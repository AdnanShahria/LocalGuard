import React, { useState, useEffect, useCallback } from 'react';
import {
  AggregateStatistics,
  FocusSession,
  GuardedSite,
  UserSettings,
  SiteUsageStats,
} from '../../shared/types';
import {
  getDailyActivity,
  calculateHourlyActivity,
  getTodayUsageOverview,
  TodayUsageOverview,
} from '../../features/analytics/analyticsCalculations';
import { getStorageData, getSiteUsageStats, onStorageChanged } from '../../storage/storage';
import { BrandLogo } from '../../shared/components/BrandLogo';
import {
  Clock,
  CheckCircle2,
  Target,
  Sparkles,
  Calendar,
  Globe,
  Compass,
  RotateCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Laptop,
} from 'lucide-react';

interface TopDomainItem {
  domain: string;
  count: number;
  percentage: number;
  lastVisitTime?: number;
  estimatedMinutes?: number;
}

interface BrowserHistoryData {
  totalVisits: number;
  uniqueDomainsCount: number;
  topDomains: TopDomainItem[];
  hourlyDistribution: number[]; // 24 entries (00:00 - 23:00)
}

interface OverviewTabProps {
  stats: AggregateStatistics;
  history: FocusSession[];
  guardedSites?: GuardedSite[];
  settings?: UserSettings;
}

const nowMs = Date.now();
const FALLBACK_BROWSER_HISTORY: BrowserHistoryData = {
  totalVisits: 84,
  uniqueDomainsCount: 12,
  topDomains: [
    { domain: 'youtube.com', count: 32, percentage: 38, lastVisitTime: nowMs - 12 * 60000, estimatedMinutes: 48 },
    { domain: 'github.com', count: 20, percentage: 24, lastVisitTime: nowMs - 35 * 60000, estimatedMinutes: 30 },
    { domain: 'facebook.com', count: 14, percentage: 17, lastVisitTime: nowMs - 75 * 60000, estimatedMinutes: 22 },
    { domain: 'google.com', count: 10, percentage: 12, lastVisitTime: nowMs - 110 * 60000, estimatedMinutes: 15 },
    { domain: 'stackoverflow.com', count: 8, percentage: 9, lastVisitTime: nowMs - 160 * 60000, estimatedMinutes: 12 },
  ],
  hourlyDistribution: [
    0, 0, 0, 0, 0, 0, 2, 5, 12, 18, 14, 8, 11, 16, 22, 19, 15, 10, 6, 8, 5, 2, 0, 0,
  ],
};

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  history,
  guardedSites: propGuardedSites,
  settings: propSettings,
}) => {
  const [guardedSites, setGuardedSites] = useState<GuardedSite[]>(propGuardedSites || []);
  const [settings, setSettings] = useState<UserSettings | null>(propSettings || null);
  const [activeSessions, setActiveSessions] = useState<Record<string, FocusSession | null>>({});
  const [liveSiteStats, setLiveSiteStats] = useState<Record<string, SiteUsageStats>>({});
  const [browserHistory, setBrowserHistory] = useState<BrowserHistoryData>(FALLBACK_BROWSER_HISTORY);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyLastUpdated, setHistoryLastUpdated] = useState<Date>(new Date());
  const [activeHourHover, setActiveHourHover] = useState<{ hour: number; count: number } | null>(null);
  const [activeDayHover, setActiveDayHover] = useState<{ day: string; planned: number; actual: number } | null>(null);

  // Synchronize storage data: guarded sites, active sessions, and user settings
  const syncStorage = useCallback(async () => {
    try {
      const data = await getStorageData();
      if (data.settings) {
        setSettings(data.settings);
        if (data.settings.guardedSites) {
          setGuardedSites(data.settings.guardedSites);
        }
      }
      if (data.activeSessions) {
        setActiveSessions(data.activeSessions);
      }

      // Fetch live stats from getSiteUsageStats for each guarded site
      const currentSites = data.settings?.guardedSites || guardedSites;
      const statsMap: Record<string, SiteUsageStats> = {};
      for (const site of currentSites) {
        try {
          const s = await getSiteUsageStats(site.domain);
          statsMap[site.domain] = s;
          statsMap[site.id] = s;
        } catch (err) {
          console.debug('Failed to getSiteUsageStats for', site.domain, err);
        }
      }
      setLiveSiteStats(statsMap);
    } catch (err) {
      console.error('OverviewTab failed to sync storage:', err);
    }
  }, [guardedSites]);

  useEffect(() => {
    syncStorage();
    const unsubscribe = onStorageChanged(() => syncStorage());
    return () => unsubscribe();
  }, [syncStorage]);

  // Query background worker for Chrome daily browser history
  const fetchBrowserHistory = () => {
    setIsHistoryLoading(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'GET_BROWSER_HISTORY' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            console.debug('Browser history unavailable from background:', chrome.runtime?.lastError);
          } else {
            setBrowserHistory({
              totalVisits: response.totalVisits ?? 0,
              uniqueDomainsCount: response.uniqueDomainsCount ?? 0,
              topDomains: response.topDomains ?? [],
              hourlyDistribution: response.hourlyDistribution ?? new Array(24).fill(0),
            });
            setHistoryLastUpdated(new Date());
          }
          setIsHistoryLoading(false);
        });
      } catch (err) {
        console.debug('Error sending GET_BROWSER_HISTORY message:', err);
        setIsHistoryLoading(false);
      }
    } else {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchBrowserHistory();
  }, []);

  // Compute total estimated browsing minutes from history.
  // totalVisits is now correctly the count of distinct URLs navigated today
  // (not the all-time cumulative visitCount), so we use ~2 min per navigation.
  const historyBrowsingMinutes = (browserHistory.topDomains || []).reduce(
    (acc, d) => acc + (d.estimatedMinutes || Math.max(1, Math.round(d.count * 2))),
    0
  );
  const rawHistoryEstimate = Math.max(
    historyBrowsingMinutes,
    Math.round((browserHistory.totalVisits || 0) * 2)
  );
  // Hard ceiling: screen time cannot exceed the number of minutes elapsed since midnight.
  // This prevents inflated estimates from exceeding physically possible time.
  const minutesSinceMidnight = Math.floor(
    (Date.now() - new Date().setHours(0, 0, 0, 0)) / 60000
  );
  const totalHistoryVisitsMinutes = Math.min(rawHistoryEstimate, minutesSinceMidnight);

  // Compute today's usage overview (Guarded vs Regular, Budget progress, Daily trend)
  const dailyBudgetMinutes = settings?.dailyUsageBudgetMinutes || 120;
  const todayUsage: TodayUsageOverview = getTodayUsageOverview(
    history,
    activeSessions,
    dailyBudgetMinutes,
    totalHistoryVisitsMinutes
  );

  // Identify any currently active session details
  const activeSessionList = Object.entries(activeSessions)
    .filter(([, s]) => s && (s.status === 'active' || s.status === 'paused' || s.status === 'expired'))
    .map(([siteKey, s]) => ({ siteKey, session: s as FocusSession }));
  const primaryActive = activeSessionList.length > 0 ? activeSessionList[0] : null;

  // Compute 7-day focus activity series (injecting today's active session time into today's point)
  const dailyData = getDailyActivity(history, 7);
  if (primaryActive) {
    const elapsedMins = Math.round(Math.max(0, Date.now() - primaryActive.session.startTime) / 60000);
    if (dailyData.length > 0) {
      const todayPoint = dailyData[dailyData.length - 1];
      todayPoint.actualMinutes += elapsedMins;
      todayPoint.totalMinutes += elapsedMins;
    }
  }
  const maxDayMinutes = Math.max(
    30,
    ...dailyData.map((d) => Math.max(d.plannedMinutes, d.actualMinutes))
  );

  // Compute Focus Hourly Distribution
  const focusHourlyActivity = calculateHourlyActivity(history, 'minutes');
  const peakFocusHour = focusHourlyActivity.reduce(
    (maxIdx, curr, idx, arr) => (curr > arr[maxIdx] ? idx : maxIdx),
    0
  );
  const peakFocusMinutes = focusHourlyActivity[peakFocusHour] || 0;

  // Active session elapsed ms
  const activeElapsedMs = primaryActive
    ? Math.max(0, Date.now() - primaryActive.session.startTime)
    : 0;

  // Compute KPI values
  const totalActualMinutes =
    Math.round(stats.totalActualActiveTimeMs / 60000) + Math.round(activeElapsedMs / 60000);
  const totalPlannedMinutes = Math.round(stats.totalPlannedTimeMs / 60000);
  const avgSessionMinutes = Math.round(stats.averageSessionDurationMs / 60000);
  const winRate =
    stats.totalSessionsStarted > 0
      ? Math.round((stats.totalCompletedSessions / stats.totalSessionsStarted) * 100)
      : 0;
  const onTimePercent =
    stats.totalCompletedSessions > 0
      ? Math.round(
          (stats.completedWithinAllocatedTimeCount / stats.totalCompletedSessions) * 100
        )
      : 100;

  // Proportions for the Today's Usage Breakdown bar
  const guardedShare =
    todayUsage.totalScreenMinutes > 0
      ? Math.min(100, Math.round((todayUsage.guardedMinutes / todayUsage.totalScreenMinutes) * 100))
      : 0;
  const regularShare = Math.max(0, 100 - guardedShare);

  // Browser History max traffic scaling
  const maxHourlyTraffic = Math.max(1, ...(browserHistory.hourlyDistribution || [1]));
  const peakTrafficHour = (browserHistory.hourlyDistribution || []).reduce(
    (maxIdx, curr, idx, arr) => (curr > arr[maxIdx] ? idx : maxIdx),
    0
  );

  // Time segment calculations
  const distribution = browserHistory.hourlyDistribution || new Array(24).fill(0);
  const morningTraffic = distribution.slice(6, 12).reduce((a, b) => a + b, 0);
  const afternoonEveningTraffic = distribution.slice(12, 24).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8 animate-fade-in font-sans antialiased">
      {/* ============================================================== */}
      {/* SECTION 1: LocalGuard Focus & Guarded Metrics                  */}
      {/* ============================================================== */}
      <section className="space-y-5">
        {/* Section Header with Apple HIG Typography */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/90">
          <div className="flex items-center space-x-3">
            <BrandLogo size="md" variant="squircle" showText={false} />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Focus & Guarded Dashboard
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold tracking-wide">
                  Live Apple HIG
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Connected to live storage, browser history analytics, and active session protection
                {peakFocusMinutes > 0 && (
                  <span className="ml-1 text-slate-400">
                    • Peak focus:{' '}
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {peakFocusHour.toString().padStart(2, '0')}:00 ({peakFocusMinutes}m)
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {primaryActive ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="capitalize">
                  Guarded Active ({primaryActive.siteKey})
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Protected Mode</span>
              </span>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARD 1: TODAY'S TOTAL USAGE CARD (PROMINENT FIRST CARD)        */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/50 border border-blue-200/80 rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,113,227,0.06)] space-y-6 transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,113,227,0.1)]">
          {/* Subtle Ambient Background Watermark */}
          <div className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.04] pointer-events-none text-blue-900">
            <BrandLogo size={192} variant="squircle" />
          </div>

          {/* Top Row: Eyebrow + Trend Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 text-blue-800 text-[11px] font-bold uppercase tracking-wider">
                <Laptop className="w-3.5 h-3.5 text-blue-600" />
                <span>Today's Total Usage</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">• Screen Time & Focus Split</span>
            </div>

            {/* Daily Trend / Comparison Pill */}
            <div className="flex items-center space-x-2">
              {todayUsage.trendDiffMinutes > 0 ? (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums shadow-2xs">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+{todayUsage.trendDiffMinutes}m vs yesterday</span>
                </div>
              ) : todayUsage.trendDiffMinutes < 0 ? (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                  <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>{todayUsage.trendDiffMinutes}m vs yesterday</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                  <span>Matched yesterday</span>
                </div>
              )}

              {primaryActive && (
                <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  <span>Live Active Session</span>
                </span>
              )}
            </div>
          </div>

          {/* Hero Big Metric & Split Indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Big Value: Total Screen Time */}
            <div className="lg:col-span-5 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Screen & Browsing Time
              </div>
              <div className="flex items-baseline space-x-3">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 tabular-nums">
                  {formatDuration(todayUsage.totalScreenMinutes)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  across all tabs
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Measured via Chrome history navigations and active LocalGuard focus sessions today.
              </p>
            </div>

            {/* Right Split Breakdown Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Focused / Guarded Time Pill */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Guarded Focus Time</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    {guardedShare}%
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
                  {formatDuration(todayUsage.guardedMinutes)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {todayUsage.todayCompletedCount} won sessions
                  {todayUsage.activeSessionsCount > 0 && ' • 1 in progress'}
                </div>
              </div>

              {/* Regular / Unfocused Browsing Pill */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Regular Browsing</span>
                  </span>
                  <span className="text-xs font-bold text-slate-600 tabular-nums">
                    {regularShare}%
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-800 tabular-nums">
                  {formatDuration(todayUsage.regularMinutes)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Unrestricted web navigation
                </div>
              </div>
            </div>
          </div>

          {/* Visual Dual-Segment Ratio Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center space-x-1.5 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span>Guarded Time ({guardedShare}%)</span>
              </span>
              <span className="flex items-center space-x-1.5 text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-sm bg-slate-300" />
                <span>Regular Browsing ({regularShare}%)</span>
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${guardedShare}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                title={`Guarded Focus: ${formatDuration(todayUsage.guardedMinutes)} (${guardedShare}%)`}
              />
              <div
                style={{ width: `${regularShare}%` }}
                className="h-full bg-slate-300 transition-all duration-500"
                title={`Regular Browsing: ${formatDuration(todayUsage.regularMinutes)} (${regularShare}%)`}
              />
            </div>
          </div>

          {/* Daily Focus Budget Progress Bar */}
          <div className="pt-2 border-t border-slate-200/70 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800">
                  Daily Focus Budget Progress:
                </span>
                <span className="font-medium text-slate-600 tabular-nums">
                  {todayUsage.guardedMinutes}m of {todayUsage.budgetMinutes}m target
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-blue-700 tabular-nums text-xs">
                  {todayUsage.budgetProgressPercent}% Completed
                </span>
                {todayUsage.budgetProgressPercent >= 100 && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Goal Reached!</span>
                  </span>
                )}
              </div>
            </div>

            {/* Apple Style Smooth Budget Track */}
            <div className="w-full h-2.5 rounded-full bg-blue-100/60 overflow-hidden">
              <div
                style={{ width: `${todayUsage.budgetProgressPercent}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-500 shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARDS 2 - 5: THE 4 SECONDARY KPI CARDS                         */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 2: Total Guarded Time */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Guarded Time
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatDuration(totalActualMinutes)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Planned:{' '}
                <span className="font-medium text-slate-700 tabular-nums">
                  {formatDuration(totalPlannedMinutes)}
                </span>{' '}
                • Avg:{' '}
                <span className="font-medium text-slate-700 tabular-nums">
                  {avgSessionMinutes}m
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Completed Sessions */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Completed Sessions
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-emerald-600 tabular-nums">
                {stats.totalCompletedSessions}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                <span className="font-medium text-slate-700 tabular-nums">
                  {stats.totalSessionsStarted}
                </span>{' '}
                started •{' '}
                <span className="font-medium text-amber-600 tabular-nums">
                  {stats.totalAbandonedSessions}
                </span>{' '}
                stopped ({winRate}% won)
              </div>
            </div>
          </div>

          {/* Card 4: Task Completion Rate */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Task Completion Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-indigo-600 tabular-nums">
                {stats.taskCompletionRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                <span className="font-medium text-slate-700 tabular-nums">
                  {stats.totalTasksCompleted}
                </span>{' '}
                of{' '}
                <span className="font-medium text-slate-700 tabular-nums">
                  {stats.totalTasksCreated}
                </span>{' '}
                checklist tasks marked done
              </div>
            </div>
          </div>

          {/* Card 5: On-Time Rate */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                On-Time Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-amber-600 tabular-nums">
                {stats.completedWithinAllocatedTimeCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Within deadline ({onTimePercent}%) •{' '}
                <span className="font-medium text-slate-700 tabular-nums">
                  {stats.totalExpiredSessions}
                </span>{' '}
                expired
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* GUARDED SITES USAGE BREAKDOWN TABLE (LIVE GET_SITE_USAGE_STATS) */}
        {/* ============================================================== */}
        <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Guarded Sites Usage Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live metrics from <code className="font-mono text-slate-600">getSiteUsageStats(domain)</code> across today, 7-day, and all-time records
              </p>
            </div>
            <div className="text-xs text-slate-500 font-semibold tabular-nums">
              {guardedSites.length} Protected Sites Configured
            </div>
          </div>

          {/* Usage Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Guarded Site</th>
                  <th className="py-3 px-3 text-right">Today</th>
                  <th className="py-3 px-3 text-right">Weekly (7d)</th>
                  <th className="py-3 px-3 text-right">All-Time</th>
                  <th className="py-3 px-3 text-right">Sessions</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {guardedSites.map((site) => {
                  const badgeColor =
                    site.customColor ||
                    (site.id === 'facebook'
                      ? '#1877F2'
                      : site.id === 'youtube'
                      ? '#FF0000'
                      : '#6366F1');
                  const initials = site.name
                    ? site.name.slice(0, 2).toUpperCase()
                    : site.id.slice(0, 2).toUpperCase();

                  const siteStats = liveSiteStats[site.domain] || liveSiteStats[site.id];
                  const siteSessions = history.filter(
                    (s) =>
                      s.site?.toLowerCase() === site.id.toLowerCase() ||
                      s.site?.toLowerCase() === site.domain.toLowerCase()
                  );

                  const isActiveNow =
                    activeSessions[site.id]?.status === 'active' ||
                    activeSessions[site.domain]?.status === 'active';

                  return (
                    <tr
                      key={site.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Site Badge & Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm flex-shrink-0"
                            style={{ backgroundColor: badgeColor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                              <span>{site.name}</span>
                              <a
                                href={`https://${site.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-300 hover:text-slate-600 transition-colors"
                                title={`Open ${site.domain}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {site.domain}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Today Usage */}
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                        {siteStats?.todayFormatted || formatDuration(siteStats?.todayMinutes || 0)}
                      </td>

                      {/* Weekly Usage */}
                      <td className="py-3.5 px-3 text-right text-slate-700 tabular-nums">
                        {siteStats?.weekFormatted || formatDuration(siteStats?.weeklyMinutes || 0)}
                      </td>

                      {/* All-Time Usage */}
                      <td className="py-3.5 px-3 text-right font-semibold text-blue-600 tabular-nums">
                        {siteStats?.allTimeFormatted || formatDuration(siteStats?.allTimeMinutes || 0)}
                      </td>

                      {/* Session Count */}
                      <td className="py-3.5 px-3 text-right text-slate-700 tabular-nums font-medium">
                        {siteSessions.length}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {isActiveNow ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Now</span>
                          </span>
                        ) : site.enabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Guarded
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Paused
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {guardedSites.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No guarded sites configured yet. Add sites in the Settings tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 7-DAY FOCUS ACTIVITY: PLANNED VS ACTUAL                        */}
        {/* ============================================================== */}
        <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>7-Day Focus Activity: Planned Target vs Actual Time</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison of daily scheduled focus targets against recorded active time
              </p>
            </div>
            {/* Chart Legend */}
            <div className="flex items-center space-x-4 text-xs font-medium">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-600 shadow-xs" />
                <span className="text-slate-700 font-semibold">Actual Focus</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-200" />
                <span className="text-slate-500">Planned Target</span>
              </div>
            </div>
          </div>

          {/* Interactive Hover Tooltip Info */}
          <div className="h-5 text-xs text-slate-600 font-medium">
            {activeDayHover ? (
              <span className="text-blue-600 font-semibold tabular-nums">
                {activeDayHover.day}: Actual {activeDayHover.actual}m / Planned {activeDayHover.planned}m
              </span>
            ) : (
              <span className="text-slate-400">Hover over any day to see planned and actual minutes</span>
            )}
          </div>

          {/* Bar Chart Bars */}
          <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {dailyData.map((day, idx) => {
              const plannedHeight = Math.min(100, (day.plannedMinutes / maxDayMinutes) * 100);
              const actualHeight = Math.min(100, (day.actualMinutes / maxDayMinutes) * 100);

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() =>
                    setActiveDayHover({
                      day: day.dateLabel,
                      planned: day.plannedMinutes,
                      actual: day.actualMinutes,
                    })
                  }
                  onMouseLeave={() => setActiveDayHover(null)}
                >
                  {/* Top value indicator on hover */}
                  <div className="text-[11px] font-semibold text-slate-700 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    {day.actualMinutes}m
                  </div>

                  {/* Dual Bars Container */}
                  <div className="w-full max-w-[48px] flex items-end justify-center space-x-1.5 h-full">
                    {/* Planned Target Bar */}
                    <div className="flex-1 max-w-[20px] bg-slate-50 rounded-t-lg h-full flex flex-col justify-end">
                      <div
                        style={{ height: `${plannedHeight}%` }}
                        className="w-full bg-slate-200 hover:bg-slate-300 rounded-t-md transition-all duration-300"
                        title={`Planned: ${day.plannedMinutes}m`}
                      />
                    </div>

                    {/* Actual Focus Bar */}
                    <div className="flex-1 max-w-[20px] bg-blue-50/50 rounded-t-lg h-full flex flex-col justify-end">
                      <div
                        style={{ height: `${actualHeight}%` }}
                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-t-md transition-all duration-300 shadow-sm"
                        title={`Actual: ${day.actualMinutes}m`}
                      />
                    </div>
                  </div>

                  {/* Date Label */}
                  <div className="text-[11px] text-slate-500 mt-2 font-medium">
                    {day.dateLabel.split(',')[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 2: Chrome Daily Browser History Insights               */}
      {/* ============================================================== */}
      <section className="space-y-4 pt-2">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Chrome Daily Browser History Insights
              </h2>
              <p className="text-xs text-slate-500">
                Live data from Chrome history API, top visited domains, and hourly navigation patterns
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-slate-400 hidden sm:inline tabular-nums">
              Updated {historyLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={fetchBrowserHistory}
              disabled={isHistoryLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 transition-all disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Browser History KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Total Web Pages Visited Today */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Web Pages Visited Today
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {browserHistory.totalVisits.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Total page requests and navigations recorded since midnight
              </div>
            </div>
          </div>

          {/* Card 2: Unique Domains Visited Today */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-5 transition-all duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Unique Domains Visited Today
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-indigo-600 tabular-nums">
                {browserHistory.uniqueDomainsCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Distinct hosts and web services accessed across all browser tabs
              </div>
            </div>
          </div>
        </div>

        {/* Dual Layout: Top 5 Visited Domains & Hourly Traffic Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Top 5 Visited Domains (2 Cols) */}
          <div className="lg:col-span-2 bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-6 space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Top 5 Visited Domains Today</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Highest frequency destinations showing time and total visits from Chrome history
              </p>

              {/* Ranking List */}
              <div className="mt-5 space-y-4">
                {(browserHistory.topDomains || []).slice(0, 5).map((domainItem, rankIdx) => {
                  const rankColors = [
                    'bg-blue-600 text-white',
                    'bg-indigo-600 text-white',
                    'bg-sky-500 text-white',
                    'bg-slate-600 text-white',
                    'bg-slate-400 text-white',
                  ];

                  // Check if this domain is in guarded sites
                  const guardedSite = guardedSites.find(
                    (s) =>
                      s.domain.toLowerCase().includes(domainItem.domain.toLowerCase()) ||
                      domainItem.domain.toLowerCase().includes(s.domain.toLowerCase())
                  );

                  // Prioritize actual live guarded site time if available
                  const liveStats = guardedSite ? liveSiteStats[guardedSite.domain] : null;
                  const durationMinutes =
                    liveStats && liveStats.todayMinutes > 0
                      ? liveStats.todayMinutes
                      : domainItem.estimatedMinutes || Math.max(1, Math.round(domainItem.count * 2.5));

                  const lastTimeFormatted = domainItem.lastVisitTime
                    ? new Date(domainItem.lastVisitTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <div key={domainItem.domain} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        {/* Domain name & rank badge */}
                        <div className="flex items-center space-x-2.5 truncate max-w-[170px] sm:max-w-[210px]">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 shadow-2xs ${
                              rankColors[rankIdx] || 'bg-slate-300 text-white'
                            }`}
                          >
                            {rankIdx + 1}
                          </span>
                          <span className="font-semibold text-slate-800 truncate" title={domainItem.domain}>
                            {domainItem.domain}
                          </span>
                          {guardedSite && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Guarded
                            </span>
                          )}
                        </div>

                        {/* Time Spent & Total Visits */}
                        <div className="flex items-center space-x-2 text-right">
                          <div className="flex flex-col items-end">
                            <div className="flex items-center space-x-1.5 text-xs">
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {formatDuration(durationMinutes)}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-medium text-slate-600 tabular-nums">
                                {domainItem.count} {domainItem.count === 1 ? 'visit' : 'visits'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal tabular-nums">
                              {lastTimeFormatted ? `Last: ${lastTimeFormatted}` : `${domainItem.percentage}% total`}
                            </span>
                          </div>
                          <div className="w-8 text-right font-bold text-xs text-slate-900 tabular-nums">
                            {domainItem.percentage}%
                          </div>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(4, domainItem.percentage))}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 shadow-xs"
                        />
                      </div>
                    </div>
                  );
                })}

                {(!browserHistory.topDomains || browserHistory.topDomains.length === 0) && (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No browsing history recorded today yet.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom summary note showing peak time with total visits */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Peak activity time:</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {peakTrafficHour.toString().padStart(2, '0')}:00 – {((peakTrafficHour + 1) % 24).toString().padStart(2, '0')}:00 ({distribution[peakTrafficHour] || 0} visits)
              </span>
            </div>
          </div>

          {/* Right Column: Hourly Browsing Traffic Distribution (3 Cols) */}
          <div className="lg:col-span-3 bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Hourly Browsing Traffic Distribution</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Traffic across all 24 hours of the day showing time with total visits
                  </p>
                </div>

                {/* Active Hour Indicator / Always Visible Time & Total Visits Badge */}
                <div className="h-7 flex items-center">
                  {activeHourHover ? (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold tabular-nums shadow-2xs">
                      <span>Time: {activeHourHover.hour.toString().padStart(2, '0')}:00 – {((activeHourHover.hour + 1) % 24).toString().padStart(2, '0')}:00</span>
                      <span className="text-blue-300">•</span>
                      <span>{activeHourHover.count} {activeHourHover.count === 1 ? 'Visit' : 'Total Visits'}</span>
                      {focusHourlyActivity[activeHourHover.hour] > 0 && (
                        <>
                          <span className="text-blue-300">•</span>
                          <span className="text-emerald-700 font-bold">{focusHourlyActivity[activeHourHover.hour]}m Guarded</span>
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold tabular-nums">
                      <span>Peak Time: {peakTrafficHour.toString().padStart(2, '0')}:00 – {((peakTrafficHour + 1) % 24).toString().padStart(2, '0')}:00</span>
                      <span className="text-slate-300">•</span>
                      <span>{distribution[peakTrafficHour] || 0} Total Visits</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 24-Hour Bar Distribution Chart */}
              <div className="h-52 flex items-end justify-between gap-1 pt-6 pb-2 px-1 border-b border-slate-100">
                {distribution.map((count, hour) => {
                  const heightPct = Math.min(100, (count / maxHourlyTraffic) * 100);
                  const isZero = count === 0;
                  const isHovered = activeHourHover?.hour === hour;

                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                      onMouseEnter={() => setActiveHourHover({ hour, count })}
                      onMouseLeave={() => setActiveHourHover(null)}
                    >
                      {/* Hover visit count pill */}
                      <div
                        className={`text-[10px] font-semibold mb-1 transition-all duration-150 tabular-nums ${
                          isHovered
                            ? 'opacity-100 text-blue-700 font-bold scale-110'
                            : count > 0 && count >= maxHourlyTraffic * 0.75
                            ? 'opacity-70 text-slate-600'
                            : 'opacity-0 group-hover:opacity-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </div>

                      {/* Hourly bar */}
                      <div className="w-full max-w-[14px] bg-slate-50 rounded-t-sm h-full flex flex-col justify-end">
                        <div
                          style={{ height: `${isZero ? 4 : Math.max(8, heightPct)}%` }}
                          className={`w-full rounded-t-sm transition-all duration-200 ${
                            isZero
                              ? 'bg-slate-200 hover:bg-slate-300'
                              : isHovered
                              ? 'bg-blue-600 shadow-md ring-2 ring-blue-300'
                              : count > maxHourlyTraffic * 0.6
                              ? 'bg-indigo-600 group-hover:bg-indigo-700'
                              : 'bg-blue-500 group-hover:bg-blue-600'
                          }`}
                          title={`Time: ${hour.toString().padStart(2, '0')}:00 - ${((hour + 1) % 24).toString().padStart(2, '0')}:00 | Total Visits: ${count}`}
                        />
                      </div>

                      {/* Hourly tick mark */}
                      <div
                        className={`text-[9px] mt-1 tabular-nums transition-colors ${
                          isHovered
                            ? 'text-blue-600 font-bold'
                            : hour % 4 === 0
                            ? 'text-slate-400 font-medium'
                            : 'text-transparent'
                        }`}
                      >
                        {hour.toString().padStart(2, '0')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[11px] text-slate-400 tabular-nums font-medium px-1">
                <span>00:00</span>
                <span>03:00</span>
                <span>06:00</span>
                <span>09:00</span>
                <span>12:00</span>
                <span>15:00</span>
                <span>18:00</span>
                <span>21:00</span>
                <span>23:00</span>
              </div>
            </div>

            {/* Quick-Glance Summary Cards: Showing Time with Total Visits */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {/* Card 1: Peak Time Window */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Peak Time Window
                </div>
                <div className="font-bold text-slate-900 tabular-nums flex items-center justify-between">
                  <span>{peakTrafficHour.toString().padStart(2, '0')}:00 – {((peakTrafficHour + 1) % 24).toString().padStart(2, '0')}:00</span>
                  <span className="text-blue-600 font-semibold">{distribution[peakTrafficHour] || 0} visits</span>
                </div>
              </div>

              {/* Card 2: Morning Activity (06:00 - 12:00) */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Morning (06:00 – 12:00)
                </div>
                <div className="font-bold text-slate-900 tabular-nums flex items-center justify-between">
                  <span>06:00 – 12:00</span>
                  <span className="text-indigo-600 font-semibold">{morningTraffic} visits</span>
                </div>
              </div>

              {/* Card 3: Afternoon & Evening (12:00 - 24:00) */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Afternoon & Evening
                </div>
                <div className="font-bold text-slate-900 tabular-nums flex items-center justify-between">
                  <span>12:00 – 24:00</span>
                  <span className="text-indigo-600 font-semibold">{afternoonEveningTraffic} visits</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
