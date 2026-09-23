/**
 * ContentProcessor - Clean and process extracted content
 */

import { AD_PATTERNS, REMOVE_SELECTORS } from '@/core/constants';
import { sanitizeHtml, sanitizeUrl } from '@/core/utils';
import { repairAntiCopyText } from '@/core/parser/antiCopyTextRepair';
import { ReplaceRule } from '@/core/rules/types';

const REMOVE_SELECTOR_QUERY = REMOVE_SELECTORS.join(',');
const READER_UI_LABELS = new Set([
  '投票推荐',
  '投票推薦',
  '加入书签',
  '加入書籤',
  '添加书签',
  '添加書籤',
  '小说报错',
  '小說報錯',
  '章节报错',
  '章節報錯',
  '关灯',
  '關燈',
  '字体-',
  '字体+',
  '字體-',
  '字體+',
  '上一章',
  '下一章',
  '上一页',
  '下一页',
  '上一頁',
  '下一頁',
  '目录',
  '目錄',
  '章节目录',
  '章節目錄',
  '章节列表',
  '章節列表',
  '返回书目',
  '返回書目',
  '返回目录',
  '返回目錄',
  '加入收藏',
  '加入收藏夹',
]);

const READER_UI_BLOCK_SELECTOR = 'div, p, span, li, section, nav, header, footer';
const PARAGRAPH_BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'CAPTION',
  'COLGROUP',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'MENU',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);
const PARAGRAPH_CONTAINER_TAGS = new Set([
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'FIGCAPTION',
  'MAIN',
  'SECTION',
]);

export interface ProcessingOptions {
  /** Remove common ad patterns */
  removeAds?: boolean;
  /** Normalize whitespace */
  normalizeWhitespace?: boolean;
  /** Fix and center images */
  fixImages?: boolean;
  /** Strip inline styles from elements */
  stripInlineStyles?: boolean;
  /** Custom remove selectors */
  removeSelectors?: string;
  /** Custom replace rules */
  replaceRules?: ReplaceRule[];
  /** Use raw content without processing */
  useRawContent?: boolean;
  /** Chapter title for cleaning */
  chapterTitle?: string;
  /** Book title for cleaning */
  bookTitle?: string;
  /** Author name for cleaning */
  authorName?: string;
}

const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  removeAds: true,
  normalizeWhitespace: true,
  fixImages: true,
  stripInlineStyles: true,
};

export class ContentProcessor {
  private readonly defaultOptions: ProcessingOptions;
  private options: ProcessingOptions;
  private regexCache = new Map<string, RegExp | null>();

  constructor(options: ProcessingOptions = {}) {
    this.defaultOptions = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
    this.options = { ...this.defaultOptions };
  }

  /**
   * Process content element and return cleaned HTML
   */
  process(element: Element, doc: Document): string {
    if (this.options.useRawContent) {
      let html = element.innerHTML;
      if (this.options.fixImages) {
        html = this.fixImages(html, doc, { center: false });
      }
      return sanitizeHtml(html);
    }

    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;

    // Some sites hide正文 in an encoded blob (e.g. `p_key`) and require clicking "加载更多".
    // Expand it before running generic cleaning so detection/processing can work normally.
    this.expandEncodedLoadMoreContent(clone, doc);

    // Remove unwanted elements
    this.removeUnwantedElements(clone);

    // Apply custom remove selectors
    if (this.options.removeSelectors) {
      this.removeBySelector(clone, this.options.removeSelectors);
    }

    // Remove common reader UI toolbars/navigation blocks mixed into正文
    this.removeReaderUiNoise(clone);

    // Strip inline styles
    if (this.options.stripInlineStyles) {
      this.stripInlineStyles(clone);
    }

    const replaceRules = this.options.replaceRules?.length ? this.options.replaceRules : null;
    this.cleanTextNodes(clone, doc, !!this.options.removeAds && !replaceRules);

    // Get text content
    let html = clone.innerHTML;

    // Apply replace rules
    if (replaceRules) {
      html = this.applyReplaceRules(html, replaceRules);
    }

    // Remove ad patterns
    if (this.options.removeAds && replaceRules) {
      const temp = doc.createElement('div');
      temp.innerHTML = html;
      this.cleanTextNodes(temp, doc, true);
      html = temp.innerHTML;
    }

    // Normalize whitespace
    if (this.options.normalizeWhitespace) {
      html = this.normalizeWhitespace(html);
    }

    // Fix images
    if (this.options.fixImages) {
      html = this.fixImages(html, doc);
    }

    // Convert br tags to paragraphs
    html = this.convertBrToParagraphs(html, doc);

    // Clean duplicate title/book/author info at start and end
    html = this.cleanDuplicateInfo(html, doc);

    // Sanitize HTML to prevent unsafe content
    html = sanitizeHtml(html);

    return html;
  }

  /**
   * Remove common reader UI toolbars/navigation that are often embedded near正文.
   * This is intentionally conservative (short text + strong UI keyword signals) to avoid false positives.
   */
  private removeReaderUiNoise(container: Element): void {
    const normalize = (text: string): string => text.replace(/\s+/g, '').trim();

    const isUiLabel = (text: string): boolean => {
      const t = normalize(text);
      if (!t) return false;
      if (READER_UI_LABELS.has(t)) return true;
      if (/^[『「【]?(?:加入|添加)[书書][签籤][，,]方便[阅閱][读讀][』」】]?$/.test(t)) return true;
      if (/^字体[+-]$/.test(t) || /^字體[+-]$/.test(t)) return true;
      if (/^(?:上一|下一)(?:章|页|頁)$/.test(t)) return true;
      if (/^(?:章?节|章節)?(?:目录|目錄|列表)$/.test(t)) return true;
      return false;
    };

    // 1) Remove single UI links/buttons by exact label (safe and common)
    const clickables = Array.from(container.querySelectorAll('a, button, label')) as Element[];
    for (const el of clickables) {
      const rawText = (el.textContent || '').trim();
      const t = normalize(rawText);
      if (!t) continue;
      // Keep it strict: only very short labels are treated as UI.
      if (t.length > 12) continue;
      if (isUiLabel(t)) {
        el.remove();
      }
    }

    // 2) Remove small blocks that look like toolbars / navigation / keyboard tips
    const blocks = Array.from(container.querySelectorAll(READER_UI_BLOCK_SELECTOR)) as Element[];

    for (const el of blocks) {
      const text = normalize(el.textContent || '');
      if (!text) continue;

      // Never delete large blocks (likely正文)
      if (text.length > 240) continue;

      const hasPrevNext =
        (text.includes('上一章') || text.includes('上一頁') || text.includes('上一页')) &&
        (text.includes('下一章') || text.includes('下一頁') || text.includes('下一页'));
      const hasCatalog =
        text.includes('目录') || text.includes('目錄') || text.includes('章节目录');
      const hasBookmark = text.includes('书签') || text.includes('書籤');
      const hasVote = text.includes('投票推荐') || text.includes('投票推薦');
      const hasReport = text.includes('报错') || text.includes('報錯');
      const hasLight = text.includes('关灯') || text.includes('關燈');
      const hasFont = text.includes('字体') || text.includes('字體');

      const isNavBar = hasPrevNext && (hasCatalog || text.includes('章節目錄'));
      const isTopBar = (hasVote && hasBookmark) || (hasBookmark && hasReport);
      const isFontBar = hasLight && hasFont;
      const isKeyboardTip =
        (text.includes('温馨提示') || text.includes('溫馨提示')) &&
        (text.toLowerCase().includes('enter') ||
          text.includes('回车') ||
          text.includes('回車') ||
          text.includes('←') ||
          text.includes('→') ||
          text.includes('按'));

      if (isKeyboardTip) {
        el.remove();
        continue;
      }
      if (isNavBar && text.length <= 120) {
        el.remove();
        continue;
      }
      if ((isTopBar || isFontBar) && text.length <= 160) {
        el.remove();
        continue;
      }
    }
  }

  /**
   * Process and return plain text
   */
  processToText(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    this.removeUnwantedElements(clone);

    let text = repairAntiCopyText(clone.textContent || '');

    if (this.options.removeAds) {
      text = this.removeAdPatterns(text);
    }

    if (this.options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim();
    }

    return text;
  }

  /**
   * Remove unwanted elements from content
   */
  private removeUnwantedElements(element: Element): void {
    try {
      const elements = this.smartQueryAll(element, REMOVE_SELECTOR_QUERY);
      elements.forEach(el => el.remove());
      return;
    } catch {
      // Fall back to per-selector removal if a future selector is not accepted as a group.
      for (const selector of REMOVE_SELECTORS) {
        try {
          const elements = this.smartQueryAll(element, selector);
          elements.forEach(el => el.remove());
        } catch {
          // Invalid selector, skip
        }
      }
    }
  }

  /**
   * Remove elements by custom selector
   */
  private removeBySelector(element: Element, selectors: string): void {
    const selectorList = selectors.split(',').map(s => s.trim());
    for (const selector of selectorList) {
      try {
        const elements = this.smartQueryAll(element, selector);
        elements.forEach(el => el.remove());
      } catch {
        // Invalid selector, skip
      }
    }
  }

  /**
   * Strip inline styles from all elements
   * This prevents original page styles from overriding reader theme
   */
  private stripInlineStyles(element: Element): void {
    // Remove style attribute from the element itself
    element.removeAttribute('style');

    // Remove style attribute from all descendants
    const elementsWithStyle = element.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      el.removeAttribute('style');
    });

    // Also remove bgcolor attribute (old HTML attribute)
    element.removeAttribute('bgcolor');
    const elementsWithBgcolor = element.querySelectorAll('[bgcolor]');
    elementsWithBgcolor.forEach(el => {
      el.removeAttribute('bgcolor');
    });
  }

  /**
   * Get a cached RegExp, or compile and cache it. Returns null for invalid patterns.
   */
  private getCachedRegex(pattern: string, flags: string): RegExp | null {
    const key = `${pattern}\0${flags}`;
    if (this.regexCache.has(key)) {
      return this.regexCache.get(key)!;
    }
    try {
      const regex = new RegExp(pattern, flags);
      this.regexCache.set(key, regex);
      return regex;
    } catch {
      this.regexCache.set(key, null);
      return null;
    }
  }

  /**
   * Apply custom replace rules
   */
  private applyReplaceRules(html: string, rules: ReplaceRule[]): string {
    let result = html;

    for (const rule of rules) {
      const regex = this.getCachedRegex(rule.pattern, rule.flags || 'g');
      if (regex) {
        result = result.replace(regex, rule.replacement);
      }
    }

    return result;
  }

  /**
   * Remove common ad patterns
   */
  private removeAdPatterns(text: string): string {
    let result = text;

    for (const pattern of AD_PATTERNS) {
      result = result.replace(pattern, '');
    }

    return result;
  }

  private cleanTextNodes(container: Element, doc: Document, removeAds: boolean): void {
    const showText = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4;
    const walker = doc.createTreeWalker(container, showText);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue || '';
      const repaired = repairAntiCopyText(value);
      const cleaned = removeAds ? this.removeAdPatterns(repaired) : repaired;
      if (cleaned !== value) node.nodeValue = cleaned;
    }
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(html: string): string {
    return (
      html
        // Remove empty paragraphs
        .replace(/<p>\s*<\/p>/gi, '')
        // Normalize multiple spaces
        .replace(/[ \t]+/g, ' ')
        // Normalize multiple newlines
        .replace(/\n{3,}/g, '\n\n')
        // Remove leading/trailing whitespace in paragraphs
        .replace(/<p>\s+/gi, '<p>')
        .replace(/\s+<\/p>/gi, '</p>')
    );
  }

  /**
   * Fix and center images
   */
  private fixImages(html: string, doc: Document): string;
  private fixImages(html: string, doc: Document, options: { center: boolean }): string;
  private fixImages(
    html: string,
    doc: Document,
    options: { center: boolean } = { center: true }
  ): string {
    if (!/<img[\s>/]/i.test(html)) return html;

    // Create a temporary container
    const temp = doc.createElement('div');
    temp.innerHTML = html;

    const images = temp.querySelectorAll('img');
    images.forEach(img => {
      const srcAttr = img.getAttribute('src')?.trim() || '';
      const looksPlaceholder =
        !srcAttr ||
        srcAttr === '#' ||
        srcAttr === 'about:blank' ||
        srcAttr.startsWith('data:') ||
        srcAttr.startsWith('javascript:') ||
        srcAttr.startsWith('vbscript:');

      // Fix lazy load - normalize common attribute names used by novel sites.
      if (looksPlaceholder) {
        const candidates = [
          'data-src',
          'data-original',
          'data-lazy-src',
          'data-original-src',
          'data-url',
          'data-actualsrc',
          'data-echo',
          'data-srcset',
        ];

        for (const attrName of candidates) {
          const rawValue = img.getAttribute(attrName)?.trim();
          if (!rawValue) continue;

          const value =
            attrName === 'data-srcset' ? rawValue.split(',')[0]?.trim().split(/\s+/)[0] : rawValue;

          const safeUrl = sanitizeUrl(value, { allowDataImage: true, mode: 'strict' });
          if (!safeUrl) continue;

          img.setAttribute('src', safeUrl);
          break;
        }
      }

      if (options.center) {
        // Add centering style
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        img.style.margin = '10px auto';
      }
    });

    return temp.innerHTML;
  }

  /** Normalize br-delimited prose into real paragraphs. */
  private convertBrToParagraphs(html: string, doc: Document): string {
    const container = doc.createElement('div');
    container.innerHTML = html;

    const hasVisibleContent = (node: Node): boolean => {
      if (node.nodeType === 3) return !!node.nodeValue?.trim();
      return node.nodeType === 1;
    };

    const stripSourceIndent = (paragraph: Element): void => {
      const showText = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4;
      const walker = doc.createTreeWalker(paragraph, showText);
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const value = node.nodeValue || '';
        const normalized = value.replace(/^[\s\u00a0\u2000-\u200b\u202f\u205f\u3000]+/u, '');
        if (normalized !== value) node.nodeValue = normalized;
        if (normalized) break;
      }
    };

    const splitWrappedParagraph = (paragraph: HTMLParagraphElement): void => {
      const nodes = Array.from(paragraph.childNodes);
      const hasDirectBreak = nodes.some(
        node => node.nodeType === 1 && (node as Element).tagName === 'BR'
      );
      if (!hasDirectBreak) return;

      const segments: Node[][] = [];
      let segment: Node[] = [];

      const flushSegment = () => {
        if (segment.some(hasVisibleContent)) segments.push(segment);
        segment = [];
      };

      for (const node of nodes) {
        if (node.nodeType === 1 && (node as Element).tagName === 'BR') {
          flushSegment();
        } else {
          segment.push(node);
        }
      }
      flushSegment();

      // Existing paragraphs may use <br> for poetry or addresses. Split only when the
      // following lines carry explicit source indentation, which identifies prose paragraphs.
      const sourceIndent = /^[\t\r\n ]*[\u00a0\u2000-\u200b\u202f\u205f\u3000]{2,}/u;
      const followingSegments = segments.slice(1);
      const indentedSegments = followingSegments.filter(nodes =>
        sourceIndent.test(nodes.map(node => node.textContent || '').join(''))
      ).length;
      if (segments.length < 2 || indentedSegments < Math.ceil(followingSegments.length * 0.8)) {
        return;
      }

      const replacements = segments.map((nodes, index) => {
        const replacement = paragraph.cloneNode(false) as HTMLParagraphElement;
        if (index > 0) replacement.removeAttribute('id');
        nodes.forEach(node => replacement.appendChild(node));
        stripSourceIndent(replacement);
        return replacement;
      });
      paragraph.replaceWith(...replacements);
    };

    const normalizeContainer = (parent: Element): void => {
      for (const child of Array.from(parent.children)) {
        if (PARAGRAPH_CONTAINER_TAGS.has(child.tagName)) {
          normalizeContainer(child);
        }
      }

      const nodes = Array.from(parent.childNodes);
      const hasInlineContent = nodes.some(node =>
        node.nodeType === 3
          ? !!node.nodeValue?.trim()
          : node.nodeType === 1 &&
            (node as Element).tagName !== 'BR' &&
            !PARAGRAPH_BLOCK_TAGS.has((node as Element).tagName)
      );
      const hasDirectBreak = nodes.some(
        node => node.nodeType === 1 && (node as Element).tagName === 'BR'
      );
      if (!hasInlineContent && !hasDirectBreak) return;

      const fragment = doc.createDocumentFragment();
      let paragraph: HTMLParagraphElement | null = null;

      const ensureParagraph = (): HTMLParagraphElement => {
        if (!paragraph) paragraph = doc.createElement('p');
        return paragraph;
      };

      const flushParagraph = (): void => {
        if (!paragraph) return;
        if (Array.from(paragraph.childNodes).some(hasVisibleContent)) {
          stripSourceIndent(paragraph);
          if (paragraph.textContent?.trim() || paragraph.querySelector('*')) {
            fragment.appendChild(paragraph);
          }
        }
        paragraph = null;
      };

      for (const node of nodes) {
        if (node.nodeType === 1) {
          const element = node as Element;
          if (element.tagName === 'BR') {
            flushParagraph();
            continue;
          }
          if (PARAGRAPH_BLOCK_TAGS.has(element.tagName)) {
            flushParagraph();
            fragment.appendChild(element);
            continue;
          }
        }

        if (node.nodeType === 3 && !node.nodeValue?.trim() && !paragraph) continue;
        ensureParagraph().appendChild(node);
      }

      flushParagraph();
      parent.replaceChildren(fragment);
    };

    Array.from(container.querySelectorAll<HTMLParagraphElement>('p')).forEach(
      splitWrappedParagraph
    );
    normalizeContainer(container);
    container.querySelectorAll('p').forEach(stripSourceIndent);

    return container.innerHTML;
  }

  /**
   * Set processing options
   */
  setOptions(options: Partial<ProcessingOptions>): void {
    this.options = { ...this.defaultOptions, ...options };
    this.regexCache.clear();
  }

  /**
   * Clean duplicate book/chapter/author info at start and end of content
   */
  private cleanDuplicateInfo(html: string, doc: Document): string {
    const { chapterTitle, bookTitle } = this.options;

    let result = html;

    // Strategy 1: Clean leading text lines that match chapter title
    if (chapterTitle && chapterTitle.length > 2) {
      // Extract chapter number pattern (e.g., "第1章", "第一章")
      const chapterNumMatch = chapterTitle.match(
        /^(第[一二三四五六七八九十百千\d]+[章节回话篇集卷])/
      );
      const chapterNum = chapterNumMatch ? chapterNumMatch[1] : '';

      // Build patterns to remove duplicate chapter titles at the start
      const titlePatterns: RegExp[] = [];

      // Full title match
      const escapedTitle = this.escapeRegExp(chapterTitle);
      titlePatterns.push(new RegExp(`^\\s*${escapedTitle}\\s*`, 'i'));

      // Title with slight variations (extra dots, spaces, etc.)
      const titleCore = chapterTitle
        .replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*/, '')
        .trim();
      if (titleCore.length > 1) {
        const escapedCore = this.escapeRegExp(titleCore);
        // Match "第X章 ·标题" or "第X章·标题" etc.
        if (chapterNum) {
          const escapedNum = this.escapeRegExp(chapterNum);
          titlePatterns.push(new RegExp(`^\\s*${escapedNum}\\s*[·•.\\s]*${escapedCore}\\s*`, 'i'));
        }
      }

      // Also match just chapter number pattern at start
      if (chapterNum) {
        const escapedNum = this.escapeRegExp(chapterNum);
        titlePatterns.push(new RegExp(`^\\s*${escapedNum}[^<]{0,50}\\s*(?=<|$)`, 'i'));
      }

      // Apply patterns to clean HTML - handle both text nodes and wrapped content
      for (const pattern of titlePatterns) {
        // Clean text at very start (before any tags)
        result = result.replace(pattern, '');

        // Clean inside first few elements
        result = result
          .replace(new RegExp(`(<p[^>]*>)\\s*${pattern.source}`, 'gi'), '$1')
          .replace(new RegExp(`(<div[^>]*>)\\s*${pattern.source}`, 'gi'), '$1')
          .replace(new RegExp(`(<span[^>]*>)\\s*${pattern.source}`, 'gi'), '$1');
      }
    }

    // Strategy 2: Remove elements containing only chapter/book title
    const tempDiv = doc.createElement('div');
    tempDiv.innerHTML = result;
    const combinedTitleFingerprint =
      chapterTitle && bookTitle
        ? `${bookTitle}${chapterTitle}`.replace(/\s+/g, '').toLowerCase()
        : '';
    const normalizedChapterTitle = (chapterTitle || '').replace(/\s+/g, '').toLowerCase();

    const isRemovableEmptyNode = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) return true;
      if (node.nodeType !== Node.ELEMENT_NODE) return true;

      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const keepTags = new Set(['img', 'svg', 'picture', 'video', 'audio', 'canvas']);
      if (keepTags.has(tag)) return false;

      // If the node contains nested elements (e.g. an <a> wrapping an <img>), keep it.
      if (el.children.length > 0) return false;

      return true;
    };

    // Get all direct children and first-level text content
    const children = Array.from(tempDiv.childNodes);
    let removedCount = 0;
    const maxRemove = 3; // Remove at most 3 leading duplicate lines

    for (const child of children) {
      if (removedCount >= maxRemove) break;

      const text = (child.textContent || '').trim();
      if (!text) {
        // Remove empty nodes, but preserve meaningful media elements (e.g. images)
        if (isRemovableEmptyNode(child)) {
          child.parentNode?.removeChild(child);
        }
        continue;
      }

      // Check if this looks like a duplicate title
      if (text.length < 100 && this.looksLikeDuplicateTitle(text)) {
        child.parentNode?.removeChild(child);
        removedCount++;
        continue;
      }

      // Title/book/author de-duplication only applies to leading lines.
      // Once actual content starts, later mentions of the chapter title are valid正文.
      break;
    }

    // Remove exact combined book/chapter fingerprints and standalone garbage markers anywhere.
    // Keep this stricter than title de-duplication so ordinary later title mentions are preserved.
    for (const child of Array.from(tempDiv.children)) {
      if (child.children.length > 0) continue;
      const text = (child.textContent || '').trim();
      const isCombinedTitleFingerprint =
        !!combinedTitleFingerprint &&
        text.replace(/\s+/g, '').toLowerCase() === combinedTitleFingerprint;
      // Match the whole template line, including punctuation left by ad cleaning.
      // A bare page number in the document title is accepted only when this marker confirms it.
      const sectionTitle =
        text.length < 100 && normalizedChapterTitle
          ? text
              .replace(/\s+/g, '')
              .toLowerCase()
              .match(
                /^(.*?)第[（(](\d+)[/／]\d+[）)][页頁](?:[，,]?(?:请|請)?[点點][击擊]下一[页頁][继繼][续續][阅閱][读讀])?[，,。.]*$/
              )
          : null;
      const isSectionTitle =
        sectionTitle &&
        (normalizedChapterTitle === sectionTitle[1] ||
          normalizedChapterTitle === sectionTitle[1] + sectionTitle[2]);
      if (isCombinedTitleFingerprint || isSectionTitle || /^>+$/.test(text)) {
        child.remove();
      }
    }

    // Strategy 2.5: Remove trailing standalone garbage markers (e.g. a lone ">")
    const tailNodes = Array.from(tempDiv.childNodes);
    let tailRemoved = 0;
    const maxTailRemove = 3;
    for (let i = tailNodes.length - 1; i >= 0 && tailRemoved < maxTailRemove; i--) {
      const node = tailNodes[i];
      const text = (node.textContent || '').trim();
      if (!text) {
        if (isRemovableEmptyNode(node)) {
          node.parentNode?.removeChild(node);
          tailRemoved++;
          continue;
        }
        break;
      }
      if (/^>+$/.test(text)) {
        node.parentNode?.removeChild(node);
        tailRemoved++;
        continue;
      }
      break;
    }

    // Strategy 3: Clean trailing content
    const trailingPatterns = [
      /\s*本章完\s*$/i,
      /\s*\(本章完\)\s*$/i,
      /\s*---+\s*$/,
      /\s*===+\s*$/,
      /\s*\*{3,}\s*$/,
    ];

    result = tempDiv.innerHTML;
    for (const pattern of trailingPatterns) {
      result = result.replace(pattern, '');
    }

    // Clean empty paragraphs that may have been created
    result = result.replace(/<p>\s*<\/p>/gi, '').replace(/<div>\s*<\/div>/gi, '');

    return result;
  }

  /**
   * Check if text looks like a duplicate chapter title
   */
  private looksLikeDuplicateTitle(text: string): boolean {
    const { chapterTitle, bookTitle } = this.options;
    const trimmed = text.trim();

    // Check against known chapter title
    if (chapterTitle) {
      const normalizedTitle = chapterTitle.replace(/\s+/g, '').toLowerCase();
      const normalizedText = trimmed.replace(/\s+/g, '').replace(/[·•.]/g, '').toLowerCase();

      // Exact or near-exact match
      if (normalizedText === normalizedTitle) return true;

      // Text contains the chapter title
      if (normalizedText.includes(normalizedTitle) || normalizedTitle.includes(normalizedText)) {
        return true;
      }

      // Check if it's just a chapter number + similar title
      const titleCore = chapterTitle
        .replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*/, '')
        .trim();
      const textCore = trimmed
        .replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*[·•.\s]*/, '')
        .trim();
      if (titleCore && textCore && this.fuzzyMatch(textCore, titleCore)) {
        return true;
      }
    }

    // Check against book title
    if (bookTitle && this.fuzzyMatch(trimmed, bookTitle)) {
      return true;
    }

    // Common chapter title patterns
    if (/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]/.test(trimmed)) {
      return true;
    }

    // Author line
    if (/^作者[：:]/i.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Fuzzy match two strings (check if they share significant overlap)
   */
  private fuzzyMatch(text: string, target: string): boolean {
    if (!text || !target) return false;

    const t1 = text.replace(/\s+/g, '').toLowerCase();
    const t2 = target.replace(/\s+/g, '').toLowerCase();

    // Exact match
    if (t1 === t2) return true;

    // One contains the other
    if (t1.includes(t2) || t2.includes(t1)) return true;

    // Check character overlap (at least 70% match)
    if (t2.length >= 3) {
      let matches = 0;
      for (const char of t2) {
        if (t1.includes(char)) matches++;
      }
      if (matches / t2.length >= 0.7) return true;
    }

    return false;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Minimal jQuery-like selector support for content cleaning (:contains, :eq, :first, :last)
   */
  private smartQueryAll(root: Element | Document, selector: string): Element[] {
    const hasJqueryPseudo = /:(?:contains\(|eq\(|first\b|last\b)/.test(selector);
    if (!hasJqueryPseudo) {
      // Try native selector first
      try {
        return Array.from(root.querySelectorAll(selector));
      } catch {
        // fall through
      }
    }

    // Handle :eq(n)
    const eqMatch = selector.match(/^(.*):eq\(([-]?\d+)\)$/);
    if (eqMatch) {
      const baseSel = eqMatch[1] || '*';
      const index = parseInt(eqMatch[2], 10);
      try {
        const nodes = Array.from(root.querySelectorAll(baseSel));
        if (nodes.length === 0) return [];
        const idx = index >= 0 ? index : nodes.length + index;
        return nodes[idx] ? [nodes[idx]] : [];
      } catch {
        return [];
      }
    }

    // Handle :last and :first
    const lastMatch = selector.match(/^(.*):last(?:\(\))?$/);
    if (lastMatch) {
      const baseSel = lastMatch[1] || '*';
      try {
        const nodes = Array.from(root.querySelectorAll(baseSel));
        return nodes.length ? [nodes[nodes.length - 1]] : [];
      } catch {
        return [];
      }
    }

    const firstMatch = selector.match(/^(.*):first(?:\(\))?$/);
    if (firstMatch) {
      const baseSel = firstMatch[1] || '*';
      try {
        const nodes = Array.from(root.querySelectorAll(baseSel));
        return nodes.length ? [nodes[0]] : [];
      } catch {
        return [];
      }
    }

    // Handle chained :contains("text")
    let currentSel = selector;
    const containsTexts: string[] = [];
    const containsRegex = /^(.*):contains\((['"]?)(.*?)\2\)$/;

    while (true) {
      const match = currentSel.match(containsRegex);
      if (!match) break;
      containsTexts.unshift(match[3]);
      currentSel = match[1];
    }

    if (containsTexts.length > 0) {
      const baseSel = currentSel.trim() || '*';
      try {
        let candidates = Array.from(root.querySelectorAll(baseSel));
        for (const text of containsTexts) {
          candidates = candidates.filter(el => (el.textContent || '').includes(text));
        }
        return candidates;
      } catch {
        return [];
      }
    }

    return [];
  }

  private expandEncodedLoadMoreContent(container: Element, doc: Document): void {
    const normalizedText = this.normalizeObfuscatedText(container.textContent || '');
    const hasLoadMore = normalizedText.includes('加载更多');
    const hasBlockedHint =
      normalizedText.includes('无法显示本章节全部内容') ||
      (normalizedText.includes('阅读模式') && normalizedText.includes('无法显示'));

    if (!hasLoadMore && !hasBlockedHint) return;

    const pKey = this.extractInlinePKey(doc);
    if (!pKey) return;

    const decoded = this.decodeBase64Utf8(pKey);
    if (!decoded) return;

    // Basic sanity checks to avoid corrupting content on unrelated pages.
    if (!decoded.includes('<p') || !/[\u4e00-\u9fff]/.test(decoded)) return;

    // Avoid double-append if site already expanded it.
    // Some sites embed full正文 in p_key but only render a short prefix; in that case
    // the decoded head will appear in the visible text but the tail won't — replace instead.
    const decodedPlain = this.normalizeObfuscatedText(decoded.replace(/<[^>]+>/g, ''));
    const decodedTextHead = decodedPlain.slice(0, 60);
    const decodedTextTail = decodedPlain.slice(-60);
    if (decodedTextHead && normalizedText.includes(decodedTextHead)) {
      this.removeLoadMoreUi(container);

      if (decodedTextTail && !normalizedText.includes(decodedTextTail)) {
        // Visible正文 is a truncated prefix; decoded likely contains the full chapter.
        container.innerHTML = decoded;
      }
      return;
    }

    this.removeLoadMoreUi(container);

    try {
      container.insertAdjacentHTML('beforeend', decoded);
    } catch {
      // Fallback: append as text (better than nothing)
      const p = doc.createElement('p');
      p.textContent = decoded.replace(/<[^>]+>/g, '');
      container.appendChild(p);
    }
  }

  private removeLoadMoreUi(container: Element): void {
    // Remove the "无法显示..." hint paragraph(s)
    for (const p of Array.from(container.querySelectorAll('p'))) {
      const t = this.normalizeObfuscatedText(p.textContent || '');
      if (
        t.includes('无法显示本章节全部内容') ||
        (t.includes('阅读模式') && t.includes('无法显示')) ||
        t.includes('请返回原网页阅读')
      ) {
        p.remove();
      }
    }

    // Remove "加载更多" buttons/links (often wrapped in a <p>)
    const candidates = Array.from(container.querySelectorAll('button, a'));
    for (const el of candidates) {
      const t = this.normalizeObfuscatedText(el.textContent || '');
      if (!t) continue;
      if (t.includes('加载更多') || t.includes('展开更多') || t.includes('查看更多')) {
        const wrapper = el.closest('p');
        if (wrapper) wrapper.remove();
        else el.remove();
      }
    }
  }

  private normalizeObfuscatedText(text: string): string {
    return text.replace(/\s+/g, '').replace(/[|｜]/g, '').trim();
  }

  private extractInlinePKey(doc: Document): string | null {
    const scripts = Array.from(doc.querySelectorAll('script'));
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!text || !text.includes('p_key')) continue;

      const match = text.match(/p_key\s*=\s*'([^']+)'/);
      if (match?.[1]) return match[1];

      const match2 = text.match(/p_key\s*=\s*"([^"]+)"/);
      if (match2?.[1]) return match2[1];
    }
    return null;
  }

  private decodeBase64Utf8(input: string): string | null {
    const value = (input || '').trim();
    if (!value) return null;

    // Browser path: atob + TextDecoder
    try {
      if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      }
    } catch {
      // fall through
    }

    // Node/test fallback
    try {
      type BufferLike = { toString: (encoding: string) => string };
      type BufferFactory = { from: (value: string, encoding: string) => BufferLike };
      const B = (globalThis as unknown as { Buffer?: BufferFactory }).Buffer;
      if (!B || typeof B.from !== 'function') return null;
      return String(B.from(value, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}
