// The app's call on a match: one bet on every match, never "no bet", and never "12" (either team
// to win), which says nothing about who wins.
//
//  1. A straight win when the favourite is 65%+ (strong).
//  2. Otherwise the favourite's double chance (1X or X2): strong at 80%+, a call at 72.5%+.
//  3. Otherwise the match's likeliest full-time goals bet (team to score, under 3.5, over 1.5
//     mostly): a call at 75%+, a lean below. A straight win on those matches came in only 44.4%.
// On 10,358 matches from 2024-25 (opening prices): straight wins 15% of matches, 77.3% came in;
// 1X/X2 46%, 80.0%; goals bets 39%, 78.6%; every match 79.1%. The earlier rule with "12" allowed
// called 12 on over half the matches and came in 79.4% overall.
// Under 4.5 goals and first-half markets are left out: the first is nearly always the likeliest
// and pays almost nothing, and the second cannot be graded from a full-time score.
import { impliedGoals, scoreGrid } from './marketGoals.js';

export const TIP_STRAIGHT_MIN = 65;
export const TIP_DOUBLE_CHANCE_MIN = 80;
export const CALL_MIN = 75;
export const SIDE_DC_MIN = 72.5;

/** The strong result call, or null when neither threshold is met. Chances in percent. */
export function strongCall(home, draw, away) {
  const fav = home >= away ? ['HOME', home] : ['AWAY', away];
  if (fav[1] >= TIP_STRAIGHT_MIN) return { pick: fav[0], prob: fav[1] };
  const dc = home >= away ? ['1X', home + draw] : ['X2', away + draw];
  if (dc[1] >= TIP_DOUBLE_CHANCE_MIN) return { pick: dc[0], prob: Math.min(99, dc[1]) };
  return null;
}

const sum = (g, f) => { let t = 0; for (let i = 0; i < g.length; i++) for (let j = 0; j < g[i].length; j++) if (f(i, j)) t += g[i][j]; return t; };

// pick -> [label, chance from (grid, [h, d, a] in 0..1)]
const FALLBACK = {
  OVER_15: ['Over 1.5 goals', g => sum(g, (i, j) => i + j > 1)],
  OVER_25: ['Over 2.5 goals', g => sum(g, (i, j) => i + j > 2)],
  UNDER_25: ['Under 2.5 goals', g => sum(g, (i, j) => i + j < 3)],
  UNDER_35: ['Under 3.5 goals', g => sum(g, (i, j) => i + j < 4)],
  BTTS_YES: ['Both teams to score', g => sum(g, (i, j) => i > 0 && j > 0)],
  BTTS_NO: ['Both teams to score: No', g => 1 - sum(g, (i, j) => i > 0 && j > 0)],
  HOME_SCORES: ['{home} to score', g => sum(g, i => i > 0)],
  AWAY_SCORES: ['{away} to score', g => sum(g, (i, j) => j > 0)]
};

const fill = (s, home, away) => s.replace('{home}', home).replace('{away}', away);

/**
 * The call for a match. `prob` is {home, draw, away} in percent; `goals` the expected goals
 * ({lambda, mu, rho}) when known, otherwise they are read from the result chances the way the
 * app reads them from prices. Returns {pick, label, prob, tier: 'STRONG'|'CALL'|'LEAN', kind}.
 */
export function decisiveCall(prob, goals = null, homeName = 'Home', awayName = 'Away') {
  const h = Number(prob?.home), d = Number(prob?.draw), a = Number(prob?.away);
  if (![h, d, a].every(Number.isFinite) || h + d + a <= 0) return null;
  const strong = strongCall(h, d, a);
  if (strong) {
    const label = strong.pick === 'HOME' ? `${homeName} to win` : strong.pick === 'AWAY' ? `${awayName} to win`
      : strong.pick === '1X' ? `${homeName} or draw` : `${awayName} or draw`;
    return { pick: strong.pick, label, prob: +strong.prob.toFixed(1), tier: 'STRONG', kind: 'RESULT' };
  }
  const s = h + d + a, x = [h / s, d / s, a / s];
  let lambda = Number(goals?.lambda), mu = Number(goals?.mu);
  if (!(lambda > 0 && mu > 0)) {
    const g = impliedGoals({ h: x[0], d: x[1], a: x[2] });
    if (!g) return null;
    ({ lambda, mu } = g);
  }
  // The favourite's double chance before any goals bet.
  const side = x[0] >= x[2] ? ['1X', x[0] + x[1], `${homeName} or draw`] : ['X2', x[2] + x[1], `${awayName} or draw`];
  if (side[1] * 100 >= SIDE_DC_MIN) {
    return { pick: side[0], label: side[2], prob: +(side[1] * 100).toFixed(1), tier: 'CALL', kind: 'RESULT' };
  }
  const grid = scoreGrid(lambda, mu, goals?.rho ?? -0.05);
  let best = null;
  for (const [pick, [label, pf]] of Object.entries(FALLBACK)) {
    const p = pf(grid, x) * 100;
    if (!best || p > best.prob) best = { pick, label: fill(label, homeName, awayName), prob: p };
  }
  return { ...best, prob: +best.prob.toFixed(1), tier: best.prob >= CALL_MIN ? 'CALL' : 'LEAN', kind: 'GOALS' };
}

/** Whether a call came in, from the full-time score (null for picks it cannot grade). */
export function gradeCall(pick, hg, ag) {
  if (hg == null || ag == null || Number.isNaN(hg) || Number.isNaN(ag)) return null;
  const t = hg + ag;
  switch (pick) {
    case 'HOME': return hg > ag;
    case 'AWAY': return ag > hg;
    case 'DRAW': return hg === ag;
    case '1X': return hg >= ag;
    case 'X2': return ag >= hg;
    case '12': return hg !== ag;
    case 'OVER_15': return t > 1;
    case 'OVER_25': return t > 2;
    case 'UNDER_25': return t < 3;
    case 'UNDER_35': return t < 4;
    case 'BTTS_YES': return hg > 0 && ag > 0;
    case 'BTTS_NO': return !(hg > 0 && ag > 0);
    case 'HOME_SCORES': return hg > 0;
    case 'AWAY_SCORES': return ag > 0;
    default: return null;
  }
}

/**
 * A finished match that was recorded as "no bet" under the old rule, graded on the call this rule
 * makes from the chances recorded before kick-off (nothing from the result feeds the call). Matches
 * in a switched-off league stay as they were.
 */
export function settleWithCall(m) {
  const sm = m?.smartMarket;
  if (!sm || String(sm.pick || '').toUpperCase() !== 'PASS' || sm.marketType === 'PASS_NO_EDGE') return m;
  let hg = Number(m.homeScore ?? m.goals?.home), ag = Number(m.awayScore ?? m.goals?.away);
  if ((!Number.isFinite(hg) || !Number.isFinite(ag)) && typeof m.actualScore === 'string' && m.actualScore.includes('-')) {
    [hg, ag] = m.actualScore.split('-').map(x => parseInt(x, 10));
  }
  const call = decisiveCall(m.prob, null, m.home, m.away);
  if (!call) return m;
  const hit = Number.isFinite(hg) && Number.isFinite(ag) ? gradeCall(call.pick, hg, ag) : null;
  return {
    ...m,
    smartMarket: {
      ...sm, pick: call.pick, pickLabel: call.label, badge: call.label, prob: call.prob, tier: call.tier,
      marketType: call.kind === 'RESULT' ? 'DOUBLE_CHANCE' : 'GOALS_CALL',
      rationale: `${call.label}: ${call.prob}% from the chances recorded before kick-off.`,
      fromPreMatchChances: true
    },
    isPass: false,
    isPush: false,
    ...(hit === null ? {} : { isHit: hit, smartHit: hit })
  };
}
