import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';

export default function InfoTooltip({ 
  children, 
  title = "Information",
  content = "",
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
      <span className="inline-flex items-center gap-1">
        {children}
        {showIcon && (
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 transition-colors inline-block" />
        )}
      </span>

      {isOpen && (
        <div 
          className={`absolute bottom-full mb-2 z-[99999] w-64 sm:w-72 p-3.5 bg-slate-900 text-slate-100 rounded-xl shadow-xl border border-slate-700 text-xs font-normal text-left animate-in fade-in zoom-in-95 duration-150 ${getPositionClasses()}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[12px] border-b border-slate-800 pb-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>{title}</span>
          </div>

          <div className="text-slate-200 text-[11px] leading-relaxed">
            {content}
          </div>

          <div className={`absolute top-full w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 ${align === 'left' ? 'left-4' : align === 'right' ? 'right-4' : 'left-1/2 -translate-x-1/2 -mt-1.5'}`} />
        </div>
      )}
    </div>
  );
}
