import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleTabActivated,
  handleRuntimeMessage,
  runPeriodicTicker,
  setLastFocusTabId,
} from '../src/background/index';
import {
  saveStorageData,
  saveActiveSession,
  saveAwayState,
  getAwayState,
  getLockoutState,
} from '../src/storage/storage';
import { INITIAL_STORAGE_SCHEMA, FocusSession, AwayState } from '../src/shared/types';
import { resetMockStorage } from './setup';

describe('Background Service Worker — Tab Departure & Away Timer System', () => {
  beforeEach(async () => {
    resetMockStorage();
    setLastFocusTabId(null);
    await saveStorageData(JSON.parse(JSON.stringify(INITIAL_STORAGE_SCHEMA)));
  });

  describe('Tab Departure Interceptor (handleTabActivated)', () => {
    it('switches back to focus tab and sends PROMPT_TAB_DEPARTURE when in Focus Mode and not authorized away', async () => {
      const now = Date.now();
      const focusSession: FocusSession = {
        id: 'session-1',
        site: 'youtube',
        purpose: 'Deep work on TypeScript MV3',
        tasks: [{ id: 't-1', text: 'Task 1', completed: false }],
        startTime: now,
        allocatedDurationMs: 25 * 60 * 1000,
        deadlineTime: now + 25 * 60 * 1000,
        status: 'active',
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 1,
        mode: 'focus',
        tabId: 101,
      };

      await saveActiveSession(focusSession);

      // User switches to destination tab 202
      await handleTabActivated({ tabId: 202 });

      // Should immediately switch back to focus tab 101
      expect(chrome.tabs.update).toHaveBeenCalledWith(101, { active: true });

      // Should send PROMPT_TAB_DEPARTURE to tab 101 with destinationTabId: 202
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(101, {
        type: 'PROMPT_TAB_DEPARTURE',
        destinationTabId: 202,
      });
    });

    it('does NOT intercept departure when authorized awayState is active', async () => {
      const now = Date.now();
      const focusSession: FocusSession = {
        id: 'session-1',
        site: 'youtube',
        purpose: 'Deep work',
        tasks: [],
        startTime: now,
        allocatedDurationMs: 25 * 60 * 1000,
        deadlineTime: now + 25 * 60 * 1000,
        status: 'active',
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
        mode: 'focus',
        tabId: 101,
      };

      await saveActiveSession(focusSession);

      const awayState: AwayState = {
        isAway: true,
        reason: 'Checking documentation',
        originTabId: 101,
        originSiteId: 'youtube',
        originSiteDomain: 'youtube.com',
        originSiteName: 'YouTube',
        departedAt: now,
        allocatedDurationMs: 5 * 60 * 1000,
        deadlineTime: now + 5 * 60 * 1000,
        destinationTabId: 202,
      };

      await saveAwayState(awayState);
      vi.clearAllMocks();

      // User switches to tab 202
      await handleTabActivated({ tabId: 202 });

      // Since awayState.isAway is true, no switch back or departure prompt should occur
      expect(chrome.tabs.update).not.toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('does NOT intercept when active tab is the focus tab itself', async () => {
      const now = Date.now();
      const focusSession: FocusSession = {
        id: 'session-1',
        site: 'youtube',
        purpose: 'Deep work',
        tasks: [],
        startTime: now,
        allocatedDurationMs: 25 * 60 * 1000,
        deadlineTime: now + 25 * 60 * 1000,
        status: 'active',
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
        mode: 'focus',
        tabId: 101,
      };

      await saveActiveSession(focusSession);
      vi.clearAllMocks();

      // Activated tab is the focus tab itself
      await handleTabActivated({ tabId: 101 });

      expect(chrome.tabs.update).not.toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('does NOT intercept departure when session mode is regular', async () => {
      const now = Date.now();
      const regularSession: FocusSession = {
        id: 'session-2',
        site: 'facebook',
        purpose: 'Casual browsing',
        tasks: [],
        startTime: now,
        allocatedDurationMs: 15 * 60 * 1000,
        deadlineTime: now + 15 * 60 * 1000,
        status: 'active',
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 0,
        mode: 'regular',
        tabId: 105,
      };

      await saveActiveSession(regularSession);
      vi.clearAllMocks();

      await handleTabActivated({ tabId: 303 });

      expect(chrome.tabs.update).not.toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Runtime Message Handlers', () => {
    it('START_AWAY_SESSION saves awayState, switches to destination tab, and updates badge', async () => {
      const sendResponse = vi.fn();
      const now = Date.now();

      const message = {
        type: 'START_AWAY_SESSION',
        awayState: {
          isAway: true,
          reason: 'Quick reference check',
          originTabId: 101,
          originSiteId: 'youtube',
          originSiteDomain: 'youtube.com',
          originSiteName: 'YouTube',
          departedAt: now,
          allocatedDurationMs: 3 * 60 * 1000,
          deadlineTime: now + 3 * 60 * 1000,
          destinationTabId: 202,
        },
      };

      await handleRuntimeMessage(message, { tab: { id: 101 } as any }, sendResponse);

      // Verify awayState in storage
      const savedAway = await getAwayState();
      expect(savedAway).not.toBeNull();
      expect(savedAway?.isAway).toBe(true);
      expect(savedAway?.reason).toBe('Quick reference check');
      expect(savedAway?.destinationTabId).toBe(202);

      // Verify destination tab switch
      expect(chrome.tabs.update).toHaveBeenCalledWith(202, { active: true });

      // Verify action badge updated to amber
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '3m' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f59e0b' });
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('EXTEND_AWAY_SESSION extends deadlineTime of awayState and updates badge', async () => {
      const now = Date.now();
      const initialAway: AwayState = {
        isAway: true,
        reason: 'Research',
        originTabId: 101,
        originSiteId: 'youtube',
        originSiteDomain: 'youtube.com',
        originSiteName: 'YouTube',
        departedAt: now,
        allocatedDurationMs: 3 * 60 * 1000,
        deadlineTime: now + 3 * 60 * 1000,
        warnedOneMinuteLeft: true,
      };

      await saveAwayState(initialAway);

      const sendResponse = vi.fn();
      const message = {
        type: 'EXTEND_AWAY_SESSION',
        addedMs: 2 * 60 * 1000,
      };

      await handleRuntimeMessage(message, {}, sendResponse);

      const updatedAway = await getAwayState();
      expect(updatedAway?.deadlineTime).toBeGreaterThan(initialAway.deadlineTime);
      expect(updatedAway?.allocatedDurationMs).toBe(5 * 60 * 1000);
      expect(updatedAway?.warnedOneMinuteLeft).toBe(false); // Reset warning
      expect(chrome.action.setBadgeText).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('FINISH_AWAY_SESSION clears awayState and switches back to originTabId if returnToOrigin is true', async () => {
      const now = Date.now();
      const initialAway: AwayState = {
        isAway: true,
        reason: 'Research',
        originTabId: 101,
        originSiteId: 'youtube',
        originSiteDomain: 'youtube.com',
        originSiteName: 'YouTube',
        departedAt: now,
        allocatedDurationMs: 5 * 60 * 1000,
        deadlineTime: now + 5 * 60 * 1000,
      };

      await saveAwayState(initialAway);

      const sendResponse = vi.fn();
      const message = {
        type: 'FINISH_AWAY_SESSION',
        returnToOrigin: true,
      };

      await handleRuntimeMessage(message, {}, sendResponse);

      const clearedAway = await getAwayState();
      expect(clearedAway).toBeNull();
      expect(chrome.tabs.update).toHaveBeenCalledWith(101, { active: true });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('TRIGGER_SCREEN_LOCKOUT saves lockout state and broadcasts to tab', async () => {
      const sendResponse = vi.fn();
      const message = {
        type: 'TRIGGER_SCREEN_LOCKOUT',
        siteId: 'youtube',
        siteDomain: 'youtube.com',
        reason: 'timer_expired',
        tabId: 101,
      };

      await handleRuntimeMessage(message, { tab: { id: 101 } as any }, sendResponse);

      const lockout = await getLockoutState('youtube');
      expect(lockout).not.toBeNull();
      expect(lockout?.isLocked).toBe(true);
      expect(lockout?.reason).toBe('timer_expired');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(101, expect.objectContaining({
        type: 'SCREEN_LOCKOUT_TRIGGERED',
        siteId: 'youtube',
      }));
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('Periodic Ticker (runPeriodicTicker)', () => {
    it('broadcasts AWAY_ONE_MINUTE_LEFT when remaining time <= 60000ms and sets warnedOneMinuteLeft in storage', async () => {
      const now = Date.now();
      const awayState: AwayState = {
        isAway: true,
        reason: 'Check email',
        originTabId: 101,
        originSiteId: 'youtube',
        originSiteDomain: 'youtube.com',
        originSiteName: 'YouTube',
        departedAt: now - 4 * 60 * 1000,
        allocatedDurationMs: 5 * 60 * 1000,
        deadlineTime: now + 45 * 1000, // 45 seconds remaining (<= 60000ms)
        warnedOneMinuteLeft: false,
        destinationTabId: 202,
      };

      await saveAwayState(awayState);
      vi.clearAllMocks();

      await runPeriodicTicker();

      const updated = await getAwayState();
      expect(updated?.warnedOneMinuteLeft).toBe(true);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          type: 'AWAY_ONE_MINUTE_LEFT',
        })
      );
      // Badge should reflect amber 1m
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1m' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f59e0b' });
    });

    it('broadcasts AWAY_EXPIRED when remaining time <= 0ms', async () => {
      const now = Date.now();
      const awayState: AwayState = {
        isAway: true,
        reason: 'Check email',
        originTabId: 101,
        originSiteId: 'youtube',
        originSiteDomain: 'youtube.com',
        originSiteName: 'YouTube',
        departedAt: now - 6 * 60 * 1000,
        allocatedDurationMs: 5 * 60 * 1000,
        deadlineTime: now - 5000, // 5s in the past (<= 0ms)
        warnedOneMinuteLeft: true,
        destinationTabId: 202,
      };

      await saveAwayState(awayState);
      vi.clearAllMocks();

      await runPeriodicTicker();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          type: 'AWAY_EXPIRED',
        })
      );
      // Badge should reflect red 0m
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '0m' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#ef4444' });
    });
  });
});
