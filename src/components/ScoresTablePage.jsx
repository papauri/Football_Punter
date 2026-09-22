import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Target, 
  Activity, 
  Brain, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Scale,
  CheckCircle2
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import InfoTooltip from './InfoTooltip';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey } from '../utils/dateUtils';

export default function ScoresTablePage({
  matches = [],
  leaguePerformance = [],
  scoreTrainingStats,
  onOpenDeepResearch,
  onAddToSlip,
  tzSettings = {},
  onSelectMarketMode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL', 'OVER_25', 'UNDER_25', 'BTTS_YES', 'HIGH_PROB'
  const [sortField, setSortField] = useState('time');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [sortBy, setSortBy] = useState('time_asc');

  const handleSort = (field) => {
    if (sortField === field) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
      if (field === 'time') setSortBy(nextDir === 'asc' ? 'time_asc' : 'custom');
      else setSortBy('custom');
    } else {
      setSortField(field);
      const defaultDesc = ['top_score', 'over15', 'over25', 'btts', 'xg'].includes(field);
      const newDir = defaultDesc ? 'desc' : 'asc';
      setSortDirection(newDir);
      if (field === 'time') setSortBy(newDir === 'asc' ? 'time_asc' : 'custom');
      else setSortBy('custom');
    }
  };

  const handleDropdownSortChange = (newVal) => {
    setSortBy(newVal);
    if (newVal === 'time_asc') {
      setSortField('time');
      setSortDirection('asc');
    } else if (newVal === 'over_desc') {
      setSortField('over25');
      setSortDirection('desc');
    } else if (newVal === 'under_desc') {
      setSortField('over25');
      setSortDirection('asc'); // lowest over = highest under
    } else if (newVal === 'xg_desc') {
      setSortField('xg');
      setSortDirection('desc');
    }
  };

  const formatMatchKickoff = (m) => {
    if (m.status === 'LIVE' || m.status === 'IN_PLAY') return 'LIVE';
    if (m.status === 'FT' || m.status === 'FINISHED') return 'FT';
    const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
    if (timeVal) return formatRelativeDayTime(timeVal, tzSettings);
    if (m.time) return m.time;
    return 'Upcoming';
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


  // Filter and sort
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      // Exclude finished matches from upcoming fixtures view
      if (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (m.home || '').toLowerCase();
        const away = (m.away || '').toLowerCase();
        const league = (m.league || '').toLowerCase();
        if (!home.includes(q) && !away.includes(q) && !league.includes(q)) return false;
      }

      if (selectedLeague !== 'All' && m.league !== selectedLeague) return false;
      if (selectedDate !== 'All') {
        const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
        const mDate = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
        if (mDate !== selectedDate) return false;
      }

      const over25 = m.scoreModel?.overUnder?.over25 || (m.over25Prob || 50);
      const bttsYes = m.scoreModel?.btts?.yes || 50;

      if (marketFilter === 'OVER_25' && over25 < 58) return false;
      if (marketFilter === 'OVER_25_HIGH_CONF' && over25 < 65) return false;
      if (marketFilter === 'UNDER_25' && over25 > 45) return false;
      if (marketFilter === 'UNDER_25_HIGH_CONF' && over25 > 35) return false; // i.e., under25 >= 65
      if (marketFilter === 'BTTS_YES' && bttsYes < 55) return false;
      if (marketFilter === 'BTTS_YES_HIGH_CONF' && bttsYes < 65) return false;
      if (marketFilter === 'BTTS_NO_HIGH_CONF' && bttsYes > 40) return false; // i.e., bttsNo >= 60

      if (marketFilter === 'HIGH_PROB') {
        const topScoreProb = m.scoreModel?.topScorelines?.[0]?.prob || 0;
        if (topScoreProb < 14) return false;
      }
      if (marketFilter === 'EXACT_SCORE_HIGH_CONF') {
        const topScoreProb = m.scoreModel?.topScorelines?.[0]?.prob || 0;
        if (topScoreProb < 16) return false;
      }

      return true;
    }).sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'time') {
        const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
        const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
        return (tA - tB) * multiplier;
      }
      if (sortField === 'fixture') {
        const nameA = `${a.home || ''} ${a.away || ''} ${a.league || ''}`.toLowerCase();
        const nameB = `${b.home || ''} ${b.away || ''} ${b.league || ''}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      }
      if (sortField === 'top_score') {
        const pA = a.scoreModel?.topScorelines?.[0]?.prob || 0;
        const pB = b.scoreModel?.topScorelines?.[0]?.prob || 0;
        return (pA - pB) * multiplier;
      }
      if (sortField === 'over15') {
        const oA = safeParseFloat(a.scoreModel?.overUnder?.over15, 75);
        const oB = safeParseFloat(b.scoreModel?.overUnder?.over15, 75);
        return (oA - oB) * multiplier;
      }
      if (sortField === 'over25') {
        const oA = safeParseFloat(a.scoreModel?.overUnder?.over25 ?? a.over25Prob, 52);
        const oB = safeParseFloat(b.scoreModel?.overUnder?.over25 ?? b.over25Prob, 52);
        return (oA - oB) * multiplier;
      }
      if (sortField === 'btts') {
        const bA = safeParseFloat(a.scoreModel?.btts?.yes, 50);
        const bB = safeParseFloat(b.scoreModel?.btts?.yes, 50);
        return (bA - bB) * multiplier;
      }
      if (sortField === 'xg') {
        const xgA = (a.lambda || safeParseFloat(a.xG?.home, 1.4)) + (a.mu || safeParseFloat(a.xG?.away, 1.1));
        const xgB = (b.lambda || safeParseFloat(b.xG?.home, 1.4)) + (b.mu || safeParseFloat(b.xG?.away, 1.1));
        return (xgA - xgB) * multiplier;
      }
      if (sortField === 'best_value') {
        const getVal = (m) => {
          const o25 = safeParseFloat(m.scoreModel?.overUnder?.over25 ?? m.over25Prob, 52);
          const u25 = 100 - o25;
          const bt = safeParseFloat(m.scoreModel?.btts?.yes, 50);
          return Math.max(o25, u25, bt);
        };
        return (getVal(a) - getVal(b)) * multiplier;
      }
      return 0;
    });
  }, [matches, searchQuery, selectedLeague, selectedDate, marketFilter, sortField, sortDirection]);

  const aggregateStats = useMemo(() => {
    if (!filteredMatches.length) return null;
    
    let sumExact = 0;
    let sumOver25 = 0;
    let sumBtts = 0;
    
    filteredMatches.forEach(m => {
      sumExact += (m.scoreModel?.topScorelines?.[0]?.prob || 0);
      sumOver25 += (m.scoreModel?.overUnder?.over25 || m.over25Prob || 50);
      sumBtts += (m.scoreModel?.btts?.yes || 50);
    });

    const count = filteredMatches.length;
    return {
      exactScore: (sumExact / count).toFixed(1),
      over25: (sumOver25 / count).toFixed(1),
      btts: (sumBtts / count).toFixed(1)
    };
  }, [filteredMatches]);

  return (
    <div className="space-y-4">
      
      {/* Top Bar with Accuracy Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <div className="font-bold text-slate-800 text-sm">Statistical Scoreline Model</div>
          <div className="text-slate-500 text-[11px]">Dynamic expected hit rates for currently filtered matches</div>
        </div>

        <div className="flex items-center gap-2">
          {aggregateStats ? (
            <>
              <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Exp. Exact Score Hit</div>
                <div className="font-bold text-slate-800 font-mono text-xs">{aggregateStats.exactScore}%</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Exp. O/U 2.5 Hit</div>
                <div className="font-bold text-emerald-700 font-mono text-xs">{aggregateStats.over25}%</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Exp. BTTS Hit</div>
                <div className="font-bold text-indigo-700 font-mono text-xs">{aggregateStats.btts}%</div>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-xs italic">No matches found for current filter</div>
          )}
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
              <button
                type="button"
                className="px-2.5 py-1 rounded-md bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold transition-all flex items-center gap-1.5 cursor-default"
              >
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>Goals & Totals (O/U & BTTS)</span>
              </button>
              {onSelectMarketMode && (
                <button
                  type="button"
                  onClick={() => onSelectMarketMode('binary')}
                  className="px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Switch to Value Bets & Kelly Moneyline"
                >
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Value Bets & Kelly (+EV)</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">
              <CheckCircle2 className="w-3 h-3 text-blue-600" />
              {filteredMatches.length} fixtures in view
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by club..."
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
              label="Market"
              value={marketFilter}
              onChange={setMarketFilter}
              options={[
                { value: 'ALL', label: 'All Totals Markets' },
                { value: 'OVER_25', label: 'Over 2.5 Goals (Favored)' },
                { value: 'OVER_25_HIGH_CONF', label: 'Over 2.5 Goals (High Conf ≥65%)' },
                { value: 'UNDER_25', label: 'Under 2.5 Goals (Favored)' },
                { value: 'UNDER_25_HIGH_CONF', label: 'Under 2.5 Goals (High Conf ≥65%)' },
                { value: 'BTTS_YES', label: 'Both Teams To Score (Yes)' },
                { value: 'BTTS_YES_HIGH_CONF', label: 'BTTS Yes (High Conf ≥65%)' },
                { value: 'BTTS_NO_HIGH_CONF', label: 'BTTS No (High Conf ≥60%)' },
                { value: 'HIGH_PROB', label: 'High Score Prob (≥14%)' },
                { value: 'EXACT_SCORE_HIGH_CONF', label: 'Exact Score Hit (High Conf ≥16%)' }
              ]}
            />

            <UniformDropdown
              label="Sort"
              value={sortBy}
              onChange={handleDropdownSortChange}
              options={[
                { value: 'time_asc', label: 'Kickoff (Earliest)' },
                { value: 'over_desc', label: 'Over 2.5 Probability' },
                { value: 'under_desc', label: 'Under 2.5 Probability' },
                { value: 'xg_desc', label: 'Total Expected Goals (xG)' }
              ]}
            />
          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Showing <strong>{filteredMatches.length}</strong> of {matches.length} fixtures</span>
          {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || marketFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedLeague('All');
                  setSelectedDate('All');
                setMarketFilter('ALL');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Compact Scores Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none h-10">
                {/* Time */}
                <th 
                  onClick={() => handleSort('time')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Kickoff Time (Asc / Desc)"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span className={sortField === 'time' ? 'text-indigo-600 font-bold' : ''}>Time</span>
                    {sortField === 'time' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Fixture */}
                <th 
                  onClick={() => handleSort('fixture')}
                  className="py-1.5 px-2 min-w-[180px] cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Match / Competition (A-Z / Z-A)"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'fixture' ? 'text-indigo-600 font-bold' : ''}>Fixture</span>
                    {sortField === 'fixture' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Top Projected Scores */}
                <th 
                  onClick={() => handleSort('top_score')}
                  className="py-1.5 px-2 min-w-[140px] cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Top Scoreline Probability"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'top_score' ? 'text-indigo-600 font-bold' : ''}>Proj. Scores</span>
                    {sortField === 'top_score' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* O1.5 */}
                <th 
                  onClick={() => handleSort('over15')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Over 1.5 Goals Probability"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Over / Under 1.5 Goals" content="Probability of the match having Over 1.5 (2 or more goals). Click to sort.">
                      <span className={sortField === 'over15' ? 'text-indigo-600 font-bold' : ''}>O1.5</span>
                    </InfoTooltip>
                    {sortField === 'over15' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* O2.5 */}
                <th 
                  onClick={() => handleSort('over25')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Over 2.5 Goals Probability"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Over / Under 2.5 Goals" content="Probability of the match having Over 2.5 (3 or more goals). Click to sort.">
                      <span className={sortField === 'over25' ? 'text-indigo-600 font-bold' : ''}>O2.5</span>
                    </InfoTooltip>
                    {sortField === 'over25' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* BTTS */}
                <th 
                  onClick={() => handleSort('btts')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Both Teams to Score (Yes) Probability"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Both Teams to Score (BTTS)" content="Probability of both teams scoring at least one goal (Yes). Click to sort.">
                      <span className={sortField === 'btts' ? 'text-indigo-600 font-bold' : ''}>BTTS</span>
                    </InfoTooltip>
                    {sortField === 'btts' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Total xG */}
                <th 
                  onClick={() => handleSort('xg')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Combined Expected Goals (xG)"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Total Expected Goals" content="Combined xG projection for both teams. Click to sort.">
                      <span className={sortField === 'xg' ? 'text-indigo-600 font-bold' : ''}>Total xG</span>
                    </InfoTooltip>
                    {sortField === 'xg' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Best Value Total */}
                <th 
                  onClick={() => handleSort('best_value')}
                  className="py-1.5 px-2 w-36 text-left cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Best Value Edge"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'best_value' ? 'text-indigo-600 font-bold' : ''}>Best Value Total</span>
                    {sortField === 'best_value' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-1.5 px-2 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100">
              {filteredMatches.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={9} className="py-12 text-center text-slate-400 block md:table-cell">
                    No scorelines match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMatches.map((m, idx) => {
                  const over15 = safeParseFloat(m.scoreModel?.overUnder?.over15, 75);
                  const over25 = safeParseFloat(m.scoreModel?.overUnder?.over25 ?? m.over25Prob, 52);
                  const under25 = 100 - over25;
                  const bttsYes = safeParseFloat(m.scoreModel?.btts?.yes, 50);
                  const topScores = m.scoreModel?.topScorelines?.slice(0, 3) || [];
                  const homeLambda = safeParseFloat(m.lambda ?? m.xG?.home, 1.4);
                  const awayMu = safeParseFloat(m.mu ?? m.xG?.away, 1.1);
                  const totalXg = safeToFixed(homeLambda + awayMu, 1, '2.5');

                  const bestValuePick = over25 >= 58 ? 'Over 2.5 Goals' : under25 >= 58 ? 'Under 2.5 Goals' : bttsYes >= 58 ? 'BTTS - Yes' : 'Under 3.5 Goals';

                  return (
                    <tr key={m.id || idx} className={`flex flex-col md:table-row hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} md:h-12`}>
                      
                      {/* ---------------- MOBILE VIEW ---------------- */}
                      <td className="md:hidden p-3 block">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-semibold text-slate-700 font-mono text-[10px] mr-2">
                              {formatMatchKickoff(m)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {m.league?.split(' ')[0] || 'Soccer'}
                            </span>
                          </div>
                          <span className="font-bold text-slate-700 font-mono text-xs">
                            xG: {totalXg}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{m.home}</span>
                            <span className="font-bold text-slate-900">{m.away}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-indigo-700 font-mono mb-0.5">
                              {topScores.length > 0 ? `${topScores[0].score} (${safeToFixed(topScores[0].prob, 1)}%)` : '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {topScores.length > 1 ? `${topScores[1].score} | ${topScores[2]?.score || '—'}` : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                           <div className="flex gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${over25 >= 55 ? 'bg-emerald-50 text-emerald-700' : under25 >= 55 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {over25 >= 50 ? `O2.5 ${safeToFixed(over25, 0)}%` : `U2.5 ${safeToFixed(under25, 0)}%`}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${bttsYes >= 55 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                BTTS {bttsYes >= 50 ? 'Y' : 'N'}
                              </span>
                           </div>
                           <div className="flex gap-1">
                             <button
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                className="px-2 py-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 text-teal-800 text-center"
                              >
                                Analysis
                             </button>
                             {onAddToSlip && (
                               <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const pickProb = bestValuePick === 'Over 2.5 Goals' ? over25 : bestValuePick === 'Under 2.5 Goals' ? under25 : bestValuePick === 'BTTS - Yes' ? bttsYes : 50;
                                    const estOdds = (100 / Math.max(10, pickProb - 5)).toFixed(2);
                                    onAddToSlip(m, 'OVER_UNDER', bestValuePick, estOdds, pickProb);
                                  }}
                                  className="px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 text-center"
                                >
                                  + Slip
                               </button>
                             )}
                           </div>
                        </div>
                      </td>

                      {/* ---------------- DESKTOP CELLS ---------------- */}
                      {/* Time */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <span className="font-semibold text-slate-700 font-mono text-xs block">
                          {formatMatchKickoff(m)}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[65px] mx-auto">
                          {m.league?.split(' ')[0] || 'Soccer'}
                        </span>
                      </td>

                      {/* Fixture */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {m.home} vs {m.away}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                          {m.league}
                        </div>
                      </td>

                      {/* Top 3 Exact Scores */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {topScores.slice(0, 3).map((sc, scIdx) => (
                            <span 
                              key={scIdx} 
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                                scIdx === 0 
                                  ? 'bg-indigo-50 text-indigo-800 font-bold border-indigo-200' 
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <strong>{sc.score}</strong> ({safeToFixed(sc.prob, 1)}%)
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* O/U 1.5 */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-xs">
                        <span className={over15 > 70 ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                          O: {safeToFixed(over15, 0)}%
                        </span>
                      </td>

                      {/* O/U 2.5 */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-xs">
                        <span className={`px-1 rounded ${over25 >= 55 ? 'bg-emerald-50 text-emerald-700 font-bold' : under25 >= 55 ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}>
                          {over25 >= 50 ? `O ${safeToFixed(over25, 0)}%` : `U ${safeToFixed(under25, 0)}%`}
                        </span>
                      </td>

                      {/* BTTS */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-xs">
                        <span className={`px-1 rounded ${bttsYes >= 55 ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
                          {bttsYes >= 50 ? `Yes ${safeToFixed(bttsYes, 0)}%` : `No ${safeToFixed(100 - bttsYes, 0)}%`}
                        </span>
                      </td>

                      {/* Total xG */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-xs font-semibold text-slate-700">
                        {totalXg}
                      </td>

                      {/* Best Value Total */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <span className="font-semibold text-slate-800 text-[11px] block">
                          {bestValuePick}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-medium font-mono">
                          Edge: +{safeToFixed(Math.abs(over25 - 50) * 0.4, 1)}%
                        </span>
                      </td>

                      {/* Analysis Action */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                            className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                            title="Open Analysis"
                          >
                            Analysis
                          </button>
                          {onAddToSlip && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const pickProb = bestValuePick === 'Over 2.5 Goals' ? over25 : bestValuePick === 'Under 2.5 Goals' ? under25 : bestValuePick === 'BTTS - Yes' ? bttsYes : 50;
                                const estOdds = (100 / Math.max(10, pickProb - 5)).toFixed(2);
                                onAddToSlip(m, 'OVER_UNDER', bestValuePick, estOdds, pickProb);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                              title={`Add ${bestValuePick} to Slip`}
                            >
                              + Add
                            </button>
                          )}
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

    </div>
  );
}
