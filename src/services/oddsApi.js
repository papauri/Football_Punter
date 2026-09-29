// Bookmaker prices from The Odds API, spent carefully.
//
// ESPN gives prices for roughly half of the fixtures the app lists. Prices matter more than anything
// else to the predictions (see docs/MODEL_ACCURACY.md), so the gaps are filled from The Odds API, but
// the free plan has 500 credits a month. The rules:
//   * Only competitions with an upcoming match (next 3 days) that ESPN has no price for are fetched.
//   * One request per competition, one region and one market (match result): 1 credit each.
//   * A competition is fetched at most once every 12 hours.
//   * A reserve of 40 credits is never touched, what is left is spread evenly over the days left in
//     the month, and no day spends more than 20, so the allowance cannot run out early.
// The sports list, which the app uses to find each competition's key and to read the remaining
// credits, costs nothing.
import fs from 'fs';
import path from 'path';
import { summariseBooks } from './oddsFeed.js';
import { similarity } from '../model/teamNames.js';

const API = 'https://api.the-odds-api.com/v4';
const RESERVE = 40;
const DAILY_CAP = 20;
const REFRESH_HOURS = 12;
const WINDOW_HOURS = 72;
const SPORTS_TTL = 24 * 60 * 60 * 1000;

// ESPN competition names to The Odds API keys, for names that do not match by title.
const ALIASES = {
  'Premier League': 'soccer_epl', 'Championship': 'soccer_efl_champ', 'League One': 'soccer_england_league1',
  'League Two': 'soccer_england_league2', 'English FA Cup': 'soccer_fa_cup', 'English Carabao Cup': 'soccer_england_efl_cup',
  'LaLiga': 'soccer_spain_la_liga', 'LaLiga 2': 'soccer_spain_segunda_division', 'Copa del Rey': 'soccer_spain_copa_del_rey',
  'Serie A': 'soccer_italy_serie_a', 'Serie B': 'soccer_italy_serie_b', 'Coppa Italia': 'soccer_italy_coppa_italia',
  'Bundesliga': 'soccer_germany_bundesliga', '2. Bundesliga': 'soccer_germany_bundesliga2', 'DFB-Pokal': 'soccer_germany_dfb_pokal',
  'Ligue 1': 'soccer_france_ligue_one', 'Ligue 2': 'soccer_france_ligue_two', 'Eredivisie': 'soccer_netherlands_eredivisie',
  'Primeira Liga': 'soccer_portugal_primeira_liga', 'Belgian Pro League': 'soccer_belgium_first_div',
  'Scottish Premiership': 'soccer_spl', 'Turkish Super Lig': 'soccer_turkey_super_league', 'Greek Super League': 'soccer_greece_super_league',
  'Saudi Pro League': 'soccer_saudi_arabia_pro_league', 'MLS': 'soccer_usa_mls', 'Liga MX': 'soccer_mexico_ligamx',
  'Brasileirão': 'soccer_brazil_campeonato', 'Japanese J1 League': 'soccer_japan_j_league', 'Swedish Allsvenskan': 'soccer_sweden_allsvenskan',
  'Norwegian Eliteserien': 'soccer_norway_eliteserien', 'Danish Superliga': 'soccer_denmark_superliga', 'Austrian Bundesliga': 'soccer_austria_bundesliga',
  'UEFA Champions League': 'soccer_uefa_champs_league', 'UEFA Europa League': 'soccer_uefa_europa_league',
  'UEFA Conference League': 'soccer_uefa_europa_conference_league', 'UEFA Nations League': 'soccer_uefa_nations_league'
};

let state = null;
let stateFile = null;

function load(dir) {
  if (state) return state;
  stateFile = path.join(dir, 'data', 'odds-api-state.json');
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { state = {}; }
  state.fetchedAt ||= {};
  state.events ||= {};
  state.spent ||= {};
  state.log ||= [];
  return state;
}

function save() {
  try { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(state)); } catch { /* best effort */ }
}

const today = () => new Date().toISOString().slice(0, 10);

function readCredits(res) {
  const r = res.headers.get('x-requests-remaining'), u = res.headers.get('x-requests-used');
  if (r !== null && r !== '') state.remaining = Number(r);
  if (u !== null && u !== '') state.used = Number(u);
  state.creditsCheckedAt = new Date().toISOString();
}

/** Credits the app may spend today: what is left above the reserve, spread over the rest of the month. */
function allowanceToday() {
  if (!Number.isFinite(state.remaining)) return 1 - (state.spent[today()] || 0); // unknown until the first answer
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  const spare = state.remaining - RESERVE;
  if (spare <= 0) return 0;
  // Capped per day as well, since the plan's month may not start on the 1st.
  return Math.min(DAILY_CAP, Math.max(1, Math.floor(spare / daysLeft))) - (state.spent[today()] || 0);
}

async function sportsList(key) {
  if (state.sports && Date.now() - (state.sportsAt || 0) < SPORTS_TTL) return state.sports;
  const res = await fetch(`${API}/sports/?apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`sports list HTTP ${res.status}`);
  readCredits(res);
  state.sports = (await res.json()).filter(s => String(s.key).startsWith('soccer_') && s.active && !s.has_outrights)
    .map(s => ({ key: s.key, title: s.title, description: s.description }));
  state.sportsAt = Date.now();
  return state.sports;
}

function sportFor(league, sports) {
  const alias = ALIASES[league];
  if (alias && sports.some(s => s.key === alias)) return alias;
  let best = null, score = 0;
  for (const s of sports) {
    const sc = Math.max(similarity(league, s.title), similarity(league, s.description || ''));
    if (sc > score) { best = s.key; score = sc; }
  }
  return score >= 0.85 ? best : null;
}

const hasEspnPrice = (m) => Boolean(m.odds && m.odds.homeOdds > 1 && m.odds.source !== 'the-odds-api');

/**
 * Fetch prices for competitions whose upcoming matches ESPN has not priced, within the budget.
 * @returns {Promise<{spent:number, fetched:string[], skipped:string, remaining:number|null}>}
 */
export async function fillMissingPrices(dir, matches, key = process.env.ODDS_API_KEY) {
  load(dir);
  if (!key) return { spent: 0, fetched: [], skipped: 'no key', remaining: null };
  const now = Date.now();
  const unpriced = (matches || []).filter(m => m && !m.isCompleted && !m.started && m.timestamp > now && m.timestamp - now < WINDOW_HOURS * 3600e3 && !hasEspnPrice(m));
  if (!unpriced.length) return { spent: 0, fetched: [], skipped: 'every upcoming match has an ESPN price', remaining: state.remaining ?? null };

  let sports;
  try { sports = await sportsList(key); } catch (e) { save(); return { spent: 0, fetched: [], skipped: e.message, remaining: state.remaining ?? null }; }

  const bySport = new Map();
  for (const m of unpriced) {
    const sk = sportFor(m.league, sports);
    if (sk) bySport.set(sk, (bySport.get(sk) || 0) + 1);
  }
  const queue = [...bySport.entries()].sort((a, b) => b[1] - a[1])
    .filter(([sk]) => now - (state.fetchedAt[sk] || 0) > REFRESH_HOURS * 3600e3);

  const fetched = [];
  let spent = 0;
  for (const [sk, count] of queue) {
    if (allowanceToday() <= 0) break;
    try {
      const res = await fetch(`${API}/sports/${sk}/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
      readCredits(res);
      state.spent[today()] = (state.spent[today()] || 0) + 1;
      spent++;
      state.fetchedAt[sk] = now;
      if (!res.ok) { state.log.unshift({ at: new Date().toISOString(), sport: sk, ok: false, note: `HTTP ${res.status}` }); continue; }
      const data = await res.json();
      state.events[sk] = (Array.isArray(data) ? data : []).map(ev => {
        const books = {};
        for (const bm of ev.bookmakers || []) {
          const mk = (bm.markets || []).find(x => x.key === 'h2h');
          const price = (name) => mk?.outcomes?.find(o => o.name === name)?.price;
          const h = price(ev.home_team), d = price('Draw'), a = price(ev.away_team);
          if (h > 1 && d > 1 && a > 1) books[bm.key] = { h, d, a };
        }
        return { home: ev.home_team, away: ev.away_team, commence: Date.parse(ev.commence_time), books };
      }).filter(ev => Object.keys(ev.books).length);
      fetched.push(sk);
      state.log.unshift({ at: new Date().toISOString(), sport: sk, ok: true, note: `${state.events[sk].length} matches priced, ${count} needed` });
    } catch (e) {
      state.log.unshift({ at: new Date().toISOString(), sport: sk, ok: false, note: e.message });
    }
  }
  state.log = state.log.slice(0, 30);
  // Forget spending records and events older than a week.
  for (const d of Object.keys(state.spent)) if (Date.parse(d) < now - 40 * 86400e3) delete state.spent[d];
  for (const sk of Object.keys(state.events)) state.events[sk] = state.events[sk].filter(ev => ev.commence > now - 6 * 3600e3);
  save();
  return { spent, fetched, skipped: queue.length && !fetched.length ? 'daily allowance used' : '', remaining: state.remaining ?? null };
}

/**
 * Prices for a fixture from the last fetch, in the same shape as the ESPN odds, or null.
 * The price used for predictions is the sharp book's (Pinnacle first) or else the median across books.
 */
export function pricesFor(dir, home, away, kickoffTs) {
  load(dir);
  for (const events of Object.values(state.events)) {
    for (const ev of events) {
      if (kickoffTs && Math.abs(ev.commence - kickoffTs) > 6 * 3600e3) continue;
      if (similarity(ev.home, home) < 0.8 || similarity(ev.away, away) < 0.8) continue;
      const s = summariseBooks(ev.books);
      if (!s) continue;
      const ref = s.sharp || { h: 100 / s.fairProb.home, d: 100 / s.fairProb.draw, a: 100 / s.fairProb.away };
      return {
        provider: `The Odds API (${s.bookCount} books)`,
        source: 'the-odds-api',
        homeOdds: +ref.h.toFixed(2), drawOdds: +ref.d.toFixed(2), awayOdds: +ref.a.toFixed(2),
        homeProb: +s.fairProb.home.toFixed(1), drawProb: +s.fairProb.draw.toFixed(1), awayProb: +s.fairProb.away.toFixed(1),
        marketFav: s.fairProb.home >= s.fairProb.away ? 'HOME' : 'AWAY',
        best: { home: s.best.h, draw: s.best.d, away: s.best.a },
        bookCount: s.bookCount
      };
    }
  }
  return null;
}

/** What the Settings page shows about credit use. */
export function oddsApiUsage(dir) {
  load(dir);
  return {
    remaining: Number.isFinite(state.remaining) ? state.remaining : null,
    used: Number.isFinite(state.used) ? state.used : null,
    spentToday: state.spent[today()] || 0,
    allowanceToday: Math.max(0, allowanceToday() + (state.spent[today()] || 0)),
    reserve: RESERVE,
    pricedMatches: Object.values(state.events).reduce((n, e) => n + e.length, 0),
    recent: state.log.slice(0, 5)
  };
}
