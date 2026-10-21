import React, { useState, useEffect } from 'react';
import { SiteId, FocusSession, UserSettings, TaskItem } from '../../shared/types';
import {
  Shield,
  Target,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface PurposeModalProps {
  site: SiteId;
  settings: UserSettings;
  onStartSession: (session: FocusSession) => void;
  onCancel?: () => void;
  onLeaveSite?: () => void;
  onOpenStatistics?: () => void;
}

export const PurposeModal: React.FC<PurposeModalProps> = ({
  site,
  settings,
  onStartSession,
  onCancel,
  onLeaveSite,
}) => {
  const [purpose, setPurpose] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(settings.defaultDurationMinutes || 15);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [sessionMode, setSessionMode] = useState<'focus' | 'regular'>(
    settings.defaultMode || 'focus'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presets = [5, 10, 15, 25, 30, 45, 60];

  const siteDisplayName =
    site === 'youtube'
      ? 'YouTube'
      : site === 'facebook'
      ? 'Facebook'
      : site.charAt(0).toUpperCase() + site.slice(1);

  // Lock body scrolling while lockout overlay is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = taskInput.trim();
    if (!trimmed) return;

    if (tasks.some((t) => t.text.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage('Task already in checklist.');
      return;
    }

    const newTask: TaskItem = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      text: trimmed,
      completed: false,
    };

    setTasks((prev) => [...prev, newTask]);
    setTaskInput('');
    setErrorMessage(null);
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleSelectPreset = (minutes: number) => {
    setSelectedMinutes(minutes);
    setIsCustomDuration(false);
    setErrorMessage(null);
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomMinutes(val);
    const parsed = parseInt(val, 10);
    const min = settings.minDurationMinutes || 1;
    const max = settings.maxDurationMinutes || 180;
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      setSelectedMinutes(parsed);
      setErrorMessage(null);
    }
  };

  const handleLeaveSite = () => {
    if (onLeaveSite) {
      onLeaveSite();
    } else if (onCancel) {
      onCancel();
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'CLOSE_CURRENT_TAB' }, () => {
          if (chrome.runtime.lastError) {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = 'about:blank';
            }
          }
        });
        setTimeout(() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'about:blank';
          }
        }, 300);
        return;
      } catch {
        // Fallback
      }
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'about:blank';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPurpose = purpose.trim();
    if (!trimmedPurpose) {
      setErrorMessage('Please state your primary purpose before starting.');
      return;
    }

    let finalMinutes = selectedMinutes;
    if (isCustomDuration) {
      const parsed = parseInt(customMinutes, 10);
      const min = settings.minDurationMinutes || 1;
      const max = settings.maxDurationMinutes || 180;
      if (isNaN(parsed) || parsed < min || parsed > max) {
        setErrorMessage(`Please choose a duration between ${min} and ${max} minutes.`);
        return;
      }
      finalMinutes = parsed;
    }

    const durationMs = finalMinutes * 60 * 1000;
    const now = Date.now();

    const finalTasks: TaskItem[] = [...tasks];
    if (taskInput.trim()) {
      finalTasks.push({
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        text: taskInput.trim(),
        completed: false,
      });
    }

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
      wasExpired: false,
      tasksCompletedCount: 0,
      totalTasksCount: finalTasks.length,
      mode: sessionMode,
    };

    onStartSession(newSession);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 select-none antialiased text-slate-900"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        background: 'rgba(11, 15, 25, 0.80)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      }}
    >
      <div
        className="w-full max-w-lg bg-white/95 text-slate-900 border border-white/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] rounded-3xl overflow-hidden flex flex-col max-h-[92vh] backdrop-blur-2xl relative animate-lg-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Specular Inner Highlight */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />

        {/* Header Bar with Apple Squircle Shield Logo */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3.5">
            {/* New Apple Continuous Squircle Shield Logo */}
            <div className="w-12 h-12 rounded-[22px] bg-gradient-to-br from-[#007AFF] to-[#0051B3] flex items-center justify-center shadow-lg shadow-[#007AFF]/30 border border-white/40 flex-shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 pointer-events-none" />
              <Shield className="w-6 h-6 text-white drop-shadow-sm relative z-10" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold tracking-wider text-[#007AFF] uppercase">
                  Focus Guard
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold font-mono border border-slate-200">
                  {siteDisplayName}
                </span>
              </div>
              <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                Why are you visiting {siteDisplayName}?
              </h2>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Visiting guarded sites requires intentionality. Declare your focus purpose, target duration, and browsing mode to unlock the site.
          </p>

          {/* Mode Selector Segment: Focus Mode vs Regular Mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Browsing Mode
            </label>
            <div className="p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSessionMode('focus')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  sessionMode === 'focus'
                    ? 'bg-white text-[#007AFF] shadow-sm shadow-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>Focus Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setSessionMode('regular')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  sessionMode === 'regular'
                    ? 'bg-white text-amber-700 shadow-sm shadow-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Regular Mode</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 px-1">
              {sessionMode === 'focus'
                ? '🛡️ Strict Guard: Full-screen lockout when time stops or expires. Tab departures require a return timer.'
                : '⏱️ Passive Tracking: Subtle HUD timer reminder with gentle notifications.'}
            </p>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium animate-lg-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Purpose Input (Required) */}
          <div className="space-y-1.5">
            <label
              htmlFor="focus-purpose-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5"
            >
              <Target className="w-4 h-4 text-[#007AFF]" />
              <span>
                Primary Purpose <span className="text-red-500">*</span>
              </span>
            </label>
            <input
              id="focus-purpose-input"
              type="text"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={
                site === 'youtube'
                  ? 'e.g., Watch tutorial on Distributed Systems...'
                  : 'e.g., Send quick reply to project message...'
              }
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/25 focus:border-[#007AFF] text-sm transition-all"
              autoFocus
              required
            />
          </div>

          {/* Actionable Tasks Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#007AFF]" />
                <span>Actionable Tasks</span>
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} added
              </span>
            </div>

            {/* Task Add Row */}
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
                placeholder="Add actionable checklist item..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#007AFF] text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => handleAddTask()}
                className="px-4 py-2.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] active:bg-[#007AFF]/30 rounded-xl text-sm font-semibold transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Task Checklist Items */}
            {tasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 pt-1">
                {tasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-slate-800 group hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <span className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-mono font-semibold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-800">
                        {task.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
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

          {/* Duration Presets & Custom Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-[#007AFF]" />
                <span>Duration Presets</span>
              </label>
              <span className="text-xs font-bold font-mono text-[#007AFF]">
                {selectedMinutes} mins
              </span>
            </div>

            {/* Presets Grid (5m, 10m, 15m, 25m, 30m, 45m, 60m) */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {presets.map((mins) => {
                const isSelected = !isCustomDuration && selectedMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25 border border-[#007AFF]'
                        : 'bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/80'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>

            {/* Custom Duration Input */}
            <div className="pt-1 flex items-center space-x-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsCustomDuration(!isCustomDuration);
                  if (!isCustomDuration) {
                    setCustomMinutes(selectedMinutes.toString());
                  }
                }}
                className={`text-slate-600 hover:text-slate-900 underline underline-offset-4 transition-colors ${
                  isCustomDuration ? 'text-[#007AFF] font-semibold' : ''
                }`}
              >
                {isCustomDuration ? 'Using custom duration' : 'Custom duration...'}
              </button>

              {isCustomDuration && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <input
                    type="number"
                    min={settings.minDurationMinutes || 1}
                    max={settings.maxDurationMinutes || 180}
                    value={customMinutes}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                    placeholder="Mins"
                    className="w-20 px-2.5 py-1.5 bg-slate-50 border border-[#007AFF] rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                    autoFocus
                  />
                  <span className="text-slate-500 font-medium">minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions: Strictly Two Choices (Start Focused Session or Leave Site) */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleLeaveSite}
              className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm border border-slate-200/80 transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Leave Site</span>
            </button>

            <button
              type="submit"
              onClick={handleSubmit}
              className="w-full sm:flex-1 px-6 py-3 bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white font-semibold rounded-xl text-sm shadow-md shadow-[#007AFF]/25 transition-all flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Focused Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
