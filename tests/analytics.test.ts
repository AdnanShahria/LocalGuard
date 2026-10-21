import { describe, it, expect } from 'vitest';
import { FocusSession } from '../src/shared/types';
import {
  calculateStatistics,
  filterAndSortHistory,
  getDailyActivity,
  getSiteUsageSummary,
  calculateHourlyActivity,
  getTodayUsageOverview,
} from '../src/features/analytics/analyticsCalculations';
import type { GuardedSite } from '../src/shared/types';

describe('Analytics and Statistics Aggregation', () => {
  const mockHistory: FocusSession[] = [
    {
      id: 'sess-1',
      site: 'youtube',
      purpose: 'Deep learning paper review',
      tasks: [
        { id: 't1', text: 'Read abstract', completed: true },
        { id: 't2', text: 'Check benchmark table', completed: true },
      ],
      startTime: 1000000,
      endTime: 1000000 + 20 * 60 * 1000,
      allocatedDurationMs: 25 * 60 * 1000,
      deadlineTime: 1000000 + 25 * 60 * 1000,
      status: 'completed',
      lastUpdateTime: 1000000 + 20 * 60 * 1000,
      actualDurationMs: 20 * 60 * 1000,
      wasExpired: false,
      tasksCompletedCount: 2,
      totalTasksCount: 2,
    },
    {
      id: 'sess-2',
      site: 'facebook',
      purpose: 'Check community announcement',
      tasks: [{ id: 't3', text: 'Find post', completed: false }],
      startTime: 2000000,
      endTime: 2000000 + 5 * 60 * 1000,
      allocatedDurationMs: 10 * 60 * 1000,
      deadlineTime: 2000000 + 10 * 60 * 1000,
      status: 'abandoned',
      lastUpdateTime: 2000000 + 5 * 60 * 1000,
      actualDurationMs: 5 * 60 * 1000,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 1,
    },
    {
      id: 'sess-3',
      site: 'youtube',
      purpose: 'Watch Blender geometry nodes tutorial',
      tasks: [{ id: 't4', text: 'Node setup', completed: true }],
      startTime: 3000000,
      endTime: 3000000 + 35 * 60 * 1000,
      allocatedDurationMs: 30 * 60 * 1000,
      deadlineTime: 3000000 + 30 * 60 * 1000,
      status: 'completed',
      lastUpdateTime: 3000000 + 35 * 60 * 1000,
      actualDurationMs: 35 * 60 * 1000,
      wasExpired: true,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    },
  ];

  // Scenario 15: Statistics aggregation
  it('Scenario 15: computes all 13 essential metrics accurately from stored records', () => {
    const stats = calculateStatistics(mockHistory, 2);

    expect(stats.totalSessionsStarted).toBe(3);
    expect(stats.totalCanceledPrompts).toBe(2);
    expect(stats.totalCompletedSessions).toBe(2);
    expect(stats.totalAbandonedSessions).toBe(1);
    expect(stats.totalExpiredSessions).toBe(1); // sess-3 wasExpired: true
    expect(stats.totalFacebookSessions).toBe(1);
    expect(stats.totalYouTubeSessions).toBe(2);

    // Planned: 25m + 10m + 30m = 65m
    expect(stats.totalPlannedTimeMs).toBe(65 * 60 * 1000);
    // Actual: 20m + 5m + 35m = 60m
    expect(stats.totalActualActiveTimeMs).toBe(60 * 60 * 1000);
    // Average: 60m / 3 = 20m
    expect(stats.averageSessionDurationMs).toBe(20 * 60 * 1000);

    // Tasks: 2 + 0 + 1 = 3 completed of 4 total (75%)
    expect(stats.totalTasksCompleted).toBe(3);
    expect(stats.totalTasksCreated).toBe(4);
    expect(stats.taskCompletionRate).toBe(75);

    // Within allocated time: sess-1 only (sess-3 exceeded and was expired)
    expect(stats.completedWithinAllocatedTimeCount).toBe(1);
  });

  it('filters historical sessions by site and search keyword', () => {
    const fbSessions = filterAndSortHistory(mockHistory, { site: 'facebook' });
    expect(fbSessions.length).toBe(1);
    expect(fbSessions[0].site).toBe('facebook');

    const searchBlender = filterAndSortHistory(mockHistory, { searchQuery: 'blender' });
    expect(searchBlender.length).toBe(1);
    expect(searchBlender[0].id).toBe('sess-3');

    const searchTask = filterAndSortHistory(mockHistory, { searchQuery: 'abstract' });
    expect(searchTask.length).toBe(1);
    expect(searchTask[0].id).toBe('sess-1');
  });

  it('computes daily activity points for charts', () => {
    const activity = getDailyActivity(mockHistory, 7);
    expect(activity.length).toBe(7);
    expect(activity[0].dateLabel).toBeDefined();
    expect(activity[0].plannedMinutes).toBeDefined();
    expect(activity[0].actualMinutes).toBeDefined();
  });

  it('computes site usage summary for guarded sites (today, weekly, allTime, session count)', () => {
    const now = Date.now();
    const testHistory: FocusSession[] = [
      {
        ...mockHistory[0],
        id: 'sess-today-yt',
        site: 'youtube',
        startTime: now - 30 * 60 * 1000, // 30m ago (today)
        actualDurationMs: 25 * 60 * 1000,
      },
      {
        ...mockHistory[1],
        id: 'sess-recent-fb',
        site: 'facebook',
        startTime: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago (weekly)
        actualDurationMs: 15 * 60 * 1000,
      },
      {
        ...mockHistory[2],
        id: 'sess-custom-site',
        site: 'reddit.com',
        startTime: now - 10 * 60 * 1000, // 10m ago (today)
        actualDurationMs: 20 * 60 * 1000,
      },
      {
        ...mockHistory[2],
        id: 'sess-old-fb',
        site: 'facebook',
        startTime: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago (allTime only)
        actualDurationMs: 40 * 60 * 1000,
      },
    ];

    const guardedSites: GuardedSite[] = [
      { id: 'facebook', domain: 'facebook.com', name: 'Facebook', enabled: true, addedAt: 1 },
      { id: 'youtube', domain: 'youtube.com', name: 'YouTube', enabled: true, addedAt: 1 },
      { id: 'reddit', domain: 'reddit.com', name: 'Reddit', enabled: true, addedAt: 1 },
      { id: 'twitter', domain: 'twitter.com', name: 'Twitter', enabled: false, addedAt: 1 },
    ];

    const summaries = getSiteUsageSummary(testHistory, guardedSites);

    expect(summaries.length).toBe(4);

    // Facebook: 1 weekly (15m) + 1 old (40m) = 55m allTime, 0m today
    const fbSummary = summaries.find((s) => s.siteId === 'facebook')!;
    expect(fbSummary.todayMinutes).toBe(0);
    expect(fbSummary.weeklyMinutes).toBe(15);
    expect(fbSummary.allTimeMinutes).toBe(55);
    expect(fbSummary.sessionCount).toBe(2);

    // YouTube: 1 today (25m) = 25m today, weekly, allTime
    const ytSummary = summaries.find((s) => s.siteId === 'youtube')!;
    expect(ytSummary.todayMinutes).toBe(25);
    expect(ytSummary.weeklyMinutes).toBe(25);
    expect(ytSummary.allTimeMinutes).toBe(25);
    expect(ytSummary.sessionCount).toBe(1);

    // Reddit (custom site): 1 today (20m)
    const redditSummary = summaries.find((s) => s.siteId === 'reddit')!;
    expect(redditSummary.todayMinutes).toBe(20);
    expect(redditSummary.weeklyMinutes).toBe(20);
    expect(redditSummary.allTimeMinutes).toBe(20);
    expect(redditSummary.sessionCount).toBe(1);

    // Twitter: 0 sessions
    const twitterSummary = summaries.find((s) => s.siteId === 'twitter')!;
    expect(twitterSummary.todayMinutes).toBe(0);
    expect(twitterSummary.weeklyMinutes).toBe(0);
    expect(twitterSummary.allTimeMinutes).toBe(0);
    expect(twitterSummary.sessionCount).toBe(0);
  });

  it('computes 24-hour hourly activity array for minutes and sessions', () => {
    // Create sessions at specific hours
    const today = new Date();
    today.setHours(9, 15, 0, 0); // 09:15
    const time9am = today.getTime();

    today.setHours(14, 30, 0, 0); // 14:30
    const time2pm = today.getTime();

    const hourlyHistory: FocusSession[] = [
      {
        ...mockHistory[0],
        startTime: time9am,
        actualDurationMs: 30 * 60 * 1000, // 30 mins
      },
      {
        ...mockHistory[1],
        startTime: time9am,
        actualDurationMs: 15 * 60 * 1000, // 15 mins
      },
      {
        ...mockHistory[2],
        startTime: time2pm,
        actualDurationMs: 45 * 60 * 1000, // 45 mins
      },
    ];

    const hourlyMinutes = calculateHourlyActivity(hourlyHistory, 'minutes');
    expect(hourlyMinutes.length).toBe(24);
    expect(hourlyMinutes[9]).toBe(45); // 30 + 15 = 45m
    expect(hourlyMinutes[14]).toBe(45); // 45m
    expect(hourlyMinutes[0]).toBe(0);

    const hourlySessions = calculateHourlyActivity(hourlyHistory, 'sessions');
    expect(hourlySessions.length).toBe(24);
    expect(hourlySessions[9]).toBe(2); // 2 sessions
    expect(hourlySessions[14]).toBe(1); // 1 session
    expect(hourlySessions[0]).toBe(0);
  });

  it('computes today usage overview including guarded vs regular minutes and budget progress', () => {
    const now = Date.now();
    const today = new Date();
    today.setHours(10, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(11, 0, 0, 0);

    const testHistory: FocusSession[] = [
      {
        id: 'sess-today-1',
        site: 'youtube',
        purpose: 'Work on thesis',
        tasks: [{ id: 't1', text: 'Section 1', completed: true }],
        startTime: today.getTime(),
        endTime: today.getTime() + 40 * 60 * 1000,
        allocatedDurationMs: 45 * 60 * 1000,
        deadlineTime: today.getTime() + 45 * 60 * 1000,
        status: 'completed',
        lastUpdateTime: today.getTime() + 40 * 60 * 1000,
        actualDurationMs: 40 * 60 * 1000,
        wasExpired: false,
        tasksCompletedCount: 1,
        totalTasksCount: 1,
      },
      {
        id: 'sess-yest-1',
        site: 'facebook',
        purpose: 'Answer messages',
        tasks: [{ id: 't2', text: 'Reply to client', completed: true }],
        startTime: yesterday.getTime(),
        endTime: yesterday.getTime() + 25 * 60 * 1000,
        allocatedDurationMs: 30 * 60 * 1000,
        deadlineTime: yesterday.getTime() + 30 * 60 * 1000,
        status: 'completed',
        lastUpdateTime: yesterday.getTime() + 25 * 60 * 1000,
        actualDurationMs: 25 * 60 * 1000,
        wasExpired: false,
        tasksCompletedCount: 1,
        totalTasksCount: 1,
      },
    ];

    const activeSessions = {
      facebook: {
        id: 'sess-active-fb',
        site: 'facebook',
        purpose: 'Urgent task',
        tasks: [{ id: 't3', text: 'Download PDF', completed: false }],
        startTime: now - 20 * 60 * 1000, // 20m elapsed
        allocatedDurationMs: 30 * 60 * 1000,
        deadlineTime: now + 10 * 60 * 1000,
        status: 'active' as const,
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 1,
      },
    };

    const overview = getTodayUsageOverview(testHistory, activeSessions, 120, 150);

    // Guarded: 40m today + 20m active = 60m
    expect(overview.guardedMinutes).toBe(60);
    // Yesterday: 25m
    expect(overview.yesterdayGuardedMinutes).toBe(25);
    // Trend diff: +35m
    expect(overview.trendDiffMinutes).toBe(35);
    // Total screen time: 150m
    expect(overview.totalScreenMinutes).toBe(150);
    // Regular browsing: 150 - 60 = 90m
    expect(overview.regularMinutes).toBe(90);
    // Budget progress: 60 / 120 = 50%
    expect(overview.budgetProgressPercent).toBe(50);
    expect(overview.activeSessionsCount).toBe(1);
    expect(overview.todayCompletedCount).toBe(1);
  });
});
