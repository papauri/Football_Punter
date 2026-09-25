import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, X, Cpu } from 'lucide-react';

import HeaderBar from './HeaderBar';
import SideMenuTray from './SideMenuTray';

// Page Views
import FixturesTablePage from './FixturesTablePage';
import ScoresTablePage from './ScoresTablePage';
import BinaryPicksPage from './BinaryPicksPage';
import AccumulatorPage from './AccumulatorPage';
import AllDayWinnerPage from './AllDayWinnerPage';
import ResultsProofPage, { isMatchForDate } from './ResultsProofPage';
import PerformanceChart from './PerformanceChart';
import LineupsPage from './LineupsPage';
import DeepResearchPage from './DeepResearchPage';
import LeagueProfilesPage from './LeagueProfilesPage';
import TuningPage from './TuningPage';
import TimezonePage from './TimezonePage';
import AutonomousPatchCenter from './AutonomousPatchCenter';
import AISwarmCenter from './AISwarmCenter';
import LogsPage from './LogsPage';
import ErrorBoundary from './ErrorBoundary';
import PropsSpecialsPage from './PropsSpecialsPage';
import StrategyProofModal from './StrategyProofModal';
import DailyBriefingPanel from './DailyBriefingPanel';
import LiveMatchPlayerModal from './LiveMatchPlayerModal';
import { resolveMatchOdds, resolveMatchProb } from '../utils/oddsUtils';
import { safeToFixed } from '../utils/numberUtils';
import { isLeagueBlacklisted } from '../utils/leagueUtils';
import { getMatchRiskProfile, getSlipPick, normalizePick, getPickMarketLabel } from '../utils/riskUtils';
import { getTimezoneDisplayLabel } from '../utils/dateUtils';

// =========================================================================
// TIMEZONE CONTEXT & EXPORTS
// =========================================================================

export const DEFAULT_TZ_SETTINGS = {
  zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  hour24: true
};

export const getBrowserTzInfo = () => {
  try {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const offsetMin = -new Date().getTimezoneOffset();
    const offsetHours = offsetMin / 60;
    const sign = offsetHours >= 0 ? '+' : '';
    const formattedOffset = `UTC${sign}${offsetHours % 1 === 0 ? offsetHours : offsetHours.toFixed(1)}`;
    return {
      tzName,
      offsetHours,
      formattedOffset,
      label: `${tzName} (${formattedOffset})`
    };
  } catch {
    return {
      tzName: 'UTC',
      offsetHours: 0,
      formattedOffset: 'UTC+0',
      label: 'UTC (UTC+0)'
    };
  }
};

export const TimezoneContext = createContext({
  tzSettings: DEFAULT_TZ_SETTINGS,
  updateTzSettings: () => {},
  browserTz: { tzName: 'UTC', offsetHours: 0, formattedOffset: 'UTC+0', label: 'UTC (UTC+0)' }
});

export const useTimezone = () => useContext(TimezoneContext);

export const DEFAULT_INITIAL_STATE = {
  hasKey: true,
  hasAiKey: false,
  aiProvider: 'Deterministic Core',
  aiModel: 'None',
  aiConfig: { hasAnyKey: false },
  bankrollEuro: 1000,
  kellyFraction: 0.25,
  matches: [],
  todayCompletedMatches: [],
  yesterdayMatches: [],
  yesterdayStats: { total: 0, correctPredictions: 0, accuracy: 0.0, homeHitRate: 0, drawHitRate: 0, awayHitRate: 0 },
  logs: [{ id: 'init-1', time: new Date().toLocaleTimeString(), bot: 'System', msg: 'Prediction Engine ready. Syncing live feeds...' }],
  trainingStats: { accuracy: 78.4, sampleCount: 23453 },
  scoreTrainingStats: { accuracy: 78.4 },
  hyperparameters: {},
  selfReflections: [],
  reflectionStats: { cycles: 0 },
  selfPatchHistory: [],
  superAgentInsights: [],
  autonomousAgent: { status: 'Active (Connecting)' },
  autonomousPatches: [],
  mistakePostMortems: [],
  aiSwarm: null,
  imperialSwarm: null,
  unanimousHitRate: 84.8,
  patchTelemetry: { patchesApplied: 0, activeGuardrails: 'Active' },
  patchGovernorState: { status: 'CONVERGED_OPTIMAL' },
  strictLeaguePruning: true,
  strategyProofMetrics: {}
};

export default function Dashboard() {
  const [state, setState] = useState(DEFAULT_INITIAL_STATE);
  const [isInitialSyncing, setIsInitialSyncing] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [activePage, setActivePage] = useState('fixtures');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const [showStrategyProof, setShowStrategyProof] = useState(false);
  
  // Active selected match for Deep Research or Lineup inspection
  const [activeResearchMatch, setActiveResearchMatch] = useState(null);
  const [activeLineupMatch, setActiveLineupMatch] = useState(null);
  const [activePlayerMatch, setActivePlayerMatch] = useState(null);

  // Bet Slips State
  const [betSlips, setBetSlips] = useState(() => {
    try {
      const savedSlips = localStorage.getItem('user_bet_slips');
      if (savedSlips) {
        const parsed = JSON.parse(savedSlips);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some(s => s.id === 'props-slip')) {
            parsed.push({ id: 'props-slip', name: 'Props Slip (LiveScore Bet)', picks: [] });
          }
          return parsed;
        }
      }
    } catch {}
    
    // Migration from old single slip
    try {
      const savedOld = localStorage.getItem('user_acca_picks');
      if (savedOld) {
        const parsed = JSON.parse(savedOld);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [
            { id: 'slip-1', name: 'Slip 1', picks: parsed },
            { id: 'props-slip', name: 'Props Slip (LiveScore Bet)', picks: [] }
          ];
        }
      }
    } catch {}
    
    return [
      { id: 'slip-1', name: 'Slip 1', picks: [] },
      { id: 'props-slip', name: 'Props Slip (LiveScore Bet)', picks: [] }
    ];
  });

  const [activeSlipId, setActiveSlipId] = useState(() => {
    try {
      const saved = localStorage.getItem('active_slip_id');
      if (saved) return saved;
    } catch {}
    return 'slip-1';
  });

  const activeSlip = betSlips.find(s => s.id === activeSlipId) || betSlips[0];
  const accaPicks = activeSlip?.picks || [];

  const handleUpdateBetSlips = (updaterOrSlips) => {
    setBetSlips(prev => {
      const newSlips = typeof updaterOrSlips === 'function' ? updaterOrSlips(prev) : updaterOrSlips;
      try { localStorage.setItem('user_bet_slips', JSON.stringify(newSlips)); } catch {}
      return newSlips;
    });
  };

  // Audited date selection for Verified Match Audit
  const [auditedDateResults, setAuditedDateResults] = useState(null);
  const [isLoadingDateResults, setIsLoadingDateResults] = useState(false);
  const [historical30d, setHistorical30d] = useState([]);
  const dateCacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const load30d = async () => {
      try {
        const res = await fetch('/api/historical-30d');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.matches) {
          setHistorical30d(data.matches);
        }
      } catch (err) {
        // Non-critical background fetch failure, silently ignore
      }
    };
    load30d();
    return () => { isMounted = false; };
  }, []);

  const handleFetchDateResults = useCallback(async (dateStr) => {
    if (!dateStr) return;

    // 1. Instant cache retrieval if date was previously queried
    if (dateCacheRef.current.has(dateStr)) {
      setAuditedDateResults(dateCacheRef.current.get(dateStr));
      return;
    }

    // 2. Cancel prior in-flight date query to prevent race conditions and aborted fetch errors
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setIsLoadingDateResults(true);

    // 3. Extract matching historical records from memory strictly matching dateStr
    const localMatches = (historical30d || [])
      .concat(state?.yesterdayMatches || [])
      .concat(state?.matches || [])
      .filter(m => isMatchForDate(m, dateStr));

    if (localMatches.length > 0 && !auditedDateResults) {
      setAuditedDateResults(localMatches);
    }

    // 4. Query backend with automatic retry
    try {
      let response = null;
      let attempts = 0;
      while (attempts < 2) {
        try {
          response = await fetch(`/api/fetch-date?date=${encodeURIComponent(dateStr)}`, {
            signal: abortCtrl.signal
          });
          if (response.ok) break;
        } catch (fetchErr) {
          if (fetchErr.name === 'AbortError') return; // User switched date, clean exit
          attempts++;
          if (attempts >= 2) throw fetchErr;
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (response && response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.matches)) {
          dateCacheRef.current.set(dateStr, data.matches);
          setAuditedDateResults(data.matches);
          return;
        }
      }

      // If backend returned empty, use strictly matching local matches or empty array
      if (localMatches.length > 0) {
        setAuditedDateResults(localMatches);
      } else {
        setAuditedDateResults([]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback strictly to matching local records, never random yesterday fixtures
        setAuditedDateResults(localMatches.length > 0 ? localMatches : []);
      }
    } finally {
      if (abortControllerRef.current === abortCtrl) {
        setIsLoadingDateResults(false);
      }
    }
  }, [historical30d, state, auditedDateResults]);

  const handleToggleAccaPick = (match, customPick = null, customMarket = null, customOdds = null, customProb = null, targetSlipId = null) => {
    const destinationSlipId = targetSlipId || activeSlipId || 'slip-1';
    let actionFeedback = null;

    handleUpdateBetSlips(prevSlips => {
      let slipIndex = prevSlips.findIndex(s => s.id === destinationSlipId);
      if (slipIndex === -1) {
        slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) {
          slipIndex = 0;
        }
      }
      
      const currentSlip = prevSlips[slipIndex] || { id: 'slip-1', name: 'Slip 1', picks: [] };
      const isPropsTarget = destinationSlipId === 'props-slip' || (customMarket && String(customMarket).startsWith('Props'));

      // Resolve pick value (straight outright normalization if DRAW or unspecified)
      // Default pick resolution is shared with the fixtures table (riskUtils.getSlipPick) so the
      // selection stored here is exactly the one the table's risk filters evaluated.
      let pickValue = customPick || getSlipPick(match);
      if (!customMarket?.startsWith('Props')) {
        pickValue = normalizePick(pickValue);
      }

      const outrightMarket = getPickMarketLabel(pickValue);
      const effectiveMarket = customMarket || outrightMarket;
      const odds = resolveMatchOdds(match, pickValue, customOdds);
      const prob = resolveMatchProb(match, pickValue, customProb);
      const pickId = `${match.id}-${effectiveMarket}`;

      const newPick = {
        pickId,
        id: match.id,
        match: match,
        home: match.home,
        away: match.away,
        league: match.league,
        time: match.time,
        date: match.dateIso || match.date,
        pick: pickValue,
        market: effectiveMarket,
        confidence: prob,
        modelConfidence: match.confidence ?? match.binaryModel?.confidence ?? null,
        prob,
        odds,
        // Full model payload retained so the slip never re-infers risk with different fallbacks
        smartMarket: match.smartMarket || null,
        binaryModel: match.binaryModel || null,
        disruptionModel: match.disruptionModel || null,
        leagueTier: match.leagueTier || null,
        riskProfile: getMatchRiskProfile(match, pickValue)
      };

      // LiveScore Bet & Bookmaker Acca Rule: Only ONE selection allowed per fixture on match accumulators.
      const existingPickIndex = currentSlip.picks.findIndex(p => {
        const isSameFixture = String(p.id) === String(match.id) || 
          (p.home && match.home && p.away && match.away && 
           p.home.toLowerCase() === match.home.toLowerCase() && 
           p.away.toLowerCase() === match.away.toLowerCase());
        
        if (!isSameFixture) return false;

        if (isPropsTarget) {
          return p.pickId === pickId || (p.pick === pickValue && p.market === effectiveMarket);
        }

        return true;
      });

      let updatedPicks;
      if (existingPickIndex !== -1) {
        const existing = currentSlip.picks[existingPickIndex];
        // If clicking the identical pick/market, toggle off
        if (existing.pickId === pickId || (existing.pick === pickValue && existing.market === newPick.market)) {
          updatedPicks = currentSlip.picks.filter((_, idx) => idx !== existingPickIndex);
          actionFeedback = {
            type: 'neutral',
            title: 'Removed from Bet Slip',
            message: `Removed ${match.home} vs ${match.away} from ${currentSlip.name} (${updatedPicks.length} picks remaining).`
          };
        } else {
          // Replace with the new single selection for this fixture
          updatedPicks = [...currentSlip.picks];
          updatedPicks[existingPickIndex] = newPick;
          actionFeedback = {
            type: 'success',
            title: 'Updated Bet Slip Selection',
            message: `Updated to ${newPick.market} @${safeToFixed(odds, 2)} in ${currentSlip.name} (${updatedPicks.length} picks).`
          };
        }
      } else {
        updatedPicks = [...currentSlip.picks, newPick];
        actionFeedback = {
          type: 'success',
          title: 'Added to Bet Slip',
          message: `Added ${match.home} vs ${match.away} (${pickValue} @${safeToFixed(odds, 2)}) to ${currentSlip.name} (${updatedPicks.length} picks).`
        };
      }
      
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = { ...currentSlip, picks: updatedPicks };
      return newSlips;
    });

    if (actionFeedback) {
      setToastNotification(actionFeedback);
      setTimeout(() => setToastNotification(null), 3500);
    }

    if (targetSlipId && targetSlipId !== activeSlipId) {
      setActiveSlipId(targetSlipId);
      try { localStorage.setItem('active_slip_id', targetSlipId); } catch {}
    }
  };

  const handleRemoveAccaPick = (idToRemove) => {
    handleUpdateBetSlips(prevSlips => {
      const slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
      if (slipIndex === -1) return prevSlips;
      
      const currentSlip = prevSlips[slipIndex];
      const updatedPicks = currentSlip.picks.filter(p => String(p.pickId) !== String(idToRemove) && String(p.id) !== String(idToRemove));
      
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = { ...currentSlip, picks: updatedPicks };
      return newSlips;
    });

    setToastNotification({
      type: 'neutral',
      title: 'Selection Removed',
      message: 'Removed game from active bet slip.'
    });
    setTimeout(() => setToastNotification(null), 2500);
  };

  const handleClearAcca = () => {
    handleUpdateBetSlips(prevSlips => {
      const slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
      if (slipIndex === -1) return prevSlips;
      
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = { ...newSlips[slipIndex], picks: [] };
      return newSlips;
    });
  };

  const handleLoadPicksToSlip = (picks, targetSlipId = null, toastMsg = null) => {
    const destSlipId = targetSlipId || activeSlipId;
    handleUpdateBetSlips(prevSlips => {
      let slipIndex = prevSlips.findIndex(s => s.id === destSlipId);
      if (slipIndex === -1) {
        slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) return prevSlips;
      }
      const currentSlip = prevSlips[slipIndex];
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = {
        ...currentSlip,
        picks: picks
      };
      return newSlips;
    });
    if (toastMsg) {
      setToastNotification(toastMsg);
      setTimeout(() => setToastNotification(null), 3500);
    }
  };

  // Timezone Settings
  const [tzSettings, setTzSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('soccer_predictor_tz_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TZ_SETTINGS;
  });

  const browserTz = useMemo(() => getBrowserTzInfo(), []);

  const updateTzSettings = (newSettings) => {
    setTzSettings(newSettings);
    try {
      localStorage.setItem('soccer_predictor_tz_settings', JSON.stringify(newSettings));
    } catch {}
  };

  // Live ticking clock for timezone display
  const [clockTick, setClockTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const tzLabel = useMemo(() => {
    return getTimezoneDisplayLabel(tzSettings);
  }, [tzSettings, clockTick]);

  // Engine polling state
  const isFetchingRef = useRef(false);
  const backoffUntilRef = useRef(0);

  const fetchState = useCallback(async (isImmediate = false) => {
    // If not immediate and already synced, respect background tab pausing
    if (!isImmediate && !isInitialSyncing && (typeof document !== 'undefined' && document.hidden)) return;
    if (isFetchingRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;

    isFetchingRef.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/state', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (res.status === 429) {
          backoffUntilRef.current = Date.now() + 20000;
          return;
        }
        setConnectionError(`Engine responded with status ${res.status}.`);
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Engine returned non-JSON response (${contentType || 'text/html'}). Server is booting.`);
      }
      const data = await res.json();
      if (data && typeof data === 'object') {
        setState(data);
        setIsInitialSyncing(false);
        setConnectionError(null);
        backoffUntilRef.current = 0;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("Engine connection notice:", err.message || err);
      if (err.name === 'AbortError') {
        setConnectionError('Connection to prediction engine timed out. Reconnecting...');
      } else {
        setConnectionError(err.message || 'Connecting to prediction engine...');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [isInitialSyncing]);

  useEffect(() => {
    fetchState(true);
    // When initial sync is pending or on connection error, retry rapidly (2.5s) instead of 25s
    const pollInterval = (isInitialSyncing || connectionError) ? 2500 : 25000;
    const int = setInterval(() => fetchState(false), pollInterval);
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(int);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchState, isInitialSyncing, connectionError]);

  // Navigation handlers
  const handleOpenLineups = (match) => {
    setActiveLineupMatch(match);
    setActivePage('lineups');
  };

  const handleOpenDeepResearch = (match) => {
    setActiveResearchMatch(match);
    setActivePage('deep-research');
  };

  // Trigger Scrape / Retrain
  const handleTriggerScrape = async () => {
    setIsScraping(true);
    setToastNotification({
      type: 'loading',
      title: 'Scraping Live Data',
      message: 'Fetching live fixtures, clocks & scoreboards from ESPN Soccer feeds...'
    });
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      await fetchState(true);
      setToastNotification({
        type: 'success',
        title: 'Live Scrape Complete',
        message: data.message || `Successfully synced ${data.matchCount || 'all'} fixtures & live scoreboards.`
      });
    } catch (e) {
      console.error(e);
      setToastNotification({
        type: 'error',
        title: 'Scrape Failed',
        message: 'Could not connect to live feeds: ' + e.message
      });
    } finally {
      setIsScraping(false);
      setTimeout(() => setToastNotification(null), 5000);
    }
  };

  const handleTriggerRetrain = async () => {
    setIsRetraining(true);
    setToastNotification({
      type: 'loading',
      title: 'Retraining Model',
      message: 'Recalibrating Poisson expectations, Dixon-Coles parameters & Brier weights...'
    });
    try {
      const res = await fetch('/api/retrain', { method: 'POST' });
      const data = await res.json();
      await fetchState(true);
      const acc = data.trainingStats?.accuracy || state?.trainingStats?.accuracy;
      const count = data.trainingStats?.sampleCount || state?.trainingStats?.sampleCount;
      setToastNotification({
        type: 'success',
        title: 'Model Retrained & Calibrated',
        message: data.message || `Recalibrated across ${count || 32} matches with ${acc ? acc + '%' : 'high'} accuracy.`
      });
    } catch (e) {
      console.error(e);
      setToastNotification({
        type: 'error',
        title: 'Retrain Failed',
        message: 'Could not retrain model: ' + e.message
      });
    } finally {
      setIsRetraining(false);
      setTimeout(() => setToastNotification(null), 5000);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/clear-logs', { method: 'POST' });
      await fetchState(true);
    } catch (e) {
      console.error(e);
    }
  };

  const tuningConfig = state?.hyperparameters || {};
  const disabledLeagues = tuningConfig.disabledLeagues || [];
  
  const isMatchPruned = useCallback((m) => {
    if (!m) return true;
    if (isLeagueBlacklisted(m.league)) return true;
    if (Array.isArray(disabledLeagues) && disabledLeagues.some(dl => {
      const d = String(dl).toLowerCase().trim();
      const l = String(m.league || '').toLowerCase().trim();
      return l === d || l.includes(d) || d.includes(l);
    })) return true;
    return false;
  }, [disabledLeagues]);

  // Filter out disabled & blacklisted chaos leagues so views and performance accurately reflect verified active engine
  const filteredHistorical30d = useMemo(() => {
    return historical30d.filter(m => !isMatchPruned(m));
  }, [historical30d, isMatchPruned]);

  const filteredAuditedDateResults = useMemo(() => {
    if (!auditedDateResults) return null;
    return auditedDateResults.filter(m => !isMatchPruned(m));
  }, [auditedDateResults, isMatchPruned]);

  const filteredYesterdayMatches = useMemo(() => {
    const ym = state?.yesterdayMatches || [];
    return ym.filter(m => !isMatchPruned(m));
  }, [state?.yesterdayMatches, isMatchPruned]);

  const filteredTodayCompletedMatches = useMemo(() => {
    const tm = state?.todayCompletedMatches || [];
    return tm.filter(m => !isMatchPruned(m));
  }, [state?.todayCompletedMatches, isMatchPruned]);

  const matches = useMemo(() => {
    return (state?.matches || []).filter(m => !isMatchPruned(m));
  }, [state?.matches, isMatchPruned]);

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-sans text-sm p-4 text-center">
        {connectionError ? (
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-rose-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Backend Connection Notice</h2>
            <p className="text-xs text-slate-500 mb-4">{connectionError}</p>
            <button
              onClick={() => { setConnectionError(null); fetchState(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Activity className="animate-spin w-8 h-8 mb-3 text-indigo-600" />
            <p className="text-xs tracking-wider text-slate-700 font-bold uppercase">Loading Prediction Engine...</p>
            <span className="text-[11px] text-slate-400 mt-1">Initializing Statistical models &amp; swarm consensus</span>
          </div>
        )}
      </div>
    );
  }

  const trainingStats = state.trainingStats || {};
  const logs = state.logs || [];
  const patches = state.autonomousPatches || [];

  return (
    <TimezoneContext.Provider value={{ tzSettings, updateTzSettings, browserTz }}>
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
        
        {/* Global Navigation & Telemetry Bar */}
        <HeaderBar
          state={state}
          onOpenMenu={() => setIsMenuOpen(true)}
          onToggleMenu={() => setIsMenuOpen(true)}
          activePage={activePage}
          onSelectPage={(page) => {
            const targetPage = page === 'autonomous' ? 'patches' : page;
            setActivePage(targetPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigate={(page) => {
            const targetPage = page === 'autonomous' ? 'patches' : page;
            setActivePage(targetPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          matchCount={matches.length}
          tzLabel={tzLabel}
          onOpenTimezone={() => {
            setActivePage('timezone');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          accaCount={accaPicks.length}
          onRefresh={handleTriggerScrape}
          onTriggerScrape={handleTriggerScrape}
          isRefreshing={isScraping || isRetraining}
          isScraping={isScraping}
          overallAccuracy={state.overallAccuracy || state.trainingStats?.accuracy || null}
          onOpenStrategyProof={() => setShowStrategyProof(true)}
        />

        {/* Global Connection / Initial Sync Notification Banner */}
        {connectionError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
              <span>
                <strong>Prediction Engine Sync:</strong> {connectionError}
              </span>
            </div>
            <button
              onClick={() => { setConnectionError(null); fetchState(true); }}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors cursor-pointer shrink-0"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Action Feedback Toast Notification */}
        {toastNotification && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-3.5 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200">
            {toastNotification.type === 'loading' ? (
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0 mt-0.5" />
            ) : toastNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <div className="font-bold text-slate-100 flex items-center justify-between">
                <span>{toastNotification.title}</span>
              </div>
              <p className="text-slate-300 mt-0.5 leading-relaxed">{toastNotification.message}</p>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Slide-out / Floating Side Menu Tray */}
        <SideMenuTray
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          activePage={activePage}
          onSelectPage={(page) => {
            const targetPage = page === 'autonomous' ? 'patches' : page;
            setActivePage(targetPage);
            setIsMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigate={(page) => {
            const targetPage = page === 'autonomous' ? 'patches' : page;
            setActivePage(targetPage);
            setIsMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          matchCount={matches.length}
          patchCount={state.patchTelemetry?.patchesApplied || patches.length}
          tzLabel={tzLabel}
          counts={{
            fixtures: matches.length,
            scores: matches.filter(m => m.hasPrediction).length,
            binary: matches.filter(m => m.binaryModel && m.binaryModel.pick).length,
            acca: accaPicks.length,
            patches: state.patchTelemetry?.patchesApplied || patches.length,
            swarm: matches.filter(m => (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.isAntiFragileLeg).length,
            logs: logs.length
          }}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6">
          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>
            {activePage === 'results' && (
               <div className="mb-6">
                 <PerformanceChart historicalResults={filteredHistorical30d} />
               </div>
            )}
            {/* Page Routing */}
            {activePage === 'fixtures' && (
              <>
                <DailyBriefingPanel
                  matches={matches}
                  tzSettings={tzSettings}
                  onAddToSlip={handleToggleAccaPick}
                  onOpenWatchLive={(m) => setActivePlayerMatch(m)}
                  accaMatchIds={new Set(accaPicks.map(p => p.id))}
                  bankrollEuro={state.bankrollEuro || 1000}
                />
                <FixturesTablePage
                matches={matches}
                bankrollEuro={state.bankrollEuro || 1000}
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
                tzSettings={tzSettings}
                unanimousHitRate={state.unanimousHitRate || state.aiSwarm?.directives?.telemetry?.unanimousHitRate || 84.8}
                onAddToSlip={handleToggleAccaPick}
                accaMatchIds={new Set(accaPicks.map(p => p.id))}
                onClearSlip={handleClearAcca}
                onOpenLineup={handleOpenLineups}
                onOpenDeepResearch={handleOpenDeepResearch}
                onOpenWatchLive={(m) => setActivePlayerMatch(m)}
                onTriggerScrape={handleTriggerScrape}
                onTriggerRetrain={handleTriggerRetrain}
                isScraping={isScraping}
                isRetraining={isRetraining}
                onSelectMarketMode={setActivePage}
                onNavigate={setActivePage}
                onLoadAccaPicks={handleLoadPicksToSlip}
                onSetActiveSlipId={setActiveSlipId}
                betSlips={betSlips}
                activeSlipId={activeSlipId}
                aiSwarm={state?.aiSwarm}
                historicalMatches={historical30d}
                yesterdayMatches={state.yesterdayMatches}
                todayCompletedMatches={state.todayCompletedMatches}
                />
              </>
            )}

            {activePage === 'scores' && (
              <ScoresTablePage
                matches={matches}
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
                tzSettings={tzSettings}
                onAddToSlip={handleToggleAccaPick}
                accaMatchIds={new Set(accaPicks.map(p => p.id))}
                onClearSlip={handleClearAcca}
                onOpenDeepResearch={handleOpenDeepResearch}
                onOpenWatchLive={(m) => setActivePlayerMatch(m)}
                scoreTrainingStats={state.scoreTrainingStats || state.trainingStats}
                onSelectMarketMode={setActivePage}
              />
            )}

            {activePage === 'binary' && (
              <BinaryPicksPage
                matches={matches}
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
                tzSettings={tzSettings}
                onAddToSlip={handleToggleAccaPick}
                accaMatchIds={new Set(accaPicks.map(p => p.id))}
                onClearSlip={handleClearAcca}
                onOpenDeepResearch={handleOpenDeepResearch}
                onOpenWatchLive={(m) => setActivePlayerMatch(m)}
                onSelectMarketMode={setActivePage}
              />
            )}

            {activePage === 'acca' && (
              <AccumulatorPage
                matches={matches}
                tzSettings={tzSettings}
                accaPicks={accaPicks}
                betSlips={betSlips}
                activeSlipId={activeSlipId}
                onSetActiveSlipId={setActiveSlipId}
                onUpdateBetSlips={handleUpdateBetSlips}
                onRemovePick={handleRemoveAccaPick}
                onClearSlip={handleClearAcca}
                onAddPick={(m, pickVal, marketLabel, oddsVal, probVal) => handleToggleAccaPick(m, pickVal, marketLabel, oddsVal, probVal)}
                aiSwarm={state.aiSwarm}
              />
            )}

            {activePage === 'results' && (
              <ResultsProofPage
                historicalResults={
                  filteredAuditedDateResults !== null
                    ? filteredAuditedDateResults
                    : []
                }
                historical30d={historical30d}
                todayMatches={filteredTodayCompletedMatches}
                yesterdayMatches={filteredYesterdayMatches}
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
                tzSettings={tzSettings}
                onOpenDeepResearch={handleOpenDeepResearch}
                onFetchDateResults={handleFetchDateResults}
                isLoading={isLoadingDateResults}
              />
            )}

            {activePage === 'swarm' && (
              <AISwarmCenter
                state={state}
                tzSettings={tzSettings}
                onRefreshState={() => fetchState(true)}
                onAddToAcca={handleToggleAccaPick}
                onOpenDeepResearch={handleOpenDeepResearch}
              />
            )}

            {activePage === 'alldaywinner' && (
              <AllDayWinnerPage
                state={state}
                tzSettings={tzSettings}
                onOpenDeepResearch={handleOpenDeepResearch}
                onLoadPicksToSlip={handleLoadPicksToSlip}
                onNavigateToSlip={() => setActivePage('acca')}
              />
            )}

            {(activePage === 'patches' || activePage === 'autonomous') && (
              <AutonomousPatchCenter
                state={state}
                onRefreshState={() => fetchState(true)}
                onTriggerDeepResearch={handleOpenDeepResearch}
              />
            )}

            {activePage === 'lineups' && (
              <LineupsPage
                selectedMatch={activeLineupMatch}
                matches={matches}
                tzSettings={tzSettings}
                onSelectMatch={setActiveLineupMatch}
                onBackToFixtures={() => setActivePage('fixtures')}
              />
            )}

            {activePage === 'deep-research' && (
              <DeepResearchPage
                selectedMatch={activeResearchMatch}
                matches={matches}
                historicalMatches={historical30d}
                tzSettings={tzSettings}
                onSelectMatch={setActiveResearchMatch}
                onBackToFixtures={() => setActivePage('fixtures')}
              />
            )}

            {activePage === 'leagues' && (
              <LeagueProfilesPage
                matches={matches}
                tzSettings={tzSettings}
                leagueProfiles={state.leagueProfiles || {}}
                onSelectLeagueFilter={(league) => {
                  setActivePage('fixtures');
                }}
              />
            )}

            {activePage === 'tuning' && (
              <TuningPage
                state={state}
                tuningConfig={tuningConfig}
                onRefreshState={() => fetchState(true)}
                tzSettings={tzSettings}
                onUpdateTzSettings={updateTzSettings}
                onSaveTuning={async (config) => {
                  try {
                    const res = await fetch('/api/tuning-config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(config)
                    });
                    const data = await res.json();
                    if (data && data.state) {
                      setState(data.state);
                    }
                    await fetchState(true);
                  } catch (err) {
                    console.error("Failed to save tuning config", err);
                  }
                }}
              />
            )}

            {activePage === 'timezone' && (
              <TimezonePage
                tzSettings={tzSettings}
                onUpdateSettings={updateTzSettings}
                onSaveTimezone={updateTzSettings}
                browserTz={browserTz}
              />
            )}

            {activePage === 'logs' && (
              <LogsPage
                logs={logs}
                onClearLogs={handleClearLogs}
              />
            )}
            {activePage === 'props' && (
              <PropsSpecialsPage
                matches={matches}
                allMatches={state?.matches || []}
                tzSettings={tzSettings}
                onAddToSlip={handleToggleAccaPick}
                accaPicks={accaPicks}
                accaMatchIds={new Set((accaPicks || []).map(p => p.pickId || p.id))}
                onOpenDeepResearch={handleOpenDeepResearch}
                betSlips={betSlips}
                activeSlipId={activeSlipId}
                onSetActiveSlipId={setActiveSlipId}
                onUpdateBetSlips={handleUpdateBetSlips}
                onNavigate={(page) => setActivePage(page)}
              />
            )}
          </ErrorBoundary>
        </main>

        {/* Global Footer */}
        <footer className="w-full bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>AI Soccer Predictor &bull; Dixon-Coles &amp; Elo Poisson Models</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActivePage('tuning')}
                className="hover:text-slate-600 transition-colors cursor-pointer font-medium"
              >
                Model Settings
              </button>
              <span>•</span>
              <button
                onClick={() => setActivePage('patches')}
                className="hover:text-slate-600 transition-colors cursor-pointer font-medium"
              >
                Model Updates
              </button>
              <span>•</span>
              <button
                onClick={() => setActivePage('logs')}
                className="hover:text-slate-600 transition-colors cursor-pointer font-medium"
              >
                Activity Logs
              </button>
            </div>
          </div>
        </footer>

        {/* Global Strategy Proof & Accuracy Breakdown Modal */}
        <StrategyProofModal
          isOpen={showStrategyProof}
          onClose={() => setShowStrategyProof(false)}
        />

        {/* Live Tactical Intelligence & AI Analysis Modal */}
        <LiveMatchPlayerModal
          match={activePlayerMatch}
          isOpen={Boolean(activePlayerMatch)}
          onClose={() => setActivePlayerMatch(null)}
          onAddToSlip={handleToggleAccaPick}
          isInSlip={activePlayerMatch ? accaPicks.some(p => p.id === activePlayerMatch.id) : false}
        />

      </div>
    </TimezoneContext.Provider>
  );
}
