import { describe, it, expect } from 'vitest';
import {
  calculateRemainingMs,
  formatTime,
  getTimerColorState,
  calculateProgressFraction,
} from '../src/features/session/timerCalculations';

describe('Timer and Adaptive Color System', () => {
  // Scenario 6: Timer countdown accuracy
  it('Scenario 6: calculates countdown remaining milliseconds accurately from deadline', () => {
    const now = 1000000;
    const deadline = now + 15 * 60 * 1000; // 15 mins

    expect(calculateRemainingMs(deadline, now)).toBe(15 * 60 * 1000);
    expect(calculateRemainingMs(deadline, now + 5000)).toBe(15 * 60 * 1000 - 5000);
    expect(calculateRemainingMs(deadline, deadline + 1000)).toBe(0); // Clamped to 0
  });

  // Scenario 7: Timer expiry
  it('Scenario 7: accurately formats time and reflects expired state at 00:00', () => {
    expect(formatTime(15 * 60 * 1000)).toBe('15:00');
    expect(formatTime(65 * 1000)).toBe('01:05');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(3665 * 1000)).toBe('01:01:05');

    const expiredState = getTimerColorState(0);
    expect(expiredState.phase).toBe('expired');
    expect(expiredState.label).toBe("Time's up");
    expect(expiredState.primaryHex).toBe('#ef4444');
  });

  // Scenario 8: Minute-boundary color transitions
  it('Scenario 8: changes visual accent at minute boundaries', () => {
    // 14 minutes remaining (odd minute) vs 13 minutes remaining (even minute or opposite parity)
    const state14m = getTimerColorState(14 * 60 * 1000);
    const state13m = getTimerColorState(13 * 60 * 1000);

    expect(state14m.minuteCycle).toBe(14);
    expect(state13m.minuteCycle).toBe(13);
    // Subtle alternate visual accent between odd and even minutes
    expect(state14m.primaryHex).not.toBe(state13m.primaryHex);
  });

  // Scenario 9: Threshold color priority
  it('Scenario 9: enforces threshold color priorities over ordinary cycle', () => {
    // > 10 min: Calm cyan / blue
    const calm = getTimerColorState(12 * 60 * 1000);
    expect(calm.phase).toBe('calm');

    // <= 10 min: Teal / green
    const steady = getTimerColorState(9 * 60 * 1000);
    expect(steady.phase).toBe('steady');

    // <= 5 min: Amber
    const warning = getTimerColorState(4 * 60 * 1000);
    expect(warning.phase).toBe('warning');

    // <= 2 min: Orange
    const urgent = getTimerColorState(100 * 1000); // 1m 40s
    expect(urgent.phase).toBe('urgent');

    // <= 1 min: Red
    const critical = getTimerColorState(45 * 1000); // 45s
    expect(critical.phase).toBe('critical');

    // <= 0: Expired
    const expired = getTimerColorState(0);
    expect(expired.phase).toBe('expired');
  });

  it('calculates progress fraction cleanly between 0 and 1', () => {
    const total = 10 * 60 * 1000;
    expect(calculateProgressFraction(total, total)).toBe(0);
    expect(calculateProgressFraction(total, total / 2)).toBe(0.5);
    expect(calculateProgressFraction(total, 0)).toBe(1);
    expect(calculateProgressFraction(total, -5000)).toBe(1);
  });
});
