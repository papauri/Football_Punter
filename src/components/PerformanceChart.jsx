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
      if (!m.date) return acc;
      const dateStr = typeof m.date === 'string' ? m.date.slice(0, 10) : new Date(m.timestamp || m.date).toISOString().slice(0, 10);
      
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, total: 0, hits: 0, confidenceSum: 0 };
      }
      
      const predictedScore = `${m.homeScore || 0}-${m.awayScore || 0}`;
      let predictedWinner = 'DRAW';
      if ((m.homeScore || 0) > (m.awayScore || 0)) predictedWinner = 'HOME';
      else if ((m.awayScore || 0) > (m.homeScore || 0)) predictedWinner = 'AWAY';
      
      if (m.binaryModel && m.binaryModel.pick) {
         predictedWinner = m.binaryModel.pick;
      } else if (m.predictedWinner) {
         predictedWinner = m.predictedWinner;
      }
      
      const isHit = m.isHit !== undefined ? Boolean(m.isHit) : (m.actualWinner === predictedWinner);
      const confidence = m.confidence || 75;

      acc[dateStr].total += 1;
      if (isHit) acc[dateStr].hits += 1;
      acc[dateStr].confidenceSum += confidence;

      return acc;
    }, {});

    // Convert to array, sort chronologically, and calculate rolling average
    const sortedDates = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    
    return sortedDates.map((day) => {
      const winRate = day.total > 0 ? (day.hits / day.total) * 100 : 0;
      return {
        date: day.date,
        shortDate: day.date.slice(5).replace('-', '/'),
        winRate: winRate,
        volume: day.total,
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
  const totalMatches = chartData.reduce((sum, d) => sum + d.volume, 0);
  const avgWinRate = chartData.reduce((sum, d) => sum + (d.winRate * d.volume), 0) / (totalMatches || 1);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            30-Day Model Trajectory
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Rolling daily win rate accuracy</p>
        </div>
        
        <div className="mt-3 sm:mt-0 flex gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">30-Day Avg</div>
            <div className="text-lg font-black text-emerald-600 font-mono flex items-center justify-end gap-1">
              <Crosshair className="w-4 h-4" />
              {safeToFixed(avgWinRate, 1)}%
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
