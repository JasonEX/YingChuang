import type { BeforeParseHook, FetchDocumentContext, HookHelpers, SiteRule } from '../types';

const DECRYPTED_CHAPTER_ATTRIBUTE = 'data-mnr-ciweimao-chapter';

type CiweimaoTocEntry = {
  title: string;
  url: string;
};

type CiweimaoToc = {
  bookTitle: string;
  entries: CiweimaoTocEntry[];
};

type CryptoWordArray = {
  toString: (encoder?: unknown) => string;
};

type CryptoJsLike = {
  AES: {
    decrypt: (
      data: unknown,
      key: unknown,
      options: { format: unknown; iv: unknown }
    ) => CryptoWordArray;
  };
  enc: {
    Base64: {
      parse: (value: string) => unknown;
    };
    Utf8: unknown;
  };
  format: {
    OpenSSL: {
      parse: (value: string) => unknown;
    };
  };
};

type WindowWithCryptoJs = Window & {
  CryptoJS?: CryptoJsLike;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isSuccessCode(value: unknown): boolean {
  return value === 100000 || value === '100000';
}

function getUnsafeWindow(): WindowWithCryptoJs | null {
  return typeof unsafeWindow !== 'undefined' ? (unsafeWindow as WindowWithCryptoJs) : null;
}

function getCrypto(): CryptoJsLike | null {
  const win = typeof window !== 'undefined' ? (window as WindowWithCryptoJs) : null;
  return win?.CryptoJS || getUnsafeWindow()?.CryptoJS || null;
}

function normalizeCiweimaoUrl(value: string, baseUrl: string): string {
  if (!value) return '';

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

function getCiweimaoChapterId(url: string): string {
  return (url.match(/\/chapter\/(\d+)/) || [])[1] || '';
}

function getCiweimaoBookIdFromIndex(url?: string): string {
  if (!url) return '';
  return (url.match(/\/chapter-list\/(\d+)/) || [])[1] || '';
}

function fixCiweimaoNavHref(doc: Document, selector: string, pageUrl: string): void {
  const el = doc.querySelector(selector);
  if (!el) return;

  let href =
    el.getAttribute('data-href') ||
    el.getAttribute('data-url') ||
    el.getAttribute('data-next') ||
    el.getAttribute('data-prev') ||
    el.getAttribute('data-link') ||
    '';
  if (!href) href = el.getAttribute('href') || '';
  if (!href || href.startsWith('javascript')) {
    const html = el.outerHTML || '';
    const match = html.match(/https?:\/\/(?:www|wap)\.ciweimao\.com\/chapter\/\d+/);
    if (match) href = match[0];
  }
  if (href && !href.startsWith('javascript')) {
    el.setAttribute('href', normalizeCiweimaoUrl(href, pageUrl));
  } else {
    el.removeAttribute('href');
  }
}

async function fetchCiweimaoJson(
  target: string,
  pageUrl: string,
  helpers?: HookHelpers
): Promise<Record<string, unknown> | null> {
  try {
    const unsafeWin = getUnsafeWindow();
    const currentWin = typeof window !== 'undefined' ? window : null;
    const fetcher =
      unsafeWin?.fetch || currentWin?.fetch || (typeof fetch === 'function' ? fetch : null);
    if (fetcher) {
      const fetchThis = unsafeWin?.fetch ? unsafeWin : currentWin?.fetch ? currentWin : undefined;
      const response = await fetcher.call(fetchThis, target, {
        credentials: 'include',
        referrer: pageUrl,
      });
      if (response?.ok) return asRecord(await response.json());
    }
  } catch {
    // Fall back to GM_xmlhttpRequest via parser helpers.
  }

  if (!helpers?.fetchJson) return null;
  return helpers.fetchJson(target, {
    headers: { Referer: pageUrl },
    withCredentials: true,
  });
}

async function fetchCiweimaoText(target: string, referrer: string): Promise<string | null> {
  try {
    const unsafeWin = getUnsafeWindow();
    const currentWin = typeof window !== 'undefined' ? window : null;
    const fetcher =
      unsafeWin?.fetch || currentWin?.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!fetcher) return null;

    const fetchThis = unsafeWin?.fetch ? unsafeWin : currentWin?.fetch ? currentWin : undefined;
    const response = await fetcher.call(fetchThis, target, {
      credentials: 'include',
      referrer,
    });
    if (!response?.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function decryptCiweimaoContent(
  chapterContent: string,
  encryptedKeys: string[],
  accessKey: string,
  crypto: CryptoJsLike
): string {
  const chars = accessKey.split('');
  const total = encryptedKeys.length;
  if (!total || !chars.length) return '';

  const keyChain = [
    encryptedKeys[chars[chars.length - 1].charCodeAt(0) % total],
    encryptedKeys[chars[0].charCodeAt(0) % total],
  ];
  const decode = (str: string): string => atob(str);
  const encode = (str: string): string => btoa(str);

  let current: string | CryptoWordArray = chapterContent;
  for (let i = 0; i < keyChain.length; i++) {
    const decoded = decode(typeof current === 'string' ? current : current.toString());
    const key = keyChain[i];
    const iv = encode(decoded.substring(0, 16));
    const encrypted = encode(decoded.substring(16));
    const parsed = crypto.format.OpenSSL.parse(encrypted);
    const decrypted = crypto.AES.decrypt(parsed, crypto.enc.Base64.parse(key), {
      iv: crypto.enc.Base64.parse(iv),
      format: crypto.format.OpenSSL,
    });

    current = i < keyChain.length - 1 ? decode(decrypted.toString(crypto.enc.Base64)) : decrypted;
  }

  return typeof current === 'string' ? current : current.toString(crypto.enc.Utf8);
}

async function fetchCiweimaoContent(
  chapterId: string,
  pageUrl: string,
  helpers?: HookHelpers
): Promise<string> {
  const origin = new URL(pageUrl).origin;
  const session = await fetchCiweimaoJson(
    `${origin}/chapter/ajax_get_session_code?chapter_id=${chapterId}`,
    pageUrl,
    helpers
  );
  if (!session || !isSuccessCode(session.code)) return '';

  const accessKeyValue = session.chapter_access_key;
  if (accessKeyValue === undefined || accessKeyValue === null) return '';
  const accessKey = String(accessKeyValue);

  const data = await fetchCiweimaoJson(
    `${origin}/chapter/get_book_chapter_detail_info?chapter_id=${chapterId}&chapter_access_key=${accessKey}`,
    pageUrl,
    helpers
  );
  if (!data || !isSuccessCode(data.code)) return '';

  const chapterContent = data.chapter_content;
  const encryptedKeys = Array.isArray(data.encryt_keys)
    ? data.encryt_keys.filter((key): key is string => typeof key === 'string')
    : [];
  const crypto = getCrypto();
  if (typeof chapterContent !== 'string' || encryptedKeys.length === 0 || !crypto) return '';

  const html = decryptCiweimaoContent(chapterContent, encryptedKeys, accessKey, crypto);
  return html;
}

async function decryptCiweimaoIfNeeded(
  doc: Document,
  contentEl: Element,
  pageUrl: string,
  helpers?: HookHelpers
): Promise<void> {
  const chapterId =
    doc.querySelector('#J_BookCnt')?.getAttribute('data-id') || getCiweimaoChapterId(pageUrl);
  if (!chapterId || contentEl.getAttribute(DECRYPTED_CHAPTER_ATTRIBUTE) === chapterId) return;

  const hasWatermark = !!contentEl.querySelector('#J_BookRead_WaterMark, .watermark');
  const text = (contentEl.textContent || '').replace(/\s+/g, '').trim();
  const chapterParas = contentEl.querySelectorAll('p.chapter').length;
  const shouldDecrypt = hasWatermark || text.length < 200 || chapterParas < 3;
  if (!shouldDecrypt) return;

  const html = await fetchCiweimaoContent(chapterId, pageUrl, helpers);
  if (html) {
    contentEl.innerHTML = html;
  }
}

function normalizeWatermarkText(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim();
}

function isLikelyWatermarkToken(token: string): boolean {
  if (!/^[A-Za-z0-9]{4,12}$/.test(token)) return false;
  const hasDigit = /\d/.test(token);
  const hasLower = /[a-z]/.test(token);
  const hasUpper = /[A-Z]/.test(token);
  return (hasDigit && (hasLower || hasUpper)) || (hasLower && hasUpper);
}

function isCjk(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch);
}

function isCjkPunct(ch: string): boolean {
  return /[，。！？、“”‘’（）()【】[\]<>《》:：;；·~…—-]/.test(ch);
}

function getPrevNonSpace(text: string, index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (!/\s/.test(ch)) return ch;
  }
  return '';
}

function getNextNonSpace(text: string, index: number): string {
  for (let i = index; i < text.length; i++) {
    const ch = text[i];
    if (!/\s/.test(ch)) return ch;
  }
  return '';
}

function shouldStripWatermarkToken(token: string, before: string, after: string): boolean {
  if (!isLikelyWatermarkToken(token)) return false;
  const beforeCjk = before && (isCjk(before) || isCjkPunct(before));
  const afterCjk = after && (isCjk(after) || isCjkPunct(after));
  if (!beforeCjk && !afterCjk) return false;

  const beforeAscii = before && /[A-Za-z0-9]/.test(before);
  const afterAscii = after && /[A-Za-z0-9]/.test(after);
  if (beforeAscii && afterAscii) return false;
  return true;
}

function stripWatermarkText(value: string): string {
  if (!value || !/[\u4e00-\u9fff]/.test(value)) return value;

  let result = '';
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (/[A-Za-z0-9]/.test(ch)) {
      let j = i + 1;
      while (j < value.length && /[A-Za-z0-9]/.test(value[j])) j++;
      const token = value.slice(i, j);
      if (token.length >= 4 && token.length <= 12) {
        const before = getPrevNonSpace(value, i);
        const after = getNextNonSpace(value, j);
        if (shouldStripWatermarkToken(token, before, after)) {
          i = j;
          continue;
        }
      }
      result += token;
      i = j;
      continue;
    }
    result += ch;
    i += 1;
  }
  return result;
}

function cleanupCiweimaoWatermarks(doc: Document, contentEl: Element): void {
  contentEl.querySelectorAll('span, i, em, b, strong, font').forEach(node => {
    const text = normalizeWatermarkText(node.textContent || '');
    if (isLikelyWatermarkToken(text)) {
      node.remove();
    }
  });

  const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(contentEl, showText);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }
  textNodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent) return;
    const tag = parent.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;

    const text = node.nodeValue || '';
    const cleaned = stripWatermarkText(text);
    if (cleaned !== text) {
      node.nodeValue = cleaned;
    }
  });

  contentEl.querySelectorAll('p.chapter span').forEach(span => span.remove());
  contentEl.querySelectorAll('p.chapter').forEach(p => {
    const hasImg = p.querySelector('img');
    const text = (p.textContent || '').replace(/\s+/g, '').trim();
    if (hasImg && text.length <= 6) {
      p.remove();
    }
  });

  // Short closing paragraphs can be legitimate prose; length alone is not a watermark signal.
}

const tocCache = new Map<string, Promise<CiweimaoToc | null>>();

function parseCiweimaoToc(html: string, tocUrl: string, fallbackBookTitle = ''): CiweimaoToc {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const seen = new Set<string>();
  const entries: CiweimaoTocEntry[] = [];

  doc.querySelectorAll<HTMLAnchorElement>('a[href*="/chapter/"]').forEach(anchor => {
    const href = anchor.getAttribute('href') || '';
    const url = normalizeCiweimaoUrl(href, tocUrl);
    if (!/\/chapter\/\d+/.test(url) || seen.has(url)) return;

    const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    seen.add(url);
    entries.push({ title, url });
  });

  const titleText = (doc.querySelector('title')?.textContent || '').trim();
  const bookTitle =
    fallbackBookTitle ||
    titleText
      .replace(/最新章节.*$/u, '')
      .replace(/无弹窗全文阅读.*$/u, '')
      .trim();

  return { bookTitle, entries };
}

async function getCiweimaoToc(
  indexUrl: string,
  referrer: string,
  fallbackBookTitle = ''
): Promise<CiweimaoToc | null> {
  const bookId = getCiweimaoBookIdFromIndex(indexUrl);
  const cacheKey = bookId || indexUrl;
  if (!cacheKey) return null;

  let cached = tocCache.get(cacheKey);
  if (!cached) {
    cached = (async () => {
      const html = await fetchCiweimaoText(indexUrl, referrer);
      if (!html || /man-machine-verify|验证码|人机验证/i.test(html)) return null;
      return parseCiweimaoToc(html, indexUrl, fallbackBookTitle);
    })();
    cached.then(toc => {
      if (!toc) {
        tocCache.delete(cacheKey);
      }
    });
    tocCache.set(cacheKey, cached);
  }
  return cached;
}

function createCiweimaoApiDocument(options: {
  bookTitle: string;
  contentHtml: string;
  indexUrl: string;
  nextUrl: string;
  prevUrl: string;
  title: string;
  url: string;
}): Document {
  const doc = document.implementation.createHTMLDocument(options.title);
  const safeSetText = (el: Element, text: string) => {
    el.textContent = text;
    return el;
  };

  const breadcrumb = doc.createElement('div');
  breadcrumb.className = 'breadcrumb';
  const bookLink = doc.createElement('a');
  bookLink.href = options.indexUrl || options.url;
  safeSetText(bookLink, options.bookTitle);
  breadcrumb.append(bookLink);

  const box = doc.createElement('div');
  box.className = 'book-read-box';
  const cnt = doc.createElement('div');
  cnt.id = 'J_BookCnt';
  cnt.setAttribute('data-id', getCiweimaoChapterId(options.url));

  const header = doc.createElement('div');
  header.className = 'read-hd';
  const h1 = doc.createElement('h1');
  h1.className = 'chapter';
  safeSetText(h1, options.title);
  header.append(h1);

  const content = doc.createElement('div');
  content.className = 'read-bd';
  content.id = 'J_BookRead';
  content.innerHTML = options.contentHtml;
  // This detached API document has no host renderer that can replace the prepared body.
  content.setAttribute(DECRYPTED_CHAPTER_ATTRIBUTE, getCiweimaoChapterId(options.url));

  const nav = doc.createElement('div');
  nav.className = 'book-read-page';
  if (options.prevUrl) {
    const prev = doc.createElement('a');
    prev.id = 'J_BtnPagePrev';
    prev.href = options.prevUrl;
    safeSetText(prev, '上一章');
    nav.append(prev);
  }
  if (options.indexUrl) {
    const index = doc.createElement('a');
    index.href = options.indexUrl;
    safeSetText(index, '目录');
    nav.append(index);
  }
  if (options.nextUrl) {
    const next = doc.createElement('a');
    next.id = 'J_BtnPageNext';
    next.href = options.nextUrl;
    safeSetText(next, '下一章');
    nav.append(next);
  }

  cnt.append(header, content);
  box.append(cnt, nav);
  doc.body.append(breadcrumb, box);
  return doc;
}

async function fetchCiweimaoApiDocument(
  targetUrl: string,
  refChapter: FetchDocumentContext
): Promise<Document | null> {
  try {
    const chapterId = getCiweimaoChapterId(targetUrl);
    if (!chapterId || !/\/\/(?:www|wap)\.ciweimao\.com\/chapter\//.test(targetUrl)) return null;

    const indexUrl = refChapter.indexUrl || '';
    const toc = indexUrl
      ? await getCiweimaoToc(indexUrl, refChapter.refererUrl, refChapter.bookTitle || '')
      : null;
    const normalizedTargetUrl = normalizeCiweimaoUrl(targetUrl, refChapter.refererUrl);
    const tocIndex =
      toc?.entries.findIndex(
        entry => normalizeCiweimaoUrl(entry.url, refChapter.refererUrl) === normalizedTargetUrl
      ) ?? -1;
    if (!toc || tocIndex < 0) return null;

    const entry = toc.entries[tocIndex];
    const prevUrl = toc.entries[tocIndex - 1]?.url || '';
    const nextUrl = toc.entries[tocIndex + 1]?.url || '';
    const html = await fetchCiweimaoContent(chapterId, normalizedTargetUrl);
    if (!html) return null;

    return createCiweimaoApiDocument({
      bookTitle: toc.bookTitle || refChapter.bookTitle || '',
      contentHtml: html,
      indexUrl,
      nextUrl,
      prevUrl,
      title: entry.title,
      url: normalizedTargetUrl,
    });
  } catch (e) {
    console.warn('[YingChuang] Ciweimao API document error:', e);
    return null;
  }
}

const ciweimaoBeforeParse: BeforeParseHook = async (doc, url, helpers) => {
  try {
    const contentEl = doc.querySelector('#J_BookRead');
    if (!contentEl) return;

    const fallbackUrl =
      typeof window !== 'undefined' && typeof window.location?.href === 'string'
        ? window.location.href
        : '';
    const pageUrl = url || doc.location?.href || fallbackUrl;
    if (!pageUrl) return;

    fixCiweimaoNavHref(doc, '#J_BtnPagePrev', pageUrl);
    fixCiweimaoNavHref(doc, '.J_BtnPagePrev', pageUrl);
    fixCiweimaoNavHref(doc, '#J_BtnPageNext', pageUrl);
    fixCiweimaoNavHref(doc, '.J_BtnPageNext', pageUrl);

    await decryptCiweimaoIfNeeded(doc, contentEl, pageUrl, helpers);
    cleanupCiweimaoWatermarks(doc, contentEl);
  } catch (e) {
    console.warn('[YingChuang] Ciweimao beforeParse error:', e);
  }
};

const ciweimaoContent: SiteRule['content'] = {
  selector: '#J_BookRead',
  remove: 'i.J_Num, .chapter span, #J_BookRead_WaterMark, .watermark',
};

const ciweimaoHooks: SiteRule['hooks'] = {
  isVipChapter: (doc, url) => {
    if (!/^https?:\/\/(?:www|wap)\.ciweimao\.com\/chapter\/\d+/i.test(url)) return null;
    // The chapter shell also contains subscription promotions; it is not a locked-page signal.
    return doc.querySelector('#J_BookCnt, #J_BookRead') ? false : null;
  },
  beforeParse: ciweimaoBeforeParse,
  fetchDocument: fetchCiweimaoApiDocument,
};

const ciweimaoAdvanced: SiteRule['advanced'] = {
  mutationSelector: '#J_BookRead',
  mutationChildCount: 2,
  timeout: 3000,
};

export const ciweimaoRule: SiteRule = {
  id: 'ciweimao',
  name: '刺猬猫',
  version: 2,
  match: { pattern: '^https?://www\\.ciweimao\\.com/chapter/\\d+' },
  content: ciweimaoContent,
  navigation: {
    prev: '#J_BtnPagePrev[href^="http"]',
    index: '.book-read-page a[href*="/chapter-list/"]',
    next: '#J_BtnPageNext[href^="http"]',
  },
  title: {
    selector: '.read-hd .chapter',
    bookSelector: '.breadcrumb > a:last()',
  },
  hooks: ciweimaoHooks,
  advanced: ciweimaoAdvanced,
  meta: { source: 'builtin', exampleUrl: 'https://www.ciweimao.com/chapter/113909523' },
};

export const ciweimaoWapRule: SiteRule = {
  id: 'ciweimao-wap',
  name: '刺猬猫(移动端)',
  version: 2,
  match: { pattern: '^https?://wap\\.ciweimao\\.com/chapter/\\d+/?(?:[?#].*)?$' },
  content: ciweimaoContent,
  navigation: {
    prev: '.J_BtnPagePrev[href^="http"]',
    index: '.book-read-page .btn-list[href*="/chapter/"]',
    next: '.J_BtnPageNext[href^="http"]',
  },
  title: { selector: 'h1.read-hd' },
  hooks: ciweimaoHooks,
  advanced: ciweimaoAdvanced,
  meta: { source: 'builtin', exampleUrl: 'https://wap.ciweimao.com/chapter/113489050' },
};
