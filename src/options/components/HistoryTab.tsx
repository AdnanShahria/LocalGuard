import React, { useState } from 'react';
import { FocusSession, HistoryFilterOptions } from '../../shared/types';
import { filterAndSortHistory } from '../../features/analytics/analyticsCalculations';
import { exportHistoryAsCsv } from '../../storage/storage';
import {
  Search,
  Download,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HistoryTabProps {
  history: FocusSession[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ history }) => {
  const [filters, setFilters] = useState<HistoryFilterOptions>({
    site: 'all',
    status: 'all',
    searchQuery: '',
    dateRange: 'all',
    sortBy: 'date_desc',
  });

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const filteredSessions = filterAndSortHistory(history, filters);

  const handleExportCsv = async () => {
    const csvContent = await exportHistoryAsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lifesolver_focus_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Controls & Filter Bar */}
      <div className="p-4 bg-[#141824] border border-white/5 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              placeholder="Search purpose or task..."
              className="w-full pl-9 pr-3.5 py-2 bg-[#171c2b] border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={history.length === 0}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filter Selectors Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5 text-xs">
          {/* Site Filter */}
          <div>
            <label className="block text-slate-400 mb-1">Platform</label>
            <select
              value={filters.site || 'all'}
              onChange={(e) => setFilters({ ...filters, site: e.target.value as any })}
              className="w-full px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="all">All Sites</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-slate-400 mb-1">Status</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="all">All Outcomes</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-slate-400 mb-1">Date Range</label>
            <select
              value={filters.dateRange || 'all'}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="w-full px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-slate-400 mb-1">Sort By</label>
            <select
              value={filters.sortBy || 'date_desc'}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="duration_desc">Longest Duration</option>
              <option value="tasks_desc">Most Tasks Done</option>
            </select>
          </div>
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing {filteredSessions.length} of {history.length} sessions</span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center bg-[#141824] border border-white/5 rounded-2xl text-slate-400 text-sm">
            No focus sessions matched the selected filters.
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const dateStr = new Date(session.startTime).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            const plannedMin = Math.round(session.allocatedDurationMs / 60000);
            const actualMin = Math.max(1, Math.round(session.actualDurationMs / 60000));
            const completedCount = session.tasksCompletedCount ?? session.tasks.filter((t) => t.completed).length;
            const totalCount = session.totalTasksCount ?? session.tasks.length;

            return (
              <div
                key={session.id}
                className="bg-[#141824] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all text-sm"
              >
                {/* Main Row */}
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-1 overflow-hidden flex-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold capitalize ${
                          session.site === 'youtube'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {session.site}
                      </span>
                      <span className="text-xs text-slate-400">{dateStr}</span>
                      {session.wasExpired && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-white truncate text-sm">
                      "{session.purpose}"
                    </div>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="flex items-center space-x-4 text-xs text-slate-300 self-end sm:self-center">
                    <div className="text-right">
                      <div className="font-mono text-slate-200">
                        {actualMin}m / {plannedMin}m
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {completedCount}/{totalCount} tasks
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex items-center space-x-1 ${
                        session.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/15 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {session.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{session.status}</span>
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-[#10141f] space-y-2 text-xs">
                    <div className="text-slate-400 font-medium">Tasks Detail:</div>
                    <div className="space-y-1.5 pl-2">
                      {session.tasks.map((task) => (
                        <div key={task.id} className="flex items-center space-x-2">
                          <span
                            className={
                              task.completed ? 'text-emerald-400 font-bold' : 'text-slate-600'
                            }
                          >
                            {task.completed ? '✓' : '○'}
                          </span>
                          <span
                            className={
                              task.completed ? 'line-through text-slate-400' : 'text-slate-200'
                            }
                          >
                            {task.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    {session.sessionLabel && (
                      <div className="pt-2 text-slate-400">
                        Label: <strong className="text-slate-200">{session.sessionLabel}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
