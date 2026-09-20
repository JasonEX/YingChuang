/**
 * Reader Store Detection Functions
 * Detection utilities for VIP pages, TOC pages, and invalid URLs
 */

import { normalizeCiwemaoChapterUrl } from '@/core/utils';

/**
 * Check if URL is invalid for chapter navigation (homepage, login, etc.)
 * This is a quick pre-fetch check to avoid loading non-chapter pages
 */
export function isInvalidChapterUrl(url: string, currentChapterUrl?: string): boolean {
  try {
    const normalizedUrl = normalizeCiwemaoChapterUrl(url);
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname;

    // Homepage/root path
    if (pathname === '/' || pathname === '') {
      return true;
    }

    // Very short paths are likely not chapter pages
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      // Some sites use single-segment chapter URLs, e.g.:
      // - Faloo: /412421_1.html
      // - Others: /123.html
      // If it doesn't contain digits, it's very likely not a chapter.
      const part = pathParts[0] || '';
      if (!/\d/.test(part)) {
        return true;
      }
    }

    // Common non-chapter URL patterns
    const invalidPatterns = [
      /^https?:\/\/[^/]+\/?$/i, // Root domain
      /^https?:\/\/[^/]+\/(?:index|home|main)?\.?(?:html?|php)?$/i, // Homepage variants
      /\/(?:book|novel|xiaoshuo|info)\/?\d*\/?$/i, // Book index without chapter
      /\/(?:list|catalog|toc|contents?)\.?(?:html?)?$/i,
      /\/(?:index|list|last|LastPage|end)\.(?:html?|php|aspx)/i,
      /\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)\.(?:html?|php|aspx)$/i,
      // Ciweimao: non-chapter endpoints under /chapter/
      /\/chapter\/get_par_tsu_list(?:$|[/?#])/i,
      /\/chapter\/ajax_get_session_code(?:$|[/?#])/i,
      /\/chapter\/get_book_chapter_detail_info(?:$|[/?#])/i,
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(normalizedUrl) || pattern.test(pathname)) {
        return true;
      }
    }

    // Non-chapter sections must be whole path segments: hostnames (author.example.com) and
    // slugs (/helpful-hero/, /about.time/) are not site sections. File endpoints such as
    // /search.php are handled separately above.
    if (
      /\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)(?:\/|$)/i.test(
        pathname
      )
    ) {
      return true;
    }

    // If current chapter URL is provided, check URL structure similarity
    if (currentChapterUrl) {
      const currentParsed = new URL(currentChapterUrl);
      const currentParts = currentParsed.pathname.split('/').filter(Boolean);

      // If current URL has significantly more path depth, target is likely not a chapter
      // e.g., current: /chapter/123/456, target: /book/123 -> invalid
      if (currentParts.length >= 3 && pathParts.length < currentParts.length - 1) {
        return true;
      }

      // Different domain/host -> invalid
      if (parsed.host !== currentParsed.host) {
        return true;
      }
    }

    return false;
  } catch {
    // URL parsing failed
    return false;
  }
}

/**
 * Detect if content looks like a Table of Contents page
 * Uses multiple heuristics to identify TOC pages
 */
export function detectTocPage(
  content: string,
  pageUrl: string,
  currentChapterUrl: string
): boolean {
  // Heuristic 0: URL pattern suggests index/book page
  const tocUrlPatterns = [
    /\/book\/\d+\.html?$/i,
    /\/book\/\d+\/?$/i,
    /\/novel\/\d+\/?$/i,
    /\/xiaoshuo\/\d+\/?$/i,
    /\/info\/\d+\.html?$/i,
    /\/\d+\/index\.html?$/i,
    /\/booklist/i,
    /\/catalog/i,
    /\/contents?\.html?$/i,
    /\/list\.html?$/i,
    /\/toc\.html?$/i,
  ];

  for (const pattern of tocUrlPatterns) {
    if (pattern.test(pageUrl)) {
      return true;
    }
  }

  // Heuristic 0.5: Compare URL structures
  try {
    const currentPath = new URL(currentChapterUrl).pathname;
    const pagePath = new URL(pageUrl).pathname;

    const chapterPattern = /\/(txt|read|chapter|article)\/\d+\/\d+/i;
    const bookPattern = /\/(book|novel|info|xiaoshuo)\/\d+/i;

    if (chapterPattern.test(currentPath) && bookPattern.test(pagePath)) {
      return true;
    }
  } catch {
    // URL parsing failed, continue with other checks
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;

  const textContent = tempDiv.textContent || '';
  const textLength = textContent.length;
  const links = tempDiv.querySelectorAll('a');
  const linkCount = links.length;

  // Heuristic 1: Very short content with many links
  if (textLength < 500 && linkCount > 10) {
    return true;
  }

  // Heuristic 2: High link-to-text ratio
  const linkTextLength = Array.from(links).reduce(
    (sum, a) => sum + (a.textContent?.length || 0),
    0
  );
  const linkRatio = textLength > 0 ? linkTextLength / textLength : 0;
  if (linkRatio > 0.6 && linkCount > 8) {
    return true;
  }

  // Heuristic 3: Many links pointing to chapter-like URLs
  const chapterLinkPattern =
    /\/(chapter|txt|read|book|novel|article)\/|\d+\.html?$|\/xs_[^/]+\/\d+\/\d+(?:\/\d+)?/i;
  const chapterLinks = Array.from(links).filter(a => {
    const href = a.getAttribute('href') || '';
    return chapterLinkPattern.test(href);
  });
  if (chapterLinks.length > 10) {
    return true;
  }

  // Heuristic 4: Contains link to the current chapter
  const normalizeUrlLocal = (url: string) => {
    try {
      const u = new URL(url, pageUrl);
      return u.pathname.replace(/\/$/, '');
    } catch {
      return url.replace(/\/$/, '');
    }
  };
  const currentPath = normalizeUrlLocal(currentChapterUrl);
  const hasLinkToCurrentChapter = Array.from(links).some(a => {
    const href = a.getAttribute('href');
    if (!href) return false;
    return normalizeUrlLocal(href) === currentPath;
  });
  if (hasLinkToCurrentChapter && linkCount > 5) {
    return true;
  }

  // Heuristic 5: Title/content contains TOC-related keywords
  // English keywords need word boundaries: prose like "protocol" or "photocopy" is not a TOC.
  const tocKeywords = [
    /目录/,
    /章节列表/,
    /章节目录/,
    /全部章节/,
    /最新章节/,
    /小说目录/,
    /\btable of contents\b/i,
    /\btoc\b/i,
    /\bcatalog\b/i,
    /\bindex\b/i,
  ];
  const keywordMatches = tocKeywords.filter(kw => kw.test(textContent));
  if (keywordMatches.length >= 2 || (keywordMatches.length >= 1 && linkCount > 15)) {
    return true;
  }

  // Heuristic 6: Content is structured like a list
  const linkTexts = Array.from(links)
    .map(a => a.textContent?.trim() || '')
    .filter(t => t.length > 0);
  const chapterNamePattern = /^第.{1,10}[章节回话篇集卷]/;
  const chapterNameLinks = linkTexts.filter(t => chapterNamePattern.test(t));
  if (chapterNameLinks.length > 5) {
    return true;
  }

  return false;
}
