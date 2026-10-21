import { FocusSession, AggregateStatistics, HistoryFilterOptions } from '../../shared/types';

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
    daySessions.forEach((s) => {
      if (s.site === 'facebook') fbMs += s.actualDurationMs;
      if (s.site === 'youtube') ytMs += s.actualDurationMs;
    });

    const dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });

    result.push({
      dateLabel,
      timestamp: dayStart,
      facebookMinutes: Math.round(fbMs / 60000),
      youtubeMinutes: Math.round(ytMs / 60000),
      totalMinutes: Math.round((fbMs + ytMs) / 60000),
      sessionCount: daySessions.length,
    });
  }

  return result;
}
