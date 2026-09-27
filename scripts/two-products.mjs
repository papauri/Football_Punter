// Two products, measured separately. Usage: npm run products
//
// "Beat the bookmakers" has been conflating two different businesses, and they have different odds of
// success:
//
//   PRODUCT A — FORECASTING. Produce a 1X2 probability better than the closing consensus. This is the
//   hard one. The closing line aggregates every public model plus the money of everyone who disagrees
//   with it, so beating it means knowing something the market does not. Measured as paired accuracy
//   and Brier against the de-vigged closing line of a sharp book.
//
//   PRODUCT B — EARLY PRICE. Find a quote available early that is generous relative to where the line
//   later settles. This does NOT require a better forecast. It requires a selection rule good enough
//   to point at the right fixtures, and the discipline to take the best price across books rather
//   than one book's. A model that is slightly worse than the closing line can still find prices that
//   beat it, because early prices carry more error and more spread between books.
//
// The yardstick for both is Pinnacle's de-vigged CLOSING line, not an average of all books. Pinnacle
// runs at about 3.1% margin against 6.2% for Bet365 and 7.1% for William Hill on this data, so its
// closing price is the best public estimate of a true probability. Judging a bet against an average
// that includes soft books flatters it.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');
const { devigPower } = await import('../src/model/devig.js');

const HOLDOUT = 9000;
const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;

const train = corpus.slice(0, -HOLDOUT);
const test = corpus.slice(-HOLDOUT);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-prod-'));
fs.writeFileSync(path.join(dir, 'training_data.json'), JSON.stringify(train));
fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
if (fs.existsSync('data/calibration.json')) fs.copyFileSync('data/calibration.json', path.join(dir, 'data', 'calibration.json'));
process.chdir(dir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(dir, { recursive: true, force: true });

const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));
// Power de-vig, not proportional. Dividing inverse odds by their sum overstates longshots by up to
// 2 points on this data, which fabricated most of the "opportunity" an earlier version of this script
// reported: a hindsight-perfect version of that strategy still lost money, because the yardstick was
// wrong. See src/model/devig.js.
const devig = (t) => {
  const r = devigPower(t[0], t[1], t[2]);
  return r ? { p: r.probs, overround: r.overround } : { p: [0, 0, 0], overround: 0 };
};
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d));

// Bootstrap, because per-bet returns are skewed and a normal interval is falsely tight.
function boot(xs, resamples = 2000) {
  if (xs.length < 2) return null;
  let seed = 20260927;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const out = new Float64Array(resamples);
  for (let k = 0; k < resamples; k++) {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) sum += xs[(rnd() * xs.length) | 0];
    out[k] = (sum - xs.length) / xs.length * 100;
  }
  const s = Array.from(out).sort((a, b) => a - b);
  return { lo: s[Math.floor(resamples * 0.025)], hi: s[Math.floor(resamples * 0.975)] };
}

// ---- assemble the evaluation set ---------------------------------------------------------------
// Requires: a Pinnacle closing line (the yardstick) and at least two books quoting at open (so a best
// price means something). Everything else is dropped and counted.
const rows = [];
let noSharp = 0, tooFewBooks = 0, noOpen = 0;
for (const m of test) {
  const o = oddsById[m.id];
  if (!o?.books) { noOpen++; continue; }
  const sharpClose = o.books.PS?.c;
  if (!sharpClose) { noSharp++; continue; }
  const openBooks = Object.entries(o.books).filter(([, v]) => v.o).map(([name, v]) => ({ name, q: v.o }));
  if (openBooks.length < 2) { tooFewBooks++; continue; }

  const bestOpen = [0, 1, 2].map(i => Math.max(...openBooks.map(b => b.q[i])));
  const bestOpenBook = [0, 1, 2].map(i => openBooks.find(b => b.q[i] === bestOpen[i]).name);
  const sharpOpen = o.books.PS?.o || null;

  rows.push({
    league: m.league,
    actual: m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW',
    home: m.home, away: m.away,
    fairClose: devig(sharpClose),
    sharpClose, sharpOpen, bestOpen, bestOpenBook,
    openBookCount: openBooks.length
  });
}

console.log('TWO PRODUCTS, MEASURED SEPARATELY');
console.log(`Trained on ${train.length} fixtures; evaluating ${rows.length} of ${test.length} unseen ones.`);
console.log(`Dropped: ${noOpen} with no per-book data, ${noSharp} with no Pinnacle close, ${tooFewBooks} with fewer than two books at open.`);
console.log(`Yardstick: Pinnacle de-vigged CLOSING line (mean margin ${f(rows.reduce((s, r) => s + r.fairClose.overround, 0) / rows.length * 100)}%).`);
console.log(`Mean best-of-books OPENING margin: ${f(rows.reduce((s, r) => s + devig(r.bestOpen).overround, 0) / rows.length * 100)}%\n`);

// ---- score the model once per fixture ----------------------------------------------------------
for (const r of rows) {
  // No odds supplied: this is our own forecast, which is what Product A must be judged on. Feeding it
  // the price would make the comparison circular.
  const p = engine.computeDixonColesProbabilities(r.home, r.away, { league: r.league });
  r.model = [p.home, p.draw, p.away].map(x => x / 100);
  r.smart = p.smartMarket?.pick || 'PASS';
}

// ================================================================================================
console.log('='.repeat(100));
console.log('PRODUCT A — FORECASTING: can we beat the closing line?');
console.log('='.repeat(100));

let mHits = 0, sHits = 0, weOnly = 0, themOnly = 0, mBrier = 0, sBrier = 0;
for (const r of rows) {
  const mRight = OUT[argmax(r.model)] === r.actual;
  const sRight = OUT[argmax(r.fairClose.p)] === r.actual;
  if (mRight) mHits++;
  if (sRight) sHits++;
  if (mRight && !sRight) weOnly++;
  if (!mRight && sRight) themOnly++;
  mBrier += r.model.reduce((t, x, i) => t + (x - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
  sBrier += r.fairClose.p.reduce((t, x, i) => t + (x - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
}
const gap = (weOnly - themOnly) / rows.length * 100;
const gapSe = Math.sqrt(weOnly + themOnly) / rows.length * 100;
console.log(`  our 1X2 hit rate            ${f(mHits / rows.length * 100)}%`);
console.log(`  sharp closing line          ${f(sHits / rows.length * 100)}%`);
console.log(`  gap (paired, McNemar)       ${f(gap)} points, 95% CI [${f(gap - 1.96 * gapSe)}, ${f(gap + 1.96 * gapSe)}]`);
console.log(`  Brier                       ours ${f(mBrier / rows.length, 4)}  sharp close ${f(sBrier / rows.length, 4)}`);
console.log(`\n  VERDICT: ${gap + 1.96 * gapSe < 0 ? 'we are behind the closing line, beyond chance. Product A does not work.' : gap - 1.96 * gapSe > 0 ? 'we are ahead of the closing line.' : 'indistinguishable from the closing line.'}`);

// ================================================================================================
console.log('\n' + '='.repeat(100));
console.log('PRODUCT B — EARLY PRICE: can we find an opening quote that beats the closing fair line?');
console.log('='.repeat(100));
console.log('A bet has positive expected value at the closing consensus when');
console.log('  best opening price  x  fair closing probability  >  1.');
console.log('This asks nothing of our forecast except that it points at the right fixtures.\n');

// First: how often does such a price exist at all? This is the size of the opportunity, independent
// of any model, and it is the ceiling on Product B.
let anyEdge = 0, edgeCount = 0;
const allEdges = [];
for (const r of rows) {
  let found = false;
  for (let i = 0; i < 3; i++) {
    const ev = r.bestOpen[i] * r.fairClose.p[i] - 1;
    allEdges.push(ev);
    if (ev > 0.02) { edgeCount++; found = true; }
  }
  if (found) anyEdge++;
}
console.log(`  Opportunity size (model-free):`);
console.log(`    outcomes priced 2%+ above the closing fair line at open: ${edgeCount} of ${rows.length * 3} (${f(edgeCount / (rows.length * 3) * 100)}%)`);
console.log(`    fixtures with at least one such outcome:                  ${anyEdge} of ${rows.length} (${f(anyEdge / rows.length * 100)}%)`);
console.log('    These exist because opening lines are looser and books disagree more early.\n');

// Now the product: bet where OUR model says the best opening price carries value, then settle at that
// price and judge the selection against the closing fair line.
function runStrategy(label, selector) {
  const returns = [];
  const evs = [];
  let hits = 0;
  for (const r of rows) {
    for (let i = 0; i < 3; i++) {
      if (!selector(r, i)) continue;
      const price = r.bestOpen[i];
      const won = OUT[i] === r.actual;
      returns.push(won ? price : 0);
      if (won) hits++;
      evs.push(price * r.fairClose.p[i] - 1);
    }
  }
  if (!returns.length) return { label, bets: 0 };
  const roi = (returns.reduce((a, b) => a + b, 0) - returns.length) / returns.length * 100;
  const ci = boot(returns);
  const meanEv = evs.reduce((a, b) => a + b, 0) / evs.length * 100;
  return { label, bets: returns.length, hitRate: hits / returns.length * 100, roi, ci, meanEv };
}

// Model-selected value bets at the best opening price, at a few edge thresholds.
const strategies = [
  ['model edge > 2%', (r, i) => r.model[i] * r.bestOpen[i] - 1 > 0.02],
  ['model edge > 5%', (r, i) => r.model[i] * r.bestOpen[i] - 1 > 0.05],
  ['model edge > 10%', (r, i) => r.model[i] * r.bestOpen[i] - 1 > 0.10],
  ['model edge > 20%', (r, i) => r.model[i] * r.bestOpen[i] - 1 > 0.20]
];
console.log('  MODEL-SELECTED value bets at the best opening price:');
console.log('  selection            bets   hit%     ROI      95% CI            mean EV vs closing fair');
for (const [label, sel] of strategies) {
  const s = runStrategy(label, sel);
  if (!s.bets) { console.log(`  ${label.padEnd(20)} ${String(0).padStart(5)}  (none)`); continue; }
  console.log(`  ${label.padEnd(20)} ${String(s.bets).padStart(5)} ${f(s.hitRate).padStart(6)}% ${f(s.roi).padStart(7)}%  [${f(s.ci.lo).padStart(6)}, ${f(s.ci.hi).padStart(6)}]  ${f(s.meanEv).padStart(8)}%`);
}

// The benchmark that matters: a selector with no model at all, using only the sharp opening line to
// spot books that are out of line. If this does as well, our model is contributing nothing.
console.log('\n  MODEL-FREE benchmark — bet whenever the best opening price beats the SHARP OPENING line,');
console.log('  which needs no forecast, only price comparison:');
const sharpSel = [
  ['sharp-open edge > 2%', 0.02],
  ['sharp-open edge > 5%', 0.05]
];
for (const [label, thr] of sharpSel) {
  const s = runStrategy(label, (r, i) => {
    if (!r.sharpOpen) return false;
    const fairOpen = devig(r.sharpOpen).p[i];
    return r.bestOpen[i] * fairOpen - 1 > thr;
  });
  if (!s.bets) { console.log(`  ${label.padEnd(20)} (none)`); continue; }
  console.log(`  ${label.padEnd(20)} ${String(s.bets).padStart(5)} ${f(s.hitRate).padStart(6)}% ${f(s.roi).padStart(7)}%  [${f(s.ci.lo).padStart(6)}, ${f(s.ci.hi).padStart(6)}]  ${f(s.meanEv).padStart(8)}%`);
}

// And the ceiling: bet every outcome that genuinely beat the closing fair line. Not achievable (it
// uses the closing line we would not have at bet time) but it bounds what Product B could ever yield.
const ceiling = runStrategy('uses closing line', (r, i) => r.bestOpen[i] * r.fairClose.p[i] - 1 > 0.02);
console.log(`\n  CEILING (cheats — uses the closing line we would not yet have):`);
console.log(`    ${String(ceiling.bets).padStart(5)} bets  hit ${f(ceiling.hitRate)}%  ROI ${f(ceiling.roi)}%  CI [${f(ceiling.ci.lo)}, ${f(ceiling.ci.hi)}]`);
console.log('    This is the most Product B could deliver with perfect selection, and it is the number');
console.log('    to compare the achievable strategies above against.');

// ---- how much of the margin story is just shopping? --------------------------------------------
console.log('\n' + '='.repeat(100));
console.log('WHERE THE MONEY ACTUALLY IS — the same bets at different prices');
console.log('='.repeat(100));
const pickedRows = rows.filter(r => r.smart && r.smart !== 'PASS');
const priceVariants = [
  ['best of books at open', r => r.bestOpen],
  ['Pinnacle at open', r => r.sharpOpen],
  ['Pinnacle at close', r => r.sharpClose]
];
console.log('  Backing the market favourite in every evaluated fixture, priced three ways:');
for (const [label, get] of priceVariants) {
  const returns = [];
  for (const r of rows) {
    const q = get(r);
    if (!q) continue;
    const fav = argmax(r.fairClose.p);
    returns.push(OUT[fav] === r.actual ? q[fav] : 0);
  }
  if (returns.length < 100) continue;
  const roi = (returns.reduce((a, b) => a + b, 0) - returns.length) / returns.length * 100;
  const ci = boot(returns);
  console.log(`    ${label.padEnd(24)} ${String(returns.length).padStart(5)} bets  ROI ${f(roi).padStart(7)}%  CI [${f(ci.lo)}, ${f(ci.hi)}]`);
}
console.log('\n  The spread between these rows is pure price selection. It owes nothing to the model, and on');
console.log('  this data it is worth more than every modelling change measured in this project.');

fs.writeFileSync(path.join(ROOT, 'data', 'two-products-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  evaluated: rows.length,
  yardstick: 'Pinnacle de-vigged closing line',
  productA: { modelHitRate: mHits / rows.length * 100, sharpHitRate: sHits / rows.length * 100, gap, gapCi: [gap - 1.96 * gapSe, gap + 1.96 * gapSe], modelBrier: mBrier / rows.length, sharpBrier: sBrier / rows.length },
  productB: {
    opportunityOutcomePct: edgeCount / (rows.length * 3) * 100,
    strategies: strategies.map(([l, sel]) => runStrategy(l, sel)),
    ceiling
  },
  caveat: 'Development window; the model has been shaped against these fixtures. Prices are observed quotes, not confirmed available bets.'
}, null, 2));
console.log('\nWritten to data/two-products-results.json');
process.exit(0);
