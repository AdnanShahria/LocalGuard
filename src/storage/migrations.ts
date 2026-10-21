import {
  StorageSchema,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  INITIAL_STORAGE_SCHEMA,
  FocusSession,
  UserSettings,
} from '../shared/types';

/**
 * Migration pipeline for local storage schemas.
 * Safely transforms older data representations into the latest version (v2).
 */
export function migrateStorageSchema(raw: unknown): StorageSchema {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(INITIAL_STORAGE_SCHEMA));
  }

  const data = raw as Partial<StorageSchema>;
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  // Build merged settings safely
  const rawSettings = (data.settings && typeof data.settings === 'object' ? data.settings : {}) as Partial<UserSettings>;
  const mergedSettings: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    hudPosition: {
      ...DEFAULT_SETTINGS.hudPosition,
      ...(rawSettings.hudPosition || {}),
    },
    hudDimensions: {
      width: Math.max(340, rawSettings.hudDimensions?.width || DEFAULT_SETTINGS.hudDimensions.width),
      height: Math.max(400, rawSettings.hudDimensions?.height || DEFAULT_SETTINGS.hudDimensions.height),
    },
  };

  // Ensure guardedSites exists and is non-empty
  if (!Array.isArray(mergedSettings.guardedSites) || mergedSettings.guardedSites.length === 0) {
    mergedSettings.guardedSites = [...DEFAULT_SETTINGS.guardedSites];
  }

  // Ensure theme preferences exist
  if (!mergedSettings.themePreference) {
    mergedSettings.themePreference = 'light';
  }
  if (!mergedSettings.hudThemeAdaptation) {
    mergedSettings.hudThemeAdaptation = 'auto';
  }
  if (!mergedSettings.hudBorderColor) {
    mergedSettings.hudBorderColor = '#007AFF';
  }
  if (!mergedSettings.defaultMode) {
    mergedSettings.defaultMode = 'focus';
  }
  if (typeof mergedSettings.dailyUsageBudgetMinutes !== 'number') {
    mergedSettings.dailyUsageBudgetMinutes = 120;
  }

  // Construct active sessions preserving any existing keys
  const rawActive = data.activeSessions && typeof data.activeSessions === 'object'
    ? data.activeSessions
    : {};
  const activeSessions: Record<string, FocusSession | null> = {
    facebook: null,
    youtube: null,
    ...rawActive,
  };

  let currentData: StorageSchema = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeSessions: JSON.parse(JSON.stringify(activeSessions)),
    sessionHistory: Array.isArray(data.sessionHistory) ? JSON.parse(JSON.stringify(data.sessionHistory)) : [],
    canceledPromptCount: typeof data.canceledPromptCount === 'number' ? data.canceledPromptCount : 0,
    settings: mergedSettings,
    awayState: data.awayState || null,
    lockoutStates: data.lockoutStates && typeof data.lockoutStates === 'object' ? data.lockoutStates : {},
  };

  // Migration from v0 to v1
  if (version < 1) {
    currentData.sessionHistory = currentData.sessionHistory.map((s) => ({
      ...s,
      tasksCompletedCount: s.tasksCompletedCount ?? (s.tasks?.filter((t) => t.completed).length || 0),
      totalTasksCount: s.totalTasksCount ?? (s.tasks?.length || 0),
      actualDurationMs: s.actualDurationMs ?? (s.endTime && s.startTime ? s.endTime - s.startTime : s.allocatedDurationMs),
      wasExpired: s.wasExpired ?? false,
    }));
  }

  // Migration from v1 to v2
  if (version < 2) {
    // Ensure all history sessions have a valid site string, tasks array, and defaults
    currentData.sessionHistory = currentData.sessionHistory.map((s) => ({
      ...s,
      site: s.site || 'unknown',
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      tasksCompletedCount: s.tasksCompletedCount ?? (Array.isArray(s.tasks) ? s.tasks.filter((t) => t.completed).length : 0),
      totalTasksCount: s.totalTasksCount ?? (Array.isArray(s.tasks) ? s.tasks.length : 0),
    }));
  }

  currentData.schemaVersion = CURRENT_SCHEMA_VERSION;
  return currentData;
}
