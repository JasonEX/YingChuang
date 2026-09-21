import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCacheV2ChapterKey,
  getCacheV2IndexKey,
  parseStoredJson,
} from '@/ui/stores/reader/persistence';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getParser } from '@/core/parser';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { parseWithSectionMerge } from '@/ui/stores/reader/section';
import type { SiteRule } from '@/core/rules/types';
import { useReaderStore } from '@/ui/stores/reader';

import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { createDom } from '../../../testUtils/dom';
import { setupPinia } from '../../../testUtils/pinia';

const {
  mockFetchAndParseUrl,
  mockGetParser,
  mockLoadTocEntriesPaged,
  mockParseWithSectionMerge,
  mockStartProgressiveSectionMerge,
} = vi.hoisted(() => ({
  mockFetchAndParseUrl: vi.fn(),
  mockGetParser: vi.fn(),
  mockLoadTocEntriesPaged: vi.fn(),
  mockParseWithSectionMerge: vi.fn(),
  mockStartProgressiveSectionMerge: vi.fn(),
}));

vi.mock('@/core/parser', () => ({
  getParser: mockGetParser,
}));

vi.mock('@/core/utils/network', () => ({
  fetchAndParseUrl: mockFetchAndParseUrl,
}));

vi.mock('@/ui/stores/reader/section', () => ({
  parseWithSectionMerge: mockParseWithSectionMerge,
  startProgressiveSectionMerge: mockStartProgressiveSectionMerge,
}));

vi.mock('@/ui/stores/reader/toc', async importOriginal => {
  const actual = await importOriginal<typeof import('@/ui/stores/reader/toc')>();
  return {
    ...actual,
    loadTocEntriesPaged: mockLoadTocEntriesPaged,
  };
});

describe('ReaderStore - workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();

    setupPinia();
    createDom('https://example.com/book/1/1.html');

    const gm = createGmStorageMock();
    stubGmStorage(gm);

    vi.clearAllMocks();
    mockGetParser.mockReturnValue({} as unknown);
    // In-reader navigation enters through the progressive function. By default these chapters
    // have no extra sections, so it resolves like a plain parse with no merge handle.
    mockStartProgressiveSectionMerge.mockImplementation(
      async (parser: unknown, doc: unknown, url: unknown) => ({
        chapter: await mockParseWithSectionMerge(parser, doc, url),
        merge: null,
      })
    );
  });

  it('shows the first section at once and keeps merging past further navigation', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>c1</p>',
      rawContent: '<p>c1</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      nextUrl: 'https://example.com/book/1/2.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body><p>x</p></body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/2.html',
        error: null,
      }),
      abort: vi.fn(),
    });

    const abort = vi.fn();
    const commit = vi.fn();
    mockStartProgressiveSectionMerge.mockImplementationOnce(async () => ({
      chapter: {
        title: '第2章',
        content: '<p>第一页</p>',
        rawContent: '<p>第一页</p>',
        url: 'https://example.com/book/1/2.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
      merge: { progress: { loaded: 1, total: 3 }, abort, commit, reject: vi.fn() },
    }));

    expect(await store.loadNextChapter('manual')).toBe(true);

    const entry = store.chapters.at(-1);
    expect(entry?.chapter.content).toBe('<p>第一页</p>');
    expect(entry?.sectionProgress).toEqual({ loaded: 1, total: 3 });
    expect(commit).toHaveBeenCalledWith(entry?.id);
    expect(store.isTailSectionMerging).toBe(true);
    // The first page is on screen, so the load itself is over while pages keep arriving.
    expect(store.isLoadingNext).toBe(false);

    // Reading on must not cut the background merge short.
    entry!.chapter.nextUrl = 'https://example.com/book/1/3.html';
    mockParseWithSectionMerge.mockResolvedValueOnce({
      title: '第3章',
      content: '<p>c3</p>',
      rawContent: '<p>c3</p>',
      url: 'https://example.com/book/1/3.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });
    expect(await store.loadNextChapter('manual')).toBe(true);
    expect(abort).not.toHaveBeenCalled();
    expect(store.chapters.find(item => item.id === entry?.id)?.sectionProgress).toEqual({
      loaded: 1,
      total: 3,
    });
    // The guard follows the tail: a merge still running further back says nothing about
    // whether the book has ended, and must not hide the end-of-book marker.
    expect(store.isTailSectionMerging).toBe(false);

    // A table-of-contents jump rebuilds the list, and does cancel it.
    store.cachedContents.set('https://example.com/book/1/9.html', {
      chapter: {
        title: '第9章',
        content: '<p>c9</p>',
        rawContent: '<p>c9</p>',
        url: 'https://example.com/book/1/9.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
      cachedAt: 1,
    });
    expect(await store.rebuildChaptersAround('https://example.com/book/1/9.html')).toBe(true);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(store.isTailSectionMerging).toBe(false);
  });

  it('grows a progressively merged chapter without resetting its reader entry', async () => {
    const store = useReaderStore();
    const entryId = store.setChapter({
      title: '第1章',
      content: '<p>第一页</p>',
      rawContent: '<p>第一页</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    store.beginChapterSections(entryId, { loaded: 1, total: 2 }, () => {});

    // A chapter that is still growing must not be reachable as a complete cache entry.
    expect(store.cachedContents.has('https://example.com/book/1/1.html')).toBe(false);
    expect(store.isTailSectionMerging).toBe(true);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>第二页</p>',
      loaded: 2,
      total: 2,
    });

    expect(store.chapters[0]?.id).toBe(entryId);
    expect(store.chapters[0]?.chapter.content).toContain('第二页');
    expect(store.chapters[0]?.sectionProgress).toEqual({ loaded: 2, total: 2 });

    await store.completeChapterSections(entryId, {
      title: '第1章',
      content: '<p>第一页</p><p></p><p>第二页</p>',
      rawContent: '<p>第一页</p><p></p><p>第二页</p>',
      url: 'https://example.com/book/1/1.html#section',
      nextUrl: 'https://example.com/book/1/2.html#top',
      confidence: 1,
      method: 'rule',
    });

    expect(store.chapters).toHaveLength(1);
    expect(store.chapters[0]?.id).toBe(entryId);
    expect(store.chapters[0]?.sectionProgress).toBeUndefined();
    expect(store.isTailSectionMerging).toBe(false);
    expect(store.chapters[0]?.chapter.content).toContain('第二页');
    expect(store.chapters[0]?.chapter.url).toBe('https://example.com/book/1/1.html');
    expect(store.chapters[0]?.chapter.nextUrl).toBe('https://example.com/book/1/2.html');
    expect(
      store.cachedContents.get('https://example.com/book/1/1.html')?.chapter.content
    ).toContain('第二页');
  });

  it('tracks displayed URLs through cache navigation, session replacement, and exit', async () => {
    const store = useReaderStore();
    const first = {
      title: '第一章',
      content: '<p>正文</p>',
      rawContent: '<p>正文</p>',
      url: 'https://example.com/book/1/1.html',
      nextUrl: 'https://example.com/book/1/2.html',
      confidence: 1,
      method: 'rule' as const,
    };
    const second = { ...first, title: '第二章', url: first.nextUrl, nextUrl: first.url };
    store.setChapter(first);
    store.cachedContents.set(second.url, { chapter: second, cachedAt: Date.now() });
    expect(await store.loadNextChapter()).toBe(true);
    expect(await store.loadNextChapter()).toBe(false);
    expect(store.chapters).toHaveLength(2);
    expect(store.getDebugSnapshot().navigation.loadedUrls.count).toBe(2);

    expect(await store.rebuildChaptersAround(first.url)).toBe(true);
    expect(store.getDebugSnapshot().navigation.loadedUrls.count).toBe(1);
    expect(await store.loadNextChapter()).toBe(true);
    expect(mockFetchAndParseUrl).not.toHaveBeenCalled();

    store.setChapter(second);
    expect(store.getDebugSnapshot().navigation.loadedUrls.count).toBe(1);
    expect(store.getDebugSnapshot().navigation.loadedUrls.tail).toEqual([second.url]);
    store.deactivate();
    expect(store.getDebugSnapshot().navigation.loadedUrls.count).toBe(0);
  });

  it('reserves TOC loading before detecting a missing index URL', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第一章',
      content: '<p>正文</p>',
      rawContent: '<p>正文</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });
    mockGetParser.mockReturnValue({
      detect: () => ({
        results: { navigation: { index: { url: 'https://example.com/book/1/index.html' } } },
      }),
    });
    mockLoadTocEntriesPaged.mockResolvedValueOnce([
      { title: '第一章', url: 'https://example.com/book/1/1.html' },
    ]);
    await Promise.all([store.loadToc(), store.loadToc()]);
    expect(mockLoadTocEntriesPaged).toHaveBeenCalledTimes(1);
    expect(store.tocLoading).toBe(false);
  });

  it('lets a second loadToc caller await the in-flight TOC', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第一章',
      content: '<p>正文</p>',
      rawContent: '<p>正文</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });
    let resolveToc!: (entries: Array<{ title: string; url: string }>) => void;
    mockLoadTocEntriesPaged.mockReturnValueOnce(
      new Promise(resolve => {
        resolveToc = resolve;
      })
    );

    // Opening the drawer starts the load without awaiting it; cache-all then awaits loadToc().
    void store.loadToc();
    let secondSettled = false;
    const second = store.loadToc().then(() => {
      secondSettled = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(secondSettled).toBe(false);

    resolveToc([{ title: '第一章', url: 'https://example.com/book/1/1.html' }]);
    await second;

    expect(mockLoadTocEntriesPaged).toHaveBeenCalledTimes(1);
    expect(store.toc).toHaveLength(1);
  });

  it('does not fetch the detected TOC after exiting during preparation', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第一章',
      content: '<p>正文</p>',
      rawContent: '<p>正文</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });
    mockGetParser.mockReturnValue({
      detect: () => ({
        results: { navigation: { index: { url: 'https://example.com/book/1/index.html' } } },
      }),
    });
    const run = store.loadToc();
    store.deactivate();
    await run;
    expect(mockLoadTocEntriesPaged).not.toHaveBeenCalled();
    expect(store.toc).toEqual([]);
  });

  it('loadToc retries once when first attempt returns empty', async () => {
    vi.useFakeTimers();

    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    mockLoadTocEntriesPaged
      .mockImplementationOnce(async (_indexUrl, _currentUrl, _rule, setAbort) => {
        setAbort(() => {});
        return [];
      })
      .mockImplementationOnce(async (_indexUrl, _currentUrl, _rule, setAbort) => {
        setAbort(() => {});
        return [
          { title: '第1章', url: 'https://example.com/book/1/1.html' },
          { title: '第2章', url: 'https://example.com/book/1/2.html' },
        ];
      });

    const p = store.loadToc();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);
    await p;

    expect(loadTocEntriesPaged).toHaveBeenCalledTimes(2);
    expect(store.toc).toEqual([
      { title: '第1章', url: 'https://example.com/book/1/1.html' },
      { title: '第2章', url: 'https://example.com/book/1/2.html' },
    ]);
    expect(store.tocLoading).toBe(false);
  });

  it('startCacheAll caches URLs via fetch+parse and persists them (best-effort)', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>ok</body></html>', 'text/html');

    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: url,
        error: null,
      }),
      abort: vi.fn(),
    }));

    mockParseWithSectionMerge.mockImplementation(async (_parser, _doc, url: string) => ({
      title: 't',
      content: '<p>c</p>',
      rawContent: '<p>c</p>',
      url,
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: null,
    }));

    await store.startCacheAll(['https://example.com/book/1/2.html']);

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(getParser).toHaveBeenCalledTimes(1);
    expect(parseWithSectionMerge).toHaveBeenCalledTimes(1);

    expect(store.cacheProgress.running).toBe(false);
    expect(store.cacheProgress.done).toBe(1);
    expect(store.cachedContents.has('https://example.com/book/1/2.html')).toBe(true);
    expect(store.persistedUrls.has('https://example.com/book/1/2.html')).toBe(true);
  });

  it('persists the current in-memory chapter when the full-book TOC needs no request', async () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);
    const store = useReaderStore();
    const currentUrl = 'https://example.com/book/1/1.html';
    const indexUrl = 'https://example.com/book/1/index.html';
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: currentUrl,
      indexUrl,
      confidence: 1,
      method: 'rule',
    });
    mockLoadTocEntriesPaged.mockResolvedValue([{ title: '第1章', url: currentUrl }]);

    await store.startCacheAll();

    const bookId = 'example.com_book_1_index.html';
    expect(fetchAndParseUrl).not.toHaveBeenCalled();
    expect(parseWithSectionMerge).not.toHaveBeenCalled();
    expect(store.persistedUrls.has(currentUrl)).toBe(true);
    expect(parseStoredJson(gm.store.get(getCacheV2ChapterKey(bookId, currentUrl)))).toMatchObject({
      chapter: { url: currentUrl, content: '<p>init</p>' },
    });
    expect(parseStoredJson(gm.store.get(getCacheV2IndexKey(bookId)))).toMatchObject({
      urls: [currentUrl],
    });
  });

  it('skips VIP documents without parsing, persisting, or adding them to retry failures', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const vipUrl = 'https://example.com/book/1/2.html';
    const readableUrl = 'https://example.com/book/1/3.html';
    const vipDoc = new DOMParser().parseFromString(
      '<html><body><main>预览正文</main><p>登录订阅本章: 16点</p></body></html>',
      'text/html'
    );
    const readableDoc = new DOMParser().parseFromString(
      '<html><body><main>完整正文</main></body></html>',
      'text/html'
    );
    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise: Promise.resolve({
        doc: url === vipUrl ? vipDoc : readableDoc,
        status: 200,
        finalUrl: url,
        error: null,
      }),
      abort: vi.fn(),
    }));
    mockParseWithSectionMerge.mockImplementation(async (_parser, _doc, url: string) => ({
      title: '第3章',
      content: '<p>完整正文</p>',
      rawContent: '<p>完整正文</p>',
      url,
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: null,
    }));

    await store.startCacheAll([vipUrl, readableUrl]);

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
    expect(parseWithSectionMerge).toHaveBeenCalledTimes(1);
    expect(parseWithSectionMerge).toHaveBeenCalledWith(
      expect.anything(),
      readableDoc,
      readableUrl,
      expect.anything()
    );
    expect(store.cachedContents.has(vipUrl)).toBe(false);
    expect(store.persistedUrls.has(vipUrl)).toBe(false);
    expect(store.cachedContents.has(readableUrl)).toBe(true);
    expect(store.persistedUrls.has(readableUrl)).toBe(true);
    expect(store.cacheProgress).toMatchObject({ done: 2, total: 2, failed: 0, running: false });

    await store.retryFailedCache();
    expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
  });

  it('does not request TOC entries already known to be locked', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const readableUrl = 'https://example.com/book/1/2.html';
    const lockedUrl = 'https://example.com/book/1/3.html';
    mockLoadTocEntriesPaged.mockResolvedValue([
      { title: '第2章', url: readableUrl },
      { title: '第3章', url: lockedUrl, access: 'locked' },
    ]);
    const doc = new DOMParser().parseFromString('<html><body>完整正文</body></html>', 'text/html');
    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise: Promise.resolve({ doc, status: 200, finalUrl: url, error: null }),
      abort: vi.fn(),
    }));
    mockParseWithSectionMerge.mockImplementation(async (_parser, _doc, url: string) => ({
      title: '第2章',
      content: '<p>完整正文</p>',
      rawContent: '<p>完整正文</p>',
      url,
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: lockedUrl,
    }));

    await store.startCacheAll();

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(fetchAndParseUrl).toHaveBeenCalledWith(readableUrl, expect.any(String));
    expect(store.cacheProgress).toMatchObject({ done: 1, total: 1, failed: 0, running: false });
  });

  it('drops previously persisted locked previews from the active cache index', async () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const bookId = 'example.com_book_1_index.html';
    const lockedUrl = 'https://example.com/book/1/2.html';
    const indexKey = getCacheV2IndexKey(bookId);
    const chapterKey = getCacheV2ChapterKey(bookId, lockedUrl);
    gm.store.set(
      indexKey,
      JSON.stringify({
        version: 2,
        bookId,
        indexUrl: 'https://example.com/book/1/index.html',
        urls: [lockedUrl],
        lastUpdated: Date.now(),
      })
    );
    gm.store.set(
      chapterKey,
      JSON.stringify({
        chapter: {
          title: '第2章',
          content: '<p>预览</p>',
          rawContent: '<p>预览</p>',
          url: lockedUrl,
          indexUrl: 'https://example.com/book/1/index.html',
          confidence: 1,
          method: 'rule',
        },
        cachedAt: Date.now(),
      })
    );
    mockLoadTocEntriesPaged.mockResolvedValue([
      { title: '第2章', url: lockedUrl, access: 'locked' },
    ]);

    await store.startCacheAll();

    expect(store.persistedUrls.has(lockedUrl)).toBe(false);
    expect(gm.store.has(indexKey)).toBe(false);
    expect(gm.store.has(chapterKey)).toBe(true);
    expect(fetchAndParseUrl).not.toHaveBeenCalled();
  });

  it('startCacheAll checkpoints the v2 index after the first persisted chapter', async () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>ok</body></html>', 'text/html');
    let resolveSecondFetch: (() => void) | null = null;
    const secondFetch = new Promise<{
      doc: Document;
      status: number;
      finalUrl: string;
      error: null;
    }>(resolve => {
      resolveSecondFetch = () =>
        resolve({
          doc,
          status: 200,
          finalUrl: 'https://example.com/book/1/3.html',
          error: null,
        });
    });

    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise:
        url === 'https://example.com/book/1/3.html'
          ? secondFetch
          : Promise.resolve({
              doc,
              status: 200,
              finalUrl: url,
              error: null,
            }),
      abort: vi.fn(),
    }));

    mockParseWithSectionMerge.mockImplementation(async (_parser, _doc, url: string) => ({
      title: url.endsWith('/2.html') ? '第2章' : '第3章',
      content: '<p>c</p>',
      rawContent: '<p>c</p>',
      url,
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: null,
    }));

    const run = store.startCacheAll([
      'https://example.com/book/1/2.html',
      'https://example.com/book/1/3.html',
    ]);

    const indexKey = getCacheV2IndexKey('example.com_book_1_index.html');
    await vi.waitFor(() => expect(gm.store.has(indexKey)).toBe(true));

    const checkpoint = parseStoredJson<{ urls: string[] }>(gm.store.get(indexKey));
    expect(checkpoint?.urls).toEqual(['https://example.com/book/1/2.html']);

    const releaseSecondFetch = resolveSecondFetch as (() => void) | null;
    releaseSecondFetch?.();
    await run;

    const finalIndex = parseStoredJson<{ urls: string[] }>(gm.store.get(indexKey));
    expect(finalIndex?.urls).toEqual(
      expect.arrayContaining([
        'https://example.com/book/1/1.html',
        'https://example.com/book/1/2.html',
        'https://example.com/book/1/3.html',
      ])
    );
  });

  it('reports failed cache entries and can retry them', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise: Promise.resolve({
        doc: null,
        status: 503,
        finalUrl: url,
        error: 'http',
      }),
      abort: vi.fn(),
    }));

    await store.startCacheAll([
      'https://example.com/book/1/2.html',
      'https://example.com/book/1/3.html',
    ]);

    expect(store.cacheProgress).toMatchObject({ done: 2, total: 2, failed: 2, running: false });

    const doc = new DOMParser().parseFromString('<html><body>ok</body></html>', 'text/html');
    mockFetchAndParseUrl.mockImplementation((url: string) => ({
      promise: Promise.resolve({ doc, status: 200, finalUrl: url, error: null }),
      abort: vi.fn(),
    }));
    mockParseWithSectionMerge.mockImplementation(async (_parser, _doc, url: string) => ({
      title: '章节',
      content: '<p>content</p>',
      rawContent: '<p>content</p>',
      url,
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: null,
    }));

    await store.retryFailedCache();
    expect(store.cacheProgress).toMatchObject({ done: 2, total: 2, failed: 0, running: false });
  });

  it('finishes immediately when there is nothing to cache', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    await store.startCacheAll([]);
    await store.retryFailedCache();

    expect(store.cacheProgress).toEqual({ done: 0, total: 0, failed: 0, running: false });
    expect(fetchAndParseUrl).not.toHaveBeenCalled();
  });

  it('counts already loaded URLs without requesting them again', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    await store.startCacheAll(['https://example.com/book/1/1.html']);

    expect(store.cacheProgress).toMatchObject({ done: 1, total: 1, failed: 0, running: false });
    expect(fetchAndParseUrl).not.toHaveBeenCalled();
  });

  it('records a parse failure after a successful fetch', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });
    const doc = new DOMParser().parseFromString('<html><body>invalid</body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({ doc, status: 200, finalUrl: null, error: null }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValue(null);

    await store.startCacheAll(['https://example.com/book/1/2.html']);

    expect(store.cacheProgress).toMatchObject({ done: 1, total: 1, failed: 1, running: false });
  });

  it('cancelCacheAll aborts in-flight request and stops caching', async () => {
    type AbortResult = { doc: null; status: null; finalUrl: null; error: 'abort' };

    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    let resolvePromise: ((value: AbortResult) => void) | null = null;
    const promise = new Promise<AbortResult>(resolve => {
      resolvePromise = resolve;
    });

    const abort = vi.fn(() => {
      resolvePromise?.({ doc: null, status: null, finalUrl: null, error: 'abort' });
    });
    mockFetchAndParseUrl.mockReturnValue({ promise, abort });

    const p = store.startCacheAll(['https://example.com/book/1/2.html']);
    await vi.waitFor(() => expect(mockFetchAndParseUrl).toHaveBeenCalledTimes(1));

    store.cancelCacheAll();
    await p;

    expect(abort).toHaveBeenCalledTimes(1);
    expect(store.cacheProgress.running).toBe(false);
  });

  it('cancelCacheAll aborts an in-flight section merge', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>next</body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/2.html',
        error: null,
      }),
      abort: vi.fn(),
    });

    let mergeSignal: AbortSignal | undefined;
    mockParseWithSectionMerge.mockImplementation(
      async (_parser, _doc, _url, options: { signal?: AbortSignal }) => {
        mergeSignal = options.signal;
        await new Promise<void>(resolve => {
          options.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        return null;
      }
    );

    const run = store.startCacheAll(['https://example.com/book/1/2.html']);
    await vi.waitFor(() => expect(mergeSignal).toBeDefined());

    store.cancelCacheAll();
    await run;

    expect(mergeSignal?.aborted).toBe(true);
    expect(store.cacheProgress.running).toBe(false);
  });

  it('rebuildChaptersAround replaces current chapters with the cached target', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    store.cachedContents.set('https://example.com/book/1/2.html', {
      chapter: {
        title: '第2章',
        content: '<p>c2</p>',
        rawContent: '<p>c2</p>',
        url: 'https://example.com/book/1/2.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
      cachedAt: 1,
    });

    const ok = await store.rebuildChaptersAround('https://example.com/book/1/2.html');
    expect(ok).toBe(true);
    expect(store.currentChapterIndex).toBe(0);
    expect(store.chapters.length).toBe(1);
    expect(store.chapters[0]?.chapter.url).toBe('https://example.com/book/1/2.html');
    expect(document.title).toBe('第2章');
    expect(window.location.href).toBe('https://example.com/book/1/2.html');
  });

  it('reloadCurrentChapter refetches and updates chapter content and cache', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>old</p>',
      rawContent: '<p>old</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>new</body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/1.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValue({
      title: '第1章(新)',
      content: '<p>new</p>',
      rawContent: '<p>new</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
      nextUrl: null,
    });

    await store.reloadCurrentChapter();

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(getParser).toHaveBeenCalledTimes(1);
    expect(parseWithSectionMerge).toHaveBeenCalledTimes(1);
    expect(store.chapters[0]?.chapter.content).toBe('<p>new</p>');
    expect(store.cachedContents.has('https://example.com/book/1/1.html')).toBe(true);
    expect(document.title).toBe('第1章(新)');

    store.clearError();
  });

  it('stops a running section merge before a reload replaces the chapter', async () => {
    const store = useReaderStore();
    const entryId = store.setChapter({
      title: '第1章',
      content: '<p>第一页</p>',
      rawContent: '<p>第一页</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });
    const abort = vi.fn();
    store.beginChapterSections(entryId, { loaded: 1, total: 4 }, abort);

    const doc = new DOMParser().parseFromString('<html><body>new</body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/1.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValueOnce({
      title: '第1章',
      content: '<p>重新加载</p>',
      rawContent: '<p>重新加载</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    await store.reloadCurrentChapter();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(store.chapters[0]?.sectionProgress).toBeUndefined();
    expect(store.chapters[0]?.chapter.content).toBe('<p>重新加载</p>');

    // The abandoned merge must not append its remaining pages onto the replacement.
    await expect(
      store.appendChapterSection(entryId, {
        content: '<p>陈旧分页</p>',
        rawContent: '<p>陈旧分页</p>',
        loaded: 2,
        total: 4,
      })
    ).resolves.toBe(false);
    expect(store.chapters[0]?.chapter.content).not.toContain('陈旧分页');

    store.clearError();
  });

  it('waits for a whole previous chapter instead of streaming it above the reader', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第2章',
      content: '<p>c2</p>',
      rawContent: '<p>c2</p>',
      url: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      prevUrl: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body><p>x</p></body></html>', 'text/html');
    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/1.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    // Had the prev load streamed, it would have received this first section, which names no
    // next chapter and is rejected as a table of contents.
    mockStartProgressiveSectionMerge.mockResolvedValue({
      chapter: {
        title: '第1章',
        content: '<p>第一页</p>',
        rawContent: '<p>第一页</p>',
        url: 'https://example.com/book/1/1.html',
        indexUrl: 'https://example.com/book/1/index.html',
        prevUrl: 'https://example.com/book/1/0.html',
        confidence: 1,
        method: 'rule',
      },
      merge: {
        progress: { loaded: 1, total: 2 },
        abort: vi.fn(),
        commit: vi.fn(),
        reject: vi.fn(),
      },
    });
    // Only the merged chapter names a next URL.
    mockParseWithSectionMerge.mockResolvedValueOnce({
      title: '第1章',
      content: '<p>第一页</p><p>第二页</p>',
      rawContent: '<p>第一页</p><p>第二页</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      prevUrl: 'https://example.com/book/1/0.html',
      nextUrl: 'https://example.com/book/1/2.html',
      confidence: 1,
      method: 'rule',
    });

    expect(await store.loadPrevChapter('manual')).toBe(true);

    expect(mockStartProgressiveSectionMerge).not.toHaveBeenCalled();
    expect(store.chapters[0]?.chapter.content).toContain('第二页');
    expect(store.chapters[0]?.sectionProgress).toBeUndefined();
  });

  it('loadNextChapter falls back to fetch when iframe parsing returns empty', async () => {
    vi.useFakeTimers();

    const store = useReaderStore();
    const rule: SiteRule = {
      id: 'iframe-site',
      name: 'Iframe Site',
      version: 1,
      match: { pattern: '^https://example\\.com/book/' },
      content: { selector: '#content' },
      navigation: { next: '#next' },
      advanced: { useIframe: true },
    };

    store.setChapter(
      {
        title: '第1章',
        content: '<p>init</p>',
        rawContent: '<p>init</p>',
        url: 'https://example.com/book/1/1.html',
        indexUrl: 'https://example.com/book/1/index.html',
        nextUrl: 'https://example.com/book/1/2.html',
        confidence: 1,
        method: 'rule',
      },
      rule
    );

    const iframeDoc = new DOMParser().parseFromString(
      '<html><body><main id="empty"></main></body></html>',
      'text/html'
    );
    const fetchDoc = new DOMParser().parseFromString(
      '<html><body><main id="content"><p>fetch</p></main></body></html>',
      'text/html'
    );

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      const el = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'iframe') {
        Object.defineProperty(el, 'contentDocument', {
          configurable: true,
          value: iframeDoc,
        });
        window.setTimeout(() => {
          (el as HTMLIFrameElement).onload?.(new Event('load'));
        }, 0);
      }
      return el;
    }) as typeof document.createElement);

    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc: fetchDoc,
        status: 200,
        finalUrl: 'https://example.com/book/1/2.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValueOnce(null).mockResolvedValueOnce({
      title: '第2章',
      content: '<p>fetch</p>',
      rawContent: '<p>fetch</p>',
      url: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      prevUrl: 'https://example.com/book/1/1.html',
      confidence: 1,
      method: 'rule',
      rule,
    });

    const loadPromise = store.loadNextChapter('auto');
    await vi.advanceTimersByTimeAsync(350);
    const ok = await loadPromise;

    expect(ok).toBe(true);
    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(parseWithSectionMerge).toHaveBeenCalledTimes(2);
    expect(mockParseWithSectionMerge.mock.calls[0]?.[1]).toBe(iframeDoc);
    expect(mockParseWithSectionMerge.mock.calls[1]?.[1]).toBe(fetchDoc);
    expect(store.chapters).toHaveLength(2);
    expect(store.chapters[1]?.chapter.title).toBe('第2章');
  });

  it('does not persist a terminal block when auto preload receives a TOC-like page', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      nextUrl: 'https://example.com/book/1/2.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>toc</body></html>', 'text/html');
    const tocContent = Array.from(
      { length: 12 },
      (_, i) => `<a href="/chapter/${i + 1}">第${i + 1}章</a>`
    ).join('');

    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/2.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValue({
      title: '目录',
      content: tocContent,
      rawContent: tocContent,
      url: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const ok = await store.loadNextChapter('auto');
    const snapshot = store.getDebugSnapshot();

    expect(ok).toBe(false);
    expect(store.hasNext).toBe(true);
    expect(snapshot.navigation.blockedNavUrls.count).toBe(0);
  });

  it('persists a terminal block when manual next receives a TOC-like page', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      nextUrl: 'https://example.com/book/1/2.html',
      confidence: 1,
      method: 'rule',
    });

    const doc = new DOMParser().parseFromString('<html><body>toc</body></html>', 'text/html');
    const tocContent = Array.from(
      { length: 12 },
      (_, i) => `<a href="/chapter/${i + 1}">第${i + 1}章</a>`
    ).join('');

    mockFetchAndParseUrl.mockReturnValue({
      promise: Promise.resolve({
        doc,
        status: 200,
        finalUrl: 'https://example.com/book/1/2.html',
        error: null,
      }),
      abort: vi.fn(),
    });
    mockParseWithSectionMerge.mockResolvedValue({
      title: '目录',
      content: tocContent,
      rawContent: tocContent,
      url: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const ok = await store.loadNextChapter('manual');
    const snapshot = store.getDebugSnapshot();

    expect(ok).toBe(false);
    expect(store.hasNext).toBe(false);
    expect(snapshot.navigation.blockedNavUrls.count).toBe(1);
    expect(store.error).toBe('已经是最后一章了');
    store.clearError();
  });
});
