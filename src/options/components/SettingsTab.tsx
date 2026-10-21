import React, { useState } from 'react';
import { UserSettings } from '../../shared/types';
import {
  exportDataAsJson,
  importDataFromJson,
  clearHistory,
  resetStatistics,
  updateSettings,
} from '../../storage/storage';
import {
  Save,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Bell,
  Clock,
  Layout,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface SettingsTabProps {
  settings: UserSettings;
  onSettingsUpdated: (newSettings: UserSettings) => void;
  onDataReset: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSettingsUpdated,
  onDataReset,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [presetInput, setPresetInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    try {
      const updated = await updateSettings(localSettings);
      onSettingsUpdated(updated);
      showStatus('Settings saved successfully!');
    } catch (err) {
      showStatus('Failed to save settings.', true);
    }
  };

  const handleResetHudPosition = async () => {
    const updated = {
      ...localSettings,
      hudPosition: { right: 20, bottom: 20 },
    };
    setLocalSettings(updated);
    await updateSettings(updated);
    onSettingsUpdated(updated);
    showStatus('HUD position reset to default (bottom-right 20px).');
  };

  const handleAddPreset = () => {
    const parsed = parseInt(presetInput, 10);
    if (!isNaN(parsed) && parsed > 0 && !localSettings.durationPresets.includes(parsed)) {
      const nextPresets = [...localSettings.durationPresets, parsed].sort((a, b) => a - b);
      setLocalSettings({ ...localSettings, durationPresets: nextPresets });
      setPresetInput('');
    }
  };

  const handleRemovePreset = (val: number) => {
    const nextPresets = localSettings.durationPresets.filter((p) => p !== val);
    setLocalSettings({ ...localSettings, durationPresets: nextPresets });
  };

  const handleExportJson = async () => {
    const jsonStr = await exportDataAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifesolver_focus_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus('JSON backup exported successfully.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importDataFromJson(content);
      if (res.success) {
        showStatus(`Backup imported successfully! (${res.count} sessions loaded)`);
        onDataReset();
      } else {
        showStatus(`Import failed: ${res.error}`, true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const handleClearHistoryConfirm = async () => {
    if (window.confirm('Are you sure you want to permanently clear all session history? This cannot be undone.')) {
      await clearHistory();
      onDataReset();
      showStatus('Session history cleared.');
    }
  };

  const handleResetStatsConfirm = async () => {
    if (window.confirm('Are you sure you want to reset all focus statistics and counters to zero?')) {
      await resetStatistics();
      onDataReset();
      showStatus('All focus statistics reset.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in text-sm">
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 ${
            statusMessage.isError
              ? 'bg-red-500/15 border-red-500/30 text-red-200'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          }`}
        >
          {statusMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* General Session Defaults */}
      <div className="p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Session Defaults</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Default Session Duration (minutes)
            </label>
            <input
              type="number"
              min={localSettings.minDurationMinutes}
              max={localSettings.maxDurationMinutes}
              value={localSettings.defaultDurationMinutes}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  defaultDurationMinutes: parseInt(e.target.value, 10) || 15,
                })
              }
              className="w-full px-3 py-2 bg-[#171c2b] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Warning Alert Threshold (minutes remaining)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={localSettings.warningThresholdMinutes}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  warningThresholdMinutes: parseInt(e.target.value, 10) || 5,
                })
              }
              className="w-full px-3 py-2 bg-[#171c2b] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Presets Manager */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <label className="block text-xs text-slate-400">Duration Presets</label>
          <div className="flex flex-wrap gap-2">
            {localSettings.durationPresets.map((preset) => (
              <span
                key={preset}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#171c2b] border border-white/10 text-xs font-mono text-slate-200"
              >
                <span>{preset}m</span>
                <button
                  type="button"
                  onClick={() => handleRemovePreset(preset)}
                  className="text-slate-500 hover:text-red-400 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="number"
              placeholder="Add mins (e.g. 20)"
              value={presetInput}
              onChange={(e) => setPresetInput(e.target.value)}
              className="w-36 px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddPreset}
              className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium"
            >
              Add Preset
            </button>
          </div>
        </div>
      </div>

      {/* Notifications & Audio */}
      <div className="p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span>Audio & Notifications</span>
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-200 text-xs">Sound notification on expiry</div>
            <div className="text-[11px] text-slate-400">
              Plays an offline harmonic chime synthesized with the Web Audio API.
            </div>
          </div>
          <input
            type="checkbox"
            checked={localSettings.soundNotifications}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, soundNotifications: e.target.checked })
            }
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
          />
        </div>

        {localSettings.soundNotifications && (
          <div className="pt-2 border-t border-white/5 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Chime Volume</span>
              <span className="font-mono">{Math.round(localSettings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={localSettings.soundVolume}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, soundVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* HUD & Interface */}
      <div className="p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Layout className="w-4 h-4 text-amber-400" />
          <span>HUD & Ergonomics</span>
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-200 text-xs">Reset HUD Screen Position</div>
            <div className="text-[11px] text-slate-400">
              Returns the floating HUD to the default bottom-right offset (20px, 20px).
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetHudPosition}
            className="px-3 py-1.5 bg-[#171c2b] hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white"
          >
            Reset Position
          </button>
        </div>

        <div className="pt-2 border-t border-white/5">
          <label className="block text-xs text-slate-400 mb-1">Reduced Motion</label>
          <select
            value={localSettings.reducedMotion}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, reducedMotion: e.target.value as any })
            }
            className="w-full sm:w-60 px-2.5 py-1.5 bg-[#171c2b] border border-white/10 rounded-lg text-white text-xs focus:outline-none"
          >
            <option value="system">Follow System Setting</option>
            <option value="always">Always Reduce Motion</option>
            <option value="never">Standard Animations</option>
          </select>
        </div>
      </div>

      {/* Save Button for Settings */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveSettings}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm flex items-center space-x-2 shadow-lg shadow-blue-600/25 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {/* Data Management Section */}
      <div className="p-5 bg-[#141824] border border-white/5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <span>Local Storage & Backup</span>
        </h3>
        <p className="text-xs text-slate-400">
          All records remain strictly inside your local browser via <code className="text-blue-300 font-mono">chrome.storage.local</code>. No cloud sync, external databases, or analytics are used.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="p-3 bg-[#171c2b] hover:bg-white/5 border border-white/10 rounded-xl text-left flex items-center space-x-3 transition-colors"
          >
            <Download className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Export Backup (JSON)</div>
              <div className="text-[11px] text-slate-400">Download complete dataset backup</div>
            </div>
          </button>

          {/* Import JSON */}
          <label className="p-3 bg-[#171c2b] hover:bg-white/5 border border-white/10 rounded-xl text-left flex items-center space-x-3 transition-colors cursor-pointer">
            <Upload className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Import Backup (JSON)</div>
              <div className="text-[11px] text-slate-400">Restore from previously exported file</div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-white/5 space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400">
            Danger Zone
          </h4>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleClearHistoryConfirm}
              className="px-3.5 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Session History</span>
            </button>

            <button
              type="button"
              onClick={handleResetStatsConfirm}
              className="px-3.5 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset All Statistics</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
