/**
 * Reader Store TOC Utilities
 * Table of Contents paged loading and stateful TOC actions.
 */

import type { ChapterEntry, TocEntry } from './types';
import {
  collectTocCandidates,
  dedupeTocEntries,
  filterTocEntries,
  findNextTocPageUrl,
} from './tocEntries';
import type { ComputedRef, Ref } from 'vue';
import { normalizeUrlForBlock, normalizeUrlForCompare, normalizeUrlForFetch } from './utils';
import { type SpecialTocLoaderContext, specialTocLoaders } from './tocProviders';
import type { ConversionMode } from '@/core/converter';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getParser } from '@/core/parser';
import type { ParsedChapter } from '@/core/parser';
import type { SiteRule } from '@/core/rules/types';

// ============ Constants ============

/** Maximum number of TOC pages to fetch */
const MAX_TOC_PAGES = 120;

/**
 * Load TOC entries from paged TOC
 */
export async function loadTocEntriesPaged(
  indexUrl: string,
  currentUrl: string,
  rule: SiteRule | undefined,
  setAbort: (abort: (() => void) | null) => void
): Promise<TocEntry[]> {
  const loaderContext: SpecialTocLoaderContext = {
    indexUrl,
    currentUrl,
    rule,
    setAbort,
  };

  const loader = specialTocLoaders.find(item => item.matches(loaderContext));
  if (loader) {
    return loader.load(loaderContext);
  }

  const visitedPages = new Set<string>();
  const seenChapterUrls = new Set<string>();
  const allCandidates: TocEntry[] = [];

  const aborters: Array<() => void> = [];
  let aborted = false;
  const abortAll = () => {
    aborted = true;
    for (const fn of aborters) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  };
  setAbort(abortAll);

  try {
    let pageUrl: string | null = indexUrl;
    let referer: string | undefined = currentUrl || indexUrl;

    while (pageUrl && visitedPages.size < MAX_TOC_PAGES) {
      const pageKey = normalizeUrlForCompare(pageUrl);
      if (visitedPages.has(pageKey)) break;
      visitedPages.add(pageKey);

      const { promise, abort } = fetchAndParseUrl(pageUrl, referer);
      aborters.push(abort);

      const result = await promise;
      // Failed/cancelled requests must not publish earlier pages as a full catalog.
      if (aborted || result.error === 'abort') return [];
      if (!result.doc || result.error) {
        if (allCandidates.length === 0) return [];
        throw new Error(`TOC page request failed: ${pageUrl} (${result.error})`);
      }

      const effectivePageUrl = result.finalUrl || pageUrl;
      const pageCandidates = collectTocCandidates(result.doc, effectivePageUrl, rule);
      if (pageCandidates.length === 0 && (rule?.toc?.selector || allCandidates.length > 0)) {
        if (allCandidates.length === 0) return [];
        throw new Error(`TOC page has no chapter entries: ${effectivePageUrl}`);
      }
      allCandidates.push(...pageCandidates);

      let newCount = 0;
      for (const entry of pageCandidates) {
        if (!seenChapterUrls.has(entry.url)) {
          seenChapterUrls.add(entry.url);
          newCount++;
        }
      }

      if (visitedPages.size >= 2 && newCount === 0) break;

      const nextPageUrl = findNextTocPageUrl(result.doc, effectivePageUrl, indexUrl);
      if (!nextPageUrl) break;

      referer = effectivePageUrl;
      pageUrl = nextPageUrl;
    }
  } finally {
    setAbort(null);
  }

  if (allCandidates.length === 0) return [];
  return filterTocEntries(dedupeTocEntries(allCandidates));
}

// ============ Stateful TOC Actions ============

export interface TocActionContext {
  // State refs
  toc: Ref<TocEntry[]>;
  tocOriginal: Ref<TocEntry[]>;
  tocLoading: Ref<boolean>;
  tocAbort: Ref<(() => void) | null>;
  chapters: Ref<ChapterEntry[]>;

  // Computed
  chapter: ComputedRef<ParsedChapter | null>;
  rule: ComputedRef<SiteRule | null>;
  currentConversionMode: Ref<ConversionMode>;

  // Session management
  runtime: {
    isSessionStale: (runId: number) => boolean;
    sessionId: () => number;
  };

  // Callbacks
  showToast: (msg: string, type: 'info' | 'error', duration?: number) => void;
  applyTocConversion: (mode: ConversionMode) => Promise<void>;

  // Dependencies (injectable for testing)
  loadTocEntriesPaged?: typeof loadTocEntriesPaged;
}

export function createTocActions(ctx: TocActionContext) {
  const _loadTocEntriesPaged = ctx.loadTocEntriesPaged ?? loadTocEntriesPaged;

  async function setTocEntries(entries: TocEntry[]): Promise<void> {
    ctx.tocOriginal.value = entries;
    await ctx.applyTocConversion(ctx.currentConversionMode.value);
  }

  async function ensureIndexUrl(): Promise<string | undefined> {
    const current = ctx.chapter.value;
    const currentUrl = current?.url || '';
    const existing = current?.indexUrl;

    // If we already have an indexUrl and it doesn't look like the current chapter URL, keep it.
    if (
      existing &&
      (!currentUrl || normalizeUrlForBlock(existing) !== normalizeUrlForBlock(currentUrl))
    ) {
      return existing;
    }

    if (!currentUrl) return undefined;

    try {
      const parser = getParser();
      const detected = parser.detect(document, currentUrl).results.navigation.index?.url;
      if (!detected) return undefined;

      const normalized = normalizeUrlForFetch(detected);
      for (const entry of ctx.chapters.value) {
        const existingIndex = entry.chapter.indexUrl;
        const entryUrl = entry.chapter.url;
        const looksLikeSelf =
          existingIndex && entryUrl
            ? normalizeUrlForBlock(existingIndex) === normalizeUrlForBlock(entryUrl)
            : false;
        if (!existingIndex || looksLikeSelf) {
          entry.chapter.indexUrl = normalized;
        }
      }
      return normalized;
    } catch (e) {
      console.error('[MNR] Failed to detect indexUrl:', e);
      return undefined;
    }
  }

  let inflight: { runId: number; promise: Promise<void> } | null = null;

  /** Callers awaiting loadToc() must see the settled TOC, so share an in-flight load. */
  function loadToc(): Promise<void> {
    const runId = ctx.runtime.sessionId();
    if (ctx.toc.value.length > 0) return Promise.resolve();
    if (inflight?.runId === runId) return inflight.promise;

    const promise = runLoadToc(runId).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { runId, promise };
    return promise;
  }

  async function runLoadToc(runId: number): Promise<void> {
    ctx.tocLoading.value = true;
    try {
      const currentUrl = ctx.chapter.value?.url || '';
      let indexUrl = ctx.chapter.value?.indexUrl;
      if (
        !indexUrl ||
        (currentUrl && normalizeUrlForBlock(indexUrl) === normalizeUrlForBlock(currentUrl))
      ) {
        indexUrl = (await ensureIndexUrl()) || undefined;
      }
      if (ctx.runtime.isSessionStale(runId)) return;
      if (!indexUrl) {
        ctx.showToast('未检测到目录链接', 'info', 2500);
        return;
      }

      let entries = await _loadTocEntriesPaged(
        indexUrl,
        currentUrl || indexUrl,
        ctx.rule.value ?? undefined,
        abort => {
          if (!ctx.runtime.isSessionStale(runId)) {
            ctx.tocAbort.value = abort;
          } else {
            abort?.();
          }
        }
      );
      if (ctx.runtime.isSessionStale(runId)) return;
      if (entries.length === 0) {
        // Retry once for transient request failures / slow dynamic pages.
        await new Promise<void>(resolve => window.setTimeout(resolve, 400));
        if (ctx.runtime.isSessionStale(runId)) return;
        entries = await _loadTocEntriesPaged(
          indexUrl,
          currentUrl || indexUrl,
          ctx.rule.value ?? undefined,
          abort => {
            if (!ctx.runtime.isSessionStale(runId)) {
              ctx.tocAbort.value = abort;
            } else {
              abort?.();
            }
          }
        );
        if (ctx.runtime.isSessionStale(runId)) return;
      }
      await setTocEntries(entries);
      if (ctx.runtime.isSessionStale(runId)) return;
      if (entries.length === 0) {
        ctx.showToast('目录解析为空，可稍后重试或刷新页面', 'info', 2500);
      }
    } catch (e) {
      if (!ctx.runtime.isSessionStale(runId)) {
        console.error('[MNR] Failed to load TOC:', e);
        ctx.showToast('目录加载失败，可稍后重试', 'error', 2500);
      }
    } finally {
      if (!ctx.runtime.isSessionStale(runId)) {
        ctx.tocLoading.value = false;
        ctx.tocAbort.value = null;
      }
    }
  }

  return { setTocEntries, ensureIndexUrl, loadToc };
}
