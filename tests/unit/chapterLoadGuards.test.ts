import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { leadsOutOfBook, prepareChapterLoad } from '@/ui/stores/reader/chapterLoadGuards';
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

  it('blocks index, VIP, known blocked, and already loaded targets', () => {
    // The index is a URL fact that availability derives too, so nothing is recorded.
    const indexCtx = createContext({ chapter: { nextUrl: 'https://example.com/book/' } });
    expect(prepareChapterLoad(indexCtx, 'next', 'manual')).toBeNull();
    expect(indexCtx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');
    expect(indexCtx.blockedNavUrls.value.size).toBe(0);

    const autoIndexCtx = createContext({ chapter: { nextUrl: 'https://example.com/book/' } });
    expect(prepareChapterLoad(autoIndexCtx, 'next', 'auto')).toBeNull();
    expect(autoIndexCtx.showToast).not.toHaveBeenCalled();

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

    const loadedCtx = createContext({
      loadedUrls: new Set(['https://example.com/book/2.html']),
    });
    expect(prepareChapterLoad(loadedCtx, 'next', 'auto')).toBeNull();
  });

  it('refuses targets that lead out of the book, reporting only manual attempts', () => {
    expect(prepareChapterLoad(createContext(), 'next', 'manual')).not.toBeNull();

    const invalidCtx = createContext({ chapter: { nextUrl: 'https://example.com/' } });
    expect(prepareChapterLoad(invalidCtx, 'next', 'manual')).toBeNull();
    expect(invalidCtx.isLoadingNext.value).toBe(false);
    expect(invalidCtx.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');
    expect(invalidCtx.blockedNavUrls.value.size).toBe(0);

    const autoInvalidCtx = createContext({ chapter: { nextUrl: 'https://example.com/' } });
    expect(prepareChapterLoad(autoInvalidCtx, 'next', 'auto')).toBeNull();
    expect(autoInvalidCtx.showToast).not.toHaveBeenCalled();
  });

  it('keeps confirmed index, VIP and navigation blocks above cache hints', () => {
    for (const kind of ['index', 'vip', 'blocked']) {
      const target = 'https://example.com/book/2.html';
      const ctx = createContext({ chapter: kind === 'index' ? { indexUrl: target } : {} });
      ctx.persistedUrls.value.add(target);
      if (kind === 'vip') ctx.vipBlockedUrls.value.add(target);
      if (kind === 'blocked') ctx.blockedNavUrls.value.add(target);
      expect(prepareChapterLoad(ctx, 'next', 'manual')).toBeNull();
    }
  });

  it('treats the book index and non-chapter URLs as leading out of the book', () => {
    // A book page that no URL heuristic flags is still the end once it is the index.
    const entry = makeEntry({ indexUrl: 'https://example.com/info/7.html' });
    expect(leadsOutOfBook('https://example.com/book/2.html', entry)).toBe(false);
    expect(leadsOutOfBook('https://example.com/info/7.html#top', entry)).toBe(true);
    expect(leadsOutOfBook('https://example.com/', entry)).toBe(true);
  });
});
