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
  CheckCircle2
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { formatRelativeDayTime, getLocalizedDateKey } from '../utils/dateUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';

export default function BinaryPicksPage({
  matches = [],
  leaguePerformance = [],
  onOpenDeepResearch,
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


  // Compute binary edges for all matches
  const binaryPicks = useMemo(() => {
    const picks = [];

    matches.forEach(m => {
      // Exclude finished matches
      if (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') return;

      const homeP = safeParseFloat(m.prob?.home, 0);
      const awayP = safeParseFloat(m.prob?.away, 0);
      const drawP = safeParseFloat(m.prob?.draw, 0);

      // Market odds estimate (or use existing marketOdds if available)
      const mHomeOdds = m.marketOdds?.home || (homeP > 0 ? (100 / Math.max(15, homeP - 5)).toFixed(2) : 2.0);
      const mAwayOdds = m.marketOdds?.away || (awayP > 0 ? (100 / Math.max(15, awayP - 5)).toFixed(2) : 3.0);
      
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
        league: m.league,
        home: m.home,
        away: m.away,
        pickTeam: bestTeam,
        market: `${bestTeam} Moneyline`,
        modelProb: bestProb,
        marketOdds: bestOdds,
        impliedProb,
        edge,
        kellyUnits,
        confidence: safeParseFloat(m.confidence, bestProb),
        dateIso: m.dateIso,
        rawDate: m.date
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-visible">
        <div className="w-full">
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

                {/* Market Pick */}
                <th 
                  onClick={() => handleSort('market')}
                  className="py-1.5 px-2 min-w-[160px] cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Market Pick"
                >
                  <div className="inline-flex items-center gap-1">
                    <span className={sortField === 'market' ? 'text-indigo-600 font-bold' : ''}>Market Pick</span>
                    {sortField === 'market' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Odds */}
                <th 
                  onClick={() => handleSort('odds')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Decimal Odds"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span className={sortField === 'odds' ? 'text-indigo-600 font-bold' : ''}>Odds</span>
                    {sortField === 'odds' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Prob */}
                <th 
                  onClick={() => handleSort('prob')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Probability"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Probability" content="The absolute probability calculated by our Poisson engine for this outcome to occur. Click to sort.">
                      <span className={sortField === 'prob' ? 'text-indigo-600 font-bold' : ''}>Prob</span>
                    </InfoTooltip>
                    {sortField === 'prob' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Implied */}
                <th 
                  onClick={() => handleSort('implied')}
                  className="py-1.5 px-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Impliedability"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Impliedability" content="The probability implied by bookmaker odds (1 / Decimal Odds). Click to sort.">
                      <span className={sortField === 'implied' ? 'text-indigo-600 font-bold' : ''}>Implied</span>
                    </InfoTooltip>
                    {sortField === 'implied' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Edge */}
                <th 
                  onClick={() => handleSort('edge')}
                  className="py-1.5 px-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Edge (+EV)"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Divergence Edge" content="The positive difference (+EV) between Prob and Implied. Click to sort.">
                      <span className={sortField === 'edge' ? 'text-indigo-600 font-bold' : ''}>Edge</span>
                    </InfoTooltip>
                    {sortField === 'edge' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Kelly */}
                <th 
                  onClick={() => handleSort('kelly')}
                  className="py-1.5 px-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                  title="Click to sort by Kelly sizing"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <KellyTooltip align="center">
                      <span className={sortField === 'kelly' ? 'text-indigo-600 font-bold' : ''}>Kelly</span>
                    </KellyTooltip>
                    {sortField === 'kelly' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-1.5 px-2 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100">
              {binaryPicks.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={9} className="py-12 text-center text-slate-400 block md:table-cell">
                    No value picks match the selected filters.
                  </td>
                </tr>
              ) : (
                binaryPicks.map((p, idx) => {
                  const isSlipAdded = accaMatchIds.has(p.id);
                  const isElite = p.edge >= 8;

                  return (
                    <tr key={p.id || idx} className={`flex flex-col md:table-row hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} md:h-12`}>
                      
                      {/* ---------------- MOBILE VIEW ---------------- */}
                      <td className="md:hidden p-3 block">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-semibold text-slate-700 font-mono text-[10px] mr-2">
                              {p.time}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {p.league?.split(' ')[0] || 'Soccer'}
                            </span>
                          </div>
                          <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] font-mono ${
                            p.edge >= 8 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : p.edge > 3 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            Edge: {p.edge > 0 ? `+${safeToFixed(p.edge, 1)}%` : `${safeToFixed(p.edge, 1)}%`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex flex-col flex-1">
                            <span className="font-bold text-slate-900">{p.home}</span>
                            <span className="font-bold text-slate-900">{p.away}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Top Pick</span>
                            <div className={`inline-block px-2.5 py-1 rounded text-[11px] font-bold border shadow-sm ${
                              isElite 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {p.market}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                           <div className="flex flex-col text-[10px] font-mono text-slate-500">
                             <span>Odds: <strong className="text-slate-900">{safeToFixed(p.marketOdds, 2)}</strong></span>
                             <KellyTooltip showIcon={false} align="left">
                               <span className="font-bold text-slate-800 mt-0.5 inline-flex items-center gap-1 cursor-help hover:text-indigo-600">
                                 <span>Stake: {p.kellyUnits > 0 ? `${p.kellyUnits}u` : 'No bet'} (1/4 Kelly)</span>
                               </span>
                             </KellyTooltip>
                           </div>
                           <div className="flex flex-col items-center justify-center pr-2">
                             <ConfidenceGauge confidence={p.modelProb} size="sm" />
                           </div>
                           <div className="flex gap-2">
                             <button
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(p.match); }}
                                className="px-2 py-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 text-teal-800 text-center"
                              >
                                Analysis
                             </button>
                             <button
                                onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(p.match); }}
                                className={`px-2 py-1 rounded text-[10px] font-medium border text-center ${
                                  isSlipAdded
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {isSlipAdded ? 'Remove' : '+ Slip'}
                             </button>
                           </div>
                        </div>
                      </td>

                      {/* ---------------- DESKTOP CELLS ---------------- */}
                      {/* Time */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <span className="font-semibold text-slate-700 font-mono text-xs block">
                          {p.time}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[65px] mx-auto">
                          {p.league?.split(' ')[0] || 'Soccer'}
                        </span>
                      </td>

                      {/* Fixture */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {p.home} vs {p.away}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                          {p.league}
                        </div>
                      </td>

                      {/* Pick */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isElite 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {p.market}
                        </span>
                      </td>

                      {/* Bookmaker Odds */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono font-semibold text-slate-800 text-xs">
                        {safeToFixed(p.marketOdds, 2)}
                      </td>

                      {/* Prob */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono font-bold text-indigo-700 text-xs">
                        <ConfidenceGauge confidence={p.modelProb} size="sm" />
                      </td>

                      {/* Implied */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-slate-500 text-xs">
                        {safeToFixed(p.impliedProb, 1)}%
                      </td>

                      {/* Edge */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono">
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
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <KellyTooltip showIcon={false} align="center">
                          <div className="group-hover/tooltip:opacity-90">
                            <span className="font-mono font-semibold text-slate-800 text-xs block group-hover:text-indigo-600 transition-colors">
                              {p.kellyUnits > 0 ? `${p.kellyUnits}u` : 'No bet'}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              1/4 Kelly
                            </span>
                          </div>
                        </KellyTooltip>
                      </td>

                      {/* Actions */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(p.match); }}
                            className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                            title="Open Analysis"
                          >
                            Analysis
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(p.match); }}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                              isSlipAdded
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border-slate-200 hover:border-purple-200'
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

    </div>
  );
}
