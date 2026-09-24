import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Target,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  Info,
  Clock,
  Shirt,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { safeToFixed } from '../utils/numberUtils';
import { formatRelativeDayTime } from '../utils/dateUtils';

export default function LineupsPage({
  matches = [],
  selectedMatch = null,
  onSelectMatch,
  onBackToFixtures,
  tzSettings = {}
}) {
  const [activeMatch, setActiveMatch] = useState(selectedMatch || matches[0] || null);
  const [lineupData, setLineupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('pitch'); // 'pitch' | 'list'
  const [activeTabSide, setActiveTabSide] = useState('all'); // 'all' | 'home' | 'away'
  const [expandedPlayerKey, setExpandedPlayerKey] = useState(null);

  const togglePlayerExpand = (key) => {
    setExpandedPlayerKey(prev => (prev === key ? null : key));
  };

  // Sync when prop changes
  useEffect(() => {
    if (selectedMatch) {
      setActiveMatch(selectedMatch);
    } else if (!activeMatch && matches.length > 0) {
      setActiveMatch(matches[0]);
    }
  }, [selectedMatch, matches]);

  const fetchLineup = async (forceRefresh = false) => {
    if (!activeMatch) return;

    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const matchId = activeMatch.espnEventId || activeMatch.id;
      const leagueCode = activeMatch.espnLeagueCode || activeMatch.league || '';
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/match-lineup?matchId=${matchId}&league=${encodeURIComponent(leagueCode)}${refreshParam}`);
      if (!res.ok) {
        throw new Error(`Lineup API responded with HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setLineupData(data);
      } else {
        setError(data.error || 'Lineups could not be retrieved for this fixture.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch lineups when activeMatch changes
  useEffect(() => {
    fetchLineup(false);
  }, [activeMatch]);

  // Match selector options
  const matchOptions = matches.map((m, idx) => {
    const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
    const timeDisplay = timeVal ? formatRelativeDayTime(timeVal, tzSettings) : (m.time || 'Upcoming');
    return {
      value: m.id || String(idx),
      label: `${timeDisplay} | ${m.home} vs ${m.away} (${m.league?.split(' ')[0] || 'Match'})`
    };
  });

  const handleMatchChange = (matchId) => {
    const found = matches.find(m => (m.id || String(matches.indexOf(m))) === matchId);
    if (found) {
      setActiveMatch(found);
      if (onSelectMatch) onSelectMatch(found);
    }
  };

  const home = lineupData?.home?.team || activeMatch?.home || 'Home Team';
  const away = lineupData?.away?.team || activeMatch?.away || 'Away Team';
  const homeLineup = lineupData?.home?.starters || lineupData?.lineups?.home || [];
  const awayLineup = lineupData?.away?.starters || lineupData?.lineups?.away || [];
  const homeSubstitutes = lineupData?.home?.substitutes || lineupData?.lineups?.substitutes?.home || [];
  const awaySubstitutes = lineupData?.away?.substitutes || lineupData?.lineups?.substitutes?.away || [];
  const homeFormation = lineupData?.home?.formation || lineupData?.formations?.home || activeMatch?.homeFormation || '4-3-3';
  const awayFormation = lineupData?.away?.formation || lineupData?.formations?.away || activeMatch?.awayFormation || '4-2-3-1';
  const isOfficial = lineupData?.isOfficial || lineupData?.status === 'CONFIRMED';
  const impact = lineupData?.lineupImpact || activeMatch?.lineupImpact;
  const recalibrated = lineupData?.recalibrated;

  // Group players by line for pitch rendering (GK, DEF, MID, FWD)
  const groupPlayersByLine = (players = []) => {
    const lines = {
      gk: [],
      def: [],
      mid: [],
      fwd: []
    };

    players.forEach((p, idx) => {
      const pos = (p.position || '').toLowerCase();
      const abbr = (p.posAbbr || '').toUpperCase();

      if (abbr === 'G' || pos.includes('goal') || idx === 0) {
        lines.gk.push(p);
      } else if (abbr === 'D' || pos.includes('def') || pos.includes('back')) {
        lines.def.push(p);
      } else if (abbr === 'M' || pos.includes('mid')) {
        lines.mid.push(p);
      } else {
        lines.fwd.push(p);
      }
    });

    // Fallback balance if categorization left lines unbalanced
    if (lines.gk.length === 0 && players.length > 0) {
      lines.gk.push(players[0]);
    }

    return lines;
  };

  const homeLines = groupPlayersByLine(homeLineup);
  const awayLines = groupPlayersByLine(awayLineup);

  // Probability display logic
  const preHome = recalibrated?.preLineupProb?.home != null ? Number(recalibrated.preLineupProb.home) : (activeMatch?.prob?.home != null ? Number(activeMatch.prob.home) : null);
  const preDraw = recalibrated?.preLineupProb?.draw != null ? Number(recalibrated.preLineupProb.draw) : (activeMatch?.prob?.draw != null ? Number(activeMatch.prob.draw) : null);
  const preAway = recalibrated?.preLineupProb?.away != null ? Number(recalibrated.preLineupProb.away) : (activeMatch?.prob?.away != null ? Number(activeMatch.prob.away) : null);

  const calHome = recalibrated?.calibratedProb?.home != null ? Number(recalibrated.calibratedProb.home) : preHome;
  const calDraw = recalibrated?.calibratedProb?.draw != null ? Number(recalibrated.calibratedProb.draw) : preDraw;
  const calAway = recalibrated?.calibratedProb?.away != null ? Number(recalibrated.calibratedProb.away) : preAway;

  const homeShift = recalibrated?.shift?.homeShift != null ? recalibrated.shift.homeShift : (calHome && preHome ? Number((calHome - preHome).toFixed(1)) : 0);
  const drawShift = recalibrated?.shift?.drawShift != null ? recalibrated.shift.drawShift : (calDraw && preDraw ? Number((calDraw - preDraw).toFixed(1)) : 0);
  const awayShift = recalibrated?.shift?.awayShift != null ? recalibrated.shift.awayShift : (calAway && preAway ? Number((calAway - preAway).toFixed(1)) : 0);

  return (
    <div className="space-y-4">
      
      {/* Top Banner & Match Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-fixtures-btn"
              onClick={onBackToFixtures}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Tactical Lineup Analysis</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  isOfficial 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {isOfficial ? 'Official Confirmed Lineup' : 'Projected XI'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time starting XI scrape and engine probability recalibration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-lineup-btn"
              onClick={() => fetchLineup(true)}
              disabled={isRefreshing || isLoading}
              className="h-8 flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isRefreshing ? 'Scraping...' : 'Re-scrape XI'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline shrink-0">
              Select Match:
            </span>
            <UniformDropdown
              value={activeMatch ? (activeMatch.id || String(matches.indexOf(activeMatch))) : ''}
              onChange={handleMatchChange}
              options={matchOptions}
              className="w-full max-w-md"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium whitespace-nowrap">
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="text-indigo-700 font-bold">{homeFormation}</span> vs <span className="text-indigo-700 font-bold">{awayFormation}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              Starters: <strong className="text-slate-900">{homeLineup.length} / {awayLineup.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Fixture Probabilities Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {activeMatch?.league || lineupData?.league || 'League Match'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {(activeMatch?.timestamp || activeMatch?.utcDate || activeMatch?.dateIso || activeMatch?.date) 
                  ? formatRelativeDayTime(activeMatch.timestamp || activeMatch.utcDate || activeMatch.dateIso || activeMatch.date, tzSettings) 
                  : (activeMatch?.time || 'Upcoming')}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <span>{home}</span>
              <span className="text-slate-400 font-normal text-sm">vs</span>
              <span>{away}</span>
            </h2>
          </div>

          {/* Model Probabilities Before vs After Lineup */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-indigo-500" />
              <span>Dixon-Coles Recalibrated Probabilities</span>
            </div>
            <div className="flex items-center gap-2">
              
              {/* Home Win */}
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center min-w-[84px]">
                <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[80px]">{home}</div>
                <div className="text-sm font-bold font-mono text-emerald-700">
                  {calHome != null ? `${safeToFixed(calHome, 1)}%` : '—'}
                </div>
                {homeShift !== 0 && (
                  <div className={`text-[10px] font-mono font-bold ${homeShift > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {homeShift > 0 ? `+${homeShift}%` : `${homeShift}%`}
                  </div>
                )}
              </div>

              {/* Draw */}
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center min-w-[74px]">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Draw</div>
                <div className="text-sm font-bold font-mono text-amber-700">
                  {calDraw != null ? `${safeToFixed(calDraw, 1)}%` : '—'}
                </div>
                {drawShift !== 0 && (
                  <div className={`text-[10px] font-mono font-bold ${drawShift > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {drawShift > 0 ? `+${drawShift}%` : `${drawShift}%`}
                  </div>
                )}
              </div>

              {/* Away Win */}
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center min-w-[84px]">
                <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[80px]">{away}</div>
                <div className="text-sm font-bold font-mono text-blue-700">
                  {calAway != null ? `${safeToFixed(calAway, 1)}%` : '—'}
                </div>
                {awayShift !== 0 && (
                  <div className={`text-[10px] font-mono font-bold ${awayShift > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {awayShift > 0 ? `+${awayShift}%` : `${awayShift}%`}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Squad Strength Meters & Lineup Tactical Impact */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Starting XI Squad Strength Index &amp; Impact Analysis
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Evaluated against primary season starters, top scorers, and goalkeeper depth
          </span>
        </div>

        {/* Strength bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Home team strength */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-800">{home} Squad Strength</span>
              <span className="font-mono font-bold text-emerald-700">
                {impact?.homeSquadStrength != null ? `${impact.homeSquadStrength}%` : '100%'}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  (impact?.homeSquadStrength || 100) >= 90 ? 'bg-emerald-500' : (impact?.homeSquadStrength || 100) >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${impact?.homeSquadStrength || 100}%` }}
              />
            </div>
          </div>

          {/* Away team strength */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-800">{away} Squad Strength</span>
              <span className="font-mono font-bold text-blue-700">
                {impact?.awaySquadStrength != null ? `${impact.awaySquadStrength}%` : '100%'}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  (impact?.awaySquadStrength || 100) >= 90 ? 'bg-blue-500' : (impact?.awaySquadStrength || 100) >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${impact?.awaySquadStrength || 100}%` }}
              />
            </div>
          </div>

        </div>

        {/* Impact notes */}
        {impact?.notes && impact.notes.length > 0 ? (
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-950">Lineup Factors Detected:</span>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {impact.notes.map((note, nIdx) => (
                  <li key={nIdx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{impact?.summary || 'Standard full-strength starting lineups deployed with standard positional depth.'}</span>
          </div>
        )}
      </div>

      {/* Visual Controls Toolbar (Pitch vs List View Toggle) */}
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 px-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Shirt className="w-4 h-4 text-indigo-600" />
          <span>Starting Lineups Layout:</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            id="toggle-pitch-view"
            onClick={() => setViewMode('pitch')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'pitch'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tactical Pitch
          </button>
          <button
            id="toggle-list-view"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Detailed Roster
          </button>
        </div>
      </div>

      {/* Error display if API failed */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TACTICAL PITCH VIEW */}
      {viewMode === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* HOME TEAM PITCH */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {home} (Home)
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {homeFormation}
              </span>
            </div>

            {/* Pitch surface */}
            <div className="p-4 bg-emerald-900 relative overflow-hidden select-none min-h-[440px] flex flex-col justify-between"
                 style={{
                   backgroundImage: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, rgba(6, 78, 59, 0.9) 100%), repeating-linear-gradient(0deg, #064e3b 0px, #064e3b 40px, #065f46 40px, #065f46 80px)'
                 }}>
              
              {/* Pitch Markings */}
              <div className="absolute inset-2 border-2 border-emerald-400/40 rounded-lg pointer-events-none" />
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-emerald-400/40 -translate-y-1/2 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-emerald-400/40 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-t-0 border-emerald-400/40 rounded-b pointer-events-none" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-b-0 border-emerald-400/40 rounded-t pointer-events-none" />

              {isLoading ? (
                <div className="my-auto text-center text-emerald-200 py-20 relative z-10">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-emerald-300" />
                  <span className="text-xs font-medium">Calibrating tactical lineup...</span>
                </div>
              ) : homeLineup.length === 0 ? (
                <div className="my-auto text-center text-emerald-200 py-20 relative z-10 text-xs">
                  Starting lineup not yet available.
                </div>
              ) : (
                <div className="relative z-10 flex flex-col justify-between h-full space-y-4 py-2">
                  
                  {/* Forwards */}
                  <div className="flex justify-around items-center">
                    {homeLines.fwd.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-200 bg-emerald-950/70 px-1 rounded">
                          FWD
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Midfielders */}
                  <div className="flex justify-around items-center">
                    {homeLines.mid.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-200 bg-emerald-950/70 px-1 rounded">
                          MID
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Defenders */}
                  <div className="flex justify-around items-center">
                    {homeLines.def.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-200 bg-emerald-950/70 px-1 rounded">
                          DEF
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Goalkeeper */}
                  <div className="flex justify-center items-center">
                    {homeLines.gk.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-amber-200 bg-amber-950/70 px-1 rounded">
                          GK
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>

            {/* Substitutes row */}
            {homeSubstitutes.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs">
                <span className="font-bold text-slate-600 block mb-1.5 text-[11px] uppercase tracking-wider">
                  Bench ({homeSubstitutes.length} Substitutes):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {homeSubstitutes.map((sub, sIdx) => (
                    <span 
                      key={sIdx}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[11px] font-medium"
                    >
                      #{sub.jersey} {sub.shortName || sub.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AWAY TEAM PITCH */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {away} (Away)
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {awayFormation}
              </span>
            </div>

            {/* Pitch surface */}
            <div className="p-4 bg-slate-900 relative overflow-hidden select-none min-h-[440px] flex flex-col justify-between"
                 style={{
                   backgroundImage: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%), repeating-linear-gradient(0deg, #0f172a 0px, #0f172a 40px, #1e293b 40px, #1e293b 80px)'
                 }}>
              
              {/* Pitch Markings */}
              <div className="absolute inset-2 border-2 border-blue-400/40 rounded-lg pointer-events-none" />
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-blue-400/40 -translate-y-1/2 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-blue-400/40 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-t-0 border-blue-400/40 rounded-b pointer-events-none" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-b-0 border-blue-400/40 rounded-t pointer-events-none" />

              {isLoading ? (
                <div className="my-auto text-center text-blue-200 py-20 relative z-10">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-300" />
                  <span className="text-xs font-medium">Calibrating tactical lineup...</span>
                </div>
              ) : awayLineup.length === 0 ? (
                <div className="my-auto text-center text-blue-200 py-20 relative z-10 text-xs">
                  Starting lineup not yet available.
                </div>
              ) : (
                <div className="relative z-10 flex flex-col justify-between h-full space-y-4 py-2">
                  
                  {/* Forwards */}
                  <div className="flex justify-around items-center">
                    {awayLines.fwd.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-blue-200 bg-blue-950/70 px-1 rounded">
                          FWD
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Midfielders */}
                  <div className="flex justify-around items-center">
                    {awayLines.mid.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-blue-200 bg-blue-950/70 px-1 rounded">
                          MID
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Defenders */}
                  <div className="flex justify-around items-center">
                    {awayLines.def.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || idx + 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-blue-200 bg-blue-950/70 px-1 rounded">
                          DEF
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Goalkeeper */}
                  <div className="flex justify-center items-center">
                    {awayLines.gk.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center group cursor-pointer max-w-[80px]">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold font-mono text-xs flex items-center justify-center border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                          {p.jersey || 1}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md text-center truncate max-w-[76px]">
                          {p.shortName || p.name}
                        </span>
                        <span className="text-[9px] font-mono text-amber-200 bg-amber-950/70 px-1 rounded">
                          GK
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>

            {/* Substitutes row */}
            {awaySubstitutes.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs">
                <span className="font-bold text-slate-600 block mb-1.5 text-[11px] uppercase tracking-wider">
                  Bench ({awaySubstitutes.length} Substitutes):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {awaySubstitutes.map((sub, sIdx) => (
                    <span 
                      key={sIdx}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[11px] font-medium"
                    >
                      #{sub.jersey} {sub.shortName || sub.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* DETAILED ROSTER TABLE VIEW */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Home Lineup Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {home} (Home)
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {homeFormation}
              </span>
            </div>

            <div className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                  <span className="text-xs font-medium">Fetching roster &amp; lineup...</span>
                </div>
              ) : homeLineup.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs p-4">
                  <p>Starting lineup not yet registered in ESPN database.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Projected starting XI will update automatically 60 minutes before kickoff.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="hidden sm:table-header-group">
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider select-none h-8">
                      <th className="py-1.5 px-2 w-10 text-center">#</th>
                      <th className="py-1.5 px-3 min-w-[120px]">Player</th>
                      <th className="py-1.5 px-2 w-28 text-center">Position</th>
                      <th className="py-1.5 px-2 w-20 text-center">Role</th>
                      <th className="py-1.5 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="flex flex-col sm:table-row-group divide-y divide-slate-100">
                    {homeLineup.map((player, idx) => {
                      const playerKey = `home-${player.jersey || idx}-${player.name || idx}`;
                      const isExpanded = expandedPlayerKey === playerKey;

                      return (
                        <React.Fragment key={playerKey}>
                          <tr 
                            className={`flex flex-col sm:table-row hover:bg-slate-50/80 transition-colors sm:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                            onClick={() => togglePlayerExpand(playerKey)}
                          >
                            {/* Mobile Card */}
                            <td className="sm:hidden p-2.5 block">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-6 h-6 rounded font-mono text-xs font-bold text-slate-700 bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                    {player.jersey || idx + 1}
                                  </span>
                                  <div className="truncate">
                                    <div className="font-semibold text-slate-900 text-xs truncate">
                                      {player.name || player}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {player.shortName || player.name}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                    player.posAbbr === 'G' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    player.posAbbr === 'D' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                    player.posAbbr === 'M' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}>
                                    {player.posAbbr || player.position || 'Starter'}
                                  </span>
                                  <span className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </span>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2 rounded flex items-center justify-between">
                                  <span>Position: <strong>{player.position || 'Starter'}</strong></span>
                                  <span>Squad status: <strong className="text-emerald-700">Starting XI</strong></span>
                                </div>
                              )}
                            </td>

                            {/* Desktop 1-Row */}
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center font-mono font-bold text-slate-500">
                              {player.jersey || idx + 1}
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-3">
                              <span className="font-semibold text-slate-900 block truncate">
                                {player.name || player}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {player.shortName || player.name}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-block font-semibold ${
                                player.posAbbr === 'G' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                player.posAbbr === 'D' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                player.posAbbr === 'M' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                'bg-purple-50 text-purple-800 border-purple-200'
                              }`}>
                                {player.position || 'Starter'}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center text-[11px] text-slate-500 font-medium">
                              Starter
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center text-slate-400">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                            </td>
                          </tr>

                          {/* Desktop Expanded Detail */}
                          {isExpanded && (
                            <tr className="hidden sm:table-row bg-slate-50/70 border-b border-slate-200">
                              <td colSpan={5} className="py-2 px-3 text-[11px] text-slate-600">
                                <div className="flex items-center justify-between">
                                  <span>Full Squad Details: <strong>{player.name || player}</strong> &bull; {player.position || 'Starter'}</span>
                                  <span className="font-mono text-emerald-700 font-semibold">Confirmed Starter</span>
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

            {/* Substitutes */}
            {homeSubstitutes.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs">
                <span className="font-bold text-slate-600 block mb-1.5 text-[11px] uppercase tracking-wider">
                  Substitutes &amp; Bench ({homeSubstitutes.length}):
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {homeSubstitutes.map((sub, sIdx) => (
                    <div key={sIdx} className="p-1.5 rounded bg-white border border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="truncate text-slate-700 font-medium">
                        #{sub.jersey} {sub.shortName || sub.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {sub.posAbbr || 'SUB'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Away Lineup Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {away} (Away)
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {awayFormation}
              </span>
            </div>

            <div className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                  <span className="text-xs font-medium">Fetching roster &amp; lineup...</span>
                </div>
              ) : awayLineup.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs p-4">
                  <p>Starting lineup not yet registered in ESPN database.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Projected starting XI will update automatically 60 minutes before kickoff.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="hidden sm:table-header-group">
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider select-none h-8">
                      <th className="py-1.5 px-2 w-10 text-center">#</th>
                      <th className="py-1.5 px-3 min-w-[120px]">Player</th>
                      <th className="py-1.5 px-2 w-28 text-center">Position</th>
                      <th className="py-1.5 px-2 w-20 text-center">Role</th>
                      <th className="py-1.5 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="flex flex-col sm:table-row-group divide-y divide-slate-100">
                    {awayLineup.map((player, idx) => {
                      const playerKey = `away-${player.jersey || idx}-${player.name || idx}`;
                      const isExpanded = expandedPlayerKey === playerKey;

                      return (
                        <React.Fragment key={playerKey}>
                          <tr 
                            className={`flex flex-col sm:table-row hover:bg-slate-50/80 transition-colors sm:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                            onClick={() => togglePlayerExpand(playerKey)}
                          >
                            {/* Mobile Card */}
                            <td className="sm:hidden p-2.5 block">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-6 h-6 rounded font-mono text-xs font-bold text-slate-700 bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                    {player.jersey || idx + 1}
                                  </span>
                                  <div className="truncate">
                                    <div className="font-semibold text-slate-900 text-xs truncate">
                                      {player.name || player}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {player.shortName || player.name}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                    player.posAbbr === 'G' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    player.posAbbr === 'D' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                    player.posAbbr === 'M' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}>
                                    {player.posAbbr || player.position || 'Starter'}
                                  </span>
                                  <span className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </span>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2 rounded flex items-center justify-between">
                                  <span>Position: <strong>{player.position || 'Starter'}</strong></span>
                                  <span>Squad status: <strong className="text-blue-700">Starting XI</strong></span>
                                </div>
                              )}
                            </td>

                            {/* Desktop 1-Row */}
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center font-mono font-bold text-slate-500">
                              {player.jersey || idx + 1}
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-3">
                              <span className="font-semibold text-slate-900 block truncate">
                                {player.name || player}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {player.shortName || player.name}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-block font-semibold ${
                                player.posAbbr === 'G' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                player.posAbbr === 'D' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                player.posAbbr === 'M' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                'bg-purple-50 text-purple-800 border-purple-200'
                              }`}>
                                {player.position || 'Starter'}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center text-[11px] text-slate-500 font-medium">
                              Starter
                            </td>
                            <td className="hidden sm:table-cell py-1.5 px-2 text-center text-slate-400">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                            </td>
                          </tr>

                          {/* Desktop Expanded Detail */}
                          {isExpanded && (
                            <tr className="hidden sm:table-row bg-slate-50/70 border-b border-slate-200">
                              <td colSpan={5} className="py-2 px-3 text-[11px] text-slate-600">
                                <div className="flex items-center justify-between">
                                  <span>Full Squad Details: <strong>{player.name || player}</strong> &bull; {player.position || 'Starter'}</span>
                                  <span className="font-mono text-blue-700 font-semibold">Confirmed Starter</span>
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

            {/* Substitutes */}
            {awaySubstitutes.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs">
                <span className="font-bold text-slate-600 block mb-1.5 text-[11px] uppercase tracking-wider">
                  Substitutes &amp; Bench ({awaySubstitutes.length}):
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {awaySubstitutes.map((sub, sIdx) => (
                    <div key={sIdx} className="p-1.5 rounded bg-white border border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="truncate text-slate-700 font-medium">
                        #{sub.jersey} {sub.shortName || sub.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {sub.posAbbr || 'SUB'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
