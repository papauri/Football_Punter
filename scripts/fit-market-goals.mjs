// Fit the goals markets (over/under 1.5, 2.5, 3.5, both teams to score) on expected goals implied by
// bookmaker match-result prices.
//
// Usage: npm run goals:fit-market
//
// Reads the season files in data/odds_cache (run `npm run odds:ingest` first). For every match the
// opening match-result prices are turned into expected goals (src/model/marketGoals.js), and the same
// small per-market model as the goals model (src/model/goalsModel.js) is fitted on seasons before
// 2024-25 and scored on 2024-25 onwards. What ships in data/goals-model-market.json is refitted on
// every season; the reported scores are the held-out ones.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GOALS_MARKETS, fitGoalsModel, goalsProbabilities, goalsOutcome } from '../src/model/goalsModel.js';
import { impliedGoals, fairProbs } from '../src/model/marketGoals.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'data', 'odds_cache');
const TEST_FROM = '2425';

const parseCsv = (text) => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map(l => { const c = l.split(','); const r = {}; header.forEach((h, i) => { r[h] = c[i]; }); return r; });
};
const odds3 = (r, a, b, c) => [r[a], r[b], r[c]].map(Number).every(x => x > 1) ? [r[a], r[b], r[c]].map(Number) : null;

const rows = [];
for (const file of fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR) : []) {
  const m = file.match(/^(\d{4})_[A-Z0-9]+\.csv$/);
  if (!m) continue;
  for (const r of parseCsv(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'))) {
    const o = odds3(r, 'AvgH', 'AvgD', 'AvgA') || odds3(r, 'B365H', 'B365D', 'B365A');
    if (!o || r.FTHG === '' || r.FTHG == null) continue;
    const [h, d, a] = fairProbs(o);
    const g = impliedGoals({ h, d, a });
    if (g) rows.push({ season: m[1], lambda: g.lambda, mu: g.mu, hg: Number(r.FTHG), ag: Number(r.FTAG) });
  }
}
if (!rows.length) { console.log('No cached season files. Run `npm run odds:ingest` first.'); process.exit(1); }

const train = rows.filter(r => r.season < TEST_FROM), test = rows.filter(r => r.season >= TEST_FROM);
const model = fitGoalsModel(train);
const f = (x, d = 1) => Number(x).toFixed(d);
const evaluation = {};
console.log(`Fitted on ${train.length} matches, scored on ${test.length} later matches\n`);
console.log('market  always-pick  model hit   Brier model vs guessing the average   ≥60% sure: picks, hit');
for (const k of GOALS_MARKETS) {
  const ys = test.map(r => (goalsOutcome(k, r.hg, r.ag) ? 1 : 0));
  const base = train.filter(r => goalsOutcome(k, r.hg, r.ag)).length / train.length;
  const ps = test.map(r => goalsProbabilities(r.lambda, r.mu, model)[k] / 100);
  const hit = ps.filter((p, i) => (p >= 0.5) === (ys[i] === 1)).length / ps.length * 100;
  const always = (base >= 0.5 ? ys.filter(Boolean).length : ys.filter(y => !y).length) / ys.length * 100;
  const brier = ps.reduce((s, p, i) => s + (p - ys[i]) ** 2, 0) / ps.length;
  const brierBase = ys.reduce((s, y) => s + (base - y) ** 2, 0) / ys.length;
  const sure = ps.map((p, i) => [Math.max(p, 1 - p), (p >= 0.5) === (ys[i] === 1)]).filter(([c]) => c >= 0.6);
  const sureHit = sure.length ? sure.filter(([, ok]) => ok).length / sure.length * 100 : null;
  evaluation[k] = { alwaysPick: +f(always), hit: +f(hit), brier: +f(brier, 4), brierBaseline: +f(brierBase, 4), confidentPicks: sure.length, confidentHit: sureHit == null ? null : +f(sureHit) };
  console.log(`${k.padEnd(6)}  ${f(always).padStart(9)}%  ${f(hit).padStart(8)}%   ${f(brier, 4)} vs ${f(brierBase, 4)}                  ${String(sure.length).padStart(5)}, ${sureHit == null ? '-' : f(sureHit) + '%'}`);
}

const shipped = fitGoalsModel(rows);
fs.writeFileSync(path.join(ROOT, 'data', 'goals-model-market.json'), JSON.stringify({
  fittedAt: new Date().toISOString(),
  source: 'expected goals implied by opening match-result prices (src/model/marketGoals.js)',
  features: 'lambda + mu - 3, |lambda - mu|, min(lambda, mu) - 1',
  weights: shipped.weights,
  samples: shipped.samples,
  heldOut: { testFrom: TEST_FROM, trainSamples: train.length, testSamples: test.length, markets: evaluation }
}, null, 2) + '\n');
console.log(`\nWritten to data/goals-model-market.json (refitted on all ${shipped.samples} matches).`);
