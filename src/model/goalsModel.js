// Goals markets: over/under 1.5, 2.5, 3.5 and both teams to score.
//
// The scoreline grid on its own overstated goals. Measured out of sample over 14,700 fixtures it
// expected about 3.2 goals a game against 2.8 actually scored, so every "over" and "both teams
// score" figure ran several points high, and its tips hit no more often than always backing the
// more common outcome.
//
// This replaces those four figures with a small logistic model per market, fitted on walk-forward
// predictions (the engine only ever saw earlier fixtures) against what actually happened. Its only
// inputs are the engine's own expected goals for each side, which carry nearly all of the usable
// signal: adding recent team form (goals for and against, over and BTTS rates, clean sheets) was
// tested and moved the out-of-sample Brier score by less than 0.001.
//
// Fitted by scripts/fit-goals-model.mjs into data/goals-model.json.

export const GOALS_MARKETS = ['o15', 'o25', 'o35', 'btts'];

export function goalsFeatures(lambda, mu) {
  const l = Number(lambda) || 0, m = Number(mu) || 0;
  return [l + m - 3, Math.abs(l - m), Math.min(l, m) - 1];
}

const outcome = {
  o15: (h, a) => h + a > 1.5,
  o25: (h, a) => h + a > 2.5,
  o35: (h, a) => h + a > 3.5,
  btts: (h, a) => h > 0 && a > 0
};

/** Plain logistic regression by gradient descent; weights[0] is the intercept. */
export function fitLogistic(xs, ys, { iterations = 2500, rate = 0.3, l2 = 1e-3 } = {}) {
  let w = new Array(xs[0].length + 1).fill(0);
  for (let it = 0; it < iterations; it++) {
    const g = new Array(w.length).fill(0);
    for (let k = 0; k < xs.length; k++) {
      const x = [1, ...xs[k]];
      const p = 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * w[i], 0)));
      x.forEach((v, i) => { g[i] += (p - ys[k]) * v; });
    }
    w = w.map((wi, i) => wi - rate * (g[i] / xs.length + (i ? l2 * wi : 0)));
  }
  return w;
}

/**
 * @param {Array<{lambda:number, mu:number, hg:number, ag:number}>} rows walk-forward predictions with results
 * @returns {{weights: Object<string, number[]>, samples: number}}
 */
export function fitGoalsModel(rows) {
  const clean = rows.filter(r => Number.isFinite(r.lambda) && Number.isFinite(r.mu) && Number.isFinite(r.hg) && Number.isFinite(r.ag));
  const xs = clean.map(r => goalsFeatures(r.lambda, r.mu));
  const weights = {};
  for (const k of GOALS_MARKETS) weights[k] = fitLogistic(xs, clean.map(r => (outcome[k](r.hg, r.ag) ? 1 : 0)));
  return { weights, samples: clean.length };
}

/**
 * Probabilities in percent, or null when no fitted model is loaded.
 * Over 1.5 >= over 2.5 >= over 3.5 is enforced, since separately fitted curves could cross.
 */
export function goalsProbabilities(lambda, mu, model) {
  if (!model?.weights) return null;
  const x = [1, ...goalsFeatures(lambda, mu)];
  const p = {};
  for (const k of GOALS_MARKETS) {
    const w = model.weights[k];
    if (!Array.isArray(w) || w.length !== x.length) return null;
    p[k] = 100 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * w[i], 0)));
  }
  p.o25 = Math.min(p.o25, p.o15);
  p.o35 = Math.min(p.o35, p.o25);
  return p;
}

export function goalsOutcome(market, homeGoals, awayGoals) {
  return outcome[market](homeGoals, awayGoals);
}
