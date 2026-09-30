import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Check, ChevronDown, ChevronUp, Target, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { formatSafeDateTime } from '../utils/dateUtils';
import UniformDropdown from './UniformDropdown';

// The day's most likely bets across every match and market (src/model/topPicks.js).
const KIND_FILTERS = [
  { value: '', label: 'All bets' },
  { value: 'Result,Double chance', label: 'Results' },
  { value: 'Goals,Team goals,First half', label: 'Goals' },
  { value: 'Corners,Cards', label: 'Corners & cards' }
];

export default function TopPicksPage({ matches = [], tzSettings, onAddToSlip, accaMatchIds = new Set(), onOpenDeepResearch }) {
  const [hours, setHours] = useState(24);
  const [min, setMin] = useState(80);
  const [kinds, setKinds] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/top-picks?hours=${hours}&min=${min}&kinds=${encodeURIComponent(kinds)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not load the picks');
      setData(json.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hours, min, kinds]);

  const byId = useMemo(() => new Map(matches.map(m => [m.id, m])), [matches]);
  const picks = data?.picks || [];

  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const addButton = (row, pick) => {
    if (!onAddToSlip) return null;
    const match = byId.get(row.matchId) || { id: row.matchId, home: row.home, away: row.away, league: row.league, timestamp: row.timestamp, dateIso: row.dateIso, time: row.time };
    const inSlip = accaMatchIds.has(row.matchId);
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAddToSlip(match, pick.label, `Top pick: ${pick.kind}`, pick.priceNow || pick.betAt, pick.chance); }}
        className={`h-7 px-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ${inSlip ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        title={inSlip ? 'This match is in your slip' : 'Add to bet slip'}
      >
        {inSlip ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        <span>{inSlip ? 'Added' : 'Add'}</span>
      </button>
    );
  };

  const priceLine = (pick) => (
    <span className="text-[11px] text-slate-600">
      Bet at <strong className="font-mono text-slate-900">{pick.betAt.toFixed(2)}+</strong>
      {pick.priceNow != null && (
        <span className={pick.priceNow >= pick.betAt ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
          {' '}· now {pick.priceNow.toFixed(2)}{pick.priceNow >= pick.betAt ? ' (worth it)' : ' (too short)'}
        </span>
      )}
    </span>
  );

  const checkList = (pick) => (pick.checks || []).length > 0 && (
    <ul className="mt-1 space-y-0.5">
      {pick.checks.map((c, i) => (
        <li key={i} className={`text-[11px] flex items-start gap-1 ${c.tone === 'warn' ? 'text-amber-800 font-semibold' : c.tone === 'ok' ? 'text-slate-600' : 'text-slate-500'}`}>
          {c.tone === 'warn' ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
            : c.tone === 'ok' ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600" />
              : <Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />}
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Top picks</h1>
            <p className="text-[11px] text-slate-500 max-w-xl">
              The most likely bets on every priced match in any competition, friendlies included, from
              results, goals, corners and cards. Only bets
              at {min}%+ with a proven past record are shown, one per match, in kick-off order. Each
              pick lists what was checked: the odds, the agents' votes and the lineups.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UniformDropdown label="When" value={hours} onChange={(v) => setHours(Number(v))}
            options={[{ value: 24, label: 'Next 24 hours' }, { value: 48, label: 'Next 2 days' }, { value: 72, label: 'Next 3 days' }]} />
          <UniformDropdown label="Chance" value={min} onChange={(v) => setMin(Number(v))}
            options={[{ value: 80, label: '80%+' }, { value: 85, label: '85%+' }, { value: 90, label: '90%+' }]} />
          <UniformDropdown label="Bets" value={kinds} onChange={setKinds} options={KIND_FILTERS} />
        </div>
        <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
          Likely is not the same as profitable. On past seasons these bets came in as often as shown, but
          at one bookmaker's prices they still lost about 4% overall, because a likely bet pays little.
          Only take one when your bookmaker pays at least the "bet at" price.
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs">{error}</div>}

      {!loading && data && picks.length === 0 && (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-800">No bet reaches {min}% in this window</div>
          <div className="text-xs text-slate-500 mt-1">{data.matchesScanned} matches checked. Try a longer window or a lower chance.</div>
        </div>
      )}

      {picks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs divide-y divide-slate-100">
          <div className="px-3 py-2 text-[11px] text-slate-500 flex flex-wrap justify-between gap-2">
            <span>{picks.length} picks from {data.matchesScanned} matches{data.competitionsScanned > 0 ? ` (incl. ${data.competitionsScanned} more competitions)` : ''}</span>
            {data.record?.matches > 0 && <span title="Corners and cards: the corners and cards model's own held-out seasons">Past record: {data.record.matches.toLocaleString()} matches in Europe's 14 main leagues{data.record.otherMatches > 0 ? ` and ${data.record.otherMatches.toLocaleString()} in other leagues, cups, qualifiers and friendlies` : ''}</span>}
          </div>
          {picks.map((row, idx) => {
            const when = formatSafeDateTime(row, null, tzSettings);
            const prevWhen = idx > 0 ? formatSafeDateTime(picks[idx - 1], null, tzSettings) : null;
            const newDay = !prevWhen || prevWhen.day !== when.day || prevWhen.date !== when.date;
            const isOpen = open.has(row.id);
            return (
              <React.Fragment key={row.id}>
              {newDay && (
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">{when.day}, {when.date}</div>
              )}
              <div className="px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-lg font-bold text-emerald-700 font-mono leading-none">{Math.round(row.chance)}%</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">chance</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">{row.label}</div>
                    <div className="text-xs text-slate-700 truncate">
                      {onOpenDeepResearch && byId.get(row.matchId)
                        ? <button type="button" className="hover:underline cursor-pointer" onClick={() => onOpenDeepResearch(byId.get(row.matchId))}>{row.home} vs {row.away}</button>
                        : <span>{row.home} vs {row.away}</span>}
                    </div>
                    <div className="text-[11px] text-slate-500"><strong className="text-slate-700">{when.time}</strong> · {row.league} · {row.kind}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {priceLine(row)}
                      <span className="text-[11px] text-slate-500" title="How often this bet at this chance came in on past matches the model had not seen">
                        Came in {row.pastHitRate}% of {row.pastPicks.toLocaleString()} past picks
                      </span>
                    </div>
                    {checkList(row)}
                    {row.others.length > 0 && (
                      <button type="button" onClick={() => toggle(row.id)} className="mt-1 text-[11px] text-indigo-600 font-semibold inline-flex items-center gap-0.5 cursor-pointer">
                        {isOpen ? 'Hide' : `${row.others.length} more strong bet${row.others.length > 1 ? 's' : ''} on this match`}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    {isOpen && (
                      <div className="mt-1.5 space-y-1">
                        {row.others.map(o => (
                          <div key={o.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800">{o.label} <span className="font-mono text-emerald-700">{Math.round(o.chance)}%</span></div>
                              {priceLine(o)}
                              {checkList(o)}
                            </div>
                            {addButton(row, o)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {addButton(row, row)}
                </div>
              </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
