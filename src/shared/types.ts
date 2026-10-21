/**
 * LifeSolver Focus Guard - Typed Data Models
 */

export type SiteId = string;

export interface GuardedSite {
  id: string;
  domain: string; // e.g. "facebook.com", "youtube.com", "reddit.com"
  name: string;   // e.g. "Facebook", "YouTube", "Reddit"
  enabled: boolean;
  addedAt: number;
  iconUrl?: string;
  customColor?: string;
}

export interface SiteUsageStats {
  todayMinutes: number;
  weeklyMinutes: number;
  allTimeMinutes: number;
  todayMs: number;
  weekMs: number;
  allTimeMs: number;
  todayFormatted: string;
  weekFormatted: string;
  allTimeFormatted: string;
}

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
  mode?: 'focus' | 'regular';
  tabId?: number;
}

export interface AwayState {
  isAway: boolean;
  reason: string;
  originTabId?: number;
  originSiteId: string;
  originSiteDomain: string;
  originSiteName: string;
  originUrl?: string;
  departedAt: number;
  allocatedDurationMs: number;
  deadlineTime: number;
  warnedOneMinuteLeft?: boolean;
  destinationTabId?: number;
}

export interface LockoutState {
  isLocked: boolean;
  reason: 'timer_expired' | 'user_stopped' | 'limit_reached' | 'manual';
  siteId: string;
  siteDomain: string;
  timestamp: number;
  session?: FocusSession | null;
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
  hudDimensions: {
    width: number;
    height: number;
  };
  timerAppearance: 'default' | 'minimal' | 'bold';
  themePreference: 'light' | 'dark' | 'system';
  hudThemeAdaptation: 'auto' | 'light' | 'dark';
  hudBorderColor: string; // e.g. '#007AFF'
  guardedSites: GuardedSite[];
  defaultMode: 'focus' | 'regular';
  dailyUsageBudgetMinutes: number;
}

export interface StorageSchema {
  schemaVersion: number;
  activeSessions: Record<string, FocusSession | null>;
  sessionHistory: FocusSession[];
  canceledPromptCount: number;
  settings: UserSettings;
  awayState: AwayState | null;
  lockoutStates: Record<string, LockoutState | null>;
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

export const CURRENT_SCHEMA_VERSION = 2;

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
  hudDimensions: {
    width: 380,
    height: 400,
  },
  timerAppearance: 'default',
  themePreference: 'light',
  hudThemeAdaptation: 'auto',
  hudBorderColor: '#007AFF',
  defaultMode: 'focus',
  dailyUsageBudgetMinutes: 120,
  guardedSites: [
    {
      id: 'facebook',
      domain: 'facebook.com',
      name: 'Facebook',
      enabled: true,
      addedAt: 1700000000000,
      customColor: '#1877F2',
    },
    {
      id: 'youtube',
      domain: 'youtube.com',
      name: 'YouTube',
      enabled: true,
      addedAt: 1700000000000,
      customColor: '#FF0000',
    },
  ],
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
  awayState: null,
  lockoutStates: {},
};
