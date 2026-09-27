// Probability calibration.
//
// The model was overconfident where it mattered most: fixtures it graded 72%+ came in at 67.8%
// out of sample, and the 72%+ bucket was no better than the 65%+ one. A stated confidence that
// does not match the observed strike rate makes staking decisions worse than no number at all.
//
// This fits a monotonic reliability map from the model's own claimed probability to the rate
// actually observed, using isotonic regression (pool-adjacent-violators). Isotonic is preferred
// over a logistic/Platt fit here because the miscalibration is not a smooth stretch — it is
// specifically the top of the range that breaks down, and isotonic can bend there without
// disturbing the middle, while still never reordering two picks.
//
// The map must be fitted on matches the evaluation will not score, or it launders the answer into
// the question. fitCalibration is therefore called with a training corpus only.

/**
 * Fit an isotonic calibration map.
 *
 * @param {Array<{p: number, hit: boolean|number}>} samples claimed probability and whether it landed
 * @param {Object} [options]
 * @param {number} [options.minSamples=300] below this, return an identity map rather than a shaky one
 * @param {number} [options.minBinSize=40] merge adjacent points until each block has this much support
 * @returns {{points: Array<{p:number,rate:number,n:number}>, meta: Object}}
 */
export function fitCalibration(samples, options = {}) {
  const minSamples = options.minSamples ?? 300;
  const minBinSize = options.minBinSize ?? 40;

  const clean = (samples || [])
    .filter(s => s && Number.isFinite(s.p) && s.p >= 0 && s.p <= 1)
    .map(s => ({ p: s.p, y: s.hit ? 1 : 0 }))
    .sort((a, b) => a.p - b.p);

  if (clean.length < minSamples) {
    return { points: [], meta: { fitted: false, reason: `only ${clean.length} samples (need ${minSamples})`, samples: clean.length } };
  }

  // 1. Bin into blocks of at least minBinSize, so each point rests on real support.
  const blocks = [];
  for (let i = 0; i < clean.length;) {
    let sumP = 0, sumY = 0, n = 0;
    while (i < clean.length && (n < minBinSize || sumP / n === clean[i].p)) {
      sumP += clean[i].p; sumY += clean[i].y; n++; i++;
    }
    // Fold a short trailing block into the previous one rather than trusting it alone.
    if (n < minBinSize && blocks.length) {
      const last = blocks[blocks.length - 1];
      last.sumP += sumP; last.sumY += sumY; last.n += n;
    } else {
      blocks.push({ sumP, sumY, n });
    }
  }

  // 2. Pool adjacent violators: merge any block whose rate falls below its predecessor, so the
  // resulting map is non-decreasing and two picks never swap order.
  const pav = blocks.map(b => ({ ...b }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 1; i < pav.length; i++) {
      if (pav[i].sumY / pav[i].n < pav[i - 1].sumY / pav[i - 1].n - 1e-12) {
        pav[i - 1].sumP += pav[i].sumP;
        pav[i - 1].sumY += pav[i].sumY;
        pav[i - 1].n += pav[i].n;
        pav.splice(i, 1);
        merged = true;
        break;
      }
    }
  }

  const points = pav.map(b => ({
    p: parseFloat((b.sumP / b.n).toFixed(4)),
    rate: parseFloat((b.sumY / b.n).toFixed(4)),
    n: b.n
  }));

  // Mean absolute calibration error before and after, for the record.
  let errBefore = 0, errAfter = 0, total = 0;
  for (const b of pav) {
    const claimed = b.sumP / b.n, observed = b.sumY / b.n;
    errBefore += b.n * Math.abs(claimed - observed);
    errAfter += b.n * Math.abs(observed - observed);
    total += b.n;
  }

  return {
    points,
    meta: {
      fitted: true,
      samples: clean.length,
      blocks: points.length,
      meanAbsCalibrationError: parseFloat((errBefore / Math.max(1, total)).toFixed(4)),
      residualError: parseFloat((errAfter / Math.max(1, total)).toFixed(4))
    }
  };
}

/**
 * Map one claimed probability through a fitted calibration, interpolating between fitted points
 * and holding the end values beyond them. An unfitted map returns the input unchanged.
 */
export function applyCalibration(p, calibration) {
  if (!Number.isFinite(p)) return p;
  const pts = calibration?.points;
  if (!pts || pts.length < 2) return p;
  if (p <= pts[0].p) return pts[0].rate;
  if (p >= pts[pts.length - 1].p) return pts[pts.length - 1].rate;
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i].p) {
      const a = pts[i - 1], b = pts[i];
      const span = b.p - a.p;
      if (span <= 1e-9) return b.rate;
      return a.rate + (b.rate - a.rate) * ((p - a.p) / span);
    }
  }
  return p;
}

/**
 * Calibrate a home/draw/away triple and renormalise to 100. Each outcome is mapped independently,
 * which can break the sum, so the result is rescaled. Ordering within the triple is preserved
 * because the map is monotonic.
 *
 * @param {{home:number,draw:number,away:number}} probs percentages summing to ~100
 * @returns {{home:number,draw:number,away:number}} percentages summing to 100
 */
export function calibrateTriple(probs, calibration) {
  if (!calibration?.points?.length) return probs;
  const raw = [probs.home, probs.draw, probs.away].map(x => applyCalibration((Number(x) || 0) / 100, calibration));
  const sum = raw.reduce((s, x) => s + x, 0);
  if (!(sum > 0)) return probs;
  return {
    home: parseFloat(((raw[0] / sum) * 100).toFixed(1)),
    draw: parseFloat(((raw[1] / sum) * 100).toFixed(1)),
    away: parseFloat(((raw[2] / sum) * 100).toFixed(1))
  };
}
