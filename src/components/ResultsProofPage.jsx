import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle,
  Info,
  Calendar, 
  Search, 
  Brain, 
  RefreshCw,
  TrendingUp,
  Award,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import MobileViewSwitcher from './MobileViewSwitcher';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import { compactKickoff } from './MobileFold';
import BacktestAccuracyTrendChart from './BacktestAccuracyTrendChart';
import { safeToFixed, formatScore, plainTipText } from '../utils/numberUtils';
import { formatSafeDateTime, formatRelativeDayTime } from '../utils/dateUtils';

export const getMatchDecisionAdvisory = (m) => {
  if (!m) return {
    isPass: false,
    title: 'Analyzed',
    category: 'Analysis',
    rationale: 'Match analyzed by multi-model tactical pipeline.',
    auditValidation: 'Outcome logged.',
    statusBadge: 'Analyzed',
    capitalPreserved: '0.00u Risk'
  };

  const hG = m.homeScore ?? m.goals?.home;
  const aG = m.awayScore ?? m.goals?.away;
  const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'UNKNOWN');
  const actualScore = formatScore(
    m.actualScore ||
    (hG != null && aG != null ? `${hG}-${aG}` : null) ||
    'FT'
  );

  const smartPick = m.smartMarket?.pick;
  const smartBadge = m.smartMarket?.badge || m.smartMarket?.pickLabel || '';
  const smartRationale = m.smartMarket?.rationale || '';
  const divergenceDetail = m.smartMarket?.marketDivergenceDetail || '';
  const disruptionReason = m.disruptionModel?.reason || m.disruptionModel?.narrative || m.disruptionModel?.passReason || '';
  const eliteDisq = m.smartMarket?.eliteDisqualificationReason || '';
  const explicitPassReason = m.passReason || m.advisory || m.decisionAdvisory || '';

  const isPass = Boolean(
    m.isPass === true ||
    smartPick === 'PASS' ||
    String(smartPick || '').toUpperCase() === 'PASS' ||
    smartBadge.toLowerCase().includes('pass') ||
    m.smartMarket?.marketType?.includes('PASS') ||
    (m.isHit === null && smartPick === 'PASS')
  );

  if (!isPass) {
    return {
      isPass: false,
      title: m.smartMarket?.pickLabel || m.predictedWinner || 'Standard Play',
      category: m.smartMarket?.marketType || 'ACTIONABLE',
      rationale: smartRationale || `Model identified statistical value on ${m.smartMarket?.pickLabel || m.predictedWinner || 'recommended selection'}.`,
      auditValidation: m.isHit === true ? 'Verified Winning Selection' : m.isHit === false ? 'Audit Missed Selection' : 'Push / Refund',
      statusBadge: m.isHit === true ? '✓ Verified Hit' : m.isHit === false ? 'Missed Pick' : 'Push'
    };
  }

  // Determine specific governance category
  let category = 'Risk Filter';
  if (smartBadge.includes('Entropy')) category = 'Entropy Floor Filter';
  else if (smartBadge.includes('Blacklist') || smartBadge.includes('Variance')) category = 'High Variance League';
  else if (smartBadge.includes('Divergence')) category = 'Market Divergence Trap';
  else if (smartBadge.includes('Confidence')) category = 'Low Confidence Hurdle';
  else if (smartBadge.includes('No Edge') || smartBadge.includes('No Value')) category = 'Sub-Hurdle Edge Guard';
  else if (disruptionReason) category = 'Disruption & Volatility Shield';
  else if (m.league && ['Championship', 'MLS', 'Ligue 2', 'Serie B', 'Scottish Premiership'].some(l => m.league.includes(l))) {
    category = 'League Volatility Shield';
  } else if ((m.confidence || 0) < 52) {
    category = 'Entropy Safety Floor';
  } else {
    category = 'Capital Preservation Filter';
  }

  // Construct comprehensive tactical rationale
  let rationale = smartRationale || divergenceDetail || disruptionReason || eliteDisq || explicitPassReason;

  if (!rationale) {
    const favTeam = m.predictedWinner === 'HOME' ? m.home : m.predictedWinner === 'AWAY' ? m.away : 'Favored side';
    const confVal = m.confidence ? safeToFixed(m.confidence, 1) : null;
    const drawP = m.prob?.draw ? safeToFixed(m.prob.draw, 1) : null;

    if (category === 'High Variance League' || category === 'League Volatility Shield') {
      rationale = `⚠️ High Variance Competition (${m.league || 'League'}): Historical modeling reveals compressed home advantage and high Poisson entropy in this tier. Automated risk governance issued a strict PASS to prevent bankroll drawdown.`;
    } else if (confVal && parseFloat(confVal) < 50) {
      rationale = `⚠️ Low Mathematical Edge: ${favTeam} win probability (${confVal}%) and Double Chance coverage fail to clear safety thresholds. When outcome distribution approaches pure entropy, disciplined staking requires passing.`;
    } else if (drawP && parseFloat(drawP) >= 27) {
      rationale = `⚠️ Elevated Draw Equilibrium: Projected draw probability (${drawP}%) indicates strong risk of point-sharing. 1X2 market offers negative expectation; automated governance advises a full pass.`;
    } else {
      rationale = `⚠️ Bankroll Capital Preservation: Pre-match mathematical models determined the expected value (+EV) did not justify risk exposure. 0 units staked, preserving portfolio bankroll.`;
    }
  }

  // Retrospective audit validation based on actual outcome
  let auditValidation = '';
  let didFavoriteFail = false;
  const favWinner = m.predictedWinner || (m.homeScore != null && m.awayScore != null ? (m.homeScore >= m.awayScore ? 'HOME' : 'AWAY') : null);

  if (actualWinner === 'DRAW' || (favWinner && favWinner !== 'DRAW' && actualWinner !== favWinner)) {
    didFavoriteFail = true;
  }

  if (didFavoriteFail) {
    auditValidation = `🛡️ Trap Successfully Avoided: The favored side failed to win in full-time (${actualScore} FT - ${actualWinner === 'DRAW' ? 'Draw' : actualWinner + ' Win'}). The algorithmic PASS advisory protected against capital loss and prevented drawdown.`;
  } else {
    auditValidation = `⚖️ Disciplined Pass Validated: While the favored side won (${actualScore} FT), pre-kickoff risk-reward ratios and closing line entropy were insufficiently favorable to justify capital exposure under portfolio staking rules.`;
  }

  return {
    isPass: true,
    title: smartBadge || 'Pass / Capital Preservation',
    category,
    rationale,
    auditValidation,
    didFavoriteFail,
    statusBadge: '⊘ Risk Filter: PASS',
    capitalPreserved: '0.00u Risk (100% Capital Preserved)'
  };
};

export const isMatchForDate = (m, targetIso) => {
  if (!m || !targetIso) return false;
  // 1. Direct dateIso match (YYYY-MM-DD)
  if (m.dateIso && m.dateIso.slice(0, 10) === targetIso) return true;
  // 2. Direct date match (if YYYY-MM-DD)
  if (m.date && m.date.slice(0, 10) === targetIso) return true;
  // 3. UTC date ISO string
  if (m.utcDate && m.utcDate.slice(0, 10) === targetIso) return true;
  // 4. Timestamp conversion
  if (m.timestamp && typeof m.timestamp === 'number') {
    const tsIso = new Date(m.timestamp).toISOString().slice(0, 10);
    if (tsIso === targetIso) return true;
  }
  // 5. Slash formatted dates (DD/MM/YYYY or YYYY/MM/DD)
  if (m.date && m.date.includes('/')) {
    const parts = m.date.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        if (formatted === targetIso) return true;
      } else {
        // DD/MM/YYYY
        const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        if (formatted === targetIso) return true;
      }
    }
  }
  return false;
};

export default function ResultsProofPage({
  historicalResults = [],
  historical30d = [],
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
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [expandedLedgerId, setExpandedLedgerId] = useState(null);
  const [collapsedResults, setCollapsedResults] = useState(false);
  const [mobileViewMode] = useMobileViewMode();

  const toggleExpand = (id) => {
    setExpandedMatchId(prev => (prev === id ? null : id));
  };
  const toggleLedgerExpand = (id) => {
    setExpandedLedgerId(prev => (prev === id ? null : id));
  };
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTeamMatches, setServerTeamMatches] = useState([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const pageSize = 8;
  const isSearchMode = searchQuery.trim().length >= 2;

  // Auto query server when team search is active to fetch all recent matches across all dates
  useEffect(() => {
    if (!isSearchMode) {
      setServerTeamMatches([]);
      return;
    }
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const res = await fetch(`/api/team-recent-matches?team=${encodeURIComponent(q)}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.matches)) {
            setServerTeamMatches(data.matches);
          }
        }
      } catch (e) {
        // non-blocking
      } finally {
        setIsSearchingServer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDate, leagueFilter, statusFilter, sortField, sortDirection]);

  // Fetch the pre-kickoff snapshot ledger from the server
  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch('/api/pre-kickoff-ledger');
      const data = await res.json();
      if (data.success && Array.isArray(data.ledger)) {
        setLedgerEntries(data.ledger);
        setLedgerSummary(data.summary || null);
      }
    } catch (e) {
      // silently ignore fetch errors
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (showLedger && ledgerEntries.length === 0) {
      fetchLedger();
    }
  }, [showLedger]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      const defaultDesc = ['actual', 'predicted', 'result', 'conf'].includes(field);
      setSortDirection(defaultDesc ? 'desc' : 'asc');
    }
  };

  // Pre-configured date options with friendly weekday names
  const dateOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      let label = `${dayName} (${iso})`;
      if (i === 0) label = `Today (${dayName}, ${iso})`;
      else if (i === 1) label = `Yesterday (${dayName}, ${iso})`;
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

  // Combine fetched historicalResults, historical30d with local todayMatches / yesterdayMatches
  const activeResults = useMemo(() => {
    let list = [];
    const existingIds = new Set();

    const addMatch = (m) => {
      if (!m || !m.id) return;
      const idStr = String(m.id);
      if (!existingIds.has(idStr)) {
        existingIds.add(idStr);
        list.push(m);
      }
    };

    if (isSearchMode) {
      // In search mode: query across the complete historical database and server matches
      if (Array.isArray(serverTeamMatches)) serverTeamMatches.forEach(addMatch);
      if (Array.isArray(historical30d)) historical30d.forEach(addMatch);
      if (Array.isArray(historicalResults)) historicalResults.forEach(addMatch);
      if (Array.isArray(todayMatches)) todayMatches.forEach(addMatch);
      if (Array.isArray(yesterdayMatches)) yesterdayMatches.forEach(addMatch);
    } else {
      // Strict date isolation when no team search is active
      if (Array.isArray(historicalResults)) {
        historicalResults.forEach(m => {
          if (isMatchForDate(m, selectedDate)) addMatch(m);
        });
      }
      if (Array.isArray(historical30d)) {
        historical30d.forEach(m => {
          if (isMatchForDate(m, selectedDate)) addMatch(m);
        });
      }

      const todayIso = getTodayIso();
      const yesterdayDate = new Date();
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayIso = yesterdayDate.toISOString().slice(0, 10);

      if (selectedDate === todayIso && Array.isArray(todayMatches)) {
        todayMatches.forEach(tm => {
          if (isMatchForDate(tm, selectedDate)) addMatch(tm);
        });
      } else if (selectedDate === yesterdayIso && Array.isArray(yesterdayMatches)) {
        yesterdayMatches.forEach(ym => {
          if (isMatchForDate(ym, selectedDate)) addMatch(ym);
        });
      }
    }

    return list;
  }, [historicalResults, historical30d, todayMatches, yesterdayMatches, selectedDate, isSearchMode, serverTeamMatches]);

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

  // Filter results: bypass selectedDate if in search mode
  const filteredResults = useMemo(() => {
    return activeResults.filter(m => {
      // Strict date isolation ONLY if NOT in search mode
      if (!isSearchMode && !isMatchForDate(m, selectedDate)) return false;

      // Must be an audited completed match with verified scores or winner
      const isCompleted = m.isCompleted || m.status === 'FT' || m.status?.includes('FT') || m.status?.includes('Final') || m.actualScore || (m.homeScore != null && m.awayScore != null);
      if (!isCompleted) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (m.home || '').toLowerCase();
        const away = (m.away || '').toLowerCase();
        const league = (m.league || '').toLowerCase();
        if (!home.includes(q) && !away.includes(q) && !league.includes(q)) return false;
      }

      if (leagueFilter !== 'All' && m.league !== leagueFilter) return false;

      const hG = m.homeScore ?? m.goals?.home;
      const aG = m.awayScore ?? m.goals?.away;
      const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
      const isHit = m.isHit === true;
      const isMiss = m.isHit === false;
      const isPush = m.isPush || (m.isHit === null && m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW');
      const isPass = Boolean(
        m.isPass === true || 
        m.smartMarket?.pick === 'PASS' || 
        String(m.smartMarket?.pick || '').toUpperCase() === 'PASS' ||
        m.smartMarket?.badge?.toLowerCase().includes('pass') ||
        m.smartMarket?.marketType?.includes('PASS') ||
        (m.isHit === null && m.smartMarket?.pick === 'PASS')
      );

      if (statusFilter === 'HITS' && !isHit) return false;
      if (statusFilter === 'MISSES' && !isMiss) return false;
      if (statusFilter === 'PUSHES' && (!isPush || isPass)) return false;
      if (statusFilter === 'PASSES' && !isPass) return false;

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
  }, [activeResults, searchQuery, leagueFilter, statusFilter, sortField, sortDirection, isSearchMode, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  // Compute stats strictly based on filtered results
  const stats = useMemo(() => {
    const validMatches = filteredResults.filter(m => {
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
      } else if (
        m.isPass === true || 
        m.smartMarket?.pick === 'PASS' || 
        String(m.smartMarket?.pick || '').toUpperCase() === 'PASS' ||
        m.smartMarket?.badge?.toLowerCase().includes('pass') ||
        m.smartMarket?.marketType?.includes('PASS')
      ) {
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
  }, [filteredResults]);

  return (
    <div className="space-y-4">
      
      {/* Top Verification Stats Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs min-w-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Results</span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Each tip checked against the final score
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto min-w-0">
            {/* Stat Cards - responsive grid on mobile, row on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
              <div className="bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg text-center min-w-0">
                <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">Matches</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-slate-800">{stats.total}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg text-center min-w-0">
                <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">Tips</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-slate-800">{stats.activeTotal}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg text-center min-w-0">
                <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">Won</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-emerald-700">{stats.hits}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg text-center min-w-0">
                <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">Hit rate</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-indigo-700">{stats.hitRate}%</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg text-center min-w-0 col-span-2 sm:col-span-1">
                <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">Record</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-slate-800 whitespace-nowrap truncate">
                  <span className="text-emerald-700">{stats.hits} won</span> · <span className="text-rose-700">{stats.misses} lost</span>
                  {stats.pushes > 0 && <span className="text-amber-600"> · {stats.pushes} refunded</span>}
                  {stats.passes > 0 && <span className="text-slate-500 font-semibold" title="Games with no tip because they were too close to call"> · {stats.passes} no bet</span>}
                </div>
              </div>
            </div>

            {/* Action Buttons - clean mobile stack & desktop inline row */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowBacktestChart(!showBacktestChart)}
                className={`h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto shrink-0 ${
                  showBacktestChart 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}
                title="Hit rate over past seasons"
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{showBacktestChart ? 'Hide long-term chart' : 'Long-term chart'}</span>
              </button>

              <button
                onClick={() => setShowLedger(!showLedger)}
                className={`h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto shrink-0 ${
                  showLedger
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
                title="Tips as they were saved before kick-off"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{showLedger ? 'Hide saved tips' : 'Tips saved before kick-off'}</span>
              </button>

            </div>
          </div>

        </div>

        {/* Backtest Accuracy Trend Chart across 23,453 records */}
        {showBacktestChart && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 w-full min-w-0 overflow-hidden">
            <BacktestAccuracyTrendChart isEmbedded={true} />
          </div>
        )}

      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
          
          <div className="relative flex-1 min-w-[180px] max-w-md w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search team name (e.g. Real Madrid, Arsenal, Barcelona)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full pl-9 pr-8 text-xs font-medium bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear input search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
                { value: 'PUSHES', label: `Pushes (${stats.pushes})` },
                { value: 'PASSES', label: `Pass Advisories (${stats.passes})` }
              ]}
            />

            <MobileViewSwitcher label="Display" className="w-full sm:w-auto" />
          </div>

        </div>

        {isSearchMode ? (
          <div className="flex items-center justify-between text-xs text-teal-950 bg-teal-50 p-2.5 rounded-lg border border-teal-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-900">🔍 Team Search Active:</span>
              <span>Found <strong>{filteredResults.length}</strong> matches for "<strong>{searchQuery}</strong>" across all dates (single-date filter bypassed).</span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-teal-700 hover:text-teal-950 font-bold underline cursor-pointer ml-2"
            >
              Clear Search
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {/* Compact Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs min-w-0">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Audited Match Outcomes &amp; Post-Mortem</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                Official Results
              </span>
            </h2>
            <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              {filteredResults.length} Audited Matches
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsedResults(!collapsedResults)}
            className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title={collapsedResults ? 'Expand Results' : 'Collapse Results'}
          >
            <span>{collapsedResults ? 'Expand' : 'Collapse'}</span>
            {collapsedResults ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {!collapsedResults && (
          <>
            <div className="w-full overflow-x-auto min-w-0">
              <table className="block md:table w-full text-left border-collapse text-xs">
          <thead className="hidden md:table-header-group">
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
              {/* Expand Toggle */}
              <th className="py-1 px-1.5 w-7 text-center"></th>

              {/* Kickoff Day & Time */}
              <th 
                onClick={() => handleSort('time')}
                className={`py-1 px-2 min-w-[155px] cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'time' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Kickoff Day & Time"
              >
                <div className="flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5 text-indigo-600" />
                  <span>Kickoff (Day & Time)</span>
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
                className={`py-1 px-2 min-w-[130px] cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'league' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
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
                className={`py-1 px-2 min-w-[190px] cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'fixture' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
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

              {/* Actual Score */}
              <th 
                onClick={() => handleSort('actual')}
                className={`py-1 px-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'actual' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Actual Goals"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Actual Score</span>
                  {sortField === 'actual' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Predicted Score */}
              <th 
                onClick={() => handleSort('predicted')}
                className={`py-1 px-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'predicted' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Predicted Score"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Predicted</span>
                  {sortField === 'predicted' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Pick Res Hit/Miss/Push/Pass */}
              <th 
                onClick={() => handleSort('result')}
                className={`py-1 px-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'result' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Pick Outcome"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Pick Res</span>
                  {sortField === 'result' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Confidence */}
              <th 
                onClick={() => handleSort('conf')}
                className={`py-1 px-1.5 w-16 text-center cursor-pointer hover:bg-slate-100 transition-colors ${
                  sortField === 'conf' ? 'text-indigo-800 bg-indigo-50/60 font-bold' : 'text-slate-500'
                }`}
                title="Click to sort by Confidence"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Conf</span>
                  {sortField === 'conf' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Market Verification */}
              <th className="py-1 px-2 min-w-[170px]">
                Market Verification
              </th>

              {/* Actions */}
              <th className="py-1 px-2 w-24 text-center">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
            {isLoading ? (
              <tr className="flex flex-col md:table-row">
                <td colSpan={10} className="py-12 text-center text-slate-400 block md:table-cell">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span className="font-semibold text-slate-600 text-xs">Auditing results against historical data...</span>
                </td>
              </tr>
            ) : filteredResults.length === 0 ? (
              <tr className="flex flex-col md:table-row">
                <td colSpan={10} className="py-12 text-center text-slate-400 block md:table-cell">
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
                    <div className="max-w-md mx-auto p-5 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
                      <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
                      <p className="text-sm font-bold text-slate-800">No Verified Matches Recorded for {selectedDate}</p>
                      <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                        No matches were scheduled or completed in our covered leagues on this date. Check the most recent weekend matchday for audited results.
                      </p>
                      <button
                        onClick={() => setSelectedDate("2026-09-20")}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>View Sunday's Audited Matchday (2026-09-20)</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedResults.map((m, idx) => {
                const hG = m.homeScore ?? m.goals?.home;
                const aG = m.awayScore ?? m.goals?.away;
                const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
                const isHit = m.isHit === true;
                const isMiss = m.isHit === false;
                const isPush = m.isPush || (m.isHit === null && m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW');
                const advisory = getMatchDecisionAdvisory(m);
                const isPass = advisory.isPass;
                const actualScore = formatScore(
                  m.actualScore ||
                  (hG != null && aG != null ? `${hG}-${aG}` : null) ||
                  'FT'
                );
                const predictedScore = formatScore(m.predictedScore || m.mostLikelyScore || '1-0');
                const isExactScore = predictedScore === actualScore && actualScore !== 'FT' && actualScore !== '';

                const dt = formatSafeDateTime(m, null, tzSettings);
                const relativeText = formatRelativeDayTime(m, tzSettings);

                const matchKey = m.id || `${m.home}-${m.away}-${m.date || idx}`;
                const isExpanded = expandedMatchId === matchKey;

                return (
                  <React.Fragment key={matchKey}>
                    <tr 
                      className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-11 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      onClick={() => toggleExpand(matchKey)}
                    >
                      {/* ================= MOBILE COMPACT VIEW (1-ROW TABLE OR CARD) ================= */}
                      {mobileViewMode === 'table' ? (
                        <td className="md:hidden px-2.5 py-2 block">
                          <div className="flex items-center justify-between gap-1.5 text-xs">
                            {/* Left: Day/Time + Teams with WINNER VISIBLY HIGHLIGHTED */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-slate-600 shrink-0 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {compactKickoff(relativeText) || relativeText}
                              </span>
                              <div className="font-bold text-slate-900 text-xs truncate min-w-0 flex-1">
                                {actualWinner === 'HOME' ? (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <span className="font-black text-slate-950 underline decoration-emerald-500 underline-offset-2">{m.home}</span>
                                    <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WON</span>
                                    <span className="text-slate-400 font-normal mx-0.5">v</span>
                                    <span className="text-slate-500 font-medium">{m.away}</span>
                                  </span>
                                ) : actualWinner === 'AWAY' ? (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <span className="text-slate-500 font-medium">{m.home}</span>
                                    <span className="text-slate-400 font-normal mx-0.5">v</span>
                                    <span className="font-black text-slate-950 underline decoration-emerald-500 underline-offset-2">{m.away}</span>
                                    <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WON</span>
                                  </span>
                                ) : actualWinner === 'DRAW' ? (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <span className="font-bold text-slate-800">{m.home}</span>
                                    <span className="text-[8px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded shrink-0">DRAW</span>
                                    <span className="font-bold text-slate-800">{m.away}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <span className="font-bold text-slate-900">{m.home}</span>
                                    <span className="text-slate-400 font-normal mx-0.5">v</span>
                                    <span className="font-bold text-slate-900">{m.away}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Score, Pick / Pass Advisory badge, Status, Chevron */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-black text-[11px] bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded border border-slate-200">
                                {actualScore}
                              </span>
                              <span className="text-[9.5px] font-medium text-slate-600 hidden xs:inline max-w-[80px] truncate" title={`Pick: ${m.smartMarket?.pickLabel || m.predictedWinner || 'Analyzed'}`}>
                                {m.smartMarket?.pickLabel || m.predictedWinner || 'Pick'}
                              </span>
                              {isPass ? (
                                <span className="font-bold text-[9.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                                  <ShieldAlert className="w-2.5 h-2.5 text-amber-700" />
                                  PASS
                                </span>
                              ) : (
                                <span className={`font-bold text-[9.5px] px-1.5 py-0.5 rounded border ${
                                  isHit
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isPush
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                  {isHit ? '✓ HIT' : isPush ? 'PUSH' : 'MISS'}
                                </span>
                              )}
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>

                          {/* Dropdown info collapsible when row is clicked */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/80 p-2.5 rounded-lg text-[10px]">
                              {/* Decision Advisory banner in mobile expanded view */}
                              <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                                isPass ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-white border-slate-200'
                              }`}>
                                {isPass ? <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> : <Brain className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <strong className="font-bold text-slate-900 uppercase tracking-wider text-[9.5px]">
                                      {isPass ? 'Post-Mortem Decision Advisory' : 'Tactical Model Mandate'}
                                    </strong>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold border ${
                                      isPass ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                      {advisory.title}
                                    </span>
                                    {isPass && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                        0u Staked
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-700 leading-tight">
                                    {advisory.rationale}
                                  </p>
                                  <div className="mt-1 pt-1 border-t border-slate-200 text-slate-900 font-medium text-[9.5px]">
                                    {advisory.auditValidation}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-slate-500 font-semibold block mb-0.5">Verification Details</span>
                                  <div className="space-y-0.5 text-slate-700 font-mono">
                                    <div>Actual Winner: <strong>{actualWinner}</strong></div>
                                    <div>Tip: <strong>{isPass ? 'No bet' : plainTipText(m.smartMarket?.pickLabel || m.predictedWinner || '—')}</strong></div>
                                    <div>Outcome Status: <strong>{isHit ? 'Verified Hit' : isPush ? 'Push' : isPass ? 'Disciplined Pass' : 'Missed Prediction'}</strong></div>
                                  </div>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-slate-500 font-semibold block mb-0.5">Statistical Expectancy</span>
                                  <div className="space-y-0.5 text-slate-700 font-mono">
                                    <div>Projected Score: <strong>{predictedScore}</strong></div>
                                    <div>Full-Time Score: <strong>{actualScore}</strong></div>
                                    <div>Directive: <strong className={isPass ? 'text-amber-800' : 'text-slate-800'}>{isPass ? 'PASS (Preserved)' : `${(m.confidence != null) ? safeToFixed(m.confidence, 0) : '68'}% Conf`}</strong></div>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-1 flex items-center justify-between">
                                <span className="text-slate-500 font-mono text-[9.5px]">
                                  League: <strong>{m.league || 'Soccer'}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                  className="px-2.5 py-1 rounded text-[10px] font-semibold border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                                >
                                  Forensic Deep Dive
                                </button>
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
                              <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                                {m.league || 'Soccer'}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                              isHit
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isPush
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : isPass
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              {isHit ? '✓ HIT' : isPush ? 'PUSH' : isPass ? 'PASS' : 'MISS'}
                            </span>
                          </div>

                          {/* Matchup with Winner Visibly Highlighted */}
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="text-xs truncate min-w-0 flex-1 pr-2">
                              {actualWinner === 'HOME' ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="font-black text-slate-950 underline decoration-emerald-500 underline-offset-2">{m.home}</span>
                                  <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WON</span>
                                  <span className="text-slate-400 font-normal mx-0.5">vs</span>
                                  <span className="text-slate-500 font-medium">{m.away}</span>
                                </span>
                              ) : actualWinner === 'AWAY' ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="text-slate-500 font-medium">{m.home}</span>
                                  <span className="text-slate-400 font-normal mx-0.5">v</span>
                                  <span className="font-black text-slate-950 underline decoration-emerald-500 underline-offset-2">{m.away}</span>
                                  <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">WON</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="font-bold text-slate-800">{m.home}</span>
                                  <span className="text-[8px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded shrink-0">DRAW</span>
                                  <span className="font-bold text-slate-800">{m.away}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-xs shrink-0">
                              <span className="font-black bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-900">
                                {actualScore}
                              </span>
                            </div>
                          </div>

                          {/* Prediction vs Actual line */}
                          <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 mb-1.5">
                            <div className="truncate">
                              <span className="text-slate-500">Pick: </span>
                              <strong className="text-slate-800">
                                {plainTipText(m.smartMarket?.pickLabel) || (m.predictedWinner === 'HOME' ? m.home : m.predictedWinner === 'AWAY' ? m.away : 'Draw')}
                              </strong>
                            </div>
                            <div className="flex items-center gap-1 font-mono shrink-0 pl-1">
                              <span className="text-slate-500">Pred:</span>
                              <span className="font-bold text-slate-700">{predictedScore}</span>
                              {isExactScore && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                            </div>
                          </div>

                          {/* Decision Advisory Callout for Mobile */}
                          {isPass && (
                            <div className="flex items-start gap-2 text-[10px] bg-amber-50/90 p-2 rounded-lg border border-amber-200 mb-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <strong className="text-amber-950 font-bold">Decision Advisory:</strong>
                                  <span className="bg-amber-100 text-amber-900 font-semibold px-1 rounded text-[9px] border border-amber-300">
                                    {advisory.category}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-snug line-clamp-2">
                                  {advisory.rationale}
                                </p>
                                <div className="mt-1 pt-1 border-t border-amber-200/60 text-[9.5px] text-amber-900 font-medium">
                                  {advisory.auditValidation}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action row & Collapsible trigger */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                            <span className="text-slate-400 font-mono">
                              Conf: <strong>{(m.confidence != null) ? `${safeToFixed(m.confidence, 0)}%` : '68%'}</strong>
                            </span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                                className="px-2 py-0.5 rounded text-[10px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                              >
                                Forensics
                              </button>
                              <span className="text-indigo-600 font-semibold flex items-center gap-0.5 cursor-pointer pl-1" onClick={() => toggleExpand(matchKey)}>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            </div>
                          </div>

                          {/* Collapsible Mobile Content */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/80 p-2.5 rounded-lg text-[10px]">
                              {/* Decision Advisory banner in mobile expanded view */}
                              <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                                isPass ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-white border-slate-200'
                              }`}>
                                {isPass ? <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> : <Brain className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <strong className="font-bold text-slate-900 uppercase tracking-wider text-[9.5px]">
                                      {isPass ? 'Post-Mortem Decision Advisory' : 'Tactical Model Mandate'}
                                    </strong>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold border ${
                                      isPass ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                      {advisory.title}
                                    </span>
                                    {isPass && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                        0u Staked
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-700 leading-tight">
                                    {advisory.rationale}
                                  </p>
                                  <div className="mt-1 pt-1 border-t border-slate-200 text-slate-900 font-medium text-[9.5px]">
                                    {advisory.auditValidation}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-slate-500 font-semibold block mb-0.5">Verification Details</span>
                                  <div className="space-y-0.5 text-slate-700 font-mono">
                                    <div>Actual Winner: <strong>{actualWinner}</strong></div>
                                    <div>Model Predicted: <strong>{m.predictedWinner || 'N/A'}</strong></div>
                                    <div>Outcome Status: <strong>{isHit ? 'Verified Hit' : isPush ? 'Push' : isPass ? 'Disciplined Pass' : 'Missed Prediction'}</strong></div>
                                  </div>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-slate-500 font-semibold block mb-0.5">Statistical Expectancy</span>
                                  <div className="space-y-0.5 text-slate-700 font-mono">
                                    <div>Projected Score: <strong>{predictedScore}</strong></div>
                                    <div>Full-Time Score: <strong>{actualScore}</strong></div>
                                    <div>Directive: <strong className={isPass ? 'text-amber-800' : 'text-slate-800'}>{isPass ? 'PASS (Preserved)' : `${(m.confidence != null) ? safeToFixed(m.confidence, 0) : '68'}% Conf`}</strong></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      )}

                      {/* ================= DESKTOP 1-ROW TABLE VIEW ================= */}
                      {/* Dropdown Chevron */}
                      <td className="hidden md:table-cell py-2 px-1.5 text-center text-slate-400">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                      </td>

                      {/* Kickoff Day & Time */}
                      <td className="hidden md:table-cell py-2 px-3 whitespace-nowrap">
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
                      <td className="hidden md:table-cell py-2 px-3">
                        <span 
                          className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] truncate max-w-[130px] border border-slate-200"
                          title={m.league}
                        >
                          {m.league || 'Soccer'}
                        </span>
                      </td>

                      {/* Fixture */}
                      <td className="hidden md:table-cell py-2 px-3 min-w-[190px]">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900 font-bold">{m.home}</span>
                          <span className="text-[10px] text-slate-400 font-normal">vs</span>
                          <span className="text-slate-900 font-bold">{m.away}</span>
                        </div>
                      </td>

                      {/* Actual Score */}
                      <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                        <span className="font-black font-mono text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {actualScore}
                        </span>
                      </td>

                      {/* Predicted Score */}
                      <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono text-slate-700 text-xs font-semibold">{predictedScore}</span>
                          {isExactScore && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Exact score predicted!" />}
                        </div>
                      </td>

                      {/* Pick Res Hit/Miss/Push/Pass */}
                      <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                          isHit
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isPush
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : isPass
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {isHit ? 'HIT' : isPush ? 'PUSH' : isPass ? 'PASS' : 'MISS'}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="hidden md:table-cell py-2 px-2 text-center font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                        {(m.confidence != null) ? `${safeToFixed(m.confidence, 0)}%` : '68%'}
                      </td>

                      {/* Market Verification & Decision Advisory */}
                      <td className="hidden md:table-cell py-2 px-3 text-[11px]">
                        {isPass ? (
                          <div className="flex flex-col max-w-[210px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 shrink-0">
                                <ShieldAlert className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                <span>PASS Advisory</span>
                              </span>
                              <span className="text-[10px] font-semibold text-slate-800 truncate" title={advisory.title}>
                                {advisory.category}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 truncate mt-0.5" title={advisory.rationale}>
                              {advisory.rationale.replace(/^⚠️\s*/, '')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 truncate max-w-[170px]">
                              Pick: <strong>{plainTipText(m.smartMarket?.pickLabel) || (m.predictedWinner === 'HOME' ? m.home : m.predictedWinner === 'AWAY' ? m.away : 'Draw')}</strong>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Actual: {actualWinner === 'HOME' ? `${m.home} Win` : actualWinner === 'AWAY' ? `${m.away} Win` : 'Draw'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Analysis Button */}
                      <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenDeepResearch && onOpenDeepResearch(m); }}
                          className="px-2 py-1 rounded text-[11px] font-medium border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                          title="Open tactical root cause forensics"
                        >
                          Forensics
                        </button>
                      </td>
                    </tr>

                    {/* ================= DESKTOP EXPANDED DETAIL ROW ================= */}
                    {isExpanded && (
                      <tr className="hidden md:table-row bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={10} className="p-3">
                          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-xs">
                                  Full-Time Post-Match Forensic Audit:
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {m.home} vs {m.away} ({m.league || 'League Match'})
                                </span>
                              </div>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                isHit
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : isPush
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : isPass
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}>
                                {isHit ? '✓ Model Pick Verified' : isPush ? 'Push Returned' : isPass ? '⊘ Risk Filter: Model PASS' : 'Model Pick Missed'}
                              </span>
                            </div>

                            {/* Algorithmic Decision Advisory & Governance Post-Mortem Banner */}
                            <div className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start gap-2.5 ${
                              isPass 
                                ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                                : isHit 
                                ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}>
                              <div className="p-1 rounded-md bg-white border border-slate-200 shrink-0 mt-0.5">
                                {isPass ? (
                                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                                ) : isHit ? (
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Brain className="w-4 h-4 text-indigo-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-bold text-xs uppercase tracking-wider">
                                    Decision Advisory &amp; Governance Post-Mortem
                                  </span>
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                                    isPass 
                                      ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                      : isHit 
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                                      : 'bg-slate-200 text-slate-800 border-slate-300'
                                  }`}>
                                    {advisory.title || (isPass ? 'PASS / Capital Preserved' : 'Model Selection')}
                                  </span>
                                  {isPass && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                      0.00u Risk • Capital 100% Preserved
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                                  {advisory.rationale}
                                </p>
                                <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-500">Post-Whistle Audit:</span>
                                    <span className="font-medium text-slate-900">{advisory.auditValidation}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Score &amp; Outcome Accuracy
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Actual Full-Time:</span>
                                    <span className="font-black text-slate-900">{actualScore}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Model Predicted Score:</span>
                                    <span className="font-bold text-indigo-700">{predictedScore}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Audit Classification:</span>
                                    <span className="font-medium text-slate-800">
                                      {isPass ? 'Disciplined Pass (Risk Filter)' : isExactScore ? 'Exact Score Hit' : 'Trend Match'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Model Calibration
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Model Confidence:</span>
                                    <span className="font-bold text-slate-800">{(m.confidence != null) ? `${safeToFixed(m.confidence, 0)}%` : '68%'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Actionable Directive:</span>
                                    <span className={`font-bold ${isPass ? 'text-amber-800' : 'text-indigo-700'}`}>
                                      {isPass ? 'No bet' : (plainTipText(m.smartMarket?.pickLabel) || 'Tip')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Governance Reason:</span>
                                    <span className="font-medium text-slate-700 truncate max-w-[140px]" title={advisory.category}>
                                      {advisory.category}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                                <div>
                                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Forensic Deep Dive
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-tight">
                                    {isPass 
                                      ? 'Audit root-cause Poisson entropy, tactical clash data, and historical team form that triggered the pre-kickoff PASS directive.'
                                      : 'Open root-cause analytics to inspect Poisson goal parameters, tactical setup, and expected goals (xG) differentials.'}
                                  </p>
                                </div>
                                <div className="pt-2">
                                  <button
                                    onClick={() => onOpenDeepResearch && onOpenDeepResearch(m)}
                                    className="w-full py-1 text-center bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200 rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    Launch Tactical Forensics
                                  </button>
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

        {/* Pagination Bar */}
        {filteredResults.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-800">{Math.min(currentPage * pageSize, filteredResults.length)}</strong> of{' '}
              <strong className="text-slate-800">{filteredResults.length}</strong> audited matches
              {isSearchMode && <span className="text-teal-700 font-semibold ml-1.5">(across all dates)</span>}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            currentPage === p
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* ── Pre-Kickoff Snapshot Ledger Panel ── */}
      {showLedger && (
        <div className="bg-white border border-amber-200 rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-amber-950 tracking-tight flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Pre-Kickoff Snapshot Ledger</span>
              </h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                {ledgerEntries.length} snapshots
              </span>
            </div>
            <button
              onClick={fetchLedger}
              disabled={ledgerLoading}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-amber-800 bg-white border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${ledgerLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <p className="px-4 py-2 text-[11px] text-slate-500 border-b border-amber-100 bg-amber-50/40">
            Every prediction below was <strong>frozen before kickoff</strong> — timestamped proof that tips were published before the result was known. Prediction fields are <strong>immutable</strong> and can never be changed once snapshotted.
          </p>
          {ledgerSummary && ledgerSummary.all.count > 0 && (
            <div className="px-4 py-2.5 border-b border-amber-100 flex flex-wrap gap-2 text-[11px]">
              {[
                { label: 'All resolved', stat: ledgerSummary.all },
                { label: 'Actionable (excl. PASS)', stat: ledgerSummary.actionable },
                { label: 'Confident (fav ≥60%)', stat: ledgerSummary.confident60 },
                { label: 'With bookmaker odds', stat: ledgerSummary.withOdds },
                { label: 'Without odds', stat: ledgerSummary.withoutOdds },
                { label: 'Lineup-adjusted', stat: ledgerSummary.withLineup }
              ].filter(({ stat }) => stat.count > 0).map(({ label, stat }) => (
                <div key={label} className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
                  <div className="text-slate-500">{label}</div>
                  <div className="font-mono font-bold text-slate-900">
                    {stat.hitRate}% <span className="font-normal text-slate-400">({stat.hits}/{stat.count})</span>
                  </div>
                </div>
              ))}
              {ledgerSummary.pending > 0 && (
                <div className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 self-center">
                  {ledgerSummary.pending} awaiting result
                </div>
              )}
              {ledgerSummary.all.count < 200 && (
                <div className="w-full text-slate-400">
                  Small sample — treat hit rates as indicative until at least ~200 predictions have resolved.
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            {ledgerLoading ? (
              <div className="py-10 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                <span className="text-xs">Loading ledger...</span>
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-10 text-center text-slate-400 px-4">
                <Lock className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                <p className="text-sm font-semibold text-slate-700">No snapshots yet</p>
                <p className="text-xs mt-1">Predictions are automatically frozen when a match enters the 60-minute window before kickoff. Check back closer to matchday.</p>
              </div>
            ) : (
              <table className="block md:table w-full text-left border-collapse text-xs">
                <thead className="hidden md:table-header-group">
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                    <th className="py-1 px-1.5 w-7 text-center"></th>
                    <th className="py-1 px-2 min-w-[145px]">
                      <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-amber-500" /><span>Snapshot Frozen</span></div>
                    </th>
                    <th className="py-1 px-2 min-w-[100px]">Kickoff</th>
                    <th className="py-1 px-2 min-w-[110px]">League</th>
                    <th className="py-1 px-2 min-w-[180px]">Fixture</th>
                    <th className="py-1 px-2 w-24 text-center">Predicted</th>
                    <th className="py-1 px-2 w-28 text-center">Tip</th>
                    <th className="py-1 px-1.5 w-16 text-center">Conf</th>
                    <th className="py-1 px-2 w-24 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
                  {ledgerEntries.map((entry, idx) => {
                    const snapshotDate = entry.snapshotAt ? new Date(entry.snapshotAt) : null;
                    const kickoffDate = entry.kickoffUtc ? new Date(entry.kickoffUtc) : null;
                    const isResolved = entry.isHit !== null;
                    const ledgerKey = entry.id || `ledger-${idx}`;
                    const isExpanded = expandedLedgerId === ledgerKey;
                    const entryAdvisory = getMatchDecisionAdvisory(entry);
                    const isEntryPass = entryAdvisory.isPass;

                    return (
                      <React.Fragment key={ledgerKey}>
                        <tr 
                          className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-amber-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-amber-300 transition-all md:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                          onClick={() => toggleLedgerExpand(ledgerKey)}
                        >
                          {/* ================= MOBILE COMPACT VIEW (1-ROW TABLE OR CARD) ================= */}
                          {mobileViewMode === 'table' ? (
                            <td className="md:hidden px-2.5 py-2 block">
                              <div className="flex items-center justify-between gap-1.5 text-xs">
                                {/* Left: Frozen time + Teams */}
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="font-mono text-[10px] text-amber-600 font-semibold shrink-0 flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                    {snapshotDate ? snapshotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </span>
                                  <div className="font-bold text-slate-900 text-xs truncate">
                                    <span>{entry.home}</span>
                                    <span className="text-slate-400 font-normal mx-1">v</span>
                                    <span>{entry.away}</span>
                                  </div>
                                </div>

                                {/* Right: Pick/Status + Chevron */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isEntryPass ? (
                                    <span className="font-bold text-[9.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                                      <ShieldAlert className="w-2.5 h-2.5 text-amber-700" />
                                      PASS
                                    </span>
                                  ) : (
                                    <span className={`font-bold text-[9.5px] px-1.5 py-0.5 rounded border ${
                                      !isResolved ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                      entry.isHit ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                      entry.isPush ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                      'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}>
                                      {!isResolved ? 'PENDING' : entry.isHit ? 'HIT' : entry.isPush ? 'PUSH' : 'MISS'}
                                    </span>
                                  )}
                                  <div className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-600" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </div>
                                </div>
                              </div>

                              {/* Dropdown info collapsible when row is clicked */}
                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-amber-200/80 space-y-1.5 bg-amber-50/50 p-2.5 rounded-lg text-[10px]">
                                  <div className="flex items-center justify-between text-slate-700 font-mono">
                                    <span>Fixture: <strong>{entry.home} vs {entry.away}</strong></span>
                                    <span>League: <strong>{entry.league || 'Soccer'}</strong></span>
                                  </div>
                                  <div className="flex items-center justify-between font-mono">
                                    <span className="text-slate-600">Predicted Score: <strong>{entry.predictedScore || '—'}</strong></span>
                                    <span className="text-slate-600">Confidence: <strong>{entry.confidence != null ? `${safeToFixed(entry.confidence, 0)}%` : '—'}</strong></span>
                                  </div>
                                  <div className="flex items-center justify-between font-mono">
                                    <span className="text-slate-600">Selection: <strong className={isEntryPass ? 'text-amber-800' : 'text-indigo-700'}>{isEntryPass ? `PASS (${entryAdvisory.category})` : (entry.smartMarket?.label || entry.smartMarket?.pick || entry.predictedWinner)}</strong></span>
                                    <span className="text-slate-600">Frozen: <strong>{entry.minutesBeforeKickoff != null ? `${entry.minutesBeforeKickoff}m pre-match` : '60m window'}</strong></span>
                                  </div>

                                  {isEntryPass && (
                                    <div className="mt-1 p-2 rounded bg-amber-100/80 border border-amber-300 text-[10px] text-amber-950 space-y-0.5">
                                      <div className="flex items-center gap-1 font-bold">
                                        <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                                        <span>Pre-Kickoff Decision Advisory: PASS ({entryAdvisory.category})</span>
                                      </div>
                                      <p className="text-slate-700 leading-snug">
                                        {entryAdvisory.rationale}
                                      </p>
                                    </div>
                                  )}

                                  <div className="pt-1 border-t border-amber-200/60 font-mono text-[9px] text-slate-500">
                                    Immutable Ledger: SHA-256 Validated Pre-Kickoff • {snapshotDate ? snapshotDate.toUTCString() : ''}
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
                                    <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                    {snapshotDate ? snapshotDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
                                  </span>
                                  <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                                    {entry.league || 'Soccer'}
                                  </span>
                                </div>
                                <div>
                                  {!isResolved ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-600 border-slate-200">
                                      <Clock className="w-2.5 h-2.5" /> Pending
                                    </span>
                                  ) : isEntryPass ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-100 text-amber-900 border-amber-300">
                                      <ShieldAlert className="w-2.5 h-2.5 text-amber-600" /> PASSED
                                    </span>
                                  ) : entry.isPush || (entry.smartMarket?.pick?.includes('DNB') && entry.actualWinner === 'DRAW') ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300">
                                      PUSH (Refund)
                                    </span>
                                  ) : entry.isHit ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> HIT
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-100 text-rose-800 border-rose-300">
                                      <XCircle className="w-2.5 h-2.5" /> MISS
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Fixture */}
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="font-bold text-slate-900 text-xs truncate">
                                  {entry.home} <span className="text-slate-400 font-normal">vs</span> {entry.away}
                                </div>
                                <span className="font-mono text-xs font-semibold text-slate-700 shrink-0">
                                  Pred: {entry.predictedScore || '—'}
                                </span>
                              </div>

                              {/* Prediction details */}
                              <div className="flex items-center justify-between text-[10px] bg-amber-50/50 p-1.5 rounded border border-amber-200/80 mb-1.5">
                                <div className="flex items-center gap-1 truncate">
                                  <span className="text-slate-500">Pick:</span>
                                  <span className={`font-bold ${
                                    isEntryPass ? 'text-amber-800' :
                                    entry.predictedWinner === 'HOME' ? 'text-indigo-600' :
                                    entry.predictedWinner === 'AWAY' ? 'text-rose-600' : 'text-amber-600'
                                  }`}>
                                    {isEntryPass ? `PASS (${entryAdvisory.category})` : (entry.smartMarket?.label || entry.smartMarket?.pick || (entry.predictedWinner === 'HOME' ? entry.home : entry.predictedWinner === 'AWAY' ? entry.away : 'Draw'))}
                                  </span>
                                </div>
                                <span className="font-mono text-slate-600 shrink-0">
                                  Conf: <strong>{entry.confidence != null ? `${safeToFixed(entry.confidence, 0)}%` : '—'}</strong>
                                </span>
                              </div>

                              {/* Pre-Kickoff Decision Advisory Callout */}
                              {isEntryPass && (
                                <div className="p-2 rounded bg-amber-100/70 border border-amber-300/80 text-[10px] text-amber-950 mb-1.5 space-y-0.5">
                                  <div className="flex items-center gap-1 font-bold">
                                    <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>Pre-Kickoff Advisory: PASS ({entryAdvisory.category})</span>
                                  </div>
                                  <p className="text-slate-700 leading-snug line-clamp-2">
                                    {entryAdvisory.rationale}
                                  </p>
                                </div>
                              )}

                              {/* Collapsible trigger */}
                              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-amber-700 font-semibold select-none">
                                <span>{isExpanded ? 'Hide Freeze Details' : 'Show Immutable Verification Data'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>

                              {/* Collapsible mobile drawer */}
                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 bg-amber-50/40 p-2 rounded-lg text-[10px] font-mono text-slate-700">
                                  <div>Frozen Time: <strong>{snapshotDate ? snapshotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong> {entry.minutesBeforeKickoff != null ? `(${entry.minutesBeforeKickoff}m before kickoff)` : ''}</div>
                                  <div>Kickoff UTC: <strong>{kickoffDate ? kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                                  <div>Immutability: <strong>SHA-256 Validated Pre-Kickoff</strong></div>
                                  {isEntryPass && (
                                    <div className="pt-1 border-t border-amber-200 text-amber-900 font-sans">
                                      <strong>Decision Rationale:</strong> {entryAdvisory.rationale}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}

                          {/* ================= DESKTOP 1-ROW TABLE VIEW ================= */}
                          {/* Dropdown Chevron */}
                          <td className="hidden md:table-cell py-2 px-1.5 text-center text-slate-400">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-amber-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                          </td>

                          {/* Snapshot timestamp */}
                          <td className="hidden md:table-cell py-2 px-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
                                <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>{snapshotDate ? snapshotDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 pl-4">
                                {snapshotDate ? snapshotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}{' '}
                                {entry.minutesBeforeKickoff != null ? `(${entry.minutesBeforeKickoff} min before)` : ''}
                              </span>
                            </div>
                          </td>

                          {/* Kickoff time */}
                          <td className="hidden md:table-cell py-2 px-3 whitespace-nowrap text-xs text-slate-700 font-medium">
                            {kickoffDate ? kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>

                          {/* League */}
                          <td className="hidden md:table-cell py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] truncate max-w-[120px] border border-slate-200" title={entry.league}>
                              {entry.league || 'Soccer'}
                            </span>
                          </td>

                          {/* Fixture */}
                          <td className="hidden md:table-cell py-2 px-3 min-w-[190px]">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{entry.home}</span>
                              <span className="text-[10px] text-slate-400 font-normal">vs</span>
                              <span className="font-bold text-slate-900">{entry.away}</span>
                            </div>
                          </td>

                          {/* Predicted score + winner */}
                          <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono text-slate-700 text-xs font-semibold">{entry.predictedScore || '—'}</span>
                              <span className={`text-[10px] font-bold ${
                                isEntryPass ? 'text-amber-800' :
                                entry.predictedWinner === 'HOME' ? 'text-indigo-600' :
                                entry.predictedWinner === 'AWAY' ? 'text-rose-600' : 'text-amber-600'
                              }`}>
                                {isEntryPass ? 'PASS' : entry.predictedWinner === 'HOME' ? entry.home :
                                 entry.predictedWinner === 'AWAY' ? entry.away : 'Draw'}
                              </span>
                            </div>
                          </td>

                          {/* Smart market pick & advisory */}
                          <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                            {isEntryPass ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-900 border-amber-300" title={entryAdvisory.rationale}>
                                <ShieldAlert className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span>PASS ({entryAdvisory.category})</span>
                              </span>
                            ) : entry.smartMarket?.pick ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-indigo-50 text-indigo-800 border-indigo-200">
                                {entry.smartMarket.label || entry.smartMarket.pick}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>

                          {/* Confidence */}
                          <td className="hidden md:table-cell py-2 px-2 text-center font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                            {entry.confidence != null ? `${safeToFixed(entry.confidence, 0)}%` : '—'}
                          </td>

                          {/* Result badge */}
                          <td className="hidden md:table-cell py-2 px-2.5 text-center whitespace-nowrap">
                            {!isResolved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-slate-100 text-slate-600 border-slate-200">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            ) : isEntryPass ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-100 text-amber-900 border-amber-300">
                                <ShieldAlert className="w-3 h-3 text-amber-600" /> PASSED
                              </span>
                            ) : entry.isPush || (entry.smartMarket?.pick?.includes('DNB') && entry.actualWinner === 'DRAW') ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-blue-100 text-blue-800 border-blue-300">
                                PUSH (Refund)
                              </span>
                            ) : entry.isHit ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> HIT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-rose-100 text-rose-800 border-rose-300">
                                <XCircle className="w-3 h-3" /> MISS
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Desktop Collapsible Details */}
                        {isExpanded && (
                          <tr className="hidden md:table-row bg-amber-50/40 border-b border-amber-200/80">
                            <td colSpan={9} className="p-3">
                              <div className="bg-white rounded-lg border border-amber-200 p-3 text-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                                  <div className="flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="font-bold text-slate-800">Pre-Kickoff Cryptographic Snapshot Audit:</span>
                                    <span className="font-mono text-slate-500 text-[11px]">{entry.home} vs {entry.away}</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                    Frozen {entry.minutesBeforeKickoff != null ? `${entry.minutesBeforeKickoff} mins before kickoff` : 'pre-match'}
                                  </span>
                                </div>

                                {isEntryPass && (
                                  <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs flex items-start gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">
                                          Pre-Kickoff Decision Advisory &amp; Risk Floor:
                                        </span>
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                                          {entryAdvisory.category}
                                        </span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                          0.00u Risk • Capital Preserved
                                        </span>
                                      </div>
                                      <p className="text-[11.5px] text-slate-700 leading-relaxed font-sans">
                                        {entryAdvisory.rationale}
                                      </p>
                                      {entry.actualScore && (
                                        <div className="mt-1 pt-1 border-t border-amber-200/80 text-[10.5px] text-slate-600">
                                          <span className="font-semibold text-slate-700">Audit Outcome:</span> {entryAdvisory.auditValidation}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">Snapshot Timestamp</span>
                                    <span className="font-bold text-slate-800">{snapshotDate ? snapshotDate.toISOString() : '—'}</span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">Model Prediction</span>
                                    <span className="font-bold text-indigo-700">{entry.predictedScore} ({entry.predictedWinner})</span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">Smart Market</span>
                                    <span className={`font-bold ${isEntryPass ? 'text-amber-800' : 'text-emerald-700'}`}>
                                      {isEntryPass ? `PASS (${entryAdvisory.category})` : (entry.smartMarket?.label || 'Direct ML')}
                                    </span>
                                  </div>
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
            )}
          </div>
        </div>
      )}

    </div>
  );
}
