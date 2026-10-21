import { SiteId } from '../shared/types';

/**
 * Detects whether the current page belongs to Facebook or YouTube.
 * Returns null if on an unsupported domain.
 */
export function detectCurrentSite(hostname = window.location.hostname): SiteId | null {
  const host = hostname.toLowerCase();

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
