import React, { useState } from 'react';
import { Clock, Lock, Check } from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import ApiKeysCard from './ApiKeysCard';

// Settings, kept to what a user actually changes: the time zone and clock, API keys, and which
// leagues get tips. The old page also exposed the model's internal parameters (home advantage, rho, Elo K,
// entropy floors). Those are not settings a punter should move, and while the model is frozen for
// testing the server refuses every change anyway, so the sliders did nothing but claim "Saved".

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London / Dublin' },
  { value: 'Europe/Paris', label: 'Paris / Berlin / Madrid / Rome' },
  { value: 'Europe/Athens', label: 'Athens / Istanbul' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg / Harare / Lusaka' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Africa/Nairobi', label: 'Nairobi' },
  { value: 'America/New_York', label: 'New York (Eastern)' },
  { value: 'America/Chicago', label: 'Chicago (Central)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Singapore', label: 'Singapore / Hong Kong' },
  { value: 'Asia/Tokyo', label: 'Tokyo / Seoul' },
  { value: 'Australia/Sydney', label: 'Sydney / Melbourne' }
];

export default function SettingsPage({ state = {}, tzSettings = {}, onUpdateTzSettings, onSaveLeagues }) {
  const [saved, setSaved] = useState(false);
  const [leagueMessage, setLeagueMessage] = useState(null);
  const frozen = Boolean(state.modelFrozen);
  const disabled = state.hyperparameters?.disabledLeagues || [];
  const zone = tzSettings.zone || 'UTC';
  const hour24 = tzSettings.hour24 !== false;
  const zoneOptions = TIMEZONES.some(t => t.value === zone) ? TIMEZONES : [{ value: zone, label: zone }, ...TIMEZONES];

  const setTz = (next) => {
    if (typeof onUpdateTzSettings !== 'function') return;
    onUpdateTzSettings({ zone, hour24, ...next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const turnLeagueOn = async (league) => {
    if (typeof onSaveLeagues !== 'function') return;
    const result = await onSaveLeagues(disabled.filter(l => l !== league));
    setLeagueMessage(result?.ok ? `${league} switched back on.` : `Couldn't change leagues: ${result?.error || 'try again'}.`);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Time</h2>
          {saved && <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UniformDropdown label="Time zone" value={zone} onChange={(val) => setTz({ zone: val })} options={zoneOptions} />
          <div className="flex items-center gap-2">
            {[['12-hour', false], ['24-hour', true]].map(([label, val]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTz({ hour24: val })}
                className={`flex-1 h-8 rounded-lg text-xs font-semibold border cursor-pointer ${
                  hour24 === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ApiKeysCard />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Leagues without tips</h2>
        {frozen && (
          <p className="text-xs text-slate-600 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
            <span>The prediction model is locked while its results are being tested, so this list can't be changed right now.</span>
          </p>
        )}
        {disabled.length === 0 ? (
          <p className="text-xs text-slate-500">Every covered league gets tips.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {disabled.map(league => (
              <li key={league} className="flex items-center justify-between py-1.5">
                <span className="text-slate-800">{league}</span>
                {!frozen && (
                  <button type="button" onClick={() => turnLeagueOn(league)} className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer">
                    Turn on
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {leagueMessage && <p className="text-xs text-slate-600">{leagueMessage}</p>}
      </div>
    </div>
  );
}
