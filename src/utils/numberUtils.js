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

export function formatKellyStake(stake, fallback = '1.5u') {
  if (!stake) return fallback;
  if (typeof stake === 'object') {
    return stake.badge || (stake.units ? `${safeToFixed(stake.units, 1)}u` : fallback);
  }
  if (typeof stake === 'number') {
    return `${stake.toFixed(1)}u`;
  }
  const parsed = safeParseFloat(stake, NaN);
  if (!isNaN(parsed)) {
    return `${parsed.toFixed(1)}u`;
  }
  return String(stake);
}

export function formatSmartMarket(sm, fallback = '') {
  if (!sm) return fallback;
  if (typeof sm === 'string') return sm;
  if (typeof sm === 'object') {
    return sm.pickLabel || sm.marketLabel || sm.pick || sm.badge || fallback;
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
