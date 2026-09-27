// Fit the probability calibration map that makes displayed confidence mean what it says.
// Usage: node scripts/fit-calibration.mjs [--reserve 9000] [--window 3000]
//
// The model was overconfident where it mattered: fixtures graded 72%+ came in at 67.8% out of
// sample, and the 72%+ bucket was no better than the 65%+ one. This fits a monotonic map from the
// model's stated probability to the rate actually observed.
//
// Split discipline. The map must be built from predictions the engine could not have memorised, so
// a whole engine is loaded on earlier fixtures only — that isolates not just team strengths but the
// head-to-head index, league profiles and predictability metrics, all of which otherwise leak.
//
//   [ ............ train ............ ][ fit window ][ ..... reserved holdout ..... ]
//
//   train        engine is built from these fixtures alone
//   fit window   predicted by that engine; claimed probability vs outcome builds the map
//   reserved     excluded entirely, so scripts/hitrate-vs-book.mjs and scripts/odds-backtest.mjs
//                still report on fixtures neither the model nor the map has seen
//
// Keep --reserve at or above the holdout those scripts use (9,000) while you are measuring. Once
// you trust the numbers, refit with --reserve 0 to bring the map right up to the latest results for
// live use; the evaluation scripts will then warn that their window overlaps the fit.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { fitCalibration } from '../src/model/calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};
const RESERVE = arg('reserve', 9000);
const WINDOW = arg('window', 3000);

const { engine } = await import('../engine.js');

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

const reserved = RESERVE > 0 ? corpus.slice(-RESERVE) : [];
const upToWindow = RESERVE > 0 ? corpus.slice(0, -RESERVE) : corpus;
const fitWindow = upToWindow.slice(-WINDOW);
const train = upToWindow.slice(0, -WINDOW);

if (train.length < 2000 || fitWindow.length < 500) {
  console.error(`Not enough data: train=${train.length}, fitWindow=${fitWindow.length}. Lower --reserve or --window.`);
  process.exit(1);
}

const stamp = (m) => (m?.timestamp ? new Date(m.timestamp).toISOString().slice(0, 10) : 'unknown');
console.log(`Corpus ${corpus.length} fixtures`);
console.log(`  train       ${String(train.length).padStart(6)}  ${stamp(train[0])} .. ${stamp(train[train.length - 1])}`);
console.log(`  fit window  ${String(fitWindow.length).padStart(6)}  ${stamp(fitWindow[0])} .. ${stamp(fitWindow[fitWindow.length - 1])}`);
console.log(`  reserved    ${String(reserved.length).padStart(6)}  ${reserved.length ? `${stamp(reserved[0])} .. ${stamp(reserved[reserved.length - 1])}` : '(none — map will overlap the evaluation holdout)'}`);

// Build the engine from the training slice alone.
const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-calib-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(train));
fs.mkdirSync(path.join(trainDir, 'data'), { recursive: true });
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

// No odds are supplied: we are calibrating the model's own opinion, not its ability to echo a price.
// skipCalibration keeps any previously loaded map out of its own training data.
const OUTCOMES = ['HOME', 'DRAW', 'AWAY'];
const samples = [];
let favHits = 0, favClaimed = 0;
for (const m of fitWindow) {
  const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, skipCalibration: true });
  const trio = [p.home, p.draw, p.away];
  // Every outcome contributes, not just the favourite: calibrating the whole distribution is what
  // fixes the Brier score, and favourites alone would leave the map no shape below about 35%.
  for (let i = 0; i < 3; i++) samples.push({ p: trio[i] / 100, hit: OUTCOMES[i] === actual });
  const k = trio.indexOf(Math.max(...trio));
  favClaimed += trio[k] / 100;
  if (OUTCOMES[k] === actual) favHits++;
}

const calibration = fitCalibration(samples, { minSamples: 600, minBinSize: 120 });
if (!calibration.meta.fitted) {
  console.error(`Calibration not fitted: ${calibration.meta.reason}`);
  process.exit(1);
}

console.log(`\nFavourites in the fit window: claimed ${(favClaimed / fitWindow.length * 100).toFixed(1)}%, actual ${(favHits / fitWindow.length * 100).toFixed(1)}%`);
console.log(`Map: ${calibration.points.length} points from ${calibration.meta.samples} outcomes, mean calibration error before correction ${(calibration.meta.meanAbsCalibrationError * 100).toFixed(2)}pp`);
console.log('\nclaimed -> observed');
for (const pt of calibration.points) {
  const dir = pt.rate > pt.p ? 'up  ' : pt.rate < pt.p ? 'down' : 'same';
  console.log(`  ${(pt.p * 100).toFixed(1).padStart(5)}%  ->  ${(pt.rate * 100).toFixed(1).padStart(5)}%   ${dir}  (n=${pt.n})`);
}

const out = {
  points: calibration.points,
  meta: {
    ...calibration.meta,
    fittedAt: new Date().toISOString(),
    trainMatches: train.length,
    fitWindowMatches: fitWindow.length,
    reservedMatches: reserved.length,
    fitWindowStart: fitWindow[0]?.timestamp ? new Date(fitWindow[0].timestamp).toISOString() : null,
    fitWindowEnd: fitWindow[fitWindow.length - 1]?.timestamp ? new Date(fitWindow[fitWindow.length - 1].timestamp).toISOString() : null,
    // Evaluation scripts compare their test window against this to detect overlap.
    fittedThroughTimestamp: fitWindow[fitWindow.length - 1]?.timestamp ?? null,
    favouriteClaimedRate: parseFloat((favClaimed / fitWindow.length).toFixed(4)),
    favouriteActualRate: parseFloat((favHits / fitWindow.length).toFixed(4))
  }
};
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'calibration.json'), JSON.stringify(out, null, 2));
console.log(`\nWritten to data/calibration.json`);
process.exit(0);
