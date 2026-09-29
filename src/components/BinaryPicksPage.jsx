import WatchButton from './WatchButton';
import React, { useState, useMemo } from 'react';
import { MobileFoldCell, FoldSummary, FoldBadge, compactKickoff } from './MobileFold';
import { 
  Scale, 
  Search, 
  TrendingUp, 
  ShieldCheck, 
  Brain, 
  Plus, 
  Check, 
  ArrowRight,
  Filter,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  Activity,
  CheckCircle2,
  Calendar,
  Tv,
  Play,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import MobileViewSwitcher from './MobileViewSwitcher';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { getMatchRiskProfile } from '../utils/riskUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, formatFriendlyDateOption } from '../utils/dateUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';
import RiskBadgeWithAiHover from './RiskBadgeWithAiHover';

export default function BinaryPicksPage({
  matches = [],
  leaguePerformance = [],
  onOpenDeepResearch,
  onOpenWatchLive,
  onAddToSlip,
  onClearSlip,
  accaMatchIds = new Set(),
  tzSettings = {},
  onSelectMarketMode
}) {
  // Shared with every list page: Cards or 1-Row Table on phones, remembered across pages.
  const [mobileViewMode] = useMobileViewMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [convictionTier, setConvictionTier] = useState('ALL'); // 'ALL', 'ELITE', 'HIGH_VALUE'
  const [minChance, setMinChance] = useState(0); // minimum chance the tip wins, in percent
  const [sortField, setSortField] = useState('conf');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [sortBy, setSortBy] = useState('conf_desc');
  const [expandedPickId, setExpandedPickId] = useState(null);
  const [collapsedBinary, setCollapsedBinary] = useState(false);

  const toggleExpand = (id) => {
    setExpandedPickId(prev => (prev === id ? null : id));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
      if (field === 'conf') setSortBy(nextDir === 'desc' ? 'conf_desc' : 'custom');
      else if (field === 'edge') setSortBy(nextDir === 'desc' ? 'edge_desc' : 'custom');
      else if (field === 'kelly') setSortBy(nextDir === 'desc' ? 'kelly_desc' : 'custom');
      else setSortBy('custom');
    } else {
      setSortField(field);
      const defaultDesc = ['odds', 'prob', 'implied', 'edge', 'kelly', 'conf'].includes(field);
      const newDir = defaultDesc ? 'desc' : 'asc';
      setSortDirection(newDir);
      if (field === 'conf') setSortBy(newDir === 'desc' ? 'conf_desc' : 'custom');
      else if (field === 'edge') setSortBy(newDir === 'desc' ? 'edge_desc' : 'custom');
      else if (field === 'kelly') setSortBy(newDir === 'desc' ? 'kelly_desc' : 'custom');
      else setSortBy('custom');
    }
  };

  const handleDropdownSortChange = (newVal) => {
    setSortBy(newVal);
    if (newVal === 'edge_desc') {
      setSortField('edge');
      setSortDirection('desc');
    } else if (newVal === 'conf_desc') {
      setSortField('conf');
      setSortDirection('desc');
    } else if (newVal === 'kelly_desc') {
      setSortField('kelly');
      setSortDirection('desc');
    } else if (newVal === 'time_asc') {
      setSortField('time');
      setSortDirection('asc');
    } else if (newVal === 'time_desc') {
      setSortField('time');
      setSortDirection('desc');
    }
  };

  // Helper to check if match is finished
  const isMatchCompleted = (m) => {
    if (!m) return false;
    if (m.isCompleted) return true;
    const st = String(m.status || m.state || '').toUpperCase();
    if (st === 'FT' || st === 'FINISHED' || st === 'FINAL' || st === 'STATUS_FULL_TIME') return true;
    if (m.actualScore && !m.isLive) return true;
    return false;
  };

  // Pre-calculate all available raw binary value picks from active matches
  const rawBinaryPicks = useMemo(() => {
    const picks = [];

    (matches || []).forEach(m => {
      // Exclude finished/completed matches strictly
      if (isMatchCompleted(m)) return;

      let homeP = safeParseFloat(m.prob?.home, 0);
      let awayP = safeParseFloat(m.prob?.away, 0);
      let drawP = safeParseFloat(m.prob?.draw, 0);

      let mHomeOdds = m.marketOdds?.home;
      let mAwayOdds = m.marketOdds?.away;

      // Dynamic mid-game in-play prediction override when match is live
      if (m.isLive && m.inPlayPrediction) {
        homeP = safeParseFloat(m.inPlayPrediction.prob?.home, homeP);
        awayP = safeParseFloat(m.inPlayPrediction.prob?.away, awayP);
        drawP = safeParseFloat(m.inPlayPrediction.prob?.draw, drawP);
        mHomeOdds = m.inPlayPrediction.fairOdds?.home || mHomeOdds;
        mAwayOdds = m.inPlayPrediction.fairOdds?.away || mAwayOdds;
      }

      if (!mHomeOdds) mHomeOdds = homeP > 0 ? (100 / Math.max(15, homeP - 5)).toFixed(2) : 2.0;
      if (!mAwayOdds) mAwayOdds = awayP > 0 ? (100 / Math.max(15, awayP - 5)).toFixed(2) : 3.0;
      
      const bestSide = homeP >= awayP ? 'HOME' : 'AWAY';
      const bestTeam = bestSide === 'HOME' ? m.home : m.away;
      const bestProb = bestSide === 'HOME' ? homeP : awayP;
      const bestOdds = safeParseFloat(bestSide === 'HOME' ? mHomeOdds : mAwayOdds, 2.0);

      const impliedProb = (1 / bestOdds) * 100;
      const edge = bestProb - impliedProb;

      // Kelly fraction = (b*p - q) / b where b = odds - 1, p = prob, q = 1 - p
      const b = Math.max(0.1, bestOdds - 1);
      const p = bestProb / 100;
      const q = 1 - p;
      const rawKelly = Math.max(0, (b * p - q) / b);
      // Fractional Kelly (1/4 Kelly for bankroll safety)
      // Quarter Kelly as a percentage of the bank, capped at 5% like the engine's own stake rule.
      const kellyUnits = safeParseFloat(Math.min(5, rawKelly * 25).toFixed(1), 0);

      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      const formattedTime = timeVal ? formatRelativeDayTime(timeVal, tzSettings) : (m.time || 'Upcoming');
      const dateKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';

      picks.push({
        match: m,
        id: m.id,
        dateKey,
        time: formattedTime,
        dt: formatSafeDateTime(timeVal, null, tzSettings),
        league: m.league,
        home: m.home,
        away: m.away,
        pickTeam: bestTeam,
        pick: bestSide,
        riskProfile: getMatchRiskProfile(m, bestSide),
        market: m.isLive ? `${bestTeam} to win (live ${m.liveMinute || 0}')` : `${bestTeam} to win`,
        modelProb: bestProb,
        marketOdds: bestOdds,
        impliedProb,
        edge,
        kellyUnits,
        confidence: safeParseFloat(m.confidence, bestProb),
        dateIso: m.dateIso,
        rawDate: m.date,
        isLive: Boolean(m.isLive),
        liveMinute: m.liveMinute,
        liveScore: m.liveScore,
        broadcast: m.broadcast
      });
    });

    return picks;
  }, [matches, tzSettings]);

  // Universal faceted filter checker
  const checkPickPasses = (p, skipDimension = null) => {
    if (!p) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!p.home.toLowerCase().includes(q) && !p.away.toLowerCase().includes(q) && !p.league.toLowerCase().includes(q)) {
        return false;
      }
    }

    // League filter
    if (skipDimension !== 'league' && selectedLeague !== 'All') {
      if (p.league !== selectedLeague) return false;
    }

    // Date filter
    if (skipDimension !== 'date' && selectedDate !== 'All') {
      if (p.dateKey !== selectedDate) return false;
    }

    // Edge / Conviction Tier filter
    if (skipDimension !== 'conviction') {
      if (convictionTier === 'ELITE' && p.edge < 8) return false;
      if (convictionTier === 'HIGH_VALUE' && p.edge < 5) return false;
    }

    // Chance filter
    if (skipDimension !== 'chance' && minChance > 0 && safeParseFloat(p.modelProb, 0) < minChance) return false;

    return true;
  };

  // Chance options with counts, faceted like the others
  const chanceOptions = useMemo(() => {
    const pool = rawBinaryPicks.filter(p => checkPickPasses(p, 'chance'));
    const n = (t) => pool.filter(p => safeParseFloat(p.modelProb, 0) >= t).length;
    return [
      { value: 0, label: `Any chance (${pool.length})` },
      { value: 60, label: `60%+ (${n(60)})` },
      { value: 70, label: `70%+ (${n(70)})` },
      { value: 80, label: `80%+ (${n(80)})` }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBinaryPicks, searchQuery, selectedLeague, selectedDate, convictionTier]);

  // Dynamic Faceted League Options
  const leagueOptions = useMemo(() => {
    const leagues = {};
    let totalEligible = 0;

    rawBinaryPicks.forEach(p => {
      if (!checkPickPasses(p, 'league')) return;
      totalEligible++;
      if (p.league) {
        leagues[p.league] = (leagues[p.league] || 0) + 1;
      }
    });

    const sortedLeagues = Object.keys(leagues).sort();
    return [
      { value: 'All', label: `All Leagues (${totalEligible})` },
      ...sortedLeagues.map(l => {
        const perf = leaguePerformance.find(lp => lp.league === l);
        const perfStr = perf ? ` · ${Math.round(perf.accuracy)}% hit rate` : '';
        return { value: l, label: `${l} (${leagues[l]})${perfStr}` };
      })
    ];
  }, [rawBinaryPicks, searchQuery, selectedDate, convictionTier, leaguePerformance, minChance]);

  // Dynamic Faceted Date Options
  const dateOptions = useMemo(() => {
    const dates = {};
    let totalEligible = 0;

    rawBinaryPicks.forEach(p => {
      if (!checkPickPasses(p, 'date')) return;
      totalEligible++;
      dates[p.dateKey] = (dates[p.dateKey] || 0) + 1;
    });

    const sortedKeys = Object.keys(dates).sort();
    return [
      { value: 'All', label: `All dates (${totalEligible})` },
      ...sortedKeys.map(k => ({ value: k, label: formatFriendlyDateOption(k, dates[k], tzSettings) }))
    ];
  }, [rawBinaryPicks, searchQuery, selectedLeague, convictionTier, minChance]);

  // Dynamic Faceted Conviction / Edge Tier Options
  const convictionOptions = useMemo(() => {
    let all = 0;
    let highValue = 0;
    let elite = 0;

    rawBinaryPicks.forEach(p => {
      if (!checkPickPasses(p, 'conviction')) return;
      all++;
      if (p.edge >= 5) highValue++;
      if (p.edge >= 8 && p.confidence >= 65) elite++;
    });

    return [
      { value: 'ALL', label: `All tips (${all})` },
      { value: 'ELITE', label: `Value 8%+ (${elite})` },
      { value: 'HIGH_VALUE', label: `Value 5%+ (${highValue})` }
    ];
  }, [rawBinaryPicks, searchQuery, selectedLeague, selectedDate, minChance]);

  // Filter and sort picks
  const binaryPicks = useMemo(() => {
    return rawBinaryPicks.filter(p => checkPickPasses(p, null)).sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'time') {
        const tA = a.match?.timestamp || (a.match?.utcDate ? new Date(a.match.utcDate).getTime() : 0);
        const tB = b.match?.timestamp || (b.match?.utcDate ? new Date(b.match.utcDate).getTime() : 0);
        return (tA - tB) * multiplier;
      }
      if (sortField === 'league') {
        return (a.league || '').localeCompare(b.league || '') * multiplier;
      }
      if (sortField === 'fixture') {
        const nameA = `${a.home || ''} ${a.away || ''} ${a.league || ''}`.toLowerCase();
        const nameB = `${b.home || ''} ${b.away || ''} ${b.league || ''}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      }
      if (sortField === 'market') {
        return (a.market || '').localeCompare(b.market || '') * multiplier;
      }
      if (sortField === 'odds') {
        return (a.marketOdds - b.marketOdds) * multiplier;
      }
      if (sortField === 'prob') {
        return (a.modelProb - b.modelProb) * multiplier;
      }
      if (sortField === 'implied') {
        return (a.impliedProb - b.impliedProb) * multiplier;
      }
      if (sortField === 'edge') {
        return (a.edge - b.edge) * multiplier;
      }
      if (sortField === 'kelly') {
        return (a.kellyUnits - b.kellyUnits) * multiplier;
      }
      if (sortField === 'conf') {
        return (a.confidence - b.confidence) * multiplier;
      }
      return 0;
    });
  }, [rawBinaryPicks, searchQuery, selectedLeague, selectedDate, convictionTier, sortField, sortDirection, minChance]);

  const binaryStats = useMemo(() => {
    if (!binaryPicks.length) {
      return {
        count: 0,
        highEdgeCount: 0,
        avgEdge: '0.0',
        avgConf: '0.0',
        combinedOdds: '0.00',
        totalKellyUnits: '0.0'
      };
    }
    const count = binaryPicks.length;
    const highEdgeCount = binaryPicks.filter(p => p.edge > 5).length;
    const sumEdge = binaryPicks.reduce((acc, p) => acc + (p.edge || 0), 0);
    const sumConf = binaryPicks.reduce((acc, p) => acc + (p.confidence || 0), 0);
    const sumKelly = binaryPicks.reduce((acc, p) => acc + (p.kellyUnits || 0), 0);
    const topSlice = binaryPicks.slice(0, 4);
    const prodOdds = topSlice.reduce((acc, p) => acc * (p.odds || 1.0), 1.0);

    return {
      count,
      highEdgeCount,
      avgEdge: (sumEdge / count).toFixed(1),
      avgConf: (sumConf / count).toFixed(1),
      combinedOdds: topSlice.length > 0 ? prodOdds.toFixed(2) : '0.00',
      totalKellyUnits: sumKelly.toFixed(1)
    };
  }, [binaryPicks]);

  return (
    <div className="space-y-4">
      
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Value bets</h2>
          <p className="text-[11px] text-slate-500">Tips where our chance of winning is higher than the odds suggest. {binaryStats.count} found.</p>
        </div>
        <KellyTooltip align="right">
          <span className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-help">How stakes work</span>
        </KellyTooltip>
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
        

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UniformDropdown
              label="League"
              value={selectedLeague}
              onChange={setSelectedLeague}
              options={leagueOptions}
            />
            <UniformDropdown
              label="Date"
              value={selectedDate}
              onChange={setSelectedDate}
              options={dateOptions}
            />

            <UniformDropdown
              label="Value"
              value={convictionTier}
              onChange={setConvictionTier}
              options={convictionOptions}
            />

            <UniformDropdown
              label="Chance"
              value={minChance}
              onChange={(v) => setMinChance(Number(v))}
              options={chanceOptions}
            />

            <UniformDropdown
              label="Sort"
              value={sortBy}
              onChange={handleDropdownSortChange}
              options={[
                { value: 'conf_desc', label: 'Most likely to win' },
                { value: 'edge_desc', label: 'Best value' },
                { value: 'time_asc', label: 'Kick-off: soonest' },
                { value: 'time_desc', label: 'Kick-off: latest' },
                { value: 'kelly_desc', label: 'Biggest stake' }
              ]}
            />
          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Showing <strong>{binaryPicks.length}</strong> value markets</span>
            {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || convictionTier !== 'ALL' || minChance > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLeague('All');
                  setSelectedDate('All');
                  setConvictionTier('ALL');
                  setMinChance(0);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-medium underline ml-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {accaMatchIds.size > 0 && typeof onClearSlip === 'function' && (
              <button
                onClick={onClearSlip}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Bet Slip ({accaMatchIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compact Binary Picks Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-900">{binaryPicks.length} tips</h2>
          </div>

          <button
            type="button"
            onClick={() => setCollapsedBinary(!collapsedBinary)}
            className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title={collapsedBinary ? 'Expand Value Bets' : 'Collapse Value Bets'}
          >
            <span>{collapsedBinary ? 'Expand' : 'Collapse'}</span>
            {collapsedBinary ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {!collapsedBinary && <MobileViewSwitcher label="Display" className="m-2" />}
        {!collapsedBinary && (
          <table className="block md:table w-full text-left border-collapse text-xs">
          <thead className="hidden md:table-header-group">
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
              {/* Expand Toggle */}
              <th className="py-1 px-1.5 w-7 text-center"></th>

              {/* Kickoff Day & Time */}
              <th 
                onClick={() => handleSort('time')}
                className={`py-1 px-2 min-w-[140px] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'time' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Kickoff Day & Time"
              >
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Kickoff</span>
                  {sortField === 'time' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* League */}
              <th 
                onClick={() => handleSort('league')}
                className={`py-1 px-2 min-w-[110px] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'league' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by League"
              >
                <div className="flex items-center gap-1">
                  <span>League</span>
                  {sortField === 'league' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Fixture */}
              <th 
                onClick={() => handleSort('fixture')}
                className={`py-1 px-2 min-w-[170px] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'fixture' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Fixture (A-Z / Z-A)"
              >
                <div className="flex items-center gap-1">
                  <span>Fixture</span>
                  {sortField === 'fixture' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Market Pick */}
              <th 
                onClick={() => handleSort('market')}
                className={`py-1 px-2 min-w-[120px] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'market' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by tip"
              >
                <div className="flex items-center gap-1">
                  <span>Tip</span>
                  {sortField === 'market' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Odds */}
              <th 
                onClick={() => handleSort('odds')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'odds' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Decimal Odds"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Odds</span>
                  {sortField === 'odds' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Prob */}
              <th 
                onClick={() => handleSort('prob')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'prob' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by our chance"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Our chance" content="How likely we think this tip is to win.">
                    <span>Our chance</span>
                  </InfoTooltip>
                  {sortField === 'prob' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Implied */}
              <th 
                onClick={() => handleSort('implied')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'implied' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by odds chance"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Odds chance" content="How likely the odds say this tip is to win.">
                    <span>Odds chance</span>
                  </InfoTooltip>
                  {sortField === 'implied' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Edge */}
              <th 
                onClick={() => handleSort('edge')}
                className={`py-1 px-1.5 w-20 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'edge' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by value"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Value" content="Our chance minus the odds' chance. Bigger is better.">
                    <span>Value</span>
                  </InfoTooltip>
                  {sortField === 'edge' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Kelly */}
              <th 
                onClick={() => handleSort('kelly')}
                className={`py-1 px-1.5 w-20 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'kelly' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by stake"
              >
                <div className="flex items-center justify-center gap-1">
                  <KellyTooltip align="center">
                    <span>Stake</span>
                  </KellyTooltip>
                  {sortField === 'kelly' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Actions */}
              <th className="py-1 px-2 w-56 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
            {binaryPicks.length === 0 ? (
              <tr className="flex flex-col md:table-row">
                <td colSpan={11} className="py-8 text-center text-slate-400 text-xs block md:table-cell">
                  No value picks match the selected filters.
                </td>
              </tr>
            ) : (
              binaryPicks.map((p, idx) => {
                const pickKey = p.id || idx;
                const isExpanded = expandedPickId === pickKey;
                const isSlipAdded = accaMatchIds.has(p.id);
                const isElite = p.edge >= 8;

                return (
                  <React.Fragment key={pickKey}>
                    <tr 
                      className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      onClick={() => toggleExpand(pickKey)}
                    >
                      {/* ================= MOBILE COMPACT CARD VIEW ================= */}
                      <MobileFoldCell
                        mode={mobileViewMode}
                        expanded={isExpanded}
                        summary={
                              <FoldSummary
                                lead={compactKickoff(p.time)}
                                home={p.home}
                                away={p.away}
                                title={(() => {
                                  const isHomeSide = String(p.market || '').includes('Home') || String(p.market || '').startsWith('1');
                                  const isAwaySide = String(p.market || '').includes('Away') || String(p.market || '').startsWith('2') || String(p.market || '').startsWith('X2');
                                  if (isHomeSide) {
                                    return (
                                      <span className="truncate">
                                        <span className="font-black text-slate-950 underline decoration-indigo-400 underline-offset-2">{p.home}</span>
                                        <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight">
                                          {String(p.market || '').includes('1X') ? '1X' : 'WIN'}
                                        </span>
                                        <span className="text-slate-400 font-normal mx-0.5">v</span>
                                        <span className="text-slate-500 font-medium">{p.away}</span>
                                      </span>
                                    );
                                  }
                                  if (isAwaySide) {
                                    return (
                                      <span className="truncate">
                                        <span className="text-slate-500 font-medium">{p.home}</span>
                                        <span className="text-slate-400 font-normal mx-0.5">v</span>
                                        <span className="font-black text-slate-950 underline decoration-indigo-400 underline-offset-2">{p.away}</span>
                                        <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded leading-tight">
                                          {String(p.market || '').includes('X2') ? 'X2' : 'WIN'}
                                        </span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="truncate">
                                      <span className="font-bold text-slate-900">{p.home}</span>
                                      <span className="text-slate-400 font-normal mx-1">v</span>
                                      <span className="font-bold text-slate-900">{p.away}</span>
                                    </span>
                                  );
                                })()}
                                live={p.isLive}
                                meta={`${p.league || 'Soccer'} · ${p.market}`}
                                expanded={isExpanded}
                                badges={<>
                                  <FoldBadge tone="accent" mono>{safeToFixed(p.modelProb, 0)}% Win</FoldBadge>
                                  <FoldBadge tone="info" mono>@{safeToFixed(p.marketOdds, 2)}</FoldBadge>
                                  <FoldBadge tone={p.edge >= 3 ? 'good' : 'neutral'} mono title="Model edge over the implied price">+{safeToFixed(p.edge, 1)}%</FoldBadge>
                                </>}
                              />
                        }
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-700 font-mono text-[10px] flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                              {p.time}
                            </span>
                            {p.isLive && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-white"></span>
                                LIVE {p.liveMinute ? `${p.liveMinute}'` : ''}
                              </span>
                            )}
                            <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                              {p.league || 'Soccer'}
                            </span>
                            <RiskBadgeWithAiHover
                              riskProfile={p.riskProfile}
                              match={p}
                              pick={p.pickTeam}
                              className="text-[9px] font-bold px-1 rounded border"
                            />
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isElite ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {p.market}
                          </span>
                        </div>

                        {/* Matchup */}
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {p.home} <span className="text-slate-400 font-normal">vs</span> {p.away}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs shrink-0">
                            <span className="font-bold text-slate-900">@{safeToFixed(p.marketOdds, 2)}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                              p.edge >= 8 ? 'bg-emerald-100 text-emerald-800' : p.edge > 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              +{safeToFixed(p.edge, 1)}% Edge
                            </span>
                          </div>
                        </div>

                        {/* Metrics Bar & Actions */}
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              Win: {safeToFixed(p.modelProb, 0)}%
                            </span>
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              Stake: {p.kellyUnits > 0 ? `${p.kellyUnits}% of bank` : 'No bet'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <WatchButton matchId={p.match?.id ?? p.id} className="!w-6 !h-6" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(p.match); }}
                              className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs ${
                                p.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}
                              title={p.isLive ? "Live Match Tactical AI Intelligence" : "Match Tactical AI Analysis"}
                            >
                              <Brain className={`w-2.5 h-2.5 shrink-0 ${p.isLive ? 'text-white' : 'text-indigo-600'}`} />
                              <span className="truncate">{p.isLive ? 'Live stats' : 'Stats'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(p.match); }}
                              className="w-[44px] h-6 px-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer"
                              title="Open Deep Analysis"
                            >
                              Intel
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(p.match, p.pick); }}
                              className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold transition-colors border inline-flex items-center justify-center gap-0.5 shrink-0 cursor-pointer ${
                                isSlipAdded
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {isSlipAdded ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Trigger */}
                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-600 font-semibold select-none">
                          <span>{isExpanded ? 'Hide Model Breakdown' : 'Show Divergence & Kelly Edge'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>

                        {/* Collapsible Mobile Content */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/60 p-2 rounded-lg text-[10px]">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                                <span className="text-slate-500 font-semibold block">Model Prob vs Bookmaker</span>
                                <div className="font-mono text-slate-800 space-y-0.5">
                                  <div>Engine Prob: <strong className="text-indigo-700">{safeToFixed(p.modelProb, 1)}%</strong></div>
                                  <div>Implied Odds: <span>{safeToFixed(p.impliedProb, 1)}%</span></div>
                                  <div>True Odds: <span>{safeToFixed(100 / Math.max(1, p.modelProb), 2)}</span></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                                <span className="text-slate-500 font-semibold block">Kelly Staking</span>
                                <div className="font-mono text-slate-800 space-y-0.5">
                                  <div>Edge: <strong className="text-emerald-700">+{safeToFixed(p.edge, 1)}%</strong></div>
                                  <div>Quarter Kelly: <span>{p.kellyUnits > 0 ? `${p.kellyUnits} units` : 'Zero EV'}</span></div>
                                  <div>Confidence: <span>{safeToFixed(p.modelProb, 0)}%</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </MobileFoldCell>

                      {/* ================= DESKTOP 1-ROW TABLE VIEW ================= */}
                      {/* Dropdown Chevron */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center text-slate-400">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                      </td>

                      {/* Kickoff Day & Time */}
                      <td className="hidden md:table-cell py-1 px-2 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 font-bold text-slate-900 text-[11px]">
                            <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{p.time}</span>
                            {p.isLive && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-white"></span>
                                LIVE {p.liveMinute ? `${p.liveMinute}'` : ''}
                              </span>
                            )}
                          </div>
                          {p.dt?.day && (p.time?.startsWith('Today') || p.time?.startsWith('Tomorrow')) && (
                            <span className="text-[9.5px] text-slate-400 pl-4 font-medium leading-tight">
                              {p.dt.day}, {p.dt.date}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* League */}
                      <td className="hidden md:table-cell py-1 px-2">
                        <span 
                          className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] truncate max-w-[110px] border border-slate-200"
                          title={p.league}
                        >
                          {p.league || 'Soccer'}
                        </span>
                      </td>

                      {/* Fixture */}
                      <td className="hidden md:table-cell py-1 px-2 min-w-[170px]">
                        <div className="font-semibold text-slate-900 flex items-center gap-1 flex-wrap text-[11.5px]">
                          <span className="text-slate-900 font-bold">{p.home}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">vs</span>
                          <span className="text-slate-900 font-bold">{p.away}</span>
                          {p.isLive && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(p.match); }}
                              className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.2 rounded-full shadow-xs animate-pulse cursor-pointer shrink-0"
                              title="Match is LIVE NOW! Click for Live Match stats"
                            >
                              <Brain className="w-1.5 h-1.5 text-white" />
                              <span>Live Intel</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Pick */}
                      <td className="hidden md:table-cell py-1 px-2 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                          isElite 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {p.market}
                        </span>
                        <RiskBadgeWithAiHover
                          riskProfile={p.riskProfile}
                          match={p}
                          pick={p.pickTeam}
                          className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold border"
                        />
                      </td>

                      {/* Bookmaker Odds */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                        {safeToFixed(p.marketOdds, 2)}
                      </td>

                      {/* Prob */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center whitespace-nowrap">
                        <ConfidenceGauge confidence={p.modelProb} size="sm" />
                      </td>

                      {/* Implied */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono text-slate-500 text-[10.5px] whitespace-nowrap">
                        {safeToFixed(p.impliedProb, 1)}%
                      </td>

                      {/* Edge */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10.5px] ${
                          p.edge >= 8 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : p.edge > 3 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.edge > 0 ? `+${safeToFixed(p.edge, 1)}%` : `${safeToFixed(p.edge, 1)}%`}
                        </span>
                      </td>

                      {/* Kelly Sizing */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center whitespace-nowrap">
                        <KellyTooltip showIcon={false} align="center">
                          <div className="cursor-help inline-block leading-tight">
                            <span className="font-mono font-bold text-slate-800 text-[11px] block hover:text-indigo-600 transition-colors">
                              {p.kellyUnits > 0 ? `${p.kellyUnits}%` : 'No bet'}
                            </span>
                            <span className="text-[9px] text-slate-400 block font-mono">
                              of bank
                            </span>
                          </div>
                        </KellyTooltip>
                      </td>

                      {/* Actions */}
                      <td className="hidden md:table-cell py-1 px-2 text-center whitespace-nowrap w-56">
                        <WatchButton matchId={p.match?.id ?? p.id} className="!w-6 !h-6 align-middle mr-1" />
                          <div className="inline-grid align-middle grid-cols-[98px_44px_58px] gap-1.5 items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(p.match); }}
                            className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs ${
                              p.isLive
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs animate-pulse font-extrabold'
                                : 'border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                            title={p.isLive ? "Live Match Tactical AI Intelligence" : "Match Tactical AI Analysis"}
                          >
                            <Brain className={`w-2.5 h-2.5 shrink-0 ${p.isLive ? 'text-white' : 'text-indigo-600'}`} />
                            <span className="truncate">{p.isLive ? 'Live stats' : 'Stats'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(p.match); }}
                            className="w-[44px] h-6 px-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer"
                            title="Open Deep Analysis"
                          >
                            Intel
                          </button>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(p.match, p.pick); }}
                            className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold transition-colors cursor-pointer border inline-flex items-center justify-center gap-0.5 shrink-0 ${
                              isSlipAdded
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                            title={isSlipAdded ? 'Remove from bet slip' : 'Add to bet slip'}
                          >
                            {isSlipAdded ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ================= DESKTOP EXPANDED DETAIL ROW ================= */}
                    {isExpanded && (
                      <tr className="hidden md:table-row bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={11} className="p-3">
                          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-xs">
                                  Quantitative Edge &amp; Expected Value Breakdown:
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {p.home} vs {p.away} ({p.market})
                                </span>
                              </div>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                isElite ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                Divergence Edge: +{safeToFixed(p.edge, 1)}%
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Probability Divergence
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Model Probability:</span>
                                    <span className="font-bold text-indigo-700">{safeToFixed(p.modelProb, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Market Implied Prob:</span>
                                    <span className="font-bold text-slate-700">{safeToFixed(p.impliedProb, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Model Fair Odds:</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(100 / Math.max(1, p.modelProb), 2)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Kelly Staking Protocol
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Market Price:</span>
                                    <span className="font-bold text-slate-800">@{safeToFixed(p.marketOdds, 2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Calculated Stake:</span>
                                    <span className="font-bold text-emerald-700">{p.kellyUnits > 0 ? `${p.kellyUnits} units` : 'No bet recommended'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Strategy Formula:</span>
                                    <span className="text-slate-500 text-[10px]">Quarter-Kelly (Conservative)</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Signal Verification
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Confidence Tier:</span>
                                    <span className="font-bold text-indigo-700">{isElite ? 'Elite High Conviction' : 'Standard Value Pick'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Expected Value:</span>
                                    <span className="font-bold text-emerald-700">+{safeToFixed(p.edge, 1)}% Edge</span>
                                  </div>
                                </div>
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
        )}
      </div>

    </div>
  );
}
