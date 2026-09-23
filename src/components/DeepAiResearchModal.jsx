import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  Activity, 
  Target, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Sliders, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  RefreshCw,
  Clock,
  TrendingUp,
  Flame,
  ShieldAlert,
  BarChart3,
  Zap,
  Award
} from 'lucide-react';
import Markdown from 'react-markdown';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';
import { formatRelativeDayTime } from '../utils/dateUtils';

export default function DeepAiResearchModal({ match, onClose, onPatchSuccess, tzSettings }) {
  const [researchData, setResearchData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPatching, setIsPatching] = useState(false);
  const [patchResult, setPatchResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!match) return;

    let isMounted = true;
    const fetchResearch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/deep-ai-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: match.id,
            home: match.home,
            away: match.away,
            league: match.league,
            actualScore: match.actualScore || (match.homeScore !== undefined ? `${match.homeScore}-${match.awayScore}` : null),
            predictedScore: match.predictedScore || match.mostLikelyScore,
            predictedWinner: match.predictedWinner || match.pick,
            actualWinner: match.actualWinner
          })
        });
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.research) {
            setResearchData(data.research);
          } else {
            setError(data.error || 'Unable to complete AI game research.');
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
  }, [match]);

  const handleApplySingleMatchPatch = async () => {
    if (!match) return;
    setIsPatching(true);
    try {
      const res = await fetch('/api/autonomous-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxMatches: 1,
          targetMatchId: match.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setPatchResult(data.result || { summary: 'Patch applied successfully' });
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

  if (!match) return null;

  const archetype = researchData?.archetype || researchData?.lossForensics?.lossArchetype || researchData?.tacticalDiagnosis?.primaryRootCause;
  const tactical = researchData?.tacticalDiagnosis;
  const clash = researchData?.analytics?.tacticalClash;
  const deltas = researchData?.parameterDeltas;
  const boxScore = researchData?.boxScore;
  const timeline = researchData?.timeline || [];
  const forensics = researchData?.lossForensics;
  const teamTrends = researchData?.teamTrends;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-600/30 flex items-center justify-center text-emerald-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {match.league || 'Soccer League'}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" />
                  Super Football Analyst Forensics
                </span>
                {(match.date || match.time || match.utcDate || match.dateIso) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    {formatRelativeDayTime(match, tzSettings)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {match.home} <span className="text-slate-500 font-normal">vs</span> {match.away}
                </h3>
                {researchData?.actualScore && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-sm border border-slate-700">
                    FT: {researchData.actualScore}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin" />
              <span className="text-sm font-semibold text-slate-200">
                Crunching Box-Score Statistics &amp; Tactical Forensics...
              </span>
              <p className="text-xs text-slate-500 max-w-md text-center">
                Ingesting possession percentages, shot maps, expected goals (xG), referee strictness, and historical team trend profiles.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="w-4 h-4" />
                Error Performing Research
              </div>
              <p>{error}</p>
            </div>
          ) : researchData ? (
            <div className="space-y-4">
              
              {/* 1. EXECUTIVE FORENSIC LOSS CARD ("How The Team Actually Lost") */}
              {forensics && (
                <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-400" />
                          {forensics.losingTeam ? `Root Cause: How ${forensics.losingTeam} Lost` : `Draw Equilibrium Post-Mortem`}
                        </span>
                        {forensics.lossArchetype && (
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                            {forensics.lossArchetype.split('_').join(' ')}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white mt-1.5 leading-snug">
                        {forensics.primaryLossReason}
                      </h4>
                    </div>
                  </div>

                  {/* Super Analyst Prose */}
                  <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 mb-3">
                    <p>{forensics.howTheyLost}</p>
                  </div>

                  {/* Turning point highlight */}
                  {forensics.turningPoint && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 mb-3 flex items-start gap-2.5">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300 font-semibold block text-[11px] uppercase tracking-wide">Decisive Match Turning Point</strong>
                        <span>{forensics.turningPoint}</span>
                      </div>
                    </div>
                  )}

                  {/* Tactical Flaws Checklist */}
                  {forensics.tacticalFlaws && forensics.tacticalFlaws.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Structural Breakdown Factors:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {forensics.tacticalFlaws.map((flaw, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-300 text-[11px]">
                            <span className="text-rose-400 font-bold shrink-0">✕</span>
                            <span>{flaw}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. REAL BOX-SCORE STATISTICAL COMPARISON GRID */}
              {boxScore && boxScore.home && boxScore.away && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                      Actual Match Box-Score Comparison
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Real Match Feeds</span>
                  </h4>

                  {/* Stat comparison rows */}
                  <div className="space-y-2.5 text-xs">
                    {/* Possession */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold text-emerald-400">{boxScore.home.possession}% {match.home}</span>
                        <span className="text-slate-400">Possession</span>
                        <span className="font-bold text-sky-400">{boxScore.away.possession}% {match.away}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${boxScore.home.possession}%` }} />
                        <div className="bg-sky-500 h-full" style={{ width: `${boxScore.away.possession}%` }} />
                      </div>
                    </div>

                    {/* Expected Goals xG */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold text-emerald-400">{boxScore.home.xG} xG</span>
                        <span className="text-slate-400">Expected Goals (xG)</span>
                        <span className="font-bold text-sky-400">{boxScore.away.xG} xG</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        {(() => {
                          const totalXg = (boxScore.home.xG + boxScore.away.xG) || 1;
                          const hPct = (boxScore.home.xG / totalXg) * 100;
                          return (
                            <>
                              <div className="bg-emerald-500 h-full" style={{ width: `${hPct}%` }} />
                              <div className="bg-sky-500 h-full" style={{ width: `${100 - hPct}%` }} />
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Stat Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center font-mono">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Shots (Target)</span>
                        <span className="text-slate-200 font-bold">
                          {boxScore.home.shots} ({boxScore.home.shotsOnTarget}) vs {boxScore.away.shots} ({boxScore.away.shotsOnTarget})
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Corner Kicks</span>
                        <span className="text-slate-200 font-bold">
                          {boxScore.home.corners} vs {boxScore.away.corners}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Goalkeeper Saves</span>
                        <span className="text-slate-200 font-bold">
                          {boxScore.home.saves} vs {boxScore.away.saves}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Fouls (Cards)</span>
                        <span className="text-slate-200 font-bold">
                          {boxScore.home.fouls} ({boxScore.home.yellowCards}🟨{boxScore.home.redCards > 0 ? ` ${boxScore.home.redCards}🟥` : ''}) vs {boxScore.away.fouls} ({boxScore.away.yellowCards}🟨{boxScore.away.redCards > 0 ? ` ${boxScore.away.redCards}🟥` : ''})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. MATCH TIMELINE */}
              {timeline && timeline.length > 0 && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Key Scoring &amp; Disciplinary Timeline
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {timeline.map((item, idx) => (
                      <div
                        key={idx}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                          item.type === 'GOAL'
                            ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-200'
                            : 'bg-rose-950/60 border-rose-700/50 text-rose-200'
                        }`}
                      >
                        <span className="font-mono font-bold">{item.minute}</span>
                        <span>{item.type === 'GOAL' ? '⚽' : '🟥'}</span>
                        <span className="font-semibold">{item.player}</span>
                        <span className="text-[10px] opacity-70">({item.team})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. EVOLVING TEAM TREND MEMORY LEDGER */}
              {teamTrends && (teamTrends.home || teamTrends.away) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Home Team Trends */}
                  {teamTrends.home && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Evolving Trend Profile</span>
                          <strong className="text-white text-sm">{teamTrends.home.team}</strong>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-300 border border-slate-700">
                          {teamTrends.home.badge || '⚔️ Competitive'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between text-slate-400">
                          <span>Tactical Identity:</span>
                          <span className="text-slate-200 font-semibold">{teamTrends.home.tacticalIdentity}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Late Capitulation Risk:</span>
                          <span className={`font-bold font-mono ${
                            teamTrends.home.tacticalIndices?.lateCapitulationRisk === 'CRITICAL' ? 'text-rose-400' :
                            teamTrends.home.tacticalIndices?.lateCapitulationRisk === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {teamTrends.home.tacticalIndices?.lateCapitulationRisk || 'LOW'}
                          </span>
                        </div>
                        {teamTrends.home.recurringWinDrivers && teamTrends.home.recurringWinDrivers[0] && (
                          <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 mt-2">
                            <span className="font-bold text-[10px] uppercase block">Primary Win Driver:</span>
                            {teamTrends.home.recurringWinDrivers[0]}
                          </div>
                        )}
                        {teamTrends.home.recurringLossDrivers && teamTrends.home.recurringLossDrivers[0] && (
                          <div className="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300 mt-1">
                            <span className="font-bold text-[10px] uppercase block">Primary Vulnerability:</span>
                            {teamTrends.home.recurringLossDrivers[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Away Team Trends */}
                  {teamTrends.away && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Evolving Trend Profile</span>
                          <strong className="text-white text-sm">{teamTrends.away.team}</strong>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-sky-300 border border-slate-700">
                          {teamTrends.away.badge || '⚔️ Competitive'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between text-slate-400">
                          <span>Tactical Identity:</span>
                          <span className="text-slate-200 font-semibold">{teamTrends.away.tacticalIdentity}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Late Capitulation Risk:</span>
                          <span className={`font-bold font-mono ${
                            teamTrends.away.tacticalIndices?.lateCapitulationRisk === 'CRITICAL' ? 'text-rose-400' :
                            teamTrends.away.tacticalIndices?.lateCapitulationRisk === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {teamTrends.away.tacticalIndices?.lateCapitulationRisk || 'LOW'}
                          </span>
                        </div>
                        {teamTrends.away.recurringWinDrivers && teamTrends.away.recurringWinDrivers[0] && (
                          <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 mt-2">
                            <span className="font-bold text-[10px] uppercase block">Primary Win Driver:</span>
                            {teamTrends.away.recurringWinDrivers[0]}
                          </div>
                        )}
                        {teamTrends.away.recurringLossDrivers && teamTrends.away.recurringLossDrivers[0] && (
                          <div className="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300 mt-1">
                            <span className="font-bold text-[10px] uppercase block">Primary Vulnerability:</span>
                            {teamTrends.away.recurringLossDrivers[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. TACTICAL CLASH METRICS */}
              {clash && (
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    Tactical Clash Matrix &amp; Modeling Residuals
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Home xG Residual</span>
                      <span className="text-slate-200 font-bold">{clash.homeXgResidual || '0.00'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Away xG Residual</span>
                      <span className="text-slate-200 font-bold">{clash.awayXgResidual || '0.00'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Finishing Variance</span>
                      <span className="text-amber-400 font-bold">{clash.finishingVarianceHome || '0.00'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Clash Intensity</span>
                      <span className="text-teal-400 font-bold">{clash.clashIntensityScore != null ? `${safeToFixed(safeParseFloat(clash.clashIntensityScore, 0.78) * 100, 0)}%` : '78%'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. RECOMMENDED PARAMETER DELTAS */}
              {deltas && (
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Calibrated Parameter Deltas
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Home Att Delta</span>
                      <span className="text-emerald-400 font-bold">{deltas.homeAttackDelta > 0 ? `+${deltas.homeAttackDelta}` : deltas.homeAttackDelta}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Home Def Delta</span>
                      <span className="text-sky-400 font-bold">{deltas.homeDefenseDelta > 0 ? `+${deltas.homeDefenseDelta}` : deltas.homeDefenseDelta}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Away Att Delta</span>
                      <span className="text-emerald-400 font-bold">{deltas.awayAttackDelta > 0 ? `+${deltas.awayAttackDelta}` : deltas.awayAttackDelta}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Away Def Delta</span>
                      <span className="text-sky-400 font-bold">{deltas.awayDefenseDelta > 0 ? `+${deltas.awayDefenseDelta}` : deltas.awayDefenseDelta}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Patch result */}
              {patchResult && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Autonomous patch committed and validated against training set. Parameters recalibrated.</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleApplySingleMatchPatch}
            disabled={isPatching || isLoading || patchResult !== null}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isPatching ? 'animate-spin' : ''}`} />
            <span>{isPatching ? 'Validating & Applying Patch...' : patchResult ? 'Patch Applied ✓' : 'Commit Autonomous Patch for This Match'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
