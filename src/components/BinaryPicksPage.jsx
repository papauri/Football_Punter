import React, { useState, useMemo } from 'react';
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
  Play
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey } from '../utils/dateUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [convictionTier, setConvictionTier] = useState('ALL'); // 'ALL', 'ELITE', 'HIGH_VALUE'
  const [sortField, setSortField] = useState('edge');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [sortBy, setSortBy] = useState('edge_desc');

  const handleSort = (field) => {
    if (sortField === field) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
      if (field === 'edge') setSortBy(nextDir === 'desc' ? 'edge_desc' : 'custom');
      else if (field === 'kelly') setSortBy(nextDir === 'desc' ? 'kelly_desc' : 'custom');
      else setSortBy('custom');
    } else {
      setSortField(field);
      const defaultDesc = ['odds', 'prob', 'implied', 'edge', 'kelly', 'conf'].includes(field);
      const newDir = defaultDesc ? 'desc' : 'asc';
      setSortDirection(newDir);
      if (field === 'edge') setSortBy(newDir === 'desc' ? 'edge_desc' : 'custom');
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
    }
  };

  // Extract leagues
  const leagueOptions = useMemo(() => {
    const set = new Set();
    matches.forEach(m => {
      if (m.league) set.add(m.league);
    });
    return [
      { value: 'All', label: `All Leagues (${matches.length})` },
      ...Array.from(set).sort().map(l => {
        const count = matches.filter(m => m.league === l).length;
        const perf = leaguePerformance.find(p => p.league === l);
        const perfStr = perf ? ` - ${perf.accuracy}% Acc` : '';
        return { value: l, label: `${l} (${count})${perfStr}` };
      })
    ];
  }, [matches, leaguePerformance]);

  // Extract unique date options
  const dateOptions = useMemo(() => {
    const dates = {};
    matches.forEach(m => {
      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      const dKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
      dates[dKey] = (dates[dKey] || 0) + 1;
    });
    const keys = Object.keys(dates).sort();
    return [
      { value: 'All', label: `All Dates (${matches.length})` },
      ...keys.map(k => ({ value: k, label: `${k} (${dates[k]})` }))
    ];
  }, [matches]);


  // Helper to check if match is finished
  const isMatchCompleted = (m) => {
    if (!m) return false;
    if (m.isCompleted) return true;
    const st = String(m.status || m.state || '').toUpperCase();
    if (st === 'FT' || st === 'FINISHED' || st === 'FINAL' || st === 'STATUS_FULL_TIME') return true;
    if (m.actualScore && !m.isLive) return true;
    return false;
  };

  // Compute binary edges for all matches
  const binaryPicks = useMemo(() => {
    const picks = [];

    matches.forEach(m => {
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
      const kellyUnits = safeParseFloat((rawKelly * 25).toFixed(1), 0);

      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      const formattedTime = timeVal ? formatRelativeDayTime(timeVal, tzSettings) : (m.time || 'Upcoming');

      picks.push({
        match: m,
        id: m.id,
        time: formattedTime,
        dt: formatSafeDateTime(timeVal, null, tzSettings),
        league: m.league,
        home: m.home,
        away: m.away,
        pickTeam: bestTeam,
        market: m.isLive ? `${bestTeam} Live In-Play (${m.liveMinute || 0}')` : `${bestTeam} Moneyline`,
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

    return picks.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.home.toLowerCase().includes(q) && !p.away.toLowerCase().includes(q) && !p.league.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (selectedLeague !== 'All' && p.league !== selectedLeague) return false;
      
      if (selectedDate !== 'All') {
        const mDateObj = p.match;
        const timeVal = mDateObj.timestamp || mDateObj.utcDate || mDateObj.dateIso || mDateObj.date;
        const mDate = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
        if (mDate !== selectedDate) return false;
      }

      if (convictionTier === 'ELITE' && (p.edge < 8 || p.confidence < 65)) return false;
      if (convictionTier === 'HIGH_VALUE' && p.edge < 5) return false;

      return true;
    }).sort((a, b) => {
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
  }, [matches, searchQuery, selectedLeague, selectedDate, convictionTier, sortField, sortDirection, tzSettings]);

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <div className="font-bold text-slate-800 text-sm">Value Bets & Staking</div>
          <div className="text-slate-500 text-[11px]">Strict mathematical edges against bookmaker implied probability</div>
        </div>

        <div className="flex items-center gap-2">
          <KellyTooltip align="right">
            <span className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1 transition-colors">
              <span>What is Kelly Staking?</span>
            </span>
          </KellyTooltip>
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            {binaryPicks.filter(p => p.edge > 5).length} High-Edge Markets Active
          </span>
        </div>
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
        
        {/* Market Perspective Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">Market View:</span>
            <div className="inline-flex p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80 text-xs font-semibold">
              {onSelectMarketMode && (
                <button
                  type="button"
                  onClick={() => onSelectMarketMode('fixtures')}
                  className="px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Switch to All Match Predictions"
                >
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  <span>All Markets (1X2 & Scores)</span>
                </button>
              )}
              {onSelectMarketMode && (
                <button
                  type="button"
                  onClick={() => onSelectMarketMode('scores')}
                  className="px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Switch to Goals & Totals (Over/Under & BTTS)"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>Goals & Totals (O/U & BTTS)</span>
                </button>
              )}
              <button
                type="button"
                className="px-2.5 py-1 rounded-md bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold transition-all flex items-center gap-1.5 cursor-default"
              >
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>Value Bets & Kelly (+EV)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {binaryPicks.length} value picks calculated
            </span>
          </div>
        </div>

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
              label="Edge Tier"
              value={convictionTier}
              onChange={setConvictionTier}
              options={[
                { value: 'ALL', label: 'All Value Bets' },
                { value: 'ELITE', label: 'Elite Value (Edge ≥8%)' },
                { value: 'HIGH_VALUE', label: 'High Value (Edge ≥5%)' }
              ]}
            />

            <UniformDropdown
              label="Sort"
              value={sortBy}
              onChange={handleDropdownSortChange}
              options={[
                { value: 'edge_desc', label: 'Highest Betting Edge' },
                { value: 'conf_desc', label: 'Highest Model Confidence' },
                { value: 'kelly_desc', label: 'Largest Kelly' }
              ]}
            />
          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Showing <strong>{binaryPicks.length}</strong> value markets</span>
            {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || convictionTier !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLeague('All');
                  setSelectedDate('All');
                  setConvictionTier('ALL');
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
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Bet Slip ({accaMatchIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compact Binary Picks Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 select-none h-9">
              {/* Kickoff Day & Time */}
              <th 
                onClick={() => handleSort('time')}
                className={`py-2 px-3 min-w-[155px] text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'time' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Kickoff Day & Time"
              >
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Kickoff (Day & Time)</span>
                  {sortField === 'time' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* League */}
              <th 
                onClick={() => handleSort('league')}
                className={`py-2 px-3 min-w-[130px] text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'league' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by League"
              >
                <div className="flex items-center gap-1">
                  <span>League</span>
                  {sortField === 'league' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Fixture */}
              <th 
                onClick={() => handleSort('fixture')}
                className={`py-2 px-3 min-w-[190px] text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'fixture' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Fixture (A-Z / Z-A)"
              >
                <div className="flex items-center gap-1">
                  <span>Fixture</span>
                  {sortField === 'fixture' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Market Pick */}
              <th 
                onClick={() => handleSort('market')}
                className={`py-2 px-2.5 min-w-[140px] text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'market' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Market Pick"
              >
                <div className="flex items-center gap-1">
                  <span>Market Pick</span>
                  {sortField === 'market' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Odds */}
              <th 
                onClick={() => handleSort('odds')}
                className={`py-2 px-2 w-20 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'odds' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Decimal Odds"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Odds</span>
                  {sortField === 'odds' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Prob */}
              <th 
                onClick={() => handleSort('prob')}
                className={`py-2 px-2 w-20 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'prob' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Model Probability"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Probability" content="The absolute probability calculated by our Poisson engine for this outcome to occur. Click to sort.">
                    <span>Prob</span>
                  </InfoTooltip>
                  {sortField === 'prob' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Implied */}
              <th 
                onClick={() => handleSort('implied')}
                className={`py-2 px-2 w-20 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'implied' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Implied Probability"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Implied Probability" content="The probability implied by bookmaker odds (1 / Decimal Odds). Click to sort.">
                    <span>Implied</span>
                  </InfoTooltip>
                  {sortField === 'implied' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Edge */}
              <th 
                onClick={() => handleSort('edge')}
                className={`py-2 px-2 w-24 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'edge' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Edge (+EV)"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Divergence Edge" content="The positive difference (+EV) between Prob and Implied. Click to sort.">
                    <span>Edge</span>
                  </InfoTooltip>
                  {sortField === 'edge' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Kelly */}
              <th 
                onClick={() => handleSort('kelly')}
                className={`py-2 px-2 w-24 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'kelly' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Kelly sizing"
              >
                <div className="flex items-center justify-center gap-1">
                  <KellyTooltip align="center">
                    <span>Kelly</span>
                  </KellyTooltip>
                  {sortField === 'kelly' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Actions */}
              <th className="py-2 px-2.5 w-32 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {binaryPicks.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  No value picks match the selected filters.
                </td>
              </tr>
            ) : (
              binaryPicks.map((p, idx) => {
                const isSlipAdded = accaMatchIds.has(p.id);
                const isElite = p.edge >= 8;

                return (
                  <tr 
                    key={p.id || idx} 
                    className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} h-11`}
                  >
                    {/* Kickoff Day & Time */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{p.time}</span>
                          {p.isLive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              LIVE {p.liveMinute ? `${p.liveMinute}'` : ''}
                            </span>
                          )}
                        </div>
                        {p.dt?.day && (p.time?.startsWith('Today') || p.time?.startsWith('Tomorrow')) && (
                          <span className="text-[10px] text-slate-400 pl-5 font-medium">
                            {p.dt.day}, {p.dt.date}
                          </span>
                        )}
                        {p.broadcast && (
                          <span className="text-[9px] text-indigo-700 font-semibold pl-5 pt-0.5 truncate max-w-[140px]" title={`Broadcast: ${p.broadcast}`}>
                            📺 {p.broadcast.split(',')[0]}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* League */}
                    <td className="py-2 px-3">
                      <span 
                        className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] truncate max-w-[130px] border border-slate-200"
                        title={p.league}
                      >
                        {p.league || 'Soccer'}
                      </span>
                    </td>

                    {/* Fixture */}
                    <td className="py-2 px-3 min-w-[190px]">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-900 font-bold">{p.home}</span>
                        <span className="text-[10px] text-slate-400 font-normal">vs</span>
                        <span className="text-slate-900 font-bold">{p.away}</span>
                        {p.isLive && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(p.match); }}
                            className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded-full shadow-xs animate-pulse cursor-pointer shrink-0"
                            title="Match is LIVE NOW! Click to Watch Stream"
                          >
                            <Play className="w-2 h-2 fill-white text-white" />
                            <span>Watch Now</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Pick */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        isElite 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {p.market}
                      </span>
                    </td>

                    {/* Bookmaker Odds */}
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                      {safeToFixed(p.marketOdds, 2)}
                    </td>

                    {/* Prob */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <ConfidenceGauge confidence={p.modelProb} size="sm" />
                    </td>

                    {/* Implied */}
                    <td className="py-2 px-2 text-center font-mono text-slate-500 text-xs whitespace-nowrap">
                      {safeToFixed(p.impliedProb, 1)}%
                    </td>

                    {/* Edge */}
                    <td className="py-2 px-2 text-center font-mono whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-xs ${
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
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <KellyTooltip showIcon={false} align="center">
                        <div className="cursor-help inline-block">
                          <span className="font-mono font-bold text-slate-800 text-xs block hover:text-indigo-600 transition-colors">
                            {p.kellyUnits > 0 ? `${p.kellyUnits}u` : 'No bet'}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            1/4 Kelly
                          </span>
                        </div>
                      </KellyTooltip>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(p.match); }}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                            p.isLive
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-400 animate-pulse'
                              : 'border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                          }`}
                          title="Watch Match Live & In-Play Radar Simulator"
                        >
                          <Play className={`w-3 h-3 ${p.isLive ? 'fill-white text-white' : 'fill-indigo-600 text-indigo-600'}`} />
                          <span>{p.isLive ? 'Watch Now' : 'Watch'}</span>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(p.match); }}
                          className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                          title="Open Analysis"
                        >
                          Analysis
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(p.match); }}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                            isSlipAdded
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          title={isSlipAdded ? 'Remove from Bet Slip' : 'Add to Bet Slip'}
                        >
                          {isSlipAdded ? 'Remove' : '+ Slip'}
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
