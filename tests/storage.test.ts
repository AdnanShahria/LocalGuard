import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMockStorage } from './setup';
import {
  getStorageData,
  saveStorageData,
  getActiveSession,
  getAnyActiveSession,
  saveActiveSession,
  updateActiveSession,
  completeSession,
  exportDataAsJson,
  importDataFromJson,
  getSiteUsageStats,
  getTodayUsage,
  getGuardedSites,
  addGuardedSite,
  updateGuardedSite,
  deleteGuardedSite,
  toggleGuardedSite,
  exportHistoryAsCsv,
  importHistoryFromCsv,
  exportHistoryAsXml,
  importHistoryFromXml,
  generateHistoryPdfReport,
  _resetInMemoryStorage,
} from '../src/storage/storage';
import { migrateStorageSchema } from '../src/storage/migrations';
import { FocusSession, CURRENT_SCHEMA_VERSION, GuardedSite } from '../src/shared/types';

describe('Storage Layer & Session Lifecycle', () => {
  beforeEach(() => {
    resetMockStorage();
    _resetInMemoryStorage();
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
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.sessionHistory.length).toBe(1);
    expect(migrated.sessionHistory[0].tasksCompletedCount).toBe(1);
    expect(migrated.sessionHistory[0].totalTasksCount).toBe(1);
    expect(migrated.settings.defaultDurationMinutes).toBe(15);
  });

  // Scenario 21: Site usage statistics calculation
  it('Scenario 21: calculates today, weekly, and all-time usage statistics for sites', async () => {
    const now = Date.now();
    const data = await getStorageData();
    data.sessionHistory = [
      {
        id: 'sess-today-1',
        site: 'youtube',
        purpose: 'Video tutorial',
        tasks: [],
        startTime: now - 30 * 60 * 1000,
        endTime: now - 10 * 60 * 1000,
        allocatedDurationMs: 25 * 60000,
        deadlineTime: now - 5 * 60000,
        status: 'completed',
        lastUpdateTime: now - 10 * 60 * 1000,
        actualDurationMs: 20 * 60000, // 20m
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
      },
      {
        id: 'sess-week-1',
        site: 'youtube.com',
        purpose: 'Research',
        tasks: [],
        startTime: now - 3 * 86400000,
        endTime: now - 3 * 86400000 + 40 * 60000,
        allocatedDurationMs: 45 * 60000,
        deadlineTime: now - 3 * 86400000 + 45 * 60000,
        status: 'completed',
        lastUpdateTime: now - 3 * 86400000 + 40 * 60000,
        actualDurationMs: 40 * 60000, // 40m
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
      },
      {
        id: 'sess-old-1',
        site: 'youtube',
        purpose: 'Old lecture',
        tasks: [],
        startTime: now - 15 * 86400000,
        endTime: now - 15 * 86400000 + 60 * 60000,
        allocatedDurationMs: 60 * 60000,
        deadlineTime: now - 15 * 86400000 + 60 * 60000,
        status: 'completed',
        lastUpdateTime: now - 15 * 86400000 + 60 * 60000,
        actualDurationMs: 60 * 60000, // 60m
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
      },
    ];
    await saveStorageData(data);

    const stats = await getSiteUsageStats('youtube.com');
    expect(stats.todayMinutes).toBe(20);
    expect(stats.weeklyMinutes).toBe(60); // 20 + 40
    expect(stats.allTimeMinutes).toBe(120); // 20 + 40 + 60
  });

  // Scenario 22: Guarded site management (CRUD)
  it('Scenario 22: supports adding, toggling, updating, and deleting guarded sites', async () => {
    const initialSites = await getGuardedSites();
    expect(initialSites.length).toBeGreaterThanOrEqual(2);

    const newSite: GuardedSite = {
      id: 'reddit',
      domain: 'reddit.com',
      name: 'Reddit',
      enabled: true,
      addedAt: Date.now(),
      customColor: '#FF4500',
    };

    await addGuardedSite(newSite);
    let sites = await getGuardedSites();
    expect(sites.some((s) => s.id === 'reddit')).toBe(true);

    await toggleGuardedSite('reddit', false);
    sites = await getGuardedSites();
    expect(sites.find((s) => s.id === 'reddit')?.enabled).toBe(false);

    await updateGuardedSite({
      ...newSite,
      name: 'Reddit Discussions',
    });
    sites = await getGuardedSites();
    expect(sites.find((s) => s.id === 'reddit')?.name).toBe('Reddit Discussions');

    await deleteGuardedSite('reddit');
    sites = await getGuardedSites();
    expect(sites.some((s) => s.id === 'reddit')).toBe(false);
  });

  // Scenario 23: Dynamic site active session management
  it('Scenario 23: manages active sessions on custom arbitrary domains', async () => {
    const customSession: FocusSession = {
      id: 'custom-sess-1',
      site: 'github.com',
      purpose: 'Review PR #42',
      tasks: [{ id: 't1', text: 'Check diff', completed: false }],
      startTime: Date.now(),
      allocatedDurationMs: 20 * 60000,
      deadlineTime: Date.now() + 20 * 60000,
      status: 'active',
      lastUpdateTime: Date.now(),
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: 1,
    };

    await saveActiveSession(customSession);
    const active = await getActiveSession('github.com');
    expect(active?.id).toBe('custom-sess-1');

    const anyActive = await getAnyActiveSession();
    expect(anyActive?.site).toBe('github.com');
    expect(anyActive?.session.id).toBe('custom-sess-1');

    await completeSession('github.com', 'completed');
    expect(await getActiveSession('github.com')).toBeNull();

    const data = await getStorageData();
    expect(data.sessionHistory.some((s) => s.id === 'custom-sess-1')).toBe(true);
  });

  // Scenario 24: CSV Export and Import
  it('Scenario 24: exports and imports session history via CSV', async () => {
    const data = await getStorageData();
    data.sessionHistory = [
      {
        id: 'csv-test-session',
        site: 'youtube',
        purpose: 'Learn "Vite" Bundling, & Vitest',
        tasks: [
          { id: 't1', text: 'Read docs', completed: true },
          { id: 't2', text: 'Write config', completed: false },
        ],
        startTime: 1700000000000,
        allocatedDurationMs: 30 * 60000,
        deadlineTime: 1700001800000,
        status: 'completed',
        lastUpdateTime: 1700001500000,
        actualDurationMs: 25 * 60000,
        wasExpired: false,
        tasksCompletedCount: 1,
        totalTasksCount: 2,
      },
    ];
    await saveStorageData(data);

    const csvOutput = await exportHistoryAsCsv();
    expect(csvOutput).toContain('csv-test-session');
    expect(csvOutput).toContain('Learn ""Vite"" Bundling, & Vitest');

    // Reset storage and import from CSV
    resetMockStorage();
    _resetInMemoryStorage();
    const importRes = await importHistoryFromCsv(csvOutput);
    expect(importRes.success).toBe(true);
    expect(importRes.count).toBe(1);

    const restored = await getStorageData();
    expect(restored.sessionHistory.length).toBe(1);
    expect(restored.sessionHistory[0].id).toBe('csv-test-session');
    expect(restored.sessionHistory[0].tasks.length).toBe(2);
    expect(restored.sessionHistory[0].tasks[0].completed).toBe(true);
  });

  // Scenario 25: XML Export and Import
  it('Scenario 25: exports and imports session history via XML', async () => {
    const data = await getStorageData();
    data.sessionHistory = [
      {
        id: 'xml-test-session',
        site: 'facebook',
        purpose: 'Catch up & review <group> posts',
        tasks: [{ id: 't1', text: 'Post updates', completed: true }],
        startTime: 1700000000000,
        allocatedDurationMs: 15 * 60000,
        deadlineTime: 1700000900000,
        status: 'completed',
        lastUpdateTime: 1700000600000,
        actualDurationMs: 10 * 60000,
        wasExpired: false,
        tasksCompletedCount: 1,
        totalTasksCount: 1,
      },
    ];
    await saveStorageData(data);

    const xmlOutput = await exportHistoryAsXml();
    expect(xmlOutput).toContain('<id>xml-test-session</id>');
    expect(xmlOutput).toContain('&lt;group&gt;');

    // Reset and import from XML
    resetMockStorage();
    _resetInMemoryStorage();
    const importRes = await importHistoryFromXml(xmlOutput);
    expect(importRes.success).toBe(true);
    expect(importRes.count).toBe(1);

    const restored = await getStorageData();
    expect(restored.sessionHistory.length).toBe(1);
    expect(restored.sessionHistory[0].id).toBe('xml-test-session');
    expect(restored.sessionHistory[0].purpose).toBe('Catch up & review <group> posts');
  });

  // Scenario 26: Printable PDF report generation
  it('Scenario 26: generates printable HTML report with complete metrics and layout', async () => {
    const session: FocusSession = {
      id: 'pdf-sess-1',
      site: 'youtube',
      purpose: 'Distributed consensus video',
      tasks: [{ id: 't1', text: 'Take notes', completed: true }],
      startTime: Date.now(),
      allocatedDurationMs: 25 * 60000,
      deadlineTime: Date.now() + 25 * 60000,
      status: 'completed',
      lastUpdateTime: Date.now(),
      actualDurationMs: 20 * 60000,
      wasExpired: false,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    };

    const htmlReport = generateHistoryPdfReport([session]);
    expect(htmlReport).toContain('LocalGuard — Audit Report');
    expect(htmlReport).toContain('Distributed consensus video');
    expect(htmlReport).toContain('Take notes');
    expect(htmlReport).toContain('window.print()');
  });

  // Scenario 27: Schema v1 to v2 migration
  it('Scenario 27: migrates schema from version 1 to 2 injecting guardedSites and themes', () => {
    const v1Data = {
      schemaVersion: 1,
      activeSessions: {
        facebook: null,
        youtube: null,
      },
      sessionHistory: [
        {
          id: 'v1-sess',
          site: 'youtube',
          purpose: 'V1 session',
          tasks: [],
          startTime: 1000,
          allocatedDurationMs: 15 * 60000,
          deadlineTime: 16 * 60000,
          status: 'completed',
          lastUpdateTime: 15 * 60000,
          actualDurationMs: 14 * 60000,
          wasExpired: false,
          tasksCompletedCount: 0,
          totalTasksCount: 0,
        },
      ],
      canceledPromptCount: 1,
      settings: {
        defaultDurationMinutes: 15,
        durationPresets: [5, 10, 15, 25, 30, 45, 60],
        minDurationMinutes: 1,
        maxDurationMinutes: 180,
        soundNotifications: true,
        soundVolume: 0.6,
        warningThresholdMinutes: 5,
        autoEndConfirmation: true,
        reducedMotion: 'system' as const,
        hudPosition: { right: 20, bottom: 20 },
        timerAppearance: 'default' as const,
      },
    };

    const migrated = migrateStorageSchema(v1Data);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.settings.guardedSites).toBeDefined();
    expect(migrated.settings.guardedSites.length).toBeGreaterThanOrEqual(2);
    expect(migrated.settings.themePreference).toBe('light');
    expect(migrated.settings.hudBorderColor).toBe('#007AFF');
    expect(migrated.settings.hudDimensions).toEqual({ width: 380, height: 400 });
    expect(migrated.sessionHistory.length).toBe(1);
    expect(migrated.sessionHistory[0].id).toBe('v1-sess');
  });

  it('retrieves comprehensive today usage overview from storage including budget and active sessions', async () => {
    const now = Date.now();
    const session: FocusSession = {
      id: 'active-today-1',
      site: 'youtube',
      purpose: 'Write system docs',
      tasks: [{ id: 't1', text: 'Section A', completed: true }],
      startTime: now - 30 * 60 * 1000,
      allocatedDurationMs: 45 * 60 * 1000,
      deadlineTime: now + 15 * 60 * 1000,
      status: 'active',
      lastUpdateTime: now,
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    };

    await saveActiveSession(session);
    const todayOverview = await getTodayUsage(100);

    expect(todayOverview.guardedMinutes).toBeGreaterThanOrEqual(29);
    expect(todayOverview.totalScreenMinutes).toBe(100);
    expect(todayOverview.regularMinutes).toBeLessThanOrEqual(71);
    expect(todayOverview.budgetMinutes).toBe(120);
    expect(todayOverview.activeSessionsCount).toBe(1);
  });
});
