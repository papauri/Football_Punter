import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Clock, Lock, CheckCircle2, ChevronDown, ChevronUp,
  Target, Award, Shield, Plus, Check, Globe, Play, Tv
} from 'lucide-react';
import { safeParseFloat, safeToFixed, formatKellyStake, formatSmartMarket } from '../utils/numberUtils';
import { isLeagueBlacklisted } from '../utils/leagueUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, getLocalizedTodayKey } from '../utils/dateUtils';
import { resolveMatchOdds, getOddsProviderLabel, calculatePotentialReturn } from '../utils/oddsUtils';
import KellyTooltip from './KellyTooltip';
import ConfidenceGauge from './ConfidenceGauge';

// ── Countdown hook: live ticking ms-to-kickoff per match ──────────────────
function useCountdowns() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000); // tick every 15s
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdownBadge(msToKickoff) {
  if (msToKickoff <= 0) return { label: 'LIVE / STARTED', color: 'bg-rose-50 text-rose-700 border-rose-200', isWindow: false };
  const totalMins = Math.floor(msToKickoff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (totalMins <= 60) {
    return {
      label: totalMins <= 5 ? `${totalMins}m — Bet Now!` : `🔒 ${totalMins}m`,
      color: totalMins <= 30 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300',
      isWindow: true
    };
  }
  if (hours < 24) return { label: `${hours}h ${mins}m`, color: 'bg-slate-100 text-slate-700 border-slate-200', isWindow: false };
  const days = Math.floor(hours / 24);
  return { label: `${days}d ${hours % 24}h`, color: 'bg-slate-50 text-slate-500 border-slate-200', isWindow: false };
}

function getMatchPick(m) {
  if (typeof m.predictedWinner === 'string') return m.predictedWinner;
  if (m.binaryModel?.pick) return m.binaryModel.pick;
  const hp = safeParseFloat(m.prob?.home, 0);
  const ap = safeParseFloat(m.prob?.away, 0);
  return hp >= ap ? 'HOME' : 'AWAY';
}

export default function DailyBriefingPanel({
  matches = [],
  tzSettings = {},
  onAddToSlip,
  onOpenWatchLive,
  accaMatchIds = new Set(),
  bankrollEuro = 1000
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'bet' | 'watch'
  const now = useCountdowns();

  // 1. Resolve Localized Today Date Key in the user's active timezone
  const localizedToday = useMemo(() => {
    return getLocalizedTodayKey(tzSettings);
  }, [tzSettings]);

  // 2. Identify the active matchday (today if games exist, or nearest upcoming date)
  const { targetDateKey, isToday } = useMemo(() => {
    const activeUpcoming = matches.filter(m => !m.isCompleted && m.status !== 'FT' && m.status !== 'FINISHED');
    const hasToday = activeUpcoming.some(m => {
      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      return getLocalizedDateKey(timeVal, tzSettings) === localizedToday;
    });

    if (hasToday) return { targetDateKey: localizedToday, isToday: true };

    const upcomingDateKeys = activeUpcoming
      .map(m => {
        const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
        return getLocalizedDateKey(timeVal, tzSettings);
      })
      .filter(d => d && d !== 'Upcoming' && d >= localizedToday)
      .sort();

    const nextDate = upcomingDateKeys[0] || localizedToday;
    return { targetDateKey: nextDate, isToday: nextDate === localizedToday };
  }, [matches, localizedToday, tzSettings]);

  // 3. Classify matches on the active matchday slate
  const slateMatches = useMemo(() => {
    const filtered = matches.filter(m => {
      if (m.isCompleted || m.status === 'FT' || m.status === 'FINISHED') return false;
      if (isLeagueBlacklisted(m.league)) return false;
      const timeVal = m.timestamp || m.utcDate || m.dateIso || m.date;
      return getLocalizedDateKey(timeVal, tzSettings) === targetDateKey;
    });

    return filtered.map(m => {
      const timeVal = m.timestamp || (m.utcDate ? new Date(m.utcDate).getTime() : null);
      const msToKickoff = timeVal ? timeVal - now : Infinity;
      const pick = getMatchPick(m);
      const homeProb = safeParseFloat(m.prob?.home, 0);
      const drawProb = safeParseFloat(m.prob?.draw, 0);
      const awayProb = safeParseFloat(m.prob?.away, 0);
      const topProb = Math.max(homeProb, drawProb, awayProb);
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence, topProb);

      const isPass = m.smartMarket?.pick === 'PASS' || m.disruptionModel?.isPassFlagged;
      const isTrap = (m.aiSwarm || m.imperialSwarm)?.isContrarianTrap || m.isMarketDivergence || m.isFavoriteTrap;
      const isUnanimous = (m.aiSwarm || m.imperialSwarm)?.isTopValueLeg || (m.aiSwarm || m.imperialSwarm)?.consensusTier === 'UNANIMOUS_DIRECTIVE';
      const inSnapshotWindow = msToKickoff >= 0 && msToKickoff <= 60 * 60 * 1000;

      const matchOdds = resolveMatchOdds(m, pick);
      const kelly = m.kellyStake ?? m.binaryModel?.kellyStake;
      const kellyUnits = safeParseFloat(kelly?.units ?? kelly?.fraction, 0);
      const rawEuro = safeParseFloat(kelly?.stakeEuro, 0);
      const stakeEuro = rawEuro > 0 
        ? rawEuro 
        : (kellyUnits > 0 ? (kellyUnits <= 1 ? kellyUnits * bankrollEuro : (kellyUnits / 100) * bankrollEuro) : (bankrollEuro * 0.02));
      const returns = calculatePotentialReturn(stakeEuro, matchOdds);
      const oddsProvider = getOddsProviderLabel(m);

      // READY TO BET: inside ≤60m kickoff window, high confidence (≥60%), not a trap/pass
      const isReadyToBet = inSnapshotWindow && !isPass && !isTrap && conf >= 60;
      // WATCH: within 4h of kickoff
      const isWatch = !isReadyToBet && msToKickoff <= 4 * 60 * 60 * 1000 && msToKickoff > 0 && !isPass;

      return {
        m,
        pick,
        conf,
        isPass,
        isTrap,
        isUnanimous,
        inSnapshotWindow,
        isReadyToBet,
        isWatch,
        msToKickoff,
        kelly,
        kellyUnits,
        stakeEuro,
        matchOdds,
        returns,
        oddsProvider,
        timeVal
      };
    }).sort((a, b) => (a.timeVal || 0) - (b.timeVal || 0));
  }, [matches, targetDateKey, tzSettings, now, bankrollEuro]);

  const readyToBet = slateMatches.filter(c => c.isReadyToBet);
  const watchList = slateMatches.filter(c => c.isWatch);
  const displayList = activeTab === 'bet' ? readyToBet : activeTab === 'watch' ? watchList : slateMatches;

  if (slateMatches.length === 0) return null;

  // Format localized header date
  const targetDateFormatted = targetDateKey ? formatSafeDateTime(targetDateKey, null, tzSettings).date : 'Upcoming';
  const tzLabel = tzSettings?.zone || 'UTC';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-4">
      {/* Executive Header — Aligned to Council Acca & Top Value styling */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{isToday ? 'Today\'s Briefing' : 'Next Active Matchday'}</span>
              </span>
              <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
                {targetDateFormatted} ({slateMatches.length} Matches)
              </span>
              {readyToBet.length > 0 && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>{readyToBet.length} Ready to Bet (≤60m)</span>
                </span>
              )}
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md flex items-center gap-1" title="Active Timezone">
                <Globe className="w-3 h-3 text-indigo-500" />
                <span>{tzLabel}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {isToday
                  ? `Autonomous Matchday Briefing • Today's Slate`
                  : `Next Matchday Slate • ${targetDateFormatted}`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isToday
                ? 'Predictions freeze strictly 60 minutes before kickoff into the tamper-proof ledger. High-conviction picks highlighted with Kelly bankroll stakes.'
                : `No fixtures scheduled for today in covered leagues. Displaying the next verified matchday (${targetDateFormatted}) with localized kickoff clocks & AI directives.`}
            </p>
          </div>

          {/* Right Toolbar / Collapse Toggle */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{collapsed ? 'Expand Slate' : 'Collapse'}</span>
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Uniform Tabs Bar — Matches Council Acca Filter Toolbar */}
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Filter Queue:</span>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Matches ({slateMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bet')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'bet'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Ready to Bet ({readyToBet.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('watch')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'watch'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Watch List ({watchList.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-medium">
              Showing <strong>{displayList.length}</strong> of {slateMatches.length} selections
            </span>
          </div>

          {/* Table — Aligned with Top Value Picks Table Design */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none h-9">
                  <th className="py-2 px-3 w-10 text-center">#</th>
                  <th className="py-2 px-3 w-36 text-center">Kickoff &amp; Clock</th>
                  <th className="py-2 px-3 min-w-[200px]">Fixture</th>
                  <th className="py-2 px-3 min-w-[130px]">League</th>
                  <th className="py-2 px-3 w-36 text-center">Model Pick</th>
                  <th className="py-2 px-3 w-28 text-center">Confidence</th>
                  <th className="py-2 px-3 w-44 text-center">LiveScore Odds &amp; Return</th>
                  <th className="py-2 px-3 w-36 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      <p className="text-sm font-semibold text-slate-600">No matches found in this queue</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {activeTab === 'bet'
                          ? 'Predictions freeze in the ≤60m window. Check back closer to kickoff.'
                          : 'Try selecting "All Matches" to see the full schedule.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayList.map((item, idx) => {
                    const { m, pick, conf, isPass, isTrap, isUnanimous, inSnapshotWindow, isReadyToBet, msToKickoff, kelly, kellyUnits, stakeEuro, matchOdds, returns, oddsProvider } = item;
                    const inSlip = accaMatchIds.has(String(m.id)) || accaMatchIds.has(m.id);
                    const isHome = pick === 'HOME';
                    const pickTeam = isHome ? m.home : pick === 'AWAY' ? m.away : 'Draw';
                    const countdown = formatCountdownBadge(msToKickoff);
                    const kickoffStr = formatRelativeDayTime(m, tzSettings);
                    const smartMarketLabel = formatSmartMarket(m.smartMarket ?? m.binaryModel?.smartMarket, `${pickTeam} ML`);
                    const kellyDisplay = formatKellyStake(kelly, '—');

                    return (
                      <tr
                        key={m.id || idx}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isReadyToBet ? 'bg-emerald-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        {/* # */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Kickoff & Clock */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="font-semibold text-slate-800 text-xs">
                            {kickoffStr}
                          </div>
                          <div className="mt-1">
                            {m.isLive ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-600 text-white border border-rose-700 shadow-xs animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                LIVE {m.liveMinute ? `${m.liveMinute}'` : ''}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${countdown.color}`}>
                                {countdown.isWindow && <Lock className="w-2.5 h-2.5" />}
                                {countdown.label}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fixture */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isHome ? 'font-bold text-slate-900 text-xs' : 'font-medium text-slate-700 text-xs'}>
                              {m.home}
                            </span>
                            <span className="text-slate-400 font-normal text-[11px]">vs</span>
                            <span className={!isHome && pick === 'AWAY' ? 'font-bold text-slate-900 text-xs' : 'font-medium text-slate-700 text-xs'}>
                              {m.away}
                            </span>
                            {m.isLive && (
                              <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-xs animate-pulse">
                                LIVE
                              </span>
                            )}
                            {isUnanimous && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                👑 6/6
                              </span>
                            )}
                            {isTrap && (
                              <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                ⚠️ Risk
                              </span>
                            )}
                          </div>
                        </td>

                        {/* League */}
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[140px]">
                          {m.league}
                        </td>

                        {/* Top Pick */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              isPass ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : isHome ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : pick === 'AWAY' ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              {isPass ? 'PASS' : pickTeam}
                            </span>
                            {smartMarketLabel && (
                              <span className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                                {smartMarketLabel}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Confidence */}
                        <td className="py-2.5 px-3 text-center">
                          <ConfidenceGauge confidence={conf} size="sm" />
                        </td>

                        {/* LiveScore Bet Odds & Potential Return */}
                        <td className="py-2.5 px-3 text-center">
                          <KellyTooltip showIcon={false} align="right">
                            <div className="flex flex-col items-center cursor-help">
                              <div className="inline-flex items-center gap-1">
                                <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded" title={`${oddsProvider} Odds`}>
                                  @{safeToFixed(matchOdds, 2)}
                                </span>
                                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded" title="Recommended Wager">
                                  €{stakeEuro.toFixed(0)}
                                </span>
                              </div>
                              <div className="text-[10px] font-medium text-slate-600 mt-0.5 whitespace-nowrap">
                                Returns <strong className="text-emerald-700 font-mono">€{returns.payoutStr}</strong> <span className="text-slate-400 font-mono">({returns.profitStr})</span>
                              </div>
                            </div>
                          </KellyTooltip>
                        </td>

                        {/* Actions (Watch Now + Slip) */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => onOpenWatchLive && onOpenWatchLive(m)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                                m.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title={m.isLive ? "Watch Match LIVE NOW in Iframe" : "Watch Match Live & In-Play Radar Simulator"}
                            >
                              <Play className={`w-3 h-3 ${m.isLive ? 'fill-white text-white' : 'fill-indigo-600 text-indigo-600'}`} />
                              <span>{m.isLive ? 'Watch Now' : 'Watch'}</span>
                            </button>

                            {onAddToSlip && !isPass ? (
                              <button
                                type="button"
                                onClick={() => onAddToSlip(m)}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  inSlip
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                                }`}
                              >
                                {inSlip ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>In Slip</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    <span>+ Slip</span>
                                  </>
                                )}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>
              Autonomous Pre-Kickoff Protocol: Matches lock into tamper-proof ledger 60 mins before kickoff.
            </span>
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Immutable Pre-Match Predictions</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
