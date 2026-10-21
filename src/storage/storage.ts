import {
  StorageSchema,
  FocusSession,
  UserSettings,
  GuardedSite,
  SiteUsageStats,
  DEFAULT_SETTINGS,
  INITIAL_STORAGE_SCHEMA,
  AwayState,
  LockoutState,
} from '../shared/types';
import { migrateStorageSchema } from './migrations';
import {
  getTodayUsageOverview,
  type TodayUsageOverview,
} from '../features/analytics/analyticsCalculations';

export type { SiteUsageStats, TodayUsageOverview };

const STORAGE_KEY = 'lifesolver_focus_guard_data';

// In-memory fallback for non-extension environments (Node, tests, dev)
let inMemoryStorage: StorageSchema = JSON.parse(JSON.stringify(INITIAL_STORAGE_SCHEMA));

export function _resetInMemoryStorage(): void {
  inMemoryStorage = JSON.parse(JSON.stringify(INITIAL_STORAGE_SCHEMA));
}

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

function isSessionActive(s: FocusSession): boolean {
  return s.status === 'active' || s.status === 'paused' || s.status === 'expired';
}

export function formatDurationInvested(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Retrieve site-specific usage statistics (Today, Weekly, All-Time).
 */
export async function getSiteUsageStats(siteDomainOrId: string): Promise<SiteUsageStats> {
  const data = await getStorageData();
  const normalizedTarget = (siteDomainOrId || '').toLowerCase().trim();
  const strippedTarget = normalizedTarget.replace(/^www\./, '');

  const guarded = data.settings.guardedSites?.find((g) => {
    const gid = g.id.toLowerCase();
    const gdom = g.domain.toLowerCase().replace(/^www\./, '');
    return gid === normalizedTarget || gdom === strippedTarget || gid === strippedTarget;
  });

  const matchKeys = new Set<string>([normalizedTarget, strippedTarget]);
  if (guarded) {
    matchKeys.add(guarded.id.toLowerCase());
    matchKeys.add(guarded.domain.toLowerCase());
    matchKeys.add(guarded.domain.toLowerCase().replace(/^www\./, ''));
  }

  const isMatchingSite = (sessionSite: string) => {
    const s = (sessionSite || '').toLowerCase().trim();
    const strippedS = s.replace(/^www\./, '');
    return matchKeys.has(s) || matchKeys.has(strippedS);
  };

  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const sevenDaysAgo = now - 7 * 86400000;

  const siteSessions = data.sessionHistory.filter((s) => isMatchingSite(s.site));
  const todaySessions = siteSessions.filter((s) => s.startTime >= startOfDay);
  const weeklySessions = siteSessions.filter((s) => s.startTime >= sevenDaysAgo);

  const calcMs = (sessions: FocusSession[]) =>
    sessions.reduce((acc, s) => acc + (s.actualDurationMs || 0), 0);

  let todayMs = calcMs(todaySessions);
  let weekMs = calcMs(weeklySessions);
  let allTimeMs = calcMs(siteSessions);

  // If there's an active session matching this site, include its elapsed time as well
  for (const [siteKey, session] of Object.entries(data.activeSessions)) {
    if (session && isSessionActive(session) && isMatchingSite(siteKey)) {
      const elapsed = Math.max(0, now - session.startTime);
      todayMs += elapsed;
      weekMs += elapsed;
      allTimeMs += elapsed;
    }
  }

  return {
    todayMinutes: Math.round(todayMs / 60000),
    weeklyMinutes: Math.round(weekMs / 60000),
    allTimeMinutes: Math.round(allTimeMs / 60000),
    todayMs,
    weekMs,
    allTimeMs,
    todayFormatted: formatDurationInvested(todayMs),
    weekFormatted: formatDurationInvested(weekMs),
    allTimeFormatted: formatDurationInvested(allTimeMs),
  };
}

/**
 * Retrieve today's comprehensive screen time, guarded time, regular time,
 * daily budget progress, and yesterday's comparison trend.
 */
export async function getTodayUsage(browserHistoryMinutes?: number): Promise<TodayUsageOverview> {
  const data = await getStorageData();
  const budget = data.settings?.dailyUsageBudgetMinutes ?? 120;
  return getTodayUsageOverview(
    data.sessionHistory || [],
    data.activeSessions || {},
    budget,
    browserHistoryMinutes
  );
}

/**
 * Retrieve active session for a specific site or domain.
 */
export async function getActiveSession(site: string): Promise<FocusSession | null> {
  const data = await getStorageData();
  const session = data.activeSessions[site];
  if (!session) return null;
  if (session.status === 'completed' || session.status === 'abandoned' || session.status === 'cancelled') {
    return null;
  }
  return session;
}

/**
 * Retrieve any active session across all dynamic sites.
 */
export async function getAnyActiveSession(): Promise<{ site: string; session: FocusSession } | null> {
  const data = await getStorageData();
  for (const [siteKey, session] of Object.entries(data.activeSessions)) {
    if (session && isSessionActive(session)) {
      return { site: siteKey, session };
    }
  }
  return null;
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
export async function clearActiveSession(site: string): Promise<void> {
  const data = await getStorageData();
  data.activeSessions[site] = null;
  await saveStorageData(data);
}

/**
 * Finalize an active session and move it to session history.
 */
export async function completeSession(
  site: string,
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
 * Reset all user settings to default configuration.
 */
export async function resetAllSettings(): Promise<UserSettings> {
  const data = await getStorageData();
  data.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  await saveStorageData(data);
  return data.settings;
}

/**
 * Guarded sites management functions
 */
export async function getGuardedSites(): Promise<GuardedSite[]> {
  const data = await getStorageData();
  return data.settings.guardedSites || [];
}

export async function addGuardedSite(site: GuardedSite): Promise<void> {
  const data = await getStorageData();
  const list = data.settings.guardedSites ? [...data.settings.guardedSites] : [];
  const index = list.findIndex(
    (s) => s.id === site.id || s.domain.toLowerCase() === site.domain.toLowerCase()
  );
  if (index >= 0) {
    list[index] = site;
  } else {
    list.push(site);
  }
  data.settings.guardedSites = list;
  await saveStorageData(data);
}

export async function updateGuardedSite(site: GuardedSite): Promise<void> {
  const data = await getStorageData();
  const list = data.settings.guardedSites ? [...data.settings.guardedSites] : [];
  const index = list.findIndex((s) => s.id === site.id);
  if (index >= 0) {
    list[index] = site;
    data.settings.guardedSites = list;
    await saveStorageData(data);
  }
}

export async function deleteGuardedSite(siteId: string): Promise<void> {
  const data = await getStorageData();
  data.settings.guardedSites = (data.settings.guardedSites || []).filter((s) => s.id !== siteId);
  if (data.activeSessions[siteId]) {
    data.activeSessions[siteId] = null;
  }
  await saveStorageData(data);
}

export async function toggleGuardedSite(siteId: string, enabled: boolean): Promise<void> {
  const data = await getStorageData();
  const list = (data.settings.guardedSites || []).map((s) =>
    s.id === siteId ? { ...s, enabled } : s
  );
  data.settings.guardedSites = list;
  await saveStorageData(data);
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
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, count: 0, error: 'Invalid JSON: root must be an object' };
    }

    if (Array.isArray(parsed)) {
      const data = await getStorageData();
      const existingIds = new Set(data.sessionHistory.map((s) => s.id));
      let added = 0;
      for (const s of parsed) {
        if (s && s.id && !existingIds.has(s.id)) {
          data.sessionHistory.push(s);
          existingIds.add(s.id);
          added++;
        }
      }
      data.sessionHistory.sort((a, b) => b.startTime - a.startTime);
      await saveStorageData(data);
      return { success: true, count: added };
    }

    if (!Array.isArray(parsed.sessionHistory) && !parsed.settings) {
      return { success: false, count: 0, error: 'Invalid schema: missing sessionHistory or settings' };
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
      count: 0,
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
    const tasksDetail = (s.tasks || []).map((t) => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('; ');

    return [
      `"${s.id}"`,
      `"${dateStr}"`,
      `"${s.site}"`,
      `"${s.status}"`,
      `"${(s.purpose || '').replace(/"/g, '""')}"`,
      plannedMin,
      actualMin,
      s.tasksCompletedCount ?? 0,
      s.totalTasksCount ?? 0,
      s.wasExpired ? 'Yes' : 'No',
      `"${tasksDetail.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let token = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        token += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(token);
      token = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      row.push(token);
      if (row.length > 0 && row.some((field) => field.trim() !== '')) {
        records.push(row);
      }
      row = [];
      token = '';
    } else {
      token += c;
    }
  }

  if (token !== '' || row.length > 0) {
    row.push(token);
    if (row.some((field) => field.trim() !== '')) {
      records.push(row);
    }
  }

  return records;
}

/**
 * Import session history from CSV string.
 */
export async function importHistoryFromCsv(
  csvText: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!csvText || !csvText.trim()) {
      return { success: false, count: 0, error: 'Empty CSV input' };
    }

    const lines = parseCsvRecords(csvText);
    if (lines.length <= 1) {
      return { success: true, count: 0 };
    }

    const dataRows = lines.slice(1);
    const importedSessions: FocusSession[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length < 5) continue;

      const id = row[0]?.trim() || `session-csv-${Date.now()}-${i}`;
      const dateStr = row[1]?.trim();
      const startTime = dateStr ? new Date(dateStr).getTime() || Date.now() : Date.now();
      const site = row[2]?.trim() || 'unknown';
      const statusRaw = row[3]?.trim() as any;
      const status = ['completed', 'abandoned', 'expired', 'active', 'paused', 'cancelled'].includes(statusRaw)
        ? statusRaw
        : 'completed';
      const purpose = row[4]?.trim() || '';
      const plannedMin = parseFloat(row[5] || '15') || 15;
      const actualMin = parseFloat(row[6] || '0') || 0;
      const tasksCompletedCount = parseInt(row[7] || '0', 10) || 0;
      const totalTasksCount = parseInt(row[8] || '0', 10) || 0;
      const wasExpired = (row[9] || '').toLowerCase() === 'yes' || (row[9] || '').toLowerCase() === 'true';
      const tasksRaw = row[10] || '';

      const tasks = [];
      if (tasksRaw.trim()) {
        const taskParts = tasksRaw.split(';');
        for (let tIdx = 0; tIdx < taskParts.length; tIdx++) {
          const trimmed = taskParts[tIdx].trim();
          if (!trimmed) continue;
          const isDone = trimmed.startsWith('[x]') || trimmed.startsWith('[X]');
          const cleanText = trimmed.replace(/^\[[ xX]\]\s*/, '').trim();
          tasks.push({
            id: `task-${id}-${tIdx}`,
            text: cleanText || trimmed,
            completed: isDone,
          });
        }
      }

      const allocatedDurationMs = plannedMin * 60000;
      const actualDurationMs = actualMin * 60000;

      importedSessions.push({
        id,
        site,
        purpose,
        tasks,
        startTime,
        endTime: startTime + actualDurationMs,
        allocatedDurationMs,
        deadlineTime: startTime + allocatedDurationMs,
        status,
        lastUpdateTime: startTime + actualDurationMs,
        actualDurationMs,
        wasExpired,
        tasksCompletedCount: tasks.length > 0 ? tasks.filter((t) => t.completed).length : tasksCompletedCount,
        totalTasksCount: tasks.length > 0 ? tasks.length : totalTasksCount,
      });
    }

    if (importedSessions.length === 0) {
      return { success: false, count: 0, error: 'No valid session records found in CSV' };
    }

    const data = await getStorageData();
    const existingIds = new Set(data.sessionHistory.map((s) => s.id));
    let addedCount = 0;

    for (const s of importedSessions) {
      if (!existingIds.has(s.id)) {
        data.sessionHistory.push(s);
        existingIds.add(s.id);
        addedCount++;
      }
    }

    data.sessionHistory.sort((a, b) => b.startTime - a.startTime);
    await saveStorageData(data);

    return { success: true, count: addedCount };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to parse CSV',
    };
  }
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function unescapeXml(escaped: string): string {
  return (escaped || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Export session history as XML string.
 */
export async function exportHistoryAsXml(): Promise<string> {
  const data = await getStorageData();
  const history = data.sessionHistory;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<focusGuardHistory exportedAt="${new Date().toISOString()}" totalSessions="${history.length}">\n`;

  for (const s of history) {
    xml += '  <session>\n';
    xml += `    <id>${escapeXml(s.id)}</id>\n`;
    xml += `    <site>${escapeXml(s.site)}</site>\n`;
    xml += `    <purpose>${escapeXml(s.purpose)}</purpose>\n`;
    xml += `    <status>${escapeXml(s.status)}</status>\n`;
    xml += `    <startTime>${s.startTime}</startTime>\n`;
    if (s.endTime) xml += `    <endTime>${s.endTime}</endTime>\n`;
    xml += `    <allocatedDurationMs>${s.allocatedDurationMs}</allocatedDurationMs>\n`;
    xml += `    <actualDurationMs>${s.actualDurationMs}</actualDurationMs>\n`;
    xml += `    <deadlineTime>${s.deadlineTime}</deadlineTime>\n`;
    xml += `    <wasExpired>${s.wasExpired}</wasExpired>\n`;
    xml += `    <tasksCompletedCount>${s.tasksCompletedCount ?? 0}</tasksCompletedCount>\n`;
    xml += `    <totalTasksCount>${s.totalTasksCount ?? 0}</totalTasksCount>\n`;

    if (s.tasks && s.tasks.length > 0) {
      xml += '    <tasks>\n';
      for (const t of s.tasks) {
        xml += `      <task id="${escapeXml(t.id)}" completed="${t.completed}"`;
        if (t.completedAt) xml += ` completedAt="${t.completedAt}"`;
        xml += `>${escapeXml(t.text)}</task>\n`;
      }
      xml += '    </tasks>\n';
    } else {
      xml += '    <tasks/>\n';
    }

    xml += '  </session>\n';
  }

  xml += '</focusGuardHistory>';
  return xml;
}

/**
 * Import session history from XML string.
 */
export async function importHistoryFromXml(
  xmlText: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!xmlText || !xmlText.trim()) {
      return { success: false, count: 0, error: 'Empty XML input' };
    }

    const importedSessions: FocusSession[] = [];

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        return { success: false, count: 0, error: parseError.textContent || 'XML parsing failed' };
      }

      const sessionNodes = doc.querySelectorAll('session');
      sessionNodes.forEach((node, idx) => {
        const getText = (selector: string) => node.querySelector(selector)?.textContent?.trim() || '';
        const id = getText('id') || `xml-session-${Date.now()}-${idx}`;
        const site = getText('site') || 'unknown';
        const purpose = getText('purpose') || '';
        const status = (getText('status') || 'completed') as any;
        const startTime = parseInt(getText('startTime'), 10) || Date.now();
        const endTimeStr = getText('endTime');
        const endTime = endTimeStr ? parseInt(endTimeStr, 10) : undefined;
        const allocatedDurationMs = parseInt(getText('allocatedDurationMs'), 10) || 15 * 60000;
        const actualDurationMs = parseInt(getText('actualDurationMs'), 10) || 0;
        const deadlineTime = parseInt(getText('deadlineTime'), 10) || startTime + allocatedDurationMs;
        const wasExpired = getText('wasExpired') === 'true';

        const tasks: any[] = [];
        const taskNodes = node.querySelectorAll('tasks > task');
        taskNodes.forEach((tn, tIdx) => {
          tasks.push({
            id: tn.getAttribute('id') || `task-${id}-${tIdx}`,
            text: tn.textContent?.trim() || '',
            completed: tn.getAttribute('completed') === 'true',
            completedAt: tn.getAttribute('completedAt') ? parseInt(tn.getAttribute('completedAt')!, 10) : undefined,
          });
        });

        const tasksCompletedCount = parseInt(getText('tasksCompletedCount'), 10) || tasks.filter((t) => t.completed).length;
        const totalTasksCount = parseInt(getText('totalTasksCount'), 10) || tasks.length;

        importedSessions.push({
          id,
          site,
          purpose,
          tasks,
          startTime,
          endTime,
          allocatedDurationMs,
          deadlineTime,
          status,
          lastUpdateTime: endTime || startTime + actualDurationMs,
          actualDurationMs,
          wasExpired,
          tasksCompletedCount,
          totalTasksCount,
        });
      });
    } else {
      const sessionRegex = /<session>([\s\S]*?)<\/session>/g;
      let sessionMatch: RegExpExecArray | null;
      let idx = 0;

      while ((sessionMatch = sessionRegex.exec(xmlText)) !== null) {
        const block = sessionMatch[1];
        const extractTag = (tag: string) => {
          const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
          return m ? unescapeXml(m[1].trim()) : '';
        };

        const id = extractTag('id') || `xml-session-${Date.now()}-${idx++}`;
        const site = extractTag('site') || 'unknown';
        const purpose = extractTag('purpose') || '';
        const status = (extractTag('status') || 'completed') as any;
        const startTime = parseInt(extractTag('startTime'), 10) || Date.now();
        const endTimeStr = extractTag('endTime');
        const endTime = endTimeStr ? parseInt(endTimeStr, 10) : undefined;
        const allocatedDurationMs = parseInt(extractTag('allocatedDurationMs'), 10) || 15 * 60000;
        const actualDurationMs = parseInt(extractTag('actualDurationMs'), 10) || 0;
        const deadlineTime = parseInt(extractTag('deadlineTime'), 10) || startTime + allocatedDurationMs;
        const wasExpired = extractTag('wasExpired') === 'true';

        const tasks: any[] = [];
        const taskRegex = /<task\s+id="([^"]*)"\s+completed="([^"]*)"(?:\s+completedAt="([^"]*)")?>([\s\S]*?)<\/task>/g;
        let tMatch: RegExpExecArray | null;
        let tIdx = 0;
        while ((tMatch = taskRegex.exec(block)) !== null) {
          tasks.push({
            id: unescapeXml(tMatch[1]) || `task-${id}-${tIdx++}`,
            completed: tMatch[2] === 'true',
            completedAt: tMatch[3] ? parseInt(tMatch[3], 10) : undefined,
            text: unescapeXml(tMatch[4].trim()),
          });
        }

        const tasksCompletedCount = parseInt(extractTag('tasksCompletedCount'), 10) || tasks.filter((t) => t.completed).length;
        const totalTasksCount = parseInt(extractTag('totalTasksCount'), 10) || tasks.length;

        importedSessions.push({
          id,
          site,
          purpose,
          tasks,
          startTime,
          endTime,
          allocatedDurationMs,
          deadlineTime,
          status,
          lastUpdateTime: endTime || startTime + actualDurationMs,
          actualDurationMs,
          wasExpired,
          tasksCompletedCount,
          totalTasksCount,
        });
      }
    }

    if (importedSessions.length === 0) {
      return { success: false, count: 0, error: 'No valid sessions found in XML' };
    }

    const data = await getStorageData();
    const existingIds = new Set(data.sessionHistory.map((s) => s.id));
    let addedCount = 0;

    for (const s of importedSessions) {
      if (!existingIds.has(s.id)) {
        data.sessionHistory.push(s);
        existingIds.add(s.id);
        addedCount++;
      }
    }

    data.sessionHistory.sort((a, b) => b.startTime - a.startTime);
    await saveStorageData(data);

    return { success: true, count: addedCount };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'XML import error',
    };
  }
}

/**
 * Generate a clean printable HTML document for PDF conversion or window.print.
 */
export function generateHistoryPdfReport(history: FocusSession[], stats?: any): string {
  const totalSessions = stats?.totalSessionsStarted ?? history.length;
  const completedCount = stats?.totalCompletedSessions ?? history.filter((s) => s.status === 'completed').length;
  const abandonedCount = stats?.totalAbandonedSessions ?? history.filter((s) => s.status === 'abandoned').length;
  const totalActualMs = stats?.totalActualActiveTimeMs ?? history.reduce((acc, s) => acc + (s.actualDurationMs || 0), 0);
  const totalMinutes = Math.round(totalActualMs / 60000);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;
  const totalTasksCompleted = stats?.totalTasksCompleted ?? history.reduce((acc, s) => acc + (s.tasksCompletedCount || 0), 0);
  const totalTasks = stats?.totalTasksCreated ?? history.reduce((acc, s) => acc + (s.totalTasksCount || 0), 0);

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tableRows = history
    .map((s) => {
      const dateStr = new Date(s.startTime).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const plannedMin = Math.round(s.allocatedDurationMs / 60000);
      const actualMin = (s.actualDurationMs / 60000).toFixed(1);
      const statusColor =
        s.status === 'completed'
          ? '#16a34a'
          : s.status === 'abandoned'
          ? '#dc2626'
          : s.wasExpired
          ? '#ea580c'
          : '#4b5563';

      const tasksText = (s.tasks || [])
        .map((t) => `<div style="font-size: 11px; color: ${t.completed ? '#16a34a' : '#6b7280'}">${t.completed ? '✓' : '○'} ${escapeXml(t.text)}</div>`)
        .join('');

      return `
        <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
          <td style="padding: 10px 8px; font-size: 12px; color: #374151;">${dateStr}</td>
          <td style="padding: 10px 8px; font-size: 12px; font-weight: 600; color: #111827; text-transform: capitalize;">${escapeXml(s.site)}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #1f2937;">
            <div>${escapeXml(s.purpose)}</div>
            ${tasksText ? `<div style="margin-top: 4px;">${tasksText}</div>` : ''}
          </td>
          <td style="padding: 10px 8px; font-size: 12px; color: #4b5563; white-space: nowrap;">${plannedMin}m / ${actualMin}m</td>
          <td style="padding: 10px 8px; font-size: 12px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; color: #fff; background-color: ${statusColor};">
              ${escapeXml(s.status)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LocalGuard — Productivity & Intentionality Audit Report</title>
  <style>
    @page {
      margin: 15mm;
      size: A4 portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .print-bar {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f3f4f6;
      padding: 12px 18px;
      border-radius: 8px;
    }
    .print-btn {
      background: #007aff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .header {
      border-bottom: 2px solid #007aff;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #007aff;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    th {
      background: #f9fafb;
      text-align: left;
      padding: 10px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #4b5563;
      border-bottom: 2px solid #e5e7eb;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>LocalGuard Productivity Report — Ready to Save as PDF</span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">LocalGuard — Audit Report</h1>
      <div class="subtitle">Intentionality & Time Management Summary</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #6b7280;">
      <div>Generated: ${reportDate}</div>
      <div>Total Records: ${totalSessions}</div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${totalSessions}</div>
      <div class="stat-label">Total (${completedCount} won, ${abandonedCount} stopped)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${completionRate}%</div>
      <div class="stat-label">Completion Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalHours}h</div>
      <div class="stat-label">Total Active Time</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalTasksCompleted} / ${totalTasks}</div>
      <div class="stat-label">Tasks Completed</div>
    </div>
  </div>

  <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #111827;">Detailed Session History</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Date & Time</th>
        <th style="width: 15%;">Guarded Site</th>
        <th style="width: 40%;">Intent / Tasks</th>
        <th style="width: 15%;">Planned / Actual</th>
        <th style="width: 15%; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #6b7280;">No session history available</td></tr>'}
    </tbody>
  </table>

  <script>
    if (window.location.search.includes('autoprint=true')) {
      window.addEventListener('load', () => window.print());
    }
  </script>
</body>
</html>`;
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

/**
 * Away State helpers for tab-departure return flow.
 */
export async function getAwayState(): Promise<AwayState | null> {
  const data = await getStorageData();
  return data.awayState || null;
}

export async function saveAwayState(awayState: AwayState | null): Promise<void> {
  const data = await getStorageData();
  data.awayState = awayState;
  await saveStorageData(data);
}

export async function clearAwayState(): Promise<void> {
  await saveAwayState(null);
}

/**
 * Lockout state helpers for strict screen takeover when timer stops or expires.
 */
export async function getLockoutState(siteId: string): Promise<LockoutState | null> {
  const data = await getStorageData();
  return (data.lockoutStates && data.lockoutStates[siteId]) || null;
}

export async function saveLockoutState(siteId: string, state: LockoutState | null): Promise<void> {
  const data = await getStorageData();
  if (!data.lockoutStates) {
    data.lockoutStates = {};
  }
  if (state === null) {
    delete data.lockoutStates[siteId];
  } else {
    data.lockoutStates[siteId] = state;
  }
  await saveStorageData(data);
}

export async function clearLockoutState(siteId: string): Promise<void> {
  await saveLockoutState(siteId, null);
}


