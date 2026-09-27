// One answer to "what state is this match in?", used by every page.
//
// Pages used to decide this separately, and disagreed. The daily briefing called any match past its
// kickoff time "LIVE / STARTED" from the clock alone, while its In-Play tab only listed matches the
// feed had confirmed as live, so a match whose feed had not updated yet showed as started but never
// appeared in In-Play. Everything now goes through getMatchPhase.

const LIVE_STATUSES = new Set([
  'LIVE', 'IN_PLAY', 'HT', '1H', '2H', 'ET', 'P',
  'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF',
  'STATUS_EXTRA_TIME', 'STATUS_OVERTIME', 'STATUS_SHOOTOUT'
]);

// A match normally ends within 130 minutes of kickoff (added time and half-time included).
export const MATCH_WINDOW_MS = 130 * 60 * 1000;

function kickoffMs(m) {
  if (m?.timestamp) return Number(m.timestamp);
  const t = m?.utcDate || m?.dateIso;
  const ms = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function isFinalStatus(status) {
  const s = String(status || '').trim();
  const l = s.toLowerCase();
  return s === 'FT' || s.includes('FT') || s.startsWith('STATUS_FINAL') || s === 'STATUS_FULL_TIME' ||
    l === 'final' || l.includes('full time') || l === 'finished' || l === 'ended' ||
    l === 'aet' || l === 'pen' || l === 'pens';
}

/**
 * @returns {'upcoming'|'starting'|'live'|'finished'|'postponed'|'result-pending'}
 *   upcoming        before kickoff
 *   starting        kickoff time has passed but the live feed has not confirmed play yet
 *   live            confirmed in play
 *   finished        full time
 *   postponed       postponed or cancelled
 *   result-pending  well past the match window with no final score yet
 */
export function getMatchPhase(m, now = Date.now()) {
  if (!m) return 'upcoming';
  const status = String(m.status || '').trim();
  const lower = status.toLowerCase();
  if (m.isCompleted || isFinalStatus(status)) return 'finished';
  if (lower.includes('postpon') || lower.includes('cancel') || lower.includes('abandon')) return 'postponed';

  const minute = m.liveMinute;
  const confirmedLive = m.isLive === true ||
    LIVE_STATUSES.has(status.toUpperCase()) ||
    /^\d+['’]/.test(status) ||
    (typeof minute === 'string' && (minute.includes("'") || minute.toLowerCase() === 'ht')) ||
    (typeof minute === 'number' && minute > 0);
  if (confirmedLive) return 'live';

  const ko = kickoffMs(m);
  if (ko == null || ko > now) return 'upcoming';
  return now - ko <= MATCH_WINDOW_MS ? 'starting' : 'result-pending';
}

/** In play, or past kickoff and waiting for the feed: both belong in an "In play" list. */
export function isInPlayPhase(phase) {
  return phase === 'live' || phase === 'starting';
}

/** Short plain-English label for a badge. */
export function phaseLabel(m, phase = getMatchPhase(m)) {
  switch (phase) {
    case 'live': {
      const min = m?.inPlayPrediction?.minuteDisplay || m?.liveMinute;
      if (!min) return 'LIVE';
      const s = String(min);
      return s === 'HT' || s.toLowerCase() === 'ht' ? 'LIVE · HT' : `LIVE ${s.includes("'") ? s : `${s}'`}`;
    }
    case 'starting': return 'Kicked off';
    case 'finished': return 'FT';
    case 'postponed': return 'Postponed';
    case 'result-pending': return 'Result due';
    default: return '';
  }
}

/** Live score as "1 - 0", or null when not in play. */
export function liveScoreText(m, phase = getMatchPhase(m)) {
  if (phase !== 'live') return null;
  const h = m.liveHomeScore ?? m.goals?.home ?? m.homeScore;
  const a = m.liveAwayScore ?? m.goals?.away ?? m.awayScore;
  return h != null && a != null ? `${h} - ${a}` : null;
}
