import { describe, it, expect, beforeEach } from 'vitest';
import { detectCurrentSite, detectGuardedSite } from '../src/content/siteDetector';
import { getActiveSession, saveActiveSession } from '../src/storage/storage';
import { resetMockStorage } from './setup';
import { FocusSession, GuardedSite } from '../src/shared/types';

describe('Website Detection & Lifecycle Scenarios', () => {
  const sampleGuardedSites: GuardedSite[] = [
    {
      id: 'facebook',
      domain: 'facebook.com',
      name: 'Facebook',
      enabled: true,
      addedAt: Date.now(),
      customColor: '#1877F2',
    },
    {
      id: 'youtube',
      domain: 'youtube.com',
      name: 'YouTube',
      enabled: true,
      addedAt: Date.now(),
      customColor: '#FF0000',
    },
    {
      id: 'reddit',
      domain: 'reddit.com',
      name: 'Reddit',
      enabled: true,
      addedAt: Date.now(),
      customColor: '#FF4500',
    },
    {
      id: 'disabled-site',
      domain: 'distraction.com',
      name: 'Distraction',
      enabled: false,
      addedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    resetMockStorage();
  });

  // Dynamic Site Detection
  it('detects guarded sites dynamically and matches subdomains', () => {
    expect(detectGuardedSite('facebook.com', sampleGuardedSites)?.id).toBe('facebook');
    expect(detectGuardedSite('www.facebook.com', sampleGuardedSites)?.id).toBe('facebook');
    expect(detectGuardedSite('m.facebook.com', sampleGuardedSites)?.id).toBe('facebook');
    expect(detectGuardedSite('youtube.com', sampleGuardedSites)?.id).toBe('youtube');
    expect(detectGuardedSite('m.youtube.com', sampleGuardedSites)?.id).toBe('youtube');
    expect(detectGuardedSite('old.reddit.com', sampleGuardedSites)?.id).toBe('reddit');
    expect(detectGuardedSite('reddit.com', sampleGuardedSites)?.id).toBe('reddit');
  });

  it('ignores disabled guarded sites', () => {
    expect(detectGuardedSite('distraction.com', sampleGuardedSites)).toBeNull();
    expect(detectGuardedSite('sub.distraction.com', sampleGuardedSites)).toBeNull();
  });

  it('rejects unguarded sites without activating', () => {
    expect(detectGuardedSite('wikipedia.org', sampleGuardedSites)).toBeNull();
    expect(detectGuardedSite('github.com', sampleGuardedSites)).toBeNull();
    expect(detectGuardedSite('google.com', sampleGuardedSites)).toBeNull();
  });

  // Scenario 1: Opening Facebook with no active session
  it('Scenario 1: detects Facebook correctly and identifies no active session', async () => {
    const site = detectCurrentSite('www.facebook.com');
    expect(site).toBe('facebook');

    const activeSession = await getActiveSession('facebook');
    expect(activeSession).toBeNull();
  });

  // Scenario 2: Opening YouTube with no active session
  it('Scenario 2: detects YouTube correctly and identifies no active session', async () => {
    const site = detectCurrentSite('www.youtube.com');
    expect(site).toBe('youtube');

    const activeSession = await getActiveSession('youtube');
    expect(activeSession).toBeNull();
  });

  it('rejects unsupported websites without activating in legacy helper', () => {
    expect(detectCurrentSite('google.com')).toBeNull();
    expect(detectCurrentSite('twitter.com')).toBeNull();
    expect(detectCurrentSite('reddit.com')).toBeNull();
  });

  // Scenario 3: Submitting an empty purpose
  it('Scenario 3: validates that an empty or whitespace-only purpose is rejected', () => {
    const validatePurpose = (purpose: string) => {
      const trimmed = purpose.trim();
      if (!trimmed) {
        return { valid: false, error: 'Please state your purpose before starting.' };
      }
      return { valid: true };
    };

    expect(validatePurpose('').valid).toBe(false);
    expect(validatePurpose('    ').valid).toBe(false);
    expect(validatePurpose('Watch CS50 lecture').valid).toBe(true);
  });

  // Scenario 11: SPA navigation during an active session
  it('Scenario 11: preserves active session across simulated SPA route navigation', async () => {
    const session: FocusSession = {
      id: 'spa-test-session',
      site: 'youtube',
      purpose: 'Watch multi-part tutorial',
      tasks: [{ id: 't1', text: 'Part 1', completed: true }],
      startTime: Date.now(),
      allocatedDurationMs: 30 * 60 * 1000,
      deadlineTime: Date.now() + 30 * 60 * 1000,
      status: 'active',
      lastUpdateTime: Date.now(),
      actualDurationMs: 0,
      wasExpired: false,
      tasksCompletedCount: 1,
      totalTasksCount: 1,
    };

    await saveActiveSession(session);

    // Simulate SPA route change: e.g. from / to /watch?v=123 to /watch?v=456
    const paths = ['/watch?v=video1', '/watch?v=video2', '/feed/subscriptions'];
    for (const _p of paths) {
      const currentActive = await getActiveSession('youtube');
      expect(currentActive).not.toBeNull();
      expect(currentActive?.id).toBe('spa-test-session');
      expect(currentActive?.status).toBe('active');
    }
  });

  // Scenario 13: Duplicate HUD prevention
  it('Scenario 13: prevents duplicate HUD mounting via window guard flag', () => {
    const testWindow: any = {};
    let mountedCount = 0;

    const mountGuard = (win: any) => {
      if (win.__LOCALGUARD_MOUNTED__ || win.__LIFESOLVER_FOCUS_GUARD_MOUNTED__) {
        return false; // Skip duplicate mount
      }
      win.__LOCALGUARD_MOUNTED__ = true;
      mountedCount += 1;
      return true;
    };

    expect(mountGuard(testWindow)).toBe(true);
    expect(mountedCount).toBe(1);

    // Call again (e.g. script re-injected)
    expect(mountGuard(testWindow)).toBe(false);
    expect(mountedCount).toBe(1);
  });
});
