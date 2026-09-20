/**
 * URL and HTML utility functions
 */

import { parseChapterSectionFromPathname } from './sectionPath';
import type { SectionUrlParser } from '@/core/rules/types';

/**
 * Normalize absolute URL
 */
export function normalizeAbsoluteUrl(href: string, base?: string): string {
  const baseCandidates: Array<string | undefined> = [base];

  // Fallback to current document/location when caller doesn't provide a base.
  // This keeps the helper tolerant for "open from history" / "no referrer" cases.
  if (typeof document !== 'undefined') baseCandidates.push(document.baseURI);
  if (typeof location !== 'undefined') baseCandidates.push(location.href);

  for (const candidate of baseCandidates) {
    if (!candidate) continue;
    try {
      return new URL(href, candidate).toString();
    } catch {
      // try next candidate
    }
  }

  try {
    return new URL(href).toString();
  } catch {
    return href;
  }
}

/**
 * Get base URL for section pages
 * /123_2.html or /123-2.html -> /123.html
 */
export function getSectionBaseUrl(url: string, parseSectionUrl?: SectionUrlParser): string | null {
  // A site may provide its own section-URL parser; when it does, that
  // wins over the generic /{id}_{page}.html split below.
  const declared = parseSectionUrl?.(url);
  if (declared) return declared.page > 1 ? declared.chapterUrl : null;

  // /123_2.html -> /123.html
  const m = url.match(/^(.*\/\d+)[_-]\d+(\.html?)$/i);
  if (m) return `${m[1]}${m[2]}`;

  // Extensionless pagination: /{bookId}/{chapterId}/{page} -> /{bookId}/{chapterId}/1
  // Keep it conservative to avoid misclassifying /{bookId}/{chapterNo} as "page 2".
  try {
    const u = new URL(url);
    // Directory-style sections; inspect only the path, preserving query and hash.
    // Keep the chapter-id/page guards aligned with sectionPath.ts.
    const dirSection = u.pathname.match(/^(.*\/\d{5,})_(\d{1,2})(\/?)$/);
    if (dirSection && Number(dirSection[2]) >= 1) {
      u.pathname = `${dirSection[1]}${dirSection[3]}`;
      return u.toString();
    }

    const parts = u.pathname.split('/').filter(Boolean);
    const hasTrailingSlash = u.pathname.endsWith('/');

    if (parts.length >= 3) {
      const pagePart = parts[parts.length - 1];
      const chapterPart = parts[parts.length - 2];

      if (/^\d{1,2}$/.test(pagePart) && /^\d{3,}$/.test(chapterPart)) {
        const numericSegments = parts.slice(0, -1).filter(p => /^\d{3,}$/.test(p));
        if (numericSegments.length >= 2) {
          parts[parts.length - 1] = '1';
          u.pathname = `/${parts.join('/')}${hasTrailingSlash ? '/' : ''}`;
          return u.toString();
        }
      }
    }

    if (parts.length >= 4) {
      const pagePart = parts[parts.length - 1];
      const chapterPart = parts[parts.length - 2];
      const hasStableBookId = parts.slice(0, -2).some(p => /^\d{3,}$/.test(p));

      if (/^\d{1,2}$/.test(pagePart) && /^\d{1,6}$/.test(chapterPart) && hasStableBookId) {
        const page = parseInt(pagePart, 10);
        if (page > 1 && page <= 99) {
          parts.pop();
          u.pathname = `/${parts.join('/')}${hasTrailingSlash ? '/' : ''}`;
          return u.toString();
        }
      }
    }
  } catch {
    // ignore
  }

  // Query-based pagination: /chapter.html?page=2 -> /chapter.html?page=1
  try {
    const u = new URL(url);
    const PAGE_PARAM_KEYS = ['page', 'p', 'pg', 'pageno', 'page_no', 'pagenum', 'pageindex', 'pn'];

    for (const [name, value] of u.searchParams) {
      const keyLower = name.toLowerCase();
      if (!PAGE_PARAM_KEYS.includes(keyLower)) continue;
      if (!/^\d+$/.test(value)) continue;
      const page = parseInt(value, 10);
      if (page <= 1) continue;

      u.searchParams.set(name, '1');
      return u.toString();
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Check if nextUrl looks like a section/page URL relative to currentUrl.
 * E.g., /123.html -> /123_2.html or /123_2.html -> /123_3.html
 */
export function isSectionLikeUrl(
  currentUrl: string,
  nextUrl: string,
  parseSectionUrl?: SectionUrlParser
): boolean {
  try {
    const current = new URL(currentUrl);
    const next = new URL(nextUrl, current);
    if (current.host !== next.host) return false;

    const currentPage = parseSectionUrl?.(current.href) ?? null;
    const nextPage = parseSectionUrl?.(next.href) ?? null;
    if (currentPage || nextPage) {
      return (
        currentPage?.chapterUrl === nextPage?.chapterUrl &&
        nextPage?.page === (currentPage?.page ?? 0) + 1
      );
    }

    const currentPath = current.pathname;
    const nextPath = next.pathname;

    const c = parseChapterSectionFromPathname(currentPath);
    const n = parseChapterSectionFromPathname(nextPath);
    if (c && n && c.chapterKey === n.chapterKey) {
      if (n.section === c.section + 1 && n.section > 1) {
        return true;
      }
    }

    // Query-based pagination: /chapter.html?page=2 -> /chapter.html?page=3
    // Treat it as section-like only when it's the same pathname and the page param increments by 1.
    if (currentPath === nextPath) {
      const PAGE_PARAM_KEYS = [
        'page',
        'p',
        'pg',
        'pageno',
        'page_no',
        'pagenum',
        'pageindex',
        'pn',
      ];

      const getParamValueCI = (params: URLSearchParams, keyLower: string): string | null => {
        for (const [name, value] of params) {
          if (name.toLowerCase() === keyLower) return value;
        }
        return null;
      };

      const extractPageInfo = (u: URL): { keyLower: string; page: number } | null => {
        for (const keyLower of PAGE_PARAM_KEYS) {
          const raw = getParamValueCI(u.searchParams, keyLower);
          if (!raw || !/^\d+$/.test(raw)) continue;
          const page = parseInt(raw, 10);
          if (page >= 1 && page <= 99) return { keyLower, page };
        }
        return null;
      };

      const nextPageInfo = extractPageInfo(next);
      if (nextPageInfo) {
        const rawCurrentPage = getParamValueCI(current.searchParams, nextPageInfo.keyLower);
        const currentPage =
          rawCurrentPage && /^\d+$/.test(rawCurrentPage) ? parseInt(rawCurrentPage, 10) : 1;

        const normalizeNonPageParams = (u: URL, pageKeyLower: string): string[] => {
          const items: string[] = [];
          for (const [name, value] of u.searchParams) {
            if (name.toLowerCase() === pageKeyLower) continue;
            items.push(`${name.toLowerCase()}=${value}`);
          }
          items.sort();
          return items;
        };

        const currentRest = normalizeNonPageParams(current, nextPageInfo.keyLower);
        const nextRest = normalizeNonPageParams(next, nextPageInfo.keyLower);
        const onlyPageDiff =
          currentRest.length === nextRest.length && currentRest.every((v, i) => v === nextRest[i]);

        if (onlyPageDiff && nextPageInfo.page === currentPage + 1 && nextPageInfo.page > 1) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Join two HTML strings with a paragraph separator
 * @param a - First HTML string
 * @param b - Second HTML string
 * @returns Combined HTML string
 */
export function joinHtml(a: string, b: string): string {
  const left = (a || '').trim();
  const right = (b || '').trim();
  if (!left) return right;
  if (!right) return left;
  return `${left}<p></p>${right}`;
}

/**
 * Normalize Ciweimao "paragraph tsukkomi" pages back to chapter URL.
 *
 * Example:
 * - https://wap.ciweimao.com/chapter/get_par_tsu_list?chapter_id=113493242&data-pgid=0
 *   -> https://wap.ciweimao.com/chapter/113493242
 */
export function normalizeCiwemaoChapterUrl(url: string): string {
  try {
    const u = new URL(url);
    if (
      (u.hostname === 'wap.ciweimao.com' || u.hostname === 'mip.ciweimao.com') &&
      (u.pathname === '/chapter/get_par_tsu_list' || u.pathname === '/chapter/get_par_tsu_list/')
    ) {
      const chapterId = u.searchParams.get('chapter_id');
      if (chapterId && /^\d+$/.test(chapterId)) {
        return `${u.origin}/chapter/${chapterId}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Remove redundant first-page query markers from HTML chapter URLs.
 *
 * Some sites link or expose `/chapter.html?page=1` while their catalog uses
 * `/chapter.html`. Keep this deliberately narrow so query-driven chapter URLs
 * such as `read.php?chapter=1` are not rewritten.
 */
export function normalizeRedundantFirstPageParam(url: string): string {
  try {
    const u = new URL(url);
    if (!/\.html?$/i.test(u.pathname)) return url;

    const params = Array.from(u.searchParams.entries());
    if (params.length !== 1) return url;

    const [name, value] = params[0];
    const pageKeys = ['page', 'p', 'pg', 'pageno', 'page_no', 'pagenum', 'pageindex', 'pn'];
    if (!pageKeys.includes(name.toLowerCase()) || value !== '1') return url;

    u.search = '';
    return u.toString();
  } catch {
    return url;
  }
}
