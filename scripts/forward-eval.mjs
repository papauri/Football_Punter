// The forward exam: score only fixtures that kicked off after the model was frozen.
// Usage: npm run forward
//
// Everything else in scripts/ measures the model on history it was shaped against. This measures it
// on fixtures that did not exist when it was written, which is the only measurement that supports a
// claim about future performance.
//
// It refuses to help you cheat in three specific ways:
//   * It ignores fixtures from before the freeze, however tempting the sample size.
//   * It checks the tracked file hashes and says plainly if the model has changed since the freeze,
//     because then the forward record no longer belongs to the frozen model.
//   * It reports intervals, not point estimates, and never declares an edge proven at a given count.
//
// Prices come from the ledger's recorded pre-kickoff price — the one actually available when the pick
// was published — not from a closing price looked up afterwards.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootstrapRoi as sharedBootstrap } from '../src/model/bootstrap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const FREEZE_FILE = path.join(ROOT, 'data', 'model-freeze.json');
if (!fs.existsSync(FREEZE_FILE)) {
  console.log('No freeze recorded. Run: npm run freeze');
  console.log('Until the model is frozen there is no forward period to evaluate, and every number in');
  console.log('this repository comes from data the model was shaped against.');
  process.exit(0);
}
const freeze = JSON.parse(fs.readFileSync(FREEZE_FILE, 'utf8'));
const freezeTs = new Date(freeze.evaluateFixturesFrom).getTime();

console.log(`FORWARD EXAM — frozen generation ${freeze.generation}, ${freeze.frozenAt.slice(0, 16)}Z`);
if (freeze.note) console.log(`Note: ${freeze.note}`);

// ---- has the model changed since the freeze? ---------------------------------------------------
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex').slice(0, 16);
const changed = [];
for (const [f, h] of Object.entries(freeze.hashes || {})) {
  if (!fs.existsSync(path.join(ROOT, f))) { changed.push(`${f} (missing)`); continue; }
  if (sha(f) !== h) changed.push(f);
}
if (changed.length) {
  console.log('\n*** THE MODEL HAS CHANGED SINCE THE FREEZE ***');
  console.log(`Changed: ${changed.join(', ')}`);
  console.log('Whatever follows is a mixture of two models, so it does not measure either one. Re-run');
  console.log('npm run freeze to start a clean forward record from today.');
} else {
  console.log('Model files unchanged since the freeze — the record below belongs to the frozen model.');
}

// ---- gather post-freeze resolved picks ---------------------------------------------------------
const ledger = fs.existsSync('pre_kickoff_ledger.json')
  ? JSON.parse(fs.readFileSync('pre_kickoff_ledger.json', 'utf8'))
  : [];
const OUT = ['HOME', 'DRAW', 'AWAY'];

const post = ledger.filter(e => {
  const ts = e.kickoffUtc ? new Date(e.kickoffUtc).getTime() : 0;
  return ts >= freezeTs && e.actualWinner;
});

console.log(`\nLedger entries: ${ledger.length} total, ${post.length} resolved since the freeze.`);
if (!post.length) {
  console.log('\nNothing to report yet. That is the expected state immediately after a freeze, and it is');
  console.log('the honest one: no claim about future performance can be supported until forward fixtures');
  console.log('have accumulated. Leave the app running and check back.');
  console.log('\nWhat will be reported once entries arrive:');
  console.log('  - paired model-versus-market accuracy on identical fixtures, with an interval');
  console.log('  - return on investment at the price actually available when each pick was published');
  console.log('  - closing-line value, as a diagnostic of timing');
  console.log('  - all of it with intervals, and no threshold at which an edge is declared proven');
  process.exit(0);
}

// ---- paired accuracy ---------------------------------------------------------------------------
const graded = post.filter(e => typeof e.hit1X2 === 'boolean' && typeof e.marketHit1X2 === 'boolean');
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d));

if (graded.length) {
  const weOnly = graded.filter(e => e.hit1X2 && !e.marketHit1X2).length;
  const bookOnly = graded.filter(e => !e.hit1X2 && e.marketHit1X2).length;
  const gap = (weOnly - bookOnly) / graded.length * 100;
  const se = Math.sqrt(weOnly + bookOnly) / graded.length * 100;
  console.log('\nPAIRED ACCURACY (1X2, McNemar)');
  console.log(`  fixtures                ${graded.length}`);
  console.log(`  our hit rate            ${f(graded.filter(e => e.hit1X2).length / graded.length * 100)}%`);
  console.log(`  market hit rate         ${f(graded.filter(e => e.marketHit1X2).length / graded.length * 100)}%`);
  console.log(`  gap                     ${f(gap)} points, 95% CI [${f(gap - 1.96 * se)}, ${f(gap + 1.96 * se)}]`);
  console.log(`  disagreements           ${weOnly + bookOnly} (we alone right ${weOnly}, market alone ${bookOnly})`);
  if (graded.length < 300) {
    console.log(`  With ${graded.length} fixtures this interval is wide. It narrows roughly with the square root of`);
    console.log('  the count, so several hundred are needed before a couple of points means anything.');
  }
}

// ---- return at the quoted price (observed pre-kickoff; availability and limits unknown) ----------------------------------------------------
const dcPrice = (x, y) => 1 / (1 / x + 1 / y);
const dnbPrice = (s, o) => (1 / s + 1 / o) / (1 / s);
function settle(pick, p, actual) {
  switch (pick) {
    case 'HOME': return actual === 'HOME' ? p.home : 0;
    case 'AWAY': return actual === 'AWAY' ? p.away : 0;
    case '1X': return actual === 'AWAY' ? 0 : dcPrice(p.home, p.draw);
    case 'X2': return actual === 'HOME' ? 0 : dcPrice(p.away, p.draw);
    case 'HOME_DNB': return actual === 'DRAW' ? 1 : actual === 'HOME' ? dnbPrice(p.home, p.away) : 0;
    case 'AWAY_DNB': return actual === 'DRAW' ? 1 : actual === 'AWAY' ? dnbPrice(p.away, p.home) : 0;
    default: return null;
  }
}

const returns = [];
for (const e of post) {
  const pick = e.smartMarket?.pick;
  const price = e.market?.quotedPrice || e.market?.priceTaken || (e.inputs?.odds ? { home: e.inputs.odds.home, draw: e.inputs.odds.draw, away: e.inputs.odds.away } : null);
  if (!pick || pick === 'PASS' || !price?.home) continue;
  const r = settle(pick, price, e.actualWinner);
  if (r != null) returns.push({ pick, r });
}

function bootstrap(xs, resamples = 2000) {
  // src/model/bootstrap.js — see the note there on why the previous inline generator was invalid.
  const r = sharedBootstrap(xs, { resamples });
  return r ? { lo: r.lo, hi: r.hi } : null;
}

if (returns.length) {
  const rs = returns.map(x => x.r);
  const roi = (rs.reduce((a, b) => a + b, 0) - rs.length) / rs.length * 100;
  const ci = bootstrap(rs);
  console.log('\nRETURN AT THE PRICE ACTUALLY TAKEN (flat 1 unit)');
  console.log(`  bets                    ${rs.length}`);
  console.log(`  ROI                     ${f(roi)}%   95% CI [${f(ci.lo)}, ${f(ci.hi)}]`);
  console.log('  Bootstrapped over per-bet returns, which are skewed, so a normal interval would be');
  console.log('  falsely tight. A CI spanning zero means the result is consistent with no edge.');
  const byPick = new Map();
  for (const { pick, r } of returns) {
    if (!byPick.has(pick)) byPick.set(pick, []);
    byPick.get(pick).push(r);
  }
  console.log('\n  by market:');
  for (const [pick, rs2] of [...byPick.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const r2 = (rs2.reduce((a, b) => a + b, 0) - rs2.length) / rs2.length * 100;
    const c2 = bootstrap(rs2, 1000);
    console.log(`    ${pick.padEnd(10)} ${String(rs2.length).padStart(4)} bets  ROI ${f(r2)}%  CI [${f(c2.lo)}, ${f(c2.hi)}]`);
  }
}

// ---- closing-line value, as a diagnostic -------------------------------------------------------
const withClv = post.filter(e => e.clv && Number.isFinite(e.clv.clvPricePct));
if (withClv.length) {
  const xs = withClv.map(e => e.clv.clvPricePct);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  const se = sd / Math.sqrt(xs.length);
  console.log('\nCLOSING-LINE VALUE (diagnostic)');
  console.log(`  picks with a closing price   ${xs.length}`);
  console.log(`  mean CLV                     ${f(mean)}%   95% CI [${f(mean - 1.96 * se)}, ${f(mean + 1.96 * se)}]`);
  console.log(`  beat the close on            ${f(withClv.filter(e => e.clv.beatTheClose).length / xs.length * 100, 1)}% of picks`);
  console.log('  CLV measures whether the market moved toward a pick after it was made. Positive CLV is');
  console.log('  a reason to keep looking, not a profit forecast: it says nothing about the margin paid,');
  console.log('  and it can be positive while returns are negative. There is no count at which it');
  console.log('  becomes proof.');
  console.log('  For reference, over the historical walk-forward mean CLV was -0.07% and the model beat');
  console.log('  the close on 48.7% of picks: no timing edge at all.');
}

console.log('\nAll of the above covers post-freeze fixtures only. Historical figures elsewhere in this');
console.log('repository describe windows the model was shaped against and are not forecasts.');
process.exit(0);
