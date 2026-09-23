import {
  addYingChuangUserscript,
  createConsoleCollector,
  getMnrE2eConfig,
  launchPersistentMnrContext,
} from './mnrE2e';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const BOOK_TITLE = '木叶：让宇智波再次伟大';
const BOOK_ID = '9145';
const FIRST_CHAPTER_ID = 6567989;
const CHAPTER_COUNT = 10;
const FIRST_URL = chapterUrl(0);
const SECOND_URL = chapterUrl(1);
const READ_DELAY_MS = envNumber('MNR_HETUSHU_READ_DELAY_MS', 3500);

const chapterOrdinals = [
  '第一章',
  '第二章',
  '第三章',
  '第四章',
  '第五章',
  '第六章',
  '第七章',
  '第八章',
  '第九章',
  '第十章',
];
const firstTenChapterUrls = new Set(
  Array.from({ length: CHAPTER_COUNT }, (_, offset) => chapterUrl(offset))
);

type ChapterSummary = {
  chars: number;
  containsWatermark: boolean;
  firstParagraphs: string[];
  paragraphCount: number;
  sequenceOk: boolean;
  title: string;
  url: string;
};

type ReaderDeepState = {
  appStyles: boolean;
  bookTitleFromDrawer: string;
  chapterCount: number;
  chapters: ChapterSummary[];
  cloudflareChallenge: boolean;
  currentTitle: string;
  drawerActiveTitle: string;
  drawerChapterCount: number;
  drawerTitles: string[];
  drawerOpen: boolean;
  href: string;
  menuCommands: string[];
  offlineCacheAction: string;
  offlineCacheStatus: string;
  offlineCacheTitle: string;
  originalHidden: boolean;
  pageTitle: string;
  readerMounted: boolean;
  readerRoot: boolean;
  hostPageStyles: boolean;
  settingsControls: {
    closeButton: boolean;
    fontSlider: boolean;
    lineHeightSlider: boolean;
    settingsPanel: boolean;
    themeButtons: number;
  };
  settingsOpen: boolean;
  toolbar: boolean;
};

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chapterUrl(offset: number): string {
  return `https://www.hetushu.com/book/${BOOK_ID}/${FIRST_CHAPTER_ID + offset}.html`;
}

function waitForReadingPace(page: Page): Promise<void> {
  return page.waitForTimeout(READ_DELAY_MS);
}

async function invokeManualEnable(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Array.isArray((window as any).__mnrMenuCommands) &&
      (window as any).__mnrMenuCommands.some(
        (command: { caption?: string }) => command.caption === '进入阅读模式'
      ),
    undefined,
    { timeout: 20_000 }
  );

  await page.evaluate(() => {
    const command = ((window as any).__mnrMenuCommands || []).find(
      (item: { caption?: string }) => item.caption === '进入阅读模式'
    );
    if (!command) throw new Error('missing menu command');
    command.fn();
  });

  await page.waitForFunction(
    () => {
      const root = document.querySelector('#mnr-reader-root');
      const content = root?.shadowRoot?.querySelector('article.mnr-reader-content');
      return !!content?.textContent?.trim();
    },
    undefined,
    { timeout: 25_000 }
  );
}

async function collectDeepState(page: Page): Promise<ReaderDeepState> {
  return page.evaluate((knownSequencesByUrl: Record<string, string[]>) => {
    const normalize = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
    const sequenceOk = (text: string, needles: string[]) => {
      let cursor = -1;
      for (const needle of needles) {
        const next = text.indexOf(needle, cursor + 1);
        if (next < 0) return false;
        cursor = next;
      }
      return true;
    };

    const cloudflareSelectors = [
      '[id*="cf-chl"]',
      '[class*="cf-chl"]',
      'form[action*="/cdn-cgi/"]',
      'iframe[src*="challenges.cloudflare.com"]',
      'iframe[src*="captcha.cloudflare.com"]',
    ];
    const hasManagedChallengeResource = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src*="/cdn-cgi/challenge-platform/"]')
    ).some(script => !script.src.includes('/cdn-cgi/challenge-platform/scripts/jsd/'));
    const root = document.querySelector('#mnr-reader-root');
    const shadow = root?.shadowRoot || null;
    const articles = Array.from(shadow?.querySelectorAll('article.mnr-reader-content') || []);
    const chapters = articles.map(article => {
      const paragraphs = Array.from(article.querySelectorAll('p')).map(p =>
        normalize(p.textContent)
      );
      const text = normalize(article.textContent);
      const url = article.getAttribute('data-chapter-url') || '';
      const knownSequences = knownSequencesByUrl[url];
      return {
        chars: text.length,
        containsWatermark: /hetushu\.com|ｗｗｗ|www\.hetushu|和图书/i.test(text),
        firstParagraphs: paragraphs.slice(0, 4),
        paragraphCount: paragraphs.length,
        sequenceOk: knownSequences ? sequenceOk(text, knownSequences) : true,
        title: normalize(article.querySelector('.mnr-chapter-title')?.textContent),
        url,
      };
    });
    const drawer = shadow?.querySelector('.mnr-drawer');
    const drawerItems = Array.from(shadow?.querySelectorAll('.mnr-chapter-list li') || []);
    const activeItem = shadow?.querySelector('.mnr-chapter-button.active');
    const settingsPanel = shadow?.querySelector('.mnr-settings-panel');

    return {
      appStyles: !!shadow?.querySelector('#mnr-app-styles'),
      bookTitleFromDrawer: normalize(shadow?.querySelector('.mnr-drawer-title')?.textContent),
      chapterCount: chapters.length,
      chapters,
      cloudflareChallenge:
        location.pathname.startsWith('/cdn-cgi/') ||
        document.querySelector(cloudflareSelectors.join(',')) !== null ||
        hasManagedChallengeResource,
      currentTitle: chapters[chapters.length - 1]?.title || '',
      drawerActiveTitle: normalize(activeItem?.textContent),
      drawerChapterCount: drawerItems.length,
      drawerTitles: drawerItems.map(item => normalize(item.textContent)),
      drawerOpen: !!drawer?.classList.contains('open'),
      hostPageStyles: !!document.querySelector('#mnr-global-styles'),
      href: location.href,
      menuCommands: ((window as any).__mnrMenuCommands || []).map(
        (command: { caption?: string }) => command.caption || ''
      ),
      offlineCacheAction: normalize(
        shadow?.querySelector('.mnr-offline-action.primary')?.textContent
      ),
      offlineCacheStatus: normalize(shadow?.querySelector('.mnr-offline-copy span')?.textContent),
      offlineCacheTitle: normalize(shadow?.querySelector('#mnr-offline-title')?.textContent),
      originalHidden: !!document.querySelector('#mnr-hide-original'),
      pageTitle: document.title,
      readerMounted: !!shadow?.querySelector('.mnr-reader'),
      readerRoot: !!root,
      settingsControls: {
        closeButton: !!settingsPanel?.querySelector('.mnr-close-btn'),
        fontSlider: !!settingsPanel?.querySelector('input[type="range"][min="14"][max="28"]'),
        lineHeightSlider: !!settingsPanel?.querySelector(
          'input[type="range"][min="1.4"][max="2.4"]'
        ),
        settingsPanel: !!settingsPanel,
        themeButtons: settingsPanel?.querySelectorAll('.mnr-theme-btn').length || 0,
      },
      settingsOpen: !!shadow?.querySelector('.mnr-settings-overlay'),
      toolbar: !!shadow?.querySelector('.mnr-floating-toolbar'),
    };
  }, expectedSequencesByUrl);
}

async function ensureBaseReaderState(
  page: Page,
  state?: ReaderDeepState
): Promise<ReaderDeepState> {
  const current = state || (await collectDeepState(page));
  expect(current.cloudflareChallenge).toBe(false);
  expect(current.menuCommands).toContain('进入阅读模式');
  expect(current.readerRoot).toBe(true);
  expect(current.readerMounted).toBe(true);
  expect(current.originalHidden).toBe(true);
  expect(current.appStyles).toBe(true);
  expect(current.hostPageStyles).toBe(false);
  return current;
}

async function verifyRenderedChapter(
  page: Page,
  expectedOffset: number,
  options: { articleIndex?: number; minParagraphs?: number } = {}
): Promise<ChapterSummary> {
  const state = await ensureBaseReaderState(page);
  const expectedUrl = chapterUrl(expectedOffset);
  const chapter =
    options.articleIndex === undefined
      ? state.chapters.find(item => item.url === expectedUrl)
      : state.chapters[options.articleIndex];
  expect(chapter, `missing rendered chapter ${expectedUrl}`).toBeTruthy();
  if (!chapter) throw new Error(`missing rendered chapter ${expectedUrl}`);
  expect(chapter.url).toBe(expectedUrl);
  expect(chapter.title).toContain(chapterOrdinals[expectedOffset]);
  expect(chapter.paragraphCount).toBeGreaterThanOrEqual(options.minParagraphs ?? 35);
  expect(chapter.chars).toBeGreaterThanOrEqual(1500);
  expect(chapter.containsWatermark).toBe(false);
  expect(chapter.sequenceOk).toBe(true);
  return chapter;
}

async function openDrawer(page: Page): Promise<ReaderDeepState> {
  const openedByClick = await page.evaluate(() => {
    const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
    if (!shadow?.querySelector('.mnr-drawer.open')) {
      const button = shadow?.querySelector<HTMLElement>('[aria-label="打开目录"]');
      if (!button) return false;
      button.click();
    }
    return true;
  });
  if (!openedByClick) {
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
      return !loading && (shadow?.querySelectorAll('.mnr-chapter-list li').length || 0) >= 10;
    },
    undefined,
    { timeout: 30_000 }
  );
  return collectDeepState(page);
}

async function openSettings(page: Page): Promise<ReaderDeepState> {
  await page.evaluate(() => {
    const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
    shadow?.querySelector<HTMLElement>('[aria-label="打开设置"]')?.click();
  });
  await page.waitForFunction(
    () =>
      !!document
        .querySelector('#mnr-reader-root')
        ?.shadowRoot?.querySelector('.mnr-settings-panel'),
    undefined,
    { timeout: 5_000 }
  );
  return collectDeepState(page);
}

async function closePanels(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function focusReaderForKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.focus();
    const main = document
      .querySelector('#mnr-reader-root')
      ?.shadowRoot?.querySelector<HTMLElement>('.mnr-reader-main');
    main?.focus({ preventScroll: true });
  });
}

async function pressAndWaitForUrl(
  page: Page,
  key: 'ArrowLeft' | 'ArrowRight',
  expectedUrl: string
) {
  await focusReaderForKeyboard(page);
  await page.keyboard.press(key);
  await page.waitForFunction(url => location.href === url, expectedUrl, { timeout: 20_000 });
  await waitForReadingPace(page);
}

async function clickTocEntry(page: Page, titlePart: string): Promise<void> {
  await page.evaluate(text => {
    const shadow = document.querySelector('#mnr-reader-root')?.shadowRoot;
    const button = Array.from(
      shadow?.querySelectorAll<HTMLButtonElement>('.mnr-chapter-button') || []
    ).find(node => (node.textContent || '').includes(text));
    if (!button) throw new Error(`TOC item not found: ${text}`);
    button.click();
  }, titlePart);
}

function expectNoCachedChapterRefetch(requests: string[], baselineCount: number): void {
  const reloadedCachedChapters = requests
    .slice(baselineCount)
    .filter(url => firstTenChapterUrls.has(url));
  expect(reloadedCachedChapters).toEqual([]);
}

const expectedSequencesByUrl: Record<string, string[]> = {
  [chapterUrl(0)]: [
    '【恭喜宿主激活家族绑定系统】',
    '【每个人都会拥有属于自己的家',
    '【当然，家族的繁荣也能给您带来巨大的提升',
    '坐在自己房间内的宇智波羽原现在脸色铁青',
  ],
  [chapterUrl(1)]: ['看到眼前的三个选项', '这三个技能没有一个是火影世界的技能', '至于另外一个'],
};

test('Hetushu manual reader flow covers prev/next, ten chapters, TOC, cache, title and book', async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(Math.max(180_000, READ_DELAY_MS * 20 + 90_000));

  const config = getMnrE2eConfig();
  const context = await launchPersistentMnrContext(testInfo, {
    blockHeavyResources: true,
    headlessFallback: true,
  });
  const chapterRequests: string[] = [];

  try {
    await addYingChuangUserscript(context);
    context.on('request', request => {
      const url = request.url();
      if (new RegExp(`hetushu\\.com/book/${BOOK_ID}/\\d+\\.html`).test(url)) {
        chapterRequests.push(url);
      }
    });

    const page = await context.newPage();
    const logs = createConsoleCollector(page);

    // Open chapter 2 first, then verify the previous-page path can render chapter 1.
    const secondResponse = await page.goto(SECOND_URL, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    expect(secondResponse?.status()).toBe(200);
    await invokeManualEnable(page);
    let state = await ensureBaseReaderState(page);
    expect(state.pageTitle).toContain(BOOK_TITLE);
    expect(state.toolbar).toBe(true);
    await verifyRenderedChapter(page, 1, { articleIndex: 0 });

    await pressAndWaitForUrl(page, 'ArrowLeft', FIRST_URL);
    await verifyRenderedChapter(page, 0, { articleIndex: 0, minParagraphs: 50 });
    const secondEntryPrevState = await collectDeepState(page);
    expect(secondEntryPrevState.chapters.some(chapter => chapter.url === SECOND_URL)).toBe(true);

    // Re-open chapter 1 as a clean reading session, then read forward to chapter 10.
    const firstResponse = await page.goto(FIRST_URL, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    expect(firstResponse?.status()).toBe(200);
    await invokeManualEnable(page);
    state = await ensureBaseReaderState(page);
    expect(state.toolbar).toBe(true);
    await verifyRenderedChapter(page, 0, { articleIndex: 0, minParagraphs: 50 });

    const openedSettings = await openSettings(page);
    expect(openedSettings.settingsOpen).toBe(true);
    expect(openedSettings.settingsControls.settingsPanel).toBe(true);
    expect(openedSettings.settingsControls.closeButton).toBe(true);
    expect(openedSettings.settingsControls.fontSlider).toBe(true);
    expect(openedSettings.settingsControls.lineHeightSlider).toBe(true);
    expect(openedSettings.settingsControls.themeButtons).toBeGreaterThanOrEqual(4);
    await closePanels(page);

    for (let offset = 1; offset < CHAPTER_COUNT; offset++) {
      await pressAndWaitForUrl(page, 'ArrowRight', chapterUrl(offset));
      await verifyRenderedChapter(page, offset);
    }

    state = await ensureBaseReaderState(page);
    expect(state.href).toBe(chapterUrl(9));
    expect(state.chapterCount).toBeLessThanOrEqual(8);
    expect(state.chapters[state.chapters.length - 1].title).toContain('第十章');

    const requestsAfterForward = chapterRequests.length;

    // Step back through already-loaded chapters. This should be display/cache navigation, not network loading.
    for (const offset of [8, 7, 6]) {
      await pressAndWaitForUrl(page, 'ArrowLeft', chapterUrl(offset));
      await verifyRenderedChapter(page, offset);
      expectNoCachedChapterRefetch(chapterRequests, requestsAfterForward);
    }

    // Move forward again through cached/displayed chapters. Auto-preloading the next unread
    // chapter after the 3-5s grace period is allowed; re-fetching these cached chapters is not.
    for (const offset of [7, 8, 9]) {
      await pressAndWaitForUrl(page, 'ArrowRight', chapterUrl(offset));
      await verifyRenderedChapter(page, offset);
      expectNoCachedChapterRefetch(chapterRequests, requestsAfterForward);
    }

    const drawerState = await openDrawer(page);
    expect(drawerState.drawerOpen).toBe(true);
    expect(drawerState.bookTitleFromDrawer).toContain(BOOK_TITLE);
    expect(drawerState.offlineCacheTitle).toBe('离线阅读');
    expect(drawerState.offlineCacheStatus).toBe('尚未缓存');
    expect(drawerState.offlineCacheAction).toBe('缓存本书');
    expect(drawerState.drawerChapterCount).toBeGreaterThanOrEqual(CHAPTER_COUNT);
    expect(drawerState.drawerActiveTitle).toContain('第十章');
    for (const ordinal of chapterOrdinals) {
      expect(drawerState.drawerTitles.some(title => title.includes(ordinal))).toBe(true);
    }

    // Select chapter 1 from TOC after it has been trimmed from the visible list.
    await clickTocEntry(page, '第一章');
    await page.waitForFunction(url => location.href === url, FIRST_URL, { timeout: 20_000 });
    await waitForReadingPace(page);
    await verifyRenderedChapter(page, 0, { articleIndex: 0, minParagraphs: 50 });

    // Then go to chapter 2 again from the cache-backed rebuilt session.
    const requestsBeforeCachedNext = chapterRequests.length;
    await pressAndWaitForUrl(page, 'ArrowRight', SECOND_URL);
    await verifyRenderedChapter(page, 1);
    expect(chapterRequests.length).toBe(requestsBeforeCachedNext);

    const screenshotPath = `${config.artifactDir}/hetushu-manual-deep.png`;
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach('hetushu-manual-deep', {
      path: screenshotPath,
      contentType: 'image/png',
    });

    console.log(
      JSON.stringify(
        {
          label: 'hetushu-manual-deep',
          proxyServer: config.proxyServer,
          readDelayMs: READ_DELAY_MS,
          screenshot: screenshotPath,
          chapterRequests: chapterRequests.length,
          finalState: await collectDeepState(page),
          logs: logs.slice(-30),
        },
        null,
        2
      )
    );

    if (logs.some(line => /pageerror|Manual enable error|Failed to load/i.test(line))) {
      throw new Error(`Unexpected YingChuang error logs:\n${logs.join('\n')}`);
    }
  } finally {
    await context.close();
  }
});
