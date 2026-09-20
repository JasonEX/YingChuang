import type { SiteRule } from '@/core/rules/types';

import {
  extractBookId,
  extractChapterNumber,
  extractUrlPattern,
  isTocNextPageText,
  isValidTocPaginationUrl,
  normalizeUrlForCompare,
  normalizeUrlForFetch,
  resolveUrl,
} from './utils';
import { specialTocTitleCleaners } from './tocProviders';
import type { TocEntry } from './types';

/** Chapter title whitelist patterns */
const CHAPTER_TITLE_PATTERNS = [
  /^.{0,10}第.{1,10}[章节回话篇集卷]/,
  /^\d{1,4}[.、\s]/,
  /^(序章|序幕|楔子|引子|终章|尾声|番外|后记|前言)/,
  /^chapter\s*\d+/i,
  /^(prologue|epilogue|preface)/i,
];

/** Non-chapter title patterns (blacklist) */
const NON_CHAPTER_TITLE_PATTERNS = [
  /^(公告|通知|声明|说明|必读|注意|警告|温馨提示)/,
  /上架感言|完本感言|请假|推迟|停更|断更|更新|爆更|上架通知|卷末感言/,
  /必看|必读|请务必阅读|读者必看/,
  /^(作者|关于作者|作品相关|设定|世界观|人物介绍|角色)/,
  /求.*票|求.*收藏|求.*订阅|求.*打赏|求.*推荐|求.*支持/,
  /新书|推荐|安利|宣传|书单|书评/,
  /^(目录|封面|简介|内容简介|书籍信息|作品信息)/,
  /^(VIP|付费|锁定|未解锁|需订阅|加入书架)$/i,
  /官网|公众号|微信|QQ群|粉丝群|书友群|交流群|读者群/,
  /登[录陆]|注册|充值|书架|书城|排行|分类|搜索|设置/,
  /首页|返回|上一页|下一页|翻页/,
  /^(章节|分卷|卷|部|篇)\s*[\d一二三四五六七八九十百千]+\s*$/,
  /^(正文|番外|VIP卷?|免费章节?)\s*$/,
];

/**
 * Check if a title matches chapter patterns (whitelist)
 */
function isLikelyChapterTitle(title: string): boolean {
  const t = title.trim();
  return CHAPTER_TITLE_PATTERNS.some(p => p.test(t));
}

/**
 * Check if a title looks like a non-chapter entry (blacklist)
 */
function isNonChapterTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 2) return true;
  return NON_CHAPTER_TITLE_PATTERNS.some(p => p.test(t));
}

/**
 * Check if a title is a placeholder
 */
function isPlaceholderTocTitle(title: string): boolean {
  return /^章节\s*\d+$/i.test(title.trim());
}

/**
 * Compare titles to determine which is better
 */
function isBetterTocTitle(oldTitle: string, newTitle: string): boolean {
  const oldWhitelist = isLikelyChapterTitle(oldTitle);
  const newWhitelist = isLikelyChapterTitle(newTitle);

  if (newWhitelist && !oldWhitelist) return true;
  if (oldWhitelist && !newWhitelist) return false;

  if (!isPlaceholderTocTitle(oldTitle) && isPlaceholderTocTitle(newTitle)) return false;
  if (isPlaceholderTocTitle(oldTitle) && !isPlaceholderTocTitle(newTitle)) return true;

  return newTitle.length > oldTitle.length;
}

/**
 * Extract chapter title from link element
 */
function extractTocLinkTitle(a: Element): string {
  // Method 1: Try common title selectors
  const titleSelectors = [
    '[class*="chapterItemTitle"]',
    '[class*="chapter-title"]',
    '[class*="chapterTitle"]',
    '.line_1',
    'h2',
    'h3',
  ];

  for (const sel of titleSelectors) {
    const el = a.querySelector(sel);
    if (el) {
      const text = (el.textContent || '').trim();
      if (text) return text;
    }
  }

  // Method 2: Check for p elements
  const firstP = a.querySelector('p');
  if (firstP) {
    const allP = a.querySelectorAll('p');
    if (allP.length > 1) {
      const text = (firstP.textContent || '').trim();
      if (text) return text;
    }
  }

  // Method 3: Get direct text content only
  let directText = '';
  for (const node of Array.from(a.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent || '';
    }
  }
  directText = directText.trim();
  if (directText) return directText;

  return (a.textContent || '').trim();
}

function cleanTocTitleForUrl(title: string, url: string): string {
  let cleaned = title.trim();

  for (const cleaner of specialTocTitleCleaners) {
    cleaned = cleaner.clean(cleaned, url);
  }

  return cleaned;
}

/**
 * Smart filter TOC entries based on URL pattern analysis and title filtering
 */
export function filterTocEntries(entries: TocEntry[]): TocEntry[] {
  if (entries.length < 5) return entries;

  // Step 0: Same-book filtering
  const bookIdCounts = new Map<string, number>();
  for (const entry of entries) {
    const bookId = extractBookId(entry.url);
    if (bookId) {
      bookIdCounts.set(bookId, (bookIdCounts.get(bookId) || 0) + 1);
    }
  }

  let dominantBookId: string | null = null;
  let maxCount = 0;
  for (const [bookId, count] of bookIdCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantBookId = bookId;
    }
  }

  const sameBookEntries =
    dominantBookId && maxCount >= 5
      ? entries.filter(entry => {
          const bookId = extractBookId(entry.url);
          return !bookId || bookId === dominantBookId;
        })
      : entries;

  // Step 1: Count URL patterns
  const patternCounts = new Map<string, number>();

  for (const entry of sameBookEntries) {
    const pattern = extractUrlPattern(entry.url);
    patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
  }

  // Step 2: Find dominant pattern(s)
  const sortedPatterns = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1]);
  const dominantPatterns = new Set<string>();
  const totalEntries = sameBookEntries.length;

  for (const [pattern, count] of sortedPatterns) {
    const ratio = count / totalEntries;
    if (count >= 5 || ratio > 0.3) {
      dominantPatterns.add(pattern);
      const coveredCount = Array.from(dominantPatterns).reduce(
        (sum, p) => sum + (patternCounts.get(p) || 0),
        0
      );
      if (coveredCount / totalEntries > 0.9) break;
    }
  }

  if (dominantPatterns.size === 0 && sortedPatterns.length > 0) {
    dominantPatterns.add(sortedPatterns[0][0]);
  }

  // Step 3: Score and filter entries
  const scoredEntries = sameBookEntries.map(entry => {
    let score = 0;
    const pattern = extractUrlPattern(entry.url);

    if (dominantPatterns.has(pattern)) {
      score += 2;
    }

    const matchesWhitelist = isLikelyChapterTitle(entry.title);
    if (matchesWhitelist) {
      score += 1;
    }

    if (!matchesWhitelist && isNonChapterTitle(entry.title)) {
      score -= 2;
    }

    return { entry, score };
  });

  const filtered = scoredEntries.filter(({ score }) => score >= 1).map(({ entry }) => entry);

  if (filtered.length < sameBookEntries.length * 0.3 || filtered.length < 10) {
    const lenientFiltered = sameBookEntries.filter(entry => !isNonChapterTitle(entry.title));
    if (lenientFiltered.length >= filtered.length) {
      return sortTocEntries(lenientFiltered);
    }
  }

  return sortTocEntries(filtered);
}

/**
 * Detect list order and sort/reverse if necessary
 */
export function sortTocEntries(entries: TocEntry[]): TocEntry[] {
  if (entries.length < 5) return entries;

  const entriesWithNum = entries
    .map((entry, index) => ({
      index,
      entry,
      num: extractChapterNumber(entry.title),
    }))
    .filter(item => item.num !== null);

  if (entriesWithNum.length < entries.length * 0.3 || entriesWithNum.length < 3) {
    return entries;
  }

  let descendingPairs = 0;
  let ascendingPairs = 0;

  for (let i = 0; i < entriesWithNum.length - 1; i++) {
    const diff = entriesWithNum[i + 1].num! - entriesWithNum[i].num!;
    if (diff < 0) descendingPairs++;
    else if (diff > 0) ascendingPairs++;
  }

  const totalPairs = descendingPairs + ascendingPairs;
  if (totalPairs > 0 && descendingPairs / totalPairs > 0.6) {
    return [...entries].reverse();
  }

  return entries;
}

/**
 * Deduplicate TOC entries while preserving the last occurrence position
 */
export function dedupeTocEntries(candidates: TocEntry[]): TocEntry[] {
  const seenUrls = new Map<string, TocEntry>();
  const results: TocEntry[] = [];

  for (let i = candidates.length - 1; i >= 0; i--) {
    const entry = candidates[i];
    if (seenUrls.has(entry.url)) {
      const existing = seenUrls.get(entry.url)!;
      if (isBetterTocTitle(existing.title, entry.title)) {
        existing.title = entry.title;
      }
    } else {
      seenUrls.set(entry.url, entry);
      results.unshift(entry);
    }
  }

  return results;
}

/**
 * Collect TOC candidates from a document
 */
export function collectTocCandidates(doc: Document, base: string, rule?: SiteRule): TocEntry[] {
  const textPattern = /(第.{1,20}[章节回话篇集卷幕]|[章回节話幕]|chapter|\d+)/i;
  const urlPattern =
    /(chapter|read|book|novel|txt|\/\d+)[/_-]\d+|\/\d+\.html?$|\/xs_[^/]+\/\d+\/\d+(?:\/\d+)?/i;
  const excludeAncestors = (rule?.toc?.excludeAncestors || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const candidates: TocEntry[] = [];
  const collect = (root: ParentNode): void => {
    for (const a of root.querySelectorAll('a[href], template')) {
      if (excludeAncestors.length > 0) {
        let excluded = false;
        for (const sel of excludeAncestors) {
          try {
            if (a.closest(sel)) {
              excluded = true;
              break;
            }
          } catch {
            // Ignore invalid selectors
          }
        }
        if (excluded) continue;
      }

      // Collapsed server-rendered lists can live in inert templates. Read their
      // links in place without executing scripts or mounting site components.
      if (a.tagName === 'TEMPLATE') {
        collect((a as HTMLTemplateElement).content);
        continue;
      }

      const text = extractTocLinkTitle(a);
      const href = a.getAttribute('href') || '';
      const abs = resolveUrl(href, base);
      if (!abs) continue;
      const url = normalizeUrlForFetch(abs);

      if (!(textPattern.test(text) || urlPattern.test(href))) {
        continue;
      }

      const title = cleanTocTitleForUrl(text || `章节 ${candidates.length + 1}`, url);
      candidates.push({ title, url });
    }
  };
  if (rule?.toc?.selector) {
    for (const root of doc.querySelectorAll(rule.toc.selector)) collect(root);
  } else {
    collect(doc);
  }

  return candidates;
}

/**
 * Find next TOC page URL
 */
export function findNextTocPageUrl(
  doc: Document,
  currentPageUrl: string,
  indexUrl: string
): string | null {
  const currentNorm = normalizeUrlForCompare(currentPageUrl);

  const pushCandidate = (
    candidates: Array<{ url: string; score: number }>,
    href: string,
    score: number
  ) => {
    const abs = resolveUrl(href, currentPageUrl);
    if (!abs) return;
    const absNorm = normalizeUrlForCompare(abs);
    if (absNorm === currentNorm) return;
    if (!isValidTocPaginationUrl(abs, indexUrl)) return;
    candidates.push({ url: abs, score });
  };

  const candidates: Array<{ url: string; score: number }> = [];

  // 1) <link rel="next" href="...">
  const linkNext = doc.querySelector('link[rel="next"][href]')?.getAttribute('href');
  if (linkNext) {
    pushCandidate(candidates, linkNext, 100);
  }

  // 2) <a rel="next" href="...">
  const aRelNext = doc.querySelector('a[rel~="next"][href]')?.getAttribute('href');
  if (aRelNext) {
    pushCandidate(candidates, aRelNext, 90);
  }

  // 3) Text-based paging links
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const text = a.textContent || '';
    if (!isTocNextPageText(text)) continue;

    const href = a.getAttribute('href');
    if (!href) continue;

    let score = 50;
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    if (rel.includes('next')) score += 10;
    const cls = (a.getAttribute('class') || '').toLowerCase();
    if (cls.includes('next')) score += 3;
    if (a.closest('.pager, .pagination, .page, .pagebar, .caption, nav')) score += 2;

    pushCandidate(candidates, href, score);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}
