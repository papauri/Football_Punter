import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Clock, Lock, TrendingUp, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, RefreshCw,
  Target, Award, Shield, Plus
} from 'lucide-react';
import { safeParseFloat, safeToFixed, formatKellyStake } from '../utils/numberUtils';
import { isLeagueBlacklisted } from '../utils/leagueUtils';

// ── Countdown hook: live ticking ms-to-kickoff per match ──────────────────
function useCountdowns(matches) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000); // update every 30s
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(msToKickoff) {
  if (msToKickoff <= 0) return { label: 'LIVE / STARTED', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
  const totalMins = Math.floor(msToKickoff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (totalMins <= 60) {
    return {
      label: totalMins <= 5 ? `${totalMins}m — Bet Now!` : `${totalMins}m to KO`,
      color: totalMins <= 30 ? 'text-emerald-700' : 'text-amber-700',
      bg: totalMins <= 30 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200',
      isWindow: true
    };
  }
  if (hours < 24) return { label: `${hours}h ${mins}m`, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' };
  const days = Math.floor(hours / 24);
  return { label: `${days}d ${hours % 24}h`, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' };
}

function getMatchPick(m) {
  if (typeof m.predictedWinner === 'string') return m.predictedWinner;
  if (m.binaryModel?.pick) return m.binaryModel.pick;
  const hp = safeParseFloat(m.prob?.home, 0);
  const ap = safeParseFloat(m.prob?.away, 0);
  return hp >= ap ? 'HOME' : 'AWAY';
}

export default function DailyBriefingPanel({ matches = [], onAddToSlip, accaMatchIds = new Set(), bankrollEuro = 1000 }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('bet'); // 'bet' | 'watch' | 'all'
  const now = useCountdowns(matches);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Classify each today match
  const classified = useMemo(() => {
    const today = matches.filter(m => {
      if (m.isCompleted || m.status === 'FT') return false;
      if (isLeagueBlacklisted(m.league)) return false;
      const d = m.dateIso || m.utcDate?.slice(0, 10) || '';
      return d === todayIso;
    });

    return today.map(m => {
      const msToKickoff = m.timestamp ? m.timestamp - now : Infinity;
      const pick = getMatchPick(m);
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence ?? m.prob?.[pick?.toLowerCase()], 60);
      const isPass = m.smartMarket?.pick === 'PASS' || m.disruptionModel?.isPassFlagged;
      const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence;
      const isElite = conf >= 68 || m.isEliteConviction || (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg;
      const inSnapshotWindow = msToKickoff >= 0 && msToKickoff <= 60 * 60 * 1000;
      const kelly = m.kellyStake ?? m.binaryModel?.kellyStake;
      const kellyUnits = safeParseFloat(kelly?.units ?? kelly?.fraction, 0);
      const kellyEuro = kellyUnits > 0 ? (kellyUnits * bankrollEuro).toFixed(0) : null;

      // READY TO BET: snapshot window + not pass + not trap + conf ≥ 60
      const isReadyToBet = inSnapshotWindow && !isPass && !isTrap && conf >= 60;
      // WATCH: within 3h + not pass + conf >= 55
      const isWatch = !isReadyToBet && msToKickoff <= 3 * 60 * 60 * 1000 && msToKickoff > 0 && !isPass && conf >= 55;

      return { m, pick, conf, isPass, isTrap, isElite, inSnapshotWindow, isReadyToBet, isWatch, msToKickoff, kelly, kellyUnits, kellyEuro };
    }).sort((a, b) => a.msToKickoff - b.msToKickoff);
  }, [matches, now, todayIso, bankrollEuro]);

  const readyToBet = classified.filter(c => c.isReadyToBet);
  const watchList = classified.filter(c => c.isWatch);
  const allToday = classified;

  const displayList = activeTab === 'bet' ? readyToBet : activeTab === 'watch' ? watchList : allToday;

  if (allToday.length === 0) return null;

  return (
    <div className="bg-white border border-indigo-200 rounded-xl shadow-xs overflow-hidden mb-4">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-white" />
          <span className="font-bold text-white text-sm">Today's Autonomous Briefing</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
            {allToday.length} fixtures today
          </span>
          {readyToBet.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 font-bold border border-emerald-300/40">
              ⚡ {readyToBet.length} Ready to Bet
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-[11px]">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-white/80" />
            : <ChevronUp className="w-4 h-4 text-white/80" />
          }
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            {[
              { key: 'bet', label: '⚡ Ready to Bet', count: readyToBet.length, active: 'bg-emerald-600 text-white', inactive: 'text-slate-600' },
              { key: 'watch', label: '👁️ Watch List', count: watchList.length, active: 'bg-amber-500 text-white', inactive: 'text-slate-600' },
              { key: 'all', label: 'All Today', count: allToday.length, active: 'bg-indigo-600 text-white', inactive: 'text-slate-600' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  activeTab === tab.key
                    ? `border-current ${tab.active}`
                    : `border-transparent ${tab.inactive} hover:bg-slate-100`
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Empty state */}
          {displayList.length === 0 && (
            <div className="py-8 text-center text-slate-400 px-4">
              {activeTab === 'bet' ? (
                <>
                  <Clock className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
                  <p className="text-sm font-semibold text-slate-700">No matches in the bet window yet</p>
                  <p className="text-xs mt-1">Predictions are frozen ≤60 min before kickoff. Check back closer to today's matches.</p>
                </>
              ) : (
                <>
                  <Target className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">Nothing to show right now</p>
                </>
              )}
            </div>
          )}

          {/* Match rows */}
          {displayList.length > 0 && (
            <div className="divide-y divide-slate-100">
              {displayList.map(({ m, pick, conf, isPass, isTrap, isElite, inSnapshotWindow, isReadyToBet, msToKickoff, kelly, kellyUnits, kellyEuro }) => {
                const countdown = formatCountdown(msToKickoff);
                const isInSlip = accaMatchIds.has(m.id);
                const smartPick = m.smartMarket?.pick !== 'PASS' ? m.smartMarket?.pickLabel || m.smartMarket?.pick : null;
                const kellyDisplay = formatKellyStake(kelly, '—');

                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors ${
                      isReadyToBet ? 'border-l-4 border-emerald-400' :
                      isPass ? 'border-l-4 border-slate-200 opacity-60' :
                      isTrap ? 'border-l-4 border-rose-300' : 'border-l-4 border-transparent'
                    }`}
                  >
                    {/* Countdown chip */}
                    <div className={`shrink-0 text-center px-2 py-1 rounded-lg border text-[10px] font-bold min-w-[72px] ${countdown.bg} ${countdown.color}`}>
                      {inSnapshotWindow && <Lock className="w-2.5 h-2.5 inline-block mr-0.5 mb-0.5" />}
                      {countdown.label}
                    </div>

                    {/* Fixture */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[100px]">{m.home}</span>
                        <span className="text-[9px] text-slate-400">vs</span>
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[100px]">{m.away}</span>
                        {isElite && <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold">⭐ Elite</span>}
                        {isTrap && <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-1 rounded font-bold">⚠️ Trap</span>}
                        {isPass && <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1 rounded font-bold">PASS</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">{m.league}</span>
                    </div>

                    {/* Pick badge */}
                    <div className="shrink-0 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                        isPass ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : pick === 'HOME' ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : pick === 'AWAY' ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {isPass ? 'PASS' : pick === 'HOME' ? m.home?.slice(0, 10) : pick === 'AWAY' ? m.away?.slice(0, 10) : 'Draw'}
                      </span>
                      {smartPick && smartPick !== pick && (
                        <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">{smartPick}</div>
                      )}
                    </div>

                    {/* Confidence */}
                    <div className="shrink-0 text-center w-14">
                      <div className={`text-xs font-black font-mono ${conf >= 70 ? 'text-emerald-700' : conf >= 60 ? 'text-indigo-700' : 'text-slate-500'}`}>
                        {safeToFixed(conf, 0)}%
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium">Conf</div>
                    </div>

                    {/* Kelly stake */}
                    <div className="shrink-0 text-center w-20">
                      {kellyEuro ? (
                        <>
                          <div className="text-xs font-bold text-emerald-700 font-mono">€{kellyEuro}</div>
                          <div className="text-[9px] text-slate-400">{kellyDisplay}</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-300">—</div>
                      )}
                    </div>

                    {/* Add to slip button */}
                    {!isPass && onAddToSlip && (
                      <button
                        onClick={() => onAddToSlip(m)}
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isInSlip
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                        title={isInSlip ? 'Remove from slip' : 'Add to bet slip'}
                      >
                        {isInSlip ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {isInSlip ? 'Added' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer summary */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {readyToBet.length > 0
                ? `${readyToBet.length} game${readyToBet.length > 1 ? 's' : ''} in bet window · ${watchList.length} to monitor`
                : `${watchList.length} game${watchList.length !== 1 ? 's' : ''} approaching — check back for snapshot lock`}
            </span>
            <span className="flex items-center gap-1 text-indigo-600 font-semibold">
              <Lock className="w-3 h-3" />
              Predictions freeze ≤60 min before kickoff
            </span>
          </div>
        </>
      )}
    </div>
  );
}
