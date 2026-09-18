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
  Clock
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';

export default function LogsPage({
  logs = [],
  onClearLogs
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

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
          <h2 className="font-bold text-slate-900 text-base">
            System &amp; Autonomous Agent Activity Logs
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
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
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
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
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
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-28">Timestamp</th>
                <th className="py-2.5 px-3 w-20 text-center">Level</th>
                <th className="py-2.5 px-3 w-36">Component / Agent</th>
                <th className="py-2.5 px-3 min-w-[300px]">Message Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 font-sans text-xs">
                    No log entries match your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <tr key={idx} className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    
                    {/* Timestamp */}
                    <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.timestamp || log.time || 'Just now'}
                    </td>

                    {/* Level */}
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLevelBadge(log.level)}`}>
                        {log.level || 'INFO'}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="py-2 px-3 text-slate-700 font-semibold text-[11px] truncate max-w-[140px]">
                      {log.source || 'Engine'}
                    </td>

                    {/* Message */}
                    <td className="py-2 px-3 text-slate-800 text-[11px] font-sans break-words">
                      {log.message}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
