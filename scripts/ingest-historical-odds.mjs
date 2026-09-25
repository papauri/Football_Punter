// Backfills historical 1X2 closing odds from football-data.co.uk onto training_data.json fixtures.
// Usage: node scripts/ingest-historical-odds.mjs   → writes data/historical_odds.json
//
// Matching: same league, kickoff date within ±1 day, identical final score, and fuzzy team-name
// similarity. The exact-score requirement makes false matches between fixtures very unlikely.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'data', 'odds_cache');
const OUT_FILE = path.join(ROOT, 'data', 'historical_odds.json');
const BASE = 'https://www.football-data.co.uk';

// football-data division code → training_data league names
const MAIN_LEAGUES = {
  E0: ['Premier League'], E1: ['Championship'], SC0: ['Scottish Premiership'],
  SP1: ['LaLiga'], SP2: ['LaLiga 2'], I1: ['Serie A'], D1: ['Bundesliga'], D2: ['2. Bundesliga'],
  F1: ['Ligue 1'], N1: ['Eredivisie'], P1: ['Primeira Liga'], B1: ['Belgian Pro League'],
  T1: ['Turkish Super Lig'], G1: ['Greek Super League']
};
// Single-file "extra" leagues (all seasons in one CSV)
const EXTRA_LEAGUES = {
  USA: ['MLS'], MEX: ['Liga MX'], BRA: ['Brasileirão'], JPN: ['Japanese J1 League'],
  SWE: ['Swedish Allsvenskan'], NOR: ['Norwegian Eliteserien'], DNK: ['Danish Superliga'],
  AUT: ['Austrian Bundesliga'], IRL: ['Irish Premier Division']
};
const SEASONS = ['2021', '2122', '2223', '2324', '2425', '2526', '2627'];

const STOP = new Set(['fc', 'cf', 'ac', 'sc', 'afc', 'cd', 'ud', 'sd', 'rc', 'club', 'de', 'the', 'fk', 'sk', 'if', 'bk', 'as', 'ss', 'us', 'vfl', 'vfb', 'tsg', 'sv', 'fsv', '1', 'calcio', 'football', 'town', 'city', 'united', 'utd']);
const ALIASES = {
  'man united': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
  "nott'm forest": 'nottingham forest', 'spurs': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
  'sheffield weds': 'sheffield wednesday', 'ath madrid': 'atletico madrid', 'ath bilbao': 'athletic club',
  'betis': 'real betis', 'sociedad': 'real sociedad', 'inter': 'internazionale', 'milan': 'ac milan',
  'paris sg': 'paris saint germain', "m'gladbach": 'borussia monchengladbach', 'ein frankfurt': 'eintracht frankfurt',
  'fc koln': 'koln', 'st pauli': 'st pauli', 'leverkusen': 'bayer leverkusen', 'dortmund': 'borussia dortmund',
  'sp lisbon': 'sporting cp', 'sp braga': 'braga', 'vitoria': 'vitoria guimaraes', 'psv eindhoven': 'psv',
  'espanol': 'espanyol', 'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'la coruna': 'deportivo la coruna'
};

function normalizeTeam(name) {
  let s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (ALIASES[s]) s = ALIASES[s];
  return s.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t)).join(' ');
}

function bigrams(s) {
  const out = new Map();
  const t = s.replace(/\s+/g, '');
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1);
  return out;
}

function similarity(a, b) {
  const x = normalizeTeam(a), y = normalizeTeam(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const bx = bigrams(x), by = bigrams(y);
  let overlap = 0, total = 0;
  for (const [k, v] of bx) { overlap += Math.min(v, by.get(k) || 0); total += v; }
  for (const v of by.values()) total += v;
  return total ? (2 * overlap) / total : 0;
}

function parseDate(d) {
  const [dd, mm, yy] = String(d).split('/').map(Number);
  if (!dd || !mm || !yy) return null;
  return Date.UTC(yy < 100 ? 2000 + yy : yy, mm - 1, dd);
}

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map(l => {
    const cells = l.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x > 1.0 ? x : null; };

// Prefer closing prices (market average → Pinnacle → Bet365), then pre-match average
function pickOdds(row) {
  const sets = [['AvgCH', 'AvgCD', 'AvgCA', 'AvgC'], ['PSCH', 'PSCD', 'PSCA', 'PSC'], ['B365CH', 'B365CD', 'B365CA', 'B365C'], ['AvgH', 'AvgD', 'AvgA', 'Avg'], ['B365H', 'B365D', 'B365A', 'B365']];
  for (const [h, d, a, src] of sets) {
    if (num(row[h]) && num(row[d]) && num(row[a])) return { h: num(row[h]), d: num(row[d]), a: num(row[a]), src };
  }
  return null;
}

async function fetchCached(url, file) {
  const target = path.join(CACHE_DIR, file);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    const ageDays = (Date.now() - fs.statSync(target).mtimeMs) / 86400000;
    if ((!file.includes('2627') && !file.startsWith('new_')) || ageDays < 1) return fs.readFileSync(target, 'utf8');
  }
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 football-punter-research' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.includes('HomeTeam') && !text.includes('Home,')) return null;
  fs.writeFileSync(target, text);
  return text;
}

async function loadOddsRows() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const rows = [];
  for (const [code, leagues] of Object.entries(MAIN_LEAGUES)) {
    for (const season of SEASONS) {
      const text = await fetchCached(`${BASE}/mmz4281/${season}/${code}.csv`, `${season}_${code}.csv`);
      if (!text) continue;
      for (const r of parseCsv(text)) {
        const ts = parseDate(r.Date);
        const odds = pickOdds(r);
        if (!ts || !odds || r.FTHG === undefined || r.FTHG === '') continue;
        rows.push({ leagues, ts, home: r.HomeTeam, away: r.AwayTeam, hg: Number(r.FTHG), ag: Number(r.FTAG), odds });
      }
    }
  }
  for (const [code, leagues] of Object.entries(EXTRA_LEAGUES)) {
    const text = await fetchCached(`${BASE}/new/${code}.csv`, `new_${code}.csv`);
    if (!text) continue;
    for (const r of parseCsv(text)) {
      const ts = parseDate(r.Date);
      const odds = pickOdds(r);
      if (!ts || !odds || r.HG === undefined || r.HG === '') continue;
      rows.push({ leagues, ts, home: r.Home, away: r.Away, hg: Number(r.HG), ag: Number(r.AG), odds });
    }
  }
  return rows;
}

async function main() {
  const training = JSON.parse(fs.readFileSync(path.join(ROOT, 'training_data.json'), 'utf8'));
  const oddsRows = await loadOddsRows();
  console.log(`Loaded ${oddsRows.length} odds rows from football-data.co.uk`);

  // Index odds rows by league name + UTC day
  const DAY = 86400000;
  const index = new Map();
  for (const r of oddsRows) {
    for (const lg of r.leagues) {
      const key = `${lg}|${Math.floor(r.ts / DAY)}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(r);
    }
  }

  const out = {};
  const coverage = {};
  let matched = 0;
  for (const m of training) {
    if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number' || !m.timestamp) continue;
    const day = Math.floor(m.timestamp / DAY);
    const cands = [day - 1, day, day + 1].flatMap(d => index.get(`${m.league}|${d}`) || [])
      .filter(r => r.hg === m.homeScore && r.ag === m.awayScore);
    let best = null, bestScore = 0;
    for (const r of cands) {
      const sh = similarity(m.home, r.home), sa = similarity(m.away, r.away);
      const score = Math.min(sh, sa) * 0.5 + (sh + sa) / 4;
      if (Math.min(sh, sa) >= 0.3 && score > bestScore) { best = r; bestScore = score; }
    }
    coverage[m.league] = coverage[m.league] || { total: 0, matched: 0 };
    coverage[m.league].total++;
    if (best) {
      out[m.id] = { h: best.odds.h, d: best.odds.d, a: best.odds.a, src: best.odds.src };
      coverage[m.league].matched++;
      matched++;
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'football-data.co.uk', matched, total: training.length, odds: out }));
  console.log(`Matched odds for ${matched}/${training.length} fixtures → ${path.relative(ROOT, OUT_FILE)}`);
  for (const [lg, c] of Object.entries(coverage).sort((a, b) => b[1].total - a[1].total).slice(0, 30)) {
    console.log(`  ${lg.padEnd(28)} ${c.matched}/${c.total} (${(c.matched / c.total * 100).toFixed(0)}%)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
