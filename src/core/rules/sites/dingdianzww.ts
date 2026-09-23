import { appendHiddenLink, extractChapterNav, getScriptText } from '../helpers/scriptNavigation';
import type { BeforeParseHook, SiteRule } from '../types';

function extractChapterIds(
  pageUrl: string,
  scriptText: string
): { articleId: string; chapterId: string } | null {
  const pathMatch = new URL(pageUrl).pathname.match(/^\/(\d+)\/(\d+)(?:_\d+)?\.html$/);
  const articleId = pathMatch?.[1] || scriptText.match(/const\s+articleId\s*=\s*(\d+)/)?.[1];
  const chapterId = pathMatch?.[2] || scriptText.match(/const\s+chapterId\s*=\s*(\d+)/)?.[1];
  if (!articleId || !chapterId) return null;
  return { articleId, chapterId };
}

function fixPageIndexLink(doc: Document, base: string): void {
  const index = doc.querySelector<HTMLAnchorElement>('.page1 .page-index[data-href]');
  const dataHref = index?.getAttribute('data-href');
  if (!index || !dataHref) return;

  try {
    index.href = new URL(dataHref, base).toString();
  } catch {
    // ignore invalid URLs from site markup
  }
}

const dingdianzwwBeforeParse: BeforeParseHook = async (doc, url, helpers) => {
  try {
    const pageUrl = url || doc.location?.href || location.href;
    const scriptText = getScriptText(doc);
    const nav = extractChapterNav(scriptText);
    appendHiddenLink(doc, 'mnr-dingdianzww-prev', nav.prev, '上一章', pageUrl);
    appendHiddenLink(doc, 'mnr-dingdianzww-next', nav.next, '下一章', pageUrl);
    fixPageIndexLink(doc, pageUrl);

    const indexHref =
      doc.querySelector<HTMLAnchorElement>('.page1 .page-index')?.href ||
      doc.querySelector<HTMLAnchorElement>('.bread a[href$="/"]:not([href="/"])')?.href ||
      null;
    appendHiddenLink(doc, 'mnr-dingdianzww-index', indexHref, '目录', pageUrl);

    const contentEl = doc.querySelector<HTMLElement>('#chapter-content');
    if (!contentEl || !helpers?.fetchText) return;

    const ids = extractChapterIds(pageUrl, scriptText);
    if (!ids) return;

    const ajaxUrl = new URL('/modules/article/ajax_chapter.php', pageUrl);
    ajaxUrl.searchParams.set('aid', ids.articleId);
    ajaxUrl.searchParams.set('cid', ids.chapterId);

    const responseText = await helpers.fetchText(ajaxUrl.toString(), {
      timeoutMs: 20_000,
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

    contentEl.innerHTML = content;
  } catch (e) {
    console.warn('[YingChuang] Dingdianzww beforeParse error:', e);
  }
};

// 顶点小说（dingdianzww.org）
// - 章节页：/{bookId}/{chapterId}.html
// - 移动模板通过 ajax_chapter.php 返回完整正文，hook 会写回 #chapter-content。
// - 站点可能带 ?page=1，但不能按分页章节合并。
export const dingdianzwwRule: SiteRule = {
  id: 'dingdianzww',
  name: '顶点小说',
  version: 2,
  match: { pattern: '^https?://dingdianzww\\.org/\\d+/\\d+\\.html(?:[?#].*)?$' },
  content: {
    selector: '.txtnav',
    remove: 'ins, .txtinfo.hide720, .readinline, .ad_content',
    replace: [
      {
        pattern: 'PC站点如章节文字不全请用手机访问dingdianzww\\.org',
        replacement: '',
      },
      {
        pattern:
          '当&前@章#节\\$内%容\\^不&完\\*整！要~查!看-完_整\\|章;节\\)请\\(退&出%阅#读\\|模\\*式！',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: '#mnr-dingdianzww-prev, .page1 a:contains("上一章")',
    index: '#mnr-dingdianzww-index, .page1 a:contains("章节目录"), .page1 a:contains("目录")',
    next: '#mnr-dingdianzww-next, .page1 a:contains("下一章")',
  },
  title: {
    selector: '.txtnav > h1, h1',
    replace: '\\(第[^)]*页\\)\\s*$',
    bookSelector: '.bread a[href^="/"]:not([href="/"]):not([href="/index.html"])[href$="/"]',
  },
  hooks: { beforeParse: dingdianzwwBeforeParse },
  advanced: {
    useIframe: true,
    noSection: true,
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://dingdianzww.org/27543/13341609.html?page=1',
  },
};
