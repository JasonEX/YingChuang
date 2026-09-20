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
import { recordDebugEvent } from '@/core/debug/events';
import type { SiteRequestDiagnostic } from '@/core/utils/siteRequest';
import type { SiteRule } from '@/core/rules/types';

// ============ Constants ============

/** Maximum number of TOC pages to fetch */
const MAX_TOC_PAGES = 120;

/** A bounded account of the latest load, retained even after its events leave the ring. */
export interface TocLoadDiagnostic {
  currentUrl: string;
  indexUrl: string | null;
  ruleId: string | null;
  attempt: number;
  loader: string;
  pages: number;
  entries: number;
  outcome: 'loading' | 'complete' | 'empty' | 'failed' | 'cancelled';
  reason: string | null;
  nextUrl?: string | null;
  request?: SiteRequestDiagnostic;
  error?: string;
}

/** Load a complete catalog; a safety limit must not publish a truncated one. */
export async function loadTocEntriesPaged(
  indexUrl: string,
  currentUrl: string,
  rule: SiteRule | undefined,
  setAbort: (abort: (() => void) | null) => void,
  report: (update: Partial<TocLoadDiagnostic>) => void = () => {}
): Promise<TocEntry[]> {
  const loaderContext: SpecialTocLoaderContext = {
    indexUrl,
    currentUrl,
    rule,
    setAbort,
    onRequest: request => report({ request }),
  };
  const loader = specialTocLoaders.find(item => item.matches(loaderContext));
  report({ loader: loader?.id ?? 'paged' });
  if (loader) {
    const entries = await loader.load(loaderContext);
    report({
      pages: entries.length ? 1 : 0,
      entries: entries.length,
      reason: entries.length ? 'provider-complete' : 'empty',
    });
    return entries;
  }

  const visitedPages = new Set<string>();
  const seenChapterUrls = new Set<string>();
  const allCandidates: TocEntry[] = [];
  let currentAbort: (() => void) | null = null;
  let aborted = false;
  setAbort(() => {
    aborted = true;
    currentAbort?.();
  });

  try {
    let pageUrl: string | null = indexUrl;
    let referer: string | undefined = currentUrl || indexUrl;
    while (pageUrl && !aborted) {
      const pageKey = normalizeUrlForCompare(pageUrl);
      if (visitedPages.has(pageKey)) {
        report({ reason: 'repeated-page' });
        break;
      }
      if (visitedPages.size >= MAX_TOC_PAGES) {
        report({ reason: 'page-limit', nextUrl: pageUrl });
        throw new Error(`TOC page limit reached before: ${pageUrl}`);
      }
      visitedPages.add(pageKey);
      report({
        request: { url: pageUrl, finalUrl: null, status: null, transport: null, reason: 'pending' },
      });
      const { promise, abort } = fetchAndParseUrl(pageUrl, referer);
      currentAbort = abort;
      if (aborted) abort();
      const result = await promise;
      currentAbort = null;
      report({
        request: {
          url: pageUrl,
          finalUrl: result.finalUrl,
          status: result.status,
          transport: null,
          reason: result.error || (result.doc ? 'success' : 'empty'),
        },
      });
      if (aborted || result.error === 'abort') {
        report({ reason: 'cancelled' });
        return [];
      }
      if (!result.doc || result.error) {
        report({ reason: result.error || 'empty-response' });
        if (allCandidates.length === 0) return [];
        throw new Error(`TOC page request failed: ${pageUrl} (${result.error})`);
      }
      const effectivePageUrl = result.finalUrl || pageUrl;
      const pageCandidates = collectTocCandidates(result.doc, effectivePageUrl, rule);
      if (pageCandidates.length === 0 && (rule?.toc?.selector || allCandidates.length > 0)) {
        report({ reason: 'empty-page' });
        if (allCandidates.length === 0) return [];
        throw new Error(`TOC page has no chapter entries: ${effectivePageUrl}`);
      }
      allCandidates.push(...pageCandidates);
      const previousCount = seenChapterUrls.size;
      for (const entry of pageCandidates) seenChapterUrls.add(entry.url);
      report({ pages: visitedPages.size, entries: seenChapterUrls.size });
      if (visitedPages.size >= 2 && seenChapterUrls.size === previousCount) {
        report({ reason: 'no-new-chapters' });
        break;
      }
      const nextPageUrl = findNextTocPageUrl(result.doc, effectivePageUrl, indexUrl);
      report({ nextUrl: nextPageUrl });
      if (!nextPageUrl) {
        report({ reason: 'last-page' });
        break;
      }
      referer = effectivePageUrl;
      pageUrl = nextPageUrl;
    }
  } finally {
    setAbort(null);
  }
  if (aborted) {
    report({ reason: 'cancelled' });
    return [];
  }
  const entries = filterTocEntries(dedupeTocEntries(allCandidates));
  report({ entries: entries.length });
  return entries;
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

  let lastLoad: TocLoadDiagnostic | null = null;

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
    const diagnostic: TocLoadDiagnostic = {
      currentUrl: ctx.chapter.value?.url || '',
      indexUrl: ctx.chapter.value?.indexUrl || null,
      ruleId: ctx.rule.value?.id || null,
      attempt: 0,
      loader: 'pending',
      pages: 0,
      entries: 0,
      outcome: 'loading',
      reason: null,
    };
    lastLoad = diagnostic;
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
      diagnostic.indexUrl = indexUrl || null;
      if (!indexUrl) {
        diagnostic.outcome = 'empty';
        diagnostic.reason = 'missing-index';
        ctx.showToast('未检测到目录链接', 'info', 2500);
        return;
      }

      const fetchEntries = () => {
        diagnostic.attempt++;
        diagnostic.pages = 0;
        diagnostic.entries = 0;
        diagnostic.reason = null;
        diagnostic.request = undefined;
        diagnostic.nextUrl = undefined;
        return _loadTocEntriesPaged(
          indexUrl,
          currentUrl || indexUrl,
          ctx.rule.value ?? undefined,
          abort => {
            if (!ctx.runtime.isSessionStale(runId)) ctx.tocAbort.value = abort;
            else abort?.();
          },
          update => Object.assign(diagnostic, update)
        );
      };
      let entries = await fetchEntries();
      if (ctx.runtime.isSessionStale(runId)) return;
      if (entries.length === 0) {
        // Preserve the existing one retry for empty / slow dynamic catalogs.
        recordDebugEvent('toc.retry', diagnostic);
        await new Promise<void>(resolve => window.setTimeout(resolve, 400));
        if (ctx.runtime.isSessionStale(runId)) return;
        entries = await fetchEntries();
        if (ctx.runtime.isSessionStale(runId)) return;
      }
      await setTocEntries(entries);
      if (ctx.runtime.isSessionStale(runId)) return;
      diagnostic.entries = entries.length;
      diagnostic.outcome = entries.length ? 'complete' : 'empty';
      if (entries.length === 0) {
        ctx.showToast('目录解析为空，可稍后重试或刷新页面', 'info', 2500);
      }
    } catch (e) {
      if (!ctx.runtime.isSessionStale(runId)) {
        diagnostic.outcome = 'failed';
        diagnostic.error = String(e);
        diagnostic.reason ??= 'exception';
        console.error('[MNR] Failed to load TOC:', e);
        ctx.showToast('目录加载失败，可稍后重试', 'error', 2500);
      }
    } finally {
      if (ctx.runtime.isSessionStale(runId)) diagnostic.outcome = 'cancelled';
      recordDebugEvent('toc.load', diagnostic, diagnostic.outcome === 'failed' ? 'error' : 'info');
      if (!ctx.runtime.isSessionStale(runId)) {
        ctx.tocLoading.value = false;
        ctx.tocAbort.value = null;
      }
    }
  }

  return { loadToc, getLoadDiagnostic: () => lastLoad };
}
