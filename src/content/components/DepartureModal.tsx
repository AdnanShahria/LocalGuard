import React, { useState, useEffect } from 'react';
import { AwayState } from '../../shared/types';
import { saveAwayState } from '../../storage/storage';
import {
  Compass,
  Clock,
  ArrowRight,
  AlertCircle,
  CornerDownLeft,
} from 'lucide-react';

export interface DepartureModalProps {
  originSiteId: string;
  originSiteDomain: string;
  originSiteName: string;
  originUrl?: string;
  originTabId?: number;
  onStay: () => void;
  onProceedAway: (awayState: AwayState) => void;
}

export const DepartureModal: React.FC<DepartureModalProps> = ({
  originSiteId,
  originSiteDomain,
  originSiteName,
  originUrl,
  originTabId,
  onStay,
  onProceedAway,
}) => {
  const [reason, setReason] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(3);
  const [isCustom, setIsCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('2');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presets = [1, 3, 5, 10];

  // Lock body scroll while modal is active
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

  const handleSelectPreset = (mins: number) => {
    setSelectedMinutes(mins);
    setIsCustom(false);
    setErrorMessage(null);
  };

  const handleCustomChange = (val: string) => {
    setCustomMinutes(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      setSelectedMinutes(parsed);
      setErrorMessage(null);
    }
  };

  const handleStartAway = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage('Please state why you are leaving before proceeding.');
      return;
    }

    let finalMinutes = selectedMinutes;
    if (isCustom) {
      const parsed = parseInt(customMinutes, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 60) {
        setErrorMessage('Please enter a valid return duration between 1 and 60 minutes.');
        return;
      }
      finalMinutes = parsed;
    }

    const durationMs = finalMinutes * 60 * 1000;
    const now = Date.now();
    const deadline = now + durationMs;

    const newAwayState: AwayState = {
      isAway: true,
      reason: trimmedReason,
      originTabId: originTabId,
      originSiteId,
      originSiteDomain,
      originSiteName,
      originUrl: originUrl || window.location.href,
      departedAt: now,
      allocatedDurationMs: durationMs,
      deadlineTime: deadline,
      warnedOneMinuteLeft: false,
    };

    // Save to storage
    await saveAwayState(newAwayState);

    // Broadcast message to background
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'START_AWAY_SESSION',
        awayState: newAwayState,
      });
    }

    onProceedAway(newAwayState);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 select-none antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        background: 'rgba(11, 15, 25, 0.78)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-modal-title"
    >
      <div className="w-full max-w-lg bg-white/95 text-slate-900 border border-white/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] rounded-3xl p-6 sm:p-7 backdrop-blur-2xl relative overflow-hidden animate-lg-slide-up space-y-5">
        {/* Specular Edge Highlight */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />

        {/* Header Bar */}
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/25 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                Focus Guard Departure
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono border border-slate-200">
                {originSiteName}
              </span>
            </div>
            <h2
              id="departure-modal-title"
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1"
            >
              Why are you leaving {originSiteName}?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
              You are currently in Focus Mode. Set your departure intention and return countdown timer to stay accountable.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium animate-lg-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleStartAway} className="space-y-4">
          {/* Reason Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="departure-reason-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Where are you going / What is your task? <span className="text-red-500">*</span>
            </label>
            <input
              id="departure-reason-input"
              type="text"
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="e.g. Checking work email, reading documentation, brief search..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white/90 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] shadow-xs"
            />
          </div>

          {/* Return Timer Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>Return Timer Duration</span>
              </label>
              <span className="text-xs font-mono font-bold text-[#007AFF]">
                {selectedMinutes} {selectedMinutes === 1 ? 'minute' : 'minutes'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {presets.map((mins) => {
                const isSelected = !isCustom && selectedMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold font-mono transition-all ${
                      isSelected
                        ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/30 scale-[1.02]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}

              {/* Custom Preset Button */}
              <button
                type="button"
                onClick={() => {
                  setIsCustom(true);
                  const parsed = parseInt(customMinutes, 10);
                  if (!isNaN(parsed)) setSelectedMinutes(parsed);
                }}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                  isCustom
                    ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/30 scale-[1.02]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Minutes Input */}
            {isCustom && (
              <div className="flex items-center space-x-2 pt-1 animate-lg-fade-in">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={customMinutes}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white"
                />
                <span className="text-xs text-slate-500 font-medium">
                  minutes before reminder triggers
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons: Stay vs Proceed */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Stay on Site */}
            <button
              type="button"
              onClick={onStay}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition-colors"
            >
              <CornerDownLeft className="w-4 h-4 text-slate-500" />
              <span>Stay on {originSiteName}</span>
            </button>

            {/* Start Return Timer & Proceed */}
            <button
              type="submit"
              onClick={handleStartAway}
              className="py-3 px-4 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:bg-[#005bc1] text-white shadow-md shadow-[#007AFF]/25 font-semibold text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition-all"
            >
              <span>Start Timer & Proceed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
