// Today's top picks: every market the app can price, on every match, keeping only the bets that
// are both very likely and backed by a measured record.
//
// Result, goals and team-goals markets are read from the scoreline grid of the market's expected
// goals (today's prices, or market memory when a match has none). data/top-picks-record.json holds
// how often each market came in, by chance band, on 10,355 matches from 2024-25 onwards that no
// fitting saw (opening prices from the football-data.co.uk files). A market enters only in a band with at least 150
// past picks. Corners and cards come from the match-statistics model, whose strongest pick at 80%+
// came in 84.9% of the time on held-out seasons.
//
// What the record does not say: at a single bookmaker these bets lost money. At 80%+ they won
// 87.4% of the time and returned -3.9% at Bet365, because the price of a likely bet is short and
// carries the margin. The "bet at" price is where a bet stops losing on the record; below it, skip.
import { scoreGrid, fairProbs } from './marketGoals.js';

export const TOP_PICK_MIN = 80;

const sum = (g, f) => { let t = 0; for (let i = 0; i < g.length; i++) for (let j = 0; j < g[i].length; j++) if (f(i, j)) t += g[i][j]; return t; };

// key -> [label, kind, probability from (grid, 1X2 chances, first-half grid)]
const GOAL_MARKETS = {
  HOME_WIN: ['{home} to win', 'Result', (g, x) => x[0]],
  AWAY_WIN: ['{away} to win', 'Result', (g, x) => x[2]],
  HOME_OR_DRAW: ['{home} or draw (1X)', 'Double chance', (g, x) => x[0] + x[1]],
  AWAY_OR_DRAW: ['{away} or draw (X2)', 'Double chance', (g, x) => x[2] + x[1]],
  OVER_1_5: ['Over 1.5 goals', 'Goals', g => sum(g, (i, j) => i + j > 1)],
  OVER_2_5: ['Over 2.5 goals', 'Goals', g => sum(g, (i, j) => i + j > 2)],
  UNDER_2_5: ['Under 2.5 goals', 'Goals', g => sum(g, (i, j) => i + j < 3)],
  UNDER_3_5: ['Under 3.5 goals', 'Goals', g => sum(g, (i, j) => i + j < 4)],
  UNDER_4_5: ['Under 4.5 goals', 'Goals', g => sum(g, (i, j) => i + j < 5)],
  BTTS_YES: ['Both teams to score', 'Goals', g => sum(g, (i, j) => i > 0 && j > 0)],
  BTTS_NO: ['Both teams to score: No', 'Goals', g => 1 - sum(g, (i, j) => i > 0 && j > 0)],
  HOME_SCORES: ['{home} to score', 'Team goals', g => sum(g, i => i > 0)],
  AWAY_SCORES: ['{away} to score', 'Team goals', g => sum(g, (i, j) => j > 0)],
  HOME_OVER_1_5: ['{home} over 1.5 goals', 'Team goals', g => sum(g, i => i > 1)],
  AWAY_OVER_1_5: ['{away} over 1.5 goals', 'Team goals', g => sum(g, (i, j) => j > 1)],
  HOME_UNDER_1_5: ['{home} under 1.5 goals', 'Team goals', g => sum(g, i => i < 2)],
  AWAY_UNDER_1_5: ['{away} under 1.5 goals', 'Team goals', g => sum(g, (i, j) => j < 2)],
  FH_OVER_0_5: ['A goal in the first half', 'First half', (g, x, fh) => sum(fh, (i, j) => i + j > 0)],
  FH_UNDER_1_5: ['Under 1.5 first-half goals', 'First half', (g, x, fh) => sum(fh, (i, j) => i + j < 2)]
};

// Held-out record of the strongest corners or cards pick at 80%+ (data/match-stats.json heldOut).
const STATS_RECORD_DEFAULT = { picks: 9594, cameIn: 84.9 };

/** The record for a market at a chance, or null when that market has no proven record there. */
export function recordFor(record, source, key, pct) {
  const bands = record?.[source]?.[key];
  if (!bands) return null;
  const band = Object.keys(bands).map(Number).filter(b => pct >= b).sort((a, b) => b - a)[0];
  return band != null ? { band, ...bands[band] } : null;
}

const fill = (label, home, away) => label.replace('{home}', home).replace('{away}', away);

/**
 * Candidate picks for one match.
 * @param match      the app's match ({id, home, away, league, odds, ...})
 * @param goals      market expected goals ({lambda, mu, rho, source}) or null
 * @param stats      corners and cards prediction (predictMatchStats) or null
 * @param record     data/top-picks-record.json
 */
export function matchCandidates(match, goals, stats, record, statsRecord = STATS_RECORD_DEFAULT) {
  const out = [];
  if (goals && (goals.source === 'PRICES' || goals.source === 'MARKET_MEMORY')) {
    const g = scoreGrid(goals.lambda, goals.mu, goals.rho ?? -0.05);
    const fh = scoreGrid(goals.lambda * 0.46, goals.mu * 0.46, 0);
    const o = match.odds || {};
    const priced = goals.source === 'PRICES' && [o.homeOdds, o.drawOdds, o.awayOdds].every(v => Number(v) > 1) && !o.drawEstimated;
    const x = priced ? fairProbs([Number(o.homeOdds), Number(o.drawOdds), Number(o.awayOdds)])
      : [sum(g, (i, j) => i > j), sum(g, (i, j) => i === j), sum(g, (i, j) => i < j)];
    for (const [key, [label, kind, pf]] of Object.entries(GOAL_MARKETS)) {
      const pct = pf(g, x, fh) * 100;
      const rec = recordFor(record, goals.source, key, pct);
      if (!rec) continue;
      out.push({ key, kind, label: fill(label, match.home, match.away), chance: pct, record: rec, source: goals.source });
    }
  }
  for (const p of stats?.picks || []) {
    const pct = p.prob * 100;
    if (pct < TOP_PICK_MIN) continue;
    const noun = p.market === 'CORNERS' ? 'corners' : 'cards';
    const label = p.def ? fill(p.label, match.home, match.away) : `${p.side === 'OVER' ? 'Over' : 'Under'} ${p.line} total ${noun}`;
    out.push({ key: p.def ? p.key : `${p.market}_${p.side}_${p.line}`, kind: p.market === 'CORNERS' ? 'Corners' : 'Cards', label, chance: pct,
      record: { band: 80, picks: statsRecord.picks, cameIn: statsRecord.cameIn, said: null }, source: 'STATS' });
  }
  return out;
}

// Current price for a pick when the app holds one: straight wins only. A double-chance price
// built from two match-result prices carries both margins (it can fall below 1.00), so it is not
// shown as if a bookmaker offered it.
function priceFor(key, odds) {
  const h = Number(odds?.homeOdds), a = Number(odds?.awayOdds);
  if (key === 'HOME_WIN' && h > 1) return h;
  if (key === 'AWAY_WIN' && a > 1) return a;
  return null;
}

// Which side a pick leans on: its attack, its defence (goalkeeper included), or both.
const RELIES = {
  HOME_WIN: [['home', 'attack'], ['home', 'defence']], AWAY_WIN: [['away', 'attack'], ['away', 'defence']],
  HOME_OR_DRAW: [['home', 'defence']], AWAY_OR_DRAW: [['away', 'defence']],
  HOME_SCORES: [['home', 'attack']], AWAY_SCORES: [['away', 'attack']], HOME_OVER_1_5: [['home', 'attack']], AWAY_OVER_1_5: [['away', 'attack']],
  HOME_UNDER_1_5: [['away', 'defence']], AWAY_UNDER_1_5: [['home', 'defence']],
  OVER_1_5: [['home', 'attack'], ['away', 'attack']], OVER_2_5: [['home', 'attack'], ['away', 'attack']], BTTS_YES: [['home', 'attack'], ['away', 'attack']], FH_OVER_0_5: [['home', 'attack'], ['away', 'attack']],
  UNDER_2_5: [['home', 'defence'], ['away', 'defence']], UNDER_3_5: [['home', 'defence'], ['away', 'defence']], UNDER_4_5: [['home', 'defence'], ['away', 'defence']], BTTS_NO: [['home', 'defence'], ['away', 'defence']], FH_UNDER_1_5: [['home', 'defence'], ['away', 'defence']]
};
// Outcomes each result pick wins on, for counting the agents that back it.
const WINS_ON = { HOME_WIN: ['HOME'], AWAY_WIN: ['AWAY'], HOME_OR_DRAW: ['HOME', 'DRAW'], AWAY_OR_DRAW: ['AWAY', 'DRAW'] };

/**
 * What was checked for a pick, in plain words: where the chance comes from, what the agents said
 * (they vote on the result only), and the team news. Team news never changes the chance (missing
 * regular players added nothing to the price when tested); it is shown as a warning.
 */
export function pickChecks(c, match, ctx = {}) {
  const checks = [];
  if (c.source === 'PRICES') checks.push({ tone: 'ok', text: `Priced from today's odds${match.odds?.provider ? ` (${match.odds.provider})` : ''}, which move with team news` });
  else if (c.source === 'MARKET_MEMORY') checks.push({ tone: 'info', text: 'No odds for this match yet: from both teams\' past prices' });
  else if (c.source === 'STATS') checks.push({ tone: 'ok', text: 'From both teams\' corners and cards for and against, this season and last' });

  const votes = (ctx.agentVotes || []).filter(v => v.predictedWinner);
  if (WINS_ON[c.key] && votes.length) {
    const backing = votes.filter(v => WINS_ON[c.key].includes(v.predictedWinner)).length;
    checks.push({ tone: backing === votes.length ? 'ok' : backing >= votes.length / 2 ? 'info' : 'warn', text: `${backing} of ${votes.length} agents back this result` });
  }

  const li = ctx.lineupImpact;
  const confirmed = li && String(li.status).toUpperCase() === 'CONFIRMED';
  if (!confirmed) {
    checks.push({ tone: 'info', text: 'Lineups not out yet: checked from 90 minutes before kick-off' });
  } else {
    const worries = [];
    for (const [sideKey, part] of RELIES[c.key] || []) {
      const team = sideKey === 'home' ? match.home : match.away;
      if (part === 'defence' && li[`${sideKey}BackupGK`]) worries.push(`${team} start their back-up goalkeeper`);
      if (part === 'attack' && li[`${sideKey}MissingStar`]) worries.push(`${team}'s top scorer is not starting`);
      if (li[`${sideKey}EloAdjust`] < 0 && (c.key === `${sideKey.toUpperCase()}_WIN` || c.key === `${sideKey.toUpperCase()}_OR_DRAW`)) worries.push(`${team} have rotated their team`);
    }
    checks.push(worries.length
      ? { tone: 'warn', text: `Lineups confirmed: ${[...new Set(worries)].join('; ')}` }
      : { tone: 'ok', text: 'Lineups confirmed: nothing against this bet' });
  }
  return checks;
}

function toPick(match, c, ctx) {
  // Break-even: the lower of the stated chance and the past record, so the price asked for never
  // leans on the record being better than the figure.
  const safe = Math.min(c.chance, c.record.cameIn);
  const price = priceFor(c.key, match.odds);
  return {
    id: `${match.id}-${c.key}`,
    key: c.key,
    kind: c.kind,
    label: c.label,
    chance: Number(c.chance.toFixed(1)),
    pastHitRate: c.record.cameIn,
    pastPicks: c.record.picks,
    betAt: Number((100 / safe).toFixed(2)),
    priceNow: price ? Number(price.toFixed(2)) : null,
    source: c.source,
    checks: pickChecks(c, match, ctx)
  };
}

/**
 * The day's top picks across all matches, in kick-off order. One row per match (picks from one
 * match win or lose together): its most likely bet at `min` or more, with the match's other bets
 * at that level under `others`. `kinds` limits the bet types considered (all when empty).
 * Each entry may carry `context` ({agentVotes, lineupImpact}) for the checks shown with a pick.
 */
export function rankTopPicks(entries, { min = TOP_PICK_MIN, kinds = [] } = {}) {
  const rows = [];
  for (const { match, candidates, context } of entries) {
    const strong = candidates
      .filter(c => c.chance >= min && (!kinds.length || kinds.includes(c.kind)))
      .sort((a, b) => b.chance - a.chance);
    if (!strong.length) continue;
    const [top, ...rest] = strong.map(c => toPick(match, c, context));
    rows.push({
      ...top,
      matchId: match.id,
      home: match.home,
      away: match.away,
      league: match.league,
      timestamp: match.timestamp,
      dateIso: match.dateIso || match.utcDate || match.date,
      time: match.time,
      others: rest
    });
  }
  return rows.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0) || b.chance - a.chance);
}
