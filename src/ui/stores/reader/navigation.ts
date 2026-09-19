/**
 * Reader Store - Chapter Navigation
 * Coordinates chapter loading, cache rebuilds, and reload actions.
 */

import type { CachedChapter, LoadSource } from './types';
import { clearNavFailure, recordNavFailure } from './navFailure';
import {
  clearPendingAbort,
  loadDocumentInIframe,
  loadFetchDocument,
  parseCandidateDocument,
} from './chapterFetch';
import { getParser, type ParsedChapter } from '@/core/parser';
import {
  insertCachedChapter,
  insertParsedChapter,
  rebuildChaptersFromCache,
} from './chapterListMutations';
import { MAX_NAV_FAILURES, MAX_SESSION_CACHE, VIP_BLOCK_TOAST } from './types';
import { normalizeUrl, normalizeUrlForBlock, normalizeUrlForFetch } from './utils';
import { prepareChapterLoad, validateTargetChapterUrl } from './chapterLoadGuards';
import { detectTocPage } from './detection';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getChapterDocumentBlockReason } from '@/core/detection';
import type { NavigationContext } from './navigationContext';
import { parseWithSectionMerge } from './section';
import { recordDebugEvent } from '@/core/debug/events';
import { shouldPersistNavigationBlock } from './navigationPolicy';
import { trimCachedContents } from './trim';

// ============ Factory ============

export function createNavigation(ctx: NavigationContext) {
  /** Unified chapter loading function */
  async function loadChapter(direction: 'next' | 'prev', source: LoadSource): Promise<boolean> {
    const runId = ctx.runtime.viewId();
    const load = prepareChapterLoad(ctx, direction, source);
    if (!load) return false;

    load.isLoadingRef.value = true;
    let outcome = 'loaded';
    try {
      // Prefer cached content if available (avoid refetching on race/abort failures).
      const cached = ctx.cachedContents.value.get(load.targetUrl);
      if (cached) {
        return await insertCachedChapter(ctx, cached, load.isNext ? 'append' : 'prepend');
      }
      if (ctx.persistedUrls.value.has(load.targetUrl)) {
        const persisted = await ctx.getPersistedCachedChapter(load.targetUrl);
        if (ctx.runtime.isViewStale(runId)) return false;
        if (persisted) {
          const sessionCached = { ...persisted, cachedAt: Date.now() };
          ctx.cachedContents.value.set(load.targetUrl, sessionCached);
          trimCachedContents(ctx.cachedContents.value, MAX_SESSION_CACHE);
          return await insertCachedChapter(ctx, sessionCached, load.isNext ? 'append' : 'prepend');
        }
      }

      // Cancel in-flight request
      if (load.pendingAbortRef.value) {
        load.pendingAbortRef.value();
        load.pendingAbortRef.value = null;
      }

      if (!validateTargetChapterUrl(ctx, load, source)) {
        outcome = 'invalid-url';
        return false;
      }

      const referer = load.refChapter.chapter.url;
      const parser = getParser();
      let cleanupIframe: (() => void) | null = null;

      const recordLoadFailure = () => {
        const count = recordNavFailure(ctx.navFailures, load.navKey, {
          maxFailures: MAX_NAV_FAILURES,
        });
        if (source === 'manual' || count === 1) {
          ctx.showToast(load.errorMessage, 'error', 2500);
        }
      };

      let parsed: ParsedChapter | null = null;

      if (load.refChapter.rule?.advanced?.useIframe) {
        const iframeLoader = loadDocumentInIframe(load.targetUrl);
        const abort = iframeLoader.abort;
        if (ctx.runtime.isViewStale(runId)) {
          abort();
          return false;
        }
        load.pendingAbortRef.value = abort;

        const iframeResult = await iframeLoader.promise;
        if (ctx.runtime.isViewStale(runId)) {
          iframeResult?.cleanup();
          abort();
          return false;
        }
        clearPendingAbort(load, abort);
        cleanupIframe = iframeResult?.cleanup || null;

        if (iframeResult?.doc) {
          let iframeParsed: ParsedChapter | 'abort' | 'blocked' | null = null;
          try {
            iframeParsed = await parseCandidateDocument(
              ctx,
              load,
              parser,
              iframeResult.doc,
              runId,
              referer,
              source
            );
          } finally {
            cleanupIframe?.();
            cleanupIframe = null;
          }
          if (iframeParsed === 'abort' || iframeParsed === 'blocked') {
            outcome = iframeParsed;
            return false;
          }
          parsed = iframeParsed;
        }
      }

      cleanupIframe?.();

      if (!parsed) {
        const fetchDoc = await loadFetchDocument(ctx, load, runId, referer);
        if (fetchDoc === 'abort') {
          outcome = 'abort';
          return false;
        }
        if (!fetchDoc) {
          outcome = 'fetch-failed';
          recordLoadFailure();
          return false;
        }

        const fetchParsed = await parseCandidateDocument(
          ctx,
          load,
          parser,
          fetchDoc,
          runId,
          referer,
          source
        );
        if (fetchParsed === 'abort' || fetchParsed === 'blocked') {
          outcome = fetchParsed;
          return false;
        }
        parsed = fetchParsed;
      }

      if (ctx.runtime.isViewStale(runId)) {
        return false;
      }
      if (!parsed) {
        outcome = 'parse-empty';
        recordLoadFailure();
        return false;
      }

      if (parsed.prevUrl) parsed.prevUrl = normalizeUrlForFetch(parsed.prevUrl);
      if (parsed.nextUrl) parsed.nextUrl = normalizeUrlForFetch(parsed.nextUrl);
      if (parsed.indexUrl) parsed.indexUrl = normalizeUrlForFetch(parsed.indexUrl);

      // Check if this is a TOC page
      const isTocPage = detectTocPage(parsed.content, load.targetUrl, load.refChapter.chapter.url);
      if (isTocPage) {
        outcome = 'toc';
        if (shouldPersistNavigationBlock(source)) {
          ctx.blockedNavUrls.value.add(load.navKey);
        }
        if (source === 'manual') {
          ctx.showToast(load.endMessage, 'info');
        }
        return false;
      }

      // Additional validation for prev: check if page has prev but no next
      if (!load.isNext) {
        if (
          parsed.nextUrl &&
          normalizeUrl(parsed.nextUrl) === normalizeUrl(load.refChapter.chapter.url)
        ) {
          // This is fine, it's actually the previous chapter
        } else if (parsed.prevUrl && !parsed.nextUrl) {
          outcome = 'invalid-prev';
          // Page has prev but no next - likely a TOC or non-chapter page
          if (shouldPersistNavigationBlock(source)) {
            ctx.blockedNavUrls.value.add(load.navKey);
          }
          return false;
        }
      }

      clearNavFailure(ctx.navFailures, load.navKey);
      return await insertParsedChapter(ctx, load, parsed);
    } catch (e) {
      outcome = 'exception';
      if (!ctx.runtime.isViewStale(runId)) {
        console.error(`[MNR] Failed to load ${direction} chapter:`, e);
        ctx.setError(load.errorMessage);
      }
      return false;
    } finally {
      recordDebugEvent('chapter.load', {
        url: load.targetUrl,
        direction,
        source,
        outcome: ctx.runtime.isViewStale(runId) ? 'stale' : outcome,
      });
      if (!ctx.runtime.isViewStale(runId)) {
        load.isLoadingRef.value = false;
      }
    }
  }

  /** Load next chapter and append to list */
  async function loadNextChapter(source: LoadSource = 'auto'): Promise<boolean> {
    return loadChapter('next', source);
  }

  /** Load previous chapter and prepend to list */
  async function loadPrevChapter(source: LoadSource = 'manual'): Promise<boolean> {
    return loadChapter('prev', source);
  }

  /**
   * Rebuild chapters array around a target URL (for jumping to cached chapter)
   */
  async function rebuildChaptersAround(targetUrl: string): Promise<boolean> {
    const runId = ctx.runtime.bumpView();
    const url = normalizeUrlForFetch(targetUrl);
    ctx.pendingNextAbort.value?.();
    ctx.pendingNextAbort.value = null;
    ctx.pendingPrevAbort.value?.();
    ctx.pendingPrevAbort.value = null;
    ctx.reloadAbort.value?.();
    ctx.reloadAbort.value = null;
    ctx.isLoading.value = false;
    ctx.isLoadingPrev.value = false;
    ctx.isLoadingNext.value = false;

    // Check cachedContents first
    let cached = ctx.cachedContents.value.get(url);
    if (!cached && ctx.persistedUrls.value.has(url)) {
      const persisted = await ctx.getPersistedCachedChapter(url);
      if (ctx.runtime.isViewStale(runId)) return false;
      if (persisted) {
        cached = { ...persisted, cachedAt: Date.now() };
        ctx.cachedContents.value.set(url, cached);
        trimCachedContents(ctx.cachedContents.value, MAX_SESSION_CACHE);
      }
    }
    if (!cached) return false;
    if (ctx.runtime.isViewStale(runId)) return false;

    return rebuildChaptersFromCache(ctx, cached, url);
  }

  /**
   * Reload current chapter - refetch and reparse with current rules
   */
  async function reloadCurrentChapter(): Promise<void> {
    const runId = ctx.runtime.viewId();
    const current = ctx.chapters.value[ctx.currentChapterIndex.value];
    if (!current) return;

    const url = current.chapter.url;

    ctx.showToast('正在重新加载...', 'info');

    ctx.reloadAbort.value?.();
    ctx.reloadAbort.value = null;
    const { promise, abort } = fetchAndParseUrl(url, url);
    if (!ctx.runtime.isViewStale(runId)) {
      ctx.reloadAbort.value = abort;
    }
    const result = await promise;
    if (ctx.runtime.isViewStale(runId)) {
      abort();
      return;
    }
    if (ctx.reloadAbort.value === abort) {
      ctx.reloadAbort.value = null;
    }
    if (result.error === 'abort') {
      return;
    }
    if (!result.doc) {
      ctx.showToast('重新加载失败', 'error');
      return;
    }

    const blockReason = getChapterDocumentBlockReason(result.doc);
    if (blockReason === 'cloudflare') {
      ctx.showToast('Cloudflare 验证页面，请完成验证后重试', 'info', 4000);
      return;
    }
    if (blockReason === 'vip') {
      ctx.vipBlockedUrls.value.add(normalizeUrlForBlock(url));
      ctx.showToast(VIP_BLOCK_TOAST, 'info', 3000);
      return;
    }

    const parser = getParser();
    const controller = new AbortController();
    const abortMerge = () => controller.abort();
    ctx.reloadAbort.value = abortMerge;
    let parsed: ParsedChapter | null;
    try {
      parsed = await parseWithSectionMerge(parser, result.doc, url, {
        signal: controller.signal,
      });
    } finally {
      if (ctx.reloadAbort.value === abortMerge) {
        ctx.reloadAbort.value = null;
      }
    }
    if (controller.signal.aborted) {
      return;
    }
    if (ctx.runtime.isViewStale(runId)) {
      return;
    }

    if (parsed) {
      if (parsed.prevUrl) parsed.prevUrl = normalizeUrlForFetch(parsed.prevUrl);
      if (parsed.nextUrl) parsed.nextUrl = normalizeUrlForFetch(parsed.nextUrl);
      if (parsed.indexUrl) parsed.indexUrl = normalizeUrlForFetch(parsed.indexUrl);

      current.chapter = parsed;
      current.rule = parsed.rule || current.rule;
      ctx.originalContents.value.set(current.id, parsed.content);
      ctx.originalTitles.value.set(current.id, {
        title: parsed.title,
        bookTitle: parsed.bookTitle,
      });

      ctx.cachedContents.value.set(parsed.url, {
        chapter: parsed,
        rule: current.rule,
        cachedAt: Date.now(),
      });

      if (ctx.currentConversionMode.value !== 'none') {
        await ctx.applyConversionToChapterEntry(current.id, ctx.currentConversionMode.value);
      }

      ctx.showToast('规则已应用', 'info');
    } else {
      ctx.showToast('解析失败', 'error');
    }
  }

  function insertCachedChapterForContext(
    cached: CachedChapter,
    position: 'append' | 'prepend'
  ): Promise<boolean> {
    return insertCachedChapter(ctx, cached, position);
  }

  return {
    insertCachedChapter: insertCachedChapterForContext,
    loadChapter,
    loadNextChapter,
    loadPrevChapter,
    rebuildChaptersAround,
    reloadCurrentChapter,
  };
}
