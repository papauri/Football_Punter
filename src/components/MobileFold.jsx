import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Mobile "1-Row Table" folding, shared by every list that shows game cards on a phone.
//
// This is the pattern the Past Results page established: in table mode each game collapses to one
// dense line carrying only what you need to scan a list — kickoff, the two teams, the pick and the
// one or two numbers that decide whether it matters — and tapping the line unfolds the full card
// underneath. Nothing is removed from any card; it is folded. Card mode, and every screen at md and
// above, render exactly as before.

const TONES = {
  good: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  bad: 'bg-rose-100 text-rose-800 border-rose-300',
  warn: 'bg-amber-100 text-amber-900 border-amber-300',
  info: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  accent: 'bg-indigo-600 text-white border-indigo-600',
  live: 'bg-rose-600 text-white border-rose-600',
  neutral: 'bg-slate-100 text-slate-800 border-slate-200'
};

// "Today (Sun) 15:00" -> "15:00", "Tomorrow (Mon) 18:30" -> "Tmr 18:30", "Wed 3 Oct 20:00" -> "Wed 20:00".
// The day only earns space when it is not today, which is the common case on a picks list.
export function compactKickoff(text) {
  const str = String(text || '').trim();
  if (!str) return '';
  const time = (str.match(/\b\d{1,2}:\d{2}\b/) || [])[0] || '';
  const lower = str.toLowerCase();
  if (lower.startsWith('today')) return time || 'Today';
  if (lower.startsWith('tomorrow')) return time ? `Tmr ${time}` : 'Tmr';
  if (lower.startsWith('yesterday')) return time ? `Yst ${time}` : 'Yst';
  const day = (str.match(/^[A-Za-z]{3}/) || [])[0] || '';
  if (!time) return str.length > 9 ? str.slice(0, 9) : str;
  return day ? `${day} ${time}` : time;
}

// A pill on the right-hand side of the line. `mono` suits scores, odds and percentages.
export function FoldBadge({ children, tone = 'neutral', mono = false, title }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <span
      title={title}
      className={`shrink-0 inline-block align-middle max-w-[8rem] truncate font-bold text-[9.5px] px-1.5 py-0.5 rounded border whitespace-nowrap ${mono ? 'font-mono text-[10.5px]' : ''} ${TONES[tone] || TONES.neutral}`}
    >
      {children}
    </span>
  );
}

// The folded line itself.
//   lead     short time or rank shown first, in mono (e.g. "15:00", "#3")
//   home/away the fixture; truncated so the badges always stay visible
//   meta     optional second line for context such as league and market
//   badges   the one to three facts that matter most for this list, as <FoldBadge> elements
//   live     true shows a pulsing live dot before the teams
export function FoldSummary({ lead, home, away, title, meta, badges, live = false, expanded = false }) {
  return (
    <div aria-expanded={expanded} className="flex items-center justify-between gap-1.5 text-xs">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {lead != null && lead !== '' && (
          <span className="font-mono text-[10px] text-slate-500 shrink-0 font-medium">{lead}</span>
        )}
        {live && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0" aria-label="Live" />}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 text-xs truncate">
            {title != null ? title : (
              <>
                <span>{home}</span>
                <span className="text-slate-400 font-normal mx-1">v</span>
                <span>{away}</span>
              </>
            )}
          </div>
          {meta && <div className="text-[10px] text-slate-500 truncate leading-tight">{meta}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {badges}
        <span className="text-slate-400 pl-0.5">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </div>
    </div>
  );
}

// Drop-in replacement for a list row's mobile card cell (`<td className="md:hidden p-3 block">`).
// The row's own onClick already toggles `expanded`, so tapping the line opens and closes it. As on the
// Past Results page, tapping anywhere on an open row folds it again; buttons inside the card keep
// working because they already stop propagation.
//
// onToggle is only for rows WITHOUT their own onClick (some lists open their detail from a button
// inside the card). Passing it to a row that already toggles would open and close in one tap.
export function MobileFoldCell({ mode, expanded, summary, children, onToggle, cardClassName = 'md:hidden p-3 block' }) {
  if (mode !== 'table') {
    return <td className={cardClassName}>{children}</td>;
  }
  return (
    <td className="md:hidden px-2.5 py-2 block">
      {onToggle
        ? <div role="button" tabIndex={0} className="cursor-pointer" onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>{summary}</div>
        : summary}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {children}
        </div>
      )}
    </td>
  );
}

// For lists built from divs rather than table rows. Holds its own open state, and uses a media query
// so only one layout is mounted — rendering the card twice and hiding one with CSS would double every
// tooltip, timer and effect inside it.
export function useIsBelowMd() {
  const query = '(max-width: 767.98px)';
  const [matches, setMatches] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia(query).matches; } catch { return false; }
  });
  useEffect(() => {
    let mql;
    try { mql = window.matchMedia(query); } catch { return undefined; }
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return matches;
}

// bare drops the card chrome, for lists that already separate items with dividers.
export function MobileFoldBlock({ mode, summary, children, className = '', defaultOpen = false, bare = false }) {
  const isMobile = useIsBelowMd();
  const [open, setOpen] = useState(defaultOpen);
  if (mode !== 'table' || !isMobile) return <>{children}</>;
  const summaryNode = typeof summary === 'function' ? summary(open) : summary;
  return (
    <div className={`bg-white ${bare ? '' : 'rounded-xl border border-slate-200/90 shadow-2xs'} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-2.5 py-2 cursor-pointer"
      >
        {summaryNode}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}
