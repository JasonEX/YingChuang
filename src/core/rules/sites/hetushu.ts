import type { BeforeParseHook, SiteRule } from '../types';
import { getRequestCooldown, recordRequestCooldown } from '@/core/utils/requestPolicy';

const SUBSTEP_READY_TIMEOUT_MS = 4000;
const MAPPED_VISIBLE_ATTRIBUTE = 'data-mnr-hetushu-visible';

async function waitForLiveContentElement(doc: Document): Promise<Element | null> {
  const existing = doc.querySelector('#content');
  const view = doc.defaultView;
  if (existing || !view || !doc.documentElement) return existing;

  return new Promise(resolve => {
    let settled = false;
    let observer: MutationObserver | null = null;
    const finish = (contentEl: Element | null) => {
      if (settled) return;
      settled = true;
      view.clearTimeout(timeoutId);
      observer?.disconnect();
      resolve(contentEl);
    };
    const timeoutId = view.setTimeout(() => finish(null), SUBSTEP_READY_TIMEOUT_MS);

    observer = new view.MutationObserver(() => {
      const contentEl = doc.querySelector('#content');
      if (contentEl) finish(contentEl);
    });
    observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['id'],
      childList: true,
      subtree: true,
    });

    const contentEl = doc.querySelector('#content');
    if (contentEl) finish(contentEl);
  });
}

function hasPendingSubstepContent(doc: Document, contentEl: Element): boolean {
  return (
    doc.body?.dataset.randomtype === 'substep' &&
    contentEl.firstElementChild?.classList.contains('mask') === true
  );
}

function hasRestoredSubstepContent(doc: Document, contentEl: Element): boolean {
  if (doc.body?.dataset.randomtype !== 'substep') return true;
  if (hasPendingSubstepContent(doc, contentEl)) return false;
  if (Array.from(contentEl.children).some(element => element.tagName === 'P')) return true;

  const rows = Array.from(contentEl.children).filter(
    element => element.tagName === 'DIV' && !element.classList.contains('chapter')
  );
  return (
    rows.length > 0 &&
    rows.every(
      element => element.classList.length > 0 || element.hasAttribute(MAPPED_VISIBLE_ATTRIBUTE)
    )
  );
}

async function waitForLiveSubstepContent(doc: Document, contentEl: Element): Promise<boolean> {
  const view = doc.defaultView;
  if (!view || !hasPendingSubstepContent(doc, contentEl)) return true;

  return new Promise(resolve => {
    let settled = false;
    let observer: MutationObserver | null = null;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      view.clearTimeout(timeoutId);
      observer?.disconnect();
      resolve(ready);
    };
    const timeoutId = view.setTimeout(() => finish(false), SUBSTEP_READY_TIMEOUT_MS);

    observer = new view.MutationObserver(() => {
      if (!hasPendingSubstepContent(doc, contentEl)) finish(true);
    });
    observer.observe(contentEl, { childList: true });

    if (!hasPendingSubstepContent(doc, contentEl)) finish(true);
  });
}

function decodeSubstepMapping(token: string): number[] | null {
  try {
    if (typeof atob !== 'function') return null;
    const values = atob(token).split(/[A-Z]+%/);
    if (!values.length || values.some(value => !/^\d+$/.test(value))) return null;
    return values.map(Number);
  } catch {
    return null;
  }
}

function applySubstepMapping(contentEl: Element, mapping: number[]): boolean {
  const firstElement = contentEl.firstElementChild;
  const mask = firstElement?.classList.contains('mask') ? firstElement : null;

  const nodes = Array.from(contentEl.childNodes).filter(
    node => node !== mask && (node.nodeType !== 3 || !!node.textContent?.trim())
  );
  let contentStart = 0;
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (element.tagName === 'H2') contentStart = index + 1;
    if (element.tagName === 'DIV' && element.className !== 'chapter') break;
  }

  const sourceNodes = nodes.slice(contentStart);
  if (mapping.length !== sourceNodes.length) return false;

  const ordered: Array<Node | undefined> = new Array(sourceNodes.length);
  let lowTargetCount = 0;
  for (let index = 0; index < mapping.length; index++) {
    const encodedTarget = mapping[index];
    const target = encodedTarget < 5 ? encodedTarget : encodedTarget - lowTargetCount;
    if (encodedTarget < 5) lowTargetCount++;
    if (target < 0 || target >= ordered.length || ordered[target]) return false;
    ordered[target] = sourceNodes[index];
  }
  if (ordered.some(node => !node)) return false;

  for (const node of ordered) {
    if (node?.nodeType === 1) {
      (node as Element).setAttribute(MAPPED_VISIBLE_ATTRIBUTE, 'true');
    }
  }
  contentEl.replaceChildren(...nodes.slice(0, contentStart), ...(ordered as Node[]));
  return true;
}

async function restoreSubstepContent(
  doc: Document,
  contentEl: Element,
  pageUrl: string
): Promise<boolean> {
  if (doc.body?.dataset.randomtype !== 'substep') return true;
  if (typeof fetch !== 'function') return false;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return false;
  }
  const chapterId = parsedUrl.pathname.match(/\/(\d+)\.html$/)?.[1];
  if (!chapterId || parsedUrl.hostname !== 'www.hetushu.com') return false;

  const requestUrl = new URL(`r${chapterId}.json`, parsedUrl).href;
  if (getRequestCooldown(requestUrl)) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUBSTEP_READY_TIMEOUT_MS);
  try {
    const response = await fetch(requestUrl, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      signal: controller.signal,
    });
    recordRequestCooldown(requestUrl, response.status, response.headers?.get?.('Retry-After'));
    if (!response.ok) return false;
    const token = response.headers.get('token');
    const mapping = token ? decodeSubstepMapping(token) : null;
    return mapping ? applySubstepMapping(contentEl, mapping) : false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

const hetushuBeforeParse: BeforeParseHook = async (doc, url, helpers) => {
  try {
    const contentEl = await waitForLiveContentElement(doc);
    if (!contentEl) return;

    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    const fallbackUrl =
      typeof window !== 'undefined' && typeof window.location?.href === 'string'
        ? window.location.href
        : '';
    const pageUrl = url || doc.location?.href || fallbackUrl;
    if (!hasRestoredSubstepContent(doc, contentEl)) {
      if (doc.defaultView && hasPendingSubstepContent(doc, contentEl)) {
        await waitForLiveSubstepContent(doc, contentEl);
      }
      let ready = hasRestoredSubstepContent(doc, contentEl);
      if (!ready && (!doc.defaultView || !hasPendingSubstepContent(doc, contentEl))) {
        ready = await restoreSubstepContent(doc, contentEl, pageUrl);
      }
      if (!ready) {
        console.warn('[YingChuang] Hetushu content reorder did not complete:', pageUrl);
      }
    }
    const titleEl = contentEl.querySelector('h2');
    const watermarkSelector =
      'acronym, bdo, big, cite, code, dfn, kbd, q, s, samp, strike, tt, u, var, ins';
    const normalizeWatermarkText = (value: string) =>
      value
        .replace(/[\s\u3000]+/g, '')
        .replace(
          /[ｗwＷW]+[.．•·。]*[hｈ][eｅ][tｔ][uｕ][sｓ][hｈ][uｕ][.．。]*(?:com|ｃｏｍ)(?:[.．。]*(?:com|ｃｏｍ))?/gi,
          ''
        );

    const collectStyleText = async () => {
      const texts = Array.from(doc.querySelectorAll('style'))
        .map(style => style.textContent || '')
        .filter(Boolean);
      const links = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
      for (const link of links) {
        if (!helpers?.fetchText) continue;
        try {
          const href = link.getAttribute('href');
          if (!href) continue;
          const styleUrl = new URL(href, pageUrl).href;
          const text = await helpers.fetchText(styleUrl, {
            timeoutMs: 4000,
            withCredentials: true,
          });
          if (text) texts.push(text);
        } catch {
          // Ignore stylesheet fetch failures.
        }
      }
      return texts.join('\n');
    };

    const extractDisplayClasses = (cssText: string) => {
      const block = new Set<string>();
      const none = new Set<string>();
      const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = ruleRe.exec(cssText))) {
        const selector = match[1] || '';
        const body = match[2] || '';
        if (!selector.includes('#content')) continue;
        const displayBlock = /display\s*:\s*block\b/i.test(body);
        const displayNone = /display\s*:\s*none\b/i.test(body);
        if (!displayBlock && !displayNone) continue;
        const classRe = /#content\s+\.([A-Za-z0-9_-]+)/g;
        let classMatch: RegExpExecArray | null;
        while ((classMatch = classRe.exec(selector))) {
          if (displayBlock) block.add(classMatch[1]);
          if (displayNone) none.add(classMatch[1]);
        }
      }
      return { block, none };
    };

    const styleClasses = extractDisplayClasses(await collectStyleText());
    const hasLayout = (el: Element) => {
      if (!win) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const isVisibleByClass = (el: Element) => {
      const classes = Array.from(el.classList || []);
      if (!classes.length) return false;
      if (classes.some(cls => styleClasses.none.has(cls))) return false;
      if (styleClasses.block.size > 0) return classes.some(cls => styleClasses.block.has(cls));
      return true;
    };
    const isVisible = (el: Element) => {
      if (el.hasAttribute(MAPPED_VISIBLE_ATTRIBUTE)) return true;
      if (!win || !hasLayout(el)) return isVisibleByClass(el);
      const style = win.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (Number(style.opacity) === 0) return false;
      return true;
    };
    const cleanClone = (el: Element) => {
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll(watermarkSelector).forEach(node => node.remove());
      const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
      const walker = doc.createTreeWalker(clone, showText);
      const textNodes: Node[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => {
        const cleaned = normalizeWatermarkText(node.nodeValue || '');
        if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
      });
      return clone;
    };

    const rows = Array.from(contentEl.children)
      .filter(el => el !== titleEl && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE')
      .filter(isVisible)
      .map((el, index) => {
        const rect = win && hasLayout(el) ? el.getBoundingClientRect() : { top: index, left: 0 };
        return {
          index,
          top: rect.top + (win ? win.scrollY : 0),
          left: rect.left + (win ? win.scrollX : 0),
          el,
        };
      })
      .sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index);

    if (!rows.length) return;
    const fragment = doc.createDocumentFragment();
    if (titleEl) fragment.appendChild(titleEl.cloneNode(true));
    rows.forEach(({ el }) => {
      const paragraph = doc.createElement('p');
      const clone = cleanClone(el);
      paragraph.innerHTML = clone.innerHTML || clone.textContent || '';
      if (paragraph.textContent && paragraph.textContent.replace(/\s+/g, '').trim()) {
        fragment.appendChild(paragraph);
      }
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(fragment);
  } catch (e) {
    console.warn('[YingChuang] Hetushu beforeParse error:', e);
  }
};

// 和图书：章节正文通过 CSS/定位打乱顺序，并混入水印标签。
export const hetushuRule: SiteRule = {
  id: 'hetushu',
  name: '和图书',
  version: 3,
  match: {
    pattern: '^https?://www\\.hetushu\\.com/book/\\d+/\\d+\\.html$',
  },
  content: {
    selector: '#content',
    remove: 'h2, acronym, bdo, big, cite, code, dfn, kbd, q, s, samp, strike, tt, u, var, ins',
  },
  navigation: {
    next: 'a#next',
    prev: 'a#pre',
    index: '#left h3 a',
  },
  title: {
    bookSelector: '#left h3',
  },
  hooks: {
    beforeParse: hetushuBeforeParse,
  },
  advanced: {
    useIframe: true,
  },
  meta: { source: 'builtin', exampleUrl: 'https://www.hetushu.com/book/9145/6567989.html' },
};
