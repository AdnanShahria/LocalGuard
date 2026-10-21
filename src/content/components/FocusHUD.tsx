import React, { useState, useEffect, useRef } from 'react';
import { FocusSession, UserSettings, TaskItem } from '../../shared/types';
import {
  calculateRemainingMs,
  formatTime,
  getTimerColorState,
  calculateProgressFraction,
} from '../../features/session/timerCalculations';
import { playCompletionChime } from '../../shared/audio';
import { SessionEndDialog } from './SessionEndDialog';
import {
  Shield,
  Minus,
  Maximize2,
  X,
  Check,
  Plus,
  GripVertical,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface FocusHUDProps {
  session: FocusSession;
  settings: UserSettings;
  onUpdateSession: (updated: FocusSession) => void;
  onEndSession: (outcome: 'completed' | 'abandoned') => void;
  onExtendSession?: (addedMs: number) => void;
  onOpenDashboard?: () => void;
}

export const FocusHUD: React.FC<FocusHUDProps> = ({
  session,
  settings,
  onUpdateSession,
  onEndSession,
  onExtendSession,
  onOpenDashboard,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [hasPlayedChime, setHasPlayedChime] = useState(false);

  // Remaining time derived from deadline
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    calculateRemainingMs(session.deadlineTime)
  );

  // Position state (right, bottom offsets in px)
  const [position, setPosition] = useState<{ right: number; bottom: number }>(() => {
    return settings.hudPosition || { right: 20, bottom: 20 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startRight: number; startBottom: number }>({
    mouseX: 0,
    mouseY: 0,
    startRight: 20,
    startBottom: 20,
  });

  // Timer Tick & Tab Focus Sync
  useEffect(() => {
    const updateTime = () => {
      const ms = calculateRemainingMs(session.deadlineTime);
      setRemainingMs(ms);

      // Play chime once if expired and audio is enabled
      if (ms <= 0 && !hasPlayedChime && settings.soundNotifications) {
        setHasPlayedChime(true);
        playCompletionChime(settings.soundVolume);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTime();
      }
    };

    const handleFocus = () => updateTime();

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session.deadlineTime, hasPlayedChime, settings.soundNotifications, settings.soundVolume]);

  // Color state calculation
  const colorState = getTimerColorState(remainingMs);
  const isExpired = remainingMs <= 0;
  const progressFraction = calculateProgressFraction(session.allocatedDurationMs, remainingMs);

  // Draggable logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from handle or header, ignore button clicks
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRight: position.right,
      startBottom: position.bottom,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = dragStartRef.current.mouseX - moveEvent.clientX; // moving left increases right offset
      const deltaY = dragStartRef.current.mouseY - moveEvent.clientY; // moving up increases bottom offset

      const newRight = Math.max(10, Math.min(window.innerWidth - 320, dragStartRef.current.startRight + deltaX));
      const newBottom = Math.max(10, Math.min(window.innerHeight - 200, dragStartRef.current.startBottom + deltaY));

      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Task Toggle
  const handleToggleTask = (taskId: string) => {
    const updatedTasks = session.tasks.map((t) => {
      if (t.id === taskId) {
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : undefined,
        };
      }
      return t;
    });

    const completedCount = updatedTasks.filter((t) => t.completed).length;
    const updatedSession: FocusSession = {
      ...session,
      tasks: updatedTasks,
      tasksCompletedCount: completedCount,
      lastUpdateTime: Date.now(),
    };

    onUpdateSession(updatedSession);
  };

  // Add Inline Task
  const handleAddInlineTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskInput.trim();
    if (!trimmed) return;

    const newTask: TaskItem = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      text: trimmed,
      completed: false,
    };

    const updatedTasks = [...session.tasks, newTask];
    const updatedSession: FocusSession = {
      ...session,
      tasks: updatedTasks,
      totalTasksCount: updatedTasks.length,
      lastUpdateTime: Date.now(),
    };

    onUpdateSession(updatedSession);
    setNewTaskInput('');
    setShowAddTask(false);
  };

  const completedCount = session.tasks.filter((t) => t.completed).length;
  const totalCount = session.tasks.length;
  const elapsedMs = Math.max(0, Date.now() - session.startTime);
  const elapsedFormatted = formatTime(elapsedMs);

  return (
    <>
      {/* End Session Confirmation / Expiration Dialog */}
      {showEndDialog && (
        <SessionEndDialog
          session={session}
          isExpired={isExpired}
          onFinish={() => {
            setShowEndDialog(false);
            onEndSession('completed');
          }}
          onAbandon={() => {
            setShowEndDialog(false);
            onEndSession('abandoned');
          }}
          onContinue={() => setShowEndDialog(false)}
          onExtendMinutes={(mins) => {
            if (onExtendSession) {
              onExtendSession(mins * 60 * 1000);
            }
            setShowEndDialog(false);
          }}
        />
      )}

      {/* Floating HUD Container */}
      <div
        style={{
          position: 'fixed',
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
          zIndex: 2147483645,
        }}
        className="font-sans select-none antialiased"
      >
        {isMinimized ? (
          /* Minimized Compact Mode Pill */
          <div
            onClick={() => setIsMinimized(false)}
            className="flex items-center space-x-2.5 px-3.5 py-2 rounded-full cursor-pointer shadow-xl border border-white/10 backdrop-blur-md transition-all transform hover:scale-105 active:scale-95"
            style={{
              backgroundColor: '#10141f',
              boxShadow: colorState.glowHex,
            }}
            title="Click to expand Focus Guard HUD"
          >
            <div
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: colorState.primaryHex }}
            />
            <span
              className="font-mono font-bold text-sm"
              style={{ color: colorState.primaryHex }}
            >
              {isExpired ? "00:00" : formatTime(remainingMs)}
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 capitalize">
              {session.site}
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </div>
        ) : (
          /* Full Expanded HUD Card */
          <div
            className="w-80 sm:w-88 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300"
            style={{
              backgroundColor: '#10141f',
              boxShadow: `0 10px 40px -10px rgba(0,0,0,0.7), ${colorState.glowHex}`,
            }}
          >
            {/* Header / Drag Bar */}
            <div
              onMouseDown={handleMouseDown}
              className="px-4 py-3 border-b border-white/5 flex items-center justify-between cursor-move bg-gradient-to-r from-white/[0.04] to-transparent"
            >
              <div className="flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                <div className="w-5 h-5 rounded-md bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-blue-400" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Focus Mode
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono capitalize">
                  {session.site}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                  title="Minimize to pill"
                  aria-label="Minimize"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowEndDialog(true)}
                  className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
                  title="End session"
                  aria-label="End session"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Timer Display */}
            <div className="px-5 py-4 text-center relative overflow-hidden">
              {/* Subtle background glow based on current state */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none transition-colors duration-1000"
                style={{ backgroundColor: colorState.bgHex }}
              />

              {/* Status Badge */}
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase mb-2 border border-white/10"
                style={{
                  backgroundColor: colorState.bgHex,
                  color: colorState.textColor,
                  borderColor: colorState.primaryHex + '33',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorState.primaryHex }} />
                <span>{colorState.label || 'Focused'}</span>
              </div>

              {/* Big Countdown */}
              <div
                className="text-4xl font-extrabold font-mono tracking-tight transition-colors duration-500"
                style={{ color: colorState.primaryHex }}
              >
                {isExpired ? "00:00" : formatTime(remainingMs)}
              </div>

              {/* Progress Bar (Elapsed vs Total) */}
              <div className="w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.round(progressFraction * 100)}%`,
                    backgroundColor: colorState.primaryHex,
                  }}
                />
              </div>

              {/* Session Purpose Description */}
              <div className="mt-2 text-xs font-medium text-slate-300 truncate px-1" title={session.purpose}>
                "{session.purpose}"
              </div>
            </div>

            {/* Tasks Section */}
            <div className="px-4 py-2.5 border-t border-white/5 bg-[#0e111a]/70 max-h-44 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center space-x-1 font-semibold text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tasks</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-400 font-medium">
                  {completedCount}/{totalCount} completed
                </span>
              </div>

              {/* Task Items List */}
              <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                {session.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`flex items-start space-x-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                      task.completed
                        ? 'bg-emerald-950/20 text-slate-400 border border-emerald-500/20'
                        : 'bg-[#151926] text-slate-200 hover:bg-[#1a2030] border border-white/5'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex-shrink-0 flex items-center justify-center border transition-colors ${
                        task.completed
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'border-white/20 bg-black/20 hover:border-blue-400'
                      }`}
                    >
                      {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-xs flex-1 break-words select-text ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Inline Add Task Toggle / Input */}
              {showAddTask ? (
                <form onSubmit={handleAddInlineTask} className="mt-2 flex space-x-1.5">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="New task..."
                    className="flex-1 px-2.5 py-1 text-xs bg-[#171c2b] border border-blue-500/50 rounded-lg text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTask(false)}
                    className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="mt-2 text-[11px] text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition-colors self-start"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add another task</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 bg-black/20">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Elapsed: {elapsedFormatted}</span>
              </span>

              <div className="flex items-center space-x-2">
                {onOpenDashboard && (
                  <button
                    onClick={onOpenDashboard}
                    className="text-slate-400 hover:text-white p-1 transition-colors"
                    title="Open Dashboard"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowEndDialog(true)}
                  className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold transition-colors"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
