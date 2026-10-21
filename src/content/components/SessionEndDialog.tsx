import React from 'react';
import { FocusSession } from '../../shared/types';
import { CheckCircle2, AlertTriangle, PlayCircle, Clock, ListChecks } from 'lucide-react';

interface SessionEndDialogProps {
  session: FocusSession;
  isExpired: boolean;
  onFinish: () => void;
  onAbandon: () => void;
  onContinue: () => void;
  onExtendMinutes?: (minutes: number) => void;
}

export const SessionEndDialog: React.FC<SessionEndDialogProps> = ({
  session,
  isExpired,
  onFinish,
  onAbandon,
  onContinue,
  onExtendMinutes,
}) => {
  const completedTasks = session.tasks.filter((t) => t.completed).length;
  const totalTasks = session.tasks.length;
  const actualDurationMs = Date.now() - session.startTime;
  const plannedMinutes = Math.round(session.allocatedDurationMs / 60000);
  const actualMinutes = Math.max(1, Math.round(actualDurationMs / 60000));

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-slate-100 font-sans">
      <div
        className="w-full max-w-md bg-[#111420] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isExpired
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {isExpired ? <Clock className="w-5 h-5 animate-pulse" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {isExpired ? "Time's Up!" : 'End this focus session?'}
            </h3>
            <p className="text-xs text-slate-400">
              {isExpired
                ? 'Your planned session duration has ended. Review your accomplishments.'
                : 'Choose how you want to record this session.'}
            </p>
          </div>
        </div>

        {/* Session Summary Card */}
        <div className="p-3.5 bg-[#171c2b] border border-white/5 rounded-xl space-y-2.5 text-xs text-slate-300">
          <div className="font-medium text-white truncate text-sm">
            "{session.purpose}"
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>
                Planned: <strong className="text-white">{plannedMinutes}m</strong>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>
                Actual: <strong className="text-white">{actualMinutes}m</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-white/5">
            <ListChecks className="w-4 h-4 text-emerald-400" />
            <span>
              Tasks completed: <strong className="text-emerald-400">{completedTasks}/{totalTasks}</strong>
            </span>
          </div>

          {/* Quick Tasks List preview */}
          <div className="max-h-24 overflow-y-auto space-y-1 pt-1">
            {session.tasks.map((t) => (
              <div key={t.id} className="flex items-center space-x-2 text-[11px]">
                <span className={t.completed ? 'text-emerald-400' : 'text-slate-500'}>
                  {t.completed ? '✓' : '○'}
                </span>
                <span className={t.completed ? 'line-through text-slate-400' : 'text-slate-200'}>
                  {t.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onFinish}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish Session</span>
          </button>

          {isExpired && onExtendMinutes && (
            <div className="flex space-x-2">
              <button
                onClick={() => onExtendMinutes(5)}
                className="flex-1 py-2 px-3 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-medium transition-colors"
              >
                +5 Mins
              </button>
              <button
                onClick={() => onExtendMinutes(10)}
                className="flex-1 py-2 px-3 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-medium transition-colors"
              >
                +10 Mins
              </button>
            </div>
          )}

          <div className="flex space-x-2 pt-1">
            {!isExpired && (
              <button
                onClick={onContinue}
                className="flex-1 py-2 px-3 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-1"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Continue</span>
              </button>
            )}
            <button
              onClick={onAbandon}
              className="flex-1 py-2 px-3 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-colors"
            >
              Abandon Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
