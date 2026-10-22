import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FocusSession,
  UserSettings,
  GuardedSite,
  DEFAULT_SETTINGS,
  AwayState,
  LockoutState,
} from '../shared/types';
import { detectGuardedSite } from './siteDetector';
import {
  getActiveSession,
  saveActiveSession,
  updateActiveSession,
  completeSession,
  getSettings,
  onStorageChanged,
  getAwayState,
  saveAwayState,
  clearAwayState,
  getLockoutState,
  saveLockoutState,
  clearLockoutState,
} from '../storage/storage';
import { PurposeModal } from './components/PurposeModal';
import { FocusHUD } from './components/FocusHUD';
import { ScreenLockoutOverlay } from './components/ScreenLockoutOverlay';
import { DepartureModal } from './components/DepartureModal';
import { AwayReminderHUD } from './components/AwayReminderHUD';
import stylesText from './styles.css?inline';

// Global window guards against duplicate execution
declare global {
  interface Window {
    __LOCALGUARD_MOUNTED__?: boolean;
    __LIFESOLVER_FOCUS_GUARD_MOUNTED__?: boolean;
  }
}

export const ContentApp: React.FC = () => {
  const [guardedSite, setGuardedSite] = useState<GuardedSite | null>(null);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [lockoutSession, setLockoutSession] = useState<FocusSession | null>(null);
  const [lockoutReason, setLockoutReason] = useState<'timer_expired' | 'user_stopped' | 'limit_reached' | 'manual'>('timer_expired');
  const [awayState, setAwayState] = useState<AwayState | null>(null);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [pendingDepartureUrl, setPendingDepartureUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize state with storage
  const syncWithStorage = async () => {
    try {
      const currentSettings = await getSettings();
      const currentGuardedSites = currentSettings.guardedSites || [];
      const matched = detectGuardedSite(window.location.hostname, currentGuardedSites);

      setSettings(currentSettings);
      setGuardedSite(matched);

      // Check global away state (applies to ALL tabs!)
      const currentAway = await getAwayState();
      setAwayState(currentAway);

      if (matched) {
        const session =
          (await getActiveSession(matched.id)) ||
          (await getActiveSession(matched.domain)) ||
          null;
        setActiveSession(session);

        // Check if there is an active lockout state for this guarded site
        const siteLockout = (await getLockoutState(matched.id)) || (await getLockoutState(matched.domain));
        if (siteLockout && siteLockout.isLocked) {
          setLockoutSession(siteLockout.session || session);
          setLockoutReason(siteLockout.reason || 'timer_expired');
        } else if (session && (session.status === 'expired' || (session.deadlineTime > 0 && Date.now() >= session.deadlineTime))) {
          // If session expired and not yet marked in lockout state
          setLockoutSession(session);
          setLockoutReason('timer_expired');
        } else {
          setLockoutSession(null);
        }
      } else {
        setActiveSession(null);
        setLockoutSession(null);
      }
    } catch (err) {
      console.error('[Focus Guard] Error synchronizing state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncWithStorage();

    // Listen for storage changes across all tabs
    const unsubscribe = onStorageChanged((newSchema) => {
      if (!newSchema || !newSchema.settings) return;
      setSettings(newSchema.settings);

      // Away state is global across ALL browser tabs
      setAwayState(newSchema.awayState || null);

      const guardedSitesList = newSchema.settings.guardedSites || [];
      const matched = detectGuardedSite(window.location.hostname, guardedSitesList);
      setGuardedSite(matched);

      if (matched) {
        const sessionForThisSite =
          newSchema.activeSessions[matched.id] ||
          newSchema.activeSessions[matched.domain] ||
          null;
        setActiveSession(sessionForThisSite);

        const lockout =
          (newSchema.lockoutStates && newSchema.lockoutStates[matched.id]) ||
          (newSchema.lockoutStates && newSchema.lockoutStates[matched.domain]) ||
          null;

        if (lockout && lockout.isLocked) {
          setLockoutSession(lockout.session || sessionForThisSite);
          setLockoutReason(lockout.reason || 'timer_expired');
        } else if (
          sessionForThisSite &&
          (sessionForThisSite.status === 'expired' ||
            (sessionForThisSite.deadlineTime > 0 && Date.now() >= sessionForThisSite.deadlineTime))
        ) {
          setLockoutSession(sessionForThisSite);
          setLockoutReason('timer_expired');
        } else {
          setLockoutSession(null);
        }
      } else {
        setActiveSession(null);
        setLockoutSession(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for runtime extension messages
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const handleMessage = (
      message: { type: string; reason?: any; session?: any; siteId?: string; awayState?: AwayState },
      _sender: any,
      sendResponse: (res: any) => void
    ) => {
      if (message.type === 'PROMPT_TAB_DEPARTURE') {
        setShowDepartureModal(true);
        sendResponse({ success: true });
        return true;
      }

      if (message.type === 'TRIGGER_SCREEN_LOCKOUT') {
        const target = message.session || activeSession;
        if (target) {
          setLockoutSession(target);
          setLockoutReason(message.reason || 'user_stopped');
          if (guardedSite) {
            saveLockoutState(guardedSite.id, {
              isLocked: true,
              reason: message.reason || 'user_stopped',
              siteId: guardedSite.id,
              siteDomain: guardedSite.domain,
              timestamp: Date.now(),
              session: target,
            }).catch(console.error);
          }
        }
        sendResponse({ success: true });
        return true;
      }

      if (message.type === 'AWAY_ONE_MINUTE_LEFT' || message.type === 'AWAY_EXPIRED') {
        if (message.awayState) {
          setAwayState(message.awayState);
        } else {
          getAwayState().then((st) => setAwayState(st));
        }
        sendResponse({ success: true });
        return true;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [activeSession, guardedSite]);

  // Intercept external link clicks during Focus Mode sessions
  useEffect(() => {
    if (
      !guardedSite ||
      !activeSession ||
      activeSession.mode === 'regular' ||
      activeSession.status !== 'active'
    ) {
      return;
    }

    const handleLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor || !anchor.href) return;

      try {
        const url = new URL(anchor.href);
        const host = url.hostname.toLowerCase();
        const currentDomain = guardedSite.domain.toLowerCase();

        const isInternal = host.includes(currentDomain) || currentDomain.includes(host);
        if (!isInternal && !url.protocol.startsWith('javascript:')) {
          e.preventDefault();
          e.stopPropagation();
          setPendingDepartureUrl(anchor.href);
          setShowDepartureModal(true);
        }
      } catch {
        // Ignore unparseable hrefs
      }
    };

    document.addEventListener('click', handleLinkClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleLinkClick, { capture: true });
    };
  }, [guardedSite, activeSession]);

  // Handle SPA URL / route navigation events
  useEffect(() => {
    const handleUrlChange = () => {
      syncWithStorage();
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('yt-navigate-finish', handleUrlChange);
    window.addEventListener('yt-page-data-updated', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('yt-navigate-finish', handleUrlChange);
      window.removeEventListener('yt-page-data-updated', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleStartSession = async (session: FocusSession) => {
    await saveActiveSession(session);
    setActiveSession(session);
    setLockoutSession(null);
    if (guardedSite) {
      await clearLockoutState(guardedSite.id);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    }
  };

  const handleUpdateSession = async (updated: FocusSession) => {
    setActiveSession(updated);
    await updateActiveSession(updated);
  };

  const handleTriggerLockout = async (
    session: FocusSession,
    reason: 'timer_expired' | 'user_stopped'
  ) => {
    setLockoutSession(session);
    setLockoutReason(reason);
    if (guardedSite) {
      const lockState: LockoutState = {
        isLocked: true,
        reason,
        siteId: guardedSite.id,
        siteDomain: guardedSite.domain,
        timestamp: Date.now(),
        session,
      };
      await saveLockoutState(guardedSite.id, lockState);
    }
  };

  const handleCompleteAndReviewSession = async () => {
    if (!guardedSite) return;
    await completeSession(guardedSite.id, 'completed');
    await clearLockoutState(guardedSite.id);
    setLockoutSession(null);
    setActiveSession(null);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    }
  };

  const handleExtendSessionMinutes = async (mins: number) => {
    const target = activeSession || lockoutSession;
    if (!target || !guardedSite) return;
    const addedMs = mins * 60 * 1000;
    const now = Date.now();
    const newDeadline = Math.max(now, target.deadlineTime) + addedMs;

    const updated: FocusSession = {
      ...target,
      status: 'active',
      deadlineTime: newDeadline,
      allocatedDurationMs: target.allocatedDurationMs + addedMs,
      wasExpired: false,
      lastUpdateTime: now,
    };

    await updateActiveSession(updated);
    await clearLockoutState(guardedSite.id);
    setActiveSession(updated);
    setLockoutSession(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    }
  };

  const handleSwitchFocusTask = async (newPurpose?: string, newMinutes?: number) => {
    if (!guardedSite) return;
    const current = activeSession || lockoutSession;

    // 1. Record previous session
    if (current) {
      await completeSession(guardedSite.id, 'completed');
    }

    // 2. Clear lockout
    await clearLockoutState(guardedSite.id);
    setLockoutSession(null);

    // 3. If explicit new task provided, immediately launch new session
    if (newPurpose) {
      const mins = newMinutes || settings.defaultDurationMinutes || 15;
      const durationMs = mins * 60 * 1000;
      const now = Date.now();
      const nextSession: FocusSession = {
        id: 'session_' + now + '_' + Math.random().toString(36).substring(2, 9),
        site: guardedSite.id,
        purpose: newPurpose,
        tasks: [{ id: 'task_' + now + '_main', text: newPurpose, completed: false }],
        startTime: now,
        allocatedDurationMs: durationMs,
        deadlineTime: now + durationMs,
        status: 'active',
        lastUpdateTime: now,
        actualDurationMs: 0,
        wasExpired: false,
        tasksCompletedCount: 0,
        totalTasksCount: 1,
        mode: current?.mode || 'focus',
      };
      await saveActiveSession(nextSession);
      setActiveSession(nextSession);
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      }
    } else {
      // Transition to PurposeModal for fresh agenda creation
      setActiveSession(null);
    }
  };

  const handleLeaveSite = () => {
    const fallbackLeave = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'about:blank';
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'CLOSE_CURRENT_TAB' }, () => {
          if (chrome.runtime?.lastError) {
            fallbackLeave();
          }
        });
        setTimeout(fallbackLeave, 350);
      } catch {
        fallbackLeave();
      }
    } else {
      fallbackLeave();
    }
  };

  const handleOpenStatistics = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE', tab: 'analytics' });
    }
  };

  // Away Reminder Handlers
  const handleReturnFromAway = async () => {
    if (!awayState) return;
    const originTabId = awayState.originTabId;
    const originUrl = awayState.originUrl;

    await clearAwayState();
    setAwayState(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SWITCH_TO_TAB',
        tabId: originTabId,
        url: originUrl,
      });
    } else if (originUrl) {
      window.location.href = originUrl;
    }
  };

  const handleExtendAwayMinutes = async (mins: number) => {
    if (!awayState) return;
    const addedMs = mins * 60 * 1000;
    const newDeadline = Math.max(Date.now(), awayState.deadlineTime) + addedMs;
    const updated: AwayState = {
      ...awayState,
      deadlineTime: newDeadline,
      allocatedDurationMs: awayState.allocatedDurationMs + addedMs,
      warnedOneMinuteLeft: false,
    };
    await saveAwayState(updated);
    setAwayState(updated);
  };

  const handleDismissAway = async () => {
    await clearAwayState();
    setAwayState(null);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'CLEAR_AWAY_SESSION' });
    }
  };

  // Departure Modal Handlers
  const handleStayOnSite = () => {
    setShowDepartureModal(false);
    setPendingDepartureUrl(null);
  };

  const handleProceedAway = (_newAwayState: AwayState) => {
    setShowDepartureModal(false);
    if (pendingDepartureUrl) {
      window.location.href = pendingDepartureUrl;
      setPendingDepartureUrl(null);
    }
  };

  if (isLoading) return null;

  // PRIORITY 1: Away Reminder HUD — renders on ANY tab in the browser!
  const renderAwayHUD = awayState && awayState.isAway ? (
    <AwayReminderHUD
      awayState={awayState}
      onReturnToSite={handleReturnFromAway}
      onExtendAwayMinutes={handleExtendAwayMinutes}
      onDismissAway={handleDismissAway}
    />
  ) : null;

  // If current page is NOT a guarded site, we only render AwayReminderHUD if away, else null
  if (!guardedSite) {
    return renderAwayHUD;
  }

  // PRIORITY 2: Departure Interception Modal in Focus Mode
  const renderDepartureModal =
    showDepartureModal && activeSession ? (
      <DepartureModal
        originSiteId={guardedSite.id}
        originSiteDomain={guardedSite.domain}
        originSiteName={guardedSite.name}
        originUrl={window.location.href}
        onStay={handleStayOnSite}
        onProceedAway={handleProceedAway}
      />
    ) : null;

  // PRIORITY 3: Full-Screen Lockout Overlay Barrier
  // Takes over the entire screen with frosted glass barrier when session is stopped, expired, or locked
  if (lockoutSession) {
    return (
      <>
        {renderAwayHUD}
        {renderDepartureModal}
        <ScreenLockoutOverlay
          session={lockoutSession}
          reason={lockoutReason}
          onCompleteAndReview={handleCompleteAndReviewSession}
          onExtendMinutes={handleExtendSessionMinutes}
          onSwitchTask={handleSwitchFocusTask}
          onCloseTabOrLeave={handleLeaveSite}
          onUpdateSessionTasks={(updatedTasks) => {
            if (activeSession) {
              handleUpdateSession({ ...activeSession, tasks: updatedTasks });
            }
          }}
        />
      </>
    );
  }

  // PRIORITY 4: Active Session Floating Liquid Glass HUD
  if (activeSession && (activeSession.status === 'active' || activeSession.status === 'paused')) {
    return (
      <>
        {renderAwayHUD}
        {renderDepartureModal}
        <FocusHUD
          session={activeSession}
          settings={settings}
          onUpdateSession={handleUpdateSession}
          onEndSession={(outcome) => {
            if (outcome === 'completed') {
              handleCompleteAndReviewSession();
            } else {
              handleLeaveSite();
            }
          }}
          onExtendSession={(addedMs) => handleExtendSessionMinutes(Math.round(addedMs / 60000))}
          onOpenDashboard={handleOpenStatistics}
          onTriggerLockout={handleTriggerLockout}
          onOpenDepartureModal={() => setShowDepartureModal(true)}
        />
      </>
    );
  }

  // PRIORITY 5: NO Active Session on guarded site -> Unclosable Apple Frosted PurposeModal
  return (
    <>
      {renderAwayHUD}
      {renderDepartureModal}
      <PurposeModal
        site={guardedSite.id}
        settings={settings}
        onStartSession={handleStartSession}
        onLeaveSite={handleLeaveSite}
        onCancel={handleLeaveSite}
        onOpenStatistics={handleOpenStatistics}
      />
    </>
  );
};

export function initLocalGuard() {
  if (window.__LOCALGUARD_MOUNTED__ || window.__LIFESOLVER_FOCUS_GUARD_MOUNTED__) {
    return;
  }

  window.__LOCALGUARD_MOUNTED__ = true;
  window.__LIFESOLVER_FOCUS_GUARD_MOUNTED__ = true;

  // Create isolated container host
  const hostId = 'localguard-host';
  let hostElement = document.getElementById(hostId);
  if (!hostElement) {
    hostElement = document.createElement('div');
    hostElement.id = hostId;
    document.documentElement.appendChild(hostElement);
  }

  // Attach isolated shadow root
  const shadowRoot = hostElement.attachShadow({ mode: 'open' });

  // Inject bundled Tailwind + components styles into shadow root
  const styleEl = document.createElement('style');
  styleEl.textContent = stylesText;
  shadowRoot.appendChild(styleEl);

  // Mount React
  const reactRootContainer = document.createElement('div');
  reactRootContainer.id = 'localguard-root-app';
  shadowRoot.appendChild(reactRootContainer);

  const root = createRoot(reactRootContainer);
  root.render(<ContentApp />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLocalGuard);
} else {
  initLocalGuard();
}
