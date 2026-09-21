import React, { useState, useMemo } from 'react';
import { 
  ListChecks, 
  Copy, 
  Check, 
  CheckCircle2, 
  Trash2, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  AlertTriangle, 
  Wallet, 
  BrainCircuit, 
  Award, 
  Zap, 
  X, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Wand2,
  RefreshCw,
  Plus,
  Shield,
  SlidersHorizontal
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { formatRelativeDayTime } from '../utils/dateUtils';
import { resolveMatchOdds, resolveMatchProb } from '../utils/oddsUtils';
import Markdown from 'react-markdown';

const PARITY_LEAGUES = [
  'Championship', 'League One', 'League Two', 'MLS', 'Major League Soccer',
  'Liga Profesional', 'Liga MX', 'Serie B', 'LaLiga 2', 'Ligue 2',
  'Swedish Allsvenskan', 'Norwegian Eliteserien', 'Danish Superliga',
  'Austrian Bundesliga', 'Saudi Pro League', 'Turkish Super Lig', 'Scottish Premiership'
];

/**
 * Autonomous Evaluation for an individual leg in a bet slip
 */
function evaluateLegAutonomousStatus(leg, match) {
  const m = match || leg.match || {};
  const sw = m.aiSwarm || m.imperialSwarm || {};
  
  const isTrap = Boolean(sw.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged);
  const isUnan = Boolean(sw.isTopValueLeg || sw.consensusTier === 'UNANIMOUS_DIRECTIVE' || sw.isUnanimousDirective);
  const isParity = Boolean(m.league && PARITY_LEAGUES.some(pl => m.league.toLowerCase().includes(pl.toLowerCase())));
  
  const drawProb = safeParseFloat(m.prob?.draw, 24);
  const pickVal = String(leg.pick || '').toUpperCase();
  const isStraightPick = pickVal === 'HOME' || pickVal === 'AWAY' || pickVal === '1' || pickVal === '2';
  const isProtectedDC = pickVal === '1X' || pickVal === 'X2' || pickVal === '12';
  
  const legProb = safeParseFloat(leg.prob, 50);
  const legOdds = safeParseFloat(leg.odds, 1.5);
  const ev = ((legProb / 100) * legOdds) - 1;

  // High draw risk if straight pick in a game where draw >= 22% or parity league
  const isDrawVulnerable = isStraightPick && (drawProb >= 22 || (isParity && legProb < 68));

  let badge = {
    type: 'neutral',
    label: 'Standard',
    title: 'Balanced model probability'
  };

  if (isTrap) {
    badge = {
      type: 'danger',
      label: '⚠️ High Risk',
      title: 'Upset risk or odds divergence detected'
    };
  } else if (isProtectedDC) {
    badge = {
      type: 'protected',
      label: '🛡️ Protected (DC)',
      title: 'Double Chance protection'
    };
  } else if (isUnan) {
    badge = {
      type: 'unanimous',
      label: '👑 Consensus',
      title: 'All models agree on this pick'
    };
  } else if (isDrawVulnerable) {
    badge = {
      type: 'warning',
      label: '⚡ Draw Risk',
      title: `Draw probability is ${safeToFixed(drawProb, 0)}% — consider Double Chance`
    };
  } else if (ev > 0.05) {
    badge = {
      type: 'positive-ev',
      label: `💎 +EV (+${safeToFixed(ev * 100, 1)}%)`,
      title: 'Model probability exceeds bookmaker odds'
    };
  } else if (ev < -0.05) {
    badge = {
      type: 'negative-ev',
      label: `📉 -EV (${safeToFixed(ev * 100, 1)}%)`,
      title: 'Odds offer lower return than model projection'
    };
  }

  return {
    isTrap,
    isUnan,
    isParity,
    drawProb,
    isStraightPick,
    isProtectedDC,
    isDrawVulnerable,
    ev,
    badge
  };
}

export default function AccumulatorPage({
  tzSettings = {},
  matches = [],
  accaPicks = [],
  betSlips = [],
  activeSlipId = 'slip-1',
  onSetActiveSlipId,
  onUpdateBetSlips,
  onRemovePick,
  onClearSlip,
  onAddPick,
  aiSwarm = null
}) {
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [bankroll, setBankroll] = useState(1000);
  const [kellyMultiplier, setKellyMultiplier] = useState(0.25); // Quarter Kelly
  const [customWager, setCustomWager] = useState("");
  const [analysisReport, setAnalysisReport] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadedNotice, setLoadedNotice] = useState(null);
  const [showStakingSettings, setShowStakingSettings] = useState(false);
  const [showVarianceExplainer, setShowVarianceExplainer] = useState(false);

  // Preset Builder Controls
  const [presetStrategy, setPresetStrategy] = useState('unanimous'); // 'unanimous' | 'antifragile' | 'value'
  const [presetLegCount, setPresetLegCount] = useState(3);

  const strategyWinRate = aiSwarm?.directives?.telemetry?.unanimousHitRate || '84.8%';
  const accaMatchIds = useMemo(() => new Set(accaPicks.map(p => String(p.id))), [accaPicks]);

  // Resolved active legs
  const activeLegs = useMemo(() => {
    return accaPicks.map((pick, idx) => {
      const pMatch = pick.match || matches.find(m => String(m.id) === String(pick.id) || (m.home === pick.home && m.away === pick.away)) || pick;
      const timeVal = pMatch.timestamp || pMatch.utcDate || pMatch.dateIso || pMatch.date;
      const dateDisplay = timeVal ? formatRelativeDayTime(timeVal, tzSettings) : (pMatch.time || 'Upcoming');
      const pickVal = pick.pick || (typeof pMatch.predictedWinner === 'string' ? pMatch.predictedWinner : pMatch.predictedWinner?.pick) || 'HOME';
      const realOdds = resolveMatchOdds(pMatch, pickVal, pick.odds);
      const realProb = resolveMatchProb(pMatch, pickVal, pick.prob || pick.confidence);

      const status = evaluateLegAutonomousStatus({ ...pick, pick: pickVal, odds: realOdds, prob: realProb }, pMatch);

      return {
        pickId: pick.pickId || `${pick.id}-${idx}`,
        id: pick.id,
        match: pMatch,
        legNum: idx + 1,
        home: pick.home,
        away: pick.away,
        league: pick.league || pMatch.league,
        time: dateDisplay,
        market: pick.market || `${pickVal} Win`,
        odds: realOdds,
        prob: realProb,
        conf: realProb,
        confidence: realProb,
        pick: pickVal,
        status
      };
    });
  }, [accaPicks, matches, tzSettings]);

  // Combined metrics
  const totalOdds = useMemo(() => {
    if (activeLegs.length === 0) return 1.0;
    return activeLegs.reduce((acc, leg) => {
      const o = safeParseFloat(leg.odds, 1.0);
      return acc * (o > 0 ? o : 1.0);
    }, 1.0);
  }, [activeLegs]);

  const combinedProb = useMemo(() => {
    if (activeLegs.length === 0) return 0;
    return activeLegs.reduce((acc, leg) => {
      const p = safeParseFloat(leg.prob, 50);
      return acc * ((p > 0 ? p : 50) / 100);
    }, 1.0) * 100;
  }, [activeLegs]);

  const expectedValue = useMemo(() => {
    if (activeLegs.length === 0 || totalOdds <= 1) return 0;
    const p = combinedProb / 100;
    return (p * totalOdds) - 1;
  }, [totalOdds, combinedProb, activeLegs]);

  const kellyRecommendation = useMemo(() => {
    if (activeLegs.length === 0 || totalOdds <= 1) return 0;
    const b = totalOdds - 1;
    const p = combinedProb / 100;
    const q = 1 - p;
    const f = p - (q / b);
    if (f <= 0) return 0;
    return bankroll * f * kellyMultiplier;
  }, [activeLegs, totalOdds, combinedProb, bankroll, kellyMultiplier]);

  const effectiveWager = useMemo(() => {
    const cw = parseFloat(customWager);
    if (!isNaN(cw) && cw > 0) return cw;
    return kellyRecommendation;
  }, [customWager, kellyRecommendation]);

  // Comprehensive Autonomous Judgment Engine for the Active Slip
  const autonomousJudgement = useMemo(() => {
    if (activeLegs.length === 0) {
      return null;
    }

    const nLegs = activeLegs.length;
    let score = 75; // baseline
    const recommendations = [];
    let trapCount = 0;
    let drawRiskCount = 0;
    let negativeEvCount = 0;
    let unanimousCount = 0;
    let dcCount = 0;

    activeLegs.forEach((l) => {
      if (l.status.isTrap) trapCount++;
      if (l.status.isDrawVulnerable) drawRiskCount++;
      if (l.status.ev < -0.05) negativeEvCount++;
      if (l.status.isUnan) unanimousCount++;
      if (l.status.isProtectedDC) dcCount++;
    });

    // 1. Leg Count Variance Decay Rubric
    if (nLegs <= 3) {
      score += 15; // optimal Kelly zone
    } else if (nLegs === 4) {
      score += 5;
    } else if (nLegs === 5) {
      score -= 10;
      recommendations.push("Ticket has 5 legs: exponential variance significantly reduces survival (~20% joint probability).");
    } else {
      score -= 25;
      recommendations.push(`High decay penalty: ${nLegs}-fold accumulator suffers from heavy multiplicative variance. Consider trimming to 3-4 legs.`);
    }

    // 2. Traps & Upset Risk
    if (trapCount > 0) {
      score -= trapCount * 25;
      recommendations.push(`${trapCount} selection(s) flagged for contrarian upset traps or market bias. High risk of losing your entire slip.`);
    }

    // 3. Draw Vulnerability
    if (drawRiskCount > 0) {
      score -= drawRiskCount * 8;
      recommendations.push(`${drawRiskCount} straight win pick(s) have draw probability ≥ 22%. Insulating with Double Chance (1X/X2) strongly protects ticket survival.`);
    }

    // 4. Expected Value
    if (expectedValue > 0.15) {
      score += 15;
    } else if (expectedValue > 0) {
      score += 8;
    } else {
      score -= 15;
      recommendations.push("Mathematical edge (EV) is currently negative. Bookmaker juice outweighs win probability.");
    }

    // 5. Unanimous Consensus & Protection Boosts
    if (unanimousCount === nLegs && nLegs >= 2) {
      score += 15;
    }
    if (dcCount > 0) {
      score += Math.min(10, dcCount * 4);
    }

    // Clamp score
    const clampedScore = Math.max(10, Math.min(99, Math.round(score)));

    // Assign Grade
    let grade = 'B';
    let gradeColor = 'text-blue-600 bg-blue-50 border-blue-200';
    let verdictTitle = 'Solid Accumulator';
    let verdictText = 'Balanced slip with positive expectations. Disciplined staking advised.';

    if (trapCount > 0) {
      grade = 'D';
      gradeColor = 'text-rose-700 bg-rose-50 border-rose-200';
      verdictTitle = 'High Risk';
      verdictText = 'One or more selections have elevated draw or upset risk.';
    } else if (nLegs >= 6) {
      grade = 'C-';
      gradeColor = 'text-amber-700 bg-amber-50 border-amber-200';
      verdictTitle = 'Too Many Legs';
      verdictText = 'Too many legs reduce overall win probability. Consider 3 to 4 legs.';
    } else if (clampedScore >= 90) {
      grade = 'A+';
      gradeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      verdictTitle = 'Top Quality Slip';
      verdictText = 'High confidence, strong value, and low risk across all picks.';
    } else if (clampedScore >= 80) {
      grade = 'A';
      gradeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      verdictTitle = 'Strong Value Slip';
      verdictText = 'Solid win probability and good value across selections.';
    } else if (clampedScore >= 70) {
      grade = 'B+';
      gradeColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
      verdictTitle = 'Favorable Value Slip';
      verdictText = 'Positive expected value. Double Chance protection can reduce risk.';
    } else if (clampedScore >= 60) {
      grade = 'B';
      gradeColor = 'text-slate-700 bg-slate-100 border-slate-300';
      verdictTitle = 'Moderate Risk';
      verdictText = 'Acceptable slip, but contains close games with draw risk.';
    } else {
      grade = 'C';
      gradeColor = 'text-amber-700 bg-amber-50 border-amber-200';
      verdictTitle = 'Elevated Risk';
      verdictText = 'Low win probability or unfavorable odds. Consider fewer legs or safer markets.';
    }

    const canAutoOptimize = trapCount > 0 || drawRiskCount > 0 || nLegs > 5 || negativeEvCount > 0;

    return {
      score: clampedScore,
      grade,
      gradeColor,
      verdictTitle,
      verdictText,
      recommendations,
      canAutoOptimize,
      trapCount,
      drawRiskCount,
      negativeEvCount,
      unanimousCount,
      dcCount
    };
  }, [activeLegs, expectedValue]);

  // Helper to find match
  const findMatchForLeg = (leg) => {
    if (!matches || matches.length === 0) return null;
    return matches.find(m => 
      (leg.fixtureId != null && String(m.id) === String(leg.fixtureId)) ||
      (leg.id != null && String(m.id) === String(leg.id)) ||
      (leg.fixture && `${m.home} vs ${m.away}`.toLowerCase() === String(leg.fixture).toLowerCase()) ||
      (leg.home && leg.away && m.home && m.away && m.home.toLowerCase().includes(leg.home.toLowerCase()) && m.away.toLowerCase().includes(leg.away.toLowerCase()))
    );
  };

  const buildPickObject = (match, pickValue, marketLabel, customOdds, customProb) => {
    const rawOdds = resolveMatchOdds(match, pickValue, customOdds);
    const prob = resolveMatchProb(match, pickValue, customProb);
    return {
      pickId: `${match.id}-${marketLabel || pickValue}`,
      id: match.id,
      match: match,
      home: match.home,
      away: match.away,
      league: match.league,
      time: match.time,
      date: match.date,
      utcDate: match.dateIso || match.date,
      market: marketLabel || `${pickValue} Win`,
      pick: pickValue,
      odds: rawOdds,
      prob: prob,
      confidence: prob
    };
  };

  // Helper to strictly deduplicate picks by fixture (LiveScore Bet single selection per match rule)
  const deduplicatePicksByFixture = (picksList) => {
    if (!Array.isArray(picksList)) return [];
    const seen = new Map();
    for (const p of picksList) {
      const matchKey = p.id 
        ? String(p.id) 
        : `${(p.home || '').toLowerCase().trim()}_vs_${(p.away || '').toLowerCase().trim()}`;
      // Keep the latest/first distinct selection per match
      if (!seen.has(matchKey)) {
        seen.set(matchKey, p);
      }
    }
    return Array.from(seen.values());
  };

  const loadPicksIntoSlip = (picksToLoad, ticketName) => {
    if (!picksToLoad || picksToLoad.length === 0) return;
    const singlePicksPerMatch = deduplicatePicksByFixture(picksToLoad);
    if (onUpdateBetSlips) {
      onUpdateBetSlips(prevSlips => {
        const slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) return prevSlips;
        const newSlips = [...prevSlips];
        newSlips[slipIndex] = {
          ...newSlips[slipIndex],
          picks: singlePicksPerMatch
        };
        return newSlips;
      });
    }
    setLoadedNotice(`Loaded ${singlePicksPerMatch.length} selections: ${ticketName}`);
    setTimeout(() => setLoadedNotice(null), 3500);
  };

  // Pools for Autonomous Presets
  const allUnanimousPool = useMemo(() => {
    const map = new Map();
    const parlayAllLegs = aiSwarm?.directives?.topValueParlay?.allLegs || aiSwarm?.directives?.topValueParlay?.legs || [];
    const directUnan = aiSwarm?.directives?.unanimousDirectives || [];
    const directiveSource = [...parlayAllLegs, ...directUnan];

    directiveSource.forEach(leg => {
      const orig = findMatchForLeg(leg);
      const fixtureId = orig?.id || leg.fixtureId;
      if (fixtureId && !map.has(String(fixtureId))) {
        const pPick = leg.pick || leg.masterVerdict || (orig && (typeof orig.predictedWinner === 'string' ? orig.predictedWinner : orig.predictedWinner?.pick)) || 'HOME';
        const targetMatch = orig || {
          id: fixtureId,
          home: leg.home,
          away: leg.away,
          league: leg.league || 'League',
          time: 'Upcoming'
        };
        const matchProb = resolveMatchProb(targetMatch, pPick, leg.modelProb && !orig?.prob ? leg.modelProb : null);
        const matchOdds = resolveMatchOdds(targetMatch, pPick, leg.odds);

        map.set(String(fixtureId), {
          match: targetMatch,
          pick: pPick,
          market: `${pPick} Win (Unanimous)`,
          odds: matchOdds,
          prob: matchProb,
          score: (leg.swarmScore || 80) + matchProb
        });
      }
    });

    (matches || []).forEach(m => {
      const idStr = String(m.id);
      if (map.has(idStr)) return;
      const sw = m.aiSwarm || m.imperialSwarm;
      const isTrap = sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged;
      if (isTrap) return;

      const isUnan = sw?.isTopValueLeg || sw?.consensusTier === 'UNANIMOUS_DIRECTIVE' || sw?.isUnanimousDirective;
      const conf = parseFloat(m.confidence ?? m.binaryModel?.confidence ?? 0);
      const isParity = Boolean(m.league && PARITY_LEAGUES.some(pl => m.league.toLowerCase().includes(pl.toLowerCase())));
      if (isParity && conf < 68.0) return;

      if (isUnan || conf >= 65) {
        const pickVal = (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || m.binaryModel?.pick || 'HOME';
        const matchProb = resolveMatchProb(m, pickVal);
        const matchOdds = resolveMatchOdds(m, pickVal);

        map.set(idStr, {
          match: m,
          pick: pickVal,
          market: `${pickVal} Win (Unanimous)`,
          odds: matchOdds,
          prob: matchProb,
          score: (sw?.swarmScore || conf) + (isUnan ? 30 : 0) + matchProb
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [aiSwarm, matches]);

  const allAntiFragilePool = useMemo(() => {
    const map = new Map();
    const parlayAllLegs = aiSwarm?.directives?.antiFragileParlay?.allLegs || aiSwarm?.directives?.antiFragileParlay?.legs || [];
    
    parlayAllLegs.forEach(leg => {
      const orig = findMatchForLeg(leg);
      const fixtureId = orig?.id || leg.fixtureId;
      if (fixtureId && !map.has(String(fixtureId))) {
        const rawPick = leg.rawPick || leg.pick || 'HOME';
        const pickVal = leg.pick || (rawPick === 'HOME' ? '1X' : rawPick === 'AWAY' ? 'X2' : rawPick);
        const marketLabel = leg.market || (rawPick === 'HOME' ? '1X (Home or Draw)' : rawPick === 'AWAY' ? 'X2 (Away or Draw)' : `${pickVal} (Protected)`);
        const targetMatch = orig || {
          id: fixtureId,
          home: leg.home,
          away: leg.away,
          league: leg.league || 'League',
          time: 'Upcoming'
        };
        const matchProb = resolveMatchProb(targetMatch, pickVal);
        const matchOdds = resolveMatchOdds(targetMatch, pickVal, leg.odds);

        map.set(String(fixtureId), {
          match: targetMatch,
          pick: pickVal,
          market: marketLabel,
          odds: matchOdds,
          prob: matchProb,
          score: matchProb + 25
        });
      }
    });

    (matches || []).forEach(m => {
      const idStr = String(m.id);
      if (map.has(idStr)) return;
      const sw = m.aiSwarm || m.imperialSwarm;
      const isTrap = sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged;
      if (isTrap) return;

      const isPrime = m.disruptionModel?.stabilityStatus === 'PRIME_STABLE' || m.stabilityStatus === 'PRIME_STABLE';
      const stabScore = m.disruptionModel?.stabilityScore || 70;

      const rawPick = (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || m.binaryModel?.pick || 'HOME';
      const protectedPick = rawPick === 'HOME' ? '1X' : rawPick === 'AWAY' ? 'X2' : rawPick;
      const marketLabel = rawPick === 'HOME' ? '1X (Home or Draw)' : rawPick === 'AWAY' ? 'X2 (Away or Draw)' : `${rawPick} (Protected)`;
      const matchProb = resolveMatchProb(m, protectedPick);
      const matchOdds = resolveMatchOdds(m, protectedPick);

      map.set(idStr, {
        match: m,
        pick: protectedPick,
        market: marketLabel,
        odds: matchOdds,
        prob: matchProb,
        score: matchProb + (isPrime ? 25 : 0) + (stabScore > 75 ? 12 : 0)
      });
    });

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [aiSwarm, matches]);

  const allValuePool = useMemo(() => {
    return (matches || [])
      .filter(m => {
        const sw = m.aiSwarm || m.imperialSwarm;
        const isTrap = sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
        if (isTrap) return false;
        const pickVal = (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || 'HOME';
        const prob = resolveMatchProb(m, pickVal);
        const odds = resolveMatchOdds(m, pickVal);
        const ev = ((prob / 100) * odds) - 1;
        return ev > 0.04 && prob >= 55;
      })
      .map(m => {
        const pickVal = (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || 'HOME';
        const prob = resolveMatchProb(m, pickVal);
        const odds = resolveMatchOdds(m, pickVal);
        const ev = ((prob / 100) * odds) - 1;
        return {
          match: m,
          pick: pickVal,
          market: `${pickVal} Win`,
          odds,
          prob,
          ev,
          score: (ev * 100) + (prob * 0.5)
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [matches]);

  // Suggested high-conviction candidate matches to append to slip
  const suggestedMatches = useMemo(() => {
    return matches
      .filter(m => {
        if (accaMatchIds.has(String(m.id))) return false;
        const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
        if (isTrap) return false;
        const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, Math.max(safeParseFloat(m.prob?.home, 0), safeParseFloat(m.prob?.away, 0)));
        const isParity = Boolean(m.league && PARITY_LEAGUES.some(pl => m.league.toLowerCase().includes(pl.toLowerCase())));
        if (isParity && conf < 68.0) return false;
        return conf >= 60;
      })
      .sort((a, b) => {
        const aUnan = ((a.aiSwarm || a.imperialSwarm)?.isTopValueLeg || (a.aiSwarm || a.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE') ? 1 : 0;
        const bUnan = ((b.aiSwarm || b.imperialSwarm)?.isTopValueLeg || (b.aiSwarm || b.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE') ? 1 : 0;
        if (aUnan !== bUnan) return bUnan - aUnan;
        const confA = safeParseFloat(a.confidence ?? a.binaryModel?.confidence, 50);
        const confB = safeParseFloat(b.confidence ?? b.binaryModel?.confidence, 50);
        return confB - confA;
      })
      .slice(0, 4);
  }, [matches, accaMatchIds]);

  // Preset Generation Handler
  const handleLoadAutonomousPreset = () => {
    let pool = allUnanimousPool;
    let label = '6-Agent Unanimous Ticket';
    if (presetStrategy === 'antifragile') {
      pool = allAntiFragilePool;
      label = 'Anti-Fragile Protected Ticket';
    } else if (presetStrategy === 'value') {
      pool = allValuePool;
      label = '+EV Alpha Ticket';
    }

    const count = presetLegCount === 'ALL' ? pool.length : (parseInt(presetLegCount, 10) || 3);
    const selected = pool.slice(0, count);

    const picksToLoad = selected.map(item => {
      const legProb = resolveMatchProb(item.match, item.pick);
      const legOdds = resolveMatchOdds(item.match, item.pick, item.odds);
      return buildPickObject(item.match, item.pick, item.market, legOdds, legProb);
    });

    if (picksToLoad.length > 0) {
      loadPicksIntoSlip(picksToLoad, `${label} (${picksToLoad.length} Legs)`);
    } else {
      // If pool is empty, fall back to any available high-confidence matches
      const fallbackMatches = (matches || [])
        .filter(m => !m.disruptionModel?.isPassFlagged)
        .slice(0, typeof presetLegCount === 'number' ? presetLegCount : 3);
      if (fallbackMatches.length > 0) {
        const fallbackPicks = fallbackMatches.map(m => {
          const pickVal = (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || 'HOME';
          const p = resolveMatchProb(m, pickVal);
          const o = resolveMatchOdds(m, pickVal);
          return buildPickObject(m, pickVal, `${pickVal} Win`, o, p);
        });
        loadPicksIntoSlip(fallbackPicks, `High-Confidence Slate (${fallbackPicks.length} Legs)`);
      } else {
        setLoadedNotice('No active matches available in slate to build ticket.');
        setTimeout(() => setLoadedNotice(null), 3000);
      }
    }
  };

  // Autonomous One-Click Optimization
  const handleAutoOptimizeSlip = () => {
    if (activeLegs.length === 0) return;

    let convertedCount = 0;
    let removedTrapCount = 0;

    // 1. Convert vulnerable straight picks to Double Chance, prune dangerous traps
    let optimized = activeLegs.map(leg => {
      const m = leg.match || matches.find(item => item.id === leg.id);
      const p = String(leg.pick).toUpperCase();

      // If contrarian trap and cannot be salvaged
      if (leg.status.isTrap && !leg.status.isProtectedDC) {
        removedTrapCount++;
        return null; // remove
      }

      // If straight pick with draw vulnerability, shield with Double Chance
      if ((p === 'HOME' || p === '1' || p === 'AWAY' || p === '2') && leg.status.isDrawVulnerable) {
        const newPick = (p === 'HOME' || p === '1') ? '1X' : 'X2';
        const newMarket = newPick === '1X' ? '1X (Home or Draw)' : 'X2 (Away or Draw)';
        const newOdds = resolveMatchOdds(m, newPick);
        const newProb = resolveMatchProb(m, newPick);
        convertedCount++;
        return buildPickObject(m, newPick, newMarket, newOdds, newProb);
      }

      return buildPickObject(m, leg.pick, leg.market, leg.odds, leg.prob);
    }).filter(Boolean);

    // 2. If ticket still has > 4 legs, trim down to top 4 highest-equity legs to prevent decay
    if (optimized.length > 4) {
      optimized = optimized
        .sort((a, b) => {
          const evA = ((a.prob / 100) * a.odds) - 1;
          const evB = ((b.prob / 100) * b.odds) - 1;
          return evB - evA;
        })
        .slice(0, 4);
    }

    if (onUpdateBetSlips) {
      onUpdateBetSlips(prevSlips => {
        const slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) return prevSlips;
        const newSlips = [...prevSlips];
        newSlips[slipIndex] = {
          ...newSlips[slipIndex],
          picks: optimized
        };
        return newSlips;
      });
    }

    setLoadedNotice(
      `Autonomous Optimization Applied: ${convertedCount} leg(s) shielded with Double Chance${removedTrapCount > 0 ? `, ${removedTrapCount} trap(s) removed` : ''}.`
    );
    setTimeout(() => setLoadedNotice(null), 4000);
  };

  // Toggle individual leg shield (Straight <-> Double Chance)
  const handleToggleLegShield = (leg) => {
    const m = leg.match || matches.find(item => item.id === leg.id);
    const p = String(leg.pick).toUpperCase();
    let newPick = p;
    let newMarket = leg.market;

    if (p === 'HOME' || p === '1') {
      newPick = '1X';
      newMarket = '1X (Home or Draw)';
    } else if (p === 'AWAY' || p === '2') {
      newPick = 'X2';
      newMarket = 'X2 (Away or Draw)';
    } else if (p === '1X') {
      newPick = 'HOME';
      newMarket = 'HOME Win';
    } else if (p === 'X2') {
      newPick = 'AWAY';
      newMarket = 'AWAY Win';
    } else {
      return;
    }

    const newOdds = resolveMatchOdds(m, newPick);
    const newProb = resolveMatchProb(m, newPick);
    const updatedPickObj = buildPickObject(m, newPick, newMarket, newOdds, newProb);

    if (onUpdateBetSlips) {
      onUpdateBetSlips(prevSlips => {
        const slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) return prevSlips;
        const currentSlip = prevSlips[slipIndex];
        const newPicks = currentSlip.picks.map(pItem => {
          if (pItem.pickId === leg.pickId || pItem.id === leg.id) {
            return updatedPickObj;
          }
          return pItem;
        });
        const newSlips = [...prevSlips];
        newSlips[slipIndex] = { ...currentSlip, picks: newPicks };
        return newSlips;
      });
    }
  };

  const handleCopyBetSlip = () => {
    if (activeLegs.length === 0) return;
    const lines = activeLegs.map(l => `• [${l.league}] ${l.home} vs ${l.away} -> ${l.market} @ ${safeToFixed(l.odds, 2)} (${l.time})`);
    const profit = (effectiveWager * totalOdds) - effectiveWager;
    const evString = `${expectedValue > 0 ? '+' : ''}${safeToFixed(expectedValue * 100, 1)}%`;
    
    const slipText = `MATCHSCRAPER AI AUTONOMOUS BET SLIP (${activeLegs.length}-Fold)\n----------------------------------------\n${lines.join('\n')}\n----------------------------------------\nAutonomous Verdict: ${autonomousJudgement?.grade || 'A'} (${autonomousJudgement?.verdictTitle || 'Verified'})\nTotal Combined Odds: ${safeToFixed(totalOdds, 2)}x\nJoint Model Probability: ${safeToFixed(combinedProb, 1)}%\nMathematical Edge (EV): ${evString}\nWager: €${safeToFixed(effectiveWager, 2)}\nPotential Payout: €${safeToFixed(effectiveWager * totalOdds, 2)} (Profit: €${safeToFixed(profit, 2)})`;
    
    navigator.clipboard.writeText(slipText);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2500);
  };

  const handleFinalAnalysis = async () => {
    if (activeLegs.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const sanitizedPicks = activeLegs.map(l => ({
        id: l.id,
        home: l.home,
        away: l.away,
        league: l.league,
        market: l.market,
        pick: l.pick,
        odds: l.odds,
        prob: l.prob,
        confidence: l.confidence || l.conf || l.prob,
        time: l.time
      }));

      const sanitizedSuggested = (suggestedMatches || []).slice(0, 4).map(m => ({
        id: m.id,
        home: m.home,
        away: m.away,
        league: m.league,
        time: m.time,
        dateIso: m.dateIso || m.utcDate || m.date
      }));

      const response = await fetch('/api/analyze-accumulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: sanitizedPicks,
          suggestedMatches: sanitizedSuggested
        })
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysisReport(data.analysis);
      } else {
        setAnalysisError(data.error || 'Analysis failed. Please try again.');
      }
    } catch (error) {
      setAnalysisError('Error connecting to analysis engine: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Sleek Uniform Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Bet Slips &amp; Accumulators
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  {activeLegs.length} {activeLegs.length === 1 ? 'Leg' : 'Legs'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Review combined odds, win probability, and recommended stakes
              </p>
            </div>
          </div>

          {/* Slip selector & quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <UniformDropdown
              label="Slip"
              value={activeSlipId}
              onChange={(val) => {
                if (val === 'create_new') {
                  const newId = `slip-${Date.now()}`;
                  onUpdateBetSlips([...betSlips, { id: newId, name: `Slip ${betSlips.length + 1}`, picks: [] }]);
                  onSetActiveSlipId(newId);
                } else {
                  onSetActiveSlipId(val);
                }
              }}
              options={[
                ...betSlips.map(s => ({ value: s.id, label: s.name })),
                { value: 'create_new', label: '+ New Slip' }
              ]}
            />

            {activeLegs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleAutoOptimizeSlip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                  title="Protect selections with Double Chance and remove high-risk picks"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Auto-Optimize</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyBetSlip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                  title="Copy bet slip summary to clipboard"
                >
                  {copiedSlip ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSlip ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Review slip with AI assistant"
                >
                  <BrainCircuit className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">{isAnalyzing ? 'Reviewing...' : 'AI Review'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClearSlip}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Clear all selections in active slip"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Autonomous Judgement & Key Metrics Card */}
      {activeLegs.length > 0 && autonomousJudgement && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`px-2.5 py-1 rounded-lg border font-black text-sm ${autonomousJudgement.gradeColor}`}>
                {autonomousJudgement.grade}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Rating: {autonomousJudgement.verdictTitle}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({autonomousJudgement.score}/100)</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {autonomousJudgement.verdictText}
                </div>
              </div>
            </div>

            {autonomousJudgement.canAutoOptimize && (
              <button
                type="button"
                onClick={handleAutoOptimizeSlip}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Protect Slip</span>
              </button>
            )}
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Combined Odds</div>
              <div className="text-base font-black font-mono text-indigo-700 mt-0.5">{safeToFixed(totalOdds, 2)}x</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Win Probability</div>
              <div className="text-base font-black font-mono text-emerald-700 mt-0.5">{safeToFixed(combinedProb, 1)}%</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Value (EV)</div>
              <div className={`text-base font-black font-mono mt-0.5 ${expectedValue > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {expectedValue > 0 ? '+' : ''}{safeToFixed(expectedValue * 100, 1)}%
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Suggested Stake</div>
              <div className="text-base font-black font-mono text-slate-800 mt-0.5">
                €{safeToFixed(effectiveWager, 2)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-emerald-800 font-bold uppercase">Potential Return</div>
              <div className="text-base font-black font-mono text-emerald-800 mt-0.5">
                €{safeToFixed(effectiveWager * totalOdds, 2)}
              </div>
            </div>
          </div>

          {/* Autonomous Recommendations if any */}
          {autonomousJudgement.recommendations.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-1">
              {autonomousJudgement.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Autonomous Presets Generator Bar (Simpler, unified UI) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Ticket Generator
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Historical Win Rate: <strong className="text-slate-800">{strategyWinRate}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Strategy mode pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 flex-wrap">
            <button
              type="button"
              onClick={() => setPresetStrategy('unanimous')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                presetStrategy === 'unanimous'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👑 Top Consensus ({allUnanimousPool.length})
            </button>
            <button
              type="button"
              onClick={() => setPresetStrategy('antifragile')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                presetStrategy === 'antifragile'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛡️ Double Chance ({allAntiFragilePool.length})
            </button>
            <button
              type="button"
              onClick={() => setPresetStrategy('value')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                presetStrategy === 'value'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💎 Best Value ({allValuePool.length})
            </button>
          </div>

          {/* Leg count pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[2, 3, 4, 5, 'ALL'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setPresetLegCount(num)}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  presetLegCount === num
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {num === 'ALL' ? 'All' : `${num} Legs`}
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleLoadAutonomousPreset}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Build Ticket</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {loadedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{loadedNotice}</span>
          </div>
          <button 
            onClick={() => setLoadedNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Analysis Error Banner */}
      {analysisError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{analysisError}</span>
          </div>
          <button 
            onClick={() => setAnalysisError(null)}
            className="text-rose-700 hover:text-rose-900 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Active Legs Table (Clean, modern look) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Active Selections
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowStakingSettings(!showStakingSettings)}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{showStakingSettings ? 'Hide Staking Options' : 'Staking Settings'}</span>
            </button>
            <span className="text-xs text-slate-500">
              {activeLegs.length === 0 ? 'No selections' : `${activeLegs.length} ready`}
            </span>
          </div>
        </div>

        {/* Collapsible Staking Controls */}
        {showStakingSettings && (
          <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-end gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Bankroll (€)</label>
              <input 
                type="number" 
                value={bankroll} 
                onChange={(e) => setBankroll(Number(e.target.value) || 0)}
                className="w-24 px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Kelly Strategy</label>
              <select 
                value={kellyMultiplier} 
                onChange={(e) => setKellyMultiplier(Number(e.target.value))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800 cursor-pointer"
              >
                <option value={0.125}>1/8 Kelly (Very Safe)</option>
                <option value={0.25}>1/4 Kelly (Recommended)</option>
                <option value={0.5}>1/2 Kelly (Moderate)</option>
                <option value={1.0}>Full Kelly (Aggressive)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Custom Wager (€)</label>
              <input 
                type="number" 
                placeholder="Auto Kelly"
                value={customWager} 
                onChange={(e) => setCustomWager(e.target.value)}
                className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {activeLegs.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <ListChecks className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Your Bet Slip is Empty</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Select your preferred strategy and click <strong>"Build Ticket"</strong> above, or generate an instant high-conviction slip below.
            </p>
            <button
              type="button"
              onClick={handleLoadAutonomousPreset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Generate Autonomous Slip</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none h-9">
                  <th className="py-1.5 px-2.5 w-10 text-center">#</th>
                  <th className="py-1.5 px-2.5 min-w-[150px]">Fixture</th>
                  <th className="py-1.5 px-2.5 min-w-[120px]">Status</th>
                  <th className="py-1.5 px-2.5 min-w-[150px]">Selection</th>
                  <th className="py-1.5 px-2.5 w-20 text-center">Odds</th>
                  <th className="py-1.5 px-2.5 w-24 text-center">Probability</th>
                  <th className="py-1.5 px-2.5 w-24 text-center">Value (EV)</th>
                  <th className="py-1.5 px-2.5 w-14 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeLegs.map((leg, idx) => {
                  const b = leg.status.badge;
                  const canShield = leg.status.isStraightPick;
                  const isDC = leg.status.isProtectedDC;

                  return (
                    <tr key={leg.pickId || leg.id || idx} className={`hover:bg-slate-50/80 transition-colors h-11 ${leg.status.isTrap ? 'bg-rose-50/40' : 'bg-white'}`}>
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">
                        {leg.legNum}
                      </td>
                      <td className="py-1.5 px-2.5">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {leg.home} vs {leg.away}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{leg.league}</span>
                          <span>•</span>
                          <span>{leg.time}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span 
                          title={b.title}
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            b.type === 'danger' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            b.type === 'warning' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                            b.type === 'protected' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            b.type === 'unanimous' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            b.type === 'positive-ev' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {leg.market}
                          </span>
                          {(canShield || isDC) && (
                            <button
                              type="button"
                              onClick={() => handleToggleLegShield(leg)}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-0.5 ${
                                isDC 
                                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={isDC ? 'Revert to straight win market' : 'Shield against draw with Double Chance (1X/X2)'}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              <span>{isDC ? 'Unshield' : 'Shield DC'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-mono font-bold text-slate-800">
                        {safeToFixed(leg.odds, 2)}
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-mono text-emerald-700 font-semibold">
                        {safeToFixed(leg.prob, 1)}%
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-mono font-bold">
                        <span className={leg.status.ev > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {leg.status.ev > 0 ? '+' : ''}{safeToFixed(leg.status.ev * 100, 1)}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onRemovePick(leg.pickId || leg.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove leg"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Recommended High-Stability Candidates (Minimalist grid) */}
      {suggestedMatches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended High-Conviction Candidates</span>
            </div>
            <span className="text-[10px] text-slate-400">Low Chaos • Traps Filtered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {suggestedMatches.map((m) => {
              const homeP = safeParseFloat(m.prob?.home, 0);
              const awayP = safeParseFloat(m.prob?.away, 0);
              const pickTeam = homeP >= awayP ? m.home : m.away;
              const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, Math.max(homeP, awayP));
              const isUnan = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE';
              
              const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
              const dateDisplay = timeVal ? formatRelativeDayTime(timeVal, tzSettings) : (m.time || 'Upcoming');

              return (
                <div 
                  key={m.id}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/30 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
                      <span className="truncate">{m.home} vs {m.away}</span>
                      {isUnan && (
                        <span className="shrink-0 text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                          👑
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>Pick: <strong>{pickTeam}</strong></span>
                      <span className="text-emerald-700 font-bold">{safeToFixed(conf, 0)}%</span>
                      <span className="text-slate-400">| {dateDisplay}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAddPick(m)}
                    className="p-1 rounded bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
                    title="Add to slip"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Variance Info Modal / Footer Note */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowVarianceExplainer(!showVarianceExplainer)}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Why 3-leg accumulators mathematically outperform longer parlays</span>
          {showVarianceExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showVarianceExplainer && (
          <div className="mt-2 text-left bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed max-w-2xl mx-auto space-y-1.5">
            <p>
              In multi-match accumulators, win probabilities compound multiplicatively ($P_1 \times P_2 \times P_3$). Even when combining 75% favorites:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
              <li><strong>3-Leg Slip:</strong> 75% × 75% × 75% = <strong>~42% win rate</strong> (Safe Kelly growth zone).</li>
              <li><strong>4-Leg Slip:</strong> 75%⁴ = <strong>~31% win rate</strong>.</li>
              <li><strong>6-Leg Slip:</strong> 75%⁶ = <strong>~17% win rate</strong> (Severe decay).</li>
            </ul>
            <p>
              Our Autonomous Optimizer automatically limits slips to the positive-equity sweet spot and shields vulnerable matches with Double Chance to preserve your long-term bankroll growth.
            </p>
          </div>
        )}
      </div>

      {/* AI Super Agent Audit Modal */}
      {analysisReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto border border-indigo-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Super Agent Accumulator Audit</h3>
                  <p className="text-xs text-slate-500 font-medium">{activeLegs.length}-Fold Accumulator • Joint Prob: {safeToFixed(combinedProb, 1)}%</p>
                </div>
              </div>
              <button 
                onClick={() => setAnalysisReport(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto bg-slate-50">
              <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <Markdown>{analysisReport}</Markdown>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                Recommended Wager: <strong className="font-mono text-emerald-700">€{safeToFixed(effectiveWager, 2)}</strong>
              </div>
              <button 
                onClick={() => setAnalysisReport(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
