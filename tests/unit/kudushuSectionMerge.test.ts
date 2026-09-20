import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { kudushuRule } from '@/core/rules/sites/kudushu';
import { Parser } from '@/core/parser';

const bookUrl = 'https://m.kudushu.org/book/1088392/';
const page1Url = 'https://m.kudushu.org/html/1088392/146537150/';
const page2Url = 'https://m.kudushu.org/html/1088392/146537150_2/';
const page3Url = 'https://m.kudushu.org/html/1088392/146537150_3/';
const prevChapterUrl = 'https://m.kudushu.org/html/1088392/146537149/';
const nextChapterUrl = 'https://m.kudushu.org/html/1088392/146537151/';

const paragraph = (n: number): string => `&nbsp;&nbsp;&nbsp;&nbsp;第${n}段正文，山风掠过林梢。`;

/**
 * Mirrors the live mobile chapter page: the site watermark, the repeated
 * nav row and the per-page heading all live inside #novelcontent, and the
 * nav labels use a full-width dash ("上—章" / "下—页").
 */
function pageHtml(options: {
  bodyFrom: number;
  isLastPage: boolean;
  nextHref: string;
  nextText: string;
  page: number;
  prevHref: string;
  prevText: string;
  totalPages: number;
}): string {
  const body = [0, 1, 2, 3, 4].map(i => paragraph(options.bodyFrom + i)).join('<br>\n<br>\n');
  const navRow = `
    <ul class="novelbutton">
      <li><p class="p1"><a href="${options.prevHref}">${options.prevText}</a></p></li>
      <li><p class="p2"><a href="${bookUrl}">返&nbsp;回&nbsp;目&nbsp;录</a></p></li>
      <li><p class="p2"><a href="/bookcase.php">进入书架</a></p></li>
      <li><p class="p1 p3"><a href="${options.nextHref}">${options.nextText}</a></p></li>
      <div class="clear"></div>
    </ul>`;
  const tail = options.isLastPage ? '' : '（本章未完，请点击下一页继续阅读）';

  return `<!doctype html>
    <html>
      <head><title>测试书名-第64章 测试章节-苦读书</title></head>
      <body>
        <div id="novelbody" class="main">
          <div class="content_top">
            <ul><li><a href="${bookUrl}">返回书页</a></li><li><a href="/">首页</a></li></ul>
          </div>
          <h1 id="chaptertitle">第64章 测试章节</h1>
          <div class="content_novel">
            ${navRow}
            <div id="novelcontent" class="novelcontent">
              <p></p>
              <div id="content_tip"><b>最新网址：m.kudushu.org</b></div>
              &nbsp;&nbsp;&nbsp;&nbsp;第64章 测试章节 (第${options.page}/${options.totalPages}页)<br><br>
              ${body}
              ${tail}
              <div id="content_tip"><b>最新网址：m.kudushu.org</b></div>
              <script>hedgeog8();</script>
              ${navRow}
            </div>
          </div>
        </div>
      </body>
    </html>`;
}

const pages = new Map<string, string>([
  [
    page1Url,
    pageHtml({
      bodyFrom: 1,
      isLastPage: false,
      nextHref: page2Url,
      nextText: '下—页',
      page: 1,
      prevHref: prevChapterUrl,
      prevText: '上—章',
      totalPages: 3,
    }),
  ],
  [
    page2Url,
    pageHtml({
      bodyFrom: 6,
      isLastPage: false,
      nextHref: page3Url,
      nextText: '下—页',
      page: 2,
      prevHref: page1Url,
      prevText: '上—页',
      totalPages: 3,
    }),
  ],
  [
    page3Url,
    pageHtml({
      bodyFrom: 11,
      isLastPage: true,
      nextHref: nextChapterUrl,
      nextText: '下—章',
      page: 3,
      prevHref: page2Url,
      prevText: '上—页',
      totalPages: 3,
    }),
  ],
]);

const makeDoc = (url: string): Document => new JSDOM(pages.get(url)!, { url }).window.document;

const toText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '\n')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();

describe('kudushu rule', () => {
  it('matches both plain and paginated chapter URLs', () => {
    const pattern = new RegExp(kudushuRule.match.pattern);
    expect(pattern.test(page1Url)).toBe(true);
    expect(pattern.test(page2Url)).toBe(true);
    expect(pattern.test(bookUrl)).toBe(false);
    expect(pattern.test('https://m.kudushu.org/html/1088392/asc-2/')).toBe(false);
  });

  it('resolves navigation despite full-width dash labels', async () => {
    const parser = new Parser();
    const first = await parser.parse(makeDoc(page1Url), page1Url);

    expect(first?.rule?.id).toBe('kudushu');
    expect(first?.title).toBe('第64章 测试章节');
    expect(first?.prevUrl).toBe(prevChapterUrl);
    expect(first?.nextUrl).toBe(page2Url);
    expect(first?.indexUrl).toBe(bookUrl);

    const last = await parser.parse(makeDoc(page3Url), page3Url);
    expect(last?.prevUrl).toBe(page2Url);
    expect(last?.nextUrl).toBe(nextChapterUrl);
  });

  it('drops the watermark, the in-content nav row and the repeated heading', async () => {
    const parser = new Parser();
    const parsed = await parser.parse(makeDoc(page1Url), page1Url);
    const text = toText(parsed?.content || '');

    expect(text).not.toContain('m.kudushu.org');
    expect(text).not.toContain('进入书架');
    expect(text).not.toContain('下—页');
    expect(text).not.toMatch(/返\s*回\s*目\s*录/);
    expect(text).not.toContain('第64章 测试章节');
    expect(text).not.toMatch(/第\d+\/\d+页/);
    expect(text).toContain('第1段正文');
    expect(text).toContain('第5段正文');
  });

  it('merges every section page into one chapter', async () => {
    const parser = new Parser();
    const merger = createSectionMerger(parser);
    const fetched: string[] = [];

    const merged = await merger.merge(makeDoc(page1Url), page1Url, {
      fetcher: async url => {
        fetched.push(url);
        return makeDoc(url);
      },
      maxPages: 10,
    });

    expect(fetched).toEqual([page2Url, page3Url]);
    expect(merged?.url).toBe(page1Url);
    expect(merged?.prevUrl).toBe(prevChapterUrl);
    expect(merged?.nextUrl).toBe(nextChapterUrl);

    const text = toText(merged?.content || '');
    for (let n = 1; n <= 15; n++) {
      expect(text).toContain(`第${n}段正文`);
    }
    expect(text.match(/第64章 测试章节/g)).toBeNull();
    expect(text).not.toContain('m.kudushu.org');
    expect(text).not.toMatch(/本章未完/);
  });

  it('starts from the first page when entering on a later section', async () => {
    const parser = new Parser();
    const merger = createSectionMerger(parser);

    const merged = await merger.merge(makeDoc(page2Url), page2Url, {
      fetcher: async url => makeDoc(url),
      maxPages: 10,
    });

    expect(merged?.url).toBe(page1Url);
    expect(merged?.nextUrl).toBe(nextChapterUrl);
    expect(toText(merged?.content || '')).toContain('第1段正文');
  });
});
