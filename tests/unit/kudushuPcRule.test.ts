import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { collectTocCandidates } from '@/ui/stores/reader/tocEntries';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { kudushuPcRule } from '@/core/rules/sites/kudushu';
import { Parser } from '@/core/parser';

const base = 'https://www.kudushu.org/html/1088/1088392/';
const indexUrl = `${base}index.html`;
const firstUrl = `${base}146537087.html`;
const prevUrl = `${base}146537149.html`;
const chapterUrl = `${base}146537150.html`;
const nextUrl = `${base}146537151.html`;
const lastUrl = `${base}148554092.html`;

/**
 * Mirrors the live PC chapter page: the watermark is baked into the text of
 * #clickeye_content, the .style3 notices sit beside it inside #content, and the
 * chapter nav is labelled 上一页/下一页 even though it moves between chapters.
 */
function chapterHtml(options: {
  body: string;
  nextHref: string;
  prevHref: string;
  title: string;
}): string {
  return `<!doctype html>
    <html>
      <head><title>测试书名-${options.title}-苦读书</title></head>
      <body>
        <div id="wrap">
          <div class="P_Nav">
            <div class="infoleft">
              <a href="https://www.kudushu.org/">苦读书</a>
              <a href="/book/info/1088/1088392.html">测试书名简介</a>
            </div>
            <div class="inforight">
              <a href="${options.prevHref}">上一页</a>
              <a href="${indexUrl}">测试书名</a>
              <a href="${options.nextHref}">下一页</a>
              <a href="Javascript:void(0);">加入书签</a>
              <a href="Javascript:void(0);">推荐本书</a>
              <a href="${indexUrl}">返回书页</a>
            </div>
          </div>
        </div>
        <div id="wrap">
          <div class="Css_6"><div id="PartA" class="PartA"><div class="P_Left">
            <div id="read_style_man" class="block_01"><div class="readSet"><a class="ra" href="javascript:;"></a></div></div>
            <div id="cont" class="block_02">
              <h1>${options.title}</h1>
              <div class="style3">苦读书推荐各位书友阅读：测试书名${options.title}</div>
              <div id="content" class="Content">
                <div id="clickeye_content">&nbsp;(苦读书 www.kudushu.org)&nbsp;&nbsp;&nbsp;&nbsp;${options.body}苦读书 www.kudushu.org</div>
                <div class="style3"><font>如果您中途有事离开，请按CTRL+D键保存当前页面至收藏夹，以便以后接着观看！</font></div>
              </div>
            </div>
          </div></div></div>
        </div>
      </body>
    </html>`;
}

const bodyOf = (from: number): string =>
  [0, 1, 2, 3, 4]
    .map(i => `第${from + i}段正文，山风掠过林梢。`)
    .join('<br><br>&nbsp;&nbsp;&nbsp;&nbsp;');

const pages = new Map<string, string>([
  [
    firstUrl,
    // First chapter: 上一页 points at the catalog, not a chapter.
    chapterHtml({
      body: bodyOf(1),
      nextHref: `${base}146537088.html`,
      prevHref: indexUrl,
      title: '第1章 起点',
    }),
  ],
  [
    chapterUrl,
    chapterHtml({
      body: bodyOf(6),
      nextHref: nextUrl,
      prevHref: prevUrl,
      title: '第64章 测试章节',
    }),
  ],
  [
    nextUrl,
    chapterHtml({
      body: bodyOf(11),
      nextHref: `${base}146537152.html`,
      prevHref: chapterUrl,
      title: '第65章 下一章',
    }),
  ],
  [
    lastUrl,
    // Last chapter: 下一页 points at the catalog.
    chapterHtml({
      body: bodyOf(16),
      nextHref: indexUrl,
      prevHref: `${base}148554091.html`,
      title: '第336章 终章',
    }),
  ],
]);

const makeDoc = (url: string): Document => new JSDOM(pages.get(url)!, { url }).window.document;

const toText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '\n')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();

// The live catalog really does open <ul class="chapters"> twice in a row.
function catalogHtml(count: number): string {
  const items = Array.from(
    { length: count },
    (_, i) =>
      `<li class="chapter"><a href="${base}${146537087 + i}.html">第${i + 1}章 测试章节</a></li>`
  ).join('');
  return `<!doctype html><html><head><title>测试书名最新章节-苦读书</title></head><body>
    <div class="main"><div class="headlink cf"><div class="index">
      <div class="volume">测试书名 第一卷：默认</div>
      <ul class="chapters"><ul class="chapters">${items}</ul></ul>
    </div></div></div>
  </body></html>`;
}

describe('kudushu PC rule', () => {
  it('matches chapter URLs only', () => {
    const pattern = new RegExp(kudushuPcRule.match.pattern);
    expect(pattern.test(chapterUrl)).toBe(true);
    expect(pattern.test(`${chapterUrl}?from=reader#x`)).toBe(true);
    expect(pattern.test(indexUrl)).toBe(false);
    expect(pattern.test('https://m.kudushu.org/html/1088392/146537150/')).toBe(false);
    expect(pattern.test('https://www.kudushu.org/book/info/1088/1088392.html')).toBe(false);
  });

  it('reads title and chapter navigation', async () => {
    const parsed = await new Parser().parse(makeDoc(chapterUrl), chapterUrl);
    expect(parsed?.rule?.id).toBe('kudushu-pc');
    expect(parsed?.title).toBe('第64章 测试章节');
    expect(parsed?.prevUrl).toBe(prevUrl);
    expect(parsed?.nextUrl).toBe(nextUrl);
    expect(parsed?.indexUrl).toBe(indexUrl);
  });

  it('does not mistake the catalog link for a neighbouring chapter', async () => {
    const parser = new Parser();

    const first = await parser.parse(makeDoc(firstUrl), firstUrl);
    expect(first?.prevUrl).toBeUndefined();
    expect(first?.nextUrl).toBe(`${base}146537088.html`);

    const last = await parser.parse(makeDoc(lastUrl), lastUrl);
    expect(last?.nextUrl).toBeUndefined();
    expect(last?.prevUrl).toBe(`${base}148554091.html`);
  });

  it('strips the site watermark and the bookmark notices', async () => {
    const parsed = await new Parser().parse(makeDoc(chapterUrl), chapterUrl);
    const text = toText(parsed?.content || '');

    expect(text).not.toContain('kudushu.org');
    expect(text).not.toContain('苦读书');
    expect(text).not.toContain('CTRL+D');
    expect(text).not.toContain('推荐各位书友');
    expect(text).toContain('第6段正文');
    expect(text).toContain('第10段正文');
  });

  it('keeps each chapter whole instead of merging the next one', async () => {
    const merger = createSectionMerger(new Parser());
    const fetched: string[] = [];

    const merged = await merger.merge(makeDoc(chapterUrl), chapterUrl, {
      fetcher: async url => {
        fetched.push(url);
        return makeDoc(url);
      },
      maxPages: 10,
    });

    // 上一页/下一页 label chapter navigation here, so nothing may be merged in.
    expect(fetched).toEqual([]);
    expect(merged?.url).toBe(chapterUrl);
    expect(merged?.nextUrl).toBe(nextUrl);
    expect(toText(merged?.content || '')).not.toContain('第11段正文');
  });

  it('collects the catalog once despite the duplicated <ul class="chapters">', () => {
    const doc = new JSDOM(catalogHtml(40), { url: indexUrl }).window.document;
    const entries = collectTocCandidates(doc, indexUrl, kudushuPcRule);

    expect(entries).toHaveLength(40);
    expect(new Set(entries.map(e => e.url)).size).toBe(40);
    expect(entries[0]).toEqual({ title: '第1章 测试章节', url: `${base}146537087.html` });
    expect(entries[39].url).toBe(`${base}${146537087 + 39}.html`);
  });
});
