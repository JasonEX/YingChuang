/**
 * Reader Store - Manages reading state with infinite scroll support
 */

import { computed, ref } from 'vue';
import { hashText, htmlTextLength, redactUrl, tailStrings } from '@/core/debug/diagnostics';
import { type ConversionMode } from '@/core/converter';
import { defineStore } from 'pinia';
import type { ParsedChapter } from '@/core/parser';
import { recordDebugEvent } from '@/core/debug/events';
import type { SiteRule } from '@/core/rules/types';

// Import types from modular files
import type {
  CachedChapter,
  CacheProgressState,
  ChapterEntry,
  SectionMergeRecord,
  SectionProgressState,
  TocEntry,
  TocEntryWithStatus,
} from './reader/types';
import { VIP_BLOCK_TOAST } from './reader/types';

// Import utilities from modular files
import {
  applyConversionToChapterEntry as applyConversionImpl,
  applyTocConversion as applyTocConversionImpl,
} from './reader/conversion';
import {
  cleanupExpiredCaches,
  clearPersistedCache as clearPersistedCacheImpl,
  getCurrentBookCacheKey,
  getPersistedCachedChapter,
  persistCache as persistCacheImpl,
  restoreCache as restoreCacheImpl,
  touchPersistedCache,
} from './reader/persistence';
import { createTocActions, loadTocEntriesPaged } from './reader/toc';
import { normalizeUrlForBlock, normalizeUrlForFetch } from './reader/utils';
import { createCacheAll } from './reader/cacheAll';
import { createNavigation } from './reader/navigation';
import { createReaderRuntime } from './reader/runtime';
import { syncHostPageToChapter } from './reader/hostPage';

// Re-export reader types used by UI modules.
export type {
  CachedChapter,
  CacheProgressState,
  ChapterEntry,
  SectionProgressState,
  TocEntry,
  TocEntryWithStatus,
};

export const useReaderStore = defineStore('reader', () => {
  // State
  const isActive = ref(false);
  const isLoadingPrev = ref(false);
  const isLoadingNext = ref(false);
  const chapters = ref<ChapterEntry[]>([]);
  const currentChapterIndex = ref(0);
  const error = ref<string | null>(null);
  const toastType = ref<'info' | 'error'>('error');
  const toastTimer = ref<number | null>(null);
  const scrollPercent = ref(0);
  const history = ref<string[]>([]);
  const loadedUrls = computed(() => new Set(chapters.value.map(entry => entry.chapter.url)));
  const vipBlockedUrls = ref<Set<string>>(new Set());
  const blockedNavUrls = ref<Set<string>>(new Set());
  const originalContents = ref<Map<string, string>>(new Map());
  const originalTitles = ref<Map<string, { title: string; bookTitle?: string }>>(new Map());
  const currentConversionMode = ref<ConversionMode>('none');
  const pendingNextAbort = ref<(() => void) | null>(null);
  const pendingPrevAbort = ref<(() => void) | null>(null);
  const navFailures = new Map<string, { count: number; nextRetryAt: number }>();
  const cacheProgress = ref<CacheProgressState>({ done: 0, total: 0, failed: 0, running: false });
  const cacheQueue = ref<string[]>([]);
  const cacheFailedUrls = ref<string[]>([]);
  const cacheAbort = ref<(() => void) | null>(null);
  const reloadAbort = ref<(() => void) | null>(null);
  const toc = ref<TocEntry[]>([]);
  const tocOriginal = ref<TocEntry[]>([]);
  const tocLoading = ref(false);
  const tocAbort = ref<(() => void) | null>(null);
  const cachedContents = ref<Map<string, CachedChapter>>(new Map());
  const sectionMerges = ref<Map<string, SectionMergeRecord>>(new Map());
  const persistedUrls = ref<Set<string>>(new Set());
  const runtime = createReaderRuntime();

  // Getters
  const chapter = computed(() => chapters.value[currentChapterIndex.value]?.chapter || null);
  const rule = computed(() => chapters.value[currentChapterIndex.value]?.rule || null);
  const bookTitle = computed(() => chapter.value?.bookTitle || '');

  function isVipBlockedUrl(url: string): boolean {
    return vipBlockedUrls.value.has(normalizeUrlForBlock(url));
  }

  function getVipBlockedToast(direction: 'next' | 'prev'): string | null {
    const entry =
      direction === 'next' ? chapters.value[chapters.value.length - 1] : chapters.value[0];
    const navUrl = direction === 'next' ? entry?.chapter.nextUrl : entry?.chapter.prevUrl;
    if (!navUrl) return null;
    return isVipBlockedUrl(navUrl) ? VIP_BLOCK_TOAST : null;
  }

  /**
   * True while any displayed chapter is still appending section pages.
   *
   * A merging chapter withholds its next-chapter URL, so `hasNext` reads false long before
   * the book actually ends. Anything that claims "no more chapters" must consult this too.
   */
  const isSectionMerging = computed(() => chapters.value.some(entry => !!entry.sectionProgress));

  const hasNext = computed(() => {
    const lastChapter = chapters.value[chapters.value.length - 1];
    const nextUrl = lastChapter?.chapter.nextUrl;
    if (!nextUrl) return false;
    if (blockedNavUrls.value.has(normalizeUrlForBlock(nextUrl))) return false;
    return !isVipBlockedUrl(nextUrl);
  });
  const hasPrev = computed(() => {
    const firstChapter = chapters.value[0];
    const prevUrl = firstChapter?.chapter.prevUrl;
    if (!prevUrl) return false;
    if (blockedNavUrls.value.has(normalizeUrlForBlock(prevUrl))) return false;
    return !isVipBlockedUrl(prevUrl);
  });
  // TOC with cache status (incremental: normalize URLs once, pre-compute status map)
  const normalizedTocUrls = computed(() => toc.value.map(entry => normalizeUrlForFetch(entry.url)));

  const tocStatusMap = computed(() => {
    const currentUrl = chapter.value?.url;
    const map = new Map<string, { isCached: boolean; isPersisted: boolean; isCurrent: boolean }>();
    for (const url of normalizedTocUrls.value) {
      map.set(url, {
        isCached:
          loadedUrls.value.has(url) ||
          cachedContents.value.has(url) ||
          persistedUrls.value.has(url),
        isPersisted: persistedUrls.value.has(url),
        isCurrent: url === currentUrl,
      });
    }
    return map;
  });

  const tocWithStatus = computed<TocEntryWithStatus[]>(() => {
    const urls = normalizedTocUrls.value;
    const statusMap = tocStatusMap.value;
    return toc.value.map((entry, i) => {
      const url = urls[i];
      const status = statusMap.get(url) || {
        isCached: false,
        isPersisted: false,
        isCurrent: false,
      };
      return { ...entry, url, ...status };
    });
  });

  function syncCurrentHostPage(): void {
    syncHostPageToChapter(chapter.value, currentChapterIndex.value);
  }

  function setError(msg: string) {
    showToast(msg, 'error', 3000);
  }

  function showToast(msg: string, type: 'info' | 'error' = 'info', duration = 2000) {
    recordDebugEvent('reader.toast', { message: msg, type, duration }, type);
    error.value = msg;
    toastType.value = type;
    if (toastTimer.value) {
      window.clearTimeout(toastTimer.value);
    }
    toastTimer.value = window.setTimeout(() => {
      error.value = null;
      toastTimer.value = null;
    }, duration);
  }

  function clearError() {
    error.value = null;
    if (toastTimer.value) {
      window.clearTimeout(toastTimer.value);
      toastTimer.value = null;
    }
  }

  let conversionId = 0;
  let tocConversionId = 0;

  async function applyConversionToChapterEntry(
    entryId: string,
    mode: ConversionMode
  ): Promise<void> {
    const requestId = conversionId;
    const viewId = runtime.viewId();
    await applyConversionImpl(
      chapters.value,
      originalContents.value,
      originalTitles.value,
      entryId,
      mode,
      () =>
        requestId === conversionId &&
        mode === currentConversionMode.value &&
        !runtime.isViewStale(viewId)
    );
  }

  async function applyTocConversion(mode: ConversionMode): Promise<void> {
    const requestId = ++tocConversionId;
    const sessionId = runtime.sessionId();
    const source = tocOriginal.value;
    const converted = await applyTocConversionImpl(source, mode, chapter.value?.sourceScript);
    if (
      requestId === tocConversionId &&
      !runtime.isSessionStale(sessionId) &&
      source === tocOriginal.value &&
      mode === currentConversionMode.value
    ) {
      toc.value = converted;
    }
  }

  async function applyTextConversion(mode: ConversionMode): Promise<void> {
    const requestId = ++conversionId;
    const sessionId = runtime.sessionId();
    const isCurrent = () => requestId === conversionId && !runtime.isSessionStale(sessionId);
    currentConversionMode.value = mode;
    for (const entry of chapters.value) {
      await applyConversionToChapterEntry(entry.id, mode);
      if (!isCurrent()) return;
    }
    await applyTocConversion(mode);
    if (!isCurrent()) return;
    syncCurrentHostPage();
  }

  function getPersistedCachedChapterForCurrentBook(url: string): CachedChapter | null {
    const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
    if (!cacheBook) return null;
    return getPersistedCachedChapter(cacheBook, url);
  }

  function persistCache(skipChapterUrls?: ReadonlySet<string>): void {
    const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
    if (!cacheBook) return;
    persistedUrls.value = persistCacheImpl(
      cacheBook,
      cachedContents.value,
      persistedUrls.value,
      skipChapterUrls
    );
  }

  function restoreCache(): void {
    const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
    if (!cacheBook) return;
    const restored = restoreCacheImpl(cacheBook);
    if (restored) {
      persistedUrls.value = restored;
      touchPersistedCache(cacheBook);
    }
    cleanupExpiredCaches({ currentBookId: cacheBook.bookId });
  }

  function clearPersistedCache(): void {
    const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
    if (!cacheBook) return;
    clearPersistedCacheImpl(cacheBook, persistedUrls.value);
    persistedUrls.value.clear();
  }

  // Initialize extracted modules
  const nav = createNavigation({
    chapters,
    currentChapterIndex,
    isLoadingNext,
    isLoadingPrev,
    pendingNextAbort,
    pendingPrevAbort,
    reloadAbort,
    loadedUrls,
    vipBlockedUrls,
    blockedNavUrls,
    cachedContents,
    sectionMerges,
    persistedUrls,
    originalContents,
    originalTitles,
    currentConversionMode,
    navFailures,
    history,
    runtime,
    showToast,
    setError,
    applyConversionToChapterEntry,
    getPersistedCachedChapter: getPersistedCachedChapterForCurrentBook,
  });

  const tocActions = createTocActions({
    toc,
    tocOriginal,
    tocLoading,
    tocAbort,
    chapters,
    chapter,
    rule,
    currentConversionMode,
    runtime,
    showToast,
    applyTocConversion,
    loadTocEntriesPaged,
  });

  const { startCacheAll, cancelCacheAll, retryFailedCache } = createCacheAll({
    cacheProgress,
    cacheQueue,
    cacheFailedUrls,
    cacheAbort,
    cachedContents,
    persistedUrls,
    tocOriginal,
    chapter,
    rule,
    chapters,
    runtime,
    loadToc: tocActions.loadToc,
    restoreCache,
    persistCache,
    showToast,
  });

  // ---- Core actions ----
  /** Cancel all in-flight requests and reset loading states */
  function cancelAllInFlight() {
    pendingNextAbort.value?.();
    pendingNextAbort.value = null;
    pendingPrevAbort.value?.();
    pendingPrevAbort.value = null;
    cacheAbort.value?.();
    cacheAbort.value = null;
    reloadAbort.value?.();
    reloadAbort.value = null;
    tocAbort.value?.();
    tocAbort.value = null;
    nav.cancelAllSectionMerges();

    isLoadingPrev.value = false;
    isLoadingNext.value = false;
    tocLoading.value = false;
    cacheProgress.value = { done: 0, total: 0, failed: 0, running: false };
    cacheQueue.value = [];
    cacheFailedUrls.value = [];
  }

  /** Clear all navigation/cache/toc data */
  function clearAllData() {
    sectionMerges.value.clear();
    chapters.value = [];
    currentChapterIndex.value = 0;
    clearError();
    vipBlockedUrls.value.clear();
    blockedNavUrls.value.clear();
    navFailures.clear();
    originalContents.value.clear();
    originalTitles.value.clear();
    cachedContents.value.clear();
    persistedUrls.value.clear();
    toc.value = [];
    tocOriginal.value = [];
  }

  function activate() {
    recordDebugEvent('reader.activate');
    isActive.value = true;
    clearError();
  }

  function deactivate() {
    recordDebugEvent('reader.deactivate');
    runtime.bumpSession();
    isActive.value = false;
    cancelAllInFlight();
    clearAllData();
  }

  /** Start a reader session on a chapter and return the display entry holding it. */
  function setChapter(newChapter: ParsedChapter, newRule?: SiteRule): string {
    recordDebugEvent('reader.setChapter', {
      url: newChapter.url,
      title: newChapter.title,
      ruleId: newRule?.id || newChapter.rule?.id,
    });
    runtime.bumpSession();
    cancelAllInFlight();
    clearAllData();
    const effectiveRule = newRule || newChapter.rule;

    // Canonicalize URLs (strip hashes etc.) to stabilize caching and navigation.
    if (newChapter.url) newChapter.url = normalizeUrlForFetch(newChapter.url);
    if (newChapter.prevUrl) newChapter.prevUrl = normalizeUrlForFetch(newChapter.prevUrl);
    if (newChapter.nextUrl) newChapter.nextUrl = normalizeUrlForFetch(newChapter.nextUrl);
    if (newChapter.indexUrl) newChapter.indexUrl = normalizeUrlForFetch(newChapter.indexUrl);

    const id = `chapter-${Date.now()}-0`;
    chapters.value = [{ chapter: newChapter, rule: effectiveRule, id }];

    // Store original content for text conversion
    originalContents.value.set(id, newChapter.content);
    originalTitles.value.set(id, { title: newChapter.title, bookTitle: newChapter.bookTitle });

    // Also store in cachedContents for quick jump
    cachedContents.value.set(newChapter.url, {
      chapter: newChapter,
      rule: effectiveRule,
      cachedAt: Date.now(),
    });

    // Add to history
    if (newChapter.url && !history.value.includes(newChapter.url)) {
      history.value.push(newChapter.url);
      if (history.value.length > 100) {
        history.value = history.value.slice(-100);
      }
    }

    if (currentConversionMode.value !== 'none') {
      void applyConversionToChapterEntry(id, currentConversionMode.value).then(() => {
        syncCurrentHostPage();
      });
    }

    syncCurrentHostPage();

    // Restore the persisted chapter index for this book.
    restoreCache();

    return id;
  }

  function updateScroll(percent: number) {
    scrollPercent.value = Math.max(0, Math.min(100, percent));
  }

  /** Update current chapter index and host page state */
  function setCurrentChapter(index: number) {
    if (index < 0 || index >= chapters.value.length) return;
    if (currentChapterIndex.value === index) return;

    recordDebugEvent('reader.setCurrentChapter', {
      from: currentChapterIndex.value,
      to: index,
      url: chapters.value[index]?.chapter.url,
    });
    currentChapterIndex.value = index;
    syncCurrentHostPage();
  }

  async function loadNextChapter(source: 'auto' | 'manual' = 'auto'): Promise<boolean> {
    recordDebugEvent('reader.loadNext.start', {
      source,
      currentIndex: currentChapterIndex.value,
      currentUrl: chapter.value?.url,
      targetUrl: chapters.value[chapters.value.length - 1]?.chapter.nextUrl,
    });
    const ok = await nav.loadNextChapter(source);
    recordDebugEvent('reader.loadNext.end', {
      source,
      ok,
      chapterCount: chapters.value.length,
      currentIndex: currentChapterIndex.value,
    });
    return ok;
  }

  async function loadPrevChapter(source: 'auto' | 'manual' = 'manual'): Promise<boolean> {
    recordDebugEvent('reader.loadPrev.start', {
      source,
      currentIndex: currentChapterIndex.value,
      currentUrl: chapter.value?.url,
      targetUrl: chapters.value[0]?.chapter.prevUrl,
    });
    const ok = await nav.loadPrevChapter(source);
    recordDebugEvent('reader.loadPrev.end', {
      source,
      ok,
      chapterCount: chapters.value.length,
      currentIndex: currentChapterIndex.value,
    });
    return ok;
  }

  async function rebuildChaptersAround(targetUrl: string): Promise<boolean> {
    recordDebugEvent('reader.rebuildAround.start', { targetUrl });
    const ok = await nav.rebuildChaptersAround(targetUrl);
    if (ok) syncCurrentHostPage();
    recordDebugEvent('reader.rebuildAround.end', { targetUrl, ok });
    return ok;
  }

  async function reloadCurrentChapter(): Promise<void> {
    await nav.reloadCurrentChapter();
    syncCurrentHostPage();
  }

  function getDebugSnapshot() {
    const currentEntry = chapters.value[currentChapterIndex.value] || null;
    const firstEntry = chapters.value[0] || null;
    const lastEntry = chapters.value[chapters.value.length - 1] || null;
    const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);

    return {
      active: isActive.value,
      loading: {
        prev: isLoadingPrev.value,
        next: isLoadingNext.value,
        toc: tocLoading.value,
        pendingNext: Boolean(pendingNextAbort.value),
        pendingPrev: Boolean(pendingPrevAbort.value),
        pendingCache: Boolean(cacheAbort.value),
        pendingReload: Boolean(reloadAbort.value),
        pendingToc: Boolean(tocAbort.value),
      },
      toast: {
        message: error.value,
        type: toastType.value,
      },
      view: {
        currentChapterIndex: currentChapterIndex.value,
        chapterCount: chapters.value.length,
        scrollPercent: scrollPercent.value,
        hasNext: hasNext.value,
        hasPrev: hasPrev.value,
        hasIndex: Boolean(chapter.value?.indexUrl),
        confidence: chapter.value?.confidence || 0,
        method: chapter.value?.method || 'detection',
        conversionMode: currentConversionMode.value,
        runtimeSessionId: runtime.sessionId(),
        runtimeViewId: runtime.viewId(),
      },
      current: summarizeChapterForDebug(currentEntry),
      first: summarizeChapterForDebug(firstEntry),
      last: summarizeChapterForDebug(lastEntry),
      navigation: {
        history: {
          count: history.value.length,
          tail: tailStrings(history.value),
        },
        loadedUrls: summarizeUrlSet(loadedUrls.value),
        vipBlockedUrls: summarizeUrlSet(vipBlockedUrls.value),
        blockedNavUrls: summarizeUrlSet(blockedNavUrls.value),
        navFailures: {
          count: navFailures.size,
          tail: Array.from(navFailures.entries())
            .slice(-8)
            .map(([url, failure]) => ({
              url: redactUrl(url),
              count: failure.count,
              retryInMs: Math.max(0, failure.nextRetryAt - Date.now()),
            })),
        },
      },
      cache: {
        currentBook: cacheBook
          ? {
              bookId: cacheBook.bookId,
              indexUrl: redactUrl(cacheBook.indexUrl),
            }
          : null,
        progress: { ...cacheProgress.value },
        queue: {
          count: cacheQueue.value.length,
          tail: tailStrings(cacheQueue.value),
        },
        memory: {
          count: cachedContents.value.size,
          tail: Array.from(cachedContents.value.entries())
            .slice(-8)
            .map(([url, cached]) => ({
              url: redactUrl(url),
              title: cached.chapter.title,
              contentChars: cached.chapter.content.length,
              textChars: htmlTextLength(cached.chapter.content),
              cachedAt: cached.cachedAt,
            })),
        },
        persistedUrls: summarizeUrlSet(persistedUrls.value),
      },
      toc: {
        loading: tocLoading.value,
        count: toc.value.length,
        originalCount: tocOriginal.value.length,
        currentMatched: tocWithStatus.value.some(entry => entry.isCurrent),
        cachedCount: tocWithStatus.value.filter(entry => entry.isCached).length,
        persistedCount: tocWithStatus.value.filter(entry => entry.isPersisted).length,
      },
      originals: {
        contentCount: originalContents.value.size,
        titleCount: originalTitles.value.size,
      },
    };
  }

  function summarizeChapterForDebug(entry: ChapterEntry | null) {
    if (!entry) return null;
    const chapterData = entry.chapter;
    return {
      id: entry.id,
      url: redactUrl(chapterData.url),
      title: chapterData.title,
      bookTitle: chapterData.bookTitle || null,
      prevUrl: redactUrl(chapterData.prevUrl),
      nextUrl: redactUrl(chapterData.nextUrl),
      indexUrl: redactUrl(chapterData.indexUrl),
      confidence: chapterData.confidence,
      method: chapterData.method,
      ruleId: entry.rule?.id || chapterData.rule?.id || null,
      contentChars: chapterData.content.length,
      textChars: htmlTextLength(chapterData.content),
      rawContentChars: chapterData.rawContent.length,
      contentHash: hashText(chapterData.content),
    };
  }

  function summarizeUrlSet(values: Set<string>) {
    return {
      count: values.size,
      tail: tailStrings(values),
    };
  }

  function $reset() {
    runtime.bumpSession();
    isActive.value = false;
    cancelAllInFlight();
    clearAllData();
    scrollPercent.value = 0;
    currentConversionMode.value = 'none';
  }

  return {
    isActive,
    isLoadingPrev,
    isLoadingNext,
    chapters,
    currentChapterIndex,
    currentConversionMode,
    chapter,
    rule,
    error,
    toastType,
    scrollPercent,
    history,
    cacheProgress,
    toc,
    tocLoading,
    cachedContents,
    persistedUrls,
    bookTitle,
    hasNext,
    hasPrev,
    isSectionMerging,
    tocWithStatus,
    activate,
    deactivate,
    setChapter,
    setCurrentChapter,
    loadNextChapter,
    loadPrevChapter,
    setError,
    showToast,
    getVipBlockedToast,
    clearError,
    updateScroll,
    getDebugSnapshot,
    applyTextConversion,
    startCacheAll,
    cancelCacheAll,
    retryFailedCache,
    loadToc: tocActions.loadToc,
    appendChapterSection: nav.appendChapterSection,
    beginChapterSections: nav.beginChapterSections,
    cancelChapterSections: nav.cancelChapterSections,
    completeChapterSections: nav.completeChapterSections,
    rebuildChaptersAround,
    reloadCurrentChapter,
    persistCache,
    restoreCache,
    clearPersistedCache,
    $reset,
  };
});
