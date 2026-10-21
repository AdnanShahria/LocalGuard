import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMockStorage } from './setup';
import {
  getStorageData,
  saveStorageData,
  getActiveSession,
  saveActiveSession,
  updateActiveSession,
  completeSession,
  exportDataAsJson,
  importDataFromJson,
} from '../src/storage/storage';
import { migrateStorageSchema } from '../src/storage/migrations';
import { FocusSession } from '../src/shared/types';

describe('Storage Layer & Session Lifecycle', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  // Scenario 4: Starting a session with valid data
  it('Scenario 4: starts and saves a session with valid data to local storage', async () => {
    const session: FocusSession = {
      id: 'session-101',
      site: 'youtube',
      purpose: 'Study distributed algorithms',
      tasks: [
        { id: 't1', text: 'Watch Raft consensus lecture', completed: false },
        { id: 't2', text: 'Summarize election timeout rules', completed: false },
      ],
      startTime: 1000000,
      allocatedDurationMs: 25 * 60 * 1000,
      deadlineTime: 1000000 + 25 * 60 * 1000,
      status: 'active',
      lastUpdateTime: 1000000,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 2,
    };

    await saveActiveSession(session);
    const retrieved = await getActiveSession('youtube');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('session-101');
    expect(retrieved?.purpose).toBe('Study distributed algorithms');
    expect(retrieved?.tasks.length).toBe(2);
  });

  // Scenario 5: Adding and completing tasks
  it('Scenario 5: updates task completion status accurately', async () => {
    const session: FocusSession = {
      id: 'session-102',
      site: 'facebook',
      purpose: 'Reply to study group message',
      tasks: [
        { id: 't1', text: 'Find group thread', completed: false },
        { id: 't2', text: 'Post project link', completed: false },
      ],
      startTime: 2000000,
      allocatedDurationMs: 10 * 60 * 1000,
      deadlineTime: 2000000 + 10 * 60 * 1000,
      status: 'active',
      lastUpdateTime: 2000000,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 2,
    };

    await saveActiveSession(session);

    // Complete task 1
    session.tasks[0].completed = true;
    session.tasks[0].completedAt = 2005000;
    session.tasksCompletedCount = 1;
    await updateActiveSession(session);

    const updated = await getActiveSession('facebook');
    expect(updated?.tasks[0].completed).toBe(true);
    expect(updated?.tasks[1].completed).toBe(false);
    expect(updated?.tasksCompletedCount).toBe(1);
  });

  // Scenario 10: Page refresh during an active session
  it('Scenario 10: restores active session after simulated page refresh', async () => {
    const session: FocusSession = {
      id: 'session-refresh-test',
      site: 'youtube',
      purpose: 'Learn React 19 compiler',
      tasks: [{ id: 't1', text: 'Watch demo', completed: true }],
      startTime: Date.now(),
      allocatedDurationMs: 15 * 60 * 1000,
      deadlineTime: Date.now() + 15 * 60 * 1000,
      status: 'active',
      lastUpdateTime: Date.now(),
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    };

    await saveActiveSession(session);

    // Simulate new tab / refresh reading storage fresh
    const restored = await getActiveSession('youtube');
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe('session-refresh-test');
    expect(restored?.status).toBe('active');
  });

  // Scenario 12: Switching between supported sites
  it('Scenario 12: maintains isolated active session states when switching between Facebook and YouTube', async () => {
    const ytSession: FocusSession = {
      id: 'yt-session',
      site: 'youtube',
      purpose: 'System design video',
      tasks: [{ id: 't1', text: 'Note key metrics', completed: false }],
      startTime: 1000,
      allocatedDurationMs: 30 * 60 * 1000,
      deadlineTime: 1000 + 30 * 60 * 1000,
      status: 'active',
      lastUpdateTime: 1000,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 1,
    };

    const fbSession: FocusSession = {
      id: 'fb-session',
      site: 'facebook',
      purpose: 'Message classmate',
      tasks: [{ id: 't2', text: 'Confirm meeting time', completed: false }],
      startTime: 2000,
      allocatedDurationMs: 5 * 60 * 1000,
      deadlineTime: 2000 + 5 * 60 * 1000,
      status: 'active',
      lastUpdateTime: 2000,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 1,
    };

    await saveActiveSession(ytSession);
    await saveActiveSession(fbSession);

    const ytRetrieved = await getActiveSession('youtube');
    const fbRetrieved = await getActiveSession('facebook');

    expect(ytRetrieved?.id).toBe('yt-session');
    expect(fbRetrieved?.id).toBe('fb-session');

    // Completing Facebook does not clear YouTube
    await completeSession('facebook', 'completed');
    expect(await getActiveSession('facebook')).toBeNull();
    expect(await getActiveSession('youtube')).not.toBeNull();
  });

  // Scenario 14: Ending and abandoning sessions
  it('Scenario 14: finalizes completed and abandoned sessions into history', async () => {
    const session: FocusSession = {
      id: 'session-abandon-test',
      site: 'youtube',
      purpose: 'Music production tutorial',
      tasks: [{ id: 't1', text: 'Drum programming', completed: false }],
      startTime: Date.now() - 60000,
      allocatedDurationMs: 15 * 60 * 1000,
      deadlineTime: Date.now() + 14 * 60 * 1000,
      status: 'active',
      lastUpdateTime: Date.now(),
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 1,
    };

    await saveActiveSession(session);
    const finalized = await completeSession('youtube', 'abandoned');

    expect(finalized?.status).toBe('abandoned');
    expect(finalized?.endTime).toBeDefined();

    // Verify removed from active and added to history
    expect(await getActiveSession('youtube')).toBeNull();
    const data = await getStorageData();
    expect(data.sessionHistory.length).toBe(1);
    expect(data.sessionHistory[0].id).toBe('session-abandon-test');
    expect(data.sessionHistory[0].status).toBe('abandoned');
  });

  // Scenario 16: JSON export and import
  it('Scenario 16: exports and imports valid JSON data', async () => {
    const session: FocusSession = {
      id: 'backup-session',
      site: 'youtube',
      purpose: 'Testing backup',
      tasks: [],
      startTime: 5000,
      allocatedDurationMs: 600000,
      deadlineTime: 605000,
      status: 'completed',
      lastUpdateTime: 605000,
      actualDurationMs: 600000,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 0,
    };

    const data = await getStorageData();
    data.sessionHistory.push(session);
    await saveStorageData(data);

    const jsonExport = await exportDataAsJson();
    expect(jsonExport).toContain('backup-session');

    // Clear and restore
    resetMockStorage();
    const importRes = await importDataFromJson(jsonExport);

    expect(importRes.success).toBe(true);
    expect(importRes.count).toBe(1);

    const restoredData = await getStorageData();
    expect(restoredData.sessionHistory[0].id).toBe('backup-session');
  });

  // Scenario 17: Invalid import handling
  it('Scenario 17: rejects invalid JSON import without corrupting existing records', async () => {
    const badJson = '{ invalid: json ]';
    const badRes = await importDataFromJson(badJson);
    expect(badRes.success).toBe(false);
    expect(badRes.error).toBeDefined();

    const emptyObjRes = await importDataFromJson('{"unrelated": 123}');
    expect(emptyObjRes.success).toBe(false);
  });

  // Scenario 18: Storage failures
  it('Scenario 18: handles storage failure gracefully with fallback', async () => {
    // Simulate chrome.runtime.lastError during get
    const originalGet = (chrome.storage.local.get as any);
    (chrome.storage.local.get as any) = vi.fn((_keys: string[], callback: any) => {
      (chrome.runtime as any).lastError = { message: 'Storage quota exceeded' };
      callback(null);
      (chrome.runtime as any).lastError = null;
    });

    const data = await getStorageData();
    expect(data).toBeDefined();
    expect(data.settings).toBeDefined();

    // Restore
    chrome.storage.local.get = originalGet;
  });

  // Scenario 19: Restoration after browser or extension worker restart
  it('Scenario 19: restores session state after simulated worker termination', async () => {
    const session: FocusSession = {
      id: 'worker-restart-session',
      site: 'facebook',
      purpose: 'Review conference group',
      tasks: [{ id: 't1', text: 'Check agenda', completed: true }],
      startTime: 10000,
      allocatedDurationMs: 15 * 60 * 1000,
      deadlineTime: 10000 + 15 * 60 * 1000,
      status: 'active',
      lastUpdateTime: 10000,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    };

    await saveActiveSession(session);

    // Simulated worker wake-up: read directly from storage fresh
    const active = await getActiveSession('facebook');
    expect(active?.id).toBe('worker-restart-session');
    expect(active?.tasks[0].completed).toBe(true);
  });

  // Scenario 20: Migration from an older storage schema
  it('Scenario 20: migrates v0 legacy schema safely to current schema', () => {
    const legacyData = {
      activeSessions: {
        facebook: null,
      },
      sessionHistory: [
        {
          id: 'v0-sess-1',
          site: 'youtube',
          purpose: 'Old session with missing task counts',
          tasks: [{ id: 't1', text: 'Task 1', completed: true }],
          startTime: 1000,
          allocatedDurationMs: 60000,
          deadlineTime: 61000,
          status: 'completed',
        },
      ],
      // No schemaVersion field
    };

    const migrated = migrateStorageSchema(legacyData);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.sessionHistory.length).toBe(1);
    expect(migrated.sessionHistory[0].tasksCompletedCount).toBe(1);
    expect(migrated.sessionHistory[0].totalTasksCount).toBe(1);
    expect(migrated.settings.defaultDurationMinutes).toBe(15);
  });
});
