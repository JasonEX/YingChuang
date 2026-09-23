/**
 * Section Merger Module
 *
 * Handles merging of multi-page chapters (sections) into single chapters.
 * Extracted from AutoEnableManager to eliminate code duplication.
 *
 * @module SectionMerger
 */

import { CHAPTER_TEXT_PATTERNS, SECTION_TEXT_PATTERNS } from '@/core/constants';
import { getSectionBaseUrl, isSectionLikeUrl, joinHtml, normalizeAbsoluteUrl } from '@/core/utils';
import type { ParsedChapter, Parser } from '@/core/parser';
import type { ChineseScript } from '@/core/converter/scriptProfile';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getRuleManager } from '@/core/rules/RuleManager';
import type { SiteRule } from '@/core/rules/types';
import { waitForRequestDelay } from '@/core/utils/requestPolicy';

const parseSectionUrl = (url: string) => getRuleManager().parseSectionUrl(url);
// Reuse documents by site-declared identity while retaining the actual URL for requests.
const getDocumentKey = (url: string, base: string) =>
  getRuleManager().normalizeChapterUrl(normalizeAbsoluteUrl(url, base));

/** Matches `(2/5)`, `（2/5）` and `(第2/5页)` section markers printed by site templates. */
const SECTION_TOTAL_PATTERN = /[（(]\s*(?:第\s*)?(\d+)\s*[/／]\s*(\d+)\s*(?:页|頁)?\s*[）)]/;

/** Section detection result */
interface SectionInfo {
  isSection: boolean;
  nextSectionUrl: string | null;
  nextChapterUrl: string | null;
  confidence: number;
}

/** Position of one section page within its chapter merge. */
export interface SectionMergeProgress {
  /** Canonical chapter URL. Identical for every emission of one chapter. */
  url: string;
  /** 1-based count of section pages merged so far, this page included. */
  loaded: number;
  /** Total section pages, only when the page declares a count we can verify. */
  total?: number;
}

/** Content contributed by one additional section page. */
export interface SectionPageDelta {
  /** Processed HTML for this page only. Never includes earlier pages. */
  content: string;
  /** Raw HTML for this page only. */
  rawContent: string;
  /** Cumulative source script after folding this page. */
  sourceScript?: ChineseScript;
  /** Next-chapter URL, when this page revealed one. */
  nextUrl?: string;
}

/** Why a progressive merge stopped. */
export interface SectionMergeEnd {
  loaded: number;
  total?: number;
  /**
   * True when more pages were still expected: aborted, fetch or parse failure, or the
   * `maxPages` cap. A truncated chapter must not be cached as complete.
   */
  truncated: boolean;
}

/** Section merge options */
export interface SectionMergeOptions {
  /** Maximum pages to merge (default: 10) */
  maxPages?: number;
  /** Confidence threshold for auto-detection (default: 0.8) */
  confidenceThreshold?: number;
  /** Speculative loads stop on rate limiting instead of occupying the recovery attempt. */
  retryRateLimit?: boolean;
  /** Signal to abort fetching/merging */
  signal?: AbortSignal;
  /** Custom fetcher function */
  fetcher?: (url: string, referrer: string) => Promise<Document | null>;
  /**
   * Called with the first section page before any further page is fetched. Merging awaits
   * the returned promise, so a consumer can commit the first page before the next request
   * leaves the browser. Fires only for progressive merges.
   */
  onFirstPage?: (chapter: ParsedChapter, progress: SectionMergeProgress) => void | Promise<void>;
  /** Called once per additional section page with that page's content only. */
  onSectionPage?: (delta: SectionPageDelta, progress: SectionMergeProgress) => void | Promise<void>;
  /** Reports completeness for every section merge, including whole-chapter consumers. */
  onMergeEnd?: (end: SectionMergeEnd) => void;
}

interface StartPageState {
  doc: Document;
  url: string;
  knownDocs: Map<string, Document>;
}

type SectionMergeState =
  | { kind: 'done'; chapter: ParsedChapter }
  | {
      kind: 'merge';
      chapterUrl: string;
      nextSectionUrl: string | null;
      nextChapterUrl: string | null;
      sectionDelayMs: number;
    };

interface MergeCursor {
  chapterUrl: string;
  lastUrl: string;
  mergedContent: string;
  mergedRaw: string;
  nextSectionUrl: string | null;
  nextChapterUrl: string | null;
  seen: Set<string>;
  remainingPages: number;
  loadedPages: number;
  totalPages?: number;
  sourceScript?: ChineseScript;
}

interface LoadedSectionPage {
  doc: Document;
  url: string;
  fromCache: boolean;
}

/**
 * Section Merger - combines multi-page chapters
 *
 * @example
 * ```typescript
 * const merger = new SectionMerger(parser);
 * const merged = await merger.merge(doc, url);
 * ```
 */
export class SectionMerger {
  constructor(private parser: Parser) {}

  /**
   * Parse and potentially merge multiple section pages
   *
   * @param doc - Starting document
   * @param url - Starting URL
   * @param options - Merge options
   * @returns Parsed chapter with merged content
   */
  async merge(
    doc: Document,
    url: string,
    options: SectionMergeOptions = {}
  ): Promise<ParsedChapter | null> {
    const confidenceThreshold = options.confidenceThreshold ?? 0.8;

    if (options.signal?.aborted) return null;

    // A landing page (for example a book page that embeds its first chapter) can redirect to
    // the chapter URL it really represents. Which pages do this is declared by site rules.
    const entryUrl = getRuleManager().resolveEntryUrl(doc, url);
    if (entryUrl) {
      const entryChapter = await this.parser.parse(doc, entryUrl);
      if (entryChapter) return entryChapter;
    }

    const startPage = await this.resolveStartPage(doc, url, options);
    if (!startPage) return null;

    const first = await this.parser.parse(startPage.doc, startPage.url);
    if (!first) return null;

    const state = this.decideSectionMerge(startPage, first, confidenceThreshold, !!options.fetcher);
    if (state.kind === 'done') return state.chapter;

    const maxPages = Math.max(1, options.maxPages ?? first.rule?.advanced?.sectionMaxPages ?? 10);

    const progressive = !!state.nextSectionUrl && maxPages > 1;
    const marker = this.readSectionMarker(startPage.doc);
    const totalPages = marker?.page === 1 ? marker.total : undefined;

    if (progressive) {
      // Merging waits here, so page 2 is never requested before the first page is committed.
      await options.onFirstPage?.(
        {
          ...first,
          url: state.chapterUrl,
          nextUrl: state.nextChapterUrl || undefined,
        },
        {
          url: state.chapterUrl,
          loaded: 1,
          total: totalPages,
        }
      );
      if (options.signal?.aborted) return null;
    }

    return this.mergeSections(startPage, first, state, maxPages, options, progressive, totalPages);
  }

  private async resolveStartPage(
    doc: Document,
    url: string,
    options: SectionMergeOptions
  ): Promise<StartPageState | null> {
    if (options.signal?.aborted) return null;

    let startUrl = url;
    let startDoc = doc;
    const knownDocs = new Map<string, Document>([[getDocumentKey(url, url), doc]]);
    const baseUrl = getSectionBaseUrl(url, parseSectionUrl);

    if (baseUrl && baseUrl !== url) {
      const baseDoc = await this.fetchUrl(
        baseUrl,
        url,
        options.fetcher,
        options.signal,
        options.retryRateLimit
      );
      if (options.signal?.aborted) return null;
      if (baseDoc) {
        startUrl = baseUrl;
        startDoc = baseDoc;
        knownDocs.set(getDocumentKey(baseUrl, url), baseDoc);
      }
    }

    return { doc: startDoc, url: startUrl, knownDocs };
  }

  private decideSectionMerge(
    startPage: StartPageState,
    first: ParsedChapter,
    confidenceThreshold: number,
    hasCustomFetcher: boolean
  ): SectionMergeState {
    if (first.rule?.advanced?.noSection) return { kind: 'done', chapter: first };

    const enableByRule = !!first.rule?.advanced?.checkSection;
    const section = this.parser.detectSection(startPage.doc, startPage.url) as
      SectionInfo | undefined;
    const hasNextSectionUrl = !!section?.isSection && !!section.nextSectionUrl;
    const shouldMerge =
      enableByRule || (!!section?.isSection && (section.confidence || 0) >= confidenceThreshold);

    if (!shouldMerge) {
      if (
        !hasNextSectionUrl &&
        first.nextUrl &&
        isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl)
      ) {
        const realNextChapterUrl = this.findNextChapterUrl(startPage.doc, startPage.url);
        if (realNextChapterUrl) {
          return { kind: 'done', chapter: { ...first, nextUrl: realNextChapterUrl } };
        }
      }
      return { kind: 'done', chapter: first };
    }

    const nextSectionUrl =
      section?.nextSectionUrl ||
      (first.nextUrl && isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl)
        ? first.nextUrl
        : null);

    return {
      kind: 'merge',
      chapterUrl: this.getChapterUrl(startPage.url, nextSectionUrl),
      nextSectionUrl,
      nextChapterUrl:
        section?.nextChapterUrl ||
        (first.nextUrl && !isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl)
          ? first.nextUrl
          : null),
      sectionDelayMs: hasCustomFetcher
        ? 0
        : Math.max(0, first.rule?.advanced?.sectionDelayMs ?? 1200),
    };
  }

  /** Read a declared page position; the request cap is never a substitute for a total. */
  private readSectionMarker(doc: Document): { page: number; total: number } | undefined {
    for (const source of [doc.title, doc.querySelector('h1')?.textContent]) {
      const match = source?.match(SECTION_TOTAL_PATTERN);
      if (!match) continue;
      const page = Number(match[1]);
      const total = Number(match[2]);
      if (Number.isSafeInteger(total) && page >= 1 && page <= total) return { page, total };
    }
    return undefined;
  }

  /** A merge is truncated whenever pages it was still owed never arrived. */
  private isTruncatedMerge(cursor: MergeCursor, signal?: AbortSignal): boolean {
    return (
      !!cursor.nextSectionUrl ||
      !!signal?.aborted ||
      (cursor.totalPages !== undefined && cursor.loadedPages < cursor.totalPages)
    );
  }

  /** Keep a canonical chapter identity separate from the URL used to fetch each section. */
  private getChapterUrl(startUrl: string, nextSectionUrl: string | null): string {
    if (!nextSectionUrl || !isSectionLikeUrl(startUrl, nextSectionUrl, parseSectionUrl))
      return startUrl;

    try {
      const start = new URL(startUrl);
      const next = new URL(nextSectionUrl, startUrl);
      const startParams = Array.from(start.searchParams.entries());
      const nextParams = Array.from(next.searchParams.entries());

      if (
        startParams.length === 1 &&
        nextParams.length === 1 &&
        startParams[0][0].toLowerCase() === nextParams[0][0].toLowerCase() &&
        startParams[0][1] === '1' &&
        nextParams[0][1] === '2'
      ) {
        start.search = '';
        return start.toString();
      }
    } catch {
      // Keep the original URL when the section pair cannot be parsed safely.
    }

    return startUrl;
  }

  /**
   * Merge multiple section pages into one chapter
   */
  private async mergeSections(
    startPage: StartPageState,
    first: ParsedChapter,
    state: Extract<SectionMergeState, { kind: 'merge' }>,
    maxPages: number,
    options: SectionMergeOptions,
    progressive: boolean,
    totalPages?: number
  ): Promise<ParsedChapter> {
    const { fetcher, signal } = options;
    const cursor = this.createMergeCursor(startPage, first, state, maxPages);
    cursor.totalPages = totalPages;

    while (cursor.remainingPages > 0 && cursor.nextSectionUrl) {
      if (signal?.aborted) break;

      if (state.sectionDelayMs > 0) {
        await waitForRequestDelay(state.sectionDelayMs, signal);
        if (signal?.aborted) break;
      }

      const page = await this.loadNextSectionPage(
        cursor,
        startPage.knownDocs,
        fetcher,
        signal,
        options.retryRateLimit
      );
      if (!page) break;

      const nextParsed = await this.parseLoadedSection(
        page,
        cursor.lastUrl,
        startPage.knownDocs,
        fetcher,
        signal,
        options.retryRateLimit
      );
      if (signal?.aborted || !nextParsed) break;

      const marker = this.readSectionMarker(page.doc);
      if (
        marker &&
        (marker.page !== cursor.loadedPages + 1 ||
          (cursor.totalPages !== undefined && marker.total !== cursor.totalPages))
      ) {
        // Leave the pending section URL intact: the existing truncated exit owns this failure.
        // Do not append a contradictory page or guess where the missing content belongs.
        break;
      }

      const section = this.parser.detectSection(page.doc, page.url) as SectionInfo | undefined;
      this.advanceMergeCursor(cursor, page.url, nextParsed, section);
      cursor.remainingPages -= 1;
      cursor.loadedPages += 1;
      cursor.totalPages ??= marker?.total;

      if (progressive) {
        await options.onSectionPage?.(
          {
            content: nextParsed.content,
            rawContent: nextParsed.rawContent,
            sourceScript: cursor.sourceScript,
            nextUrl: cursor.nextChapterUrl || undefined,
          },
          { url: cursor.chapterUrl, loaded: cursor.loadedPages, total: cursor.totalPages }
        );
      }
    }

    options.onMergeEnd?.({
      loaded: cursor.loadedPages,
      total: cursor.totalPages,
      truncated: this.isTruncatedMerge(cursor, signal),
    });

    return this.buildMergedChapter(first, cursor);
  }

  private createMergeCursor(
    startPage: StartPageState,
    first: ParsedChapter,
    state: Extract<SectionMergeState, { kind: 'merge' }>,
    maxPages: number
  ): MergeCursor {
    return {
      chapterUrl: state.chapterUrl,
      lastUrl: startPage.url,
      mergedContent: first.content,
      mergedRaw: first.rawContent,
      nextSectionUrl: state.nextSectionUrl,
      nextChapterUrl: state.nextChapterUrl,
      seen: new Set([getDocumentKey(startPage.url, startPage.url)]),
      remainingPages: Math.max(0, maxPages - 1),
      loadedPages: 1,
      sourceScript: first.sourceScript,
    };
  }

  private async loadNextSectionPage(
    cursor: MergeCursor,
    knownDocs: Map<string, Document>,
    fetcher?: SectionMergeOptions['fetcher'],
    signal?: AbortSignal,
    retryRateLimit?: boolean
  ): Promise<LoadedSectionPage | null> {
    if (signal?.aborted || !cursor.nextSectionUrl) return null;

    const url = normalizeAbsoluteUrl(cursor.nextSectionUrl, cursor.lastUrl);
    const key = getDocumentKey(url, cursor.lastUrl);
    if (cursor.seen.has(key)) return null;
    cursor.seen.add(key);

    const cachedDoc = knownDocs.get(key) ?? null;
    if (cachedDoc) {
      return { doc: cachedDoc, url, fromCache: true };
    }

    const doc = await this.fetchUrl(url, cursor.lastUrl, fetcher, signal, retryRateLimit);
    if (!doc) return null;

    knownDocs.set(key, doc);
    return { doc, url, fromCache: false };
  }

  private async parseLoadedSection(
    page: LoadedSectionPage,
    referrer: string,
    knownDocs: Map<string, Document>,
    fetcher?: SectionMergeOptions['fetcher'],
    signal?: AbortSignal,
    retryRateLimit?: boolean
  ): Promise<ParsedChapter | null> {
    let parsed = await this.parser.parse(page.doc, page.url);
    if (parsed || !page.fromCache || signal?.aborted) return parsed;

    const doc = await this.fetchUrl(page.url, referrer, fetcher, signal, retryRateLimit);
    if (!doc) return null;

    knownDocs.set(getDocumentKey(page.url, referrer), doc);
    page.doc = doc;
    parsed = await this.parser.parse(doc, page.url);
    return parsed;
  }

  private advanceMergeCursor(
    cursor: MergeCursor,
    pageUrl: string,
    parsed: ParsedChapter,
    section: SectionInfo | undefined
  ): void {
    cursor.mergedContent = joinHtml(cursor.mergedContent, parsed.content);
    cursor.mergedRaw = joinHtml(cursor.mergedRaw, parsed.rawContent);
    cursor.sourceScript = this.mergeSourceScript(cursor.sourceScript, parsed.sourceScript);

    if (section?.nextChapterUrl) cursor.nextChapterUrl = section.nextChapterUrl;

    cursor.nextSectionUrl = section?.nextSectionUrl || null;
    if (!cursor.nextSectionUrl && parsed.nextUrl) {
      if (isSectionLikeUrl(pageUrl, parsed.nextUrl, parseSectionUrl)) {
        cursor.nextSectionUrl = parsed.nextUrl;
      } else if (!cursor.nextChapterUrl) {
        cursor.nextChapterUrl = parsed.nextUrl;
      }
    }

    cursor.lastUrl = pageUrl;
  }

  private buildMergedChapter(first: ParsedChapter, cursor: MergeCursor): ParsedChapter {
    return {
      ...first,
      url: cursor.chapterUrl,
      content: cursor.mergedContent,
      rawContent: cursor.mergedRaw,
      nextUrl: cursor.nextChapterUrl || undefined,
      sourceScript: cursor.sourceScript,
    };
  }

  private mergeSourceScript(
    current: ChineseScript | undefined,
    next: ChineseScript | undefined
  ): ChineseScript | undefined {
    if (!next || next === 'unknown') return current;
    if (!current || current === 'unknown') return next;
    if (current === next) return current;
    return 'mixed';
  }

  /**
   * Internal fetch helper
   */
  private async fetchUrl(
    url: string,
    referrer: string,
    customFetcher?: SectionMergeOptions['fetcher'],
    signal?: AbortSignal,
    retryRateLimit?: boolean
  ): Promise<Document | null> {
    if (signal?.aborted) {
      return null;
    }

    if (customFetcher) {
      return await customFetcher(url, referrer);
    }

    const { promise, abort } = fetchAndParseUrl(url, referrer, { retryRateLimit });
    if (!signal) {
      const result = await promise;
      return result.doc;
    }

    if (signal.aborted) {
      abort();
      return null;
    }

    let abortListener: (() => void) | null = null;
    const abortPromise = new Promise<Awaited<typeof promise>>(resolve => {
      abortListener = () => {
        abort();
        resolve({ doc: null, status: null, finalUrl: null, error: 'abort' });
      };
      signal.addEventListener('abort', abortListener, { once: true });
    });

    try {
      const result = await Promise.race([promise, abortPromise]);
      return result.doc;
    } finally {
      if (abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
    }
  }

  /**
   * Find the real next chapter URL (not section URL)
   */
  private findNextChapterUrl(doc: Document, currentUrl: string): string | null {
    const links = doc.querySelectorAll('a[href]');

    const candidates: Array<{ url: string; score: number }> = [];

    for (const link of links) {
      const anchor = link as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      if (!href) continue;

      const absUrl = normalizeAbsoluteUrl(href, currentUrl);
      if (absUrl === currentUrl || isSectionLikeUrl(currentUrl, absUrl, parseSectionUrl)) continue;

      const text = anchor.textContent?.trim() || '';
      if (!text) continue;

      const normalizedText = text.replace(/\s+/g, '').trim();
      if (!normalizedText) continue;

      const lowerText = normalizedText.toLowerCase();

      // Forward-only hints. Keep it conservative: this is used to skip remaining section pages.
      const isForward =
        /下一/.test(normalizedText) ||
        /下[章节篇话]/.test(normalizedText) ||
        /后一章/.test(normalizedText) ||
        /继续阅读/.test(normalizedText) ||
        /next/i.test(normalizedText);
      if (!isForward) continue;

      const isChapterText = CHAPTER_TEXT_PATTERNS.some(p => p.test(text));
      const isSectionText =
        SECTION_TEXT_PATTERNS.some(p => p.test(text)) ||
        (lowerText.includes('next') &&
          lowerText.includes('page') &&
          !lowerText.includes('chapter'));
      const isEnglishNextChapter = lowerText.includes('next') && lowerText.includes('chapter');

      // Skip pagination links like "下一页/next page".
      if (isSectionText && !isChapterText && !isEnglishNextChapter) continue;

      let score = 0;
      if (isChapterText) score += 50;
      if (isEnglishNextChapter) score += 45;
      if (lowerText === 'next' || lowerText === '>' || lowerText === '»') score += 10;
      if (lowerText.includes('next')) score += 2;
      if (normalizedText.length <= 5) score += 1;

      const rel = (anchor.getAttribute('rel') || '').toLowerCase();
      if (rel.includes('next')) score += 2;

      if (score > 0) {
        candidates.push({ url: absUrl, score });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
  }
}

/**
 * Create a section merger instance
 */
export function createSectionMerger(parser: Parser): SectionMerger {
  return new SectionMerger(parser);
}

/** One display entry receives sequential updates from one merge. */
export type SectionMergeUpdate =
  | { stage: 'append'; delta: SectionPageDelta; progress: SectionMergeProgress }
  | { stage: 'complete'; chapter: ParsedChapter; rule?: SiteRule; truncated: boolean }
  | { stage: 'cancel'; reason: 'aborted' | 'failed' };

export type SectionDelivery = (update: SectionMergeUpdate) => void | Promise<void>;

/** Shared delivery lifecycle for initial launch and subsequent chapter navigation. */
export async function streamSectionMerge(
  merger: SectionMerger,
  doc: Document,
  url: string,
  signal: AbortSignal,
  first: (
    chapter: ParsedChapter,
    progress: SectionMergeProgress
  ) => SectionDelivery | void | Promise<SectionDelivery | void>,
  retryRateLimit = true
): Promise<ParsedChapter | null> {
  const target: { delivery?: SectionDelivery } = {};
  let truncated = false;
  try {
    const chapter = await merger.merge(doc, url, {
      signal,
      retryRateLimit,
      onFirstPage: async (chapter, progress) => {
        target.delivery = (await first(chapter, progress)) || undefined;
      },
      onSectionPage: async (delta, progress) => {
        await target.delivery?.({ stage: 'append', delta, progress });
      },
      onMergeEnd: end => {
        truncated = end.truncated;
      },
    });
    if (!chapter || signal.aborted) {
      await target.delivery?.({ stage: 'cancel', reason: signal.aborted ? 'aborted' : 'failed' });
      return null;
    }
    await target.delivery?.({ stage: 'complete', chapter, rule: chapter.rule, truncated });
    return truncated && !target.delivery ? null : chapter;
  } catch (error) {
    await target.delivery?.({ stage: 'cancel', reason: 'failed' });
    throw error;
  }
}
