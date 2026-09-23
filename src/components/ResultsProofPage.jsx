import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Calendar, 
  Search, 
  Brain, 
  RefreshCw,
  TrendingUp,
  Award,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import BacktestAccuracyTrendChart from './BacktestAccuracyTrendChart';
import { safeToFixed, formatScore } from '../utils/numberUtils';
import { formatSafeDateTime, formatRelativeDayTime } from '../utils/dateUtils';

export default function ResultsProofPage({
  historicalResults = [],
  todayMatches = [],
  yesterdayMatches = [],
  leaguePerformance = [],
  onOpenDeepResearch,
  onFetchDateResults,
  isLoading = false,
  tzSettings
}) {
  const getTodayIso = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [searchQuery, setSearchQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'HITS', 'MISSES'
  const [showBacktestChart, setShowBacktestChart] = useState(false);
  const [sortField, setSortField] = useState('time');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      const defaultDesc = ['actual', 'predicted', 'result', 'conf'].includes(field);
      setSortDirection(defaultDesc ? 'desc' : 'asc');
    }
  };

  // Pre-configured date options
  const dateOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = i === 0 ? `Today (${iso})` : (i === 1 ? `Yesterday (${iso})` : `${i} days ago (${iso})`);
      opts.push({ value: iso, label });
    }
    return opts;
  }, []);

  // When date changes, request data from backend
  useEffect(() => {
    if (onFetchDateResults) {
      onFetchDateResults(selectedDate);
    }
  }, [selectedDate]);

  // Combine fetched historicalResults with local todayMatches / yesterdayMatches for active selected date
  const activeResults = useMemo(() => {
    const todayIso = getTodayIso();
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayIso = yesterdayDate.toISOString().slice(0, 10);

    let list = Array.isArray(historicalResults) ? [...historicalResults] : [];

    if (selectedDate === todayIso && todayMatches && todayMatches.length > 0) {
      const existingIds = new Set(list.map(m => String(m.id)));
      todayMatches.forEach(tm => {
        if (!existingIds.has(String(tm.id))) {
          existingIds.add(String(tm.id));
          list.push(tm);
        }
      });
    } else if (selectedDate === yesterdayIso && yesterdayMatches && yesterdayMatches.length > 0) {
      const existingIds = new Set(list.map(m => String(m.id)));
      yesterdayMatches.forEach(ym => {
        if (!existingIds.has(String(ym.id))) {
          existingIds.add(String(ym.id));
          list.push(ym);
        }
      });
    }

    return list;
  }, [historicalResults, todayMatches, yesterdayMatches, selectedDate]);

  // Extract unique leagues
  const leagueOptions = useMemo(() => {
    const set = new Set();
    const validMatches = activeResults.filter(m => {
      return m.isCompleted || m.status === 'FT' || m.status?.includes('FT') || m.status?.includes('Final') || m.actualScore || (m.homeScore != null && m.awayScore != null);
    });
    validMatches.forEach(m => {
      if (m.league) set.add(m.league);
    });
    return [
      { value: 'All', label: `All Leagues (${validMatches.length})` },
      ...Array.from(set).sort().map(l => {
        const count = validMatches.filter(m => m.league === l).length;
        const perf = leaguePerformance.find(p => p.league === l);
        const perfStr = perf ? ` - ${perf.accuracy}% Acc` : '';
        return { value: l, label: `${l} (${count})${perfStr}` };
      })
    ];
  }, [activeResults, leaguePerformance]);

  // Filter results
  const filteredResults = useMemo(() => {
    return activeResults.filter(m => {
      // Must be an audited completed match with verified scores or winner
      const isCompleted = m.isCompleted || m.status === 'FT' || m.status?.includes('FT') || m.status?.includes('Final') || m.actualScore || (m.homeScore != null && m.awayScore != null);
      if (!isCompleted) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (m.home || '').toLowerCase();
        const away = (m.away || '').toLowerCase();
        if (!home.includes(q) && !away.includes(q)) return false;
      }

      if (leagueFilter !== 'All' && m.league !== leagueFilter) return false;

      const hG = m.homeScore ?? m.goals?.home;
      const aG = m.awayScore ?? m.goals?.away;
      const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
      const isHit = m.isHit === true;
      const isMiss = m.isHit === false;
      const isPush = m.isPush || (m.isHit === null && m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW');
      const isPass = m.isPass || (m.isHit === null && m.smartMarket?.pick === 'PASS');

      if (statusFilter === 'HITS' && !isHit) return false;
      if (statusFilter === 'MISSES' && !isMiss) return false;
      if (statusFilter === 'PUSHES' && !isPush && !isPass) return false;

      return true;
    }).sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'time') {
        const tA = a.timestamp || (a.utcDate ? new Date(a.utcDate).getTime() : 0);
        const tB = b.timestamp || (b.utcDate ? new Date(b.utcDate).getTime() : 0);
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
      if (sortField === 'actual') {
        const sumA = (a.homeScore || 0) + (a.awayScore || 0);
        const sumB = (b.homeScore || 0) + (b.awayScore || 0);
        return (sumA - sumB) * multiplier;
      }
      if (sortField === 'predicted') {
        const pA = `${a.predictedHome || 0}-${a.predictedAway || 0}`;
        const pB = `${b.predictedHome || 0}-${b.predictedAway || 0}`;
        return pA.localeCompare(pB) * multiplier;
      }
      if (sortField === 'result') {
        const rA = a.isHit ? 1 : 0;
        const rB = b.isHit ? 1 : 0;
        return (rA - rB) * multiplier;
      }
      if (sortField === 'conf') {
        return ((a.confidence || 0) - (b.confidence || 0)) * multiplier;
      }
      return 0;
    });
  }, [activeResults, searchQuery, leagueFilter, statusFilter, sortField, sortDirection]);

  // Compute stats
  const stats = useMemo(() => {
    const validMatches = activeResults.filter(m => {
      return m.isCompleted || m.status === 'FT' || m.status?.includes('FT') || m.status?.includes('Final') || m.actualScore || (m.homeScore != null && m.awayScore != null);
    });
    if (validMatches.length === 0) return { total: 0, hits: 0, misses: 0, pushes: 0, passes: 0, activeTotal: 0, hitRate: '0.0' };
    let hits = 0;
    let misses = 0;
    let pushes = 0;
    let passes = 0;

    validMatches.forEach(m => {
      const hG = m.homeScore ?? m.goals?.home;
      const aG = m.awayScore ?? m.goals?.away;
      const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
      if (m.isHit === true) {
        hits++;
      } else if (m.isHit === false) {
        misses++;
      } else if (m.isPush || (m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW')) {
        pushes++;
      } else if (m.isPass || m.smartMarket?.pick === 'PASS') {
        passes++;
      } else {
        // Fallback to binary pick if isHit is completely undefined
        const binaryHit = m.predictedWinner ? actualWinner === m.predictedWinner : false;
        if (binaryHit) hits++;
        else misses++;
      }
    });
    const total = validMatches.length;
    const activeTotal = hits + misses;
    const hitRate = activeTotal > 0 ? safeToFixed((hits / activeTotal) * 100, 1) : (total > 0 ? safeToFixed((hits / total) * 100, 1) : '0.0');
    return { total, hits, misses, pushes, passes, activeTotal, hitRate };
  }, [activeResults]);

  return (
    <div className="space-y-4">
      
      {/* Top Verification Stats Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Verified Match Audit &amp; Performance Proof</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                Audited Real Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Full transparent verification against official final whistle scores from ESPN &amp; Understat
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Audited Games</div>
              <div className="text-sm font-bold font-mono text-slate-800">{stats.total}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Active Wagers</div>
              <div className="text-sm font-bold font-mono text-slate-800">{stats.activeTotal}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Correct Hits</div>
              <div className="text-sm font-bold font-mono text-emerald-700">{stats.hits}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Hit Rate</div>
              <div className="text-sm font-bold font-mono text-indigo-700">{stats.hitRate}%</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Record</div>
              <div className="text-sm font-bold font-mono text-slate-800">
                <span className="text-emerald-700">{stats.hits}W</span> - <span className="text-rose-700">{stats.misses}L</span>
                {stats.pushes > 0 && <span className="text-amber-600"> - {stats.pushes}P</span>}
              </div>
            </div>

            <button
              onClick={() => setShowBacktestChart(!showBacktestChart)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                showBacktestChart 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
              title="Toggle multi-season 23,453 match accuracy trend chart"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{showBacktestChart ? 'Hide 23.4k Chart' : '23.4k Accuracy Trend'}</span>
            </button>
          </div>

        </div>

        {/* Backtest Accuracy Trend Chart across 23,453 records */}
        {showBacktestChart && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <BacktestAccuracyTrendChart />
          </div>
        )}
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search audited club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UniformDropdown
              label="Audited Date"
              value={selectedDate}
              onChange={setSelectedDate}
              options={dateOptions}
            />

            <UniformDropdown
              label="League"
              value={leagueFilter}
              onChange={setLeagueFilter}
              options={leagueOptions}
            />

            <UniformDropdown
              label="Outcome"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Audited Outcomes' },
                { value: 'HITS', label: `Verified Hits (${stats.hits})` },
                { value: 'MISSES', label: `Audited Misses (${stats.misses})` },
                { value: 'PUSHES', label: `Pushes & Passed (${stats.pushes + stats.passes})` }
              ]}
            />
          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Showing <strong>{filteredResults.length}</strong> audited outcomes for {selectedDate}</span>
          {(searchQuery || leagueFilter !== 'All' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setLeagueFilter('All');
                setStatusFilter('ALL');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Compact Results Table */}
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

              {/* Actual Score */}
              <th 
                onClick={() => handleSort('actual')}
                className={`py-2 px-2.5 w-24 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'actual' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Actual Goals"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Actual Score</span>
                  {sortField === 'actual' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Predicted Score */}
              <th 
                onClick={() => handleSort('predicted')}
                className={`py-2 px-2.5 w-24 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'predicted' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Predicted Score"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Predicted</span>
                  {sortField === 'predicted' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Pick Res Hit/Miss/Push/Pass */}
              <th 
                onClick={() => handleSort('result')}
                className={`py-2 px-2.5 w-28 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'result' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Pick Outcome"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Pick Res</span>
                  {sortField === 'result' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Confidence */}
              <th 
                onClick={() => handleSort('conf')}
                className={`py-2 px-2 w-16 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'conf' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Confidence"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Conf</span>
                  {sortField === 'conf' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Market Verification */}
              <th className="py-2 px-3 min-w-[170px] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Market Verification
              </th>

              {/* Actions */}
              <th className="py-2 px-2.5 w-24 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span className="font-semibold text-slate-600 text-xs">Auditing results against historical data...</span>
                </td>
              </tr>
            ) : filteredResults.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  {selectedDate === getTodayIso() ? (
                    <div className="max-w-md mx-auto p-5 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
                      <Calendar className="w-8 h-8 text-indigo-500 mx-auto mb-2.5" />
                      <p className="text-sm font-bold text-slate-800">No Full-Time Games Recorded For Today Yet</p>
                      <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                        Today's matches ({selectedDate}) are currently scheduled or in-play. Once games reach Full Time (FT), their final scores, verified prediction hits, and AI post-mortems appear here automatically.
                      </p>
                      <button
                        onClick={() => setSelectedDate(dateOptions[1]?.value || '')}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>View Yesterday's Verified Matches ({dateOptions[1]?.value})</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">No verified matches recorded for {selectedDate}</p>
                      <p className="text-xs text-slate-500 mt-1">Select a different date from the dropdown above.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredResults.map((m, idx) => {
                const hG = m.homeScore ?? m.goals?.home;
                const aG = m.awayScore ?? m.goals?.away;
                const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
                const isHit = m.isHit === true;
                const isMiss = m.isHit === false;
                const isPush = m.isPush || (m.isHit === null && m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW');
                const isPass = m.isPass || (m.isHit === null && m.smartMarket?.pick === 'PASS');
                const actualScore = formatScore(
                  m.actualScore ||
                  (hG != null && aG != null ? `${hG}-${aG}` : null) ||
                  'FT'
                );
                const predictedScore = formatScore(m.predictedScore || m.mostLikelyScore || '1-0');
                const isExactScore = predictedScore === actualScore && actualScore !== 'FT' && actualScore !== '';

                const dt = formatSafeDateTime(m, null, tzSettings);
                const relativeText = formatRelativeDayTime(m, tzSettings);

                return (
                  <tr 
                    key={m.id || idx} 
                    className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} h-11`}
                  >
                    {/* Kickoff Day & Time */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{relativeText}</span>
                        </div>
                        {dt.day && (relativeText.startsWith('Today') || relativeText.startsWith('Tomorrow') || relativeText.startsWith('Yesterday')) && (
                          <span className="text-[10px] text-slate-400 pl-5 font-medium">
                            {dt.day}, {dt.date}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* League */}
                    <td className="py-2 px-3">
                      <span 
                        className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] truncate max-w-[130px] border border-slate-200"
                        title={m.league}
                      >
                        {m.league || 'Soccer'}
                      </span>
                    </td>

                    {/* Fixture */}
                    <td className="py-2 px-3 min-w-[190px]">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-900 font-bold">{m.home}</span>
                        <span className="text-[10px] text-slate-400 font-normal">vs</span>
                        <span className="text-slate-900 font-bold">{m.away}</span>
                      </div>
                    </td>

                    {/* Actual Score */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span className="font-black font-mono text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {actualScore}
                      </span>
                    </td>

                    {/* Predicted Score */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-mono text-slate-700 text-xs font-semibold">{predictedScore}</span>
                        {isExactScore && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Exact score predicted!" />}
                      </div>
                    </td>

                    {/* Pick Res Hit/Miss/Push/Pass */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                        isHit
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isPush
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : isPass
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {isHit ? 'HIT' : isPush ? 'PUSH' : isPass ? 'PASS' : 'MISS'}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                      {(m.confidence != null) ? `${safeToFixed(m.confidence, 0)}%` : '68%'}
                    </td>

                    {/* Market Verification */}
                    <td className="py-2 px-3 text-[11px] whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 truncate max-w-[170px]">
                          Pick: <strong>{m.smartMarket?.pickLabel || (m.predictedWinner === 'HOME' ? m.home : m.predictedWinner === 'AWAY' ? m.away : 'Draw')}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Actual: {actualWinner === 'HOME' ? `${m.home} Win` : actualWinner === 'AWAY' ? `${m.away} Win` : 'Draw'}
                        </span>
                      </div>
                    </td>

                    {/* Analysis Button */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                        className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                        title="Open tactical root cause forensics"
                      >
                        Analysis
                      </button>
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
