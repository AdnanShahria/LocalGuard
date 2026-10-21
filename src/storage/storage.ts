import {
  StorageSchema,
  FocusSession,
  SiteId,
  UserSettings,
  INITIAL_STORAGE_SCHEMA,
} from '../shared/types';
import { migrateStorageSchema } from './migrations';

const STORAGE_KEY = 'lifesolver_focus_guard_data';

// In-memory fallback for non-extension environments (Node, tests, dev)
let inMemoryStorage: StorageSchema = JSON.parse(JSON.stringify(INITIAL_STORAGE_SCHEMA));

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

/**
 * Low-level read helper with defensive error handling and migration.
 */
export async function getStorageData(): Promise<StorageSchema> {
  try {
    if (hasChromeStorage()) {
      return new Promise<StorageSchema>((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (chrome.runtime?.lastError) {
            console.error('Storage read error:', chrome.runtime.lastError);
            resolve(migrateStorageSchema(inMemoryStorage));
            return;
          }
          const raw = result ? result[STORAGE_KEY] : null;
          resolve(migrateStorageSchema(raw));
        });
      });
    } else {
      return migrateStorageSchema(inMemoryStorage);
    }
  } catch (err) {
    console.error('Failed to retrieve storage data:', err);
    return migrateStorageSchema(inMemoryStorage);
  }
}

/**
 * Low-level save helper.
 */
export async function saveStorageData(data: StorageSchema): Promise<void> {
  try {
    inMemoryStorage = JSON.parse(JSON.stringify(data));
    if (hasChromeStorage()) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
          if (chrome.runtime?.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  } catch (err) {
    console.error('Failed to persist storage data:', err);
    throw err;
  }
}

/**
 * Retrieve active session for a specific site ('facebook' | 'youtube').
 */
export async function getActiveSession(site: SiteId): Promise<FocusSession | null> {
  const data = await getStorageData();
  const session = data.activeSessions[site];
  if (!session) return null;
  // If session is already completed or abandoned, return null
  if (session.status === 'completed' || session.status === 'abandoned' || session.status === 'cancelled') {
    return null;
  }
  return session;
}

/**
 * Retrieve any active session across all supported sites.
 */
export async function getAnyActiveSession(): Promise<{ site: SiteId; session: FocusSession } | null> {
  const data = await getStorageData();
  if (data.activeSessions.youtube && isSessionActive(data.activeSessions.youtube)) {
    return { site: 'youtube', session: data.activeSessions.youtube };
  }
  if (data.activeSessions.facebook && isSessionActive(data.activeSessions.facebook)) {
    return { site: 'facebook', session: data.activeSessions.facebook };
  }
  return null;
}

function isSessionActive(s: FocusSession): boolean {
  return s.status === 'active' || s.status === 'paused' || s.status === 'expired';
}

/**
 * Save or update active session for a site.
 */
export async function saveActiveSession(session: FocusSession): Promise<void> {
  const data = await getStorageData();
  data.activeSessions[session.site] = session;
  await saveStorageData(data);
}

/**
 * Update an existing active session (e.g. task checkboxes or duration updates).
 */
export async function updateActiveSession(session: FocusSession): Promise<void> {
  const data = await getStorageData();
  data.activeSessions[session.site] = {
    ...session,
    lastUpdateTime: Date.now(),
  };
  await saveStorageData(data);
}

/**
 * Clear the active session for a site.
 */
export async function clearActiveSession(site: SiteId): Promise<void> {
  const data = await getStorageData();
  data.activeSessions[site] = null;
  await saveStorageData(data);
}

/**
 * Finalize an active session and move it to session history.
 */
export async function completeSession(
  site: SiteId,
  outcome: 'completed' | 'abandoned'
): Promise<FocusSession | null> {
  const data = await getStorageData();
  const active = data.activeSessions[site];
  if (!active) return null;

  const now = Date.now();
  const completedTasks = active.tasks.filter((t) => t.completed).length;
  const actualDurationMs = Math.max(0, now - active.startTime);

  const finalizedSession: FocusSession = {
    ...active,
    status: outcome,
    endTime: now,
    actualDurationMs,
    lastUpdateTime: now,
    tasksCompletedCount: completedTasks,
    totalTasksCount: active.tasks.length,
    wasExpired: active.wasExpired || now >= active.deadlineTime,
  };

  data.activeSessions[site] = null;
  data.sessionHistory.unshift(finalizedSession);
  await saveStorageData(data);

  return finalizedSession;
}

/**
 * Record a canceled prompt.
 */
export async function recordCanceledPrompt(): Promise<void> {
  const data = await getStorageData();
  data.canceledPromptCount = (data.canceledPromptCount || 0) + 1;
  await saveStorageData(data);
}

/**
 * Retrieve user settings.
 */
export async function getSettings(): Promise<UserSettings> {
  const data = await getStorageData();
  return data.settings;
}

/**
 * Update user settings.
 */
export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const data = await getStorageData();
  data.settings = {
    ...data.settings,
    ...partial,
  };
  await saveStorageData(data);
  return data.settings;
}

/**
 * Retrieve session history.
 */
export async function getHistory(): Promise<FocusSession[]> {
  const data = await getStorageData();
  return data.sessionHistory;
}

/**
 * Clear all session history while preserving settings and active sessions.
 */
export async function clearHistory(): Promise<void> {
  const data = await getStorageData();
  data.sessionHistory = [];
  await saveStorageData(data);
}

/**
 * Reset statistics (history + canceled prompt counts).
 */
export async function resetStatistics(): Promise<void> {
  const data = await getStorageData();
  data.sessionHistory = [];
  data.canceledPromptCount = 0;
  await saveStorageData(data);
}

/**
 * Export complete dataset as JSON string.
 */
export async function exportDataAsJson(): Promise<string> {
  const data = await getStorageData();
  return JSON.stringify(data, null, 2);
}

/**
 * Import and validate JSON backup.
 */
export async function importDataFromJson(
  jsonStr: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid JSON: root must be an object' };
    }

    if (!Array.isArray(parsed.sessionHistory) && !parsed.settings) {
      return { success: false, error: 'Invalid schema: missing sessionHistory or settings' };
    }

    const validated = migrateStorageSchema(parsed);
    await saveStorageData(validated);
    return {
      success: true,
      count: validated.sessionHistory.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'JSON parse error',
    };
  }
}

/**
 * Export session history as a CSV string.
 */
export async function exportHistoryAsCsv(): Promise<string> {
  const data = await getStorageData();
  const headers = [
    'ID',
    'Date',
    'Site',
    'Status',
    'Purpose',
    'Planned Duration (min)',
    'Actual Duration (min)',
    'Tasks Completed',
    'Total Tasks',
    'Was Expired',
    'Tasks List',
  ];

  const rows = data.sessionHistory.map((s) => {
    const dateStr = new Date(s.startTime).toISOString();
    const plannedMin = Math.round(s.allocatedDurationMs / 60000);
    const actualMin = (s.actualDurationMs / 60000).toFixed(1);
    const tasksDetail = s.tasks.map((t) => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('; ');

    return [
      `"${s.id}"`,
      `"${dateStr}"`,
      `"${s.site}"`,
      `"${s.status}"`,
      `"${s.purpose.replace(/"/g, '""')}"`,
      plannedMin,
      actualMin,
      s.tasksCompletedCount,
      s.totalTasksCount,
      s.wasExpired ? 'Yes' : 'No',
      `"${tasksDetail.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Storage listener for cross-tab or component updates.
 */
export function onStorageChanged(callback: (schema: StorageSchema) => void): () => void {
  if (hasChromeStorage()) {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        callback(migrateStorageSchema(changes[STORAGE_KEY].newValue));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  return () => {};
}
