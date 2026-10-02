import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { builtInRules } from '@/core/rules/builtInRules';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { Parser } from '@/core/parser';
import { suduguRule } from '@/core/rules/sites/sudugu';

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
        <title>废土边境检查官 第291章 新的改制，突破重械！-斤斤斤小说-全文免费阅读-速读谷</title>
      </head>
      <body>
        <div class="container">
          <div class="submenu">
            <span><a href="/i/pifu.aspx">设置</a></span>
            <h1><a href="/109/">废土边境检查官</a> &gt; 第291章 新的改制，突破重械！</h1>
          </div>
          <div class="con">
            <p>${options.body}</p>
          </div>
          <div class="prenext">
            <span><a href="${options.prevHref}">${options.prevText}</a></span>
            <a href="/109/#dir">目录</a>
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

const page1Html = chapterHtml({
  body: `PAGE1 ${'第一页正文。'.repeat(260)}`,
  nextHref: '/109/1226047-2.html',
  nextText: '下一页',
  prevHref: '/109/1226046.html',
  prevText: '上一章',
});

const page2Html = chapterHtml({
  body: `PAGE2 ${'第二页正文。'.repeat(260)}`,
  nextHref: '/109/1226047-3.html',
  nextText: '下一页',
  prevHref: '/109/1226047.html',
  prevText: '上一页',
});

const page3Html = chapterHtml({
  body: `PAGE3 ${'第三页正文。'.repeat(260)}</p><p>前往必搜索</p><p>后续正文。`,
  nextHref: '/109/1226047-4.html',
  nextText: '下一页',
  prevHref: '/109/1226047-2.html',
  prevText: '上一页',
});

const page4Html = chapterHtml({
  body: `PAGE4 ${'第四页正文。'.repeat(260)}`,
  nextHref: '/109/1236002.html',
  nextText: '下一章',
  prevHref: '/109/1226047-3.html',
  prevText: '上一页',
});

const tocHtml = `
  <!doctype html>
  <html>
    <body>
      <div class="container">
        <ul class="new">
          <li><a href="/109/3960401.html">第541章 石板生产，复活的向日葵！</a></li>
        </ul>
        <div id="list" class="dir clear">
          <ul>
            <li><a href="/109/10445.html">第一章 幸福城，您的废土避难首选！</a></li>
            <li><a href="/109/1226046.html">第290章 生命礼赞，原初超凡之种！</a></li>
            <li><a href="/109/1226047.html">第291章 新的改制，突破重械！</a></li>
            <li><a href="/109/1236002.html">第292章 军团分裂，自主力量！</a></li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`;

describe.each(['https://www.shudugu.org', 'https://www.suduguu.com'])(
  'Sudugu rule on %s',
  origin => {
    const page1Url = `${origin}/109/1226047.html`;
    const page2Url = `${origin}/109/1226047-2.html`;
    const page3Url = `${origin}/109/1226047-3.html`;
    const page4Url = `${origin}/109/1226047-4.html`;
    const prevChapterUrl = `${origin}/109/1226046.html`;
    const nextChapterUrl = `${origin}/109/1236002.html`;
    const indexUrl = `${origin}/109/#dir`;

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
      expect(builtInRules).toContain(suduguRule);
      expect(suduguRule.version).toBe(2);
      expect(suduguRule.advanced?.checkSection).toBe(true);
      expect(new RegExp(suduguRule.match.pattern, 'i').test(page1Url)).toBe(true);
    });

    it('parses title, book title, navigation and content from a chapter page', async () => {
      const chapter = await new Parser().parse(makeDoc(page1Html, page1Url), page1Url);

      expect(chapter?.rule?.id).toBe('sudugu');
      expect(chapter?.title).toBe('第291章 新的改制，突破重械！');
      expect(chapter?.bookTitle).toBe('废土边境检查官');
      expect(chapter?.prevUrl).toBe(prevChapterUrl);
      expect(chapter?.indexUrl).toBe(indexUrl);
      expect(chapter?.nextUrl).toBe(page2Url);
      expect(chapter?.content).toContain('PAGE1');
    });

    it('removes the leftover search promotion without trimming adjacent prose', async () => {
      const html = chapterHtml({
        body: '正文前句。</p><p>前往必搜索</p><p>正文后句。',
        nextHref: '/109/1236002.html',
        nextText: '下一章',
        prevHref: '/109/1226046.html',
        prevText: '上一章',
      });
      const chapter = await new Parser().parse(makeDoc(html, page3Url), page3Url);

      expect(chapter?.content).toContain('正文前句。');
      expect(chapter?.content).toContain('正文后句。');
      expect(chapter?.content).not.toContain('前往必搜索');
      expect(chapter?.content).not.toContain('<p></p>');
    });

    it('merges paged chapters and keeps the real next chapter URL', async () => {
      const pages = new Map<string, string>([
        [page1Url, page1Html],
        [page2Url, page2Html],
        [page3Url, page3Html],
        [page4Url, page4Html],
      ]);

      const parser = new Parser();
      const merger = createSectionMerger(parser);
      const result = await merger.merge(makeDoc(page1Html, page1Url), page1Url, {
        fetcher: async url => makeDoc(pages.get(url)!, url),
        maxPages: 10,
      });

      expect(result?.url).toBe(page1Url);
      expect(result?.prevUrl).toBe(prevChapterUrl);
      expect(result?.nextUrl).toBe(nextChapterUrl);
      expect(result?.content).toContain('PAGE1');
      expect(result?.content).toContain('PAGE2');
      expect(result?.content).toContain('PAGE3');
      expect(result?.content).toContain('PAGE4');
      expect(result?.content).toContain('后续正文。');
      expect(result?.content).not.toContain('前往必搜索');
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

      const entries = await loadTocEntriesPaged(indexUrl, page1Url, suduguRule, vi.fn());

      expect(gm).toHaveBeenCalledTimes(1);
      expect(entries.map(entry => entry.title)).toEqual([
        '第一章 幸福城，您的废土避难首选！',
        '第290章 生命礼赞，原初超凡之种！',
        '第291章 新的改制，突破重械！',
        '第292章 军团分裂，自主力量！',
      ]);
    });
  }
);

it('matches only supported Sudugu chapter hosts and paths', () => {
  const pattern = new RegExp(suduguRule.match.pattern, 'i');
  expect(pattern.test('https://www.suduguu.com/1921/3444370.html')).toBe(true);
  expect(pattern.test('https://www.suduguu.com/1921/3444370-2.html?from=toc#content')).toBe(true);
  expect(pattern.test('https://www.suduguu.com/1921/')).toBe(false);
  expect(pattern.test('https://www.suduguu.com.evil.example/1921/3444370.html')).toBe(false);
  expect(pattern.test('https://other.example/1921/3444370.html')).toBe(false);
});
