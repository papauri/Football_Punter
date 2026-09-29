import React, { useEffect, useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, Circle, Loader2, ExternalLink } from 'lucide-react';

// API keys: which are set, whether each works (a free test call), and a simple way to add, replace,
// test or remove one. Keys never come back from the server in full, only as e.g. "ab12…9f3c".

const ONE_HOUR = 60 * 60 * 1000;

function StatusPill({ service, testing }) {
  if (testing) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…</span>;
  if (!service.configured) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Circle className="w-3.5 h-3.5" /> Not set</span>;
  const t = service.lastTest;
  if (!t) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Circle className="w-3.5 h-3.5" /> Not tested</span>;
  return t.ok
    ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> Working</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5"><XCircle className="w-3.5 h-3.5" /> Not working</span>;
}

export default function ApiKeysCard() {
  const [services, setServices] = useState([]);
  const [usage, setUsage] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [notes, setNotes] = useState({});
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    try {
      const res = await fetch('/api/keys');
      const json = await res.json();
      setServices(json.services || []);
      setUsage(json.oddsUsage || null);
      setLoadError(null);
      return json.services || [];
    } catch (e) {
      setLoadError('Could not load API keys.');
      return [];
    }
  };

  const test = async (id) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch('/api/keys/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (json.services) setServices(json.services);
      setNotes(n => ({ ...n, [id]: null }));
      if (id === 'odds') load();
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  // On opening Settings, re-test any set key not tested in the last hour. The tests are free.
  useEffect(() => {
    load().then(list => {
      list.filter(s => s.configured && (!s.lastTest || Date.now() - Date.parse(s.lastTest.at) > ONE_HOUR)).forEach(s => test(s.id));
    });
  }, []);

  const save = async (id) => {
    const key = (drafts[id] || '').trim();
    if (!key) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, key }) });
      const json = await res.json();
      if (!res.ok) { setNotes(n => ({ ...n, [id]: json.error || 'Could not save.' })); return; }
      if (json.services) setServices(json.services);
      setDrafts(d => ({ ...d, [id]: '' }));
      setNotes(n => ({ ...n, [id]: json.ok ? 'Saved.' : 'Saved, but the test failed. Check the key.' }));
      if (id === 'odds') load();
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  const remove = async (id) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { setNotes(n => ({ ...n, [id]: json.error || 'Could not remove.' })); return; }
      if (json.services) setServices(json.services);
      setNotes(n => ({ ...n, [id]: 'Removed.' }));
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3" id="api-keys">
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-4 h-4 text-slate-500" /> API keys</h2>
      {loadError && <p className="text-xs text-rose-700">{loadError}</p>}
      <ul className="divide-y divide-slate-100">
        {services.map(s => (
          <li key={s.id} className="py-3 space-y-2" data-service={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900">{s.name}</div>
                <div className="text-[11px] text-slate-500">{s.use}</div>
              </div>
              <StatusPill service={s} testing={busy[s.id]} />
            </div>

            {s.configured && (
              <div className="text-[11px] text-slate-600">
                Key <span className="font-mono">{s.masked}</span>, {s.source === 'server' ? 'set on the server' : 'saved in the app'}.
                {s.lastTest && <span className={s.lastTest.ok ? 'text-emerald-700' : 'text-rose-700'}> {s.lastTest.message}</span>}
              </div>
            )}

            {s.id === 'odds' && s.lastTest?.ok && usage && (
              <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
                {usage.remaining != null ? <><strong>{usage.remaining}</strong> credits left this month. </> : null}
                Used today: {usage.spentToday} of {usage.allowanceToday} credits. The app only fetches competitions with upcoming matches ESPN has no price for, at most twice a day each, and keeps {usage.reserve} credits in reserve.
                {usage.pricedMatches > 0 && <> {usage.pricedMatches} matches currently priced from it.</>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                autoComplete="off"
                value={drafts[s.id] || ''}
                onChange={e => setDrafts(d => ({ ...d, [s.id]: e.target.value }))}
                placeholder={s.configured ? 'Paste a new key to replace it' : 'Paste key'}
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                aria-label={`${s.name} key`}
              />
              <button type="button" onClick={() => save(s.id)} disabled={!drafts[s.id]?.trim() || busy[s.id]}
                className="h-8 px-3 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer">
                Save &amp; test
              </button>
              {s.configured && (
                <button type="button" onClick={() => test(s.id)} disabled={busy[s.id]}
                  className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer">
                  Test
                </button>
              )}
              {s.configured && s.source === 'app' && (
                <button type="button" onClick={() => remove(s.id)} disabled={busy[s.id]}
                  className="h-8 px-3 rounded-lg text-xs font-semibold border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 disabled:opacity-40 cursor-pointer">
                  Remove
                </button>
              )}
              {!s.configured && s.signup && (
                <a href={s.signup} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-0.5">
                  Get a key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {notes[s.id] && <p className="text-[11px] text-slate-600">{notes[s.id]}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
