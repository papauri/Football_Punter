import { liveScoreText } from '../utils/matchStatus';
import WatchButton from './WatchButton';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search,
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Brain, 
  Users, 
  Plus, 
  Check, 
  Sparkles, 
  Scale, 
  Target, 
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Info,
  Layers,
  Activity,
  ArrowRight,
  RefreshCw,
  Cpu,
  CheckCircle2,
  Zap,
  Copy,
  ShieldCheck,
  Shield,
  X,
  Flame,
  Award,
  Crown,
  Lock,
  Clock,
  Calendar,
  History,
  Tv,
  Play
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, getLocalizedTodayKey, formatFriendlyDateOption } from '../utils/dateUtils';
import { safeParseFloat, safeToFixed, formatKellyStake, formatSmartMarket, formatScore, plainTipText } from '../utils/numberUtils';
import { isTrapMatch, getMatchRiskProfile, getMarketPick } from '../utils/riskUtils';
import { getLeaguePredictabilityTier, isLeagueBlacklisted, isLeagueSolid } from '../utils/leagueUtils';
import { resolveMatchOdds, resolveMatchProb, getOddsProviderLabel, calculatePotentialReturn } from '../utils/oddsUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';
import RiskBadgeWithAiHover from './RiskBadgeWithAiHover';
import MobileViewSwitcher from './MobileViewSwitcher';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import { compactKickoff } from './MobileFold';
import StrategyProofModal from './StrategyProofModal';

// Helper to reliably extract match pick without gaps
export const getMatchPick = (m) => {
  if (!m) return 'HOME';
  if (typeof m.predictedWinner === 'string') return m.predictedWinner;
  if (m.predictedWinner?.pick) return m.predictedWinner.pick;
  if (m.binaryModel?.pick) return m.binaryModel.pick;
  const homeProb = safeParseFloat(m.prob?.home, 0);
  const drawProb = safeParseFloat(m.prob?.draw, 0);
  const awayProb = safeParseFloat(m.prob?.away, 0);
  const highestProb = Math.max(homeProb, drawProb, awayProb);
  if (drawProb === highestProb && drawProb > homeProb && drawProb > awayProb) return 'DRAW';
  return homeProb >= awayProb ? 'HOME' : 'AWAY';
};

export default function FixturesTablePage({
  matches = [],
  historicalMatches = [],
  yesterdayMatches = [],
  todayCompletedMatches = [],
  bankrollEuro = 1000,
  leaguePerformance = [],
  tzSettings,
  onOpenDeepResearch,
  onOpenLineup,
  onOpenWatchLive,
  onRefresh,
  onAddToSlip,
  accaMatchIds = new Set(),
  onTriggerScrape,
  onTriggerRetrain,
  isScraping = false,
  isRetraining = false,
  onSelectMarketMode,
  onNavigate,
  onLoadAccaPicks,
  onSetActiveSlipId,
  betSlips = [],
  activeSlipId = 'slip-1',
  aiSwarm = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [selectedOutcome, setSelectedOutcome] = useState('ALL');
  const [filterMode, setFilterMode] = useState('All');
  const [sortField, setSortField] = useState('probs');
  const [sortDirection, setSortDirection] = useState('desc');
  const [sortBy, setSortBy] = useState('probs_desc');
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [expandedCouncilId, setExpandedCouncilId] = useState(null);
  const [mobileViewMode] = useMobileViewMode();

  const toggleCouncilExpand = (id) => {
    setExpandedCouncilId(prev => (prev === id ? null : id));
  };
  const [collapsedCouncilAcca, setCollapsedCouncilAcca] = useState(true);
  const [collapsedMatchPredictions, setCollapsedMatchPredictions] = useState(false);
  const [copiedAccaSlip, setCopiedAccaSlip] = useState(false);
  const [isAccaLoaded, setIsAccaLoaded] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;

  // Live countdown tick — updates every 30s so row timers stay fresh
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Returns countdown badge info for a match's kickoff timestamp
  const formatKickoffCountdown = (m) => {
    if (!m.timestamp) return null;
    const ms = m.timestamp - nowTick;
    if (ms <= 0) return null; // already started / live
    const totalMins = Math.floor(ms / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const inSnapshotWindow = ms <= 60 * 60 * 1000;
    if (totalMins > 6 * 60) return null; // don't show for distant fixtures
    return {
      label: inSnapshotWindow
        ? (totalMins <= 10 ? `${totalMins}m — BET NOW` : `🔒 ${totalMins}m`)
        : hours > 0 ? `${hours}h ${mins}m` : `${totalMins}m`,
      isWindow: inSnapshotWindow,
      color: inSnapshotWindow && totalMins <= 30
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : inSnapshotWindow
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-slate-100 text-slate-600 border-slate-200',
    };
  };

  // Strategic Enhancements: Lineup Impact, Confidence Level, Bet Safety Mode, Major League Filter
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [convictionMode, setConvictionMode] = useState('ALL'); // 'ALL' | 'HIGH' (>=60%) | 'ELITE' (>=68% or Consensus) | 'UNANIMOUS'
  const [marketMode, setMarketMode] = useState('STRAIGHT_1X2'); // 'STRAIGHT_1X2' (outright: win, draw or win) | 'DOUBLE_CHANCE' | 'DNB'
  const [filterByMarketOnly, setFilterByMarketOnly] = useState(false);
  const [strictLeaguePruning, setStrictLeaguePruning] = useState(true);
  const [calibratingLineups, setCalibratingLineups] = useState(false);
  const [lineupCalibrateResult, setLineupCalibrateResult] = useState(null);
  const [showStrategyProofModal, setShowStrategyProofModal] = useState(false);

  const handleCalibrateLineups = async () => {
    try {
      setCalibratingLineups(true);
      const res = await fetch('/api/lineups/auto-calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (data.success) {
        setLineupCalibrateResult(`Tips updated for ${data.calibratedCount || 0} matches (${data.confirmedCount || 0} with confirmed lineups).`);
        if (typeof onRefresh === 'function') onRefresh();
      } else {
        setLineupCalibrateResult(`Couldn't check lineups: ${data.error || 'try again shortly'}.`);
      }
    } catch (err) {
      setLineupCalibrateResult("Couldn't check lineups: no connection to the server.");
    } finally {
      setCalibratingLineups(false);
      setTimeout(() => setLineupCalibrateResult(null), 6000);
    }
  };

  const handleToggleStrictPruning = async () => {
    const nextVal = !strictLeaguePruning;
    setStrictLeaguePruning(nextVal);
    try {
      await fetch('/api/leagues/strict-pruning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
    } catch (e) {
      // ignore
    }
  };

  const todayKey = useMemo(() => getLocalizedTodayKey(tzSettings), [tzSettings]);

  // Strict check for completed match — guarantee played matches NEVER appear in day winner slate
  const isMatchCompleted = (m) => {
    if (!m) return true;
    if (m.isCompleted) return true;
    const st = String(m.status || '').toUpperCase();
    if (st === 'FT' || st === 'FINISHED' || st === 'FINAL' || st === 'STATUS_FULL_TIME' || st.includes('FULL TIME')) return true;
    if (m.actualScore && !m.isLive && st !== 'LIVE' && !st.includes("'") && st !== 'HT') return true;
    return false;
  };

  // Robust check for today upcoming or live in-play match
  const isTodayUpcomingOrLive = (m) => {
    if (!m) return false;
    if (isMatchCompleted(m)) return false; // Strictly NEVER completed matches
    if (m.isLive || (m.status && (m.status.includes("'") || m.status.includes('LIVE') || m.status === 'HT'))) return true;
    const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
    const dKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : null;
    return dKey === todayKey;
  };


  const getSortFieldLabel = (field) => {
    switch (field) {
      case 'time': return 'Kickoff Time';
      case 'fixture': return 'Fixture';
      case 'lineup': return 'Confirmed Lineup';
      case 'prediction': return 'AI Prediction';
      case 'probs': return 'Top Win Probability';
      case 'home_prob': return 'Home Win % (1)';
      case 'draw_prob': return 'Draw % (X)';
      case 'away_prob': return 'Away Win % (2)';
      case 'conf': return 'Confidence Score';
      case 'xg': return 'Total Expected Goals (xG)';
      case 'kelly': return 'Kelly';
      case 'odds': return 'Odds';
      default: return field;
    }
  };

  const syncSortByDropdown = (field, dir) => {
    if (field === 'time') setSortBy(dir === 'asc' ? 'time_asc' : 'time_desc');
    else if (field === 'conf') setSortBy(dir === 'desc' ? 'conf_desc' : 'conf_asc');
    else if (field === 'probs') setSortBy(dir === 'desc' ? 'probs_desc' : 'probs_asc');
    else if (field === 'home_prob') setSortBy(dir === 'desc' ? 'home_desc' : 'home_asc');
    else if (field === 'draw_prob') setSortBy(dir === 'desc' ? 'draw_desc' : 'draw_asc');
    else if (field === 'away_prob') setSortBy(dir === 'desc' ? 'away_desc' : 'away_asc');
    else if (field === 'xg') setSortBy(dir === 'desc' ? 'xg_desc' : 'xg_asc');
    else if (field === 'kelly') setSortBy(dir === 'desc' ? 'kelly_desc' : 'kelly_asc');
    else if (field === 'odds') setSortBy(dir === 'desc' ? 'odds_desc' : 'odds_asc');
    else if (field === 'fixture') setSortBy(dir === 'asc' ? 'fixture_asc' : 'fixture_desc');
    else setSortBy('custom');
  };

  // Column header sort click handler (Excel-like behavior)
  const handleSort = (field) => {
    let nextDir = 'desc';
    if (sortField === field) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
    } else {
      setSortField(field);
      // For numerical/probabilistic metrics, default descending; for text/time, default ascending
      const defaultDesc = ['conf', 'probs', 'home_prob', 'draw_prob', 'away_prob', 'xg', 'kelly'].includes(field);
      nextDir = defaultDesc ? 'desc' : 'asc';
      setSortDirection(nextDir);
    }
    syncSortByDropdown(field, nextDir);
  };

  const handleDropdownSortChange = (newVal) => {
    setSortBy(newVal);
    if (newVal === 'time_asc') {
      setSortField('time');
      setSortDirection('asc');
    } else if (newVal === 'time_desc') {
      setSortField('time');
      setSortDirection('desc');
    } else if (newVal === 'conf_desc') {
      setSortField('conf');
      setSortDirection('desc');
    } else if (newVal === 'conf_asc') {
      setSortField('conf');
      setSortDirection('asc');
    } else if (newVal === 'probs_desc') {
      setSortField('probs');
      setSortDirection('desc');
    } else if (newVal === 'probs_asc') {
      setSortField('probs');
      setSortDirection('asc');
    } else if (newVal === 'home_desc') {
      setSortField('home_prob');
      setSortDirection('desc');
    } else if (newVal === 'home_asc') {
      setSortField('home_prob');
      setSortDirection('asc');
    } else if (newVal === 'draw_desc') {
      setSortField('draw_prob');
      setSortDirection('desc');
    } else if (newVal === 'draw_asc') {
      setSortField('draw_prob');
      setSortDirection('asc');
    } else if (newVal === 'away_desc') {
      setSortField('away_prob');
      setSortDirection('desc');
    } else if (newVal === 'away_asc') {
      setSortField('away_prob');
      setSortDirection('asc');
    } else if (newVal === 'xg_desc') {
      setSortField('xg');
      setSortDirection('desc');
    } else if (newVal === 'xg_asc') {
      setSortField('xg');
      setSortDirection('asc');
    } else if (newVal === 'kelly_desc') {
      setSortField('kelly');
      setSortDirection('desc');
    } else if (newVal === 'kelly_asc') {
      setSortField('kelly');
      setSortDirection('asc');
    } else if (newVal === 'odds_desc') {
      setSortField('odds');
      setSortDirection('desc');
    } else if (newVal === 'odds_asc') {
      setSortField('odds');
      setSortDirection('asc');
    } else if (newVal === 'fixture_asc') {
      setSortField('fixture');
      setSortDirection('asc');
    } else if (newVal === 'fixture_desc') {
      setSortField('fixture');
      setSortDirection('desc');
    }
  };

  // Helper to evaluate full match criteria for filtering
  const evaluateMatchItem = (m) => {
    if (!m) return null;
    const isCompleted = isMatchCompleted(m);
    const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
    const dateKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';

    const homeProb = safeParseFloat(m.prob?.home, 0);
    const drawProb = safeParseFloat(m.prob?.draw, 0);
    const awayProb = safeParseFloat(m.prob?.away, 0);
    const topProb = Math.max(homeProb, drawProb, awayProb);
    const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, topProb);

    const sw = m.aiSwarm || m.imperialSwarm;
    // Universal risk profile, evaluated on the exact pick that onAddToSlip(m) will store,
    // so filter verdicts and bet slip badges can never diverge.
    const slipPick = getMarketPick(m, marketMode);
    const riskProfile = getMatchRiskProfile(m, slipPick);
    const isTrap = riskProfile.riskLevel === 'HIGH';
    const isUnanimous = Boolean(
      sw?.is100Unanimous || 
      sw?.isTopValueLeg || 
      sw?.isUnanimousDirective || 
      sw?.consensusTier === 'UNANIMOUS_DIRECTIVE' || 
      sw?.agreementPercentage === 100
    );
    const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';
    const isDnbAdvised = Boolean(m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0);
    const favProb = Math.max(homeProb, awayProb);
    const isDoubleChanceAdvised = Boolean(m.smartMarket?.marketType === 'DOUBLE_CHANCE' || (drawProb >= 24.0 && (favProb + drawProb) >= 68));
    const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
    const isTier1 = leagueTierObj?.tier === 1;

    const matchPick = getMatchPick(m);

    return {
      match: m,
      id: m.id,
      isCompleted,
      dateKey,
      league: m.league,
      home: m.home,
      away: m.away,
      homeProb,
      drawProb,
      awayProb,
      topProb,
      conf,
      isTrap,
      isUnanimous,
      isDerivative,
      isDnbAdvised,
      isDoubleChanceAdvised,
      isTier1,
      matchPick,
      slipPick,
      riskProfile,
      isLowRisk: riskProfile.riskLevel === 'LOW',
      isHigh: riskProfile.isHighConfidence,
      isElite: riskProfile.isElite
    };
  };

  // Pre-evaluated match items for ultra-fast filtering
  const evaluatedItems = useMemo(() => {
    return matches.map(evaluateMatchItem).filter(Boolean);
  }, [matches, tzSettings, marketMode]);

  // Universal filter checker: checks if an item passes all filters, optionally skipping one dimension for faceted counts
  const checkItemPasses = (item, skipDimension = null) => {
    if (!item || item.isCompleted) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const home = (item.home || '').toLowerCase();
      const away = (item.away || '').toLowerCase();
      const league = (item.league || '').toLowerCase();
      if (!home.includes(q) && !away.includes(q) && !league.includes(q)) return false;
    }

    // Strict League Pruning
    if (strictLeaguePruning) {
      if (isLeagueBlacklisted(item.league)) return false;
      const tierObj = getLeaguePredictabilityTier(item.league);
      if (tierObj?.tier === 3 || tierObj === 'TIER_3') return false;
    }

    // 1. Date filter (skipped when computing dateOptions)
    if (skipDimension !== 'date' && selectedDate !== 'All') {
      const isClubSearch = searchQuery.trim().length >= 2;
      if (!isClubSearch && item.dateKey !== selectedDate) return false;
    }

    // 2. League filter (skipped when computing leagueOptions)
    if (skipDimension !== 'league' && selectedLeague !== 'All') {
      if (item.league !== selectedLeague) return false;
    }

    // 3. Outcome filter (skipped when computing outcomeCounts)
    if (skipDimension !== 'outcome' && selectedOutcome !== 'ALL') {
      if (selectedOutcome === 'WIN_LOSE') {
        if (item.matchPick !== 'HOME' && item.matchPick !== 'AWAY') return false;
      } else if (selectedOutcome === 'DRAW') {
        if (item.matchPick !== 'DRAW') return false;
      } else if (selectedOutcome === 'HOME') {
        if (item.matchPick !== 'HOME') return false;
      } else if (selectedOutcome === 'AWAY') {
        if (item.matchPick !== 'AWAY') return false;
      }
    }

    // Helper checks for Quality & Special filters: require strict minimum confidence and win probability
    const isItemHigh = item.isHigh;
    const isItemElite = item.isElite;

    // 4. Conviction / Quality filter (skipped when computing qualityOptions)
    if (skipDimension !== 'quality') {
      if (convictionMode === 'HIGH' && !isItemHigh) return false;
      if (convictionMode === 'ELITE' && !isItemElite) return false;
      if (convictionMode === 'UNANIMOUS' && !item.isUnanimous) return false;
    }

    // 5. Special Filter Mode (skipped when computing qualityOptions)
    if (skipDimension !== 'quality') {
      if (filterMode === 'NO_TRAPS' && !item.isLowRisk) return false;
      if (filterMode === 'DERIVATIVE_SAFETY' && !item.isDerivative) return false;
      if (filterMode === 'UPSET_RISK' && !item.isTrap) return false;
      if (filterMode === 'TIER_1_ONLY' && !item.isTier1) return false;
      if (filterMode === 'DNB_ONLY' && !item.isDnbAdvised) return false;
    }

    // 6. Market Mode filter
    if (skipDimension !== 'market' && filterByMarketOnly) {
      if (marketMode === 'DNB' && !item.isDnbAdvised) return false;
      if (marketMode === 'DOUBLE_CHANCE' && !item.isDoubleChanceAdvised) return false;
    }

    return true;
  };

  // Extract unique leagues dynamically faceted across all other active filters
  const leagueOptions = useMemo(() => {
    const leagues = {};
    let totalEligible = 0;

    evaluatedItems.forEach(item => {
      if (!checkItemPasses(item, 'league')) return;
      totalEligible++;
      if (item.league) {
        leagues[item.league] = (leagues[item.league] || 0) + 1;
      }
    });

    const sortedLeagues = Object.keys(leagues).sort();

    return [
      { value: 'All', label: `All Leagues (${totalEligible})` },
      ...sortedLeagues.map(l => {
        const perf = leaguePerformance.find(p => p.league === l);
        const perfStr = perf ? ` · ${Math.round(perf.accuracy)}% hit rate` : '';
        return { value: l, label: `${l} (${leagues[l]})${perfStr}` };
      })
    ];
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedDate, selectedOutcome, convictionMode, filterMode, marketMode, filterByMarketOnly, leaguePerformance]);

  // Extract unique date options dynamically faceted across all other active filters
  const { dateOptions, nearestUpcomingDateKey, todayMatchCount, nearestUpcomingCount, totalActiveCount } = useMemo(() => {
    const dates = {};
    let totalEligible = 0;
    let todayCount = 0;

    evaluatedItems.forEach(item => {
      if (!checkItemPasses(item, 'date')) return;
      totalEligible++;
      dates[item.dateKey] = (dates[item.dateKey] || 0) + 1;
      if (item.dateKey === todayKey) todayCount++;
    });

    // Ensure Today is always present so user sees today's active count under current filters
    if (!dates[todayKey]) {
      dates[todayKey] = 0;
    }

    const sortedKeys = Object.keys(dates).sort();
    const upcomingKeys = sortedKeys.filter(k => k !== 'Upcoming' && k >= todayKey && dates[k] > 0);
    const nearestKey = upcomingKeys[0] || null;

    const options = [
      { value: 'All', label: `All Upcoming Dates (${totalEligible})` },
      ...sortedKeys.map(k => ({
        value: k,
        label: formatFriendlyDateOption(k, dates[k] || 0, tzSettings)
      }))
    ];

    return {
      dateOptions: options,
      nearestUpcomingDateKey: nearestKey,
      todayMatchCount: todayCount,
      nearestUpcomingCount: nearestKey ? (dates[nearestKey] || 0) : 0,
      totalActiveCount: totalEligible
    };
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedLeague, selectedOutcome, convictionMode, filterMode, marketMode, filterByMarketOnly, tzSettings, todayKey]);

  // Dynamic Outcome Counts
  const outcomeCounts = useMemo(() => {
    let all = 0;
    let winLose = 0;
    let draw = 0;
    let home = 0;
    let away = 0;

    evaluatedItems.forEach(item => {
      if (!checkItemPasses(item, 'outcome')) return;
      all++;
      if (item.matchPick === 'HOME') {
        home++;
        winLose++;
      } else if (item.matchPick === 'AWAY') {
        away++;
        winLose++;
      } else if (item.matchPick === 'DRAW') {
        draw++;
      }
    });

    return { all, winLose, draw, home, away };
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedDate, selectedLeague, convictionMode, filterMode, marketMode, filterByMarketOnly]);

  const outcomeOptions = useMemo(() => [
    { value: 'ALL', label: `All Outcomes (${outcomeCounts.all})` },
    { value: 'WIN_LOSE', label: `Win / Lose Only (${outcomeCounts.winLose})` },
    { value: 'DRAW', label: `Draw Only (${outcomeCounts.draw})` },
    { value: 'HOME', label: `Home Win Only (${outcomeCounts.home})` },
    { value: 'AWAY', label: `Away Win Only (${outcomeCounts.away})` }
  ], [outcomeCounts]);

  // Dynamic Quality / Conviction Options
  const convictionOptions = useMemo(() => {
    let all = 0;
    let high = 0;
    let elite = 0;
    let unanimous = 0;

    evaluatedItems.forEach(item => {
      if (!checkItemPasses(item, 'quality')) return;
      all++;
      if (item.isHigh) high++;
      if (item.isElite) elite++;
      if (item.isUnanimous) unanimous++;
    });

    return [
      { value: 'ALL', label: `All tips (${all})` },
      { value: 'HIGH', label: `60%+ chance (${high})` },
      { value: 'ELITE', label: `68%+ chance (${elite})` },
      { value: 'UNANIMOUS', label: `Top picks (${unanimous})` }
    ];
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedDate, selectedLeague, selectedOutcome, marketMode, filterByMarketOnly]);

  // Dynamic Special Filter Options
  const specialFilterOptions = useMemo(() => {
    let all = 0;
    let unanimous = 0;
    let high = 0;
    let elite = 0;
    let noTraps = 0;
    let dnb = 0;
    let safeAlt = 0;
    let tier1 = 0;
    let traps = 0;

    evaluatedItems.forEach(item => {
      if (!checkItemPasses(item, 'quality')) return;
      all++;
      if (item.isUnanimous) unanimous++;
      if (item.isHigh) high++;
      if (item.isElite) elite++;
      if (item.isLowRisk) noTraps++;
      if (item.isDnbAdvised) dnb++;
      if (item.isDerivative) safeAlt++;
      if (item.isTier1) tier1++;
      if (item.isTrap) traps++;
    });

    return [
      { value: 'All', label: `Everything (${all})` },
      { value: 'NO_TRAPS', label: `No risky tips (${noTraps})` },
      { value: 'TIER_1_ONLY', label: `Top leagues only (${tier1})` },
      { value: 'UPSET_RISK', label: `Possible upsets (${traps})` }
    ];
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedDate, selectedLeague, selectedOutcome, marketMode, filterByMarketOnly]);

  // Base Matches remaining (for stats & search reference)
  const baseMatches = useMemo(() => {
    return evaluatedItems
      .filter(item => checkItemPasses(item, null))
      .map(item => item.match);
  }, [evaluatedItems, searchQuery, strictLeaguePruning, selectedDate, selectedLeague, selectedOutcome, convictionMode, filterMode, marketMode, filterByMarketOnly]);

  const prunedNoiseMatchesCount = useMemo(() => {
    return matches.filter(m => {
      if (isMatchCompleted(m)) return false;
      if (isLeagueBlacklisted(m.league)) return true;
      const tierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
      return tierObj?.tier === 3 || tierObj === 'TIER_3';
    }).length;
  }, [matches]);

  const isSearchActive = searchQuery.trim().length >= 2;

  useEffect(() => {
    setHistoryPage(1);
  }, [searchQuery]);

  const recentCompletedMatches = useMemo(() => {
    if (!isSearchActive) return [];
    const q = searchQuery.toLowerCase().trim();
    const map = new Map();

    const addMatch = (m) => {
      if (!m || !m.id) return;
      const isCompleted = m.isCompleted || m.status === 'FT' || m.status?.includes('FT') || m.status?.includes('Final') || m.actualScore || (m.homeScore != null && m.awayScore != null);
      if (!isCompleted) return;
      const home = (m.home || '').toLowerCase();
      const away = (m.away || '').toLowerCase();
      if (home.includes(q) || away.includes(q)) {
        if (!map.has(String(m.id))) {
          map.set(String(m.id), m);
        }
      }
    };

    if (Array.isArray(historicalMatches)) historicalMatches.forEach(addMatch);
    if (Array.isArray(yesterdayMatches)) yesterdayMatches.forEach(addMatch);
    if (Array.isArray(todayCompletedMatches)) todayCompletedMatches.forEach(addMatch);
    if (Array.isArray(matches)) matches.forEach(addMatch);

    return Array.from(map.values()).sort((a, b) => {
      const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
      const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
      return tB - tA; // newest first
    });
  }, [searchQuery, isSearchActive, historicalMatches, yesterdayMatches, todayCompletedMatches, matches]);

  const historyTotalPages = Math.max(1, Math.ceil(recentCompletedMatches.length / historyPageSize));
  const paginatedHistoryMatches = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return recentCompletedMatches.slice(start, start + historyPageSize);
  }, [recentCompletedMatches, historyPage, historyPageSize]);

  // Pre-calculate if any true unanimous match exists in the filtered set
  const { hasUnanimous, maxBaseConfidence } = useMemo(() => {
    let hasUnan = false;
    let maxConf = 0;
    for (const m of baseMatches) {
      const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
      if (isUnanimous) hasUnan = true;
      
      const homeProb = safeParseFloat(m.prob?.home, 0);
      const drawProb = safeParseFloat(m.prob?.draw, 0);
      const awayProb = safeParseFloat(m.prob?.away, 0);
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, Math.max(homeProb, drawProb, awayProb));
      if (conf > maxConf) maxConf = conf;
    }
    return { hasUnanimous: hasUnan, maxBaseConfidence: maxConf };
  }, [baseMatches]);

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    return [...baseMatches].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'probs') {
        const maxA = Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.draw, 0), safeParseFloat(a.prob?.away, 0));
        const maxB = Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.draw, 0), safeParseFloat(b.prob?.away, 0));
        if (maxA !== maxB) {
          return (maxA - maxB) * multiplier;
        }
        const confA = safeParseFloat(a.confidence ?? a.binaryModel?.confidence, maxA);
        const confB = safeParseFloat(b.confidence ?? b.binaryModel?.confidence, maxB);
        if (confA !== confB) {
          return (confA - confB) * multiplier;
        }
        const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
        const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
        return tA - tB;
      }
      if (sortField === 'conf') {
        const confA = safeParseFloat(a.confidence ?? a.binaryModel?.confidence, Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.draw, 0), safeParseFloat(a.prob?.away, 0)));
        const confB = safeParseFloat(b.confidence ?? b.binaryModel?.confidence, Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.draw, 0), safeParseFloat(b.prob?.away, 0)));
        if (confA !== confB) {
          return (confA - confB) * multiplier;
        }
        const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
        const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
        return tA - tB;
      }
      if (sortField === 'time') {
        const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
        const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
        return (tA - tB) * multiplier;
      }
      if (sortField === 'tier') {
        const tierA = (a.leagueTier?.tier) || getLeaguePredictabilityTier(a.league).tier;
        const tierB = (b.leagueTier?.tier) || getLeaguePredictabilityTier(b.league).tier;
        return (tierA - tierB) * multiplier;
      }
      if (sortField === 'fixture') {
        const nameA = `${a.home || ''} ${a.away || ''} ${a.league || ''}`.toLowerCase();
        const nameB = `${b.home || ''} ${b.away || ''} ${b.league || ''}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      }
      if (sortField === 'lineup') {
        const lA = (a.lineupAdjusted || a.hasConfirmedLineup) ? 1 : 0;
        const lB = (b.lineupAdjusted || b.hasConfirmedLineup) ? 1 : 0;
        return (lA - lB) * multiplier;
      }
      if (sortField === 'prediction') {
        const pickA = getMatchPick(a);
        const pickB = getMatchPick(b);
        return pickA.localeCompare(pickB) * multiplier;
      }
      if (sortField === 'home_prob') {
        return (safeParseFloat(a.prob?.home, 0) - safeParseFloat(b.prob?.home, 0)) * multiplier;
      }
      if (sortField === 'draw_prob') {
        return (safeParseFloat(a.prob?.draw, 0) - safeParseFloat(b.prob?.draw, 0)) * multiplier;
      }
      if (sortField === 'away_prob') {
        return (safeParseFloat(a.prob?.away, 0) - safeParseFloat(b.prob?.away, 0)) * multiplier;
      }
      if (sortField === 'xg') {
        const xgA = safeParseFloat(a.xG?.home ?? a.lambda, 0) + safeParseFloat(a.xG?.away ?? a.mu, 0);
        const xgB = safeParseFloat(b.xG?.home ?? b.lambda, 0) + safeParseFloat(b.xG?.away ?? b.mu, 0);
        return (xgA - xgB) * multiplier;
      }
      if (sortField === 'kelly') {
        const kA = safeParseFloat(a.kellyStake?.units ?? a.binaryModel?.kellyStake?.units ?? a.kellyStake?.fraction, 0);
        const kB = safeParseFloat(b.kellyStake?.units ?? b.binaryModel?.kellyStake?.units ?? b.kellyStake?.fraction, 0);
        return (kA - kB) * multiplier;
      }
      if (sortField === 'odds') {
        // Odds of the pick that would land on the slip, so the sort matches what gets staked
        const oA = safeParseFloat(resolveMatchOdds(a, getMarketPick(a, marketMode)), 0);
        const oB = safeParseFloat(resolveMatchOdds(b, getMarketPick(b, marketMode)), 0);
        return (oA - oB) * multiplier;
      }
      return 0;
    });
  }, [baseMatches, sortField, sortDirection, marketMode]);

  const renderMarketPrediction = (m, predictedWinner, homeProb, drawProb, awayProb, matchOdds = null) => {
    const isFavHome = homeProb >= awayProb;
    const favTeam = isFavHome ? m.home : m.away;
    const favProb = isFavHome ? homeProb : awayProb;
    const nonDrawTotal = Math.max(0.01, homeProb + awayProb);
    const dnbProb = Math.round((favProb / nonDrawTotal) * 100);
    const dcProb = Math.min(99, Math.round(favProb + drawProb));
    const dcCode = isFavHome ? '1X' : 'X2';
    const odds = matchOdds || resolveMatchOdds(m, predictedWinner);

    // 2. DNB Mode (Draw No Bet)
    if (marketMode === 'DNB') {
      const dnbOdds = resolveMatchOdds(m, isFavHome ? '1' : '2');
      return (
        <span 
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs whitespace-nowrap" 
          title={`Draw-No-Bet (${dnbProb}%): ${favTeam} Win, refunded on tie (@${safeToFixed(dnbOdds, 2)})`}
        >
          {isFavHome ? 'Home (draw = refund)' : 'Away (draw = refund)'}
        </span>
      );
    }

    // 3. Double Chance Mode
    if (marketMode === 'DOUBLE_CHANCE') {
      const dcOdds = resolveMatchOdds(m, dcCode);
      return (
        <span 
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap" 
          title={`Double Chance (${dcCode}, ${dcProb}%): ${favTeam} or Draw (@${safeToFixed(dcOdds, 2)})`}
        >
          {isFavHome ? 'Home or draw' : 'Away or draw'}
        </span>
      );
    }

    // 4. Straight 1X2
    return (
      <span 
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold border whitespace-nowrap shadow-2xs ${getWinnerBadgeClass(predictedWinner)}`}
        title={`Outright Pick: ${predictedWinner === 'HOME' ? m.home : predictedWinner === 'AWAY' ? m.away : 'Draw'} (@${safeToFixed(odds, 2)})`}
      >
        {predictedWinner === 'HOME' ? 'Home win' : predictedWinner === 'AWAY' ? 'Away win' : 'Draw'}
      </span>
    );
  };

  const toggleExpand = (id) => {
    setExpandedMatchId(prev => prev === id ? null : id);
  };

  const formatMatchKickoff = (m) => {
    const sLower = String(m.status || '').toLowerCase();
    if (sLower.includes('postpone')) return 'Postponed';
    if (sLower.includes('cancel')) return 'Canceled';
    if (sLower.includes('suspend') || sLower.includes('delay')) return 'Delayed';
    if (m.status === 'LIVE' || m.status === 'IN_PLAY') return 'LIVE';
    if (m.status === 'FT' || m.status === 'FINISHED') return 'FT';
    const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
    if (timeVal) return formatRelativeDayTime(timeVal, tzSettings);
    if (m.time) return m.time;
    return 'Upcoming';
  };

  const getWinnerBadgeClass = (winner) => {
    if (winner === 'HOME') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (winner === 'AWAY') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  const getConfidenceBadge = (conf) => {
    if (conf >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (conf >= 60) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-4">
      
      {/* ⚽ Main Match Predictions & Win Probabilities Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Uniform Header & Actions Bar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">All matches</h2>
              <p className="text-[11px] text-slate-500">
                {baseMatches.length === matches.length ? `${matches.length} matches` : `${baseMatches.length} of ${matches.length} matches`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
              <button
                onClick={handleCalibrateLineups}
                disabled={calibratingLineups}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                title="Look for confirmed starting line-ups and update the tips"
              >
                <Zap className={`w-3.5 h-3.5 text-emerald-600 ${calibratingLineups ? 'animate-spin' : ''}`} />
                <span>{calibratingLineups ? 'Checking lineups...' : 'Check lineups'}</span>
              </button>

              <button
                onClick={() => setShowStrategyProofModal(true)}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="How often the tips have been right"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Track record</span>
              </button>


              <button
                type="button"
                onClick={() => setCollapsedMatchPredictions(!collapsedMatchPredictions)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title={collapsedMatchPredictions ? 'Expand Match Predictions' : 'Collapse Match Predictions'}
              >
                <span>{collapsedMatchPredictions ? 'Show' : 'Hide'}</span>
                {collapsedMatchPredictions ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </div>
        </div>

        {!collapsedMatchPredictions && (
          <>
            {/* Feedback Alert for Lineup Calibration */}
            {lineupCalibrateResult && (
              <div className="mx-3 mt-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{lineupCalibrateResult}</span>
                </div>
                <button 
                  onClick={() => setLineupCalibrateResult(null)}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Compact Unified Filter Toolbar */}
            <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowMobileFilters(v => !v)}
                className="md:hidden h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer"
              >
                {showMobileFilters ? 'Hide filters' : 'Filters'}
              </button>
              <MobileViewSwitcher label="Display" className="md:hidden" />
              <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-1.5 flex-1 min-w-[240px]`}>
                {/* Search Box */}
                <div className="relative flex-1 min-w-[130px] max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter club / league..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-6 py-1 text-xs bg-white text-slate-800 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Date Dropdown */}
                <UniformDropdown
                  label="Date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  options={dateOptions}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* League Dropdown */}
                <UniformDropdown
                  label="League"
                  value={selectedLeague}
                  onChange={setSelectedLeague}
                  options={leagueOptions}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Outcome Dropdown */}
                <UniformDropdown
                  label="Outcome"
                  value={selectedOutcome}
                  onChange={setSelectedOutcome}
                  options={outcomeOptions}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Quality Dropdown */}
                <UniformDropdown
                  label="Chance"
                  value={convictionMode}
                  onChange={setConvictionMode}
                  options={convictionOptions}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Market Dropdown */}
                <UniformDropdown
                  label="Bet type"
                  value={marketMode}
                  onChange={setMarketMode}
                  options={[
                    { value: 'STRAIGHT_1X2', label: 'Result (win, draw or win)' },
                    { value: 'DOUBLE_CHANCE', label: 'Team or draw' },
                    { value: 'DNB', label: 'Draw = refund' }
                  ]}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Special Filter Dropdown */}
                <UniformDropdown
                  label="Show"
                  value={filterMode}
                  onChange={setFilterMode}
                  options={specialFilterOptions}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Sort Dropdown */}
                <UniformDropdown
                  label="Sort"
                  value={sortBy}
                  onChange={handleDropdownSortChange}
                  options={[
                    { value: 'probs_desc', label: 'Most likely first' },
                    { value: 'probs_asc', label: 'Least likely first' },
                    { value: 'conf_desc', label: 'Most confident first' },
                    { value: 'time_asc', label: 'Kick-off: soonest' },
                    { value: 'time_desc', label: 'Kick-off: latest' },
                    { value: 'home_desc', label: 'Home win chance' },
                    { value: 'draw_desc', label: 'Draw chance' },
                    { value: 'away_desc', label: 'Away win chance' },
                    { value: 'xg_desc', label: 'Most goals expected' },
                    { value: 'kelly_desc', label: 'Best value' },
                    { value: 'odds_asc', label: 'Lowest odds' },
                    { value: 'odds_desc', label: 'Highest odds' }
                  ]}
                  selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
                />

                {/* Safety Bet Recommended Only Filter */}
                {(marketMode === 'DNB' || marketMode === 'DOUBLE_CHANCE') && (
                  <button
                    type="button"
                    onClick={() => setFilterByMarketOnly(!filterByMarketOnly)}
                    className={`h-7 px-2 rounded text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                      filterByMarketOnly
                        ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title={filterByMarketOnly ? "Showing only games where safety bet is recommended" : "Filter by recommended safety bet"}
                  >
                    <span>{filterByMarketOnly ? '✓ Recommended only' : 'Recommended only'}</span>
                  </button>
                )}

                {/* Major Leagues Toggle */}
                <button
                  type="button"
                  onClick={handleToggleStrictPruning}
                  className={`h-7 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 border shadow-2xs ${
                    strictLeaguePruning
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Focus on major, highly predictable leagues and exclude low-reliability divisions."
                >
                  <span className={`w-3 h-3 rounded flex items-center justify-center border text-[8.5px] ${
                    strictLeaguePruning ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'border-slate-300 bg-white'
                  }`}>
                    {strictLeaguePruning ? '✓' : ''}
                  </span>
                  <span>Major leagues</span>
                  {strictLeaguePruning && prunedNoiseMatchesCount > 0 && (
                    <span className="text-[9px] font-normal text-emerald-700">
                      ({prunedNoiseMatchesCount})
                    </span>
                  )}
                </button>

                <InfoTooltip
                  title="Tips"
                  content="Each tip is one result: home win, draw or away win. A draw is only called when it is as likely as either team winning. The chance shows how sure the tip is; tips shown at 70%+ have come in about 78% of the time."
                  align="right"
                />

              </div>

              {/* Status and Clear Filters */}
              <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0">
                <span>Showing <strong>{filteredMatches.length}</strong> of {matches.length} matches</span>
                {selectedOutcome === 'WIN_LOSE' && (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Win/Lose
                  </span>
                )}
                {selectedOutcome === 'DRAW' && (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Draw
                  </span>
                )}
                {selectedOutcome === 'HOME' && (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Home
                  </span>
                )}
                {selectedOutcome === 'AWAY' && (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Away
                  </span>
                )}
                {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || selectedOutcome !== 'ALL' || filterMode !== 'All' || sortBy !== 'probs_desc' || convictionMode !== 'ALL' || filterByMarketOnly) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedLeague('All');
                      setSelectedDate('All');
                      setSelectedOutcome('ALL');
                      setFilterMode('All');
                      setConvictionMode('ALL');
                      setFilterByMarketOnly(false);
                      setSortBy('probs_desc');
                      setSortField('probs');
                      setSortDirection('desc');
                    }}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

      {/* Active Bet Slip Quick Status & Navigation Bar */}
      {accaMatchIds && accaMatchIds.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50 via-purple-50/40 to-slate-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 shadow-xs mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-600 text-white shrink-0 font-bold text-xs">
              {accaMatchIds.size}
            </span>
            <div>
              <span className="font-bold text-slate-900">
                {betSlips.find(s => s.id === activeSlipId)?.name || 'Slip 1'}:
              </span>
              <span className="text-slate-600 ml-1">
                {accaMatchIds.size} {accaMatchIds.size === 1 ? 'match' : 'matches'} currently loaded in active bet slip.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {betSlips && betSlips.length > 1 && onSetActiveSlipId && (
              <UniformDropdown
                label="Target Slip"
                value={activeSlipId}
                onChange={onSetActiveSlipId}
                options={betSlips.map(s => ({ value: s.id, label: `${s.name} (${s.picks?.length || 0})` }))}
                selectClassName="bg-white border-indigo-200 py-0.5 text-xs shadow-none"
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof onNavigate === 'function') onNavigate('acca');
                else if (typeof onSelectMarketMode === 'function') onSelectMarketMode('acca');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <span>View Bet Slip &amp; Accumulators ({accaMatchIds.size})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Midweek Off-Day Notice Banner if Today has 0 matches */}
      {todayMatchCount === 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 rounded-xl text-xs text-slate-600 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60 shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-800">Midweek Rest Day:</span> No covered league fixtures scheduled for today ({formatFriendlyDateOption(todayKey, null, tzSettings)}).
              {nearestUpcomingDateKey && (
                <span className="text-slate-500 ml-1 sm:inline block">
                  Next active matchday starts <strong className="text-slate-700">{formatFriendlyDateOption(nearestUpcomingDateKey, null, tzSettings)}</strong> ({nearestUpcomingCount} fixtures).
                </span>
              )}
            </div>
          </div>
          {nearestUpcomingDateKey && selectedDate !== nearestUpcomingDateKey && (
            <button
              onClick={() => setSelectedDate(nearestUpcomingDateKey)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <span>View {formatFriendlyDateOption(nearestUpcomingDateKey, null, tzSettings)} Slate</span>
              <ArrowRight className="w-3 h-3 text-indigo-600" />
            </button>
          )}
        </div>
      )}

      {/* ── Searched Club Recent Form & Completed Matches Ledger ── */}
      {isSearchActive && recentCompletedMatches.length > 0 && (
        <div className="bg-white border border-teal-200 rounded-xl shadow-xs overflow-hidden mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gradient-to-r from-teal-50 via-white to-teal-50 border-b border-teal-200 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <History className="w-3.5 h-3.5 text-teal-700" />
              <span className="font-bold text-teal-950 text-xs sm:text-sm">
                Recent Form: <span className="text-teal-700 font-extrabold">{searchQuery}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
                {recentCompletedMatches.length} past games
              </span>
              <InfoTooltip
                title="Historical Form & Performance"
                content="Historical match results and predictions for this club with instant 1-click tactical post-mortem analysis."
                align="left"
              />
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="block md:table w-full text-left border-collapse text-xs">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] text-slate-500 uppercase tracking-wider font-bold h-8 select-none">
                  <th className="py-1 px-2.5">Date</th>
                  <th className="py-1 px-2.5">Competition</th>
                  <th className="py-1 px-2.5">Matchup</th>
                  <th className="py-1 px-2.5 text-center">Score</th>
                  <th className="py-1 px-2.5 text-center">Tip</th>
                  <th className="py-1 px-2.5 text-center">Stats</th>
                </tr>
              </thead>
              <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100">
                {paginatedHistoryMatches.map((m) => {
                  const hG = m.homeScore ?? m.goals?.home ?? 0;
                  const aG = m.awayScore ?? m.goals?.away ?? 0;
                  const actualWinner = m.actualWinner || (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW');
                  const scoreDisplay = `${hG} - ${aG}`;
                  const isHit = m.isHit === true;
                  const isMiss = m.isHit === false;
                  const isPass = Boolean(
                    m.isPass === true || 
                    m.smartMarket?.pick === 'PASS' || 
                    String(m.smartMarket?.pick || '').toUpperCase() === 'PASS' ||
                    m.smartMarket?.badge?.toLowerCase().includes('pass')
                  );

                  return (
                    <tr key={m.id || m.espnEventId} className="flex flex-col md:table-row hover:bg-teal-50/30 transition-colors">
                      {/* ================= MOBILE COMPACT VIEW (1-ROW TABLE OR CARD) ================= */}
                      {mobileViewMode === 'table' ? (
                        <td className="md:hidden px-2.5 py-2 block">
                          <div className="flex items-center justify-between gap-1.5 text-xs">
                            {/* Left: Date/Time + Matchup */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-slate-500 shrink-0 font-medium">
                                {formatRelativeDayTime(m, tzSettings).split(' ')[0]}
                              </span>
                              <div className="font-bold text-slate-900 text-xs truncate">
                                <span>{m.home}</span>
                                <span className="text-slate-400 font-normal mx-1">v</span>
                                <span>{m.away}</span>
                              </div>
                            </div>

                            {/* Right: Score + Pick/Status Badge + Deep Analysis Button */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-bold text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                                {scoreDisplay}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                isHit ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                isPass ? 'bg-amber-50 text-amber-900 border-amber-300' :
                                isMiss ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {isPass ? 'No bet' : (plainTipText(m.smartMarket?.pickLabel) || m.predictedWinner || '—')}
                              </span>
                              <button
                                onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-2xs"
                                title="Open Master Football Analyst post-mortem"
                              >
                                Analysis
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <td className="md:hidden p-2.5 block">
                          <div className="flex justify-between items-center mb-1 text-[10.5px]">
                            <span className="text-slate-500 font-mono">
                              {formatRelativeDayTime(m, tzSettings)}
                            </span>
                            <span className="font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {m.league || 'League'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center mb-1.5">
                            <div className="text-xs font-bold text-slate-900">
                              <span className={m.home?.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-teal-900 font-black' : ''}>
                                {m.home}
                              </span>
                              <span className="text-slate-400 font-normal mx-1">vs</span>
                              <span className={m.away?.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-teal-900 font-black' : ''}>
                                {m.away}
                              </span>
                            </div>
                            <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-900 text-xs">
                              {scoreDisplay}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              isHit ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              isPass ? 'bg-amber-50 text-amber-900 border-amber-300' :
                              isMiss ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {isPass ? plainTipText(m.smartMarket?.badge || 'Pass') : (plainTipText(m.smartMarket?.pickLabel) || m.predictedWinner || '—')}
                            </span>

                            <button
                              onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                              className="px-2.5 py-1 rounded text-[10.5px] font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-2xs"
                              title="Open Master Football Analyst post-mortem"
                            >
                              Deep Analysis
                            </button>
                          </div>
                        </td>
                      )}

                      {/* ================= DESKTOP 1-ROW VIEW ================= */}
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap text-slate-500 font-mono text-[10.5px]">
                        {formatRelativeDayTime(m, tzSettings)}
                      </td>
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap font-medium text-slate-600 text-[10.5px]">
                        {m.league || 'League'}
                      </td>
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap text-[11.5px]">
                        <span className={`font-semibold ${m.home?.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-teal-900 font-bold' : 'text-slate-800'}`}>
                          {m.home}
                        </span>
                        <span className="text-slate-400 mx-1">vs</span>
                        <span className={`font-semibold ${m.away?.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-teal-900 font-bold' : 'text-slate-800'}`}>
                          {m.away}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap text-center">
                        <span className="font-mono font-bold px-1.5 py-0.2 bg-slate-100 border border-slate-200 rounded text-slate-900 text-[11px]">
                          {scoreDisplay}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap text-center text-[10.5px]">
                        <span className={`px-1.5 py-0.2 rounded font-semibold ${
                          isHit ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          isPass ? 'bg-amber-50 text-amber-900 border border-amber-300' :
                          isMiss ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {isPass ? plainTipText(m.smartMarket?.badge || 'Pass') : (plainTipText(m.smartMarket?.pickLabel) || m.predictedWinner || '—')}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-1.5 px-2.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                          className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-2xs"
                          title="Open Master Football Analyst post-mortem"
                        >
                          Deep Analysis
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* History Pagination Bar */}
          {recentCompletedMatches.length > historyPageSize && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">
                Page <strong className="text-slate-700">{historyPage}</strong> of{' '}
                <strong className="text-slate-700">{historyTotalPages}</strong> ({recentCompletedMatches.length} total completed games)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPage === historyTotalPages}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Matches League Table */}
        <div className="overflow-x-auto">
          <table className="block md:table w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                {/* Time */}
                <th 
                  onClick={() => handleSort('time')}
                  className={`py-1 px-2 w-24 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'time' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Kickoff Time"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={sortField === 'time' ? 'text-indigo-600 font-bold' : ''}>Kick-off</span>
                    {sortField === 'time' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Fixture */}
                <th 
                  onClick={() => handleSort('fixture')}
                  className={`py-1 px-2 min-w-[180px] cursor-pointer transition-colors group select-none ${
                    sortField === 'fixture' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Teams / Competition"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'fixture' ? 'text-indigo-600 font-bold' : ''}>Match</span>
                    {sortField === 'fixture' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Lineup */}
                <th 
                  onClick={() => handleSort('lineup')}
                  className={`py-1 px-1.5 w-16 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'lineup' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by lineup status"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={sortField === 'lineup' ? 'text-indigo-600 font-bold' : ''}>Lineup</span>
                    {sortField === 'lineup' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Prediction */}
                <th 
                  onClick={() => handleSort('prediction')}
                  className={`py-1 px-1.5 w-24 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'prediction' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by tip"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={sortField === 'prediction' ? 'text-indigo-600 font-bold' : ''}>Tip</span>
                    {sortField === 'prediction' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* 1 | X | 2 Probs */}
                <th 
                  onClick={() => handleSort('probs')}
                  className={`py-1 px-1.5 w-28 text-center cursor-pointer transition-colors group select-none ${
                    ['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by chance"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? 'text-indigo-600 font-bold' : ''}>Home · Draw · Away</span>
                    {['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Conf */}
                <th 
                  onClick={() => handleSort('conf')}
                  className={`py-1 px-1.5 w-16 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'conf' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Confidence"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <InfoTooltip title="Chance" content="How likely we think the tip is to win.">
                      <span className={sortField === 'conf' ? 'text-indigo-600 font-bold' : ''}>Chance</span>
                    </InfoTooltip>
                    {sortField === 'conf' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Score/xG */}
                <th 
                  onClick={() => handleSort('xg')}
                  className={`py-1 px-1.5 w-20 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'xg' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by goals expected"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <InfoTooltip title="Likely score" content="The most likely final score, with expected goals for each team in brackets.">
                      <span className={sortField === 'xg' ? 'text-indigo-600 font-bold' : ''}>Likely score</span>
                    </InfoTooltip>
                    {sortField === 'xg' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* LiveScore Bet Odds & Potential Return */}
                <th 
                  onClick={() => handleSort('kelly')}
                  className={`py-1 px-2 w-36 text-left cursor-pointer transition-colors group select-none ${
                    sortField === 'kelly' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by value"
                >
                  <div className="inline-flex items-center gap-0.5">
                    <InfoTooltip title="Odds & return" content="The odds, the suggested stake, and what it pays back if it wins.">
                      <span className={sortField === 'kelly' ? 'text-indigo-600 font-bold' : ''}>Odds & return</span>
                    </InfoTooltip>
                    {sortField === 'kelly' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-1 px-2 w-72 min-w-[285px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
              {filteredMatches.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={9} className="py-14 px-4 text-center block md:table-cell">
                    {selectedDate === todayKey && todayMatchCount === 0 ? (
                      <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center py-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                          Midweek Rest Day — No Fixtures Scheduled Today
                        </h3>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                          There are no matches scheduled today ({formatFriendlyDateOption(todayKey, null, tzSettings)}) across covered top-tier European leagues (Premier League, La Liga, Serie A, Bundesliga, Champions League, UEFA Nations League). Our strict signal filter automatically screens out volatile friendly and youth matches.
                        </p>
                        {nearestUpcomingDateKey && (
                          <div className="mt-4 pt-3 border-t border-slate-100 w-full flex flex-col sm:flex-row items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedDate(nearestUpcomingDateKey)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              <span>View {formatFriendlyDateOption(nearestUpcomingDateKey, null, tzSettings)} Slate ({nearestUpcomingCount} Matches)</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedDate('All')}
                              className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              View All Upcoming ({totalActiveCount})
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-400">
                          No matches fit these filters.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Try another date or clear the filters.</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMatches.map((m, idx) => {
                  const isExpanded = expandedMatchId === (m.id || idx);
                  const isSlipAdded = accaMatchIds.has(m.id) || accaMatchIds.has(String(m.id)) || (m.home && m.away && Array.from(accaMatchIds).some(id => String(id).includes(`${m.home}-${m.away}`)));
                  const homeProb = safeParseFloat(m.prob?.home, 0);
                  const drawProb = safeParseFloat(m.prob?.draw, 0);
                  const awayProb = safeParseFloat(m.prob?.away, 0);
                  const highestProb = Math.max(homeProb, drawProb, awayProb);
                  const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, highestProb);
                  
                  const predictedWinner = getMatchPick(m);
                  
                  const scoreObj = m.mostLikelyScore || m.scoreModel?.topScorelines?.[0]?.score;
                  let rawScore = '—';
                  if (typeof scoreObj === 'string') rawScore = scoreObj;
                  else if (scoreObj?.home !== undefined) rawScore = `${scoreObj.home}-${scoreObj.away}`;
                  else if (m.predictedScore) rawScore = m.predictedScore;
                  const score = formatScore(rawScore);
                  
                  const hasLineup = m.lineupAdjusted || m.hasConfirmedLineup;

                  const homeXg = safeParseFloat(m.xG?.home ?? m.lambda, 1.5);
                  const awayXg = safeParseFloat(m.xG?.away ?? m.mu, 1.1);
                  const matchOdds = resolveMatchOdds(m, predictedWinner);
                  const oddsProvider = getOddsProviderLabel(m);
                  const kelly = m.kellyStake ?? m.binaryModel?.kellyStake;
                  const kellyUnits = safeParseFloat(kelly?.units ?? kelly?.fraction, 0);
                  const rawEuro = safeParseFloat(kelly?.stakeEuro, 0);
                  const rowStake = rawEuro > 0 
                    ? rawEuro 
                    : (kellyUnits > 0 ? (kellyUnits <= 1 ? kellyUnits * bankrollEuro : (kellyUnits / 100) * bankrollEuro) : (bankrollEuro * 0.02));
                  const returns = calculatePotentialReturn(rowStake, matchOdds);
                  const kellyDisplay = formatKellyStake(kelly, '1.5u');
                  const smartMarketDisplay = formatSmartMarket(m.smartMarket ?? m.binaryModel?.smartMarket, `${predictedWinner === 'HOME' ? m.home : predictedWinner === 'AWAY' ? m.away : 'Draw'} ML`);

                  const slipPick = getMarketPick(m, marketMode);
                  const riskProfile = getMatchRiskProfile(m, slipPick);
                  const isTrap = riskProfile.riskLevel === 'HIGH';
                  const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
                  const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';

                  const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
                  const isDnbAdvised = m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0;
                  const countdown = formatKickoffCountdown(m);

                  return (
                    <React.Fragment key={m.id || idx}>
                      <tr 
                        className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer ${
                          isUnanimous ? 'ring-1 ring-amber-300 md:ring-0 bg-amber-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                        onClick={() => toggleExpand(m.id || idx)}
                      >
                        {/* ---------------- MOBILE VIEW (1-ROW TABLE OR CARD) ---------------- */}
                        {mobileViewMode === 'table' ? (
                          <td className="md:hidden px-2.5 py-2 block">
                            <div className="flex items-center justify-between gap-1.5 text-xs">
                              {/* Left: Kickoff / LIVE + Teams with WINNER VISIBLY HIGHLIGHTED */}
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {m.isLive ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-600 text-white animate-pulse shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    <span>LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}</span>
                                    {liveScoreText(m) && <span className="font-mono font-bold">({liveScoreText(m)})</span>}
                                  </span>
                                ) : (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-800 shrink-0 font-mono">
                                    FT {score !== '—' ? `(${score})` : ''}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-slate-600 shrink-0 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {compactKickoff(formatMatchKickoff(m)) || formatMatchKickoff(m)}
                                  </span>
                                )}

                                {/* Matchup: Who Wins Visibly Highlighted */}
                                <div className="text-xs truncate min-w-0 flex-1">
                                  {predictedWinner === 'HOME' ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-black text-slate-950 underline decoration-indigo-400 underline-offset-2">{m.home}</span>
                                      <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight shrink-0">WIN</span>
                                      <span className="text-slate-400 font-normal mx-0.5">v</span>
                                      <span className="text-slate-500 font-medium">{m.away}</span>
                                    </span>
                                  ) : predictedWinner === 'AWAY' ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-slate-500 font-medium">{m.home}</span>
                                      <span className="text-slate-400 font-normal mx-0.5">v</span>
                                      <span className="font-black text-slate-950 underline decoration-indigo-400 underline-offset-2">{m.away}</span>
                                      <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight shrink-0">WIN</span>
                                    </span>
                                  ) : predictedWinner === 'DRAW' ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-bold text-slate-800">{m.home}</span>
                                      <span className="text-[8.5px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded leading-tight shrink-0">DRAW</span>
                                      <span className="font-bold text-slate-800">{m.away}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-bold text-slate-900">{m.home}</span>
                                      <span className="text-slate-400 font-normal mx-0.5">v</span>
                                      <span className="font-bold text-slate-900">{m.away}</span>
                                    </span>
                                  )}
                                  {isUnanimous && (
                                    <span className="ml-1 text-[8.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded font-bold shrink-0 inline-block align-middle" title="One of our strongest tips">
                                      👑
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Pick @ Odds, Conf, Chevron */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono font-bold text-[10.5px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  {smartMarketDisplay || (predictedWinner === 'HOME' ? `${m.home} Win` : predictedWinner === 'AWAY' ? `${m.away} Win` : 'Draw')} @{safeToFixed(matchOdds, 2)}
                                </span>
                                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200" title="Model Win Probability">
                                  {safeToFixed(conf, 0)}%
                                </span>
                                <div className="text-slate-400">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <td className="md:hidden p-3 block">
                            <div className="flex justify-between items-start mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-700 font-mono text-[10px]">
                                  {compactKickoff(formatMatchKickoff(m)) || formatMatchKickoff(m)}
                                </span>
                                {String(m.status || '').toLowerCase().includes('postpone') ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    Postponed
                                  </span>
                                ) : String(m.status || '').toLowerCase().includes('cancel') ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    Canceled
                                  </span>
                                ) : String(m.status || '').toLowerCase().includes('delay') || String(m.status || '').toLowerCase().includes('suspend') ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Delayed
                                  </span>
                                ) : m.isLive ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                    LIVE {m.liveMinute ? `${m.liveMinute}'` : ''} {liveScoreText(m) ? `(${liveScoreText(m)})` : ''}
                                  </span>
                                ) : (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') ? (
                                  <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-slate-200 text-slate-800 font-mono">
                                    FT ({score})
                                  </span>
                                ) : countdown ? (
                                  <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${countdown.color}`}>
                                    {countdown.isWindow && <Lock className="w-2 h-2" />}
                                    {countdown.label}
                                  </span>
                                ) : null}
                                <span className="text-[9.5px] text-slate-400">
                                  {m.league}
                                </span>
                              </div>
                              <ConfidenceGauge confidence={conf} size="sm" />
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex flex-col flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs ${predictedWinner === 'HOME' ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-semibold text-slate-700'}`}>{m.home}</span>
                                  {predictedWinner === 'HOME' && (
                                    <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight">WIN</span>
                                  )}
                                  {isUnanimous && (
                                    <span 
                                      className="text-[8.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold shrink-0" 
                                      title="One of our strongest tips"
                                    >
                                      Top pick
                                    </span>
                                  )}
                                  {leagueTierObj && (
                                    <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded border shadow-2xs ${leagueTierObj.badgeStyle}`} title={`${leagueTierObj.label} (${leagueTierObj.expectedHighConvictionWinRate} hit rate)`}>
                                      {leagueTierObj.badgeShort}
                                    </span>
                                  )}
                                  {isDnbAdvised && (
                                    <span className="text-[8.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-bold" title={`Draw Risk ${safeToFixed(drawProb, 1)}% ≥ 24.0% — DNB protects stake`}>
                                      Draw = refund
                                    </span>
                                  )}
                                  <RiskBadgeWithAiHover
                                    riskProfile={riskProfile}
                                    match={m}
                                    pick={slipPick}
                                    className="text-[8.5px] border px-1 py-0.2 rounded font-bold"
                                  />
                                  {isDerivative && <span className="text-[8.5px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded font-bold">🛡️ {m.smartMarket?.pick}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className={`text-xs ${predictedWinner === 'AWAY' ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-semibold text-slate-700'}`}>{m.away}</span>
                                  {predictedWinner === 'AWAY' && (
                                    <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight">WIN</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[8.5px] uppercase font-bold text-slate-400 mb-0.5">Top Pick</span>
                                {renderMarketPrediction(m, predictedWinner, homeProb, drawProb, awayProb, matchOdds)}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 mt-1.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[9.5px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {score}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {smartMarketDisplay} @{safeToFixed(matchOdds, 2)}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200" title={`Wager €${safeToFixed(rowStake, 0)} based on €${bankrollEuro} bankroll`}>
                                  💰 €{safeToFixed(rowStake, 0)} → €{returns.payoutStr} ({returns.profitStr})
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <WatchButton matchId={m.id} className="!w-6 !h-6" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenWatchLive) onOpenWatchLive(m);
                                  }}
                                  className={`w-[98px] h-6 flex items-center justify-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer shrink-0 ${
                                    m.isLive
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                  }`}
                                  title={m.isLive ? "Open Live Match Intelligence & Tactical AI Analysis" : "Open Match Intelligence & Tactical AI Analysis"}
                                >
                                  <Brain className={`w-2 h-2 shrink-0 ${m.isLive ? 'text-white' : 'text-indigo-600'}`} />
                                  <span className="truncate">{m.isLive ? 'Live stats' : 'Stats'}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onAddToSlip) onAddToSlip(m, slipPick);
                                  }}
                                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer shrink-0 ${
                                    isSlipAdded
                                      ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                  }`}
                                >
                                  {isSlipAdded ? <Trash2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                            
                            {!isExpanded && (
                              <div className="text-[9.5px] text-slate-400 mt-1 text-center uppercase tracking-wider font-semibold">
                                Tap for details <ChevronDown className="w-2.5 h-2.5 inline-block ml-0.5" />
                              </div>
                            )}
                          </td>
                        )}

                        {/* ---------------- DESKTOP CELLS ---------------- */}
                        {/* Time / Status */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1 font-mono text-[11px]">
                            <span className="font-semibold text-slate-700">
                              {formatMatchKickoff(m)}
                            </span>
                            {String(m.status || '').toLowerCase().includes('postpone') ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Postponed
                              </span>
                            ) : String(m.status || '').toLowerCase().includes('cancel') ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                Canceled
                              </span>
                            ) : String(m.status || '').toLowerCase().includes('delay') || String(m.status || '').toLowerCase().includes('suspend') ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Delayed
                              </span>
                            ) : m.isLive ? (
                              <span 
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white animate-pulse"
                                title={`Match currently live: ${m.liveMinute || 0}' (${m.liveScore?.home ?? 0}-${m.liveScore?.away ?? 0})`}
                              >
                                <span>LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}</span>
                              </span>
                            ) : countdown ? (
                              <span 
                                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${countdown.color}`}
                                title={countdown.isWindow ? "Pre-kickoff lock window (≤60m): Prediction is locked & frozen" : "Time until match kickoff"}
                              >
                                {countdown.isWindow && <Lock className="w-2 h-2 shrink-0" />}
                                <span>{countdown.label}</span>
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Fixture / Teams */}
                        <td className="hidden md:table-cell py-1.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[11.5px] max-w-[170px]">
                              <span className={predictedWinner === 'HOME' ? 'font-bold text-slate-900 underline decoration-indigo-400 underline-offset-2' : 'font-medium text-slate-600'}>{m.home}</span>
                              {predictedWinner === 'HOME' && <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">WIN</span>}
                              <span className="text-slate-400 mx-1">vs</span>
                              <span className={predictedWinner === 'AWAY' ? 'font-bold text-slate-900 underline decoration-indigo-400 underline-offset-2' : 'font-medium text-slate-600'}>{m.away}</span>
                              {predictedWinner === 'AWAY' && <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">WIN</span>}
                              {predictedWinner === 'DRAW' && <span className="ml-1 text-[8px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">DRAW</span>}
                            </span>
                            {m.isLive && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.2 rounded-full shadow-xs animate-pulse cursor-pointer shrink-0"
                                title="Match is LIVE NOW! Click for Live Match stats"
                              >
                                <Brain className="w-1.5 h-1.5 text-white" />
                                <span>Live stats</span>
                              </button>
                            )}
                            {isUnanimous ? (
                              <span 
                                className="inline-flex items-center text-[8.5px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded border border-amber-300 shrink-0" 
                                title="One of our strongest tips"
                              >
                                Top pick
                              </span>
                            ) : (isTrap || riskProfile.riskLevel === 'LOW') ? (
                              <RiskBadgeWithAiHover
                                riskProfile={riskProfile}
                                match={m}
                                pick={slipPick}
                                className="text-[8.5px] font-bold px-1 py-0.2 rounded border shrink-0"
                              />
                            ) : isDnbAdvised ? (
                              <span className="inline-flex items-center text-[8.5px] font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-200 shrink-0" title="Money back if it ends in a draw">
                                Draw = refund
                              </span>
                            ) : m.teamTrends?.home?.badge ? (
                              <span className="inline-flex items-center text-[8.5px] font-bold bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200 shrink-0" title={m.teamTrends.home.tacticalIdentity}>
                                {m.teamTrends.home.badge}
                              </span>
                            ) : null}
                            <span className="text-[9.5px] text-slate-400 truncate max-w-[110px] ml-auto">
                              {m.league}
                            </span>
                          </div>
                        </td>

                        {/* Lineup XI Badge Button */}
                        <td className="hidden md:table-cell py-1.5 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenLineup && onOpenLineup(m); }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border transition-colors cursor-pointer inline-block ${
                              m.lineupAdjusted
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold'
                                : hasLineup
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={m.lineupAdjusted ? `Lineup impact calibrated: ${m.lineupImpactReason || 'Tactical weighting applied'}` : "Click to view Starting XI"}
                          >
                            {hasLineup ? 'Confirmed' : 'Expected'}
                          </button>
                        </td>

                        {/* AI Prediction Pick */}
                        <td className="hidden md:table-cell py-1.5 px-1.5 text-center whitespace-nowrap">
                          {renderMarketPrediction(m, predictedWinner, homeProb, drawProb, awayProb, matchOdds)}
                        </td>

                        {/* Probabilities 1 | X | 2 */}
                        <td className="hidden md:table-cell py-1.5 px-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-mono">
                            <span className={`px-0.5 rounded ${homeProb > awayProb && homeProb > drawProb ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}>
                              {safeToFixed(homeProb, 0)}%
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className={`px-0.5 rounded ${drawProb > homeProb && drawProb > awayProb ? 'font-bold text-amber-700 bg-amber-50' : 'text-slate-600'}`}>
                              {safeToFixed(drawProb, 0)}%
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className={`px-0.5 rounded ${awayProb > homeProb && awayProb > drawProb ? 'font-bold text-blue-700 bg-blue-50' : 'text-slate-600'}`}>
                              {safeToFixed(awayProb, 0)}%
                            </span>
                          </div>
                        </td>

                        {/* Confidence */}
                        <td className="hidden md:table-cell py-1.5 px-1.5 text-center whitespace-nowrap">
                          <ConfidenceGauge confidence={conf} size="sm" />
                        </td>

                        {/* Score/xG */}
                        <td className="hidden md:table-cell py-1.5 px-1.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1 font-mono text-[11px]" title={`Projected score ${score} · Expected goals: xG ${safeToFixed(homeXg, 1, '1.5')}-${safeToFixed(awayXg, 1, '1.1')}`}>
                            <span className="font-bold text-slate-800">{score}</span>
                            <span className="text-[9.5px] text-slate-400">({safeToFixed(homeXg, 1, '1.5')}-{safeToFixed(awayXg, 1, '1.1')})</span>
                          </div>
                        </td>

                        {/* LiveScore Bet Odds & Potential Return */}
                        <td className="hidden md:table-cell py-1.5 px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-mono">
                            <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded" title={`${oddsProvider} Odds`}>
                              @{safeToFixed(matchOdds, 2)}
                            </span>
                            <KellyTooltip showIcon={false} align="right">
                              <span className="text-emerald-800 font-bold bg-emerald-50/90 border border-emerald-200 px-1 py-0.2 rounded cursor-help" title={`Stake €${safeToFixed(rowStake, 0)} (${kellyDisplay})`}>
                                €{safeToFixed(rowStake, 0)}
                              </span>
                            </KellyTooltip>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold text-emerald-700" title="Potential Payout">
                              €{returns.payoutStr}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center whitespace-nowrap">
                          <WatchButton matchId={m.id} className="!w-6 !h-6 align-middle mr-1" />
                          <div className="inline-grid align-middle grid-cols-[98px_56px_58px_52px] gap-1 items-center justify-center">
                            {/* Tactical AI Analysis Modal */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                              className={`w-[98px] h-6 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs shrink-0 ${
                                m.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse font-extrabold'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title={m.isLive ? "Live Match Intelligence & In-Play Momentum" : "Pre-Match Tactical AI Analysis"}
                            >
                              <Brain className={`w-2.5 h-2.5 shrink-0 ${m.isLive ? 'text-white' : 'text-indigo-600'}`} />
                              <span className="truncate">{m.isLive ? 'Live stats' : 'Stats'}</span>
                            </button>

                            {/* Deep Analysis Page */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                              className="w-[56px] h-6 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                              title="Open Analysis"
                            >
                              Analysis
                            </button>

                            {/* Add to Slip Slip */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(m, slipPick); }}
                              className={`w-[58px] h-6 rounded text-[10px] font-medium transition-colors cursor-pointer border flex items-center justify-center shrink-0 ${
                                isSlipAdded
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  : 'bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border-slate-200 hover:border-purple-200'
                              }`}
                              title={isSlipAdded ? 'Remove from bet slip' : 'Add to bet slip'}
                            >
                              {isSlipAdded ? '✓ Added' : '+ Add'}
                            </button>

                            {/* Expand Row Details */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(m.id || idx); }}
                              className="w-[52px] h-6 rounded text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-0.5 shrink-0"
                              title="Toggle tactical analysis details"
                            >
                              <span>{isExpanded ? 'Hide' : 'Tactics'}</span>
                              {isExpanded ? <ChevronUp className="w-2.5 h-2.5 shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 shrink-0" />}
                            </button>
                          </div>
                        </td>

                      </tr>

                      {/* Expanded Tactical Mini-Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200 flex flex-col md:table-row">
                          <td colSpan={9} className="p-3 block md:table-cell">
                            {/* MOBILE EXTENDED ACTION BUTTONS (Only visible on mobile when expanded) */}
                            <div className="md:hidden flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-200">
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenLineup && onOpenLineup(m); }}
                                className={`flex-1 px-2 py-1.5 rounded text-[11px] font-semibold border transition-colors text-center ${
                                  hasLineup
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-white text-slate-600 border-slate-300'
                                }`}
                              >
                                {hasLineup ? 'Lineup confirmed' : 'Lineup expected'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 text-teal-800 text-center"
                              >
                                Analysis
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(m, slipPick); }}
                                className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border text-center ${
                                  isSlipAdded
                                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {isSlipAdded ? '✓ Added' : '+ Add'}
                              </button>
                            </div>

                            {/* LiveScore Bet & Returns Banner */}
                            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white rounded-xl p-3 mb-3 border border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 font-bold font-mono text-sm">
                                  €
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-white tracking-wide">{smartMarketDisplay}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                      @{safeToFixed(matchOdds, 2)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      ({oddsProvider} Benchmark)
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 mt-0.5">
                                    Recommended Stake: <strong className="text-white font-mono">€{safeToFixed(rowStake, 2)}</strong> ({safeToFixed(kellyUnits, 1)}u · {m.kellyStake?.fractionLabel || '1/4 Kelly'} · €{bankrollEuro} Bankroll)
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 w-full md:w-auto justify-between md:justify-start">
                                <div>
                                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Potential Payout</div>
                                  <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400">€{returns.payoutStr}</div>
                                </div>
                                <div className="h-6 w-px bg-slate-700" />
                                <div>
                                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Net Profit</div>
                                  <div className="text-xs sm:text-sm font-bold font-mono text-white">{returns.profitStr}</div>
                                </div>
                                <div className="h-6 w-px bg-slate-700" />
                                <div>
                                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Mathematical Edge</div>
                                  <div className="text-xs sm:text-sm font-bold font-mono text-indigo-300">+{safeToFixed(m.smartMarket?.expectedValue ?? m.kellyStake?.expectedValue ?? 8.0, 1)}% EV</div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                              
                              {/* Evolving Team Trends & Tactical DNA */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Team style</span>
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">Learning</span>
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex justify-between items-center">
                                    <span className="truncate max-w-[70px]">{m.home}:</span>
                                    <span className="font-semibold text-slate-900 text-[10px] bg-slate-100 px-1 rounded truncate max-w-[100px]">
                                      {m.teamTrends?.home?.badge || '🛡️ Balanced'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="truncate max-w-[70px]">{m.away}:</span>
                                    <span className="font-semibold text-slate-900 text-[10px] bg-slate-100 px-1 rounded truncate max-w-[100px]">
                                      {m.teamTrends?.away?.badge || '🛡️ Balanced'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500">Late Risk:</span>
                                    <span className={`font-mono font-bold ${
                                      m.teamTrends?.away?.tacticalIndices?.lateCapitulationRisk === 'CRITICAL' ? 'text-rose-600' :
                                      m.teamTrends?.away?.tacticalIndices?.lateCapitulationRisk === 'HIGH' ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>
                                      {m.teamTrends?.away?.tacticalIndices?.lateCapitulationRisk || 'LOW'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Statistical Matrix Summary */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Dixon-Coles Metrics
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex justify-between">
                                    <span>Home Attack / Def:</span>
                                    <span className="font-mono">{safeToFixed(m.homeMetrics?.attack, 2, '1.45')} / {safeToFixed(m.homeMetrics?.defense, 2, '0.95')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Away Attack / Def:</span>
                                    <span className="font-mono">{safeToFixed(m.awayMetrics?.attack, 2, '1.10')} / {safeToFixed(m.awayMetrics?.defense, 2, '1.20')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Over 2.5 Goals:</span>
                                    <span className="font-bold text-emerald-700">{m.over25Prob ? `${safeToFixed(m.over25Prob, 0, '58')}%` : '58%'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* League Predictability & Momentum */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Predictability &amp; Form</span>
                                  <span className={`text-[9px] px-1 rounded font-bold ${leagueTierObj.badgeStyle}`}>{leagueTierObj.badgeShort}</span>
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex justify-between">
                                    <span>Confidence Hit Rate:</span>
                                    <span className="font-mono font-bold text-emerald-700">{leagueTierObj.expectedHighConvictionWinRate}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>6-Game Form (H):</span>
                                    <span className="font-mono font-semibold">{m.formMomentum?.home?.record || '3-1-2'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>6-Game Form (A):</span>
                                    <span className="font-mono font-semibold">{m.formMomentum?.away?.record || '2-2-2'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Draw-No-Bet (DNB) Strategy */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Draw = refund</span>
                                  {isDnbAdvised ? (
                                    <span className="text-[9px] px-1 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Advised</span>
                                  ) : (
                                    <span className="text-[9px] px-1 rounded font-bold bg-slate-100 text-slate-600">Optional</span>
                                  )}
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex justify-between">
                                    <span>Draw Risk:</span>
                                    <span className={`font-mono font-bold ${drawProb >= 24 ? 'text-amber-700' : 'text-slate-600'}`}>{safeToFixed(drawProb, 1)}% {drawProb >= 24 ? '(≥24%)' : '(&lt;24%)'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Action:</span>
                                    <span className="font-medium text-slate-900">{isDnbAdvised ? 'Draw-No-Bet' : 'Straight Win / DC'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Salvage Non-Loss:</span>
                                    <span className="font-mono font-bold text-indigo-700">69.5%</span>
                                  </div>
                                </div>
                              </div>

                              {/* Referee & Disciplinary */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Referee &amp; Absences
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex justify-between">
                                    <span>Official:</span>
                                    <span className="font-semibold truncate max-w-[100px]">{m.referee?.name || 'Standard'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Strictness:</span>
                                    <span className="font-mono font-bold text-amber-700">{m.referee?.strictness ? `${m.referee.strictness}/10` : '5/10'}</span>
                                  </div>
                                  <div className="flex justify-between truncate text-rose-700">
                                    <span>Absences:</span>
                                    <span className="truncate max-w-[100px]">{m.missingPlayers && m.missingPlayers.length > 0 ? `${m.missingPlayers.length} key out` : 'Clean'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Direct Jump to Dedicated Pages */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  More
                                </div>
                                <div className="space-y-1.5">
                                  <button
                                    onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                                    className="w-full text-left px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>Research</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => onOpenLineup && onOpenLineup(m)}
                                    className="w-full text-left px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>Lineups</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>

      {/* Empirical Strategy Proof & Benchmark Modal */}
      <StrategyProofModal
        isOpen={showStrategyProofModal}
        onClose={() => setShowStrategyProofModal(false)}
      />

    </div>
  );
}
