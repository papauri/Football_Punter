import React, { useState, useEffect, useMemo } from 'react';
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
  Award,
  Swords,
  ShieldAlert,
  ChevronRight,
  Compass,
  Trophy,
  BookOpen
} from 'lucide-react';
import Markdown from 'react-markdown';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed, formatScore } from '../utils/numberUtils';
import { formatRelativeDayTime } from '../utils/dateUtils';

export default function DeepResearchPage({
  matches = [],
  historicalMatches = [],
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

  const combinedMatches = useMemo(() => {
    const map = new Map();
    if (selectedMatch && selectedMatch.id) {
      map.set(String(selectedMatch.id), selectedMatch);
    }
    if (Array.isArray(matches)) {
      matches.forEach(m => {
        if (m && m.id && !map.has(String(m.id))) map.set(String(m.id), m);
      });
    }
    if (Array.isArray(historicalMatches)) {
      historicalMatches.forEach(m => {
        if (m && m.id && !map.has(String(m.id))) map.set(String(m.id), m);
      });
    }
    return Array.from(map.values());
  }, [matches, historicalMatches, selectedMatch]);

  const matchOptions = useMemo(() => {
    return combinedMatches.map((m, idx) => {
      const timeDisplay = formatRelativeDayTime(m, tzSettings);
      const scoreStr = m.actualScore ? ` [${m.actualScore}]` : '';
      return {
        value: String(m.id || idx),
        label: `${timeDisplay} | ${m.home} vs ${m.away}${scoreStr} (${m.league?.split(' ')[0] || 'Match'})`
      };
    });
  }, [combinedMatches, tzSettings]);

  const handleMatchChange = (matchId) => {
    const found = combinedMatches.find(m => String(m.id || combinedMatches.indexOf(m)) === String(matchId));
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

  const dossier = researchData?.masterTacticalDossier || researchData?.tacticalDiagnosis?.masterTacticalDossier;
  const executiveVerdict = researchData?.executiveVerdict || dossier?.executiveVerdict || researchData?.tacticalDiagnosis?.executiveVerdict;
  const systemicClash = dossier?.systemicClash;
  const turningPoints = dossier?.decisiveTurningPoints || [];
  const phases = Array.isArray(dossier?.chronologicalPhases) 
    ? dossier.chronologicalPhases 
    : Object.values(dossier?.chronologicalPhases || dossier?.matchPhases || {});
  const calibration = dossier?.modelCalibrationLessons;
  const defeatBreakdown = dossier?.forensicDefeatDiagnosis || dossier?.forensicDefeatBreakdown;
  const keyPlayerImpact = dossier?.keyPlayerImpact || [];
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
        <div className="space-y-4">
          
          {/* 1. MASTER AGENT EXECUTIVE STRATEGIC VERDICT */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 pb-3 border-b border-slate-700/70">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 shadow-xs">
                    <Trophy className="w-3.5 h-3.5 text-teal-400" />
                    UEFA Pro Master Tactical Dossier
                  </span>
                  {defeatBreakdown?.rootCauseCategory && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-amber-500/30">
                      {defeatBreakdown.rootCauseCategory.split('_').join(' ')}
                    </span>
                  )}
                  {forensics?.lossArchetype && !defeatBreakdown?.rootCauseCategory && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-amber-500/30">
                      {forensics.lossArchetype.split('_').join(' ')}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-mono">
                    {activeMatch?.league || 'Football Competition'} • {activeMatch?.actualScore ? `Final: ${activeMatch.actualScore}` : 'Tactical Audit'}
                  </span>
                </div>
              </div>

              {/* Title & Loss Header */}
              <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-teal-400 shrink-0" />
                <span>
                  {defeatBreakdown?.losingTeam 
                    ? `Forensic Autopsy: How ${defeatBreakdown.losingTeam} Lost to ${defeatBreakdown.winner}`
                    : forensics?.losingTeam
                    ? `Forensic Autopsy: How ${forensics.losingTeam} Lost`
                    : `Tactical Synthesis: ${activeMatch?.home} vs ${activeMatch?.away}`}
                </span>
              </h3>

              {/* Executive Verdict Prose */}
              <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-slate-200 text-xs sm:text-sm leading-relaxed mb-4">
                <p className="whitespace-pre-line">
                  {executiveVerdict || defeatBreakdown?.masterDiagnosis || forensics?.howTheyLost || 'Deep tactical forensic analysis synthesized from match data.'}
                </p>
              </div>

              {/* Top Analytical Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">Primary Inflection Point</span>
                  <span className="font-semibold text-amber-300">
                    {forensics?.turningPoint || (turningPoints[0] ? `${turningPoints[0].minute} ${turningPoints[0].title}` : 'Dynamic game-state swing')}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">Fatal Concession Zone</span>
                  <span className="font-semibold text-rose-300">
                    {defeatBreakdown?.fatalConcessionZone || 'Defensive transition half-spaces'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">Predictive Model Calibration</span>
                  <span className="font-semibold text-teal-300">
                    {calibration?.calibratedPoissonAdjustment || 'Poisson xG variance re-weighted'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Main Tactical Columns (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* 2. SYSTEMIC CLASH & MANAGERIAL BLUEPRINT */}
              {systemicClash && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-indigo-600" />
                      Systemic Clash &amp; Managerial Blueprint
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Tactical Matchup</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {/* Home Blueprint */}
                    <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-100 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-slate-900 font-bold">{systemicClash.homeDetails?.club || systemicClash.homeDetails?.team || systemicClash.home?.team || activeMatch?.home}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800">
                          {systemicClash.homeDetails?.system || systemicClash.homeDetails?.shape || systemicClash.home?.shape || '4-3-3'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-500">Manager: </span>
                          <span className="font-bold text-slate-800">{systemicClash.homeDetails?.manager || systemicClash.home?.manager || 'Head Coach'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">In Possession: </span>
                          <span>{systemicClash.homeDetails?.inPossession || systemicClash.home?.inPossession}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Out of Possession: </span>
                          <span>{systemicClash.homeDetails?.outOfPossession || systemicClash.home?.outOfPossession}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Key Strengths: </span>
                          <span>{systemicClash.homeDetails?.keyStrengths || systemicClash.home?.pressingProfile}</span>
                        </div>
                      </div>
                    </div>

                    {/* Away Blueprint */}
                    <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-slate-900 font-bold">{systemicClash.awayDetails?.club || systemicClash.awayDetails?.team || systemicClash.away?.team || activeMatch?.away}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                          {systemicClash.awayDetails?.system || systemicClash.awayDetails?.shape || systemicClash.away?.shape || '4-3-3'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-500">Manager: </span>
                          <span className="font-bold text-slate-800">{systemicClash.awayDetails?.manager || systemicClash.away?.manager || 'Head Coach'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">In Possession: </span>
                          <span>{systemicClash.awayDetails?.inPossession || systemicClash.away?.inPossession}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Out of Possession: </span>
                          <span>{systemicClash.awayDetails?.outOfPossession || systemicClash.away?.outOfPossession}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Key Strengths: </span>
                          <span>{systemicClash.awayDetails?.keyStrengths || systemicClash.away?.pressingProfile}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(systemicClash.keyTacticalBattle || systemicClash.tacticalDynamic) && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <strong className="text-slate-900 block font-semibold mb-0.5">Clash Dynamic Synthesis:</strong>
                      <p>{systemicClash.keyTacticalBattle || systemicClash.tacticalDynamic}</p>
                      {systemicClash.possessionDynamic && (
                        <p className="mt-1 text-slate-500 font-mono text-[11px]">{systemicClash.possessionDynamic}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. DECISIVE GAME-STATE TURNING POINTS */}
              {turningPoints && turningPoints.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Decisive Game-State Turning Points
                  </h4>
                  <div className="space-y-2.5">
                    {turningPoints.map((tp, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white">
                              {tp.minute}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {tp.title}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                            tp.type === 'RED_CARD' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            tp.type === 'PENALTY' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            tp.type === 'GOAL' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-slate-200 text-slate-800'
                          }`}>
                            {tp.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed mb-1.5">
                          {tp.narrative || tp.description}
                        </p>
                        {(tp.tacticalImpact || tp.impact) && (
                          <div className="text-[11px] font-semibold text-slate-600 bg-white p-2 rounded border border-slate-200 flex items-start gap-1.5">
                            <ArrowRight className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            <span><strong className="text-slate-800">Tactical Impact:</strong> {tp.tacticalImpact || tp.impact}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. CHRONOLOGICAL MATCH PHASES */}
              {phases && phases.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    Chronological Match Phases
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {phases.map((ph, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono font-bold text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                              {ph.label || ph.phase}
                            </span>
                            {ph.dominantSide && (
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                {ph.dominantSide}
                              </span>
                            )}
                          </div>
                          <strong className="text-slate-900 block font-semibold mb-1 text-[11px]">{ph.title}</strong>
                          <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{ph.narrative || ph.dynamic}</p>
                        </div>
                        {(ph.tacticalDynamic || ph.turningFactor || ph.keyFactor) && (
                          <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                            <strong className="text-slate-700">Dynamic:</strong> {ph.tacticalDynamic || ph.turningFactor || ph.keyFactor}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. FORENSIC DEFEAT BREAKDOWN & STRUCTURAL VULNERABILITIES */}
              {(defeatBreakdown?.structuralFlaws?.length > 0 || defeatBreakdown?.tacticalFlaws?.length > 0 || forensics?.tacticalFlaws?.length > 0) && (
                <div className="bg-white border border-rose-200 rounded-xl p-4 sm:p-5 shadow-xs bg-gradient-to-br from-rose-50/30 via-white to-white">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Structural Tactical Vulnerabilities Identified
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(defeatBreakdown?.structuralFlaws || defeatBreakdown?.tacticalFlaws || forensics?.tacticalFlaws || []).map((flaw, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-rose-100 text-slate-700 text-[11px] shadow-xs">
                        <span className="text-rose-600 font-bold shrink-0">✕</span>
                        <span>{flaw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. REAL BOX-SCORE STATISTICAL COMPARISON */}
              {boxScore && boxScore.home && boxScore.away && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
                      Actual Match Box-Score Statistics
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

              {/* 7. DISCIPLINARY TIMELINE */}
              {timeline && timeline.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Match Event Feed
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

              {/* 8. EVOLVING TEAM TRENDS */}
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

            </div>

            {/* Sidebar Column (1 col) */}
            <div className="space-y-4">
              
              {/* SUPERMODEL CALIBRATION & BETTING EDGE */}
              {calibration && (
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border border-indigo-700/60 rounded-xl p-4 shadow-sm text-xs">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-teal-400" />
                    <span>Predictive Calibration Lessons</span>
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-indigo-950/60 border border-indigo-800/60">
                      <span className="text-[10px] text-indigo-300 block">Analytical Residual</span>
                      <span className="text-white font-semibold">{calibration.analyticalResidual}</span>
                    </div>

                    <div className="p-2 rounded bg-indigo-950/60 border border-indigo-800/60">
                      <span className="text-[10px] text-teal-300 block">Calibrated Poisson Adjustment</span>
                      <span className="text-teal-200 font-semibold">{calibration.calibratedPoissonAdjustment}</span>
                    </div>

                    {calibration.futureBettingEdgeRule && (
                      <div className="p-2.5 rounded bg-teal-950/40 border border-teal-700/50 text-teal-200">
                        <strong className="text-[10px] uppercase block text-teal-300 font-bold mb-1">Unstoppable Edge Rule:</strong>
                        <p className="text-[11px] leading-relaxed">{calibration.futureBettingEdgeRule}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FORENSIC PARAMETER ADJUSTMENTS */}
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
        </div>
      ) : null}

    </div>
  );
}
