import React from 'react';
import { AggregateStatistics, FocusSession } from '../../shared/types';
import { getDailyActivity } from '../../features/analytics/analyticsCalculations';
import {
  Clock,
  CheckCircle2,
  Target,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OverviewTabProps {
  stats: AggregateStatistics;
  history: FocusSession[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ stats, history }) => {
  const dailyData = getDailyActivity(history, 7);
  const maxDayMinutes = Math.max(1, ...dailyData.map((d) => d.totalMinutes));

  const plannedHours = (stats.totalPlannedTimeMs / (1000 * 60 * 60)).toFixed(1);
  const actualHours = (stats.totalActualActiveTimeMs / (1000 * 60 * 60)).toFixed(1);
  const avgMins = Math.round(stats.averageSessionDurationMs / 60000);

  const fbTotalMins = Math.round(
    history.filter((s) => s.site === 'facebook').reduce((acc, s) => acc + s.actualDurationMs, 0) / 60000
  );
  const ytTotalMins = Math.round(
    history.filter((s) => s.site === 'youtube').reduce((acc, s) => acc + s.actualDurationMs, 0) / 60000
  );
  const siteTotalMins = fbTotalMins + ytTotalMins || 1;
  const fbPercent = Math.round((fbTotalMins / siteTotalMins) * 100);
  const ytPercent = 100 - fbPercent;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Completed Sessions */}
        <div className="p-4 bg-[#141824] border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Completed Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {stats.totalCompletedSessions}
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.totalSessionsStarted} total started ({stats.totalAbandonedSessions} abandoned)
          </div>
        </div>

        {/* Card 2: Total Focus Time */}
        <div className="p-4 bg-[#141824] border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Total Focus Time</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {actualHours}h
          </div>
          <div className="text-[11px] text-slate-400">
            Planned: {plannedHours}h • Avg: {avgMins}m / session
          </div>
        </div>

        {/* Card 3: Task Completion Rate */}
        <div className="p-4 bg-[#141824] border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Task Completion</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {stats.taskCompletionRate}%
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.totalTasksCompleted} of {stats.totalTasksCreated} tasks done
          </div>
        </div>

        {/* Card 4: Within Time Limit */}
        <div className="p-4 bg-[#141824] border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">On-Time Completion</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {stats.completedWithinAllocatedTimeCount}
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.totalExpiredSessions} sessions reached timer expiry
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Activity Bar Chart */}
        <div className="lg:col-span-2 p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Daily Focus Activity (Last 7 Days)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Focus minutes logged per day</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                <span className="text-slate-400">Facebook</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-red-500" />
                <span className="text-slate-400">YouTube</span>
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-white/5">
            {dailyData.map((day, idx) => {
              const fbHeight = (day.facebookMinutes / maxDayMinutes) * 100;
              const ytHeight = (day.youtubeMinutes / maxDayMinutes) * 100;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {day.totalMinutes}m
                  </div>
                  <div className="w-full max-w-[36px] bg-white/5 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-110">
                    <div
                      style={{ height: `${fbHeight}%` }}
                      className="bg-blue-500 transition-all duration-500"
                      title={`Facebook: ${day.facebookMinutes}m`}
                    />
                    <div
                      style={{ height: `${ytHeight}%` }}
                      className="bg-red-500 transition-all duration-500"
                      title={`YouTube: ${day.youtubeMinutes}m`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    {day.dateLabel.split(',')[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Site & Outcome Breakdown */}
        <div className="p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Platform Distribution</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Time spent by supported site</p>

            {/* Split Bar */}
            <div className="mt-4 space-y-2">
              <div className="w-full h-3 rounded-full bg-white/5 flex overflow-hidden">
                <div style={{ width: `${fbPercent}%` }} className="bg-blue-600 transition-all duration-500" />
                <div style={{ width: `${ytPercent}%` }} className="bg-red-600 transition-all duration-500" />
              </div>

              <div className="flex justify-between text-xs pt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-blue-600" />
                  <span className="text-slate-300">Facebook ({fbPercent}%)</span>
                  <span className="text-slate-400 font-mono text-[11px]">{fbTotalMins}m</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-red-600" />
                  <span className="text-slate-300">YouTube ({ytPercent}%)</span>
                  <span className="text-slate-400 font-mono text-[11px]">{ytTotalMins}m</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Session Integrity
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-[#171c2b] rounded-xl border border-white/5">
                <div className="text-slate-400 text-[11px]">Canceled Prompts</div>
                <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                  {stats.totalCanceledPrompts}
                </div>
              </div>
              <div className="p-2.5 bg-[#171c2b] rounded-xl border border-white/5">
                <div className="text-slate-400 text-[11px]">Expired Sessions</div>
                <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                  {stats.totalExpiredSessions}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
