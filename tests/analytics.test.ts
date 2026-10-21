import { describe, it, expect } from 'vitest';
import { FocusSession } from '../src/shared/types';
import {
  calculateStatistics,
  filterAndSortHistory,
  getDailyActivity,
} from '../src/features/analytics/analyticsCalculations';

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
  });
});
