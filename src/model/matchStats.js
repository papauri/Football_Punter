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

const logit = (p) => Math.log(clamp(p, 1e-4, 1 - 1e-4) / (1 - clamp(p, 1e-4, 1 - 1e-4)));

/**
 * Inputs for the market adjustment of one line: the model's own chance, plus the market's expected
 * total goals and how one-sided it expects the match to be. Tight matches draw more cards.
 */
export function lineFeatures(p, goals) {
  return [logit(p), goals.lambda + goals.mu - 2.7, Math.abs(goals.lambda - goals.mu), goals.lambda - goals.mu];
}

function adjusted(p, goals, w) {
  if (!goals || !Array.isArray(w)) return p;
  const x = lineFeatures(p, goals);
  let z = w[0];
  for (let i = 0; i < x.length; i++) z += w[i + 1] * x[i];
  return 1 / (1 + Math.exp(-z));
}

/**
 * Every corners and cards line with the side the model favours, most likely first.
 * These are the only markets that have been scored against real results (see heldOut in the data file).
 * With `goals` (expected goals from bookmaker prices) and fitted `calibration`, each chance is
 * adjusted by the market's view of the match.
 */
export function statPicks(exp, params = DEFAULT_PARAMS, goals = null, calibration = null) {
  const corners = exp.homeCorners + exp.awayCorners, cards = exp.homeCards + exp.awayCards;
  const out = [];
  for (const [market, lines, mean, shape] of [['CORNERS', CORNER_LINES, corners, params.cornersShape], ['CARDS', CARD_LINES, cards, params.cardsShape]]) {
    for (const line of lines) {
      const p = adjusted(probOver(mean, line, shape), goals, calibration?.[market]?.[line]);
      out.push({ market, line, side: p >= 0.5 ? 'OVER' : 'UNDER', prob: Math.max(p, 1 - p), expected: mean });
    }
  }
  return out.sort((a, b) => b.prob - a.prob);
}

export const pickHit = (pick, totalCorners, totalCards) => {
  const total = pick.market === 'CORNERS' ? totalCorners : totalCards;
  return pick.side === 'OVER' ? total > pick.line : total < pick.line;
};

// ---- Team markets -----------------------------------------------------------------------------
// Per-team counts, "most corners" and "both teams booked". One team's corners vary more than a
// match total, so team corners use a wider spread (shape 8, fitted on 2021-24); cards keep 30. A
// two-number correction per market (fitted by scripts/fit-match-stats.mjs) removes what bias is
// left, e.g. "both teams booked" came in about 4 points more often than the raw figure said.
export const TEAM_SHAPE = { corners: 8, cards: 30 };
export const TEAM_MARKETS = [
  ...[3.5, 4.5, 5.5, 6.5].map(line => ({ key: `home_corners_${line}`, market: 'CORNERS', kind: 'team', team: 'home', stat: 'corners', line })),
  ...[2.5, 3.5, 4.5, 5.5].map(line => ({ key: `away_corners_${line}`, market: 'CORNERS', kind: 'team', team: 'away', stat: 'corners', line })),
  { key: 'home_most_corners', market: 'CORNERS', kind: 'most', team: 'home', stat: 'corners' },
  { key: 'away_most_corners', market: 'CORNERS', kind: 'most', team: 'away', stat: 'corners' },
  // No 0.5 card lines: a team gets at least one card about 86-90% of the time, so they pay too little
  // to be worth a tip and would crowd out every other pick.
  ...[1.5, 2.5].map(line => ({ key: `home_cards_${line}`, market: 'CARDS', kind: 'team', team: 'home', stat: 'cards', line })),
  ...[1.5, 2.5].map(line => ({ key: `away_cards_${line}`, market: 'CARDS', kind: 'team', team: 'away', stat: 'cards', line })),
  { key: 'both_teams_carded', market: 'CARDS', kind: 'both', stat: 'cards' }
];

function nbDist(mean, shape, n = 30) {
  const p = shape / (shape + mean), out = [];
  for (let k = 0; k < n; k++) out.push(Math.exp(logGamma(k + shape) - logGamma(shape) - logGamma(k + 1) + shape * Math.log(p) + k * Math.log(1 - p)));
  return out;
}

/** Raw chance (0..1) of the market's "yes" side: over the line, most corners, or both booked. */
export function teamMarketRaw(exp, def) {
  const shape = TEAM_SHAPE[def.stat];
  const h = def.stat === 'corners' ? exp.homeCorners : exp.homeCards;
  const a = def.stat === 'corners' ? exp.awayCorners : exp.awayCards;
  if (def.kind === 'team') return probOver(def.team === 'home' ? h : a, def.line, shape);
  const dh = nbDist(h, shape), da = nbDist(a, shape);
  if (def.kind === 'both') return (1 - dh[0]) * (1 - da[0]);
  let p = 0;
  for (let i = 0; i < dh.length; i++) for (let j = 0; j < da.length; j++) if (def.team === 'home' ? i > j : j > i) p += dh[i] * da[j];
  return p;
}

/** Whether the "yes" side of a team market came in, given the match's counts. */
export function teamMarketOutcome(def, s) {
  const h = def.stat === 'corners' ? s.hc : s.hk, a = def.stat === 'corners' ? s.ac : s.ak;
  if (def.kind === 'team') return (def.team === 'home' ? h : a) > def.line;
  if (def.kind === 'both') return h > 0 && a > 0;
  return def.team === 'home' ? h > a : a > h;
}

const recalibrate = (p, w) => (Array.isArray(w) ? 1 / (1 + Math.exp(-(w[0] + w[1] * logit(p)))) : p);

function teamMarketLabel(def, yes) {
  const noun = def.stat === 'corners' ? 'corners' : 'cards';
  if (def.kind === 'both') return yes ? 'Both teams get a card' : 'Not both teams get a card';
  if (def.kind === 'most') return `{${def.team}} most corners`;
  return `{${def.team}} ${yes ? 'over' : 'under'} ${def.line} ${noun}`;
}

/**
 * Team-market picks with the side the model favours. Labels carry {home}/{away} placeholders for
 * the caller to fill with team names. "Most corners" is offered only on its yes side (a tie loses).
 */
export function teamPicks(exp, calibration = null) {
  const out = [];
  for (const def of TEAM_MARKETS) {
    const p = recalibrate(teamMarketRaw(exp, def), calibration?.[def.key]);
    if (def.kind === 'most' && p < 0.5) continue;
    const yes = p >= 0.5;
    const mean = def.stat === 'corners' ? (def.team === 'away' ? exp.awayCorners : exp.homeCorners) : (def.team === 'away' ? exp.awayCards : exp.homeCards);
    out.push({ market: def.market, key: def.key, line: def.line ?? null, side: yes ? (def.kind === 'team' ? 'OVER' : 'YES') : (def.kind === 'team' ? 'UNDER' : 'NO'),
      prob: yes ? p : 1 - p, expected: def.kind === 'team' ? mean : null, label: teamMarketLabel(def, yes), def });
  }
  return out.sort((a, b) => b.prob - a.prob);
}

export const teamPickHit = (pick, s) => {
  const yes = teamMarketOutcome(pick.def, s);
  return pick.side === 'OVER' || pick.side === 'YES' ? yes : !yes;
};
