export interface ProtectionOptions {
  /** Block unwanted redirects */
  blockRedirects?: boolean;
  /** Restore right-click menu */
  enableRightClick?: boolean;
  /** Restore text selection */
  enableSelection?: boolean;
  /** Restore copy functionality */
  enableCopy?: boolean;
  /** Intercept keyboard listeners to prevent key blocking */
  unlockKeyboard?: boolean;
  /** Block popup windows */
  blockPopups?: boolean;
  /** Remove event hijacking */
  removeEventHijacking?: boolean;
  /** Block visibility change detection */
  blockVisibilityDetection?: boolean;
  /** Clear all timers (setInterval/setTimeout) to reduce CPU usage */
  clearTimers?: boolean;
  /** Clean up suspicious scripts (aggressive) */
  cleanupScripts?: boolean;
}

const DEFAULT_PROTECTION_OPTIONS: Required<ProtectionOptions> = {
  blockRedirects: true,
  enableRightClick: true,
  enableSelection: true,
  enableCopy: true,
  unlockKeyboard: true,
  blockPopups: true,
  removeEventHijacking: true,
  blockVisibilityDetection: true,
  clearTimers: false,
  cleanupScripts: false,
};

export const isCloudflareChallenge = (doc: Document = document): boolean => {
  const pathname =
    doc.location?.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (pathname.startsWith('/cdn-cgi/')) return true;

  const selectors = [
    '[id*="cf-chl"]',
    '[class*="cf-chl"]',
    'form[action*="/cdn-cgi/"]',
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="captcha.cloudflare.com"]',
  ];

  if (doc.querySelector(selectors.join(',')) !== null) return true;

  const hasManagedChallengeResource = Array.from(
    doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')
  ).some(element => {
    const resourceUrl = element.getAttribute('src') || element.getAttribute('href') || '';
    if (!/\/cdn-cgi\/challenge-platform\//i.test(resourceUrl)) return false;

    // JS Detection and its successor Precursor run in the background on readable
    // pages. Their presence alone does not mean the page is a challenge.
    return !/\/cdn-cgi\/challenge-platform\/scripts\/(?:jsd|precursor)\//i.test(resourceUrl);
  });
  if (hasManagedChallengeResource) return true;

  const title = (doc.title || '').trim().toLowerCase();
  if (title === 'just a moment...' || title === 'attention required! | cloudflare') {
    return true;
  }

  const scriptText = Array.from(doc.querySelectorAll('script'))
    .map(script => `${script.getAttribute('src') || ''}\n${script.textContent || ''}`)
    .join('\n');
  if (/_cf_chl_opt|cf_chl_|challenges\.cloudflare\.com/i.test(scriptText)) {
    return true;
  }

  const bodyText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  return /enable javascript and cookies to continue/i.test(bodyText);
};

export function withDefaultProtectionOptions(options: ProtectionOptions = {}): ProtectionOptions {
  return { ...DEFAULT_PROTECTION_OPTIONS, ...options };
}

export function getEffectiveProtectionOptions(
  options: ProtectionOptions,
  doc: Document = document
): ProtectionOptions {
  if (!isCloudflareChallenge(doc)) {
    return options;
  }

  return {
    ...options,
    blockRedirects: false,
    clearTimers: false,
    removeEventHijacking: false,
  };
}
