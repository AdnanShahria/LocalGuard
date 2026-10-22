import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FocusSession, UserSettings, TaskItem, SiteUsageStats } from '../../shared/types';
import {
  calculateRemainingMs,
  formatTime,
  getTimerColorState,
  calculateProgressFraction,
} from '../../features/session/timerCalculations';
import { playCompletionChime } from '../../shared/audio';
import { ScreenLockoutOverlay } from './ScreenLockoutOverlay';
import {
  updateSettings,
  getSiteUsageStats,
} from '../../storage/storage';
import {
  Shield,
  Minus,
  Maximize2,
  Check,
  Plus,
  GripVertical,
  Clock,
  CheckCircle2,
  ExternalLink,
  Sun,
  Moon,
  Square,
  Trash2,
  Edit2,
  Scaling,
} from 'lucide-react';

interface FocusHUDProps {
  session: FocusSession;
  settings: UserSettings;
  onUpdateSession: (updated: FocusSession) => void;
  onEndSession: (outcome: 'completed' | 'abandoned') => void;
  onExtendSession?: (addedMs: number) => void;
  onOpenDashboard?: () => void;
  onTriggerLockout?: (session: FocusSession, reason: 'timer_expired' | 'user_stopped') => void;
  onOpenDepartureModal?: () => void;
}

/**
 * Detects whether the current host page has a dark background.
 */
function detectPageIsDark(): boolean {
  try {
    const html = document.documentElement;
    const body = document.body;

    // Check common dark mode attributes / classes
    if (
      html.hasAttribute('dark') ||
      html.classList.contains('dark') ||
      body?.classList.contains('dark') ||
      html.getAttribute('data-theme') === 'dark' ||
      body?.getAttribute('data-theme') === 'dark'
    ) {
      return true;
    }

    // YouTube specific dark theme selector
    if (document.querySelector('html[dark]') || document.querySelector('ytd-app[dark]')) {
      return true;
    }

    // Helper to extract RGB and determine luminance
    const parseRgb = (colorStr: string): { r: number; g: number; b: number } | null => {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
      };
    };

    for (const el of [body, html]) {
      if (!el) continue;
      const bg = window.getComputedStyle(el).backgroundColor;
      const parsed = parseRgb(bg);
      if (parsed && (parsed.r > 0 || parsed.g > 0 || parsed.b > 0)) {
        const luminance = 0.2126 * (parsed.r / 255) + 0.7152 * (parsed.g / 255) + 0.0722 * (parsed.b / 255);
        return luminance < 0.45;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export const FocusHUD: React.FC<FocusHUDProps> = ({
  session,
  settings,
  onUpdateSession,
  onEndSession,
  onExtendSession,
  onOpenDashboard,
  onTriggerLockout,
  onOpenDepartureModal: _onOpenDepartureModal,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [hasPlayedChime, setHasPlayedChime] = useState(false);

  // Remaining time derived from deadline
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    calculateRemainingMs(session.deadlineTime)
  );

  // Position state (right, bottom offsets in px)
  const [position, setPosition] = useState<{ right: number; bottom: number }>(() => {
    return settings.hudPosition || { right: 20, bottom: 20 };
  });

  // Dimension state (width, height in px; bounded 320-750W x 340-800H)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    const raw = settings.hudDimensions || { width: 400, height: 460 };
    return {
      width: Math.max(320, Math.min(750, raw.width || 400)),
      height: Math.max(340, Math.min(800, raw.height < 360 ? 460 : raw.height)),
    };
  });

  // Size customization menu state
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  // Task inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [newTaskInput, setNewTaskInput] = useState('');

  // Site usage stats
  const [siteStats, setSiteStats] = useState<SiteUsageStats>({
    todayMinutes: 0,
    weeklyMinutes: 0,
    allTimeMinutes: 0,
    todayMs: 0,
    weekMs: 0,
    allTimeMs: 0,
    todayFormatted: '0m',
    weekFormatted: '0m',
    allTimeFormatted: '0m',
  });

  // Adaptive contrast engine state
  const [autoDetectedDark, setAutoDetectedDark] = useState<boolean>(() => detectPageIsDark());
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>(() => {
    return settings.hudThemeAdaptation || 'auto';
  });

  // Determine active visual theme:
  // On dark websites: White Theme HUD
  // On light websites: Smoked Dark Theme HUD
  const isWhiteTheme =
    themeMode === 'light' ? true : themeMode === 'dark' ? false : autoDetectedDark;

  // Selectable border color
  const accentColor = settings.hudBorderColor || '#007AFF';

  // Refs for dragging and resizing
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startRight: 20,
    startBottom: 20,
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startWidth: 400,
    startHeight: 460,
    startRight: 20,
    startBottom: 20,
  });

  const isResizingTopLeftRef = useRef(false);
  const resizeTopLeftStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startWidth: 400,
    startHeight: 460,
  });

  // Background darkness mutation observer
  useEffect(() => {
    const checkDarkness = () => {
      setAutoDetectedDark(detectPageIsDark());
    };

    checkDarkness();
    const observer = new MutationObserver(checkDarkness);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'dark', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // Fetch Site Usage Stats
  const refreshSiteStats = useCallback(async () => {
    try {
      const stats = await getSiteUsageStats(session.site);
      setSiteStats(stats);
    } catch (err) {
      console.error('Failed to load site stats in HUD:', err);
    }
  }, [session.site]);

  useEffect(() => {
    refreshSiteStats();
    const interval = setInterval(refreshSiteStats, 15000);
    return () => clearInterval(interval);
  }, [refreshSiteStats]);

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

      // Automatically trigger screen lockout when timer expires in Focus Mode
      if (ms <= 0 && onTriggerLockout) {
        onTriggerLockout(session, 'timer_expired');
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

  // Manual theme contrast toggle
  const handleToggleTheme = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // If currently white theme, switch to smoked dark theme ('dark')
    // If currently dark, switch to white theme ('light')
    const nextMode = isWhiteTheme ? 'dark' : 'light';
    setThemeMode(nextMode);
    try {
      await updateSettings({ hudThemeAdaptation: nextMode });
    } catch (err) {
      console.error('Failed to persist HUD theme setting:', err);
    }
  };

  // Quick Extend (+5 minutes)
  const handleQuickExtend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExtendSession) {
      onExtendSession(5 * 60 * 1000);
    }
  };

  // Dragging by Header
  const handleDragMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('form')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRight: position.right,
      startBottom: position.bottom,
    };

    let latestRight = position.right;
    let latestBottom = position.bottom;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = dragStartRef.current.mouseX - moveEvent.clientX;
      const deltaY = dragStartRef.current.mouseY - moveEvent.clientY;

      const maxRight = Math.max(10, window.innerWidth - dimensions.width - 10);
      const maxBottom = Math.max(10, window.innerHeight - dimensions.height - 10);

      latestRight = Math.max(10, Math.min(maxRight, dragStartRef.current.startRight + deltaX));
      latestBottom = Math.max(10, Math.min(maxBottom, dragStartRef.current.startBottom + deltaY));

      setPosition({ right: latestRight, bottom: latestBottom });
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        // Persist position
        updateSettings({ hudPosition: { right: latestRight, bottom: latestBottom } }).catch(
          console.error
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resizing from Top-Left Corner Handle (Expands inward toward page center smoothly)
  const handleResizeTopLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingTopLeftRef.current = true;
    resizeTopLeftStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
    };

    let latestWidth = dimensions.width;
    let latestHeight = dimensions.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingTopLeftRef.current) return;
      const dx = resizeTopLeftStartRef.current.mouseX - moveEvent.clientX;
      const dy = resizeTopLeftStartRef.current.mouseY - moveEvent.clientY;

      const newWidth = Math.max(320, Math.min(750, resizeTopLeftStartRef.current.startWidth + dx));
      const newHeight = Math.max(340, Math.min(800, resizeTopLeftStartRef.current.startHeight + dy));

      latestWidth = newWidth;
      latestHeight = newHeight;
      setDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      if (isResizingTopLeftRef.current) {
        isResizingTopLeftRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        updateSettings({
          hudDimensions: { width: latestWidth, height: latestHeight },
        }).catch(console.error);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resizing from Bottom-Right Corner Handle
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = true;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
      startRight: position.right,
      startBottom: position.bottom,
    };

    let latestWidth = dimensions.width;
    let latestHeight = dimensions.height;
    let latestRight = position.right;
    let latestBottom = position.bottom;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dx = moveEvent.clientX - resizeStartRef.current.mouseX;
      const dy = moveEvent.clientY - resizeStartRef.current.mouseY;

      // New clamped dimensions: width 320-750, height 340-800
      const newWidth = Math.max(320, Math.min(750, resizeStartRef.current.startWidth + dx));
      const newHeight = Math.max(340, Math.min(800, resizeStartRef.current.startHeight + dy));

      const deltaW = newWidth - resizeStartRef.current.startWidth;
      const deltaH = newHeight - resizeStartRef.current.startHeight;

      const newRight = Math.max(5, resizeStartRef.current.startRight - deltaW);
      const newBottom = Math.max(5, resizeStartRef.current.startBottom - deltaH);

      latestWidth = newWidth;
      latestHeight = newHeight;
      latestRight = newRight;
      latestBottom = newBottom;

      setDimensions({ width: newWidth, height: newHeight });
      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        updateSettings({
          hudDimensions: { width: latestWidth, height: latestHeight },
          hudPosition: { right: latestRight, bottom: latestBottom },
        }).catch(console.error);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Custom Size Preset & Slider Handlers
  const handleApplyPresetSize = async (w: number, h: number) => {
    setDimensions({ width: w, height: h });
    try {
      await updateSettings({ hudDimensions: { width: w, height: h } });
    } catch (err) {
      console.error('Failed to save preset size:', err);
    }
  };

  const handleSliderWidth = (w: number) => {
    setDimensions((prev) => ({ ...prev, width: Math.max(320, Math.min(750, w)) }));
  };

  const handleSliderHeight = (h: number) => {
    setDimensions((prev) => ({ ...prev, height: Math.max(340, Math.min(800, h)) }));
  };

  const handleCommitSize = async () => {
    try {
      await updateSettings({ hudDimensions: dimensions });
    } catch (err) {
      console.error('Failed to commit size:', err);
    }
  };

  // Task Toggle
  const handleToggleTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  // Task Inline Edit Start
  const handleStartEditTask = (task: TaskItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
  };

  // Task Inline Edit Save
  const handleSaveEditTask = (taskId: string) => {
    const trimmed = editingTaskText.trim();
    if (trimmed) {
      const updatedTasks = session.tasks.map((t) =>
        t.id === taskId ? { ...t, text: trimmed } : t
      );
      onUpdateSession({
        ...session,
        tasks: updatedTasks,
        lastUpdateTime: Date.now(),
      });
    }
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  // Task Delete
  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTasks = session.tasks.filter((t) => t.id !== taskId);
    const completedCount = updatedTasks.filter((t) => t.completed).length;
    onUpdateSession({
      ...session,
      tasks: updatedTasks,
      totalTasksCount: updatedTasks.length,
      tasksCompletedCount: completedCount,
      lastUpdateTime: Date.now(),
    });
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
    onUpdateSession({
      ...session,
      tasks: updatedTasks,
      totalTasksCount: updatedTasks.length,
      lastUpdateTime: Date.now(),
    });

    setNewTaskInput('');
  };

  const completedCount = session.tasks.filter((t) => t.completed).length;
  const totalCount = session.tasks.length;

  // Site label helper
  const siteDomainLabel =
    session.site === 'youtube'
      ? 'YouTube'
      : session.site === 'facebook'
      ? 'Facebook'
      : session.site;

  return (
    <>
      {/* End Session Lockout Barrier */}
      {showEndDialog && (
        <ScreenLockoutOverlay
          session={session}
          reason={isExpired ? 'timer_expired' : 'user_stopped'}
          onCompleteAndReview={() => {
            setShowEndDialog(false);
            onEndSession('completed');
          }}
          onExtendMinutes={(mins: number) => {
            if (onExtendSession) {
              onExtendSession(mins * 60 * 1000);
            }
            setShowEndDialog(false);
          }}
          onSwitchTask={() => {
            setShowEndDialog(false);
            onEndSession('completed');
          }}
          onCloseTabOrLeave={() => {
            setShowEndDialog(false);
            onEndSession('abandoned');
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
          /* Minimized Compact Mode Pill (Dynamic Island Style) */
          <div
            onClick={() => setIsMinimized(false)}
            className={`flex items-center space-x-2.5 px-4 py-2 rounded-full cursor-pointer shadow-2xl transition-all transform hover:scale-105 active:scale-95 border ${
              isWhiteTheme
                ? 'bg-white/90 text-slate-900 border-white/60 shadow-xl'
                : 'bg-[#0e121e]/90 text-white border-white/15 shadow-2xl'
            }`}
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: `${accentColor}55`,
              boxShadow: `0 10px 30px -5px rgba(0,0,0,0.4), 0 0 15px -2px ${accentColor}33, ${colorState.glowHex}`,
            }}
            title="Click to expand Focus Guard HUD"
          >
            <div
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: colorState.primaryHex }}
            />
            <span
              className="font-mono font-bold text-sm tracking-tight"
              style={{ color: colorState.primaryHex }}
            >
              {isExpired ? '00:00' : formatTime(remainingMs)}
            </span>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                isWhiteTheme
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {siteDomainLabel}
            </span>
            <Maximize2
              className={`w-3.5 h-3.5 transition-colors ${
                isWhiteTheme ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            />
          </div>
        ) : (
          /* Full Liquid Glass HUD Card */
          <div
            style={{
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              backgroundColor: isWhiteTheme
                ? 'rgba(255, 255, 255, 0.92)'
                : 'rgba(14, 18, 30, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: isWhiteTheme ? `${accentColor}44` : `${accentColor}55`,
              boxShadow: isWhiteTheme
                ? `0 20px 45px -10px rgba(0,0,0,0.18), 0 0 20px -3px ${accentColor}25, ${colorState.glowHex}`
                : `0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px -3px ${accentColor}33, ${colorState.glowHex}`,
            }}
            className={`relative rounded-2xl border border-t ${
              isWhiteTheme
                ? 'border-t-white/80 text-slate-900'
                : 'border-t-white/40 text-white'
            } shadow-2xl flex flex-col overflow-hidden transition-colors duration-300`}
          >
            {/* 1. Header Bar: Grip handle, Shield icon, Site domain badge, Theme toggle, Minimize, End session */}
            <div
              onMouseDown={handleDragMouseDown}
              className={`px-3.5 py-2.5 border-b flex items-center justify-between cursor-move flex-shrink-0 ${
                isWhiteTheme
                  ? 'border-slate-200/80 bg-gradient-to-r from-slate-100/60 to-transparent'
                  : 'border-white/5 bg-gradient-to-r from-white/[0.04] to-transparent'
              }`}
            >
              {/* Left group */}
              <div className="flex items-center space-x-2">
                <span title="Drag to reposition HUD" className="inline-flex items-center">
                  <GripVertical
                    className={`w-4 h-4 cursor-grab active:cursor-grabbing transition-colors ${
                      isWhiteTheme
                        ? 'text-slate-400 hover:text-slate-600'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  />
                </span>
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    border: `1px solid ${accentColor}50`,
                  }}
                >
                  <Shield className="w-3 h-3" style={{ color: accentColor }} />
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isWhiteTheme ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  LocalGuard
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold tracking-wide ${
                    isWhiteTheme
                      ? 'bg-slate-200/80 text-slate-700'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {siteDomainLabel}
                </span>

                {/* Mode Toggle: Focus Mode (Strict) vs Regular Mode (Passive) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextMode = session.mode === 'regular' ? 'focus' : 'regular';
                    onUpdateSession({
                      ...session,
                      mode: nextMode,
                      lastUpdateTime: Date.now(),
                    });
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 border transition-all ${
                    session.mode === 'regular'
                      ? isWhiteTheme
                        ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : isWhiteTheme
                      ? 'bg-blue-50 text-[#007AFF] border-blue-300 hover:bg-blue-100'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                  }`}
                  title={`Current: ${session.mode === 'regular' ? 'Regular Mode (Passive Tracking)' : 'Focus Mode (Strict Guard)'}. Click to switch mode.`}
                  aria-label="Toggle Mode"
                >
                  {session.mode === 'regular' ? (
                    <>
                      <Clock className="w-2.5 h-2.5 text-amber-500" />
                      <span>Regular</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-2.5 h-2.5 text-[#007AFF]" />
                      <span>Focus</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right group: Resize, Theme toggle, Minimize, End Session */}
              <div className="flex items-center space-x-1">
                {/* Size Controls Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSizeMenu(!showSizeMenu);
                  }}
                  className={`p-1 rounded transition-colors ${
                    showSizeMenu
                      ? isWhiteTheme
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-600/30 text-blue-300'
                      : isWhiteTheme
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Resize HUD"
                  aria-label="Resize HUD"
                >
                  <Scaling className="w-3.5 h-3.5" />
                </button>

                {/* Contrast engine manual toggle button */}
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className={`p-1 rounded transition-colors ${
                    isWhiteTheme
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={
                    isWhiteTheme
                      ? 'Current: White Theme HUD (Click for Smoked Dark)'
                      : 'Current: Smoked Dark HUD (Click for White Glass)'
                  }
                  aria-label="Toggle HUD contrast theme"
                >
                  {isWhiteTheme ? (
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </button>

                {/* Minimize to Pill */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className={`p-1 rounded transition-colors ${
                    isWhiteTheme
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Minimize to pill"
                  aria-label="Minimize HUD"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* End Session Button -> Trigger Lockout Overlay */}
                <button
                  type="button"
                  onClick={() => {
                    if (onTriggerLockout) {
                      onTriggerLockout(session, 'user_stopped');
                    } else {
                      setShowEndDialog(true);
                    }
                  }}
                  className={`p-1 rounded transition-colors ${
                    isWhiteTheme
                      ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                      : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                  }`}
                  title="Stop session & lock screen"
                  aria-label="End session"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>

            {/* In-HUD Size Customizer Popover */}
            {showSizeMenu && (
              <div
                className={`p-3 border-b flex-shrink-0 animate-in fade-in duration-150 ${
                  isWhiteTheme
                    ? 'bg-slate-100/95 border-slate-200 text-slate-800'
                    : 'bg-[#121624]/95 border-white/10 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px]">
                    <Scaling className="w-3.5 h-3.5 text-blue-500" />
                    <span>HUD Size Customizer</span>
                  </div>
                  <span className="font-mono text-[10px] text-blue-500 font-bold">
                    {dimensions.width}px × {dimensions.height}px
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                  {[
                    { label: 'Compact', w: 340, h: 380 },
                    { label: 'Standard', w: 400, h: 460 },
                    { label: 'Spacious', w: 480, h: 560 },
                    { label: 'Tall', w: 400, h: 640 },
                  ].map((preset) => {
                    const isCurrent = dimensions.width === preset.w && dimensions.height === preset.h;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPresetSize(preset.w, preset.h)}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isWhiteTheme
                            ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Sliders */}
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Width: {dimensions.width}px</span>
                    <span className="text-[9px] text-slate-400 font-mono">320px - 750px</span>
                  </div>
                  <input
                    type="range"
                    min="320"
                    max="750"
                    step="10"
                    value={dimensions.width}
                    onChange={(e) => handleSliderWidth(parseInt(e.target.value, 10))}
                    onMouseUp={handleCommitSize}
                    onTouchEnd={handleCommitSize}
                    className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-medium text-slate-500">Height: {dimensions.height}px</span>
                    <span className="text-[9px] text-slate-400 font-mono">340px - 800px</span>
                  </div>
                  <input
                    type="range"
                    min="340"
                    max="800"
                    step="10"
                    value={dimensions.height}
                    onChange={(e) => handleSliderHeight(parseInt(e.target.value, 10))}
                    onMouseUp={handleCommitSize}
                    onTouchEnd={handleCommitSize}
                    className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            )}

            {/* 2. Total Time Left: Countdown, Progress Bar, +5m Extend Button */}
            <div className="px-4 py-2 text-center relative overflow-hidden flex-shrink-0">
              {/* Subtle accent glow overlay */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000"
                style={{ backgroundColor: colorState.bgHex }}
              />

              <div className="flex items-center justify-between mb-1">
                {/* Status Badge */}
                <div
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase border"
                  style={{
                    backgroundColor: colorState.bgHex,
                    color: colorState.textColor,
                    borderColor: `${colorState.primaryHex}33`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colorState.primaryHex }}
                  />
                  <span>{colorState.label || 'Focusing'}</span>
                </div>

                {/* Quick +5m Extend Button */}
                <button
                  type="button"
                  onClick={handleQuickExtend}
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight transition-all active:scale-95 border ${
                    isWhiteTheme
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 shadow-sm'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}
                  title="Extend session by +5 minutes"
                >
                  <Plus className="w-2.5 h-2.5 stroke-[3]" />
                  <span>5m</span>
                </button>
              </div>

              {/* Big Countdown Timer */}
              <div
                className="text-3xl font-extrabold font-mono tracking-tight transition-colors duration-500 leading-none my-1"
                style={{ color: colorState.primaryHex }}
              >
                {isExpired ? '00:00' : formatTime(remainingMs)}
              </div>

              {/* Smooth Progress Bar */}
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden ${
                  isWhiteTheme ? 'bg-slate-200/80' : 'bg-white/10'
                }`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.round(progressFraction * 100)}%`,
                    backgroundColor: colorState.primaryHex,
                  }}
                />
              </div>

              {/* Session Purpose Snippet */}
              <div
                className={`mt-1.5 text-xs font-medium truncate px-1 ${
                  isWhiteTheme ? 'text-slate-600' : 'text-slate-300'
                }`}
                title={session.purpose}
              >
                &ldquo;{session.purpose}&rdquo;
              </div>
            </div>

            {/* 3. Serialized & Inline-Editable Task List */}
            <div
              className={`px-3.5 py-2.5 border-t flex-1 min-h-[160px] flex flex-col overflow-hidden ${
                isWhiteTheme
                  ? 'border-slate-200/70 bg-slate-50/50'
                  : 'border-white/5 bg-[#0b0e17]/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2 flex-shrink-0">
                <span
                  className={`flex items-center space-x-1.5 font-bold text-xs ${
                    isWhiteTheme ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Tasks Checklist</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {completedCount}/{totalCount} completed
                </span>
              </div>

              {/* Scrollable Tasks Container */}
              <div
                className="space-y-2 overflow-y-auto pr-1.5 flex-1 min-h-[90px] hud-tasks-scroll"
                style={{
                  maxHeight: '100%',
                  overscrollBehavior: 'contain',
                }}
              >
                {session.tasks.length === 0 ? (
                  <div
                    className={`text-center py-2 text-[11px] italic ${
                      isWhiteTheme ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    No tasks yet. Add an action below.
                  </div>
                ) : (
                  session.tasks.map((task, index) => {
                    const isEditing = editingTaskId === task.id;
                    return (
                      <div
                        key={task.id}
                        className={`group flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all ${
                          task.completed
                            ? isWhiteTheme
                              ? 'bg-emerald-50/80 border-emerald-200/60 text-slate-500'
                              : 'bg-emerald-950/20 border-emerald-500/20 text-slate-400'
                            : isWhiteTheme
                            ? 'bg-white border-slate-200 hover:border-blue-400/60 text-slate-800 shadow-sm'
                            : 'bg-[#151926] border-white/5 hover:border-blue-500/40 text-slate-200'
                        }`}
                      >
                        {/* Serial Number: 1., 2., 3. */}
                        <span
                          className={`font-mono text-[10px] font-bold flex-shrink-0 ${
                            task.completed
                              ? 'text-emerald-500/70'
                              : isWhiteTheme
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {index + 1}.
                        </span>

                        {/* Checkbox toggle */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleTask(task.id, e)}
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                            task.completed
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-xs'
                              : isWhiteTheme
                              ? 'border-slate-300 bg-slate-50 hover:border-blue-500'
                              : 'border-white/20 bg-black/30 hover:border-blue-400'
                          }`}
                          title={task.completed ? 'Mark incomplete' : 'Mark completed'}
                          aria-label={`Toggle task ${index + 1}`}
                        >
                          {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        {/* Inline Editable Text or Input */}
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditTask(task.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            onBlur={() => handleSaveEditTask(task.id)}
                            autoFocus
                            className={`flex-1 text-xs px-1.5 py-0.5 rounded border focus:outline-none ${
                              isWhiteTheme
                                ? 'bg-white border-blue-500 text-slate-900'
                                : 'bg-[#1a2030] border-blue-400 text-white'
                            }`}
                          />
                        ) : (
                          <span
                            onClick={(e) => handleStartEditTask(task, e)}
                            className={`text-xs flex-1 break-words cursor-text select-text ${
                              task.completed
                                ? 'line-through text-slate-400'
                                : isWhiteTheme
                                ? 'text-slate-800'
                                : 'text-slate-200'
                            }`}
                            title="Click to edit task"
                          >
                            {task.text}
                          </span>
                        )}

                        {/* Actions: Edit icon hint & Delete button */}
                        {!isEditing && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartEditTask(task, e)}
                              className={`p-0.5 rounded transition-colors ${
                                isWhiteTheme
                                  ? 'text-slate-400 hover:text-slate-700'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title="Edit task text"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              className="p-0.5 text-red-400 hover:text-red-500 rounded transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inline "Add task" input row */}
              <form onSubmit={handleAddInlineTask} className="mt-1.5 flex items-center space-x-1.5 flex-shrink-0">
                <input
                  type="text"
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  placeholder="Add next action (Enter)..."
                  className={`flex-1 px-2.5 py-1 text-xs rounded-lg border focus:outline-none transition-colors ${
                    isWhiteTheme
                      ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      : 'bg-[#151926] border-white/10 text-white placeholder-slate-500 focus:border-blue-500/60'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newTaskInput.trim()}
                  className={`p-1 rounded-lg text-white font-semibold transition-all flex items-center justify-center ${
                    newTaskInput.trim()
                      ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-xs'
                      : 'bg-blue-600/40 opacity-50 cursor-not-allowed'
                  }`}
                  title="Add task"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* 4. Site Time Invested Meters: Today: XXm | Week: XXm | All-Time: XXh XXm */}
            <div
              className={`px-3.5 py-2 border-t flex items-center justify-between text-[10px] flex-shrink-0 ${
                isWhiteTheme
                  ? 'border-slate-200/80 bg-slate-100/70 text-slate-600'
                  : 'border-white/5 bg-black/30 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">
                  Today:{' '}
                  <strong className={isWhiteTheme ? 'text-slate-900 font-bold' : 'text-slate-200 font-bold'}>
                    {siteStats.todayFormatted}
                  </strong>
                  {' '}| Week:{' '}
                  <strong className={isWhiteTheme ? 'text-slate-900 font-bold' : 'text-slate-200 font-bold'}>
                    {siteStats.weekFormatted}
                  </strong>
                  {' '}| All-Time:{' '}
                  <strong className={isWhiteTheme ? 'text-slate-900 font-bold' : 'text-slate-200 font-bold'}>
                    {siteStats.allTimeFormatted}
                  </strong>
                </span>
              </div>

              {/* Dashboard launcher */}
              {onOpenDashboard && (
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className={`p-0.5 rounded transition-colors flex-shrink-0 ml-1 ${
                    isWhiteTheme
                      ? 'text-slate-400 hover:text-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Open LocalGuard Dashboard"
                  aria-label="Open Dashboard"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 5. Resizable Drag Handles: Top-Left & Bottom-Right */}
            {/* Top-Left Corner Handle (Drag to expand into screen) */}
            <div
              onMouseDown={handleResizeTopLeftMouseDown}
              className={`absolute top-0.5 left-0.5 w-4 h-4 cursor-nwse-resize flex items-center justify-center z-20 group transition-colors ${
                isWhiteTheme
                  ? 'text-slate-400 hover:text-blue-600'
                  : 'text-slate-500 hover:text-blue-400'
              }`}
              title="Resize HUD (Drag Top-Left corner inwards)"
            >
              <svg
                viewBox="0 0 10 10"
                className="w-2.5 h-2.5 fill-none stroke-current opacity-40 group-hover:opacity-100 transition-opacity"
              >
                <path d="M2 8L8 2M2 5L5 2M2 2L2 2" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Bottom-Right Corner Handle */}
            <div
              onMouseDown={handleResizeMouseDown}
              className={`absolute bottom-0.5 right-0.5 w-4 h-4 cursor-se-resize flex items-center justify-center z-20 group transition-colors ${
                isWhiteTheme
                  ? 'text-slate-400 hover:text-blue-600'
                  : 'text-slate-500 hover:text-blue-400'
              }`}
              title="Resize HUD (Drag Bottom-Right corner)"
            >
              <svg
                viewBox="0 0 10 10"
                className="w-2.5 h-2.5 fill-none stroke-current opacity-40 group-hover:opacity-100 transition-opacity"
              >
                <path d="M8 2L2 8M8 5L5 8M8 8L8 8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
