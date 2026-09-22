/**
 * Parser - Main content parser using detection engine and rules
 */

import { type ChineseScript, inferChineseScript } from '@/core/converter/scriptProfile';
import { ContentProcessor, ProcessingOptions } from './ContentProcessor';
import {
  DetectionEngine,
  type DetectionEngineResult,
  type NavigationResult,
  type SectionDetectionResult,
} from '@/core/detection';
import { HookFetchOptions, HookHelpers, RuleMatchResult, SiteRule } from '@/core/rules/types';
import { getRuleManager } from '@/core/rules/RuleManager';
import { resolveAndValidateHttpUrl } from '@/core/utils/network';

const MIN_DYNAMIC_TEXT_LENGTH = 80;
const GLOBAL_DYNAMIC_WAIT_MS = 600;
const RULE_DYNAMIC_WAIT_MS = 1500;
const DYNAMIC_SCROLL_STABLE_MS = 200;
const DYNAMIC_SCROLL_DELAY_MS = 120;
const DYNAMIC_SCROLL_MAX_STEPS = 10;

/** Parsed chapter data */
export interface ParsedChapter {
  /** Chapter title */
  title: string;
  /** Book title (if detected) */
  bookTitle?: string;
  /** Processed HTML content */
  content: string;
  /** Raw HTML content (before processing) */
  rawContent: string;
  /** Previous chapter URL */
  prevUrl?: string;
  /** Next chapter URL */
  nextUrl?: string;
  /** Index/TOC URL */
  indexUrl?: string;
  /** Current page URL */
  url: string;
  /** Detection confidence */
  confidence: number;
  /** Rule used (if any) */
  rule?: SiteRule;
  /** Detection method */
  method: 'rule' | 'detection' | 'mixed';
  /** Source Chinese/Japanese script inferred from page metadata or content */
  sourceScript?: ChineseScript;
}

/** Parser options */
export interface ParserOptions {
  /** Force use detection even if rule exists */
  forceDetection?: boolean;
  /** Processing options */
  processing?: ProcessingOptions;
}

export class Parser {
  private detectionEngine: DetectionEngine;
  private contentProcessor: ContentProcessor;
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.detectionEngine = new DetectionEngine();
    this.contentProcessor = new ContentProcessor(options.processing);
    this.options = options;
  }

  /**
   * Parse the current page
   */
  async parse(doc: Document = document, explicitUrl?: string): Promise<ParsedChapter | null> {
    const url = explicitUrl || doc.location?.href || window.location.href;

    // Try to match a rule first
    const ruleManager = getRuleManager();
    const ruleMatch = ruleManager.matchRule(url);

    if (ruleMatch && !this.options.forceDetection) {
      // Use rule-based parsing
      return await this.parseWithRule(doc, url, ruleMatch);
    }

    // Use detection-based parsing
    return await this.parseWithDetection(doc, url);
  }

  /**
   * Parse using a matched rule
   */
  private async parseWithRule(
    doc: Document,
    url: string,
    ruleMatch: RuleMatchResult
  ): Promise<ParsedChapter | null> {
    const rule = ruleMatch.rule;

    // Execute beforeParse hook if present (supports async)
    if (!(await this.runBeforeParseHook(rule, doc, url))) return null;

    // Extract content
    let contentElement = this.selectElement(doc, rule.content.selector);

    if (this.shouldWaitForRuleContent(rule, contentElement)) {
      await this.waitForRuleContent(doc, rule);
      contentElement = this.selectElement(doc, rule.content.selector);
    }
    if (!contentElement) {
      // Fallback to detection if rule selector fails
      return await this.parseWithDetection(doc, url, rule);
    }

    // Extract navigation from rule selectors
    let navigation = this.extractNavigation(doc, rule);

    // Fallback to detection-based navigation ONLY if rule doesn't define that nav type
    // If rule defines a selector but it doesn't match, that means the link doesn't exist
    // (e.g., first chapter has no prev link)
    // Note: `false` means "explicitly disable", so treat it as defined and do not fall back.
    const hasRulePrev = rule.navigation?.prev !== undefined;
    const hasRuleNext = rule.navigation?.next !== undefined;
    const hasRuleIndex = rule.navigation?.index !== undefined;

    if (!navigation.next || !navigation.prev || !navigation.index) {
      const detectedNav = this.detectionEngine.detectNavigation(doc, url);
      if (!hasRuleNext && !navigation.next && detectedNav.next?.url) {
        navigation.next = detectedNav.next.url;
      }
      if (!hasRulePrev && !navigation.prev && detectedNav.prev?.url) {
        navigation.prev = detectedNav.prev.url;
      }
      if (!hasRuleIndex && !navigation.index && detectedNav.index?.url) {
        navigation.index = detectedNav.index.url;
      }
    }

    // Extract title
    const title = this.extractTitle(doc, rule);

    // Process content with title info for duplicate cleaning
    const processingOptions: ProcessingOptions = {
      removeSelectors: rule.content.remove,
      replaceRules: rule.content.replace,
      removeAds: rule.processing?.removeAds !== false,
      normalizeWhitespace: rule.processing?.normalizeWhitespace !== false,
      fixImages: rule.processing?.fixImages !== false,
      useRawContent: rule.processing?.useRawContent,
      chapterTitle: title.chapter,
      bookTitle: title.book,
    };

    this.contentProcessor.setOptions(processingOptions);
    const rawContent = contentElement.innerHTML;
    const sourceText = this.buildSourceScriptSample(title.chapter, title.book, contentElement);
    const sourceScript = inferChineseScript(doc, sourceText);
    const content = this.contentProcessor.process(contentElement, doc);

    return {
      title: title.chapter,
      bookTitle: title.book,
      content,
      rawContent,
      prevUrl: navigation.prev,
      nextUrl: navigation.next,
      indexUrl: navigation.index,
      url,
      confidence: 1.0,
      rule,
      method: 'rule',
      sourceScript,
    };
  }

  /**
   * Parse using detection engine
   */
  private async parseWithDetection(
    doc: Document,
    url: string,
    fallbackRule?: SiteRule
  ): Promise<ParsedChapter | null> {
    let detection = this.detectionEngine.detect(doc, url);

    if (this.shouldWaitForDetectionContent(detection.results.content.element)) {
      const selector = detection.results.content.selector || fallbackRule?.content.selector;
      await this.waitForDynamicContent(doc, {
        selector,
        timeoutMs: GLOBAL_DYNAMIC_WAIT_MS,
        minTextLength: MIN_DYNAMIC_TEXT_LENGTH,
      });
      detection = this.detectionEngine.detect(doc, url);
    }

    if (!detection.results.content.element) {
      return null;
    }

    const contentElement = detection.results.content.element;

    // Use detection results for navigation, with fallback to rule if available
    const navigation = {
      prev: detection.results.navigation.prev?.url,
      next: detection.results.navigation.next?.url,
      index: detection.results.navigation.index?.url,
    };

    // Override with rule navigation if available
    if (fallbackRule?.navigation) {
      const ruleNav = this.extractNavigation(doc, fallbackRule);
      if (ruleNav.prev) navigation.prev = ruleNav.prev;
      if (ruleNav.next) navigation.next = ruleNav.next;
      if (ruleNav.index) navigation.index = ruleNav.index;
    }

    // Get title info for duplicate cleaning
    const chapterTitle = detection.results.title.chapterTitle || '';
    const bookTitle = detection.results.title.bookTitle;

    // Process content with title info
    const processingOptions: ProcessingOptions = {
      removeSelectors: fallbackRule?.content.remove,
      replaceRules: fallbackRule?.content.replace,
      chapterTitle,
      bookTitle,
    };

    this.contentProcessor.setOptions(processingOptions);
    const rawContent = contentElement.innerHTML;
    const sourceText = this.buildSourceScriptSample(chapterTitle, bookTitle, contentElement);
    const sourceScript = inferChineseScript(doc, sourceText);
    const content = this.contentProcessor.process(contentElement, doc);

    return {
      title: chapterTitle || 'Unknown Chapter',
      bookTitle,
      content,
      rawContent,
      prevUrl: navigation.prev,
      nextUrl: navigation.next,
      indexUrl: navigation.index,
      url,
      confidence: detection.confidence.overall,
      rule: fallbackRule,
      method: fallbackRule ? 'mixed' : 'detection',
      sourceScript,
    };
  }

  /**
   * Quick check if page looks like a novel chapter
   */
  quickCheck(doc: Document = document): boolean {
    return this.detectionEngine.quickCheck(doc);
  }

  /**
   * Get detection results without parsing
   */
  detect(doc: Document = document, url?: string): DetectionEngineResult {
    return this.detectionEngine.detect(doc, url || doc.location?.href || window.location.href);
  }

  /**
   * Detect navigation without running content/title detection.
   */
  detectNavigation(doc: Document = document, url?: string): NavigationResult {
    return this.detectionEngine.detectNavigation(
      doc,
      url || doc.location?.href || window.location.href
    );
  }

  /**
   * Detect section state without running content/title detection.
   */
  detectSection(doc: Document = document, url?: string): SectionDetectionResult {
    return this.detectionEngine.detectSection(
      doc,
      url || doc.location?.href || window.location.href
    );
  }

  /**
   * Extract navigation links using rule
   */
  private extractNavigation(
    doc: Document,
    rule: SiteRule
  ): { prev?: string; next?: string; index?: string } {
    const result: { prev?: string; next?: string; index?: string } = {};

    const asAnchor = (el: Element | null): HTMLAnchorElement | null => {
      if (!el) return null;
      // Avoid cross-realm `instanceof` issues in tests / DOMParser documents.
      if (el.tagName?.toLowerCase() === 'a') return el as HTMLAnchorElement;
      return null;
    };

    const prevSelector = rule.navigation?.prev;
    if (typeof prevSelector === 'string' && prevSelector.trim()) {
      const el = this.selectElement(doc, prevSelector);
      const anchor = asAnchor(el);
      if (anchor) result.prev = anchor.href;
    }

    const nextSelector = rule.navigation?.next;
    if (typeof nextSelector === 'string' && nextSelector.trim()) {
      const el = this.selectElement(doc, nextSelector);
      const anchor = asAnchor(el);
      if (anchor) result.next = anchor.href;
    }

    const indexSelector = rule.navigation?.index;
    if (typeof indexSelector === 'string' && indexSelector.trim()) {
      const el = this.selectElement(doc, indexSelector);
      const anchor = asAnchor(el);
      if (anchor) result.index = anchor.href;
    }

    return result;
  }

  /**
   * Extract title using rule
   */
  private extractTitle(doc: Document, rule: SiteRule): { chapter: string; book?: string } {
    let chapter = '';
    let book: string | undefined;
    let detection: ReturnType<typeof this.detectionEngine.detectTitle> | null = null;
    const getDetection = () => {
      detection ??= this.detectionEngine.detectTitle(doc);
      return detection;
    };

    // Try rule's title selector
    if (rule.title?.selector) {
      const el = this.selectElement(doc, rule.title.selector);
      if (el) {
        chapter = el.textContent?.trim() || '';
      }
    }

    // Try rule's title pattern on document.title
    if (!chapter && rule.title?.pattern) {
      const match = doc.title.match(new RegExp(rule.title.pattern));
      if (match) {
        // Support patternIndex to specify which capture group to use
        const patternIndex = (rule.title as { patternIndex?: number }).patternIndex ?? 1;
        chapter = match[patternIndex] || match[1] || match[0];

        // Also extract book title from pattern if configured
        const bookPatternIndex = (rule.title as { bookPatternIndex?: number }).bookPatternIndex;
        if (bookPatternIndex && match[bookPatternIndex]) {
          book = match[bookPatternIndex];
        }
      }
    }

    // Fallback to detection
    if (!chapter) {
      const detected = getDetection();
      chapter = detected.chapterTitle;
      book = book || detected.bookTitle;
    }

    // Try book title selector
    if (!book && rule.title?.bookSelector) {
      const el = this.selectElement(doc, rule.title.bookSelector);
      if (el) {
        book = el.textContent?.trim();
      }
    }

    if (!book) {
      const detected = getDetection();
      book = detected.bookTitle;
    }

    // Apply title cleanup
    if (rule.title?.replace && chapter) {
      try {
        chapter = chapter.replace(new RegExp(rule.title.replace), '').trim();
      } catch (e) {
        console.debug('[Parser] Invalid title replace regex:', rule.title.replace, e);
      }
    }

    return { chapter, book };
  }

  /**
   * Select element with error handling
   */
  private selectElement(doc: Document, selector: string): Element | null {
    const selectors = selector
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    for (const sel of selectors) {
      const el = this.smartSelect(doc, sel);
      if (el) return el;
    }

    return null;
  }

  private buildSourceScriptSample(
    chapterTitle: string | undefined,
    bookTitle: string | undefined,
    contentElement: Element
  ): string {
    return [chapterTitle, bookTitle, contentElement.textContent || ''].filter(Boolean).join('\n');
  }

  private shouldWaitForRuleContent(rule: SiteRule, element: Element | null): boolean {
    const advanced = rule.advanced;
    if (advanced?.mutationSelector || advanced?.lazyLoadScroll) {
      return true;
    }
    return this.isContentInsufficient(element);
  }

  private shouldWaitForDetectionContent(element: Element | null): boolean {
    return this.isContentInsufficient(element);
  }

  private isContentInsufficient(element: Element | null): boolean {
    if (!element) return true;
    if (element instanceof Element && element.hasAttribute('data-mnr-loading')) return true;
    const text = (element.textContent || '').replace(/\s+/g, '').trim();
    if (!text) return true;
    if (text.length < MIN_DYNAMIC_TEXT_LENGTH) return true;
    if (this.isPlaceholderText(text)) return true;
    return false;
  }

  private isPlaceholderText(text: string): boolean {
    return /加载中|正在加载|内容加载|请稍候|请等待|点击加载|下滑|滚动加载/i.test(text);
  }

  private async waitForRuleContent(doc: Document, rule: SiteRule): Promise<void> {
    const advanced = rule.advanced;
    const selector = advanced?.mutationSelector || rule.content.selector;
    const timeoutMs = advanced?.timeout ?? RULE_DYNAMIC_WAIT_MS;
    const minChildCount = advanced?.mutationChildCount;
    const shouldScroll = !!advanced?.lazyLoadScroll;

    await this.waitForDynamicContent(doc, {
      selector,
      minChildCount,
      timeoutMs,
      minTextLength: MIN_DYNAMIC_TEXT_LENGTH,
      scroll: shouldScroll,
    });
  }

  private async waitForDynamicContent(
    doc: Document,
    options: {
      selector?: string;
      minChildCount?: number;
      timeoutMs?: number;
      minTextLength?: number;
      scroll?: boolean;
    }
  ): Promise<boolean> {
    const selector = options.selector?.trim();
    const minTextLength = options.minTextLength ?? MIN_DYNAMIC_TEXT_LENGTH;
    const timeoutMs = options.timeoutMs ?? GLOBAL_DYNAMIC_WAIT_MS;
    const minChildCount =
      typeof options.minChildCount === 'number' && options.minChildCount > 0
        ? options.minChildCount
        : undefined;
    const target = doc.body || doc.documentElement;

    if (!target) return false;

    const getLength = () => {
      if (!selector) {
        return (doc.body?.textContent || '').replace(/\s+/g, '').length;
      }
      const el = this.selectElement(doc, selector);
      if (!el) return 0;
      return (el.textContent || '').replace(/\s+/g, '').length;
    };

    const isReady = (): boolean => {
      if (selector) {
        const el = this.selectElement(doc, selector);
        if (!el) return false;
        const length = (el.textContent || '').replace(/\s+/g, '').length;
        if (length >= minTextLength && !this.isPlaceholderText(el.textContent || '')) {
          return true;
        }
        if (minChildCount && el.children.length >= minChildCount) {
          return true;
        }
        return false;
      }
      const length = (doc.body?.textContent || '').replace(/\s+/g, '').length;
      return length >= minTextLength;
    };

    if (isReady()) return true;

    let resolvePromise: (value: boolean) => void = () => {};
    let observer: MutationObserver | null = null;
    let timeoutId: number | undefined;
    let resolved = false;

    const done = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      if (observer) observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
      resolvePromise(value);
    };

    const waitPromise = new Promise<boolean>(resolve => {
      resolvePromise = resolve;
      observer = new MutationObserver(() => {
        if (isReady()) {
          done(true);
        }
      });
      observer.observe(target, { childList: true, subtree: true, characterData: true });
      timeoutId = window.setTimeout(() => done(isReady()), timeoutMs);
    });

    let scrollPromise: Promise<void> | null = null;
    if (options.scroll) {
      scrollPromise = this.triggerLazyLoadScroll(getLength, timeoutMs);
    }

    const ready = await waitPromise;

    if (scrollPromise) {
      await scrollPromise;
    }

    return ready || isReady();
  }

  private async triggerLazyLoadScroll(getLength: () => number, timeoutMs: number): Promise<void> {
    if (typeof window === 'undefined' || typeof window.scrollBy !== 'function') {
      return;
    }

    const startY = window.scrollY;
    if (startY > 5) {
      return;
    }

    const step = Math.max(window.innerHeight * 0.8, 400);
    const maxSteps = Math.min(
      DYNAMIC_SCROLL_MAX_STEPS,
      Math.max(3, Math.floor(timeoutMs / (DYNAMIC_SCROLL_DELAY_MS + 10)))
    );
    let lastLength = getLength();
    let stableFor = 0;

    for (let i = 0; i < maxSteps && stableFor < DYNAMIC_SCROLL_STABLE_MS; i++) {
      window.scrollBy({ top: step, behavior: 'auto' });
      await this.sleep(DYNAMIC_SCROLL_DELAY_MS);
      const length = getLength();
      if (length > lastLength) {
        lastLength = length;
        stableFor = 0;
      } else {
        stableFor += DYNAMIC_SCROLL_DELAY_MS;
      }
    }

    if (window.scrollY !== startY) {
      window.scrollTo({ top: startY, behavior: 'auto' });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  /**
   * Resolve and validate a URL for hook fetch helpers.
   *
   * Allows cross-origin http(s) by default (this userscript already declares permissive @connect),
   * but blocks private-network/loopback hosts unless the current page is on the same host.
   */
  private resolveHookFetchUrl(url: string): string | null {
    return resolveAndValidateHttpUrl(url, window.location.href);
  }

  /**
   * Resolve native CSS or supported jQuery-like selectors.
   */
  private smartSelect(doc: Document, selector: string): Element | null {
    let nativeError: unknown;
    try {
      const native = doc.querySelector(selector);
      if (native) return native;
    } catch (e) {
      nativeError = e;
    }

    // Handle :eq(n)
    const eqMatch = selector.match(/^(.*):eq\(([-]?\d+)\)$/);
    if (eqMatch) {
      const baseSel = eqMatch[1] || '*';
      const index = parseInt(eqMatch[2], 10);
      try {
        const nodes = doc.querySelectorAll(baseSel);
        const idx = index >= 0 ? index : nodes.length + index;
        return nodes[idx] || null;
      } catch (e) {
        console.debug('[Parser] :eq selector failed:', baseSel, e);
        return null;
      }
    }

    // Handle :last
    const lastMatch = selector.match(/^(.*):last(?:\(\))?$/);
    if (lastMatch) {
      const baseSel = lastMatch[1] || '*';
      try {
        const nodes = doc.querySelectorAll(baseSel);
        return nodes[nodes.length - 1] || null;
      } catch (e) {
        console.debug('[Parser] :last selector failed:', baseSel, e);
        return null;
      }
    }

    // Handle :first
    const firstMatch = selector.match(/^(.*):first(?:\(\))?$/);
    if (firstMatch) {
      const baseSel = firstMatch[1] || '*';
      try {
        const nodes = doc.querySelectorAll(baseSel);
        return nodes[0] || null;
      } catch (e) {
        console.debug('[Parser] :first selector failed:', baseSel, e);
        return null;
      }
    }

    // Handle one or more :contains("text")
    let currentSel = selector;
    const containsTexts: string[] = [];
    const containsRegex = /^(.*):contains\((['"]?)(.*?)\2\)$/;

    while (true) {
      const match = currentSel.match(containsRegex);
      if (!match) break;
      containsTexts.unshift(match[3]); // applied inner-most last
      currentSel = match[1];
    }

    if (containsTexts.length > 0) {
      const baseSel = currentSel.trim() || '*';
      try {
        let candidates = Array.from(doc.querySelectorAll(baseSel));
        for (const text of containsTexts) {
          candidates = candidates.filter(el => (el.textContent || '').includes(text));
        }
        return candidates[0] || null;
      } catch (e) {
        console.debug('[Parser] :contains selector failed:', baseSel, e);
        return null;
      }
    }

    if (nativeError) console.debug('[Parser] Invalid selector:', selector, nativeError);
    return null;
  }

  private async runBeforeParseHook(rule: SiteRule, doc: Document, url?: string): Promise<boolean> {
    const beforeParse = rule.hooks?.beforeParse;
    if (!beforeParse) return true;

    try {
      await beforeParse(doc, url, this.getHookHelpers());
      return true;
    } catch (e) {
      console.warn('[Parser] beforeParse hook error:', e);
      return false;
    }
  }

  private getHookHelpers(): HookHelpers {
    return {
      fetchJson: (url: string, options?: HookFetchOptions) => this.fetchJson(url, options),
      fetchText: (url: string, options?: HookFetchOptions) => this.fetchText(url, options),
    };
  }

  private async fetchJson(
    url: string,
    options: HookFetchOptions = {}
  ): Promise<Record<string, unknown> | null> {
    const responseText = await this.fetchText(url, options);
    if (!responseText) return null;
    try {
      return JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async fetchText(url: string, options: HookFetchOptions = {}): Promise<string | null> {
    const resolved = this.resolveHookFetchUrl(url);
    if (!resolved) {
      console.warn('[Parser] Fetch blocked: invalid or unsafe URL:', url);
      return null;
    }

    const resolvedUrl = new URL(resolved);
    const timeoutMs = options.timeoutMs ?? 4000;
    const headers = options.headers ?? {};
    const referrer = options.referrer
      ? resolveAndValidateHttpUrl(options.referrer, window.location.href) || undefined
      : undefined;
    const withCredentials = options.withCredentials ?? true;
    const gmXhr = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;

    if (gmXhr) {
      return new Promise(resolve => {
        const gmHeaders = { ...headers };
        if (referrer && !Object.keys(gmHeaders).some(name => name.toLowerCase() === 'referer')) {
          gmHeaders.Referer = referrer;
        }
        gmXhr({
          method: 'GET',
          url: resolvedUrl.href,
          headers: gmHeaders,
          timeout: timeoutMs,
          withCredentials,
          onload: resp =>
            resolve(resp.status >= 200 && resp.status < 300 ? resp.responseText || null : null),
          onerror: () => resolve(null),
          ontimeout: () => resolve(null),
        });
      });
    }

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const fetchHeaders = { ...headers };
      for (const name of Object.keys(fetchHeaders)) {
        if (name.toLowerCase() === 'referer') {
          delete fetchHeaders[name];
        }
      }
      const resp = await fetch(resolvedUrl.href, {
        credentials: withCredentials ? 'include' : 'omit',
        headers: fetchHeaders,
        referrer,
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (!resp.ok) return null;
      return await resp.text();
    } catch {
      return null;
    }
  }
}

// Singleton instance
let parserInstance: Parser | null = null;

/**
 * Get the singleton Parser instance
 */
export function getParser(): Parser {
  if (!parserInstance) {
    parserInstance = new Parser();
  }
  return parserInstance;
}
