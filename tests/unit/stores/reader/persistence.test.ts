import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAndParseUrl } from '@/core/utils/network';
import { useReaderStore } from '@/ui/stores/reader';

import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { createDom } from '../../../testUtils/dom';
import { setupPinia } from '../../../testUtils/pinia';

const { mockFetchAndParseUrl } = vi.hoisted(() => ({
  mockFetchAndParseUrl: vi.fn(),
}));

vi.mock('@/core/utils/network', () => ({
  fetchAndParseUrl: mockFetchAndParseUrl,
}));

describe('ReaderStore - persistence', () => {
  beforeEach(() => {
    setupPinia();
    createDom('https://example.com/book/1/1.html');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('persistCache stores cached chapters and index (v2) and updates persistedUrls', async () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      nextUrl: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    store.cachedContents.set('https://example.com/book/1/1.html', {
      chapter: {
        title: '第1章',
        content: '<p>c1</p>',
        rawContent: '<p>c1</p>',
        url: 'https://example.com/book/1/1.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
      cachedAt: 1,
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
      cachedAt: 2,
    });

    const now = vi.spyOn(Date, 'now').mockReturnValue(1234);
    store.persistCache();
    now.mockRestore();

    expect(gm.GM_setValue).toHaveBeenCalled();
    expect(Array.from(store.persistedUrls)).toEqual(
      expect.arrayContaining([
        'https://example.com/book/1/1.html',
        'https://example.com/book/1/2.html',
      ])
    );

    const keys = Array.from(gm.store.keys());
    expect(
      keys.some(k => k.startsWith('mnr_cache_v2_chapter_example.com_book_1_index.html_'))
    ).toBe(true);
    expect(keys).toContain('mnr_cache_v2_index_example.com_book_1_index.html');
  });

  it('restoreCache reads the v2 index', async () => {
    const bookId = 'example.com_book_1_index.html';
    const v2Key = `mnr_cache_v2_index_${bookId}`;

    const gm = createGmStorageMock({
      [v2Key]: JSON.stringify({
        version: 2,
        bookId,
        indexUrl: 'https://example.com/book/1/index.html',
        urls: ['https://example.com/book/1/10.html'],
        lastUpdated: 1,
      }),
    });
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

    store.restoreCache();
    expect(Array.from(store.persistedUrls)).toEqual(['https://example.com/book/1/10.html']);
  });

  it('clearPersistedCache deletes persisted keys and clears persistedUrls (keeps session cache)', async () => {
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
    store.persistCache();
    expect(store.persistedUrls.size).toBeGreaterThan(0);
    const sessionCacheSize = store.cachedContents.size;
    expect(sessionCacheSize).toBeGreaterThan(0);

    const beforeKeys = new Set(gm.store.keys());
    store.clearPersistedCache();

    expect(store.persistedUrls.size).toBe(0);
    expect(store.cachedContents.size).toBe(sessionCacheSize);

    const afterKeys = new Set(gm.store.keys());
    for (const k of beforeKeys) {
      if (k.startsWith('mnr_cache_v2_chapter_') || k.startsWith('mnr_cache_v2_index_')) {
        expect(afterKeys.has(k)).toBe(false);
      }
    }
  });

  it('clearPersistedCache falls back to GM_listValues scan when url index is missing', async () => {
    const bookId = 'example.com_book_1_index.html';
    const chapterPrefix = `mnr_cache_v2_chapter_${bookId}_`;

    const gm = createGmStorageMock({
      [`${chapterPrefix}a`]: 'x',
      [`${chapterPrefix}b`]: 'y',
      other: 'z',
    });
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

    store.persistedUrls.clear();
    store.clearPersistedCache();

    expect(gm.store.has(`${chapterPrefix}a`)).toBe(false);
    expect(gm.store.has(`${chapterPrefix}b`)).toBe(false);
    expect(gm.store.has('other')).toBe(true);
  });

  it('loadNextChapter uses persisted cache without network refetch', async () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    mockFetchAndParseUrl.mockImplementation(() => {
      throw new Error('should not fetch when persisted cache exists');
    });

    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      nextUrl: 'https://example.com/book/1/2.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    store.cachedContents.set('https://example.com/book/1/2.html', {
      chapter: {
        title: '第2章',
        content: '<p>cached</p>',
        rawContent: '<p>cached</p>',
        url: 'https://example.com/book/1/2.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
      cachedAt: 1,
    });
    store.persistCache();

    // Force the store to read from persisted storage rather than the session cache.
    store.cachedContents.clear();

    const ok = await store.loadNextChapter();
    expect(ok).toBe(true);
    expect(store.chapters.length).toBe(2);
    expect(store.chapters[1]?.chapter.url).toBe('https://example.com/book/1/2.html');
    expect(fetchAndParseUrl).not.toHaveBeenCalled();
  });
});
