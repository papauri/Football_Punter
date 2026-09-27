// Does fitting on expected goals beat fitting on goals scored?
// Usage: npm run xg:ablation
//
// The all-leagues figure hides the answer: understat covers the top five European leagues and
// nothing else, so roughly two thirds of the corpus has no xG and cannot move either way. This
// measures the xG-covered leagues on their own, which is the only place the change can show up, and
// reports the bookmaker's hit rate on the same fixtures so the comparison means something.
//
// Reported on the validation window (the 3,000 fixtures before the 9,000-fixture holdout), so the
// decision of whether to ship xG is not made on the numbers used to report final performance.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');

const HOLDOUT = 9000;
const VALIDATION = 3000;
// --window holdout runs the same comparison on the reserved holdout instead. That is a CONFIRMATORY
// measurement only: whether xG ships is decided on the validation window, and re-tuning against
// holdout output would destroy the one clean read we have.
const USE_HOLDOUT = process.argv.includes('--window') && process.argv[process.argv.indexOf('--window') + 1] === 'holdout';

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;
const xgFile = JSON.parse(fs.readFileSync('data/historical_xg.json', 'utf8'));
const xgById = xgFile.xg || {};

const train = USE_HOLDOUT ? corpus.slice(0, -HOLDOUT) : corpus.slice(0, -(HOLDOUT + VALIDATION));
const validation = USE_HOLDOUT ? corpus.slice(-HOLDOUT) : corpus.slice(-(HOLDOUT + VALIDATION), -HOLDOUT);

// Leagues understat actually covers, taken from the ingested data rather than assumed.
const xgLeagues = new Set();
for (const m of corpus) if (xgById[m.id]) xgLeagues.add(m.league);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-xgabl-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(train));
fs.mkdirSync(path.join(trainDir, 'data'), { recursive: true });
if (fs.existsSync('data/calibration.json')) fs.copyFileSync('data/calibration.json', path.join(trainDir, 'data', 'calibration.json'));
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));

const cases = validation.map(m => {
  const o = oddsById[m.id];
  let market = null;
  if (o) {
    const inv = [1 / o.h, 1 / o.d, 1 / o.a];
    const s = inv[0] + inv[1] + inv[2];
    market = inv.map(x => x / s);
  }
  return {
    m,
    market,
    inXgLeague: xgLeagues.has(m.league),
    actual: m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW'
  };
});

function score(list) {
  let hits = 0, brier = 0, conf = 0, confHits = 0;
  for (const c of list) {
    const p = engine.computeDixonColesProbabilities(c.m.home, c.m.away, { league: c.m.league });
    const pr = [p.home, p.draw, p.away].map(x => x / 100);
    const k = argmax(pr);
    if (OUT[k] === c.actual) hits++;
    brier += pr.reduce((s, x, i) => s + (x - (OUT[i] === c.actual ? 1 : 0)) ** 2, 0) / 3;
    if (pr[k] >= 0.6) { conf++; if (OUT[k] === c.actual) confHits++; }
  }
  return {
    n: list.length,
    hit: list.length ? hits / list.length * 100 : 0,
    brier: list.length ? brier / list.length : NaN,
    conf,
    confHit: conf ? confHits / conf * 100 : null
  };
}
function marketScore(list) {
  const withOdds = list.filter(c => c.market);
  let hits = 0, brier = 0;
  for (const c of withOdds) {
    if (OUT[argmax(c.market)] === c.actual) hits++;
    brier += c.market.reduce((s, x, i) => s + (x - (OUT[i] === c.actual ? 1 : 0)) ** 2, 0) / 3;
  }
  return { n: withOdds.length, hit: withOdds.length ? hits / withOdds.length * 100 : 0, brier: withOdds.length ? brier / withOdds.length : NaN };
}

const inXg = cases.filter(c => c.inXgLeague);
const outXg = cases.filter(c => !c.inXgLeague);
const hp = engine.hyperparameters;
const halfLife = hp.strengthHalfLifeDays ?? 240;
const prior = hp.strengthPriorGames ?? 8;

console.log(`${USE_HOLDOUT ? 'HOLDOUT (confirmatory)' : 'Validation'} window: ${cases.length} fixtures`);
console.log(`  in xG-covered leagues:  ${inXg.length}  (${[...xgLeagues].join(', ')})`);
console.log(`  not covered by xG:      ${outXg.length}`);
console.log(`xG ingested for ${Object.keys(xgById).length} fixtures across the corpus\n`);

const fmt = s => `hit ${s.hit.toFixed(1)}%  Brier ${s.brier.toFixed(4)}  fav>=60%: ${String(s.conf).padStart(3)} @ ${s.confHit == null ? '--' : s.confHit.toFixed(1) + '%'}`;

const rows = [];
for (const xgWeight of [0, 0.25, 0.5, 0.75, 1]) {
  engine.applyFittedTeamStrengths({ halfLifeDays: halfLife, priorGames: prior, xgWeight });
  rows.push({ xgWeight, inXg: score(inXg), outXg: score(outXg), all: score(cases) });
}

console.log('XG-COVERED LEAGUES ONLY — the only place xG can change anything');
for (const r of rows) console.log(`  xgWeight ${String(r.xgWeight).padEnd(5)} ${fmt(r.inXg)}`);
const mk = marketScore(inXg);
console.log(`  BOOKMAKER      hit ${mk.hit.toFixed(1)}%  Brier ${mk.brier.toFixed(4)}   (on the ${mk.n} of these with closing odds)`);

console.log('\nLEAGUES WITH NO XG — should be unchanged, so this is the control');
for (const r of rows) console.log(`  xgWeight ${String(r.xgWeight).padEnd(5)} ${fmt(r.outXg)}`);

console.log('\nALL LEAGUES COMBINED');
for (const r of rows) console.log(`  xgWeight ${String(r.xgWeight).padEnd(5)} ${fmt(r.all)}`);

const base = rows.find(r => r.xgWeight === 0);
const best = rows.slice().sort((a, b) => a.inXg.brier - b.inXg.brier)[0];
console.log(`\nOn xG-covered leagues: goals-only Brier ${base.inXg.brier.toFixed(4)} -> best ${best.inXg.brier.toFixed(4)} at xgWeight ${best.xgWeight}`);
console.log(`                       goals-only hit ${base.inXg.hit.toFixed(1)}% -> ${best.inXg.hit.toFixed(1)}%`);
const gapBefore = base.inXg.hit - mk.hit;
const gapAfter = best.inXg.hit - mk.hit;
console.log(`Gap to the bookmaker on these leagues: ${gapBefore.toFixed(1)} -> ${gapAfter.toFixed(1)} points`);
if (USE_HOLDOUT) {
  console.log('\nNote: confirmatory run on the holdout. Do not tune against these numbers.');
} else {
  console.log('\nNote: these are validation figures, used to decide whether to ship xG.');
  console.log('Final performance is reported by npm run hitrate on the untouched holdout.');
}
process.exit(0);
