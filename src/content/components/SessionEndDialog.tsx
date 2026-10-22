import React, { useEffect } from 'react';
import { FocusSession } from '../../shared/types';
import {
  Shield,
  Clock,
  CheckCircle2,
  ListChecks,
  Plus,
  LogOut,
  PlayCircle,
} from 'lucide-react';

interface SessionEndDialogProps {
  session: FocusSession;
  isExpired: boolean;
  onFinish: () => void;
  onAbandon?: () => void;
  onContinue?: () => void;
  onExtendMinutes?: (minutes: number) => void;
  onLeaveSite?: () => void;
}

export const SessionEndDialog: React.FC<SessionEndDialogProps> = ({
  session,
  isExpired,
  onFinish,
  onAbandon,
  onContinue,
  onExtendMinutes,
  onLeaveSite,
}) => {
  const completedTasks = session.tasks.filter((t) => t.completed).length;
  const totalTasks = session.tasks.length;
  const actualDurationMs = Date.now() - session.startTime;
  const plannedMinutes = Math.round(session.allocatedDurationMs / 60000);
  const actualMinutes = Math.max(1, Math.round(actualDurationMs / 60000));

  // Completely block scrolling and interaction with site feed behind lockout overlay
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

  const handleLeaveSite = () => {
    if (onLeaveSite) {
      onLeaveSite();
    } else if (onAbandon) {
      onAbandon();
    } else if (onFinish) {
      onFinish();
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

  const siteDisplayName =
    session.site === 'youtube'
      ? 'YouTube'
      : session.site === 'facebook'
      ? 'Facebook'
      : session.site.charAt(0).toUpperCase() + session.site.slice(1);

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans select-none antialiased text-slate-900"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lockout-dialog-title"
    >
      <div className="w-full max-w-md bg-white/95 text-slate-900 border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-5 backdrop-blur-xl animate-slide-up">
        {/* Header - Apple White Mode */}
        <div className="flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isExpired
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20'
            }`}
          >
            {isExpired ? (
              <Clock className="w-5 h-5 animate-pulse" />
            ) : (
              <Shield className="w-5 h-5 text-[#007AFF]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                LocalGuard Lockout
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold font-mono">
                {siteDisplayName}
              </span>
            </div>
            <h3
              id="lockout-dialog-title"
              className="text-lg font-bold text-slate-900 tracking-tight mt-0.5"
            >
              {isExpired ? "Time's Up! Site Locked" : 'End Focused Session?'}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {isExpired
                ? 'Your planned session duration has elapsed. Access to this site is locked.'
                : 'Review your session summary and choose how to proceed.'}
            </p>
          </div>
        </div>

        {/* Session Review Card */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3 text-xs text-slate-700">
          <div>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block mb-0.5">
              Session Purpose
            </span>
            <div className="font-semibold text-slate-900 text-sm truncate">
              "{session.purpose}"
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#007AFF]" />
              <span>
                Planned: <strong className="text-slate-900 font-mono">{plannedMinutes}m</strong>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                Actual: <strong className="text-slate-900 font-mono">{actualMinutes}m</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60">
            <ListChecks className="w-4 h-4 text-emerald-600" />
            <span>
              Tasks completed:{' '}
              <strong className="text-emerald-700 font-mono">
                {completedTasks}/{totalTasks}
              </strong>
            </span>
          </div>

          {/* Actionable Tasks Checklist Review */}
          {session.tasks.length > 0 && (
            <div className="max-h-28 overflow-y-auto space-y-1.5 pt-1 pr-1">
              {session.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center space-x-2 text-xs p-1.5 rounded-lg bg-white border border-slate-200/60"
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                      task.completed
                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {task.completed ? '✓' : '○'}
                  </span>
                  <span
                    className={`truncate ${
                      task.completed
                        ? 'line-through text-slate-400'
                        : 'text-slate-800 font-medium'
                    }`}
                  >
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          {/* Action 1: Finish Session */}
          <button
            type="button"
            onClick={onFinish}
            className="w-full py-3 px-4 bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 shadow-md shadow-[#007AFF]/25 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish Session</span>
          </button>

          {/* Action 2: Extend Session (+5m, +10m) */}
          {onExtendMinutes && (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => onExtendMinutes(5)}
                className="flex-1 py-2.5 px-3 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 active:bg-[#007AFF]/30 text-[#007AFF] border border-[#007AFF]/20 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Extend +5m</span>
              </button>
              <button
                type="button"
                onClick={() => onExtendMinutes(10)}
                className="flex-1 py-2.5 px-3 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 active:bg-[#007AFF]/30 text-[#007AFF] border border-[#007AFF]/20 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Extend +10m</span>
              </button>
            </div>
          )}

          {/* Action 3: Leave Site */}
          <button
            type="button"
            onClick={handleLeaveSite}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Leave Site</span>
          </button>

          {/* Subtle Resume Session if manually invoked and not expired */}
          {!isExpired && onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="w-full py-1 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors flex items-center justify-center space-x-1"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Resume Session</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
