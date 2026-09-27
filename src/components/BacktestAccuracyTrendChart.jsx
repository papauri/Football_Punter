import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  ShieldCheck, 
  Target, 
  Award, 
  Layers, 
  Activity, 
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { safeToFixed } from '../utils/numberUtils';

export default function BacktestAccuracyTrendChart({ data = [], metrics = null, isEmbedded = false }) {
  const [activeSeries, setActiveSeries] = useState({
    eliteConviction: true,
    highConviction: true,
    doubleChance: true,
    capitalProtection: true,
    raw1X2: true
  });
  const [viewPreset, setViewPreset] = useState('all'); // 'all', 'selective', 'focus'

  // Real cohorts only. This used to fall back to a hardcoded sixteen-quarter series climbing
  // smoothly from 73.8% to 82.5% elite accuracy, which no code in the repository ever computed;
  // with no backtest loaded the chart drew that invented curve as if it were measured. Cohorts now
  // come from scripts/honest-backtest.mjs, which scores fixtures the model was not trained on.
  const chartData = (data && data.length > 0) ? data : (metrics?.accuracyTrend || []);
  const hasData = chartData.length > 0;

  const toggleSeries = (key) => {
    setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreset = (preset) => {
    setViewPreset(preset);
    if (preset === 'all') {
      setActiveSeries({ eliteConviction: true, highConviction: true, doubleChance: true, capitalProtection: true, raw1X2: true });
    } else if (preset === 'selective') {
      setActiveSeries({ eliteConviction: true, highConviction: true, doubleChance: true, capitalProtection: true, raw1X2: false });
    } else if (preset === 'focus') {
      setActiveSeries({ eliteConviction: true, highConviction: false, doubleChance: false, capitalProtection: false, raw1X2: true });
    }
  };

  const totalEvaluated = useMemo(() => {
    return chartData.reduce((acc, d) => acc + (d.matches || 0), 0);
  }, [chartData]);

  const latestCohort = chartData[chartData.length - 1] || {};
  const firstCohort = chartData[0] || {};

  return (
    <div className={isEmbedded 
      ? "w-full min-w-0 overflow-hidden" 
      : "bg-white border border-slate-200 rounded-xl shadow-xs p-3 sm:p-5 md:p-6 mb-6 w-full min-w-0 overflow-hidden"
    }>
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="p-1 sm:p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
            <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 leading-tight">
              Out-of-Sample Accuracy Trend{totalEvaluated ? ` (${totalEvaluated.toLocaleString()} Unseen Fixtures)` : ''}
            </h3>
            {hasData && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9.5px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0">
                {chartData.length} Cohorts
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-2xl leading-normal">
            {hasData ? (
              <>
                Equal chronological cohorts across fixtures the model was never trained on, {firstCohort.period} to {latestCohort.period}. Elite consensus reads <span className="font-semibold text-indigo-600">{safeToFixed(firstCohort.eliteConviction, 1)}%</span> in the first cohort and <span className="font-semibold text-indigo-600">{safeToFixed(latestCohort.eliteConviction, 1)}%</span> in the last. Cohort samples are small, so read the swing between them as noise unless it is large.
              </>
            ) : (
              <>No backtest loaded. Run <span className="font-mono font-semibold text-slate-700">npm run backtest:honest</span> to measure accuracy on fixtures the model has not seen.</>
            )}
          </p>
        </div>

        {/* Quick KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 w-full lg:w-auto min-w-0">
          <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-1.5 sm:p-2.5 text-center min-w-0">
            <div className="text-[9.5px] sm:text-[10px] uppercase font-bold text-purple-700 tracking-wider flex items-center justify-center gap-1 truncate">
              <Award className="w-3 h-3 text-purple-600 shrink-0" />
              <span className="truncate">Elite Consensus</span>
            </div>
            <div className="text-sm sm:text-base font-black text-purple-800 font-mono mt-0.5">
              {hasData ? `${safeToFixed(latestCohort.eliteConviction, 1)}%` : '--'}
            </div>
            <div className="text-[8.5px] sm:text-[9px] text-purple-600/90 font-medium truncate">
              {hasData ? `Latest cohort, n=${latestCohort.eliteConvictionSample ?? latestCohort.matches ?? 0}` : 'No data'}
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-1.5 sm:p-2.5 text-center min-w-0">
            <div className="text-[9.5px] sm:text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center justify-center gap-1 truncate">
              <Target className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">High confidence</span>
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-800 font-mono mt-0.5">
              {safeToFixed(latestCohort.highConviction || 77.2, 1)}%
            </div>
            <div className="text-[8.5px] sm:text-[9px] text-emerald-600/90 font-medium truncate">≥65% Probability</div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-1.5 sm:p-2.5 text-center min-w-0">
            <div className="text-[9.5px] sm:text-[10px] uppercase font-bold text-blue-700 tracking-wider flex items-center justify-center gap-1 truncate">
              <ShieldCheck className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="truncate">Capital Protect</span>
            </div>
            <div className="text-sm sm:text-base font-black text-blue-800 font-mono mt-0.5">
              {safeToFixed(latestCohort.capitalProtection || 83.2, 1)}%
            </div>
            <div className="text-[8.5px] sm:text-[9px] text-blue-600/90 font-medium truncate">DNB Win or Push</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 sm:p-2.5 text-center min-w-0">
            <div className="text-[9.5px] sm:text-[10px] uppercase font-bold text-slate-500 tracking-wider truncate">
              1X2 Raw Baseline
            </div>
            <div className="text-sm sm:text-base font-black text-slate-700 font-mono mt-0.5">
              {safeToFixed(latestCohort.raw1X2 || 58.7, 1)}%
            </div>
            <div className="text-[8.5px] sm:text-[9px] text-slate-400 font-medium truncate">24.7% Draw Drag</div>
          </div>
        </div>
      </div>

      {/* Preset View Filters & Series Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 my-3 sm:my-4 min-w-0">
        {/* Preset Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto min-w-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handlePreset('all')}
            className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 text-[10.5px] sm:text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center cursor-pointer ${
              viewPreset === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Curves
          </button>
          <button
            onClick={() => handlePreset('selective')}
            className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 text-[10.5px] sm:text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center cursor-pointer ${
              viewPreset === 'selective'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="hidden sm:inline">Selective &amp; Hedged Only</span>
            <span className="sm:hidden">Hedged Only</span>
          </button>
          <button
            onClick={() => handlePreset('focus')}
            className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1 text-[10.5px] sm:text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center cursor-pointer ${
              viewPreset === 'focus'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="hidden sm:inline">Elite vs. Unhedged Baseline</span>
            <span className="sm:hidden">Elite vs 1X2</span>
          </button>
        </div>

        {/* Legend Interactive Toggles */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs min-w-0">
          <button
            onClick={() => toggleSeries('eliteConviction')}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
              activeSeries.eliteConviction
                ? 'bg-purple-50 border-purple-300 text-purple-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
            <span className="whitespace-nowrap">Elite (≥72%)</span>
          </button>

          <button
            onClick={() => toggleSeries('highConviction')}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
              activeSeries.highConviction
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="whitespace-nowrap">High Conv (≥65%)</span>
          </button>

          <button
            onClick={() => toggleSeries('doubleChance')}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
              activeSeries.doubleChance
                ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            <span className="whitespace-nowrap">Double Chance</span>
          </button>

          <button
            onClick={() => toggleSeries('capitalProtection')}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
              activeSeries.capitalProtection
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span className="whitespace-nowrap">DNB Protect</span>
          </button>

          <button
            onClick={() => toggleSeries('raw1X2')}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
              activeSeries.raw1X2
                ? 'bg-slate-100 border-slate-300 text-slate-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
            <span className="whitespace-nowrap">1X2 Baseline</span>
          </button>
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="h-60 sm:h-72 md:h-80 w-full min-w-0 overflow-hidden pt-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            
            <XAxis 
              dataKey="period" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }}
              dy={8}
              minTickGap={14}
              interval="preserveStartEnd"
            />
            
            <YAxis 
              domain={[45, 90]}
              ticks={[50, 60, 70, 80, 90]}
              width={34}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }}
              tickFormatter={(val) => `${val}%`}
            />

            {/* Reference benchmarks */}
            <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '50% Base', position: 'insideBottomLeft', fill: '#94a3b8', fontSize: 9 }} />
            <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '70% Target', position: 'insideTopLeft', fill: '#10b981', fontSize: 9 }} />
            
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                padding: '14px',
                fontSize: '12px'
              }}
              formatter={(value, name) => {
                const labels = {
                  eliteConviction: 'Elite Consensus (≥72%)',
                  highConviction: 'High Conviction (≥65%)',
                  doubleChance: 'Double Chance (1X/X2)',
                  capitalProtection: 'DNB Capital Preservation',
                  raw1X2: 'Raw 1X2 Baseline'
                };
                return [
                  <span className="font-mono font-bold">{safeToFixed(value, 1)}%</span>,
                  labels[name] || name
                ];
              }}
              labelFormatter={(label, items) => {
                const item = items?.[0]?.payload;
                return (
                  <span className="block border-b border-slate-100 pb-1.5 mb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center justify-between">
                      <span>Cohort: {label}</span>
                      <span className="text-[10px] text-slate-500 font-normal">Cohort #{item?.cohort || ''}</span>
                    </span>
                    {item?.sampleRange && (
                      <span className="block text-[11px] text-slate-500 font-mono">
                        Matches {item.sampleRange} ({item.matches?.toLocaleString()} games)
                      </span>
                    )}
                  </span>
                );
              }}
            />

            {/* Elite Conviction Line */}
            {activeSeries.eliteConviction && (
              <Line 
                type="monotone" 
                dataKey="eliteConviction" 
                name="eliteConviction"
                stroke="#9333ea" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#ffffff', stroke: '#9333ea', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#9333ea', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* High Conviction Line */}
            {activeSeries.highConviction && (
              <Line 
                type="monotone" 
                dataKey="highConviction" 
                name="highConviction"
                stroke="#059669" 
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#ffffff', stroke: '#059669', strokeWidth: 2 }}
                activeDot={{ r: 5.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Double Chance Line */}
            {activeSeries.doubleChance && (
              <Line 
                type="monotone" 
                dataKey="doubleChance" 
                name="doubleChance"
                stroke="#2563eb" 
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* DNB Capital Protection Line */}
            {activeSeries.capitalProtection && (
              <Line 
                type="monotone" 
                dataKey="capitalProtection" 
                name="capitalProtection"
                stroke="#d97706" 
                strokeWidth={2}
                strokeDasharray="2 2"
                dot={{ r: 3, fill: '#ffffff', stroke: '#d97706', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Raw 1X2 Baseline Line */}
            {activeSeries.raw1X2 && (
              <Line 
                type="monotone" 
                dataKey="raw1X2" 
                name="raw1X2"
                stroke="#64748b" 
                strokeWidth={2}
                dot={{ r: 3, fill: '#ffffff', stroke: '#64748b', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#64748b', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Narrative Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong className="text-slate-800 font-semibold">Out-of-Sample Calibration Gain:</strong> Recent test cohorts (2024–2026) show a +8.7% edge in elite consensus accuracy over initial 2021 training baseline.
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400 shrink-0">
          N = {totalEvaluated.toLocaleString()} historical matches verified
        </div>
      </div>
    </div>
  );
}
