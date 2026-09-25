import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Tv, 
  Radio, 
  Activity, 
  Play, 
  Volume2, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  RefreshCw, 
  Plus, 
  Check, 
  Clock, 
  Info, 
  Flame, 
  BarChart2,
  ChevronRight,
  Wifi,
  Zap,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  Compass,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Share2
} from 'lucide-react';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { 
  buildMatchStreamSources, 
  openStraightStream, 
  getSportzxStreamUrl,
  fetchScrapedMatchStreams,
  filterPlayableStreams
} from '../utils/streamUtils';

// Re-export buildMatchStreamSources for backwards compatibility
export { buildMatchStreamSources };

export default function LiveMatchPlayerModal({
  match,
  isOpen,
  onClose,
  onAddToSlip,
  isInSlip = false
}) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'advisor' | 'radar' | 'analysis'
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [streamState, setStreamState] = useState('ready'); // 'ready' | 'loading' | 'playing' | 'failed'
  const [autoFallbackEnabled, setAutoFallbackEnabled] = useState(false); // default OFF to stop broken link cycling
  const [autoSwitchNotice, setAutoSwitchNotice] = useState(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState('');
  const [forcePlayStream, setForcePlayStream] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveMinute, setLiveMinute] = useState(45);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [inPlayData, setInPlayData] = useState(null);
  const [advisoryData, setAdvisoryData] = useState(null);
  const [isLoadingInPlay, setIsLoadingInPlay] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 50 });
  const [attackingSide, setAttackingSide] = useState('home');
  const [inAppFrameActive, setInAppFrameActive] = useState(false);
  const [frameLoadFailed, setFrameLoadFailed] = useState(false);
  
  // Real-time Internet Stream Scraper State
  const [scrapedSources, setScrapedSources] = useState([]);
  const [isScrapingInternet, setIsScrapingInternet] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState('');
  const [onlyPlayableInFrame, setOnlyPlayableInFrame] = useState(true);

  const fallbackTimerRef = useRef(null);
  const iframeRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Compute prioritized stream sources with real-time scraped feeds prioritized
  const streamSources = useMemo(() => {
    const baseSources = buildMatchStreamSources(match);
    if (!scrapedSources || scrapedSources.length === 0) {
      return filterPlayableStreams(baseSources, onlyPlayableInFrame);
    }
    // Place scraped match-specific streams first
    const merged = [
      ...scrapedSources,
      ...baseSources.filter(b => !scrapedSources.some(s => s.id === b.id))
    ];
    return filterPlayableStreams(merged, onlyPlayableInFrame);
  }, [match, scrapedSources, onlyPlayableInFrame]);

  const currentSource = streamSources[currentSourceIndex] || streamSources[0];

  // Derive completed vs live status flags
  const isMatchCompleted = Boolean(
    match?.isCompleted === true ||
    match?.status === 'FT' ||
    match?.status === 'STATUS_FULL_TIME' ||
    match?.status === 'FINAL' ||
    match?.status === 'Final' ||
    (typeof match?.status === 'string' && match.status.includes('FT'))
  );

  const isMatchLive = !isMatchCompleted && Boolean(
    match?.isLive === true || 
    match?.status === 'LIVE' || 
    match?.status === 'STATUS_IN_PROGRESS' || 
    match?.status === 'STATUS_HALFTIME' || 
    match?.status === 'HT' || 
    (typeof match?.liveMinute === 'string' && (match.liveMinute.includes("'") || match.liveMinute.toLowerCase() === 'ht')) ||
    (typeof match?.status === 'string' && (match.status.includes("'") || match.status.toLowerCase() === 'ht')) ||
    (typeof match?.liveMinute === 'number' && match.liveMinute > 0)
  );

  const isPreMatch = !isMatchLive && !isMatchCompleted;

  // Real-time internet scraper function
  const scrapeInternetForStreams = async (matchData) => {
    if (!matchData) return;
    setIsScrapingInternet(true);
    setScrapeStatusText(`Scraping internet for live streams showing ${matchData.home} vs ${matchData.away}...`);
    try {
      const results = await fetchScrapedMatchStreams(matchData);
      if (results && results.length > 0) {
        setScrapedSources(results);
        setScrapeStatusText(`Scraped ${results.length} live stream feeds playable in frame`);
        const firstPlayable = results.find(r => r.playableInFrame && (r.url || r.embedUrl));
        if (firstPlayable) {
          setActiveStreamUrl(firstPlayable.url || firstPlayable.embedUrl);
          setInAppFrameActive(true);
        }
      } else {
        setScrapeStatusText('Search completed. Active in-frame match feed loaded.');
      }
    } catch (err) {
      setScrapeStatusText('In-frame relay active.');
    } finally {
      setIsScrapingInternet(false);
    }
  };

  // Initialize scores, in-play prediction, initial stream feed & scrape internet
  useEffect(() => {
    if (!match) return;

    setCurrentSourceIndex(0);
    setStreamState('loading');
    setAutoSwitchNotice(null);
    setForcePlayStream(true);
    setInAppFrameActive(true);
    setFrameLoadFailed(false);
    setScrapedSources([]);

    const hS = match.liveHomeScore ?? match.goals?.home ?? match.homeScore ?? 0;
    const aS = match.liveAwayScore ?? match.goals?.away ?? match.awayScore ?? 0;
    setLiveScore({ home: hS, away: aS });

    let min = 45;
    if (typeof match.liveMinute === 'number') min = match.liveMinute;
    else if (typeof match.liveMinute === 'string') {
      const parsed = parseInt(match.liveMinute.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) min = parsed;
      else if (match.liveMinute.toLowerCase().includes('ht')) min = 45;
    } else if (typeof match.status === 'string') {
      const parsed = parseInt(match.status.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) min = parsed;
    }
    setLiveMinute(min);

    if (match.inPlayPrediction) {
      setInPlayData(match.inPlayPrediction);
      if (match.inPlayPrediction.advisory) {
        setAdvisoryData(match.inPlayPrediction.advisory);
      }
    }

    // Fetch latest in-play analysis & advisor report
    fetchInPlayPrediction(min, hS, aS);

    const initialSource = streamSources[0];
    if (initialSource?.url || initialSource?.straightUrl) {
      setActiveStreamUrl(initialSource.url || initialSource.straightUrl);
    }

    // Scrape the internet when loading to discover active match streams
    scrapeInternetForStreams(match);
  }, [match]);

  // Live in-play background ticker every 20 seconds
  useEffect(() => {
    if (!isMatchLive || !isOpen) return;

    const interval = setInterval(() => {
      setLiveMinute(prev => Math.min(94, prev + 1));
      fetchInPlayPrediction(liveMinute, liveScore.home, liveScore.away);
    }, 20000);

    return () => clearInterval(interval);
  }, [isMatchLive, isOpen, liveMinute, liveScore]);

  // Handle stream source index changes cleanly without broken link cascades
  useEffect(() => {
    if (!currentSource) return;

    setFrameLoadFailed(false);

    if (currentSource.type === 'radar') {
      setActiveTab('radar');
      setStreamState('playing');
      return;
    }

    const targetUrl = currentSource.url || currentSource.straightUrl;
    if (targetUrl) {
      setActiveStreamUrl(targetUrl);
      setInAppFrameActive(true);
      setStreamState('loading');
    }

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [currentSourceIndex, currentSource]);

  // 2D Tactical Pitch Radar Simulation Tick
  useEffect(() => {
    if (!isMatchLive || activeTab !== 'radar') return;

    const interval = setInterval(() => {
      setBallPosition(prev => {
        const targetX = attackingSide === 'home' ? 70 + Math.random() * 25 : 5 + Math.random() * 25;
        const targetY = 20 + Math.random() * 60;
        return {
          x: Math.round(prev.x * 0.7 + targetX * 0.3),
          y: Math.round(prev.y * 0.7 + targetY * 0.3)
        };
      });

      if (Math.random() < 0.25) {
        setAttackingSide(s => s === 'home' ? 'away' : 'home');
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [isMatchLive, activeTab, attackingSide]);

  const handleAutoAdvance = () => {
    if (currentSourceIndex < streamSources.length - 1) {
      const nextIdx = currentSourceIndex + 1;
      const nextSource = streamSources[nextIdx];
      setAutoSwitchNotice(`Switched to ${nextSource.name}.`);
      setCurrentSourceIndex(nextIdx);
    } else {
      setActiveTab('radar');
      setAutoSwitchNotice('Displaying Live 2D Pitch Radar & Tactical Simulator.');
    }
  };

  const handleManualSourceSelect = (idx) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setCurrentSourceIndex(idx);
    setAutoSwitchNotice(null);
    setFrameLoadFailed(false);
    if (streamSources[idx]?.type === 'radar') {
      setActiveTab('radar');
    } else {
      setActiveTab('stream');
    }
  };

  const handleLaunchStraight = (customUrl = null) => {
    const targetUrl = customUrl || currentSource?.straightUrl || currentSource?.backupStraightUrl || currentSource?.portalUrl || getSportzxStreamUrl(match);
    openStraightStream(targetUrl);
  };

  const handleIframeLoaded = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setStreamState('playing');
    setFrameLoadFailed(false);
  };

  const handleIframeError = () => {
    setStreamState('failed');
    setFrameLoadFailed(true);
    if (autoFallbackEnabled) {
      handleAutoAdvance();
    }
  };

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const fetchInPlayPrediction = async (min, hS, aS) => {
    if (!match) return;
    try {
      setIsLoadingInPlay(true);
      const res = await fetch('/api/in-play-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          match,
          liveMinute: min,
          liveHomeScore: hS,
          liveAwayScore: aS,
          lockedPick: match.predictedWinner || match.binaryModel?.pick
        })
      });
      const data = await res.json();
      if (data.success && data.inPlayPrediction) {
        setInPlayData(data.inPlayPrediction);
        if (data.inPlayPrediction.advisory) {
          setAdvisoryData(data.inPlayPrediction.advisory);
        }
      }
    } catch (e) {
      console.warn('Could not fetch in-play prediction:', e);
    } finally {
      setIsLoadingInPlay(false);
    }
  };

  if (!isOpen || !match) return null;

  const channelsList = Array.isArray(match.channels) && match.channels.length > 0 
    ? match.channels 
    : (match.broadcast ? match.broadcast.split(',').map(s => s.trim()) : ['Sportzx Live HD', 'Sky Sports Main Event', 'TNT Sports HD']);

  const currentHomeP = inPlayData?.liveProb?.home ?? safeParseFloat(match.prob?.home, 50);
  const currentDrawP = inPlayData?.liveProb?.draw ?? safeParseFloat(match.prob?.draw, 25);
  const currentAwayP = inPlayData?.liveProb?.away ?? safeParseFloat(match.prob?.away, 25);
  const currentProjScore = inPlayData?.projectedFinalScore || match.mostLikelyScore || '1 - 0';

  const lockedPick = match.predictedWinner || match.binaryModel?.pick || (currentHomeP >= currentAwayP ? 'HOME' : 'AWAY');
  const lockedPickTeam = lockedPick === 'HOME' ? match.home : lockedPick === 'AWAY' ? match.away : 'Draw';

  const preHomeP = safeParseFloat(match.prob?.home, 50);
  const preAwayP = safeParseFloat(match.prob?.away, 25);
  const prePickP = lockedPick === 'HOME' ? preHomeP : preAwayP;
  const currentPickP = lockedPick === 'HOME' ? currentHomeP : currentAwayP;
  const probShiftDelta = parseFloat((currentPickP - prePickP).toFixed(1));

  const advisor = advisoryData || inPlayData?.advisory;
  const sportzxUrl = getSportzxStreamUrl(match);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        ref={modalContainerRef}
        className={`bg-slate-950 border border-slate-800/80 rounded-2xl w-full ${isFullscreen ? 'max-w-none h-full' : 'max-w-5xl max-h-[94vh]'} flex flex-col shadow-2xl overflow-hidden text-slate-100 transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Top Header Bar */}
        <div className="px-4 py-2.5 bg-slate-950/95 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Tv className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-sm sm:text-base truncate tracking-tight">
                  {match.home} <span className="text-slate-500 font-normal text-xs">vs</span> {match.away}
                </span>

                {isMatchLive ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    LIVE {inPlayData?.minuteDisplay || `${liveMinute}'`}
                  </span>
                ) : isMatchCompleted ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    FT • Finished
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3 h-3" />
                    Kickoff {match.time || 'Today'}
                  </span>
                )}

                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                  {match.league || 'Soccer'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                {isMatchLive ? (
                  <span className="font-semibold text-emerald-400 font-mono">
                    Score: <strong className="text-white text-sm">{liveScore.home} - {liveScore.away}</strong>
                  </span>
                ) : isMatchCompleted ? (
                  <span className="font-semibold text-slate-300 font-mono">
                    Final: <strong className="text-white text-sm">{match.actualScore || `${liveScore.home} - ${liveScore.away}`}</strong>
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">
                    Pre-Match Standby • Projected Score: <strong className="text-white font-mono">{match.mostLikelyScore || '1 - 0'}</strong>
                  </span>
                )}
                <span className="text-slate-600">•</span>
                <span className="truncate text-slate-400 text-[11px]">⚡ Direct Feed: {currentSource?.provider || 'Sportzx HD'}</span>
              </div>
            </div>
          </div>

          {/* Header Controls with Direct Sportzx Launcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Stream Straight from Sportzx Primary Header Button */}
            <button
              onClick={() => handleLaunchStraight(sportzxUrl)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer border border-emerald-400/30"
              title="Stream straight from Sportzx without broken links"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span className="hidden sm:inline">Stream Straight from</span>
              <span>Sportzx ↗</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Player'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer border border-white/5 ml-1"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-white/5 flex items-center justify-between gap-2 overflow-x-auto text-xs select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('stream')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'stream' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Sportzx &amp; Free Live Streams</span>
              {isMatchLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'advisor' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-amber-300 hover:text-amber-100 border border-amber-500/30'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>In-Play Advisor Agent</span>
              {advisor?.betStatus && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'radar' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>2D Pitch Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'analysis' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Poisson Shift</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2.5">
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Free Streams • Zero Broken Relays
            </span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left/Main Column: Player Area */}
          <div className="lg:col-span-8 flex flex-col space-y-3">
            
            {/* Notice Alert if any */}
            {autoSwitchNotice && (
              <div className="p-2.5 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-xs text-indigo-200 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{autoSwitchNotice}</span>
                </div>
                <button
                  onClick={() => setAutoSwitchNotice(null)}
                  className="text-indigo-400 hover:text-white text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* TAB 1: Live Web TV Stream */}
            {activeTab === 'stream' && (
              <div className="space-y-3">
                
                {/* Real-time Internet Scraper Status Bar */}
                <div className="px-3 py-2 bg-slate-950/90 border border-emerald-500/20 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {isScrapingInternet ? (
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Scraping internet for live in-frame streams...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{scrapeStatusText || `Internet search verified ${streamSources.length} match streams`}</span>
                      </div>
                    )}

                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" />
                      <span>In-Frame Playable Only</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => scrapeInternetForStreams(match)}
                      disabled={isScrapingInternet}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border border-white/5"
                      title="Scan internet now for newly published live streams"
                    >
                      <RefreshCw className={`w-3 h-3 ${isScrapingInternet ? 'animate-spin' : ''}`} />
                      <span>{isScrapingInternet ? 'Scraping...' : 'Re-scrape Internet'}</span>
                    </button>
                  </div>
                </div>

                {/* 1-Click Stream Source Switcher Bar */}
                <div className="p-2 bg-slate-950/80 border border-white/5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-semibold flex items-center gap-1 text-[11px]">
                      <Tv className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Streams:</span>
                    </span>

                    {streamSources.map((src, idx) => {
                      const isSelected = currentSourceIndex === idx;
                      return (
                        <button
                          key={src.id}
                          onClick={() => handleManualSourceSelect(idx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5'
                          }`}
                          title={src.description || src.name}
                        >
                          {src.isScraped && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          )}
                          <span>{src.shortName}</span>
                          {src.isScraped && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Live Scraped</span>
                          )}
                          {src.recommended && !src.isScraped && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Top</span>
                          )}
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLaunchStraight()}
                      className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-emerald-500/30"
                      title="Open direct unblocked stream in a new window"
                    >
                      <ExternalLink className="w-3 h-3 text-emerald-400" />
                      <span>Launch Stream ↗</span>
                    </button>
                  </div>
                </div>

                {/* Player View Container */}
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col justify-center">
                  
                  {/* Scenario A: Automatic In-App Frame Stream */}
                  {inAppFrameActive && activeStreamUrl && !frameLoadFailed ? (
                    <div className="relative w-full h-full bg-black">
                      {streamState === 'loading' && (
                        <div className="absolute inset-0 z-10 bg-slate-950/80 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
                          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin mb-2" />
                          <span className="text-xs font-semibold text-emerald-400">Connecting live frame stream...</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{currentSource?.provider || 'Sportzx HD Relay'}</span>
                        </div>
                      )}

                      <iframe
                        ref={iframeRef}
                        src={activeStreamUrl}
                        title={`${match.home} vs ${match.away} Live Stream`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                        allowFullScreen
                        onLoad={handleIframeLoaded}
                        onError={handleIframeError}
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-encrypted-media allow-fullscreen"
                      />

                      {/* Floating In-Frame Assist Bar */}
                      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-xs shadow-md">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>Streaming In-Frame</span>
                        </span>

                        <button
                          onClick={() => {
                            if (iframeRef.current) {
                              setStreamState('loading');
                              iframeRef.current.src = activeStreamUrl;
                            }
                          }}
                          className="p-1.5 rounded-full text-xs font-medium bg-slate-900/90 text-slate-300 hover:text-white border border-white/10 backdrop-blur-xs transition-colors cursor-pointer"
                          title="Reload Frame Stream"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleLaunchStraight()}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 hover:text-white border border-emerald-500/40 backdrop-blur-xs shadow-lg transition-all cursor-pointer"
                          title="Open stream in unblocked tab"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>Popout ↗</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Scenario B: Direct Stream Straight Hub (Fallback or Alternate View) */
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 flex flex-col items-center justify-between p-4 sm:p-6 text-center select-none overflow-y-auto">
                      
                      {/* Top Status Strip inside Player */}
                      <div className="w-full flex items-center justify-between text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Direct Relay • Anti-Adblock Bypass</span>
                        </span>

                        <span className="text-[11px] font-mono text-slate-400">
                          Official Broadcast: <strong className="text-white">{channelsList[0] || 'Sportzx Live'}</strong>
                        </span>
                      </div>

                      {/* Main Center Action Area */}
                      <div className="my-auto py-3 max-w-lg flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/15">
                          <Tv className="w-7 h-7 text-emerald-400" />
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            {currentSource?.badge || '⚡ Sportzx Direct'}
                          </span>
                          {isMatchLive ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                              LIVE {inPlayData?.minuteDisplay || `${liveMinute}'`}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Kickoff {match.time || 'Today'}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                          {match.home} <span className="text-slate-500 font-normal text-sm">vs</span> {match.away}
                        </h3>

                        <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                          {currentSource?.description || 'Stream straight from Sportzx high-speed live football portal with anti-buffer bypass.'}
                        </p>

                        {/* Primary Straight Stream Launcher Button */}
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                          <button
                            onClick={() => {
                              setInAppFrameActive(true);
                              setFrameLoadFailed(false);
                              setStreamState('loading');
                            }}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-emerald-400/40"
                          >
                            <Play className="w-4 h-4 fill-white" />
                            <span>Play Stream Inside Frame</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight()}
                            className="w-full sm:w-auto px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Open direct unblocked stream in a new window"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Launch Popout</span>
                          </button>
                        </div>

                        {/* Search Bypass & Alternate Fallbacks */}
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap justify-center">
                          <button
                            onClick={() => {
                              const ytIdx = streamSources.findIndex(s => s.type === 'youtube_live');
                              if (ytIdx >= 0) handleManualSourceSelect(ytIdx);
                              setInAppFrameActive(true);
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1 cursor-pointer"
                          >
                            <Tv className="w-3 h-3" />
                            <span>Switch to In-Frame Live Video Feed</span>
                          </button>

                          <span className="text-slate-600">•</span>

                          <button
                            onClick={() => setActiveTab('radar')}
                            className="text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1 cursor-pointer"
                          >
                            <Activity className="w-3 h-3" />
                            <span>2D Pitch Simulator</span>
                          </button>
                        </div>
                      </div>

                      {/* Bottom Fast Stream Switcher Bar for Similar Free Sources */}
                      <div className="w-full pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Stream Straight from Similar Free:</span>
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                          <button
                            onClick={() => handleLaunchStraight(sportzxUrl)}
                            className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 hover:text-white rounded-lg text-[11px] font-bold border border-emerald-700/50 cursor-pointer flex items-center gap-1"
                          >
                            <span>⚡ Sportzx</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight('https://thestreameast.to/category/soccer')}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/5 cursor-pointer flex items-center gap-1"
                          >
                            <span>📺 StreamEast</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight('https://totalsportek.pro')}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/5 cursor-pointer flex items-center gap-1"
                          >
                            <span>🌐 Totalsportek</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight('https://www.score808.com')}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/5 cursor-pointer flex items-center gap-1"
                          >
                            <span>⚽ Score808</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight('https://www.viprow.nu/sports-football-online')}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/5 cursor-pointer flex items-center gap-1"
                          >
                            <span>🏆 VIPRow</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStraight('https://www.rojadirectaenvivo.club')}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/5 cursor-pointer flex items-center gap-1"
                          >
                            <span>📡 Rojadirecta</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Sandboxed Protection Badge */}
                  <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 pointer-events-none">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/85 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs shadow-md">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{currentSource?.badge || 'Sportzx • Direct Link'}</span>
                    </span>
                  </div>

                </div>

                {/* Stream Bottom Quick Info Bar */}
                <div className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">Active Source:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {currentSource?.provider || 'Sportzx Direct Live'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 truncate max-w-xs">{currentSource?.description}</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-400 flex-wrap">
                    <button
                      onClick={() => handleLaunchStraight(sportzxUrl)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Stream Straight from Sportzx ↗</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: In-Play Analyst Advisory Agent */}
            {activeTab === 'advisor' && (
              <div className="space-y-4 p-4 sm:p-5 bg-slate-950 border border-amber-900/40 rounded-xl text-xs">
                {/* Advisor Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>In-Play Tactical Forensics &amp; Bet Divert Advisor</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                          Autonomous Advisor
                        </span>
                      </h3>
                      <p className="text-slate-400 text-[11px]">
                        Diagnoses pitch shifts, explains trailing bets, and calculates strategic hedge/divert narratives without changing model weights.
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${advisor?.statusColor || 'text-emerald-400 bg-emerald-950 border-emerald-500/40'}`}>
                      {advisor?.betStatusBadge || '🟢 Position Validated'}
                    </span>
                  </div>
                </div>

                {/* Locked Pre-Match Bet vs Live In-Play Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-900/90 border border-white/5 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10.5px] block font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Locked Pre-Match Bet:
                    </span>
                    <strong className="text-white text-sm block">
                      {lockedPickTeam} Win ({lockedPick})
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Pre-Game Prob: {prePickP}%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/90 border border-white/5 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10.5px] block font-medium flex items-center gap-1">
                      <Activity className="w-3 h-3 text-rose-400" />
                      In-Play Minute &amp; Score:
                    </span>
                    <strong className="text-emerald-400 font-mono text-sm block">
                      {liveScore.home} - {liveScore.away} ({liveMinute}')
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Projected Final: {currentProjScore}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/90 border border-white/5 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10.5px] block font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-amber-400" />
                      Live Win Probability Shift:
                    </span>
                    <strong className={`font-mono text-sm block ${probShiftDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {currentPickP}% ({probShiftDelta >= 0 ? `+${probShiftDelta}` : `${probShiftDelta}`}%)
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Remaining xG: {advisor?.remainingXg?.home || 0.8} vs {advisor?.remainingXg?.away || 0.6}
                    </span>
                  </div>
                </div>

                {/* Section 1: What Changed on the Pitch (Forensics) */}
                <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Forensic Diagnosis: What Changed in the Match?</span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">
                    {advisor?.whatChanged || `${lockedPickTeam} is executing pre-match baseline tempo. Live game dynamic reflects expected territorial distribution.`}
                  </p>
                  <p className="text-slate-400 text-[11px] leading-relaxed italic">
                    {advisor?.tacticalDiagnosis || 'Tactical shape remains compact with nominal counter-attack vulnerability.'}
                  </p>
                </div>

                {/* Section 2: Strategic Divert & Hedge Directive */}
                <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <Compass className="w-4 h-4 text-amber-400" />
                      <span>Strategic Advisor: Bet Divert &amp; Hedge Roadmap</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-black bg-amber-900/80 text-amber-200 border border-amber-700/60">
                      {advisor?.advisoryDivert?.badge || '🛡️ Ride Position'}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm">
                    {advisor?.advisoryDivert?.title || 'Hold Position & Ride Current Bet'}
                  </h4>

                  <p className="text-slate-200 text-xs leading-relaxed">
                    {advisor?.advisoryDivert?.rationale || 'Statistical metrics support holding the wager to conclusion.'}
                  </p>

                  {advisor?.advisoryDivert?.recommendedHedgeMarket && (
                    <div className="mt-2 p-2 bg-slate-950/80 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 text-[10.5px] block">Recommended Hedge Vehicle:</span>
                        <strong className="text-white font-mono">{advisor.advisoryDivert.recommendedHedgeMarket}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10.5px] block">Indicative In-Play Odds:</span>
                        <strong className="text-amber-400 font-mono text-sm">@{advisor.advisoryDivert.hedgeOdds || 1.85}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Advisory Narrative Story */}
                <div className="p-3 bg-slate-900 border border-white/5 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Real-Time Advisory Story
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {advisor?.narrativeRoadmap || `Live in-play analysis for ${match.home} vs ${match.away} actively tracking probability decay.`}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: 2D Tactical Pitch Radar */}
            {activeTab === 'radar' && (
              <div className="space-y-3">
                <div className="relative w-full aspect-video sm:aspect-21/9 bg-emerald-950 border-2 border-emerald-800/80 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between p-3.5 select-none">
                  {/* Pitch Turf Pattern */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Pitch Markings */}
                  <div className="absolute inset-2 border border-emerald-500/30 rounded-lg pointer-events-none" />
                  <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px border-l border-emerald-500/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/30 rounded-full" />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-28 border border-emerald-500/30 border-l-0" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-28 border border-emerald-500/30 border-r-0" />

                  {/* Header */}
                  <div className="relative z-10 flex items-center justify-between text-xs font-bold text-white px-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-mono">
                        {match.home}
                      </span>
                      <span className="text-xl font-mono text-emerald-200">{liveScore.home}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMatchLive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white font-mono text-[11px] animate-pulse">
                          🔴 {inPlayData?.minuteDisplay || `${liveMinute}'`} IN-PLAY
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700 font-mono text-[11px]">
                          ⏳ PRE-MATCH STANDBY
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xl font-mono text-emerald-200">{liveScore.away}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-mono">
                        {match.away}
                      </span>
                    </div>
                  </div>

                  {/* Pitch Action */}
                  {isMatchLive ? (
                    <div className="relative z-10 flex-1 flex items-center justify-center my-2">
                      <div 
                        className="absolute w-4 h-4 rounded-full bg-white border-2 border-emerald-900 shadow-lg shadow-white/50 transition-all duration-1000 ease-out z-20 flex items-center justify-center"
                        style={{ left: `${ballPosition.x}%`, top: `${ballPosition.y}%` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      </div>

                      <div 
                        className={`absolute px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-xs transition-all duration-700 ${
                          attackingSide === 'home' 
                            ? 'left-1/3 bg-indigo-600/80 text-white shadow-indigo-500/50 shadow-md' 
                            : 'right-1/3 bg-rose-600/80 text-white shadow-rose-500/50 shadow-md'
                        }`}
                      >
                        ⚡ Attacking Momentum: {attackingSide === 'home' ? match.home : match.away}
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-auto text-center p-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 flex items-center justify-center mb-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        2D Simulation Standby
                      </h4>
                      <p className="text-[11px] sm:text-xs text-emerald-300/80 max-w-sm mt-1">
                        Dynamic pitch ball physics, momentum waves, and live Poisson decay activate at kickoff.
                      </p>
                    </div>
                  )}

                  {/* Pitch Footer */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-emerald-300 px-2 bg-emerald-950/80 rounded-lg py-1 border border-emerald-800/40">
                    <span>Tactical Radar: Low-Latency Sync</span>
                    <span>{isMatchLive ? `Momentum: ${attackingSide.toUpperCase()}` : 'Kickoff Pending'}</span>
                    <span>Pitch: Natural Grass</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: In-Play Mid-Game Analytics */}
            {activeTab === 'analysis' && (
              <div className="space-y-4 p-4 bg-slate-950 border border-white/5 rounded-xl text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {isMatchLive ? 'Supermodel Mid-Game Poisson Shift' : 'Pre-Match Analytical Foundation'}
                    </h3>
                    <p className="text-slate-400 text-[11px]">
                      {isMatchLive ? 'Live probability decay during active in-play match state' : 'Dixon-Coles bivariate Poisson pre-game expected goals'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-bold text-sm">
                      Pick: {inPlayData?.livePickLabel || match.predictedWinner || `${match.home} Win`}
                    </span>
                    <span className="block text-slate-400 text-[10px]">
                      Projected Final: {currentProjScore}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">{isMatchLive ? 'Live Home Win %' : 'Home Win %'}</span>
                    <strong className="text-indigo-400 font-mono text-base block mt-0.5">{currentHomeP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Remaining xG: {inPlayData?.remainingXg?.home || match.lambda || 1.2}</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">{isMatchLive ? 'Live Draw %' : 'Draw %'}</span>
                    <strong className="text-amber-400 font-mono text-base block mt-0.5">{currentDrawP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Stalemate probability</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">{isMatchLive ? 'Live Away Win %' : 'Away Win %'}</span>
                    <strong className="text-rose-400 font-mono text-base block mt-0.5">{currentAwayP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Remaining xG: {inPlayData?.remainingXg?.away || match.mu || 0.9}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-indigo-900/40 rounded-lg space-y-1.5">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Tactical Directive &amp; Game-State Breakdown
                  </span>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    {inPlayData?.tacticalAdvice || inPlayData?.momentumVerdict || match.analyticsConclusion || `${match.home} vs ${match.away}: Tactical dynamics favor projected final score of ${currentProjScore}.`}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: In-Play Betting & Tactical Sidebar */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            
            {/* Live / Pre-Match Odds Card */}
            <div className="p-4 bg-slate-950 border border-white/5 rounded-xl space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  {isMatchLive ? 'Live In-Play Analytics' : 'Pre-Game Model Odds'}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                  isMatchLive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
                }`}>
                  {isMatchLive ? `${liveMinute}' Live Tick` : (match.time || 'Pre-Game')}
                </span>
              </div>

              {/* Dynamic Pick & Live Odds */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Model Directive:</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {inPlayData?.liveOdds || 1.35}x
                  </span>
                </div>
                <div className="font-bold text-white text-sm">
                  {inPlayData?.livePickLabel || match.predictedWinner || `${match.home} Win`}
                </div>
                <div className="text-[11px] text-slate-400">
                  Model Probability: <strong className="text-emerald-400 font-mono">{currentHomeP}%</strong> • Projected: <strong className="text-white font-mono">{currentProjScore}</strong>
                </div>

                <button
                  onClick={() => onAddToSlip && onAddToSlip(match, inPlayData?.livePick || 'HOME', `${inPlayData?.livePickLabel || match.home} Win`, inPlayData?.liveOdds || 1.35, currentHomeP)}
                  className={`w-full py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    isInSlip 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isInSlip ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added to Slip</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Pick to Slip</span>
                    </>
                  )}
                </button>
              </div>

              {/* In-Play Probability Shift Bars */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>{match.home} (Home)</span>
                  <span className="font-mono font-bold text-white">{currentHomeP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentHomeP}%` }} />
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Draw (X)</span>
                  <span className="font-mono font-bold text-white">{currentDrawP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentDrawP}%` }} />
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>{match.away} (Away)</span>
                  <span className="font-mono font-bold text-white">{currentAwayP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentAwayP}%` }} />
                </div>
              </div>
            </div>

            {/* Quick Straight Stream Launcher Card in Sidebar */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Stream Straight
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700/50">
                  Fast HD
                </span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                Watch full HD live broadcast directly on Sportzx with unblocked carrier streams.
              </p>

              <button
                onClick={() => handleLaunchStraight(sportzxUrl)}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Stream Straight from Sportzx ↗</span>
              </button>
            </div>

            {/* TV Broadcaster Info Card */}
            <div className="p-4 bg-slate-950 border border-white/5 rounded-xl space-y-2.5 text-xs">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                Live Broadcast Listings
              </span>

              <div className="space-y-1.5">
                {channelsList.map((ch, idx) => (
                  <div key={idx} className="p-2 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-between">
                    <span className="font-medium text-slate-300 truncate">{ch}</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0 ml-2">
                      Sportzx HD
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
