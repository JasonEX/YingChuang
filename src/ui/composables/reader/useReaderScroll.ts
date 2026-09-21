/** Reader scroll handling: chapter tracking, local progress and control visibility. */

import { type ComputedRef, onScopeDispose, type Ref } from 'vue';
import { getChapterPercent } from './useReaderPosition';
import { isChapterComplete } from '@/ui/stores/reader/types';
import type { ScheduleAutoLoadNext } from './useReaderAutoLoad';
import type { useReaderStore } from '@/ui/stores/reader';

const SCROLL_THROTTLE_MS = 16;
const SCROLL_SETTLE_CHECK_MS = 180;

export interface UseReaderScrollOptions {
  mainRef: Ref<HTMLElement | null>;
  chapterRefs: Map<string, HTMLElement>;
  readerStore: ReturnType<typeof useReaderStore>;
  autoHideHeader: ComputedRef<boolean>;
  showControls: Ref<boolean>;
  isNavigating: Ref<boolean>;
  scheduleAutoLoadNext: ScheduleAutoLoadNext;
  savePosition: (url: string, percent: number) => void;
}

export function useReaderScroll(options: UseReaderScrollOptions) {
  const {
    mainRef,
    chapterRefs,
    readerStore,
    autoHideHeader,
    showControls,
    isNavigating,
    scheduleAutoLoadNext,
    savePosition,
  } = options;

  let lastScrollCall = 0;
  let pendingScrollTimer: ReturnType<typeof setTimeout> | null = null;
  let lastScrollTop = 0;
  let pendingScrollSettleTimer: ReturnType<typeof setTimeout> | null = null;

  onScopeDispose(() => {
    if (pendingScrollTimer) clearTimeout(pendingScrollTimer);
    if (pendingScrollSettleTimer) clearTimeout(pendingScrollSettleTimer);
  }, true);

  function queueScrollSettledAutoLoadCheck(): void {
    if (pendingScrollSettleTimer) clearTimeout(pendingScrollSettleTimer);
    pendingScrollSettleTimer = setTimeout(() => {
      pendingScrollSettleTimer = null;
      scheduleAutoLoadNext('settled');
    }, SCROLL_SETTLE_CHECK_MS);
  }

  function findCurrentChapter(mainEl: HTMLElement): { index: number; element: HTMLElement } | null {
    const mainRect = mainEl.getBoundingClientRect();
    const viewportCenter = mainRect.top + mainEl.clientHeight / 2;
    let nearest: { index: number; element: HTMLElement; distance: number } | null = null;

    for (let index = 0; index < readerStore.chapters.length; index++) {
      const url = readerStore.chapters[index]?.chapter.url;
      const element = url ? chapterRefs.get(url) : undefined;
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) return { index, element };

      const distance = Math.min(
        Math.abs(rect.top - viewportCenter),
        Math.abs(rect.bottom - viewportCenter)
      );
      if (!nearest || distance < nearest.distance) nearest = { index, element, distance };
    }

    return nearest ? { index: nearest.index, element: nearest.element } : null;
  }

  function handleScrollCore() {
    const mainEl = mainRef.value;
    if (!mainEl) return;

    const currentScrollTop = mainEl.scrollTop;
    if (isNavigating.value) {
      const currentIndex = Number(readerStore.currentChapterIndex ?? 0);
      const currentUrl = readerStore.chapters[currentIndex]?.chapter.url;
      const currentElement = currentUrl ? chapterRefs.get(currentUrl) : undefined;
      const fallbackHeight = mainEl.scrollHeight - mainEl.clientHeight;
      const percent = currentElement
        ? getChapterPercent(
            mainEl,
            currentElement,
            isChapterComplete(readerStore.chapters[currentIndex])
          )
        : fallbackHeight > 0
          ? (currentScrollTop / fallbackHeight) * 100
          : 100;
      readerStore.updateScroll(percent);
      return;
    }

    if (autoHideHeader.value) {
      if (currentScrollTop > lastScrollTop && currentScrollTop > 100) {
        showControls.value = false;
      } else if (currentScrollTop < lastScrollTop - 20) {
        showControls.value = true;
      }
    }
    lastScrollTop = currentScrollTop;

    const current = findCurrentChapter(mainEl);
    if (current) {
      const complete = isChapterComplete(readerStore.chapters[current.index]);
      const percent = getChapterPercent(mainEl, current.element, complete);
      readerStore.setCurrentChapter(current.index);
      readerStore.updateScroll(percent);
      const url = readerStore.chapters[current.index]?.chapter.url;
      // A merging chapter's percent is measured against a height that is still growing.
      if (url && complete) savePosition(url, percent);
    } else {
      const scrollableHeight = mainEl.scrollHeight - mainEl.clientHeight;
      readerStore.updateScroll(
        scrollableHeight > 0 ? (currentScrollTop / scrollableHeight) * 100 : 100
      );
    }

    queueScrollSettledAutoLoadCheck();
  }

  function handleScroll(): void {
    const remaining = SCROLL_THROTTLE_MS - (Date.now() - lastScrollCall);
    if (remaining <= 0) {
      if (pendingScrollTimer) clearTimeout(pendingScrollTimer);
      pendingScrollTimer = null;
      lastScrollCall = Date.now();
      handleScrollCore();
    } else if (!pendingScrollTimer) {
      pendingScrollTimer = setTimeout(() => {
        pendingScrollTimer = null;
        lastScrollCall = Date.now();
        handleScrollCore();
      }, remaining);
    }
  }

  return { handleScroll };
}
