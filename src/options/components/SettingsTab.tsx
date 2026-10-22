import React, { useState, useEffect } from 'react';
import { UserSettings, GuardedSite } from '../../shared/types';
import {
  exportDataAsJson,
  importDataFromJson,
  exportHistoryAsCsv,
  importHistoryFromCsv,
  exportHistoryAsXml,
  importHistoryFromXml,
  generateHistoryPdfReport,
  clearHistory,
  resetStatistics,
  updateSettings,
  resetAllSettings,
  getGuardedSites,
  addGuardedSite,
  toggleGuardedSite,
  deleteGuardedSite,
  getHistory,
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
  Shield,
  Plus,
  FileSpreadsheet,
  FileText,
  Code,
  RotateCcw,
  Volume2,
  Globe,
  Sun,
  Moon,
  Contrast,
} from 'lucide-react';

interface SettingsTabProps {
  settings: UserSettings;
  onSettingsUpdated: (newSettings: UserSettings) => void;
  onDataReset: () => void;
}

const BORDER_COLOR_PALETTE = [
  { label: 'System Blue', value: '#007AFF' },
  { label: 'Emerald', value: '#34C759' },
  { label: 'Purple', value: '#AF52DE' },
  { label: 'Orange', value: '#FF9500' },
  { label: 'Red', value: '#FF3B30' },
  { label: 'Silver', value: '#94A3B8' },
];

const SITE_COLOR_PALETTE = [
  '#007AFF', // Blue
  '#34C759', // Emerald
  '#AF52DE', // Purple
  '#FF9500', // Orange
  '#FF3B30', // Red
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#64748B', // Slate
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSettingsUpdated,
  onDataReset,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [guardedSites, setGuardedSites] = useState<GuardedSite[]>(settings.guardedSites || []);
  const [presetInput, setPresetInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // New site form inputs
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('#007AFF');
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Sync state if settings prop changes externally
  useEffect(() => {
    setLocalSettings(settings);
    if (settings.guardedSites) {
      setGuardedSites(settings.guardedSites);
    }
  }, [settings]);

  // Initial load of guarded sites from storage
  const refreshGuardedSites = async () => {
    try {
      const sites = await getGuardedSites();
      setGuardedSites(sites);
      setLocalSettings((prev) => ({ ...prev, guardedSites: sites }));
    } catch (err) {
      console.error('Failed to refresh guarded sites:', err);
    }
  };

  useEffect(() => {
    refreshGuardedSites();
  }, []);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 4500);
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

  // --- Guarded Sites Actions ---

  const handleToggleSite = async (siteId: string, enabled: boolean) => {
    try {
      await toggleGuardedSite(siteId, enabled);
      await refreshGuardedSites();
      showStatus(`Site ${enabled ? 'enabled' : 'paused'}.`);
    } catch (err) {
      showStatus('Failed to update site status.', true);
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove "${siteName}" from guarded websites? LocalGuard will no longer prompt or track focus on this site.`
      )
    ) {
      try {
        await deleteGuardedSite(siteId);
        await refreshGuardedSites();
        showStatus(`Removed "${siteName}" from guarded websites.`);
      } catch (err) {
        showStatus('Failed to delete site.', true);
      }
    }
  };

  const handleAddCustomSite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let domain = newDomainInput.trim().toLowerCase();
    // Clean domain: strip protocol, www, trailing slashes and paths
    domain = domain
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .trim();

    if (!domain) {
      showStatus('Please enter a valid website domain.', true);
      return;
    }

    // Check for duplicate domain
    const exists = guardedSites.some(
      (s) => s.domain.toLowerCase() === domain || s.id.toLowerCase() === domain
    );
    if (exists) {
      showStatus(`Website "${domain}" is already in your guarded list.`, true);
      return;
    }

    const defaultName = domain.split('.')[0];
    const capitalizedDefault = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    const finalName = newNameInput.trim() || capitalizedDefault;

    const newSite: GuardedSite = {
      id: domain.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || `site-${Date.now()}`,
      domain,
      name: finalName,
      enabled: true,
      addedAt: Date.now(),
      customColor: newColorInput,
    };

    try {
      await addGuardedSite(newSite);
      await refreshGuardedSites();
      setNewDomainInput('');
      setNewNameInput('');
      setIsAddingSite(false);
      showStatus(`Added "${finalName}" (${domain}) to guarded websites.`);
    } catch (err) {
      showStatus('Failed to add guarded site.', true);
    }
  };

  // --- HUD Actions ---

  const handleResetHudPositionAndSize = async () => {
    const updated: UserSettings = {
      ...localSettings,
      hudPosition: { right: 20, bottom: 20 },
      hudDimensions: { width: 400, height: 460 },
    };
    setLocalSettings(updated);
    await updateSettings(updated);
    onSettingsUpdated(updated);
    showStatus('HUD position & size reset to default (bottom-right 20px, 400×460).');
  };

  // --- Presets Actions ---

  const handleAddPreset = () => {
    const parsed = parseInt(presetInput, 10);
    if (!isNaN(parsed) && parsed > 0 && !localSettings.durationPresets.includes(parsed)) {
      const nextPresets = [...localSettings.durationPresets, parsed].sort((a, b) => a - b);
      const updated = { ...localSettings, durationPresets: nextPresets };
      setLocalSettings(updated);
      setPresetInput('');
    }
  };

  const handleRemovePreset = (val: number) => {
    const nextPresets = localSettings.durationPresets.filter((p) => p !== val);
    setLocalSettings({ ...localSettings, durationPresets: nextPresets });
  };

  // --- Multi-Format Export Actions ---

  const handleExportCsv = async () => {
    try {
      const csvStr = await exportHistoryAsCsv();
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `localguard_history_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('CSV history exported successfully.');
    } catch (err) {
      showStatus('Failed to export CSV.', true);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const history = await getHistory();
      const htmlReport = generateHistoryPdfReport(history);
      const blob = new Blob([htmlReport], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
        showStatus('Printable PDF report opened in a new tab.');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `localguard_report_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showStatus('Report downloaded. Open and press Ctrl+P / Cmd+P to save as PDF.');
      }
    } catch (err) {
      showStatus('Failed to generate PDF report.', true);
    }
  };

  const handleExportXml = async () => {
    try {
      const xmlStr = await exportHistoryAsXml();
      const blob = new Blob([xmlStr], { type: 'application/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `localguard_history_${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('XML history exported successfully.');
    } catch (err) {
      showStatus('Failed to export XML.', true);
    }
  };

  const handleExportJson = async () => {
    try {
      const jsonStr = await exportDataAsJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `localguard_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('JSON backup exported successfully.');
    } catch (err) {
      showStatus('Failed to export JSON.', true);
    }
  };

  // --- Multi-Format Import Action with Auto-Detection ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        showStatus('The selected file is empty.', true);
        return;
      }

      setIsImporting(true);
      try {
        let result: { success: boolean; count?: number; error?: string };

        // Auto-detect format by extension or payload content
        if (
          fileName.endsWith('.json') ||
          content.trim().startsWith('{') ||
          content.trim().startsWith('[')
        ) {
          result = await importDataFromJson(content);
        } else if (
          fileName.endsWith('.xml') ||
          content.includes('<focusGuardHistory') ||
          content.includes('<?xml') ||
          content.includes('<session>')
        ) {
          result = await importHistoryFromXml(content);
        } else if (
          fileName.endsWith('.csv') ||
          content.includes('ID,Date,Site') ||
          content.includes('Planned Duration')
        ) {
          result = await importHistoryFromCsv(content);
        } else {
          // Fallback heuristic: try JSON, then XML, then CSV
          try {
            JSON.parse(content);
            result = await importDataFromJson(content);
          } catch {
            if (content.includes('<') && content.includes('>')) {
              result = await importHistoryFromXml(content);
            } else {
              result = await importHistoryFromCsv(content);
            }
          }
        }

        if (result.success) {
          showStatus(`Imported successfully! (${result.count ?? 0} sessions loaded)`);
          onDataReset();
          await refreshGuardedSites();
        } else {
          showStatus(`Import failed: ${result.error || 'Invalid file format'}`, true);
        }
      } catch (err) {
        showStatus(
          `Import error: ${err instanceof Error ? err.message : 'File parsing error'}`,
          true
        );
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow re-upload
  };

  // --- Danger Zone Actions ---

  const handleClearHistoryConfirm = async () => {
    if (
      window.confirm(
        'Are you sure you want to permanently clear all session history? This cannot be undone.'
      )
    ) {
      await clearHistory();
      onDataReset();
      showStatus('Session history cleared successfully.');
    }
  };

  const handleResetSettingsConfirm = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset all settings to defaults? Your HUD colors, presets, and guarded site preferences will be restored to initial defaults.'
      )
    ) {
      try {
        const restored = await resetAllSettings();
        setLocalSettings(restored);
        onSettingsUpdated(restored);
        await refreshGuardedSites();
        showStatus('All settings have been restored to initial defaults.');
      } catch (err) {
        showStatus('Failed to reset settings.', true);
      }
    }
  };

  const handleResetStatsConfirm = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset all focus statistics and canceled prompt counters to zero?'
      )
    ) {
      await resetStatistics();
      onDataReset();
      showStatus('All focus statistics and counters reset.');
    }
  };

  const currentHudColor = localSettings.hudBorderColor || '#007AFF';
  const currentHudTheme = localSettings.hudThemeAdaptation || 'auto';
  const activeSitesCount = guardedSites.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6 max-w-4xl text-sm font-sans tracking-tight">
      {/* Toast Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            statusMessage.isError
              ? 'bg-red-50/90 border-red-200 text-red-800'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            {statusMessage.isError ? (
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="font-medium text-xs sm:text-sm">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Save Button Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Preferences & System Control</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure intentional site guards, HUD aesthetics, presets, and offline data backups.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          className="px-5 py-2.5 bg-[#007AFF] hover:bg-[#0062cc] text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-[0.98]"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. GUARDED WEBSITES MANAGER SECTION                          */}
      {/* ============================================================ */}
      <div className="p-6 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#007AFF] flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Guarded Websites
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200/60">
                  {activeSitesCount} active / {guardedSites.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Websites where intentional purpose prompts and floating HUD are actively enforced.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingSite(!isAddingSite)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              isAddingSite
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingSite ? 'Close Form' : 'Add Custom Website'}</span>
          </button>
        </div>

        {/* Add Custom Website Inline Form */}
        {isAddingSite && (
          <form
            onSubmit={handleAddCustomSite}
            className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>Add New Guarded Website</span>
              </div>
              <span className="text-[11px] text-slate-400">Supported format: domain.com</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Website Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. reddit.com, x.com, instagram.com"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Display Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reddit, X / Twitter"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
                />
              </div>
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Site Accent Color
              </label>
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {SITE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColorInput(color)}
                    className={`w-6 h-6 rounded-full transition-all relative flex items-center justify-center ${
                      newColorInput.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {newColorInput.toLowerCase() === color.toLowerCase() && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                ))}

                {/* Native Color Picker for custom Hex */}
                <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
                  <input
                    type="color"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Custom Hex Color"
                  />
                  <span className="font-mono text-xs text-slate-500 uppercase">{newColorInput}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingSite(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#007AFF] hover:bg-[#0062cc] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Site to Guard</span>
              </button>
            </div>
          </form>
        )}

        {/* Guarded Sites List Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {guardedSites.map((site) => (
            <div
              key={site.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                site.enabled
                  ? 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300 shadow-xs'
                  : 'bg-slate-50/30 border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0 pr-2">
                {/* Site Color Dot */}
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs ring-2 ring-white"
                  style={{ backgroundColor: site.customColor || '#007AFF' }}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                    {site.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate flex items-center space-x-1">
                    <span>{site.domain}</span>
                    {site.enabled ? (
                      <span className="text-[10px] text-emerald-600 font-sans font-medium">
                        • Guard Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-sans font-medium">
                        • Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggle Switch & Delete Action */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Apple Style Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={site.enabled}
                  onClick={() => handleToggleSite(site.id, !site.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    site.enabled ? 'bg-[#34C759]' : 'bg-slate-200'
                  }`}
                  title={site.enabled ? 'Pause guarding' : 'Enable guarding'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      site.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteSite(site.id, site.name)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title={`Delete ${site.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {guardedSites.length === 0 && (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No guarded websites yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click &quot;Add Custom Website&quot; above to add your first domain.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. HUD CUSTOMIZER & ERGONOMICS                               */}
      {/* ============================================================ */}
      <div className="p-6 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#AF52DE] flex items-center justify-center shadow-xs">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Floating HUD Customizer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize border colors, auto-contrast glass themes, and screen ergonomics.
            </p>
          </div>
        </div>

        {/* Selectable Border Color Swatches */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-800">
                HUD Border & Accent Color
              </label>
              <p className="text-[11px] text-slate-500">
                Select from official Apple system tints or choose a custom hex tone.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className="w-4 h-4 rounded-full ring-2 ring-slate-200 shadow-xs"
                style={{ backgroundColor: currentHudColor }}
              />
              <span className="font-mono text-xs font-medium text-slate-700 uppercase">
                {currentHudColor}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {BORDER_COLOR_PALETTE.map((swatch) => {
              const isSelected = currentHudColor.toLowerCase() === swatch.value.toLowerCase();
              return (
                <button
                  key={swatch.value}
                  type="button"
                  onClick={() =>
                    setLocalSettings({ ...localSettings, hudBorderColor: swatch.value })
                  }
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: swatch.value }}
                  />
                  <span>{swatch.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                </button>
              );
            })}

            {/* Custom Hex Color Picker Input */}
            <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
              <input
                type="color"
                value={currentHudColor}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, hudBorderColor: e.target.value })
                }
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                title="Custom Color Picker"
              />
              <span className="text-[11px] text-slate-500 font-medium">Custom</span>
            </div>
          </div>
        </div>

        {/* HUD Theme Adaptation Selector */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              HUD Theme Adaptation
            </label>
            <p className="text-[11px] text-slate-500">
              Controls contrast against underlying web page backgrounds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Auto Contrast Card */}
            <button
              type="button"
              onClick={() =>
                setLocalSettings({ ...localSettings, hudThemeAdaptation: 'auto' })
              }
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                currentHudTheme === 'auto'
                  ? 'border-[#007AFF] bg-blue-50/40 ring-2 ring-[#007AFF]/20 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Contrast
                  className={`w-4 h-4 ${
                    currentHudTheme === 'auto' ? 'text-[#007AFF]' : 'text-slate-500'
                  }`}
                />
                {currentHudTheme === 'auto' && (
                  <Check className="w-3.5 h-3.5 text-[#007AFF]" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Auto-Contrast</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  White on dark sites, Dark on light sites
                </div>
              </div>
            </button>

            {/* Always Light Glass Card */}
            <button
              type="button"
              onClick={() =>
                setLocalSettings({ ...localSettings, hudThemeAdaptation: 'light' })
              }
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                currentHudTheme === 'light'
                  ? 'border-[#007AFF] bg-blue-50/40 ring-2 ring-[#007AFF]/20 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Sun
                  className={`w-4 h-4 ${
                    currentHudTheme === 'light' ? 'text-[#007AFF]' : 'text-slate-500'
                  }`}
                />
                {currentHudTheme === 'light' && (
                  <Check className="w-3.5 h-3.5 text-[#007AFF]" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Always Light Glass</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Frosted translucent white backdrop
                </div>
              </div>
            </button>

            {/* Always Dark Glass Card */}
            <button
              type="button"
              onClick={() =>
                setLocalSettings({ ...localSettings, hudThemeAdaptation: 'dark' })
              }
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                currentHudTheme === 'dark'
                  ? 'border-[#007AFF] bg-blue-50/40 ring-2 ring-[#007AFF]/20 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Moon
                  className={`w-4 h-4 ${
                    currentHudTheme === 'dark' ? 'text-[#007AFF]' : 'text-slate-500'
                  }`}
                />
                {currentHudTheme === 'dark' && (
                  <Check className="w-3.5 h-3.5 text-[#007AFF]" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Always Dark Glass</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Frosted translucent midnight backdrop
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Live HUD Mini Mockup Preview */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Live HUD Preview
          </label>
          <div
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              currentHudTheme === 'dark'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-900 shadow-sm'
            }`}
            style={{
              borderColor: currentHudColor,
              boxShadow: `0 4px 20px -2px ${currentHudColor}25`,
            }}
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: `${currentHudColor}20`, color: currentHudColor }}
              >
                12m
              </div>
              <div>
                <div className="text-xs font-bold">Researching React Architecture</div>
                <div
                  className={`text-[11px] ${
                    currentHudTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  2 of 3 tasks checked • Active
                </div>
              </div>
            </div>

            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: currentHudColor, color: '#ffffff' }}
            >
              Guarded
            </span>
          </div>
        </div>

        {/* HUD Dimensions & Custom Sizing System */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-800">
                Custom HUD Sizing & Dimensions
              </label>
              <p className="text-[11px] text-slate-500">
                Adjust width and height so all tasks, timer, and usage meters fit comfortably.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#007AFF] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {localSettings.hudDimensions?.width || 400}px × {localSettings.hudDimensions?.height || 460}px
            </span>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Compact', desc: '340 × 380 px', w: 340, h: 380 },
              { label: 'Standard', desc: '400 × 460 px (Rec)', w: 400, h: 460 },
              { label: 'Spacious', desc: '480 × 560 px', w: 480, h: 560 },
              { label: 'Tall', desc: '400 × 640 px', w: 400, h: 640 },
            ].map((preset) => {
              const isSelected =
                localSettings.hudDimensions?.width === preset.w &&
                localSettings.hudDimensions?.height === preset.h;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      hudDimensions: { width: preset.w, height: preset.h },
                    })
                  }
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-[#007AFF] bg-blue-50/50 ring-2 ring-[#007AFF]/20 text-slate-900 font-bold'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{preset.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Width & Height Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">HUD Width</span>
                <span className="font-mono font-bold text-slate-900">
                  {localSettings.hudDimensions?.width || 400}px
                </span>
              </div>
              <input
                type="range"
                min="320"
                max="750"
                step="10"
                value={localSettings.hudDimensions?.width || 400}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    hudDimensions: {
                      width: parseInt(e.target.value, 10),
                      height: localSettings.hudDimensions?.height || 460,
                    },
                  })
                }
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>320px</span>
                <span>750px</span>
              </div>
            </div>

            <div className="space-y-1 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">HUD Height</span>
                <span className="font-mono font-bold text-slate-900">
                  {localSettings.hudDimensions?.height || 460}px
                </span>
              </div>
              <input
                type="range"
                min="340"
                max="800"
                step="10"
                value={localSettings.hudDimensions?.height || 460}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    hudDimensions: {
                      width: localSettings.hudDimensions?.width || 400,
                      height: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>340px</span>
                <span>800px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Position Reset & Ergonomics */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900 text-xs">
              Reset Floating HUD Position & Size
            </div>
            <div className="text-[11px] text-slate-500">
              Restores the in-page widget to bottom-right corner (offset 20px, 400×460 dimensions).
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetHudPositionAndSize}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Position & Size</span>
          </button>
        </div>

        {/* Reduced Motion Setting */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900 text-xs">Reduced Motion & Animations</div>
            <div className="text-[11px] text-slate-500">
              Minimizes floating transitions and spring physics for accessibility.
            </div>
          </div>
          <select
            value={localSettings.reducedMotion}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, reducedMotion: e.target.value as any })
            }
            className="w-full sm:w-56 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#007AFF]"
          >
            <option value="system">Follow System Setting</option>
            <option value="always">Always Reduce Motion</option>
            <option value="never">Standard Fluid Animations</option>
          </select>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. SESSION DEFAULTS & DURATION PRESETS                       */}
      {/* ============================================================ */}
      <div className="p-6 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl space-y-5">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Session Timing & Presets
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Default countdown values and quick-pick durations offered when entering sites.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white"
            />
          </div>
        </div>

        {/* Presets List */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-700">
            Quick-Select Duration Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {localSettings.durationPresets.map((preset) => (
              <span
                key={preset}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-medium text-slate-800"
              >
                <span>{preset}m</span>
                <button
                  type="button"
                  onClick={() => handleRemovePreset(preset)}
                  className="text-slate-400 hover:text-red-500 font-bold ml-1 transition-colors"
                  title="Remove preset"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center space-x-2 pt-1.5">
            <input
              type="number"
              placeholder="Add mins (e.g. 20)"
              value={presetInput}
              onChange={(e) => setPresetInput(e.target.value)}
              className="w-40 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#007AFF] focus:bg-white"
            />
            <button
              type="button"
              onClick={handleAddPreset}
              className="px-3.5 py-1.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30 rounded-xl text-xs font-semibold transition-colors"
            >
              Add Preset
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. AUDIO & NOTIFICATIONS                                     */}
      {/* ============================================================ */}
      <div className="p-6 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl space-y-5">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Audio & Notifications
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Harmonic chimes generated offline via the native Web Audio API.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-900 text-xs">
              Sound Chime on Session Expiry
            </div>
            <div className="text-[11px] text-slate-500">
              Plays a gentle harmonic alert when your focus duration expires.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localSettings.soundNotifications}
            onClick={() =>
              setLocalSettings({
                ...localSettings,
                soundNotifications: !localSettings.soundNotifications,
              })
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              localSettings.soundNotifications ? 'bg-[#34C759]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                localSettings.soundNotifications ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {localSettings.soundNotifications && (
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center space-x-1.5">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Chime Volume</span>
              </span>
              <span className="font-mono text-slate-800">
                {Math.round(localSettings.soundVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={localSettings.soundVolume}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  soundVolume: parseFloat(e.target.value),
                })
              }
              className="w-full accent-[#007AFF] cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. MULTI-FORMAT DATA HUB (DOWNLOAD & UPLOAD)                 */}
      {/* ============================================================ */}
      <div className="p-6 bg-white text-slate-900 border border-slate-200/80 shadow-sm rounded-2xl space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#34C759] flex items-center justify-center shadow-xs">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Multi-Format Data Hub (Export & Import)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              100% offline data portability. Export or restore your session records across CSV, PDF, XML, or JSON.
            </p>
          </div>
        </div>

        {/* 4 Download / Export Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">
            Download & Export Formats
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-start space-x-3 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <span>Download CSV</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Spreadsheet format for Excel, Google Sheets, or Apple Numbers.
                </div>
              </div>
            </button>

            {/* PDF Report Export */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-start space-x-3 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <span>Download PDF Report</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Formatted audit summary ready for printing or saving to PDF.
                </div>
              </div>
            </button>

            {/* XML Export */}
            <button
              type="button"
              onClick={handleExportXml}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-start space-x-3 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Code className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <span>Download XML</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Hierarchical schema for programmatic analysis and enterprise pipelines.
                </div>
              </div>
            </button>

            {/* JSON Export */}
            <button
              type="button"
              onClick={handleExportJson}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-start space-x-3 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <span>Download JSON</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Complete dataset backup including all settings and guarded sites.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Upload & Restore Section */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Upload & Restore Data (.json, .csv, .xml)
          </label>
          <p className="text-[11px] text-slate-500">
            Select any previously exported file. The format is automatically detected and parsed.
          </p>

          <label className="p-4 bg-slate-50 hover:bg-slate-100/80 border-2 border-dashed border-slate-200 hover:border-[#007AFF]/50 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007AFF] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-900">
              {isImporting ? 'Parsing and restoring dataset...' : 'Click to Upload or Drag and Drop File'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Supports <span className="font-mono text-slate-700 font-semibold">.json</span>,{' '}
              <span className="font-mono text-slate-700 font-semibold">.csv</span>, or{' '}
              <span className="font-mono text-slate-700 font-semibold">.xml</span> files
            </div>
            <input
              type="file"
              accept=".json,.csv,.xml"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. DATA RESET & DANGER ZONE                                  */}
      {/* ============================================================ */}
      <div className="p-6 bg-red-50/30 border border-red-200/80 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2 text-red-900 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>Danger Zone & Reset Controls</span>
        </div>
        <p className="text-xs text-red-700/90 leading-relaxed">
          Actions here permanently delete your local records or reset customizations. Because
          LocalGuard is strictly offline, deleted data cannot be recovered unless you hold an exported backup.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          {/* Clear Session History */}
          <button
            type="button"
            onClick={handleClearHistoryConfirm}
            className="px-4 py-2.5 border border-red-300 bg-white hover:bg-red-50 text-red-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>Clear Session History</span>
          </button>

          {/* Reset All Settings to Defaults */}
          <button
            type="button"
            onClick={handleResetSettingsConfirm}
            className="px-4 py-2.5 border border-red-300 bg-white hover:bg-red-50 text-red-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-600" />
            <span>Reset Settings to Defaults</span>
          </button>

          {/* Reset All Statistics */}
          <button
            type="button"
            onClick={handleResetStatsConfirm}
            className="px-4 py-2.5 border border-red-300 bg-white hover:bg-red-50 text-red-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-red-600" />
            <span>Reset All Statistics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
