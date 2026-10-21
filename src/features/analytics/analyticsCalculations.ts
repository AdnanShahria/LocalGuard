import {
  FocusSession,
  AggregateStatistics,
  HistoryFilterOptions,
  type GuardedSite,
} from '../../shared/types';

export interface SiteUsageSummary {
  siteId: string;
  name: string;
  domain: string;
  todayMinutes: number;
  weeklyMinutes: number;
  allTimeMinutes: number;
  sessionCount: number;
  customColor?: string;
  enabled?: boolean;
}

/**
 * Computes all 13 essential metrics from historical session records and canceled prompt counts.
 */
export function calculateStatistics(
  history: FocusSession[],
  canceledPromptCount: number
): AggregateStatistics {
  const totalCompleted = history.filter((s) => s.status === 'completed').length;
  const totalAbandoned = history.filter((s) => s.status === 'abandoned').length;
  const totalExpired = history.filter((s) => s.wasExpired || s.status === 'expired').length;
  const totalSessions = history.length;

  const totalFacebook = history.filter((s) => s.site === 'facebook').length;
  const totalYouTube = history.filter((s) => s.site === 'youtube').length;

  let totalPlannedTimeMs = 0;
  let totalActualActiveTimeMs = 0;
  let totalTasksCompleted = 0;
  let totalTasksCreated = 0;
  let completedWithinAllocatedTimeCount = 0;

  for (const s of history) {
    totalPlannedTimeMs += s.allocatedDurationMs || 0;
    totalActualActiveTimeMs += s.actualDurationMs || 0;

    const completed = s.tasksCompletedCount ?? s.tasks.filter((t) => t.completed).length;
    const total = s.totalTasksCount ?? s.tasks.length;
    totalTasksCompleted += completed;
    totalTasksCreated += total;

    // Completed within allocated time: must be completed and actual duration <= allocated duration (with 5s grace period)
    if (s.status === 'completed' && s.actualDurationMs <= s.allocatedDurationMs + 5000 && !s.wasExpired) {
      completedWithinAllocatedTimeCount += 1;
    }
  }

  const averageSessionDurationMs = totalSessions > 0 ? Math.round(totalActualActiveTimeMs / totalSessions) : 0;
  const taskCompletionRate = totalTasksCreated > 0 ? Math.round((totalTasksCompleted / totalTasksCreated) * 100) : 0;

  return {
    totalSessionsStarted: totalSessions,
    totalCanceledPrompts: canceledPromptCount,
    totalCompletedSessions: totalCompleted,
    totalAbandonedSessions: totalAbandoned,
    totalExpiredSessions: totalExpired,
    totalFacebookSessions: totalFacebook,
    totalYouTubeSessions: totalYouTube,
    totalPlannedTimeMs,
    totalActualActiveTimeMs,
    averageSessionDurationMs,
    totalTasksCompleted,
    totalTasksCreated,
    taskCompletionRate,
    completedWithinAllocatedTimeCount,
  };
}

/**
 * Filters and sorts historical sessions according to criteria.
 */
export function filterAndSortHistory(
  history: FocusSession[],
  options: HistoryFilterOptions
): FocusSession[] {
  const { site, status, searchQuery, dateRange, sortBy = 'date_desc' } = options;

  let result = [...history];

  // Filter by site
  if (site && site !== 'all') {
    result = result.filter((s) => s.site === site);
  }

  // Filter by status
  if (status && status !== 'all') {
    if (status === 'expired') {
      result = result.filter((s) => s.wasExpired || s.status === 'expired');
    } else {
      result = result.filter((s) => s.status === status);
    }
  }

  // Filter by search query (purpose or task text)
  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((s) => {
      const matchPurpose = s.purpose.toLowerCase().includes(q);
      const matchTasks = s.tasks.some((t) => t.text.toLowerCase().includes(q));
      const matchLabel = s.sessionLabel ? s.sessionLabel.toLowerCase().includes(q) : false;
      return matchPurpose || matchTasks || matchLabel;
    });
  }

  // Filter by date range
  if (dateRange && dateRange !== 'all') {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    if (dateRange === 'today') {
      result = result.filter((s) => s.startTime >= startOfToday);
    } else if (dateRange === 'week') {
      const sevenDaysAgo = now - 7 * dayMs;
      result = result.filter((s) => s.startTime >= sevenDaysAgo);
    } else if (dateRange === 'month') {
      const thirtyDaysAgo = now - 30 * dayMs;
      result = result.filter((s) => s.startTime >= thirtyDaysAgo);
    }
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return a.startTime - b.startTime;
      case 'duration_desc':
        return b.actualDurationMs - a.actualDurationMs;
      case 'tasks_desc':
        return (b.tasksCompletedCount ?? 0) - (a.tasksCompletedCount ?? 0);
      case 'date_desc':
      default:
        return b.startTime - a.startTime;
    }
  });

  return result;
}

export interface DailyActivityPoint {
  dateLabel: string;
  timestamp: number;
  facebookMinutes: number;
  youtubeMinutes: number;
  totalMinutes: number;
  sessionCount: number;
  plannedMinutes: number;
  actualMinutes: number;
}

/**
 * Computes daily activity series for the last N days (for charts).
 */
export function getDailyActivity(history: FocusSession[], daysCount = 7): DailyActivityPoint[] {
  const result: DailyActivityPoint[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const daySessions = history.filter((s) => s.startTime >= dayStart && s.startTime < dayEnd);

    let fbMs = 0;
    let ytMs = 0;
    let plannedMs = 0;
    let actualMs = 0;

    daySessions.forEach((s) => {
      plannedMs += s.allocatedDurationMs || 0;
      actualMs += s.actualDurationMs || 0;
      if (s.site === 'facebook' || s.site?.includes('facebook')) fbMs += s.actualDurationMs;
      if (s.site === 'youtube' || s.site?.includes('youtube')) ytMs += s.actualDurationMs;
    });

    const dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });

    result.push({
      dateLabel,
      timestamp: dayStart,
      facebookMinutes: Math.round(fbMs / 60000),
      youtubeMinutes: Math.round(ytMs / 60000),
      totalMinutes: Math.round(actualMs / 60000),
      sessionCount: daySessions.length,
      plannedMinutes: Math.round(plannedMs / 60000),
      actualMinutes: Math.round(actualMs / 60000),
    });
  }

  return result;
}

/**
 * Check if a session belongs to a guarded site.
 */
function isSessionForSite(session: FocusSession, site: GuardedSite): boolean {
  if (!session.site) return false;
  const sessSite = session.site.toLowerCase().trim();
  const siteId = site.id.toLowerCase().trim();
  const cleanDomain = site.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').trim();
  const cleanSessSite = sessSite.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').trim();

  // Exact ID match
  if (sessSite === siteId) return true;
  // Exact domain match
  if (cleanSessSite === cleanDomain) return true;

  // Domain prefix match (e.g. 'youtube' matching 'youtube.com')
  const domainParts = cleanDomain.split('.');
  const primaryDomainPart = domainParts[0];
  if (sessSite === primaryDomainPart) return true;
  if (cleanSessSite === primaryDomainPart) return true;

  return false;
}

/**
 * Computes usage summary for each guarded site: todayMinutes, weeklyMinutes, allTimeMinutes, sessionCount.
 */
export function getSiteUsageSummary(
  history: FocusSession[],
  guardedSites: GuardedSite[]
): SiteUsageSummary[] {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (guardedSites || []).map((site) => {
    const siteSessions = history.filter((s) => isSessionForSite(s, site));

    let todayMs = 0;
    let weeklyMs = 0;
    let allTimeMs = 0;

    for (const s of siteSessions) {
      const duration = s.actualDurationMs || 0;
      allTimeMs += duration;

      if (s.startTime >= startOfToday) {
        todayMs += duration;
      }
      if (s.startTime >= sevenDaysAgo) {
        weeklyMs += duration;
      }
    }

    return {
      siteId: site.id,
      name: site.name,
      domain: site.domain,
      todayMinutes: Math.round(todayMs / 60000),
      weeklyMinutes: Math.round(weeklyMs / 60000),
      allTimeMinutes: Math.round(allTimeMs / 60000),
      sessionCount: siteSessions.length,
      customColor: site.customColor,
      enabled: site.enabled,
    };
  });
}

/**
 * Computes an array of 24 numbers representing minutes or sessions per hour of the day (00:00 to 23:00).
 */
export function calculateHourlyActivity(
  history: FocusSession[],
  metric: 'minutes' | 'sessions' = 'minutes'
): number[] {
  const hourly = new Array<number>(24).fill(0);
  for (const session of history) {
    if (session.startTime) {
      const date = new Date(session.startTime);
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        if (metric === 'sessions') {
          hourly[hour] += 1;
        } else {
          const mins = Math.round((session.actualDurationMs || 0) / 60000);
          hourly[hour] += mins;
        }
      }
    }
  }
  return hourly;
}

export interface TodayUsageOverview {
  totalScreenMinutes: number;
  guardedMinutes: number;
  regularMinutes: number;
  budgetMinutes: number;
  budgetProgressPercent: number;
  yesterdayGuardedMinutes: number;
  trendDiffMinutes: number;
  activeSessionsCount: number;
  todayCompletedCount: number;
  todayAbandonedCount: number;
  todaySessionsCount: number;
  todayTasksCompleted: number;
  todayTasksCreated: number;
}

/**
 * Computes today's comprehensive screen time, guarded focus time, regular time,
 * daily budget progress, and yesterday's comparison trend.
 */
export function getTodayUsageOverview(
  history: FocusSession[],
  activeSessions: Record<string, FocusSession | null> = {},
  budgetMinutes: number = 120,
  browserHistoryEstimatedMinutes?: number
): TodayUsageOverview {
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const todaySessions = history.filter((s) => s.startTime >= startOfToday);
  const yesterdaySessions = history.filter(
    (s) => s.startTime >= startOfYesterday && s.startTime < startOfToday
  );

  let todayGuardedMs = todaySessions.reduce((acc, s) => acc + (s.actualDurationMs || 0), 0);
  const yesterdayGuardedMs = yesterdaySessions.reduce((acc, s) => acc + (s.actualDurationMs || 0), 0);

  let todayTasksCompleted = 0;
  let todayTasksCreated = 0;

  for (const s of todaySessions) {
    todayTasksCompleted += s.tasksCompletedCount ?? s.tasks.filter((t) => t.completed).length;
    todayTasksCreated += s.totalTasksCount ?? s.tasks.length;
  }

  // Include elapsed time and tasks from currently active sessions
  let activeSessionsCount = 0;
  for (const session of Object.values(activeSessions)) {
    if (
      session &&
      (session.status === 'active' || session.status === 'paused' || session.status === 'expired')
    ) {
      activeSessionsCount++;
      const elapsed = Math.max(0, now - session.startTime);
      todayGuardedMs += elapsed;

      todayTasksCompleted += session.tasks.filter((t) => t.completed).length;
      todayTasksCreated += session.tasks.length;
    }
  }

  const guardedMinutes = Math.round(todayGuardedMs / 60000);
  const yesterdayGuardedMinutes = Math.round(yesterdayGuardedMs / 60000);
  const trendDiffMinutes = guardedMinutes - yesterdayGuardedMinutes;

  // Minutes elapsed since midnight: the hard physical ceiling for any screen time estimate.
  // No browsing estimate should ever exceed this value.
  const minutesSinceMidnight = Math.floor((now - new Date(now).setHours(0, 0, 0, 0)) / 60000);

  const rawEstimatedTotal =
    browserHistoryEstimatedMinutes !== undefined && browserHistoryEstimatedMinutes > 0
      ? Math.max(guardedMinutes, browserHistoryEstimatedMinutes)
      : Math.max(guardedMinutes, Math.round(guardedMinutes * 1.5));

  // Cap to minutes elapsed since midnight — it is physically impossible to browse
  // more than the time that has passed today.
  const estimatedTotalBrowsing = Math.min(rawEstimatedTotal, minutesSinceMidnight);

  const totalScreenMinutes = estimatedTotalBrowsing;
  const regularMinutes = Math.max(0, totalScreenMinutes - guardedMinutes);
  const budgetProgressPercent =
    budgetMinutes > 0
      ? Math.min(100, Math.round((guardedMinutes / budgetMinutes) * 100))
      : 0;

  const todayCompletedCount = todaySessions.filter((s) => s.status === 'completed').length;
  const todayAbandonedCount = todaySessions.filter((s) => s.status === 'abandoned').length;

  return {
    totalScreenMinutes,
    guardedMinutes,
    regularMinutes,
    budgetMinutes,
    budgetProgressPercent,
    yesterdayGuardedMinutes,
    trendDiffMinutes,
    activeSessionsCount,
    todayCompletedCount,
    todayAbandonedCount,
    todaySessionsCount: todaySessions.length + activeSessionsCount,
    todayTasksCompleted,
    todayTasksCreated,
  };
}
