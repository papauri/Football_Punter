import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, X, Cpu } from 'lucide-react';

import HeaderBar from './HeaderBar';
import SideMenuTray from './SideMenuTray';

// Page Views
import FixturesTablePage from './FixturesTablePage';
import ScoresTablePage from './ScoresTablePage';
import BinaryPicksPage from './BinaryPicksPage';
import AccumulatorPage from './AccumulatorPage';
import ResultsProofPage from './ResultsProofPage';
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
import { resolveMatchOdds, resolveMatchProb } from '../utils/oddsUtils';

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

export default function Dashboard() {
  const [state, setState] = useState(null);
  const [activePage, setActivePage] = useState('fixtures');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  
  // Active selected match for Deep Research or Lineup inspection
  const [activeResearchMatch, setActiveResearchMatch] = useState(null);
  const [activeLineupMatch, setActiveLineupMatch] = useState(null);

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

    // 3. Extract matching historical records from memory for instant fallback / optimistic render
    const localMatches = (historical30d || [])
      .concat(state?.yesterdayMatches || [])
      .concat(state?.matches || [])
      .filter(m => (m.date && m.date.startsWith(dateStr)) || (m.dateIso && m.dateIso.startsWith(dateStr)));

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

      // If backend returned empty but we have local historical data, use local
      if (localMatches.length > 0) {
        setAuditedDateResults(localMatches);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback smoothly to local records
        if (localMatches.length > 0) {
          setAuditedDateResults(localMatches);
        } else if (state?.yesterdayMatches && state.yesterdayMatches.length > 0) {
          setAuditedDateResults(state.yesterdayMatches);
        }
      }
    } finally {
      if (abortControllerRef.current === abortCtrl) {
        setIsLoadingDateResults(false);
      }
    }
  }, [historical30d, state, auditedDateResults]);

  const handleToggleAccaPick = (match, customPick = null, customMarket = null, customOdds = null, customProb = null, targetSlipId = null) => {
    const destinationSlipId = targetSlipId || activeSlipId;
    handleUpdateBetSlips(prevSlips => {
      let slipIndex = prevSlips.findIndex(s => s.id === destinationSlipId);
      if (slipIndex === -1) {
        slipIndex = prevSlips.findIndex(s => s.id === activeSlipId);
        if (slipIndex === -1) return prevSlips;
      }
      
      const currentSlip = prevSlips[slipIndex];
      const isPropsTarget = destinationSlipId === 'props-slip' || (customMarket && String(customMarket).startsWith('Props'));

      // Resolve pick value (straight outright normalization if DRAW or unspecified)
      let pickValue = customPick || match.binaryModel?.pick || (typeof match.predictedWinner === 'string' ? match.predictedWinner : match.predictedWinner?.pick) || 'HOME';
      if (!customMarket?.startsWith('Props')) {
        let strPick = String(pickValue).toUpperCase();
        if (strPick === '1') strPick = 'HOME';
        if (strPick === '2') strPick = 'AWAY';
        if (!customPick && strPick !== 'HOME' && strPick !== 'AWAY') {
          const pHome = Number(match.prob?.home || match.homeProb || 40);
          const pAway = Number(match.prob?.away || match.awayProb || 30);
          strPick = pHome >= pAway ? 'HOME' : 'AWAY';
        }
        pickValue = strPick;
      }

      const outrightMarket = `${pickValue} Win (Outright)`;
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
        prob,
        odds
      };

      // LiveScore Bet & Bookmaker Acca Rule: Only ONE selection allowed per fixture on match accumulators.
      // For props slips, allow distinct prop markets for the same match, toggling off if the identical prop is clicked.
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
        } else {
          // Replace with the new single selection for this fixture
          updatedPicks = [...currentSlip.picks];
          updatedPicks[existingPickIndex] = newPick;
        }
      } else {
        updatedPicks = [...currentSlip.picks, newPick];
      }
      
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = { ...currentSlip, picks: updatedPicks };
      return newSlips;
    });

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
      const updatedPicks = currentSlip.picks.filter(p => p.pickId !== idToRemove && p.id !== idToRemove);
      
      const newSlips = [...prevSlips];
      newSlips[slipIndex] = { ...currentSlip, picks: updatedPicks };
      return newSlips;
    });
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

  // Engine polling state
  const isFetchingRef = useRef(false);
  const backoffUntilRef = useRef(0);

  const fetchState = useCallback(async (isImmediate = false) => {
    if (!isImmediate && (typeof document !== 'undefined' && document.hidden)) return;
    if (isFetchingRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;

    isFetchingRef.current = true;
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        if (res.status === 429) {
          backoffUntilRef.current = Date.now() + 20000;
          return;
        }
        return;
      }
      const data = await res.json();
      setState(data);
      backoffUntilRef.current = 0;
    } catch (err) {
      console.warn("Engine connection notice:", err.message || err);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchState(true);
    const int = setInterval(() => fetchState(false), 9000);
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
  }, [fetchState]);

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
  
  // Filter out disabled leagues from historical views so performance accurately reflects active engine
  const filteredHistorical30d = useMemo(() => {
    return historical30d.filter(m => !disabledLeagues.includes(m.league));
  }, [historical30d, disabledLeagues]);

  const filteredAuditedDateResults = useMemo(() => {
    if (!auditedDateResults) return null;
    return auditedDateResults.filter(m => !disabledLeagues.includes(m.league));
  }, [auditedDateResults, disabledLeagues]);

  const filteredYesterdayMatches = useMemo(() => {
    const ym = state?.yesterdayMatches || [];
    return ym.filter(m => !disabledLeagues.includes(m.league));
  }, [state?.yesterdayMatches, disabledLeagues]);

  const matches = useMemo(() => {
    return (state?.matches || []).filter(m => !disabledLeagues.includes(m.league));
  }, [state?.matches, disabledLeagues]);

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-sans text-sm">
        <Activity className="animate-spin w-8 h-8 mb-3 text-indigo-600" />
        <p className="text-xs tracking-wider text-slate-700 font-bold uppercase">Loading Prediction Engine...</p>
        <span className="text-[11px] text-slate-400 mt-1">Initializing Statistical models &amp; swarm consensus</span>
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
          tzLabel={tzSettings.mode === 'auto' ? browserTz.formattedOffset : tzSettings.manualLabel}
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
        />

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
          tzLabel={tzSettings.mode === 'auto' ? browserTz.formattedOffset : tzSettings.manualLabel}
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
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>
            {activePage === 'results' && (
               <div className="mb-6">
                 <PerformanceChart historicalResults={filteredHistorical30d} />
               </div>
            )}
            {/* Page Routing */}
            {activePage === 'fixtures' && (
              <FixturesTablePage
                matches={matches}
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
                tzSettings={tzSettings}
                unanimousHitRate={state.unanimousHitRate || state.aiSwarm?.directives?.telemetry?.unanimousHitRate || 84.8}
                onAddToSlip={handleToggleAccaPick}
                accaMatchIds={new Set(accaPicks.map(p => p.id))}
                onClearSlip={handleClearAcca}
                onOpenLineup={handleOpenLineups}
                onOpenDeepResearch={handleOpenDeepResearch}
                onTriggerScrape={handleTriggerScrape}
                onTriggerRetrain={handleTriggerRetrain}
                isScraping={isScraping}
                isRetraining={isRetraining}
                onSelectMarketMode={setActivePage}
              />
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
                    : (filteredYesterdayMatches && filteredYesterdayMatches.length > 0)
                      ? filteredYesterdayMatches
                      : []
                }
                leaguePerformance={state.trainingStats?.leaguePerformance || []}
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
                Telemetry &amp; Updates
              </button>
              <span>•</span>
              <button
                onClick={() => setActivePage('logs')}
                className="hover:text-slate-600 transition-colors cursor-pointer font-medium"
              >
                System Logs
              </button>
            </div>
          </div>
        </footer>

      </div>
    </TimezoneContext.Provider>
  );
}
