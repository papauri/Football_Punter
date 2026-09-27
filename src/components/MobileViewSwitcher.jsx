import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useMobileViewMode } from '../utils/useMobileViewMode';

export default function MobileViewSwitcher({ className = '', label = 'View' }) {
  const [mode, setMode] = useMobileViewMode();

  return (
    <div className={`md:hidden flex items-center justify-between gap-2 bg-slate-100/90 border border-slate-200/90 p-1 rounded-lg text-xs ${className}`}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1.5 flex items-center gap-1">
        <span>{label}:</span>
      </span>
      <div className="inline-flex rounded-md p-0.5 bg-slate-200/70 shrink-0">
        <button
          type="button"
          onClick={() => setMode('card')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
            mode === 'card'
              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Show each match as a card"
        >
          <LayoutGrid className="w-3 h-3 text-slate-700" />
          <span>Cards</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('table')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
            mode === 'table'
              ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Show each match as one line; tap a line for more"
        >
          <List className="w-3 h-3" />
          <span>List</span>
        </button>
      </div>
    </div>
  );
}
