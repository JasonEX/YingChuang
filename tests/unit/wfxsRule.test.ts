import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextWfxsTocPage, wfxsRule } from '@/core/rules/sites/wfxs';
import {
  wfxsCatalog,
  wfxsChapter,
  wfxsChapterUrl,
  wfxsIndexUrl,
  wfxsOrigin,
} from '../testUtils/wfxs';
import { builtInRules } from '@/core/rules/builtInRules';
import { createMeta } from '@/meta';
import { JSDOM } from 'jsdom';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { Parser } from '@/core/parser';

const doc = (html: string) => new JSDOM(html, { url: wfxsIndexUrl }).window.document;

describe('Wfxs mobile adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('GM_getValue', () => null);
    vi.stubGlobal('GM_setValue', () => {});
    vi.stubGlobal('GM_listValues', () => []);
    vi.stubGlobal('GM_deleteValue', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('registers only mobile chapter URLs and a matching userscript entry', () => {
    expect(builtInRules).toContain(wfxsRule);
    const pattern = new RegExp(wfxsRule.match.pattern);
    expect(pattern.test('https://m.wfxs.tw/xiaoshuo/9074406/84446392/')).toBe(true);
    expect(pattern.test(wfxsChapterUrl(1) + '?from=toc#body')).toBe(true);
    expect(pattern.test(wfxsIndexUrl)).toBe(false);
    expect(pattern.test(`${wfxsOrigin}/xiaoshuo/9074406/`)).toBe(false);
    expect(pattern.test('https://m.wfxs.tw.evil.example/xiaoshuo/9074406/1/')).toBe(false);
    expect(createMeta({ version: '1.0.17' }).matches).toContain('*://m.wfxs.tw/xiaoshuo/*/*/');
  });

  it('parses the real DOM structure without recommendations or site UI', async () => {
    const result = await new Parser().parse(doc(wfxsChapter(4)), wfxsChapterUrl(4));
    expect(result?.rule?.id).toBe('wfxs');
    expect(result?.bookTitle).toBe('测试之旅');
    expect(result?.title).toBe('第4章 山间');
    expect(result?.prevUrl).toBe(wfxsChapterUrl(3));
    expect(result?.nextUrl).toBe(wfxsChapterUrl(5));
    expect(result?.indexUrl).toBe(wfxsIndexUrl);
    expect(result?.content).toContain('第4章正文');
    expect(result?.content).not.toContain('广告推荐文字');
  });

  it('follows ascending same-book links and stops at the last page', () => {
    expect(nextWfxsTocPage(doc(wfxsCatalog(1)), wfxsIndexUrl)).toBe(
      `${wfxsOrigin}/booklist/9074406/2.html`
    );
    expect(nextWfxsTocPage(doc(wfxsCatalog(2)), `${wfxsOrigin}/booklist/9074406/2.html`)).toBe(
      `${wfxsOrigin}/booklist/9074406/3.html`
    );
    expect(
      nextWfxsTocPage(doc(wfxsCatalog(3)), `${wfxsOrigin}/booklist/9074406/3.html`)
    ).toBeNull();
    expect(
      nextWfxsTocPage(doc(wfxsCatalog(1)), 'https://other.example/booklist/9074406.html')
    ).toBeNull();
    expect(nextWfxsTocPage(doc(wfxsCatalog(1)), wfxsChapterUrl(1))).toBeNull();
  });

  it('rejects a broken page chain instead of publishing a truncated catalog', () => {
    const html = wfxsCatalog(1).replace(
      'href="/booklist/9074406/2.html"',
      'href="/booklist/999/2.html"'
    );
    expect(() => nextWfxsTocPage(doc(html), wfxsIndexUrl)).toThrow('missing the next page');
  });

  it('ignores malformed and off-site links, and rejects missing pagination controls', () => {
    const html =
      wfxsCatalog(1) +
      '<a href="http://[">bad</a><a href="https://other.example/booklist/9074406/2.html">bad</a>';
    expect(nextWfxsTocPage(doc(html), wfxsIndexUrl)).toBe(`${wfxsOrigin}/booklist/9074406/2.html`);
    expect(() => nextWfxsTocPage(doc('<ul id="html_box"></ul>'), wfxsIndexUrl)).toThrow(
      'pagination controls'
    );
  });

  it.each(['runtime', 'persisted'])('loads each catalog page once with a %s rule', async source => {
    const rule =
      source === 'persisted' ? (JSON.parse(JSON.stringify(wfxsRule)) as typeof wfxsRule) : wfxsRule;
    const requests: string[] = [];
    vi.stubGlobal('GM_xmlhttpRequest', (opts: GM_xmlhttpRequestOptions) => {
      requests.push(opts.url);
      const page = Number(new URL(opts.url).pathname.match(/\/(\d+)\.html$/)?.[1]);
      const body = wfxsCatalog(page === 9074406 ? 1 : page);
      opts.onload?.({
        responseText: body,
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
        readyState: 4,
        responseHeaders: '',
      });
      return { abort: vi.fn() };
    });
    const entries = await loadTocEntriesPaged(wfxsIndexUrl, wfxsChapterUrl(4), rule, vi.fn());
    expect(entries.map(e => e.url)).toEqual(
      Array.from({ length: 9 }, (_, i) => wfxsChapterUrl(i + 1))
    );
    expect(requests).toEqual([
      wfxsIndexUrl,
      `${wfxsOrigin}/booklist/9074406/2.html`,
      `${wfxsOrigin}/booklist/9074406/3.html`,
    ]);
  });
});
