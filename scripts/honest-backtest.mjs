// Produce backtest_20k_results.json — the figures the dashboard's strategy-proof panel shows.
// Usage: npm run backtest:honest
//
// The file this replaces was not a backtest. The engine scored the same 23,453 fixtures it had just
// trained on, so its "56.85% raw / 72.08% high conviction / 76.32% elite" and even its
// "holdoutTestSet" were all in-sample, and the accuracyTrend cohorts — sixteen quarters of numbers
// climbing smoothly to 82.5% — were not produced by any code in the repository at all. Measured
// properly the same buckets come in 10 to 15 points lower.
//
// Here the engine is built from the older fixtures only, in a temporary working directory, and then
// scores fixtures it has never seen. Where closing odds exist the bookmaker's own hit rate on the
// identical fixtures is reported beside ours, because that is the only comparison that says whether
// a number is any good.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');
const { isLeagueBlacklisted } = await import('../src/utils/leagueUtils.js');

const HOLDOUT = 9000;
const COHORTS = 8;

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;

const train = corpus.slice(0, -HOLDOUT);
const holdout = corpus.slice(-HOLDOUT);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-honest-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(train));
fs.mkdirSync(path.join(trainDir, 'data'), { recursive: true });
if (fs.existsSync('data/calibration.json')) fs.copyFileSync('data/calibration.json', path.join(trainDir, 'data', 'calibration.json'));
process.chdir(trainDir);
const t0 = Date.now();
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));

// Score every holdout fixture once.
const scored = [];
for (const m of holdout) {
  const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
  const trio = [p.home, p.draw, p.away];
  const o = oddsById[m.id];
  let market = null;
  if (o) {
    const inv = [1 / o.h, 1 / o.d, 1 / o.a];
    const s = inv[0] + inv[1] + inv[2];
    market = inv.map(x => x / s);
  }
  scored.push({
    timestamp: m.timestamp || 0,
    league: m.league,
    allowed: !isLeagueBlacklisted(m.league) && !engine.isLeagueDisabled(m.league),
    actual,
    trio,
    maxProb: Math.max(...trio),
    pick: OUT[argmax(trio)],
    favourite: trio[0] >= trio[2] ? 'HOME' : 'AWAY',
    market
  });
}
const elapsedSeconds = ((Date.now() - t0) / 1000).toFixed(2);

const rate = (h, n) => (n ? parseFloat(((h / n) * 100).toFixed(2)) : 0);

function summarise(list) {
  let hits = 0, hc = 0, hcH = 0, el = 0, elH = 0;
  let dnbWon = 0, dnbPush = 0, dnbLost = 0, dcWon = 0, dcLost = 0;
  let brier = 0;
  for (const r of list) {
    if (r.pick === r.actual) hits++;
    if (r.maxProb >= 65) { hc++; if (r.pick === r.actual) hcH++; }
    if (r.maxProb >= 72) { el++; if (r.pick === r.actual) elH++; }
    if (r.actual === 'DRAW') dnbPush++;
    else if (r.actual === r.favourite) dnbWon++;
    else dnbLost++;
    if (r.actual === r.favourite || r.actual === 'DRAW') dcWon++; else dcLost++;
    brier += r.trio.reduce((s, x, i) => s + (x / 100 - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
  }
  return {
    sampleSize: list.length,
    rawAccuracy: rate(hits, list.length),
    rawHits: hits,
    brier: list.length ? parseFloat((brier / list.length).toFixed(4)) : null,
    highConviction: { threshold: '>=65%', count: hc, hits: hcH, accuracy: rate(hcH, hc) },
    eliteConviction: { threshold: '>=72%', count: el, hits: elH, accuracy: rate(elH, el) },
    drawNoBet: { won: dnbWon, push: dnbPush, lost: dnbLost, strikeRateExclPush: rate(dnbWon, dnbWon + dnbLost) },
    doubleChance: { won: dcWon, lost: dcLost, winRate: rate(dcWon, list.length) }
  };
}

// Bookmaker baseline on exactly the fixtures where we hold a price.
function bookmakerBaseline(list) {
  const withOdds = list.filter(r => r.market);
  if (!withOdds.length) return null;
  let ours = 0, theirs = 0, ourDc = 0, theirDc = 0, ourBrier = 0, theirBrier = 0;
  for (const r of withOdds) {
    const mk = OUT[argmax(r.market)];
    const mkFav = r.market[0] >= r.market[2] ? 'HOME' : 'AWAY';
    if (r.pick === r.actual) ours++;
    if (mk === r.actual) theirs++;
    if (r.actual === r.favourite || r.actual === 'DRAW') ourDc++;
    if (r.actual === mkFav || r.actual === 'DRAW') theirDc++;
    ourBrier += r.trio.reduce((s, x, i) => s + (x / 100 - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
    theirBrier += r.market.reduce((s, x, i) => s + (x - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
  }
  const n = withOdds.length;
  return {
    comparableFixtures: n,
    model1X2: rate(ours, n),
    bookmaker1X2: rate(theirs, n),
    gap1X2: parseFloat((rate(ours, n) - rate(theirs, n)).toFixed(2)),
    modelDoubleChance: rate(ourDc, n),
    bookmakerDoubleChance: rate(theirDc, n),
    modelBrier: parseFloat((ourBrier / n).toFixed(4)),
    bookmakerBrier: parseFloat((theirBrier / n).toFixed(4)),
    note: 'Closing odds from football-data.co.uk, vig removed. Domestic leagues only: no cup or international competition has odds coverage.'
  };
}

const overall = summarise(scored);
const allowedOnly = summarise(scored.filter(r => r.allowed));
const baseline = bookmakerBaseline(scored);

// A real trend: equal chronological cohorts inside the holdout, each measured the same way. The
// previous file's sixteen ever-improving quarters were not computed from anything.
const perCohort = Math.floor(scored.length / COHORTS);
const accuracyTrend = [];
for (let i = 0; i < COHORTS; i++) {
  const slice = scored.slice(i * perCohort, i === COHORTS - 1 ? scored.length : (i + 1) * perCohort);
  if (!slice.length) continue;
  const s = summarise(slice);
  const b = bookmakerBaseline(slice);
  const first = slice[0].timestamp ? new Date(slice[0].timestamp).toISOString().slice(0, 7) : '?';
  const last = slice[slice.length - 1].timestamp ? new Date(slice[slice.length - 1].timestamp).toISOString().slice(0, 7) : '?';
  accuracyTrend.push({
    cohort: i + 1,
    period: first === last ? first : `${first} .. ${last}`,
    matches: slice.length,
    raw1X2: s.rawAccuracy,
    highConviction: s.highConviction.accuracy,
    highConvictionSample: s.highConviction.count,
    eliteConviction: s.eliteConviction.accuracy,
    eliteConvictionSample: s.eliteConviction.count,
    doubleChance: s.doubleChance.winRate,
    dnbStrikeRate: s.drawNoBet.strikeRateExclPush,
    bookmaker1X2: b ? b.bookmaker1X2 : null
  });
}

const results = {
  generatedAt: new Date().toISOString(),
  generatedBy: 'scripts/honest-backtest.mjs',
  method: {
    summary: 'Engine trained on the oldest fixtures only, then scored fixtures it had never seen.',
    corpusMatches: corpus.length,
    trainMatches: train.length,
    holdoutMatches: holdout.length,
    trainRange: [train[0]?.date ?? null, train[train.length - 1]?.date ?? null],
    holdoutRange: [holdout[0]?.date ?? null, holdout[holdout.length - 1]?.date ?? null],
    oddsSuppliedToModel: false,
    calibrationFittedThrough: engine.probabilityCalibration?.meta?.fitWindowEnd ?? null,
    caveats: [
      'Every figure below is out of sample for team strengths and for the calibration map.',
      'Head-to-head records and league profiles are indexed from the loaded training corpus only.',
      'Hit rate alone does not show an edge: double chance and DNB need roughly 75-83% to break even at typical prices. Read the bookmakerBaseline block.'
    ]
  },
  elapsedSeconds,
  totalRecords: holdout.length,
  draws: {
    total: scored.filter(r => r.actual === 'DRAW').length,
    percentage: rate(scored.filter(r => r.actual === 'DRAW').length, scored.length)
  },
  holdout: overall,
  holdoutAppAllowedLeagues: allowedOnly,
  bookmakerBaseline: baseline,
  accuracyTrend,

  // Keys the dashboard's strategy-proof panel reads. Same names as before, honest values now.
  sampleSize: overall.sampleSize,
  rawBaselineAccuracy: overall.rawAccuracy,
  rawHits: overall.rawHits,
  totalEvaluated: overall.sampleSize,
  selectiveHighConvictionAccuracy: overall.highConviction.accuracy,
  selectiveHighConvictionHits: overall.highConviction.hits,
  selectiveHighConvictionCount: overall.highConviction.count,
  selectiveEliteConvictionAccuracy: overall.eliteConviction.accuracy,
  selectiveEliteConvictionHits: overall.eliteConviction.hits,
  selectiveEliteConvictionCount: overall.eliteConviction.count,
  drawNoBetStrikeRate: overall.drawNoBet.strikeRateExclPush,
  drawNoBetWon: overall.drawNoBet.won,
  drawNoBetPush: overall.drawNoBet.push,
  drawNoBetLost: overall.drawNoBet.lost,
  drawNoBetCapitalProtection: overall.doubleChance.winRate,
  doubleChanceWinRate: overall.doubleChance.winRate,
  holdoutTestSet: {
    sampleSize: overall.sampleSize,
    rawAccuracy: overall.rawAccuracy,
    highConvictionAccuracy: overall.highConviction.accuracy,
    eliteConvictionAccuracy: overall.eliteConviction.accuracy,
    dnbStrikeRate: overall.drawNoBet.strikeRateExclPush,
    doubleChanceWinRate: overall.doubleChance.winRate
  },
  description: baseline
    ? `Out-of-sample backtest on ${holdout.length.toLocaleString()} unseen fixtures. On the ${baseline.comparableFixtures.toLocaleString()} with closing odds the model picks ${baseline.model1X2}% of 1X2 results against the bookmaker's ${baseline.bookmaker1X2}% (gap ${baseline.gap1X2 >= 0 ? '+' : ''}${baseline.gap1X2} points).`
    : `Out-of-sample backtest on ${holdout.length.toLocaleString()} unseen fixtures.`
};

fs.writeFileSync(path.join(ROOT, 'backtest_20k_results.json'), JSON.stringify(results, null, 2));

console.log(`Trained on ${train.length} fixtures, scored ${holdout.length} unseen ones in ${elapsedSeconds}s\n`);
console.log('OUT-OF-SAMPLE (all leagues)');
console.log(`  raw 1X2            ${overall.rawAccuracy}%   (Brier ${overall.brier})`);
console.log(`  high conviction    ${overall.highConviction.accuracy}%  on ${overall.highConviction.count} picks   [file previously claimed 77.2%]`);
console.log(`  elite conviction   ${overall.eliteConviction.accuracy}%  on ${overall.eliteConviction.count} picks   [file previously claimed 82.5%]`);
console.log(`  draw-no-bet        ${overall.drawNoBet.strikeRateExclPush}%  (${overall.drawNoBet.push} pushes)`);
console.log(`  double chance      ${overall.doubleChance.winRate}%`);
console.log('\nAPP-ALLOWED LEAGUES ONLY');
console.log(`  raw 1X2            ${allowedOnly.rawAccuracy}%   high conv ${allowedOnly.highConviction.accuracy}% (n=${allowedOnly.highConviction.count})   DC ${allowedOnly.doubleChance.winRate}%`);
if (baseline) {
  console.log('\nAGAINST THE BOOKMAKER (fixtures with closing odds)');
  console.log(`  1X2            model ${baseline.model1X2}%   bookmaker ${baseline.bookmaker1X2}%   gap ${baseline.gap1X2 >= 0 ? '+' : ''}${baseline.gap1X2}`);
  console.log(`  double chance  model ${baseline.modelDoubleChance}%   bookmaker ${baseline.bookmakerDoubleChance}%`);
  console.log(`  Brier          model ${baseline.modelBrier}   bookmaker ${baseline.bookmakerBrier}`);
}
console.log('\nWritten to backtest_20k_results.json');
process.exit(0);
