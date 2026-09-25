// Universal Risk & Conviction Taxonomy (BUILD_PLAN.md §2.2).
// Single source of truth for risk classification — the fixtures table filters, bet slip badges,
// accumulator auto-builders and binary picks all consume getMatchRiskProfile so a pick that is
// "Low Risk" when filtered can never re-appear as "High Risk" once added to a slip.
import { safeParseFloat, safeToFixed } from './numberUtils.js';
import { getLeaguePredictabilityTier, isLeagueBlacklisted, isCupCompetition } from './leagueUtils.js';

export const PARITY_LEAGUES = [
  'Championship', 'League One', 'League Two', 'MLS', 'Major League Soccer',
  'Liga Profesional', 'Liga MX', 'Serie B', 'LaLiga 2', 'Ligue 2',
  'Swedish Allsvenskan', 'Norwegian Eliteserien', 'Danish Superliga',
  'Austrian Bundesliga', 'Saudi Pro League', 'Turkish Super Lig'
];

export const RISK_THRESHOLDS = {
  ELITE_PROB: 68.0,
  ELITE_CONF: 72.0,
  ELITE_MAX_DRAW: 22.0,
  HIGH_PROB: 60.0,
  HIGH_CONF: 60.0,
  HIGH_MAX_DRAW: 24.0,
  DNB_DRAW: 24.0,
  PROTECTED_PROB: 48.0,
  CONTESTED_PROB: 40.0,
  TRAP_CONF: 45.0,
  HIGH_DRAW_RISK: 26.0
};

// Tier key → presentation. `type` maps onto the slip badge palette (AccumulatorPage).
export const RISK_TIERS = {
  ELITE:     { riskLevel: 'LOW',    badge: '👑 Elite (Low Risk)',    color: 'emerald', type: 'protected',  label: 'Elite Conviction' },
  HIGH:      { riskLevel: 'LOW',    badge: '🛡️ High Confidence',     color: 'teal',    type: 'protected',  label: 'High Edge' },
  PROTECTED: { riskLevel: 'LOW',    badge: '🛡️ Draw Protected',      color: 'emerald', type: 'protected',  label: 'Protected Market' },
  DNB:       { riskLevel: 'MEDIUM', badge: '🛡️ DNB Advised',         color: 'indigo',  type: 'positive-ev', label: 'Safety Protected' },
  CONTESTED: { riskLevel: 'MEDIUM', badge: '⚖️ Contested',           color: 'amber',   type: 'warning',    label: 'Contested Parity' },
  TRAP:      { riskLevel: 'HIGH',   badge: '⚠️ Volatile / Trap',     color: 'rose',    type: 'danger',     label: 'High Risk' },
  EXCLUDED:  { riskLevel: 'HIGH',   badge: '⛔ Blacklisted League',  color: 'rose',    type: 'danger',     label: 'Excluded' }
};

export const RISK_BADGE_CLASSES = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  amber: 'bg-amber-100 text-amber-900 border-amber-300',
  rose: 'bg-rose-100 text-rose-800 border-rose-300'
};

export function normalizePick(pick) {
  const p = String(pick || '').toUpperCase().trim();
  if (p === '1') return 'HOME';
  if (p === '2') return 'AWAY';
  if (p === 'X') return 'DRAW';
  return p;
}

export function getDefaultPick(m) {
  if (!m) return 'HOME';
  const explicit = typeof m.predictedWinner === 'string' ? m.predictedWinner : (m.predictedWinner?.pick || m.binaryModel?.pick);
  if (explicit) return normalizePick(explicit);
  const home = safeParseFloat(m.prob?.home, 0);
  const draw = safeParseFloat(m.prob?.draw, 0);
  const away = safeParseFloat(m.prob?.away, 0);
  if (draw > home && draw > away) return 'DRAW';
  return home >= away ? 'HOME' : 'AWAY';
}

export function isTrapMatch(m) {
  if (!m) return false;
  const sw = m.aiSwarm || m.imperialSwarm || {};
  return Boolean(sw.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged);
}

export function isParityLeague(league) {
  if (!league) return false;
  const l = String(league).toLowerCase();
  return PARITY_LEAGUES.some(pl => l.includes(pl.toLowerCase()));
}

/**
 * Deterministic risk profile for a match (optionally for a specific pick on that match).
 * Depends only on model fields carried on the match object, never on bookmaker odds, so the
 * same match + pick produces the same verdict in every view.
 */
export function getMatchRiskProfile(match, pickOverride = null) {
  const m = match || {};
  const pick = normalizePick(pickOverride || getDefaultPick(m));
  const home = safeParseFloat(m.prob?.home, 0);
  const draw = safeParseFloat(m.prob?.draw, 0);
  const away = safeParseFloat(m.prob?.away, 0);
  const topProb = Math.max(home, draw, away);
  const confidence = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, topProb);

  const isStraight = pick === 'HOME' || pick === 'AWAY';
  const isProtectedMarket = pick === '1X' || pick === 'X2' || pick === '12' || pick.includes('DNB');
  const pickProb = pick === 'HOME' ? home
    : pick === 'AWAY' ? away
    : pick === 'DRAW' ? draw
    : pick === '1X' ? home + draw
    : pick === 'X2' ? away + draw
    : pick === '12' ? home + away
    : Math.max(home, away);

  const tierObj = m.leagueTier?.tier ? m.leagueTier : getLeaguePredictabilityTier(m.league);
  const leagueTier = tierObj?.tier || 2;
  const isBlacklisted = isLeagueBlacklisted(m.league);
  const isCup = isCupCompetition(m.league);
  const isParity = isParityLeague(m.league);
  const isTrap = isTrapMatch(m);
  const dnbAdvised = Boolean(m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || draw >= RISK_THRESHOLDS.DNB_DRAW);
  const T = RISK_THRESHOLDS;

  let tierKey;
  let reason;
  if (isBlacklisted || leagueTier === 3) {
    tierKey = 'EXCLUDED';
    reason = 'Competition blacklisted (Tier 3) due to extreme parity, random noise or missing telemetry.';
  } else if (isTrap) {
    tierKey = 'TRAP';
    reason = 'Contrarian trap, market divergence or disruption PASS flag detected.';
  } else if (confidence < T.TRAP_CONF || pick === 'DRAW') {
    tierKey = 'TRAP';
    reason = pick === 'DRAW'
      ? 'Straight draw selections carry the highest variance in the 1X2 market.'
      : `Model confidence ${safeToFixed(confidence, 1)}% is below the ${T.TRAP_CONF}% safety floor.`;
  } else if (isProtectedMarket) {
    tierKey = pickProb >= 70 ? 'PROTECTED' : 'DNB';
    reason = `Draw-protected market covering ${safeToFixed(Math.min(99, pickProb), 1)}% of outcomes.`;
  } else if (pickProb >= T.ELITE_PROB && confidence >= T.ELITE_CONF && draw < T.ELITE_MAX_DRAW) {
    tierKey = 'ELITE';
    reason = `Win probability ${safeToFixed(pickProb, 1)}%, confidence ${safeToFixed(confidence, 1)}%, draw risk ${safeToFixed(draw, 1)}%.`;
  } else if (pickProb >= T.HIGH_PROB && confidence >= T.HIGH_CONF && draw < T.HIGH_MAX_DRAW) {
    tierKey = 'HIGH';
    reason = `Win probability ${safeToFixed(pickProb, 1)}% with draw risk contained under ${T.HIGH_MAX_DRAW}%.`;
  } else if (pickProb >= T.PROTECTED_PROB) {
    tierKey = 'DNB';
    reason = `Draw probability ${safeToFixed(draw, 1)}% — Draw-No-Bet or Double Chance advised.`;
  } else if (pickProb >= T.CONTESTED_PROB) {
    tierKey = 'CONTESTED';
    reason = `Win probability only ${safeToFixed(pickProb, 1)}% — contested fixture, prefer Double Chance.`;
  } else {
    tierKey = 'TRAP';
    reason = `Win probability ${safeToFixed(pickProb, 1)}% is below the ${T.CONTESTED_PROB}% contested floor.`;
  }

  // Tier 3-style volatility (cups / parity leagues) mandates draw protection on straight wins.
  if (isStraight && (tierKey === 'ELITE' || tierKey === 'HIGH') && (isCup || (isParity && pickProb < 66))) {
    tierKey = 'DNB';
    reason = isCup
      ? 'Knockout cup tie — rotation and extra-time variance make DNB protection mandatory.'
      : 'High-parity league — straight wins require ≥66% to avoid DNB enforcement.';
  }

  const tier = RISK_TIERS[tierKey];
  const riskScore = Math.round(
    tierKey === 'EXCLUDED' ? 100
      : tierKey === 'TRAP' ? Math.max(75, 100 - confidence / 2)
      : Math.max(0, Math.min(74, (100 - pickProb) * 0.7 + draw * 0.6 - (confidence - 50) * 0.3))
  );

  return {
    tierKey,
    riskLevel: tier.riskLevel,
    riskScore,
    isTrap: tierKey === 'TRAP' || tierKey === 'EXCLUDED',
    isFlaggedTrap: isTrap,
    isElite: tierKey === 'ELITE',
    isHighConfidence: tierKey === 'ELITE' || tierKey === 'HIGH',
    isDrawVulnerable: isStraight && (draw >= T.HIGH_DRAW_RISK || tierKey === 'DNB' || tierKey === 'CONTESTED'),
    dnbAdvised,
    badge: tier.badge,
    badgeType: tier.type,
    badgeClass: RISK_BADGE_CLASSES[tier.color],
    color: tier.color,
    label: tier.label,
    reason,
    pick,
    pickProb,
    confidence,
    drawProb: draw,
    leagueTier
  };
}

export function isLowRiskPick(match, pick = null) {
  return getMatchRiskProfile(match, pick).riskLevel === 'LOW';
}

// The pick that actually lands on a slip when a match is added without an explicit selection:
// the model's top side, with straight-draw predictions normalised to the stronger team.
export function getSlipPick(m) {
  const pick = getDefaultPick(m);
  if (pick === 'HOME' || pick === 'AWAY' || pick === '1X' || pick === 'X2' || pick === '12') return pick;
  const home = safeParseFloat(m?.prob?.home ?? m?.homeProb, 0);
  const away = safeParseFloat(m?.prob?.away ?? m?.awayProb, 0);
  return home >= away ? 'HOME' : 'AWAY';
}
