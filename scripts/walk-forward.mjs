// Rolling walk-forward evaluation: the closest thing to running the live app over history.
// Usage: npm run walkforward [-- --from 2025-04-01 --to 2026-10-01 --stepdays 30 --calibrate]
//
// WHY THIS EXISTS, AND WHAT WAS WRONG WITH THE OLDER SCRIPTS
//
// scripts/hitrate-vs-book.mjs and scripts/honest-backtest.mjs fit the model once on older fixtures
// and then score a long later period. That removes direct training-on-test leakage, but it does not
// reproduce a live model, which learns from every result as it arrives. A single fit is stale by the
// end of an 18-month test window, and stale in a way that flatters nothing in particular but does not
// describe the system anyone would actually run.
//
// They also priced every decision at CLOSING odds. Closing prices are the sharpest of the week and
// are only known after the market has finished moving — that is, after the decision being tested.
// Betting a backtest at closing prices is a mild form of using the future, and it sets the model an
// unfairly hard accuracy target while simultaneously flattering its ROI relative to what was really
// available early.
//
// This script fixes both:
//   * Refits at every step. At each boundary T the engine is rebuilt from fixtures strictly before T
//     — head-to-head index, league profiles and team strengths — then scores only the fixtures in
//     [T, T+step). Nothing from the step window, or after it, is visible. Probabilities are left
//     uncalibrated by default; see the note on CALIBRATE below for why.
//   * Prices at OPENING odds. Decisions and returns use the price available when the market opened.
//     Closing prices are used for one purpose only: measuring closing-line value, which is what they
//     are legitimately good for.
//
// WHAT IT REPORTS
//   * Paired model-versus-market accuracy (McNemar), with a confidence interval.
//   * ROI on the picks the app would actually have published, at the opening market average AND at
//     the best opening price across books, because the gap between those two is larger than any
//     modelling change measured in this project.
//   * Closing-line value as a diagnostic, not as proof of profit.
//
// This is a DEVELOPMENT measurement. The historical window has been inspected and changed against
// repeatedly, so treat these numbers as a sanity check on method, not as an estimate of future
// performance. See docs/MODEL_ACCURACY.md, "Retiring the historical window".
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { fitCalibration } from '../src/model/calibration.js';
import { devigPower } from '../src/model/devig.js';
import { bootstrapRoi as sharedBootstrap } from '../src/model/bootstrap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};
const FROM = arg('from', '2025-04-01');
const TO = arg('to', '2026-10-01');
const STEP_DAYS = parseInt(arg('stepdays', '30'), 10);
// Calibration is OFF by default. It was on until a paired comparison showed it made every measure
// worse — model-only Brier 0.2056 against 0.2002 uncalibrated, blend 0.2000 against 0.1956, and ROI at
// best price about half a point lower. The per-step map cannot be fitted cleanly inside one process:
// the engine is a stateful singleton, so head-to-head records and Elo from later in the history reach
// the fixtures the map is fitted on, and the map learns to over-correct. The shipped map is fitted
// offline with a genuinely separate engine (scripts/fit-calibration.mjs) and is roughly neutral on the
// holdout (Brier -0.0002), so uncalibrated walk-forward figures are representative of the live app.
// --calibrate turns the per-step map back on, for reproducing that comparison.
const CALIBRATE = process.argv.includes('--calibrate');

const DAY = 86400000;
const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;

const day = m => String(m.date || (m.timestamp ? new Date(m.timestamp).toISOString() : '')).slice(0, 10);
const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));

// ---- market helpers ----------------------------------------------------------------------------
// Power de-vig: proportional scaling overstates longshots enough to distort both the market's Brier
// score and any expected-value decision. See src/model/devig.js.
const devig = (t) => {
  const r = devigPower(t.h, t.d, t.a);
  return r ? { probs: r.probs, overround: r.overround } : { probs: [0, 0, 0], overround: 0 };
};

// Derived prices for the markets the app actually publishes, from the 1X2 prices, keeping the book's
// margin rather than inventing a fair price.
//   double chance: 1 / (1/p1 + 1/p2)
//   draw-no-bet:   stake returned on a draw, so the price is the favourite's share of the two
//                  non-draw inverse odds
const dcPrice = (x, y) => 1 / (1 / x + 1 / y);
const dnbPrice = (side, other) => (1 / side + 1 / other) / (1 / side);

// Return per 1 unit staked. 1 means stake returned (a push).
function settle(pick, price, actual) {
  switch (pick) {
    case 'HOME': return actual === 'HOME' ? price.h : 0;
    case 'AWAY': return actual === 'AWAY' ? price.a : 0;
    case '1X': return actual === 'AWAY' ? 0 : dcPrice(price.h, price.d);
    case 'X2': return actual === 'HOME' ? 0 : dcPrice(price.a, price.d);
    case 'HOME_DNB': return actual === 'DRAW' ? 1 : actual === 'HOME' ? dnbPrice(price.h, price.a) : 0;
    case 'AWAY_DNB': return actual === 'DRAW' ? 1 : actual === 'AWAY' ? dnbPrice(price.a, price.h) : 0;
    default: return null; // goals markets have no 1X2-derived price
  }
}
const stakedPrice = (pick, price) => {
  switch (pick) {
    case 'HOME': return price.h;
    case 'AWAY': return price.a;
    case '1X': return dcPrice(price.h, price.d);
    case 'X2': return dcPrice(price.a, price.d);
    case 'HOME_DNB': return dnbPrice(price.h, price.a);
    case 'AWAY_DNB': return dnbPrice(price.a, price.h);
    default: return null;
  }
};

// ---- one step ----------------------------------------------------------------------------------
// Rebuild the engine from fixtures strictly before `boundary`, then score [boundary, boundary+step).
function buildEngineUpTo(boundaryTs) {
  const history = corpus.filter(m => (m.timestamp || 0) < boundaryTs);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-wf-'));
  fs.writeFileSync(path.join(dir, 'training_data.json'), JSON.stringify(history));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  process.chdir(dir);
  engine.loadTrainingDataFromDisk();   // H2H, league profiles and strengths, all from history only
  process.chdir(ROOT);
  fs.rmSync(dir, { recursive: true, force: true });
  return history;
}

// Fit the calibration map using only information available at the boundary: strengths from the first
// 85% of history, predictions on the last 15% that those strengths never saw.
function fitStepCalibration(history) {
  if (!CALIBRATE || history.length < 3000) return { points: [] };
  const cut = Math.floor(history.length * 0.85);
  engine.applyFittedTeamStrengths({ corpus: history.slice(0, cut) });
  const samples = [];
  for (const m of history.slice(cut)) {
    const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
    const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, skipCalibration: true });
    const trio = [p.home, p.draw, p.away];
    for (let i = 0; i < 3; i++) samples.push({ p: trio[i] / 100, hit: OUT[i] === actual });
  }
  engine.applyFittedTeamStrengths({ corpus: history });  // restore the full-history fit for scoring
  const cal = fitCalibration(samples, { minSamples: 600, minBinSize: 120 });
  return cal.meta.fitted ? cal : { points: [] };
}

// ---- accumulators ------------------------------------------------------------------------------
const acc = {
  n: 0, modelHits: 0, marketHits: 0, weOnly: 0, bookOnly: 0, bothRight: 0, neither: 0,
  modelBrier: 0, marketBrier: 0,
  // The blend is fed the price, so comparing it with the market is close to circular: it agrees with
  // the market on about 98% of fixtures by construction. Model-only (no odds supplied) is the honest
  // measure of our independent skill, so both are tracked.
  soloHits: 0, soloBrier: 0, soloWeOnly: 0, soloBookOnly: 0,
  betReturnsAvg: [], betReturnsMax: [],
  betsAvg: 0, stakedAvg: 0, returnedAvg: 0, wonAvg: 0, pushAvg: 0,
  betsMax: 0, stakedMax: 0, returnedMax: 0,
  clvN: 0, clvSum: 0, clvBeat: 0,
  perPick: new Map()
};
const steps = [];

const fromTs = new Date(`${FROM}T00:00:00Z`).getTime();
const toTs = new Date(`${TO}T00:00:00Z`).getTime();

console.log('ROLLING WALK-FORWARD — refit at every step, priced at OPENING odds');
console.log(`Window ${FROM} .. ${TO}, step ${STEP_DAYS} days, calibration ${CALIBRATE ? 'refitted per step' : 'off'}`);
console.log(`Corpus ${corpus.length} fixtures; opening prices available for ${Object.values(oddsById).filter(o => o.open).length}\n`);
console.log('step  boundary    trainN  testN  model%  mkt%    gap   mBrier  mktBrier  bets  ROI@avg  ROI@best   CLV%');

let stepIndex = 0;
for (let boundary = fromTs; boundary < toTs; boundary += STEP_DAYS * DAY) {
  const stepEnd = Math.min(boundary + STEP_DAYS * DAY, toTs);
  // Only fixtures with an OPENING price can be evaluated: without one there is no point-in-time
  // decision to test, and pricing them at the close is the very thing this script avoids.
  const window = corpus.filter(m => (m.timestamp || 0) >= boundary && (m.timestamp || 0) < stepEnd && oddsById[m.id]?.open);
  if (window.length < 30) continue;

  const history = buildEngineUpTo(boundary);
  if (history.length < 3000) continue;
  const calibration = fitStepCalibration(history);
  engine.probabilityCalibration = calibration;

  const s = {
    n: 0, modelHits: 0, marketHits: 0, weOnly: 0, bookOnly: 0,
    soloHits: 0, soloBrier: 0, soloWeOnly: 0, soloBookOnly: 0,
    modelBrier: 0, marketBrier: 0,
    bets: 0, stakedAvg: 0, returnedAvg: 0, stakedMax: 0, returnedMax: 0,
    clvN: 0, clvSum: 0, clvBeat: 0
  };

  for (const m of window) {
    const o = oddsById[m.id];
    const openAvg = { h: o.open.h, d: o.open.d, a: o.open.a };
    const openBest = o.openMax ? { h: o.openMax.h, d: o.openMax.d, a: o.openMax.a } : openAvg;
    const closeAvg = { h: o.h, d: o.d, a: o.a };
    const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';

    const mk = devig(openAvg);
    // The engine sees the OPENING price, exactly as the live app sees the current price.
    const p = engine.computeDixonColesProbabilities(m.home, m.away, {
      league: m.league,
      odds: {
        homeOdds: openAvg.h, drawOdds: openAvg.d, awayOdds: openAvg.a,
        homeProb: mk.probs[0] * 100, drawProb: mk.probs[1] * 100, awayProb: mk.probs[2] * 100,
        marketFav: mk.probs[0] >= mk.probs[2] ? 'HOME' : 'AWAY'
      }
    });
    const pr = [p.home, p.draw, p.away].map(x => x / 100);
    const modelRight = OUT[argmax(pr)] === actual;
    const marketRight = OUT[argmax(mk.probs)] === actual;

    // Same fixture with no price supplied: our own opinion, unaided.
    const solo = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
    const sp = [solo.home, solo.draw, solo.away].map(x => x / 100);
    const soloRight = OUT[argmax(sp)] === actual;
    if (soloRight) s.soloHits++;
    if (soloRight && !marketRight) s.soloWeOnly++;
    if (!soloRight && marketRight) s.soloBookOnly++;
    s.soloBrier += sp.reduce((t, x, i) => t + (x - (OUT[i] === actual ? 1 : 0)) ** 2, 0) / 3;

    s.n++;
    if (modelRight) s.modelHits++;
    if (marketRight) s.marketHits++;
    if (modelRight && !marketRight) s.weOnly++;
    if (!modelRight && marketRight) s.bookOnly++;
    s.modelBrier += pr.reduce((t, x, i) => t + (x - (OUT[i] === actual ? 1 : 0)) ** 2, 0) / 3;
    s.marketBrier += mk.probs.reduce((t, x, i) => t + (x - (OUT[i] === actual ? 1 : 0)) ** 2, 0) / 3;

    // The pick the app would have published, staked flat at the opening price.
    const pick = p.smartMarket?.pick || 'PASS';
    if (pick !== 'PASS') {
      const rAvg = settle(pick, openAvg, actual);
      const rMax = settle(pick, openBest, actual);
      if (rAvg != null) {
        s.bets++;
        s.stakedAvg += 1; s.returnedAvg += rAvg;
        s.stakedMax += 1; s.returnedMax += rMax;
        acc.betReturnsAvg.push(rAvg);
        acc.betReturnsMax.push(rMax);
        const bucket = acc.perPick.get(pick) || { n: 0, staked: 0, returnedAvg: 0, returnedMax: 0, won: 0, push: 0, retAvg: [], retMax: [] };
        bucket.n++; bucket.staked += 1; bucket.returnedAvg += rAvg; bucket.returnedMax += rMax;
        bucket.retAvg.push(rAvg); bucket.retMax.push(rMax);
        if (rAvg > 1) bucket.won++; else if (rAvg === 1) bucket.push++;
        acc.perPick.set(pick, bucket);

        // Closing-line value on the price we would have taken. A diagnostic only.
        const takenOpen = stakedPrice(pick, openAvg);
        const takenClose = stakedPrice(pick, closeAvg);
        if (takenOpen && takenClose) {
          s.clvN++;
          s.clvSum += (takenOpen / takenClose - 1) * 100;
          if (takenOpen > takenClose) s.clvBeat++;
        }
      }
    }
  }

  const gap = (s.weOnly - s.bookOnly) / s.n * 100;
  const roiAvg = s.stakedAvg ? (s.returnedAvg - s.stakedAvg) / s.stakedAvg * 100 : null;
  const roiMax = s.stakedMax ? (s.returnedMax - s.stakedMax) / s.stakedMax * 100 : null;
  const clv = s.clvN ? s.clvSum / s.clvN : null;
  const pad = (x, n, d = 1) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d)).padStart(n);
  console.log(
    String(++stepIndex).padStart(4) + '  ' + new Date(boundary).toISOString().slice(0, 10) +
    String(history.length).padStart(9) + String(s.n).padStart(7) +
    pad(s.modelHits / s.n * 100, 8) + pad(s.marketHits / s.n * 100, 7) + pad(gap, 7) +
    pad(s.modelBrier / s.n, 9, 4) + pad(s.marketBrier / s.n, 10, 4) +
    String(s.bets).padStart(6) + pad(roiAvg, 9) + pad(roiMax, 10) + pad(clv, 7)
  );

  steps.push({ boundary: new Date(boundary).toISOString().slice(0, 10), ...s, gap, roiAvg, roiMax, clv });
  acc.n += s.n; acc.modelHits += s.modelHits; acc.marketHits += s.marketHits;
  acc.soloHits += s.soloHits; acc.soloBrier += s.soloBrier;
  acc.soloWeOnly += s.soloWeOnly; acc.soloBookOnly += s.soloBookOnly;
  acc.weOnly += s.weOnly; acc.bookOnly += s.bookOnly;
  acc.modelBrier += s.modelBrier; acc.marketBrier += s.marketBrier;
  acc.betsAvg += s.bets; acc.stakedAvg += s.stakedAvg; acc.returnedAvg += s.returnedAvg;
  acc.stakedMax += s.stakedMax; acc.returnedMax += s.returnedMax;
  acc.clvN += s.clvN; acc.clvSum += s.clvSum; acc.clvBeat += s.clvBeat;
}

// ---- pooled results with uncertainty -----------------------------------------------------------
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d));
console.log('\n' + '='.repeat(96));
console.log(`POOLED OVER ${steps.length} STEPS — ${acc.n} fixtures, all priced at opening odds`);
console.log('='.repeat(96));

const gap = (acc.weOnly - acc.bookOnly) / acc.n * 100;
const gapSe = Math.sqrt(acc.weOnly + acc.bookOnly) / acc.n * 100;
const soloGap = (acc.soloWeOnly - acc.soloBookOnly) / acc.n * 100;
const soloGapSe = Math.sqrt(acc.soloWeOnly + acc.soloBookOnly) / acc.n * 100;
console.log('\nACCURACY (paired against the market, McNemar)');
console.log(`  market 1X2                     ${f(acc.marketHits / acc.n * 100)}%   (opening average, vig removed)`);
console.log('');
console.log(`  MODEL ONLY, no price supplied  ${f(acc.soloHits / acc.n * 100)}%`);
console.log(`    gap to market                ${f(soloGap)} points, SE ${f(soloGapSe)}, 95% CI [${f(soloGap - 1.96 * soloGapSe)}, ${f(soloGap + 1.96 * soloGapSe)}]`);
console.log(`    disagreements                ${acc.soloWeOnly + acc.soloBookOnly} of ${acc.n} fixtures (we alone right ${acc.soloWeOnly}, market alone ${acc.soloBookOnly})`);
console.log(`    Brier                        ${f(acc.soloBrier / acc.n, 4)} vs market ${f(acc.marketBrier / acc.n, 4)}`);
console.log('');
console.log(`  WHAT THE APP SHOWS (blend)     ${f(acc.modelHits / acc.n * 100)}%`);
console.log(`    gap to market                ${f(gap)} points, SE ${f(gapSe)}, 95% CI [${f(gap - 1.96 * gapSe)}, ${f(gap + 1.96 * gapSe)}]`);
console.log(`    disagreements                ${acc.weOnly + acc.bookOnly} of ${acc.n} fixtures (we alone right ${acc.weOnly}, market alone ${acc.bookOnly})`);
console.log(`    Brier                        ${f(acc.modelBrier / acc.n, 4)} vs market ${f(acc.marketBrier / acc.n, 4)}`);
console.log('    Note: the blend is fed the price, so it agrees with the market on almost every fixture.');
console.log('    Its gap being ~0 means adding our model to the price neither helps nor hurts, not that');
console.log('    we match the market independently. The model-only row above is the real comparison.');

console.log('\nRETURN ON PUBLISHED PICKS (flat 1 unit, opening prices)');
const roiAvg = (acc.returnedAvg - acc.stakedAvg) / acc.stakedAvg * 100;
const roiMax = (acc.returnedMax - acc.stakedMax) / acc.stakedMax * 100;
// Flat-stake returns are heavily skewed — most bets return 0 and a few return the price — so a
// normal-approximation standard error understates the interval. Bootstrap instead: resample the
// per-bet returns with replacement and read the 2.5th and 97.5th percentiles.
function bootstrapRoi(returns, resamples = 2000) {
  // src/model/bootstrap.js: a correct 32-bit generator. The inline one this replaced cycled every
  // 10,466 draws, so its intervals were not valid.
  const r = sharedBootstrap(returns, { resamples });
  return r ? { lo: r.lo, hi: r.hi } : null;
}
const ciAvg = bootstrapRoi(acc.betReturnsAvg);
const ciMax = bootstrapRoi(acc.betReturnsMax);
console.log(`  bets             ${acc.betsAvg}`);
console.log(`  ROI at market average price   ${f(roiAvg)}%   95% CI [${f(ciAvg.lo)}, ${f(ciAvg.hi)}]`);
console.log(`  ROI at best available price   ${f(roiMax)}%   95% CI [${f(ciMax.lo)}, ${f(ciMax.hi)}]   <- shopping around`);
console.log('  Intervals are bootstrapped over per-bet returns (2,000 resamples), because flat-stake');
console.log('  returns are skewed and a normal approximation would report a falsely tight interval.');

console.log('\n  by market:');
for (const [pick, b] of [...acc.perPick.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const rAvg = (b.returnedAvg - b.staked) / b.staked * 100;
  const rMax = (b.returnedMax - b.staked) / b.staked * 100;
  const ci = bootstrapRoi(b.retMax, 1000);
  console.log(`    ${pick.padEnd(10)} ${String(b.n).padStart(5)} bets  hit ${f(b.won / Math.max(1, b.n - b.push) * 100, 1)}%  ROI@avg ${f(rAvg)}%  ROI@best ${f(rMax)}% CI [${f(ci.lo)}, ${f(ci.hi)}]${b.push ? `  (${b.push} pushes)` : ''}`);
}

console.log('\nCLOSING-LINE VALUE (diagnostic)');
console.log(`  mean CLV on the ${acc.clvN} priced picks: ${f(acc.clvSum / acc.clvN)}%`);
console.log(`  beat the closing price on ${f(acc.clvBeat / acc.clvN * 100, 1)}% of them`);
console.log('  Positive CLV means the market moved toward our pick after we would have bet it. It is');
console.log('  evidence of timing, not a guarantee of profit, and it does not become proof at any');
console.log('  particular sample size.');

console.log('\nSTEP-TO-STEP VARIATION (why a single window is not enough)');
const gaps = steps.map(s => s.gap);
const rois = steps.map(s => s.roiMax).filter(x => x != null);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / Math.max(1, xs.length - 1));
console.log(`  gap across steps:        mean ${f(mean(gaps))}, sd ${f(sd(gaps))}, range [${f(Math.min(...gaps))}, ${f(Math.max(...gaps))}]`);
console.log(`  ROI@best across steps:   mean ${f(mean(rois))}, sd ${f(sd(rois))}, range [${f(Math.min(...rois))}, ${f(Math.max(...rois))}]`);

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'walk-forward-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  window: { from: FROM, to: TO, stepDays: STEP_DAYS },
  pricing: 'opening (Avg*) for decisions and returns; closing (AvgC*) used only for CLV',
  calibration: CALIBRATE ? 'refitted at every step from pre-boundary data only' : 'off',
  pooled: {
    fixtures: acc.n,
    modelHitRate: acc.modelHits / acc.n * 100,
    marketHitRate: acc.marketHits / acc.n * 100,
    gap, gapSe, gapCi: [gap - 1.96 * gapSe, gap + 1.96 * gapSe],
    modelOnlyHitRate: acc.soloHits / acc.n * 100,
    modelOnlyGap: soloGap, modelOnlyGapCi: [soloGap - 1.96 * soloGapSe, soloGap + 1.96 * soloGapSe],
    modelOnlyBrier: acc.soloBrier / acc.n,
    roiAtAverageCi: ciAvg ? [ciAvg.lo, ciAvg.hi] : null,
    roiAtBestCi: ciMax ? [ciMax.lo, ciMax.hi] : null,
    modelBrier: acc.modelBrier / acc.n,
    marketBrier: acc.marketBrier / acc.n,
    bets: acc.betsAvg, roiAtAverage: roiAvg, roiAtBest: roiMax,
    meanClv: acc.clvSum / acc.clvN, beatCloseRate: acc.clvBeat / acc.clvN * 100
  },
  steps,
  caveat: 'Development measurement. This historical window has been inspected and changed against repeatedly; it is not an estimate of future performance.'
}, null, 2));
console.log('\nWritten to data/walk-forward-results.json');
process.exit(0);
