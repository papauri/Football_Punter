import React, { useState } from 'react';
import { 
  Clock, 
  Globe, 
  Save, 
  Check, 
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';

export default function TimezonePage({
  tzSettings = {},
  onSaveTimezone,
  onUpdateSettings
}) {
  const [selectedZone, setSelectedZone] = useState(tzSettings?.zone || 'UTC');
  const [hourFormat, setHourFormat] = useState(tzSettings?.hour24 ? '24' : '12');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state if props update
  React.useEffect(() => {
    if (tzSettings?.zone) setSelectedZone(tzSettings.zone);
    if (tzSettings?.hour24 !== undefined) setHourFormat(tzSettings.hour24 ? '24' : '12');
  }, [tzSettings?.zone, tzSettings?.hour24]);

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'Europe/London', label: 'London / Dublin (GMT / BST)' },
    { value: 'Europe/Paris', label: 'Paris / Berlin / Madrid / Rome (CET / CEST)' },
    { value: 'Europe/Athens', label: 'Athens / Istanbul (EET / EEST)' },
    { value: 'America/New_York', label: 'New York / Eastern Time (EST / EDT)' },
    { value: 'America/Chicago', label: 'Chicago / Central Time (CST / CDT)' },
    { value: 'America/Denver', label: 'Denver / Mountain Time (MST / MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles / Pacific Time (PST / PDT)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'Asia/Dubai', label: 'Dubai / Gulf Standard (GST)' },
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok / Jakarta (ICT)' },
    { value: 'Asia/Singapore', label: 'Singapore / Hong Kong (SGT / HKT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo / Seoul (JST / KST)' },
    { value: 'Australia/Perth', label: 'Perth / Western Australia (AWST, UTC+8)' },
    { value: 'Australia/Adelaide', label: 'Adelaide / Central Australia (ACST / ACDT, UTC+9:30)' },
    { value: 'Australia/Brisbane', label: 'Brisbane / Queensland (AEST, UTC+10)' },
    { value: 'Australia/Sydney', label: 'Sydney / Melbourne / Canberra (AEST / AEDT, UTC+10/11)' }
  ];

  const now = new Date();
  const formatSampleTime = () => {
    try {
      return now.toLocaleTimeString([], {
        timeZone: selectedZone,
        hour12: hourFormat === '12',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return now.toTimeString().slice(0, 8);
    }
  };

  const notifyChange = (newZone, newHour24) => {
    const nextSettings = {
      zone: newZone,
      hour24: newHour24
    };
    if (typeof onUpdateSettings === 'function') onUpdateSettings(nextSettings);
    if (typeof onSaveTimezone === 'function') onSaveTimezone(nextSettings);
  };

  const handleZoneSelect = (newZone) => {
    setSelectedZone(newZone);
    notifyChange(newZone, hourFormat === '24');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleHourSelect = (newFormat) => {
    setHourFormat(newFormat);
    notifyChange(selectedZone, newFormat === '24');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSave = () => {
    notifyChange(selectedZone, hourFormat === '24');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-base">
            Timezone &amp; Kickoff Clock Preferences
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how kickoff times, live minutes, and scheduled scrapes are displayed across the platform
          </p>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        
        {/* Live Clock Preview */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Selected Clock</div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">{formatSampleTime()}</div>
            <div className="text-xs text-slate-500">{selectedZone}</div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Browser System Time:</div>
            <div className="font-mono text-slate-600 font-semibold">{now.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Timezone Region</label>
            <UniformDropdown
              value={selectedZone}
              onChange={handleZoneSelect}
              options={timezoneOptions}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Clock Format</label>
            <UniformDropdown
              value={hourFormat}
              onChange={handleHourSelect}
              options={[
                { value: '12', label: '12-Hour (e.g. 03:00 PM)' },
                { value: '24', label: '24-Hour (e.g. 15:00)' }
              ]}
              className="w-full"
            />
          </div>

        </div>

        {/* Sample Match Preview */}
        <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1">
          <div className="font-semibold text-slate-700">Kickoff Display Preview:</div>
          <div className="text-slate-600 flex items-center gap-2">
            <span className="font-bold text-slate-900">Arsenal vs Chelsea</span>
            <span>•</span>
            <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {formatSampleTime().slice(0, 5)} {hourFormat === '12' ? (parseInt(formatSampleTime().slice(0, 2)) >= 12 ? 'PM' : 'AM') : ''}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Timezone Applied!' : 'Save & Apply Timezone'}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
