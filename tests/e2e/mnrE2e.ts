import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TARGET_URL = 'https://www.ciweimao.com/chapter/102930784';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

type LaunchOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>;

export interface MnrE2eConfig {
  artifactDir: string;
  minContentChars: number;
  profileDir: string;
  proxyServer: string | null;
  readerTimeoutMs: number;
  targetUrl: string;
  userScriptPath: string;
  warmupMinBodyChars: number;
  warmupTimeoutMs: number;
}

export interface MnrPageState {
  appStyles: boolean;
  bodyChars: number;
  cloudflareChallenge: boolean;
  contentChars: number;
  contentPreview: string;
  readerEntry: boolean;
  href: string;
  originalHidden: boolean;
  pageTitle: string;
  paragraphCount: number;
  readerMounted: boolean;
  readerRoot: boolean;
  hostPageStyles: boolean;
  shadowTitle: string;
}

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function getProxyServer(): string | null {
  const value =
    process.env.MNR_E2E_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    '';

  if (!value || value.toLowerCase() === 'none') return null;
  return value;
}

function resolveHeadless(testInfo: TestInfo, fallback: boolean): boolean {
  const explicit = parseBoolean(process.env.MNR_E2E_HEADLESS);
  if (explicit !== undefined) return explicit;

  const configured = testInfo.project.use.headless;
  return typeof configured === 'boolean' ? configured : fallback;
}

export function getMnrE2eConfig(): MnrE2eConfig {
  return {
    artifactDir: process.env.MNR_E2E_ARTIFACT_DIR || path.join(repoRoot, '.test', 'mnr-e2e'),
    minContentChars: envNumber('MNR_E2E_MIN_CONTENT_CHARS', 1000),
    profileDir: process.env.MNR_E2E_PROFILE_DIR || path.join(repoRoot, '.test', 'mnr-e2e-profile'),
    proxyServer: getProxyServer(),
    readerTimeoutMs: envNumber('MNR_E2E_READER_TIMEOUT_MS', 90_000),
    targetUrl: process.env.MNR_E2E_URL || DEFAULT_TARGET_URL,
    userScriptPath:
      process.env.MNR_E2E_USERSCRIPT || path.join(repoRoot, 'scripts', 'YingChuang.user.js'),
    warmupMinBodyChars: envNumber('MNR_E2E_WARMUP_MIN_BODY_CHARS', 500),
    warmupTimeoutMs: envNumber('MNR_E2E_WARMUP_TIMEOUT_MS', 10 * 60 * 1000),
  };
}

export async function launchPersistentMnrContext(
  testInfo: TestInfo,
  options: {
    blockHeavyResources?: boolean;
    forceHeaded?: boolean;
    headlessFallback?: boolean;
  } = {}
): Promise<BrowserContext> {
  const config = getMnrE2eConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  fs.mkdirSync(config.artifactDir, { recursive: true });

  const launchOptions: LaunchOptions = {
    headless: options.forceHeaded
      ? false
      : resolveHeadless(testInfo, options.headlessFallback ?? true),
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    userAgent:
      process.env.MNR_E2E_USER_AGENT ||
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    viewport: { width: 1365, height: 900 },
  };

  if (config.proxyServer) {
    launchOptions.proxy = { server: config.proxyServer };
  }

  const context = await chromium.launchPersistentContext(config.profileDir, launchOptions);

  if (options.blockHeavyResources) {
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        return route.abort();
      }
      return route.continue();
    });
  }

  return context;
}

export async function addYingChuangUserscript(context: BrowserContext): Promise<void> {
  const config = getMnrE2eConfig();
  const userScript = fs.readFileSync(config.userScriptPath, 'utf8');

  await context.addInitScript({
    content: `${createGmMockScript()}\n${userScript}`,
  });
}

export async function getFirstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] || context.newPage();
}

async function clickReaderEntry(page: Page): Promise<void> {
  await page.waitForTimeout(300);

  const clicked = await page.evaluate(() => {
    const entryHost = document.querySelector('#mnr-entry-root');
    const entryButton = entryHost?.shadowRoot?.querySelector(
      '#mnr-entry-button'
    ) as HTMLButtonElement | null;
    if (entryButton) {
      entryButton.click();
      return true;
    }

    return false;
  });

  if (clicked) {
    await page.waitForTimeout(1000);
  }
}

async function collectMnrPageState(page: Page): Promise<MnrPageState> {
  return page.evaluate(() => {
    const cloudflareSelectors = [
      '[id*="cf-chl"]',
      '[class*="cf-chl"]',
      'form[action*="/cdn-cgi/"]',
      'script[src*="/cdn-cgi/challenge-platform"]',
      'link[href*="/cdn-cgi/challenge-platform"]',
      'iframe[src*="challenges.cloudflare.com"]',
      'iframe[src*="captcha.cloudflare.com"]',
    ];
    const cloudflareChallenge =
      location.pathname.startsWith('/cdn-cgi/') ||
      document.querySelector(cloudflareSelectors.join(',')) !== null;

    const root = document.querySelector('#mnr-reader-root');
    const entry = document.querySelector('#mnr-entry-root');
    const reader = root?.shadowRoot?.querySelector('.mnr-reader');
    const content = root?.shadowRoot?.querySelector('.mnr-reader-content');
    const title = root?.shadowRoot?.querySelector('.mnr-chapter-title')?.textContent?.trim() || '';
    const contentText = content?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const bodyText = document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';

    return {
      appStyles: !!root?.shadowRoot?.querySelector('#mnr-app-styles'),
      bodyChars: bodyText.length,
      cloudflareChallenge,
      contentChars: contentText.length,
      contentPreview: contentText.slice(0, 160),
      readerEntry: !!entry,
      hostPageStyles: !!document.querySelector('#mnr-global-styles'),
      href: location.href,
      originalHidden: !!document.querySelector('#mnr-hide-original'),
      pageTitle: document.title,
      paragraphCount: root?.shadowRoot?.querySelectorAll('.mnr-reader-content p').length || 0,
      readerMounted: !!reader,
      readerRoot: !!root,
      shadowTitle: title,
    };
  });
}

export async function waitForReadableNonCloudflarePage(page: Page): Promise<MnrPageState> {
  const config = getMnrE2eConfig();
  const startedAt = Date.now();
  let lastState = await collectMnrPageState(page);

  while (Date.now() - startedAt < config.warmupTimeoutMs) {
    try {
      lastState = await collectMnrPageState(page);
    } catch {
      await page.waitForTimeout(1000);
      continue;
    }
    if (!lastState.cloudflareChallenge && lastState.bodyChars >= config.warmupMinBodyChars) {
      return lastState;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(
    [
      'Timed out waiting for a readable non-Cloudflare page.',
      `URL: ${config.targetUrl}`,
      `Last href: ${lastState.href}`,
      `Cloudflare challenge: ${lastState.cloudflareChallenge}`,
      `Body chars: ${lastState.bodyChars}`,
      'Finish the browser challenge in the opened window, or raise MNR_E2E_WARMUP_TIMEOUT_MS.',
    ].join('\n')
  );
}

export async function waitForMnrReader(page: Page): Promise<MnrPageState> {
  const config = getMnrE2eConfig();

  await page
    .waitForFunction(
      () =>
        !!document.querySelector('#mnr-reader-root') ||
        !!document.querySelector('#mnr-entry-root') ||
        location.pathname.startsWith('/cdn-cgi/') ||
        document.querySelector('[id*="cf-chl"], [class*="cf-chl"], form[action*="/cdn-cgi/"]') !==
          null,
      undefined,
      { timeout: config.readerTimeoutMs }
    )
    .catch(() => undefined);

  await clickReaderEntry(page);

  await page
    .waitForFunction(
      () => {
        const root = document.querySelector('#mnr-reader-root');
        const content = root?.shadowRoot?.querySelector('.mnr-reader-content');
        return !!content?.textContent?.trim();
      },
      undefined,
      { timeout: 15_000 }
    )
    .catch(() => undefined);

  return collectMnrPageState(page);
}

export async function saveStableScreenshot(
  page: Page,
  prefix: string,
  targetUrl?: string
): Promise<string> {
  const config = getMnrE2eConfig();
  const url = new URL(targetUrl ?? config.targetUrl);
  const name = `${prefix}-${url.hostname.replace(/[^a-z0-9.-]+/gi, '-')}.png`;
  const screenshotPath = path.join(config.artifactDir, name);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  return screenshotPath;
}

export function assertMnrSmokeState(state: MnrPageState): void {
  const config = getMnrE2eConfig();

  if (state.cloudflareChallenge) {
    throw new Error(
      [
        'Cloudflare challenge is still visible in the smoke test browser.',
        `Run: MNR_E2E_URL="${config.targetUrl}" npm run e2e:warmup`,
        'After the browser closes successfully, rerun npm run e2e:smoke.',
        'If the site only trusts headed Chromium, use npm run e2e:smoke:headed.',
      ].join('\n')
    );
  }

  expect(state.readerRoot).toBe(true);
  expect(state.readerMounted).toBe(true);
  expect(state.shadowTitle.length).toBeGreaterThan(0);
  expect(state.contentChars).toBeGreaterThanOrEqual(config.minContentChars);
  expect(state.paragraphCount).toBeGreaterThan(0);
  expect(state.originalHidden).toBe(true);
  expect(state.appStyles).toBe(true);
  expect(state.hostPageStyles).toBe(false);
}

export function createConsoleCollector(page: Page): string[] {
  const logs: string[] = [];

  page.on('console', message => {
    const text = message.text();
    if (
      text.includes('[MNR]') ||
      text.includes('[RuleStorage]') ||
      text.includes('[YingChuang]') ||
      text.includes('[AutoEnableManager]')
    ) {
      logs.push(`${message.type()}: ${text}`);
    }
  });

  page.on('pageerror', error => {
    logs.push(`pageerror: ${error.message}`);
  });

  return logs;
}

export function printRunSummary<TState>(
  label: string,
  details: {
    logs?: string[];
    screenshotPath?: string;
    state: TState;
    status?: number | null;
    targetUrl?: string;
  }
): void {
  const config = getMnrE2eConfig();
  console.log(
    JSON.stringify(
      {
        label,
        proxyServer: config.proxyServer,
        screenshot: details.screenshotPath,
        status: details.status ?? null,
        targetUrl: details.targetUrl ?? config.targetUrl,
        result: details.state,
        logs: details.logs?.slice(-30) || [],
      },
      null,
      2
    )
  );
}

export function createGmMockScript(): string {
  return `
(() => {
  const store = new Map();
  // Same-origin fixture persistence; cross-origin tests supply a tab-scoped mock.
  window.GM_getTab = callback => queueMicrotask(() =>
    callback(JSON.parse(sessionStorage.getItem('__mnr_test_tab') || '{}')));
  window.GM_saveTab = tab => sessionStorage.setItem('__mnr_test_tab', JSON.stringify(tab));
  window.unsafeWindow = window;
  window.GM_info = {
    script: {
      name: 'YingChuang',
      namespace: 'https://github.com/JasonEX',
      description: 'playwright e2e',
      version: '9.0.0',
      includes: [],
      excludes: '',
      matches: '',
      resources: [],
      unwrap: false,
    },
    scriptMetaStr: '',
    scriptWillUpdate: false,
    version: 'playwright-e2e',
  };
  window.GM_addStyle = css => {
    const style = document.createElement('style');
    style.textContent = css;
    const parent = document.head || document.documentElement;
    if (parent) parent.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => {
      (document.head || document.documentElement).appendChild(style);
    }, { once: true });
    return style;
  };
  window.GM_getValue = (name, defaultValue) => (store.has(name) ? store.get(name) : defaultValue);
  window.GM_setValue = (name, value) => { store.set(name, value); };
  window.GM_deleteValue = name => { store.delete(name); };
  window.GM_listValues = () => Array.from(store.keys());
  window.GM_getResourceURL = () => '';
  window.GM_openInTab = url => window.open(url, '_blank');
  window.GM_setClipboard = text => navigator.clipboard?.writeText?.(String(text));
  window.GM_registerMenuCommand = (caption, fn) => {
    window.__mnrMenuCommands = window.__mnrMenuCommands || [];
    window.__mnrMenuCommands.push({ caption, fn });
    return window.__mnrMenuCommands.length;
  };
  const normalizeCharset = charset => {
    const normalized = String(charset || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (!normalized) return '';
    if (normalized === 'utf8') return 'utf-8';
    if (normalized === 'gbk' || normalized === 'gb2312' || normalized === 'gb18030') return 'gb18030';
    return normalized;
  };
  const extractCharset = value => {
    const match = String(value || '').match(/charset\\s*=\\s*["']?([^;"'\\s>]+)/i);
    return normalizeCharset(match && match[1]);
  };
  const sniffCharset = buffer => {
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
    let ascii = '';
    for (const byte of bytes) {
      ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ' ';
    }
    const charsetMeta = ascii.match(/<meta[^>]+charset\\s*=\\s*["']?([^"' />]+)/i);
    if (charsetMeta && charsetMeta[1]) return normalizeCharset(charsetMeta[1]);
    const contentTypeMeta = ascii.match(
      /<meta[^>]+http-equiv\\s*=\\s*["']?content-type["']?[^>]+content\\s*=\\s*["']([^"']+)["']/i
    );
    return extractCharset(contentTypeMeta && contentTypeMeta[1]);
  };
  const decodeResponseText = async (resp, overrideMimeType) => {
    if (typeof resp.arrayBuffer !== 'function' || typeof TextDecoder === 'undefined') {
      return resp.text();
    }
    const buffer = await resp.arrayBuffer();
    const charset =
      extractCharset(overrideMimeType) ||
      extractCharset(resp.headers.get('content-type')) ||
      sniffCharset(buffer) ||
      normalizeCharset(document.characterSet) ||
      'utf-8';
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  };
  window.GM_xmlhttpRequest = details => {
    const controller = new AbortController();
    let settled = false;
    let timeoutTimer = null;
    const finish = callback => {
      if (settled) return false;
      settled = true;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      callback();
      return true;
    };
    const timeoutMs = Number(details.timeout || 0);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        controller.abort();
        finish(() => {
          details.ontimeout?.({
            readyState: 4,
            responseHeaders: '',
            responseText: '',
            status: 0,
            statusText: 'timeout',
            finalUrl: details.url,
          });
        });
      }, timeoutMs);
    }
    fetch(details.url, {
      method: details.method || 'GET',
      headers: details.headers,
      body: details.data,
      credentials: details.withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
    }).then(async resp => {
      const responseText = await decodeResponseText(resp, details.overrideMimeType);
      const responseHeaders = Array.from(resp.headers.entries())
        .map(([key, value]) => key + ': ' + value)
        .join('\\r\\n');
      finish(() => details.onload?.({
        readyState: 4,
        responseHeaders,
        responseText,
        status: resp.status,
        statusText: resp.statusText,
        finalUrl: resp.url,
      }));
    }).catch(error => {
      finish(() => details.onerror?.({
        readyState: 4,
        responseHeaders: '',
        responseText: String(error),
        status: 0,
        statusText: 'error',
        finalUrl: details.url,
      }));
    });
    return {
      abort: () => {
        controller.abort();
        finish(() => details.onabort?.({
          readyState: 4,
          responseHeaders: '',
          responseText: '',
          status: 0,
          statusText: 'abort',
          finalUrl: details.url,
        }));
      }
    };
  };
})();
`;
}
