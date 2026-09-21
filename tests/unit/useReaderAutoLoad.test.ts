import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, reactive, ref } from 'vue';
import { JSDOM } from 'jsdom';

import {
  INTERSECTION_ROOT_MARGIN_PX,
  MAX_UNREAD_PRELOAD_CHAPTERS,
} from '@/ui/composables/reader/autoLoadPolicy';
import {
  SHORT_CHAPTER_PRELOAD_DELAY_MS,
  useReaderAutoLoad,
} from '@/ui/composables/reader/useReaderAutoLoad';

describe('useReaderAutoLoad', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });
    // test env
    vi.stubGlobal('window', dom.window);
    // test env
    vi.stubGlobal('document', dom.window.document);

    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makeChapter(url: string, nextUrl = 'https://example.com/chapter/next') {
    return {
      chapter: {
        url,
        title: 'Chapter',
        bookTitle: 'Book',
        content: '内容'.repeat(1000),
        indexUrl: 'https://example.com/book/1',
        nextUrl,
        prevUrl: '',
        method: 'rule',
        confidence: 100,
      },
      rule: { id: 'test', name: 'Test', pattern: 'example\\.com' },
      id: `entry-${url}`,
    };
  }

  function defineScrollMetrics(
    el: HTMLElement,
    metrics: { scrollHeight: number; scrollTop: number; clientHeight: number }
  ) {
    Object.defineProperty(el, 'scrollHeight', { value: metrics.scrollHeight, configurable: true });
    Object.defineProperty(el, 'scrollTop', {
      value: metrics.scrollTop,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(el, 'clientHeight', { value: metrics.clientHeight, configurable: true });
  }

  function setChapterHeight(
    chapterRefs: Map<string, HTMLElement>,
    url: string,
    height: number,
    onRead?: () => void
  ): void {
    const element = document.createElement('article');
    Object.defineProperty(element, 'offsetHeight', {
      get: () => {
        onRead?.();
        return height;
      },
      configurable: true,
    });
    chapterRefs.set(url, element);
  }

  function createAutoLoadOptions(overrides: Record<string, any> = {}) {
    const mainRef = ref<HTMLElement | null>(overrides.mainRef || null);
    const chapters = overrides.chapters || [makeChapter('https://example.com/chapter/1')];
    const chapterRefs = overrides.chapterRefs || new Map<string, HTMLElement>();
    if (!overrides.chapterRefs) {
      for (const entry of chapters) {
        const element = document.createElement('article');
        Object.defineProperty(element, 'offsetHeight', {
          value: overrides.defaultChapterHeight ?? 1200,
          configurable: true,
        });
        chapterRefs.set(entry.chapter.url, element);
      }
    }
    const readerStore = reactive({
      chapters,
      currentChapterIndex: overrides.currentChapterIndex ?? 0,
      hasNext: overrides.hasNext ?? true,
      isLoadingNext: overrides.isLoadingNext ?? false,
      isLoadingPrev: overrides.isLoadingPrev ?? false,
      loadNextChapter: vi.fn().mockResolvedValue(true),
      ...overrides.readerStore,
    });
    const configStore = reactive({
      behavior: {
        preloadNext: overrides.preloadNext ?? true,
      },
      reading: {
        fontFamily: 'sans-serif',
        fontSize: 18,
        lineHeight: 1.8,
        letterSpacing: 0,
        paragraphIndent: 2,
        maxWidth: 800,
        padding: 20,
        textConversion: 'none',
      },
      customCSS: '',
      customCleanupRegex: '',
      ...overrides.configStore,
    });

    return {
      mainRef,
      chapterRefs,
      readerStore: readerStore as any,
      configStore: configStore as any,
      isNavigating: ref(overrides.isNavigating ?? false),
    };
  }

  async function flushPromises() {
    await Promise.resolve();
    await nextTick();
  }

  it('does nothing when mainRef is null', () => {
    const opts = createAutoLoadOptions({ mainRef: null });
    const result = useReaderAutoLoad(opts);

    result.scheduleAutoLoadNext('state');
    vi.advanceTimersByTime(5000);

    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('owns bottom-sentinel observation without changing the near-bottom policy', () => {
    const mainEl = document.createElement('main');
    const sentinel = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    let notifyIntersection: (entries: IntersectionObserverEntry[]) => void = () => undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const observer = vi.fn(function (nextCallback: IntersectionObserverCallback) {
      notifyIntersection = entries => nextCallback(entries, {} as IntersectionObserver);
      return { observe, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', observer);
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const result = useReaderAutoLoad(opts);
    result.clearAutoLoadTimer();
    vi.advanceTimersByTime(3000);

    result.observeBottomSentinel(sentinel);

    expect(observer).toHaveBeenCalledWith(expect.any(Function), {
      root: mainEl,
      rootMargin: `${INTERSECTION_ROOT_MARGIN_PX}px`,
      threshold: 0,
    });
    expect(observe).toHaveBeenCalledWith(sentinel);

    notifyIntersection([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    mainEl.scrollTop = 2900;
    notifyIntersection([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('does not auto preload before the 3s hard gate', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });

    useReaderAutoLoad(opts);

    vi.advanceTimersByTime(2999);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('does not spin when a successful preload appends no chapter', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(3000);
    await flushPromises();
    vi.advanceTimersByTime(10_000);
    await flushPromises();

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);
  });

  it('keeps the 1600px fallback behind the same hard gate', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const result = useReaderAutoLoad(opts);

    result.scheduleAutoLoadNext('settled');
    vi.advanceTimersByTime(2999);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('does not let near-bottom scroll preload when it is still outside the 1600px fallback', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 6000, scrollTop: 1000, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const result = useReaderAutoLoad(opts);

    result.clearAutoLoadTimer();
    vi.advanceTimersByTime(3000);

    result.scheduleAutoLoadNext('settled');

    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('uses the 1600px fallback after the hard gate has passed', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const result = useReaderAutoLoad(opts);

    result.clearAutoLoadTimer();
    vi.advanceTimersByTime(3000);
    result.scheduleAutoLoadNext('settled');

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('holds preloading while an unread chapter is still merging its sections', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const merging = {
      ...makeChapter('https://example.com/chapter/2'),
      sectionProgress: { loaded: 2, total: 9 },
    };
    const opts = createAutoLoadOptions({
      mainRef: mainEl,
      chapters: [makeChapter('https://example.com/chapter/1'), merging],
      currentChapterIndex: 0,
      // Short enough that the buffer would otherwise read "short" and keep preloading.
      defaultChapterHeight: 100,
      hasNext: true,
    });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(5000);
    await flushPromises();

    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    opts.readerStore.chapters[1].sectionProgress = undefined;
    await nextTick();
    vi.advanceTimersByTime(5000);
    await flushPromises();

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('does not preload when an unread next chapter is already buffered', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({
      mainRef: mainEl,
      chapters: [
        makeChapter('https://example.com/chapter/1'),
        makeChapter('https://example.com/chapter/2'),
      ],
      currentChapterIndex: 0,
      hasNext: true,
    });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(5000);

    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('preloads through under-one-screen chapters until a full-screen chapter is buffered', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const nextChapters = [
      { url: 'https://example.com/chapter/2', height: 300 },
      { url: 'https://example.com/chapter/3', height: 900 },
    ];

    opts.readerStore.loadNextChapter = vi.fn(async () => {
      const next = nextChapters.shift();
      if (!next) return false;
      const entry = makeChapter(next.url, 'https://example.com/chapter/4');
      opts.readerStore.chapters.push(entry);
      setChapterHeight(opts.chapterRefs, next.url, next.height);
      return true;
    });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(3000);
    await flushPromises();

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SHORT_CHAPTER_PRELOAD_DELAY_MS - 1);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(SHORT_CHAPTER_PRELOAD_DELAY_MS * 2);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(2);
  });

  it('caps an all-short unread buffer at ten chapters for the same visible chapter', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    let nextNumber = 2;

    opts.readerStore.loadNextChapter = vi.fn(async () => {
      const url = `https://example.com/chapter/${nextNumber++}`;
      const entry = makeChapter(url, `https://example.com/chapter/${nextNumber}`);
      opts.readerStore.chapters.push(entry);
      setChapterHeight(opts.chapterRefs, url, 300);
      return true;
    });

    const result = useReaderAutoLoad(opts);
    vi.advanceTimersByTime(3000);
    await flushPromises();

    for (let count = 1; count < MAX_UNREAD_PRELOAD_CHAPTERS; count++) {
      vi.advanceTimersByTime(SHORT_CHAPTER_PRELOAD_DELAY_MS);
      await flushPromises();
    }

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(MAX_UNREAD_PRELOAD_CHAPTERS);
    result.scheduleAutoLoadNext('settled');
    result.scheduleAutoLoadNext('sentinel');
    vi.advanceTimersByTime(10_000);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(MAX_UNREAD_PRELOAD_CHAPTERS);
  });

  it('caches chapter height checks across repeated viewport triggers', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const chapters = [
      makeChapter('https://example.com/chapter/1'),
      makeChapter('https://example.com/chapter/2'),
    ];
    const chapterRefs = new Map<string, HTMLElement>();
    let heightReads = 0;
    setChapterHeight(chapterRefs, chapters[1].chapter.url, 900, () => {
      heightReads += 1;
    });
    const opts = createAutoLoadOptions({ mainRef: mainEl, chapters, chapterRefs });
    const result = useReaderAutoLoad(opts);

    result.scheduleAutoLoadNext('settled');
    result.scheduleAutoLoadNext('sentinel');
    result.scheduleAutoLoadNext('settled');

    expect(heightReads).toBe(1);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('invalidates cached chapter heights when display layout settings change', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const chapters = [
      makeChapter('https://example.com/chapter/1'),
      makeChapter('https://example.com/chapter/2'),
    ];
    const chapterRefs = new Map<string, HTMLElement>();
    let heightReads = 0;
    setChapterHeight(chapterRefs, chapters[1].chapter.url, 900, () => {
      heightReads += 1;
    });
    const opts = createAutoLoadOptions({ mainRef: mainEl, chapters, chapterRefs });
    useReaderAutoLoad(opts);
    expect(heightReads).toBe(1);

    opts.configStore.reading.fontSize = 20;
    await nextTick();

    expect(heightReads).toBe(2);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    opts.configStore.customCleanupRegex = '测试广告$';
    await nextTick();

    expect(heightReads).toBe(3);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('coalesces resize invalidations into one animation frame', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return 7;
    });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const chapters = [
      makeChapter('https://example.com/chapter/1'),
      makeChapter('https://example.com/chapter/2'),
    ];
    const chapterRefs = new Map<string, HTMLElement>();
    let heightReads = 0;
    setChapterHeight(chapterRefs, chapters[1].chapter.url, 900, () => {
      heightReads += 1;
    });
    const opts = createAutoLoadOptions({ mainRef: mainEl, chapters, chapterRefs });
    useReaderAutoLoad(opts);

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(requestFrame).toHaveBeenCalledTimes(1);

    callbacks[0]?.(0);
    expect(heightReads).toBe(2);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });

  it('does not preload while disabled, loading, navigating, or at the end', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });

    for (const overrides of [
      { preloadNext: false },
      { isLoadingNext: true },
      { isLoadingPrev: true },
      { isNavigating: true },
      { hasNext: false },
    ]) {
      const opts = createAutoLoadOptions({ mainRef: mainEl, ...overrides });
      useReaderAutoLoad(opts);
      vi.advanceTimersByTime(5000);
      expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
      vi.clearAllTimers();
    }
  });

  it('responds to the preload setting being turned off and back on', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });

    useReaderAutoLoad(opts);
    opts.configStore.behavior.preloadNext = false;
    await nextTick();
    vi.advanceTimersByTime(5000);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    opts.configStore.behavior.preloadNext = true;
    await nextTick();

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('preloads when progressive section merging reveals the next chapter', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl, hasNext: false });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(5000);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    opts.readerStore.hasNext = true;
    await nextTick();

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('schedules after loading state clears without loading during the busy state', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });

    const opts = createAutoLoadOptions({ mainRef: mainEl });

    const result = useReaderAutoLoad(opts);
    result.clearAutoLoadTimer();

    opts.readerStore.isLoadingNext = true;
    await nextTick();
    vi.advanceTimersByTime(5000);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    opts.readerStore.isLoadingNext = false;
    await nextTick();
    vi.advanceTimersByTime(3000);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('waits until the page becomes visible before scheduling preload', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });

    useReaderAutoLoad(opts);
    vi.advanceTimersByTime(5000);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('starts a new hard gate when the visible current chapter changes', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({
      mainRef: mainEl,
      chapters: [
        makeChapter('https://example.com/chapter/1'),
        makeChapter('https://example.com/chapter/2'),
      ],
      currentChapterIndex: 0,
    });
    useReaderAutoLoad(opts);

    vi.advanceTimersByTime(1000);
    opts.readerStore.currentChapterIndex = 1;
    await nextTick();

    vi.advanceTimersByTime(2999);
    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('auto');
  });

  it('applies a short cooldown after failed auto preload and retries only after a later trigger', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    opts.readerStore.loadNextChapter = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = useReaderAutoLoad(opts);
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);

    result.scheduleAutoLoadNext('state');
    result.scheduleAutoLoadNext('settled');
    vi.advanceTimersByTime(5999);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(2);
  });

  it('also cools down when auto preload rejects', async () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 2900, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    opts.readerStore.loadNextChapter = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(true);

    const result = useReaderAutoLoad(opts);
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(1);

    result.scheduleAutoLoadNext('sentinel');
    vi.advanceTimersByTime(6000);

    expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(2);
  });

  it('clearAutoLoadTimer clears the pending hard-gate timer', () => {
    const mainEl = document.createElement('div');
    defineScrollMetrics(mainEl, { scrollHeight: 5000, scrollTop: 0, clientHeight: 600 });
    const opts = createAutoLoadOptions({ mainRef: mainEl });
    const result = useReaderAutoLoad(opts);

    result.clearAutoLoadTimer();
    vi.advanceTimersByTime(5000);

    expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
  });
});
