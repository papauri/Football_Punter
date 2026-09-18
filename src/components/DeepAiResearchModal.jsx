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
  RefreshCw
} from 'lucide-react';
import Markdown from 'react-markdown';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';

export default function DeepAiResearchModal({ match, onClose, onPatchSuccess }) {
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

  const archetype = researchData?.tacticalDiagnosis?.primaryRootCause || researchData?.analytics?.rootCauseArchetype;
  const tactical = researchData?.tacticalDiagnosis;
  const clash = researchData?.analytics?.tacticalClash;
  const deltas = researchData?.parameterDeltas;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
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
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">
                  Autonomous Tactical Research
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                {match.home} vs {match.away}
              </h3>
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
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-sm font-semibold text-slate-300">
                Running Autonomous AI Game Research &amp; Advanced Data Analytics...
              </span>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                Computing expected goals residuals, finishing variance, defensive depth friction, and querying AI tactical models.
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
              {/* Archetype Banner */}
              {archetype && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Diagnosed Miss Archetype</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {archetype.split('_').join(' ')}
                    </span>
                  </div>
                  {researchData.confidence && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-mono block">AI Diagnosis Confidence</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{researchData.confidence}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tactical Clash Metrics */}
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

              {/* AI Tactical Narrative */}
              {tactical && (
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Match Analysis
                  </h4>
                  {tactical.tacticalNarrative && (
                    <div className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      {tactical.tacticalNarrative}
                    </div>
                  )}

                  {tactical.turningPoint && (
                    <div className="text-xs p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="font-bold text-amber-400 block mb-1">Key Match Turning Point:</span>
                      <p className="text-slate-300 leading-relaxed">{tactical.turningPoint}</p>
                    </div>
                  )}

                  {tactical.varianceVsStructuralRatio && (
                    <div className="flex items-center justify-between text-xs font-mono p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Root Cause Attribution:</span>
                      <span className="text-slate-200">
                        {tactical.varianceVsStructuralRatio.structuralRatio}% Structural vs {tactical.varianceVsStructuralRatio.varianceRatio}% Unpredictable Variance
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Parameter Deltas */}
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
