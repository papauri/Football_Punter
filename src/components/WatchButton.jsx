import React from 'react';
import { Star } from 'lucide-react';
import { useWatchList } from '../utils/useWatchList';

// Star button used on every match row. Stops the click so it never also opens or folds the row.
export default function WatchButton({ matchId, className = '' }) {
  const { isWatched, toggle } = useWatchList();
  const on = isWatched(matchId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(matchId); }}
      title={on ? 'Remove from watch list' : 'Add to watch list'}
      aria-pressed={on}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer shrink-0 ${
        on ? 'bg-amber-50 border-amber-300 text-amber-500' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-300'
      } ${className}`}
    >
      <Star className="w-3.5 h-3.5" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
