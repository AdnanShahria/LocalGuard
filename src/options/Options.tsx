import React, { useState, useEffect } from 'react';
import { FocusSession, UserSettings, DEFAULT_SETTINGS, AggregateStatistics } from '../shared/types';
import { getStorageData, onStorageChanged } from '../storage/storage';
import { calculateStatistics } from '../features/analytics/analyticsCalculations';
import { OverviewTab } from './components/OverviewTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { BrandLogo } from '../shared/components/BrandLogo';
import { BarChart2, History, Settings, ExternalLink } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar - Apple White Mode */}
      <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/90 text-slate-900 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo size={38} variant="squircle" showText={false} />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  LocalGuard
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 font-semibold tracking-wide">
                  Active Protection
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">Intentional & Focused Browsing Guardian</p>
            </div>
          </div>

          {/* Quick links to guarded sites */}
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            {(settings.guardedSites && settings.guardedSites.length > 0
              ? settings.guardedSites.slice(0, 3)
              : [
                  { id: 'youtube', name: 'YouTube', domain: 'youtube.com' },
                  { id: 'facebook', name: 'Facebook', domain: 'facebook.com' },
                ]
            ).map((site) => (
              <a
                key={site.id}
                href={`https://${site.domain}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 text-slate-700 border border-slate-200/80 flex items-center space-x-1.5 transition-all font-medium"
              >
                <span>{site.name}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Clean Apple Tab Switcher */}
        <div className="flex space-x-1 p-1 bg-slate-200/60 rounded-2xl border border-slate-200/80 max-w-md shadow-2xs">
          <button
            onClick={() => {
              setActiveTab('overview');
              window.location.hash = 'overview';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98 ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-blue-600" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              window.location.hash = 'history';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>History</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              window.location.hash = 'settings';
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98 ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-700" />
            <span>Settings</span>
          </button>
        </div>

        {/* Tab Views */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
            Loading LocalGuard data...
          </div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <OverviewTab
                stats={stats}
                history={history}
                guardedSites={settings.guardedSites}
                settings={settings}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab history={history} settings={settings} />
            )}
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
