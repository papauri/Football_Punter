// Agents and lineups for fixtures outside the scraped leagues (Top picks' wider scan), read from
// ESPN's match summary: today's prices, the last five results, the league table, the head-to-head
// record and the app's own call. Each agent votes home, draw or away from its own source, or
// abstains when that source has nothing on the match (no table in a friendly, fewer than three
// recent games, and so on), the same way the main-league agents do.
import { fairProbs } from '../model/marketGoals.js';
import { strongCall } from '../model/matchCall.js';

const vote = (agentName, predictedWinner, summary) => ({ agentName, predictedWinner, conviction: predictedWinner ? 60 : 0, summary });
const side = (fx, pick) => (pick === 'HOME' ? fx.home : pick === 'AWAY' ? fx.away : 'a draw');

export function agentVotesFromSummary(summary, fx) {
  const votes = [];
  const comps = summary?.header?.competitions?.[0]?.competitors || [];
  const homeId = comps.find(c => c.homeAway === 'home')?.id;
  const awayId = comps.find(c => c.homeAway === 'away')?.id;

  // 1. Today's prices, margin removed.
  const o = fx.odds || {};
  if (o.homeOdds > 1 && o.drawOdds > 1 && o.awayOdds > 1) {
    const [h, d, a] = fairProbs([o.homeOdds, o.drawOdds, o.awayOdds]).map(x => x * 100);
    const pick = h >= a && h >= d ? 'HOME' : a > h && a >= d ? 'AWAY' : 'DRAW';
    votes.push(vote("Today's prices", pick, `Prices make ${side(fx, pick)} most likely (home ${Math.round(h)}%, draw ${Math.round(d)}%, away ${Math.round(a)}%).`));
  }

  // 2. Recent form: points per game over each side's last five.
  const pts = { W: 3, D: 1, L: 0 };
  const formOf = (teamName, id) => {
    const t = (summary?.lastFiveGames || []).find(x => String(x.team?.id) === String(id) || x.team?.displayName === teamName);
    const res = (t?.events || []).map(e => e.gameResult).filter(r => r in pts);
    return res.length >= 3 ? res.reduce((s, r) => s + pts[r], 0) / res.length : null;
  };
  const hf = formOf(fx.home, homeId), af = formOf(fx.away, awayId);
  if (hf != null && af != null) {
    const pick = hf - af >= 0.6 ? 'HOME' : af - hf >= 0.6 ? 'AWAY' : 'DRAW';
    votes.push(vote('Recent form', pick, `${fx.home} ${hf.toFixed(1)} points a game in their last five, ${fx.away} ${af.toFixed(1)}.`));
  } else votes.push(vote('Recent form', null, 'Not enough recent games for both sides.'));

  // 3. League table: points per game, when both sides are in the same table.
  const entries = (summary?.standings?.groups || []).flatMap(g => g.standings?.entries || []);
  const ppg = (id) => {
    const e = entries.find(x => String(x.id) === String(id));
    const stat = (n) => e?.stats?.find(s => s.name === n)?.value;
    const gp = stat('gamesPlayed'), p = stat('points');
    return gp >= 5 && Number.isFinite(p) ? p / gp : null;
  };
  const hp = ppg(homeId), ap = ppg(awayId);
  if (hp != null && ap != null) {
    const pick = hp - ap >= 0.3 ? 'HOME' : ap - hp >= 0.3 ? 'AWAY' : 'DRAW';
    votes.push(vote('League table', pick, `${fx.home} ${hp.toFixed(2)} points a game this season, ${fx.away} ${ap.toFixed(2)}.`));
  } else votes.push(vote('League table', null, 'No shared league table (cup tie, friendly or early season).'));

  // 4. Head to head: finished meetings in ESPN's series.
  const meetings = (summary?.seasonseries || []).flatMap(s => s.events || []).filter(e => e.status === 'post');
  if (meetings.length >= 2) {
    let hw = 0, aw = 0, dr = 0;
    for (const m of meetings) {
      const winner = (m.competitors || []).find(c => c.winner);
      if (!winner) dr++;
      else if (String(winner.team?.id) === String(homeId)) hw++;
      else if (String(winner.team?.id) === String(awayId)) aw++;
    }
    const pick = hw > aw && hw > dr ? 'HOME' : aw > hw && aw > dr ? 'AWAY' : 'DRAW';
    votes.push(vote('Head to head', pick, `Last ${meetings.length} meetings: ${fx.home} ${hw} wins, ${fx.away} ${aw}, ${dr} draws.`));
  } else votes.push(vote('Head to head', null, 'Fewer than two recent meetings.'));

  // 5. The app's call on the prices (straight wins only, as for the main leagues).
  if (o.homeOdds > 1 && o.drawOdds > 1 && o.awayOdds > 1) {
    const [h, d, a] = fairProbs([o.homeOdds, o.drawOdds, o.awayOdds]).map(x => x * 100);
    const call = strongCall(h, d, a);
    votes.push(call && (call.pick === 'HOME' || call.pick === 'AWAY')
      ? vote("The app's call", call.pick, `Calls ${side(fx, call.pick)} to win (${Math.round(call.prob)}%).`)
      : vote("The app's call", null, 'No straight-win call on this match.'));
  }
  return votes;
}

/** Confirmed lineups in the same shape the main lineup check uses, or null before they are out. */
export function lineupsFromSummary(summary) {
  const rosters = summary?.rosters || [];
  if (!rosters.some(r => (r.roster || []).some(p => p.starter))) return null;
  const fmt = (r) => ({
    team: r?.team?.displayName,
    formation: r?.formation || '4-3-3',
    status: 'CONFIRMED',
    isOfficial: true,
    starters: (r?.roster || []).filter(p => p.starter).map(p => ({
      id: p.athlete?.id, name: p.athlete?.displayName, shortName: p.athlete?.shortName, jersey: p.jersey || p.athlete?.jersey || '-',
      position: p.position?.name || 'Starter', posAbbr: p.position?.abbreviation || 'F'
    })),
    substitutes: (r?.roster || []).filter(p => !p.starter).map(p => ({
      id: p.athlete?.id, name: p.athlete?.displayName, jersey: p.jersey || p.athlete?.jersey || '-',
      posAbbr: p.position?.abbreviation || 'SUB'
    }))
  });
  const home = rosters.find(r => r.homeAway === 'home'), away = rosters.find(r => r.homeAway === 'away');
  return home && away ? { home: fmt(home), away: fmt(away), leaders: summary.leaders || [] } : null;
}
