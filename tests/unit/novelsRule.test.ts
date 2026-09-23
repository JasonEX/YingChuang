import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encryptNovels,
  makeNovelsChapter,
  novelsBookPath,
  novelsOrigin,
  novelsUrl,
} from '../testUtils/novels';

import { builtInRules } from '@/core/rules/builtInRules';
import { createMeta } from '@/meta';

import { normalizeUrlForBlock, normalizeUrlForFetch } from '@/ui/stores/reader/utils';

import { novelsRule } from '@/core/rules/sites/novels';
import { Parser } from '@/core/parser';
import { SectionMerger } from '@/core/auto-enable/SectionMerger';
import { webcrypto } from 'node:crypto';

function doc(html: string) {
  const result = new DOMParser().parseFromString(html, 'text/html');
  const base = result.createElement('base');
  base.href = novelsOrigin;
  result.head.prepend(base);
  return result;
}

afterEach(() => vi.unstubAllGlobals());

describe('繁體小說 rule', () => {
  it('registers chapter-only matching and injection for query-string URLs', () => {
    expect(builtInRules).toContain(novelsRule);
    const pattern = new RegExp(novelsRule.match.pattern);
    expect(pattern.test(novelsUrl())).toBe(true);
    expect(pattern.test(novelsUrl(21, 2))).toBe(true);
    expect(pattern.test(novelsOrigin + novelsBookPath)).toBe(false);
    expect(pattern.test(novelsUrl().replace('www.novels.com.tw', 'other.example'))).toBe(false);
    expect(createMeta({ version: 'test' }).matches).toContain('*://www.novels.com.tw/novels/*');
  });

  it('uses one chapter identity for catalog, tracking links and block/cache keys', () => {
    const canonical = novelsUrl().split('?')[0];
    expect(normalizeUrlForFetch(novelsUrl())).toBe(canonical);
    expect(normalizeUrlForBlock(novelsUrl())).toBe(canonical);
    expect(normalizeUrlForFetch(`${novelsUrl()}&lang=zh#top`)).toBe(`${canonical}?lang=zh`);
    expect(normalizeUrlForFetch(novelsUrl(21, 2))).toBe(novelsUrl(21, 2).split('?')[0]);
    const other = 'https://example.com/chapter/12.html?aid=42';
    expect(normalizeUrlForFetch(other)).toBe(other);
    expect(normalizeUrlForBlock(other)).toBe(other);
  });

  it.each([1, 2, 3])('decrypts and merges a chapter opened at page %i', async page => {
    vi.stubGlobal('crypto', webcrypto);
    const fetcher = vi.fn(async (url: string) => {
      const section = [1, 2, 3].find(
        i => normalizeUrlForFetch(novelsUrl(21, i)) === normalizeUrlForFetch(url)
      );
      if (!section) throw new Error(`Unexpected URL ${url}`);
      return doc(makeNovelsChapter(21, section).replaceAll('?aid=1092650', new URL(url).search));
    });
    const parsed = await new SectionMerger(new Parser()).merge(
      doc(makeNovelsChapter(21, page)),
      novelsUrl(21, page),
      { fetcher }
    );
    expect(parsed?.title).toBe('第21章 山間行旅');
    expect(parsed?.bookTitle).toBe('山間行旅');
    expect(normalizeUrlForFetch(parsed!.url)).toBe(novelsUrl().split('?')[0]);
    expect(normalizeUrlForFetch(parsed!.prevUrl!)).toBe(novelsUrl(20).split('?')[0]);
    expect(normalizeUrlForFetch(parsed!.nextUrl!)).toBe(novelsUrl(22).split('?')[0]);
    expect(parsed?.indexUrl).toBe(novelsOrigin + novelsBookPath);
    for (const i of [1, 2, 3]) expect(parsed?.content).toContain(`第${i}頁終點`);
    expect(parsed?.content).not.toMatch(/encryptedContent|繼續全文閱讀/);
    expect(parsed?.content).not.toContain(String.fromCharCode(8));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => normalizeUrlForFetch(url))).not.toContain(
      normalizeUrlForFetch(novelsUrl(21, page))
    );
  });

  it('preserves already-rendered paragraphs and removes injected ad containers', async () => {
    const document = doc(makeNovelsChapter());
    document.querySelector('#article')!.innerHTML =
      '<p>旅人繼續沿著山路前進。</p>'.repeat(25) + '<div id="compass-fit-123">廣告干擾</div>';
    const parsed = await new Parser().parse(document, novelsUrl());
    expect(parsed?.content).toContain('旅人繼續');
    expect(parsed?.content).not.toContain('廣告干擾');
  });

  it('streams only the current chapter and exposes the next chapter after its last page', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const url = (chapter: number, page = 1) => novelsUrl(chapter, page).split('?')[0];
    const fetcher = vi.fn(async (requested: string) => {
      const page = [2, 3].find(page => requested === url(48, page));
      if (!page) throw new Error(`Unexpected section request ${requested}`);
      return doc(makeNovelsChapter(48, page).replaceAll('?aid=1092650', ''));
    });
    const onFirstPage = vi.fn();
    const onSectionPage = vi.fn();
    const onMergeEnd = vi.fn();
    const parsed = await new SectionMerger(new Parser()).merge(
      doc(makeNovelsChapter(48).replaceAll('?aid=1092650', '')),
      url(48),
      { fetcher, onFirstPage, onSectionPage, onMergeEnd }
    );

    expect(onFirstPage).toHaveBeenCalledWith(
      expect.objectContaining({ url: url(48), nextUrl: undefined }),
      { url: url(48), loaded: 1, total: 3 }
    );
    expect(fetcher.mock.calls.map(([requested]) => requested)).toEqual([url(48, 2), url(48, 3)]);
    expect(onSectionPage.mock.calls.map(([delta]) => delta.nextUrl)).toEqual([undefined, url(49)]);
    expect(onMergeEnd).toHaveBeenCalledWith({ loaded: 3, total: 3, truncated: false });
    expect(parsed).toMatchObject({ url: url(48), nextUrl: url(49) });
  });

  it('renders plain text without treating ampersands as markup', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const document = doc(makeNovelsChapter());
    document.querySelector('#chapter-content script')!.textContent =
      `window.encryptedContent = ${JSON.stringify(encryptNovels('山路 & 晨霧\n第二行'))};`;
    await novelsRule.hooks!.beforeParse!(document);
    expect(document.querySelector('#article')!.textContent).toBe('山路 & 晨霧第二行');
    expect(document.querySelectorAll('#article > p')).toHaveLength(2);
  });

  it('aborts a failed decode without changing the host page or publishing a chapter', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const document = doc(makeNovelsChapter());
    document.querySelector('#chapter-content script')!.textContent =
      'window.encryptedContent = "broken";';
    const original = document.body.innerHTML;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onFirstPage = vi.fn();
    const fetcher = vi.fn();
    try {
      const parsed = await new SectionMerger(new Parser()).merge(document, novelsUrl(), {
        onFirstPage,
        fetcher,
      });
      expect(parsed).toBeNull();
      expect(document.body.innerHTML).toBe(original);
      expect(onFirstPage).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('[Parser] beforeParse hook error:', expect.any(Error));
    } finally {
      warn.mockRestore();
    }
    await novelsRule.hooks!.beforeParse!(doc('<p>non-chapter</p>'));
  });
});
