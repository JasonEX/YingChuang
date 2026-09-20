import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { JSDOM } from 'jsdom';

import { useChapterNavigation } from '@/ui/composables/reader/useChapterNavigation';

describe('useChapterNavigation', () => {
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

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makeChapterEntry(url: string, prevUrl?: string, nextUrl?: string) {
    return {
      chapter: { url, prevUrl, nextUrl, content: '', title: '' },
      rule: undefined,
      id: `ch-${url}`,
    };
  }

  function useFakeTimersWithImmediateAnimationFrame(): void {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      })
    );
  }

  function createNavigationOptions(overrides: Record<string, any> = {}) {
    const chapterRefs = overrides.chapterRefs || new Map();
    const mainRef = ref(overrides.mainRef || null);
    const isNavigating = ref(false);

    const readerStore = {
      chapters: overrides.chapters || [],
      currentChapterIndex: 0,
      isLoadingPrev: overrides.isLoadingPrev ?? false,
      isLoadingNext: overrides.isLoadingNext ?? false,
      hasPrev: overrides.hasPrev ?? false,
      hasNext: overrides.hasNext ?? false,
      setCurrentChapter: vi.fn(),
      loadPrevChapter: vi.fn().mockResolvedValue(true),
      loadNextChapter: vi.fn().mockResolvedValue(true),
      rebuildChaptersAround: vi.fn().mockResolvedValue(true),
      showToast: vi.fn(),
      getVipBlockedToast: vi.fn().mockReturnValue(null),
      ...overrides.readerStore,
    };

    const onViewportSettled = overrides.onViewportSettled || vi.fn();

    return {
      mainRef,
      chapterRefs,
      readerStore: readerStore as any,
      isNavigating,
      onViewportSettled,
    };
  }

  describe('navigation ownership', () => {
    it('a directory selection replaces the old scroll completion timer', async () => {
      vi.useFakeTimers();
      const mainEl = document.createElement('main');
      Object.defineProperties(mainEl, {
        clientHeight: { value: 800 },
        scrollHeight: { value: 4000 },
      });
      mainEl.scrollBy = vi.fn();
      mainEl.scrollTo = vi.fn();
      const entry = makeChapterEntry('https://example.com/ch2');
      const opts = createNavigationOptions({ mainRef: mainEl, chapters: [entry] });
      opts.chapterRefs.set(entry.chapter.url, document.createElement('article'));
      const scope = effectScope();
      const nav = scope.run(() => useChapterNavigation(opts))!;
      await nav.turnReaderPage('next');
      vi.advanceTimersByTime(400);
      await nav.jumpToCachedChapter(entry.chapter.url);
      vi.advanceTimersByTime(250);
      expect(opts.isNavigating.value).toBe(true);
      expect(opts.onViewportSettled).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(opts.isNavigating.value).toBe(false);
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
      await nav.turnReaderPage('next');
      scope.stop();
      vi.runAllTimers();
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('does not move or announce a viewport after the reader closes during loading', async () => {
      const mainEl = document.createElement('main');
      mainEl.scrollBy = vi.fn();
      let resolve!: (value: boolean) => void;
      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasNext: true,
        readerStore: {
          loadNextChapter: vi.fn(
            () =>
              new Promise<boolean>(done => {
                resolve = done;
              })
          ),
        },
      });
      const scope = effectScope();
      const nav = scope.run(() => useChapterNavigation(opts))!;
      const pending = nav.loadBoundaryChapter('next');
      expect(opts.isNavigating.value).toBe(true);
      scope.stop();
      resolve(true);
      await expect(pending).resolves.toBe(false);
      expect(mainEl.scrollBy).not.toHaveBeenCalled();
      expect(opts.onViewportSettled).not.toHaveBeenCalled();
      expect(opts.isNavigating.value).toBe(false);
    });

    it('an obsolete directory cache miss cannot navigate away from the latest selection', async () => {
      const location = { href: 'https://example.com/current' };
      vi.stubGlobal('window', { location });
      const mainEl = document.createElement('main');
      mainEl.scrollTo = vi.fn();
      let resolveOld!: (value: boolean) => void;
      const rebuild = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<boolean>(done => {
              resolveOld = done;
            })
        )
        .mockResolvedValueOnce(true);
      const opts = createNavigationOptions({
        mainRef: mainEl,
        readerStore: { rebuildChaptersAround: rebuild },
      });
      const nav = useChapterNavigation(opts);
      const old = nav.jumpToCachedChapter('https://example.com/old');
      await nav.jumpToCachedChapter('https://example.com/new');
      resolveOld(false);
      await old;
      expect(location.href).toBe('https://example.com/current');
      expect(mainEl.scrollTo).toHaveBeenCalledTimes(1);
      expect(opts.onViewportSettled).toHaveBeenCalledTimes(1);
    });
  });

  describe('jumpToCachedChapter', () => {
    it('scrolls to existing chapter in display list', async () => {
      const entry = makeChapterEntry('https://example.com/ch1');
      const chapterRefs = new Map();
      const mainEl = document.createElement('main');
      mainEl.scrollTo = vi.fn();
      const el = document.createElement('div');

      chapterRefs.set('https://example.com/ch1', el);

      const readerStore = {
        chapters: [entry],
        setCurrentChapter: vi.fn(),
        rebuildChaptersAround: vi.fn(),
      };
      const opts = createNavigationOptions({
        chapters: [entry],
        chapterRefs,
        mainRef: mainEl,
        readerStore,
      });
      const { jumpToCachedChapter } = useChapterNavigation(opts);

      await jumpToCachedChapter('https://example.com/ch1');
      expect(readerStore.setCurrentChapter).toHaveBeenCalledWith(0);
      expect(mainEl.scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 0 });
      expect(opts.isNavigating.value).toBe(true);
    });

    it('rebuilds from cache when chapter is not in display list', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();

      const replaceStateSpy = vi.fn();
      window.history.replaceState = replaceStateSpy;

      const readerStore = {
        chapters: [],
        setCurrentChapter: vi.fn(),
        rebuildChaptersAround: vi.fn().mockResolvedValue(true),
      };
      const opts = createNavigationOptions({
        chapters: [],
        mainRef: mainEl,
        readerStore,
      });
      const { jumpToCachedChapter } = useChapterNavigation(opts);

      await jumpToCachedChapter('https://example.com/ch5');
      expect(readerStore.rebuildChaptersAround).toHaveBeenCalledWith('https://example.com/ch5');
      expect(replaceStateSpy).not.toHaveBeenCalled();
      expect(mainEl.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    });

    it('attempts navigation fallback when rebuild fails', async () => {
      const readerStore = {
        chapters: [],
        setCurrentChapter: vi.fn(),
        rebuildChaptersAround: vi.fn().mockResolvedValue(false),
      };
      const opts = createNavigationOptions({
        chapters: [],
        mainRef: document.createElement('main'),
        readerStore,
      });
      const { jumpToCachedChapter } = useChapterNavigation(opts);

      // The function will try to set window.location.href — this will throw
      // in jsdom, but we verify rebuild was attempted and returned false
      try {
        await jumpToCachedChapter('https://example.com/ch5');
      } catch {
        // Expected: jsdom may throw on navigation
      }
      expect(readerStore.rebuildChaptersAround).toHaveBeenCalledWith('https://example.com/ch5');
    });
  });

  describe('jumpToChapter', () => {
    it('returns early when mainRef is null', async () => {
      const opts = createNavigationOptions({ mainRef: null });
      const { jumpToChapter } = useChapterNavigation(opts);
      await jumpToChapter(0);
      expect(opts.readerStore.setCurrentChapter).not.toHaveBeenCalled();
    });

    it('returns early for out-of-range index', async () => {
      const mainEl = document.createElement('div');
      const entry = makeChapterEntry('https://example.com/ch1');
      const opts = createNavigationOptions({ chapters: [entry], mainRef: mainEl });
      const { jumpToChapter } = useChapterNavigation(opts);
      await jumpToChapter(-1);
      expect(opts.readerStore.setCurrentChapter).not.toHaveBeenCalled();
    });

    it('resets isNavigating when target element not found', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const entry = makeChapterEntry('https://example.com/ch1');
      const opts = createNavigationOptions({ chapters: [entry], mainRef: mainEl });
      const { jumpToChapter } = useChapterNavigation(opts);

      await jumpToChapter(0);
      expect(opts.isNavigating.value).toBe(false);
    });

    it('resets isNavigating when target chapter has no url', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();

      const opts = createNavigationOptions({
        chapters: [{ chapter: { url: '', content: '', title: '' }, rule: undefined, id: 'blank' }],
        mainRef: mainEl,
      });
      const { jumpToChapter } = useChapterNavigation(opts);

      await jumpToChapter(0);

      expect(opts.isNavigating.value).toBe(false);
      expect(mainEl.scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls to chapter with smooth behavior and sets timeout', async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((cb: FrameRequestCallback) => {
          cb(0);
          return 0;
        })
      );

      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const chapterRefs = new Map();
      const chEl = document.createElement('div');
      chEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 100 });
      chapterRefs.set('https://example.com/ch1', chEl);

      const entry = makeChapterEntry('https://example.com/ch1');
      const opts = createNavigationOptions({
        chapters: [entry],
        mainRef: mainEl,
        chapterRefs,
      });
      const { jumpToChapter } = useChapterNavigation(opts);

      // Run the async function - flush only microtasks (nextTick + rAF) but not macrotasks (setTimeout)
      const jumpPromise = jumpToChapter(0, 'smooth');
      // Flush microtasks for nextTick and the rAF-based Promise
      await Promise.resolve();
      await Promise.resolve();
      await jumpPromise;

      expect(mainEl.scrollTo).toHaveBeenCalled();
      expect(opts.readerStore.setCurrentChapter).toHaveBeenCalledWith(0);

      // The smooth navigation lock timeout hasn't fired yet
      expect(opts.isNavigating.value).toBe(true);

      vi.advanceTimersByTime(650);
      expect(opts.isNavigating.value).toBe(false);

      vi.useRealTimers();
    });

    it('scrolls to chapter with auto behavior and resets via rAF', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const chapterRefs = new Map();
      const chEl = document.createElement('div');
      chEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 50 });
      chapterRefs.set('https://example.com/ch1', chEl);

      const entry = makeChapterEntry('https://example.com/ch1');
      const opts = createNavigationOptions({
        chapters: [entry],
        mainRef: mainEl,
        chapterRefs,
      });
      const { jumpToChapter } = useChapterNavigation(opts);

      await jumpToChapter(0, 'auto');
      expect(opts.isNavigating.value).toBe(false);
    });
  });

  describe('handleWheel', () => {
    it('loads prev chapter on upward scroll at top', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const entry = makeChapterEntry('https://example.com/ch1', 'https://example.com/ch0');
      const opts = createNavigationOptions({
        chapters: [entry],
        mainRef: mainEl,
        hasPrev: true,
      });
      const { handleWheel } = useChapterNavigation(opts);

      const wheelEvent = {
        deltaY: -10,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;
      handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(opts.readerStore.loadPrevChapter).toHaveBeenCalled();
    });

    it('does nothing on downward scroll away from bottom', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(mainEl, 'clientHeight', { value: 600 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2000 });

      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasPrev: true,
      });
      const { handleWheel } = useChapterNavigation(opts);

      const wheelEvent = {
        deltaY: 10,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;
      handleWheel(wheelEvent);
      expect(wheelEvent.preventDefault).not.toHaveBeenCalled();
      expect(opts.readerStore.loadPrevChapter).not.toHaveBeenCalled();
      expect(opts.readerStore.loadNextChapter).not.toHaveBeenCalled();
    });

    it('manually appends next chapter on downward scroll at bottom', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 1400, writable: true });
      Object.defineProperty(mainEl, 'clientHeight', { value: 600 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2000 });

      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasNext: true,
      });
      const { handleWheel } = useChapterNavigation(opts);

      const wheelEvent = {
        deltaY: 10,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;
      handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
    });

    it('still treats bottom boundary wheel as manual reading when preload is disabled', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 1400, writable: true });
      Object.defineProperty(mainEl, 'clientHeight', { value: 600 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2000 });

      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasNext: true,
        preloadNext: false,
      });
      const { handleWheel } = useChapterNavigation(opts);

      const wheelEvent = {
        deltaY: 10,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;
      handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
    });

    it('does nothing when mainRef is null', () => {
      const opts = createNavigationOptions({ mainRef: null });
      const { handleWheel } = useChapterNavigation(opts);
      handleWheel({ deltaY: -10 } as WheelEvent);
    });

    it('does nothing when already loading prev', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasPrev: true,
        isLoadingPrev: true,
      });
      const { handleWheel } = useChapterNavigation(opts);
      handleWheel({ deltaY: -10 } as WheelEvent);
      expect(opts.readerStore.loadPrevChapter).not.toHaveBeenCalled();
    });

    it('does nothing when isNavigating', () => {
      const mainEl = document.createElement('div');
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasPrev: true,
      });
      opts.isNavigating.value = true;
      const { handleWheel } = useChapterNavigation(opts);
      handleWheel({ deltaY: -10 } as WheelEvent);
      expect(opts.readerStore.loadPrevChapter).not.toHaveBeenCalled();
    });
  });

  describe('navigateChapter', () => {
    it('jumps to previous chapter within list', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const entries = [
        makeChapterEntry('https://example.com/ch0'),
        makeChapterEntry('https://example.com/ch1'),
      ];
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 1,
        setCurrentChapter: vi.fn(),
        loadPrevChapter: vi.fn(),
        loadNextChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        readerStore,
      });
      const target = document.createElement('article');
      target.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      opts.chapterRefs.set(entries[0].chapter.url, target);
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('prev');
      await vi.waitFor(() => expect(mainEl.scrollTo).toHaveBeenCalled());
      expect(readerStore.setCurrentChapter).toHaveBeenCalledWith(0);
    });

    it('loads prev chapter when at beginning and hasPrev', async () => {
      const mainEl = document.createElement('div');
      const readerStore = {
        chapters: [makeChapterEntry('https://example.com/ch0')],
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadPrevChapter: vi.fn().mockResolvedValue(true),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: [makeChapterEntry('https://example.com/ch0')],
        mainRef: mainEl,
        hasPrev: true,
        readerStore,
      });
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('prev');
      expect(readerStore.loadPrevChapter).toHaveBeenCalledWith('manual');
    });

    it('shows toast when no prev chapter', async () => {
      const mainEl = document.createElement('div');
      const readerStore = {
        chapters: [makeChapterEntry('https://example.com/ch0')],
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: [makeChapterEntry('https://example.com/ch0')],
        mainRef: mainEl,
        hasPrev: false,
        readerStore,
      });
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('prev');
      expect(readerStore.showToast).toHaveBeenCalledWith('已经是第一章了', 'info');
    });

    it('shows VIP blocked toast when getVipBlockedToast returns value', async () => {
      const mainEl = document.createElement('div');
      const readerStore = {
        chapters: [makeChapterEntry('https://example.com/ch0')],
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue('VIP blocked message'),
      };
      const opts = createNavigationOptions({
        chapters: [makeChapterEntry('https://example.com/ch0')],
        mainRef: mainEl,
        hasPrev: false,
        readerStore,
      });
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('prev');
      expect(readerStore.showToast).toHaveBeenCalledWith('VIP blocked message', 'info');
    });

    it('jumps to next chapter within list', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const entries = [
        makeChapterEntry('https://example.com/ch0'),
        makeChapterEntry('https://example.com/ch1'),
      ];
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        readerStore,
      });
      const target = document.createElement('article');
      target.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      opts.chapterRefs.set(entries[1].chapter.url, target);
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('next');
      await vi.waitFor(() => expect(mainEl.scrollTo).toHaveBeenCalled());
      expect(readerStore.setCurrentChapter).toHaveBeenCalledWith(1);
    });

    it('loads next chapter when at end and hasNext', async () => {
      const mainEl = document.createElement('div');
      const entries = [makeChapterEntry('https://example.com/ch0')];
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn().mockResolvedValue(true),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore,
      });
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('next');
      expect(readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
    });

    it('shows toast when no next chapter', async () => {
      const mainEl = document.createElement('div');
      const readerStore = {
        chapters: [makeChapterEntry('https://example.com/ch0')],
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: [makeChapterEntry('https://example.com/ch0')],
        mainRef: mainEl,
        hasNext: false,
        readerStore,
      });
      const { navigateChapter } = useChapterNavigation(opts);

      await navigateChapter('next');
      expect(readerStore.showToast).toHaveBeenCalledWith('已经是最后一章了', 'info');
    });

    it('returns early when mainRef is null', async () => {
      const opts = createNavigationOptions({ mainRef: null });
      const { navigateChapter } = useChapterNavigation(opts);
      await navigateChapter('next');
      expect(opts.readerStore.setCurrentChapter).not.toHaveBeenCalled();
    });

    it('returns early when isNavigating', async () => {
      const mainEl = document.createElement('div');
      const opts = createNavigationOptions({ mainRef: mainEl });
      opts.isNavigating.value = true;
      const { navigateChapter } = useChapterNavigation(opts);
      await navigateChapter('next');
    });
  });

  describe('scrollReader', () => {
    it('scrolls down by step', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 100, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl });
      const { scrollReader } = useChapterNavigation(opts);

      await scrollReader('down');
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 150, behavior: 'auto' });
    });

    it('scrolls up by step', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 100, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl });
      const { scrollReader } = useChapterNavigation(opts);

      await scrollReader('up');
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: -150, behavior: 'auto' });
    });

    it('loads the previous chapter and continues one line at the top boundary', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasPrev: true,
      });
      const { scrollReader } = useChapterNavigation(opts);

      await scrollReader('up');

      expect(opts.readerStore.loadPrevChapter).toHaveBeenCalledWith('manual');
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: -150, behavior: 'auto' });
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
      expect(opts.isNavigating.value).toBe(false);
    });

    it('loads the next chapter and continues one line at the bottom boundary', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const opts = createNavigationOptions({
        mainRef: mainEl,
        hasNext: true,
      });
      const { scrollReader } = useChapterNavigation(opts);

      await scrollReader('down');

      expect(opts.readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 150, behavior: 'auto' });
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
      expect(opts.isNavigating.value).toBe(false);
    });

    it('does not interfere with an active navigation', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'scrollTop', { value: 100, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl });
      opts.isNavigating.value = true;
      const { scrollReader } = useChapterNavigation(opts);

      await scrollReader('down');

      expect(mainEl.scrollBy).not.toHaveBeenCalled();
    });

    it('does nothing when mainRef is null', async () => {
      const opts = createNavigationOptions({ mainRef: null });
      const { scrollReader } = useChapterNavigation(opts);
      await expect(scrollReader('down')).resolves.toBeUndefined();
    });
  });

  describe('loadBoundaryChapter', () => {
    it('appends the next chapter without turning another reader page', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 1_200, writable: true });

      const current = makeChapterEntry('https://example.com/ch1');
      const next = makeChapterEntry('https://example.com/ch2');
      const entries = [current];
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn().mockReturnValue({ top: -1_200, bottom: 800 });
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn().mockImplementation(async () => {
          entries.push(next);
          return true;
        }),
        loadPrevChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { loadBoundaryChapter } = useChapterNavigation(opts);

      await expect(loadBoundaryChapter('next')).resolves.toBe(true);

      expect(readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
      expect(mainEl.scrollTop).toBe(1_200);
      expect(mainEl.scrollBy).not.toHaveBeenCalled();
      expect(opts.isNavigating.value).toBe(false);
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('restores the visible anchor when appending trims content above it', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 1_200, writable: true });

      const current = makeChapterEntry('https://example.com/ch1');
      const next = makeChapterEntry('https://example.com/ch2');
      const entries = [current];
      let currentTop = -1_200;
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn(
        () => ({ top: currentTop, bottom: currentTop + 2_000 }) as DOMRect
      );
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn().mockImplementation(async () => {
          currentTop -= 900;
          entries.push(next);
          return true;
        }),
        loadPrevChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { loadBoundaryChapter } = useChapterNavigation(opts);

      await loadBoundaryChapter('next');

      expect(mainEl.scrollTop).toBe(300);
      expect(mainEl.scrollBy).not.toHaveBeenCalled();
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('preserves the current chapter when prepending at the top boundary', async () => {
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const previous = makeChapterEntry('https://example.com/ch0');
      const current = makeChapterEntry('https://example.com/ch1');
      const entries = [current];
      let currentTop = 0;
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn(
        () => ({ top: currentTop, bottom: currentTop + 1_200 }) as DOMRect
      );
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn(),
        loadPrevChapter: vi.fn().mockImplementation(async () => {
          currentTop += 900;
          entries.unshift(previous);
          return true;
        }),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasPrev: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { loadBoundaryChapter } = useChapterNavigation(opts);

      await loadBoundaryChapter('prev');

      expect(mainEl.scrollTop).toBe(900);
      expect(mainEl.scrollBy).not.toHaveBeenCalled();
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('releases the navigation lock without settling when loading fails', async () => {
      const mainEl = document.createElement('div');
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });

      const current = makeChapterEntry('https://example.com/ch1');
      const opts = createNavigationOptions({
        chapters: [current],
        mainRef: mainEl,
        hasNext: true,
        readerStore: { loadNextChapter: vi.fn().mockResolvedValue(false) },
      });
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, bottom: 800 });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { loadBoundaryChapter } = useChapterNavigation(opts);

      await expect(loadBoundaryChapter('next')).resolves.toBe(false);

      expect(opts.isNavigating.value).toBe(false);
      expect(opts.onViewportSettled).not.toHaveBeenCalled();
    });

    it('accepts the next boundary pull once content is committed, even before the next frame', async () => {
      // A busy/background frame must not keep already loaded content navigation-locked.
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn(() => 1)
      );
      const opts = createNavigationOptions({
        mainRef: document.createElement('div'),
        hasNext: true,
      });
      const { loadBoundaryChapter } = useChapterNavigation(opts);
      const first = loadBoundaryChapter('next');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(opts.isNavigating.value).toBe(false);
      await expect(first).resolves.toBe(true);
      await expect(loadBoundaryChapter('next')).resolves.toBe(true);
      expect(opts.readerStore.loadNextChapter).toHaveBeenCalledTimes(2);
    });

    it('holds the navigation lock until an in-flight boundary load settles', async () => {
      const mainEl = document.createElement('div');
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });

      const current = makeChapterEntry('https://example.com/ch1');
      const next = makeChapterEntry('https://example.com/ch2');
      const entries = [current];
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, bottom: 800 });
      let finishLoad: (() => void) | undefined;
      const loadNextChapter = vi.fn(
        () =>
          new Promise<boolean>(resolve => {
            finishLoad = () => {
              entries.push(next);
              resolve(true);
            };
          })
      );
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore: { loadNextChapter },
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { loadBoundaryChapter } = useChapterNavigation(opts);

      const firstLoad = loadBoundaryChapter('next');
      expect(opts.isNavigating.value).toBe(true);
      await expect(loadBoundaryChapter('next')).resolves.toBe(false);
      expect(loadNextChapter).toHaveBeenCalledOnce();

      finishLoad?.();
      await expect(firstLoad).resolves.toBe(true);
      expect(opts.isNavigating.value).toBe(false);
    });
  });

  describe('turnReaderPage', () => {
    it('scrolls by 90% of the viewport while content remains', async () => {
      vi.useFakeTimers();
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 500, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl });
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('next');

      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 720, behavior: 'smooth' });
      expect(opts.isNavigating.value).toBe(true);
      vi.advanceTimersByTime(650);
      expect(opts.isNavigating.value).toBe(false);
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('keeps scrolling current content while a background next preload is in flight', async () => {
      vi.useFakeTimers();
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 500, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl, isLoadingNext: true });
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('next');

      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 720, behavior: 'smooth' });
      expect(opts.isNavigating.value).toBe(true);
      vi.advanceTimersByTime(650);
      expect(opts.isNavigating.value).toBe(false);
    });

    it('ignores another page command while the current animation is locked', async () => {
      vi.useFakeTimers();
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 500, writable: true });

      const opts = createNavigationOptions({ mainRef: mainEl });
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('next');
      await turnReaderPage('next');

      expect(mainEl.scrollBy).toHaveBeenCalledOnce();
    });

    it('loads the next chapter at the bottom and continues by one reader page', async () => {
      useFakeTimersWithImmediateAnimationFrame();
      const mainEl = document.createElement('div');
      mainEl.scrollTo = vi.fn();
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 1_200, writable: true });

      const current = makeChapterEntry('https://example.com/ch1');
      const next = makeChapterEntry('https://example.com/ch2');
      const entries = [current];
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn().mockImplementation(async () => {
          entries.push(next);
          return true;
        }),
        loadPrevChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn().mockReturnValue({ top: -1_200 });
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('next');

      expect(readerStore.loadNextChapter).toHaveBeenCalledWith('manual');
      expect(mainEl.scrollTo).not.toHaveBeenCalled();
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 720, behavior: 'smooth' });
      expect(readerStore.setCurrentChapter).not.toHaveBeenCalled();

      vi.advanceTimersByTime(650);
      expect(opts.onViewportSettled).toHaveBeenCalledOnce();
    });

    it('preserves the visible chapter anchor when appending trims earlier chapters', async () => {
      useFakeTimersWithImmediateAnimationFrame();
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 1_200, writable: true });

      const current = makeChapterEntry('https://example.com/ch1');
      const next = makeChapterEntry('https://example.com/ch2');
      const entries = [current];
      let currentTop = -1_200;
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn(() => ({ top: currentTop }) as DOMRect);
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadNextChapter: vi.fn().mockImplementation(async () => {
          currentTop -= 900;
          entries.push(next);
          return true;
        }),
        loadPrevChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };
      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasNext: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('next');

      expect(mainEl.scrollTop).toBe(300);
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: 720, behavior: 'smooth' });
    });

    it('loads the previous chapter at the top and reveals its last screen', async () => {
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockImplementation(() => 0 as unknown as ReturnType<typeof setTimeout>);
      const mainEl = document.createElement('div');
      mainEl.scrollBy = vi.fn();
      mainEl.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0 });
      Object.defineProperty(mainEl, 'clientHeight', { value: 800 });
      Object.defineProperty(mainEl, 'scrollHeight', { value: 2_000 });
      Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });

      const previous = makeChapterEntry('https://example.com/ch0');
      const current = makeChapterEntry('https://example.com/ch1');
      const entries = [current];
      let currentTop = 0;
      const currentElement = document.createElement('article');
      currentElement.getBoundingClientRect = vi.fn(
        () => ({ top: currentTop, bottom: currentTop + 1_200 }) as DOMRect
      );
      const readerStore = {
        chapters: entries,
        currentChapterIndex: 0,
        setCurrentChapter: vi.fn(),
        loadPrevChapter: vi.fn().mockImplementation(async () => {
          currentTop += 1_000;
          entries.unshift(previous);
          return true;
        }),
        loadNextChapter: vi.fn(),
        showToast: vi.fn(),
        getVipBlockedToast: vi.fn().mockReturnValue(null),
      };

      const opts = createNavigationOptions({
        chapters: entries,
        mainRef: mainEl,
        hasPrev: true,
        readerStore,
      });
      opts.chapterRefs.set(current.chapter.url, currentElement);
      const { turnReaderPage } = useChapterNavigation(opts);

      await turnReaderPage('prev');

      expect(readerStore.loadPrevChapter).toHaveBeenCalledWith('manual');
      expect(mainEl.scrollTop).toBe(1_000);
      expect(mainEl.scrollBy).toHaveBeenCalledWith({ top: -720, behavior: 'smooth' });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 650);
    });
  });
});
