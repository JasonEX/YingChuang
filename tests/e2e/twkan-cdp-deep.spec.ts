import type { Browser, Page } from '@playwright/test';
import { chromium, expect, test } from '@playwright/test';

import {
  addYingChuangUserscript,
  createConsoleCollector,
  printRunSummary,
  saveStableScreenshot,
  waitForMnrReader,
} from './mnrE2e';

const BOOK_TITLE = '誰說我做的魔法卡牌有問題？';
const START_URL = 'https://twkan.com/txt/93181/53052605';
const PREV_URL = 'https://twkan.com/txt/93181/53052420';
const NEXT_URL = 'https://twkan.com/txt/93181/53052783';
const READ_DELAY_MS = envNumber('MNR_TWKAN_READ_DELAY_MS', 3500);

type TwkanDeepState = {
  articles: Array<{
    chars: number;
    containsTwkanAd: boolean;
    contentPreview: string;
    title: string;
    url: string;
  }>;
  bookTitleFromDrawer: string;
  cloudflareChallenge: boolean;
  drawerChapterCount: number;
  drawerOpen: boolean;
  drawerTitles: string[];
  href: string;
  pageTitle: string;
  readerMounted: boolean;
  readerRoot: boolean;
};

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function waitForReadingPace(page: Page): Promise<void> {
  await page.waitForTimeout(READ_DELAY_MS);
}

async function collectTwkanState(page: Page): Promise<TwkanDeepState> {
  return page.evaluate(() => {
    const normalize = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
    const cloudflareSelectors = [
      '[id*="cf-chl"]',
      '[class*="cf-chl"]',
      'form[action*="/cdn-cgi/"]',
      'script[src*="/cdn-cgi/challenge-platform"]',
      'link[href*="/cdn-cgi/challenge-platform"]',
      'iframe[src*="challenges.cloudflare.com"]',
      'iframe[src*="captcha.cloudflare.com"]',
    ];

    const root = document.querySelector('#mnr-reader-root');
    const shadow = root?.shadowRoot || null;
    const articles = Array.from(shadow?.querySelectorAll('article.mnr-reader-content') || []).map(
      article => {
        const contentNode = Array.from(article.children).find(
          child => !child.classList.contains('mnr-chapter-title')
        );
        const text = normalize(contentNode?.textContent || article.textContent);
        return {
          chars: text.length,
          containsTwkanAd:
            /(?:請|请)记住[臺台]湾小[説说]网|(?:請|请)記住臺灣小説網|域名|[臺台]湾好书|台湾好书|章节更新|章節更新/i.test(
              text
            ),
          contentPreview: text.slice(0, 160),
          title: normalize(article.querySelector('.mnr-chapter-title')?.textContent),
          url: article.getAttribute('data-chapter-url') || '',
        };
      }
    );
    const drawer = shadow?.querySelector('.mnr-drawer');
    const drawerItems = Array.from(shadow?.querySelectorAll('.mnr-chapter-list li') || []);

    return {
      articles,
      bookTitleFromDrawer: normalize(shadow?.querySelector('.mnr-drawer-title')?.textContent),
      cloudflareChallenge:
        location.pathname.startsWith('/cdn-cgi/') ||
        document.querySelector(cloudflareSelectors.join(',')) !== null,
      drawerChapterCount: drawerItems.length,
      drawerOpen: !!drawer?.classList.contains('open'),
      drawerTitles: drawerItems.map(item => normalize(item.textContent)),
      href: location.href,
      pageTitle: document.title,
      readerMounted: !!shadow?.querySelector('.mnr-reader'),
      readerRoot: !!root,
    };
  });
}

async function ensureChapter(page: Page, url: string, titlePart: string): Promise<void> {
  await page.waitForFunction(expectedUrl => location.href === expectedUrl, url, {
    timeout: 20_000,
  });
  await page.waitForFunction(
    expectedUrl => {
      const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
      const article = Array.from(shadow?.querySelectorAll('article.mnr-reader-content') || []).find(
        item => item.getAttribute('data-chapter-url') === expectedUrl
      );
      return !!article?.textContent?.trim();
    },
    url,
    { timeout: 20_000 }
  );
  const state = await collectTwkanState(page);
  expect(state.cloudflareChallenge).toBe(false);
  expect(state.readerRoot).toBe(true);
  expect(state.readerMounted).toBe(true);
  const article = state.articles.find(item => item.url === url);
  expect(article, `missing rendered chapter ${url}`).toBeTruthy();
  expect(article?.title).toContain(titlePart);
  expect(article?.chars).toBeGreaterThan(1200);
  expect(article?.containsTwkanAd).toBe(false);
  expect(article?.contentPreview).not.toContain('作者');
  expect(article?.contentPreview).not.toContain('請記住臺灣小説網');
  expect(article?.contentPreview).not.toContain('请记住台湾小说网');
}

async function pressAndWait(page: Page, key: 'ArrowLeft' | 'ArrowRight', url: string) {
  await page.keyboard.press(key);
  await waitForReadingPace(page);
  await page.waitForFunction(expectedUrl => location.href === expectedUrl, url, {
    timeout: 20_000,
  });
}

async function openDrawer(page: Page): Promise<TwkanDeepState> {
  const clicked = await page.evaluate(() => {
    const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
    const button = shadow?.querySelector<HTMLElement>('[aria-label="打开目录"]');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) {
    await page.keyboard.press('c');
  }
  await page.waitForFunction(
    () => {
      const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
      const drawer = shadow?.querySelector('.mnr-drawer.open');
      return !!drawer;
    },
    undefined,
    { timeout: 5_000 }
  );
  await page.waitForFunction(
    () => {
      const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
      const loading = shadow?.querySelector('.mnr-drawer-loading');
      return !loading && (shadow?.querySelectorAll('.mnr-chapter-list li').length || 0) >= 500;
    },
    undefined,
    { timeout: 30_000 }
  );
  return collectTwkanState(page);
}

test('Twkan CDP flow covers prev/next, TOC and cached chapter navigation', async ({
  browserName: _browserName,
}, testInfo) => {
  const endpoint = process.env.MNR_E2E_CDP_ENDPOINT;
  test.skip(!endpoint, 'Set MNR_E2E_CDP_ENDPOINT to run Twkan CDP deep E2E.');
  if (!endpoint) return;
  test.setTimeout(Math.max(120_000, READ_DELAY_MS * 8 + 60_000));

  let browser: Browser | undefined;
  let page: Page | undefined;
  const chapterRequests: string[] = [];

  try {
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No default Chrome context found at ${endpoint}`);

    await addYingChuangUserscript(context);
    context.on('request', request => {
      const url = request.url();
      if (/twkan\.com\/txt\/93181\/\d+/.test(url)) {
        chapterRequests.push(url);
      }
    });

    page = await context.newPage();
    const logs = createConsoleCollector(page);
    const response = await page.goto(START_URL, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await waitForMnrReader(page);

    expect(response?.status()).toBe(200);
    await ensureChapter(page, START_URL, '第120章');
    let state = await collectTwkanState(page);
    expect(state.pageTitle).toContain(BOOK_TITLE);

    await pressAndWait(page, 'ArrowRight', NEXT_URL);
    await ensureChapter(page, NEXT_URL, '第121章');

    const requestsAfterNext = chapterRequests.length;
    await pressAndWait(page, 'ArrowLeft', START_URL);
    await ensureChapter(page, START_URL, '第120章');
    expect(chapterRequests.length).toBe(requestsAfterNext);

    await pressAndWait(page, 'ArrowLeft', PREV_URL);
    await ensureChapter(page, PREV_URL, '第119章');

    const requestsAfterPrev = chapterRequests.length;
    await pressAndWait(page, 'ArrowRight', START_URL);
    await ensureChapter(page, START_URL, '第120章');
    expect(chapterRequests.length).toBe(requestsAfterPrev);

    state = await openDrawer(page);
    expect(state.drawerOpen).toBe(true);
    expect(state.bookTitleFromDrawer).toContain(BOOK_TITLE);
    expect(state.drawerChapterCount).toBeGreaterThanOrEqual(500);
    expect(state.drawerTitles.some(title => title.includes('第120章'))).toBe(true);
    expect(state.drawerTitles.some(title => title.includes('第1章'))).toBe(true);

    const screenshotPath = await saveStableScreenshot(page, 'twkan-cdp-deep');
    await testInfo.attach('twkan-cdp-deep', { path: screenshotPath, contentType: 'image/png' });

    printRunSummary('twkan-cdp-deep', {
      logs,
      screenshotPath,
      state,
      status: response?.status() ?? null,
    });

    if (logs.some(line => /pageerror|Manual enable error|Failed to load/i.test(line))) {
      throw new Error(`Unexpected YingChuang error logs:\n${logs.join('\n')}`);
    }
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
});
