import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import {
  type CachedChapter,
  type ChapterEntry,
  MAX_CACHED_CHAPTERS,
} from '@/ui/stores/reader/types';
import {
  insertCachedChapter,
  insertParsedChapter,
  rebuildChaptersFromCache,
} from '@/ui/stores/reader/chapterListMutations';
import { createNavigation } from '@/ui/stores/reader/navigation';
import type { NavigationContext } from '@/ui/stores/reader/navigationContext';
import type { ParsedChapter } from '@/core/parser';
import type { PreparedChapterLoad } from '@/ui/stores/reader/chapterLoadGuards';

describe('chapterListMutations', () => {
  function makeChapter(index: number, overrides: Partial<ParsedChapter> = {}): ParsedChapter {
    return {
      title: `Chapter ${index}`,
      bookTitle: 'Book',
      content: `<p>Content ${index}</p>`,
      rawContent: `<p>Raw ${index}</p>`,
      prevUrl: `https://example.com/${index - 1}.html`,
      nextUrl: `https://example.com/${index + 1}.html`,
      indexUrl: 'https://example.com/book/',
      url: `https://example.com/${index}.html`,
      confidence: 1,
      method: 'rule',
      ...overrides,
    };
  }

  function makeEntry(index: number): ChapterEntry {
    return {
      chapter: makeChapter(index),
      id: `entry-${index}`,
    };
  }

  function makeCached(index: number): CachedChapter {
    return {
      chapter: makeChapter(index),
      cachedAt: Date.now(),
    };
  }

  function makeContext(entries: ChapterEntry[] = [makeEntry(1)]): NavigationContext {
    const chapters = ref(entries);
    return {
      chapters,
      currentChapterIndex: ref(0),
      isLoadingNext: ref(false),
      isLoadingPrev: ref(false),
      pendingNextAbort: ref(null),
      pendingPrevAbort: ref(null),
      reloadAbort: ref(null),
      loadedUrls: computed(() => new Set(chapters.value.map(entry => entry.chapter.url))),
      vipBlockedUrls: ref(new Set()),
      blockedNavUrls: ref(new Set()),
      cachedContents: ref(new Map()),
      persistedUrls: ref(new Set()),
      originalContents: ref(new Map()),
      originalTitles: ref(new Map()),
      currentConversionMode: ref('none'),
      navFailures: new Map(),
      runtime: {
        bumpView: vi.fn(() => 1),
        isViewStale: vi.fn(() => false),
        viewId: vi.fn(() => 1),
      },
      showToast: vi.fn(),
      setError: vi.fn(),
      applyConversionToChapterEntry: vi.fn(),
      getPersistedCachedChapter: vi.fn(),
    };
  }

  function makeLoad(isNext: boolean, refChapter: ChapterEntry): PreparedChapterLoad {
    return {
      direction: isNext ? 'next' : 'prev',
      endMessage: isNext ? '已经是最后一章了' : '已经是第一章了',
      errorMessage: isNext ? '加载下一章失败' : '加载上一章失败',
      isLoadingRef: ref(false),
      isNext,
      navKey: refChapter.chapter.url,
      pendingAbortRef: ref(null),
      refChapter,
      targetUrl: refChapter.chapter.url,
    };
  }

  it('prepends cached chapters, records originals, and applies conversion', async () => {
    const ctx = makeContext([makeEntry(2)]);
    ctx.currentConversionMode.value = 'sc';

    await expect(insertCachedChapter(ctx, makeCached(1), 'prepend')).resolves.toBe(true);

    const inserted = ctx.chapters.value[0];
    expect(inserted.chapter.url).toBe('https://example.com/1.html');
    expect(ctx.currentChapterIndex.value).toBe(1);
    expect(ctx.loadedUrls.value.has('https://example.com/1.html')).toBe(true);
    expect(ctx.originalContents.value.get(inserted.id)).toBe('<p>Content 1</p>');
    expect(ctx.originalTitles.value.get(inserted.id)).toEqual({
      title: 'Chapter 1',
      bookTitle: 'Book',
    });
    expect(ctx.applyConversionToChapterEntry).toHaveBeenCalledWith(inserted.id, 'sc');
  });

  it('inserts previous parsed chapters and trims the display tail', async () => {
    const entries = Array.from({ length: MAX_CACHED_CHAPTERS }, (_, index) => makeEntry(index + 2));
    const ctx = makeContext(entries);
    ctx.currentConversionMode.value = 'tc';
    const parsed = makeChapter(1);
    const load = makeLoad(false, entries[0]);

    await expect(insertParsedChapter(ctx, load, parsed)).resolves.toBe(true);

    expect(ctx.chapters.value).toHaveLength(MAX_CACHED_CHAPTERS);
    expect(ctx.chapters.value[0].chapter.url).toBe('https://example.com/1.html');
    expect(ctx.chapters.value.at(-1)?.chapter.url).toBe('https://example.com/6.html');
    expect(ctx.loadedUrls.value.has('https://example.com/7.html')).toBe(false);
    expect(ctx.currentChapterIndex.value).toBe(1);
    expect(ctx.cachedContents.value.get('https://example.com/1.html')?.chapter.url).toBe(
      parsed.url
    );
    expect(ctx.applyConversionToChapterEntry).toHaveBeenCalledWith(ctx.chapters.value[0].id, 'tc');
  });

  it('trims the display head when appending far past the active chapter', async () => {
    const entries = Array.from({ length: MAX_CACHED_CHAPTERS }, (_, index) => makeEntry(index + 1));
    const ctx = makeContext(entries);
    ctx.currentChapterIndex.value = 4;
    ctx.originalContents.value.set(entries[0].id, entries[0].chapter.content);
    ctx.originalTitles.value.set(entries[0].id, { title: entries[0].chapter.title });
    const parsed = makeChapter(7);
    const load = makeLoad(true, entries.at(-1)!);

    await expect(insertParsedChapter(ctx, load, parsed)).resolves.toBe(true);

    expect(ctx.chapters.value).toHaveLength(MAX_CACHED_CHAPTERS);
    expect(ctx.chapters.value[0].chapter.url).toBe('https://example.com/2.html');
    expect(ctx.chapters.value.at(-1)?.chapter.url).toBe('https://example.com/7.html');
    expect(ctx.loadedUrls.value.has('https://example.com/1.html')).toBe(false);
    expect(ctx.originalContents.value.has(entries[0].id)).toBe(false);
    expect(ctx.originalTitles.value.has(entries[0].id)).toBe(false);
    expect(ctx.currentChapterIndex.value).toBe(3);
  });

  it('rebuilds display state from cached content and applies conversion', async () => {
    const ctx = makeContext([makeEntry(10), makeEntry(11)]);
    ctx.currentConversionMode.value = 'sc';
    ctx.originalContents.value.set('stale', 'stale');
    ctx.originalTitles.value.set('stale', { title: 'stale' });
    const cached = makeCached(3);

    await expect(rebuildChaptersFromCache(ctx, cached)).resolves.toBe(true);

    expect(ctx.chapters.value).toHaveLength(1);
    expect(ctx.chapters.value[0].chapter.url).toBe('https://example.com/3.html');
    expect(ctx.currentChapterIndex.value).toBe(0);
    expect(ctx.loadedUrls.value).toEqual(new Set(['https://example.com/3.html']));
    expect(ctx.originalContents.value.get(ctx.chapters.value[0].id)).toBe('<p>Content 3</p>');
    expect(ctx.originalTitles.value.get(ctx.chapters.value[0].id)).toEqual({
      title: 'Chapter 3',
      bookTitle: 'Book',
    });
    expect(ctx.applyConversionToChapterEntry).toHaveBeenCalledWith(ctx.chapters.value[0].id, 'sc');
  });
  it('reserves persisted navigation before its first await', async () => {
    const ctx = makeContext();
    const cached = makeCached(2);
    ctx.currentConversionMode.value = 'sc';
    vi.mocked(ctx.getPersistedCachedChapter).mockReturnValue(cached);
    let resolve!: () => void;
    vi.mocked(ctx.applyConversionToChapterEntry).mockReturnValue(
      new Promise(done => {
        resolve = done;
      })
    );
    ctx.persistedUrls.value.add(cached.chapter.url);
    const actions = createNavigation(ctx);
    const first = actions.loadNextChapter('auto');
    const second = actions.loadNextChapter('manual');
    expect(ctx.getPersistedCachedChapter).toHaveBeenCalledTimes(1);
    resolve();
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(ctx.chapters.value.map(entry => entry.chapter.url)).toEqual([
      'https://example.com/1.html',
      cached.chapter.url,
    ]);
    expect(ctx.isLoadingNext.value).toBe(false);
  });

  it.each(['cached', 'parsed'] as const)(
    'does not trim the new view after a stale %s insertion',
    async kind => {
      const ctx = makeContext();
      ctx.currentConversionMode.value = 'sc';
      let resolve!: () => void;
      vi.mocked(ctx.applyConversionToChapterEntry).mockReturnValue(
        new Promise(done => {
          resolve = done;
        })
      );
      const run =
        kind === 'cached'
          ? insertCachedChapter(ctx, makeCached(2), 'prepend')
          : insertParsedChapter(ctx, makeLoad(false, ctx.chapters.value[0]), makeChapter(2));
      const replacement = Array.from({ length: MAX_CACHED_CHAPTERS + 1 }, (_, index) =>
        makeEntry(index + 20)
      );
      ctx.chapters.value = replacement;
      vi.mocked(ctx.runtime.isViewStale).mockReturnValue(true);
      resolve();
      expect(await run).toBe(false);
      expect(ctx.chapters.value).toHaveLength(MAX_CACHED_CHAPTERS + 1);
    }
  );
});
