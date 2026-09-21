import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { collectTocCandidates } from '@/ui/stores/reader/tocEntries';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { Parser } from '@/core/parser';

function makeDoc(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document;
}

function pageHtml(options: {
  body: string;
  nextHref: string;
  nextText?: string;
  pageLabel: string;
  prevHref: string;
}): string {
  return `
    <!doctype html>
    <html>
      <head>
        <title>001 团藏，你根部姓志村啊？ - 穿越三代：让木叶再次伟大！小说 - 钢笔小说</title>
      </head>
      <body>
        <a href="/gb_1/94443">书籍详情</a>
        <h1>001 团藏，你根部姓志村啊？(${options.pageLabel})</h1>
        <div class="content">
          <p>【穿越三代：让木叶再次伟大！】小说免费阅读，请收藏 钢笔小说【goboo.cc】</p>
          <p>${options.body}</p>
          <p>阅|读|模|式|或|畅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。加|载|更|多</p>
        </div>
        <div class="page">
          <a href="${options.prevHref}">上一页</a>
          <a href="/ml_1/94443?cid=1">目录</a>
          <a href="${options.nextHref}">${options.nextText || '下一页'}</a>
        </div>
      </body>
    </html>
  `;
}

describe('Goboo section merge', () => {
  it('merges extensionless /book/chapter/page URLs and cleans mobile template noise', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const page1Url = 'https://m.goboo.cc/gb_1/94443/1';
    const page2Url = 'https://m.goboo.cc/gb_1/94443/1/2';
    const page3Url = 'https://m.goboo.cc/gb_1/94443/1/3';
    const nextChapterUrl = 'https://m.goboo.cc/gb_1/94443/2';

    const pages = new Map<string, string>([
      [
        page1Url,
        pageHtml({
          body: '第一页正文。'.repeat(120),
          nextHref: '/gb_1/94443/1/2',
          pageLabel: '1/3',
          prevHref: 'javascript:void(0);',
        }),
      ],
      [
        page2Url,
        pageHtml({
          body: '第二页正文。'.repeat(120),
          nextHref: '/gb_1/94443/1/3',
          pageLabel: '2/3',
          prevHref: '/gb_1/94443/1',
        }),
      ],
      [
        page3Url,
        pageHtml({
          body: '第三页正文。'.repeat(120),
          nextHref: '/gb_1/94443/2',
          nextText: '下一章',
          pageLabel: '3/3',
          prevHref: '/gb_1/94443/1/2',
        }),
      ],
    ]);

    const parser = new Parser();
    const merger = createSectionMerger(parser);
    const firstPages: Array<{ content: string; nextUrl?: string }> = [];
    const result = await merger.merge(makeDoc(pages.get(page1Url)!, page1Url), page1Url, {
      fetcher: async url => makeDoc(pages.get(url)!, url),
      maxPages: 10,
      onFirstPage: chapter => {
        firstPages.push(chapter);
      },
    });

    expect(firstPages).toHaveLength(1);
    expect(firstPages[0]?.content).toContain('第一页正文。');
    expect(firstPages[0]?.content).not.toContain('第二页正文。');
    expect(firstPages[0]?.nextUrl).toBeUndefined();
    expect(result?.title).toBe('001 团藏，你根部姓志村啊？');
    expect(result?.bookTitle).toBe('穿越三代：让木叶再次伟大！');
    expect(result?.url).toBe(page1Url);
    expect(result?.nextUrl).toBe(nextChapterUrl);
    expect(result?.indexUrl).toBe('https://m.goboo.cc/ml_1/94443');
    expect(result?.content).toContain('第一页正文。');
    expect(result?.content).toContain('第二页正文。');
    expect(result?.content).toContain('第三页正文。');
    expect(result?.content).not.toContain('小说免费阅读，请收藏');
    expect(result?.content).not.toContain('阅|读|模|式');
  });

  it('decodes p_key continuation without waiting for the inert load-more button', async () => {
    const url = 'https://m.goboo.cc/gb_1/94443/1';
    const visible = '当前页可见正文。'.repeat(80);
    const hidden = '编码中的后续正文。'.repeat(80);
    const encoded = Buffer.from(`<p>${hidden}</p>`, 'utf8').toString('base64');
    const doc = makeDoc(
      `<!doctype html>
      <html>
        <head>
          <title>001 测试章节 - 测试小说小说 - 钢笔小说</title>
        </head>
        <body>
          <div class="content">
            <p>【测试小说】小说免费阅读，请收藏 钢笔小说【goboo.cc】</p>
            <p>${visible}</p>
            <p>阅|读|模|式|或|畅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。<button>加|载|更|多</button></p>
          </div>
          <script>const p_key='${encoded}';</script>
        </body>
      </html>`,
      url
    );
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const result = await new Parser().parse(doc, url);

    expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 1200);
    expect(result?.content).toContain(visible);
    expect(result?.content).toContain(hidden);
    expect(result?.content).not.toContain('加载更多');
    expect(result?.content).not.toContain('小说免费阅读，请收藏');
  });

  it('uses the line_1 node as the catalog title instead of concatenating date/index text', () => {
    const url = 'https://m.goboo.cc/ml_1/94443';
    const doc = makeDoc(
      `
        <!doctype html>
        <html>
          <body>
            <ul>
              <li>
                <a href="/gb_1/94443/277">
                  <div class="time">2026-06-08 12:23</div>
                  <div class="line_1">188 平静而迅速变化的三年，火之意志之术，大筒木一族降临</div>
                </a>
              </li>
              <li>
                <a href="/gb_1/94443/1">
                  <span>1</span>
                  <div class="line_1">001 团藏，你根部姓志村啊？</div>
                </a>
              </li>
              <li>
                <a href="/gb_1/94443/17">17017 木叶会是漩涡一族永远的家</a>
              </li>
            </ul>
          </body>
        </html>
      `,
      url
    );
    vi.stubGlobal('Node', doc.defaultView!.Node);

    const entries = collectTocCandidates(doc, url);

    expect(entries[0]).toEqual({
      title: '188 平静而迅速变化的三年，火之意志之术，大筒木一族降临',
      url: 'https://m.goboo.cc/gb_1/94443/277',
    });
    expect(entries[1]).toEqual({
      title: '001 团藏，你根部姓志村啊？',
      url: 'https://m.goboo.cc/gb_1/94443/1',
    });
    expect(entries[2]).toEqual({
      title: '017 木叶会是漩涡一族永远的家',
      url: 'https://m.goboo.cc/gb_1/94443/17',
    });
  });
});
