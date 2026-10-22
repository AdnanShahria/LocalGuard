import React, { useState } from 'react';
import { FocusSession, HistoryFilterOptions, UserSettings } from '../../shared/types';
import { filterAndSortHistory } from '../../features/analytics/analyticsCalculations';
import {
  exportHistoryAsCsv,
  exportHistoryAsXml,
  exportDataAsJson,
  generateHistoryPdfReport,
} from '../../storage/storage';
import {
  Search,
  FileSpreadsheet,
  FileCode,
  FileText,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ListTodo,
  Tag,
} from 'lucide-react';

interface HistoryTabProps {
  history: FocusSession[];
  settings?: UserSettings;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ history, settings }) => {
  const [filters, setFilters] = useState<HistoryFilterOptions>({
    site: 'all',
    status: 'all',
    searchQuery: '',
    dateRange: 'all',
    sortBy: 'date_desc',
  });

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const filteredSessions = filterAndSortHistory(history, filters);

  // Dynamically compute list of all guarded sites from settings and historical records
  const availableSites = React.useMemo(() => {
    const sitesMap = new Map<string, { id: string; name: string }>();

    // From settings.guardedSites
    if (settings?.guardedSites && settings.guardedSites.length > 0) {
      settings.guardedSites.forEach((g) => {
        sitesMap.set(g.id.toLowerCase(), { id: g.id, name: g.name });
      });
    }

    // From history records
    history.forEach((s) => {
      const key = (s.site || '').toLowerCase();
      if (key && !sitesMap.has(key)) {
        const formatted = key === 'youtube' ? 'YouTube' : key === 'facebook' ? 'Facebook' : key.charAt(0).toUpperCase() + key.slice(1);
        sitesMap.set(key, { id: key, name: formatted });
      }
    });

    // Ensure defaults exist if list was empty
    if (!sitesMap.has('youtube')) sitesMap.set('youtube', { id: 'youtube', name: 'YouTube' });
    if (!sitesMap.has('facebook')) sitesMap.set('facebook', { id: 'facebook', name: 'Facebook' });

    return Array.from(sitesMap.values());
  }, [settings, history]);

  const handleExportCsv = async () => {
    const csvContent = await exportHistoryAsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localguard_history_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const reportHtml = generateHistoryPdfReport(filteredSessions);
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `localguard_report_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXml = async () => {
    const xmlContent = await exportHistoryAsXml();
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localguard_history_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = async () => {
    const jsonContent = await exportDataAsJson();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localguard_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Filter Bar & Multi-format Download Bar - Apple White Mode */}
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        {/* Search & Export Buttons Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              placeholder="Search by purpose or task..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Multi-format Quick Download bar */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">Export:</span>
            <button
              onClick={handleExportCsv}
              disabled={history.length === 0}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              title="Download as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={history.length === 0}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              title="Print / Save PDF report"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportXml}
              disabled={history.length === 0}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              title="Download structured XML"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600" />
              <span>XML</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={history.length === 0}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              title="Download JSON backup"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-600" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Filter Selectors Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Site Filter - Dynamically populated */}
          <div>
            <label className="block font-medium text-slate-500 mb-1">Guarded Site</label>
            <select
              value={filters.site || 'all'}
              onChange={(e) => setFilters({ ...filters, site: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">All Sites ({history.length})</option>
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-medium text-slate-500 mb-1">Outcome Status</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">All Outcomes</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block font-medium text-slate-500 mb-1">Date Range</label>
            <select
              value={filters.dateRange || 'all'}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div>
            <label className="block font-medium text-slate-500 mb-1">Sort By</label>
            <select
              value={filters.sortBy || 'date_desc'}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="duration_desc">Longest Duration</option>
              <option value="tasks_desc">Most Tasks Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Session Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-800">{filteredSessions.length}</strong> of{' '}
            <strong className="text-slate-800">{history.length}</strong> recorded focus sessions
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">No focus sessions found</p>
            <p className="text-xs text-slate-400">Try adjusting your search criteria or filters.</p>
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
            const completedCount =
              session.tasksCompletedCount ?? session.tasks.filter((t) => t.completed).length;
            const totalCount = session.totalTasksCount ?? session.tasks.length;

            const siteName =
              session.site === 'youtube'
                ? 'YouTube'
                : session.site === 'facebook'
                ? 'Facebook'
                : session.site.charAt(0).toUpperCase() + session.site.slice(1);

            const siteColorClass =
              session.site === 'youtube'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : session.site === 'facebook'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200';

            return (
              <div
                key={session.id}
                className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
              >
                {/* Main Card Header */}
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      {/* Site Badge */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${siteColorClass}`}
                      >
                        {siteName}
                      </span>

                      {/* Date & Time */}
                      <span className="text-xs text-slate-500">{dateStr}</span>

                      {/* Planned vs Actual Duration Tag */}
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-medium flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {actualMin}m / {plannedMin}m
                        </span>
                      </span>

                      {/* Expired Tag */}
                      {session.wasExpired && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          Expired
                        </span>
                      )}
                    </div>

                    {/* Purpose */}
                    <div className="font-semibold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                      "{session.purpose}"
                    </div>
                  </div>

                  {/* Right Metrics & Badges */}
                  <div className="flex items-center space-x-3 text-xs self-end sm:self-center">
                    {/* Task Progress Counter */}
                    <div className="text-right hidden sm:block">
                      <div className="font-semibold text-slate-700">
                        {completedCount}/{totalCount} tasks
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {totalCount > 0
                          ? `${Math.round((completedCount / totalCount) * 100)}% done`
                          : 'No tasks'}
                      </div>
                    </div>

                    {/* Completion Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center space-x-1.5 border ${
                        session.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : session.status === 'abandoned'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {session.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : session.status === 'abandoned' ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>{session.status}</span>
                    </span>

                    {/* Expand / Collapse Chevron */}
                    <div className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Task List & Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/60 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span className="flex items-center space-x-1.5">
                        <ListTodo className="w-4 h-4 text-blue-600" />
                        <span>Serialized Tasks & Action Items</span>
                      </span>
                      <span className="text-slate-500 font-normal">
                        {completedCount} of {totalCount} completed
                      </span>
                    </div>

                    {session.tasks && session.tasks.length > 0 ? (
                      <div className="space-y-2 pl-1">
                        {session.tasks.map((task, idx) => (
                          <div
                            key={task.id || idx}
                            className={`p-2.5 rounded-xl border flex items-start space-x-3 transition-colors ${
                              task.completed
                                ? 'bg-emerald-50/50 border-emerald-100 text-slate-600'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            {/* Serial Number & Status Check */}
                            <span className="font-mono font-bold text-slate-400 select-none w-5 pt-0.5">
                              {idx + 1}.
                            </span>

                            <div className="pt-0.5">
                              {task.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span
                                className={`text-xs ${
                                  task.completed
                                    ? 'line-through text-slate-400 font-normal'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {task.text}
                              </span>
                              {task.completedAt && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Finished at {new Date(task.completedAt).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 italic">
                        No individual tasks were recorded for this session.
                      </div>
                    )}

                    {session.sessionLabel && (
                      <div className="pt-2 flex items-center space-x-2 text-slate-500 border-t border-slate-200/60">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Tag / Label: <strong className="text-slate-700">{session.sessionLabel}</strong>
                        </span>
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
