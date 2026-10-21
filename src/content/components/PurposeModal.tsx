import React, { useState } from 'react';
import { SiteId, FocusSession, UserSettings, TaskItem } from '../../shared/types';
import {
  Shield,
  Target,
  Clock,
  Plus,
  Trash2,
  Bell,
  BellOff,
  BarChart2,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PurposeModalProps {
  site: SiteId;
  settings: UserSettings;
  onStartSession: (session: FocusSession) => void;
  onCancel: () => void;
  onOpenStatistics: () => void;
}

export const PurposeModal: React.FC<PurposeModalProps> = ({
  site,
  settings,
  onStartSession,
  onCancel,
  onOpenStatistics,
}) => {
  const [purpose, setPurpose] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(settings.defaultDurationMinutes || 15);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(settings.soundNotifications);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presets = settings.durationPresets && settings.durationPresets.length > 0
    ? settings.durationPresets
    : [5, 10, 15, 25, 30, 45, 60];

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = taskInput.trim();
    if (!trimmed) return;

    // Check duplicate
    if (tasks.some((t) => t.text.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage('Task already added.');
      return;
    }

    const newTask: TaskItem = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      text: trimmed,
      completed: false,
    };

    setTasks([...tasks, newTask]);
    setTaskInput('');
    setErrorMessage(null);
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  const handleSelectPreset = (minutes: number) => {
    setSelectedMinutes(minutes);
    setIsCustomDuration(false);
    setErrorMessage(null);
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomMinutes(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= settings.minDurationMinutes && parsed <= settings.maxDurationMinutes) {
      setSelectedMinutes(parsed);
      setErrorMessage(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPurpose = purpose.trim();
    if (!trimmedPurpose) {
      setErrorMessage('Please state your purpose before starting.');
      return;
    }

    let finalMinutes = selectedMinutes;
    if (isCustomDuration) {
      const parsed = parseInt(customMinutes, 10);
      if (isNaN(parsed) || parsed < settings.minDurationMinutes || parsed > settings.maxDurationMinutes) {
        setErrorMessage(`Please choose a duration between ${settings.minDurationMinutes} and ${settings.maxDurationMinutes} minutes.`);
        return;
      }
      finalMinutes = parsed;
    }

    const durationMs = finalMinutes * 60 * 1000;
    const now = Date.now();

    // If user typed in task input without clicking Enter/Add, auto-include it
    let finalTasks = [...tasks];
    if (taskInput.trim()) {
      finalTasks.push({
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        text: taskInput.trim(),
        completed: false,
      });
    }

    // If no explicit tasks were created, create a default primary task from purpose
    if (finalTasks.length === 0) {
      finalTasks.push({
        id: 'task_' + Date.now() + '_main',
        text: trimmedPurpose,
        completed: false,
      });
    }

    const newSession: FocusSession = {
      id: 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      site,
      purpose: trimmedPurpose,
      tasks: finalTasks,
      startTime: now,
      allocatedDurationMs: durationMs,
      deadlineTime: now + durationMs,
      status: 'active',
      lastUpdateTime: now,
      actualDurationMs: 0,
      sessionLabel: sessionLabel.trim() || undefined,
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: finalTasks.length,
    };

    onStartSession(newSession);
  };

  return (
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      <div
        className="w-full max-w-xl bg-[#10141f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  LifeSolver Focus Guard
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 capitalize font-mono">
                  {site}
                </span>
              </div>
              <h2 id="modal-title" className="text-xl font-bold text-white tracking-tight mt-0.5">
                Why are you here?
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Cancel and dismiss"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-300">
            Every minute has a purpose. Decide yours before you continue browsing.
          </p>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center space-x-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Purpose Input */}
          <div className="space-y-2">
            <label htmlFor="focus-purpose-input" className="block text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Target className="w-4 h-4 text-blue-400" />
              <span>Primary Purpose <span className="text-red-400">*</span></span>
            </label>
            <input
              id="focus-purpose-input"
              type="text"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={site === 'youtube' ? 'e.g. Watch a tutorial on systems architecture...' : 'e.g. Reply to work group message...'}
              className="w-full px-4 py-3 bg-[#171c2b] border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
              autoFocus
              required
            />
          </div>

          {/* Planned Tasks */}
          <div className="space-y-2.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Actionable Tasks</span>
              </span>
              <span className="text-slate-400 text-[11px] lowercase">({tasks.length} added)</span>
            </label>

            {/* Add Task Input Row */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                placeholder="Add a specific task to accomplish..."
                className="flex-1 px-3.5 py-2.5 bg-[#171c2b] border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => handleAddTask()}
                className="px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-sm font-medium transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Task List */}
            {tasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {tasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2.5 bg-[#141824] border border-white/5 rounded-lg text-sm text-slate-200 group hover:border-white/15 transition-all"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                        {idx + 1}
                      </span>
                      <span className="truncate">{task.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
                      title="Remove task"
                      aria-label="Remove task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Allocation */}
          <div className="space-y-2.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Time Allocation</span>
              </span>
              <span className="text-cyan-400 font-mono text-sm font-bold">
                {selectedMinutes} {selectedMinutes === 1 ? 'min' : 'mins'}
              </span>
            </label>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {presets.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSelectPreset(mins)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-medium transition-all ${
                    !isCustomDuration && selectedMinutes === mins
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 border border-blue-400'
                      : 'bg-[#171c2b] text-slate-300 border border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            {/* Custom Duration Toggle & Input */}
            <div className="pt-1 flex items-center space-x-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsCustomDuration(!isCustomDuration);
                  if (!isCustomDuration) {
                    setCustomMinutes(selectedMinutes.toString());
                  }
                }}
                className={`text-slate-300 hover:text-white underline underline-offset-4 transition-colors ${
                  isCustomDuration ? 'text-blue-400 font-medium' : ''
                }`}
              >
                {isCustomDuration ? 'Using custom duration' : 'Set custom duration...'}
              </button>

              {isCustomDuration && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <input
                    type="number"
                    min={settings.minDurationMinutes}
                    max={settings.maxDurationMinutes}
                    value={customMinutes}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                    placeholder="Mins"
                    className="w-20 px-2.5 py-1 bg-[#171c2b] border border-blue-500/50 rounded-lg text-white font-mono text-xs focus:outline-none"
                    autoFocus
                  />
                  <span className="text-slate-400">minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Optional Session Settings Accordion */}
          <div className="pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>{showAdvanced ? 'Hide additional session options' : 'Additional session options...'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3.5 bg-[#141824] rounded-xl border border-white/5 space-y-3 animate-slide-up text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Session Label (optional)</label>
                  <input
                    type="text"
                    value={sessionLabel}
                    onChange={(e) => setSessionLabel(e.target.value)}
                    placeholder="e.g. Deep Work, Research, Quick Catch-up"
                    className="w-full px-3 py-1.5 bg-[#10141f] border border-white/10 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300 flex items-center space-x-1.5">
                    {soundEnabled ? <Bell className="w-3.5 h-3.5 text-blue-400" /> : <BellOff className="w-3.5 h-3.5 text-slate-500" />}
                    <span>Sound notification on expiry</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onOpenStatistics}
                className="px-3 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-blue-400 hover:bg-white/5 text-sm transition-colors flex items-center space-x-1.5"
                title="View focus statistics and history"
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </button>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Start Focus Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
