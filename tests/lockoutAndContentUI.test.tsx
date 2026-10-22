import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenLockoutOverlay } from '../src/content/components/ScreenLockoutOverlay';
import { DepartureModal } from '../src/content/components/DepartureModal';
import { AwayReminderHUD } from '../src/content/components/AwayReminderHUD';
import { PurposeModal } from '../src/content/components/PurposeModal';
import { FocusSession, AwayState, DEFAULT_SETTINGS } from '../src/shared/types';
import { resetMockStorage } from './setup';

describe('Lockout & Content UI Components', () => {
  beforeEach(() => {
    resetMockStorage();
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  });

  const mockSession: FocusSession = {
    id: 'test-session-1',
    site: 'youtube',
    purpose: 'Learn React Query caching patterns',
    tasks: [
      { id: 't1', text: 'Watch video 1', completed: true },
      { id: 't2', text: 'Take code notes', completed: false },
    ],
    startTime: Date.now() - 15 * 60 * 1000,
    allocatedDurationMs: 15 * 60 * 1000,
    deadlineTime: Date.now(),
    status: 'expired',
    lastUpdateTime: Date.now(),
    actualDurationMs: 15 * 60 * 1000,
    wasExpired: true,
    tasksCompletedCount: 1,
    totalTasksCount: 2,
    mode: 'focus',
  };

  describe('ScreenLockoutOverlay', () => {
    it('locks viewport overflow and touch actions on mount', () => {
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          reason="timer_expired"
          onCompleteAndReview={vi.fn()}
          onExtendMinutes={vi.fn()}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={vi.fn()}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');
      expect(document.body.style.touchAction).toBe('none');
    });

    it('renders the session summary, purpose, and all 4 distinct action cases', () => {
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          reason="user_stopped"
          onCompleteAndReview={vi.fn()}
          onExtendMinutes={vi.fn()}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={vi.fn()}
        />
      );

      // Verify site and purpose
      expect(screen.getByText('YouTube')).toBeDefined();
      expect(screen.getByText('"Learn React Query caching patterns"')).toBeDefined();

      // Verify all 4 case badges
      expect(screen.getByText('Case 1')).toBeDefined();
      expect(screen.getByText('Complete & Review Session')).toBeDefined();

      expect(screen.getByText('Case 2')).toBeDefined();
      expect(screen.getByText('Extend Focus Session')).toBeDefined();

      expect(screen.getByText('Case 3')).toBeDefined();
      expect(screen.getByText('Switch Focus Task')).toBeDefined();

      expect(screen.getByText('Case 4')).toBeDefined();
      expect(screen.getByText('Close Tab / Leave Site')).toBeDefined();
    });

    it('triggers Case 1: onCompleteAndReview when clicked', () => {
      const handleComplete = vi.fn();
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          onCompleteAndReview={handleComplete}
          onExtendMinutes={vi.fn()}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={vi.fn()}
        />
      );

      const case1Btn = screen.getByText('Complete & Review Session').closest('button');
      expect(case1Btn).not.toBeNull();
      fireEvent.click(case1Btn!);
      expect(handleComplete).toHaveBeenCalledTimes(1);
    });

    it('triggers Case 2: onExtendMinutes with +5m, +15m, +25m presets', () => {
      const handleExtend = vi.fn();
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          onCompleteAndReview={vi.fn()}
          onExtendMinutes={handleExtend}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('+5m'));
      expect(handleExtend).toHaveBeenCalledWith(5);

      fireEvent.click(screen.getByText('+15m'));
      expect(handleExtend).toHaveBeenCalledWith(15);

      fireEvent.click(screen.getByText('+25m'));
      expect(handleExtend).toHaveBeenCalledWith(25);
    });

    it('triggers Case 4: onCloseTabOrLeave when clicked', () => {
      const handleLeave = vi.fn();
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          onCompleteAndReview={vi.fn()}
          onExtendMinutes={vi.fn()}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={handleLeave}
        />
      );

      const case4Btn = screen.getByText('Close Tab / Leave Site').closest('button');
      expect(case4Btn).not.toBeNull();
      fireEvent.click(case4Btn!);
      expect(handleLeave).toHaveBeenCalledTimes(1);
    });

    it('allows toggling task checklist inside lockout overlay', () => {
      const handleUpdateTasks = vi.fn();
      render(
        <ScreenLockoutOverlay
          session={mockSession}
          onCompleteAndReview={vi.fn()}
          onExtendMinutes={vi.fn()}
          onSwitchTask={vi.fn()}
          onCloseTabOrLeave={vi.fn()}
          onUpdateSessionTasks={handleUpdateTasks}
        />
      );

      const taskBtn = screen.getByText('Take code notes').closest('button');
      expect(taskBtn).not.toBeNull();
      fireEvent.click(taskBtn!);
      expect(handleUpdateTasks).toHaveBeenCalled();
    });
  });

  describe('DepartureModal', () => {
    it('renders departure prompt header and presets', () => {
      render(
        <DepartureModal
          originSiteId="youtube"
          originSiteDomain="youtube.com"
          originSiteName="YouTube"
          onStay={vi.fn()}
          onProceedAway={vi.fn()}
        />
      );

      expect(screen.getByText('Why are you leaving YouTube?')).toBeDefined();
      expect(screen.getByText('1m')).toBeDefined();
      expect(screen.getByText('3m')).toBeDefined();
      expect(screen.getByText('5m')).toBeDefined();
      expect(screen.getByText('10m')).toBeDefined();
    });

    it('calls onStay when Stay on Site is clicked', () => {
      const handleStay = vi.fn();
      render(
        <DepartureModal
          originSiteId="youtube"
          originSiteDomain="youtube.com"
          originSiteName="YouTube"
          onStay={handleStay}
          onProceedAway={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Stay on YouTube'));
      expect(handleStay).toHaveBeenCalledTimes(1);
    });

    it('requires a reason before proceeding with return timer', async () => {
      const handleProceed = vi.fn();
      render(
        <DepartureModal
          originSiteId="youtube"
          originSiteDomain="youtube.com"
          originSiteName="YouTube"
          onStay={vi.fn()}
          onProceedAway={handleProceed}
        />
      );

      fireEvent.click(screen.getByText('Start Timer & Proceed'));
      expect(handleProceed).not.toHaveBeenCalled();
      expect(screen.getByText('Please state why you are leaving before proceeding.')).toBeDefined();

      // Now enter a reason
      const input = screen.getByPlaceholderText(/Checking work email/);
      fireEvent.change(input, { target: { value: 'Quick documentation check' } });
      fireEvent.click(screen.getByText('Start Timer & Proceed'));

      await vi.waitFor(() => {
        expect(handleProceed).toHaveBeenCalledTimes(1);
      });
      const awayArg = handleProceed.mock.calls[0][0] as AwayState;
      expect(awayArg.isAway).toBe(true);
      expect(awayArg.reason).toBe('Quick documentation check');
      expect(awayArg.originSiteId).toBe('youtube');
    });
  });

  describe('AwayReminderHUD', () => {
    const mockAwayState: AwayState = {
      isAway: true,
      reason: 'Reading API documentation',
      originSiteId: 'youtube',
      originSiteDomain: 'youtube.com',
      originSiteName: 'YouTube',
      departedAt: Date.now() - 60000,
      allocatedDurationMs: 180000,
      deadlineTime: Date.now() + 120000,
      warnedOneMinuteLeft: false,
    };

    it('renders badge, reason, and return button', () => {
      render(
        <AwayReminderHUD
          awayState={mockAwayState}
          onReturnToSite={vi.fn()}
          onExtendAwayMinutes={vi.fn()}
          onDismissAway={vi.fn()}
        />
      );

      expect(screen.getByText('Away from YouTube')).toBeDefined();
      expect(screen.getByText('"Reading API documentation"')).toBeDefined();
      expect(screen.getByText('Return to YouTube Now')).toBeDefined();
    });

    it('triggers onReturnToSite when clicked', () => {
      const handleReturn = vi.fn();
      render(
        <AwayReminderHUD
          awayState={mockAwayState}
          onReturnToSite={handleReturn}
          onExtendAwayMinutes={vi.fn()}
          onDismissAway={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Return to YouTube Now'));
      expect(handleReturn).toHaveBeenCalledTimes(1);
    });

    it('triggers onExtendAwayMinutes when +1m or +5m is clicked', () => {
      const handleExtend = vi.fn();
      render(
        <AwayReminderHUD
          awayState={mockAwayState}
          onReturnToSite={vi.fn()}
          onExtendAwayMinutes={handleExtend}
          onDismissAway={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('+1m'));
      expect(handleExtend).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByText('+5m'));
      expect(handleExtend).toHaveBeenCalledWith(5);
    });

    it('renders completion dialog when timer expires', () => {
      const expiredAwayState: AwayState = {
        ...mockAwayState,
        deadlineTime: Date.now() - 5000, // expired
      };

      render(
        <AwayReminderHUD
          awayState={expiredAwayState}
          onReturnToSite={vi.fn()}
          onExtendAwayMinutes={vi.fn()}
          onDismissAway={vi.fn()}
        />
      );

      expect(screen.getByText('Did you finish your task?')).toBeDefined();
      expect(screen.getByText('Yes, Return to YouTube')).toBeDefined();
      expect(screen.getByText('+2m More')).toBeDefined();
      expect(screen.getByText('+5m More')).toBeDefined();
    });
  });

  describe('PurposeModal Mode Toggle', () => {
    it('allows toggling between Focus Mode and Regular Mode', () => {
      const handleStart = vi.fn();
      render(
        <PurposeModal
          site="youtube"
          settings={DEFAULT_SETTINGS}
          onStartSession={handleStart}
          onLeaveSite={vi.fn()}
        />
      );

      expect(screen.getByText('Focus Mode')).toBeDefined();
      expect(screen.getByText('Regular Mode')).toBeDefined();

      // Click Regular Mode
      fireEvent.click(screen.getByText('Regular Mode'));

      // Enter purpose and start
      const purposeInput = document.getElementById('focus-purpose-input') as HTMLInputElement;
      fireEvent.change(purposeInput, { target: { value: 'Listen to study lo-fi' } });

      const startBtn = screen.getByText(/Start Focused Session/i);
      fireEvent.click(startBtn);

      expect(handleStart).toHaveBeenCalledTimes(1);
      const session = handleStart.mock.calls[0][0] as FocusSession;
      expect(session.purpose).toBe('Listen to study lo-fi');
      expect(session.mode).toBe('regular');
    });
  });
});
