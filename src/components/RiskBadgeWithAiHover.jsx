import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ShieldCheck, AlertTriangle, Info, X } from 'lucide-react';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils.js';

// In-memory client cache to make repeated hovers instant (0ms latency)
const clientAiSummaryCache = new Map();

/**
 * Standard simple English definitions for betting risk badges.
 * Displayed instantly while AI generates or if offline.
 */
export function getSimpleEnglishDefinition(badge, tierKey) {
  const b = String(badge || '').toLowerCase();
  const k = String(tierKey || '').toUpperCase();

  if (b.includes('safest') || k === 'ELITE') {
    return "A 'Safest' bet means the computer is very confident. This team has a very high chance to win (>68%), the danger of a tie is low, and stats show this is the most reliable pick on the board.";
  }
  if (b.includes('risky') || b.includes('trap') || k === 'TRAP') {
    return "A 'Risky' bet means there is a high danger of losing your money. The win chance is low, there is a strong chance of a tie, or the bookmaker odds look like a trap.";
  }
  if (b.includes('confident') || k === 'HIGH') {
    return "A 'Confident' bet means the team has a good, solid chance to win (>60%) with low tie danger. It is a strong, balanced pick without taking wild risks.";
  }
  if (b.includes('draw = refund') || b.includes('dnb') || k === 'DNB') {
    return "'Draw = refund' means Draw No Bet. If your team wins, you win. If the match ends in a draw, you get 100% of your bet money back. You only lose if the other team wins.";
  }
  if (b.includes('covers the draw') || k === 'PROTECTED') {
    return "'Covers the draw' means Double Chance (Win or Draw). You win your bet if your team wins OR if the game finishes in a tie.";
  }
  if (b.includes('close game') || k === 'CONTESTED') {
    return "A 'Close game' means both teams are evenly matched. An outright win is dangerous because either side could easily win or tie, so extra protection is advised.";
  }
  if (b.includes('league off') || k === 'EXCLUDED') {
    return "This league has extreme randomness, frequent unexpected upsets, or lacks reliable team data. The computer advises skipping this match.";
  }
  return "This badge tells you how safe or dangerous this pick is based on team strength, draw danger, and bookmaker odds.";
}

/**
 * Generate a smart heuristic explanation for this specific match in plain English.
 */
export function getSimpleEnglishExplanation(match, riskProfile, pick) {
  const m = match || {};
  const rp = riskProfile || {};
  const home = m.home || 'Home';
  const away = m.away || 'Away';
  const league = m.league || 'the league';
  const pickProb = safeParseFloat(rp.pickProb ?? (rp.pick === 'AWAY' ? m.prob?.away : m.prob?.home), 50);
  const drawProb = safeParseFloat(rp.drawProb ?? m.prob?.draw, 24);
  const b = String(rp.badge || '').toLowerCase();
  const k = String(rp.tierKey || '').toUpperCase();

  if (b.includes('safest') || k === 'ELITE') {
    return `Our mathematical model gives the favorite an impressive ${safeToFixed(pickProb, 0)}% chance to win, with draw danger capped at just ${safeToFixed(drawProb, 0)}%. Because they dominate recent form and attacking power in ${league}, this game easily clears our strictest safety rules.`;
  }
  if (b.includes('risky') || b.includes('trap') || k === 'TRAP') {
    if (drawProb >= 28) {
      return `This game was flagged as Risky because the tie danger is high (${safeToFixed(drawProb, 0)}%) and the favorite's win chance is only ${safeToFixed(pickProb, 0)}%. When games have high draw danger, betting on an outright winner often leads to surprise losses.`;
    }
    return `This game was flagged as Risky because the model detected a possible trap. Either the bookmaker odds disagree with the true statistics, or the win probability (${safeToFixed(pickProb, 0)}%) is too low to safely risk your money on.`;
  }
  if (b.includes('confident') || k === 'HIGH') {
    return `With a ${safeToFixed(pickProb, 0)}% win likelihood and controlled tie danger (${safeToFixed(drawProb, 0)}%), the model identifies a solid advantage. It qualifies as a confident selection for standard play.`;
  }
  if (b.includes('draw = refund') || b.includes('dnb') || k === 'DNB') {
    return `The favorite has the edge, but the draw probability is elevated at ${safeToFixed(drawProb, 0)}%. Using Draw No Bet protects you: if ${home} and ${away} tie, your stake is safely refunded.`;
  }
  if (b.includes('close game') || k === 'CONTESTED') {
    return `${home} and ${away} are closely matched (${safeToFixed(pickProb, 0)}% win probability vs ${safeToFixed(drawProb, 0)}% draw danger). It is too close to call outright with high confidence.`;
  }
  return rp.reason || `The model assessed win probability at ${safeToFixed(pickProb, 0)}% and draw risk at ${safeToFixed(drawProb, 0)}%.`;
}

export default function RiskBadgeWithAiHover({
  riskProfile,
  match,
  pick,
  className = '',
  children,
  badgeText = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, alignRight: false, openAbove: false });

  const badgeRef = useRef(null);
  const popoverRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const rp = riskProfile || {};
  const badgeLabel = badgeText || rp.badge || 'Status';
  const badgeClass = rp.badgeClass || 'bg-slate-100 text-slate-700 border-slate-300';
  const tierKey = rp.tierKey || 'STANDARD';
  const isRisky = rp.riskLevel === 'HIGH' || tierKey === 'TRAP' || tierKey === 'EXCLUDED';
  const isSafest = tierKey === 'ELITE';

  const cacheKey = `${match?.id || match?.home + '_' + match?.away}_${tierKey}_${badgeLabel}`;

  const calculatePosition = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Popover width is ~320px to 360px
    const popoverWidth = 340;
    const popoverHeight = 260;

    let left = rect.left + rect.width / 2;
    let alignRight = false;

    // If near right edge of screen
    if (rect.left + popoverWidth > viewportWidth - 16) {
      left = Math.min(viewportWidth - 16, rect.right);
      alignRight = true;
    } else if (left - popoverWidth / 2 < 16) {
      left = 16;
      alignRight = false;
    }

    let top = rect.bottom + 8;
    let openAbove = false;

    // If near bottom of screen
    if (rect.bottom + popoverHeight > viewportHeight - 16 && rect.top > popoverHeight) {
      top = rect.top - 8;
      openAbove = true;
    }

    setPopoverPos({ top, left, alignRight, openAbove });
  };

  const handleOpen = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    hoverTimeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsOpen(true);

      // Check client cache first
      if (clientAiSummaryCache.has(cacheKey)) {
        setAiData(clientAiSummaryCache.get(cacheKey));
        return;
      }

      // Initial instant baseline (no waiting)
      const instantFallback = {
        definition: getSimpleEnglishDefinition(badgeLabel, tierKey),
        explanation: getSimpleEnglishExplanation(match, rp, pick),
        isAiGenerated: false
      };
      setAiData(instantFallback);
      setLoading(true);

      // Fetch dynamic AI explanation from server
      fetch('/api/ai-risk-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: {
            home: match?.home,
            away: match?.away,
            league: match?.league,
            prob: match?.prob,
            confidence: match?.confidence ?? rp.confidence,
            odds: match?.odds
          },
          tierKey,
          badge: badgeLabel,
          reason: rp.reason,
          pick: pick || rp.pick,
          pickProb: rp.pickProb,
          drawProb: rp.drawProb,
          confidence: rp.confidence
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            const finalData = {
              definition: data.definition || instantFallback.definition,
              explanation: data.explanation || instantFallback.explanation,
              isAiGenerated: data.isAiGenerated !== false
            };
            clientAiSummaryCache.set(cacheKey, finalData);
            setAiData(finalData);
          }
        })
        .catch(() => {
          // Keep instant fallback cleanly
        })
        .finally(() => {
          setLoading(false);
        });
    }, 120); // 120ms debounce prevents flickering on casual mouse movement
  };

  const handleClose = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleClickToggle = (e) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      handleOpen();
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const displayData = aiData || {
    definition: getSimpleEnglishDefinition(badgeLabel, tierKey),
    explanation: getSimpleEnglishExplanation(match, rp, pick),
    isAiGenerated: false
  };

  const home = match?.home || 'Home';
  const away = match?.away || 'Away';
  const pickProb = safeParseFloat(rp.pickProb ?? (rp.pick === 'AWAY' ? match?.prob?.away : match?.prob?.home), 50);
  const drawProb = safeParseFloat(rp.drawProb ?? match?.prob?.draw, 24);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onClick={handleClickToggle}
      ref={badgeRef}
    >
      <span 
        className={`inline-flex items-center gap-1 cursor-help transition-transform hover:scale-[1.03] select-none ${badgeClass} ${className}`}
        role="button"
        tabIndex={0}
      >
        {children ? children : (
          <>
            {isSafest && <ShieldCheck className="w-2.5 h-2.5 shrink-0 text-emerald-700" />}
            {isRisky && <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-700" />}
            <span>{badgeLabel}</span>
          </>
        )}
      </span>

      {/* Floating Interactive Popover */}
      {isOpen && (
        <div 
          ref={popoverRef}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
          }}
          onMouseLeave={handleClose}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: popoverPos.openAbove ? 'auto' : `${popoverPos.top}px`,
            bottom: popoverPos.openAbove ? `${window.innerHeight - popoverPos.top}px` : 'auto',
            left: popoverPos.alignRight ? 'auto' : `${popoverPos.left}px`,
            right: popoverPos.alignRight ? `${window.innerWidth - popoverPos.left}px` : 'auto',
            transform: popoverPos.alignRight ? 'none' : 'translateX(-50%)',
            zIndex: 9999
          }}
          className="w-[330px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-auto"
        >
          {/* Header */}
          <div className={`px-3 py-2 border-b flex items-center justify-between ${
            isSafest ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            isRisky ? 'bg-rose-50 border-rose-200 text-rose-900' :
            'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500 animate-pulse" />
              <span className="font-extrabold text-[11px] uppercase tracking-wider">AI Risk Explainer</span>
              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${badgeClass}`}>
                {badgeLabel}
              </span>
            </div>
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
              aria-label="Close explainer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 space-y-2.5 text-xs">
            {/* Match info row */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-700 truncate">{home} vs {away}</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-1">
                {match?.league || 'Soccer'}
              </span>
            </div>

            {/* Part 1: What the term means firstly in simple English */}
            <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-200/70">
              <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-900 mb-1">
                <Info className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>1. What "{badgeLabel}" means in plain English:</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-normal">
                {displayData.definition}
              </p>
            </div>

            {/* Part 2: AI Match Summary - Why this game was categorized as such */}
            <div className={`rounded-lg p-2.5 border ${
              isSafest ? 'bg-emerald-50/50 border-emerald-200/80' :
              isRisky ? 'bg-rose-50/50 border-rose-200/80' :
              'bg-indigo-50/40 border-indigo-200/70'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] font-bold text-slate-900 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>2. Why this game is tagged {badgeLabel}:</span>
                </span>
                {loading && (
                  <span className="text-[9px] text-indigo-600 font-medium animate-pulse">
                    AI updating...
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-800 leading-relaxed">
                {displayData.explanation}
              </p>
            </div>

            {/* Key Stats Bar */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center">
              <div className="bg-slate-100/70 rounded p-1 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-medium">Win Chance</div>
                <div className="text-[11px] font-bold text-slate-900">{safeToFixed(pickProb, 1)}%</div>
              </div>
              <div className="bg-slate-100/70 rounded p-1 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-medium">Draw Risk</div>
                <div className={`text-[11px] font-bold ${drawProb >= 25 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {safeToFixed(drawProb, 1)}%
                </div>
              </div>
              <div className="bg-slate-100/70 rounded p-1 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-medium">Model Trust</div>
                <div className="text-[11px] font-bold text-slate-900">
                  {safeToFixed(rp.confidence ?? match?.confidence ?? 65, 0)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
