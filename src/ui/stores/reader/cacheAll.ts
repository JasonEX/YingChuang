/**
 * Reader Store - Batch Cache All
 * Handles caching all chapters from TOC sequentially with persistence.
 */

import type { CachedChapter, CacheProgressState, TocEntry } from './types';
import type { ComputedRef, Ref } from 'vue';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getChapterDocumentBlockReason } from '@/core/detection';
import { getParser } from '@/core/parser';
import type { ParsedChapter } from '@/core/parser';
import type { SiteRule } from '@/core/rules/types';

import {
  deletePersistedCacheIndex,
  getCurrentBookCacheKey,
  persistCachedChapter,
  persistCacheIndex,
  PERSISTED_CACHE_INDEX_CHECKPOINT_CHAPTERS,
} from './persistence';
import { loadDocumentInIframe, loadRuleApiDocument } from './chapterFetch';
import { normalizeUrlForBlock, normalizeUrlForFetch } from './utils';

import { detectTocPage } from './detection';
import { MAX_SESSION_CACHE } from './types';
import { parseWithSectionMerge } from './section';
import { recordDebugEvent } from '@/core/debug/events';
import { trimCachedContents } from './trim';

// ============ Context Interface ============

export interface CacheAllContext {
  // State refs
  cacheProgress: Ref<CacheProgressState>;
  cacheQueue: Ref<string[]>;
  cacheFailedUrls: Ref<string[]>;
  cacheAbort: Ref<(() => void) | null>;
  cachedContents: Ref<Map<string, CachedChapter>>;
  persistedUrls: Ref<Set<string>>;
  /** Unconverted TOC of the current book, filled by loadToc(). */
  tocOriginal: Ref<TocEntry[]>;

  // Computed
  chapter: ComputedRef<ParsedChapter | null>;
  rule: ComputedRef<SiteRule | null>;
  chapters: Ref<Array<{ chapter: ParsedChapter }>>;

  // Session management
  runtime: {
    isSessionStale: (runId: number) => boolean;
    sessionId: () => number;
  };

  // Callbacks
  /** The reader's single TOC loader; it reports missing or empty TOCs itself. */
  loadToc: () => Promise<void>;
  restoreCache: () => Promise<void>;
  persistCache: (skipChapterUrls?: ReadonlySet<string>) => Promise<void>;
  showToast: (message: string, type?: 'info' | 'error', duration?: number) => void;
}

// ============ Factory ============

export function createCacheAll(ctx: CacheAllContext) {
  let taskId = 0;
  /**
   * Batch cache chapters (best-effort, sequential)
   * Persists chapters to storage (best-effort); in-memory cache is LRU-capped.
   */
  async function startCacheAll(urls?: string[]): Promise<void> {
    const runId = ctx.runtime.sessionId();
    if (ctx.cacheProgress.value.running) return;

    const fullBook = urls === undefined;
    const currentTask = ++taskId;
    const isCurrent = () => currentTask === taskId && !ctx.runtime.isSessionStale(runId);
    ctx.cacheProgress.value = { done: 0, total: 0, failed: 0, running: true };
    try {
      const seenUrls = new Set<string>();
      const knownLockedUrls = new Set<string>();
      ctx.cacheFailedUrls.value = [];

      if (fullBook) {
        await ctx.loadToc();
        if (!isCurrent()) return;
        // loadToc already reported a missing or empty TOC.
        if (ctx.tocOriginal.value.length === 0) return;
      }

      // Ensure we have the latest persistedUrls before building the task list.
      await ctx.restoreCache();
      if (!isCurrent()) return;
      const persistedSet = new Set(ctx.persistedUrls.value);
      const cacheBook = getCurrentBookCacheKey(ctx.chapter.value?.indexUrl);
      const indexUrlKey = cacheBook ? normalizeUrlForBlock(cacheBook.indexUrl) : null;
      const isIndexUrl = (url: string) =>
        indexUrlKey !== null && normalizeUrlForBlock(url) === indexUrlKey;

      let cacheableChapterCount = 0;
      let taskList = urls ? urls.map(normalizeUrlForFetch).filter(url => !isIndexUrl(url)) : []; // No limit
      ctx.cacheQueue.value = [...taskList];

      // 目录列表：由阅读器统一加载的目录决定缓存全本的任务
      if (fullBook) {
        const tocEntries = ctx.tocOriginal.value;
        const tocLinks = new Set<string>();
        let removedPersistedLocked = false;
        for (const entry of tocEntries.slice(0, 10000)) {
          const url = normalizeUrlForFetch(entry.url);
          if (entry.access === 'locked') {
            knownLockedUrls.add(url);
            ctx.cachedContents.value.delete(url);
            removedPersistedLocked = persistedSet.delete(url) || removedPersistedLocked;
          } else {
            if (!isIndexUrl(url)) tocLinks.add(url);
          }
        }
        if (removedPersistedLocked && cacheBook) {
          ctx.persistedUrls.value = new Set(persistedSet);
          if (persistedSet.size > 0) {
            persistCacheIndex(cacheBook, persistedSet);
          } else {
            deletePersistedCacheIndex(cacheBook);
          }
        }
        cacheableChapterCount = tocLinks.size;
        // In-memory chapters need only the final storage flush; persisted chapters need no work.
        taskList = Array.from(tocLinks).filter(
          url => !ctx.cachedContents.value.has(url) && !persistedSet.has(url)
        );
        ctx.cacheQueue.value = [...taskList];
      }

      // Total is actual list length
      const estimatedTotal = taskList.length;
      if (!isCurrent()) return;
      if (estimatedTotal === 0) {
        if (fullBook) {
          if (cacheableChapterCount === 0) {
            ctx.showToast('目录中没有可缓存的章节', 'info');
            return;
          }
          await ctx.persistCache();
          if (!isCurrent()) return;
          ctx.showToast('本书章节已全部缓存', 'info');
        }
        return;
      }
      ctx.cacheProgress.value = { done: 0, total: estimatedTotal, failed: 0, running: true };

      let nextUrl: string | undefined | null = taskList.shift();
      let referer =
        ctx.chapters.value[ctx.chapters.value.length - 1]?.chapter.url || ctx.chapter.value?.url;
      let persistedSinceIndexWrite = 0;
      let hasWrittenIndexCheckpoint = false;
      // Only this run's writes are current; older persisted copies may predate a re-parse.
      const writtenUrls = new Set<string>();

      while (isCurrent() && ctx.cacheProgress.value.running && nextUrl) {
        const targetUrl = normalizeUrlForFetch(nextUrl);

        // 去重 - only stored content can satisfy an offline-cache task.
        if (
          seenUrls.has(targetUrl) ||
          ctx.cachedContents.value.has(targetUrl) ||
          persistedSet.has(targetUrl)
        ) {
          ctx.cacheProgress.value = {
            ...ctx.cacheProgress.value,
            done: ctx.cacheProgress.value.done + 1,
          };
          nextUrl = taskList.shift() ?? null;
          continue;
        }

        let cleanupIframe: (() => void) | undefined;
        try {
          const parseDocument = async (doc: Document): Promise<ParsedChapter | null> => {
            const controller = new AbortController();
            const abortMerge = () => {
              controller.abort();
              cleanupIframe?.();
            };
            ctx.cacheAbort.value = abortMerge;
            try {
              const parsed = await parseWithSectionMerge(getParser(), doc, targetUrl, {
                signal: controller.signal,
              });
              return controller.signal.aborted || !isCurrent() ? null : parsed;
            } finally {
              if (ctx.cacheAbort.value === abortMerge) ctx.cacheAbort.value = null;
            }
          };
          let parsed: ParsedChapter | null = null;
          let blockReason: ReturnType<typeof getChapterDocumentBlockReason> = null;
          const reference = ctx.chapter.value;
          const rule = ctx.rule.value ?? reference?.rule;
          if (rule?.advanced?.useIframe) {
            const loader = loadDocumentInIframe(targetUrl);
            ctx.cacheAbort.value = loader.abort;
            const loaded = await loader.promise;
            cleanupIframe = loaded?.cleanup;
            if (!isCurrent()) break;
            ctx.cacheAbort.value = null;
            if (loaded) {
              blockReason = getChapterDocumentBlockReason(loaded.doc);
              if (!blockReason) parsed = await parseDocument(loaded.doc);
            }
            cleanupIframe?.();
            cleanupIframe = undefined;
            if (!isCurrent()) break;
          }
          if (!parsed && !blockReason) {
            const apiDoc = reference
              ? await loadRuleApiDocument(targetUrl, { chapter: reference, rule })
              : null;
            if (!isCurrent()) break;
            let doc = apiDoc;
            if (!doc) {
              const { promise, abort } = fetchAndParseUrl(targetUrl, referer);
              ctx.cacheAbort.value = abort;
              const result = await promise;
              if (!isCurrent()) break;
              ctx.cacheAbort.value = null;
              if (result.error === 'abort') break;
              doc = result.doc;
              if (!doc)
                recordDebugEvent('cache.chapter.failed', {
                  url: targetUrl,
                  reason: result.error,
                  status: result.status,
                });
            }
            if (doc) {
              blockReason = getChapterDocumentBlockReason(doc);
              if (!blockReason) parsed = await parseDocument(doc);
            }
          }
          if (!isCurrent()) break;
          const isToc =
            parsed && detectTocPage(parsed.content, parsed.url, reference?.url || targetUrl);
          if (blockReason || !parsed || isToc) {
            recordDebugEvent('cache.chapter.rejected', {
              url: targetUrl,
              reason: blockReason || (isToc ? 'toc' : 'parse-empty'),
            });
            if (blockReason !== 'vip') ctx.cacheFailedUrls.value.push(targetUrl);
            ctx.cacheProgress.value = {
              ...ctx.cacheProgress.value,
              done: ctx.cacheProgress.value.done + 1,
              failed: ctx.cacheProgress.value.failed + (blockReason === 'vip' ? 0 : 1),
            };
            nextUrl = taskList.shift() ?? null;
            continue;
          }

          // Store in cachedContents (not chapters - for memory efficiency)
          const cached: CachedChapter = {
            chapter: parsed,
            rule: parsed.rule,
            cachedAt: Date.now(),
          };
          ctx.cachedContents.value.set(parsed.url, cached);
          seenUrls.add(parsed.url);

          // Trim session cache (LRU) to avoid unbounded memory usage during cache-all.
          trimCachedContents(ctx.cachedContents.value, MAX_SESSION_CACHE);

          // Persist chapter (best-effort) while caching to avoid holding everything in memory.
          if (cacheBook) {
            const persisted = persistCachedChapter(cacheBook, parsed.url, cached);
            if (persisted) {
              persistedSet.add(parsed.url);
              writtenUrls.add(parsed.url);
              persistedSinceIndexWrite += 1;
              if (
                !hasWrittenIndexCheckpoint ||
                persistedSinceIndexWrite >= PERSISTED_CACHE_INDEX_CHECKPOINT_CHAPTERS
              ) {
                if (persistCacheIndex(cacheBook, persistedSet)) {
                  persistedSinceIndexWrite = 0;
                  hasWrittenIndexCheckpoint = true;
                }
              }
            }
          }

          // Mark as loaded for deduplication
          ctx.cacheProgress.value = {
            ...ctx.cacheProgress.value,
            done: ctx.cacheProgress.value.done + 1,
          };

          // 下一章 URL 优先：显式队列 > 检测器返回 nextUrl（分页合并后 nextUrl 已指向下一章）
          referer = parsed.url;
          nextUrl =
            taskList.shift() ?? (parsed.nextUrl ? normalizeUrlForFetch(parsed.nextUrl) : null);
          if (
            nextUrl &&
            (isIndexUrl(nextUrl) || knownLockedUrls.has(normalizeUrlForFetch(nextUrl)))
          ) {
            nextUrl = null;
          }

          // If following nextUrl chain, update total estimate
          if (taskList.length === 0 && nextUrl) {
            const normalizedNext = normalizeUrlForFetch(nextUrl);
            if (
              !seenUrls.has(normalizedNext) &&
              !ctx.cachedContents.value.has(normalizedNext) &&
              !persistedSet.has(normalizedNext)
            ) {
              ctx.cacheProgress.value = {
                ...ctx.cacheProgress.value,
                total: ctx.cacheProgress.value.done + 1,
              };
            }
          }
        } finally {
          cleanupIframe?.();
        }
      }

      if (!isCurrent() || !ctx.cacheProgress.value.running) return;

      // Persist cache after completion
      if (cacheBook && persistedSet.size > 0) {
        ctx.persistedUrls.value = persistedSet;
      }
      await ctx.persistCache(writtenUrls);
      if (!isCurrent()) return;

      if (ctx.cacheProgress.value.failed > 0) {
        ctx.showToast(`缓存完成，${ctx.cacheProgress.value.failed} 章失败`, 'error', 3500);
      } else {
        ctx.showToast('离线缓存完成', 'info', 2500);
      }
    } catch (error) {
      if (isCurrent()) {
        console.error('[MNR] Cache task failed:', error);
        recordDebugEvent('cache.failed', { reason: 'exception', error: String(error) }, 'error');
        ctx.showToast('离线缓存失败，可重试', 'error', 3500);
      }
    } finally {
      if (isCurrent()) {
        ctx.cacheAbort.value?.();
        ctx.cacheAbort.value = null;
        ctx.cacheProgress.value = { ...ctx.cacheProgress.value, running: false };
      }
    }
  }

  function cancelCacheAll(): void {
    taskId += 1;
    ctx.cacheProgress.value = { done: 0, total: 0, failed: 0, running: false };
    ctx.cacheQueue.value = [];
    ctx.cacheFailedUrls.value = [];
    ctx.cacheAbort.value?.();
    ctx.cacheAbort.value = null;
  }

  function retryFailedCache(): Promise<void> {
    const urls = [...ctx.cacheFailedUrls.value];
    if (urls.length === 0) return Promise.resolve();
    return startCacheAll(urls);
  }

  return { startCacheAll, cancelCacheAll, retryFailedCache };
}
