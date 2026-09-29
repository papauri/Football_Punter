// Bulletproof Number & Probability Formatters for Engine Stats

export function safeParseFloat(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? fallback : parsed;
}

export function safeToFixed(val, decimals = 0, fallback = '0') {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : safeParseFloat(val, NaN);
  if (isNaN(num)) return fallback;
  return num.toFixed(decimals);
}

// Suggested stake as a share of the bankroll. Units above 1 are percentages (5.9 = 5.9%), a
// fraction at or below 1 is a share (0.05 = 5%), matching how stakes are turned into euros.
export function formatKellyStake(stake, fallback = '—') {
  if (!stake) return fallback;
  const units = typeof stake === 'object' ? safeParseFloat(stake.units ?? stake.fraction, NaN) : safeParseFloat(stake, NaN);
  if (!Number.isFinite(units) || units <= 0) return fallback;
  const pct = units <= 1 ? units * 100 : units;
  return `${pct.toFixed(1)}% of bank`;
}

// Plain-English tip label for any smart-market value the engine produces, e.g.
//   "1X (Aberdeen or Draw)" -> "Aberdeen or draw", "Atalanta Win" -> "Atalanta to win",
//   "Real Betis DNB (Draw-No-Bet)" -> "Real Betis (draw = refund)", "Pass / Entropy Floor" -> "No bet · too close to call".
const PASS_REASONS = [
  [/entropy|parity|close/i, 'too close to call'],
  [/blacklist|disabled|league/i, 'league switched off'],
  [/divergence|trap|disagree/i, 'model and odds disagree']
];
export function plainTipText(label) {
  const t = String(label || '').trim();
  if (!t) return '';
  if (/^no strong call/i.test(t)) return 'No strong call';
  if (/^pass\b/i.test(t)) {
    const hit = PASS_REASONS.find(([re]) => re.test(t));
    return hit ? `No bet · ${hit[1]}` : 'No bet';
  }
  let m = t.match(/^(?:1X|X2)\s*\((.+?)(?:\s+or\s+|\s*\/\s*)draw\)$/i);
  if (m) return `${m[1]} or draw`;
  m = t.match(/^(.+?)\s+DNB\b/i);
  if (m) return `${m[1]} (draw = refund)`;
  m = t.match(/^(.+?)\s+Win(?:\s*\((?:1|2|Outright)\))?$/i);
  if (m) return `${m[1]} to win`;
  return t.replace(/\bMoneyline\b/g, 'to win');
}

export function formatSmartMarket(sm, fallback = '') {
  if (!sm) return fallback;
  if (typeof sm === 'string') return plainTipText(sm) || fallback;
  if (typeof sm === 'object') {
    return plainTipText(sm.pickLabel || sm.badge || sm.marketLabel || sm.pick) || fallback;
  }
  return String(sm);
}

export function formatScore(score, fallback = '—') {
  if (!score) return fallback;
  if (typeof score === 'string') return score;
  if (typeof score === 'object') {
    if (score.score) return String(score.score);
    if (score.home !== undefined && score.away !== undefined) {
      if (score.home === null || score.away === null) return fallback;
      return `${score.home}-${score.away}`;
    }
  }
  return String(score);
}
