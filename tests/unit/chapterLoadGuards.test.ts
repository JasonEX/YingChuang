import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { prepareChapterLoad, validateTargetChapterUrl } from '@/ui/stores/reader/chapterLoadGuards';
import type { ChapterEntry } from '@/ui/stores/reader/types';
import type { NavigationContext } from '@/ui/stores/reader/navigationContext';

describe('chapterLoadGuards', () => {
  function makeEntry(overrides: Record<string, any> = {}): ChapterEntry {
    return {
      chapter: {
        url: 'https://example.com/book/1.html',
        title: 'Chapter 1',
        content: '',
        prevUrl: '',
        nextUrl: 'https://example.com/book/2.html',
        indexUrl: 'https://example.com/book/',
        ...overrides,
      } as any,
      rule: undefined,
      id: `entry-${overrides.url || '1'}`,
    };
  }

  function createContext(overrides: Record<string, any> = {}): NavigationContext {
    return {
      chapters: ref(overrides.chapters || [makeEntry(overrides.chapter)]),
      currentChapterIndex: ref(0),
      isLoadingNext: ref(overrides.isLoadingNext ?? false),
      isLoadingPrev: ref(overrides.isLoadingPrev ?? false),
      pendingNextAbort: ref(null),
      pendingPrevAbort: ref(null),
      reloadAbort: ref(null),
      loadedUrls: ref(overrides.loadedUrls || new Set<string>()),
      vipBlockedUrls: ref(overrides.vipBlockedUrls || new Set<string>()),
      blockedNavUrls: ref(overrides.blockedNavUrls || new Set<string>()),
      cachedContents: ref(new Map()),
      persistedUrls: ref(new Set()),
      originalContents: ref(new Map()),
      originalTitles: ref(new Map()),
      currentConversionMode: ref('none'),
      navFailures: overrides.navFailures || new Map(),
      runtime: {
        bumpView: vi.fn(() => 1),
        isViewStale: vi.fn(() => false),
        viewId: vi.fn(() => 1),
      },
      showToast: vi.fn(),
      setError: vi.fn(),
      applyConversionToChapterEntry: vi.fn(),
      getPersistedCachedChapter: vi.fn(),
      ...overrides.ctx,
    } as unknown as NavigationContext;
  }

  it('reports a merging chapter instead of claiming the book ended', () => {
    const entry: ChapterEntry = {
      ...makeEntry({ nextUrl: '' }),
      sectionProgress: { loaded: 2, total: 5 },
    };
    const ctx = createContext({ chapters: [entry] });

    expect(prepareChapterLoad(ctx, 'next', 'manual')).toBeNull();
    expect(ctx.showToast).toHaveBeenCalledWith('本章正在加载后续内容，请稍候', 'info');
  });

  it('reports an incomplete chapter rather than the end of the book', () => {
    const entry: ChapterEntry = {
      ...makeEntry({ nextUrl: '' }),
      sectionsIncomplete: true,
    };
    const ctx = createContext({ chapters: [entry] });

    expect(prepareChapterLoad(ctx, 'next', 'manual')).toBeNull();
    expect(ctx.showToast).toHaveBeenCalledWith('本章内容不完整，无法确认下一章', 'info');
  });

  it('still reports the end of the book when nothing is merging', () => {
    const ctx = createContext({ chapter: { nextUrl: '' } });

    expect(prepareChapterLoad(ctx, 'next', 'manual')).toBeNull();
    expect(ctx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');
  });

  it('prepares next and previous loads and normalizes target URLs', () => {
    const entry = makeEntry({
      prevUrl: 'https://example.com/book/0.html#top',
      nextUrl: 'https://example.com/book/2.html#content',
    });
    const ctx = createContext({ chapters: [entry] });

    const next = prepareChapterLoad(ctx, 'next', 'auto');
    const prev = prepareChapterLoad(ctx, 'prev', 'manual');

    expect(next?.isNext).toBe(true);
    expect(next?.targetUrl).toBe('https://example.com/book/2.html');
    expect(entry.chapter.nextUrl).toBe('https://example.com/book/2.html');
    expect(prev?.isNext).toBe(false);
    expect(prev?.targetUrl).toBe('https://example.com/book/0.html');
    expect(entry.chapter.prevUrl).toBe('https://example.com/book/0.html');
  });

  it('blocks while already loading or when the target is missing', () => {
    const loadingCtx = createContext({ isLoadingNext: true });
    expect(prepareChapterLoad(loadingCtx, 'next', 'manual')).toBeNull();

    const missingCtx = createContext({ chapter: { nextUrl: '' } });
    expect(prepareChapterLoad(missingCtx, 'next', 'manual')).toBeNull();
    expect(missingCtx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');

    const autoMissingCtx = createContext({ chapter: { nextUrl: '' } });
    expect(prepareChapterLoad(autoMissingCtx, 'next', 'auto')).toBeNull();
    expect(autoMissingCtx.showToast).not.toHaveBeenCalled();
  });

  it('blocks index, VIP, known blocked, auto recent failure, and already loaded targets', () => {
    const indexCtx = createContext({ chapter: { nextUrl: 'https://example.com/book/' } });
    expect(prepareChapterLoad(indexCtx, 'next', 'manual')).toBeNull();
    expect(indexCtx.blockedNavUrls.value.has('https://example.com/book')).toBe(true);

    const autoIndexCtx = createContext({ chapter: { nextUrl: 'https://example.com/book/' } });
    expect(prepareChapterLoad(autoIndexCtx, 'next', 'auto')).toBeNull();
    expect(autoIndexCtx.blockedNavUrls.value.has('https://example.com/book')).toBe(false);

    const vipCtx = createContext({
      vipBlockedUrls: new Set(['https://example.com/book/2.html']),
    });
    expect(prepareChapterLoad(vipCtx, 'next', 'auto')).toBeNull();
    expect(vipCtx.showToast).toHaveBeenCalledWith('该章节为VIP/付费内容，无法加载', 'info', 3000);

    const blockedCtx = createContext({
      blockedNavUrls: new Set(['https://example.com/book/2.html']),
    });
    expect(prepareChapterLoad(blockedCtx, 'next', 'manual')).toBeNull();
    expect(blockedCtx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');

    const failedCtx = createContext({
      navFailures: new Map([
        ['https://example.com/book/2.html', { count: 1, nextRetryAt: Date.now() + 1000 }],
      ]),
    });
    expect(prepareChapterLoad(failedCtx, 'next', 'auto')).toBeNull();
    expect(failedCtx.showToast).not.toHaveBeenCalledWith(
      '加载失败过于频繁，请稍后重试',
      'info',
      2000
    );

    const manualRetryCtx = createContext({
      navFailures: new Map([
        ['https://example.com/book/2.html', { count: 1, nextRetryAt: Date.now() + 1000 }],
      ]),
    });
    expect(prepareChapterLoad(manualRetryCtx, 'next', 'manual')).not.toBeNull();

    const loadedCtx = createContext({
      loadedUrls: new Set(['https://example.com/book/2.html']),
    });
    expect(prepareChapterLoad(loadedCtx, 'next', 'auto')).toBeNull();
  });

  it('validates candidate target URLs and reports manual invalid targets', () => {
    const ctx = createContext();
    const load = prepareChapterLoad(ctx, 'next', 'manual');
    expect(load).not.toBeNull();
    expect(validateTargetChapterUrl(ctx, load!, 'manual')).toBe(true);

    const invalidCtx = createContext({ chapter: { nextUrl: 'https://example.com/' } });
    const invalidLoad = prepareChapterLoad(invalidCtx, 'next', 'manual');
    expect(invalidLoad).not.toBeNull();
    invalidLoad!.isLoadingRef.value = true;

    expect(validateTargetChapterUrl(invalidCtx, invalidLoad!, 'manual')).toBe(false);
    expect(invalidLoad!.isLoadingRef.value).toBe(false);
    expect(invalidCtx.blockedNavUrls.value.has('https://example.com')).toBe(true);
    expect(invalidCtx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');

    const autoInvalidCtx = createContext({ chapter: { nextUrl: 'https://example.com/' } });
    const autoInvalidLoad = prepareChapterLoad(autoInvalidCtx, 'next', 'auto');
    expect(autoInvalidLoad).not.toBeNull();
    autoInvalidLoad!.isLoadingRef.value = true;

    expect(validateTargetChapterUrl(autoInvalidCtx, autoInvalidLoad!, 'auto')).toBe(false);
    expect(autoInvalidLoad!.isLoadingRef.value).toBe(false);
    expect(autoInvalidCtx.blockedNavUrls.value.has('https://example.com')).toBe(false);
    expect(autoInvalidCtx.showToast).not.toHaveBeenCalled();
  });
});
