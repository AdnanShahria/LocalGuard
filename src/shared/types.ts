/**
 * LifeSolver Focus Guard - Typed Data Models
 */

export type SiteId = 'facebook' | 'youtube';

export type SessionStatus =
  | 'prompting'
  | 'active'
  | 'paused'
  | 'expired'
  | 'completed'
  | 'abandoned'
  | 'cancelled';

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: number;
}

export interface FocusSession {
  id: string;
  site: SiteId;
  purpose: string;
  tasks: TaskItem[];
  startTime: number;
  allocatedDurationMs: number;
  deadlineTime: number;
  status: SessionStatus;
  lastUpdateTime: number;
  endTime?: number;
  actualDurationMs: number;
  sessionLabel?: string;
  pausedRemainingMs?: number;
  wasExpired: boolean;
  tasksCompletedCount: number;
  totalTasksCount: number;
}

export interface UserSettings {
  defaultDurationMinutes: number;
  durationPresets: number[];
  minDurationMinutes: number;
  maxDurationMinutes: number;
  soundNotifications: boolean;
  soundVolume: number;
  warningThresholdMinutes: number;
  autoEndConfirmation: boolean;
  reducedMotion: 'system' | 'always' | 'never';
  hudPosition: {
    right: number;
    bottom: number;
  };
  timerAppearance: 'default' | 'minimal' | 'bold';
}

export interface StorageSchema {
  schemaVersion: number;
  activeSessions: Partial<Record<SiteId, FocusSession | null>>;
  sessionHistory: FocusSession[];
  canceledPromptCount: number;
  settings: UserSettings;
}

export interface AggregateStatistics {
  totalSessionsStarted: number;
  totalCanceledPrompts: number;
  totalCompletedSessions: number;
  totalAbandonedSessions: number;
  totalExpiredSessions: number;
  totalFacebookSessions: number;
  totalYouTubeSessions: number;
  totalPlannedTimeMs: number;
  totalActualActiveTimeMs: number;
  averageSessionDurationMs: number;
  totalTasksCompleted: number;
  totalTasksCreated: number;
  taskCompletionRate: number; // 0 to 100 percentage
  completedWithinAllocatedTimeCount: number;
}

export interface HistoryFilterOptions {
  site?: 'all' | SiteId;
  status?: 'all' | 'completed' | 'abandoned' | 'expired';
  searchQuery?: string;
  dateRange?: 'all' | 'today' | 'week' | 'month';
  sortBy?: 'date_desc' | 'date_asc' | 'duration_desc' | 'tasks_desc';
}

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  defaultDurationMinutes: 15,
  durationPresets: [5, 10, 15, 25, 30, 45, 60],
  minDurationMinutes: 1,
  maxDurationMinutes: 180,
  soundNotifications: true,
  soundVolume: 0.6,
  warningThresholdMinutes: 5,
  autoEndConfirmation: true,
  reducedMotion: 'system',
  hudPosition: {
    right: 20,
    bottom: 20,
  },
  timerAppearance: 'default',
};

export const INITIAL_STORAGE_SCHEMA: StorageSchema = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  activeSessions: {
    facebook: null,
    youtube: null,
  },
  sessionHistory: [],
  canceledPromptCount: 0,
  settings: DEFAULT_SETTINGS,
};
