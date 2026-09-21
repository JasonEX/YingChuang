import { BUILD_DATE, VERSION } from '@/version';
import {
  type DebugJsonValue,
  hashText,
  htmlTextLength,
  redactUrl,
  toDebugValue,
  truncateDebugString,
} from '@/core/debug/diagnostics';
import { getDebugEvents, recordDebugEvent } from '@/core/debug/events';
import type { useConfigStore } from '@/ui/stores/config';
import type { useReaderStore } from '@/ui/stores/reader';

export interface BootstrapDebugSnapshot {
  isInitialized: boolean;
  autoEnableDone: boolean;
  isActive: boolean;
  entryPageKind: string | null;
  currentDecision: DebugJsonValue;
  originalHostPage: DebugJsonValue;
}

export interface DiagnosticInfo {
  schema: 'mnr-debug-v1';
  generatedAt: string;
  app: {
    version: string;
    buildDate: string;
    bootstrap?: BootstrapDebugSnapshot;
    gm: DebugJsonValue;
  };
  browser: DebugJsonValue;
  page: DebugJsonValue;
  config: DebugJsonValue;
  reader: DebugJsonValue;
  recentEvents: DebugJsonValue;
}

export interface DiagnosticOptions {
  readerStore?: ReturnType<typeof useReaderStore> | null;
  configStore?: ReturnType<typeof useConfigStore> | null;
  bootstrap?: BootstrapDebugSnapshot;
}

export interface CopyDiagnosticOptions extends DiagnosticOptions {
  notify?: (message: string, type?: 'info' | 'error') => void;
}

export interface CopyDiagnosticResult {
  ok: boolean;
  text: string;
  info: DiagnosticInfo;
  error?: unknown;
}

export function buildDiagnosticInfo(options: DiagnosticOptions = {}): DiagnosticInfo {
  return {
    schema: 'mnr-debug-v1',
    generatedAt: new Date().toISOString(),
    app: {
      version: VERSION,
      buildDate: BUILD_DATE,
      bootstrap: options.bootstrap,
      gm: getGmSnapshot(),
    },
    browser: getBrowserSnapshot(),
    page: getPageSnapshot(),
    config: options.configStore ? getConfigSnapshot(options.configStore) : null,
    reader: options.readerStore?.getDebugSnapshot
      ? toDebugValue(options.readerStore.getDebugSnapshot(), 5)
      : null,
    // The event buffer is already bounded; do not truncate away its newest entries.
    recentEvents: getDebugEvents().map(event => toDebugValue(event, 4)),
  };
}

export async function copyDiagnosticInfo(
  options: CopyDiagnosticOptions = {}
): Promise<CopyDiagnosticResult> {
  recordDebugEvent('debug.copy.request', {
    readerActive: Boolean(options.readerStore?.isActive),
  });

  const info = buildDiagnosticInfo(options);
  const text = JSON.stringify(info, null, 2);

  try {
    await writeClipboard(text);
    recordDebugEvent('debug.copy.success', {
      bytes: text.length,
      readerActive: Boolean(options.readerStore?.isActive),
    });
    options.notify?.('诊断信息已复制', 'info');
    return { ok: true, text, info };
  } catch (error) {
    recordDebugEvent(
      'debug.copy.failure',
      {
        error,
      },
      'error'
    );
    options.notify?.('诊断信息复制失败', 'error');
    return { ok: false, text, info, error };
  }
}

async function writeClipboard(text: string): Promise<void> {
  let gmError: unknown;
  if (typeof GM_setClipboard !== 'undefined') {
    try {
      GM_setClipboard(text);
      return;
    } catch (error) {
      gmError = error;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (gmError) throw gmError;
  throw new Error('No clipboard API available');
}

function getGmSnapshot(): DebugJsonValue {
  if (typeof GM_info === 'undefined') return null;

  return toDebugValue({
    scriptName: GM_info.script?.name,
    scriptVersion: GM_info.script?.version,
    managerVersion: GM_info.version,
  });
}

function getBrowserSnapshot(): DebugJsonValue {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;

  return toDebugValue({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: Array.from(navigator.languages || []),
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen:
      typeof screen !== 'undefined'
        ? {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
          }
        : null,
    visibilityState: document.visibilityState,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function getPageSnapshot(): DebugJsonValue {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const bodyText = document.body?.textContent || '';
  const bodyHtml = document.body?.innerHTML || '';

  return toDebugValue({
    href: redactUrl(window.location.href),
    origin: window.location.origin,
    pathname: window.location.pathname,
    title: truncateDebugString(document.title || ''),
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    bodyTextChars: bodyText.length,
    bodyHtmlChars: bodyHtml.length,
    bodyTextHash: hashText(bodyText),
    bodyTextApproxChars: htmlTextLength(bodyHtml),
    pageFlags: getPageFlags(),
    mnrRoots: {
      readerRoot: Boolean(document.getElementById('mnr-reader-root')),
      entryPromptRoot: Boolean(document.getElementById('mnr-entry-prompt-root')),
      readerEntryRoot: Boolean(document.getElementById('mnr-entry-root')),
      hideOriginalStyle: Boolean(document.getElementById('mnr-hide-original')),
    },
    historyState: toDebugValue(window.history.state),
  });
}

function getPageFlags(): DebugJsonValue {
  const title = (document.title || '').toLowerCase();
  const text = (document.body?.textContent || '').toLowerCase();
  const html = document.documentElement?.innerHTML?.toLowerCase() || '';

  return toDebugValue({
    cloudflareLike:
      title.includes('just a moment') ||
      text.includes('cloudflare') ||
      html.includes('cf-challenge') ||
      Boolean(document.querySelector('.cf-turnstile, input[name="cf-turnstile-response"]')),
    loginLike: /登录|登錄|login|sign in|注册|註冊/.test(text.slice(0, 5000)),
    noBody: !document.body,
  });
}

function getConfigSnapshot(configStore: ReturnType<typeof useConfigStore>): DebugJsonValue {
  return toDebugValue({
    themeId: configStore.themeId,
    reading: {
      fontSize: configStore.reading.fontSize,
      lineHeight: configStore.reading.lineHeight,
      letterSpacing: configStore.reading.letterSpacing,
      paragraphIndent: configStore.reading.paragraphIndent,
      maxWidth: configStore.reading.maxWidth,
      padding: configStore.reading.padding,
      textConversion: configStore.reading.textConversion,
      fontFamily: configStore.reading.fontFamily,
    },
    behavior: configStore.behavior,
    protection: configStore.protection,
    customCssChars: configStore.customCSS.length,
  });
}
