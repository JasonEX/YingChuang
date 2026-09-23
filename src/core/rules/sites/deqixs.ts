import { appendHiddenLink, extractChapterNav, getScriptText } from '../helpers/scriptNavigation';
import type { BeforeParseHook, SiteRule } from '../types';

function extractJsValue(source: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:var|let|const)\\s+${name}\\s*=\\s*(?:['"]([^'"]+)['"]|([^;\\s]+))\\s*;`
  );
  const match = source.match(pattern);
  return match?.[1] || match?.[2] || null;
}

const deqixsCoBeforeParse: BeforeParseHook = async (doc, url, helpers) => {
  try {
    const pageUrl = url || doc.location?.href || location.href;
    const page = new URL(pageUrl);
    const pathMatch = page.pathname.match(/^\/books\/(\d+)\/(\d+)\.html$/);
    if (!pathMatch) return;

    const [, articleId, chapterId] = pathMatch;
    const scriptText = getScriptText(doc);
    const nav = extractChapterNav(scriptText);
    appendHiddenLink(doc, 'mnr-deqixs-co-prev', nav.prev, '上一章', pageUrl);
    appendHiddenLink(doc, 'mnr-deqixs-co-next', nav.next, '下一章', pageUrl);

    const tokenScriptSrc = doc
      .querySelector<HTMLScriptElement>('script[src*="/scripts/chapter.js.php"]')
      ?.getAttribute('src');
    if (!tokenScriptSrc || !helpers) return;

    const tokenScriptUrl = new URL(tokenScriptSrc, pageUrl).toString();
    const tokenScript = await helpers.fetchText(tokenScriptUrl, {
      timeoutMs: 15_000,
      referrer: pageUrl,
      withCredentials: true,
    });
    if (!tokenScript) return;

    const token = extractJsValue(tokenScript, 'chapterToken');
    const timestamp = extractJsValue(tokenScript, 'timestamp');
    const nonce = extractJsValue(tokenScript, 'nonce');
    if (!token || !timestamp || !nonce) return;

    const params = new URLSearchParams({
      aid: articleId,
      cid: chapterId,
      token,
      timestamp,
      nonce,
    });
    const ajaxUrl = new URL(`/modules/article/ajax2.php?${params.toString()}`, pageUrl).toString();
    const responseText = await helpers.fetchText(ajaxUrl, {
      timeoutMs: 20_000,
      referrer: pageUrl,
      withCredentials: true,
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!responseText) return;

    const payload = JSON.parse(responseText) as {
      status?: number;
      data?: { content?: unknown };
    };
    const content = payload.data?.content;
    if (payload.status !== 1 || typeof content !== 'string' || !content.trim()) return;

    const contentEl = doc.querySelector<HTMLElement>('#chapter-content');
    if (contentEl) {
      contentEl.innerHTML = content;
      contentEl.setAttribute('data-mnr-deqixs-full', '1');
    }
  } catch (e) {
    console.warn('[YingChuang] Deqixs.co beforeParse error:', e);
  }
};

// 得奇小说网
// - 章节页：/{bookId}/{chapterId}.html
// - 分页章节：/{bookId}/{chapterId}_{pageNo}.html
// - 目录页：/{bookId}/
export const deqixsRule: SiteRule = {
  id: 'deqixs',
  name: '得奇小说网',
  version: 1,
  match: {
    pattern: '^https?://www\\.deqixs\\.org/\\d+/\\d+(?:_\\d+)?\\.html(?:[?#].*)?$',
  },
  content: {
    selector: '.con',
    remove: 'script, style, iframe, ins',
  },
  navigation: {
    prev: '.prenext span:first-child a[href$=".html"]',
    index: '.prenext > a',
    next: '.prenext span:last-child a[href$=".html"]',
  },
  title: {
    selector: '.submenu h1',
    replace: '^.*?>\\s*',
    bookSelector: '.submenu h1 > a[href$="/"]',
  },
  toc: {
    excludeAncestors: '.new, .item, h1, h2',
  },
  advanced: {
    checkSection: true,
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.deqixs.org/24/18442_6.html',
  },
};

// 得奇小说网新版动态页
// - 章节页：/books/{bookId}/{chapterId}.html
// - 正文由 /modules/article/ajax2.php 动态返回，hook 会写回 #chapter-content
export const deqixsCoRule: SiteRule = {
  id: 'deqixs-co',
  name: '得奇小说网(.co)',
  version: 2,
  match: {
    pattern: '^https?://www\\.deqixs\\.co/books/\\d+/\\d+\\.html(?:[?#].*)?$',
  },
  content: {
    selector: '#chapter-content',
    remove: 'script, style, iframe, ins, .loading, .error',
    replace: [
      {
        pattern:
          '当&前@章#节\\$内%容\\^不&完\\*整！要~查!看-完_整\\|章;节\\)请\\(退&出%阅#读\\|模\\*式！',
        replacement: '',
        flags: 'g',
      },
      {
        pattern: '本章节未完.+?请订阅',
        replacement: '',
        flags: 'g',
      },
    ],
  },
  navigation: {
    prev: '#mnr-deqixs-co-prev',
    index: '.breadcrumb a[href*="/books/"][href$="/"]',
    next: '#mnr-deqixs-co-next',
  },
  title: {
    selector: 'h1.pt10',
    replace: '\\(第[^)]*页\\)\\s*$',
    bookSelector: '.breadcrumb a[href*="/books/"][href$="/"]',
  },
  hooks: {
    beforeParse: deqixsCoBeforeParse,
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.deqixs.co/books/325/266271.html',
  },
};
