import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  makeOopCatalog,
  makeOopChapter,
  oopChapterCount,
  oopChapterUrl,
  oopIndexUrl,
} from '../testUtils/oop';
import { builtInRules } from '@/core/rules/builtInRules';
import { createMeta } from '@/meta';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { oopRule } from '@/core/rules/sites/oop';
import { Parser } from '@/core/parser';
import { SectionMerger } from '@/core/auto-enable/SectionMerger';

function doc(html: string, url = oopChapterUrl()): Document {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const base = document.createElement('base');
  base.href = url;
  document.head.prepend(base);
  return document;
}

afterEach(() => vi.unstubAllGlobals());

describe('短篇小說 adapter', () => {
  it('registers chapter-only matching and injection on the supplied catalog URL', () => {
    expect(builtInRules).toContain(oopRule);
    const pattern = new RegExp(oopRule.match.pattern);
    expect(pattern.test(oopChapterUrl())).toBe(true);
    expect(pattern.test(`${oopChapterUrl(31, 2)}?from=reader#body`)).toBe(true);
    expect(pattern.test(`${oopIndexUrl}?p=4`)).toBe(false);
    expect(pattern.test(oopChapterUrl().replace('www.oop.tw', 'www.oop.tw.evil.example'))).toBe(
      false
    );
    expect(pattern.test(oopChapterUrl().replace('a835900a.html', 'a835900_0a.html'))).toBe(false);
    expect(createMeta({ version: 'test' }).matches).toContain('*://www.oop.tw/*');
  });

  it('keeps one section identity without rewriting catalog or unrelated URLs', () => {
    const parse = oopRule.hooks!.parseSectionUrl!;
    expect(parse(`${oopChapterUrl(31, 2)}?lang=tw#body`)).toEqual({
      chapterUrl: `${oopChapterUrl()}?lang=tw`,
      page: 2,
    });
    expect(parse(oopChapterUrl())).toEqual({ chapterUrl: oopChapterUrl(), page: 1 });
    expect(parse(`${oopIndexUrl}?p=4`)).toBeNull();
    expect(parse('https://other.example/areada/a33080432a/a835900_2a.html')).toBeNull();
  });

  it.each([false, true])(
    'restores raw tails and preserves rendered text (rendered=%s)',
    async rendered => {
      const document = doc(makeOopChapter(31, 1, rendered));
      const parser = new Parser();
      for (let iteration = 0; iteration < 2; iteration++) {
        const parsed = await parser.parse(document, oopChapterUrl());
        expect(parsed).toMatchObject({
          title: '第31章 山路',
          bookTitle: '山間行旅',
          prevUrl: oopChapterUrl(30),
          nextUrl: oopChapterUrl(31, 2),
          indexUrl: oopIndexUrl,
          method: 'rule',
        });
        expect(parsed?.content).toContain('第1頁尾段。');
        expect(parsed?.content).toContain('第1頁終點😀。');
        expect(parsed?.content).not.toMatch(/廣告推薦|請前往|ｏｏｐ|😀點終/);
      }
      expect(document.querySelector('#article')!.hasAttribute('data-ct')).toBe(false);
    }
  );

  it.each([0, 999, NaN])('leaves text alone when the reversal count is %s', async count => {
    const document = doc(makeOopChapter(31, 1, true));
    const article = document.querySelector<HTMLElement>('#article')!;
    article.style.removeProperty('font-size');
    article.setAttribute('data-ct', String(count));
    const before = article.innerHTML;
    await oopRule.hooks!.beforeParse!(document);
    expect(article.innerHTML).toBe(before);
  });

  it('accepts documents without the reversal marker and excludes catalog navigation at book ends', async () => {
    await oopRule.hooks!.beforeParse!(doc('<p>沒有正文標記</p>'));
    const first = await new Parser().parse(doc(makeOopChapter(1)), oopChapterUrl(1));
    expect(first?.prevUrl).toBeUndefined();
    const last = await new Parser().parse(
      doc(makeOopChapter(oopChapterCount, 2)),
      oopChapterUrl(oopChapterCount, 2)
    );
    expect(last?.nextUrl).toBeUndefined();
    expect(last?.indexUrl).toBe(oopIndexUrl);
  });

  it.each([1, 2])('merges both sections once when opened at page %i', async page => {
    const fetcher = vi.fn(async (url: string) => {
      const section = url === oopChapterUrl() ? 1 : url === oopChapterUrl(31, 2) ? 2 : null;
      if (!section) throw new Error(`Unexpected section request ${url}`);
      return doc(makeOopChapter(31, section), url);
    });
    const onFirstPage = vi.fn();
    const onSectionPage = vi.fn();
    const onMergeEnd = vi.fn();
    const parsed = await new SectionMerger(new Parser()).merge(
      doc(makeOopChapter(31, page), oopChapterUrl(31, page)),
      oopChapterUrl(31, page),
      { fetcher, onFirstPage, onSectionPage, onMergeEnd }
    );
    expect(parsed).toMatchObject({
      url: oopChapterUrl(),
      prevUrl: oopChapterUrl(30),
      nextUrl: oopChapterUrl(32),
    });
    for (const section of [1, 2]) {
      expect(parsed?.content).toContain(`第${section}頁起點。`);
      expect(parsed?.content).toContain(`第${section}頁終點😀。`);
    }
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      oopChapterUrl(31, page === 1 ? 2 : 1),
      oopChapterUrl(31, page)
    );
    expect(onFirstPage).toHaveBeenCalledWith(
      expect.objectContaining({ url: oopChapterUrl(), nextUrl: undefined }),
      expect.objectContaining({ loaded: 1 })
    );
    expect(onSectionPage).toHaveBeenCalledWith(
      expect.objectContaining({ nextUrl: oopChapterUrl(32) }),
      expect.objectContaining({ loaded: 2 })
    );
    expect(onMergeEnd).toHaveBeenCalledWith({ loaded: 2, total: undefined, truncated: false });
  });

  it('loads every main-list entry in chapter order without previews or trap links', async () => {
    const requests: string[] = [];
    vi.stubGlobal('GM_xmlhttpRequest', (options: GM_xmlhttpRequestOptions) => {
      requests.push(options.url);
      const page = Number(new URL(options.url).searchParams.get('p') || 1);
      options.onload?.({
        responseText: makeOopCatalog(page),
        status: 200,
        statusText: 'OK',
        finalUrl: options.url,
        readyState: 4,
        responseHeaders: '',
      });
      return { abort: vi.fn() };
    });
    const entries = await loadTocEntriesPaged(oopIndexUrl, oopChapterUrl(), oopRule, vi.fn());
    expect(entries).toEqual(
      Array.from({ length: oopChapterCount }, (_, index) => ({
        title: `第${index + 1}章 山路`,
        url: oopChapterUrl(index + 1),
      }))
    );
    expect(requests).toEqual([oopIndexUrl, `${oopIndexUrl}?p=2`, `${oopIndexUrl}?p=3`]);
  });
});
