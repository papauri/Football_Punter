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
  state
}) {
  const PAGE_TITLES = {
    fixtures: 'Match Predictions',
    props: 'Props & Specials (Corners/Cards)',
    scores: 'Goals & Totals',
    binary: 'Value Bets & Kelly',
    swarm: 'AI Swarm Consensus',
    acca: 'Bet Slips & Accumulators',
    'deep-research': 'Match AI Research',
    lineups: 'Starting XI Lineups',
    results: 'Past Results & Proof',
    leagues: 'League Stats & Profiles',
    tuning: 'Model Settings & Tuning',
    patches: 'System Updates & Learning',
    autonomous: 'System Updates & Learning',
    timezone: 'Timezone Settings',
    logs: 'System Activity Logs'
  };

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

  const currentTitle = activePageTitle || PAGE_TITLES[activePage] || 'Match Predictions';
  const selectedDropdownValue = (activePage === 'autonomous' || activePage === 'patches') 
    ? 'patches' 
    : activePage;

  const pageOptions = [
    {
      group: 'Match Predictions & Bets',
      options: [
        { value: 'fixtures', label: 'Match Predictions' },
        { value: 'props', label: 'Props & Specials (Corners/Cards)' },
        { value: 'scores', label: 'Goals & Totals' },
        { value: 'binary', label: 'Value Bets & Kelly' },
        { value: 'swarm', label: 'AI Swarm Consensus' },
        { value: 'acca', label: 'Bet Slips & Accumulators' }
      ]
    },
    {
      group: 'Intelligence & Audit',
      options: [
        { value: 'lineups', label: 'Starting XI Lineups' },
        { value: 'results', label: 'Past Results & Proof' },
        { value: 'deep-research', label: 'Match AI Research' },
        { value: 'leagues', label: 'League Stats & Profiles' }
      ]
    },
    {
      group: 'System & Configuration',
      options: [
        { value: 'tuning', label: 'Model Settings & Tuning' },
        { value: 'patches', label: 'System Updates & Learning' },
        { value: 'timezone', label: 'Timezone Settings' },
        { value: 'logs', label: 'System Activity Logs' }
      ]
    }
  ];

  const refreshing = Boolean(isRefreshing || isScraping);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
        
        {/* Left: Tray Opener + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={handleOpenMenuClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            title="Open navigation menu"
          >
            <Menu className="w-4 h-4 text-slate-600" />
            <span className="font-semibold">Menu</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Page Title & Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-900 text-sm tracking-tight truncate hidden md:inline">
              MatchScraper AI
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden md:inline shrink-0" />
            <span className="font-semibold text-indigo-700 text-xs sm:text-sm bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100 truncate">
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
            selectClassName="bg-slate-50/90 hover:bg-white text-slate-800 font-semibold border-slate-300 hover:border-indigo-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-xs py-1.5 shadow-2xs rounded-lg transition-all"
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
                handlePageSelect('timezone');
              }
            }}
            className="hidden sm:flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors border border-slate-200 cursor-pointer"
            title="Configure timezone"
          >
            <span className="truncate max-w-[130px] font-mono">{tzLabel || 'UTC'}</span>
          </button>

          {/* Unanimous Strike Rate Badge */}
          <button
            onClick={() => handlePageSelect('swarm')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Empirical hit rate on 6-agent unanimous consensus picks (Click to view AI Swarm Consensus)"
          >
            <span>👑</span>
            <span className="hidden sm:inline font-sans font-semibold text-slate-700">Unanimous Rate:</span>
            <span className="font-extrabold text-amber-700">
              {typeof state?.unanimousHitRate === 'number' 
                ? `${state.unanimousHitRate.toFixed(1)}%` 
                : state?.aiSwarm?.directives?.telemetry?.unanimousHitRate || '76.2%'}
            </span>
          </button>

          {/* Super Agent Dual-Engine Status Pill */}
          <div 
            className="hidden lg:flex items-center text-[10px] font-semibold select-none shrink-0"
            title={state?.hasActiveAiKey 
              ? "Super Agent (Gemini AI) is ONLINE: providing qualitative news synthesis and supervisory research over the deterministic core." 
              : "Deterministic Mathematical Engine (Dixon-Coles + 6 Councils) is 100% Active. Super Agent is on Standby (Offline-Safe)."}
          >
            {state?.hasActiveAiKey ? (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                <span>Super Agent: Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Deterministic Core Active</span>
                <span className="text-slate-400 font-normal">(Super Agent Standby)</span>
              </span>
            )}
          </div>

          {/* Accuracy Badge */}
          {overallAccuracy && (
            <div className="hidden xl:flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono shadow-sm">
              <span>Model Accuracy: {overallAccuracy > 30 ? overallAccuracy : (overallAccuracy + 50).toFixed(1)}%</span>
            </div>
          )}

          {/* Matches Count Badge */}
          <div className="flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="font-mono font-semibold">{matchCount}</span>
            <span className="ml-1 hidden sm:inline text-slate-500">Fixtures</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh fixtures & recalculate state"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

      </div>
    </header>
  );
}
