import { GuardedSite } from '../shared/types';

/**
 * Detects whether the current page belongs to any enabled guarded site.
 * Supports exact domain match and subdomain matches (e.g. m.facebook.com matches facebook.com).
 */
export function detectGuardedSite(
  hostname = window.location.hostname,
  guardedSites: GuardedSite[] = []
): GuardedSite | null {
  if (!hostname || !Array.isArray(guardedSites)) {
    return null;
  }

  const host = hostname.toLowerCase();
  for (const site of guardedSites) {
    if (!site || !site.enabled || !site.domain) continue;
    const d = site.domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (host === d || host.endsWith('.' + d)) {
      return site;
    }
  }
  return null;
}

/**
 * Backward compatibility helper for legacy hardcoded site checks.
 */
export function detectCurrentSite(hostname = window.location.hostname): string | null {
  const host = (hostname || '').toLowerCase();

  // YouTube match
  if (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host.endsWith('.youtube.com')
  ) {
    return 'youtube';
  }

  // Facebook match
  if (
    host === 'facebook.com' ||
    host === 'www.facebook.com' ||
    host === 'm.facebook.com' ||
    host === 'web.facebook.com' ||
    host.endsWith('.facebook.com')
  ) {
    return 'facebook';
  }

  return null;
}
