import React, { useState, useEffect, useRef } from 'react';
import { AwayState } from '../../shared/types';
import { formatTime } from '../../features/session/timerCalculations';
import { playCompletionChime, playWarningTick } from '../../shared/audio';
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Minimize2,
  Maximize2,
  X,
} from 'lucide-react';

export interface AwayReminderHUDProps {
  awayState: AwayState;
  onReturnToSite: () => void;
  onExtendAwayMinutes: (minutes: number) => void;
  onDismissAway: () => void;
}

export const AwayReminderHUD: React.FC<AwayReminderHUDProps> = ({
  awayState,
  onReturnToSite,
  onExtendAwayMinutes,
  onDismissAway,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, awayState.deadlineTime - Date.now())
  );
  const [isMinimized, setIsMinimized] = useState(false);
  const warnedOneMinuteRef = useRef(false);
  const playedExpiredChimeRef = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const ms = Math.max(0, awayState.deadlineTime - Date.now());
      setRemainingMs(ms);

      // 1-minute alert chime
      if (ms <= 60000 && ms > 0 && !warnedOneMinuteRef.current) {
        warnedOneMinuteRef.current = true;
        playWarningTick(0.4);
      }

      // Expired completion chime
      if (ms <= 0 && !playedExpiredChimeRef.current) {
        playedExpiredChimeRef.current = true;
        playCompletionChime(0.5);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTime();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', updateTime);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', updateTime);
    };
  }, [awayState.deadlineTime]);

  const isExpired = remainingMs <= 0;
  const isOneMinuteWarning = remainingMs <= 60000 && !isExpired;

  // Fraction for progress bar
  const totalAllocated = awayState.allocatedDurationMs || 60000;
  const fractionRemaining = Math.max(0, Math.min(1, remainingMs / totalAllocated));
  const progressPercent = Math.round(fractionRemaining * 100);

  const originSite = awayState.originSiteName || 'Guarded Site';

  // 1. Minimized floating pill
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed top-4 right-4 z-[2147483647] flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/95 text-slate-900 border border-white/60 shadow-xl backdrop-blur-2xl cursor-pointer hover:scale-105 transition-all select-none animate-lg-fade-in"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
        title="Click to expand Away HUD"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isExpired
              ? 'bg-red-500 animate-ping'
              : isOneMinuteWarning
              ? 'bg-amber-500 animate-pulse'
              : 'bg-[#007AFF] animate-pulse'
          }`}
        />
        <span className="font-mono tabular-nums font-bold text-xs">
          {formatTime(remainingMs)}
        </span>
        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">
          {originSite}
        </span>
        <Maximize2 className="w-3 h-3 text-slate-400" />
      </div>
    );
  }

  // 2. Full Liquid Glass Away HUD Card
  return (
    <div
      className="fixed top-4 right-4 z-[2147483647] w-80 max-w-[calc(100vw-2rem)] select-none antialiased animate-lg-slide-up"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
      role="region"
      aria-label="Focus Guard Away Reminder"
    >
      <div
        className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl relative overflow-hidden transition-all ${
          isExpired
            ? 'bg-white/95 border-red-300 text-slate-900 shadow-red-500/10'
            : isOneMinuteWarning
            ? 'bg-white/95 border-amber-300 text-slate-900 shadow-amber-500/10'
            : 'bg-white/95 border-white/70 text-slate-900 shadow-slate-900/15'
        }`}
      >
        {/* Specular Inner Highlight */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isExpired
                  ? 'bg-red-500 animate-ping'
                  : isOneMinuteWarning
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-[#007AFF] animate-pulse'
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
              Away from {originSite}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Minimize to pill"
              aria-label="Minimize HUD"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDismissAway}
              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Dismiss away session"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stated Reason */}
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-slate-700 truncate" title={awayState.reason}>
            "{awayState.reason}"
          </div>
        </div>

        {/* 1-Minute Alert Banner */}
        {isOneMinuteWarning && (
          <div className="mb-3 flex items-center space-x-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-semibold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
            <span>1 minute left to return to {originSite}!</span>
          </div>
        )}

        {/* Countdown Display & Progress Bar */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span
              className={`font-mono tabular-nums text-3xl font-extrabold tracking-tight ${
                isExpired
                  ? 'text-red-600'
                  : isOneMinuteWarning
                  ? 'text-amber-600'
                  : 'text-[#007AFF]'
              }`}
            >
              {isExpired ? '00:00' : formatTime(remainingMs)}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {isExpired ? 'Time Expired' : `${progressPercent}% remaining`}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
            <div
              className={`h-full transition-all duration-1000 ${
                isExpired
                  ? 'bg-red-500'
                  : isOneMinuteWarning
                  ? 'bg-amber-500'
                  : 'bg-[#007AFF]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Expired Completion Dialog or Normal Controls */}
        {isExpired ? (
          <div className="space-y-2 pt-1 border-t border-slate-200/60 animate-lg-fade-in">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Did you finish your task?</span>
            </div>

            <button
              type="button"
              onClick={onReturnToSite}
              className="w-full py-2.5 px-3 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white text-xs font-bold shadow-md shadow-[#007AFF]/25 flex items-center justify-center space-x-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Yes, Return to {originSite}</span>
            </button>

            <div className="flex space-x-1.5">
              <button
                type="button"
                onClick={() => onExtendAwayMinutes(2)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>+2m More</span>
              </button>
              <button
                type="button"
                onClick={() => onExtendAwayMinutes(5)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>+5m More</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Controls */
          <div className="space-y-2 pt-1 border-t border-slate-200/60">
            <button
              type="button"
              onClick={onReturnToSite}
              className="w-full py-2.5 px-3 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white text-xs font-bold shadow-md shadow-[#007AFF]/25 flex items-center justify-center space-x-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to {originSite} Now</span>
            </button>

            <div className="flex space-x-1.5">
              <button
                type="button"
                onClick={() => onExtendAwayMinutes(1)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold font-mono transition-colors flex items-center justify-center space-x-1"
                title="Add 1 minute to return timer"
              >
                <Plus className="w-3 h-3" />
                <span>+1m</span>
              </button>
              <button
                type="button"
                onClick={() => onExtendAwayMinutes(5)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold font-mono transition-colors flex items-center justify-center space-x-1"
                title="Add 5 minutes to return timer"
              >
                <Plus className="w-3 h-3" />
                <span>+5m</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
