import { normalizeUrlForFetch, resolveUrl } from '../utils';
import type { SpecialTocLoader, SpecialTocLoaderContext } from './index';
import { requestSiteData } from '@/core/utils/siteRequest';
import type { TocEntry } from '../types';

interface AjaxChapterListLoaderOptions {
  id: string;
  ruleIds: readonly string[];
  matchesHost: (hostname: string) => boolean;
  matchesChapterPath: (pathname: string) => boolean;
  cleanTitle?: (title: string) => string;
}

function resolvePageUrl(
  indexUrl: string,
  currentUrl: string,
  options: AjaxChapterListLoaderOptions
): URL | null {
  const fallbackBase =
    (typeof location !== 'undefined' && typeof location.href === 'string' && location.href) ||
    'https://example.invalid/';

  for (const candidate of [currentUrl, indexUrl]) {
    const absolute = resolveUrl(candidate, fallbackBase);
    if (!absolute) continue;

    try {
      const url = new URL(absolute);
      if (options.matchesHost(url.hostname)) return url;
    } catch {
      // Ignore invalid URLs and try the other candidate.
    }
  }

  return null;
}

function extractBookId(
  indexUrl: string,
  currentUrl: string,
  pageUrl: URL,
  options: AjaxChapterListLoaderOptions
): string | null {
  for (const candidate of [currentUrl, indexUrl]) {
    const absolute = resolveUrl(candidate, pageUrl.href);
    if (!absolute) continue;

    try {
      const url = new URL(absolute);
      if (!options.matchesHost(url.hostname)) continue;
      const match = url.pathname.match(/^\/(?:txt|book)\/(\d+)(?:\/|\.html?$)/);
      if (match) return match[1];
    } catch {
      // Ignore invalid URLs and try the other candidate.
    }
  }

  return null;
}

function buildChapterListUrl(
  indexUrl: string,
  currentUrl: string,
  options: AjaxChapterListLoaderOptions
): string | null {
  const pageUrl = resolvePageUrl(indexUrl, currentUrl, options);
  if (!pageUrl) return null;

  const bookId = extractBookId(indexUrl, currentUrl, pageUrl, options);
  if (!bookId) return null;

  return new URL(`/ajax_novels/chapterlist/${bookId}.html`, pageUrl.origin).toString();
}

function parseChapterList(
  html: string,
  apiUrl: string,
  options: AjaxChapterListLoaderOptions
): TocEntry[] {
  if (!html.trim() || typeof DOMParser === 'undefined') return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const anchors = Array.from(doc.querySelectorAll('ul li a[href], a[href*="/txt/"]'));
  const seen = new Set<string>();
  const entries: TocEntry[] = [];

  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href')?.trim();
    if (!rawHref) continue;

    const absolute = resolveUrl(rawHref, apiUrl);
    if (!absolute) continue;

    let url: URL;
    try {
      url = new URL(absolute);
    } catch {
      continue;
    }
    if (!options.matchesHost(url.hostname) || !options.matchesChapterPath(url.pathname)) continue;

    const normalizedUrl = normalizeUrlForFetch(url.toString());
    if (seen.has(normalizedUrl)) continue;

    const rawTitle = (anchor.textContent || '').trim();
    const title = (options.cleanTitle?.(rawTitle) || rawTitle).trim();
    seen.add(normalizedUrl);
    entries.push({
      title: title || `章节 ${entries.length + 1}`,
      url: normalizedUrl,
    });
  }

  return entries;
}

async function loadChapterList(
  context: SpecialTocLoaderContext,
  options: AjaxChapterListLoaderOptions
): Promise<TocEntry[]> {
  const apiUrl = buildChapterListUrl(context.indexUrl, context.currentUrl, options);
  if (!apiUrl) return [];

  return (
    (await requestSiteData(apiUrl, {
      responseType: 'text',
      setAbort: context.setAbort,
      onResult: context.onRequest,
      referrer: context.currentUrl || context.indexUrl,
      headers: { Accept: 'text/html, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' },
      parse: data => {
        const entries = typeof data === 'string' ? parseChapterList(data, apiUrl, options) : [];
        return entries.length ? entries : null;
      },
    })) || []
  );
}

export function createAjaxChapterListLoader(
  options: AjaxChapterListLoaderOptions
): SpecialTocLoader {
  return {
    id: options.id,
    matches: context =>
      options.ruleIds.includes(context.rule?.id || '') ||
      resolvePageUrl(context.indexUrl, context.currentUrl, options) !== null,
    load: context => loadChapterList(context, options),
  };
}
