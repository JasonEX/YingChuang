import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { deqixsCoRule, deqixsRule } from '@/core/rules/sites/deqixs';
import { builtInRules } from '@/core/rules/builtInRules';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { Parser } from '@/core/parser';

const page1Url = 'https://www.deqixs.org/24/18442.html';
const page2Url = 'https://www.deqixs.org/24/18442_2.html';
const page3Url = 'https://www.deqixs.org/24/18442_3.html';
const page4Url = 'https://www.deqixs.org/24/18442_4.html';
const page5Url = 'https://www.deqixs.org/24/18442_5.html';
const page6Url = 'https://www.deqixs.org/24/18442_6.html';
const page7Url = 'https://www.deqixs.org/24/18442_7.html';
const nextChapterUrl = 'https://www.deqixs.org/24/18443.html';
const indexUrl = 'https://www.deqixs.org/24/';
const coChapterUrl = 'https://www.deqixs.co/books/325/266271.html';
const coPrevChapterUrl = 'https://www.deqixs.co/books/325/266270.html';
const coNextChapterUrl = 'https://www.deqixs.co/books/325/266272.html';
const coIndexUrl = 'https://www.deqixs.co/books/325/';

function chapterHtml(options: {
  body: string;
  nextHref: string;
  nextText: string;
  prevHref: string;
  prevText: string;
}): string {
  return `
    <!doctype html>
    <html>
      <head>
        <title>苟在两界修仙 第1章 转世(元旦快乐！)-文抄公小说-手打最新章节-得奇小说网</title>
      </head>
      <body>
        <div class="container">
          <div class="submenu">
            <h1><a href="https://www.deqixs.org/24/">苟在两界修仙</a> &gt; 第1章 转世(元旦快乐！)</h1>
          </div>
          <div class="con">
            ${options.body}<br /><br />
          </div>
          <div class="prenext">
            <span><a href="${options.prevHref}">${options.prevText}</a></span>
            <a href="https://www.deqixs.org/24/">目录</a>
            <span><a href="${options.nextHref}">${options.nextText}</a></span>
          </div>
        </div>
      </body>
    </html>
  `;
}

function makeDoc(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document;
}

function sectionBody(label: string): string {
  return `${label} ${'分页正文。'.repeat(140)}`;
}

const page1Html = chapterHtml({
  body: sectionBody('PAGE1'),
  nextHref: '/24/18442_2.html',
  nextText: '下一页',
  prevHref: '/24/',
  prevText: '上一章',
});

const page2Html = chapterHtml({
  body: sectionBody('PAGE2'),
  nextHref: '/24/18442_3.html',
  nextText: '下一页',
  prevHref: '/24/18442_1.html',
  prevText: '上一页',
});

const page3Html = chapterHtml({
  body: sectionBody('PAGE3'),
  nextHref: '/24/18442_4.html',
  nextText: '下一页',
  prevHref: '/24/18442_2.html',
  prevText: '上一页',
});

const page4Html = chapterHtml({
  body: sectionBody('PAGE4'),
  nextHref: '/24/18442_5.html',
  nextText: '下一页',
  prevHref: '/24/18442_3.html',
  prevText: '上一页',
});

const page5Html = chapterHtml({
  body: sectionBody('PAGE5'),
  nextHref: '/24/18442_6.html',
  nextText: '下一页',
  prevHref: '/24/18442_4.html',
  prevText: '上一页',
});

const page6Html = chapterHtml({
  body: sectionBody('PAGE6'),
  nextHref: '/24/18442_7.html',
  nextText: '下一页',
  prevHref: '/24/18442_5.html',
  prevText: '上一页',
});

const page7Html = chapterHtml({
  body: sectionBody('PAGE7'),
  nextHref: '/24/18443.html',
  nextText: '下一章',
  prevHref: '/24/18442_6.html',
  prevText: '上一页',
});

const tocHtml = `
  <!doctype html>
  <html>
    <body>
      <div class="container">
        <ul class="new">
          <li><a href="/24/73837.html">第512章 擂台</a></li>
        </ul>
        <h2><a href="/24/18442.html">开始阅读</a><a href="/24/txt.html#dir">TXT下载</a></h2>
        <div id="list" class="dir clear">
          <ul>
            <li><a href="/24/18442.html">第1章 转世(元旦快乐！)</a></li>
            <li><a href="/24/18443.html">第2章 道生(求收藏！)</a></li>
            <li><a href="/24/18444.html">第3章 龙王诞(求推荐！ )</a></li>
            <li><a href="/24/18445.html">第4章 再现(求收藏)</a></li>
            <li><a href="/24/18446.html">第5章 祭祀开始(求推荐)</a></li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`;

const deqixsCoHtml = `
  <!doctype html>
  <html>
    <head>
      <title>四合院里的大国宗师无错精校版_第1477章 特种金属缺货了（4k）_得奇小说网</title>
      <script src="https://www.deqixs.co/scripts/chapter.js.php?aid=325&cid=266271&referrer=https://www.deqixs.co/books/325/266271.html"></script>
      <script>
        function loadChapter(direction) {
          let chapterUrl = '';
          if (direction === 'prev') {
            chapterUrl = 'https://www.deqixs.co/books/325/266270.html';
          } else {
            chapterUrl = 'https://www.deqixs.co/books/325/266272.html';
          }
        }

        $(document).ready(function() {});
      </script>
    </head>
    <body>
      <ol class="breadcrumb">
        <li><a href="/" title="得奇小说网">首页</a></li>
        <li><a href="https://www.deqixs.co/sort/2/1.html">都市小说</a></li>
        <li><a href="https://www.deqixs.co/books/325/">四合院里的大国宗师</a></li>
        <li class="active">第1477章 特种金属缺货了（4k）</li>
      </ol>
      <h1 class="pt10"> 第1477章 特种金属缺货了（4k）(第1/4页)</h1>
      <div class="readcontent" id="rtext">
        <div id="chapter-content"><div class="loading">正在加载章节内容...</div></div>
        <p class="text-center">
          <a href="javascript:void(0)" class="btn btn-default page-link page-prev" data-action="prev">上一页</a>
          <a href="javascript:void(0)" class="btn btn-default page-link page-index" data-href="/325/">目录</a>
          <a href="javascript:void(0)" class="btn btn-default page-link page-next" data-action="next">下一页</a>
        </p>
      </div>
    </body>
  </html>
`;

describe('Deqixs rule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is auto-discovered as a site rule', () => {
    expect(builtInRules).toContain(deqixsRule);
    expect(deqixsRule.version).toBe(1);
    expect(deqixsRule.advanced?.checkSection).toBe(true);
    expect(new RegExp(deqixsRule.match.pattern, 'i').test(page6Url)).toBe(true);
  });

  it('matches the .co and .cc dynamic chapter routes', () => {
    expect(builtInRules).toContain(deqixsCoRule);
    expect(deqixsCoRule.version).toBe(3);
    expect(deqixsCoRule.hooks?.beforeParse).toBeTypeOf('function');
    expect(new RegExp(deqixsCoRule.match.pattern, 'i').test(coChapterUrl)).toBe(true);
    expect(
      new RegExp(deqixsCoRule.match.pattern, 'i').test(
        'https://www.deqixs.cc/books/325/266271.html'
      )
    ).toBe(true);
  });

  it('parses title, book title, navigation and content from a section page', async () => {
    const chapter = await new Parser().parse(makeDoc(page6Html, page6Url), page6Url);

    expect(chapter?.rule?.id).toBe('deqixs');
    expect(chapter?.title).toBe('第1章 转世(元旦快乐！)');
    expect(chapter?.bookTitle).toBe('苟在两界修仙');
    expect(chapter?.prevUrl).toBe(page5Url);
    expect(chapter?.indexUrl).toBe(indexUrl);
    expect(chapter?.nextUrl).toBe(page7Url);
    expect(chapter?.content).toContain('PAGE6');
  });

  it('normalizes a later section to page one, merges all sections, and keeps real next chapter', async () => {
    const pages = new Map<string, string>([
      [page1Url, page1Html],
      [page2Url, page2Html],
      [page3Url, page3Html],
      [page4Url, page4Html],
      [page5Url, page5Html],
      [page6Url, page6Html],
      [page7Url, page7Html],
    ]);

    const parser = new Parser();
    const merger = createSectionMerger(parser);
    const fetchedUrls: string[] = [];
    const result = await merger.merge(makeDoc(page6Html, page6Url), page6Url, {
      fetcher: async url => {
        fetchedUrls.push(url);
        return makeDoc(pages.get(url)!, url);
      },
      maxPages: 10,
    });

    expect(result?.url).toBe(page1Url);
    expect(result?.prevUrl).toBeUndefined();
    expect(result?.nextUrl).toBe(nextChapterUrl);
    expect(fetchedUrls).not.toContain(page6Url);
    expect(fetchedUrls).toContain(page7Url);
    for (let i = 1; i <= 7; i++) {
      expect(result?.content).toContain(`PAGE${i}`);
    }
  });

  it('loads catalog entries from the book index page', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: tocHtml,
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: vi.fn() };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const entries = await loadTocEntriesPaged(indexUrl, page6Url, deqixsRule, vi.fn());

    expect(gm).toHaveBeenCalledTimes(1);
    expect(entries.map(entry => entry.title)).toEqual([
      '第1章 转世(元旦快乐！)',
      '第2章 道生(求收藏！)',
      '第3章 龙王诞(求推荐！ )',
      '第4章 再现(求收藏)',
      '第5章 祭祀开始(求推荐)',
    ]);
  });

  it.each(['co', 'cc'])('loads full deqixs.%s content and navigation', async domain => {
    const chapterUrl = coChapterUrl.replace('.co/', `.${domain}/`);
    const prevChapterUrl = coPrevChapterUrl.replace('.co/', `.${domain}/`);
    const nextChapterUrl = coNextChapterUrl.replace('.co/', `.${domain}/`);
    const bookIndexUrl = coIndexUrl.replace('.co/', `.${domain}/`);
    const html = deqixsCoHtml.replaceAll('www.deqixs.co', `www.deqixs.${domain}`);
    const tokenScript = `
      var chapterToken = 'token-abc';
      var timestamp = 1782205800000;
      var nonce = 'nonce-xyz';
    `;
    const fullContent = `第1481章 特种金属缺货了（4k）<br /><br />${'完整正文。'.repeat(300)}`;
    const requests: GM_xmlhttpRequestOptions[] = [];
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      requests.push(opts);
      const responseText = opts.url.includes('/scripts/chapter.js.php')
        ? tokenScript
        : JSON.stringify({
            status: 1,
            message: '获取成功',
            data: { article_id: 325, chapter_id: 266271, content: fullContent },
          });
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText,
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: vi.fn() };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const chapter = await new Parser().parse(makeDoc(html, chapterUrl), chapterUrl);

    expect(chapter?.rule?.id).toBe('deqixs-co');
    expect(chapter?.title).toBe('第1477章 特种金属缺货了（4k）');
    expect(chapter?.bookTitle).toBe('四合院里的大国宗师');
    expect(chapter?.prevUrl).toBe(prevChapterUrl);
    expect(chapter?.indexUrl).toBe(bookIndexUrl);
    expect(chapter?.nextUrl).toBe(nextChapterUrl);
    expect(chapter?.rawContent).toContain('第1481章 特种金属缺货了（4k）');
    expect(chapter?.content).toContain('完整正文');
    expect(chapter?.content.length).toBeGreaterThan(1000);
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toContain('/scripts/chapter.js.php');
    expect(requests[0].headers).toEqual(expect.objectContaining({ Referer: chapterUrl }));
    expect(requests[1].url).toContain('/modules/article/ajax2.php?');
    expect(requests[1].url).toContain('token=token-abc');
    expect(requests[1].url).toContain('timestamp=1782205800000');
    expect(requests[1].url).toContain('nonce=nonce-xyz');
    expect(requests[1].headers).toEqual(
      expect.objectContaining({
        Referer: chapterUrl,
        'X-Requested-With': 'XMLHttpRequest',
      })
    );
  });

  it('reads the complete .cc catalog after the reverse-ordered latest preview', async () => {
    const chapterUrl = 'https://www.deqixs.cc/books/325/266271.html';
    const bookIndexUrl = 'https://www.deqixs.cc/books/325/';
    const catalog = `<!doctype html><dl class="book chapterlist">
      <h2>最新章节</h2>
      <dd><a href="${bookIndexUrl}266273.html">第3章 新章预览</a></dd>
      <dd><a href="${bookIndexUrl}266272.html">第2章 新章预览</a></dd>
      <div id="list-chapterAll">
        <h2>全部章节目录</h2>
        <dd><a href="${bookIndexUrl}266271.html">第1章 起点</a></dd>
        <dd><a href="${bookIndexUrl}266272.html">第2章 继续</a></dd>
        <dd><a href="${bookIndexUrl}266273.html">第3章 终点</a></dd>
      </div>
    </dl>`;
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: catalog,
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: vi.fn() };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const entries = await loadTocEntriesPaged(bookIndexUrl, chapterUrl, deqixsCoRule, vi.fn());

    expect(gm).toHaveBeenCalledTimes(1);
    expect(entries.map(entry => entry.title)).toEqual(['第1章 起点', '第2章 继续', '第3章 终点']);
    expect(entries.map(entry => entry.url)).toEqual([
      `${bookIndexUrl}266271.html`,
      `${bookIndexUrl}266272.html`,
      `${bookIndexUrl}266273.html`,
    ]);
  });
});
