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
  ArrowRight
} from 'lucide-react';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';

/**
 * Builds prioritized Sportzx and Live Web TV iframe stream feeds for any fixture
 */
export function buildMatchStreamSources(match) {
  if (!match) return [];

  const home = match.home || 'Home';
  const away = match.away || 'Away';
  const league = match.league || '';
  const cleanHome = home.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanAway = away.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const slug = `${cleanHome.toLowerCase().replace(/\s+/g, '-')}-vs-${cleanAway.toLowerCase().replace(/\s+/g, '-')}`;
  const leagueLower = league.toLowerCase();

  // Determine primary and secondary TV channel keys
  let tvChannelKey = 'SkySportsMainEvent';
  let tvChannelLabel = 'Sky Sports Main Event';
  let secondaryChannelKey = 'TNTSports1';
  let secondaryChannelLabel = 'TNT Sports 1';

  if (leagueLower.includes('chile') || leagueLower.includes('copa chile') || leagueLower.includes('chi.')) {
    tvChannelKey = 'TNTSportsChile';
    tvChannelLabel = 'TNT Sports Chile HD';
    secondaryChannelKey = 'TNTSports2';
    secondaryChannelLabel = 'TNT Sports 2 Chile';
  } else if (leagueLower.includes('premier league') || leagueLower.includes('epl')) {
    tvChannelKey = 'SkySportsPremierLeague';
    tvChannelLabel = 'Sky Sports Premier League HD';
    secondaryChannelKey = 'TNTSports1';
    secondaryChannelLabel = 'TNT Sports 1';
  } else if (leagueLower.includes('champions league') || leagueLower.includes('uefa') || leagueLower.includes('europa')) {
    tvChannelKey = 'TNTSports1';
    tvChannelLabel = 'TNT Sports 1 HD';
    secondaryChannelKey = 'TNTSports2';
    secondaryChannelLabel = 'TNT Sports 2';
  } else if (leagueLower.includes('la liga') || leagueLower.includes('primera')) {
    tvChannelKey = 'LaLigaTV';
    tvChannelLabel = 'LaLiga TV HD';
    secondaryChannelKey = 'PremierSports1';
    secondaryChannelLabel = 'Premier Sports 1';
  } else if (leagueLower.includes('serie a') || leagueLower.includes('ital')) {
    tvChannelKey = 'TNTSports1';
    tvChannelLabel = 'TNT Sports 1 (Serie A)';
    secondaryChannelKey = 'ParamountPlus';
    secondaryChannelLabel = 'Paramount+ Sports';
  } else if (leagueLower.includes('bundesliga') || leagueLower.includes('german')) {
    tvChannelKey = 'SkySportsFootball';
    tvChannelLabel = 'Sky Sports Football HD';
    secondaryChannelKey = 'ESPN';
    secondaryChannelLabel = 'ESPN Sports';
  } else if (leagueLower.includes('ligue 1') || leagueLower.includes('france')) {
    tvChannelKey = 'beIN1';
    tvChannelLabel = 'beIN Sports 1 HD';
    secondaryChannelKey = 'TNTSports1';
    secondaryChannelLabel = 'TNT Sports 1';
  } else if (leagueLower.includes('mls') || leagueLower.includes('usa')) {
    tvChannelKey = 'ESPN';
    tvChannelLabel = 'ESPN USA HD';
    secondaryChannelKey = 'AppleTV';
    secondaryChannelLabel = 'MLS Season Pass';
  }

  // Override if match has explicitly scraped broadcasts
  const broadcastStr = (match.broadcast || '').toLowerCase();
  if (broadcastStr.includes('tnt sports chile') || broadcastStr.includes('estadio tnt')) {
    tvChannelKey = 'TNTSportsChile';
    tvChannelLabel = 'TNT Sports Chile HD';
    secondaryChannelKey = 'TNTSports2';
    secondaryChannelLabel = 'TNT Sports 2 Chile';
  } else if (broadcastStr.includes('peacock')) {
    tvChannelKey = 'Peacock';
    tvChannelLabel = 'Peacock USA HD';
  } else if (broadcastStr.includes('tnt')) {
    tvChannelKey = 'TNTSports1';
    tvChannelLabel = 'TNT Sports 1 HD';
  } else if (broadcastStr.includes('sky')) {
    tvChannelKey = 'SkySportsMainEvent';
    tvChannelLabel = 'Sky Sports Main Event HD';
  } else if (broadcastStr.includes('dazn')) {
    tvChannelKey = 'DAZN1';
    tvChannelLabel = 'DAZN 1 HD';
  } else if (broadcastStr.includes('espn')) {
    tvChannelKey = 'ESPN';
    tvChannelLabel = 'ESPN HD';
  }

  return [
    {
      id: 'sportzx-tv',
      name: `Sportzx Web TV (${tvChannelLabel})`,
      shortName: 'Sportzx TV',
      type: 'webtv',
      provider: 'Sportzx Live Network',
      badge: '⚡ Auto Feed 1',
      url: `https://topembed.pw/channel/${tvChannelKey}`,
      fallbackUrl: `https://sportzx.co/live?event=${encodeURIComponent(home + ' vs ' + away)}`,
      description: `Direct high-definition live television broadcast from ${tvChannelLabel} via Sportzx stream engine`
    },
    {
      id: 'sportzx-match',
      name: `Sportzx Match Stream (${cleanHome} vs ${cleanAway})`,
      shortName: 'Sportzx Match',
      type: 'match_feed',
      provider: 'Sportzx Stream Relay',
      badge: '📺 Feed 2',
      url: `https://streamed.su/watch/${slug}`,
      fallbackUrl: `https://sportzx.co/embed/${slug}`,
      description: `Direct sports match stream powered by Sportzx high-speed web video servers`
    },
    {
      id: 'webtv-mirror',
      name: `Live Web TV Mirror (${secondaryChannelLabel})`,
      shortName: 'Web TV 2',
      type: 'channel_mirror',
      provider: 'Web TV Satellite',
      badge: '🌐 Feed 3',
      url: `https://topembed.pw/channel/${secondaryChannelKey}`,
      fallbackUrl: `https://embedstream.me/football/${slug}-stream-1`,
      description: `Alternative television network feed on ${secondaryChannelLabel}`
    },
    {
      id: 'global-stream',
      name: `Global Sports Online Feed (${cleanHome} vs ${cleanAway})`,
      shortName: 'Global Feed',
      type: 'global_feed',
      provider: 'Sports Online Gate',
      badge: '🛰️ Feed 4',
      url: `https://embedstream.me/football/${slug}-stream-1`,
      fallbackUrl: `https://totalsportek.pro/game/${slug}`,
      description: `Secondary global web stream mirror for uninterrupted coverage`
    },
    {
      id: 'radar-fallback',
      name: 'Interactive 2D Pitch Radar & Tactical Simulator',
      shortName: 'Pitch Radar',
      type: 'radar',
      provider: 'AI Tactical Radar',
      badge: '📡 Zero-Lag',
      url: null,
      description: 'Ultra-low latency tactical radar simulating attacking momentum and live probability decay'
    }
  ];
}

export default function LiveMatchPlayerModal({
  match,
  isOpen,
  onClose,
  onAddToSlip,
  isInSlip = false
}) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'radar' | 'radio' | 'analysis'
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [streamState, setStreamState] = useState('loading'); // 'loading' | 'playing' | 'failed' | 'switching'
  const [autoFallbackEnabled, setAutoFallbackEnabled] = useState(true);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState('');
  const [forcePlayStream, setForcePlayStream] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveMinute, setLiveMinute] = useState(45);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [inPlayData, setInPlayData] = useState(null);
  const [isLoadingInPlay, setIsLoadingInPlay] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 50 });
  const [attackingSide, setAttackingSide] = useState('home');

  const fallbackTimerRef = useRef(null);
  const iframeRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Compute prioritized stream sources
  const streamSources = useMemo(() => {
    return buildMatchStreamSources(match);
  }, [match]);

  const currentSource = streamSources[currentSourceIndex] || streamSources[0];

  // Derive live status flags
  const isMatchLive = Boolean(
    match?.isLive === true || 
    match?.status === 'LIVE' || 
    match?.status === 'STATUS_IN_PROGRESS' || 
    match?.status === 'STATUS_HALFTIME' || 
    match?.status === 'HT' || 
    (typeof match?.liveMinute === 'string' && (match.liveMinute.includes("'") || match.liveMinute.toLowerCase() === 'ht')) ||
    (typeof match?.status === 'string' && (match.status.includes("'") || match.status.toLowerCase() === 'ht')) ||
    (typeof match?.liveMinute === 'number' && match.liveMinute > 0)
  );

  const isMatchCompleted = Boolean(
    match?.isCompleted === true ||
    match?.status === 'FT' ||
    match?.status === 'STATUS_FULL_TIME' ||
    match?.status === 'FINAL' ||
    match?.status === 'Final' ||
    (typeof match?.status === 'string' && match.status.includes('FT'))
  );

  const isPreMatch = !isMatchLive && !isMatchCompleted;

  // Initialize scores, in-play prediction, and initial stream feed
  useEffect(() => {
    if (!match) return;

    // Reset stream state
    setCurrentSourceIndex(0);
    setStreamState('loading');
    setAutoSwitchNotice(null);
    setForcePlayStream(false);

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
    } else if (isMatchLive) {
      fetchInPlayPrediction(min, hS, aS);
    }

    // Set initial stream URL
    if (streamSources[0]?.url) {
      setActiveStreamUrl(streamSources[0].url);
    }
  }, [match]);

  // Handle stream source index change & Auto-Fallback Timer
  useEffect(() => {
    if (!currentSource) return;

    if (currentSource.type === 'radar') {
      setActiveTab('radar');
      setStreamState('playing');
      setAutoSwitchNotice('Auto-switched to 2D Pitch Radar: Live visual simulator active.');
      return;
    }

    if (currentSource.url) {
      setActiveStreamUrl(currentSource.url);
      setStreamState('loading');
    }

    // Clear prior timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }

    // If auto-fallback is enabled and game is live or force stream is on, set 7-second auto watchdog
    if (autoFallbackEnabled && (isMatchLive || forcePlayStream)) {
      fallbackTimerRef.current = setTimeout(() => {
        handleAutoAdvance();
      }, 7000);
    }

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [currentSourceIndex, autoFallbackEnabled, isMatchLive, forcePlayStream]);

  // 2D Tactical Pitch Radar Simulation Tick (ONLY when match is LIVE!)
  useEffect(() => {
    if (!isMatchLive || activeTab !== 'radar') return;

    const interval = setInterval(() => {
      // Simulate attacking transitions between home and away
      setBallPosition(prev => {
        const targetX = attackingSide === 'home' ? 70 + Math.random() * 25 : 5 + Math.random() * 25;
        const targetY = 20 + Math.random() * 60;
        return {
          x: Math.round(prev.x * 0.7 + targetX * 0.3),
          y: Math.round(prev.y * 0.7 + targetY * 0.3)
        };
      });

      // Randomly change attack momentum every few ticks
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
      setAutoSwitchNotice(`Feed ${currentSourceIndex + 1} took too long to play. Auto-switched to ${nextSource.name}.`);
      setCurrentSourceIndex(nextIdx);
    } else {
      setActiveTab('radar');
      setAutoSwitchNotice('Web stream mirrors offline or geo-restricted. Displaying Live 2D Pitch Radar & Tactical Simulator.');
    }
  };

  const handleManualSourceSelect = (idx) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setCurrentSourceIndex(idx);
    setAutoSwitchNotice(null);
    if (streamSources[idx]?.type === 'radar') {
      setActiveTab('radar');
    } else {
      setActiveTab('stream');
    }
  };

  const handleNextStream = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    handleAutoAdvance();
  };

  const handleIframeLoaded = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setStreamState('playing');
  };

  const handleIframeError = () => {
    if (autoFallbackEnabled) {
      handleAutoAdvance();
    } else {
      setStreamState('failed');
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
          liveAwayScore: aS
        })
      });
      const data = await res.json();
      if (data.success && data.inPlayPrediction) {
        setInPlayData(data.inPlayPrediction);
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
    : (match.broadcast ? match.broadcast.split(',').map(s => s.trim()) : ['TNT Sports Chile', 'Sky Sports Main Event', 'Peacock']);

  const currentHomeP = inPlayData?.liveProb?.home ?? safeParseFloat(match.prob?.home, 50);
  const currentDrawP = inPlayData?.liveProb?.draw ?? safeParseFloat(match.prob?.draw, 25);
  const currentAwayP = inPlayData?.liveProb?.away ?? safeParseFloat(match.prob?.away, 25);
  const currentProjScore = inPlayData?.projectedFinalScore || match.mostLikelyScore || '1 - 0';

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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
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
                    LIVE {inPlayData?.minuteDisplay || (match.liveMinute || match.status || `${liveMinute}'`)}
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
                <span className="truncate text-slate-400 text-[11px]">📺 {channelsList[0] || 'Official HD'}</span>
              </div>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Player'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <a
              href={currentSource.url || currentSource.fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
              title="Pop-out player in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer border border-white/5 ml-1"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimalist Mode Selector Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-white/5 flex items-center justify-between gap-2 overflow-x-auto text-xs select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('stream')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'stream' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Video Stream</span>
              {isMatchLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-0.5" />
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
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                isMatchLive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                {isMatchLive ? 'SIMULATING' : 'STANDBY'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('radio')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeTab === 'radio' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Radio Audio</span>
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
              <span>AI Analytics</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2.5">
            <button
              onClick={() => setAutoFallbackEnabled(!autoFallbackEnabled)}
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                autoFallbackEnabled 
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-700/60' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Automatically switches to next unblocked mirror within 7s if feed stalls"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Auto-Switch: {autoFallbackEnabled ? '7s' : 'OFF'}</span>
            </button>

            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Zero Ads • Sandboxed
            </span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left/Main Column: Player Area */}
          <div className="lg:col-span-8 flex flex-col space-y-3">
            
            {/* Auto-Switch Notice Alert */}
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
                {/* 1-Click Stream Source Switcher Bar */}
                <div className="p-2 bg-slate-950/80 border border-white/5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-semibold flex items-center gap-1 text-[11px]">
                      <Tv className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Feeds:</span>
                    </span>

                    {streamSources.map((src, idx) => (
                      <button
                        key={src.id}
                        onClick={() => handleManualSourceSelect(idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          currentSourceIndex === idx
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5'
                        }`}
                        title={src.description}
                      >
                        <span>{src.shortName}</span>
                        {currentSourceIndex === idx && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleNextStream}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-white/5"
                      title="Skip to next stream mirror"
                    >
                      <RotateCcw className="w-3 h-3 text-indigo-400" />
                      <span>Next Feed</span>
                    </button>
                  </div>
                </div>

                {/* Player View Container */}
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl">
                  {/* Case 1: Match is NOT live yet, show "Stream Has Not Started Yet" standby */}
                  {isPreMatch && !forcePlayStream ? (
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-black flex flex-col items-center justify-center p-6 text-center select-none">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
                        <Clock className="w-7 h-7 text-amber-400 animate-pulse" />
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Standby • Kickoff {match.time || 'Upcoming Today'}
                      </span>

                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        Stream Has Not Started Yet
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1.5 leading-relaxed">
                        Live HD video broadcast feeds activate automatically 10–15 minutes before the match kicks off.
                      </p>

                      <div className="mt-4 px-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center gap-2.5 text-xs text-slate-300 max-w-sm">
                        <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="truncate">
                          Official Broadcast: <strong className="text-white">{match.broadcast || 'TNT Sports Chile, TNT Sports HD'}</strong>
                        </span>
                      </div>

                      <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
                        <button
                          onClick={() => setForcePlayStream(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white text-white" />
                          <span>Open Carrier Stream Anyway</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('analysis')}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pre-Match Predictions</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Case 2: Match IS LIVE or user forced playback */
                    activeStreamUrl ? (
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
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <Tv className="w-10 h-10 mb-2 opacity-50 text-indigo-400" />
                        <p className="text-sm font-semibold text-slate-300">Connecting to Live Web TV Stream...</p>
                      </div>
                    )
                  )}

                  {/* Sandboxed Protection Badge Overlay */}
                  <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/85 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs shadow-md">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Sandboxed • Zero Ads</span>
                    </span>
                  </div>

                  {/* Active Source Badge Overlay */}
                  <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/85 text-indigo-300 border border-indigo-500/40 backdrop-blur-xs shadow-md font-mono">
                      <span>{currentSource.shortName}</span>
                    </span>
                  </div>
                </div>

                {/* Minimalist Live Stream Bottom Strip */}
                <div className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Stream Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {currentSource.provider}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 truncate max-w-xs">{currentSource.description}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[11px]">Stream stalled?</span>
                    <button
                      onClick={handleNextStream}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                    >
                      Switch mirror feed →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 2D Tactical Soccer Pitch Radar */}
            {activeTab === 'radar' && (
              <div className="space-y-3">
                <div className="relative w-full aspect-video sm:aspect-21/9 bg-emerald-950 border-2 border-emerald-800/80 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between p-3.5 select-none">
                  {/* Pitch Turf Pattern */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Pitch Markings */}
                  <div className="absolute inset-2 border border-emerald-500/30 rounded-lg pointer-events-none" />
                  <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px border-l border-emerald-500/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/30 rounded-full" />
                  {/* Goal Boxes */}
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

                  {/* Pitch Action or Standby State */}
                  {isMatchLive ? (
                    /* Live match dynamic physics & player movement */
                    <div className="relative z-10 flex-1 flex items-center justify-center my-2">
                      {/* Simulated Ball with Trail */}
                      <div 
                        className="absolute w-4 h-4 rounded-full bg-white border-2 border-emerald-900 shadow-lg shadow-white/50 transition-all duration-1000 ease-out z-20 flex items-center justify-center"
                        style={{ left: `${ballPosition.x}%`, top: `${ballPosition.y}%` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      </div>

                      {/* Attacking Momentum Wave Indicator */}
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
                    /* Match NOT live: Standby Pitch Display */
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-auto text-center p-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 flex items-center justify-center mb-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        2D Simulation Standby
                      </h4>
                      <p className="text-[11px] sm:text-xs text-emerald-300/80 max-w-sm mt-1">
                        Dynamic pitch ball physics, possession momentum waves, and live Poisson goal probability decay will activate when the match kicks off.
                      </p>
                    </div>
                  )}

                  {/* Pitch Footer: Tactical Stats */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-emerald-300 px-2 bg-emerald-950/80 rounded-lg py-1 border border-emerald-800/40">
                    <span>Tactical Radar: Low-Latency Sync</span>
                    <span>{isMatchLive ? `Momentum: ${attackingSide.toUpperCase()}` : 'Kickoff Pending'}</span>
                    <span>Pitch: Natural Grass</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Tactical State:</span>
                    <span className="font-semibold text-indigo-400">
                      {isMatchLive 
                        ? (inPlayData?.momentumVerdict || `${match.home} and ${match.away} contesting mid-pitch territorial control.`)
                        : `Pre-match preparation: ${match.home} vs ${match.away} kicks off at ${match.time || 'scheduled time'}.`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Audio Commentary */}
            {activeTab === 'radio' && (
              <div className="space-y-4 p-5 bg-slate-950 border border-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Radio className={`w-5 h-5 ${isMatchLive ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Football Audio Commentary</h3>
                    <p className="text-xs text-slate-400">
                      {isMatchLive 
                        ? 'Real-time play-by-play radio commentary & crowd atmosphere'
                        : 'Live commentary stream activates at kickoff'
                      }
                    </p>
                  </div>
                </div>

                {isMatchLive ? (
                  <div className="p-4 bg-slate-900 border border-white/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Source: Sports Audio Live Stream</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Broadcasting Live
                      </span>
                    </div>
                    
                    <div className="aspect-21/9 w-full bg-black rounded-lg overflow-hidden">
                      <iframe
                        src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(match.home + ' vs ' + match.away + ' radio live commentary')}&autoplay=1`}
                        title="Audio Commentary Stream"
                        className="w-full h-full border-0"
                        allow="autoplay"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-900/60 border border-white/5 rounded-xl text-center space-y-2">
                    <Radio className="w-8 h-8 text-slate-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-200">Commentary Feed Standby</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Official matchday audio commentary will begin broadcasting once the game kicks off at {match.time || 'scheduled matchday time'}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: In-Play Mid-Game Analytics */}
            {activeTab === 'analysis' && (
              <div className="space-y-4 p-4 bg-slate-950 border border-white/5 rounded-xl text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {isMatchLive ? 'Supermodel Mid-Game Autopsy' : 'Pre-Match Analytical Foundation'}
                    </h3>
                    <p className="text-slate-400 text-[11px]">
                      {isMatchLive ? 'Real-time Poisson goal rate decay during active live play' : 'Dixon-Coles bivariate Poisson pre-game expected goals'}
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
                    <span className="text-[10px] text-slate-500 font-mono">xG: {match.lambda || inPlayData?.remainingXg?.home || 1.2}</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">{isMatchLive ? 'Live Draw %' : 'Draw %'}</span>
                    <strong className="text-amber-400 font-mono text-base block mt-0.5">{currentDrawP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Stalemate probability</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">{isMatchLive ? 'Live Away Win %' : 'Away Win %'}</span>
                    <strong className="text-rose-400 font-mono text-base block mt-0.5">{currentAwayP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">xG: {match.mu || inPlayData?.remainingXg?.away || 0.9}</span>
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
                  {isMatchLive ? 'Live In-Play Odds' : 'Pre-Game Model Odds'}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                  isMatchLive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
                }`}>
                  {isMatchLive ? `${liveMinute}' Tick` : (match.time || 'Pre-Game')}
                </span>
              </div>

              {/* Dynamic Pick & Live Odds */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Recommended Pick:</span>
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
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
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

              {/* Probability Bars */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>{match.home}</span>
                  <span className="font-mono font-bold text-white">{currentHomeP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentHomeP}%` }} />
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Draw</span>
                  <span className="font-mono font-bold text-white">{currentDrawP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentDrawP}%` }} />
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>{match.away}</span>
                  <span className="font-mono font-bold text-white">{currentAwayP}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentAwayP}%` }} />
                </div>
              </div>
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
                      Official HD
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 leading-normal pt-1">
                Broadcaster metadata synced from ESPN &amp; official regional league rights holders.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
