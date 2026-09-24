import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Calculator, TrendingUp, ShieldCheck, X } from 'lucide-react';

/**
 * KellyTooltip Component
 * Displays an interactive hover/click card explaining the Kelly Criterion,
 * mathematical formula, fractional safety, and staking logic.
 * Rendered via createPortal directly into document.body to prevent clipping
 * by overflow-hidden containers and to stay on top of all headers.
 */
export default function KellyTooltip({ 
  children, 
  title = "Kelly Criterion (Optimal Staking)",
  showIcon = true,
  align = "center" // "left" | "center" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalCoords, setPortalCoords] = useState(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(340, window.innerWidth - 24);
    
    // Check if near top of viewport (e.g. within 260px)
    // If rect.top < 260, position BELOW the icon
    const placeBelow = rect.top < 260;
    
    const triggerCenter = rect.left + rect.width / 2;
    let targetLeft = triggerCenter - tooltipWidth / 2;
    if (align === 'left') targetLeft = rect.left;
    else if (align === 'right') targetLeft = rect.right - tooltipWidth;
    
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, targetLeft));
    const arrowLeft = Math.max(16, Math.min(tooltipWidth - 16, triggerCenter - clampedLeft));

    setPortalCoords({
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      left: clampedLeft,
      width: tooltipWidth,
      placeBelow,
      arrowLeft
    });
  }, [align]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (triggerRef.current?.contains(e.target) || tooltipRef.current?.contains(e.target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('click', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('click', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <span 
        ref={triggerRef}
        className="inline-flex items-center cursor-help group select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {showIcon && (
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 transition-colors inline-block" />
          )}
        </span>
      </span>

      {isOpen && portalCoords && typeof document !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: `${portalCoords.left}px`,
            width: `${portalCoords.width}px`,
            zIndex: 999999,
            ...(portalCoords.placeBelow 
              ? { top: `${portalCoords.top}px` } 
              : { bottom: `${window.innerHeight - portalCoords.top}px` }
            )
          }}
          className="p-3.5 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 text-xs font-normal text-left animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-1.5 font-bold text-amber-400 text-[12px] border-b border-slate-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{title}</span>
            </div>
            <button 
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Core concept */}
          <p className="text-slate-200 text-[11px] leading-relaxed mb-2">
            The <strong>Kelly Criterion</strong> is a mathematical formula used by pro sports bettors to determine the <em>optimal bankroll percentage</em> to wager when you have a statistical edge (+EV).
          </p>

          {/* Formula snippet */}
          <div className="bg-slate-950/80 border border-slate-800 rounded px-2 py-1 font-mono text-[10px] text-emerald-400 mb-2 flex items-center justify-between">
            <span>f* = (b · p - q) / b</span>
            <span className="text-[9px] text-slate-400 font-sans">Optimal Stake %</span>
          </div>

          {/* Key explanations */}
          <div className="space-y-1.5 text-[10.5px] text-slate-300">
            <div className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>What is EV (+EV)?</strong> Expected Value measures mathematical edge over the bookmaker. If our Poisson model estimates 60% win chance and LiveScore Bet pays 1.85, the bet has positive edge (+EV) over market pricing.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
              <span><strong>Why €50 next to games?</strong> Our default bankroll is set to <strong>€1,000</strong>. On high-conviction prime bets, Quarter-Kelly hits the strict <strong>5% safety ceiling (5.0 units) = €50.00</strong> to prevent over-exposure. If your bankroll is €100, that 5.0u recommendation becomes €5.00.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-amber-400 text-xs font-bold leading-none shrink-0">•</span>
              <span><strong>1/4 Kelly Discipline:</strong> Wagers 25% of theoretical full Kelly to smooth out variance and protect your bankroll against bad-beat runs.</span>
            </div>
          </div>

          {/* Down/Up arrow pointer */}
          <div 
            style={{ left: `${portalCoords.arrowLeft}px` }}
            className={`absolute w-2.5 h-2.5 bg-slate-900 border-slate-700 rotate-45 -translate-x-1/2 ${
              portalCoords.placeBelow 
                ? 'bottom-full -mb-1.5 border-t border-l' 
                : 'top-full -mt-1.5 border-b border-r'
            }`} 
          />
        </div>,
        document.body
      )}
    </>
  );
}
