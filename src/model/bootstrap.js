// Bootstrap confidence intervals for betting returns.
//
// Flat-stake returns are heavily skewed — most bets return 0 or a small multiple, a few return the
// full price — so a normal-approximation interval is falsely tight. Resampling the per-bet returns
// with replacement and reading off percentiles is the honest alternative.
//
// The generator matters more than it looks. The scripts in this repository previously each carried
// an inline linear congruential generator, `seed = (seed * 1103515245 + 12345) & 0x7fffffff`. In
// JavaScript that product exceeds 2^53, so the low bits of every state are lost to floating-point
// rounding and the sequence falls into a cycle of just 10,466 values. A bootstrap of 3,569 bets
// with 2,000 resamples needs 7.1 million draws, so every "resample" was close to a copy of the same
// few thousand indices, and the reported intervals were neither centred on the estimate nor the
// right width. mulberry32 below does its arithmetic with Math.imul, stays within 32 bits, and has a
// period of 2^32.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Percentile bootstrap for flat-stake ROI.
 *
 * @param {number[]} returns  gross return per 1-unit stake for each bet (0 = lost, 1 = push, price = won)
 * @param {Object} [options]
 * @param {number} [options.resamples=2000]
 * @param {number} [options.seed=20260927]  fixed, so a rerun on unchanged data reports the same interval
 * @param {number} [options.level=0.95]
 * @returns {{roi:number, lo:number, hi:number, n:number}|null}  percentages
 */
export function bootstrapRoi(returns, options = {}) {
  const xs = (returns || []).filter(x => Number.isFinite(x));
  const n = xs.length;
  if (n < 2) return null;
  const resamples = options.resamples ?? 2000;
  const level = options.level ?? 0.95;
  const rnd = mulberry32(options.seed ?? 20260927);

  const roi = (xs.reduce((a, b) => a + b, 0) - n) / n * 100;
  const out = new Float64Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += xs[(rnd() * n) | 0];
    out[r] = (sum - n) / n * 100;
  }
  out.sort();
  const tail = (1 - level) / 2;
  return {
    roi,
    lo: out[Math.floor(resamples * tail)],
    hi: out[Math.min(resamples - 1, Math.floor(resamples * (1 - tail)))],
    n
  };
}
