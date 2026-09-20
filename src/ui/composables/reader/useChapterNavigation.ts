/**
 * useChapterNavigation - Composable for chapter navigation logic
 *
 * Handles navigating between chapters, jumping to specific chapters,
 * loading adjacent chapters while preserving context, and keyboard-driven scrolling.
 */

import { nextTick, onScopeDispose, type Ref } from 'vue';
import type { useReaderStore } from '@/ui/stores/reader';

export interface UseChapterNavigationOptions {
  mainRef: Ref<HTMLElement | null>;
  chapterRefs: Map<string, HTMLElement>;
  readerStore: ReturnType<typeof useReaderStore>;
  isNavigating: Ref<boolean>;
  onViewportSettled: () => void;
}

type ChapterDirection = 'prev' | 'next';
type ReaderMoveMode = 'line' | 'page';

type ViewportAnchor = {
  top: number;
  url: string;
};

const SCROLL_BOUNDARY_EPSILON_PX = 4;
const SMOOTH_NAVIGATION_LOCK_MS = 650;
const PAGE_SCROLL_RATIO = 0.9;
const LINE_SCROLL_STEP_PX = 150;

export function useChapterNavigation(options: UseChapterNavigationOptions) {
  const { mainRef, chapterRefs, readerStore, isNavigating, onViewportSettled } = options;

  let navigationId = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  function clearSettleTimer(): void {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }

  onScopeDispose(() => {
    navigationId += 1;
    clearSettleTimer();
    isNavigating.value = false;
  }, true);

  /** A directory selection supersedes older navigation; repeated paging waits for completion. */
  async function runNavigation(
    action: (mainEl: HTMLElement, isCurrent: () => boolean) => Promise<'auto' | 'smooth' | void>,
    replace = false
  ): Promise<boolean> {
    const mainEl = mainRef.value;
    if (!mainEl || (isNavigating.value && !replace)) return false;
    const id = ++navigationId;
    const isCurrent = () => id === navigationId;
    clearSettleTimer();
    isNavigating.value = true;
    let behavior: 'auto' | 'smooth' | void = undefined;
    const finish = () => {
      if (!isCurrent()) return;
      clearSettleTimer();
      isNavigating.value = false;
      if (behavior) onViewportSettled();
    };
    try {
      behavior = await action(mainEl, isCurrent);
      return isCurrent() && behavior !== undefined;
    } finally {
      if (isCurrent()) {
        if (behavior === 'smooth') settleTimer = setTimeout(finish, SMOOTH_NAVIGATION_LOCK_MS);
        else finish();
      }
    }
  }

  async function scrollToChapter(
    mainEl: HTMLElement,
    url: string,
    behavior: 'auto' | 'smooth',
    isCurrent: () => boolean
  ): Promise<'auto' | 'smooth' | void> {
    await nextTick();
    if (!isCurrent()) return;
    const index = readerStore.chapters.findIndex(entry => entry.chapter.url === url);
    const targetEl = chapterRefs.get(url);
    if (index < 0 || !targetEl) return;
    const top =
      targetEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top + mainEl.scrollTop;
    mainEl.scrollTo({ top, behavior });
    readerStore.setCurrentChapter(index);
    return behavior;
  }

  function captureViewportAnchor(
    mainEl: HTMLElement,
    direction: ChapterDirection
  ): ViewportAnchor | null {
    const entries = readerStore.chapters;
    const mainTop = mainEl.getBoundingClientRect().top;
    const mainBottom = mainTop + mainEl.clientHeight;
    const start = direction === 'next' ? entries.length - 1 : 0;
    const step = direction === 'next' ? -1 : 1;

    for (let index = start; index >= 0 && index < entries.length; index += step) {
      const url = entries[index]?.chapter.url;
      const chapterEl = url ? chapterRefs.get(url) : undefined;
      if (!url || !chapterEl) continue;

      const rect = chapterEl.getBoundingClientRect();
      if (rect.bottom > mainTop && rect.top < mainBottom) {
        return { url, top: rect.top - mainTop };
      }
    }

    const fallbackUrl = entries[start]?.chapter.url;
    const fallbackEl = fallbackUrl ? chapterRefs.get(fallbackUrl) : undefined;
    if (!fallbackUrl || !fallbackEl) return null;

    return { url: fallbackUrl, top: fallbackEl.getBoundingClientRect().top - mainTop };
  }

  function restoreViewportAnchor(mainEl: HTMLElement, anchor: ViewportAnchor | null): void {
    if (!anchor) return;

    const chapterEl = chapterRefs.get(anchor.url);
    if (!chapterEl) return;

    const nextTop = chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
    mainEl.scrollTop += nextTop - anchor.top;
  }

  function isAtTop(mainEl: HTMLElement): boolean {
    return mainEl.scrollTop <= SCROLL_BOUNDARY_EPSILON_PX;
  }

  function isAtBottom(mainEl: HTMLElement): boolean {
    return (
      mainEl.scrollHeight - (mainEl.scrollTop + mainEl.clientHeight) <= SCROLL_BOUNDARY_EPSILON_PX
    );
  }

  function preventBoundaryDefault(e: WheelEvent): void {
    if (e.cancelable === false) return;
    if (typeof e.preventDefault !== 'function') return;
    e.preventDefault();
  }

  function showBoundaryEnd(direction: ChapterDirection): void {
    const fallback = direction === 'next' ? '已经是最后一章了' : '已经是第一章了';
    readerStore.showToast(readerStore.getVipBlockedToast(direction) || fallback, 'info');
  }

  async function loadAtBoundary(
    mainEl: HTMLElement,
    direction: ChapterDirection,
    isCurrent: () => boolean
  ): Promise<boolean> {
    const available = direction === 'next' ? readerStore.hasNext : readerStore.hasPrev;
    if (!available) {
      showBoundaryEnd(direction);
      return false;
    }

    const anchor = captureViewportAnchor(mainEl, direction);

    try {
      const loaded =
        direction === 'next'
          ? await readerStore.loadNextChapter('manual')
          : await readerStore.loadPrevChapter('manual');
      if (!loaded || !isCurrent()) return false;

      // Commit the DOM and anchor together before accepting another gesture. Geometry reads
      // resolve layout; waiting for a frame would leave the new chapter visible but locked.
      await nextTick();
      if (!isCurrent()) return false;
      restoreViewportAnchor(mainEl, anchor);
      return true;
    } catch (error) {
      console.error(`[MNR] Failed to load ${direction} chapter at reader boundary:`, error);
      return false;
    }
  }

  async function loadBoundaryChapter(direction: ChapterDirection): Promise<boolean> {
    if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return false;
    return runNavigation(async (mainEl, isCurrent) => {
      if (await loadAtBoundary(mainEl, direction, isCurrent)) return 'auto';
    });
  }

  async function jumpToCachedChapter(url: string): Promise<void> {
    await runNavigation(async (mainEl, isCurrent) => {
      if (readerStore.chapters.some(entry => entry.chapter.url === url)) {
        return scrollToChapter(mainEl, url, 'smooth', isCurrent);
      }
      const success = await readerStore.rebuildChaptersAround(url);
      if (!isCurrent()) return;
      if (!success) {
        window.location.href = url;
        return;
      }
      await nextTick();
      if (!isCurrent()) return;
      mainEl.scrollTo({ top: 0, behavior: 'auto' });
      return 'auto';
    }, true);
  }

  async function jumpToChapter(
    index: number,
    behavior: 'auto' | 'smooth' = 'smooth'
  ): Promise<void> {
    const url = readerStore.chapters[index]?.chapter.url;
    if (!url) return;
    await runNavigation((mainEl, isCurrent) => scrollToChapter(mainEl, url, behavior, isCurrent));
  }

  async function moveReader(direction: ChapterDirection, mode: ReaderMoveMode): Promise<void> {
    await runNavigation(async (mainEl, isCurrent) => {
      const atBoundary = direction === 'next' ? isAtBottom(mainEl) : isAtTop(mainEl);
      if (atBoundary) {
        if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return;
        const available = direction === 'next' ? readerStore.hasNext : readerStore.hasPrev;
        if (!available) {
          if (mode === 'page') showBoundaryEnd(direction);
          return;
        }
        if (!(await loadAtBoundary(mainEl, direction, isCurrent))) return;
        if (!isCurrent()) return;
      }
      const behavior = mode === 'page' ? 'smooth' : 'auto';
      mainEl.scrollBy({
        top:
          (mode === 'page' ? mainEl.clientHeight * PAGE_SCROLL_RATIO : LINE_SCROLL_STEP_PX) *
          (direction === 'next' ? 1 : -1),
        behavior,
      });
      return behavior;
    });
  }

  /**
   * Turn one reader page while preserving a small overlap for reading continuity.
   * At content boundaries, continue into the adjacent chapter instead of clamping.
   */
  function turnReaderPage(direction: ChapterDirection): Promise<void> {
    return moveReader(direction, 'page');
  }

  /**
   * Handle wheel event at scroll boundaries.
   * Preventing the default boundary wheel is required to keep the host page from
   * receiving the gesture after the reader's internal scroller reaches its edge.
   */
  function handleWheel(e: WheelEvent) {
    const mainEl = mainRef.value;
    if (!mainEl) return;

    if (e.deltaY < 0 && isAtTop(mainEl)) {
      preventBoundaryDefault(e);
      if (readerStore.hasPrev) void loadBoundaryChapter('prev');
      return;
    }

    if (e.deltaY > 0 && isAtBottom(mainEl)) {
      preventBoundaryDefault(e);
      if (readerStore.hasNext) void loadBoundaryChapter('next');
    }
  }

  /**
   * Navigate to previous or next chapter
   */
  async function navigateChapter(direction: ChapterDirection): Promise<void> {
    const targetIndex = readerStore.currentChapterIndex + (direction === 'next' ? 1 : -1);
    if (readerStore.chapters[targetIndex]) {
      await jumpToChapter(targetIndex);
      return;
    }
    await runNavigation(async (mainEl, isCurrent) => {
      const available = direction === 'next' ? readerStore.hasNext : readerStore.hasPrev;
      if (!available) {
        showBoundaryEnd(direction);
        return;
      }
      if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return;
      const loaded =
        direction === 'next'
          ? await readerStore.loadNextChapter('manual')
          : await readerStore.loadPrevChapter('manual');
      if (!loaded || !isCurrent()) return;
      const entry =
        direction === 'next'
          ? readerStore.chapters[readerStore.chapters.length - 1]
          : readerStore.chapters[0];
      if (entry)
        return scrollToChapter(
          mainEl,
          entry.chapter.url,
          direction === 'next' ? 'smooth' : 'auto',
          isCurrent
        );
    });
  }

  /**
   * Scroll one line while preserving continuous-reading semantics at chapter boundaries.
   */
  function scrollReader(direction: 'up' | 'down'): Promise<void> {
    return moveReader(direction === 'down' ? 'next' : 'prev', 'line');
  }

  return {
    navigateChapter,
    jumpToChapter,
    jumpToCachedChapter,
    loadBoundaryChapter,
    turnReaderPage,
    handleWheel,
    scrollReader,
  };
}
