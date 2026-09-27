import React, { useState, useEffect, useMemo } from 'react';
import MobileViewSwitcher from './MobileViewSwitcher';
import WatchButton from './WatchButton';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import { useWatchList } from '../utils/useWatchList';
import { MobileFoldCell, FoldSummary, FoldBadge, compactKickoff } from './MobileFold';
import { ChevronDown, ChevronUp, Plus, Check, BarChart2 } from 'lucide-react';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { isTrapMatch, normalizePick, getSlipPick, plainPickLabel } from '../utils/riskUtils';
import { isLeagueBlacklisted } from '../utils/leagueUtils';
import { formatSafeDateTime, formatRelativeDayTime, getLocalizedDateKey, getLocalizedTodayKey } from '../utils/dateUtils';
import { resolveMatchOdds, calculatePotentialReturn } from '../utils/oddsUtils';
import { getMatchPhase, isInPlayPhase, phaseLabel, liveScoreText } from '../utils/matchStatus';

// Today's matches: the first thing on the home page, built to place a bet quickly.
//   All         every match on today's card (or the next day with matches)
//   In play     matches under way, including ones past kickoff that the live feed has not confirmed
//   Watch list  matches you starred, on any day
//   Best bets   upcoming matches where the model has a tip at 60% or more and no risk flag

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdownText(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `in ${Math.max(0, mins)}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h ${mins % 60}m`;
  return `in ${Math.floor(h / 24)}d`;
}

const PHASE_TONE = {
  live: 'bg-rose-600 text-white border-rose-700',
  starting: 'bg-rose-50 text-rose-700 border-rose-200',
  finished: 'bg-slate-100 text-slate-600 border-slate-200',
  postponed: 'bg-amber-50 text-amber-800 border-amber-200',
  'result-pending': 'bg-slate-100 text-slate-600 border-slate-200'
};

function StatusBadge({ m, phase, now }) {
  if (phase === 'upcoming') {
    const ms = (m.timestamp || 0) - now;
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-slate-50 text-slate-600 border-slate-200">{countdownText(ms)}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${PHASE_TONE[phase] || PHASE_TONE.finished}`}>
      {phase === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      {phaseLabel(m, phase)}
    </span>
  );
}

export default function DailyBriefingPanel({
  matches = [],
  tzSettings = {},
  onAddToSlip,
  onOpenWatchLive,
  accaMatchIds = new Set(),
  bankrollEuro = 1000
}) {
  const [mobileViewMode] = useMobileViewMode();
  const { isWatched } = useWatchList();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const now = useNow();

  const todayKey = useMemo(() => getLocalizedTodayKey(tzSettings), [tzSettings]);
  const dateKeyOf = (m) => getLocalizedDateKey(m.timestamp || m.utcDate || m.dateIso || m.date, tzSettings);

  // Today if anything is still to play or in play today, otherwise the next day with matches.
  const { targetDateKey, isToday } = useMemo(() => {
    const open = matches.filter(m => getMatchPhase(m, now) !== 'finished' && !isLeagueBlacklisted(m.league));
    if (open.some(m => dateKeyOf(m) === todayKey)) return { targetDateKey: todayKey, isToday: true };
    const next = open.map(dateKeyOf).filter(d => d && d !== 'Upcoming' && d >= todayKey).sort()[0] || todayKey;
    return { targetDateKey: next, isToday: next === todayKey };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, todayKey, tzSettings, now]);

  const rows = useMemo(() => {
    const build = (m) => {
      const phase = getMatchPhase(m, now);
      const smart = normalizePick(m.smartMarket?.pick || '');
      const isPass = smart === 'PASS' || Boolean(m.disruptionModel?.isPassFlagged);
      const pick = isPass ? 'PASS' : (smart || getSlipPick(m));
      const conf = safeParseFloat(m.confidence ?? m.binaryModel?.confidence,
        Math.max(safeParseFloat(m.prob?.home), safeParseFloat(m.prob?.draw), safeParseFloat(m.prob?.away)));
      const odds = isPass ? null : resolveMatchOdds(m, pick);
      const kelly = m.kellyStake ?? m.binaryModel?.kellyStake;
      const units = safeParseFloat(kelly?.units ?? kelly?.fraction, 0);
      const rawEuro = safeParseFloat(kelly?.stakeEuro, 0);
      const stake = rawEuro > 0 ? rawEuro : units > 0 ? (units <= 1 ? units * bankrollEuro : (units / 100) * bankrollEuro) : bankrollEuro * 0.02;
      const isRisky = isTrapMatch(m);
      return {
        m, phase, pick, isPass, isRisky, conf, odds, stake,
        returns: odds ? calculatePotentialReturn(stake, odds) : null,
        isBest: phase === 'upcoming' && !isPass && !isRisky && conf >= 60
      };
    };
    const byTime = (a, b) => {
      const live = (r) => (isInPlayPhase(r.phase) ? 0 : 1);
      return live(a) - live(b) || (a.m.timestamp || 0) - (b.m.timestamp || 0);
    };
    const visible = matches.filter(m => !isLeagueBlacklisted(m.league));
    const slate = visible.filter(m => getMatchPhase(m, now) !== 'finished' && dateKeyOf(m) === targetDateKey).map(build).sort(byTime);
    const inPlay = visible.filter(m => isInPlayPhase(getMatchPhase(m, now))).map(build).sort(byTime);
    const watched = visible.filter(m => isWatched(m.id)).map(build).sort(byTime);
    return { slate, inPlay, watched, best: slate.filter(r => r.isBest) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, targetDateKey, tzSettings, now, bankrollEuro, isWatched]);

  if (rows.slate.length === 0 && rows.inPlay.length === 0 && rows.watched.length === 0) return null;

  const TABS = [
    { id: 'all', label: 'All', list: rows.slate },
    { id: 'inplay', label: 'In play', list: rows.inPlay, live: true },
    { id: 'watch', label: 'Watch list', list: rows.watched },
    { id: 'best', label: 'Best bets', list: rows.best }
  ];
  const current = TABS.find(t => t.id === activeTab) || TABS[0];
  const dayLabel = isToday ? 'Today' : formatSafeDateTime(targetDateKey, null, tzSettings).date;
  const emptyText = {
    all: 'No matches left on this day.',
    inplay: 'Nothing in play right now.',
    watch: 'Tap the star on any match to follow it here.',
    best: 'No strong tips yet. Check back closer to kickoff.'
  }[current.id];

  const addButton = (r, inSlip) => (r.isPass || !onAddToSlip) ? (
    <span className="inline-flex items-center justify-center h-7 px-2 rounded-md text-[10.5px] font-semibold text-slate-400 bg-slate-50 border border-slate-200" title="Too close to call, so no tip">No bet</span>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAddToSlip(r.m, r.pick); }}
      className={`inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[10.5px] font-bold border transition-colors cursor-pointer ${
        inSlip ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
      }`}
      title={inSlip ? 'Remove from bet slip' : 'Add to bet slip'}
    >
      {inSlip ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
      <span>{inSlip ? 'Added' : 'Add'}</span>
    </button>
  );

  const detailsButton = (r) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpenWatchLive && onOpenWatchLive(r.m); }}
      className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[10.5px] font-bold border bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer"
      title="Match stats and live updates"
    >
      <BarChart2 className="w-3 h-3" />
      <span>Stats</span>
    </button>
  );

  const details = (r) => {
    const m = r.m;
    const live = r.phase === 'live' ? m.inPlayPrediction?.liveProb : null;
    const p = live || m.prob || {};
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        {[['Home win', p.home], ['Draw', p.draw], ['Away win', p.away]].map(([label, v]) => (
          <div key={label} className="bg-slate-50 border border-slate-200 rounded p-2">
            <div className="text-[10px] text-slate-500">{label}{live ? ' (now)' : ''}</div>
            <div className="font-bold text-slate-900 font-mono">{safeToFixed(v, 0)}%</div>
          </div>
        ))}
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <div className="text-[10px] text-slate-500">{r.phase === 'live' ? 'Likely final score' : 'Likely score'}</div>
          <div className="font-bold text-slate-900 font-mono">{(r.phase === 'live' && m.inPlayPrediction?.projectedFinalScore) || m.mostLikelyScore || '—'}</div>
        </div>
        {r.returns && (
          <div className="col-span-2 sm:col-span-4 text-slate-600">
            Suggested stake <strong className="text-slate-900">€{safeToFixed(r.stake, 0)}</strong> at {safeToFixed(r.odds, 2)} returns <strong className="text-emerald-700">€{r.returns.payoutStr}</strong> if it wins.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-4">
      <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{dayLabel}'s matches</h2>
          <p className="text-[11px] text-slate-500">{rows.slate.length} {rows.slate.length === 1 ? 'match' : 'matches'}{rows.inPlay.length ? ` · ${rows.inPlay.length} in play` : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <span>{collapsed ? 'Show' : 'Hide'}</span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center gap-1.5">
            {TABS.map(t => {
              const on = t.id === current.id;
              const n = t.list.length;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 border transition-colors ${
                    on ? (t.live ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-900 text-white border-slate-900')
                       : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.live && n > 0 && <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-white' : 'bg-rose-500'} animate-pulse`} />}
                  <span>{t.label}</span>
                  <span className={`text-[10px] font-mono ${on ? 'text-white/80' : 'text-slate-400'}`}>{n}</span>
                </button>
              );
            })}
            <MobileViewSwitcher label="Display" className="ml-auto md:hidden" />
          </div>

          <table className="block md:table w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider h-8">
                <th className="px-2 w-10"></th>
                <th className="px-2 w-32">Kick-off</th>
                <th className="px-2">Match</th>
                <th className="px-2 w-40">League</th>
                <th className="px-2 w-48">Tip</th>
                <th className="px-2 w-16 text-center">Chance</th>
                <th className="px-2 w-16 text-center">Odds</th>
                <th className="px-2 w-40 text-right"></th>
              </tr>
            </thead>
            <tbody className="p-2.5 md:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2 md:space-y-0">
              {current.list.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-500 block md:table-cell">{emptyText}</td>
                </tr>
              ) : current.list.map((r) => {
                const m = r.m;
                const key = String(m.id);
                const open = expandedId === key;
                const inSlip = accaMatchIds.has(String(m.id)) || accaMatchIds.has(m.id);
                const kickoff = formatRelativeDayTime(m, tzSettings);
                const score = liveScoreText(m, r.phase);
                const tip = plainPickLabel(r.pick, m);
                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200 md:border-0 cursor-pointer hover:bg-slate-50/60 ${r.phase === 'live' ? 'md:bg-rose-50/30' : ''}`}
                      onClick={() => setExpandedId(open ? null : key)}
                    >
                      <MobileFoldCell
                        mode={mobileViewMode}
                        expanded={open}
                        summary={
                          <FoldSummary
                            lead={r.phase === 'upcoming' ? compactKickoff(kickoff) : phaseLabel(m, r.phase)}
                            home={m.home}
                            away={m.away}
                            live={r.phase === 'live'}
                            meta={r.isPass ? 'No bet · too close to call' : tip}
                            expanded={open}
                            badges={<>
                              {score && <FoldBadge tone="live" mono>{score}</FoldBadge>}
                              {!r.isPass && <FoldBadge tone={r.isBest ? 'good' : 'info'} mono>{Math.round(r.conf)}%</FoldBadge>}
                              {r.odds > 1 && <FoldBadge mono>{safeToFixed(r.odds, 2)}</FoldBadge>}
                            </>}
                          />
                        }
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-700">{kickoff}</span>
                          <StatusBadge m={m} phase={r.phase} now={now} />
                        </div>
                        <div className="font-bold text-slate-900 text-[13px] leading-snug">
                          {m.home} <span className="text-slate-400 font-normal">v</span> {m.away}
                          {score && <span className="ml-2 font-mono text-rose-700">{score}</span>}
                        </div>
                        <div className="text-[10.5px] text-slate-500 mb-2">{m.league}</div>
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 mb-2 text-[11.5px]">
                          <span className={`font-semibold ${r.isPass ? 'text-slate-500' : 'text-slate-900'}`}>{r.isPass ? 'No bet · too close to call' : tip}</span>
                          {!r.isPass && <span className="font-mono text-slate-700">{Math.round(r.conf)}% · {safeToFixed(r.odds, 2)}</span>}
                        </div>
                        {r.isRisky && !r.isPass && <div className="text-[10.5px] text-amber-700 mb-2">Risky: the model and the odds disagree on this one.</div>}
                        <div className="flex items-center gap-1.5">
                          <WatchButton matchId={m.id} />
                          {detailsButton(r)}
                          <div className="ml-auto">{addButton(r, inSlip)}</div>
                        </div>
                        {open && <div className="mt-2 pt-2 border-t border-slate-100">{details(r)}</div>}
                      </MobileFoldCell>

                      <td className="hidden md:table-cell px-2 py-1.5"><WatchButton matchId={m.id} /></td>
                      <td className="hidden md:table-cell px-2 py-1.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-[11px]">{kickoff}</div>
                        <div className="mt-0.5"><StatusBadge m={m} phase={r.phase} now={now} /></div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5">
                        <span className="font-semibold text-slate-900">{m.home}</span>
                        <span className="text-slate-400 mx-1">v</span>
                        <span className="font-semibold text-slate-900">{m.away}</span>
                        {score && <span className="ml-2 font-mono font-bold text-rose-700">{score}</span>}
                        {r.isRisky && !r.isPass && <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1" title="The model and the odds disagree">Risky</span>}
                      </td>
                      <td className="hidden md:table-cell px-2 py-1.5 text-slate-500 text-[11px] truncate max-w-[160px]">{m.league}</td>
                      <td className={`hidden md:table-cell px-2 py-1.5 font-semibold ${r.isPass ? 'text-slate-400' : 'text-slate-900'}`}>{r.isPass ? 'No bet' : tip}</td>
                      <td className="hidden md:table-cell px-2 py-1.5 text-center font-mono">{r.isPass ? '—' : `${Math.round(r.conf)}%`}</td>
                      <td className="hidden md:table-cell px-2 py-1.5 text-center font-mono">{r.odds > 1 ? safeToFixed(r.odds, 2) : '—'}</td>
                      <td className="hidden md:table-cell px-2 py-1.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {detailsButton(r)}
                          {addButton(r, inSlip)}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="hidden md:table-row bg-slate-50/60">
                        <td colSpan={8} className="px-4 py-3">{details(r)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
