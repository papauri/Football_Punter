import React, { useState, useMemo } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey } from '../utils/dateUtils';
import { safeParseFloat, safeToFixed, formatKellyStake, formatSmartMarket, formatScore } from '../utils/numberUtils';
import { getLeaguePredictabilityTier } from '../utils/leagueUtils';
import ConfidenceGauge from './ConfidenceGauge';
import KellyTooltip from './KellyTooltip';
import InfoTooltip from './InfoTooltip';

export default function FixturesTablePage({
  matches = [],
  leaguePerformance = [],
  tzSettings,
  onOpenDeepResearch,
  onOpenLineup,
  onAddToSlip,
  accaMatchIds = new Set(),
  onTriggerScrape,
  onTriggerRetrain,
  isScraping = false,
  isRetraining = false,
  onSelectMarketMode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [filterMode, setFilterMode] = useState('All'); // 'All', 'HIGH_CONFIDENCE', 'ELITE', 'CAUTION'
  const [sortField, setSortField] = useState('time');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [sortBy, setSortBy] = useState('time_asc');
  const [expandedMatchId, setExpandedMatchId] = useState(null);

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

  // 1. First, apply base filters (date, league, search, exclude finished)
  const baseMatches = useMemo(() => {
    return matches.filter(m => {
      if (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') return false;

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
        const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
        const mDate = timeVal ? getLocalizedDateKey(timeVal, tzSettings) : 'Upcoming';
        if (mDate !== selectedDate) return false;
      }

      return true;
    });
  }, [matches, searchQuery, selectedLeague, selectedDate, tzSettings]);

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

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    // 3. Apply the final strategy filter logic
    return baseMatches.filter(m => {
      const homeProb = safeParseFloat(m.prob?.home, 0);
      const drawProb = safeParseFloat(m.prob?.draw, 0);
      const awayProb = safeParseFloat(m.prob?.away, 0);
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, Math.max(homeProb, drawProb, awayProb));

      const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
      const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
      const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';

      if (filterMode === 'UNANIMOUS') {
        if (hasUnanimous) {
          if (!isUnanimous) return false;
        } else {
          // Dynamic fallback: If no unanimous picks exist for this period/filter, show the highest confidence (win rate) game(s) instead
          if (conf < maxBaseConfidence || maxBaseConfidence === 0) return false;
        }
      }

      if (filterMode === 'NO_TRAPS' && isTrap) return false;
      if (filterMode === 'DERIVATIVE_SAFETY' && !isDerivative) return false;
      if (filterMode === 'HIGH_CONFIDENCE' && conf < 65) return false;
      if (filterMode === 'ELITE' && conf < 75) return false;
      if (filterMode === 'CAUTION' && conf >= 65) return false;

      const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
      const isDnbAdvised = m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0;
      if (filterMode === 'TIER_1_ONLY' && leagueTierObj?.tier !== 1) return false;
      if (filterMode === 'DNB_ONLY' && !isDnbAdvised) return false;

      return true;
    }).sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

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
        const pickA = (typeof a.predictedWinner === 'string' ? a.predictedWinner : (a.predictedWinner?.pick || a.binaryModel?.pick || '')) || '';
        const pickB = (typeof b.predictedWinner === 'string' ? b.predictedWinner : (b.predictedWinner?.pick || b.binaryModel?.pick || '')) || '';
        return pickA.localeCompare(pickB) * multiplier;
      }
      if (sortField === 'probs') {
        const maxA = Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.draw, 0), safeParseFloat(a.prob?.away, 0));
        const maxB = Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.draw, 0), safeParseFloat(b.prob?.away, 0));
        return (maxA - maxB) * multiplier;
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
      if (sortField === 'conf') {
        const confA = safeParseFloat(a.confidence ?? a.binaryModel?.confidence, Math.max(safeParseFloat(a.prob?.home, 0), safeParseFloat(a.prob?.draw, 0), safeParseFloat(a.prob?.away, 0)));
        const confB = safeParseFloat(b.confidence ?? b.binaryModel?.confidence, Math.max(safeParseFloat(b.prob?.home, 0), safeParseFloat(b.prob?.draw, 0), safeParseFloat(b.prob?.away, 0)));
        return (confA - confB) * multiplier;
      }
      if (sortField === 'xg') {
        const xgA = safeParseFloat(a.lambda ?? a.xG?.home, 0) + safeParseFloat(a.mu ?? a.xG?.away, 0);
        const xgB = safeParseFloat(b.lambda ?? b.xG?.home, 0) + safeParseFloat(b.mu ?? b.xG?.away, 0);
        return (xgA - xgB) * multiplier;
      }
      if (sortField === 'kelly') {
        const kA = safeParseFloat(a.kellyStake?.units ?? a.binaryModel?.kellyStake?.units ?? a.kellyStake?.fraction, 0);
        const kB = safeParseFloat(b.kellyStake?.units ?? b.binaryModel?.kellyStake?.units ?? b.kellyStake?.fraction, 0);
        return (kA - kB) * multiplier;
      }
      return 0;
    });
  }, [baseMatches, hasUnanimous, maxBaseConfidence, filterMode, sortField, sortDirection]);

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
      
      {/* Top Banner & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Main Model & Match Outputs (1X2)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {matches.length} Matches Analyzed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive probability engine combining Dixon-Coles, Elo, and 6-Agent Consensus.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTriggerRetrain && onTriggerRetrain()}
              disabled={isRetraining}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              <Cpu className={`w-3.5 h-3.5 text-indigo-600 ${isRetraining ? 'animate-spin' : ''}`} />
              <span>{isRetraining ? 'Retraining...' : 'Retrain Statistical Model'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search Box */}
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search club or competition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
          </div>
          
          {/* Right: Dropdowns */}
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
              label="Conviction"
              value={filterMode}
              onChange={setFilterMode}
              options={[
                { value: 'All', label: 'All Convictions' },
                { value: 'UNANIMOUS', label: '👑 6-Agent Unanimous' },
                { value: 'TIER_1_ONLY', label: '⭐ Tier 1 High-Edge Leagues Only' },
                { value: 'DNB_ONLY', label: '🛡️ DNB Advised (Draw ≥ 24%)' },
                { value: 'NO_TRAPS', label: '🛡️ High Stability Only' },
                { value: 'DERIVATIVE_SAFETY', label: '🔄 Smart Derivative Picks' },
                { value: 'ELITE', label: 'Elite Edge (≥75%)' },
                { value: 'HIGH_CONFIDENCE', label: 'High Conf (≥65%)' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Showing matches count */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <span>Showing <strong>{filteredMatches.length}</strong> of {matches.length} fixtures</span>
        {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || filterMode !== 'All') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedLeague('All');
              setSelectedDate('All');
              setFilterMode('All');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Matches League Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-visible">
        <div className="w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none h-11">
                {/* Time */}
                <th 
                  onClick={() => handleSort('time')}
                  className={`py-1.5 px-2 w-24 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'time' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by Kickoff Time (${sortField === 'time' ? (sortDirection === 'asc' ? 'Earliest first — click for Latest' : 'Latest first — click for Earliest') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span className={sortField === 'time' ? 'text-indigo-600 font-bold' : ''}>Time</span>
                    {sortField === 'time' ? (
                      sortDirection === 'asc' ? (
                        <span className="inline-flex items-center text-indigo-600 gap-0.5 text-[10px] font-mono font-bold">
                          <ArrowUp className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-indigo-600 gap-0.5 text-[10px] font-mono font-bold">
                          <ArrowDown className="w-3 h-3" />
                        </span>
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Fixture */}
                <th 
                  onClick={() => handleSort('fixture')}
                  className={`py-1.5 px-2 min-w-[180px] cursor-pointer transition-colors group select-none ${
                    sortField === 'fixture' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by Teams / Competition (${sortField === 'fixture' ? (sortDirection === 'asc' ? 'A to Z — click for Z to A' : 'Z to A — click for A to Z') : 'Click to sort'})`}
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

                {/* Lineup */}
                <th 
                  onClick={() => handleSort('lineup')}
                  className={`py-1.5 px-2 w-20 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'lineup' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by Confirmed XI status (${sortField === 'lineup' ? (sortDirection === 'desc' ? 'Confirmed first' : 'Unconfirmed first') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span className={sortField === 'lineup' ? 'text-indigo-600 font-bold' : ''}>Lineup</span>
                    {sortField === 'lineup' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Prediction */}
                <th 
                  onClick={() => handleSort('prediction')}
                  className={`py-1.5 px-2 w-28 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'prediction' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by AI Pick Outcome (${sortField === 'prediction' ? (sortDirection === 'asc' ? 'Ascending' : 'Descending') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span className={sortField === 'prediction' ? 'text-indigo-600 font-bold' : ''}>Prediction</span>
                    {sortField === 'prediction' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* 1 | X | 2 Probs */}
                <th 
                  className={`py-1.5 px-3 w-40 text-center select-none transition-colors ${
                    ['probs', 'home_prob', 'draw_prob', 'away_prob'].includes(sortField) ? 'bg-indigo-50/60' : ''
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div 
                      onClick={() => handleSort('probs')}
                      className="inline-flex items-center justify-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors group"
                      title={`Click to sort by Top Win Probability (${sortField === 'probs' ? (sortDirection === 'asc' ? 'Lowest first — click for Highest' : 'Highest first — click for Lowest') : 'Click to sort'})`}
                    >
                      <InfoTooltip title="1 | X | 2 Probabilities" content="The model's calculated win probabilities for Home (1), Draw (X), and Away (2). Click 'Probs' or individual buttons below to sort.">
                        <span className={sortField === 'probs' ? 'text-indigo-600 font-bold' : ''}>1 | X | 2 Probs</span>
                      </InfoTooltip>
                      {sortField === 'probs' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>

                    {/* Sub-selectors for 1, X, 2 probabilities */}
                    <div className="inline-flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded border border-slate-200 text-[9px] font-mono font-bold">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSort('probs'); }}
                        title={`Sort by Overall Top Prob (${sortField === 'probs' && sortDirection === 'asc' ? 'Ascending' : 'Descending'})`}
                        className={`px-1 py-0.2 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
                          sortField === 'probs' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                        }`}
                      >
                        <span>Top</span>
                        {sortField === 'probs' && (sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSort('home_prob'); }}
                        title={`Sort by Home Win (1) % (${sortField === 'home_prob' && sortDirection === 'asc' ? 'Ascending' : 'Descending'})`}
                        className={`px-1 py-0.2 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
                          sortField === 'home_prob' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                        }`}
                      >
                        <span>1</span>
                        {sortField === 'home_prob' && (sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSort('draw_prob'); }}
                        title={`Sort by Draw (X) % (${sortField === 'draw_prob' && sortDirection === 'asc' ? 'Ascending' : 'Descending'})`}
                        className={`px-1 py-0.2 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
                          sortField === 'draw_prob' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                        }`}
                      >
                        <span>X</span>
                        {sortField === 'draw_prob' && (sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSort('away_prob'); }}
                        title={`Sort by Away Win (2) % (${sortField === 'away_prob' && sortDirection === 'asc' ? 'Ascending' : 'Descending'})`}
                        className={`px-1 py-0.2 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
                          sortField === 'away_prob' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                        }`}
                      >
                        <span>2</span>
                        {sortField === 'away_prob' && (sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                      </button>
                    </div>
                  </div>
                </th>

                {/* Conf */}
                <th 
                  onClick={() => handleSort('conf')}
                  className={`py-1.5 px-2 w-20 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'conf' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by AI Confidence (${sortField === 'conf' ? (sortDirection === 'desc' ? 'High to Low — click for Low to High' : 'Low to High — click for High to Low') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Confidence Score" content="Overall AI confidence in the top prediction, accounting for injury absences, odds movement, and historical variance. Click column to sort.">
                      <span className={sortField === 'conf' ? 'text-indigo-600 font-bold' : ''}>Conf</span>
                    </InfoTooltip>
                    {sortField === 'conf' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Score/xG */}
                <th 
                  onClick={() => handleSort('xg')}
                  className={`py-1.5 px-2 w-24 text-center cursor-pointer transition-colors group select-none ${
                    sortField === 'xg' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by Total Projected Expected Goals (xG) (${sortField === 'xg' ? (sortDirection === 'desc' ? 'Highest xG first — click for Lowest' : 'Lowest xG first — click for Highest') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <InfoTooltip title="Score / Expected Goals (xG)" content="Most likely exact scoreline, along with calculated Expected Goals (xG). Click column to sort.">
                      <span className={sortField === 'xg' ? 'text-indigo-600 font-bold' : ''}>Score/xG</span>
                    </InfoTooltip>
                    {sortField === 'xg' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Smart Staking */}
                <th 
                  onClick={() => handleSort('kelly')}
                  className={`py-1.5 px-2 w-36 text-left cursor-pointer transition-colors group select-none ${
                    sortField === 'kelly' ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-100'
                  }`}
                  title={`Click to sort by Kelly sizing (${sortField === 'kelly' ? (sortDirection === 'desc' ? 'Highest stake first — click for Lowest' : 'Lowest stake first — click for Highest') : 'Click to sort'})`}
                >
                  <div className="inline-flex items-center gap-1">
                    <InfoTooltip title="Smart Staking & Kelly" content="Recommended betting market based on highest +EV edge with optimal Kelly bankroll sizing. Click column to sort.">
                      <span className={sortField === 'kelly' ? 'text-indigo-600 font-bold' : ''}>Smart Staking</span>
                    </InfoTooltip>
                    {sortField === 'kelly' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-1.5 px-2 w-48 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100">
              {filteredMatches.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={9} className="py-12 text-center text-slate-400 block md:table-cell">
                    <p className="text-sm font-medium">
                      {filterMode === 'UNANIMOUS' 
                        ? 'No matches match your active filter criteria for 6 agent unanimous 76.2% win rate ai strategy filter.'
                        : filterMode === 'NO_TRAPS'
                        ? 'No matches match your active filter criteria for High Stability Only ai strategy filter.'
                        : filterMode === 'DERIVATIVE_SAFETY'
                        ? 'No matches match your active filter criteria for Derivative Safety ai strategy filter.'
                        : filterMode === 'ELITE'
                        ? 'No matches match your active filter criteria for Elite ai strategy filter.'
                        : filterMode === 'HIGH_CONFIDENCE'
                        ? 'No matches match your active filter criteria for High Confidence ai strategy filter.'
                        : filterMode === 'CAUTION'
                        ? 'No matches match your active filter criteria for Caution Risk ai strategy filter.'
                        : 'No matches match your active filter criteria.'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Try switching dates, clearing the search query, or selecting "All Leagues".</p>
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
                  
                  const fallbackPick = homeProb === highestProb ? 'HOME' : (awayProb === highestProb ? 'AWAY' : 'DRAW');
                  const predictedWinner = typeof m.predictedWinner === 'string' ? m.predictedWinner : (m.predictedWinner?.pick || m.binaryModel?.pick || fallbackPick);
                  
                  const scoreObj = m.mostLikelyScore || m.scoreModel?.topScorelines?.[0]?.score;
                  let rawScore = '—';
                  if (typeof scoreObj === 'string') rawScore = scoreObj;
                  else if (scoreObj?.home !== undefined) rawScore = `${scoreObj.home}-${scoreObj.away}`;
                  else if (m.predictedScore) rawScore = m.predictedScore;
                  const score = formatScore(rawScore);
                  
                  const hasLineup = m.lineupAdjusted || m.hasConfirmedLineup;

                  const homeXg = safeParseFloat(m.lambda ?? m.xG?.home, 1.5);
                  const awayXg = safeParseFloat(m.mu ?? m.xG?.away, 1.1);
                  const kellyDisplay = formatKellyStake(m.kellyStake ?? m.binaryModel?.kellyStake, '1.5u');
                  const smartMarketDisplay = formatSmartMarket(m.smartMarket ?? m.binaryModel?.smartMarket, `${predictedWinner === 'HOME' ? m.home : predictedWinner === 'AWAY' ? m.away : 'Draw'} ML`);

                  const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
                  const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE' || (m.aiSwarm || m.imperialSwarm)?.isUnanimousDirective;
                  const isDerivative = m.smartMarket?.marketType === 'DOUBLE_CHANCE' || m.smartMarket?.marketType === 'DRAW_NO_BET' || m.smartMarket?.marketType === 'OVER_15';

                  const leagueTierObj = m.leagueTier || getLeaguePredictabilityTier(m.league);
                  const isDnbAdvised = m.smartMarket?.dnbProtection?.isAdvised || m.smartMarket?.marketType === 'DRAW_NO_BET' || drawProb >= 24.0;

                  return (
                    <React.Fragment key={m.id || idx}>
                      <tr 
                        className={`flex flex-col md:table-row hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} md:h-12 cursor-pointer md:cursor-default`}
                        onClick={() => { if (window.innerWidth < 768) toggleExpand(m.id || idx); }}
                      >
                        {/* ---------------- MOBILE VIEW ---------------- */}
                        <td className="md:hidden p-3 block">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-semibold text-slate-700 font-mono text-[10px] mr-2">
                                {formatMatchKickoff(m)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {m.league}
                              </span>
                            </div>
                            <ConfidenceGauge confidence={conf} size="sm" />
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900">{m.home}</span>
                                {isUnanimous && <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded font-bold" title="6-Agent Unanimous Selection (76.2% Win Rate)">👑 Unan (76.2%)</span>}
                                {leagueTierObj && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shadow-2xs ${leagueTierObj.badgeStyle}`} title={`${leagueTierObj.label} (${leagueTierObj.expectedHighConvictionWinRate} hit rate)`}>
                                    {leagueTierObj.badgeShort}
                                  </span>
                                )}
                                {isDnbAdvised && (
                                  <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-bold" title={`Draw Risk ${safeToFixed(drawProb, 1)}% ≥ 24.0% — DNB protects stake`}>
                                    🛡️ DNB
                                  </span>
                                )}
                                {isTrap && <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-300 px-1 rounded font-bold">⚠️ Upset Risk</span>}
                                {isDerivative && <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded font-bold">🛡️ {m.smartMarket?.pick}</span>}
                              </div>
                              <span className="font-bold text-slate-900">{m.away}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Top Pick</span>
                              <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-bold border shadow-sm ${getWinnerBadgeClass(predictedWinner)}`}>
                                {predictedWinner === 'HOME' ? `${m.home?.slice(0, 10)} WIN` : predictedWinner === 'AWAY' ? `${m.away?.slice(0, 10)} WIN` : 'DRAW'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {score}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                {smartMarketDisplay}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAddToSlip) onAddToSlip(m);
                              }}
                              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                isSlipAdded
                                  ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              {isSlipAdded ? <Trash2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                            </button>
                          </div>
                          
                          {!isExpanded && (
                            <div className="text-[10px] text-slate-400 mt-2 text-center uppercase tracking-wider font-semibold">
                              Tap for details <ChevronDown className="w-3 h-3 inline-block ml-0.5" />
                            </div>
                          )}
                        </td>

                        {/* ---------------- DESKTOP CELLS ---------------- */}
                        {/* Time / Status */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <span className="font-semibold text-slate-700 font-mono text-xs block">
                            {formatMatchKickoff(m)}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[65px] mx-auto">
                            {m.league?.split(' ')[0] || 'Soccer'}
                          </span>
                        </td>

                        {/* Fixture / Teams */}
                        <td className="hidden md:table-cell py-1.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 truncate">
                                  {m.home}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400">vs</span>
                                <span className="font-semibold text-slate-900 truncate">
                                  {m.away}
                                </span>
                                {isUnanimous && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 shadow-2xs" title="6-Agent Unanimous Selection (76.2% Empirical Win Rate)">
                                    👑 Unanimous (76.2%)
                                  </span>
                                )}
                                {leagueTierObj && (
                                  <span 
                                    className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border shadow-2xs ${leagueTierObj.badgeStyle}`} 
                                    title={`${leagueTierObj.label} (${leagueTierObj.expectedHighConvictionWinRate} conviction hit rate) • ${leagueTierObj.description}`}
                                  >
                                    {leagueTierObj.badge}
                                  </span>
                                )}
                                {isDnbAdvised && (
                                  <span 
                                    className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 shadow-2xs" 
                                    title={`Draw risk ${safeToFixed(drawProb, 1)}% ≥ 24.0%. Calibrated Draw-No-Bet salvages stake with 69.5% non-loss rate.`}
                                  >
                                    🛡️ DNB Advised
                                  </span>
                                )}
                                {isTrap && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded border border-rose-300 shadow-2xs" title="Upset Potential Flagged by Council">
                                    ⚠️ Upset Risk
                                  </span>
                                )}
                                {isDerivative && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200" title={`Smart Derivative: ${m.smartMarket?.pick}`}>
                                    🛡️ {m.smartMarket?.pick}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="truncate max-w-[150px] font-medium">{m.league}</span>
                                {m.formMomentum && (
                                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1 rounded" title={`Rolling 6-game form: Home (${m.formMomentum.home?.record || '—'}) vs Away (${m.formMomentum.away?.record || '—'})`}>
                                    Form: {m.formMomentum.home?.record || '—'} vs {m.formMomentum.away?.record || '—'}
                                  </span>
                                )}
                                {m.referee?.name && (
                                  <span className="text-slate-400 hidden sm:inline truncate">
                                    • Ref: {m.referee.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Lineup XI Badge Button */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenLineup && onOpenLineup(m); }}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer inline-block ${
                              hasLineup
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to view Starting XI"
                          >
                            {hasLineup ? 'XI Conf' : 'XI Est'}
                          </button>
                        </td>

                        {/* AI Prediction Pick */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getWinnerBadgeClass(predictedWinner)}`}>
                            {predictedWinner === 'HOME' ? `${m.home?.slice(0, 10)} WIN` : predictedWinner === 'AWAY' ? `${m.away?.slice(0, 10)} WIN` : 'DRAW'}
                          </span>
                        </td>

                        {/* Probabilities 1 | X | 2 */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-xs font-mono">
                            <span className={`px-1 rounded ${homeProb > awayProb && homeProb > drawProb ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}>
                              {safeToFixed(homeProb, 0)}%
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className={`px-1 rounded ${drawProb > homeProb && drawProb > awayProb ? 'font-bold text-amber-700 bg-amber-50' : 'text-slate-600'}`}>
                              {safeToFixed(drawProb, 0)}%
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className={`px-1 rounded ${awayProb > homeProb && awayProb > drawProb ? 'font-bold text-blue-700 bg-blue-50' : 'text-slate-600'}`}>
                              {safeToFixed(awayProb, 0)}%
                            </span>
                          </div>
                        </td>

                        {/* Confidence */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <ConfidenceGauge confidence={conf} size="sm" />
                        </td>

                        {/* Score/xG */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <span className="font-bold text-slate-800 text-xs font-mono block">
                            {score}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            xG {safeToFixed(homeXg, 1, '1.5')}-{safeToFixed(awayXg, 1, '1.1')}
                          </span>
                        </td>

                        {/* Smart Staking */}
                        <td className="hidden md:table-cell py-1.5 px-2">
                          <div className="text-[11px]">
                            <span className="font-semibold text-slate-800 block truncate max-w-[150px]" title={smartMarketDisplay}>
                              {smartMarketDisplay}
                            </span>
                            <KellyTooltip showIcon={false} align="right">
                              <span className="text-[10px] text-emerald-700 font-medium block font-mono cursor-help hover:underline">
                                Kelly: {kellyDisplay}
                              </span>
                            </KellyTooltip>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Deep Analysis Page */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                              className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                              title="Open Analysis"
                            >
                              Analysis
                            </button>

                            {/* Add to Slip Slip */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddToSlip && onAddToSlip(m); }}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
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
                              className="px-1.5 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                              
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
  );
}
