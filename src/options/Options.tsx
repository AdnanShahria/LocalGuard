import React, { useState, useEffect } from 'react';
import { FocusSession, UserSettings, DEFAULT_SETTINGS, AggregateStatistics } from '../shared/types';
import { getStorageData, onStorageChanged } from '../storage/storage';
import { calculateStatistics } from '../features/analytics/analyticsCalculations';
import { OverviewTab } from './components/OverviewTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { Shield, BarChart2, History, Settings, ExternalLink } from 'lucide-react';

export const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview');
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<AggregateStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync hash routing (e.g. #history or #settings)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'history' || hash === 'settings' || hash === 'overview') {
        setActiveTab(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const loadData = async () => {
    try {
      const storage = await getStorageData();
      setHistory(storage.sessionHistory);
      setSettings(storage.settings);
      const computed = calculateStatistics(storage.sessionHistory, storage.canceledPromptCount);
      setStats(computed);
    } catch (err) {
      console.error('Failed to load options data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = onStorageChanged(() => loadData());
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0e14] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#10141f]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white tracking-tight">
                  LifeSolver Focus Guard
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-medium">
                  Local Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-400">Intentional Facebook & YouTube Browsing</p>
            </div>
          </div>

          {/* Quick links to supported sites */}
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-300 border border-red-500/20 flex items-center space-x-1 transition-colors"
            >
              <span>YouTube</span>
              <ExternalLink className="w-3 h-3 text-red-400" />
            </a>
            <a
              href="https://www.facebook.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/20 flex items-center space-x-1 transition-colors"
            >
              <span>Facebook</span>
              <ExternalLink className="w-3 h-3 text-blue-400" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Tab Switcher */}
        <div className="flex space-x-1 p-1.5 bg-[#141824] rounded-2xl border border-white/5 max-w-md">
          <button
            onClick={() => {
              setActiveTab('overview');
              window.location.hash = 'overview';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Overview & Analytics</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              window.location.hash = 'history';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Session History</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              window.location.hash = 'settings';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* Tab Views */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading data...</div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <OverviewTab stats={stats} history={history} />
            )}
            {activeTab === 'history' && <HistoryTab history={history} />}
            {activeTab === 'settings' && (
              <SettingsTab
                settings={settings}
                onSettingsUpdated={(s) => setSettings(s)}
                onDataReset={() => loadData()}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};
