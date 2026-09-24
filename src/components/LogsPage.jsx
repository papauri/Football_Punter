import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Trash2, 
  Download, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';

export default function LogsPage({
  logs = [],
  onClearLogs
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!log.message.toLowerCase().includes(q) && !(log.source || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;

      return true;
    });
  }, [logs, searchQuery, levelFilter]);

  const handleExport = () => {
    const text = logs.map(l => `[${l.timestamp || l.time}] [${l.level || 'INFO'}] [${l.source || 'SYSTEM'}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matchscraper-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (lvl) => {
    if (lvl === 'ERROR') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (lvl === 'WARN' || lvl === 'WARNING') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (lvl === 'SUCCESS') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>System &amp; Autonomous Agent Activity Logs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audit trail of background scraping, Statistical recalibrations, swarm council debate rounds, and autonomous patches
          </p>
        </div>
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search log messages or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full pl-8 pr-3 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniformDropdown
            label="Log Level"
            value={levelFilter}
            onChange={setLevelFilter}
            options={[
              { value: 'ALL', label: 'All Log Levels' },
              { value: 'INFO', label: 'Information Only' },
              { value: 'SUCCESS', label: 'Success / Commits' },
              { value: 'WARNING', label: 'Warnings & Upsets' },
              { value: 'ERROR', label: 'Errors Only' }
            ]}
          />

          <button
            onClick={handleExport}
            className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="h-8 px-3 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Clear all system logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                <th className="py-1 px-1.5 w-7 text-center"></th>
                <th className="py-1 px-2 w-32">Timestamp</th>
                <th className="py-1 px-2 w-20 text-center">Level</th>
                <th className="py-1 px-2 w-36">Component / Agent</th>
                <th className="py-1 px-2 min-w-[280px]">Message Details</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr className="flex flex-col md:table-row">
                  <td colSpan={5} className="py-10 text-center text-slate-400 font-sans text-xs block md:table-cell">
                    No log entries match your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const logKey = log.id || `log-${idx}`;
                  const isExpanded = expandedLogId === logKey;

                  return (
                    <React.Fragment key={logKey}>
                      <tr 
                        className={`flex flex-col md:table-row hover:bg-indigo-50/20 transition-colors md:h-10 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        onClick={() => toggleExpand(logKey)}
                      >
                        {/* ================= MOBILE COMPACT CARD VIEW ================= */}
                        <td className="md:hidden p-2.5 block">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${getLevelBadge(log.level)}`}>
                                {log.level || 'INFO'}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[120px]">
                                {log.source || 'Engine'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {log.timestamp || log.time || 'Just now'}
                            </span>
                          </div>

                          <div className="text-slate-800 text-[11px] font-sans truncate mb-1">
                            {log.message}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-indigo-600 font-semibold pt-1 border-t border-slate-100 select-none">
                            <span>{isExpanded ? 'Hide Full Log' : 'View Full Details'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded-lg break-words whitespace-pre-wrap">
                              {log.message}
                            </div>
                          )}
                        </td>

                        {/* ================= DESKTOP 1-ROW TABLE VIEW ================= */}
                        {/* Dropdown Chevron */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-3 h-3 mx-auto text-indigo-600" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
                        </td>

                        {/* Timestamp */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-slate-500 text-[11px] whitespace-nowrap">
                          {log.timestamp || log.time || 'Just now'}
                        </td>

                        {/* Level */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLevelBadge(log.level)}`}>
                            {log.level || 'INFO'}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-slate-700 font-semibold text-[11px] truncate max-w-[160px]">
                          {log.source || 'Engine'}
                        </td>

                        {/* Message (single line compact on desktop) */}
                        <td className="hidden md:table-cell py-1.5 px-2 text-slate-800 text-[11px] font-sans truncate max-w-xl">
                          {log.message}
                        </td>
                      </tr>

                      {/* Desktop Collapsible Details */}
                      {isExpanded && (
                        <tr className="hidden md:table-row bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={5} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="font-bold text-slate-800">Complete Log Payload:</span>
                                <span className="font-mono text-slate-400 text-[11px]">{log.source || 'System'} • {log.timestamp || log.time}</span>
                              </div>
                              <div className="font-mono text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-50 p-2.5 rounded border border-slate-200 select-all">
                                {log.message}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
