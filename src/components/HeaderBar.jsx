import React from 'react';
import { 
  Menu, 
  RefreshCw, 
  Clock, 
  Calendar, 
  Activity, 
  Sliders, 
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { PAGE_SECTIONS, PAGE_LABELS, resolvePage } from '../utils/pages';

export default function HeaderBar({
  onOpenMenu,
  onToggleMenu,
  activePage = 'fixtures',
  onSelectPage,
  onNavigate,
  activePageTitle,
  matchCount = 0,
  tzLabel = '',
  onOpenTimezone,
  onRefresh,
  onTriggerScrape,
  isRefreshing = false,
  isScraping = false,
  overallAccuracy = null,
  accaCount = 0,
  state,
  onOpenStrategyProof
}) {


  const handlePageSelect = (val) => {
    if (typeof onSelectPage === 'function') {
      onSelectPage(val);
    } else if (typeof onNavigate === 'function') {
      onNavigate(val);
    }
  };

  const handleOpenMenuClick = () => {
    if (typeof onOpenMenu === 'function') {
      onOpenMenu();
    } else if (typeof onToggleMenu === 'function') {
      onToggleMenu();
    }
  };

  const handleRefreshClick = () => {
    if (typeof onRefresh === 'function') {
      onRefresh();
    } else if (typeof onTriggerScrape === 'function') {
      onTriggerScrape();
    }
  };

  const currentTitle = activePageTitle || PAGE_LABELS[resolvePage(activePage)] || 'Matches';
  const selectedDropdownValue = resolvePage(activePage);

  const pageOptions = PAGE_SECTIONS.map(section => ({
    group: section.title,
    options: section.pages.map(p => ({ value: p.id, label: p.label }))
  }));

  const refreshing = Boolean(isRefreshing || isScraping);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="w-full max-w-[1920px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* Left: Tray Opener + Title */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={handleOpenMenuClick}
            className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-semibold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            title="Open navigation menu"
          >
            <Menu className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden xs:inline">Menu</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Page Title & Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-900 text-sm tracking-tight truncate hidden md:inline">
              MatchScraper AI
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden md:inline shrink-0" />
            <span className="font-semibold text-indigo-700 text-xs sm:text-sm bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
              {currentTitle}
            </span>
          </div>
        </div>

        {/* Center: Quick Page Switcher Dropdown */}
        <div className="hidden lg:block">
          <UniformDropdown
            value={selectedDropdownValue}
            onChange={handlePageSelect}
            options={pageOptions}
            className="w-64 xl:w-72"
            selectClassName="h-8 bg-slate-50/90 hover:bg-white text-slate-800 font-semibold border-slate-300 hover:border-indigo-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-xs py-0 shadow-2xs rounded-lg transition-all"
          />
        </div>

        {/* Right: Telemetry & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timezone / Clock Quick Pill */}
          <button
            onClick={() => {
              if (typeof onOpenTimezone === 'function') {
                onOpenTimezone();
              } else {
                handlePageSelect('tuning');
              }
            }}
            className="h-8 hidden sm:flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer shadow-2xs shrink-0"
            title="Change time zone"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate max-w-[150px] font-mono text-[11px]">{tzLabel || 'UTC'}</span>
          </button>

          {/* Bet Slip Quick Access Pill */}
          <button
            onClick={() => handlePageSelect('acca')}
            className={`h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border shrink-0 ${
              activePage === 'acca'
                ? 'bg-indigo-600 text-white border-indigo-700'
                : accaCount > 0
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="View bet slip"
          >
            <span>Slip</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
              activePage === 'acca' ? 'bg-indigo-800 text-white' : accaCount > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {accaCount}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            title="Get the latest matches and scores"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
        </div>

      </div>
    </header>
  );
}
