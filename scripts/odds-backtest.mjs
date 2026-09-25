// Out-of-sample comparison of the model against bookmaker closing odds (data/historical_odds.json).
// Usage: node scripts/odds-backtest.mjs
//
// Temporal split as in verify-build.mjs: the engine is trained on fixtures before the most recent
// 9,000, which are then scored. The model/market blend weight is tuned on the first half of the
// test window and reported on the second half, so the reported figures never see their own tuning.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');
const { getLeaguePredictabilityTier, isLeagueSolid } = await import('../src/utils/leagueUtils.js');

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;
const test = corpus.slice(-9000);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-odds-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(corpus.slice(0, -9000)));
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const OUTCOMES = ['HOME', 'DRAW', 'AWAY'];
const rows = [];
for (const m of test) {
  const o = oddsById[m.id];
  if (!o) continue;
  const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
  const inv = [1 / o.h, 1 / o.d, 1 / o.a];
  const book = inv.reduce((s, x) => s + x, 0);
  const market = inv.map(x => x / book); // de-vigged implied probabilities
  const marketOpt = {
    homeOdds: o.h, drawOdds: o.d, awayOdds: o.a,
    homeProb: market[0] * 100, drawProb: market[1] * 100, awayProb: market[2] * 100,
    marketFav: market[0] >= market[2] ? 'HOME' : 'AWAY'
  };
  const live = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, odds: marketOpt });
  rows.push({
    league: m.league,
    tier1: getLeaguePredictabilityTier(m.league)?.tier === 1,
    solid: isLeagueSolid(m.league),
    actual,
    model: [p.home, p.draw, p.away].map(x => x / 100),
    liveBlend: [live.home, live.draw, live.away].map(x => x / 100),
    market,
    odds: [o.h, o.d, o.a]
  });
}

const blend = (r, w) => r.model.map((x, i) => (1 - w) * x + w * r.market[i]);
const argmax = (v) => v.indexOf(Math.max(...v));
function score(list, probsOf) {
  let hits = 0, brier = 0, conf = 0, confHits = 0;
  for (const r of list) {
    const pr = probsOf(r);
    const k = argmax(pr);
    if (OUTCOMES[k] === r.actual) hits++;
    brier += pr.reduce((s, x, i) => s + (x - (OUTCOMES[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
    if (k !== 1 && pr[k] >= 0.6) { conf++; if (OUTCOMES[k] === r.actual) confHits++; }
  }
  return { hitRate: hits / list.length * 100, brier: brier / list.length, conf, confHitRate: conf ? confHits / conf * 100 : null };
}
// Flat 1-unit stakes at closing odds on outcomes where probability × odds exceeds 1 + edge
function roi(list, probsOf, edge) {
  let staked = 0, returned = 0;
  for (const r of list) {
    const pr = probsOf(r);
    for (let i = 0; i < 3; i++) {
      if (pr[i] * r.odds[i] > 1 + edge) {
        staked++;
        if (OUTCOMES[i] === r.actual) returned += r.odds[i];
      }
    }
  }
  return { bets: staked, roi: staked ? (returned - staked) / staked * 100 : null };
}

const half = Math.floor(rows.length / 2);
const tune = rows.slice(0, half), holdout = rows.slice(half);
let bestW = 0, bestBrier = Infinity;
for (let w = 0; w <= 1.0001; w += 0.05) {
  const b = score(tune, r => blend(r, w)).brier;
  if (b < bestBrier) { bestBrier = b; bestW = +w.toFixed(2); }
}

const fmt = (s) => `hit ${s.hitRate.toFixed(1)}%  Brier ${s.brier.toFixed(4)}  fav≥60%: ${s.conf} picks @ ${s.confHitRate == null ? '—' : s.confHitRate.toFixed(1) + '%'}`;
const fmtRoi = (r) => `${r.bets} bets, ROI ${r.roi == null ? '—' : r.roi.toFixed(1) + '%'}`;
console.log(`Fixtures with closing odds in the 9,000-match test window: ${rows.length}`);
console.log(`Blend weight tuned on first ${tune.length}: w_market = ${bestW}`);
console.log(`\nHOLDOUT (last ${holdout.length} fixtures, never used for tuning):`);
console.log(`  Model only (no odds)        ${fmt(score(holdout, r => r.model))}`);
console.log(`  Market only (closing odds)  ${fmt(score(holdout, r => r.market))}`);
console.log(`  Current live blend (engine) ${fmt(score(holdout, r => r.liveBlend))}`);
console.log(`  Tuned blend (w=${bestW})       ${fmt(score(holdout, r => blend(r, bestW)))}`);
console.log(`\nValue betting at closing odds (flat stakes, holdout):`);
for (const edge of [0.0, 0.05, 0.10]) {
  console.log(`  edge >${(edge * 100).toFixed(0)}%  model: ${fmtRoi(roi(holdout, r => r.model, edge))}  |  live blend: ${fmtRoi(roi(holdout, r => r.liveBlend, edge))}  |  tuned blend: ${fmtRoi(roi(holdout, r => blend(r, bestW), edge))}`);
}
console.log(`  Backing the market favourite every game: ${fmtRoi({ bets: holdout.length, roi: holdout.reduce((s, r) => { const k = argmax(r.market); return s + (OUTCOMES[k] === r.actual ? r.odds[k] : 0); }, 0) / holdout.length * 100 - 100 })}`);

// Trusted-league segments (league lists in src/utils/leagueUtils.js), holdout only
console.log(`\nBY LEAGUE GROUP (holdout):`);
const segments = [
  ['Tier 1 (High Edge)', r => r.tier1],
  ['Solid leagues', r => r.solid],
  ['Everything else', r => !r.solid && !r.tier1]
];
for (const [label, keep] of segments) {
  const seg = holdout.filter(keep);
  if (seg.length < 50) continue;
  const mo = score(seg, r => r.model), mk = score(seg, r => r.market);
  console.log(`  ${label} (n=${seg.length})`);
  console.log(`    model  ${fmt(mo)}  |  value bets: ${fmtRoi(roi(seg, r => r.model, 0.05))}`);
  console.log(`    market ${fmt(mk)}`);
}
process.exit(0);
