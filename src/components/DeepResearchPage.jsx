import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  ArrowLeft, 
  RefreshCw, 
  Sparkles, 
  Target, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  ArrowRight,
  ShieldCheck,
  Activity,
  Clock,
  BarChart3,
  Flame,
  Zap,
  Award
} from 'lucide-react';
import Markdown from 'react-markdown';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed, formatScore } from '../utils/numberUtils';
import { formatRelativeDayTime } from '../utils/dateUtils';

export default function DeepResearchPage({
  matches = [],
  selectedMatch = null,
  onSelectMatch,
  onBackToFixtures,
  onPatchSuccess,
  tzSettings
}) {
  const [activeMatch, setActiveMatch] = useState(selectedMatch || matches[0] || null);
  const [researchData, setResearchData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [patchResult, setPatchResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync prop changes
  useEffect(() => {
    if (selectedMatch) {
      setActiveMatch(selectedMatch);
    } else if (!activeMatch && matches.length > 0) {
      setActiveMatch(matches[0]);
    }
  }, [selectedMatch, matches]);

  // Fetch deep research for active match
  useEffect(() => {
    if (!activeMatch) return;

    let isMounted = true;
    const fetchResearch = async () => {
      setIsLoading(true);
      setError(null);
      setResearchData(null);
      setPatchResult(null);

      try {
        const res = await fetch('/api/deep-ai-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: activeMatch.id,
            home: activeMatch.home,
            away: activeMatch.away,
            league: activeMatch.league,
            actualScore: activeMatch.actualScore || (activeMatch.homeScore !== undefined ? `${activeMatch.homeScore}-${activeMatch.awayScore}` : null),
            predictedScore: activeMatch.predictedScore || activeMatch.mostLikelyScore,
            predictedWinner: activeMatch.predictedWinner || activeMatch.pick,
            actualWinner: activeMatch.actualWinner
          })
        });
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.research) {
            setResearchData(data.research);
          } else {
            setError(data.error || 'Unable to retrieve deep AI forensics for this fixture.');
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchResearch();
    return () => { isMounted = false; };
  }, [activeMatch]);

  const matchOptions = matches.map((m, idx) => {
    const timeDisplay = formatRelativeDayTime(m, tzSettings);
    return {
      value: String(m.id || idx),
      label: `${timeDisplay} | ${m.home} vs ${m.away} (${m.league?.split(' ')[0] || 'Match'})`
    };
  });

  const handleMatchChange = (matchId) => {
    const found = matches.find(m => String(m.id || matches.indexOf(m)) === String(matchId));
    if (found) {
      setActiveMatch(found);
      if (onSelectMatch) onSelectMatch(found);
    }
  };

  const handleApplySingleMatchPatch = async () => {
    if (!activeMatch) return;
    setIsPatching(true);
    try {
      const res = await fetch('/api/autonomous-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxMatches: 1,
          targetMatchId: activeMatch.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setPatchResult(data.result || { summary: 'Statistical parameters adjusted.' });
        if (onPatchSuccess) onPatchSuccess();
      } else {
        setError(data.error || 'Failed to apply patch.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPatching(false);
    }
  };

  const tactical = researchData?.tacticalDiagnosis;
  const clash = researchData?.analytics?.tacticalClash;
  const deltas = researchData?.parameterDeltas;
  const boxScore = researchData?.boxScore;
  const timeline = researchData?.timeline || [];
  const forensics = researchData?.lossForensics;
  const teamTrends = researchData?.teamTrends;

  return (
    <div className="space-y-4">
      
      {/* Top Navigation & Match Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToFixtures}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Fixtures</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
              Forensic Target:
            </span>
            <UniformDropdown
              value={activeMatch ? String(activeMatch.id || matches.indexOf(activeMatch)) : ''}
              onChange={handleMatchChange}
              options={matchOptions}
              className="w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-semibold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-teal-600" />
            <span>Super Football Analyst Forensics</span>
          </span>
        </div>

      </div>

      {/* Header Match Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                {activeMatch?.league || 'Football Competition'}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatRelativeDayTime(activeMatch, tzSettings)}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1">
              {activeMatch?.home} <span className="text-slate-400 font-normal">vs</span> {activeMatch?.away}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>Predicted Pick: <strong className="text-slate-800">{activeMatch?.predictedWinner || 'Home'}</strong></span>
              <span>•</span>
              <span>Model Conf: <strong className="text-indigo-700 font-mono">{activeMatch?.confidence != null ? `${safeToFixed(activeMatch.confidence, 0)}%` : '72%'}</strong></span>
              {activeMatch?.actualScore && (
                <>
                  <span>•</span>
                  <span>Actual Score: <strong className="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{formatScore(activeMatch.actualScore)}</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Recalibrate / Apply Patch Button */}
          <div>
            <button
              onClick={handleApplySingleMatchPatch}
              disabled={isPatching || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isPatching ? 'animate-spin' : ''}`} />
              <span>{isPatching ? 'Applying Patch...' : 'Auto-Patch Statistical Parameters'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Patch Result Banner if applied */}
      {patchResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 shadow-xs text-xs text-emerald-900 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-emerald-950">Autonomous Patch Applied to Master Engine</h4>
            <p className="mt-0.5 text-emerald-800 leading-relaxed">
              {patchResult.summary || 'Team ratings and tactical parameters recalibrated based on forensic diagnosis.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Research Content */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">Crunching Match Data</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Analyzing box-score statistics, pitch dynamics, pressing traps, referee strictness, and team trend profiles...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs text-xs">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
          <h4 className="font-bold text-slate-800 text-sm">Analysis Unavailable</h4>
          <p className="text-slate-500 mt-1">{error}</p>
        </div>
      ) : researchData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Tactical Forensics & Box-Score (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            
            {/* 1. EXECUTIVE LOSS FORENSICS CARD */}
            {forensics && (
              <div className="bg-white border border-amber-200 rounded-xl p-4 sm:p-5 shadow-xs bg-gradient-to-br from-amber-50/50 via-white to-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-600" />
                    {forensics.losingTeam ? `Tactical Post-Mortem: How ${forensics.losingTeam} Lost` : `Match Parity Breakdown`}
                  </span>
                  {forensics.lossArchetype && (
                    <span className="text-[10px] font-mono text-slate-600 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {forensics.lossArchetype.split('_').join(' ')}
                    </span>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">
                  {forensics.primaryLossReason}
                </h3>

                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                  <p>{forensics.howTheyLost}</p>
                </div>

                {forensics.turningPoint && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-3 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[11px] uppercase tracking-wider font-bold text-amber-950">Decisive Turning Point:</strong>
                      <span>{forensics.turningPoint}</span>
                    </div>
                  </div>
                )}

                {forensics.tacticalFlaws && forensics.tacticalFlaws.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Structural Vulnerabilities:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {forensics.tacticalFlaws.map((flaw, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200 text-slate-700 text-[11px]">
                          <span className="text-rose-600 font-bold shrink-0">✕</span>
                          <span>{flaw}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. REAL BOX-SCORE STATISTICAL COMPARISON */}
            {boxScore && boxScore.home && boxScore.away && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
                    Actual Match Box-Score Comparison
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Real Feed Data</span>
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Possession */}
                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="font-bold text-teal-700">{boxScore.home.possession}% {activeMatch?.home}</span>
                      <span className="text-slate-400">Possession</span>
                      <span className="font-bold text-indigo-700">{boxScore.away.possession}% {activeMatch?.away}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                      <div className="bg-teal-500 h-full" style={{ width: `${boxScore.home.possession}%` }} />
                      <div className="bg-indigo-500 h-full" style={{ width: `${boxScore.away.possession}%` }} />
                    </div>
                  </div>

                  {/* Expected Goals */}
                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="font-bold text-teal-700">{boxScore.home.xG} xG</span>
                      <span className="text-slate-400">Expected Goals (xG)</span>
                      <span className="font-bold text-indigo-700">{boxScore.away.xG} xG</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                      {(() => {
                        const totalXg = (boxScore.home.xG + boxScore.away.xG) || 1;
                        const hPct = (boxScore.home.xG / totalXg) * 100;
                        return (
                          <>
                            <div className="bg-teal-500 h-full" style={{ width: `${hPct}%` }} />
                            <div className="bg-indigo-500 h-full" style={{ width: `${100 - hPct}%` }} />
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stat Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center font-mono">
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Shots (Target)</span>
                      <span className="text-slate-800 font-bold">
                        {boxScore.home.shots} ({boxScore.home.shotsOnTarget}) vs {boxScore.away.shots} ({boxScore.away.shotsOnTarget})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Corners</span>
                      <span className="text-slate-800 font-bold">
                        {boxScore.home.corners} vs {boxScore.away.corners}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Saves</span>
                      <span className="text-slate-800 font-bold">
                        {boxScore.home.saves} vs {boxScore.away.saves}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Fouls &amp; Cards</span>
                      <span className="text-slate-800 font-bold">
                        {boxScore.home.fouls} ({boxScore.home.yellowCards}🟨) vs {boxScore.away.fouls} ({boxScore.away.yellowCards}🟨)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TIMELINE */}
            {timeline && timeline.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Match Event Timeline
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {timeline.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                        item.type === 'GOAL'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <span className="font-mono font-bold">{item.minute}</span>
                      <span>{item.type === 'GOAL' ? '⚽' : '🟥'}</span>
                      <span className="font-semibold">{item.player}</span>
                      <span className="text-[10px] text-slate-500">({item.team})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. EVOLVING TEAM TRENDS */}
            {teamTrends && (teamTrends.home || teamTrends.away) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamTrends.home && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase block">Evolving Trend Profile</span>
                        <strong className="text-slate-900 text-sm">{teamTrends.home.team}</strong>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {teamTrends.home.badge || '⚔️ Competitive'}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Identity:</span>
                        <span className="font-semibold text-slate-800">{teamTrends.home.tacticalIdentity}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Late Capitulation Risk:</span>
                        <span className={`font-bold font-mono ${
                          teamTrends.home.tacticalIndices?.lateCapitulationRisk === 'CRITICAL' ? 'text-rose-600' :
                          teamTrends.home.tacticalIndices?.lateCapitulationRisk === 'HIGH' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {teamTrends.home.tacticalIndices?.lateCapitulationRisk || 'LOW'}
                        </span>
                      </div>
                      {teamTrends.home.recurringWinDrivers && teamTrends.home.recurringWinDrivers[0] && (
                        <div className="p-2 rounded bg-teal-50/70 border border-teal-100 text-teal-900 mt-2">
                          <span className="font-bold text-[10px] uppercase block text-teal-800">Win Driver:</span>
                          {teamTrends.home.recurringWinDrivers[0]}
                        </div>
                      )}
                      {teamTrends.home.recurringLossDrivers && teamTrends.home.recurringLossDrivers[0] && (
                        <div className="p-2 rounded bg-rose-50/70 border border-rose-100 text-rose-900 mt-1">
                          <span className="font-bold text-[10px] uppercase block text-rose-800">Vulnerability:</span>
                          {teamTrends.home.recurringLossDrivers[0]}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {teamTrends.away && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase block">Evolving Trend Profile</span>
                        <strong className="text-slate-900 text-sm">{teamTrends.away.team}</strong>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {teamTrends.away.badge || '⚔️ Competitive'}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Identity:</span>
                        <span className="font-semibold text-slate-800">{teamTrends.away.tacticalIdentity}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Late Capitulation Risk:</span>
                        <span className={`font-bold font-mono ${
                          teamTrends.away.tacticalIndices?.lateCapitulationRisk === 'CRITICAL' ? 'text-rose-600' :
                          teamTrends.away.tacticalIndices?.lateCapitulationRisk === 'HIGH' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {teamTrends.away.tacticalIndices?.lateCapitulationRisk || 'LOW'}
                        </span>
                      </div>
                      {teamTrends.away.recurringWinDrivers && teamTrends.away.recurringWinDrivers[0] && (
                        <div className="p-2 rounded bg-teal-50/70 border border-teal-100 text-teal-900 mt-2">
                          <span className="font-bold text-[10px] uppercase block text-teal-800">Win Driver:</span>
                          {teamTrends.away.recurringWinDrivers[0]}
                        </div>
                      )}
                      {teamTrends.away.recurringLossDrivers && teamTrends.away.recurringLossDrivers[0] && (
                        <div className="p-2 rounded bg-rose-50/70 border border-rose-100 text-rose-900 mt-1">
                          <span className="font-bold text-[10px] uppercase block text-rose-800">Vulnerability:</span>
                          {teamTrends.away.recurringLossDrivers[0]}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. TACTICAL CLASH */}
            {clash && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Tactical Stylistic Clash Matrix
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-800 mb-1">{activeMatch?.home} Style</div>
                    <p className="text-[11px] text-slate-600">{clash.homeStyle || 'High-press possession with vertical wing overloads'}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-800 mb-1">{activeMatch?.away} Style</div>
                    <p className="text-[11px] text-slate-600">{clash.awayStyle || 'Compact low-block defensive shape with direct counter transition'}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sidebar Parameters & Adjustments (1 col) */}
          <div className="space-y-4">
            
            {/* Calibrated Parameter Adjustments */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-xs">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Forensic Parameter Adjustments</span>
              </h4>

              <div className="space-y-2 divide-y divide-slate-100">
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Home Attack Factor:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {deltas?.homeAttackDelta != null ? `${safeParseFloat(deltas.homeAttackDelta, 0) > 0 ? '+' : ''}${safeToFixed(deltas.homeAttackDelta, 2)}` : '+0.05'}
                  </span>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Home Defense Factor:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {deltas?.homeDefenseDelta != null ? `${safeParseFloat(deltas.homeDefenseDelta, 0) > 0 ? '+' : ''}${safeToFixed(deltas.homeDefenseDelta, 2)}` : '+0.05'}
                  </span>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Away Attack Factor:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {deltas?.awayAttackDelta != null ? `${safeParseFloat(deltas.awayAttackDelta, 0) > 0 ? '+' : ''}${safeToFixed(deltas.awayAttackDelta, 2)}` : '+0.06'}
                  </span>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Away Defense Factor:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {deltas?.awayDefenseDelta != null ? `${safeParseFloat(deltas.awayDefenseDelta, 0) > 0 ? '+' : ''}${safeToFixed(deltas.awayDefenseDelta, 2)}` : '-0.04'}
                  </span>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Referee Strictness Impact:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {activeMatch?.referee?.strictness ? `${activeMatch.referee.strictness}/10` : '5/10'}
                  </span>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-slate-600">Low-Score Dependency (Tau):</span>
                  <span className="font-mono font-bold text-indigo-700">
                    0.245
                  </span>
                </div>
              </div>
            </div>

            {/* Key Star Absence Gravity */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-xs">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Key Squad Gravity Checks
              </h4>
              {activeMatch?.missingPlayers && activeMatch.missingPlayers.length > 0 ? (
                <div className="space-y-1.5">
                  {activeMatch.missingPlayers.map((p, idx) => (
                    <div key={idx} className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800">
                      <strong>{p.name || p}</strong> ({p.role || 'Key Starter'}) — Absent
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">No high-gravity player absences identified.</p>
              )}
            </div>

          </div>

        </div>
      ) : null}

    </div>
  );
}
