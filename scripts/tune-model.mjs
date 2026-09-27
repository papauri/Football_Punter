// Tune the model's fitting and shaping hyperparameters, and ablate the hand-written heuristics.
// Usage: node scripts/tune-model.mjs
//
// Split discipline: the most recent 9,000 fixtures are the reported holdout and are NEVER touched
// here. Tuning uses a validation window carved out of the remaining (training) fixtures, so nothing
// selected below has seen the numbers it will later be judged on. Selection is by Brier score,
// which rewards honest probabilities, with hit rate reported alongside.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');

const HOLDOUT = 9000;
const VALIDATION = 3000;

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;

const train = corpus.slice(0, -(HOLDOUT + VALIDATION));
const validation = corpus.slice(-(HOLDOUT + VALIDATION), -HOLDOUT);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-tune-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(train));
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));

// Pre-resolve the market view once; it never changes across settings.
const cases = validation.map(m => {
  const o = oddsById[m.id];
  let odds = null;
  if (o) {
    const inv = [1 / o.h, 1 / o.d, 1 / o.a];
    const book = inv[0] + inv[1] + inv[2];
    odds = {
      homeOdds: o.h, drawOdds: o.d, awayOdds: o.a,
      homeProb: inv[0] / book * 100, drawProb: inv[1] / book * 100, awayProb: inv[2] / book * 100,
      marketFav: inv[0] >= inv[2] ? 'HOME' : 'AWAY'
    };
  }
  return {
    m,
    odds,
    actual: m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW'
  };
});

// Score the model with no odds supplied, so we measure the model's own skill rather than its
// ability to echo a price.
function evaluate() {
  let hits = 0, brier = 0, n = 0, conf = 0, confHits = 0;
  for (const c of cases) {
    const p = engine.computeDixonColesProbabilities(c.m.home, c.m.away, { league: c.m.league });
    const pr = [p.home, p.draw, p.away].map(x => x / 100);
    const k = argmax(pr);
    n++;
    if (OUT[k] === c.actual) hits++;
    brier += pr.reduce((s, x, i) => s + (x - (OUT[i] === c.actual ? 1 : 0)) ** 2, 0) / 3;
    if (pr[k] >= 0.6) { conf++; if (OUT[k] === c.actual) confHits++; }
  }
  return {
    n,
    hitRate: hits / n * 100,
    brier: brier / n,
    conf,
    confHitRate: conf ? confHits / conf * 100 : null
  };
}

const fmt = s => `Brier ${s.brier.toFixed(4)}  hit ${s.hitRate.toFixed(1)}%  fav>=60%: ${String(s.conf).padStart(4)} @ ${s.confHitRate == null ? '--' : s.confHitRate.toFixed(1) + '%'}`;
const hp = engine.hyperparameters;
const baselineHp = { ...hp };

console.log(`Train ${train.length}  |  Validation ${validation.length}  |  Holdout (untouched) ${HOLDOUT}`);
console.log(`Validation fixtures with closing odds: ${cases.filter(c => c.odds).length}\n`);

let best = { label: 'baseline', brier: Infinity, settings: {} };
const consider = (label, settings, s) => {
  const flag = s.brier < best.brier ? '  <-- best so far' : '';
  console.log(`  ${label.padEnd(34)} ${fmt(s)}${flag}`);
  if (s.brier < best.brier) best = { label, brier: s.brier, settings: { ...settings } };
};

console.log('BASELINE (current hyperparameters, fitted strengths)');
const base = evaluate();
consider('baseline', {}, base);

// ---- 1. Strength fit: recency half-life and shrinkage --------------------------------------------
console.log('\nSTRENGTH FIT — recency half-life (days)');
for (const halfLifeDays of [120, 180, 240, 365, 540, 730]) {
  engine.applyFittedTeamStrengths({ halfLifeDays, priorGames: hp.strengthPriorGames ?? 8 });
  consider(`halfLife=${halfLifeDays}`, { strengthHalfLifeDays: halfLifeDays }, evaluate());
}
const bestHalfLife = best.settings.strengthHalfLifeDays ?? 240;

console.log('\nSTRENGTH FIT — shrinkage prior (phantom games)');
for (const priorGames of [2, 4, 8, 12, 20]) {
  engine.applyFittedTeamStrengths({ halfLifeDays: bestHalfLife, priorGames });
  consider(`prior=${priorGames}`, { strengthHalfLifeDays: bestHalfLife, strengthPriorGames: priorGames }, evaluate());
}
const bestPrior = best.settings.strengthPriorGames ?? 8;
engine.applyFittedTeamStrengths({ halfLifeDays: bestHalfLife, priorGames: bestPrior });

// How much of the fitted response should come from expected goals rather than goals scored. Only
// the top-five-league fixtures have xG, so this trades finishing noise for chance quality on roughly
// a third of the corpus and leaves the rest as it was.
const xgAvailable = Object.keys(engine.loadHistoricalXg() || {}).length;
console.log(`\nSTRENGTH FIT — expected-goals weight (xG available for ${xgAvailable} fixtures)`);
if (xgAvailable > 500) {
  for (const xgWeight of [0, 0.25, 0.5, 0.75, 1.0]) {
    engine.applyFittedTeamStrengths({ halfLifeDays: bestHalfLife, priorGames: bestPrior, xgWeight });
    consider(`xgWeight=${xgWeight}`, { strengthHalfLifeDays: bestHalfLife, strengthPriorGames: bestPrior, xgWeight }, evaluate());
  }
} else {
  console.log('  skipped — run npm run xg:ingest first');
}
const bestXgWeight = best.settings.xgWeight ?? 0;
engine.applyFittedTeamStrengths({ halfLifeDays: bestHalfLife, priorGames: bestPrior, xgWeight: bestXgWeight });

// ---- 2. Shaping parameters ---------------------------------------------------------------------
console.log('\nSHAPE — Dixon-Coles low-score correction rho');
for (const dixonColesRho of [-0.25, -0.174, -0.10, -0.05, 0]) {
  hp.dixonColesRho = dixonColesRho;
  consider(`rho=${dixonColesRho}`, { ...best.settings, dixonColesRho }, evaluate());
}
hp.dixonColesRho = best.settings.dixonColesRho ?? baselineHp.dixonColesRho;
hp.xgWeight = bestXgWeight;

console.log('\nSHAPE — softmax temperature (>1 flattens, <1 sharpens)');
for (const temperature of [1.0, 1.15, 1.3, 1.45, 1.6]) {
  hp.temperature = temperature;
  consider(`temperature=${temperature}`, { ...best.settings, temperature }, evaluate());
}
hp.temperature = best.settings.temperature ?? baselineHp.temperature;

console.log('\nSHAPE — home advantage');
for (const homeAdvantage of [1.05, 1.10, 1.156, 1.22, 1.30]) {
  hp.homeAdvantage = homeAdvantage;
  consider(`homeAdvantage=${homeAdvantage}`, { ...best.settings, homeAdvantage }, evaluate());
}
hp.homeAdvantage = best.settings.homeAdvantage ?? baselineHp.homeAdvantage;

// ---- 3. Ablate the hand-written heuristics -----------------------------------------------------
// These were written as magic numbers with no measurement behind them. Each is worth keeping only
// if switching it off makes the validation score worse.
console.log('\nABLATION — head-to-head weight (0 disables the H2H layer entirely)');
for (const h2hWeight of [0, 0.08, 0.16, 0.25]) {
  hp.h2hWeight = h2hWeight;
  consider(`h2hWeight=${h2hWeight}`, { ...best.settings, h2hWeight }, evaluate());
}
hp.h2hWeight = best.settings.h2hWeight ?? baselineHp.h2hWeight;

console.log('\nABLATION — form delta weight');
for (const formDeltaWeight of [0, 0.06, 0.12, 0.2]) {
  hp.formDeltaWeight = formDeltaWeight;
  consider(`formDeltaWeight=${formDeltaWeight}`, { ...best.settings, formDeltaWeight }, evaluate());
}
hp.formDeltaWeight = best.settings.formDeltaWeight ?? baselineHp.formDeltaWeight;

console.log('\nABLATION — Elo weight in the blend');
for (const eloRatio of [0, 0.25, 0.5, 0.75]) {
  hp.eloRatio = eloRatio;
  consider(`eloRatio=${eloRatio}`, { ...best.settings, eloRatio }, evaluate());
}
hp.eloRatio = best.settings.eloRatio ?? baselineHp.eloRatio;

console.log('\nABLATION — goal overdispersion r (higher = closer to plain Poisson)');
for (const goalOverdispersionR of [2.5, 4.5, 8, 1000]) {
  hp.goalOverdispersionR = goalOverdispersionR;
  consider(`overdispersionR=${goalOverdispersionR}`, { ...best.settings, goalOverdispersionR }, evaluate());
}
hp.goalOverdispersionR = best.settings.goalOverdispersionR ?? baselineHp.goalOverdispersionR;

// ---- result -----------------------------------------------------------------------------------
console.log(`\nBEST ON VALIDATION: ${best.label}  Brier ${best.brier.toFixed(4)}`);
console.log('Settings to apply:');
console.log(JSON.stringify(best.settings, null, 2));
console.log(`\nBaseline Brier was ${base.brier.toFixed(4)}; improvement ${((base.brier - best.brier) / base.brier * 100).toFixed(2)}%`);

const outPath = path.join(ROOT, 'data', 'tuned-hyperparameters.json');
fs.writeFileSync(outPath, JSON.stringify({
  tunedAt: new Date().toISOString(),
  trainMatches: train.length,
  validationMatches: validation.length,
  holdoutReserved: HOLDOUT,
  baseline: { brier: base.brier, hitRate: base.hitRate, confHitRate: base.confHitRate },
  best: { label: best.label, brier: best.brier },
  settings: best.settings
}, null, 2));
console.log(`\nWritten to ${path.relative(ROOT, outPath)} (not applied automatically — review, then move into hyperparameters.json)`);
process.exit(0);
