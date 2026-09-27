// Build the corners and cards model from football-data.co.uk match statistics.
//
// Usage: npm run stats:fit            (writes data/match-stats.json, the copy kept in git)
//        node scripts/fit-match-stats.mjs --out data/match-stats.live.json
//                                        (what the server runs daily; the app uses the newer file)
//
// Reads the season files cached by `npm run odds:ingest` in data/odds_cache (the current season is
// fetched again when the cached copy is more than a day old). Every match is replayed in date order;
// matches from 2024-25 onwards are also scored using only what the model knew before kick-off, and
// those scores are what the report shows. The ratings after the last match are written to
// data/match-stats.json for the app to use.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatchStatsModel, probOver, statPicks, pickHit, CORNER_LINES, CARD_LINES } from '../src/model/matchStats.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'data', 'odds_cache');
const BASE = 'https://www.football-data.co.uk';
const LEAGUES = {
  E0: 'Premier League', E1: 'Championship', SC0: 'Scottish Premiership', SP1: 'LaLiga', SP2: 'LaLiga 2',
  I1: 'Serie A', D1: 'Bundesliga', D2: '2. Bundesliga', F1: 'Ligue 1', N1: 'Eredivisie', P1: 'Primeira Liga',
  B1: 'Belgian Pro League', T1: 'Turkish Super Lig', G1: 'Greek Super League'
};
const SEASONS = ['2021', '2122', '2223', '2324', '2425', '2526', '2627'];
const TEST_FROM = '2425';
const CURRENT = SEASONS[SEASONS.length - 1];

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map(l => { const c = l.split(','); const r = {}; header.forEach((h, i) => { r[h] = c[i]; }); return r; });
}
const parseDate = (d) => { const [dd, mm, yy] = String(d).split('/').map(Number); return dd && mm && yy ? Date.UTC(yy < 100 ? 2000 + yy : yy, mm - 1, dd) : null; };
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

async function seasonFile(season, code) {
  const file = path.join(CACHE_DIR, `${season}_${code}.csv`);
  const fresh = fs.existsSync(file) && (season !== CURRENT || Date.now() - fs.statSync(file).mtimeMs < 86400000);
  if (!fresh) {
    try {
      const res = await fetch(`${BASE}/mmz4281/${season}/${code}.csv`, { signal: AbortSignal.timeout(30000) });
      const text = res.ok ? await res.text() : '';
      if (text.includes('HomeTeam')) { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(file, text); }
    } catch { /* fall back to whatever is cached */ }
  }
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const matches = [];
for (const code of Object.keys(LEAGUES)) {
  for (const season of SEASONS) {
    const text = await seasonFile(season, code);
    if (!text) continue;
    for (const r of parseCsv(text)) {
      const t = parseDate(r.Date);
      const hc = num(r.HC), ac = num(r.AC), hy = num(r.HY), ay = num(r.AY);
      if (!t || !r.HomeTeam || hc == null || ac == null || hy == null || ay == null) continue;
      matches.push({ t, season, lg: code, home: r.HomeTeam, away: r.AwayTeam, hc, ac, hk: hy + (num(r.HR) || 0), ak: ay + (num(r.AR) || 0) });
    }
  }
}
matches.sort((a, b) => a.t - b.t);
if (!matches.length) { console.log('No cached season files. Run `npm run odds:ingest` first.'); process.exit(1); }

const model = new MatchStatsModel();
const scored = [];
for (const m of matches) {
  const e = model.expect(m.lg, m.home, m.away);
  if (e && m.season >= TEST_FROM) scored.push({ m, e });
  model.update(m);
}

const f = (x, d = 1) => Number(x).toFixed(d);
function report(label, lines, total, mean, shape) {
  const out = {};
  console.log(`\n${label}: line   always-pick  model hit   Brier model vs league-wide rate   ≥60% sure: picks, hit`);
  for (const l of lines) {
    const ys = scored.map(({ m }) => (total(m) > l ? 1 : 0));
    const base = ys.reduce((s, y) => s + y, 0) / ys.length;
    const ps = scored.map(({ e }) => probOver(mean(e), l, shape));
    const right = (p, y) => (p >= 0.5) === (y === 1);
    const hit = ps.filter((p, i) => right(p, ys[i])).length / ps.length * 100;
    const brier = ps.reduce((s, p, i) => s + (p - ys[i]) ** 2, 0) / ps.length;
    const brierBase = ys.reduce((s, y) => s + (base - y) ** 2, 0) / ys.length;
    const sure = ps.map((p, i) => [Math.max(p, 1 - p), right(p, ys[i])]).filter(([c]) => c >= 0.6);
    const sureHit = sure.length ? sure.filter(([, ok]) => ok).length / sure.length * 100 : null;
    out[l] = { alwaysPick: +f(Math.max(base, 1 - base) * 100), hit: +f(hit), brier: +f(brier, 4), brierBaseline: +f(brierBase, 4), confidentPicks: sure.length, confidentHit: sureHit == null ? null : +f(sureHit) };
    console.log(`${String(l).padStart(12)}  ${f(out[l].alwaysPick).padStart(9)}%  ${f(hit).padStart(8)}%   ${f(brier, 4)} vs ${f(brierBase, 4)}                   ${String(sure.length).padStart(5)}, ${sureHit == null ? '-' : f(sureHit) + '%'}`);
  }
  return out;
}
console.log(`${matches.length} matches; ${scored.length} from ${TEST_FROM.slice(0, 2)}-${TEST_FROM.slice(2)} onwards scored before kick-off`);
const corners = report('Total corners', CORNER_LINES, m => m.hc + m.ac, e => e.homeCorners + e.awayCorners, model.p.cornersShape);
const cards = report('Total cards', CARD_LINES, m => m.hk + m.ak, e => e.homeCards + e.awayCards, model.p.cardsShape);

// The page shows each fixture's most likely corners or cards pick, so that is the track record
// that matters: how often the single strongest pick per match came in, overall and by how sure it was.
const tops = scored.map(({ m, e }) => {
  const pick = statPicks(e, model.p)[0];
  return { m, pick, hit: pickHit(pick, m.hc + m.ac, m.hk + m.ak) };
});
const band = (lo, hi) => {
  const b = tops.filter(t => t.pick.prob >= lo && t.pick.prob < hi);
  return { from: lo * 100, to: hi * 100, picks: b.length, hit: b.length ? +f(b.filter(t => t.hit).length / b.length * 100) : null };
};
const topPick = { picks: tops.length, hit: +f(tops.filter(t => t.hit).length / tops.length * 100), bands: [band(0.6, 0.7), band(0.7, 0.8), band(0.8, 1.01)] };
console.log(`\nStrongest pick per match: ${topPick.picks} picks, ${topPick.hit}% came in`);
for (const b of topPick.bands) console.log(`  shown ${b.from}-${Math.min(b.to, 100)}%: ${b.picks} picks, ${b.hit}% came in`);
const label = (p) => `${p.side === 'OVER' ? 'Over' : 'Under'} ${p.line} ${p.market === 'CORNERS' ? 'corners' : 'cards'}`;
const recent = tops.slice(-40).reverse().map(({ m, pick, hit }) => ({
  date: new Date(m.t).toISOString().slice(0, 10), league: LEAGUES[m.lg], home: m.home, away: m.away, market: pick.market,
  pick: label(pick), chance: +f(pick.prob * 100), hit,
  result: `${m.hc + m.ac} corners, ${m.hk + m.ak} cards`
}));

const out = {
  fittedAt: new Date().toISOString(),
  lastMatch: new Date(matches[matches.length - 1].t).toISOString().slice(0, 10),
  leagueNames: LEAGUES,
  ...model.toJSON(),
  heldOut: { from: TEST_FROM, matches: scored.length, corners, cards, topPick },
  recent
};
for (const t of Object.values(out.teams)) for (const k of ['cf', 'ca', 'kf', 'ka']) t[k] = +t[k].toFixed(4);
for (const L of Object.values(out.leagues)) for (const k of ['hc', 'ac', 'hk', 'ak']) L[k] = +L[k].toFixed(3);
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx === -1 ? path.join(ROOT, 'data', 'match-stats.json') : path.resolve(process.argv[outIdx + 1]);
fs.writeFileSync(outFile, JSON.stringify(out) + '\n');
console.log(`\nWritten to ${path.relative(ROOT, outFile)} (${Object.keys(out.teams).length} teams, ratings as of ${out.lastMatch}).`);
