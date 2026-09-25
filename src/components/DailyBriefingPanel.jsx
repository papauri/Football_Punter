import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Clock, Lock, CheckCircle2, ChevronDown, ChevronUp,
  Target, Award, Shield, Plus, Check, Globe, Play, Brain
} from 'lucide-react';
import { safeParseFloat, safeToFixed, formatKellyStake, formatSmartMarket } from '../utils/numberUtils';
import { isTrapMatch } from '../utils/riskUtils';
import { isLeagueBlacklisted } from '../utils/leagueUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, getLocalizedTodayKey } from '../utils/dateUtils';
import { resolveMatchOdds, getOddsProviderLabel, calculatePotentialReturn } from '../utils/oddsUtils';
import KellyTooltip from './KellyTooltip';
import ConfidenceGauge from './ConfidenceGauge';
import InfoTooltip from './InfoTooltip';

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
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedMatchId(prev => (prev === id ? null : id));
  };
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
      const isTrap = isTrapMatch(m);
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

      const isMatchInPlay = Boolean(
        m.isLive === true ||
        m.status === 'LIVE' ||
        m.status === 'HT' ||
        m.status === 'STATUS_IN_PROGRESS' ||
        m.status === 'STATUS_HALFTIME' ||
        (typeof m.liveMinute === 'string' && (m.liveMinute.includes("'") || m.liveMinute.toLowerCase() === 'ht')) ||
        (typeof m.status === 'string' && (m.status.includes("'") || m.status.toLowerCase() === 'ht')) ||
        (typeof m.liveMinute === 'number' && m.liveMinute > 0)
      );

      const liveHomeScore = m.liveHomeScore ?? m.goals?.home ?? (m.homeScore != null ? m.homeScore : 0);
      const liveAwayScore = m.liveAwayScore ?? m.goals?.away ?? (m.awayScore != null ? m.awayScore : 0);
      const liveScoreStr = isMatchInPlay ? `${liveHomeScore} - ${liveAwayScore}` : null;
      const liveMinStr = m.inPlayPrediction?.minuteDisplay || m.liveMinute || m.status || 'Live';

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
        isMatchInPlay,
        liveScoreStr,
        liveMinStr,
        msToKickoff,
        kelly,
        kellyUnits,
        stakeEuro,
        matchOdds,
        returns,
        oddsProvider,
        timeVal
      };
    }).sort((a, b) => {
      // Prioritize live matches at top of slate
      if (a.isMatchInPlay && !b.isMatchInPlay) return -1;
      if (!a.isMatchInPlay && b.isMatchInPlay) return 1;
      return (a.timeVal || 0) - (b.timeVal || 0);
    });
  }, [matches, targetDateKey, tzSettings, now, bankrollEuro]);

  const liveMatches = slateMatches.filter(c => c.isMatchInPlay);
  const readyToBet = slateMatches.filter(c => c.isReadyToBet);
  const watchList = slateMatches.filter(c => c.isWatch);
  const displayList = activeTab === 'inplay' ? liveMatches : activeTab === 'bet' ? readyToBet : activeTab === 'watch' ? watchList : slateMatches;

  if (slateMatches.length === 0) return null;

  // Format localized header date
  const targetDateFormatted = targetDateKey ? formatSafeDateTime(targetDateKey, null, tzSettings).date : 'Upcoming';
  const tzLabel = tzSettings?.zone || 'UTC';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-4">
      {/* Executive Header — Aligned to Council Selections styling */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="bg-slate-900 text-white text-[10px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{isToday ? 'Today\'s Briefing' : 'Next Active Matchday'}</span>
              </span>
              <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] sm:text-[10.5px] font-semibold px-2 py-0.5 rounded-md">
                {targetDateFormatted} ({slateMatches.length} Matches)
              </span>
              {readyToBet.length > 0 && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                  <Lock className="w-2.5 h-2.5 text-emerald-600" />
                  <span>{readyToBet.length} Ready to Bet (≤60m)</span>
                </span>
              )}
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] sm:text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md flex items-center gap-1" title="Active Timezone">
                <Globe className="w-2.5 h-2.5 text-indigo-500" />
                <span>{tzLabel}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>{isToday
                  ? `Autonomous Matchday Briefing • Today's Slate`
                  : `Next Matchday Slate • ${targetDateFormatted}`}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                  Poisson + ML Clocks
                </span>
              </h2>
              <InfoTooltip
                title={isToday ? "Matchday Briefing" : "Next Matchday Slate"}
                content={isToday
                  ? "Predictions freeze strictly 60 minutes before kickoff into the tamper-proof ledger. High-conviction picks highlighted with Kelly bankroll stakes."
                  : `No fixtures scheduled for today in covered leagues. Displaying the next verified matchday (${targetDateFormatted}) with localized kickoff clocks & AI directives.`
                }
              />
            </div>
          </div>

          {/* Right Toolbar / Collapse Toggle */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>{collapsed ? 'Expand Slate' : 'Collapse'}</span>
              {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Uniform Tabs Bar — Matches Council Acca Filter Toolbar */}
          <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mr-1">Filter Queue:</span>
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
              {liveMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('inplay')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'inplay'
                      ? 'bg-rose-600 text-white shadow-2xs animate-pulse'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span>In-Play Live ({liveMatches.length})</span>
                </button>
              )}
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
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                  <th className="py-1 px-1.5 w-7 text-center"></th>
                  <th className="py-1 px-1.5 w-8 text-center">#</th>
                  <th className="py-1 px-2 w-32 text-center">Kickoff &amp; Clock</th>
                  <th className="py-1 px-2 min-w-[170px]">Fixture</th>
                  <th className="py-1 px-2 min-w-[110px]">League</th>
                  <th className="py-1 px-2 w-28 text-center">Model Pick</th>
                  <th className="py-1 px-1.5 w-24 text-center">Confidence</th>
                  <th className="py-1 px-1.5 w-36 text-center">Odds &amp; Return</th>
                  <th className="py-1 px-2 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
                {displayList.length === 0 ? (
                  <tr className="flex flex-col md:table-row">
                    <td colSpan={9} className="py-8 text-center text-slate-400 block md:table-cell">
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
                    const matchKey = m.id || `daily-${idx}`;
                    const isExpanded = expandedMatchId === matchKey;
                    const inSlip = accaMatchIds.has(String(m.id)) || accaMatchIds.has(m.id);
                    const isHome = pick === 'HOME';
                    const pickTeam = isHome ? m.home : pick === 'AWAY' ? m.away : 'Draw';
                    const countdown = formatCountdownBadge(msToKickoff);
                    const kickoffStr = formatRelativeDayTime(m, tzSettings);
                    const smartMarketLabel = formatSmartMarket(m.smartMarket ?? m.binaryModel?.smartMarket, `${pickTeam} ML`);
                    const kellyDisplay = formatKellyStake(kelly, '—');

                    return (
                      <React.Fragment key={matchKey}>
                        <tr
                          className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 transition-all md:h-10 cursor-pointer ${
                            isReadyToBet ? 'ring-1 ring-emerald-300 md:ring-0 bg-emerald-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                          onClick={() => toggleExpand(matchKey)}
                        >
                          {/* ================= MOBILE COMPACT CARD VIEW ================= */}
                          <td className="md:hidden p-3 block">
                            <div className="flex justify-between items-start mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="w-5 h-5 rounded font-mono text-[10px] font-bold text-slate-600 bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {kickoffStr}
                                </span>
                                <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200 truncate max-w-[110px]">
                                  {m.league}
                                </span>
                              </div>
                              <div>
                                {m.isLive || item.isMatchInPlay ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white border border-rose-700 shadow-xs animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                      LIVE {item.liveMinStr ? (item.liveMinStr.includes("'") || item.liveMinStr === 'HT' ? item.liveMinStr : `${item.liveMinStr}'`) : ''}
                                    </span>
                                    {item.liveScoreStr && (
                                      <span className="text-[10px] font-mono font-bold text-slate-900 bg-emerald-50 border border-emerald-300 px-1 rounded">
                                        Score: {item.liveScoreStr}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${countdown.color}`}>
                                    {countdown.isWindow && <Lock className="w-2.5 h-2.5" />}
                                    {countdown.label}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Fixture */}
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                <span className={isHome ? 'font-black text-slate-900' : 'text-slate-800'}>{m.home}</span>
                                <span className="text-slate-400 font-normal mx-1">vs</span>
                                <span className={!isHome && pick === 'AWAY' ? 'font-black text-slate-900' : 'text-slate-800'}>{m.away}</span>
                              </div>
                              {isUnanimous && (
                                <span className="text-[8.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold shrink-0">
                                  👑 6/6
                                </span>
                              )}
                              {isTrap && (
                                <span className="text-[8.5px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.2 rounded font-bold shrink-0">
                                  ⚠️ Risk
                                </span>
                              )}
                            </div>

                            {/* Pick + Conf + Odds summary */}
                            <div className="flex items-center justify-between text-[10.5px] bg-slate-50 p-1.5 rounded border border-slate-200/80 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 text-[10px]">Pick:</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                  isPass ? 'bg-slate-100 text-slate-600 border-slate-300'
                                  : isHome ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : pick === 'AWAY' ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {isPass ? 'PASS' : pickTeam}
                                </span>
                                {smartMarketLabel && (
                                  <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                                    {smartMarketLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[10px]">
                                <span className="text-slate-600">@{safeToFixed(matchOdds, 2)}</span>
                                <span className="text-emerald-700 font-bold">€{returns.payoutStr}</span>
                              </div>
                            </div>

                            {/* Mobile action bar & collapse trigger */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenWatchLive && onOpenWatchLive(m);
                                  }}
                                  className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs ${
                                    m.isLive || item.isMatchInPlay
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                  }`}
                                  title={m.isLive || item.isMatchInPlay ? "Open Live In-Play Tactical AI Analysis" : "Open Match Intelligence & Tactical AI Analysis"}
                                >
                                  <Brain className={`w-2.5 h-2.5 shrink-0 ${m.isLive || item.isMatchInPlay ? 'text-white' : 'text-indigo-600'}`} />
                                  <span className="truncate">{m.isLive || item.isMatchInPlay ? 'Live Analysis' : 'Tactical Intel'}</span>
                                </button>

                                {onAddToSlip && !isPass ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddToSlip(m);
                                    }}
                                    className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold border transition-colors cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 ${
                                      inSlip
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                                    }`}
                                  >
                                    {inSlip ? (
                                      <>
                                        <Check className="w-2.5 h-2.5" />
                                        <span>In Slip</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>+ Slip</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <div className="w-[58px] h-6 flex items-center justify-center text-[9px] font-semibold text-slate-400 bg-slate-100/70 border border-slate-200 rounded">
                                    Pass
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium select-none">
                                <span>{isExpanded ? 'Less' : 'Details'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </div>
                            </div>

                            {/* Mobile Collapsible Details */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 bg-slate-50 p-2 rounded-lg text-[10.5px]">
                                <div className="grid grid-cols-3 gap-1 text-center font-mono">
                                  <div className="p-1 rounded bg-white border border-slate-200">
                                    <span className="text-[9px] text-slate-400 block font-sans">Home 1</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(m.prob?.home, 1)}%</span>
                                  </div>
                                  <div className="p-1 rounded bg-white border border-slate-200">
                                    <span className="text-[9px] text-slate-400 block font-sans">Draw X</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(m.prob?.draw, 1)}%</span>
                                  </div>
                                  <div className="p-1 rounded bg-white border border-slate-200">
                                    <span className="text-[9px] text-slate-400 block font-sans">Away 2</span>
                                    <span className="font-bold text-slate-800">{safeToFixed(m.prob?.away, 1)}%</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-slate-600 text-[10px]">
                                  <span>Suggested Stake: <strong>€{safeToFixed(stakeEuro, 0)}</strong></span>
                                  <span>Conf Score: <strong>{safeToFixed(conf, 1)}%</strong></span>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* ================= DESKTOP 1-ROW TABLE VIEW ================= */}
                          {/* Dropdown Chevron */}
                          <td className="hidden md:table-cell py-1 px-1.5 text-center text-slate-400">
                            {isExpanded ? <ChevronUp className="w-3 h-3 mx-auto text-indigo-600" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
                          </td>

                          {/* # */}
                          <td className="hidden md:table-cell py-1 px-1.5 text-center text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>

                          {/* Kickoff & Clock */}
                          <td className="hidden md:table-cell py-1 px-2 text-center whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-[11px] leading-tight">
                              {kickoffStr}
                            </div>
                            <div className="mt-0.5">
                              {m.isLive || item.isMatchInPlay ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-black bg-rose-600 text-white border border-rose-700 shadow-xs animate-pulse">
                                    <span className="w-1 h-1 rounded-full bg-white"></span>
                                    LIVE {item.liveMinStr ? (item.liveMinStr.includes("'") || item.liveMinStr === 'HT' ? item.liveMinStr : `${item.liveMinStr}'`) : ''}
                                  </span>
                                  {item.liveScoreStr && (
                                    <span className="text-[9.5px] font-mono font-bold text-slate-900 bg-emerald-50 border border-emerald-300 px-1 rounded">
                                      {item.liveScoreStr}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${countdown.color}`}>
                                  {countdown.isWindow && <Lock className="w-2.5 h-2.5" />}
                                  {countdown.label}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Fixture */}
                          <td className="hidden md:table-cell py-1 px-2">
                            <div className="flex items-center gap-1 flex-wrap leading-tight text-[11.5px]">
                              <span className={isHome ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}>
                                {m.home}
                              </span>
                              <span className="text-slate-400 font-normal text-[9.5px]">vs</span>
                              <span className={!isHome && pick === 'AWAY' ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}>
                                {m.away}
                              </span>
                              {(m.isLive || item.isMatchInPlay) && (
                                <span className="text-[8.5px] bg-rose-600 text-white font-extrabold px-1 py-0.2 rounded shadow-xs animate-pulse">
                                  IN-PLAY
                                </span>
                              )}
                              {isUnanimous && (
                                <span className="text-[8.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold shrink-0">
                                  👑 6/6
                                </span>
                              )}
                              {isTrap && (
                                <span className="text-[8.5px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.2 rounded font-bold shrink-0">
                                  ⚠️ Risk
                                </span>
                              )}
                            </div>
                          </td>

                          {/* League */}
                          <td className="hidden md:table-cell py-1 px-2 text-slate-500 text-[10px] truncate max-w-[120px]">
                            {m.league}
                          </td>

                          {/* Top Pick */}
                          <td className="hidden md:table-cell py-1 px-2 text-center">
                            <div className="inline-flex flex-col items-center leading-tight">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                isPass ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : isHome ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : pick === 'AWAY' ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {isPass ? 'PASS' : pickTeam}
                              </span>
                              {smartMarketLabel && (
                                <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[110px]">
                                  {smartMarketLabel}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Confidence */}
                          <td className="hidden md:table-cell py-1 px-1.5 text-center">
                            <ConfidenceGauge confidence={conf} size="sm" />
                          </td>

                          {/* LiveScore Bet Odds & Potential Return */}
                          <td className="hidden md:table-cell py-1 px-1.5 text-center">
                            <KellyTooltip showIcon={false} align="right">
                              <div className="flex flex-col items-center cursor-help leading-tight">
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[10.5px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded" title={`${oddsProvider} Odds`}>
                                    @{safeToFixed(matchOdds, 2)}
                                  </span>
                                  <span className="text-[10.5px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded" title="Recommended Wager">
                                    €{safeToFixed(stakeEuro, 0)}
                                  </span>
                                </div>
                                <div className="text-[9.5px] font-medium text-slate-600 mt-0.5 whitespace-nowrap">
                                  Returns <strong className="text-emerald-700 font-mono">€{returns.payoutStr}</strong>
                                </div>
                              </div>
                            </KellyTooltip>
                          </td>

                          {/* Actions (Watch Now + Slip) */}
                          <td className="hidden md:table-cell py-1 px-2 text-center whitespace-nowrap w-44">
                            <div className="grid grid-cols-[98px_58px] gap-1.5 items-center justify-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenWatchLive && onOpenWatchLive(m);
                                }}
                                className={`w-[98px] h-6 px-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 shadow-2xs ${
                                  m.isLive || item.isMatchInPlay
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs animate-pulse font-extrabold'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                                title={m.isLive || item.isMatchInPlay ? "Open Live In-Play Tactical AI Analysis" : "Open Match Intelligence & Tactical AI Analysis"}
                              >
                                <Brain className={`w-2.5 h-2.5 shrink-0 ${m.isLive || item.isMatchInPlay ? 'text-white' : 'text-indigo-600'}`} />
                                <span className="truncate">{m.isLive || item.isMatchInPlay ? 'Live Analysis' : 'Tactical Intel'}</span>
                              </button>

                              {onAddToSlip && !isPass ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToSlip(m);
                                  }}
                                  className={`w-[58px] h-6 px-1 rounded text-[10px] font-bold border transition-colors cursor-pointer inline-flex items-center justify-center gap-0.5 shrink-0 ${
                                    inSlip
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                      : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                                  }`}
                                >
                                  {inSlip ? (
                                    <>
                                      <Check className="w-2.5 h-2.5" />
                                      <span>In Slip</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>+ Slip</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="w-[58px] h-6 flex items-center justify-center text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-200/80 rounded">
                                  Pass
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Desktop Collapsible Details */}
                        {isExpanded && (
                          <tr className="hidden md:table-row bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={9} className="p-3">
                              <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                  <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                                    <span className="font-bold text-slate-800">Match Analytical Profile:</span>
                                    <span className="font-mono text-slate-500 text-[11px]">{m.home} vs {m.away}</span>
                                    {(m.isLive || item.isMatchInPlay) && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                        🔴 In-Play Score: {item.liveScoreStr || '0 - 0'} ({item.liveMinStr})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onOpenWatchLive && onOpenWatchLive(m)}
                                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <Brain className="w-3 h-3 text-white" />
                                      <span>Open Tactical AI Analysis ↗</span>
                                    </button>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ID: {m.id}
                                    </span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 font-mono text-[11px]">
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">
                                      {(m.isLive || item.isMatchInPlay) ? 'In-Play Live Probabilities' : '1X2 Probabilities'}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      H: {safeToFixed(m.inPlayPrediction?.liveProb?.home ?? m.prob?.home, 1)}% | D: {safeToFixed(m.inPlayPrediction?.liveProb?.draw ?? m.prob?.draw, 1)}% | A: {safeToFixed(m.inPlayPrediction?.liveProb?.away ?? m.prob?.away, 1)}%
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">
                                      {(m.isLive || item.isMatchInPlay) ? 'Projected Final Score' : 'Expected Goals (xG)'}
                                    </span>
                                    <span className="font-bold text-indigo-700">
                                      {(m.isLive || item.isMatchInPlay) ? (m.inPlayPrediction?.projectedFinalScore || m.mostLikelyScore || '1 - 0') : `H: ${m.xgHome ?? '1.2'} | A: ${m.xgAway ?? '1.0'}`}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">Pre-Match Locked Status</span>
                                    <span className="font-bold text-slate-700 flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-slate-400" />
                                      <span>Pick: {pickTeam} ({conf}%)</span>
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block font-sans text-[10px] uppercase">Optimal Wager</span>
                                    <span className="font-bold text-slate-800">€{safeToFixed(stakeEuro, 0)} ➔ Payout €{returns.payoutStr}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
