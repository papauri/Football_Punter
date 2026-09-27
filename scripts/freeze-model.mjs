// Freeze the model and its decision rules, so a genuine forward exam becomes possible.
// Usage: npm run freeze
//
// WHY
//
// The most recent 9,000 fixtures have now been looked at repeatedly: strengths were fitted against
// them, hyperparameters chosen with them in view, xG accepted after checking them, two league bugs
// found through them and the walk-forward inspected on them. Every one of those steps was reasonable
// in isolation, and together they mean the window can no longer serve as a final exam. Results on it
// are development output — useful for catching mistakes, worthless as an estimate of future
// performance, because the model has been shaped until those numbers looked acceptable.
//
// The only honest remedy is to stop changing the model, write down exactly what it is, and evaluate
// fixtures that did not exist when it was written. This records that snapshot: the hyperparameters,
// the calibration map's provenance, the decision rules, and content hashes of the files that decide
// a prediction. scripts/forward-eval.mjs then scores ONLY fixtures kicking off after the freeze, and
// verifies the hashes still match so a silent change cannot pass unnoticed.
//
// Changing the model after this is entirely legitimate — that is how it improves — but it starts a
// new freeze, and the forward record begins again from that date. Resist the temptation to freeze,
// peek, adjust and re-freeze: doing that repeatedly recreates the problem this is meant to solve.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const FREEZE_FILE = path.join(ROOT, 'data', 'model-freeze.json');
const note = (() => {
  const i = process.argv.indexOf('--note');
  return i === -1 ? null : process.argv[i + 1];
})();

// The files that actually decide a prediction. A change to any of them invalidates the freeze.
const TRACKED = [
  'engine.js',
  'src/model/strengthFit.js',
  'src/model/calibration.js',
  'src/utils/leagueUtils.js',
  'hyperparameters.json',
  'data/calibration.json'
];

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex').slice(0, 16);

const hashes = {};
for (const f of TRACKED) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error(`Cannot freeze: ${f} is missing.`);
    process.exit(1);
  }
  hashes[f] = sha(f);
}

const hyperparameters = JSON.parse(fs.readFileSync('hyperparameters.json', 'utf8'));
const calibration = fs.existsSync('data/calibration.json')
  ? JSON.parse(fs.readFileSync('data/calibration.json', 'utf8')).meta
  : null;
const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => typeof m.homeScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const lastResult = corpus[corpus.length - 1];

const existing = fs.existsSync(FREEZE_FILE) ? JSON.parse(fs.readFileSync(FREEZE_FILE, 'utf8')) : null;

const freeze = {
  frozenAt: new Date().toISOString(),
  // Fixtures kicking off from here on are the forward exam. Anything earlier is development data,
  // because the model was shaped with it in view.
  evaluateFixturesFrom: new Date().toISOString(),
  supersedes: existing ? { frozenAt: existing.frozenAt, generation: existing.generation } : null,
  generation: existing ? (existing.generation || 1) + 1 : 1,
  note: note || null,
  trainedThrough: {
    lastResultInCorpus: lastResult?.date || null,
    corpusFixtures: corpus.length
  },
  hashes,
  hyperparameters,
  calibration: calibration ? {
    fittedAt: calibration.fittedAt, fitWindowEnd: calibration.fitWindowEnd,
    samples: calibration.samples, reservedMatches: calibration.reservedMatches
  } : null,
  // Written down so "the decision rules" cannot quietly drift either.
  decisionRules: {
    entropyFloorThreshold: hyperparameters.entropyFloorThreshold,
    paritySafetyThreshold: hyperparameters.paritySafetyThreshold,
    minConfidenceThreshold: hyperparameters.minConfidenceThreshold,
    dnbDrawThreshold: hyperparameters.dnbDrawThreshold,
    noPriceEntropySurcharge: hyperparameters.noPriceEntropySurcharge,
    disabledLeagues: hyperparameters.disabledLeagues,
    staking: 'flat 1 unit per published non-PASS pick',
    pricing: 'the price available when the pick is published, not the closing price'
  },
  developmentResults: {
    note: 'Kept for the record. These come from windows the model was shaped against and are NOT forecasts.',
    walkForward: fs.existsSync('data/walk-forward-results.json')
      ? (({ pooled, window }) => ({ window, pooled }))(JSON.parse(fs.readFileSync('data/walk-forward-results.json', 'utf8')))
      : null
  }
};

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(FREEZE_FILE, JSON.stringify(freeze, null, 2));

console.log(`Model frozen — generation ${freeze.generation}${existing ? ` (supersedes generation ${existing.generation || 1} from ${existing.frozenAt.slice(0, 10)})` : ''}`);
console.log(`  frozen at            ${freeze.frozenAt}`);
console.log(`  forward exam covers  fixtures kicking off after the above`);
console.log(`  last result in data  ${freeze.trainedThrough.lastResultInCorpus}`);
if (note) console.log(`  note                 ${note}`);
console.log('\nTracked file hashes:');
for (const [f, h] of Object.entries(hashes)) console.log(`  ${f.padEnd(30)} ${h}`);
console.log('\nFrom now on, run npm run forward to score only post-freeze fixtures.');
console.log('Editing any tracked file invalidates this freeze; re-run npm run freeze to start a new one,');
console.log('and note that doing so restarts the forward record from zero.');
process.exit(0);
