/**
 * Reader Store Utility Functions
 */

import { normalizeCiwemaoChapterUrl, normalizeRedundantFirstPageParam } from '@/core/utils';

/**
 * Normalize URL for fetching (remove hash, canonicalize)
 */
export function normalizeUrlForFetch(url: string): string {
  const normalized = normalizeRedundantFirstPageParam(normalizeCiwemaoChapterUrl(url));
  try {
    const u = new URL(normalized);
    u.hash = '';
    return u.toString();
  } catch {
    return normalized.replace(/#.*$/, '');
  }
}

/**
 * Normalize URL for comparison (remove trailing slash and index.html)
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').replace(/\/index\.html?$/, '');
}

/**
 * Normalize URL for block list (combines fetch and comparison normalization)
 */
export function normalizeUrlForBlock(url: string): string {
  const normalized = normalizeCiwemaoChapterUrl(url);
  try {
    const u = new URL(normalized);
    u.hash = '';
    return normalizeUrl(u.toString());
  } catch {
    return normalizeUrl(normalized.replace(/#.*$/, ''));
  }
}

/**
 * Resolve relative URL to absolute
 */
export function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extract URL pattern by replacing numbers with placeholders
 * e.g., /chapter/123/456.html -> /chapter/{N}/{N}.html
 */
export function extractUrlPattern(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\d+/g, '{N}');
  } catch {
    return url.replace(/\d+/g, '{N}');
  }
}

/**
 * Extract book ID from URL for same-book filtering
 */
export function extractBookId(url: string): string | null {
  try {
    const u = new URL(url);
    const patterns = [
      /\/book\/(\d+)/,
      /\/chapter\/(\d+)\//,
      /\/(\d+)\/\d+(?:\.html?)?$/,
      /\/(\d+)_\d+(?:\.html?)?$/,
      /[?&](?:book_?id|bid|id)=(\d+)/i,
    ];
    for (const p of patterns) {
      const m = u.pathname.match(p) || u.search.match(p);
      if (m) return m[1];
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Extract chapter number from title for sorting
 */
export function extractChapterNumber(title: string): number | null {
  // 1. "第123章" / "第 123 章" / "第123话"
  const match1 = title.match(/第\s*(\d+)\s*[章节回话篇集卷]/);
  if (match1) return parseInt(match1[1], 10);

  // 2. "123." / "123 " / "123、" at start
  const match2 = title.match(/^(\d+)[.、\s]/);
  if (match2) return parseInt(match2[1], 10);

  // 3. "Chapter 123"
  const match3 = title.match(/Chapter\s*(\d+)/i);
  if (match3) return parseInt(match3[1], 10);

  return null;
}

/**
 * Normalize text for TOC pager detection
 */
export function normalizeTocPagerText(text: string): string {
  return text.replace(/\s+/g, '').trim();
}

/**
 * Check if text indicates a TOC next page
 */
export function isTocNextPageText(text: string): boolean {
  const t = normalizeTocPagerText(text).toLowerCase();
  if (!t) return false;
  if (t.includes('下一页') || t.includes('下页') || t.includes('下一頁') || t.includes('下頁')) {
    return true;
  }
  if (t.includes('next') && !t.includes('chapter') && (t.includes('page') || t === 'next')) {
    return true;
  }
  return false;
}

/**
 * Normalize URL for comparison (for TOC)
 */
export function normalizeUrlForCompare(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Extract TOC pagination seed from URL
 */
export function extractTocPaginationSeed(indexUrl: string): string | null {
  try {
    const u = new URL(indexUrl);
    const m = u.pathname.match(/\/(\d{3,})(?:[/?]|$)/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Check if candidate URL is valid for TOC pagination
 */
export function isValidTocPaginationUrl(candidateUrl: string, indexUrl: string): boolean {
  try {
    const c = new URL(candidateUrl);
    const idx = new URL(indexUrl);
    if (c.protocol !== 'http:' && c.protocol !== 'https:') return false;
    if (c.origin !== idx.origin) return false;

    const seed = extractTocPaginationSeed(indexUrl);
    if (seed && !c.pathname.includes(seed)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate exponential backoff delay in milliseconds.
 * @param failureCount - Number of consecutive failures (1-based)
 * @param baseMs - Base delay in ms (default: 1500)
 * @param maxMs - Maximum delay cap in ms (default: 30000)
 */
export function calculateBackoff(failureCount: number, baseMs = 1500, maxMs = 30000): number {
  return Math.min(baseMs * Math.pow(2, failureCount - 1), maxMs);
}
