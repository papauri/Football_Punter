import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Calculator, TrendingUp, ShieldCheck } from 'lucide-react';

/**
 * KellyTooltip Component
 * Displays an interactive hover/click card explaining the Kelly Criterion,
 * mathematical formula, fractional safety, and staking logic.
 */
export default function KellyTooltip({ 
  children, 
  title = "Kelly Criterion (Optimal Staking)",
  showIcon = true,
  align = "center" // "left" | "center" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen]);

  const getPositionClasses = () => {
    if (align === 'left') return 'left-0';
    if (align === 'right') return 'right-0';
    return 'left-1/2 -translate-x-1/2';
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center cursor-help group ${isOpen ? 'z-[9999]' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Trigger element */}
      <span className="inline-flex items-center gap-1">
        {children}
        {showIcon && (
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 transition-colors inline-block" />
        )}
      </span>

      {/* Floating Hover Card */}
      {isOpen && (
        <div 
          className={`absolute bottom-full mb-2 z-[99999] w-72 sm:w-80 p-3.5 bg-slate-900 text-slate-100 rounded-xl shadow-xl border border-slate-700 text-xs font-normal text-left animate-in fade-in zoom-in-95 duration-150 ${getPositionClasses()}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[12px] border-b border-slate-800 pb-1.5 mb-2">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span>{title}</span>
          </div>

          {/* Core concept */}
          <p className="text-slate-200 text-[11px] leading-relaxed mb-2">
            The <strong>Kelly Criterion</strong> is a mathematical formula used by quantitative traders and pro sports bettors to determine the <em>optimal fraction of your bankroll</em> to wager when you have a statistical edge (+EV).
          </p>

          {/* Formula snippet */}
          <div className="bg-slate-950/80 border border-slate-800 rounded px-2 py-1 font-mono text-[10px] text-emerald-400 mb-2.5 flex items-center justify-between">
            <span>f* = (b · p - q) / b</span>
            <span className="text-[9px] text-slate-400 font-sans">Optimal Stake %</span>
          </div>

          {/* Key explanations */}
          <div className="space-y-1.5 text-[10.5px] text-slate-300">
            <div className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Edge (+EV):</strong> If model win probability exceeds bookmaker odds, Kelly sizes the bet to maximize bankroll growth rate.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
              <span><strong>1/4 Kelly Safety:</strong> We wager 25% of full Kelly (quarter-Kelly) to smooth variance and protect against losing streaks.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-slate-400 text-xs font-bold leading-none shrink-0">•</span>
              <span><strong>'No bet':</strong> If there is 0% or negative edge over the odds, Kelly wagers 0 units to prevent bankroll drain.</span>
            </div>
          </div>

          {/* Down arrow pointer */}
          <div className={`absolute top-full w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 ${align === 'left' ? 'left-4' : align === 'right' ? 'right-4' : 'left-1/2 -translate-x-1/2 -mt-1.5'}`} />
        </div>
      )}
    </div>
  );
}
