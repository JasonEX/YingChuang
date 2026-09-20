/**
 * NavigationDetector - Detect prev/next/index navigation links
 * Also detects multi-page chapters (分页章节)
 */

import {
  CHAPTER_TEXT_PATTERNS,
  NON_CHAPTER_ENDPOINT_PATTERNS,
  SECTION_TEXT_PATTERNS,
} from '@/core/constants';
import { generateCssSelector, isSectionLikeUrl } from '@/core/utils';
import { NAV_PATTERNS, NavigationResult, NavLinkResult, SectionDetectionResult } from './types';
import { getRuleManager } from '@/core/rules/RuleManager';
import { parseChapterSectionFromPathname } from '@/core/utils/sectionPath';

/** URLs to ignore as navigation links */
const INVALID_URL_PATTERNS = [
  /(?:index|list|last|LastPage|end)\.(?:html?|php|aspx)/i,
  /^javascript:/i,
  /BuyChapterUnLogin/i,
  /\/0\.html$/i,
  ...NON_CHAPTER_ENDPOINT_PATTERNS,
  // Homepage/root path patterns
  /^https?:\/\/[^/]+\/?$/i, // Root domain only (e.g., https://www.qidian.com/)
  /^https?:\/\/[^/]+\/(?:index|home|main)?\.?(?:html?|php|aspx)?$/i, // /index.html, /home.php
  /^https?:\/\/[^/]+\/\?/i, // Root with query string (e.g., https://example.com/?ref=xxx)
];

/** Pre-collected signal for a single <a> element */
type NavPurpose = 'next' | 'prev' | 'index';

interface LinkTarget {
  href: string;
  url: URL;
}

interface LinkSignal {
  anchor: HTMLAnchorElement;
  href: string; // resolved URL
  url: URL;
  text: string; // textContent trimmed
  normalizedText: string;
  title: string; // title attribute
  rel: string; // rel attribute
}

interface NavCandidate {
  element: HTMLAnchorElement;
  score: number;
  text: string;
  href: string;
  method: NavLinkResult['method'];
  confidence?: number;
}

type NavCandidateMap = Record<NavPurpose, NavCandidate[]>;

const NAV_PURPOSES: readonly NavPurpose[] = ['next', 'prev', 'index'];

function normalizeLinkText(text: string): string {
  return text.replace(/\s+/g, '').trim();
}

function resolveLinkTarget(anchor: HTMLAnchorElement, baseUrl: string): LinkTarget | null {
  const rawHref = anchor.getAttribute('href');
  if (!rawHref) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawHref, baseUrl);
  } catch {
    return null;
  }

  // Only allow http(s) navigation targets.
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null;
  }

  return {
    href: parsedUrl.toString(),
    url: parsedUrl,
  };
}

function isValidSignalLink(signal: LinkSignal, purpose: NavPurpose, currentUrl: string): boolean {
  const { href, text, url: parsedUrl } = signal;

  // Skip invalid URL patterns
  // NOTE: index/list URLs are often valid *for目录页*; don't filter them for index purpose.
  for (const pattern of INVALID_URL_PATTERNS) {
    if (pattern.test(href)) {
      if (purpose === 'index') {
        // If link text looks like directory or book title, allow list/index pages.
        const looksLikeIndex = NAV_PATTERNS.index.some(p => p.test(text));
        const looksLikeBookTitle = /^《.+》$/.test(text);
        if (looksLikeIndex || looksLikeBookTitle) continue;
      }
      return false;
    }
  }

  // Skip anchor-only links (unless they contain chapter info)
  if (href.includes('#') && !href.includes('#chapter')) {
    try {
      const currentPathname = new URL(currentUrl).pathname;
      if (parsedUrl.pathname === currentPathname) {
        return false;
      }
    } catch {
      // If URL parsing fails, fall through and treat as potentially valid.
    }
  }

  // Skip URLs that are clearly not chapter pages
  try {
    const pathname = parsedUrl.pathname;

    // Skip if pathname is too short (likely homepage or section page)
    // But allow for index purpose if it looks like a book directory
    if (pathname === '/' || pathname.length < 3) {
      // For index links, allow directory paths like /book3/7748/
      if (purpose === 'index' && pathname.length >= 3) {
        // Allow if it looks like a book title link
        const looksLikeBookTitle = /^《.+》$/.test(text);
        if (looksLikeBookTitle) {
          return true;
        }
      }
      return false;
    }

    // 如果只有一个路径部分，检查是否像章节 URL
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      // 单路径部分：必须包含数字才可能是章节
      // 允许: /412421_1.html, /123.html, /chapter123
      // 排除: /book, /novel, /index.html (无数字)
      const part = pathParts[0] || '';
      if (!/\d/.test(part)) {
        // Some sites use slug-like chapter URLs without digits (e.g. /next.html).
        // Allow them only when link text strongly indicates navigation purpose.
        const looksLikeNav =
          NAV_PATTERNS[purpose].some(p => p.test(text)) ||
          CHAPTER_TEXT_PATTERNS.some(p => p.test(text)) ||
          SECTION_TEXT_PATTERNS.some(p => p.test(text));

        if (!looksLikeNav) {
          return false;
        }
      }
    }

    // For index purpose, allow directory paths (ending with /)
    if (purpose === 'index' && pathname.endsWith('/')) {
      return true;
    }

    // Skip common non-chapter paths
    const nonChapterPaths = [
      /^\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)/i,
      /^\/(?:book|novel|xiaoshuo|info)\/?\d*\/?$/i, // /book/ or /book/123/ without chapter
    ];
    for (const pattern of nonChapterPaths) {
      if (pattern.test(pathname)) return false;
    }
  } catch {
    // URL parsing failed, continue
  }

  return true;
}

export class NavigationDetector {
  private resolveBaseUrl(doc: Document, currentUrl?: string): string {
    const candidates: Array<string | undefined> = [
      currentUrl,
      doc.location?.href,
      (doc as Document & { _mnrUrl?: string })._mnrUrl,
      typeof window !== 'undefined' ? window.location.href : undefined,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const u = new URL(candidate);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          return u.toString();
        }
      } catch {
        // ignore
      }
    }

    return candidates.find(Boolean) || '';
  }

  private resolveLinkTarget(anchor: HTMLAnchorElement, baseUrl: string): LinkTarget | null {
    return resolveLinkTarget(anchor, baseUrl);
  }

  /**
   * Single-pass DOM scan: collect all link signals from the document.
   */
  private collectLinkSignals(doc: Document, baseUrl: string): LinkSignal[] {
    const anchors = doc.querySelectorAll<HTMLAnchorElement>('a[href]');
    const signals: LinkSignal[] = [];

    for (const anchor of anchors) {
      const target = this.resolveLinkTarget(anchor, baseUrl);
      if (!target) continue;

      const text = anchor.textContent?.trim() || '';
      const title = anchor.title || '';

      signals.push({
        anchor,
        href: target.href,
        url: target.url,
        text,
        normalizedText: normalizeLinkText(text),
        title,
        rel: (anchor.getAttribute('rel') || '').toLowerCase(),
      });
    }

    return signals;
  }

  /**
   * Detect all navigation links in the document
   */
  detect(doc: Document, currentUrl?: string): NavigationResult {
    const resolvedCurrentUrl = this.resolveBaseUrl(doc, currentUrl);
    const signals = this.collectLinkSignals(doc, resolvedCurrentUrl);

    // Store signals for detectSection to reuse
    this._lastSignals = signals;
    this._lastBaseUrl = resolvedCurrentUrl;
    const candidates = this.scoreNavigationLinks(signals, resolvedCurrentUrl);

    return {
      next: this.pickNavLink(candidates.next),
      prev: this.pickNavLink(candidates.prev),
      index: this.pickNavLink(candidates.index),
    };
  }

  /** Cached signals from the last detect() call, reused by detectSection() */
  private _lastSignals: LinkSignal[] = [];
  private _lastBaseUrl = '';

  private scoreNavigationLinks(signals: LinkSignal[], currentUrl: string): NavCandidateMap {
    const candidates: NavCandidateMap = {
      next: [],
      prev: [],
      index: [],
    };

    for (const signal of signals) {
      for (const type of NAV_PURPOSES) {
        const candidate = this.scoreSignalForNav(signal, type, currentUrl);
        if (candidate) candidates[type].push(candidate);
      }
    }

    return candidates;
  }

  private scoreSignalForNav(
    signal: LinkSignal,
    type: NavPurpose,
    currentUrl: string
  ): NavCandidate | null {
    const patterns = NAV_PATTERNS[type];

    if (type !== 'index' && signal.rel === type && isValidSignalLink(signal, type, currentUrl)) {
      return {
        element: signal.anchor,
        href: signal.href,
        score: 1000,
        confidence: 0.95,
        method: 'rel-attribute',
        text: signal.text,
      };
    }

    let score = 0;
    let matchedTextPattern = false;
    for (const pattern of patterns) {
      if (pattern.test(signal.text)) {
        matchedTextPattern = true;
        score += 10;
        // Exact/short match bonus
        if (signal.text.length <= 5) score += 5;
      }
    }

    // Prefer real chapter navigation over section pagination when both exist.
    // This keeps "下一章/上一章" higher than "下一页/上一页" for next/prev detection.
    if ((type === 'next' || type === 'prev') && matchedTextPattern) {
      const isChapter = CHAPTER_TEXT_PATTERNS.some(p => p.test(signal.text));
      const isSection = SECTION_TEXT_PATTERNS.some(p => p.test(signal.text));
      if (isChapter) score += 3;
      if (isSection && !isChapter) score -= 2;
    }

    // For index links, also recognize book title links (wrapped in 《》)
    // Many sites use book title as the index/catalog link
    if (type === 'index') {
      // Book title pattern: 《书名》
      if (/^《.+》$/.test(signal.text)) {
        score += 8;
      }
      // URL points to directory (ends with / or is index.html)
      if (signal.href.endsWith('/') || /\/index\.html?$/i.test(signal.href)) {
        score += 3;
      }
    }

    // Check title attribute too
    if (signal.title) {
      for (const pattern of patterns) {
        if (pattern.test(signal.title)) {
          score += 5;
        }
      }
    }

    // Penalty for long text (likely not a nav link)
    if (signal.text.length > 20) {
      score -= 5;
    }

    if (score <= 0) return null;
    if (!isValidSignalLink(signal, type, currentUrl)) return null;

    return {
      element: signal.anchor,
      score: score + this.getPositionBonus(signal.anchor),
      text: signal.text,
      href: signal.href,
      method: 'text-matching',
    };
  }

  private pickNavLink(candidates: NavCandidate[]): NavLinkResult | null {
    if (candidates.length === 0) return null;

    // Sort by score and return best
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    return {
      element: best.element,
      url: best.href,
      selector: this.generateSelector(best.element),
      confidence: best.confidence ?? Math.min(best.score / 15, 0.9),
      method: best.method,
      text: best.text,
    };
  }

  private getPositionBonus(anchor: HTMLAnchorElement): number {
    try {
      const rect = anchor.getBoundingClientRect();
      const doc = anchor.ownerDocument;
      const scrollHeight = doc.documentElement?.scrollHeight || 0;
      if (rect.top < 300 || (scrollHeight > 0 && rect.top > scrollHeight - 300)) {
        return 2;
      }
    } catch {
      // Layout reads may fail for detached/cross-realm elements.
    }
    return 0;
  }

  /**
   * Validate navigation by comparing URLs
   * Useful to ensure next/prev links follow expected pattern
   */
  validateNavigation(currentUrl: string, navigation: NavigationResult): NavigationResult {
    // Extract chapter number from current URL if possible
    const currentNum = this.extractChapterNumber(currentUrl);
    if (currentNum === null) return navigation;

    // Validate next link
    if (navigation.next) {
      const nextNum = this.extractChapterNumber(navigation.next.url);
      if (nextNum !== null && nextNum !== currentNum + 1) {
        // Reduce confidence if chapter numbers don't match expected pattern
        navigation.next.confidence *= 0.7;
      }
    }

    // Validate prev link
    if (navigation.prev) {
      const prevNum = this.extractChapterNumber(navigation.prev.url);
      if (prevNum !== null && prevNum !== currentNum - 1) {
        navigation.prev.confidence *= 0.7;
      }
    }

    return navigation;
  }

  /**
   * Try to extract chapter number from URL
   */
  private extractChapterNumber(url: string): number | null {
    // Common patterns: /123.html, /chapter/123, /123_456.html
    const patterns = [
      /\/(\d+)\.html?$/i,
      /\/chapter\/(\d+)/i,
      /\/(\d+)_\d+\.html?$/i,
      /_(\d+)\.html?$/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * Detect if current page is part of a multi-page chapter (分页章节)
   * This enables automatic section merging without manual rule configuration
   */
  detectSection(
    doc: Document,
    currentUrl: string,
    navigation: NavigationResult
  ): SectionDetectionResult {
    // Reuse signals from detect() if available, otherwise collect fresh
    const baseUrl = this.resolveBaseUrl(doc, currentUrl);
    const signals =
      this._lastSignals.length > 0 && this._lastBaseUrl === baseUrl
        ? this._lastSignals
        : this.collectLinkSignals(doc, baseUrl);

    const result: SectionDetectionResult = {
      isSection: false,
      currentSection: null,
      nextSectionUrl: null,
      nextChapterUrl: null,
      confidence: 0,
      method: 'none',
    };

    // Strategy 1: Check current URL pattern
    const urlSectionInfo = this.extractSectionFromUrl(currentUrl);
    if (urlSectionInfo) {
      result.isSection = true;
      result.currentSection = urlSectionInfo.section;
      result.confidence = 0.8;
      result.method = 'url-pattern';
    }

    // Strategy 2: Check navigation link text
    if (navigation.next) {
      const nextText = navigation.next.text || '';
      const isNextSection = SECTION_TEXT_PATTERNS.some(p => p.test(nextText));
      const isNextChapter = CHAPTER_TEXT_PATTERNS.some(p => p.test(nextText));

      if (isNextSection && !isNextChapter) {
        const nextUrl = navigation.next.url;
        const comparison = this.compareUrlsForSection(currentUrl, nextUrl);
        if (comparison.isSection) {
          // "下一页" type link - this is a section navigation within the same chapter
          result.isSection = true;
          result.nextSectionUrl = nextUrl;
          result.confidence = Math.max(result.confidence, 0.9);
          result.method = 'link-text';
        } else {
          // Some templates use "下一页" as cross-chapter navigation (上一页/下一页 across chapters).
          // Treat it as next chapter candidate, not a section page.
          result.nextChapterUrl = result.nextChapterUrl || nextUrl;
        }
      } else if (isNextChapter) {
        // "下一章" type link - this is chapter navigation
        result.nextChapterUrl = navigation.next.url;
      }
    }

    // Strategy 3: Compare current URL with next URL pattern
    if (navigation.next && !result.isSection) {
      const nextUrl = navigation.next.url;
      const comparison = this.compareUrlsForSection(currentUrl, nextUrl);

      if (comparison.isSection) {
        result.isSection = true;
        result.nextSectionUrl = nextUrl;
        result.confidence = Math.max(result.confidence, comparison.confidence);
        result.method = 'url-comparison';
      }
    }

    // Strategy 4: Generic navigation may miss "Continue" style section links.
    // Keep URL-pattern section discovery in section detection, not in generic nav scoring.
    if (!result.isSection && !result.nextSectionUrl) {
      const nextSectionUrl = this.findNextSectionUrlByPattern(signals, currentUrl);
      if (nextSectionUrl) {
        result.isSection = true;
        result.nextSectionUrl = nextSectionUrl;
        result.confidence = Math.max(result.confidence, 0.85);
        result.method = 'url-comparison';
      }
    }

    // Strategy 5: Check prev link for section indicators
    if (navigation.prev && !result.isSection) {
      const prevText = navigation.prev.text || '';
      const isPrevSection = SECTION_TEXT_PATTERNS.some(p => p.test(prevText));

      if (isPrevSection) {
        const prevUrl = navigation.prev.url;
        // Validate it's the previous section within the same chapter.
        // compareUrlsForSection expects current->next, so use prev as current and currentUrl as next.
        const comparison = this.compareUrlsForSection(prevUrl, currentUrl);
        if (comparison.isSection) {
          result.isSection = true;
          result.currentSection = this.extractSectionFromUrl(currentUrl)?.section ?? null;
          result.confidence = Math.max(result.confidence, 0.85);
          result.method = 'link-text';
        }
      }
    }

    // Strategy 6: Even if navigation.next prefers "下一章", still try to find an explicit "下一页" link.
    // Some templates show both links, and we must not stop merging early.
    if (!result.nextSectionUrl) {
      const nextSectionUrl = this.findNextSectionUrl(signals, currentUrl);
      if (nextSectionUrl) {
        result.isSection = true;
        result.nextSectionUrl = nextSectionUrl;
        result.confidence = Math.max(result.confidence, 0.9);
        if (result.method === 'none') result.method = 'link-text';
      }
    }

    // If we detected a section but don't have nextChapterUrl, try to find it
    if (result.isSection && !result.nextChapterUrl) {
      result.nextChapterUrl = this.findNextChapterUrl(signals, currentUrl);
    }

    return result;
  }

  /**
   * Extract section number from URL
   * Returns { section } or null
   */
  private extractSectionFromUrl(url: string): { section: number } | null {
    try {
      const parsed = new URL(url);
      const info = parseChapterSectionFromPathname(parsed.pathname);
      if (!info) return null;
      if (info.section > 1) {
        return { section: info.section };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Compare two URLs to detect section relationship
   */
  private compareUrlsForSection(
    currentUrl: string,
    nextUrl: string
  ): { isSection: boolean; confidence: number } {
    try {
      const current = new URL(currentUrl);
      const next = new URL(nextUrl);

      // Must be same host
      if (current.host !== next.host) {
        return { isSection: false, confidence: 0 };
      }

      const currentPath = current.pathname;
      const nextPath = next.pathname;

      // A self-link (including a different fragment) cannot advance a section.
      if (currentPath === nextPath && current.search === next.search) {
        return { isSection: false, confidence: 0 };
      }

      // Fast path: strict section-like detection (includes query-based pagination).
      if (isSectionLikeUrl(currentUrl, nextUrl, url => getRuleManager().parseSectionUrl(url))) {
        const currentInfo = parseChapterSectionFromPathname(currentPath);
        const nextInfo = parseChapterSectionFromPathname(nextPath);
        if (
          currentInfo &&
          nextInfo &&
          currentInfo.chapterKey === nextInfo.chapterKey &&
          nextInfo.section === currentInfo.section + 1 &&
          nextInfo.section > 1
        ) {
          return { isSection: true, confidence: 0.95 };
        }

        // Query-based (or non-path) pagination: reliable enough but slightly lower confidence.
        return { isSection: true, confidence: 0.85 };
      }

      return { isSection: false, confidence: 0 };
    } catch {
      return { isSection: false, confidence: 0 };
    }
  }

  private findNextSectionUrl(signals: LinkSignal[], currentUrl: string): string | null {
    const isNextSectionText = (normalizedText: string): boolean => {
      if (!normalizedText) return false;
      // Only accept forward paging labels ("下一页/下页"), avoid picking "上一页".
      if (
        normalizedText.includes('下一页') ||
        normalizedText.includes('下页') ||
        normalizedText.includes('下一頁') ||
        normalizedText.includes('下頁')
      ) {
        return true;
      }
      // Conservative English fallback
      const lowerText = normalizedText.toLowerCase();
      if (lowerText.includes('next') && !lowerText.includes('chapter')) {
        return true;
      }
      return false;
    };

    const candidates: Array<{ url: string; score: number }> = [];
    for (const signal of signals) {
      const { anchor, href, normalizedText, text, rel } = signal;
      if (!text) continue;

      const isSection = SECTION_TEXT_PATTERNS.some(p => p.test(text));
      const isChapter = CHAPTER_TEXT_PATTERNS.some(p => p.test(text));
      if (!isSection || isChapter) continue;
      if (!isNextSectionText(normalizedText)) continue;
      if (!isValidSignalLink(signal, 'next', currentUrl)) continue;

      const comparison = this.compareUrlsForSection(currentUrl, href);
      if (!comparison.isSection) continue;

      let score = 50;
      if (text.length <= 5) score += 5;
      if (rel.includes('next')) score += 5;
      if (anchor.closest('.pager, .pagination, .page, nav, footer')) score += 2;
      score += Math.round(comparison.confidence * 10);

      candidates.push({ url: href, score });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
  }

  private findNextSectionUrlByPattern(signals: LinkSignal[], currentUrl: string): string | null {
    const candidates: Array<{ url: string; score: number }> = [];

    for (const signal of signals) {
      const { href, normalizedText, rel } = signal;
      if (/上一|上页|上一頁|上頁|prev(?:ious)?/i.test(normalizedText)) continue;
      if (!isValidSignalLink(signal, 'next', currentUrl)) continue;

      const comparison = this.compareUrlsForSection(currentUrl, href);
      if (!comparison.isSection) continue;

      let score = Math.round(comparison.confidence * 100);
      if (rel.includes('next')) score += 5;
      candidates.push({ url: href, score });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
  }

  /**
   * Try to find the next chapter URL (skipping remaining sections)
   */
  private findNextChapterUrl(signals: LinkSignal[], currentUrl: string): string | null {
    // Look for links with "下一章/下一节/后一章/next" text (forward only)
    for (const signal of signals) {
      const { href, normalizedText, text } = signal;
      const isForward =
        /下一/.test(normalizedText) ||
        /下[章节篇话]/.test(normalizedText) ||
        /后一章/.test(normalizedText) ||
        /next/i.test(normalizedText);
      if (!isForward) continue;

      // Must match chapter pattern, not section pattern
      const isChapter = CHAPTER_TEXT_PATTERNS.some(p => p.test(text));
      const isSection = SECTION_TEXT_PATTERNS.some(p => p.test(text));

      if (isChapter && !isSection && isValidSignalLink(signal, 'next', currentUrl)) {
        // Verify it's a different chapter, not the same chapter's section
        const comparison = this.compareUrlsForSection(currentUrl, href);
        if (!comparison.isSection) {
          return href;
        }
      }
    }

    return null;
  }

  /**
   * Generate a CSS selector for a link element
   */
  private generateSelector(element: Element): string {
    return generateCssSelector(element);
  }
}
