import type { BeforeParseHook, SiteRule } from '../types';

type QidianPageContext = {
  pageContext?: {
    pageProps?: {
      pageData?: {
        bookInfo?: {
          bookId?: number | string;
        };
        chapterInfo?: {
          next?: number | string;
          prev?: number | string;
        };
        chapterContentInfo?: {
          firstChapterId?: number | string;
          nextChapterId?: number | string;
        };
        firstChapterId?: number | string;
        nextChapterId?: number | string;
      };
    };
    routeParams?: {
      bookId?: number | string;
    };
  };
};

function hasQidianChapterId(value: number | string | undefined): value is number | string {
  return value !== undefined && value !== null && String(value) !== '-1' && String(value) !== '';
}

function readQidianPageContext(doc: Document): QidianPageContext | null {
  const script = doc.querySelector('#vite-plugin-ssr_pageContext');
  if (!script) return null;

  try {
    return JSON.parse(script.textContent || '{}') as QidianPageContext;
  } catch {
    return null;
  }
}

function extractBookIdFromQidianUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
    const match = parsed.pathname.match(/\/(?:book|chapter)\/(\d+)(?:\/|$)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function extractChapterIdFromQidianUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
    const match = parsed.pathname.match(/\/chapter\/\d+\/(\d+)(?:\/|$)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function resolveQidianBookId(
  data: QidianPageContext | null,
  url: string | undefined
): string | null {
  const bookId =
    data?.pageContext?.pageProps?.pageData?.bookInfo?.bookId ??
    data?.pageContext?.routeParams?.bookId ??
    extractBookIdFromQidianUrl(url);

  return bookId === undefined || bookId === null || String(bookId) === '' ? null : String(bookId);
}

function resolveQidianFirstChapterId(data: QidianPageContext | null): number | string | undefined {
  const pageData = data?.pageContext?.pageProps?.pageData;
  return pageData?.firstChapterId ?? pageData?.chapterContentInfo?.firstChapterId;
}

function resolveQidianNextPreviewChapterId(
  data: QidianPageContext | null
): number | string | undefined {
  const pageData = data?.pageContext?.pageProps?.pageData;
  return pageData?.nextChapterId ?? pageData?.chapterContentInfo?.nextChapterId;
}

function normalizeQidianHydratedParagraphIndent(doc: Document): void {
  const spans = doc.querySelectorAll('main[id^="c-"] p > span.content-text:first-child');
  for (const span of spans) {
    const firstChild = span.firstChild;
    if (!firstChild || firstChild.nodeType !== 3) continue;

    const text = firstChild.nodeValue || '';
    const normalized = text.replace(/^[\s\u3000]+/u, '');
    if (normalized !== text) firstChild.nodeValue = normalized;
  }
}

function resolveQidianMobileBookPreviewChapterUrl(doc: Document, url: string): string | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.hostname !== 'm.qidian.com') return null;
  if (!/^\/book\/\d+\/?$/.test(parsedUrl.pathname)) return null;

  const data = readQidianPageContext(doc);
  const bookId = resolveQidianBookId(data, url);
  const firstChapterId = resolveQidianFirstChapterId(data);
  if (!bookId || !hasQidianChapterId(firstChapterId)) return null;

  return new URL(`/chapter/${bookId}/${String(firstChapterId)}/`, parsedUrl.origin).toString();
}

const qidianBeforeParse: BeforeParseHook = (doc, url) => {
  normalizeQidianHydratedParagraphIndent(doc);

  // Remove review count from title.
  try {
    const reviews = doc.querySelectorAll('h1 .review, h2 .review');
    reviews.forEach(el => el.remove());
  } catch (e) {
    console.debug('[MNR] Failed to remove review elements:', e);
  }

  try {
    const data = readQidianPageContext(doc);
    const pageData = data?.pageContext?.pageProps?.pageData;
    if (!pageData) return;

    const bookId = resolveQidianBookId(data, url);
    const currentChapterId = extractChapterIdFromQidianUrl(url);
    const firstChapterId = resolveQidianFirstChapterId(data);
    const chapterInfo = pageData.chapterInfo;
    const prevChapterId = chapterInfo?.prev;
    let nextChapterId = chapterInfo?.next;
    if (
      !hasQidianChapterId(nextChapterId) &&
      currentChapterId &&
      hasQidianChapterId(firstChapterId) &&
      String(firstChapterId) === currentChapterId
    ) {
      nextChapterId = resolveQidianNextPreviewChapterId(data);
    }
    const host = url ? new URL(url).hostname : location.hostname;
    const navContainer = doc.createElement('div');
    navContainer.id = 'mnr-qidian-nav';
    navContainer.style.display = 'none';

    if (bookId && hasQidianChapterId(prevChapterId)) {
      const prev = doc.createElement('a');
      prev.id = 'mnr-qidian-prev';
      prev.href = `//${host}/chapter/${bookId}/${prevChapterId}/`;
      prev.textContent = '上一章';
      navContainer.appendChild(prev);
    }

    if (bookId && hasQidianChapterId(nextChapterId)) {
      const next = doc.createElement('a');
      next.id = 'mnr-qidian-next';
      next.href = `//${host}/chapter/${bookId}/${nextChapterId}/`;
      next.textContent = '下一章';
      navContainer.appendChild(next);
    }

    if (bookId) {
      const index = doc.createElement('a');
      index.id = 'mnr-qidian-index';
      // The /catalog/ route can return 406 to fetch/GM requests on newer Qidian pages.
      // The book detail page contains the same chapter links and is more stable to parse.
      index.href = `//${host}/book/${bookId}/`;
      index.textContent = '目录';
      navContainer.appendChild(index);
    }

    doc.body.appendChild(navContainer);
  } catch (e) {
    console.warn('[YingChuang] Qidian beforeParse error:', e);
  }
};

const qidianContent: SiteRule['content'] = {
  selector: 'main[id^="c-"]',
  remove: '.review, #r-titlePage, .tooltip-wrapper, .chapter-end-qrcode, section[id^="r-"]',
};

const qidianNavigation: SiteRule['navigation'] = {
  // #mnr-qidian-* are created by beforeParse hook from JSON data.
  // Fallback selectors cover older DOM-rendered pages.
  prev: '#mnr-qidian-prev, .nav-btn-group a:contains("上一章"), a.nav-btn:contains("上一章")',
  index: '#mnr-qidian-index',
  next: '#mnr-qidian-next, .nav-btn-group a:contains("下一章"), a.nav-btn:contains("下一章")',
};

const qidianTitle: SiteRule['title'] = {
  selector: 'h1.title, h2.title, h1.text-1\\.3em, h2.text-1\\.3em, #r-nav-chapter-title',
};

const qidianHooks: SiteRule['hooks'] = {
  beforeParse: qidianBeforeParse,
};

export const qidianMobileRule: SiteRule = {
  id: 'qidian-mobile',
  name: '起点中文网手机版',
  version: 1,
  match: {
    pattern: '^https?://m\\.qidian\\.com/chapter/.*',
  },
  content: {
    ...qidianContent,
  },
  navigation: {
    ...qidianNavigation,
  },
  title: {
    ...qidianTitle,
  },
  hooks: {
    ...qidianHooks,
    // m.qidian.com/book/<id>/ embeds the first chapter but sits outside this rule's match on
    // purpose, so the entry redirect is declared here instead of hard-coded in SectionMerger.
    resolveEntryUrl: resolveQidianMobileBookPreviewChapterUrl,
  },
  advanced: {
    mutationSelector: 'main[id^="c-"]',
    mutationChildCount: 0,
  },
  meta: { source: 'builtin' },
};

export const qidianRule: SiteRule = {
  id: 'qidian',
  name: '起点中文网',
  version: 9,
  match: {
    pattern: '^https?://www\\.qidian\\.com/chapter/.*',
  },
  content: {
    ...qidianContent,
  },
  navigation: {
    ...qidianNavigation,
  },
  title: {
    ...qidianTitle,
  },
  hooks: {
    ...qidianHooks,
  },
  advanced: {
    useIframe: true,
    mutationSelector: 'main[id^="c-"]',
    mutationChildCount: 0,
  },
  meta: { source: 'builtin' },
};
