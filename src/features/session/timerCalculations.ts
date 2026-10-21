/**
 * LifeSolver Focus Guard - Adaptive Timer & Color System
 *
 * Implements deadline-based countdown calculations and the adaptive
 * minute-boundary + priority threshold color palette.
 */

export interface TimerColorState {
  phase: 'calm' | 'steady' | 'warning' | 'urgent' | 'critical' | 'expired';
  primaryHex: string;
  ringHex: string;
  glowHex: string;
  bgHex: string;
  textColor: string;
  label?: string;
  minuteCycle: number;
  minuteBoundaryActive: boolean;
}

/**
 * Calculates remaining milliseconds from a deadline timestamp.
 * Guarantees a non-negative integer.
 */
export function calculateRemainingMs(deadlineTimestamp: number, currentTimestamp = Date.now()): number {
  return Math.max(0, deadlineTimestamp - currentTimestamp);
}

/**
 * Formats milliseconds into MM:SS or HH:MM:SS.
 */
export function formatTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Computes the adaptive timer visual state.
 *
 * Priority Thresholds:
 * - Expired (remainingMs <= 0): Strong Red with 'Time's up'
 * - <= 1 min: Red (critical)
 * - <= 2 min: Orange (urgent)
 * - <= 5 min: Amber (warning)
 * - <= 10 min: Teal/Green (steady)
 * - > 10 min: Cyan/Blue (calm)
 *
 * Minute-Boundary Cycle:
 * - Changes accent visual tint at each minute boundary without overriding threshold priority.
 */
export function getTimerColorState(remainingMs: number): TimerColorState {
  const minuteIndex = Math.floor(remainingMs / 60000);
  const secondsIntoMinute = Math.floor((remainingMs % 60000) / 1000);
  // Mark minute boundary as active during the first 3 seconds of a new minute
  const minuteBoundaryActive = secondsIntoMinute >= 57 || secondsIntoMinute <= 1;

  if (remainingMs <= 0) {
    return {
      phase: 'expired',
      primaryHex: '#ef4444',
      ringHex: '#dc2626',
      glowHex: 'rgba(239, 68, 68, 0.45)',
      bgHex: 'rgba(239, 68, 68, 0.12)',
      textColor: '#f87171',
      label: "Time's up",
      minuteCycle: 0,
      minuteBoundaryActive: false,
    };
  }

  // Minute cycle accent offset (alternates subtle visual accents per minute)
  const isOddMinute = minuteIndex % 2 === 1;

  // 1 minute or less: Red
  if (remainingMs <= 60_000) {
    return {
      phase: 'critical',
      primaryHex: isOddMinute ? '#f87171' : '#ef4444',
      ringHex: '#ef4444',
      glowHex: 'rgba(239, 68, 68, 0.35)',
      bgHex: 'rgba(239, 68, 68, 0.1)',
      textColor: '#fca5a5',
      label: 'Final minute',
      minuteCycle: minuteIndex,
      minuteBoundaryActive,
    };
  }

  // 2 minutes or less: Orange
  if (remainingMs <= 120_000) {
    return {
      phase: 'urgent',
      primaryHex: isOddMinute ? '#fb923c' : '#f97316',
      ringHex: '#f97316',
      glowHex: 'rgba(249, 115, 22, 0.35)',
      bgHex: 'rgba(249, 115, 22, 0.1)',
      textColor: '#fdba74',
      label: 'Under 2 mins',
      minuteCycle: minuteIndex,
      minuteBoundaryActive,
    };
  }

  // 5 minutes or less: Amber
  if (remainingMs <= 300_000) {
    return {
      phase: 'warning',
      primaryHex: isOddMinute ? '#fbbf24' : '#f59e0b',
      ringHex: '#f59e0b',
      glowHex: 'rgba(245, 158, 11, 0.35)',
      bgHex: 'rgba(245, 158, 11, 0.1)',
      textColor: '#fde68a',
      label: 'Wrapping up',
      minuteCycle: minuteIndex,
      minuteBoundaryActive,
    };
  }

  // 10 minutes or less: Teal / Green
  if (remainingMs <= 600_000) {
    return {
      phase: 'steady',
      primaryHex: isOddMinute ? '#14b8a6' : '#10b981',
      ringHex: '#10b981',
      glowHex: 'rgba(16, 185, 129, 0.35)',
      bgHex: 'rgba(16, 185, 129, 0.1)',
      textColor: '#6ee7b7',
      label: 'Focus flow',
      minuteCycle: minuteIndex,
      minuteBoundaryActive,
    };
  }

  // More than 10 minutes: Calm Cyan / Blue
  return {
    phase: 'calm',
    primaryHex: isOddMinute ? '#06b6d4' : '#3b82f6',
    ringHex: '#0ea5e9',
    glowHex: 'rgba(6, 182, 212, 0.35)',
    bgHex: 'rgba(6, 182, 212, 0.1)',
    textColor: '#7dd3fc',
    label: 'Deep focus',
    minuteCycle: minuteIndex,
    minuteBoundaryActive,
  };
}

/**
 * Computes progress fraction (0 to 1) representing elapsed time.
 */
export function calculateProgressFraction(allocatedDurationMs: number, remainingMs: number): number {
  if (allocatedDurationMs <= 0) return 1;
  const elapsed = allocatedDurationMs - remainingMs;
  return Math.min(1, Math.max(0, elapsed / allocatedDurationMs));
}
