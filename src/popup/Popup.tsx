import React, { useState, useEffect } from 'react';
import { FocusSession, AggregateStatistics } from '../shared/types';
import {
  getAnyActiveSession,
  getStorageData,
  completeSession,
  onStorageChanged,
} from '../storage/storage';
import { calculateStatistics } from '../features/analytics/analyticsCalculations';
import {
  formatTime,
  calculateRemainingMs,
  getTimerColorState,
} from '../features/session/timerCalculations';
import {
  Shield,
  CheckCircle2,
  BarChart2,
  History,
  Settings,
  ExternalLink,
  PlayCircle,
} from 'lucide-react';

export const Popup: React.FC = () => {
  const [activeInfo, setActiveInfo] = useState<{ site: 'facebook' | 'youtube'; session: FocusSession } | null>(null);
  const [stats, setStats] = useState<AggregateStatistics | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const loadData = async () => {
    try {
      const [currentActive, storageData] = await Promise.all([
        getAnyActiveSession(),
        getStorageData(),
      ]);

      setActiveInfo(currentActive);
      if (currentActive) {
        setRemainingMs(calculateRemainingMs(currentActive.session.deadlineTime));
      }

      const calculated = calculateStatistics(
        storageData.sessionHistory,
        storageData.canceledPromptCount
      );
      setStats(calculated);
    } catch (err) {
      console.error('Failed to load popup data:', err);
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

  const openSite = (siteUrl: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: siteUrl });
    } else {
      window.open(siteUrl, '_blank');
    }
  };

  const colorState = activeInfo ? getTimerColorState(remainingMs) : null;
  const isExpired = remainingMs <= 0;

  return (
    <div className="w-[360px] bg-[#0c0e14] text-slate-100 font-sans p-4 space-y-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center space-x-1.5">
              <span>Focus Guard</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-mono font-normal">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Intentional Facebook & YouTube</p>
          </div>
        </div>

        <button
          onClick={() => openOptionsPage('settings')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Active Focus Session Card */}
      {activeInfo && activeInfo.session ? (
        <div
          className="p-3.5 rounded-xl border border-white/10 relative overflow-hidden space-y-3"
          style={{
            backgroundColor: '#131722',
            boxShadow: colorState?.glowHex,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: colorState?.primaryHex }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Active Session
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 capitalize font-mono">
              {activeInfo.site}
            </span>
          </div>

          <div className="text-center py-1">
            <div
              className="text-3xl font-extrabold font-mono"
              style={{ color: colorState?.primaryHex }}
            >
              {isExpired ? "00:00" : formatTime(remainingMs)}
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mt-1 px-1">
              "{activeInfo.session.purpose}"
            </p>
          </div>

          {/* Tasks Summary */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {activeInfo.session.tasks.filter((t) => t.completed).length}/
                {activeInfo.session.tasks.length} tasks
              </span>
            </span>

            <button
              onClick={handleEndSession}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[11px] font-medium border border-red-500/30 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      ) : (
        /* Idle Status Card */
        <div className="p-3.5 bg-[#131722] border border-white/10 rounded-xl space-y-2.5 text-center">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <PlayCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Ready for Focus</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Open Facebook or YouTube to begin an intentional session.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-2 pt-1">
            <button
              onClick={() => openSite('https://www.youtube.com')}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-medium transition-colors"
            >
              YouTube
            </button>
            <button
              onClick={() => openSite('https://www.facebook.com')}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors"
            >
              Facebook
            </button>
          </div>
        </div>
      )}

      {/* Quick Metrics */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-[#131722] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-400">Completed</div>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {stats.totalCompletedSessions}
            </div>
          </div>
          <div className="p-2 bg-[#131722] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-400">Total Time</div>
            <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">
              {Math.round(stats.totalActualActiveTimeMs / 60000)}m
            </div>
          </div>
          <div className="p-2 bg-[#131722] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-400">Task Rate</div>
            <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
              {stats.taskCompletionRate}%
            </div>
          </div>
        </div>
      )}

      {/* Navigation Quick Links */}
      <div className="space-y-1.5 pt-1 border-t border-white/10">
        <button
          onClick={() => openOptionsPage('overview')}
          className="w-full px-3 py-2 bg-[#131722] hover:bg-[#1a2030] border border-white/5 rounded-xl text-xs font-medium text-slate-300 hover:text-white flex items-center justify-between transition-colors"
        >
          <span className="flex items-center space-x-2">
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Dashboard & Analytics</span>
          </span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </button>

        <button
          onClick={() => openOptionsPage('history')}
          className="w-full px-3 py-2 bg-[#131722] hover:bg-[#1a2030] border border-white/5 rounded-xl text-xs font-medium text-slate-300 hover:text-white flex items-center justify-between transition-colors"
        >
          <span className="flex items-center space-x-2">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Session History</span>
          </span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </button>
      </div>
    </div>
  );
};
