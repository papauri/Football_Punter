// Fit the goals-market model (over/under 1.5, 2.5, 3.5 and both teams to score).
//
// Usage:
//   npm run walkforward -- --from 2022-07-01 --to 2025-04-01 --goals-out /tmp/goals-early.json
//   npm run walkforward -- --goals-out /tmp/goals-recent.json
//   node scripts/fit-goals-model.mjs --train /tmp/goals-early.json --test /tmp/goals-recent.json
//
// Both inputs are walk-forward logs, so every expected-goals figure came from an engine that had
// only seen earlier fixtures. The model is fitted on --train and scored on --test, a later window
// it never saw. What ships in data/goals-model.json is then refitted on train and test together,
// so the live app uses the most recent results; the reported scores are the held-out ones.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GOALS_MARKETS, fitGoalsModel, goalsProbabilities, goalsOutcome } from '../src/model/goalsModel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? null : process.argv[i + 1]; };
const read = (f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { window: j.window, rows: j.fixtures || j }; };

const trainFile = argOf('train'), testFile = argOf('test');
if (!trainFile || !testFile) {
  console.log('Usage: node scripts/fit-goals-model.mjs --train <walk-forward goals log> --test <later goals log>');
  process.exit(1);
}
const train = read(trainFile), test = read(testFile);
const usable = (r) => Number.isFinite(r.lambda) && Number.isFinite(r.mu) && Number.isFinite(r.hg) && Number.isFinite(r.ag);
const trainRows = train.rows.filter(usable), testRows = test.rows.filter(usable);

const model = fitGoalsModel(trainRows);
const f = (x, d = 1) => Number(x).toFixed(d);
const evaluation = {};
console.log(`Fitted on ${trainRows.length} fixtures, scored on ${testRows.length} later fixtures\n`);
console.log('market  always-pick  model hit   Brier model vs guessing the average   ≥60% sure: picks, hit');
for (const k of GOALS_MARKETS) {
  const ys = testRows.map(r => (goalsOutcome(k, r.hg, r.ag) ? 1 : 0));
  const base = trainRows.filter(r => goalsOutcome(k, r.hg, r.ag)).length / trainRows.length;
  const ps = testRows.map(r => goalsProbabilities(r.lambda, r.mu, model)[k] / 100);
  const hit = ps.filter((p, i) => (p >= 0.5) === (ys[i] === 1)).length / ps.length * 100;
  const always = (base >= 0.5 ? ys.filter(Boolean).length : ys.filter(y => !y).length) / ys.length * 100;
  const brier = ps.reduce((s, p, i) => s + (p - ys[i]) ** 2, 0) / ps.length;
  const brierBase = ys.reduce((s, y) => s + (base - y) ** 2, 0) / ys.length;
  const sure = ps.map((p, i) => [Math.max(p, 1 - p), (p >= 0.5) === (ys[i] === 1)]).filter(([c]) => c >= 0.6);
  const sureHit = sure.length ? sure.filter(([, ok]) => ok).length / sure.length * 100 : null;
  evaluation[k] = { alwaysPick: +f(always), hit: +f(hit), brier: +f(brier, 4), brierBaseline: +f(brierBase, 4), confidentPicks: sure.length, confidentHit: sureHit == null ? null : +f(sureHit) };
  console.log(`${k.padEnd(6)}  ${f(always).padStart(9)}%  ${f(hit).padStart(8)}%   ${f(brier, 4)} vs ${f(brierBase, 4)}                  ${String(sure.length).padStart(5)}, ${sureHit == null ? '-' : f(sureHit) + '%'}`);
}

const shipped = fitGoalsModel([...trainRows, ...testRows]);
const out = {
  fittedAt: new Date().toISOString(),
  features: 'lambda + mu - 3, |lambda - mu|, min(lambda, mu) - 1',
  weights: shipped.weights,
  samples: shipped.samples,
  heldOut: { trainWindow: train.window, testWindow: test.window, trainSamples: trainRows.length, testSamples: testRows.length, markets: evaluation }
};
fs.writeFileSync(path.join(ROOT, 'data', 'goals-model.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nWritten to data/goals-model.json (refitted on all ${shipped.samples} fixtures for live use).`);
