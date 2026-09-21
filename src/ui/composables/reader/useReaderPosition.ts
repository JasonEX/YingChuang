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
  let pendingEntryId: string | null = currentEntry()?.id ?? null;
  let savedPercent: number | null = null;
  let disposed = false;
  let lastSaveAt = 0;

  function cancelRestore(): void {
    pendingEntryId = null;
  }

  async function applySavedPosition(): Promise<void> {
    const entry = currentEntry();
    if (!pendingEntryId || entry?.id !== pendingEntryId || savedPercent === null) return;
    if (!isChapterComplete(entry)) return;
    const id = pendingEntryId;
    await nextTick();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (
      disposed ||
      pendingEntryId !== id ||
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
    cancelRestore();
    readerStore.showToast('已回到上次阅读位置', 'info', 1800);
  }

  async function restorePosition(): Promise<void> {
    const entry = currentEntry();
    if (!entry || entry.id !== pendingEntryId) return;
    const percent = await getReadingPosition(entry.chapter.url);
    if (entry.id !== pendingEntryId) return;
    if (percent === null || percent < 3 || percent > 98) {
      cancelRestore();
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
    () => {
      if (
        currentEntry()?.id !== pendingEntryId ||
        isNavigating.value ||
        currentEntry()?.sectionsIncomplete
      ) {
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
    if (pendingEntryId || !isChapterComplete(entry) || entry.chapter.url !== url) return;
    const now = Date.now();
    if (now - lastSaveAt < 500) return;
    lastSaveAt = now;
    saveReadingPosition(url, percent);
  }

  function flushPosition(): void {
    const entry = currentEntry();
    const mainEl = mainRef.value;
    const chapterEl = entry && chapterRefs.get(entry.chapter.url);
    if (!pendingEntryId && isChapterComplete(entry) && mainEl && chapterEl) {
      // Growth or conversion may have changed the height since the last scroll event.
      saveReadingPosition(entry.chapter.url, getChapterPercent(mainEl, chapterEl, true));
    }
    void flushReadingPositions();
  }

  return { restorePosition, cancelRestore, savePosition, flushPosition };
}
