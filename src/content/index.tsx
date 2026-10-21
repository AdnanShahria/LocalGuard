import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteId, FocusSession, UserSettings, DEFAULT_SETTINGS } from '../shared/types';
import { detectCurrentSite } from './siteDetector';
import {
  getActiveSession,
  saveActiveSession,
  updateActiveSession,
  completeSession,
  recordCanceledPrompt,
  getSettings,
  onStorageChanged,
} from '../storage/storage';
import { PurposeModal } from './components/PurposeModal';
import { FocusHUD } from './components/FocusHUD';
import stylesText from './styles.css?inline';

// Global guard against duplicate execution
declare global {
  interface Window {
    __LIFESOLVER_FOCUS_GUARD_MOUNTED__?: boolean;
  }
}

const ContentApp: React.FC<{ site: SiteId }> = ({ site }) => {
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);

  // Initialize and read storage
  const syncWithStorage = async () => {
    try {
      const [currentSettings, currentSession] = await Promise.all([
        getSettings(),
        getActiveSession(site),
      ]);
      setSettings(currentSettings);
      setActiveSession(currentSession);
    } catch (err) {
      console.error('Error synchronizing focus guard state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncWithStorage();

    // Listen for storage changes across tabs
    const unsubscribe = onStorageChanged((newSchema) => {
      setSettings(newSchema.settings);
      const sessionForThisSite = newSchema.activeSessions[site] || null;
      setActiveSession(sessionForThisSite);
    });

    return () => {
      unsubscribe();
    };
  }, [site]);

  // Handle SPA URL / route changes
  useEffect(() => {
    const handleUrlChange = () => {
      const detected = detectCurrentSite();
      if (detected === site) {
        syncWithStorage();
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('yt-navigate-finish', handleUrlChange);
    window.addEventListener('yt-page-data-updated', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('yt-navigate-finish', handleUrlChange);
      window.removeEventListener('yt-page-data-updated', handleUrlChange);
    };
  }, [site]);

  const handleStartSession = async (session: FocusSession) => {
    await saveActiveSession(session);
    setActiveSession(session);
    setIsPromptDismissed(false);
  };

  const handleUpdateSession = async (updated: FocusSession) => {
    setActiveSession(updated);
    await updateActiveSession(updated);
  };

  const handleEndSession = async (outcome: 'completed' | 'abandoned') => {
    await completeSession(site, outcome);
    setActiveSession(null);
    setIsPromptDismissed(false);
  };

  const handleExtendSession = async (addedMs: number) => {
    if (!activeSession) return;
    const now = Date.now();
    const newDeadline = Math.max(now, activeSession.deadlineTime) + addedMs;
    const updated: FocusSession = {
      ...activeSession,
      deadlineTime: newDeadline,
      allocatedDurationMs: activeSession.allocatedDurationMs + addedMs,
      wasExpired: false,
      lastUpdateTime: now,
    };
    await updateActiveSession(updated);
    setActiveSession(updated);
  };

  const handleCancelPrompt = async () => {
    await recordCanceledPrompt();
    setIsPromptDismissed(true);
  };

  const handleOpenStatistics = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE', tab: 'analytics' });
    }
  };

  if (isLoading) return null;

  // If there is an active session, always show the HUD
  if (activeSession && activeSession.status === 'active') {
    return (
      <FocusHUD
        session={activeSession}
        settings={settings}
        onUpdateSession={handleUpdateSession}
        onEndSession={handleEndSession}
        onExtendSession={handleExtendSession}
        onOpenDashboard={handleOpenStatistics}
      />
    );
  }

  // If there is no active session and prompt is not dismissed, show purpose modal
  if (!isPromptDismissed) {
    return (
      <PurposeModal
        site={site}
        settings={settings}
        onStartSession={handleStartSession}
        onCancel={handleCancelPrompt}
        onOpenStatistics={handleOpenStatistics}
      />
    );
  }

  // If user canceled prompt, provide a discreet floating reopen button
  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 2147483645,
      }}
      className="font-sans"
    >
      <button
        onClick={() => setIsPromptDismissed(false)}
        className="px-3.5 py-2 rounded-full bg-[#10141f]/90 hover:bg-[#151a2b] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all flex items-center space-x-2"
        title="Start a focused browsing session"
      >
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span>Focus Mode</span>
      </button>
    </div>
  );
};

function initFocusGuard() {
  if (window.__LIFESOLVER_FOCUS_GUARD_MOUNTED__) {
    return;
  }

  const site = detectCurrentSite();
  if (!site) {
    return; // Not on Facebook or YouTube
  }

  window.__LIFESOLVER_FOCUS_GUARD_MOUNTED__ = true;

  // Create isolated container host
  const hostId = 'lifesolver-focus-guard-host';
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
  reactRootContainer.id = 'lifesolver-root-app';
  shadowRoot.appendChild(reactRootContainer);

  const root = createRoot(reactRootContainer);
  root.render(<ContentApp site={site} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFocusGuard);
} else {
  initFocusGuard();
}
