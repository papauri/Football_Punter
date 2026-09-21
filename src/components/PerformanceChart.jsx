import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Activity, Crosshair } from 'lucide-react';
import { safeToFixed } from '../utils/numberUtils';

export default function PerformanceChart({ historicalResults = [] }) {
  const chartData = useMemo(() => {
    if (!historicalResults || historicalResults.length === 0) return [];

    // Group by date
    const dailyStats = historicalResults.reduce((acc, m) => {
      if (!m.date && !m.dateIso) return acc;
      const rawDate = m.dateIso || m.date;
      const dateStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : new Date(m.timestamp || rawDate).toISOString().slice(0, 10);
      
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, total: 0, activeWagers: 0, hits: 0, pushes: 0, passes: 0, confidenceSum: 0 };
      }
      
      const isHit = m.isHit === true;
      const isMiss = m.isHit === false;
      const isPush = m.isPush || (m.isHit === null && m.smartMarket?.pick?.includes('DNB'));
      const isPass = m.isPass || (m.isHit === null && m.smartMarket?.pick === 'PASS');
      const confidence = m.confidence ? parseFloat(m.confidence) : 70;

      acc[dateStr].total += 1;
      if (isHit) {
        acc[dateStr].hits += 1;
        acc[dateStr].activeWagers += 1;
      } else if (isMiss) {
        acc[dateStr].activeWagers += 1;
      } else if (isPush) {
        acc[dateStr].pushes += 1;
      } else if (isPass) {
        acc[dateStr].passes += 1;
      } else {
        const fallbackHit = m.isHit !== undefined ? Boolean(m.isHit) : (m.actualWinner && m.predictedWinner ? m.actualWinner === m.predictedWinner : false);
        if (fallbackHit) acc[dateStr].hits += 1;
        acc[dateStr].activeWagers += 1;
      }

      acc[dateStr].confidenceSum += confidence;

      return acc;
    }, {});

    // Convert to array, sort chronologically, and calculate rolling average
    const sortedDates = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    
    return sortedDates.map((day) => {
      const activeCount = day.activeWagers > 0 ? day.activeWagers : day.total;
      const winRate = activeCount > 0 ? (day.hits / activeCount) * 100 : 0;
      return {
        date: day.date,
        shortDate: day.date.slice(5).replace('-', '/'),
        winRate: winRate,
        volume: day.total,
        activeWagers: day.activeWagers,
        hits: day.hits,
        pushes: day.pushes,
        passes: day.passes,
        avgConfidence: day.total > 0 ? day.confidenceSum / day.total : 0
      };
    }).slice(-30); // Last 30 days maximum
  }, [historicalResults]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl h-64 text-slate-400">
        <Activity className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm font-medium">Insufficient historical data to plot performance</span>
      </div>
    );
  }

  // Calculate overall metrics for the visible period
  const rawStats = useMemo(() => {
    let rawHits = 0;
    let total = 0;
    let hits = 0;
    let misses = 0;
    let pushes = 0;
    let passes = 0;

    (historicalResults || []).forEach(m => {
      const hG = m.homeScore ?? m.goals?.home;
      const aG = m.awayScore ?? m.goals?.away;
      if (hG == null || aG == null) return;
      total++;
      const actualWinner = m.actualWinner || (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW');
      if (m.predictedWinner && m.predictedWinner === actualWinner) rawHits++;

      if (m.isHit === true) hits++;
      else if (m.isHit === false) misses++;
      else if (m.isPush || (m.smartMarket?.pick?.includes('DNB') && actualWinner === 'DRAW')) pushes++;
      else if (m.isPass || m.smartMarket?.pick === 'PASS') passes++;
    });

    const activeWagers = hits + misses;
    const smartWinRate = activeWagers > 0 ? (hits / activeWagers) * 100 : 0;
    const rawRate = total > 0 ? (rawHits / total) * 100 : 0;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    return { total, rawHits, rawRate, hits, misses, pushes, passes, activeWagers, smartWinRate, passRate };
  }, [historicalResults]);

  const totalMatches = chartData.reduce((sum, d) => sum + d.volume, 0);
  const avgWinRate = rawStats.smartWinRate || (chartData.reduce((sum, d) => sum + (d.winRate * d.volume), 0) / (totalMatches || 1));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            30-Day Model Trajectory &amp; Calibration Audit
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Rolling daily win rate accuracy on recommended plays across audited global fixtures
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-emerald-50/60 border border-emerald-200 px-3.5 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
              <span>Smart Strike Rate</span>
              <span className="text-[9px] px-1 py-0.2 bg-emerald-200 text-emerald-900 rounded font-bold">Recommended</span>
            </div>
            <div className="text-lg font-black text-emerald-700 font-mono flex items-center justify-end gap-1">
              <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
              {safeToFixed(avgWinRate, 1)}%
            </div>
            <div className="text-[10px] text-emerald-600/90 font-mono">
              {rawStats.hits}W - {rawStats.misses}L on active wagers
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Raw 1X2 Baseline
            </div>
            <div className="text-lg font-black text-slate-700 font-mono">
              {safeToFixed(rawStats.rawRate, 1)}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Unhedged single-winner
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Traps Passed
            </div>
            <div className="text-lg font-black text-slate-700 font-mono">
              {safeToFixed(rawStats.passRate, 1)}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {rawStats.passes} coin-flips bypassed
            </div>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="shortDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
              labelStyle={{ color: '#475569', fontWeight: 700, fontSize: '11px', marginBottom: '8px' }}
              formatter={(value, name, props) => {
                if (name === 'winRate') return [<span className="font-mono font-bold text-emerald-600">{safeToFixed(value, 1)}%</span>, 'Win Rate'];
                if (name === 'volume') return [<span className="font-mono font-bold text-slate-600">{value}</span>, 'Matches Analysed'];
                return [value, name];
              }}
            />
            
            <Line 
              type="monotone" 
              dataKey="winRate" 
              name="winRate"
              stroke="#4f46e5" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
