/** Whole-chapter positions are saved and restored only against complete display entries. */
import {
  flushReadingPositions,
  getReadingPosition,
  saveReadingPosition,
} from '@/ui/stores/reader/readingPosition';
import { nextTick, onScopeDispose, type Ref, watch } from 'vue';
import { isChapterComplete } from '@/ui/stores/reader/types';
import type { useReaderStore } from '@/ui/stores/reader';

export function getChapterPercent(
  mainEl: HTMLElement,
  chapterEl: HTMLElement,
  complete: boolean
): number {
  const top =
    mainEl.scrollTop + chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
  if (complete && chapterEl.offsetHeight <= mainEl.clientHeight) return 100;
  const height = Math.max(1, chapterEl.offsetHeight - mainEl.clientHeight * 0.5);
  return Math.max(0, Math.min(100, ((mainEl.scrollTop - top) / height) * 100));
}

export function useReaderPosition(options: {
  mainRef: Ref<HTMLElement | null>;
  chapterRefs: Map<string, HTMLElement>;
  readerStore: ReturnType<typeof useReaderStore>;
  isNavigating: Ref<boolean>;
}) {
  const { mainRef, chapterRefs, readerStore, isNavigating } = options;
  const currentEntry = () => readerStore.chapters[readerStore.currentChapterIndex];
  // One initial restoration belongs to this display entry, including while storage is read.
  const initialEntryId = currentEntry()?.id;
  let state: 'pending' | 'cancelled' | 'ready' = initialEntryId ? 'pending' : 'ready';
  let cancelledScrollTop = 0;
  let savedPercent: number | null = null;
  let disposed = false;
  let lastSaveAt = 0;

  function cancelRestore(): void {
    if (state !== 'pending') return;
    state = 'cancelled';
    cancelledScrollTop = mainRef.value?.scrollTop ?? 0;
  }

  function allowSaving(): void {
    state = 'ready';
  }

  function canSave(): boolean {
    if (state === 'cancelled' && mainRef.value && mainRef.value.scrollTop !== cancelledScrollTop) {
      allowSaving();
    }
    return state === 'ready';
  }

  async function applySavedPosition(): Promise<void> {
    const entry = currentEntry();
    if (state !== 'pending' || entry?.id !== initialEntryId || savedPercent === null) return;
    if (!isChapterComplete(entry)) return;
    const id = initialEntryId;
    await nextTick();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (
      disposed ||
      state !== 'pending' ||
      currentEntry()?.id !== id ||
      !isChapterComplete(currentEntry())
    )
      return;
    const mainEl = mainRef.value;
    const chapterEl = chapterRefs.get(entry.chapter.url);
    if (!mainEl || !chapterEl) return;
    const top =
      mainEl.scrollTop + chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
    const height = Math.max(0, chapterEl.offsetHeight - mainEl.clientHeight * 0.5);
    mainEl.scrollTop = top + (savedPercent / 100) * height;
    readerStore.updateScroll(savedPercent);
    allowSaving();
    readerStore.showToast('已回到上次阅读位置', 'info', 1800);
  }

  async function restorePosition(): Promise<void> {
    const entry = currentEntry();
    if (!entry || entry.id !== initialEntryId || state !== 'pending') return;
    const percent = await getReadingPosition(entry.chapter.url);
    if (entry.id !== initialEntryId || state !== 'pending') return;
    if (percent === null || percent < 3 || percent > 98) {
      allowSaving();
      return;
    }
    savedPercent = percent;
    await applySavedPosition();
  }

  watch(
    () => [
      currentEntry()?.id,
      currentEntry()?.sectionProgress !== undefined,
      currentEntry()?.sectionsIncomplete,
      isNavigating.value,
    ],
    (value, previous) => {
      if (value[0] !== previous[0]) {
        allowSaving();
      } else if (isNavigating.value || currentEntry()?.sectionsIncomplete) {
        cancelRestore();
      } else {
        void applySavedPosition();
      }
    },
    { flush: 'post' }
  );
  onScopeDispose(() => {
    disposed = true;
  });

  function savePosition(url: string, percent: number): void {
    const entry = currentEntry();
    if (!canSave() || !isChapterComplete(entry) || entry.chapter.url !== url) return;
    const now = Date.now();
    if (now - lastSaveAt < 500) return;
    lastSaveAt = now;
    saveReadingPosition(url, percent);
  }

  function flushPosition(): void {
    const entry = currentEntry();
    const mainEl = mainRef.value;
    const chapterEl = entry && chapterRefs.get(entry.chapter.url);
    if (canSave() && isChapterComplete(entry) && mainEl && chapterEl) {
      // Growth or conversion may have changed the height since the last scroll event.
      saveReadingPosition(entry.chapter.url, getChapterPercent(mainEl, chapterEl, true));
    }
    void flushReadingPositions();
  }

  return { restorePosition, cancelRestore, savePosition, flushPosition };
}
