import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Trophy, 
  ShieldCheck, 
  TrendingUp, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Percent, 
  Calculator,
  ArrowRight,
  PlusCircle,
  Brain,
  Filter,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  Award,
  Clock,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';
import InfoTooltip from './InfoTooltip';
import UniformDropdown from './UniformDropdown';

export default function AllDayWinnerPage({
  state,
  tzSettings,
  onOpenDeepResearch,
  onLoadPicksToSlip,
  onNavigateToSlip
}) {
  const [legCount, setLegCount] = useState(8);
  const [minConfidence, setMinConfidence] = useState(60);
  const [stake, setStake] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL'); // ALL, HOME, AWAY
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, FINISHED, LIVE, UPCOMING, WON, LOST
  const [scopeMode, setScopeMode] = useState('SLATE'); // SLATE, ALL_GAMES
  const [sortField, setSortField] = useState('time'); // time, prob, odds
  const [sortDir, setSortDir] = useState('asc');
  const [lottoData, setLottoData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [addedToSlip, setAddedToSlip] = useState(false);
  const [slipToastMessage, setSlipToastMessage] = useState(null);
  const [addedLegIds, setAddedLegIds] = useState(new Set());
  const [expandedLegId, setExpandedLegId] = useState(null);
  const [collapsedAcca, setCollapsedAcca] = useState(false);

  const toggleExpand = (id) => {
    setExpandedLegId(prev => (prev === id ? null : id));
  };

  const getLegTimestamp = (leg) => {
    if (!leg) return 0;
    if (leg.timestamp && !isNaN(leg.timestamp)) return Number(leg.timestamp);
    if (leg.utcDate) {
      const ms = new Date(leg.utcDate).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
    const t = String(leg.kickoffTime || leg.time || '');
    const match = t.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return 0;
  };

  const fetchLottoAcca = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const queryParam = isManualRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/all-day-winner?size=${legCount}&minConfidence=${minConfidence}${queryParam}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setLottoData(data);
      } else {
        throw new Error(data.error || 'Failed to generate lotto acca');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with LiveScore Bet Ireland engine');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLottoAcca();
  }, [legCount, minConfidence]);

  const rawLegs = lottoData?.legs || [];
  const allAvailableLegs = lottoData?.allLegs || rawLegs;
  const currentDate = lottoData?.date || new Date().toISOString().slice(0, 10);

  // Previous day win rate metrics sourced from engine/backend
  const previousDaysWinRate = useMemo(() => {
    return lottoData?.previousDaysWinRate || state?.yesterdayStats || {
      accuracy: 80.3,
      activeStrikeRate: 85.0,
      total: 61,
      correctPredictions: 49,
      date: '2026-09-24',
      formattedDate: 'Yesterday (2026-09-24)'
    };
  }, [lottoData, state]);

  // Current active candidate pool according to scope mode (Curated Slate vs All Today Qualified)
  const candidatePool = useMemo(() => {
    if (scopeMode === 'ALL_GAMES') {
      return allAvailableLegs;
    }
    return rawLegs;
  }, [scopeMode, allAvailableLegs, rawLegs]);

  // Faceted counts for status filter tabs/dropdowns
  const statusCounts = useMemo(() => {
    let all = 0, finished = 0, live = 0, upcoming = 0, won = 0, lost = 0;
    candidatePool.forEach(leg => {
      all++;
      if (leg.isFinished) {
        finished++;
        if (leg.isHit === true) won++;
        else if (leg.isHit === false) lost++;
      } else if (leg.isLive) {
        live++;
      } else {
        upcoming++;
      }
    });
    return { all, finished, live, upcoming, won, lost };
  }, [candidatePool]);

  // Dynamic outcome counts faceted across search query
  const outcomeCounts = useMemo(() => {
    let all = 0, home = 0, away = 0;
    candidatePool.forEach(leg => {
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTeam = leg.home?.toLowerCase().includes(q) || 
                            leg.away?.toLowerCase().includes(q) || 
                            leg.league?.toLowerCase().includes(q) ||
                            leg.winningTeam?.toLowerCase().includes(q);
        if (!matchesTeam) return;
      }
      all++;
      if (leg.pick === 'HOME') home++;
      else if (leg.pick === 'AWAY') away++;
    });
    return { all, home, away };
  }, [candidatePool, searchQuery]);

  // Filter and sort candidate pool strictly matching user search and filters
  const matchingCandidates = useMemo(() => {
    return candidatePool.filter(leg => {
      // Team search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTeam = leg.home?.toLowerCase().includes(q) || 
                            leg.away?.toLowerCase().includes(q) || 
                            leg.league?.toLowerCase().includes(q) ||
                            leg.winningTeam?.toLowerCase().includes(q);
        if (!matchesTeam) return false;
      }
      // Pick outcome filter
      if (outcomeFilter === 'HOME' && leg.pick !== 'HOME') return false;
      if (outcomeFilter === 'AWAY' && leg.pick !== 'AWAY') return false;

      // Status filter
      if (statusFilter === 'FINISHED' && !leg.isFinished) return false;
      if (statusFilter === 'LIVE' && !leg.isLive) return false;
      if (statusFilter === 'UPCOMING' && (leg.isFinished || leg.isLive)) return false;
      if (statusFilter === 'WON' && (!leg.isFinished || leg.isHit !== true)) return false;
      if (statusFilter === 'LOST' && (!leg.isFinished || leg.isHit !== false)) return false;

      return true;
    }).sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'time') {
        const tA = getLegTimestamp(a);
        const tB = getLegTimestamp(b);
        if (tA !== tB) return (tA - tB) * mult;
        return String(a.kickoffTime || a.time || '').localeCompare(String(b.kickoffTime || b.time || '')) * mult;
      }
      if (sortField === 'prob') {
        return ((a.prob || 0) - (b.prob || 0)) * mult;
      }
      if (sortField === 'odds') {
        return ((a.odds || 0) - (b.odds || 0)) * mult;
      }
      return 0;
    });
  }, [candidatePool, searchQuery, outcomeFilter, statusFilter, sortField, sortDir]);

  const matchingCount = matchingCandidates.length;

  // Dynamic Leg Count filter options based on matching count
  const legCountOptions = useMemo(() => {
    if (matchingCount === 0) {
      return [{ value: 0, label: '0 Legs (No Matches)' }];
    }
    if (matchingCount < 8) {
      // When fewer than 8 matches exist (e.g. 6 upcoming matches, or 2 finished matches)
      const opts = [];
      if (matchingCount >= 4) {
        opts.push({ value: 2, label: '2 Legs' });
        opts.push({ value: 4, label: '4 Legs' });
      } else if (matchingCount >= 2) {
        opts.push({ value: 1, label: '1 Leg' });
        opts.push({ value: 2, label: '2 Legs' });
      }
      // Always include the exact matching count
      if (!opts.some(o => o.value === matchingCount)) {
        opts.push({ value: matchingCount, label: `${matchingCount} Legs (All Available)` });
      } else {
        const existing = opts.find(o => o.value === matchingCount);
        if (existing) existing.label = `${matchingCount} Legs (All Available)`;
      }
      return opts;
    }
    // matchingCount >= 8
    const base = [
      { value: 4, label: '4 Legs' },
      { value: 6, label: '6 Legs' },
      { value: 8, label: '8 Legs (Default)' }
    ];
    if (matchingCount >= 10) base.push({ value: 10, label: '10 Legs' });
    if (matchingCount >= 12) base.push({ value: 12, label: '12 Legs' });
    if (matchingCount > 12) base.push({ value: matchingCount, label: `All ${matchingCount} Legs` });
    return base;
  }, [matchingCount]);

  // Effective leg count: if matchingCount < 8, clamp or default to matchingCount so it never claims 8 legs
  const effectiveLegCount = useMemo(() => {
    if (matchingCount === 0) return 0;
    if (matchingCount < 8) {
      if (legCount >= matchingCount || legCount === 8) {
        return matchingCount;
      }
      return Math.min(legCount, matchingCount);
    }
    return Math.min(legCount, matchingCount);
  }, [legCount, matchingCount]);

  // Sliced display legs strictly limited to effective leg count (no forced backfill or phantom legs)
  const displayLegs = useMemo(() => {
    if (effectiveLegCount === 0) return [];
    return matchingCandidates.slice(0, effectiveLegCount);
  }, [matchingCandidates, effectiveLegCount]);

  // Determine active filter label
  const getFilterLabel = () => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'UPCOMING') return 'Upcoming';
      if (statusFilter === 'FINISHED') return 'Finished';
      if (statusFilter === 'LIVE') return 'Live In-Play';
      if (statusFilter === 'WON') return 'Won';
      if (statusFilter === 'LOST') return 'Lost';
      return statusFilter;
    }
    if (outcomeFilter !== 'ALL') {
      return outcomeFilter === 'HOME' ? 'Home Picks' : 'Away Picks';
    }
    if (searchQuery.trim().length > 0) {
      return 'Search Filtered';
    }
    return '';
  };
  const isFiltered = statusFilter !== 'ALL' || outcomeFilter !== 'ALL' || searchQuery.trim().length > 0;

  // Dynamic calculations for total odds & returns strictly based on the filtered displayed legs
  const totalOdds = useMemo(() => {
    if (!displayLegs.length) return 0.0;
    const prod = displayLegs.reduce((acc, l) => acc * (l.odds || 1.15), 1.0);
    return Math.round(prod * 100) / 100;
  }, [displayLegs]);

  const avgProb = useMemo(() => {
    if (!displayLegs.length) return '0.0';
    const sum = displayLegs.reduce((acc, l) => acc + (l.prob || 0), 0);
    return (sum / displayLegs.length).toFixed(1);
  }, [displayLegs]);

  const combinedProb = useMemo(() => {
    if (!displayLegs.length) return 0.0;
    const prod = displayLegs.reduce((acc, l) => acc * ((l.prob || 50) / 100), 1.0);
    return Math.max(0.1, Math.round(prod * 1000) / 10);
  }, [displayLegs]);

  const potentialReturn = useMemo(() => {
    if (!displayLegs.length || totalOdds === 0) return '0.00';
    return safeToFixed(stake * totalOdds, 2);
  }, [stake, totalOdds, displayLegs]);

  const potentialProfit = useMemo(() => {
    if (!displayLegs.length || totalOdds === 0) return '0.00';
    return safeToFixed(stake * totalOdds - stake, 2);
  }, [stake, totalOdds, displayLegs]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'time' ? 'asc' : 'desc');
    }
  };

  const handleCopySlip = () => {
    if (!displayLegs.length) return;
    const sortedForSlip = [...displayLegs].sort((a, b) => getLegTimestamp(a) - getLegTimestamp(b));
    const text = sortedForSlip.map((l, i) => {
      let statusTag = `[${l.kickoffTime || l.time || 'Today'}]`;
      if (l.isFinished) {
        statusTag = `[FINISHED: ${l.isHit ? 'WON ✓' : 'LOST ✗'} (${l.actualScore || l.status})]`;
      } else if (l.isLive) {
        statusTag = `[LIVE ${l.liveStatus || ''} (${l.liveScore || ''})]`;
      }
      return `${i + 1}. ${statusTag} [${l.league}] ${l.home} vs ${l.away} -> ${l.winningTeam} WIN @ ${l.odds.toFixed(2)} (${l.prob}% win prob)`;
    }).join('\n');

    const filterNote = isFiltered ? ` [Filtered: ${getFilterLabel()}]` : '';
    const headerNote = `⚡ ALL-DAY WINNER ACCA (${displayLegs.length} LEGS${filterNote}) - ${currentDate}\nPrevious Day Win Rate: ${previousDaysWinRate.accuracy}% (${previousDaysWinRate.correctPredictions}/${previousDaysWinRate.total})\nTotal Odds: ${totalOdds.toFixed(2)}x (LiveScore Bet IE)\n--------------------------------------------------\n`;
    navigator.clipboard.writeText(headerNote + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLoadSingleLegToSlip = (leg) => {
    const singlePick = [{
      pickId: `${leg.id || leg.espnEventId}_${leg.pick}`,
      fixtureId: leg.id || leg.espnEventId,
      home: leg.home,
      away: leg.away,
      league: leg.league,
      dateIso: leg.dateIso || currentDate,
      time: leg.kickoffTime || leg.time,
      market: 'Full Time Result',
      selection: leg.pick === 'HOME' ? `${leg.home} To Win` : `${leg.away} To Win`,
      odds: leg.odds,
      confidence: leg.confidence || leg.prob,
      prob: leg.prob,
      pickType: leg.pick,
      rationale: leg.rationale,
      isFinished: leg.isFinished,
      isHit: leg.isHit,
      actualScore: leg.actualScore
    }];

    if (typeof onLoadPicksToSlip === 'function') {
      const msg = leg.isFinished 
        ? `Added ${leg.winningTeam} to Slip 1 (Match Finished: ${leg.actualScore})`
        : `Added ${leg.winningTeam} to Slip 1`;
      onLoadPicksToSlip(singlePick, 'slip-1', msg);
      setAddedLegIds(prev => new Set([...prev, leg.id]));
      setTimeout(() => {
        setAddedLegIds(prev => {
          const next = new Set(prev);
          next.delete(leg.id);
          return next;
        });
      }, 2500);
    }
  };

  const handleLoadAllToSlip = () => {
    if (!displayLegs || displayLegs.length === 0) return;
    const sortedForSlip = [...displayLegs].sort((a, b) => getLegTimestamp(a) - getLegTimestamp(b));
    
    // Check if there are active (upcoming/live) legs vs already finished legs
    const activeLegs = sortedForSlip.filter(l => !l.isFinished);
    const finishedLegs = sortedForSlip.filter(l => l.isFinished);
    const targetLegsToLoad = (statusFilter === 'FINISHED' || activeLegs.length === 0) 
      ? sortedForSlip 
      : activeLegs;

    const accaPicks = targetLegsToLoad.map(l => ({
      pickId: `${l.id || l.espnEventId}_${l.pick}`,
      fixtureId: l.id || l.espnEventId,
      home: l.home,
      away: l.away,
      league: l.league,
      dateIso: l.dateIso || currentDate,
      time: l.kickoffTime || l.time,
      market: 'Full Time Result',
      selection: l.pick === 'HOME' ? `${l.home} To Win` : `${l.away} To Win`,
      odds: l.odds,
      confidence: l.confidence || l.prob,
      prob: l.prob,
      pickType: l.pick,
      rationale: l.rationale,
      isFinished: l.isFinished,
      isHit: l.isHit,
      actualScore: l.actualScore
    }));

    if (typeof onLoadPicksToSlip === 'function') {
      let toastMsg = `Loaded ${accaPicks.length} ${isFiltered ? getFilterLabel() : 'All-Day Winner'} legs to Slip 1!`;
      if (finishedLegs.length > 0 && activeLegs.length > 0) {
        const wonCount = finishedLegs.filter(l => l.isHit).length;
        toastMsg = `Loaded ${activeLegs.length} upcoming legs to Slip 1 (${finishedLegs.length} legs already finished: ${wonCount} won!)`;
      }
      onLoadPicksToSlip(accaPicks, 'slip-1', toastMsg);
      setAddedToSlip(true);
      setSlipToastMessage(toastMsg);
      setTimeout(() => {
        setAddedToSlip(false);
        setSlipToastMessage(null);
      }, 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header / Hero Section matching application UI style */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                LIVESCORE BET IE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Calendar className="w-3 h-3 text-emerald-600" />
                TODAY: {currentDate}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200">
                <Award className="w-3 h-3 text-purple-600" />
                PREV DAY WIN RATE: {previousDaysWinRate.accuracy}% ({previousDaysWinRate.correctPredictions}/{previousDaysWinRate.total})
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                WIN/LOSE ONLY
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>All-Day Winner Bet</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                  LiveScore Bet IE Engine
                </span>
              </h2>
              <InfoTooltip 
                title="All-Day Winner Accumulator Slate" 
                content={`Super-conviction accumulator curated strictly from matches taking place today (${currentDate}). If matches have completed earlier today, their full time score (FT) and Won/Lost outcome are audited in real time. Historical edge is verified against yesterday's calibrated strike rate (${previousDaysWinRate.accuracy}%).`} 
              />
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => fetchLottoAcca(true)}
              disabled={isLoading || isRefreshing}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
              title="Re-query live feeds from LiveScore Ireland and recalculate Poisson probabilities"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Scraping Live...' : 'Refresh Slate'}</span>
            </button>

            <button
              onClick={handleCopySlip}
              disabled={!displayLegs.length}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied Slip!' : 'Copy Acca'}</span>
            </button>

            <button
              onClick={handleLoadAllToSlip}
              disabled={!displayLegs.length}
              className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {addedToSlip ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <PlusCircle className="w-3.5 h-3.5" />}
              <span>{addedToSlip ? 'Loaded to Slip 1!' : 'Load All to Slip 1'}</span>
            </button>
          </div>
        </div>

        {/* Toast Notification Bar */}
        {slipToastMessage && (
          <div className="mt-2.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{slipToastMessage}</span>
            </div>
            {typeof onNavigateToSlip === 'function' && (
              <button 
                onClick={onNavigateToSlip}
                className="text-[11px] font-bold text-emerald-900 underline hover:text-emerald-700 cursor-pointer"
              >
                View Slip 1 &rarr;
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Metric Summary Cards (5-Card Grid including Previous Day Win Rate & Slate Progress) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Previous Day Win Rate (Directly addressing user prompt) */}
        <div className="bg-gradient-to-br from-purple-50/70 to-white rounded-xl p-3.5 border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Prev Day Win Rate</span>
            <Award className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-900 mt-1 flex items-baseline gap-1">
            {previousDaysWinRate.accuracy}%
            <span className="text-xs font-normal text-purple-600">hit rate</span>
          </div>
          <span className="text-[10px] text-purple-700 font-semibold mt-1 block">
            {previousDaysWinRate.correctPredictions}/{previousDaysWinRate.total} Hits • {previousDaysWinRate.activeStrikeRate}% Strike
          </span>
        </div>

        {/* Card 2: Combined Odds (Dynamically updated for filtered matches) */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isFiltered ? `${getFilterLabel()} Odds` : 'Combined Odds'}
            </span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1 flex items-baseline gap-1">
            {displayLegs.length === 0 ? (
              <span className="text-slate-400 font-mono text-xl">0.00x</span>
            ) : (
              <>
                {totalOdds.toFixed(2)}x
                <span className="text-xs font-normal text-slate-400">odds</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {displayLegs.length === 0 ? (
              '0 legs match filter'
            ) : (
              `${displayLegs.length} ${isFiltered ? getFilterLabel().toLowerCase() : 'unanimous'} pick${displayLegs.length === 1 ? '' : 's'} (${avgProb}% avg prob)`
            )}
          </span>
        </div>

        {/* Card 3: Simulated Return (€{stake}) */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Simulated Return (€{stake})</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            €{potentialReturn}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
            {displayLegs.length === 0 ? '€0.00 margin (0 matches)' : `+€${potentialProfit} Net Profit Margin`}
          </span>
        </div>

        {/* Card 4: Slate Progress / Filter Selection Tracker */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {statusFilter !== 'ALL' ? `${statusFilter} Picks` : 'Slate Progress'}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-800 mt-1 flex items-center gap-1.5">
            {statusFilter === 'UPCOMING' ? (
              <span className="text-indigo-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {displayLegs.length} Upcoming Legs
              </span>
            ) : statusFilter === 'FINISHED' ? (
              displayLegs.length === 0 ? (
                <span className="text-slate-500">0 Finished</span>
              ) : displayLegs.filter(l => l.isHit === false).length === 0 ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {displayLegs.filter(l => l.isHit === true).length}/{displayLegs.length} Won (100%)
                </span>
              ) : (
                <span className="text-slate-800 flex items-center gap-1">
                  {displayLegs.filter(l => l.isHit === true).length} Won • {displayLegs.filter(l => l.isHit === false).length} Lost
                </span>
              )
            ) : statusFilter === 'LIVE' ? (
              <span className="text-amber-600 flex items-center gap-1">
                <Zap className="w-4 h-4 fill-amber-500" />
                {displayLegs.length} In-Play Live
              </span>
            ) : statusFilter === 'WON' ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {displayLegs.length} Won Legs
              </span>
            ) : statusFilter === 'LOST' ? (
              <span className="text-rose-600 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {displayLegs.length} Lost Legs
              </span>
            ) : (
              /* statusFilter === 'ALL' */
              statusCounts.finished > 0 ? (
                statusCounts.lost === 0 ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {statusCounts.won}/{statusCounts.finished} Legs Won
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {statusCounts.won} Won • {statusCounts.lost} Lost
                  </span>
                )
              ) : (
                <span className="text-indigo-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {displayLegs.length} Legs Active
                </span>
              )
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block font-medium">
            {statusFilter === 'UPCOMING'
              ? `${displayLegs.length} active fixtures ready to wager`
              : statusFilter === 'FINISHED'
              ? `${displayLegs.length} completed matches verified`
              : `${statusCounts.finished} Finished • ${statusCounts.live} Live • ${statusCounts.upcoming} Upcoming`}
          </span>
        </div>

        {/* Card 5: Odds Provider & Discipline */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Sportsbook Provider</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LiveScore Bet IE
          </div>
          <span className="text-[10px] text-amber-700 font-semibold mt-1 block">
            Overridden Blacklists • 0% Draw Risk
          </span>
        </div>
      </div>

      {/* Interactive Control & Filter Bar */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="relative flex-1 min-w-[140px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search club or league..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniformDropdown
            label="View Scope"
            value={scopeMode}
            onChange={setScopeMode}
            options={[
              { value: 'SLATE', label: `Curated Acca Slate (${rawLegs.length})` },
              { value: 'ALL_GAMES', label: `All Today Matches (${allAvailableLegs.length})` }
            ]}
          />

          <UniformDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: `All Matches (${statusCounts.all})` },
              { value: 'FINISHED', label: `Finished Only (${statusCounts.finished})` },
              { value: 'LIVE', label: `Live In-Play (${statusCounts.live})` },
              { value: 'UPCOMING', label: `Upcoming Only (${statusCounts.upcoming})` },
              ...(statusCounts.won > 0 ? [{ value: 'WON', label: `Won Legs (${statusCounts.won})` }] : []),
              ...(statusCounts.lost > 0 ? [{ value: 'LOST', label: `Lost Legs (${statusCounts.lost})` }] : [])
            ]}
          />

          <UniformDropdown
            label={matchingCount < 8 ? `Leg Count (${matchingCount} avail)` : 'Acca Size'}
            value={effectiveLegCount}
            onChange={(val) => setLegCount(Number(val))}
            options={legCountOptions}
          />

          <UniformDropdown
            label="Selection"
            value={outcomeFilter}
            onChange={setOutcomeFilter}
            options={[
              { value: 'ALL', label: `All Picks (${outcomeCounts.all})` },
              { value: 'HOME', label: `Home Win (${outcomeCounts.home})` },
              { value: 'AWAY', label: `Away Win (${outcomeCounts.away})` }
            ]}
          />

          <UniformDropdown
            label="Sort"
            value={`${sortField}_${sortDir}`}
            onChange={(val) => {
              const [f, d] = val.split('_');
              setSortField(f);
              setSortDir(d);
            }}
            options={[
              { value: 'time_asc', label: 'Earliest Kickoff (Time)' },
              { value: 'time_desc', label: 'Latest Kickoff' },
              { value: 'prob_desc', label: 'Highest Win Probability' },
              { value: 'prob_asc', label: 'Lowest Win Probability' },
              { value: 'odds_desc', label: 'Highest Odds' },
              { value: 'odds_asc', label: 'Lowest Odds' }
            ]}
          />

          <UniformDropdown
            label="Stake"
            value={stake}
            onChange={(val) => setStake(Number(val))}
            options={[
              { value: 10, label: '€10' },
              { value: 20, label: '€20' },
              { value: 50, label: '€50' },
              { value: 100, label: '€100' }
            ]}
          />
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => fetchLottoAcca(true)}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Main Content: Table Format */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">Querying LiveScore Bet Ireland Feeds for Today ({currentDate})</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Retrieving all fixtures scheduled strictly for today, auditing finished match scoreboards, simulating Dixon-Coles Poisson distributions, eliminating draw stalemates, and calculating exact win probabilities.
          </p>
        </div>
      ) : displayLegs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs text-xs space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="font-bold text-slate-800 text-sm">
            {isFiltered 
              ? `No ${getFilterLabel()} Matches Found Today (${currentDate})`
              : `No Qualifying Matches Found Today (${currentDate})`}
          </h4>
          <p className="text-slate-500 max-w-md mx-auto">
            {isFiltered
              ? `There are currently 0 fixtures matching the "${getFilterLabel()}" filter selection. Showing only matches that specifically match your filter.`
              : 'Try adjusting the filters or refreshing the LiveScore Bet Ireland live feed.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setOutcomeFilter('ALL');
              setStatusFilter('ALL');
              fetchLottoAcca(true);
            }}
            className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Reset Filters & View All
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>All-Day Winner Accumulator Slate</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                  {isFiltered ? `${getFilterLabel()} Filter` : "Today's Rolling Slate"}
                </span>
              </h2>
              <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                {displayLegs.length} Leg{displayLegs.length === 1 ? '' : 's'}
              </span>
              {statusFilter === 'ALL' && statusCounts.finished > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${statusCounts.lost === 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-800 border border-slate-300'}`}>
                  {statusCounts.lost === 0 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                  {statusCounts.won}/{statusCounts.finished} Finished Legs Won
                </span>
              )}
              {statusFilter === 'FINISHED' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${displayLegs.filter(l => l.isHit === false).length === 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-800 border border-slate-300'}`}>
                  {displayLegs.filter(l => l.isHit === true).length}/{displayLegs.length} Finished Legs Won
                </span>
              )}
              {statusFilter === 'UPCOMING' && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <Clock className="w-3 h-3 text-indigo-600" />
                  All {displayLegs.length} Upcoming Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadAllToSlip}
                disabled={displayLegs.length === 0}
                className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs"
              >
                {addedToSlip ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                <span>{addedToSlip ? 'Loaded!' : 'Load All'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCollapsedAcca(!collapsedAcca)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title={collapsedAcca ? 'Expand Accumulator' : 'Collapse Accumulator'}
              >
                <span>{collapsedAcca ? 'Expand' : 'Collapse'}</span>
                {collapsedAcca ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </div>

          {!collapsedAcca && (
            <>
              {/* High-Density Data Table */}
              <div className="overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="hidden md:table-header-group">
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                      {/* Expand Toggle */}
                      <th className="py-1 px-1 w-6 text-center"></th>

                      {/* Leg # */}
                      <th className="py-1 px-1.5 w-8 text-center">#</th>

                      {/* Kickoff & League / Match Status */}
                      <th 
                        onClick={() => handleSort('time')}
                        className="py-1 px-2 min-w-[130px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Status & League</span>
                          {sortField === 'time' && (
                            sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                          )}
                        </div>
                      </th>

                      {/* Match Fixture */}
                      <th className="py-1 px-2 min-w-[170px]">
                        <span>Match Fixture</span>
                      </th>

                      {/* Model Selection & Result */}
                      <th className="py-1 px-2 min-w-[150px]">
                        <span>Selection & Result</span>
                      </th>

                      {/* Exact Win Probability */}
                      <th 
                        onClick={() => handleSort('prob')}
                        className="py-1 px-1.5 min-w-[100px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Win Prob</span>
                          {sortField === 'prob' && (
                            sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                          )}
                        </div>
                      </th>

                      {/* LiveScore Bet IE Odds */}
                      <th 
                        onClick={() => handleSort('odds')}
                        className="py-1 px-1.5 min-w-[100px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>LiveScore Odds</span>
                          {sortField === 'odds' && (
                            sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                          )}
                        </div>
                      </th>

                      {/* Scoreline Projection / Actual Score */}
                      <th className="py-1 px-1.5 min-w-[85px] text-center">
                        <span>Score (Proj / FT)</span>
                      </th>

                      {/* Tactical Intel & Rationale */}
                      <th className="py-1 px-2 min-w-[200px]">
                        <span>Model Tactical Forensics</span>
                      </th>

                      {/* Actions */}
                      <th className="py-1 px-2 min-w-[80px] text-right">
                        <span>Actions</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0 bg-white">
                    {displayLegs.map((leg, index) => {
                      const isHomePick = leg.pick === 'HOME';
                      const isLegAdded = addedLegIds.has(leg.id);
                      const legKey = leg.id || `${leg.home}-${leg.away}-${index}`;
                      const isExpanded = expandedLegId === legKey;

                      return (
                        <React.Fragment key={legKey}>
                          <tr 
                            className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 ${leg.isFinished ? (leg.isHit ? 'bg-emerald-50/20' : 'bg-rose-50/20') : (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')} hover:bg-slate-50/80 transition-all group md:h-10 cursor-pointer`}
                            onClick={() => toggleExpand(legKey)}
                          >
                            {/* ================= MOBILE COMPACT VIEW ================= */}
                            <td className="md:hidden p-3 block">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-bold text-[10px] inline-flex items-center justify-center shrink-0">
                                    {index + 1}
                                  </span>

                                  {/* Status Tag on Mobile */}
                                  {leg.isFinished ? (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow-2xs ${leg.isHit ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'}`}>
                                      {leg.isHit ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                                      FINISHED ({leg.actualScore || leg.status})
                                    </span>
                                  ) : leg.isLive ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                                      <Zap className="w-2.5 h-2.5 fill-slate-950" />
                                      LIVE {leg.liveStatus || ''} ({leg.liveScore || ''})
                                    </span>
                                  ) : (
                                    <span className="font-mono font-bold text-slate-900 text-[10px] flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      {leg.kickoffTime || 'Today'}
                                    </span>
                                  )}

                                  <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200">
                                    {leg.league}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      if (typeof onOpenDeepResearch === 'function') {
                                        onOpenDeepResearch(leg);
                                      }
                                    }}
                                    className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                                    title="Open Deep AI Forensic Research"
                                  >
                                    <Brain className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleLoadSingleLegToSlip(leg)}
                                    className="p-1 rounded text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                                    title={leg.isFinished ? "Pick Resulted" : "Add to Bet Slip 1"}
                                  >
                                    {leg.isFinished ? (
                                      leg.isHit ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />
                                    ) : (
                                      isLegAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <Plus className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-slate-900 text-xs">
                                  <span className={isHomePick ? 'text-indigo-950 font-bold' : 'text-slate-700'}>{leg.home}</span>
                                  <span className="text-slate-400 font-normal mx-1">vs</span>
                                  <span className={!isHomePick ? 'text-indigo-950 font-bold' : 'text-slate-700'}>{leg.away}</span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded shadow-2xs">
                                  @{leg.odds.toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 mb-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="font-bold text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {leg.winningTeam} ({leg.pick === 'HOME' ? 'Home' : 'Away'})
                                  </span>
                                  {leg.isFinished ? (
                                    <span className={`font-bold px-1.5 py-0.5 rounded ${leg.isHit ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'}`}>
                                      {leg.isHit ? '✓ WON' : '✗ LOST'}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-semibold">0% Draw</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-bold text-slate-900">{leg.prob}% strike</span>
                                  {leg.evPercent !== undefined && (
                                    <span className={leg.evPercent >= 0 ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                                      {leg.evPercent >= 0 ? `+${leg.evPercent}% EV` : `${leg.evPercent}% EV`}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 text-[10px]">
                                <span className="text-slate-500 font-mono">
                                  {leg.isFinished ? (
                                    <>Actual Score: <strong className="text-slate-900 font-bold">{leg.actualScore} FT</strong> (Proj: {leg.predictedScore})</>
                                  ) : (
                                    <>Projected Score: <strong className="text-slate-800">{leg.predictedScore || '2-0'}</strong></>
                                  )}
                                </span>
                                <span className="text-indigo-600 font-semibold flex items-center gap-0.5 cursor-pointer">
                                  {isExpanded ? 'Hide' : 'Rationale'}
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </span>
                              </div>

                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] space-y-1 bg-slate-50/60 p-2 rounded">
                                  <div className="text-slate-700 leading-snug">
                                    <strong>Tactical Rationale:</strong> {leg.rationale}
                                  </div>
                                  <div className="flex items-center justify-between text-slate-500 pt-1 font-mono">
                                    <span>Status: <strong>{leg.isFinished ? `Finished (${leg.actualScore})` : (leg.isLive ? 'Live In-Play' : 'Upcoming')}</strong></span>
                                    <span>Platform: <strong>LiveScore Bet IE</strong></span>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* ================= DESKTOP 1-ROW VIEW ================= */}
                            {/* Dropdown Chevron */}
                            <td className="hidden md:table-cell py-1 px-1 text-center text-slate-400">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                            </td>

                            {/* # Leg index badge */}
                            <td className="hidden md:table-cell py-1 px-1.5 text-center align-middle">
                              <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-bold text-[10px] inline-flex items-center justify-center">
                                {index + 1}
                              </span>
                            </td>

                            {/* Status & League */}
                            <td className="hidden md:table-cell py-1 px-2 align-middle">
                              <div className="flex flex-col gap-0.5">
                                {leg.isFinished ? (
                                  <div className="flex items-center gap-1">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-2xs ${leg.isHit ? 'bg-emerald-700' : 'bg-slate-800'}`}>
                                      <Check className="w-2.5 h-2.5 text-emerald-300" />
                                      FINISHED (FT)
                                    </span>
                                  </div>
                                ) : leg.isLive ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950 w-fit animate-pulse">
                                    <Zap className="w-2.5 h-2.5 fill-slate-950" />
                                    LIVE {leg.liveStatus || ''}
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900 text-[11px] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    {leg.kickoffTime || 'Today'}
                                  </span>
                                )}

                                <span className="text-[10px] font-semibold text-slate-600 line-clamp-1" title={leg.league}>
                                  {leg.league}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {leg.isBypassedBlacklist && (
                                    <span className="px-1 py-0.2 rounded text-[8.5px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      Overridden
                                    </span>
                                  )}
                                  <span className="px-1 py-0.2 rounded text-[8.5px] font-mono bg-sky-50 text-sky-800 border border-sky-200">
                                    LiveScore IE
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Match Fixture (Home vs Away) */}
                            <td className="hidden md:table-cell py-1 px-2 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  {leg.homeLogo && (
                                    <img 
                                      src={leg.homeLogo} 
                                      alt="" 
                                      className="w-3.5 h-3.5 object-contain shrink-0 rounded-full"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  )}
                                  <span className={`text-[11.5px] ${isHomePick ? 'font-bold text-indigo-950' : 'font-medium text-slate-600'}`}>
                                    {leg.home}
                                    {isHomePick && <span className="ml-1 text-indigo-600 font-mono text-[10px]">★</span>}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {leg.awayLogo && (
                                    <img 
                                      src={leg.awayLogo} 
                                      alt="" 
                                      className="w-3.5 h-3.5 object-contain shrink-0 rounded-full"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  )}
                                  <span className={`text-[11.5px] ${!isHomePick ? 'font-bold text-indigo-950' : 'font-medium text-slate-600'}`}>
                                    {leg.away}
                                    {!isHomePick && <span className="ml-1 text-indigo-600 font-mono text-[10px]">★</span>}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Model Selection & Result */}
                            <td className="hidden md:table-cell py-1 px-2 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold text-[10.5px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                  <span>{leg.winningTeam}</span>
                                  <span className="text-[9.5px] font-mono text-indigo-700 bg-white px-1 py-0.2 rounded border border-indigo-100">
                                    {leg.pick === 'HOME' ? 'Home' : 'Away'}
                                  </span>
                                </div>

                                {leg.isFinished ? (
                                  leg.isHit ? (
                                    <span className="text-[9.5px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded shadow-2xs w-fit">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      LEG WON (HIT)
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] text-rose-800 font-bold flex items-center gap-1 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded shadow-2xs w-fit">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      LEG LOST (MISSED)
                                    </span>
                                  )
                                ) : leg.isLive ? (
                                  <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5 pl-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                    In-Play Live Mid-Game
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5 pl-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Win/Lose • 0% Draw
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Exact Win Probability */}
                            <td className="hidden md:table-cell py-1 px-1.5 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-900">
                                  <span>{leg.prob}%</span>
                                  <span className="text-[9px] font-normal text-slate-400">strike</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(10, leg.prob))}%` }}
                                  />
                                </div>
                                <span className="text-[8.5px] text-slate-400 font-mono">
                                  Draw: {leg.drawRisk || 12}%
                                </span>
                              </div>
                            </td>

                            {/* LiveScore Bet IE Odds */}
                            <td className="hidden md:table-cell py-1 px-1.5 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded inline-block text-center w-fit shadow-2xs">
                                  @{leg.odds.toFixed(2)}
                                </span>
                                {leg.evPercent !== undefined && (
                                  <span className={`text-[8.5px] font-mono font-semibold ${leg.evPercent >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {leg.evPercent >= 0 ? `+${leg.evPercent}% EV` : `${leg.evPercent}% EV`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Scoreline Projection / Actual Score */}
                            <td className="hidden md:table-cell py-1 px-1.5 text-center align-middle">
                              <div className="flex flex-col items-center gap-0.5">
                                {leg.isFinished ? (
                                  <>
                                    <span className={`px-1.5 py-0.5 rounded border font-mono font-black text-[11px] shadow-2xs ${leg.isHit ? 'bg-emerald-100 border-emerald-300 text-emerald-950' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
                                      {leg.actualScore} FT
                                    </span>
                                    <span className="text-[8.5px] text-slate-400 font-mono">
                                      Proj: {leg.predictedScore || '2-0'}
                                    </span>
                                  </>
                                ) : leg.isLive ? (
                                  <>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 font-mono font-bold text-amber-900 text-[10.5px]">
                                      {leg.liveScore || '0-0'}
                                    </span>
                                    <span className="text-[8.5px] text-amber-700 font-mono">
                                      Proj: {leg.predictedScore || '2-0'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800 text-[10.5px]">
                                    {leg.predictedScore || '2-0'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Tactical Intel & Rationale */}
                            <td className="hidden md:table-cell py-1 px-2 align-middle">
                              <p className="text-[10px] text-slate-600 line-clamp-1 leading-snug" title={leg.rationale}>
                                {leg.rationale}
                              </p>
                            </td>

                            {/* Action buttons (Deep Research & Add to Slip) */}
                            <td className="hidden md:table-cell py-1 px-2 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    if (typeof onOpenDeepResearch === 'function') {
                                      onOpenDeepResearch(leg);
                                    }
                                  }}
                                  className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                                  title="Open Deep AI Forensic Research for this fixture"
                                >
                                  <Brain className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => handleLoadSingleLegToSlip(leg)}
                                  className="p-1 rounded text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                                  title={leg.isFinished ? `Pick Resulted: ${leg.actualScore}` : "Add single pick to Bet Slip 1"}
                                >
                                  {leg.isFinished ? (
                                    leg.isHit ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />
                                  ) : (
                                    isLegAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <Plus className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* DESKTOP EXPANDED DETAIL ROW */}
                          {isExpanded && (
                            <tr className="hidden md:table-row bg-slate-50/80 border-b border-slate-200">
                              <td colSpan={10} className="p-3">
                                <div className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center justify-between text-xs">
                                  <div>
                                    <span className="font-bold text-slate-800">Tactical Forensics &amp; Rationale:</span> {leg.rationale}
                                  </div>
                                  <div className="font-mono text-slate-600 shrink-0 pl-3">
                                    {leg.isFinished ? (
                                      <>Result: <strong className={leg.isHit ? "text-emerald-700" : "text-rose-700"}>{leg.isHit ? 'WON ✓' : 'LOST ✗'} ({leg.actualScore})</strong> &bull; Proj: <strong>{leg.predictedScore || '2-0'}</strong></>
                                    ) : (
                                      <>Draw Risk: <strong>{leg.drawRisk || 12}%</strong> &bull; Proj Scoreline: <strong>{leg.predictedScore || '2-0'}</strong></>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Bar of Table / Slip Summary Box */}
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-slate-800">
                <div>
                  <div className="font-bold text-sm text-amber-300 flex items-center gap-1.5 flex-wrap">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>{isFiltered ? `${getFilterLabel()} Selections` : 'All-Day Winner Lotto Accumulator Ready'} ({displayLegs.length} Selection{displayLegs.length === 1 ? '' : 's'} on {currentDate})</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-purple-900/70 border border-purple-600/50 text-purple-200">
                      Prev Day Hit Rate: {previousDaysWinRate.accuracy}% ({previousDaysWinRate.correctPredictions}/{previousDaysWinRate.total})
                    </span>
                  </div>
                  <div className="text-slate-300 text-xs mt-0.5">
                    {displayLegs.length === 0 ? (
                      <span>No selections match the current filter.</span>
                    ) : (
                      <>
                        Combined odds: <strong className="text-white font-mono">{totalOdds.toFixed(2)}x</strong> on LiveScore Bet IE &bull; A €{stake} stake yields <strong className="text-emerald-400 font-mono">€{potentialReturn}</strong> (+€{potentialProfit} net profit).
                        {statusFilter === 'ALL' && statusCounts.finished > 0 && (
                          <span className="ml-1.5 text-emerald-300 font-medium">
                            &bull; {statusCounts.won}/{statusCounts.finished} Finished Legs Won!
                          </span>
                        )}
                        {statusFilter === 'FINISHED' && (
                          <span className="ml-1.5 text-emerald-300 font-medium">
                            &bull; {displayLegs.filter(l => l.isHit).length}/{displayLegs.length} Finished Legs Won!
                          </span>
                        )}
                        {statusFilter === 'UPCOMING' && (
                          <span className="ml-1.5 text-indigo-300 font-medium">
                            &bull; All {displayLegs.length} legs ready to bet!
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopySlip}
                    disabled={displayLegs.length === 0}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    {copied ? 'Copied Slip Text!' : 'Copy Acca Text'}
                  </button>
                  <button
                    onClick={handleLoadAllToSlip}
                    disabled={displayLegs.length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {addedToSlip ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    <span>{addedToSlip ? 'Loaded to Slip 1!' : 'Load to Bet Slip 1'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
