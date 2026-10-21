import { StorageSchema, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, INITIAL_STORAGE_SCHEMA } from '../shared/types';

/**
 * Migration pipeline for local storage schemas.
 * Safely transforms older data representations into the latest version.
 */
export function migrateStorageSchema(raw: unknown): StorageSchema {
  if (!raw || typeof raw !== 'object') {
    return { ...INITIAL_STORAGE_SCHEMA };
  }

  const data = raw as Partial<StorageSchema>;
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  let currentData: StorageSchema = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeSessions: {
      facebook: data.activeSessions?.facebook || null,
      youtube: data.activeSessions?.youtube || null,
    },
    sessionHistory: Array.isArray(data.sessionHistory) ? data.sessionHistory : [],
    canceledPromptCount: typeof data.canceledPromptCount === 'number' ? data.canceledPromptCount : 0,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
    },
  };

  // Run sequential migrations if version < target
  if (version < 1) {
    // Migration from v0 (or unversioned) to v1
    // Ensure all history sessions have required fields
    currentData.sessionHistory = currentData.sessionHistory.map((s) => ({
      ...s,
      tasksCompletedCount: s.tasksCompletedCount ?? (s.tasks?.filter((t) => t.completed).length || 0),
      totalTasksCount: s.totalTasksCount ?? (s.tasks?.length || 0),
      actualDurationMs: s.actualDurationMs ?? (s.endTime && s.startTime ? s.endTime - s.startTime : s.allocatedDurationMs),
      wasExpired: s.wasExpired ?? false,
    }));
  }

  currentData.schemaVersion = CURRENT_SCHEMA_VERSION;
  return currentData;
}
