import { liveScoreText } from '../utils/matchStatus';
import WatchButton from './WatchButton';
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
  CheckCircle2,
  Calendar,
  Play,
  Check,
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import MobileViewSwitcher from './MobileViewSwitcher';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import InfoTooltip from './InfoTooltip';
import { compactKickoff } from './MobileFold';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';

// Every goals tip the engine prices for a match, most likely first. Team goals and first-half goals
// only exist when the expected goals came from bookmaker prices (tested, see docs/MODEL_ACCURACY.md).
export function goalTips(m) {
  const sm = m?.scoreModel || {};
  const o25 = safeParseFloat(sm.overUnder?.over25 ?? m?.over25Prob, NaN);
  const o35 = safeParseFloat(sm.overUnder?.over35, NaN);
  const btts = safeParseFloat(sm.btts?.yes, NaN);
  const tg = sm.teamGoals || {}, fh = sm.firstHalf || {};
  const tips = [
    ['Over 2.5 goals', o25], ['Under 2.5 goals', 100 - o25],
    ['Under 3.5 goals', 100 - o35],
    ['Both teams score', btts], ['Not both teams score', 100 - btts],
    [`${m?.home} to score`, safeParseFloat(tg.homeToScore, NaN)],
    [`${m?.away} to score`, safeParseFloat(tg.awayToScore, NaN)],
    ['Goal in the first half', safeParseFloat(fh.over05, NaN)]
  ].filter(([, p]) => Number.isFinite(p)).map(([label, prob]) => ({ label, prob }));
  return tips.sort((a, b) => b.prob - a.prob);
}
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, formatFriendlyDateOption } from '../utils/dateUtils';

export default function ScoresTablePage({
  matches = [],
  leaguePerformance = [],
  scoreTrainingStats,
  onOpenDeepResearch,
  onOpenWatchLive,
  onAddToSlip,
  accaMatchIds = new Set(),
  tzSettings = {},
  onSelectMarketMode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL', 'OVER_25', 'UNDER_25', 'BTTS_YES', ...
  const [sortField, setSortField] = useState('time');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [sortBy, setSortBy] = useState('time_asc');
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [collapsedScores, setCollapsedScores] = useState(false);
  const [mobileViewMode] = useMobileViewMode();

  const toggleExpand = (matchId) => {
    setExpandedMatchId(prev => (prev === matchId ? null : matchId));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
      if (field === 'time') setSortBy(nextDir === 'asc' ? 'time_asc' : 'custom');
      else setSortBy('custom');
    } else {
      setSortField(field);
      const defaultDesc = ['top_score', 'over15', 'over25', 'btts', 'xg', 'best_value'].includes(field);
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

  // Pre-evaluate all upcoming active matches
  const rawScoresMatches = useMemo(() => {
    return (matches || []).filter(m => {
      if (!m) return false;
      if (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') return false;
      return true;
    }).map(m => {
      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      const dateKey = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
      const over25 = safeParseFloat(m.scoreModel?.overUnder?.over25 ?? m.over25Prob, 50);
      const bttsYes = safeParseFloat(m.scoreModel?.btts?.yes, 50);
      const topScoreProb = safeParseFloat(m.scoreModel?.topScorelines?.[0]?.prob, 0);
      const homeScores = safeParseFloat(m.scoreModel?.teamGoals?.homeToScore, 0);
      const awayScores = safeParseFloat(m.scoreModel?.teamGoals?.awayToScore, 0);
      const fhGoal = safeParseFloat(m.scoreModel?.firstHalf?.over05, 0);

      return {
        match: m,
        id: m.id,
        league: m.league,
        home: m.home,
        away: m.away,
        dateKey,
        timeVal,
        over25,
        bttsYes,
        topScoreProb,
        homeScores,
        awayScores,
        fhGoal
      };
    });
  }, [matches, tzSettings]);

  // Universal filter checker
  const checkMatchPasses = (item, skipDimension = null) => {
    if (!item) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const home = (item.home || '').toLowerCase();
      const away = (item.away || '').toLowerCase();
      const league = (item.league || '').toLowerCase();
      if (!home.includes(q) && !away.includes(q) && !league.includes(q)) return false;
    }

    // League filter
    if (skipDimension !== 'league' && selectedLeague !== 'All') {
      if (item.league !== selectedLeague) return false;
    }

    // Date filter
    if (skipDimension !== 'date' && selectedDate !== 'All') {
      if (item.dateKey !== selectedDate) return false;
    }

    // Market filter
    if (skipDimension !== 'market' && marketFilter !== 'ALL') {
      if (marketFilter === 'OVER_25' && item.over25 < 50) return false;
      if (marketFilter === 'OVER_25_HIGH_CONF' && item.over25 < 60) return false;
      if (marketFilter === 'UNDER_25' && item.over25 >= 50) return false;
      if (marketFilter === 'UNDER_25_HIGH_CONF' && item.over25 > 40) return false;
      if (marketFilter === 'BTTS_YES' && item.bttsYes < 50) return false;
      if (marketFilter === 'BTTS_YES_HIGH_CONF' && item.bttsYes < 60) return false;
      if (marketFilter === 'BTTS_NO_HIGH_CONF' && item.bttsYes > 40) return false;
      if (marketFilter === 'HOME_SCORES' && item.homeScores < 80) return false;
      if (marketFilter === 'AWAY_SCORES' && item.awayScores < 80) return false;
      if (marketFilter === 'FH_GOAL' && item.fhGoal < 75) return false;
    }

    return true;
  };

  // Dynamic Faceted League Options
  const leagueOptions = useMemo(() => {
    const leagues = {};
    let totalEligible = 0;

    rawScoresMatches.forEach(item => {
      if (!checkMatchPasses(item, 'league')) return;
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
  }, [rawScoresMatches, searchQuery, selectedDate, marketFilter, leaguePerformance]);

  // Dynamic Faceted Date Options
  const dateOptions = useMemo(() => {
    const dates = {};
    let totalEligible = 0;

    rawScoresMatches.forEach(item => {
      if (!checkMatchPasses(item, 'date')) return;
      totalEligible++;
      dates[item.dateKey] = (dates[item.dateKey] || 0) + 1;
    });

    const sortedKeys = Object.keys(dates).sort();
    return [
      { value: 'All', label: `All dates (${totalEligible})` },
      ...sortedKeys.map(k => ({ value: k, label: formatFriendlyDateOption(k, dates[k], tzSettings) }))
    ];
  }, [rawScoresMatches, searchQuery, selectedLeague, marketFilter]);

  // Dynamic Faceted Market Options
  const marketOptions = useMemo(() => {
    let all = 0;
    let o25 = 0;
    let o25High = 0;
    let u25 = 0;
    let u25High = 0;
    let btts = 0;
    let bttsHigh = 0;
    let bttsNoHigh = 0;
    let homeScores = 0;
    let awayScores = 0;
    let fhGoal = 0;

    rawScoresMatches.forEach(item => {
      if (!checkMatchPasses(item, 'market')) return;
      all++;
      if (item.over25 >= 50) o25++;
      if (item.over25 >= 60) o25High++;
      if (item.over25 < 50) u25++;
      if (item.over25 <= 40) u25High++;
      if (item.bttsYes >= 50) btts++;
      if (item.bttsYes >= 60) bttsHigh++;
      if (item.bttsYes <= 40) bttsNoHigh++;
      if (item.homeScores >= 80) homeScores++;
      if (item.awayScores >= 80) awayScores++;
      if (item.fhGoal >= 75) fhGoal++;
    });

    return [
      { value: 'ALL', label: `All goals tips (${all})` },
      { value: 'OVER_25', label: `Leans over 2.5 (${o25})` },
      { value: 'OVER_25_HIGH_CONF', label: `Over 2.5, 60%+ chance (${o25High})` },
      { value: 'UNDER_25', label: `Leans under 2.5 (${u25})` },
      { value: 'UNDER_25_HIGH_CONF', label: `Under 2.5, 60%+ chance (${u25High})` },
      { value: 'BTTS_YES', label: `Leans both score (${btts})` },
      { value: 'BTTS_YES_HIGH_CONF', label: `Both score, 60%+ chance (${bttsHigh})` },
      { value: 'BTTS_NO_HIGH_CONF', label: `Not both score, 60%+ chance (${bttsNoHigh})` },
      { value: 'HOME_SCORES', label: `Home team scores, 80%+ chance (${homeScores})` },
      { value: 'AWAY_SCORES', label: `Away team scores, 80%+ chance (${awayScores})` },
      { value: 'FH_GOAL', label: `Goal in first half, 75%+ chance (${fhGoal})` }
    ];
  }, [rawScoresMatches, searchQuery, selectedLeague, selectedDate]);

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    return rawScoresMatches
      .filter(item => checkMatchPasses(item, null))
      .map(item => item.match)
      .sort((a, b) => {
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
        const xgA = safeParseFloat(a.scoreModel?.expectedGoals?.total, 0);
        const xgB = safeParseFloat(b.scoreModel?.expectedGoals?.total, 0);
        return (xgA - xgB) * multiplier;
      }
      if (sortField === 'best_value') {
        const getVal = (m) => goalTips(m)[0]?.prob ?? 0;
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
      
      {/* Top bar: average chances over the listed matches */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Goals</h2>
          <p className="text-[11px] text-slate-500">Over/under, both teams to score and likely scores. {filteredMatches.length} matches.</p>
        </div>

        <div className="flex items-center gap-2">
          {aggregateStats ? (
            <>
              <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-center">
                <div className="text-[9.5px] text-slate-400 font-semibold" title="Average chance of the most likely score, over the matches listed">Avg. top score</div>
                <div className="font-bold text-slate-800 font-mono text-[11px]">{aggregateStats.exactScore}%</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-center">
                <div className="text-[9.5px] text-slate-400 font-semibold" title="Average chance of over 2.5 goals, over the matches listed">Avg. over 2.5</div>
                <div className="font-bold text-emerald-700 font-mono text-[11px]">{aggregateStats.over25}%</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-center">
                <div className="text-[9.5px] text-slate-400 font-semibold" title="Average chance both teams score, over the matches listed">Avg. both score</div>
                <div className="font-bold text-indigo-700 font-mono text-[11px]">{aggregateStats.btts}%</div>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-xs italic">No matches found for current filter</div>
          )}
        </div>
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
        

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
              options={marketOptions}
            />

            <UniformDropdown
              label="Sort"
              value={sortBy}
              onChange={handleDropdownSortChange}
              options={[
                { value: 'time_asc', label: 'Kick-off: soonest' },
                { value: 'over_desc', label: 'Most likely over 2.5' },
                { value: 'under_desc', label: 'Most likely under 2.5' },
                { value: 'xg_desc', label: 'Most goals expected' }
              ]}
            />

            <MobileViewSwitcher label="Display" className="w-full sm:w-auto" />
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Exact Scorelines &amp; Goals Totals</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                O/U 2.5 &amp; Probabilities
              </span>
            </h2>
            <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              {filteredMatches.length} Matches
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsedScores(!collapsedScores)}
            className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title={collapsedScores ? 'Expand Scores' : 'Collapse Scores'}
          >
            <span>{collapsedScores ? 'Expand' : 'Collapse'}</span>
            {collapsedScores ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {!collapsedScores && (
          <div className="overflow-x-auto">
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
                title="Click to sort by Fixture"
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

              {/* Top Projected Scores */}
              <th 
                onClick={() => handleSort('top_score')}
                className={`py-1 px-2 min-w-[130px] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'top_score' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Top Scoreline Probability"
              >
                <div className="flex items-center gap-1">
                  <span>Proj. Scores</span>
                  {sortField === 'top_score' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* O1.5 */}
              <th 
                onClick={() => handleSort('over15')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'over15' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Over 1.5 Goals Probability"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Over / Under 1.5 Goals" content="Probability of the match having Over 1.5 (2 or more goals). Click to sort.">
                    <span>O1.5</span>
                  </InfoTooltip>
                  {sortField === 'over15' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* O2.5 */}
              <th 
                onClick={() => handleSort('over25')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'over25' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Over 2.5 Goals Probability"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Over / Under 2.5 Goals" content="Probability of the match having Over 2.5 (3 or more goals). Click to sort.">
                    <span>O2.5</span>
                  </InfoTooltip>
                  {sortField === 'over25' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* BTTS */}
              <th 
                onClick={() => handleSort('btts')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'btts' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Both Teams to Score (Yes) Probability"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Both Teams to Score (BTTS)" content="Probability of both teams scoring at least one goal (Yes). Click to sort.">
                    <span>BTTS</span>
                  </InfoTooltip>
                  {sortField === 'btts' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Total xG */}
              <th 
                onClick={() => handleSort('xg')}
                className={`py-1 px-1.5 w-16 text-center text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'xg' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="Click to sort by Combined Expected Goals (xG)"
              >
                <div className="flex items-center justify-center gap-1">
                  <InfoTooltip title="Total Expected Goals" content="Combined xG projection for both teams. Click to sort.">
                    <span>Total xG</span>
                  </InfoTooltip>
                  {sortField === 'xg' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Best Value Total */}
              <th 
                onClick={() => handleSort('best_value')}
                className={`py-1 px-2 min-w-[120px] text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'best_value' ? 'text-indigo-800 bg-indigo-50/60' : 'text-slate-500'
                }`}
                title="The most likely goals tip for the match"
              >
                <div className="flex items-center gap-1">
                  <span>Best tip</span>
                  {sortField === 'best_value' ? (
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
            {filteredMatches.length === 0 ? (
              <tr className="flex flex-col md:table-row">
                <td colSpan={11} className="py-8 text-center text-slate-400 text-xs block md:table-cell">
                  No scorelines match the active filter criteria.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, idx) => {
                const matchKey = m.id || idx;
                const isExpanded = expandedMatchId === matchKey;
                const inSlip = accaMatchIds.has(m.id) || accaMatchIds.has(String(m.id)) || (m.home && m.away && Array.from(accaMatchIds).some(id => String(id).includes(`${m.home}-${m.away}`)));
                const over15 = safeParseFloat(m.scoreModel?.overUnder?.over15, 75);
                const over25 = safeParseFloat(m.scoreModel?.overUnder?.over25 ?? m.over25Prob, 52);
                const under25 = 100 - over25;
                const bttsYes = safeParseFloat(m.scoreModel?.btts?.yes, 50);
                const topScores = m.scoreModel?.topScorelines?.slice(0, 5) || [];
                const over35 = safeParseFloat(m.scoreModel?.overUnder?.over35, NaN);
                const homeLambda = safeParseFloat(m.scoreModel?.expectedGoals?.home ?? m.lambda, 1.4);
                const awayMu = safeParseFloat(m.scoreModel?.expectedGoals?.away ?? m.mu, 1.1);
                const totalXg = safeToFixed(homeLambda + awayMu, 1, '2.5');
                const tips = goalTips(m);
                const bestTip = tips[0] || { label: 'Over 2.5 goals', prob: over25 };
                const bestValuePick = bestTip.label;
                const teamGoals = m.scoreModel?.teamGoals;
                const firstHalf = m.scoreModel?.firstHalf;

                const relativeText = formatMatchKickoff(m);
                const dt = formatSafeDateTime(m, null, tzSettings);

                const handleSlipAdd = (e) => {
                  e.stopPropagation();
                  if (!onAddToSlip) return;
                  const pickProb = bestTip.prob;
                  // Fair price for the tip; the bookmaker's own price replaces it on the slip.
                  const fairOdds = (100 / Math.max(1, pickProb)).toFixed(2);
                  onAddToSlip(m, 'OVER_UNDER', bestValuePick, fairOdds, pickProb);
                };

                return (
                  <React.Fragment key={matchKey}>
                    <tr 
                      className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      onClick={() => toggleExpand(matchKey)}
                    >
                      {/* ================= MOBILE COMPACT VIEW (1-ROW TABLE OR CARD) ================= */}
                      {mobileViewMode === 'table' ? (
                        <td className="md:hidden px-2.5 py-2 block">
                          <div className="flex items-center justify-between gap-1.5 text-xs">
                            {/* Left: Day/Time/LIVE + Teams */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {m.isLive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-600 text-white animate-pulse shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  <span>LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}</span>
                                  {liveScoreText(m) && <span className="font-mono font-bold">({liveScoreText(m)})</span>}
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] text-slate-600 shrink-0 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {compactKickoff(relativeText) || relativeText}
                                </span>
                              )}
                              <div className="font-bold text-slate-900 text-xs truncate min-w-0 flex-1">
                                {(() => {
                                  const topHomeGoals = topScores[0] ? parseInt(topScores[0].score.split('-')[0], 10) : null;
                                  const topAwayGoals = topScores[0] ? parseInt(topScores[0].score.split('-')[1], 10) : null;
                                  const isHomeFavored = topHomeGoals != null && topAwayGoals != null ? topHomeGoals > topAwayGoals : homeLambda > awayMu;
                                  const isAwayFavored = topHomeGoals != null && topAwayGoals != null ? topAwayGoals > topHomeGoals : awayMu > homeLambda;
                                  return (
                                    <span className="inline-flex items-center gap-1 truncate">
                                      <span className={isHomeFavored ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-medium text-slate-600'}>{m.home}</span>
                                      {isHomeFavored && <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WIN</span>}
                                      <span className="text-slate-400 font-normal mx-0.5">v</span>
                                      <span className={isAwayFavored ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-medium text-slate-600'}>{m.away}</span>
                                      {isAwayFavored && <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WIN</span>}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Right: Top Score, Best Value Pick, Chevron */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {topScores[0] && (
                                <span className="font-mono font-bold text-[11px] bg-indigo-50 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-200" title="Projected Most Likely Score">
                                  {topScores[0].score}
                                </span>
                              )}
                              <span className="font-bold text-[9.5px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                {bestValuePick}
                              </span>
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>

                          {/* Mobile Collapsible Details when row is clicked */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/60 p-2 rounded-lg text-[10px]">
                              <div className="flex justify-between items-center">
                                <div className="font-mono text-slate-600">
                                  xG: <strong>{homeLambda.toFixed(1)} - {awayMu.toFixed(1)}</strong> (Total: {totalXg})
                                </div>
                                <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                                  {m.league || 'Soccer'}
                                </span>
                              </div>

                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Top Projected Scorelines (Poisson Simulation)
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {topScores.map((sc, scIdx) => (
                                    <span key={scIdx} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">
                                      <strong>{sc.score}</strong> ({safeToFixed(sc.prob, 1)}%)
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-500 block">Goal Over Lines</span>
                                  <div className="font-mono text-slate-800 font-semibold mt-0.5 space-y-0.5">
                                    <div>O 1.5: {safeToFixed(over15, 0)}%</div>
                                    <div>O 2.5: {safeToFixed(over25, 0)}%</div>
                                    <div>O 3.5: {safeToFixed(over35, 0, '—')}%</div>
                                  </div>
                                </div>
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-500 block">BTTS &amp; xG Expectancy</span>
                                  <div className="font-mono text-slate-800 font-semibold mt-0.5 space-y-0.5">
                                    <div>BTTS Yes: {safeToFixed(bttsYes, 0)}%</div>
                                    <div>BTTS No: {safeToFixed(100 - bttsYes, 0)}%</div>
                                    <div>xG: {homeLambda.toFixed(1)} - {awayMu.toFixed(1)}</div>
                                  </div>
                                </div>
                              </div>
                              {(teamGoals || firstHalf) && (
                                <div className="bg-white p-1.5 rounded border border-slate-200 text-[10px] font-mono text-slate-800 font-semibold space-y-0.5">
                                  {teamGoals && <div>{m.home} to score: {safeToFixed(teamGoals.homeToScore, 0)}%</div>}
                                  {teamGoals && <div>{m.away} to score: {safeToFixed(teamGoals.awayToScore, 0)}%</div>}
                                  {firstHalf && <div>Goal in first half: {safeToFixed(firstHalf.over05, 0)}%</div>}
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => onOpenWatchLive && onOpenWatchLive(m)}
                                  className="px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 cursor-pointer"
                                >
                                  Intel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                                  className="px-2 py-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 text-teal-800 cursor-pointer"
                                >
                                  Analysis
                                </button>
                                {onAddToSlip && (
                                  <button
                                    type="button"
                                    onClick={handleSlipAdd}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                      inSlip ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-indigo-600 text-white border-indigo-600'
                                    }`}
                                  >
                                    {inSlip ? '✓ Added' : '+ Add'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      ) : (
                        /* ================= MOBILE COMPACT CARD VIEW ================= */
                        <td className="md:hidden p-3 block">
                          <div className="flex justify-between items-start mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-700 font-mono text-[10px] flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                {compactKickoff(relativeText) || relativeText}
                              </span>
                              {m.isLive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                  LIVE {m.liveMinute ? `${m.liveMinute}'` : ''} {liveScoreText(m) ? `(${liveScoreText(m)})` : ''}
                                </span>
                              ) : (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') ? (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-slate-200 text-slate-800 font-mono">
                                  FT
                                </span>
                              ) : null}
                              <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                                {m.league || 'Soccer'}
                              </span>
                            </div>
                            <span className="font-bold text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {bestValuePick}
                            </span>
                          </div>

                          {/* Teams & Score Projection with Favored Team Highlighted */}
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex flex-col flex-1 min-w-0 pr-2">
                              {(() => {
                                const topHomeGoals = topScores[0] ? parseInt(topScores[0].score.split('-')[0], 10) : null;
                                const topAwayGoals = topScores[0] ? parseInt(topScores[0].score.split('-')[1], 10) : null;
                                const isHomeFavored = topHomeGoals != null && topAwayGoals != null ? topHomeGoals > topAwayGoals : homeLambda > awayMu;
                                const isAwayFavored = topHomeGoals != null && topAwayGoals != null ? topAwayGoals > topHomeGoals : awayMu > homeLambda;
                                return (
                                  <div className="text-xs truncate">
                                    <span className={isHomeFavored ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-semibold text-slate-700'}>{m.home}</span>
                                    {isHomeFavored && <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">WIN</span>}
                                    <span className="text-slate-400 font-normal mx-1">vs</span>
                                    <span className={isAwayFavored ? 'font-black text-slate-950 underline decoration-indigo-400 underline-offset-2' : 'font-semibold text-slate-700'}>{m.away}</span>
                                    {isAwayFavored && <span className="ml-1 text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">WIN</span>}
                                  </div>
                                );
                              })()}
                              <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                xG: {homeLambda.toFixed(1)} - {awayMu.toFixed(1)} (Total: {totalXg})
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {topScores[0] && (
                                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-900 font-mono font-bold text-xs border border-indigo-200">
                                  {topScores[0].score} <span className="text-[10px] font-normal text-indigo-600">({safeToFixed(topScores[0].prob, 0)}%)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Compact Metrics Row */}
                          <div className="flex items-center justify-between gap-1.5 text-[10px] pt-1.5 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded font-mono font-semibold border ${over25 >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {over25 >= 50 ? `O 2.5: ${safeToFixed(over25, 0)}%` : `U 2.5: ${safeToFixed(under25, 0)}%`}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded font-mono font-semibold border ${bttsYes >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                BTTS: {safeToFixed(bttsYes, 0)}%
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <WatchButton matchId={m.id} className="!w-6 !h-6" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                                className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs ${
                                  m.isLive
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                }`}
                                title={m.isLive ? "Live Match Tactical AI Intelligence" : "Match Tactical AI Analysis"}
                              >
                                <Brain className={`w-2.5 h-2.5 shrink-0 ${m.isLive ? 'text-white' : 'text-indigo-600'}`} />
                                <span className="truncate">{m.isLive ? 'Live stats' : 'Stats'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                className="w-[44px] h-6 px-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer"
                                title="Open Deep Analysis"
                              >
                                Intel
                              </button>
                              {onAddToSlip ? (
                                <button
                                  type="button"
                                  onClick={handleSlipAdd}
                                  className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold border transition-colors inline-flex items-center justify-center gap-0.5 shrink-0 cursor-pointer ${
                                    inSlip
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                      : 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                                  title={inSlip ? 'Remove from bet slip' : `Add ${bestValuePick} to bet slip`}
                                >
                                  {inSlip ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                                  <span>{inSlip ? '✓ Added' : '+ Add'}</span>
                                </button>
                              ) : (
                                <div className="w-[58px]" />
                              )}
                            </div>
                          </div>

                          {/* Mobile Dropdown Collapsible Toggle */}
                          <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-600 font-semibold select-none">
                            <span>{isExpanded ? 'Hide Probability Details' : 'Show Score & Probability Breakdown'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>

                          {/* Mobile Collapsible Details */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/60 p-2 rounded-lg">
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Top Projected Scorelines (Poisson Simulation)
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {topScores.map((sc, scIdx) => (
                                    <span key={scIdx} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">
                                      <strong>{sc.score}</strong> ({safeToFixed(sc.prob, 1)}%)
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-500 block">Goal Over Lines</span>
                                  <div className="font-mono text-slate-800 font-semibold mt-0.5 space-y-0.5">
                                    <div>O 1.5: {safeToFixed(over15, 0)}%</div>
                                    <div>O 2.5: {safeToFixed(over25, 0)}%</div>
                                    <div>O 3.5: {safeToFixed(over35, 0, '—')}%</div>
                                  </div>
                                </div>
                                <div className="bg-white p-1.5 rounded border border-slate-200">
                                  <span className="text-slate-500 block">BTTS &amp; xG Expectancy</span>
                                  <div className="font-mono text-slate-800 font-semibold mt-0.5 space-y-0.5">
                                    <div>BTTS Yes: {safeToFixed(bttsYes, 0)}%</div>
                                    <div>BTTS No: {safeToFixed(100 - bttsYes, 0)}%</div>
                                    <div>xG: {homeLambda.toFixed(1)} - {awayMu.toFixed(1)}</div>
                                  </div>
                                </div>
                              </div>
                              {(teamGoals || firstHalf) && (
                                <div className="bg-white p-1.5 rounded border border-slate-200 text-[10px] font-mono text-slate-800 font-semibold space-y-0.5">
                                  {teamGoals && <div>{m.home} to score: {safeToFixed(teamGoals.homeToScore, 0)}%</div>}
                                  {teamGoals && <div>{m.away} to score: {safeToFixed(teamGoals.awayToScore, 0)}%</div>}
                                  {firstHalf && <div>Goal in first half: {safeToFixed(firstHalf.over05, 0)}%</div>}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )}

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
                            <span>{relativeText}</span>
                            {m.isLive && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-white"></span>
                                LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}
                              </span>
                            )}
                          </div>
                          {dt.day && (relativeText.startsWith('Today') || relativeText.startsWith('Tomorrow')) && (
                            <span className="text-[9.5px] text-slate-400 pl-4 font-medium leading-tight">
                              {dt.day}, {dt.date}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* League */}
                      <td className="hidden md:table-cell py-1 px-2">
                        <span 
                          className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] truncate max-w-[110px] border border-slate-200"
                          title={m.league}
                        >
                          {m.league || 'Soccer'}
                        </span>
                      </td>

                      {/* Fixture */}
                      <td className="hidden md:table-cell py-1 px-2 min-w-[170px]">
                        <div className="font-semibold text-slate-900 flex items-center gap-1 flex-wrap text-[11.5px]">
                          <span className="text-slate-900 font-bold">{m.home}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">vs</span>
                          <span className="text-slate-900 font-bold">{m.away}</span>
                        </div>
                      </td>

                      {/* Top 3 Exact Scores */}
                      <td className="hidden md:table-cell py-1 px-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {topScores.slice(0, 3).map((sc, scIdx) => (
                            <span 
                              key={scIdx} 
                              className={`px-1 py-0.2 rounded text-[10px] font-mono border ${
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
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono text-[11px] whitespace-nowrap">
                        <span className={over15 > 70 ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                          {safeToFixed(over15, 0)}%
                        </span>
                      </td>

                      {/* O/U 2.5 */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono whitespace-nowrap">
                        <span className={`px-1.5 py-0.2 rounded text-[10.5px] font-bold border ${over25 >= 55 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : under25 >= 55 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {over25 >= 50 ? `O ${safeToFixed(over25, 0)}%` : `U ${safeToFixed(under25, 0)}%`}
                        </span>
                      </td>

                      {/* BTTS */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono whitespace-nowrap">
                        <span className={`px-1.5 py-0.2 rounded text-[10.5px] font-bold border ${bttsYes >= 55 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {bttsYes >= 50 ? `Yes ${safeToFixed(bttsYes, 0)}%` : `No ${safeToFixed(100 - bttsYes, 0)}%`}
                        </span>
                      </td>

                      {/* Total xG */}
                      <td className="hidden md:table-cell py-1 px-1.5 text-center font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">
                        {totalXg}
                      </td>

                      {/* Best Value Total */}
                      <td className="hidden md:table-cell py-1 px-2 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-slate-800 text-[10.5px]">
                            {bestValuePick}
                          </span>
                          <span className="text-[9px] text-emerald-700 font-semibold font-mono">
                            {safeToFixed(bestTip.prob, 0)}% likely
                          </span>
                        </div>
                      </td>

                      {/* Analysis & Slip Action */}
                      <td className="hidden md:table-cell py-1 px-2 text-center whitespace-nowrap w-56">
                        <WatchButton matchId={m.id} className="!w-6 !h-6 align-middle mr-1" />
                        <div className="inline-grid align-middle grid-cols-[98px_44px_58px] gap-1.5 items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(m); }}
                            className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs cursor-pointer ${
                              m.isLive
                                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}
                            title={m.isLive ? "Live Match Tactical AI Intelligence" : "Match Tactical AI Analysis"}
                          >
                            <Brain className={`w-2.5 h-2.5 shrink-0 ${m.isLive ? 'text-white' : 'text-indigo-600'}`} />
                            <span className="truncate">{m.isLive ? 'Live stats' : 'Stats'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                            className="w-[44px] h-6 px-1 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer"
                            title="Open Deep Analysis"
                          >
                            Intel
                          </button>

                          {onAddToSlip ? (
                            <button
                              type="button"
                              onClick={handleSlipAdd}
                              className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold border transition-colors cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 ${
                                inSlip
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                  : 'border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                              title={inSlip ? 'Remove from bet slip' : `Add ${bestValuePick} to bet slip`}
                            >
                              {inSlip ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                              <span>{inSlip ? '✓ Added' : '+ Add'}</span>
                            </button>
                          ) : (
                            <div className="w-[58px]" />
                          )}
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
                                  Poisson Goal Distribution &amp; Advanced Probabilities:
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {m.home} (xG: {homeLambda.toFixed(2)}) vs {m.away} (xG: {awayMu.toFixed(2)})
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                Recommended Market: {bestValuePick}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* Top Exact Scores */}
                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Top 5 Projected Scores
                                </div>
                                <div className="space-y-1">
                                  {topScores.map((sc, scIdx) => (
                                    <div key={scIdx} className="flex items-center justify-between text-[11px]">
                                      <span className="font-mono font-bold text-slate-800">{sc.score}</span>
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, sc.prob * 4)}%` }} />
                                        </div>
                                        <span className="font-mono text-slate-600 text-[10px] w-10 text-right">{safeToFixed(sc.prob, 1)}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Over/Under Matrix */}
                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Totals Line Probabilities
                                </div>
                                <div className="space-y-1 text-[11px] font-mono">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Over 1.5 Goals:</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(over15, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Over 2.5 Goals:</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(over25, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Under 2.5 Goals:</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(under25, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Over 3.5 Goals:</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(over35, 1, '—')}%</span>
                                  </div>
                                  {teamGoals && (
                                    <>
                                      <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1">
                                        <span className="text-slate-600">{m.home} to score:</span>
                                        <span className="font-bold text-slate-800">{safeToFixed(teamGoals.homeToScore, 1)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">{m.away} to score:</span>
                                        <span className="font-bold text-slate-800">{safeToFixed(teamGoals.awayToScore, 1)}%</span>
                                      </div>
                                    </>
                                  )}
                                  {firstHalf && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Goal in first half:</span>
                                      <span className="font-bold text-slate-800">{safeToFixed(firstHalf.over05, 1)}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Both Teams To Score & xG */}
                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Both Teams To Score &amp; Expected Goals
                                </div>
                                <div className="space-y-1 text-[11px] font-mono">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">BTTS (Yes):</span>
                                    <span className="font-bold text-emerald-700">{safeToFixed(bttsYes, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">BTTS (No):</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(100 - bttsYes, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1">
                                    <span className="text-slate-600">Total Match xG:</span>
                                    <span className="font-bold text-indigo-700">{totalXg} Goals</span>
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
      </div>
      )}
      </div>

    </div>
  );
}
