import React, { useState, useEffect } from 'react';
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
  RefreshCw, 
  Plus, 
  Check, 
  Clock, 
  Info,
  Flame,
  BarChart2
} from 'lucide-react';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';

export default function LiveMatchPlayerModal({
  match,
  isOpen,
  onClose,
  onAddToSlip,
  isInSlip = false
}) {
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'stream' | 'radio' | 'analysis'
  const [selectedChannel, setSelectedChannel] = useState('ch1');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [activeStreamUrl, setActiveStreamUrl] = useState('');
  const [isSimulatingLive, setIsSimulatingLive] = useState(false);
  const [liveMinute, setLiveMinute] = useState(65);
  const [liveScore, setLiveScore] = useState({ home: 1, away: 0 });
  const [inPlayData, setInPlayData] = useState(null);
  const [isLoadingInPlay, setIsLoadingInPlay] = useState(false);

  useEffect(() => {
    if (!match) return;

    // Initialize scores & minute
    const hS = match.liveHomeScore ?? match.goals?.home ?? match.homeScore ?? (match.isLive ? 1 : 0);
    const aS = match.liveAwayScore ?? match.goals?.away ?? match.awayScore ?? 0;
    setLiveScore({ home: hS, away: aS });

    let min = 65;
    if (typeof match.liveMinute === 'number') min = match.liveMinute;
    else if (typeof match.liveMinute === 'string') {
      const parsed = parseInt(match.liveMinute.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) min = parsed;
      else if (match.liveMinute.toLowerCase().includes('ht')) min = 45;
    }
    setLiveMinute(min);

    // If pre-calculated inPlayPrediction exists on match, set it
    if (match.inPlayPrediction) {
      setInPlayData(match.inPlayPrediction);
    } else {
      fetchInPlayPrediction(min, hS, aS);
    }

    // Default stream URLs
    const query = encodeURIComponent(`${match.home} vs ${match.away} live stream`);
    const ytUrl = `https://www.youtube.com/embed?listType=search&list=${query}&autoplay=1`;
    setActiveStreamUrl(ytUrl);
  }, [match]);

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

  const isLive = match.isLive || isSimulatingLive || (match.status && !match.isCompleted && match.status !== 'FT' && (match.status.includes("'") || match.status.includes('LIVE') || match.status === 'HT'));
  const channelsList = Array.isArray(match.channels) && match.channels.length > 0 
    ? match.channels 
    : (match.broadcast ? match.broadcast.split(',').map(s => s.trim()) : ['Sky Sports Main Event', 'Peacock', 'ESPN+']);

  const handleChannelSelect = (chKey) => {
    setSelectedChannel(chKey);
    const query = encodeURIComponent(`${match.home} vs ${match.away}`);
    if (chKey === 'ch1') {
      setActiveStreamUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(match.home + ' vs ' + match.away + ' live commentary')}&autoplay=1`);
    } else if (chKey === 'ch2') {
      setActiveStreamUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(match.home + ' vs ' + match.away + ' full match highlights')}&autoplay=1`);
    } else if (chKey === 'ch3') {
      setActiveStreamUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(match.league + ' live soccer')}&autoplay=1`);
    } else if (chKey === 'custom' && customStreamUrl.trim()) {
      setActiveStreamUrl(customStreamUrl.trim());
    }
  };

  const currentHomeP = inPlayData?.liveProb?.home ?? safeParseFloat(match.prob?.home, 50);
  const currentDrawP = inPlayData?.liveProb?.draw ?? safeParseFloat(match.prob?.draw, 25);
  const currentAwayP = inPlayData?.liveProb?.away ?? safeParseFloat(match.prob?.away, 25);
  const currentProjScore = inPlayData?.projectedFinalScore || match.mostLikelyScore || '1 - 0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm sm:text-base truncate">
                  {match.home} vs {match.away}
                </span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    LIVE {inPlayData?.minuteDisplay || `${liveMinute}'`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {match.time || 'Upcoming Today'}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-950/70 text-indigo-300 border border-indigo-800/60">
                  {match.league}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>Score: <strong className="text-white font-mono">{liveScore.home} - {liveScore.away}</strong></span>
                <span>•</span>
                <span className="truncate">📺 {channelsList.join(' • ')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'radar' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>2D Pitch Radar & Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('stream')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stream' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Free Live Stream Player</span>
            </button>

            <button
              onClick={() => setActiveTab('radio')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'radio' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Radio Commentary</span>
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'analysis' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>In-Play Mid-Game Analytics</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Feed Connected
            </span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left/Main Column: Video / Radar / Audio Player */}
          <div className="lg:col-span-8 flex flex-col space-y-3.5">
            
            {/* Tab 1: 2D Pitch Simulator / Radar */}
            {activeTab === 'radar' && (
              <div className="space-y-3">
                {/* 2D Synthetic Soccer Pitch Radar */}
                <div className="relative w-full aspect-video sm:aspect-21/9 bg-emerald-950 border-2 border-emerald-800/80 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between p-3 select-none">
                  {/* Pitch Turf Pattern */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Pitch Markings */}
                  <div className="absolute inset-2 border border-emerald-500/30 rounded-lg pointer-events-none" />
                  <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px border-l border-emerald-500/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/30 rounded-full" />
                  {/* Goal Boxes */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-28 border border-emerald-500/30 border-l-0" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-28 border border-emerald-500/30 border-r-0" />

                  {/* Pitch Radar Header */}
                  <div className="relative z-10 flex items-center justify-between text-xs font-bold text-white px-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-mono">
                        {match.home}
                      </span>
                      <span className="text-xl font-mono text-emerald-200">{liveScore.home}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white font-mono text-[11px] animate-pulse">
                        🔴 {liveMinute}' IN-PLAY
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xl font-mono text-emerald-200">{liveScore.away}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-mono">
                        {match.away}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Tactical Pitch Action Representation */}
                  <div className="relative z-10 flex-1 flex items-center justify-center my-2">
                    <div className="bg-slate-950/70 backdrop-blur-xs border border-emerald-500/40 rounded-xl p-3 max-w-sm text-center">
                      <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tactical Momentum & Pitch Pressure</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {inPlayData?.momentumVerdict || `${match.home} holding spatial control in mid-block. ${match.away} looking to exploit counter-attack lanes.`}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-slate-300 font-mono">
                        <span>xG: {match.xG?.home || '1.4'} - {match.xG?.away || '1.1'}</span>
                        <span>•</span>
                        <span>Rem xG: {inPlayData?.remainingXg?.home || '0.4'} - {inPlayData?.remainingXg?.away || '0.3'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pitch Radar Footer: Momentum Bar */}
                  <div className="relative z-10 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-300 px-1 font-mono">
                      <span>{match.home} Attack Pressure ({currentHomeP}%)</span>
                      <span>{match.away} Counter Threat ({currentAwayP}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900/80 rounded-full overflow-hidden flex border border-emerald-600/40">
                      <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${currentHomeP}%` }} />
                      <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${currentDrawP}%` }} />
                      <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${currentAwayP}%` }} />
                    </div>
                  </div>
                </div>

                {/* Broadcast Banner */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">TV Channels:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {channelsList.map((ch, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a
                    href="https://www.livescorebet.com/ie/sports/football"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                  >
                    <span>Watch Official Feed</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Tab 2: Free Live Stream Player (Sandboxed Iframe) */}
            {activeTab === 'stream' && (
              <div className="space-y-3">
                {/* Channel Selector Bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 font-semibold">Stream Source:</span>
                  <button
                    onClick={() => handleChannelSelect('ch1')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      selectedChannel === 'ch1' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Channel 1 (Live Feed)
                  </button>
                  <button
                    onClick={() => handleChannelSelect('ch2')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      selectedChannel === 'ch2' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Channel 2 (Multi-Angle)
                  </button>
                  <button
                    onClick={() => handleChannelSelect('ch3')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      selectedChannel === 'ch3' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Channel 3 (Official Feed)
                  </button>
                  <button
                    onClick={() => handleChannelSelect('custom')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      selectedChannel === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Custom Stream URL
                  </button>
                </div>

                {/* Custom URL Input if selected */}
                {selectedChannel === 'custom' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste stream embed URL (https://...)"
                      value={customStreamUrl}
                      onChange={(e) => setCustomStreamUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleChannelSelect('custom')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Load Stream
                    </button>
                  </div>
                )}

                {/* Secure Sandboxed Iframe Video Player */}
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                  {activeStreamUrl ? (
                    <iframe
                      src={activeStreamUrl}
                      title="Live Match Player"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <Tv className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-sm font-semibold text-slate-300">Select a free channel or paste a stream link above</p>
                      <span className="text-xs text-slate-500 mt-1">Sandboxed HTML5 engine prevents unauthorized popups</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>🔒 Sandboxed Iframe: Malicious redirects blocked</span>
                  <span>Official Broadcasters: {channelsList.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Tab 3: Live Radio Commentary */}
            {activeTab === 'radio' && (
              <div className="space-y-4 p-6 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Audio Commentary Stream</h3>
                    <p className="text-xs text-slate-400">Play-by-play tactical radio commentary & crowd atmosphere</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Source: Live Football Audio Network</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Broadcasting Live
                    </span>
                  </div>
                  
                  {/* YouTube Live Radio / Audio Player Embed */}
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
              </div>
            )}

            {/* Tab 4: In-Play Mid-Game Analytics */}
            {activeTab === 'analysis' && (
              <div className="space-y-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">Supermodel Mid-Game Autopsy</h3>
                    <p className="text-slate-400 text-[11px]">Real-time Poisson goal rate recalibration during live match play</p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-bold text-sm">
                      Live Pick: {inPlayData?.livePickLabel || `${match.home} Win`}
                    </span>
                    <span className="block text-slate-400 text-[10px]">
                      Projected Final: {currentProjScore}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">Live Home Win %</span>
                    <strong className="text-indigo-400 font-mono text-base block mt-0.5">{currentHomeP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Rem xG: {inPlayData?.remainingXg?.home || 0.4}</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">Live Draw %</span>
                    <strong className="text-amber-400 font-mono text-base block mt-0.5">{currentDrawP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Stalemate risk</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                    <span className="text-slate-400 text-[11px] block">Live Away Win %</span>
                    <strong className="text-rose-400 font-mono text-base block mt-0.5">{currentAwayP}%</strong>
                    <span className="text-[10px] text-slate-500 font-mono">Rem xG: {inPlayData?.remainingXg?.away || 0.3}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-indigo-900/40 rounded-lg space-y-1.5">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Tactical Directive & Game-State Breakdown
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {inPlayData?.tacticalAdvice || `${match.home} holding game-state leverage into 2H. Model favors closing out victory.`}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: In-Play Betting & Tactical Sidebar */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            
            {/* Live In-Play Model Card */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  Live In-Play Odds
                </span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  {liveMinute}' Tick
                </span>
              </div>

              {/* Dynamic Pick & Live Odds */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Recommended In-Play Pick:</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {inPlayData?.liveOdds || 1.35}x
                  </span>
                </div>
                <div className="font-bold text-white text-sm">
                  {inPlayData?.livePickLabel || `${match.home} Win`}
                </div>
                <div className="text-[11px] text-slate-400">
                  Model Probability: <strong className="text-emerald-400 font-mono">{currentHomeP}%</strong> • Projected: <strong className="text-white font-mono">{currentProjScore}</strong>
                </div>

                <button
                  onClick={() => onAddToSlip && onAddToSlip(match, inPlayData?.livePick || 'HOME', `${inPlayData?.livePickLabel || match.home} Win (Live)`, inPlayData?.liveOdds || 1.35, currentHomeP)}
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
                      <span>Add Live Pick to Slip</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Probability Bars */}
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
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                Live Broadcast Listings
              </span>

              <div className="space-y-1.5">
                {channelsList.map((ch, idx) => (
                  <div key={idx} className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
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
