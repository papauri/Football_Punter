// Opponent-adjusted team strength fitting.
//
// Why this exists: attack/defence used to be a team's raw goals-per-game divided by a constant,
// which credits a side for having played weak opponents and punishes it for a hard schedule. Teams
// absent from the training corpus were worse still — their ratings came from a hash of the club
// name, i.e. deterministic noise. Both are replaced here by a Dixon-Coles style maximum-likelihood
// fit in which every team's attack and defence are solved jointly, so facing a strong defence is
// accounted for.
//
// Model (multiplicative, matching how engine.js builds lambda/mu):
//   home goals ~ Poisson(base[league] * attack[home] * defence[away] * homeAdv[league])
//   away goals ~ Poisson(base[league] * attack[away] * defence[home])
//
// attack and defence are normalised to mean 1, so they stay drop-in compatible with the existing
// lambda/mu scale and the thresholds tuned against it. Fitting is by iterative proportional
// updates: each parameter's closed-form weighted update given the others, repeated to convergence.
// This is the standard approach for this likelihood and converges in a few dozen passes.

const DEFAULTS = {
  // Exponential time decay. halfLifeDays is the more legible knob; xi is derived from it.
  halfLifeDays: 240,
  // Shrinkage toward the league average, in "phantom games" of evidence. Keeps a side with three
  // matches from being handed an extreme rating.
  priorGames: 8,
  iterations: 60,
  tolerance: 1e-5,
  // Guard rails on the final multipliers, matching the ranges engine.js previously clamped to.
  minAttack: 0.45,
  maxAttack: 2.4,
  minDefence: 0.45,
  maxDefence: 2.2
};

const winnerOf = (h, a) => (h > a ? 'HOME' : a > h ? 'AWAY' : 'DRAW');

/**
 * Fit per-team attack/defence multipliers and per-league baselines from played matches.
 *
 * @param {Array} matches  played fixtures: { home, away, homeScore, awayScore, league, timestamp }
 * @param {Object} [options] see DEFAULTS
 * @returns {{teams: Object, leagues: Object, meta: Object}}
 */
export function fitTeamStrengths(matches, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const xi = Math.log(2) / Math.max(1, cfg.halfLifeDays);

  const games = [];
  let latest = 0;
  for (const m of matches || []) {
    if (!m || !m.home || !m.away) continue;
    const hg = typeof m.homeScore === 'number' ? m.homeScore : m.goals?.home;
    const ag = typeof m.awayScore === 'number' ? m.awayScore : m.goals?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    const ts = m.timestamp || (m.date ? new Date(m.date).getTime() : 0);
    if (ts > latest) latest = ts;
    games.push({ home: m.home, away: m.away, hg, ag, league: m.league || 'Unknown', ts });
  }
  if (!games.length) {
    return { teams: {}, leagues: {}, meta: { matches: 0, teams: 0, fitted: false } };
  }

  // Exponential recency weight. Matches with no usable timestamp are treated as oldest rather
  // than newest, so undated rows cannot dominate the fit.
  const DAY = 86400000;
  for (const g of games) {
    const ageDays = g.ts ? Math.max(0, (latest - g.ts) / DAY) : cfg.halfLifeDays * 4;
    g.w = Math.exp(-xi * ageDays);
  }

  // ---- initialise -----------------------------------------------------------------------------
  const teams = new Map();   // name -> { attack, defence, wGames, scored, conceded }
  const leagues = new Map(); // league -> { base, homeAdv, w, homeGoals, awayGoals }

  const touchTeam = (name) => {
    if (!teams.has(name)) teams.set(name, { attack: 1, defence: 1, wGames: 0, scored: 0, conceded: 0, games: 0 });
    return teams.get(name);
  };
  const touchLeague = (name) => {
    if (!leagues.has(name)) leagues.set(name, { base: 1.35, homeAdv: 1.25, w: 0, homeGoals: 0, awayGoals: 0 });
    return leagues.get(name);
  };

  for (const g of games) {
    const h = touchTeam(g.home), a = touchTeam(g.away), L = touchLeague(g.league);
    h.wGames += g.w; a.wGames += g.w;
    h.games++; a.games++;
    h.scored += g.w * g.hg; h.conceded += g.w * g.ag;
    a.scored += g.w * g.ag; a.conceded += g.w * g.hg;
    L.w += g.w; L.homeGoals += g.w * g.hg; L.awayGoals += g.w * g.ag;
  }

  // League baseline = weighted mean goals per team per game; home advantage = home/away goal ratio.
  for (const L of leagues.values()) {
    const home = L.homeGoals / Math.max(1e-9, L.w);
    const away = L.awayGoals / Math.max(1e-9, L.w);
    L.base = Math.max(0.4, Math.min(2.6, (home + away) / 2));
    L.homeAdv = Math.max(1.0, Math.min(1.7, away > 0.05 ? home / away : 1.25));
  }

  // ---- iterate --------------------------------------------------------------------------------
  // Each pass updates every attack given current defences, then every defence given current
  // attacks. The update is the weighted ratio of goals actually scored to goals the model expected,
  // shrunk toward 1 by priorGames of phantom evidence at the league average.
  let delta = Infinity;
  let iterationsRun = 0;
  for (let iter = 0; iter < cfg.iterations && delta > cfg.tolerance; iter++) {
    iterationsRun = iter + 1;
    // Convergence is measured across a whole pass, from the values as they stood at the start to
    // the values after this pass's re-normalisation. Comparing against the pre-normalisation
    // numbers instead would fold the normalising shift into the difference, so a fixed point would
    // still report a constant non-zero delta and the loop could never report convergence.
    const before = new Map();
    for (const [name, t] of teams) before.set(name, [t.attack, t.defence]);

    // attack
    const attackNum = new Map(), attackDen = new Map();
    for (const g of games) {
      const L = leagues.get(g.league);
      const h = teams.get(g.home), a = teams.get(g.away);
      // home attack faces away defence, with the venue factor
      attackNum.set(g.home, (attackNum.get(g.home) || 0) + g.w * g.hg);
      attackDen.set(g.home, (attackDen.get(g.home) || 0) + g.w * L.base * a.defence * L.homeAdv);
      // away attack faces home defence, no venue factor
      attackNum.set(g.away, (attackNum.get(g.away) || 0) + g.w * g.ag);
      attackDen.set(g.away, (attackDen.get(g.away) || 0) + g.w * L.base * h.defence);
    }
    for (const [name, t] of teams) {
      const num = (attackNum.get(name) || 0) + cfg.priorGames * 1.0;
      const den = (attackDen.get(name) || 0) + cfg.priorGames * 1.0;
      t.attack = clamp(num / Math.max(1e-9, den), cfg.minAttack, cfg.maxAttack);
    }

    // defence (higher = leakier, same orientation as the previous implementation)
    const defNum = new Map(), defDen = new Map();
    for (const g of games) {
      const L = leagues.get(g.league);
      const h = teams.get(g.home), a = teams.get(g.away);
      // home defence concedes to away attack
      defNum.set(g.home, (defNum.get(g.home) || 0) + g.w * g.ag);
      defDen.set(g.home, (defDen.get(g.home) || 0) + g.w * L.base * a.attack);
      // away defence concedes to home attack, with the venue factor
      defNum.set(g.away, (defNum.get(g.away) || 0) + g.w * g.hg);
      defDen.set(g.away, (defDen.get(g.away) || 0) + g.w * L.base * h.attack * L.homeAdv);
    }
    for (const [name, t] of teams) {
      const num = (defNum.get(name) || 0) + cfg.priorGames * 1.0;
      const den = (defDen.get(name) || 0) + cfg.priorGames * 1.0;
      t.defence = clamp(num / Math.max(1e-9, den), cfg.minDefence, cfg.maxDefence);
    }

    // Re-normalise to mean 1 so the pair stays identified (attack*k and defence/k are equivalent)
    // and the lambda/mu scale downstream is unchanged.
    normaliseToMeanOne(teams, 'attack');
    normaliseToMeanOne(teams, 'defence');

    delta = 0;
    for (const [name, t] of teams) {
      const [a0, d0] = before.get(name);
      delta = Math.max(delta, Math.abs(t.attack - a0), Math.abs(t.defence - d0));
    }
  }

  // ---- output ---------------------------------------------------------------------------------
  const outTeams = {};
  for (const [name, t] of teams) {
    outTeams[name] = {
      attack: round(t.attack),
      defense: round(t.defence),
      games: t.games,
      weightedGames: round(t.wGames),
      goalsFor: round(t.scored / Math.max(1e-9, t.wGames)),
      goalsAgainst: round(t.conceded / Math.max(1e-9, t.wGames))
    };
  }
  const outLeagues = {};
  for (const [name, L] of leagues) {
    outLeagues[name] = {
      baseGoals: round(L.base),
      homeAdvantage: round(L.homeAdv),
      weightedMatches: round(L.w)
    };
  }

  return {
    teams: outTeams,
    leagues: outLeagues,
    meta: {
      fitted: true,
      matches: games.length,
      teams: teams.size,
      halfLifeDays: cfg.halfLifeDays,
      priorGames: cfg.priorGames,
      iterations: iterationsRun,
      converged: delta <= cfg.tolerance,
      finalDelta: delta,
      latestMatchAt: latest ? new Date(latest).toISOString() : null
    }
  };
}

/**
 * Rescale fitted strengths so the mean of attack*defence over a reference set of fixtures matches
 * the mean the previous ratings produced. Keeps lambda/mu in the range the engine's conviction and
 * entropy thresholds were tuned against, so a strength change cannot silently move every threshold.
 */
export function matchScale(fitted, referenceMeanProduct) {
  const names = Object.keys(fitted.teams);
  if (!names.length || !referenceMeanProduct || referenceMeanProduct <= 0) return fitted;
  let sum = 0;
  for (const n of names) sum += fitted.teams[n].attack * fitted.teams[n].defense;
  const current = sum / names.length;
  if (current <= 0) return fitted;
  const k = Math.sqrt(referenceMeanProduct / current);
  for (const n of names) {
    fitted.teams[n].attack = round(fitted.teams[n].attack * k);
    fitted.teams[n].defense = round(fitted.teams[n].defense * k);
  }
  fitted.meta.scaleFactor = round(k);
  return fitted;
}

function normaliseToMeanOne(teams, key) {
  let sum = 0, n = 0;
  for (const t of teams.values()) { sum += t[key]; n++; }
  if (!n || sum <= 0) return;
  const mean = sum / n;
  for (const t of teams.values()) t[key] /= mean;
}

const clamp = (x, lo, hi) => (Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 1);
const round = (x) => parseFloat(Number(x).toFixed(4));

export { winnerOf, DEFAULTS as STRENGTH_FIT_DEFAULTS };
