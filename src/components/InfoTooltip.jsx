import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Info, X } from 'lucide-react';

export default function InfoTooltip({ 
  children, 
  title = "Information",
  content = "",
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
    const tooltipWidth = Math.min(300, window.innerWidth - 24);
    
    // Check if near top of viewport (e.g. within 240px)
    // If rect.top < 240, position BELOW the icon so it's never pushed offscreen or under top bars
    const placeBelow = rect.top < 240;
    
    // Calculate horizontal center
    const triggerCenter = rect.left + rect.width / 2;
    let targetLeft = triggerCenter - tooltipWidth / 2;
    if (align === 'left') targetLeft = rect.left;
    else if (align === 'right') targetLeft = rect.right - tooltipWidth;
    
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, targetLeft));
    const arrowLeft = Math.max(14, Math.min(tooltipWidth - 14, triggerCenter - clampedLeft));

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
          <div className="flex items-center justify-between gap-1.5 font-bold text-amber-400 text-[12px] border-b border-slate-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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

          <div className="text-slate-200 text-[11px] leading-relaxed">
            {content}
          </div>

          {/* Pointer Arrow */}
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
