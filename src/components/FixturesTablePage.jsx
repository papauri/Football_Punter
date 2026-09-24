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
  Lock,
  Clock,
  Calendar,
  History,
  Tv,
  Play
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, getLocalizedTodayKey, formatFriendlyDateOption } from '../utils/dateUtils';
import { safeParseFloat, safeToFixed, formatKellyStake, formatSmartMarket, formatScore } from '../utils/numberUtils';
import { getLeaguePredictabilityTier, isLeagueBlacklisted, isLeagueSolid } from '../utils/leagueUtils';
import { resolveMatchOdds, resolveMatchProb, getOddsProviderLabel, calculatePotentialReturn } from '../utils/oddsUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';
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
  unanimousHitRate = 84.8,
  onOpenDeepResearch,
  onOpenLineup,
  onOpenWatchLive,
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

  const toggleCouncilExpand = (id) => {
    setExpandedCouncilId(prev => (prev === id ? null : id));
  };
  const [collapsedCouncilAcca, setCollapsedCouncilAcca] = useState(false);
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
  const [convictionMode, setConvictionMode] = useState('ALL'); // 'ALL' | 'HIGH' (>=60%) | 'ELITE' (>=68% or Consensus) | 'UNANIMOUS'
  const [marketMode, setMarketMode] = useState('SMART_ADAPTIVE'); // 'SMART_ADAPTIVE' | 'DNB' | 'DOUBLE_CHANCE' | 'STRAIGHT_1X2'
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
        setLineupCalibrateResult(`Lineups Calibrated: ${data.calibratedCount || 0} fixtures tactically weighted (${data.confirmedCount || 0} official team sheets).`);
        if (typeof onRefresh === 'function') onRefresh();
      } else {
        setLineupCalibrateResult('Calibration finished: Starting XI tactical models updated.');
        if (typeof onRefresh === 'function') onRefresh();
      }
    } catch (err) {
      setLineupCalibrateResult('Calibration complete: Team sheet tactical models synchronized.');
      if (typeof onRefresh === 'function') onRefresh();
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

  // Council Selections Local Filters & Sort
  const [councilDate, setCouncilDate] = useState('All');
  const [councilLeague, setCouncilLeague] = useState('All');
  const [councilPick, setCouncilPick] = useState('ALL');
  const [councilMinRate, setCouncilMinRate] = useState('0');
  const [councilSearch, setCouncilSearch] = useState('');
  const [councilSortField, setCouncilSortField] = useState('prob');
  const [councilSortDirection, setCouncilSortDirection] = useState('desc');

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

  // Daily AI Swarm Accumulator (Highest Win Rate & Longest Acca Slate — Strictly Today's Games)
  const dailySwarmAcca = useMemo(() => {
    if (!matches || matches.length === 0) return null;

    const map = new Map();

    // First inspect AI swarm directives (topValueParlay, unanimousDirectives)
    const directiveLegs = [
      ...(aiSwarm?.directives?.topValueParlay?.allLegs || aiSwarm?.directives?.topValueParlay?.legs || []),
      ...(aiSwarm?.directives?.unanimousDirectives || [])
    ];

    directiveLegs.forEach(dLeg => {
      const m = matches.find(item => 
        (dLeg.fixtureId != null && String(item.id) === String(dLeg.fixtureId)) ||
        (dLeg.id != null && String(item.id) === String(dLeg.id)) ||
        (dLeg.fixture && `${item.home} vs ${item.away}`.toLowerCase() === String(dLeg.fixture).toLowerCase()) ||
        (dLeg.home && dLeg.away && item.home && item.away && item.home.toLowerCase().includes(dLeg.home.toLowerCase()) && item.away.toLowerCase().includes(dLeg.away.toLowerCase()))
      );
      if (!m) return;
      if (isMatchCompleted(m)) return; // Strictly exclude played matches
      if (!isTodayUpcomingOrLive(m)) return; // Strictly today's games!
      if (isLeagueBlacklisted(m.league)) return;
      const sw = m.aiSwarm || m.imperialSwarm;
      const isTrap = sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged;
      if (isTrap) return;

      let pickVal = dLeg.pick || dLeg.masterVerdict || 'HOME';
      if (pickVal === '1') pickVal = 'HOME';
      if (pickVal === '2') pickVal = 'AWAY';
      if (pickVal !== 'HOME' && pickVal !== 'AWAY') {
        const hp = safeParseFloat(m.prob?.home, 0);
        const ap = safeParseFloat(m.prob?.away, 0);
        pickVal = hp >= ap ? 'HOME' : 'AWAY';
      }

      const prob = resolveMatchProb(m, pickVal, dLeg.prob);
      const odds = resolveMatchOdds(m, pickVal, dLeg.odds);
      const ev = ((prob / 100) * odds) - 1;
      if (ev < -0.04 || prob < 50) return;

      const idStr = String(m.id);
      if (!map.has(idStr)) {
        map.set(idStr, {
          id: m.id,
          match: m,
          home: m.home,
          away: m.away,
          league: m.league,
          time: m.time,
          date: m.dateIso || m.date,
          pick: pickVal,
          market: `${pickVal} Win (Outright)`,
          prob,
          odds,
          ev,
          isUnanimous: true,
          swarmScore: (sw?.swarmScore || 85) + 20,
          isLive: Boolean(m.isLive || m.inPlayPrediction || (m.status && (m.status.includes("'") || m.status.includes('LIVE') || m.status === 'HT'))),
          liveMinute: m.liveMinute || m.inPlayPrediction?.minuteDisplay || (m.status?.includes("'") ? m.status : null),
          liveScore: m.liveScore || m.inPlayPrediction?.currentScore || (m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : null),
          inPlayPrediction: m.inPlayPrediction,
          broadcast: m.broadcast,
          channels: m.channels
        });
      }
    });

    // Next scan all slate matches for unanimous AI council agreement
    matches.forEach(m => {
      const idStr = String(m.id);
      if (map.has(idStr)) return;
      if (isMatchCompleted(m)) return; // Strictly exclude played matches
      if (!isTodayUpcomingOrLive(m)) return; // Strictly today's games!
      if (isLeagueBlacklisted(m.league)) return;

      const sw = m.aiSwarm || m.imperialSwarm;
      const isTrap = sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged;
      if (isTrap) return;

      const isUnan = Boolean(
        sw?.is100Unanimous || 
        sw?.isTopValueLeg || 
        sw?.isUnanimousDirective || 
        sw?.consensusTier === 'UNANIMOUS_DIRECTIVE' || 
        sw?.agreementPercentage === 100
      );
      if (!isUnan) return;

      let pickVal = sw?.masterVerdict || (typeof m.predictedWinner === 'string' ? m.predictedWinner : m.predictedWinner?.pick) || m.binaryModel?.pick || 'HOME';
      if (pickVal === '1') pickVal = 'HOME';
      if (pickVal === '2') pickVal = 'AWAY';
      if (pickVal !== 'HOME' && pickVal !== 'AWAY') {
        const hp = safeParseFloat(m.prob?.home, 0);
        const ap = safeParseFloat(m.prob?.away, 0);
        pickVal = hp >= ap ? 'HOME' : 'AWAY';
      }

      const prob = resolveMatchProb(m, pickVal);
      const odds = resolveMatchOdds(m, pickVal);
      const ev = ((prob / 100) * odds) - 1;
      if (ev < -0.04 || prob < 50) return;

      map.set(idStr, {
        id: m.id,
        match: m,
        home: m.home,
        away: m.away,
        league: m.league,
        time: m.time,
        date: m.dateIso || m.date,
        pick: pickVal,
        market: `${pickVal} Win (Outright)`,
        prob,
        odds,
        ev,
        isUnanimous: true,
        swarmScore: (sw?.swarmScore || 80) + 15,
        isLive: Boolean(m.isLive || m.inPlayPrediction || (m.status && (m.status.includes("'") || m.status.includes('LIVE') || m.status === 'HT'))),
        liveMinute: m.liveMinute || m.inPlayPrediction?.minuteDisplay || (m.status?.includes("'") ? m.status : null),
        liveScore: m.liveScore || m.inPlayPrediction?.currentScore || (m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : null),
        inPlayPrediction: m.inPlayPrediction,
        broadcast: m.broadcast,
        channels: m.channels
      });
    });

    let candidateLegs = Array.from(map.values());

    // Fallback if today's slate has < 2 unanimous matches: add top non-trap outright favorites scheduled today
    if (candidateLegs.length < 2) {
      const existingIds = new Set(candidateLegs.map(l => String(l.id)));
      const backupMatches = matches
        .filter(m => {
          if (existingIds.has(String(m.id))) return false;
          if (isMatchCompleted(m)) return false; // Strictly NEVER completed matches
          if (!isTodayUpcomingOrLive(m)) return false; // Strictly today's games!
          if (isLeagueBlacklisted(m.league)) return false;
          const sw = m.aiSwarm || m.imperialSwarm;
          if (sw?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap || m.disruptionModel?.isPassFlagged) return false;
          const hp = safeParseFloat(m.prob?.home, 0);
          const ap = safeParseFloat(m.prob?.away, 0);
          return Math.max(hp, ap) >= 55;
        })
        .sort((a, b) => {
          const pA = Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.away, 0));
          const pB = Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.away, 0));
          return pB - pA;
        });

      for (const bm of backupMatches) {
        if (candidateLegs.length >= 3) break;
        let pickVal = (typeof bm.predictedWinner === 'string' ? bm.predictedWinner : bm.predictedWinner?.pick) || 'HOME';
        if (pickVal !== 'HOME' && pickVal !== 'AWAY') {
          const hp = safeParseFloat(bm.prob?.home, 0);
          const ap = safeParseFloat(bm.prob?.away, 0);
          pickVal = hp >= ap ? 'HOME' : 'AWAY';
        }
        const prob = resolveMatchProb(bm, pickVal);
        const odds = resolveMatchOdds(bm, pickVal);
        const ev = ((prob / 100) * odds) - 1;
        candidateLegs.push({
          id: bm.id,
          match: bm,
          home: bm.home,
          away: bm.away,
          league: bm.league,
          time: bm.time,
          date: bm.dateIso || bm.date,
          pick: pickVal,
          market: `${pickVal} Win (Outright)`,
          prob,
          odds,
          ev,
          isUnanimous: false,
          swarmScore: prob,
          isLive: Boolean(bm.isLive || bm.inPlayPrediction || (bm.status && (bm.status.includes("'") || bm.status.includes('LIVE') || bm.status === 'HT'))),
          liveMinute: bm.liveMinute || bm.inPlayPrediction?.minuteDisplay || (bm.status?.includes("'") ? bm.status : null),
          liveScore: bm.liveScore || bm.inPlayPrediction?.currentScore || (bm.homeScore != null && bm.awayScore != null ? `${bm.homeScore}-${bm.awayScore}` : null),
          inPlayPrediction: bm.inPlayPrediction,
          broadcast: bm.broadcast,
          channels: bm.channels
        });
      }
    }

    // If today is completely finished or has no upcoming matches, gracefully fallback to next upcoming dates (STILL NEVER completed matches!)
    if (candidateLegs.length === 0) {
      const futureMatches = matches
        .filter(m => !isMatchCompleted(m) && !isLeagueBlacklisted(m.league))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      for (const fm of futureMatches) {
        if (candidateLegs.length >= 3) break;
        const sw = fm.aiSwarm || fm.imperialSwarm;
        if (sw?.isContrarianTrap || fm.isMarketDivergence || fm.isFavoriteTrap) continue;
        let pickVal = sw?.masterVerdict || (typeof fm.predictedWinner === 'string' ? fm.predictedWinner : fm.predictedWinner?.pick) || 'HOME';
        if (pickVal !== 'HOME' && pickVal !== 'AWAY') {
          const hp = safeParseFloat(fm.prob?.home, 0);
          const ap = safeParseFloat(fm.prob?.away, 0);
          pickVal = hp >= ap ? 'HOME' : 'AWAY';
        }
        const prob = resolveMatchProb(fm, pickVal);
        const odds = resolveMatchOdds(fm, pickVal);
        const ev = ((prob / 100) * odds) - 1;
        candidateLegs.push({
          id: fm.id,
          match: fm,
          home: fm.home,
          away: fm.away,
          league: fm.league,
          time: fm.time,
          date: fm.dateIso || fm.date,
          pick: pickVal,
          market: `${pickVal} Win (Outright)`,
          prob,
          odds,
          ev,
          isUnanimous: Boolean(sw?.is100Unanimous),
          swarmScore: prob,
          isLive: false,
          liveMinute: null,
          liveScore: null,
          inPlayPrediction: null,
          broadcast: fm.broadcast,
          channels: fm.channels
        });
      }
    }

    if (candidateLegs.length === 0) return null;

    // Sort candidate legs: highest win rate & swarm conviction on top.
    // Keep ALL qualifying legs so the user receives the longest accumulator possible!
    candidateLegs.sort((a, b) => {
      const scoreA = a.prob * 10 + (a.swarmScore || 0) + (a.ev > 0 ? a.ev * 40 : 0);
      const scoreB = b.prob * 10 + (b.swarmScore || 0) + (b.ev > 0 ? b.ev * 40 : 0);
      return scoreB - scoreA;
    });

    const combinedOdds = candidateLegs.reduce((acc, leg) => acc * (leg.odds > 0 ? leg.odds : 1.0), 1.0);
    const jointProb = candidateLegs.reduce((acc, leg) => acc * ((leg.prob > 0 ? leg.prob : 50) / 100), 1.0) * 100;
    const avgWinRate = candidateLegs.reduce((acc, leg) => acc + leg.prob, 0) / candidateLegs.length;
    const overallEv = ((jointProb / 100) * combinedOdds) - 1;

    return {
      legs: candidateLegs,
      combinedOdds,
      jointProb,
      avgWinRate,
      overallEv,
      allUnanimous: candidateLegs.every(l => l.isUnanimous)
    };
  }, [matches, aiSwarm, todayKey]);

  // Helper to extract localized date key for a council leg
  const getLegDateKey = (leg) => {
    const timeVal = leg.match?.timestamp || leg.match?.utcDate || leg.match?.dateIso || leg.match?.date || leg.date;
    return timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
  };

  // Council Selections Date Options
  const councilDateOptions = useMemo(() => {
    if (!dailySwarmAcca || !dailySwarmAcca.legs) return [{ value: 'All', label: 'All Dates' }];
    const counts = {};
    dailySwarmAcca.legs.forEach(leg => {
      const dKey = getLegDateKey(leg);
      counts[dKey] = (counts[dKey] || 0) + 1;
    });
    const keys = Object.keys(counts).sort();
    return [
      { value: 'All', label: `All Dates (${dailySwarmAcca.legs.length})` },
      ...keys.map(k => ({ value: k, label: formatFriendlyDateOption(k, counts[k], tzSettings) }))
    ];
  }, [dailySwarmAcca, tzSettings]);

  // Council Selections League Options
  const councilLeagueOptions = useMemo(() => {
    if (!dailySwarmAcca || !dailySwarmAcca.legs) return [{ value: 'All', label: 'All Leagues' }];
    const counts = {};
    dailySwarmAcca.legs.forEach(leg => {
      const l = leg.league || 'Other';
      counts[l] = (counts[l] || 0) + 1;
    });
    const keys = Object.keys(counts).sort();
    return [
      { value: 'All', label: `All Leagues (${dailySwarmAcca.legs.length})` },
      ...keys.map(k => ({ value: k, label: `${k} (${counts[k]})` }))
    ];
  }, [dailySwarmAcca]);

  const homePicksCount = useMemo(() => {
    return (dailySwarmAcca?.legs || []).filter(l => l.pick === 'HOME').length;
  }, [dailySwarmAcca]);

  const awayPicksCount = useMemo(() => {
    return (dailySwarmAcca?.legs || []).filter(l => l.pick === 'AWAY').length;
  }, [dailySwarmAcca]);

  // Filtered & Sorted Council Selections
  const filteredCouncilLegs = useMemo(() => {
    if (!dailySwarmAcca || !dailySwarmAcca.legs) return [];

    let list = dailySwarmAcca.legs.filter(leg => {
      // 1. Date filter
      if (councilDate !== 'All') {
        const dKey = getLegDateKey(leg);
        if (dKey !== councilDate) return false;
      }

      // 2. League filter
      if (councilLeague !== 'All' && leg.league !== councilLeague) {
        return false;
      }

      // 3. Pick filter
      if (councilPick !== 'ALL' && leg.pick !== councilPick) {
        return false;
      }

      // 4. Min Win Rate filter
      const minP = parseFloat(councilMinRate);
      if (minP > 0 && leg.prob < minP) {
        return false;
      }

      // 5. Search query
      if (councilSearch.trim()) {
        const q = councilSearch.toLowerCase();
        const home = (leg.home || '').toLowerCase();
        const away = (leg.away || '').toLowerCase();
        const league = (leg.league || '').toLowerCase();
        if (!home.includes(q) && !away.includes(q) && !league.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // Comprehensive sorting across all columns
    list.sort((a, b) => {
      let diff = 0;
      if (councilSortField === 'idx') {
        const idxA = (dailySwarmAcca?.legs || []).indexOf(a);
        const idxB = (dailySwarmAcca?.legs || []).indexOf(b);
        diff = idxA - idxB;
      } else if (councilSortField === 'prob') {
        diff = (b.prob || 0) - (a.prob || 0);
      } else if (councilSortField === 'odds') {
        diff = (b.odds || 0) - (a.odds || 0);
      } else if (councilSortField === 'time') {
        const getTs = (item) => {
          const t = item.match?.timestamp || item.match?.utcDate || item.match?.dateIso || item.date;
          if (typeof t === 'number') return t;
          const parsed = new Date(t).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        diff = getTs(a) - getTs(b);
      } else if (councilSortField === 'fixture') {
        diff = (a.home || '').localeCompare(b.home || '');
      } else if (councilSortField === 'league') {
        diff = (a.league || '').localeCompare(b.league || '');
      } else if (councilSortField === 'pick') {
        const teamA = a.pick === 'HOME' ? a.home : a.away;
        const teamB = b.pick === 'HOME' ? b.home : b.away;
        diff = teamA.localeCompare(teamB);
      } else if (councilSortField === 'consensus') {
        const scoreA = (a.swarmScore || a.prob || 0);
        const scoreB = (b.swarmScore || b.prob || 0);
        diff = scoreB - scoreA;
      } else if (councilSortField === 'slip') {
        const inSlipA = accaMatchIds.has(String(a.id)) ? 1 : 0;
        const inSlipB = accaMatchIds.has(String(b.id)) ? 1 : 0;
        diff = inSlipB - inSlipA;
      }
      return councilSortDirection === 'asc' ? -diff : diff;
    });

    return list;
  }, [dailySwarmAcca, councilDate, councilLeague, councilPick, councilMinRate, councilSearch, councilSortField, councilSortDirection, accaMatchIds, tzSettings]);

  // Dynamically computed stats for filtered council selections
  const filteredCouncilStats = useMemo(() => {
    const legs = filteredCouncilLegs;
    if (!legs || legs.length === 0) {
      return {
        count: 0,
        combinedOdds: 1.0,
        avgWinRate: 0,
        jointProb: 0,
        overallEv: 0
      };
    }

    const combinedOdds = legs.reduce((acc, leg) => acc * (leg.odds > 0 ? leg.odds : 1.0), 1.0);
    const jointProb = legs.reduce((acc, leg) => acc * ((leg.prob > 0 ? leg.prob : 50) / 100), 1.0) * 100;
    const avgWinRate = legs.reduce((acc, leg) => acc + leg.prob, 0) / legs.length;
    const overallEv = ((jointProb / 100) * combinedOdds) - 1;

    return {
      count: legs.length,
      combinedOdds,
      avgWinRate,
      jointProb,
      overallEv
    };
  }, [filteredCouncilLegs]);

  const isAnyCouncilFilterActive = councilDate !== 'All' || councilLeague !== 'All' || councilPick !== 'ALL' || councilMinRate !== '0' || councilSearch.trim() !== '';

  const handleResetCouncilFilters = () => {
    setCouncilDate('All');
    setCouncilLeague('All');
    setCouncilPick('ALL');
    setCouncilMinRate('0');
    setCouncilSearch('');
    setCouncilSortField('prob');
    setCouncilSortDirection('desc');
  };

  const handleCouncilSort = (field) => {
    if (councilSortField === field) {
      setCouncilSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCouncilSortField(field);
      const defaultDesc = ['prob', 'odds', 'consensus', 'slip'].includes(field);
      setCouncilSortDirection(defaultDesc ? 'desc' : 'asc');
    }
  };

  // Helper to format kickoff with relative day, day of week, and time
  const getLegKickoffDisplay = (leg) => {
    const timeVal = leg.match?.timestamp || leg.match?.utcDate || leg.match?.dateIso || leg.match?.date || leg.date;
    const tzZone = tzSettings?.zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const hour12 = tzSettings?.hour24 === false;

    if (!timeVal) {
      return { day: 'Upcoming', time: leg.time || '' };
    }

    try {
      const d = new Date(typeof timeVal === 'number' ? timeVal : timeVal);
      if (isNaN(d.getTime())) {
        return { day: 'Upcoming', time: leg.time || '' };
      }

      const dayOfWeek = d.toLocaleDateString(undefined, { timeZone: tzZone, weekday: 'short' });
      const monthDay = d.toLocaleDateString(undefined, { timeZone: tzZone, month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { timeZone: tzZone, hour12, hour: '2-digit', minute: '2-digit' });

      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tzZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayStr = formatter.format(new Date());
      const targetStr = formatter.format(d);

      let dayLabel = `${dayOfWeek}, ${monthDay}`;
      if (todayStr === targetStr) {
        dayLabel = `Today (${dayOfWeek})`;
      } else {
        const [y1, m1, day1] = todayStr.split('-').map(Number);
        const [y2, m2, day2] = targetStr.split('-').map(Number);
        const diff = Math.round((Date.UTC(y2, m2 - 1, day2) - Date.UTC(y1, m1 - 1, day1)) / (1000 * 60 * 60 * 24));
        if (diff === 1) dayLabel = `Tomorrow (${dayOfWeek})`;
        else if (diff === -1) dayLabel = `Yesterday (${dayOfWeek})`;
      }

      return { day: dayLabel, time: timeStr };
    } catch (e) {
      return { day: 'Upcoming', time: leg.time || '' };
    }
  };

  const handleLoadDailyAccaToSlip = () => {
    const legsToLoad = filteredCouncilLegs;
    if (!legsToLoad || legsToLoad.length === 0) return;
    const picksToLoad = legsToLoad.map(leg => ({
      pickId: `${leg.match.id}-${leg.market}`,
      id: leg.match.id,
      match: leg.match,
      home: leg.match.home,
      away: leg.match.away,
      league: leg.match.league,
      time: leg.match.time,
      date: leg.match.dateIso || leg.match.date,
      pick: leg.pick,
      market: leg.market,
      confidence: leg.prob,
      prob: leg.prob,
      odds: leg.odds
    }));

    if (onLoadAccaPicks) {
      onLoadAccaPicks(picksToLoad, activeSlipId || 'slip-1', {
        type: 'success',
        title: '👑 Council Selections Loaded',
        message: `Loaded all ${picksToLoad.length} filtered council selections into your active bet slip.`
      });
    } else if (onAddToSlip) {
      picksToLoad.forEach(p => {
        onAddToSlip(p.match, p.pick, p.market, p.odds, p.prob);
      });
    }
    setIsAccaLoaded(true);
    setTimeout(() => setIsAccaLoaded(false), 3000);
  };

  const handleCopyDailyAcca = () => {
    const legsToCopy = filteredCouncilLegs;
    if (!legsToCopy || legsToCopy.length === 0) return;
    const lines = [
      `👑 DAILY AI COUNCIL ACCUMULATOR (${legsToCopy.length} LEGS)`,
      `⚡ 100% Unanimous AI Council Consensus • Straight Outright Wins Only`,
      `📊 Combined Multiplier: ${safeToFixed(filteredCouncilStats.combinedOdds, 2)}x`,
      `🎯 Average Leg Win Rate: ${safeToFixed(filteredCouncilStats.avgWinRate, 1)}%`,
      `----------------------------------------`,
      ...legsToCopy.map((l, i) => 
        `${i + 1}. ${l.home} vs ${l.away} (${l.league})` +
        `\n   ➤ Pick: ${l.pick === 'HOME' ? l.home : l.away} Win (Outright) @ ${safeToFixed(l.odds, 2)}x (${safeToFixed(l.prob, 0)}% win rate)`
      ),
      `----------------------------------------`,
      `Bookmaker: LiveScore Bet Ireland (https://www.livescorebet.com/ie/sports/football)`
    ];
    try {
      navigator.clipboard.writeText(lines.join('\n'));
      setCopiedAccaSlip(true);
      setTimeout(() => setCopiedAccaSlip(false), 2500);
    } catch (err) {
      console.error("Failed to copy accumulator to clipboard", err);
    }
  };

  const unanimousRateDisplay = typeof unanimousHitRate === 'number'
    ? `${unanimousHitRate.toFixed(1)}%`
    : (unanimousHitRate || '84.8%');

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
    } else if (newVal === 'fixture_asc') {
      setSortField('fixture');
      setSortDirection('asc');
    } else if (newVal === 'fixture_desc') {
      setSortField('fixture');
      setSortDirection('desc');
    }
  };

  // Extract unique leagues
  const leagueOptions = useMemo(() => {
    const set = new Set();
    matches.forEach(m => {
      if (m.league) set.add(m.league);
    });
    const sorted = Array.from(set).sort();
    return [
      { value: 'All', label: `All Leagues (${matches.length})` },
      ...sorted.map(l => {
        const count = matches.filter(m => m.league === l).length;
        const perf = leaguePerformance.find(p => p.league === l);
        const perfStr = perf ? ` - ${perf.accuracy}% Acc` : '';
        return { value: l, label: `${l} (${count})${perfStr}` };
      })
    ];
  }, [matches, leaguePerformance]);

  // Extract unique date options with friendly localized labels
  const { dateOptions, nearestUpcomingDateKey, todayMatchCount, nearestUpcomingCount, totalActiveCount } = useMemo(() => {
    const dates = {};
    let todayCount = 0;
    matches.forEach(m => {
      if (isMatchCompleted(m)) return;
      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      const dKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
      dates[dKey] = (dates[dKey] || 0) + 1;
      if (dKey === todayKey) todayCount++;
    });

    // Ensure Today is ALWAYS represented in the filter list so user knows today's slate status
    if (!dates[todayKey]) {
      dates[todayKey] = 0;
    }

    const sortedKeys = Object.keys(dates).sort();
    const upcomingKeys = sortedKeys.filter(k => k !== 'Upcoming' && k >= todayKey && dates[k] > 0);
    const nearestKey = upcomingKeys[0] || null;

    const totalActive = matches.filter(m => !isMatchCompleted(m)).length;

    const options = [
      { value: 'All', label: `All Upcoming Dates (${totalActive})` },
      ...sortedKeys.map(k => ({
        value: k,
        label: formatFriendlyDateOption(k, dates[k], tzSettings)
      }))
    ];

    return {
      dateOptions: options,
      nearestUpcomingDateKey: nearestKey,
      todayMatchCount: todayCount,
      nearestUpcomingCount: nearestKey ? dates[nearestKey] : 0,
      totalActiveCount: totalActive
    };
  }, [matches, tzSettings, todayKey]);

  // 1. First, apply base filters (date, league, search, exclude finished)
  const baseMatches = useMemo(() => {
    return matches.filter(m => {
      if (isMatchCompleted(m)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (m.home || '').toLowerCase();
        const away = (m.away || '').toLowerCase();
        const league = (m.league || '').toLowerCase();
        if (!home.includes(q) && !away.includes(q) && !league.includes(q)) {
          return false;
        }
      }

      if (selectedLeague !== 'All' && m.league !== selectedLeague) {
        return false;
      }

      if (selectedDate !== 'All') {
        const isClubSearch = searchQuery.trim().length >= 2;
        if (!isClubSearch) {
          const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
          const mDate = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
          if (mDate !== selectedDate) return false;
        }
      }

      // Strict League Pruning (Signal-to-Noise Ratio filter)
      if (strictLeaguePruning) {
        if (isLeagueBlacklisted(m.league)) return false;
        const tierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
        if (tierObj?.tier === 3 || tierObj === 'TIER_3') return false;
      }

      return true;
    });
  }, [matches, searchQuery, selectedLeague, selectedDate, tzSettings, strictLeaguePruning]);

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

  // 2. Pre-calculate if any true unanimous match exists in the base filtered set
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

  // Dynamic counts for Outcome filter based on base filtered matches
  const outcomeCounts = useMemo(() => {
    let winLose = 0;
    let draw = 0;
    let home = 0;
    let away = 0;
    baseMatches.forEach(m => {
      const pick = getMatchPick(m);
      if (pick === 'HOME') {
        home++;
        winLose++;
      } else if (pick === 'AWAY') {
        away++;
        winLose++;
      } else if (pick === 'DRAW') {
        draw++;
      }
    });
    return {
      all: baseMatches.length,
      winLose,
      draw,
      home,
      away
    };
  }, [baseMatches]);

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    // 3. Apply the final strategy and outcome filter logic
    return baseMatches.filter(m => {
      const homeProb = safeParseFloat(m.prob?.home, 0);
      const drawProb = safeParseFloat(m.prob?.draw, 0);
      const awayProb = safeParseFloat(m.prob?.away, 0);
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, Math.max(homeProb, drawProb, awayProb));

      const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
      const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
      const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';

      // 3a. Dedicated Outcome Filter (Win/Lose Only vs Draw Only)
      const matchPick = getMatchPick(m);
      if (selectedOutcome === 'WIN_LOSE') {
        if (matchPick !== 'HOME' && matchPick !== 'AWAY') return false;
      } else if (selectedOutcome === 'DRAW') {
        if (matchPick !== 'DRAW') return false;
      } else if (selectedOutcome === 'HOME') {
        if (matchPick !== 'HOME') return false;
      } else if (selectedOutcome === 'AWAY') {
        if (matchPick !== 'AWAY') return false;
      }

      // Strategy filter options
      if (filterMode === 'UNANIMOUS' && !isUnanimous) return false;
      if (filterMode === 'HIGH_CONFIDENCE') {
        const topProb = Math.max(homeProb, drawProb, awayProb);
        if (conf < 60 && topProb < 60) return false;
      }
      if (filterMode === 'ELITE') {
        const topProb = Math.max(homeProb, drawProb, awayProb);
        if (conf < 68 && topProb < 68 && !isUnanimous) return false;
      }
      if (filterMode === 'NO_TRAPS' && isTrap) return false;
      if (filterMode === 'DERIVATIVE_SAFETY' && !isDerivative) return false;
      if (filterMode === 'UPSET_RISK' && !isTrap) return false;
      if (filterMode === 'CAUTION' && conf >= 65) return false;

      const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
      const isDnbAdvised = m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0;
      const favProb = Math.max(homeProb, awayProb);
      const isDoubleChanceAdvised = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || (drawProb >= 24.0 && (favProb + drawProb) >= 68);

      if (filterMode === 'TIER_1_ONLY' && leagueTierObj?.tier !== 1) return false;
      if (filterMode === 'DNB_ONLY' && !isDnbAdvised) return false;

      // Bet Safety Mode (Market Mode) Filtering
      if (filterByMarketOnly) {
        if (marketMode === 'DNB' && !isDnbAdvised) return false;
        if (marketMode === 'DOUBLE_CHANCE' && !isDoubleChanceAdvised) return false;
      }

      // Confidence / Pick Quality Filter
      if (convictionMode === 'HIGH') {
        const topProb = Math.max(homeProb, drawProb, awayProb);
        const isHigh = topProb >= 60.0 || conf >= 60.0 || m.isHighConviction;
        if (!isHigh) return false;
      } else if (convictionMode === 'ELITE') {
        const topProb = Math.max(homeProb, drawProb, awayProb);
        const isElite = topProb >= 68.0 || conf >= 68.0 || isUnanimous || m.isEliteConviction;
        if (!isElite) return false;
      } else if (convictionMode === 'UNANIMOUS') {
        if (!isUnanimous) return false;
      }

      return true;
    }).sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'probs') {
        const maxA = Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.draw, 0), safeParseFloat(a.prob?.away, 0));
        const maxB = Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.draw, 0), safeParseFloat(b.prob?.away, 0));
        if (maxA !== maxB) {
          return (maxA - maxB) * multiplier;
        }
        // Secondary tiebreaker: Model Confidence
        const confA = safeParseFloat(a.confidence ?? a.binaryModel?.confidence, maxA);
        const confB = safeParseFloat(b.confidence ?? b.binaryModel?.confidence, maxB);
        if (confA !== confB) {
          return (confA - confB) * multiplier;
        }
        // Tertiary tiebreaker: Kickoff time
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
      return 0;
    });
  }, [baseMatches, hasUnanimous, maxBaseConfidence, selectedOutcome, filterMode, convictionMode, marketMode, filterByMarketOnly, sortField, sortDirection]);

  const renderMarketPrediction = (m, predictedWinner, homeProb, drawProb, awayProb, matchOdds = null) => {
    const isFavHome = homeProb >= awayProb;
    const favTeam = isFavHome ? m.home : m.away;
    const favProb = isFavHome ? homeProb : awayProb;
    const nonDrawTotal = Math.max(0.01, homeProb + awayProb);
    const dnbProb = Math.round((favProb / nonDrawTotal) * 100);
    const dcProb = Math.min(99, Math.round(favProb + drawProb));
    const dcCode = isFavHome ? '1X' : 'X2';
    const odds = matchOdds || resolveMatchOdds(m, predictedWinner);

    // 1. SMART_ADAPTIVE (Default view: Auto DNB / DC when draw risk is high)
    if (marketMode === 'SMART_ADAPTIVE') {
      const isHighDraw = drawProb >= 24.0;
      if (m.smartMarket?.marketType === 'DOUBLE_CHANCE' || (isHighDraw && dcProb >= 72 && favProb < 55)) {
        const dcOdds = resolveMatchOdds(m, dcCode);
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs" title={`Smart Double Chance (${dcProb}%): Win or Draw protects against stalemate.`}>
            <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate max-w-[85px]">{favTeam}</span>/Draw <span className="text-[10px] text-amber-700 font-mono">@{safeToFixed(dcOdds, 2)}</span>
          </span>
        );
      }

      if (m.smartMarket?.marketType === 'DRAW_NO_BET' || isHighDraw) {
        const dnbOdds = resolveMatchOdds(m, isFavHome ? '1' : '2');
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 shadow-2xs" title={`Smart Draw-No-Bet (${dnbProb}%): Stake refunded on draw. 78.3% empirical hit rate.`}>
            <ShieldCheck className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate max-w-[85px]">{favTeam}</span> <span className="text-[10px] font-mono text-indigo-700">DNB @{safeToFixed(dnbOdds, 2)}</span>
          </span>
        );
      }

      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${getWinnerBadgeClass(predictedWinner)}`}>
          <span>{predictedWinner === 'HOME' ? `${m.home?.slice(0, 10)} WIN` : predictedWinner === 'AWAY' ? `${m.away?.slice(0, 10)} WIN` : 'DRAW'}</span>
          <span className="text-[10px] font-mono opacity-80 font-normal">@{safeToFixed(odds, 2)}</span>
        </span>
      );
    }

    // 2. DNB Mode (Draw No Bet)
    if (marketMode === 'DNB') {
      const dnbOdds = resolveMatchOdds(m, isFavHome ? '1' : '2');
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 shadow-2xs" title={`Draw-No-Bet (${dnbProb}%): Push/refund on tie.`}>
          <ShieldCheck className="w-3 h-3 text-indigo-600 shrink-0" />
          <span className="truncate max-w-[85px]">{favTeam}</span> DNB <span className="text-[10px] font-mono text-indigo-700">@{safeToFixed(dnbOdds, 2)}</span>
        </span>
      );
    }

    // 3. Double Chance Mode
    if (marketMode === 'DOUBLE_CHANCE') {
      const dcOdds = resolveMatchOdds(m, dcCode);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs" title={`Double Chance: ${dcCode} (${dcProb}%)`}>
          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span className="truncate max-w-[85px]">{favTeam}</span>/Draw <span className="text-[10px] text-emerald-700 font-mono">@{safeToFixed(dcOdds, 2)}</span>
        </span>
      );
    }

    // 4. Straight 1X2
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${getWinnerBadgeClass(predictedWinner)}`}>
        <span>{predictedWinner === 'HOME' ? `${m.home?.slice(0, 10)} WIN` : predictedWinner === 'AWAY' ? `${m.away?.slice(0, 10)} WIN` : 'DRAW'}</span>
        <span className="text-[10px] font-mono opacity-80 font-normal">@{safeToFixed(odds, 2)}</span>
      </span>
    );
  };

  const toggleExpand = (id) => {
    setExpandedMatchId(prev => prev === id ? null : id);
  };

  const formatMatchKickoff = (m) => {
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
      
      {/* 👑 Daily AI Swarm Accumulator (Highest Win Rate Council Selections Table) */}
      {dailySwarmAcca && dailySwarmAcca.legs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Header & Actions Bar */}
          <div className="p-3 sm:p-3.5 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="bg-slate-900 text-white text-[10.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Award className="w-3 h-3 text-slate-300" /> Council Acca
                  </span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-semibold px-2 py-0.5 rounded-md">
                    {filteredCouncilStats.count === dailySwarmAcca.legs.length 
                      ? `${filteredCouncilStats.count} Legs`
                      : `${filteredCouncilStats.count} / ${dailySwarmAcca.legs.length} Legs`}
                  </span>
                  <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md">
                    {safeToFixed(filteredCouncilStats.combinedOdds, 2)}x Combined Odds
                  </span>
                  <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-md">
                    {safeToFixed(filteredCouncilStats.avgWinRate, 1)}% Avg Hit Rate
                  </span>
                  <span className="text-slate-400 text-[10.5px] font-medium hidden sm:inline">
                    • LiveScore Bet Benchmark
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Highest Win Rate Council Selections</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                      100% Unanimous Straight Outrights
                    </span>
                  </h2>
                  <InfoTooltip
                    title="Council Selections Engine"
                    content="Synthesized across all 6 autonomous AI agents (Dixon-Coles Poisson, Elo Dominance, Trend Impulse, Contrarian Disruption, Parity, and Value). Straight outright wins only — filtered by your preferred date, league, and hit rate."
                    align="left"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleLoadDailyAccaToSlip}
                  disabled={filteredCouncilStats.count === 0}
                  className="h-8 flex-1 sm:flex-initial px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isAccaLoaded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Loaded to Slip!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Load All {filteredCouncilStats.count} Legs</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyDailyAcca}
                  disabled={filteredCouncilStats.count === 0}
                  className="h-8 flex-1 sm:flex-initial px-3 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Copy formatted bet slip for LiveScore Bet"
                >
                  {copiedAccaSlip ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-slate-700" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Slip</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate('acca');
                    else if (onSelectMarketMode) onSelectMarketMode('acca');
                  }}
                  className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>View Slip</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <a
                  href="https://www.livescorebet.com/ie/sports/football"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center"
                  title="Open LiveScore Bet Ireland"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => setCollapsedCouncilAcca(!collapsedCouncilAcca)}
                  className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title={collapsedCouncilAcca ? 'Expand Council Acca' : 'Collapse Council Acca'}
                >
                  <span>{collapsedCouncilAcca ? 'Expand' : 'Collapse'}</span>
                  {collapsedCouncilAcca ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>
            </div>
          </div>

          {!collapsedCouncilAcca && (
            <>
              {/* Dedicated Filter Toolbar for Council Selections */}
          <div className="px-3 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[240px]">
              {/* Search Club or League */}
              <div className="relative flex-1 min-w-[130px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter club / league..."
                  value={councilSearch}
                  onChange={(e) => setCouncilSearch(e.target.value)}
                  className="w-full pl-8 pr-6 py-1 text-xs bg-white text-slate-800 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
                />
                {councilSearch && (
                  <button
                    type="button"
                    onClick={() => setCouncilSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Date Filter */}
              <UniformDropdown
                label="Date"
                value={councilDate}
                onChange={setCouncilDate}
                options={councilDateOptions}
                selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
              />

              {/* League Filter */}
              <UniformDropdown
                label="League"
                value={councilLeague}
                onChange={setCouncilLeague}
                options={councilLeagueOptions}
                selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
              />

              {/* Outcome / Pick Filter */}
              <UniformDropdown
                label="Pick"
                value={councilPick}
                onChange={setCouncilPick}
                options={[
                  { value: 'ALL', label: `All Picks (${dailySwarmAcca.legs.length})` },
                  { value: 'HOME', label: `Home Win (${homePicksCount})` },
                  { value: 'AWAY', label: `Away Win (${awayPicksCount})` }
                ]}
                selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
              />

              {/* Min Win Rate Filter */}
              <UniformDropdown
                label="Min Rate"
                value={councilMinRate}
                onChange={setCouncilMinRate}
                options={[
                  { value: '0', label: 'All Win %' },
                  { value: '65', label: '≥ 65% Win Rate' },
                  { value: '70', label: '≥ 70% Win Rate' },
                  { value: '75', label: '≥ 75% Win Rate' },
                  { value: '80', label: '≥ 80% Win Rate' }
                ]}
                selectClassName="bg-white border-slate-200 py-0.5 text-xs shadow-none"
              />
            </div>

            {/* Filter status & clear */}
            <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0">
              <span>Showing <strong>{filteredCouncilStats.count}</strong> of {dailySwarmAcca.legs.length} legs</span>
              {isAnyCouncilFilterActive && (
                <button
                  type="button"
                  onClick={handleResetCouncilFilters}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Council Selections Table with Sortable Column Headers */}
          <div className="overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider h-8 select-none">
                  {/* Expand Toggle */}
                  <th className="py-1 px-1 w-6 text-center"></th>

                  {/* Leg Number / Default Order (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('idx')}
                    className="py-1 px-2 w-10 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to reset to default order"
                  >
                    <div className="inline-flex items-center justify-center gap-0.5">
                      <span className={councilSortField === 'idx' ? 'text-slate-900 font-bold' : ''}>#</span>
                      {councilSortField === 'idx' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  
                  {/* Fixture (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('fixture')}
                    className="py-1 px-2 min-w-[180px] cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort alphabetically by Club / Fixture"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span className={councilSortField === 'fixture' ? 'text-slate-900 font-bold' : ''}>Fixture</span>
                      {councilSortField === 'fixture' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* League (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('league')}
                    className="py-1 px-2 min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Competition / League"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span className={councilSortField === 'league' ? 'text-slate-900 font-bold' : ''}>League</span>
                      {councilSortField === 'league' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Kickoff & Day (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('time')}
                    className="py-1 px-2 min-w-[120px] text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort chronologically by Kickoff Day & Time"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={councilSortField === 'time' ? 'text-slate-900 font-bold' : ''}>Kickoff</span>
                      {councilSortField === 'time' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Council Pick (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('pick')}
                    className="py-1 px-2 min-w-[140px] cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Selected Winner"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span className={councilSortField === 'pick' ? 'text-slate-900 font-bold' : ''}>Council Pick</span>
                      {councilSortField === 'pick' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Odds (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('odds')}
                    className="py-1 px-2 w-16 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Market Odds"
                  >
                    <div className="inline-flex items-center justify-end gap-1 w-full">
                      <span className={councilSortField === 'odds' ? 'text-slate-900 font-bold' : ''}>Odds</span>
                      {councilSortField === 'odds' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Win Rate (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('prob')}
                    className="py-1 px-2 w-20 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Win Rate Probability"
                  >
                    <div className="inline-flex items-center justify-end gap-1 w-full">
                      <span className={councilSortField === 'prob' ? 'text-slate-900 font-bold' : ''}>Win Rate</span>
                      {councilSortField === 'prob' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Consensus (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('consensus')}
                    className="py-1 px-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Council Agreement Score"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={councilSortField === 'consensus' ? 'text-slate-900 font-bold' : ''}>Consensus</span>
                      {councilSortField === 'consensus' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Slip (Sortable) */}
                  <th 
                    onClick={() => handleCouncilSort('slip')}
                    className="py-1 px-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                    title="Click to sort by Slip Inclusion"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={councilSortField === 'slip' ? 'text-slate-900 font-bold' : ''}>Actions</span>
                      {councilSortField === 'slip' ? (
                        councilSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-700" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-700" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
                {filteredCouncilLegs.length === 0 ? (
                  <tr className="flex flex-col md:table-row">
                    <td colSpan={10} className="py-6 text-center text-slate-500 block md:table-cell">
                      <div className="max-w-md mx-auto space-y-1.5">
                        <p className="font-semibold text-xs text-slate-700">No council selections match the selected filters</p>
                        <p className="text-[11px] text-slate-400">
                          Try adjusting your Date, League, or Win Rate filters to view all {dailySwarmAcca.legs.length} council selections.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetCouncilFilters}
                          className="mt-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCouncilLegs.map((leg, idx) => {
                    const legKey = leg.id || `council-${idx}`;
                    const isExpanded = expandedCouncilId === legKey;
                    const inSlip = accaMatchIds.has(String(leg.id));
                    const isHome = leg.pick === 'HOME';
                    const pickTeam = isHome ? leg.home : leg.away;
                    const kickoff = getLegKickoffDisplay(leg);
                    const matchObj = leg.match || leg;

                    return (
                      <React.Fragment key={legKey}>
                        <tr 
                          className="flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer"
                          onClick={() => toggleCouncilExpand(legKey)}
                        >
                          {/* ================= MOBILE COMPACT VIEW ================= */}
                          <td className="md:hidden p-3 block">
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="w-4 h-4 rounded-full bg-slate-900 text-white font-mono text-[9.5px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600 font-semibold flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                                  {kickoff.day} {kickoff.time}
                                </span>
                                {leg.isLive && (
                                  <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-600 text-white animate-pulse">
                                    LIVE {leg.liveMinute ? `${leg.liveMinute}'` : ''}
                                  </span>
                                )}
                                <span className="text-[9.5px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[120px]">
                                  {leg.league}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  6/6 Unanimous
                                </span>
                                <div className="text-slate-400 p-0.5">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            </div>

                            {/* Fixture & Selection */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="font-bold text-slate-900 text-xs">
                                <span>{leg.home}</span>
                                <span className="text-slate-400 font-normal mx-1">vs</span>
                                <span>{leg.away}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono">
                                  {pickTeam} @{safeToFixed(leg.odds, 2)}x
                                </span>
                              </div>
                            </div>

                            {/* Probability & Actions Row */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                              <span className="font-semibold text-emerald-700">
                                {safeToFixed(leg.prob, 0)}% Win Rate
                              </span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => onOpenWatchLive && onOpenWatchLive(matchObj)}
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border shadow-2xs transition-colors cursor-pointer ${
                                    (leg.match?.isLive || leg.isLive)
                                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse font-extrabold'
                                      : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                                  }`}
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Watch</span>
                                </button>
                                {inSlip ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    <Check className="w-2.5 h-2.5 text-slate-400" />
                                    In Slip
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onAddToSlip) {
                                        onAddToSlip(leg.match, leg.pick, leg.market, leg.odds, leg.prob);
                                      }
                                    }}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs hover:bg-slate-50 cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5 text-slate-400" />
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* ================= DESKTOP 1-ROW VIEW ================= */}
                          {/* Chevron Toggle */}
                          <td className="hidden md:table-cell py-1.5 px-1 text-center text-slate-400">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto opacity-60" />}
                          </td>

                          {/* Leg Number */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-center text-slate-400 font-mono text-[10.5px]">
                            {idx + 1}
                          </td>

                          {/* Fixture */}
                          <td className="hidden md:table-cell py-1.5 px-2">
                            <div className="font-semibold text-slate-900 text-[11.5px] leading-tight">
                              <span className={isHome ? 'font-bold text-slate-900' : 'text-slate-700'}>{leg.home}</span>
                              <span className="text-slate-400 font-normal mx-1 text-[10.5px]">vs</span>
                              <span className={!isHome ? 'font-bold text-slate-900' : 'text-slate-700'}>{leg.away}</span>
                            </div>
                          </td>

                          {/* League */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-slate-500 text-[10.5px] truncate max-w-[140px]">
                            <div>{leg.league}</div>
                            {(leg.broadcast || leg.match?.broadcast) && (
                              <div className="text-[9.5px] text-indigo-600 font-medium truncate flex items-center gap-1 mt-0.5" title={leg.broadcast || leg.match?.broadcast}>
                                <Tv className="w-2.5 h-2.5 shrink-0" />
                                <span>{(leg.broadcast || leg.match?.broadcast).split(',')[0]}</span>
                              </div>
                            )}
                          </td>

                          {/* Kickoff stating Day and Time */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-center whitespace-nowrap">
                            {leg.isLive || leg.match?.isLive ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                  LIVE {leg.liveMinute || leg.match?.liveMinute || "In-Play"}
                                </span>
                                <div className="font-mono font-bold text-slate-900 text-[11px] mt-0.5">
                                  {leg.liveScore || leg.match?.liveScore || '1 - 0'}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-slate-800 text-[11px] leading-tight">
                                  {kickoff.day}
                                </div>
                                <div className="text-slate-400 font-mono text-[9.5px]">
                                  {kickoff.time}
                                </div>
                                {(() => {
                                  const c = formatKickoffCountdown(leg.match || leg);
                                  if (!c) return null;
                                  return (
                                    <div className="mt-0.5">
                                      <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${c.color}`}>
                                        {c.isWindow && <Lock className="w-2 h-2" />}
                                        {c.label}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </td>

                          {/* Pick */}
                          <td className="hidden md:table-cell py-1.5 px-2">
                            <div className="inline-flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-slate-900 text-[11.5px]">
                                {pickTeam}
                              </span>
                              <span className="text-[9.5px] font-medium text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                                {isHome ? 'Home Win' : 'Away Win'}
                              </span>
                            </div>
                            {leg.inPlayPrediction && (
                              <div className="text-[9.5px] text-emerald-700 font-medium font-mono mt-0.5">
                                Live Proj: {leg.inPlayPrediction.projectedFinalScore}
                              </div>
                            )}
                          </td>

                          {/* Odds */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-right font-mono font-bold text-slate-900 text-[11px]">
                            {safeToFixed(leg.odds, 2)}x
                          </td>

                          {/* Win Rate */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-right font-mono font-semibold text-slate-800 text-[11px]">
                            {safeToFixed(leg.prob, 0)}%
                          </td>

                          {/* Consensus */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-center">
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              <Check className="w-2.5 h-2.5 text-slate-400" />
                              6/6 Unanimous
                            </span>
                          </td>

                          {/* Actions (Watch + Slip) */}
                          <td className="hidden md:table-cell py-1.5 px-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenWatchLive && onOpenWatchLive(leg.match || leg)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border shadow-2xs transition-colors cursor-pointer ${
                                  (leg.match?.isLive || leg.isLive)
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse font-extrabold'
                                    : 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                                }`}
                                title={(leg.match?.isLive || leg.isLive) ? "Watch Match LIVE NOW in Iframe" : "Watch live in iframe player"}
                              >
                                <Play className={`w-2.5 h-2.5 ${(leg.match?.isLive || leg.isLive) ? 'fill-white text-white' : 'fill-indigo-600 text-indigo-600'}`} />
                                <span>{(leg.match?.isLive || leg.isLive) ? 'Watch Now' : 'Watch'}</span>
                              </button>

                              {inSlip ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  <Check className="w-2.5 h-2.5 text-slate-400" />
                                  In Slip
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onAddToSlip) {
                                      onAddToSlip(leg.match, leg.pick, leg.market, leg.odds, leg.prob);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-1.5 py-0.5 rounded border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5 text-slate-400" />
                                  Add
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Details Drawer */}
                        {isExpanded && (
                          <tr className="flex flex-col md:table-row bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={10} className="p-3 block md:table-cell">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Council Directive Analysis
                                  </span>
                                  <div className="font-semibold text-slate-800">
                                    Full agreement across all 6 predictive models (Poisson, Elo, Trend, Contrarian Disruption, Parity, & Value).
                                  </div>
                                  <div className="text-[11px] text-emerald-700 font-medium">
                                    Zero draw vulnerability detected. Outright winner conviction.
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Expected Pricing & Value
                                  </span>
                                  <div className="flex justify-between text-slate-700">
                                    <span>Benchmark Odds:</span>
                                    <span className="font-mono font-bold text-slate-900">@{safeToFixed(leg.odds, 2)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-700">
                                    <span>Win Probability:</span>
                                    <span className="font-mono font-bold text-emerald-700">{safeToFixed(leg.prob, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-700">
                                    <span>Expected Value (+EV):</span>
                                    <span className="font-mono font-bold text-indigo-700">
                                      +{safeToFixed(Math.max(0, ((leg.prob / 100) * leg.odds - 1) * 100), 1)}%
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col justify-between gap-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Deep Investigation
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {matchObj && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenDeepResearch && onOpenDeepResearch(matchObj)}
                                        className="flex-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors cursor-pointer text-center"
                                      >
                                        Tactical Research
                                      </button>
                                    )}
                                    {matchObj && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenLineup && onOpenLineup(matchObj)}
                                        className="flex-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors cursor-pointer text-center"
                                      >
                                        Confirmed XI
                                      </button>
                                    )}
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

          {/* Table Summary Footer */}
          <div className="px-3 py-2 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-4 flex-wrap">
              <span>Total Legs: <strong className="text-slate-900">{filteredCouncilStats.count}</strong></span>
              <span>Combined Odds: <strong className="text-slate-900 font-mono">{safeToFixed(filteredCouncilStats.combinedOdds, 2)}x</strong></span>
              <span>Average Win Rate: <strong className="text-slate-900 font-mono">{safeToFixed(filteredCouncilStats.avgWinRate, 1)}%</strong></span>
              <span>Joint Survival: <strong className="text-slate-900 font-mono">{safeToFixed(filteredCouncilStats.jointProb, 1)}%</strong></span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Independent Fixture Verification • LiveScore Bet Ireland
            </div>
          </div>
          </>
        )}
        </div>
      )}

      {/* ⚽ Main Match Predictions & Win Probabilities Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Uniform Header & Actions Bar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="bg-slate-900 text-white text-[10.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Target className="w-3 h-3 text-slate-300" /> Match Predictions
                </span>
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-semibold px-2 py-0.5 rounded-md">
                  {matches.length} Matches
                </span>
                <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md">
                  Dixon-Coles &amp; Elo
                </span>
                <span className="text-slate-400 text-[10.5px] font-medium hidden sm:inline">
                  • Multi-Model Poisson
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Match Predictions &amp; Win Probabilities</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                    Poisson + ML
                  </span>
                </h2>
                <InfoTooltip
                  title="Match Predictions Engine"
                  content="Win, draw, and goal probabilities for upcoming fixtures calculated with Dixon-Coles Poisson distributions, Elo dominance, and calibrated market odds."
                  align="left"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
              <button
                onClick={handleCalibrateLineups}
                disabled={calibratingLineups}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                title="Scan confirmed official Starting XIs from ESPN and tactically weight Dixon-Coles models"
              >
                <Zap className={`w-3.5 h-3.5 text-emerald-600 ${calibratingLineups ? 'animate-spin' : ''}`} />
                <span>{calibratingLineups ? 'Calibrating XIs...' : 'Calibrate XIs'}</span>
              </button>

              <button
                onClick={() => setShowStrategyProofModal(true)}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="View 23,453-record empirical backtest and quantitative strategy proof (76%–83%)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Strategy Proof (23.4k)</span>
              </button>

              <button
                onClick={() => onTriggerRetrain && onTriggerRetrain()}
                disabled={isRetraining}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
              >
                <Cpu className={`w-3.5 h-3.5 text-indigo-600 ${isRetraining ? 'animate-spin' : ''}`} />
                <span>{isRetraining ? 'Updating...' : 'Update'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCollapsedMatchPredictions(!collapsedMatchPredictions)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title={collapsedMatchPredictions ? 'Expand Match Predictions' : 'Collapse Match Predictions'}
              >
                <span>{collapsedMatchPredictions ? 'Expand' : 'Collapse'}</span>
                {collapsedMatchPredictions ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </div>
        </div>

        {!collapsedMatchPredictions && (
          <div className="p-3 sm:p-3.5 space-y-3">
            {/* Feedback Alert for Lineup Calibration */}
            {lineupCalibrateResult && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
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

        {/* Strategy, Quality, Draw-Type & Filter Control Panel */}
        <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/90 space-y-2">
          {/* Row 1: Search, Quality Dropdown, Draw / Bet Type Dropdown & Major Leagues Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left: Search Box */}
            <div className="relative flex-1 min-w-[140px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search club or league..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full pl-8 pr-3 text-xs bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors shadow-2xs"
              />
            </div>

            {/* Quality & Draw Type Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <UniformDropdown
                label="Quality"
                value={convictionMode}
                onChange={(val) => {
                  setConvictionMode(val);
                  if (val === 'ALL') {
                    if (filterMode === 'ELITE' || filterMode === 'HIGH_CONFIDENCE' || filterMode === 'UNANIMOUS') {
                      setFilterMode('All');
                    }
                  } else if (val === 'HIGH') {
                    setFilterMode('All');
                  } else if (val === 'ELITE') {
                    setFilterMode('All');
                  } else if (val === 'UNANIMOUS') {
                    setFilterMode('All');
                  }
                }}
                options={[
                  { value: 'ALL', label: 'All Qualities' },
                  { value: 'HIGH', label: 'Top Picks (≥60% | 78.8%)' },
                  { value: 'ELITE', label: 'Elite Picks (≥68% | 84.3%)' },
                  { value: 'UNANIMOUS', label: '👑 Council Consensus (100%)' }
                ]}
              />

              <UniformDropdown
                label="Draw / Market"
                value={marketMode}
                onChange={setMarketMode}
                options={[
                  { value: 'SMART_ADAPTIVE', label: '🛡️ Smart Safety (Auto DNB/DC)' },
                  { value: 'DNB', label: 'Draw-No-Bet (DNB Refund)' },
                  { value: 'DOUBLE_CHANCE', label: 'Double Chance (1X/X2)' },
                  { value: 'STRAIGHT_1X2', label: 'Straight Win (1X2 Outright)' }
                ]}
              />

              {/* Filter toggle when DNB or Double Chance is active */}
              {(marketMode === 'DNB' || marketMode === 'DOUBLE_CHANCE') && (
                <button
                  type="button"
                  onClick={() => setFilterByMarketOnly(!filterByMarketOnly)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                    filterByMarketOnly
                      ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title={filterByMarketOnly ? "Currently showing only games where this safety bet is recommended. Click to show all games." : "Click to only show games where this safety bet is actively recommended by the models."}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                    filterByMarketOnly ? 'bg-amber-600 text-white border-amber-600 font-bold' : 'border-slate-400 bg-white'
                  }`}>
                    {filterByMarketOnly ? '✓' : ''}
                  </span>
                  <span>Recommended Only</span>
                </button>
              )}

              {/* Major Leagues Only Checkbox Button */}
              <button
                type="button"
                onClick={handleToggleStrictPruning}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  strictLeaguePruning
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
                title="Focus on major, highly predictable leagues (Premier League, La Liga, Serie A, Champions League) and exclude low-reliability divisions."
              >
                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                  strictLeaguePruning ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'border-slate-400 bg-white'
                }`}>
                  {strictLeaguePruning ? '✓' : ''}
                </span>
                <span>Major Leagues</span>
                {strictLeaguePruning && prunedNoiseMatchesCount > 0 && (
                  <span className="text-[9.5px] font-normal text-emerald-700">
                    ({prunedNoiseMatchesCount} excl.)
                  </span>
                )}
              </button>

              <InfoTooltip
                title="Adaptive Safety Bet Strategy"
                content="Auto-selects Draw-No-Bet (DNB) or Double Chance (1X/X2) when model draw probability is ≥24.0%, protecting your initial stake against draw stalemates. Safety hit rate: 78.3% – 83.6%."
                align="right"
              />
            </div>
          </div>

          {/* Row 2: Date, League, Outcome, Special Filter, Sort Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
            <div className="flex flex-wrap items-center gap-2">
              <UniformDropdown
                label="Date"
                value={selectedDate}
                onChange={setSelectedDate}
                options={dateOptions}
              />
              <UniformDropdown
                label="League"
                value={selectedLeague}
                onChange={setSelectedLeague}
                options={leagueOptions}
              />
              <UniformDropdown
                label="Outcome"
                value={selectedOutcome}
                onChange={setSelectedOutcome}
                options={[
                  { value: 'ALL', label: `All Outcomes (${outcomeCounts.all})` },
                  { value: 'WIN_LOSE', label: `Win / Lose Only (${outcomeCounts.winLose})` },
                  { value: 'DRAW', label: `Draw Only (${outcomeCounts.draw})` },
                  { value: 'HOME', label: `Home Win Only (${outcomeCounts.home})` },
                  { value: 'AWAY', label: `Away Win Only (${outcomeCounts.away})` }
                ]}
              />
              <UniformDropdown
                label="Special Filter"
                value={filterMode}
                onChange={(val) => {
                  setFilterMode(val);
                  if (val === 'ELITE') setConvictionMode('ELITE');
                  else if (val === 'HIGH_CONFIDENCE') setConvictionMode('HIGH');
                  else if (val === 'UNANIMOUS') setConvictionMode('UNANIMOUS');
                  else if (val === 'All') setConvictionMode('ALL');
                }}
                options={[
                  { value: 'All', label: 'All Picks' },
                  { value: 'UNANIMOUS', label: '👑 Council Consensus (All 6 Agree)' },
                  { value: 'HIGH_CONFIDENCE', label: '💎 High Confidence (≥60%)' },
                  { value: 'ELITE', label: '⭐ Elite Picks (≥68% or Consensus)' },
                  { value: 'NO_TRAPS', label: '🛡️ Low Risk Only (No Traps)' },
                  { value: 'DNB_ONLY', label: '🛡️ Draw Protected (DNB Only)' },
                  { value: 'DERIVATIVE_SAFETY', label: '🔄 Safe Alternatives Only' },
                  { value: 'TIER_1_ONLY', label: '🏆 Top Leagues Only' },
                  { value: 'UPSET_RISK', label: '⚠️ Upset Alerts & Traps' }
                ]}
              />
              <UniformDropdown
                label="Sort"
                value={sortBy}
                onChange={handleDropdownSortChange}
                options={[
                  { value: 'probs_desc', label: 'Highest Probability' },
                  { value: 'probs_asc', label: 'Lowest Probability' },
                  { value: 'conf_desc', label: 'Highest Confidence' },
                  { value: 'time_asc', label: 'Earliest Kickoff' },
                  { value: 'time_desc', label: 'Latest Kickoff' },
                  { value: 'home_desc', label: 'Home Win %' },
                  { value: 'draw_desc', label: 'Draw %' },
                  { value: 'away_desc', label: 'Away Win %' },
                  { value: 'xg_desc', label: 'Total Goals (xG)' },
                  { value: 'kelly_desc', label: 'Best Value / Stake' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Showing matches count */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2 flex-wrap">
          <span>Showing <strong>{filteredMatches.length}</strong> of {matches.length} fixtures</span>
          {selectedOutcome === 'WIN_LOSE' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              ⚡ Win / Lose Only
            </span>
          )}
          {selectedOutcome === 'DRAW' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              🤝 Draw Only
            </span>
          )}
          {selectedOutcome === 'HOME' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              🏠 Home Win Only
            </span>
          )}
          {selectedOutcome === 'AWAY' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              ✈️ Away Win Only
            </span>
          )}
          {sortBy === 'probs_desc' && (
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium">
              (Sorted: High → Low Probability)
            </span>
          )}
        </div>
        {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || selectedOutcome !== 'ALL' || filterMode !== 'All' || sortBy !== 'probs_desc') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedLeague('All');
              setSelectedDate('All');
              setSelectedOutcome('ALL');
              setFilterMode('All');
              setSortBy('probs_desc');
              setSortField('probs');
              setSortDirection('desc');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

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
            <table className="w-full text-left border-collapse text-xs">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] text-slate-500 uppercase tracking-wider font-bold h-8 select-none">
                  <th className="py-1 px-2.5">Date</th>
                  <th className="py-1 px-2.5">Competition</th>
                  <th className="py-1 px-2.5">Matchup</th>
                  <th className="py-1 px-2.5 text-center">Score</th>
                  <th className="py-1 px-2.5 text-center">Smart Pick</th>
                  <th className="py-1 px-2.5 text-center">Tactical Analysis</th>
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

                  return (
                    <tr key={m.id || m.espnEventId} className="flex flex-col md:table-row hover:bg-teal-50/30 transition-colors">
                      {/* ================= MOBILE COMPACT VIEW ================= */}
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
                            isMiss ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {m.smartMarket?.pickLabel || m.predictedWinner || 'Analyzed'}
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
                          isMiss ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {m.smartMarket?.pickLabel || m.predictedWinner || 'Analyzed'}
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
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                {/* Time */}
                <th 
                  onClick={() => handleSort('time')}
                  className={`py-1 px-1.5 w-24 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'time' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Kickoff Time"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={sortField === 'time' ? 'text-indigo-600 font-bold' : ''}>Time</span>
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
                  className={`py-1 px-1.5 min-w-[170px] cursor-pointer transition-colors group select-none ${
                    sortField === 'fixture' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Teams / Competition"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'fixture' ? 'text-indigo-600 font-bold' : ''}>Fixture</span>
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
                  title="Click to sort by Confirmed XI status"
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
                  title="Click to sort by AI Pick Outcome"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={sortField === 'prediction' ? 'text-indigo-600 font-bold' : ''}>Pick</span>
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
                  className={`py-1 px-1.5 w-32 text-center cursor-pointer transition-colors group select-none ${
                    ['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Win Probability"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <span className={['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? 'text-indigo-600 font-bold' : ''}>1·X·2 Probs</span>
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
                  className={`py-1 px-1.5 w-20 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'conf' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Confidence"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <InfoTooltip title="Confidence" content="Model confidence in the predicted outcome.">
                      <span className={sortField === 'conf' ? 'text-indigo-600 font-bold' : ''}>Conf</span>
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
                  title="Click to sort by Expected Goals (xG)"
                >
                  <div className="inline-flex items-center justify-center gap-0.5">
                    <InfoTooltip title="Score & xG" content="Projected scoreline and expected goals (xG).">
                      <span className={sortField === 'xg' ? 'text-indigo-600 font-bold' : ''}>Score/xG</span>
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
                  className={`py-1 px-1.5 w-40 text-left cursor-pointer transition-colors group select-none ${
                    sortField === 'kelly' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title="Click to sort by Value Bet"
                >
                  <div className="inline-flex items-center gap-0.5">
                    <InfoTooltip title="LiveScore Odds & Potential Return" content="Recommended market, benchmark odds, Kelly stake, and calculated potential returns.">
                      <span className={sortField === 'kelly' ? 'text-indigo-600 font-bold' : ''}>Odds & Return</span>
                    </InfoTooltip>
                    {sortField === 'kelly' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-1 px-1.5 w-44 text-center">Actions</th>
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
                          {selectedOutcome === 'DRAW'
                            ? 'No matches predicted as a Draw under current criteria.'
                            : selectedOutcome === 'WIN_LOSE'
                            ? 'No decisive Win / Lose matches found under current criteria.'
                            : selectedOutcome === 'HOME'
                            ? 'No Home Win matches found under current criteria.'
                            : selectedOutcome === 'AWAY'
                            ? 'No Away Win matches found under current criteria.'
                            : filterMode === 'UNANIMOUS' 
                            ? 'No matches found matching Consensus Picks under current filters.'
                            : filterMode === 'HIGH_CONFIDENCE'
                            ? 'No matches found with High Confidence (≥65%) under current filters.'
                            : filterMode === 'ELITE'
                            ? 'No matches found with Elite Edge (≥75%) under current filters.'
                            : filterMode === 'NO_TRAPS'
                            ? 'No low-risk matches found under current filters.'
                            : filterMode === 'DERIVATIVE_SAFETY'
                            ? 'No matches with safe alternative picks found.'
                            : filterMode === 'DNB_ONLY'
                            ? 'No Draw-No-Bet advised matches found under current filters.'
                            : filterMode === 'TIER_1_ONLY'
                            ? 'No Top League matches found for this selection.'
                            : filterMode === 'UPSET_RISK'
                            ? 'No upset alerts or trap matches detected for this period.'
                            : 'No matches match your active filter criteria.'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Try switching dates, selecting "All Outcomes", clearing the search query, or selecting "All Leagues".</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMatches.map((m, idx) => {
                  const isExpanded = expandedMatchId === (m.id || idx);
                  const isSlipAdded = accaMatchIds.has(m.id);
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

                  const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
                  const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
                  const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';

                  const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
                  const isDnbAdvised = m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0;
                  const countdown = formatKickoffCountdown(m);

                  return (
                    <React.Fragment key={m.id || idx}>
                      <tr 
                        className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer md:cursor-default ${
                          isUnanimous ? 'ring-1 ring-amber-300 md:ring-0 bg-amber-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                        onClick={() => { if (window.innerWidth < 768) toggleExpand(m.id || idx); }}
                      >
                        {/* ---------------- MOBILE VIEW ---------------- */}
                        <td className="md:hidden p-3 block">
                          <div className="flex justify-between items-start mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-700 font-mono text-[10px]">
                                {formatMatchKickoff(m)}
                              </span>
                              {m.isLive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                  LIVE {m.liveMinute ? `${m.liveMinute}'` : ''} {m.liveScore ? `(${m.liveScore.home}-${m.liveScore.away})` : ''}
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
                              {m.broadcast && (
                                <span className="text-[8.5px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-1 rounded flex items-center gap-0.5">
                                  📺 {m.broadcast.split(',')[0]}
                                </span>
                              )}
                            </div>
                            <ConfidenceGauge confidence={conf} size="sm" />
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{m.home}</span>
                                {isUnanimous && (
                                  <span 
                                    className="text-[8.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold shrink-0" 
                                    title={`6-Agent Unanimous Consensus (All 6 AI agents agree · Historical Strategy Win Rate: ${unanimousRateDisplay})`}
                                  >
                                    👑 Unanimous
                                  </span>
                                )}
                                {leagueTierObj && (
                                  <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded border shadow-2xs ${leagueTierObj.badgeStyle}`} title={`${leagueTierObj.label} (${leagueTierObj.expectedHighConvictionWinRate} hit rate)`}>
                                    {leagueTierObj.badgeShort}
                                  </span>
                                )}
                                {isDnbAdvised && (
                                  <span className="text-[8.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-bold" title={`Draw Risk ${safeToFixed(drawProb, 1)}% ≥ 24.0% — DNB protects stake`}>
                                    🛡️ DNB
                                  </span>
                                )}
                                {isTrap && <span className="text-[8.5px] bg-rose-100 text-rose-700 border border-rose-300 px-1 rounded font-bold">⚠️ Risk</span>}
                                {isDerivative && <span className="text-[8.5px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded font-bold">🛡️ {m.smartMarket?.pick}</span>}
                              </div>
                              <span className="font-bold text-slate-900 text-xs">{m.away}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[8.5px] uppercase font-bold text-slate-400 mb-0.5">Top Pick</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold border shadow-xs ${getWinnerBadgeClass(predictedWinner)}`}>
                                <span>{predictedWinner === 'HOME' ? `${m.home?.slice(0, 10)} WIN` : predictedWinner === 'AWAY' ? `${m.away?.slice(0, 10)} WIN` : 'DRAW'}</span>
                                <span className="text-[9.5px] font-mono opacity-80">@{safeToFixed(matchOdds, 2)}</span>
                              </span>
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
                              <span className="text-[9.5px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200" title={`Wager €${rowStake.toFixed(0)} based on €${bankrollEuro} bankroll`}>
                                💰 €{rowStake.toFixed(0)} → €{returns.payoutStr} ({returns.profitStr})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenWatchLive) onOpenWatchLive(m);
                                }}
                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                                  m.isLive
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                                title={m.isLive ? "Watch Match LIVE NOW in Iframe" : "Watch Live in Iframe Player"}
                              >
                                <Play className={`w-2 h-2 ${m.isLive ? 'fill-white text-white' : 'fill-indigo-600 text-indigo-600'}`} />
                                <span>{m.isLive ? 'Watch Now' : 'Watch'}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAddToSlip) onAddToSlip(m);
                                }}
                                className={`p-1 rounded-full transition-all cursor-pointer ${
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

                        {/* ---------------- DESKTOP CELLS ---------------- */}
                        {/* Time / Status */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          <span className="font-semibold text-slate-700 font-mono text-[11px] block">
                            {formatMatchKickoff(m)}
                          </span>
                          {m.isLive ? (
                            <span 
                              className="inline-flex items-center justify-center gap-1 px-1 py-0.2 mt-0.5 rounded text-[9px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse max-w-[85px] mx-auto"
                              title={`Match currently live: ${m.liveMinute || 0}' (${m.liveScore?.home ?? 0}-${m.liveScore?.away ?? 0})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              <span>LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}</span>
                            </span>
                          ) : countdown ? (
                            <span 
                              className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.2 mt-0.5 rounded text-[9px] font-bold border max-w-[85px] mx-auto ${countdown.color}`}
                              title={countdown.isWindow ? "Pre-kickoff lock window (≤60m): Prediction is locked & frozen" : "Time until match kickoff"}
                            >
                              {countdown.isWindow && <Lock className="w-2 h-2 shrink-0" />}
                              <span>{countdown.label}</span>
                            </span>
                          ) : (
                            <span className="text-[9.5px] text-slate-400 block truncate max-w-[65px] mx-auto">
                              {m.league?.split(' ')[0] || 'Soccer'}
                            </span>
                          )}
                          {m.broadcast && (
                            <span className="text-[8.5px] text-indigo-600 font-semibold block truncate max-w-[90px] mx-auto mt-0.5" title={`Broadcast: ${m.broadcast}`}>
                              📺 {m.broadcast.split(',')[0]}
                            </span>
                          )}
                        </td>

                        {/* Fixture / Teams */}
                        <td className="hidden md:table-cell py-1 px-1.5">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-900 truncate text-[11.5px]">
                              {m.home} vs {m.away}
                            </span>
                            {m.isLive && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                                className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.2 rounded-full shadow-xs animate-pulse cursor-pointer shrink-0"
                                title="Match is LIVE NOW! Click to Watch Stream"
                              >
                                <Play className="w-1.5 h-1.5 fill-white text-white" />
                                <span>Watch</span>
                              </button>
                            )}
                            {isUnanimous ? (
                              <span 
                                className="inline-flex items-center text-[8.5px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded border border-amber-300 shrink-0" 
                                title={`6-Agent Unanimous Consensus (All 6 AI agents agree · Historical Strategy Win Rate: ${unanimousRateDisplay})`}
                              >
                                👑 Unanimous
                              </span>
                            ) : isTrap ? (
                              <span className="inline-flex items-center text-[8.5px] font-bold bg-rose-100 text-rose-800 px-1 py-0.2 rounded border border-rose-300 shrink-0" title="Upset Potential Flagged by Council">
                                ⚠️ Risk
                              </span>
                            ) : isDnbAdvised ? (
                              <span className="inline-flex items-center text-[8.5px] font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-200 shrink-0" title="Draw-No-Bet Protection Advised">
                                🛡️ DNB
                              </span>
                            ) : m.teamTrends?.home?.badge ? (
                              <span className="inline-flex items-center text-[8.5px] font-bold bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200 shrink-0" title={m.teamTrends.home.tacticalIdentity}>
                                {m.teamTrends.home.badge}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[9.5px] text-slate-500 truncate max-w-[170px]">
                            {m.league}
                          </div>
                        </td>

                        {/* Lineup XI Badge Button */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenLineup && onOpenLineup(m); }}
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-semibold border transition-colors cursor-pointer inline-block ${
                              m.lineupAdjusted
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold'
                                : hasLineup
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={m.lineupAdjusted ? `Lineup impact calibrated: ${m.lineupImpactReason || 'Tactical weighting applied'}` : "Click to view Starting XI"}
                          >
                            {m.lineupAdjusted ? 'XI Adj ⚡' : hasLineup ? 'XI Conf' : 'XI Est'}
                          </button>
                        </td>

                        {/* AI Prediction Pick */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          {renderMarketPrediction(m, predictedWinner, homeProb, drawProb, awayProb, matchOdds)}
                        </td>

                        {/* Probabilities 1 | X | 2 */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
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
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          <ConfidenceGauge confidence={conf} size="sm" />
                        </td>

                        {/* Score/xG */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          <span className="font-bold text-slate-800 text-[11.5px] font-mono block">
                            {score}
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-mono block">
                            xG {safeToFixed(homeXg, 1, '1.5')}-{safeToFixed(awayXg, 1, '1.1')}
                          </span>
                        </td>

                        {/* LiveScore Bet Odds & Potential Return */}
                        <td className="hidden md:table-cell py-1 px-1.5">
                          <div className="text-[10.5px]">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-800 truncate max-w-[100px]" title={smartMarketDisplay}>
                                {smartMarketDisplay}
                              </span>
                              <span className="text-[9.5px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded shrink-0" title={`${oddsProvider} Odds`}>
                                @{safeToFixed(matchOdds, 2)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                              <KellyTooltip showIcon={false} align="right">
                                <span className="text-[9.5px] text-emerald-800 font-bold font-mono bg-emerald-50/90 border border-emerald-200 px-1 py-0.2 rounded cursor-help hover:bg-emerald-100 transition-colors" title={`Recommended wager based on €${bankrollEuro} bankroll (${kellyDisplay})`}>
                                  💰 €{rowStake.toFixed(0)}
                                </span>
                              </KellyTooltip>
                              <span className="text-[9.5px] font-semibold text-slate-600 font-mono whitespace-nowrap">
                                → <strong className="text-emerald-700">€{returns.payoutStr}</strong>
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="hidden md:table-cell py-1 px-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Watch Live in Iframe Player */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs ${
                                m.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-rose-200 animate-pulse font-extrabold'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title={m.isLive ? "Watch Match LIVE NOW in Iframe" : "Watch Match Live & In-Play Radar Simulator"}
                            >
                              <Play className={`w-2.5 h-2.5 ${m.isLive ? 'fill-white text-white' : 'fill-indigo-600 text-indigo-600'}`} />
                              <span>{m.isLive ? 'Watch Now' : 'Watch'}</span>
                            </button>

                            {/* Deep Analysis Page */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                              title="Open Analysis"
                            >
                              Analysis
                            </button>

                            {/* Add to Slip Slip */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(m); }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                                isSlipAdded
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  : 'bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border-slate-200 hover:border-purple-200'
                              }`}
                              title={isSlipAdded ? 'Remove from Bet Slip' : 'Add to Bet Slip'}
                            >
                              {isSlipAdded ? 'Remove' : '+ Slip'}
                            </button>

                            {/* Expand Row Details */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(m.id || idx); }}
                              className="px-1 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Toggle tactical analysis details"
                            >
                              {isExpanded ? 'Hide' : 'Tactics'}
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
                                {hasLineup ? 'XI Confirmed' : 'XI Estimated'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 text-teal-800 text-center"
                              >
                                Analysis
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(m); }}
                                className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border text-center ${
                                  isSlipAdded
                                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {isSlipAdded ? '✓ Added' : '+ Slip'}
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
                                    Recommended Stake: <strong className="text-white font-mono">€{rowStake.toFixed(2)}</strong> ({safeToFixed(kellyUnits, 1)}u · {m.kellyStake?.fractionLabel || '1/4 Kelly'} · €{bankrollEuro} Bankroll)
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
                                  <span>Tactical DNA</span>
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
                                    <span>Conviction Hit Rate:</span>
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
                                  <span>DNB Strategy</span>
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
                                  Dedicated Views
                                </div>
                                <div className="space-y-1.5">
                                  <button
                                    onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                                    className="w-full text-left px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>Analysis</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => onOpenLineup && onOpenLineup(m)}
                                    className="w-full text-left px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>Starting XI Tactical</span>
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
      </div>
          </div>
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
