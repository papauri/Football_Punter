// Turning bookmaker prices into probabilities.
//
// Every price carries margin, so inverse odds sum to more than 1 and must be scaled down. HOW they
// are scaled down matters more than it looks, and getting it wrong invents edges that do not exist.
//
// The obvious method — divide each inverse odd by their sum — assumes the margin is spread evenly in
// proportion to probability. It is not. Bookmakers load more margin onto longshots, because that is
// where the public bets and where they can. Proportional scaling therefore hands longshots too much
// probability and favourites too little.
//
// Measured on 16,503 Pinnacle closing lines from this repository's own data:
//
//   de-vigged bucket   proportional says   actually happens   error
//     5-10%                  7.81%              5.65%         +2.16
//    10-20%                 15.68%             14.17%         +1.51
//    20-35%                 27.20%             26.86%         +0.35
//    35-50%                 41.97%             42.57%         -0.59
//    50-70%                 58.47%             60.19%         -1.72
//    70%+                   77.56%             80.99%         -3.43
//
// That bias is large enough to fabricate a betting strategy. Selecting outcomes where "the best price
// beats the fair probability" picked mostly longshots, and a hindsight-perfect version of that
// strategy still returned -2.93%, because the outcomes were never positive expected value — the
// yardstick was wrong, not the selection.
//
// The power method fixes most of it: raise each inverse odd to a power k chosen so they sum to 1.
// Since inverse odds are below 1, a k above 1 shrinks small values proportionally more than large
// ones, which is the correction needed. Same table under the power method:
//
//     5-10%  +1.26    10-20%  +0.84    20-35%  +0.14    35-50%  -0.34    50-70%  -0.87    70%+  -1.59
//
// Roughly half the error, no fitted parameters, and it cannot reorder outcomes. Shin's method models
// insider money explicitly and does slightly better again, but it needs a fitted parameter per league
// and the gain over this is small.
//
// Note on hit rates: picking the highest probability is unaffected by which method is used, because
// both are monotone. Accuracy comparisons in this project are therefore unchanged. Brier scores and
// anything involving expected value are affected, and should use the power method.

const clean = (h, d, a) => {
  const x = [Number(h), Number(d), Number(a)];
  return x.every(v => Number.isFinite(v) && v > 1) ? x : null;
};

/**
 * Proportional (multiplicative) de-vig. Kept for comparison and for reproducing older figures.
 * Biased: overstates longshots, understates favourites.
 */
export function devigProportional(h, d, a) {
  const o = clean(h, d, a);
  if (!o) return null;
  const inv = o.map(x => 1 / x);
  const sum = inv[0] + inv[1] + inv[2];
  return {
    method: 'proportional',
    probs: inv.map(x => x / sum),
    overround: sum - 1
  };
}

/**
 * Power de-vig: find k such that sum(inverseOdds^k) = 1, by bisection.
 * Preferred for fair probabilities and for any expected-value calculation.
 */
export function devigPower(h, d, a) {
  const o = clean(h, d, a);
  if (!o) return null;
  const inv = o.map(x => 1 / x);
  const sum = inv[0] + inv[1] + inv[2];
  // A price set with no margin needs no correction.
  if (sum <= 1) return { method: 'power', probs: inv.map(x => x / sum), overround: sum - 1, k: 1 };

  // sum(inv^k) decreases as k rises, because every inv is below 1. Bracket generously and bisect.
  let lo = 1, hi = 3;
  const at = (k) => inv.reduce((s, x) => s + Math.pow(x, k), 0);
  let guard = 0;
  while (at(hi) > 1 && guard++ < 40) hi *= 1.5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > 1) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const p = inv.map(x => Math.pow(x, k));
  const total = p[0] + p[1] + p[2];
  return {
    method: 'power',
    probs: p.map(x => x / total),
    overround: sum - 1,
    k
  };
}

/**
 * Fair probabilities as percentages, keyed by outcome, using the power method by default.
 *
 * @returns {{HOME:number, DRAW:number, AWAY:number, overround:number, method:string}|null}
 */
export function fairProbabilities(h, d, a, method = 'power') {
  const r = method === 'proportional' ? devigProportional(h, d, a) : devigPower(h, d, a);
  if (!r) return null;
  return {
    HOME: r.probs[0] * 100,
    DRAW: r.probs[1] * 100,
    AWAY: r.probs[2] * 100,
    overround: r.overround * 100,
    method: r.method,
    k: r.k ?? null
  };
}

/**
 * Expected value of backing one outcome at a price, judged against a fair probability.
 * Returns the edge as a fraction: 0.05 means 5% expected profit per unit staked.
 */
export function expectedValue(price, fairProbPct) {
  if (!(price > 1) || !(fairProbPct >= 0)) return null;
  return price * (fairProbPct / 100) - 1;
}
