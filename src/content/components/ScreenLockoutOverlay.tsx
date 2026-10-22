import React, { useState, useEffect, useRef } from 'react';
import { FocusSession, TaskItem } from '../../shared/types';
import {
  Clock,
  CheckCircle2,
  LogOut,
  RotateCw,
  Target,
  AlertTriangle,
} from 'lucide-react';

export interface ScreenLockoutOverlayProps {
  session: FocusSession;
  reason?: 'timer_expired' | 'user_stopped' | 'limit_reached' | 'manual';
  onCompleteAndReview: () => void;
  onExtendMinutes: (minutes: number) => void;
  onSwitchTask: (newPurpose?: string, newMinutes?: number) => void;
  onCloseTabOrLeave: () => void;
  onUpdateSessionTasks?: (updatedTasks: TaskItem[]) => void;
}

export const ScreenLockoutOverlay: React.FC<ScreenLockoutOverlayProps> = ({
  session,
  reason = 'timer_expired',
  onCompleteAndReview,
  onExtendMinutes,
  onSwitchTask,
  onCloseTabOrLeave,
  onUpdateSessionTasks,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>(session.tasks || []);
  const [isSwitchingInline, setIsSwitchingInline] = useState(false);
  const [newPurposeInput, setNewPurposeInput] = useState('');
  const [newMinutesInput, setNewMinutesInput] = useState<number>(15);
  const overlayRef = useRef<HTMLDivElement>(null);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const actualDurationMs = Math.max(0, (session.endTime || Date.now()) - session.startTime);
  const plannedMinutes = Math.round(session.allocatedDurationMs / 60000);
  const actualMinutes = Math.max(1, Math.round(actualDurationMs / 60000));
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  // Bulletproof viewport lock & event trapping:
  // Completely block scrolling, touch moves, wheel, and keyboard escape on underlying page.
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    const handleTrapKeyDown = (e: KeyboardEvent) => {
      // Prevent ESC or any keys from bubbling to host page
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      }
      // If pressing Backspace or Space when not focused on an input inside our overlay, prevent host navigation/scrolling
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput && (e.key === ' ' || e.key === 'Backspace' || e.key.startsWith('Page') || e.key.startsWith('Arrow'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTrapScroll = (e: Event) => {
      // Stop wheel and touchmove events from scrolling background
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleTrapKeyDown, { capture: true });
    window.addEventListener('wheel', handleTrapScroll, { capture: true, passive: false });
    window.addEventListener('touchmove', handleTrapScroll, { capture: true, passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleTrapKeyDown, { capture: true });
      window.removeEventListener('wheel', handleTrapScroll, { capture: true });
      window.removeEventListener('touchmove', handleTrapScroll, { capture: true });
    };
  }, []);

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined } : t
    );
    setTasks(updated);
    if (onUpdateSessionTasks) {
      onUpdateSessionTasks(updated);
    }
  };

  const handleInlineSwitchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPurposeInput.trim();
    if (trimmed) {
      onSwitchTask(trimmed, newMinutesInput);
    } else {
      onSwitchTask();
    }
  };

  const siteDisplayName =
    session.site === 'youtube'
      ? 'YouTube'
      : session.site === 'facebook'
      ? 'Facebook'
      : session.site.charAt(0).toUpperCase() + session.site.slice(1);

  const isUserStopped = reason === 'user_stopped';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        background: 'rgba(11, 15, 25, 0.82)',
        backdropFilter: 'blur(36px) saturate(180%)',
        WebkitBackdropFilter: 'blur(36px) saturate(180%)',
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="screen-lockout-title"
    >
      {/* Centered Apple Glass Card */}
      <div className="w-full max-w-xl bg-white/95 text-slate-900 border border-white/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] rounded-3xl p-6 sm:p-7 backdrop-blur-2xl relative overflow-hidden animate-lg-slide-up space-y-6">
        {/* Specular Edge Highlight */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />

        {/* 1. Header with Apple squircle shield & site badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                isUserStopped
                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                  : 'bg-red-500/15 text-red-600 border border-red-500/30'
              }`}
            >
              {isUserStopped ? (
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              ) : (
                <Clock className="w-6 h-6 animate-pulse" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                  Focus Guard Lockout
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono border border-slate-200">
                  {siteDisplayName}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isUserStopped
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {isUserStopped ? 'Session Stopped' : "Time's Up"}
                </span>
              </div>

              <h2
                id="screen-lockout-title"
                className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1"
              >
                {isUserStopped
                  ? 'Focus Session Stopped — Screen Locked'
                  : 'Focus Time Expired — Screen Locked'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Focus Guard has full control of this tab. To continue browsing or leave intentionally, choose one of the cases below.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Session Intent & Stats Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-xs space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Session Purpose
              </span>
              <span className="text-[10px] font-mono font-semibold text-slate-500">
                Mode: {session.mode === 'regular' ? 'Passive Tracking' : 'Strict Focus Guard'}
              </span>
            </div>
            <div className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
              "{session.purpose}"
            </div>
          </div>

          {/* Time & Task Stats Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60 text-xs">
            <div className="p-2 rounded-xl bg-white border border-slate-200/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Planned</span>
              <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
                {plannedMinutes} min
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Actual</span>
              <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
                {actualMinutes} min
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Completed</span>
              <span className="text-sm font-bold text-emerald-600 font-mono tabular-nums">
                {completedCount}/{totalCount} ({completionPercent}%)
              </span>
            </div>
          </div>

          {/* Interactive Checklist Review */}
          {tasks.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block mb-1">
                Verify Completed Tasks
              </span>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="w-full text-left flex items-center space-x-2.5 p-2 rounded-xl bg-white hover:bg-slate-100/70 border border-slate-200/60 transition-colors text-xs cursor-pointer group"
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors ${
                        task.completed
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300 text-transparent group-hover:border-emerald-500'
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`truncate flex-1 font-medium ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {task.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. The 4 Distinct Cases - Apple Action Matrix */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Choose Your Next Action
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Case 1: Complete & Review Session */}
            <button
              type="button"
              onClick={onCompleteAndReview}
              className="group p-3.5 rounded-2xl bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white shadow-md shadow-[#007AFF]/25 transition-all text-left flex flex-col justify-between"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                  Case 1
                </span>
              </div>
              <div>
                <div className="text-sm font-bold">Complete & Review Session</div>
                <div className="text-[11px] text-white/80 mt-0.5 leading-tight">
                  Record stats, log achievements, and finish this visit intentionally.
                </div>
              </div>
            </button>

            {/* Case 2: Extend Focus Session */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#007AFF]/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[#007AFF]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Case 2
                </span>
              </div>
              <div className="mb-2">
                <div className="text-sm font-bold text-slate-900">Extend Focus Session</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Need more time on this purpose? Quick one-click add:
                </div>
              </div>
              <div className="flex space-x-1.5 pt-1">
                {[5, 15, 25].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onExtendMinutes(mins)}
                    className="flex-1 py-1 px-1.5 rounded-lg bg-[#007AFF]/10 hover:bg-[#007AFF] hover:text-white text-[#007AFF] text-[11px] font-bold font-mono transition-colors text-center"
                    title={`Extend session by ${mins} minutes`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Case 3: Switch Focus Task */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#007AFF]/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <RotateCw className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Case 3
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Switch Focus Task</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Finished early or shifting focus? Set a new agenda and restart.
                </div>
              </div>
              <div className="pt-2">
                {!isSwitchingInline ? (
                  <button
                    type="button"
                    onClick={() => setIsSwitchingInline(true)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Enter New Task</span>
                  </button>
                ) : (
                  <form onSubmit={handleInlineSwitchSubmit} className="space-y-1.5 animate-lg-fade-in">
                    <input
                      type="text"
                      autoFocus
                      placeholder="What is your new focus task?"
                      value={newPurposeInput}
                      onChange={(e) => setNewPurposeInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                    <div className="flex space-x-1.5">
                      <select
                        value={newMinutesInput}
                        onChange={(e) => setNewMinutesInput(parseInt(e.target.value, 10))}
                        className="py-1 px-1.5 text-[11px] font-mono rounded-lg border border-slate-300 bg-white"
                      >
                        <option value={5}>5m</option>
                        <option value={15}>15m</option>
                        <option value={25}>25m</option>
                        <option value={45}>45m</option>
                      </select>
                      <button
                        type="submit"
                        className="flex-1 py-1 px-2 rounded-lg bg-purple-600 text-white text-[11px] font-semibold hover:bg-purple-700 transition-colors"
                      >
                        Start
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Case 4: Close Tab / Leave Site */}
            <button
              type="button"
              onClick={onCloseTabOrLeave}
              className="p-3.5 rounded-2xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200/80 hover:border-red-200 shadow-xs transition-all text-left flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-slate-200/70 group-hover:bg-red-100 text-slate-600 group-hover:text-red-600 flex items-center justify-center transition-colors">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 group-hover:bg-red-100 text-slate-600 group-hover:text-red-700 transition-colors">
                  Case 4
                </span>
              </div>
              <div>
                <div className="text-sm font-bold">Close Tab / Leave Site</div>
                <div className="text-[11px] text-slate-500 group-hover:text-red-600/80 mt-0.5 leading-tight transition-colors">
                  Safely close this tab or navigate back to protect your focus.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
