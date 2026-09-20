/**
 * useReaderAutoLoad - bounded automatic preloading.
 *
 * Every visible chapter gets a short reading grace period. The buffer may continue
 * through under-one-screen chapters, but requests remain sequential and capped.
 */

import {
  type AutoLoadReason,
  decideAutoLoadNext,
  INTERSECTION_ROOT_MARGIN_PX,
  isViewportNearBottom,
  MAX_UNREAD_PRELOAD_CHAPTERS,
  type UnreadBufferState,
} from './autoLoadPolicy';
import type { ChapterEntry, useReaderStore } from '@/ui/stores/reader';
import { nextTick, onUnmounted, type Ref, watch } from 'vue';
import { recordDebugEvent } from '@/core/debug/events';
import type { useConfigStore } from '@/ui/stores/config';

const PRELOAD_DELAY_MIN_MS = 3000;
const PRELOAD_DELAY_MAX_MS = 5000;
export const SHORT_CHAPTER_PRELOAD_DELAY_MS = 300;
const FAILURE_COOLDOWN_MIN_MS = 6000;
const FAILURE_COOLDOWN_MAX_MS = 10000;

export type ScheduleAutoLoadNext = (reason?: AutoLoadReason) => void;

export interface UseReaderAutoLoadOptions {
  mainRef: Ref<HTMLElement | null>;
  chapterRefs: Map<string, HTMLElement>;
  readerStore: ReturnType<typeof useReaderStore>;
  configStore: ReturnType<typeof useConfigStore>;
  isNavigating: Ref<boolean>;
}

export function useReaderAutoLoad(options: UseReaderAutoLoadOptions) {
  const { mainRef, chapterRefs, readerStore, configStore, isNavigating } = options;

  let autoLoadTimer: ReturnType<typeof setTimeout> | null = null;
  let autoLoadTimerDueAt = 0;
  let autoLoadInFlight = false;
  let sessionKey = '';
  let graceUntil = 0;
  let failureCooldownUntil = 0;
  let layoutRevision = 0;
  let layoutInvalidationFrame: number | null = null;
  let bottomObserver: globalThis.IntersectionObserver | null = null;
  let lastBufferState: UnreadBufferState | '' = '';
  const chapterScreenCache = new Map<
    string,
    { fillsViewport: boolean; layoutRevision: number; viewportHeight: number }
  >();

  function getRandomDelayMs(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getCurrentIndex(): number {
    const index = Number(readerStore.currentChapterIndex ?? 0);
    if (!Number.isFinite(index) || readerStore.chapters.length === 0) return 0;
    return Math.max(0, Math.min(readerStore.chapters.length - 1, index));
  }

  function getCurrentSessionKey(): string {
    const entry = readerStore.chapters[getCurrentIndex()];
    if (!entry) return '';
    return `${entry.id}:${entry.chapter.url}`;
  }

  function ensureSession(): boolean {
    const nextSessionKey = getCurrentSessionKey();
    if (!nextSessionKey) return false;

    if (nextSessionKey !== sessionKey) {
      sessionKey = nextSessionKey;
      graceUntil = Date.now() + getRandomDelayMs(PRELOAD_DELAY_MIN_MS, PRELOAD_DELAY_MAX_MS);
      failureCooldownUntil = 0;
      lastBufferState = '';
      clearAutoLoadTimer();
      recordDebugEvent('autoload.session', {
        currentIndex: getCurrentIndex(),
        currentUrl: readerStore.chapters[getCurrentIndex()]?.chapter.url,
        graceMs: Math.max(0, graceUntil - Date.now()),
      });
    }
    return true;
  }

  function getChapterViewportState(
    entry: ChapterEntry,
    mainEl: HTMLElement
  ): 'pending' | 'short' | 'sufficient' {
    const viewportHeight = mainEl.clientHeight;
    const chapterEl = chapterRefs.get(entry.chapter.url);
    if (!chapterEl || viewportHeight <= 0) return 'pending';

    const cached = chapterScreenCache.get(entry.id);
    if (
      cached &&
      cached.layoutRevision === layoutRevision &&
      cached.viewportHeight === viewportHeight
    ) {
      return cached.fillsViewport ? 'sufficient' : 'short';
    }

    const chapterHeight = chapterEl.offsetHeight;
    if (chapterHeight <= 0) return 'pending';

    const fillsViewport = chapterHeight >= viewportHeight;
    chapterScreenCache.set(entry.id, { fillsViewport, layoutRevision, viewportHeight });
    return fillsViewport ? 'sufficient' : 'short';
  }

  function getUnreadBufferState(mainEl: HTMLElement): UnreadBufferState {
    const unreadEntries = readerStore.chapters.slice(getCurrentIndex() + 1);
    if (unreadEntries.length === 0) return 'empty';
    if (unreadEntries.length >= MAX_UNREAD_PRELOAD_CHAPTERS) return 'capped';

    let hasPendingMeasurement = false;
    for (const entry of unreadEntries) {
      const state = getChapterViewportState(entry, mainEl);
      if (state === 'sufficient') return 'sufficient';
      if (state === 'pending') hasPendingMeasurement = true;
    }

    return hasPendingMeasurement ? 'pending' : 'short';
  }

  function recordBufferState(state: UnreadBufferState): void {
    if (state === lastBufferState) return;
    lastBufferState = state;
    recordDebugEvent('autoload.buffer', {
      state,
      currentIndex: getCurrentIndex(),
      unreadChapterCount: Math.max(0, readerStore.chapters.length - getCurrentIndex() - 1),
      limit: MAX_UNREAD_PRELOAD_CHAPTERS,
    });
  }

  function pruneChapterScreenCache(activeIds: string[]): void {
    const active = new Set(activeIds);
    for (const id of chapterScreenCache.keys()) {
      if (!active.has(id)) chapterScreenCache.delete(id);
    }
  }

  function invalidateChapterScreenCache(): void {
    layoutRevision += 1;
    chapterScreenCache.clear();
    lastBufferState = '';
  }

  function queueLayoutInvalidation(): void {
    if (layoutInvalidationFrame !== null) return;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      invalidateChapterScreenCache();
      scheduleAutoLoadNext('state');
      return;
    }

    layoutInvalidationFrame = globalThis.requestAnimationFrame(() => {
      layoutInvalidationFrame = null;
      invalidateChapterScreenCache();
      scheduleAutoLoadNext('state');
    });
  }

  function isPageHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  function clearAutoLoadTimer(): void {
    if (!autoLoadTimer) return;
    clearTimeout(autoLoadTimer);
    autoLoadTimer = null;
    autoLoadTimerDueAt = 0;
  }

  function scheduleTimerAt(dueAt: number): void {
    if (autoLoadTimer && autoLoadTimerDueAt <= dueAt) return;

    clearAutoLoadTimer();
    autoLoadTimerDueAt = dueAt;
    autoLoadTimer = setTimeout(
      () => {
        autoLoadTimer = null;
        autoLoadTimerDueAt = 0;
        scheduleAutoLoadNext('timer');
      },
      Math.max(0, dueAt - Date.now())
    );
  }

  async function finishLoad(
    ok: boolean,
    startedSessionKey: string,
    startedTailId: string | undefined
  ): Promise<void> {
    recordDebugEvent('autoload.finish', {
      ok,
      chapterCount: readerStore.chapters.length,
      currentIndex: readerStore.currentChapterIndex,
    });

    if (getCurrentSessionKey() !== startedSessionKey) {
      autoLoadInFlight = false;
      ensureSession();
      scheduleAutoLoadNext('state');
      return;
    }

    if (ok) {
      failureCooldownUntil = 0;
      await nextTick();
      autoLoadInFlight = false;
      const mainEl = mainRef.value;
      if (!mainEl) return;
      if (getCurrentSessionKey() !== startedSessionKey) {
        ensureSession();
        scheduleAutoLoadNext('state');
        return;
      }
      if (readerStore.chapters[readerStore.chapters.length - 1]?.id === startedTailId) return;

      const bufferState = getUnreadBufferState(mainEl);
      recordBufferState(bufferState);
      if (bufferState === 'short') {
        graceUntil = Date.now() + SHORT_CHAPTER_PRELOAD_DELAY_MS;
      }
      scheduleAutoLoadNext('state');
      return;
    }

    autoLoadInFlight = false;
    failureCooldownUntil =
      Date.now() + getRandomDelayMs(FAILURE_COOLDOWN_MIN_MS, FAILURE_COOLDOWN_MAX_MS);
  }

  function startAutoLoad(): void {
    if (!mainRef.value) return;

    clearAutoLoadTimer();
    autoLoadInFlight = true;
    const startedSessionKey = sessionKey;
    const startedTailId = readerStore.chapters[readerStore.chapters.length - 1]?.id;
    recordDebugEvent('autoload.start', {
      currentIndex: readerStore.currentChapterIndex,
      currentUrl: readerStore.chapter?.url,
      nextUrl: readerStore.chapters[readerStore.chapters.length - 1]?.chapter.nextUrl,
    });
    void readerStore.loadNextChapter('auto').then(
      ok => finishLoad(ok, startedSessionKey, startedTailId),
      () => finishLoad(false, startedSessionKey, startedTailId)
    );
  }

  function scheduleAutoLoadNext(reason: AutoLoadReason = 'state'): void {
    const mainEl = mainRef.value;
    if (!mainEl || !ensureSession()) return;

    const currentTime = Date.now();
    const unreadBufferState = getUnreadBufferState(mainEl);
    recordBufferState(unreadBufferState);
    const decision = decideAutoLoadNext(reason, {
      autoLoadInFlight,
      enabled: configStore.behavior.preloadNext,
      failureCooldownUntil,
      graceUntil,
      hasChapter: readerStore.chapters.length > 0,
      hasNext: readerStore.hasNext,
      isLoadingNext: readerStore.isLoadingNext,
      isLoadingPrev: readerStore.isLoadingPrev,
      isNavigating: isNavigating.value,
      isNearBottom: isViewportNearBottom(
        mainEl.scrollHeight,
        mainEl.scrollTop,
        mainEl.clientHeight
      ),
      now: currentTime,
      pageHidden: isPageHidden(),
      unreadBufferState,
    });

    if (decision.type === 'schedule') {
      scheduleTimerAt(decision.dueAt);
    } else if (decision.type === 'start') {
      startAutoLoad();
    } else if (decision.clearTimer) {
      clearAutoLoadTimer();
    }
  }

  function observeBottomSentinel(sentinel: HTMLElement | null): void {
    const root = mainRef.value;
    if (!root || !sentinel) return;

    bottomObserver?.disconnect();
    bottomObserver = new globalThis.IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) scheduleAutoLoadNext('sentinel');
      },
      {
        root,
        rootMargin: `${INTERSECTION_ROOT_MARGIN_PX}px`,
        threshold: 0,
      }
    );
    bottomObserver.observe(sentinel);
  }

  watch(
    () => readerStore.chapters.map(entry => entry.id),
    activeIds => {
      pruneChapterScreenCache(activeIds);
      scheduleAutoLoadNext('state');
    },
    { flush: 'post' }
  );

  watch(
    () => readerStore.currentChapterIndex,
    () => {
      scheduleAutoLoadNext('state');
    }
  );

  watch(
    () => readerStore.hasNext,
    available => {
      if (!available) {
        clearAutoLoadTimer();
        return;
      }
      scheduleAutoLoadNext('state');
    }
  );

  watch(
    () => [readerStore.isLoadingNext, readerStore.isLoadingPrev, isNavigating.value],
    ([loadingNext, loadingPrev, navigating]) => {
      if (loadingNext || loadingPrev || navigating) return;
      scheduleAutoLoadNext('state');
    }
  );

  watch(
    () => configStore.behavior.preloadNext,
    enabled => {
      if (!enabled) {
        clearAutoLoadTimer();
        failureCooldownUntil = 0;
        return;
      }
      scheduleAutoLoadNext('state');
    }
  );

  watch(
    () => [
      configStore.reading?.fontFamily,
      configStore.reading?.fontSize,
      configStore.reading?.lineHeight,
      configStore.reading?.letterSpacing,
      configStore.reading?.paragraphIndent,
      configStore.reading?.maxWidth,
      configStore.reading?.padding,
      configStore.reading?.textConversion,
      configStore.customCSS,
      configStore.customCleanupRegex,
    ],
    () => {
      queueLayoutInvalidation();
    },
    { flush: 'post' }
  );

  function handleVisibilityChange(): void {
    if (!isPageHidden()) {
      scheduleAutoLoadNext('visibility');
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', queueLayoutInvalidation, { passive: true });
  }

  scheduleAutoLoadNext('state');

  onUnmounted(() => {
    clearAutoLoadTimer();
    bottomObserver?.disconnect();
    bottomObserver = null;
    if (layoutInvalidationFrame !== null) {
      globalThis.cancelAnimationFrame?.(layoutInvalidationFrame);
      layoutInvalidationFrame = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', queueLayoutInvalidation);
    }
    chapterScreenCache.clear();
  });

  return {
    scheduleAutoLoadNext,
    clearAutoLoadTimer,
    observeBottomSentinel,
  };
}
