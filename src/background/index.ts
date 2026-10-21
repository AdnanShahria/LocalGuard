/**
 * LocalGuard Background Service Worker (MV3)
 * Handles lifecycle, tab departure interception, away timer countdown,
 * action badge updates, lockout broadcast, and browsing analytics.
 */

import {
  getStorageData,
  saveStorageData,
  getAnyActiveSession,
  getAwayState,
  saveAwayState,
  saveLockoutState,
} from '../storage/storage';
import {
  INITIAL_STORAGE_SCHEMA,
  AwayState,
  FocusSession,
  LockoutState,
  UserSettings,
} from '../shared/types';
import { calculateRemainingMs } from '../features/session/timerCalculations';

// Module-level in-memory state tracking for active focus session tab
let lastFocusTabId: number | null = null;
let tickerInterval: ReturnType<typeof setInterval> | null = null;

export function setLastFocusTabId(tabId: number | null): void {
  lastFocusTabId = tabId;
}

export function getLastFocusTabId(): number | null {
  return lastFocusTabId;
}

// LocalGuard - Initialize defaults on installation
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('[LocalGuard] Extension installed. Initializing defaults...');
      const data = await getStorageData();
      if (!data || !data.settings) {
        await saveStorageData(INITIAL_STORAGE_SCHEMA);
      }
    }
  });
}

/**
 * Resolves the tab ID associated with the active focus session.
 */
export async function resolveFocusTabId(
  session: FocusSession,
  siteKey?: string,
  settings?: UserSettings
): Promise<number | null> {
  // 1. Direct tabId property on session
  if (session.tabId && typeof session.tabId === 'number') {
    return session.tabId;
  }

  // 2. Cached in-memory tab ID if still valid
  if (lastFocusTabId && typeof lastFocusTabId === 'number') {
    if (typeof chrome !== 'undefined' && chrome.tabs?.get) {
      try {
        const tab = await chrome.tabs.get(lastFocusTabId);
        if (tab && tab.id) {
          return tab.id;
        }
      } catch {
        lastFocusTabId = null;
      }
    } else {
      return lastFocusTabId;
    }
  }

  // 3. Fallback: Query open tabs matching the guarded site domain or session site key
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    try {
      const key = siteKey || session.site;
      const guarded = settings?.guardedSites?.find(
        (g) =>
          g.id.toLowerCase() === key.toLowerCase() ||
          g.domain.toLowerCase().includes(key.toLowerCase())
      );
      const targetDomain = (guarded?.domain || key).toLowerCase().replace(/^www\./, '');

      const tabs = await chrome.tabs.query({});
      const matched = tabs.find((t) => {
        if (!t.url) return false;
        try {
          const u = new URL(t.url);
          const host = u.hostname.toLowerCase().replace(/^www\./, '');
          return host.includes(targetDomain) || targetDomain.includes(host);
        } catch {
          return false;
        }
      });

      if (matched?.id) {
        lastFocusTabId = matched.id;
        return matched.id;
      }
    } catch (err) {
      console.debug('[LocalGuard] Error querying tabs for focus session:', err);
    }
  }

  return null;
}

/**
 * Tab Departure Interceptor:
 * Intercepts tab switches when a Focus Mode session is active without an authorized awayState.
 */
export async function handleTabActivated(activeInfo: { tabId: number; windowId?: number }): Promise<void> {
  try {
    const data = await getStorageData();

    // 1. Check if there is an active session in storage with mode === 'focus'
    let focusSession: FocusSession | null = null;
    let focusSiteKey: string | null = null;

    for (const [siteKey, session] of Object.entries(data.activeSessions || {})) {
      if (
        session &&
        (session.status === 'active' || session.status === 'paused') &&
        (session.mode === 'focus' || (!session.mode && data.settings?.defaultMode === 'focus'))
      ) {
        focusSession = session;
        focusSiteKey = siteKey;
        break;
      }
    }

    if (!focusSession) {
      return;
    }

    // 2. Resolve the focus session tab
    const focusTabId = await resolveFocusTabId(focusSession, focusSiteKey || undefined, data.settings);
    if (!focusTabId) {
      return;
    }

    // Check if the active tab is different from the focus session tab
    if (activeInfo.tabId === focusTabId) {
      lastFocusTabId = activeInfo.tabId;
      return;
    }

    // 3. Check if an authorized awayState is currently active (awayState?.isAway)
    const awayState = data.awayState;
    if (awayState && awayState.isAway) {
      return;
    }

    // 4. In Focus Mode and NOT authorized away:
    // Instantly switch back to the focus tab
    if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
      try {
        await chrome.tabs.update(focusTabId, { active: true });
      } catch (err) {
        console.debug('[LocalGuard] Error switching back to focus tab:', err);
      }
    }

    // Send a runtime message to that tab: { type: 'PROMPT_TAB_DEPARTURE', destinationTabId: activeInfo.tabId }
    if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
      try {
        await chrome.tabs.sendMessage(focusTabId, {
          type: 'PROMPT_TAB_DEPARTURE',
          destinationTabId: activeInfo.tabId,
        });
      } catch (err) {
        console.debug('[LocalGuard] Error sending PROMPT_TAB_DEPARTURE to tab:', err);
      }
    }
  } catch (err) {
    console.debug('[LocalGuard] Error in handleTabActivated:', err);
  }
}

// Register tabs.onActivated listener
if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await handleTabActivated(activeInfo);
  });
}

// Listen for tab navigation to auto-capture focus tab ID
if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    if (tab.url) {
      try {
        const u = new URL(tab.url);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        getStorageData().then((data) => {
          for (const [siteKey, session] of Object.entries(data.activeSessions || {})) {
            if (session && (session.status === 'active' || session.status === 'paused')) {
              const guarded = data.settings?.guardedSites?.find(
                (g) => g.id.toLowerCase() === siteKey.toLowerCase() || g.domain.toLowerCase().includes(siteKey.toLowerCase())
              );
              const domain = (guarded?.domain || siteKey).toLowerCase().replace(/^www\./, '');
              if (host.includes(domain) || domain.includes(host)) {
                lastFocusTabId = tabId;
              }
            }
          }
        }).catch(() => {});
      } catch {
        // Ignore URL parse error
      }
    }
  });
}

/**
 * Update extension action badge based on active session or away state.
 */
export async function updateActionBadge(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  try {
    const away = await getAwayState();
    if (away && away.isAway) {
      const remainingMs = away.deadlineTime - Date.now();
      const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000));
      if (remainingMs > 0) {
        chrome.action.setBadgeText({ text: `${remainingMins}m` });
        chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber badge for away
      } else {
        chrome.action.setBadgeText({ text: '0m' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red badge for expired away
      }
      return;
    }

    const activeInfo = await getAnyActiveSession();
    if (activeInfo && (activeInfo.session.status === 'active' || activeInfo.session.status === 'paused')) {
      const remainingMs = calculateRemainingMs(activeInfo.session.deadlineTime);
      const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000));
      if (remainingMs > 0) {
        chrome.action.setBadgeText({ text: `${remainingMins}m` });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' }); // Blue badge for focus session
      } else {
        chrome.action.setBadgeText({ text: '0m' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red badge for expired session
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.debug('[LocalGuard] Badge update error:', err);
  }
}

/**
 * Periodic Ticker:
 * Manages away timer countdown, warning alerts at <= 1 minute, expiration events,
 * and dynamic action badge reflection.
 */
export async function runPeriodicTicker(): Promise<void> {
  try {
    const awayState = await getAwayState();
    if (awayState && awayState.isAway) {
      const now = Date.now();
      const remainingMs = awayState.deadlineTime - now;
      const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000));

      // 1. Update action badge with remaining away time (e.g. "3m" in amber #f59e0b)
      if (typeof chrome !== 'undefined' && chrome.action) {
        if (remainingMs > 0) {
          chrome.action.setBadgeText({ text: `${remainingMins}m` });
          chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
        } else {
          chrome.action.setBadgeText({ text: '0m' });
          chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        }
      }

      // 2. If remaining time <= 60000ms and not warnedOneMinuteLeft
      if (remainingMs <= 60000 && !awayState.warnedOneMinuteLeft) {
        awayState.warnedOneMinuteLeft = true;
        await saveAwayState(awayState);

        // Send message AWAY_ONE_MINUTE_LEFT to active tab
        if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const targetTabId = tabs[0]?.id || awayState.destinationTabId;
            if (targetTabId) {
              await chrome.tabs.sendMessage(targetTabId, {
                type: 'AWAY_ONE_MINUTE_LEFT',
                remainingMs,
                awayState,
              });
            }
          } catch (err) {
            console.debug('[LocalGuard] Error broadcasting AWAY_ONE_MINUTE_LEFT:', err);
          }
        }
      }

      // 3. If remaining time <= 0ms: Send message AWAY_EXPIRED to active tab
      if (remainingMs <= 0) {
        if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const targetTabId = tabs[0]?.id || awayState.destinationTabId;
            if (targetTabId) {
              await chrome.tabs.sendMessage(targetTabId, {
                type: 'AWAY_EXPIRED',
                awayState,
              });
            }
          } catch (err) {
            console.debug('[LocalGuard] Error broadcasting AWAY_EXPIRED:', err);
          }
        }
      }
    } else {
      await updateActionBadge();
    }
  } catch (err) {
    console.debug('[LocalGuard] Error in periodic ticker:', err);
  }
}

export function startCountdownTicker(): void {
  if (tickerInterval) {
    clearInterval(tickerInterval);
  }
  runPeriodicTicker();
  tickerInterval = setInterval(runPeriodicTicker, 1000);
}

export function stopCountdownTicker(): void {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

// Alarms API integration for service worker wake-up resilience
if (typeof chrome !== 'undefined' && chrome.alarms) {
  try {
    chrome.alarms.create('localguard_away_ticker', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'localguard_away_ticker') {
        runPeriodicTicker();
      }
    });
  } catch {
    // Alarms fallback handling
  }
}

/**
 * Handle runtime messages from content scripts, popup, and options pages.
 */
export async function handleRuntimeMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<boolean> {
  // Capture focus tab ID if sender tab exists
  if (sender.tab?.id) {
    lastFocusTabId = sender.tab.id;
  }

  // 1. OPEN_OPTIONS_PAGE
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    const url = message.tab ? `options.html#${message.tab}` : 'options.html';
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    }
    sendResponse({ success: true });
    return true;
  }

  // 2. UPDATE_BADGE
  if (message.type === 'UPDATE_BADGE') {
    updateActionBadge().then(() => sendResponse({ success: true }));
    return true;
  }

  // 3. CLOSE_CURRENT_TAB
  if (message.type === 'CLOSE_CURRENT_TAB') {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      if (sender.tab?.id) {
        chrome.tabs.remove(sender.tab.id);
      } else {
        chrome.tabs.create({ url: 'chrome://newtab' });
      }
    }
    sendResponse({ success: true });
    return true;
  }

  // 4. START_AWAY_SESSION
  if (message.type === 'START_AWAY_SESSION') {
    try {
      const now = Date.now();
      const rawAway = message.awayState || message;
      const durationMs =
        rawAway.allocatedDurationMs ||
        rawAway.durationMs ||
        (rawAway.durationMinutes ? rawAway.durationMinutes * 60000 : 5 * 60000);
      const deadline = rawAway.deadlineTime || now + durationMs;
      const originTabId = rawAway.originTabId ?? lastFocusTabId ?? sender.tab?.id;
      const destinationTabId = rawAway.destinationTabId ?? message.destinationTabId;

      const awayState: AwayState = {
        isAway: true,
        reason: rawAway.reason || 'Quick departure',
        originTabId,
        originSiteId: rawAway.originSiteId || '',
        originSiteDomain: rawAway.originSiteDomain || '',
        originSiteName: rawAway.originSiteName || '',
        originUrl: rawAway.originUrl || sender.tab?.url,
        departedAt: rawAway.departedAt || now,
        allocatedDurationMs: durationMs,
        deadlineTime: deadline,
        warnedOneMinuteLeft: false,
        destinationTabId,
      };

      await saveAwayState(awayState);

      // Switch to destination tab if supplied
      if (destinationTabId && typeof destinationTabId === 'number' && typeof chrome !== 'undefined' && chrome.tabs?.update) {
        try {
          await chrome.tabs.update(destinationTabId, { active: true });
        } catch (err) {
          console.debug('[LocalGuard] Error switching to destination tab:', err);
        }
      }

      // Start countdown ticker and refresh badge
      startCountdownTicker();
      await updateActionBadge();
      sendResponse({ success: true, awayState });
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }

    return true;
  }

  // 5. EXTEND_AWAY_SESSION
  if (message.type === 'EXTEND_AWAY_SESSION') {
    try {
      const currentAway = await getAwayState();
      if (currentAway && currentAway.isAway) {
        const extensionMs =
          message.addedMs ||
          message.extensionMs ||
          (message.addedMinutes ? message.addedMinutes * 60000 : 5 * 60000);
        const newDeadline =
          message.newDeadlineTime ||
          Math.max(Date.now(), currentAway.deadlineTime) + extensionMs;

        const updatedAway: AwayState = {
          ...currentAway,
          allocatedDurationMs: currentAway.allocatedDurationMs + extensionMs,
          deadlineTime: newDeadline,
          warnedOneMinuteLeft: false, // Reset warning upon extension
        };

        await saveAwayState(updatedAway);
        await updateActionBadge();
        sendResponse({ success: true, awayState: updatedAway });
      } else {
        sendResponse({ success: false, error: 'No active away session to extend' });
      }
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }

    return true;
  }

  // 6. FINISH_AWAY_SESSION
  if (message.type === 'FINISH_AWAY_SESSION') {
    try {
      const currentAway = await getAwayState();
      const originTabId = currentAway?.originTabId ?? message.originTabId ?? lastFocusTabId;

      await saveAwayState(null);

      // If returnToOrigin is requested, switch active tab back to originTabId
      if (message.returnToOrigin && originTabId && typeof chrome !== 'undefined' && chrome.tabs?.update) {
        try {
          await chrome.tabs.update(originTabId, { active: true });
        } catch (err) {
          console.debug('[LocalGuard] Error returning to origin tab:', err);
        }
      }

      await updateActionBadge();
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }

    return true;
  }

  // 7. TRIGGER_SCREEN_LOCKOUT
  if (message.type === 'TRIGGER_SCREEN_LOCKOUT') {
    try {
      const siteId = message.siteId || message.lockoutState?.siteId || 'default';
      const lockoutState: LockoutState = message.lockoutState || {
        isLocked: true,
        reason: message.reason || 'timer_expired',
        siteId,
        siteDomain: message.siteDomain || '',
        timestamp: Date.now(),
        session: message.session || null,
      };

      await saveLockoutState(siteId, lockoutState);

      // Broadcast to sender / target tab
      const targetTabId = message.tabId ?? sender.tab?.id;
      if (targetTabId && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        try {
          await chrome.tabs.sendMessage(targetTabId, {
            type: 'SCREEN_LOCKOUT_TRIGGERED',
            lockoutState,
            siteId,
          });
        } catch {
          // Tab listener may not be active
        }
      }

      // Broadcast to current active tab if different
      if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id && tabs[0].id !== targetTabId) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'SCREEN_LOCKOUT_TRIGGERED',
              lockoutState,
              siteId,
            }).catch(() => {});
          }
        } catch {
          // Ignore tab query error
        }
      }

      sendResponse({ success: true, lockoutState });
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }

    return true;
  }

  // 8. GET_BROWSER_HISTORY
  if (message.type === 'GET_BROWSER_HISTORY') {
    if (typeof chrome !== 'undefined' && chrome.history) {
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      chrome.history.search(
        { text: '', startTime: startOfDay, maxResults: 10000 },
        (items) => {
          // IMPORTANT: chrome.history.search() filters URLs by lastVisitTime >= startTime,
          // but item.visitCount is the ALL-TIME cumulative count for that URL, not today's count.
          // Each item represents exactly 1 distinct URL that was navigated to today.
          // We count items.length (distinct page navigations today), NOT the sum of visitCount.
          const totalVisits = items.length;

          const domainMap: Record<
            string,
            {
              count: number;       // number of distinct URLs visited today for this domain
              lastVisitTime: number;
              firstVisitTime: number;
              sampleTitle?: string;
            }
          > = {};
          const hourlyDistribution: number[] = new Array(24).fill(0);

          for (const item of items) {
            // Each item = 1 navigation today (not its all-time visitCount)
            const visits = 1;

            if (item.url) {
              try {
                const urlObj = new URL(item.url);
                const domain = urlObj.hostname.replace(/^www\./, '');
                if (domain) {
                  if (!domainMap[domain]) {
                    domainMap[domain] = {
                      count: 0,
                      lastVisitTime: item.lastVisitTime || Date.now(),
                      firstVisitTime: item.lastVisitTime || Date.now(),
                      sampleTitle: item.title,
                    };
                  }
                  domainMap[domain].count += visits;
                  if (item.lastVisitTime) {
                    domainMap[domain].lastVisitTime = Math.max(
                      domainMap[domain].lastVisitTime,
                      item.lastVisitTime
                    );
                    domainMap[domain].firstVisitTime = Math.min(
                      domainMap[domain].firstVisitTime,
                      item.lastVisitTime
                    );
                  }
                }
              } catch {
                // Ignore invalid URLs
              }
            }

            if (item.lastVisitTime) {
              const hour = new Date(item.lastVisitTime).getHours();
              if (hour >= 0 && hour < 24) {
                hourlyDistribution[hour] += visits;
              }
            }
          }

          const uniqueDomainsCount = Object.keys(domainMap).length;

          const topDomains = Object.entries(domainMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([domain, data]) => ({
              domain,
              count: data.count,
              percentage: totalVisits > 0 ? Math.round((data.count / totalVisits) * 100) : 0,
              lastVisitTime: data.lastVisitTime,
              // ~2 min avg dwell time per distinct page navigation
              estimatedMinutes: Math.max(1, Math.round(data.count * 2)),
            }));

          sendResponse({
            totalVisits,
            uniqueDomainsCount,
            topDomains,
            hourlyDistribution,
          });
        }
      );
      return true;
    } else {
      sendResponse({ totalVisits: 0, uniqueDomainsCount: 0, topDomains: [], hourlyDistribution: [] });
      return true;
    }
  }

  return false;
}

// Register onMessage listener
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleRuntimeMessage(message, sender, sendResponse);
    return true; // Keep async response channel open
  });
}

// Start ticker and synchronize initial action badge
startCountdownTicker();
updateActionBadge();
