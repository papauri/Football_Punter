// Corners and cards, from real match statistics.
//
// football-data.co.uk records corners, yellow and red cards (and the referee, for the English and
// Scottish leagues) for every match in the 14 main European leagues. This model keeps, for each
// league, the average corners and cards at home and away, and for each team how far above or below
// that average it runs, both for (corners it wins, cards it gets) and against (corners and cards its
// opponents get). Ratings move a little after every match, so recent matches count for more and a
// team with little history stays close to its league average.
//
// Referees were tested too (the English and Scottish files name them) and made no difference out of
// sample once each team's own record was known, so they are not used.
//
// Expected corners for the home side = league home average x home attack rating x away defence rating,
// and likewise for the away side and for cards. Totals are turned into over/under chances with a
// negative binomial, whose extra spread is fitted to what the data shows.
//
// Tuned by scripts/fit-match-stats.mjs, which also reports how it did on seasons it never saw.

export const CORNER_LINES = [7.5, 8.5, 9.5, 10.5, 11.5];
export const CARD_LINES = [2.5, 3.5, 4.5, 5.5];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const DEFAULT_PARAMS = { teamRate: 0.02, leagueRate: 0.004, cornersShape: 30, cardsShape: 30 };

/**
 * Walks matches in date order and keeps the ratings. Call expect() before update() for each match
 * to get what the model knew beforehand.
 */
export class MatchStatsModel {
  constructor(params = {}) {
    this.p = { ...DEFAULT_PARAMS, ...params };
    this.leagues = {};
    this.teams = {};
  }

  league(lg) {
    return (this.leagues[lg] ||= { hc: 5.3, ac: 4.4, hk: 2.0, ak: 2.3, n: 0 });
  }

  team(name) {
    return (this.teams[name] ||= { cf: 1, ca: 1, kf: 1, ka: 1, n: 0 });
  }

  /** Expected corners and cards for each side, or null when the league has too little history. */
  expect(lg, home, away) {
    const L = this.leagues[lg];
    if (!L || L.n < 30) return null;
    const h = this.teams[home] || { cf: 1, ca: 1, kf: 1, ka: 1, n: 0 };
    const a = this.teams[away] || { cf: 1, ca: 1, kf: 1, ka: 1, n: 0 };
    return {
      homeCorners: L.hc * h.cf * a.ca,
      awayCorners: L.ac * a.cf * h.ca,
      homeCards: L.hk * h.kf * a.ka,
      awayCards: L.ak * a.kf * h.ka,
      history: Math.min(h.n, a.n)
    };
  }

  update(m) {
    const L = this.league(m.lg);
    const e = this.expect(m.lg, m.home, m.away) || { homeCorners: L.hc, awayCorners: L.ac, homeCards: L.hk, awayCards: L.ak };
    const h = this.team(m.home), a = this.team(m.away);
    const t = this.p.teamRate;
    // How far each side ran from what was expected (1 = exactly as expected). Half of the gap goes
    // to each team's rating. The ratio averages 1, so ratings do not drift up or down over time.
    const gap = (obs, exp) => clamp(obs / Math.max(exp, 0.3), 0, 3) - 1;
    const move = (x, g) => x * (1 + t * g / 2);
    const gHC = gap(m.hc, e.homeCorners), gAC = gap(m.ac, e.awayCorners);
    const gHK = gap(m.hk, e.homeCards), gAK = gap(m.ak, e.awayCards);
    h.cf = move(h.cf, gHC); a.ca = move(a.ca, gHC);
    a.cf = move(a.cf, gAC); h.ca = move(h.ca, gAC);
    h.kf = move(h.kf, gHK); a.ka = move(a.ka, gHK);
    a.kf = move(a.kf, gAK); h.ka = move(h.ka, gAK);
    h.n++; a.n++;
    h.lg = a.lg = m.lg;
    const lr = L.n < 100 ? 1 / (L.n + 1) : this.p.leagueRate;
    L.hc += lr * (m.hc - L.hc); L.ac += lr * (m.ac - L.ac);
    L.hk += lr * (m.hk - L.hk); L.ak += lr * (m.ak - L.ak);
    L.n++;
  }

  toJSON() {
    return { params: this.p, leagues: this.leagues, teams: this.teams };
  }

  static fromJSON(j) {
    const m = new MatchStatsModel(j.params);
    Object.assign(m.leagues, j.leagues || {});
    Object.assign(m.teams, j.teams || {});
    return m;
  }
}

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/** Chance (0..1) that a negative binomial count with this mean and shape goes over the line. */
export function probOver(mean, line, shape) {
  const r = shape, p = r / (r + mean);
  let under = 0;
  for (let k = 0; k <= Math.floor(line); k++) {
    under += Math.exp(logGamma(k + r) - logGamma(r) - logGamma(k + 1) + r * Math.log(p) + k * Math.log(1 - p));
  }
  return clamp(1 - under, 0, 1);
}

/** Over chances in percent for each standard line. */
export function linesFor(mean, lines, shape) {
  const out = {};
  for (const l of lines) out[l] = +(probOver(mean, l, shape) * 100).toFixed(1);
  return out;
}

/**
 * Every corners and cards line with the side the model favours, most likely first.
 * These are the only markets that have been scored against real results (see heldOut in the data file).
 */
export function statPicks(exp, params = DEFAULT_PARAMS) {
  const corners = exp.homeCorners + exp.awayCorners, cards = exp.homeCards + exp.awayCards;
  const out = [];
  for (const line of CORNER_LINES) {
    const p = probOver(corners, line, params.cornersShape);
    out.push({ market: 'CORNERS', line, side: p >= 0.5 ? 'OVER' : 'UNDER', prob: Math.max(p, 1 - p), expected: corners });
  }
  for (const line of CARD_LINES) {
    const p = probOver(cards, line, params.cardsShape);
    out.push({ market: 'CARDS', line, side: p >= 0.5 ? 'OVER' : 'UNDER', prob: Math.max(p, 1 - p), expected: cards });
  }
  return out.sort((a, b) => b.prob - a.prob);
}

export const pickHit = (pick, totalCorners, totalCards) => {
  const total = pick.market === 'CORNERS' ? totalCorners : totalCards;
  return pick.side === 'OVER' ? total > pick.line : total < pick.line;
};
