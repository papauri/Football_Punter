// Expected goals read from bookmaker prices, and remembered from past prices.
//
// Measured on 10,348 matches from 2024-25 onwards in the 14 main European leagues, the expected goals
// implied by the opening match-result prices beat our own goals model on every goals market: over 2.5
// hit 57.3% against about 53.6%, both-teams-to-score 55.6% against 54.0%, the most likely exact score
// 13.3% against 12.2%, and the top three scores 34.1% against 30.5%. Adding our model's own expected
// goals on top of the implied ones changed nothing measurable, so when a price exists it is used.
//
// impliedGoals() finds the home and away expected goals whose scoreline grid reproduces the market's
// home/draw/away chances (and the over 2.5 chance, when an over/under price is known).
//
// MarketMemory keeps a rating per team learned from the expected goals implied by past prices, not
// from results. Prices carry far less noise than scorelines, so these ratings predict a match with no
// odds almost as well as the odds would: 51.3% hit against 51.9% for the actual prices, where ratings
// learned from results managed 49.9%.

const MAXG = 10;
const FACT = [1];
for (let i = 1; i <= MAXG; i++) FACT[i] = FACT[i - 1] * i;

/** Scoreline grid (Poisson with the Dixon-Coles low-score adjustment), normalised. */
export function scoreGrid(lambda, mu, rho = -0.05) {
  const pl = [], pm = [];
  for (let i = 0; i <= MAXG; i++) {
    pl[i] = Math.exp(-lambda) * lambda ** i / FACT[i];
    pm[i] = Math.exp(-mu) * mu ** i / FACT[i];
  }
  const g = [];
  let s = 0;
  for (let i = 0; i <= MAXG; i++) {
    g[i] = [];
    for (let j = 0; j <= MAXG; j++) {
      let tau = 1;
      if (i === 0 && j === 0) tau = 1 - lambda * mu * rho;
      else if (i === 0 && j === 1) tau = 1 + lambda * rho;
      else if (i === 1 && j === 0) tau = 1 + mu * rho;
      else if (i === 1 && j === 1) tau = 1 - rho;
      g[i][j] = pl[i] * pm[j] * tau;
      s += g[i][j];
    }
  }
  for (const row of g) for (let j = 0; j <= MAXG; j++) row[j] /= s;
  return g;
}

export function gridMarkets(g, line = 2.5) {
  let h = 0, d = 0, a = 0, over = 0, push = 0;
  for (let i = 0; i <= MAXG; i++) {
    for (let j = 0; j <= MAXG; j++) {
      const p = g[i][j];
      if (i > j) h += p; else if (i === j) d += p; else a += p;
      if (i + j > line) over += p; else if (i + j === line) push += p;
    }
  }
  // On a whole-number line a total equal to the line is refunded, so the price reflects over
  // against under with those cases removed.
  return { h, d, a, over: push ? over / (1 - push) : over };
}

/** Bookmaker odds with the margin removed (proportionally). */
export function fairProbs(odds) {
  const q = odds.map(o => 1 / o);
  const s = q.reduce((x, y) => x + y, 0);
  return q.map(x => x / s);
}

/**
 * Expected goals implied by market chances.
 * @param {{h:number, d:number, a:number, over?:number, line?:number}} t chances (0..1); `over` is the
 *   chance of going over `line` goals (default 2.5), from an over/under price when one is known
 * @returns {{lambda:number, mu:number}|null}
 */
export function impliedGoals(t) {
  if (![t.h, t.d, t.a].every(x => Number.isFinite(x) && x > 0)) return null;
  const line = Number.isFinite(t.line) ? t.line : 2.5;
  const withLine = Number.isFinite(t.over) && t.over > 0 && t.over < 1 && line >= 0.5 && line <= 6.5;
  // With only match-result prices the draw chance is what pins down the goal total, and that link
  // depends on the low-score adjustment; -0.05 fitted best. With an over/under price it barely matters.
  const rho = withLine ? -0.1 : -0.05;
  const err = (l, m) => {
    const k = gridMarkets(scoreGrid(l, m, rho), line);
    let e = (k.h - t.h) ** 2 + (k.a - t.a) ** 2;
    e += withLine ? 2 * (k.over - t.over) ** 2 : (k.d - t.d) ** 2;
    return e;
  };
  let best = [1.4, 1.1], be = err(1.4, 1.1);
  for (const step of [0.4, 0.15, 0.05, 0.015, 0.005]) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const [dl, dm] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]) {
        const l = best[0] + dl, m = best[1] + dm;
        if (l < 0.05 || m < 0.05 || l > 6 || m > 6) continue;
        const e = err(l, m);
        if (e < be) { be = e; best = [l, m]; improved = true; }
      }
    }
  }
  return { lambda: best[0], mu: best[1] };
}

/**
 * Team ratings learned from the expected goals implied by past prices.
 * log(home goals) = league home base + home attack - away defence, and likewise for the away side.
 */
export class MarketMemory {
  constructor({ rate = 0.25, minMatches = 5 } = {}) {
    this.rate = rate;
    this.minMatches = minMatches;
    this.teams = {};
    this.leagues = {};
  }

  /** Learn from one past match whose prices implied these expected goals. Call in date order. */
  update(league, home, away, lambda, mu) {
    if (!league || !home || !away || !(lambda > 0) || !(mu > 0)) return;
    const L = (this.leagues[league] ||= { hb: Math.log(1.5), ab: Math.log(1.2), n: 0 });
    const h = (this.teams[home] ||= { att: 0, def: 0, n: 0, league });
    const a = (this.teams[away] ||= { att: 0, def: 0, n: 0, league });
    // A team seen in a new league (promotion, relegation) starts again: its ratings were relative to
    // the old league's baseline.
    if (h.league !== league) Object.assign(h, { att: 0, def: 0, n: 0, league });
    if (a.league !== league) Object.assign(a, { att: 0, def: 0, n: 0, league });
    const pl = Math.exp(L.hb + h.att - a.def), pm = Math.exp(L.ab + a.att - h.def);
    const gl = Math.log(lambda / pl) * pl, gm = Math.log(mu / pm) * pm;
    const r = this.rate;
    h.att += r * gl; a.def -= r * gl;
    a.att += r * gm; h.def -= r * gm;
    L.hb += r * 0.1 * gl; L.ab += r * 0.1 * gm;
    h.n++; a.n++; L.n++;
  }

  /** Expected goals for a fixture, or null unless both teams are known in this league. */
  predict(league, home, away) {
    const L = this.leagues[league], h = this.teams[home], a = this.teams[away];
    if (!L || !h || !a || h.league !== league || a.league !== league) return null;
    if (h.n < this.minMatches || a.n < this.minMatches) return null;
    return { lambda: Math.exp(L.hb + h.att - a.def), mu: Math.exp(L.ab + a.att - h.def) };
  }
}
