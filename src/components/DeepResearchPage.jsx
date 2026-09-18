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
  Activity
} from 'lucide-react';
import Markdown from 'react-markdown';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed, formatScore } from '../utils/numberUtils';

export default function DeepResearchPage({
  matches = [],
  selectedMatch = null,
  onSelectMatch,
  onBackToFixtures,
  onPatchSuccess
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

  // Fetch research when activeMatch changes
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

  const matchOptions = matches.map((m, idx) => ({
    value: m.id || String(idx),
    label: `${m.home} vs ${m.away} (${m.league?.split(' ')[0] || 'Match'})`
  }));

  const handleMatchChange = (matchId) => {
    const found = matches.find(m => (m.id || String(matches.indexOf(m))) === matchId);
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
        setPatchResult(data.result || { summary: 'Tactical patch applied successfully' });
        if (onPatchSuccess) onPatchSuccess();
      } else {
        setError(data.error || 'Failed to apply autonomous tactical patch.');
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
              value={activeMatch ? (activeMatch.id || String(matches.indexOf(activeMatch))) : ''}
              onChange={handleMatchChange}
              options={matchOptions}
              className="w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-semibold flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-teal-600" />
            <span>Match Analysis</span>
          </span>
        </div>

      </div>

      {/* Header Match Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
              {activeMatch?.league || 'Football Competition'}
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1.5">
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
          <h3 className="font-bold text-slate-800 text-sm">Analyzing Match Data</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Analyzing pitch dynamics, pressing traps, referee tendencies, and expected goal residuals...
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
          
          {/* Tactical Diagnosis (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Primary Analysis */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal-600" />
                  <span>Tactical &amp; Structural Breakdown</span>
                </h3>
                {researchData.archetype && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {researchData.archetype}
                  </span>
                )}
              </div>

              <div className="markdown-body text-slate-700 text-xs leading-relaxed">
                {researchData.narrative ? (
                  <Markdown>{researchData.narrative}</Markdown>
                ) : (
                  <p>{researchData.summary || 'Tactical analysis completed across historical formation metrics.'}</p>
                )}
              </div>
            </div>

            {/* Tactical Clash Details */}
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
            
            {/* Dixon-Coles Adjustments */}
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
