import React, { useState, useEffect } from 'react';
import { FocusSession, AggregateStatistics, GuardedSite } from '../shared/types';
import {
  getAnyActiveSession,
  getStorageData,
  completeSession,
  onStorageChanged,
  getSiteUsageStats,
  updateSettings,
  getTodayUsage,
  TodayUsageOverview,
} from '../storage/storage';
import { calculateStatistics } from '../features/analytics/analyticsCalculations';
import {
  formatTime,
  calculateRemainingMs,
  getTimerColorState,
} from '../features/session/timerCalculations';
import { BrandLogo } from '../shared/components/BrandLogo';
import {
  CheckCircle2,
  BarChart2,
  Settings,
  PlayCircle,
  Globe,
  Laptop,
  ShieldCheck,
  Compass,
} from 'lucide-react';

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export const Popup: React.FC = () => {
  const [activeInfo, setActiveInfo] = useState<{ site: string; session: FocusSession } | null>(null);
  const [stats, setStats] = useState<AggregateStatistics | null>(null);
  const [guardedSites, setGuardedSites] = useState<GuardedSite[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [currentMode, setCurrentMode] = useState<'focus' | 'regular'>('focus');
  const [todayUsage, setTodayUsage] = useState<TodayUsageOverview | null>(null);

  // Active tab domain & its usage today
  const [activeTabDomain, setActiveTabDomain] = useState<string | null>(null);
  const [domainTodayFormatted, setDomainTodayFormatted] = useState<string>('0m');

  const loadData = async () => {
    try {
      const [currentActive, storageData] = await Promise.all([
        getAnyActiveSession(),
        getStorageData(),
      ]);

      setActiveInfo(currentActive);
      setGuardedSites(storageData.settings.guardedSites || []);
      setCurrentMode(storageData.settings.defaultMode || 'focus');

      if (currentActive) {
        setRemainingMs(calculateRemainingMs(currentActive.session.deadlineTime));
      }

      const calculated = calculateStatistics(
        storageData.sessionHistory,
        storageData.canceledPromptCount
      );
      setStats(calculated);

      // Load today's usage overview
      const overview = await getTodayUsage();
      setTodayUsage(overview);

      // Check active tab domain
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs[0];
          if (tab && tab.url && !tab.url.startsWith('chrome://')) {
            try {
              const url = new URL(tab.url);
              const domain = url.hostname.replace(/^www\./, '');
              setActiveTabDomain(domain);
              const usage = await getSiteUsageStats(domain);
              setDomainTodayFormatted(usage.todayFormatted || `${usage.todayMinutes}m`);
            } catch {
              // Ignore invalid URLs
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to load LocalGuard popup data:', err);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = onStorageChanged(() => {
      loadData();
    });

    return () => unsubscribe();
  }, []);

  // Timer interval for popup countdown
  useEffect(() => {
    if (!activeInfo) return;

    const interval = setInterval(() => {
      const ms = calculateRemainingMs(activeInfo.session.deadlineTime);
      setRemainingMs(ms);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeInfo]);

  const handleModeSwitch = async (mode: 'focus' | 'regular') => {
    try {
      setCurrentMode(mode);
      await updateSettings({ defaultMode: mode });
    } catch (err) {
      console.error('Failed to update mode setting:', err);
    }
  };

  const handleEndSession = async () => {
    if (!activeInfo) return;
    await completeSession(activeInfo.site, 'completed');
    setActiveInfo(null);
    loadData();
  };

  const openOptionsPage = (tabName = 'overview') => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: `options.html#${tabName}` });
    } else {
      window.open(`options.html#${tabName}`, '_blank');
    }
  };

  const openSite = (domainOrUrl: string) => {
    const fullUrl = domainOrUrl.startsWith('http') ? domainOrUrl : `https://${domainOrUrl}`;
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: fullUrl });
    } else {
      window.open(fullUrl, '_blank');
    }
  };

  const colorState = activeInfo ? getTimerColorState(remainingMs) : null;
  const isExpired = remainingMs <= 0;

  return (
    <div className="w-[370px] bg-[#f8fafc] text-slate-900 font-sans p-4 space-y-3.5 select-none antialiased">
      {/* Top Header - Apple HIG White Mode with Brand Squircle Shield Logo */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
        <div className="flex items-center space-x-2.5">
          <BrandLogo size={34} variant="squircle" showText={false} />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center space-x-1.5">
              <span>LocalGuard</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 font-semibold tracking-wide">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-normal">Intentional Browsing Guardian</p>
          </div>
        </div>

        <button
          onClick={() => openOptionsPage('settings')}
          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 active:scale-95 transition-all"
          title="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ============================================================== */}
      {/* PROMINENT MODE SWITCHER: FOCUS MODE VS REGULAR MODE            */}
      {/* ============================================================== */}
      <div className="p-2.5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => handleModeSwitch('focus')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-98 ${
              currentMode === 'focus'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${currentMode === 'focus' ? 'text-blue-600' : 'text-slate-400'}`} />
            <span>Focus Mode</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('regular')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-98 ${
              currentMode === 'regular'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${currentMode === 'regular' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>Regular Mode</span>
          </button>
        </div>

        {/* Mode Status Description */}
        <div className="flex items-center justify-between text-[11px] px-1">
          {currentMode === 'focus' ? (
            <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Strict Focus Active: Guarded sites require intent</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Regular Mode: Unrestricted browsing permitted</span>
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono">Saved</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TODAY'S TOTAL SCREEN TIME + GUARDED TIME SUMMARY CARD          */}
      {/* ============================================================== */}
      {todayUsage && (
        <div className="p-3.5 bg-gradient-to-br from-white via-white to-blue-50/40 border border-blue-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
              <Laptop className="w-3.5 h-3.5 text-blue-600" />
              <span>Today's Total Screen Time</span>
            </span>
            <span className="text-xs font-bold text-slate-900 tabular-nums">
              {formatDuration(todayUsage.totalScreenMinutes)}
            </span>
          </div>

          {/* Breakdown Split: Guarded vs Regular */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-white border border-emerald-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Guarded Focus
              </div>
              <div className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">
                {formatDuration(todayUsage.guardedMinutes)}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Regular Browsing
              </div>
              <div className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">
                {formatDuration(todayUsage.regularMinutes)}
              </div>
            </div>
          </div>

          {/* Daily Focus Budget Progress */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-600">
              <span>Focus Budget ({todayUsage.budgetMinutes}m target)</span>
              <span className="font-bold text-blue-700 tabular-nums">
                {todayUsage.budgetProgressPercent}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-blue-100/60 overflow-hidden">
              <div
                style={{ width: `${todayUsage.budgetProgressPercent}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Focus Session Card */}
      {activeInfo && activeInfo.session ? (
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: colorState?.primaryHex || '#007aff' }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Session
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize font-medium border border-slate-200">
              {activeInfo.site}
            </span>
          </div>

          <div className="text-center py-1">
            <div
              className="text-3xl font-bold tracking-tight tabular-nums"
              style={{ color: colorState?.primaryHex || '#007aff' }}
            >
              {isExpired ? '00:00' : formatTime(remainingMs)}
            </div>
            <p className="text-xs text-slate-700 font-semibold truncate mt-1 px-1">
              "{activeInfo.session.purpose}"
            </p>
          </div>

          {/* Tasks Summary & End Session */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center space-x-1.5 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {activeInfo.session.tasks.filter((t) => t.completed).length}/
                {activeInfo.session.tasks.length} tasks done
              </span>
            </span>

            <button
              onClick={handleEndSession}
              className="px-3 py-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 rounded-xl text-[11px] font-semibold border border-rose-200 transition-all"
            >
              End Session
            </button>
          </div>
        </div>
      ) : (
        /* Idle Status Card */
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5 text-center">
          <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Ready for Focus</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Visit a guarded site to start an intentional session.
            </p>
          </div>

          {/* Quick Launch Buttons */}
          <div className="flex items-center justify-center flex-wrap gap-1.5 pt-1">
            {(guardedSites && guardedSites.length > 0
              ? guardedSites.slice(0, 3)
              : [
                  { id: 'youtube', name: 'YouTube', domain: 'youtube.com' },
                  { id: 'facebook', name: 'Facebook', domain: 'facebook.com' },
                ]
            ).map((site) => (
              <button
                key={site.id}
                onClick={() => openSite(site.domain)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all"
              >
                {site.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's Usage for Current Active Tab's Domain */}
      {activeTabDomain && (
        <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-slate-500 truncate">
              Today on <strong className="text-slate-800">{activeTabDomain}</strong>:
            </span>
          </div>
          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex-shrink-0 tabular-nums">
            {domainTodayFormatted}
          </span>
        </div>
      )}

      {/* Quick Summary Metrics */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 bg-white border border-slate-200/90 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Completed</div>
            <div className="text-base font-bold text-emerald-600 tabular-nums mt-0.5">
              {stats.totalCompletedSessions}
            </div>
          </div>
          <div className="p-2.5 bg-white border border-slate-200/90 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Guarded Time</div>
            <div className="text-base font-bold text-blue-600 tabular-nums mt-0.5">
              {formatDuration(Math.round(stats.totalActualActiveTimeMs / 60000))}
            </div>
          </div>
          <div className="p-2.5 bg-white border border-slate-200/90 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Task Rate</div>
            <div className="text-base font-bold text-indigo-600 tabular-nums mt-0.5">
              {stats.taskCompletionRate}%
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
        <button
          onClick={() => openOptionsPage('overview')}
          className="w-full px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 shadow-2xs transition-all"
        >
          <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Open Dashboard</span>
        </button>

        <button
          onClick={() => openOptionsPage('settings')}
          className="w-full px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 shadow-2xs transition-all"
        >
          <Settings className="w-3.5 h-3.5 text-slate-600" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};
