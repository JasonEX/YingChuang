import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { AutoEnableManager } from '@/core/AutoEnableManager';
import { builtInRules } from '@/core/rules/builtInRules';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { Parser } from '@/core/parser';
import { xszjRule } from '@/core/rules/sites/xszj';

const bookId = '490346';
const chapterId = '1534359';
const page1Url = `https://xszj.org/b/${bookId}/c/${chapterId}`;
const page1WithParamUrl = `${page1Url}?page=1`;
const page2Url = `${page1Url}?page=2`;
const page3Url = `${page1Url}?page=3`;
const page4Url = `${page1Url}?page=4`;
const prevChapterUrl = `https://xszj.org/b/${bookId}/c/1534355`;
const nextChapterUrl = `https://xszj.org/b/${bookId}/c/1534362`;
const indexUrl = `https://xszj.org/b/${bookId}/cs/1`;

/**
 * 章节页骨架，还原站点真实结构：
 * - 分页时“下一页”的 rel 错标为 prev（站点缺陷）
 * - 正文位于 #content > #booktxt，内部含站点脚本的空 div
 */
function chapterHtml(options: {
  title?: string;
  bookname: string;
  bookTitle: string;
  chapterTitle: string;
  body: string;
  prevText: string;
  prevHref: string;
  nextText: string;
  nextHref: string;
  lang?: 'hans' | 'hant';
}): string {
  const navText =
    options.lang === 'hant'
      ? { index: '目錄', nextPattern: '下一頁', prevPattern: '上一頁', nextChapter: '下一章' }
      : { index: '目录', nextPattern: '下一页', prevPattern: '上一页', nextChapter: '下一章' };
  const nextText = options.nextText === '下一章' ? navText.nextChapter : navText.nextPattern;
  const prevText = options.prevText === '上一章' ? '上一章' : navText.prevPattern;
  const indexText = navText.index;

  return `
    <!doctype html>
    <html lang="zh-Hans">
      <head>
        <title>${options.title || `${options.chapterTitle}-${options.bookTitle}-小说之家`}</title>
      </head>
      <body id="wrapper">
        <article class="box_con">
          <div class="con_top">
            <a href="/">首页</a> &gt; <a href="/c/7">玄幻异能</a> &gt;
            <a href="/b/${bookId}" title="${options.bookTitle}最新章节">${options.bookTitle}</a>
            &gt; ${options.chapterTitle}
          </div>
          <h1 class="bookname">${options.bookname}</h1>
          <div class="bottem1">
            <a rel="prev" href="${options.prevHref}">${prevText}</a>
            <a href="/b/${bookId}/cs/1" rel="index">${indexText}</a>
            <a rel="prev" href="${options.nextHref}">${nextText}</a>
          </div>
          <div id="content_1"></div>
          <div id="content">
            <div id="booktxt">
              <div><script>try {t();} catch (err) {}</script></div>
              <p>${options.body}</p>
              <div><script>try {b();} catch (err) {}</script></div>
            </div>
          </div>
          <div id="content_2"></div>
          <div class="bottem2">
            <a rel="prev" href="${options.prevHref}">${prevText}</a>
            <a href="/b/${bookId}/cs/1" rel="index">${indexText}</a>
            <a rel="prev" href="${options.nextHref}">${nextText}</a>
          </div>
        </article>
      </body>
    </html>
  `;
}

function makeDoc(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document;
}

const bookTitle = '暮年武圣：开局六十倍修炼速度';
const chapterTitle = '第93章 让人震惊的实力';

const page1Html = chapterHtml({
  bookname: `${chapterTitle} （1/4）`,
  bookTitle,
  chapterTitle,
  body: `PAGE1 ${'第一页正文。'.repeat(200)}`,
  prevText: '上一章',
  prevHref: `/b/${bookId}/c/1534355`,
  nextText: '下一页',
  nextHref: `/b/${bookId}/c/${chapterId}?page=2`,
});

const page2Html = chapterHtml({
  bookname: `${chapterTitle} （2/4）`,
  bookTitle,
  chapterTitle,
  body: `PAGE2 ${'第二页正文。'.repeat(200)}`,
  prevText: '上一页',
  prevHref: `/b/${bookId}/c/${chapterId}?page=1`,
  nextText: '下一页',
  nextHref: `/b/${bookId}/c/${chapterId}?page=3`,
});

const page3Html = chapterHtml({
  bookname: `${chapterTitle} （3/4）`,
  bookTitle,
  chapterTitle,
  body: `PAGE3 ${'第三页正文。'.repeat(200)}`,
  prevText: '上一页',
  prevHref: `/b/${bookId}/c/${chapterId}?page=2`,
  nextText: '下一页',
  nextHref: `/b/${bookId}/c/${chapterId}?page=4`,
});

const page4Html = chapterHtml({
  bookname: `${chapterTitle} （4/4）`,
  bookTitle,
  chapterTitle,
  body: `PAGE4 ${'第四页正文。'.repeat(200)}`,
  prevText: '上一页',
  prevHref: `/b/${bookId}/c/${chapterId}?page=3`,
  nextText: '下一章',
  nextHref: `/b/${bookId}/c/1534362`,
});

function stubGmStorage(): void {
  Object.assign(globalThis, {
    GM_deleteValue: () => {},
    GM_getValue: () => null,
    GM_listValues: () => [],
    GM_setValue: () => {},
  });
}

describe('xszj rule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    stubGmStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is auto-discovered as a site rule', () => {
    expect(builtInRules).toContain(xszjRule);
    expect(xszjRule.version).toBe(1);
    expect(xszjRule.advanced?.checkSection).toBe(true);
    expect(xszjRule.advanced?.sectionMaxPages).toBe(99);

    const pattern = new RegExp(xszjRule.match.pattern, 'i');
    expect(pattern.test(page1Url)).toBe(true);
    expect(pattern.test(page2Url)).toBe(true);
    expect(pattern.test(`https://m.xszj.org/b/${bookId}/c/${chapterId}`)).toBe(true);
    // 目录页与书籍页不应触发章节规则
    expect(pattern.test(indexUrl)).toBe(false);
    expect(pattern.test(`https://xszj.org/b/${bookId}`)).toBe(false);
  });

  it('parses title, book title, navigation and content from a chapter page', async () => {
    const chapter = await new Parser().parse(makeDoc(page1Html, page1Url), page1Url);

    expect(chapter?.rule?.id).toBe('xszj');
    expect(chapter?.title).toBe(chapterTitle);
    expect(chapter?.bookTitle).toBe(bookTitle);
    expect(chapter?.prevUrl).toBe(prevChapterUrl);
    expect(chapter?.indexUrl).toBe(indexUrl);
    expect(chapter?.nextUrl).toBe(page2Url);
    expect(chapter?.content).toContain('PAGE1');
  });

  it('parses traditional Chinese navigation on the mobile mirror', async () => {
    const mobileUrl = `https://m.xszj.org/b/${bookId}/c/${chapterId}`;
    const html = chapterHtml({
      bookname: `第93章 讓人震驚的實力 （1/4）`,
      bookTitle: '暮年武聖：開局六十倍修煉速度',
      chapterTitle: '第93章 讓人震驚的實力',
      body: `MOBILE ${'移動端正文。'.repeat(200)}`,
      prevText: '上一章',
      prevHref: `/b/${bookId}/c/1534355`,
      nextText: '下一页',
      nextHref: `/b/${bookId}/c/${chapterId}?page=2`,
      lang: 'hant',
    });

    const chapter = await new Parser().parse(makeDoc(html, mobileUrl), mobileUrl);

    expect(chapter?.rule?.id).toBe('xszj');
    expect(chapter?.title).toBe('第93章 讓人震驚的實力');
    expect(chapter?.bookTitle).toBe('暮年武聖：開局六十倍修煉速度');
    expect(chapter?.prevUrl).toBe(`https://m.xszj.org/b/${bookId}/c/1534355`);
    expect(chapter?.indexUrl).toBe(`https://m.xszj.org/b/${bookId}/cs/1`);
    expect(chapter?.nextUrl).toBe(`${mobileUrl}?page=2`);
    expect(chapter?.content).toContain('MOBILE');
  });

  it('merges query-paged chapters and keeps the real next chapter URL', async () => {
    const pages = new Map<string, string>([
      [page1Url, page1Html],
      [page1WithParamUrl, page1Html],
      [page2Url, page2Html],
      [page3Url, page3Html],
      [page4Url, page4Html],
    ]);
    const fetcher = vi.fn(async (url: string) => makeDoc(pages.get(url)!, url));
    const firstPages: import('@/core/parser').ParsedChapter[] = [];

    const parser = new Parser();
    const merger = createSectionMerger(parser);
    const result = await merger.merge(makeDoc(page1Html, page1Url), page1Url, {
      fetcher,
      onFirstPage: chapter => {
        firstPages.push(chapter);
      },
    });

    expect(firstPages).toHaveLength(1);
    expect(firstPages[0]?.url).toBe(page1Url);
    expect(firstPages[0]?.content).toContain('PAGE1');
    expect(firstPages[0]?.content).not.toContain('PAGE2');
    expect(result?.url).toBe(page1Url);
    expect(result?.prevUrl).toBe(prevChapterUrl);
    expect(result?.nextUrl).toBe(nextChapterUrl);
    expect(result?.content).toContain('PAGE1');
    expect(result?.content).toContain('PAGE2');
    expect(result?.content).toContain('PAGE3');
    expect(result?.content).toContain('PAGE4');
  });

  it('uses the site page cap for chapters longer than the global ten-page default', async () => {
    const totalPages = 12;
    const pages = new Map<string, string>();

    for (let page = 1; page <= totalPages; page += 1) {
      const url = page === 1 ? page1Url : `${page1Url}?page=${page}`;
      const isLastPage = page === totalPages;
      pages.set(
        url,
        chapterHtml({
          bookname: `${chapterTitle} （${page}/${totalPages}）`,
          bookTitle,
          chapterTitle,
          body: `PAGE${page} ${`第${page}页正文。`.repeat(80)}`,
          prevText: page === 1 ? '上一章' : '上一页',
          prevHref:
            page === 1 ? `/b/${bookId}/c/1534355` : `/b/${bookId}/c/${chapterId}?page=${page - 1}`,
          nextText: isLastPage ? '下一章' : '下一页',
          nextHref: isLastPage
            ? `/b/${bookId}/c/1534362`
            : `/b/${bookId}/c/${chapterId}?page=${page + 1}`,
        })
      );
    }

    const fetcher = vi.fn(async (url: string) => {
      const html = pages.get(url);
      return html ? makeDoc(html, url) : null;
    });
    const result = await createSectionMerger(new Parser()).merge(
      makeDoc(pages.get(page1Url)!, page1Url),
      page1Url,
      { fetcher }
    );

    expect(fetcher).toHaveBeenCalledTimes(totalPages - 1);
    expect(result?.content).toContain('PAGE12');
    expect(result?.nextUrl).toBe(nextChapterUrl);
  });

  it('keeps a single-page chapter as-is without fetching sections', async () => {
    const singleHtml = chapterHtml({
      bookname: `${chapterTitle} （1/1）`,
      bookTitle,
      chapterTitle,
      body: `SINGLE ${'单页章节正文。'.repeat(200)}`,
      prevText: '上一章',
      prevHref: `/b/${bookId}/c/1534355`,
      nextText: '下一章',
      nextHref: `/b/${bookId}/c/1534362`,
    });
    const fetcher = vi.fn(async (url: string) => makeDoc(singleHtml, url));

    const parser = new Parser();
    const merger = createSectionMerger(parser);
    const result = await merger.merge(makeDoc(singleHtml, page1Url), page1Url, {
      fetcher,
      maxPages: 10,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result?.url).toBe(page1Url);
    expect(result?.title).toBe(chapterTitle);
    expect(result?.nextUrl).toBe(nextChapterUrl);
    expect(result?.content).toContain('SINGLE');
  });
});

describe('xszj section merge from a middle page', () => {
  it('should normalize to first page and merge ?page=2..4 into one chapter', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: page2Url });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);
    stubGmStorage();

    const pages = new Map<string, string>([
      [page1Url, page1Html],
      [page1WithParamUrl, page1Html],
      [page2Url, page2Html],
      [page3Url, page3Html],
      [page4Url, page4Html],
    ]);

    const gm = vi.fn(
      (opts: {
        url: string;
        onload?: (resp: { status: number; responseText: string }) => void;
      }) => {
        const html = pages.get(opts.url);
        setTimeout(
          () =>
            opts.onload?.({
              status: html ? 200 : 404,
              responseText: html || '',
            }),
          0
        );
        return { abort: () => {} };
      }
    );
    globalThis.GM_xmlhttpRequest = gm as unknown as typeof GM_xmlhttpRequest;

    let launched: import('@/core/parser').ParsedChapter | null = null;
    const manager = new AutoEnableManager({ enableProtection: false });
    manager.setLaunchCallback(event => {
      // Progressive merging also emits the partial first page; only the merged chapter counts.
      if (event.stage === 'complete') launched = event.chapter;
      return update => {
        if (update.stage === 'complete') launched = update.chapter;
      };
    });

    try {
      await manager.manualEnable(dom.window.document);

      expect(launched).not.toBeNull();
      const chapter = launched as unknown as import('@/core/parser').ParsedChapter;
      // 深链 ?page=2 先回到第一页；确认 page=1 → page=2 后再使用裸地址作章节身份。
      expect(chapter.url).toBe(page1Url);
      expect(chapter.prevUrl).toBe(prevChapterUrl);
      expect(chapter.nextUrl).toBe(nextChapterUrl);
      expect(chapter.content).toContain('PAGE1');
      expect(chapter.content).toContain('PAGE2');
      expect(chapter.content).toContain('PAGE3');
      expect(chapter.content).toContain('PAGE4');
      // 请求层保留真实分页 URL，不在全局改写 extensionless ?page=1。
      expect(gm.mock.calls.some(call => call[0].url === page1WithParamUrl)).toBe(true);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  }, 20_000);
});
