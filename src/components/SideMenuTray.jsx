import React from 'react';
import { X, Layers, Calendar, Target, Scale, Brain, Users, History, Trophy, Sliders, ListChecks, Activity } from 'lucide-react';
import { PAGE_SECTIONS, resolvePage } from '../utils/pages';

export default function SideMenuTray({
  isOpen,
  onClose,
  activePage,
  onSelectPage,
  onNavigate,
  matchCount = 0,
  tzLabel = '',
  trainedCount = 0,
  isSwarmRunning = true,
  patchCount = 0,
  counts = {}
}) {
  if (!isOpen) return null;

  const effectiveMatchCount = matchCount || counts.fixtures || 0;

  const handleSelect = (pageId) => {
    const targetPage = resolvePage(pageId);
    if (typeof onSelectPage === 'function') {
      onSelectPage(targetPage);
    } else if (typeof onNavigate === 'function') {
      onNavigate(targetPage);
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const ICONS = {
    fixtures: Calendar, binary: Scale, scores: Activity, props: Target, acca: ListChecks,
    results: History, lineups: Users, 'deep-research': Brain, leagues: Trophy, tuning: Sliders
  };
  const COUNTS = {
    fixtures: effectiveMatchCount,
    binary: counts.binary,
    acca: counts.acca
  };
  const navSections = PAGE_SECTIONS.map(section => ({
    title: section.title,
    items: section.pages.map(p => ({
      id: p.id,
      label: p.label,
      icon: ICONS[p.id] || Calendar,
      badge: COUNTS[p.id] > 0 ? String(COUNTS[p.id]) : null,
      badgeColor: 'bg-slate-100 text-slate-600'
    }))
  }));

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-80 max-w-[85vw] bg-white border-r border-slate-200 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
        
        {/* Tray Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 tracking-tight">MatchScraper AI</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Football predictions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      title={item.label}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-600'
                          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
