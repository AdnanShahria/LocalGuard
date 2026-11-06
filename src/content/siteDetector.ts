import { GuardedSite } from '../shared/types';

/**
 * Normalizes a stored domain/URL pattern for matching.
 * For http/https entries: strips protocol and www, extracts hostname.
 * For all other schemes (file://, chrome://, edge://, about:, etc.): preserves the full value as-is.
 */
function normalizeSitePattern(raw: string): { type: 'hostname' | 'prefix'; value: string } {
  const trimmed = raw.trim();
  // Non-HTTP/HTTPS schemes (file://, chrome://, edge://, about:, chrome-extension://, etc.)
  if (/^(file|chrome|edge|about|chrome-extension|moz-extension|brave|opera):/.test(trimmed.toLowerCase())) {
    return { type: 'prefix', value: trimmed.toLowerCase() };
  }
  // Standard http/https — extract hostname only
  const hostOnly = trimmed
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '');
  return { type: 'hostname', value: hostOnly };
}

/**
 * Detects whether the current page belongs to any enabled guarded site.
 *
 * Supports:
 *  - Exact domain match and subdomain matches for http/https sites
 *    (e.g. m.facebook.com matches facebook.com)
 *  - Full URL prefix match for browser-native URLs:
 *    file://, chrome://, edge://, about:, chrome-extension://, etc.
 *    (e.g. "file:///C:/Users/Adnan/Desktop/SStudy" matches any file under that folder)
 */
export function detectGuardedSite(
  hostname = window.location.hostname,
  guardedSites: GuardedSite[] = [],
  fullUrl = typeof window !== 'undefined' ? window.location.href : ''
): GuardedSite | null {
  if (!Array.isArray(guardedSites)) {
    return null;
  }

  const host = hostname.toLowerCase();
  const url = fullUrl.toLowerCase();

  for (const site of guardedSites) {
    if (!site || !site.enabled || !site.domain) continue;

    const pattern = normalizeSitePattern(site.domain);

    if (pattern.type === 'prefix') {
      // Match if the current full URL starts with the stored prefix
      if (url.startsWith(pattern.value)) {
        return site;
      }
    } else {
      // Standard hostname match (exact or subdomain)
      if (!host) continue;
      const d = pattern.value;
      if (host === d || host.endsWith('.' + d)) {
        return site;
      }
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
