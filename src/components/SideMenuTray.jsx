import React from 'react';
import { 
  X, 
  Layers, 
  Calendar, 
  Target, 
  Scale, 
  Bot, 
  Brain, 
  Users, 
  History, 
  Trophy, 
  Sliders, 
  Zap, 
  Clock, 
  Terminal, 
  ListChecks,
  Activity,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';

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
  const effectivePatchCount = patchCount || counts.patches || 0;
  const effectiveTrained = trainedCount || counts.trained || 0;

  const handleSelect = (pageId) => {
    const targetPage = (pageId === 'autonomous') ? 'patches' : pageId;
    if (typeof onSelectPage === 'function') {
      onSelectPage(targetPage);
    } else if (typeof onNavigate === 'function') {
      onNavigate(targetPage);
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const navSections = [
    {
      title: 'Predictions & Bets',
      items: [
        {
          id: 'fixtures',
          label: 'Match Predictions',
          icon: Calendar,
          badge: effectiveMatchCount > 0 ? `${effectiveMatchCount} matches` : null,
          badgeColor: 'bg-emerald-100 text-emerald-800'
        },
        {
          id: 'props',
          label: 'Corners & Cards',
          icon: Target,
          badge: 'Props',
          badgeColor: 'bg-indigo-100 text-indigo-800'
        },
        {
          id: 'scores',
          label: 'Goals & Totals',
          icon: Activity,
          badge: counts.scores > 0 ? `${counts.scores} goals` : 'O/U',
          badgeColor: 'bg-blue-100 text-blue-800'
        },
        {
          id: 'binary',
          label: 'Value Bets',
          icon: Scale,
          badge: counts.binary > 0 ? `${counts.binary} picks` : 'Value',
          badgeColor: 'bg-emerald-100 text-emerald-800'
        },
        {
          id: 'swarm',
          label: 'Model Consensus',
          icon: Bot,
          badge: isSwarmRunning ? 'Active' : 'Idle',
          badgeColor: isSwarmRunning ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
        },
        {
          id: 'alldaywinner',
          label: 'All-Day Winner Bet',
          icon: Zap,
          badge: '8-Team Lotto',
          badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
        },
        {
          id: 'acca',
          label: 'Bet Slips',
          icon: ListChecks,
          badge: counts.acca > 0 ? `${counts.acca} picks` : null,
          badgeColor: 'bg-purple-100 text-purple-800'
        }
      ]
    },
    {
      title: 'Analysis & History',
      items: [
        {
          id: 'lineups',
          label: 'Starting Lineups',
          icon: Users,
          badge: 'Confirmed',
          badgeColor: 'bg-sky-100 text-sky-800'
        },
        {
          id: 'results',
          label: 'Past Results',
          icon: History,
          badge: 'Audit',
          badgeColor: 'bg-slate-200 text-slate-800'
        },
        {
          id: 'deep-research',
          label: 'Match Research',
          icon: Brain,
          badge: 'AI Deep',
          badgeColor: 'bg-purple-100 text-purple-800'
        },
        {
          id: 'leagues',
          label: 'League Stats',
          icon: Trophy,
          badge: 'Rankings',
          badgeColor: 'bg-amber-100 text-amber-800'
        }
      ]
    },
    {
      title: 'Settings & Logs',
      items: [
        {
          id: 'tuning',
          label: 'Model Settings',
          icon: Sliders,
          badge: safeParseFloat(effectiveTrained, 0) > 0 ? `${safeToFixed(safeParseFloat(effectiveTrained, 0) / 1000, 1)}k trained` : null,
          badgeColor: 'bg-slate-100 text-slate-700'
        },
        {
          id: 'patches',
          label: 'Model Updates',
          icon: Zap,
          badge: effectivePatchCount > 0 ? `${effectivePatchCount} updates` : 'Active',
          badgeColor: 'bg-emerald-100 text-emerald-800'
        },
        {
          id: 'timezone',
          label: 'Timezone Settings',
          icon: Clock,
          badge: tzLabel || 'UTC',
          badgeColor: 'bg-slate-100 text-slate-700'
        },
        {
          id: 'logs',
          label: 'Activity Logs',
          icon: Terminal,
          badge: 'Live',
          badgeColor: 'bg-slate-100 text-slate-700'
        }
      ]
    }
  ];

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
              <p className="text-[11px] text-slate-500 font-medium">Football Match Predictions</p>
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
                  const isActive = activePage === item.id || 
                    ((activePage === 'patches' || activePage === 'autonomous') && (item.id === 'patches' || item.id === 'autonomous'));
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

        {/* Tray Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center justify-between mb-1 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Status
            </span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
              Active
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Statistical Models</span>
            <span>Live</span>
          </div>
        </div>

      </div>
    </div>
  );
}
