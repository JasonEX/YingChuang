import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedChapter, Parser } from '@/core/parser';
import type { SiteRule } from '@/core/rules/types';

const { mockFetchAndParseUrl } = vi.hoisted(() => ({
  mockFetchAndParseUrl: vi.fn(),
}));

vi.mock('@/core/utils/network', () => ({
  fetchAndParseUrl: mockFetchAndParseUrl,
}));

import {
  type SectionMergeEnd,
  SectionMerger,
  type SectionPageDelta,
} from '@/core/auto-enable/SectionMerger';
import { joinHtml } from '@/core/utils';

describe('SectionMerger (extra coverage)', () => {
  beforeEach(() => {
    mockFetchAndParseUrl.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeDoc = () =>
    new DOMParser().parseFromString('<!doctype html><html><body></body></html>', 'text/html');

  it('falls back to parsed section-like nextUrl when nextSectionUrl is missing', async () => {
    const parsed: Record<string, ParsedChapter> = {
      'https://example.com/1.html': {
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url: 'https://example.com/1.html',
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
        rule: {
          id: 'r',
          version: 1,
          match: { pattern: 'example\\.com', type: 'regex' },
          content: { selector: '#content' },
          advanced: { checkSection: true },
          meta: { source: 'builtin' },
        },
      },
      'https://example.com/1_2.html': {
        title: 'c1-2',
        content: '<p>b</p>',
        rawContent: '<p>b</p>',
        url: 'https://example.com/1_2.html',
        nextUrl: 'https://example.com/1_3.html',
        confidence: 1,
        method: 'rule',
      },
      'https://example.com/1_3.html': {
        title: 'c1-3',
        content: '<p>c</p>',
        rawContent: '<p>c</p>',
        url: 'https://example.com/1_3.html',
        nextUrl: 'https://example.com/2.html',
        confidence: 1,
        method: 'rule',
      },
    };

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => parsed[url] || null),
      detectSection: vi.fn((_doc: Document, _url: string) => ({
        isSection: true,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0.9,
      })),
    };

    const fetcher = vi.fn(async () => makeDoc());
    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(makeDoc(), 'https://example.com/1.html', {
      maxPages: 10,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalled();
    expect(result?.content).toContain('<p>a</p>');
    expect(result?.content).toContain('<p>b</p>');
    expect(result?.content).toContain('<p>c</p>');
    expect(result?.nextUrl).toBe('https://example.com/2.html');
  });

  it('returns early when signal is aborted before normalization fetch', async () => {
    const fakeParser = {
      parse: vi.fn(async () => null),
      detectSection: vi.fn(() => undefined),
    };

    const controller = new AbortController();
    controller.abort();

    const fetcher = vi.fn(async () => makeDoc());
    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(makeDoc(), 'https://example.com/1_2.html', {
      fetcher,
      signal: controller.signal,
    });

    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(fakeParser.parse).not.toHaveBeenCalled();
    expect(fakeParser.detectSection).not.toHaveBeenCalled();
  });

  it('aborts an in-flight fetch task when signal becomes aborted synchronously', async () => {
    let aborted = false;
    const signal = {
      get aborted() {
        return aborted;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as AbortSignal;

    const abort = vi.fn();
    mockFetchAndParseUrl.mockImplementationOnce(() => {
      aborted = true;
      return { promise: new Promise(() => {}), abort };
    });

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
        rule: {
          id: 'r',
          version: 1,
          match: { pattern: 'example\\.com', type: 'regex' },
          content: { selector: '#content' },
          advanced: { checkSection: true },
          meta: { source: 'builtin' },
        },
      })),
      detectSection: vi.fn(() => ({
        isSection: true,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0.9,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(makeDoc(), 'https://example.com/1.html', { signal });

    expect(result?.content).toContain('<p>a</p>');
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('resolves real next chapter URL when section-like nextUrl is present but should not merge', async () => {
    const doc = makeDoc();
    doc.body.innerHTML = `
      <a href="/1_2.html">Next page</a>
      <a href="/2.html">下章</a>
    `;

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
      })),
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(doc, 'https://example.com/1.html');

    expect(result?.nextUrl).toBe('https://example.com/2.html');
  });

  it('returns first chapter when rule disables section merge', async () => {
    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
        rule: {
          id: 'r',
          version: 1,
          match: { pattern: 'example\\.com', type: 'regex' },
          content: { selector: '#content' },
          advanced: { noSection: true },
          meta: { source: 'builtin' },
        },
      })),
      detectSection: vi.fn(() => undefined),
    };

    const fetcher = vi.fn(async () => makeDoc());
    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(makeDoc(), 'https://example.com/1.html', { fetcher });

    expect(result?.nextUrl).toBe('https://example.com/1_2.html');
    expect(fetcher).not.toHaveBeenCalled();
    expect(fakeParser.detectSection).not.toHaveBeenCalled();
  });

  it('keeps section-like nextUrl when detection provides nextSectionUrl but should not merge', async () => {
    const doc = makeDoc();
    doc.body.innerHTML = `
      <a href="/2.html">下章</a>
    `;

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
      })),
      detectSection: vi.fn(() => ({
        isSection: true,
        nextSectionUrl: 'https://example.com/1_2.html',
        nextChapterUrl: null,
        confidence: 0.1,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(doc, 'https://example.com/1.html');

    expect(result?.nextUrl).toBe('https://example.com/1_2.html');
  });

  it('normalizes later section page to baseUrl when base fetch succeeds', async () => {
    const baseDoc = makeDoc();
    const openDoc = makeDoc();

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: undefined,
        confidence: 1,
        method: 'rule',
        rule: {
          id: 'r',
          version: 1,
          match: { pattern: 'example\\.com', type: 'regex' },
          content: { selector: '#content' },
          advanced: { noSection: true },
          meta: { source: 'builtin' },
        },
      })),
      detectSection: vi.fn(() => undefined),
    };

    const fetcher = vi.fn(async (url: string) => (url.endsWith('/1.html') ? baseDoc : null));
    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(openDoc, 'https://example.com/1_2.html', { fetcher });

    expect(fakeParser.parse).toHaveBeenCalledWith(baseDoc, 'https://example.com/1.html');
    expect(result?.url).toBe('https://example.com/1.html');
  });

  it('refetches a cached section page when cached parsing fails after base normalization', async () => {
    const baseDoc = makeDoc();
    const openDoc = makeDoc();
    const refetchedDoc = makeDoc();

    const fakeParser = {
      parse: vi.fn(async (doc: Document, url: string) => {
        if (url.endsWith('/1.html')) {
          return {
            title: 'c1',
            content: '<p>a</p>',
            rawContent: '<p>a</p>',
            url,
            nextUrl: 'https://example.com/1_2.html',
            confidence: 1,
            method: 'rule',
            rule: {
              id: 'r',
              version: 1,
              match: { pattern: 'example\\.com', type: 'regex' },
              content: { selector: '#content' },
              advanced: { checkSection: true },
              meta: { source: 'builtin' },
            },
          } satisfies ParsedChapter;
        }

        if (url.endsWith('/1_2.html') && doc === openDoc) {
          return null;
        }

        if (url.endsWith('/1_2.html') && doc === refetchedDoc) {
          return {
            title: 'c1-2',
            content: '<p>b</p>',
            rawContent: '<p>b</p>',
            url,
            nextUrl: 'https://example.com/2.html',
            confidence: 1,
            method: 'rule',
          } satisfies ParsedChapter;
        }

        return null;
      }),
      detectSection: vi.fn((_doc: Document, url: string) => {
        if (url.endsWith('/1.html')) {
          return {
            isSection: true,
            nextSectionUrl: 'https://example.com/1_2.html',
            nextChapterUrl: null,
            confidence: 1,
          };
        }

        return {
          isSection: true,
          nextSectionUrl: null,
          nextChapterUrl: 'https://example.com/2.html',
          confidence: 1,
        };
      }),
    };

    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/1.html')) return baseDoc;
      if (url.endsWith('/1_2.html')) return refetchedDoc;
      return null;
    });
    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(openDoc, 'https://example.com/1_2.html', { fetcher });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://example.com/1.html',
      'https://example.com/1_2.html'
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://example.com/1_2.html',
      'https://example.com/1.html'
    );
    expect(result?.content).toContain('<p>a</p>');
    expect(result?.content).toContain('<p>b</p>');
    expect(result?.nextUrl).toBe('https://example.com/2.html');
  });

  it('finds forward next chapter URL and skips pagination-like "next page" links', async () => {
    const doc = makeDoc();
    doc.body.innerHTML = `
      <a href="/p2.html">Next page</a>
      <a href="/continue.html">继续阅读</a>
      <a href="/2.html" rel="next">后一章</a>
    `;

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
      })),
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(doc, 'https://example.com/1.html');

    expect(result?.nextUrl).toBe('https://example.com/2.html');
  });

  it('prefers strong English next-link hints like "Next"', async () => {
    const doc = makeDoc();
    doc.body.innerHTML = `
      <a href="/p2.html">Next page</a>
      <a href="/2.html">Next</a>
    `;

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
      })),
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(doc, 'https://example.com/1.html');

    expect(result?.nextUrl).toBe('https://example.com/2.html');
  });

  it('does not change nextUrl when no suitable next-chapter link can be found', async () => {
    const doc = makeDoc();
    doc.body.innerHTML = `
      <a>no href</a>
      <a href="/1_2.html">下一页</a>
      <a href="/same.html"> </a>
    `;

    const fakeParser = {
      parse: vi.fn(async (_doc: Document, url: string) => ({
        title: 'c1',
        content: '<p>a</p>',
        rawContent: '<p>a</p>',
        url,
        nextUrl: 'https://example.com/1_2.html',
        confidence: 1,
        method: 'rule',
      })),
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })),
    };

    const merger = new SectionMerger(fakeParser as unknown as Parser);
    const result = await merger.merge(doc, 'https://example.com/1.html');

    expect(result?.nextUrl).toBe('https://example.com/1_2.html');
  });
});

describe('SectionMerger (progressive section streaming)', () => {
  const pageUrls = [
    'https://example.com/1.html',
    'https://example.com/1_2.html',
    'https://example.com/1_3.html',
  ];

  interface ProgressiveSetup {
    /** Extra `advanced` flags folded into the first page's rule. */
    advanced?: SiteRule['advanced'];
    /** Section marker printed in each page title, by 1-based page number. */
    marker?: (page: number) => string;
    /** Pages the fetcher refuses to serve, by 1-based page number. */
    missing?: number[];
    pages?: number;
  }

  function setup(options: ProgressiveSetup = {}) {
    const pageCount = options.pages ?? 3;
    const urls = pageUrls.slice(0, pageCount);

    const docs = new Map(
      urls.map((url, index) => [
        url,
        new DOMParser().parseFromString(
          `<!doctype html><html><head><title>第一章${options.marker?.(index + 1) ?? ''}</title></head><body></body></html>`,
          'text/html'
        ),
      ])
    );

    const rule: SiteRule = {
      id: 'progressive-fixture',
      version: 1,
      match: { pattern: 'example\\.com', type: 'regex' },
      content: { selector: '#content' },
      advanced: { checkSection: true, ...options.advanced },
      meta: { source: 'builtin' },
    };

    const parser = {
      parse: vi.fn(async (_doc: Document, url: string) => {
        const index = urls.indexOf(url);
        const parsed: ParsedChapter = {
          title: '第一章',
          content: `<p>page${index + 1}</p>`,
          rawContent: `<p>raw${index + 1}</p>`,
          url,
          confidence: 1,
          method: 'rule',
        };
        return index === 0 ? { ...parsed, rule } : parsed;
      }),
      detectSection: vi.fn((_doc: Document, url: string) => ({
        isSection: true,
        nextSectionUrl: urls[urls.indexOf(url) + 1] ?? null,
        nextChapterUrl: null,
        confidence: 1,
      })),
    };

    const missing = new Set((options.missing ?? []).map(page => urls[page - 1]));
    const fetcher = vi.fn(async (url: string) =>
      missing.has(url) ? null : (docs.get(url) ?? null)
    );

    const deltas: SectionPageDelta[] = [];
    const firstPages: ParsedChapter[] = [];
    const ends: SectionMergeEnd[] = [];
    const progressTotals: Array<number | undefined> = [];

    return {
      deltas,
      ends,
      fetcher,
      firstPages,
      merger: new SectionMerger(parser as unknown as Parser),
      progressTotals,
      startDoc: docs.get(urls[0])!,
      startUrl: urls[0],
      handlers: {
        fetcher,
        onFirstPage: (chapter: ParsedChapter, progress: { total?: number }) => {
          firstPages.push(chapter);
          progressTotals.push(progress.total);
        },
        onSectionPage: (delta: SectionPageDelta, progress: { total?: number }) => {
          deltas.push(delta);
          progressTotals.push(progress.total);
        },
        onMergeEnd: (end: SectionMergeEnd) => {
          ends.push(end);
        },
      },
    };
  }

  it('emits one delta per extra page, each carrying only that page', async () => {
    const s = setup();
    const result = await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.firstPages).toHaveLength(1);
    expect(s.firstPages[0]?.content).toBe('<p>page1</p>');
    expect(s.deltas.map(delta => delta.content)).toEqual(['<p>page2</p>', '<p>page3</p>']);
    expect(s.deltas.map(delta => delta.rawContent)).toEqual(['<p>raw2</p>', '<p>raw3</p>']);
    expect(result?.content).toContain('<p>page3</p>');
  });

  it('folds first page and deltas back into exactly the merged content', async () => {
    const s = setup();
    const result = await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    const folded = [s.firstPages[0]!.content, ...s.deltas.map(delta => delta.content)].reduce(
      (left, right) => joinHtml(left, right)
    );
    const foldedRaw = [
      s.firstPages[0]!.rawContent,
      ...s.deltas.map(delta => delta.rawContent),
    ].reduce((left, right) => joinHtml(left, right));

    expect(folded).toBe(result?.content);
    expect(foldedRaw).toBe(result?.rawContent);
  });

  it('does not fetch the next page until onFirstPage resolves', async () => {
    const s = setup();
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });

    const merged = s.merger.merge(s.startDoc, s.startUrl, {
      ...s.handlers,
      onFirstPage: () => gate,
    });

    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(s.fetcher).not.toHaveBeenCalled();

    release();
    const result = await merged;
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    expect(result?.content).toContain('<p>page3</p>');
  });

  it('stays silent when the rule opts out, and still merges everything', async () => {
    const s = setup({ advanced: { disableProgressiveSectionMerge: true } });
    const result = await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.firstPages).toHaveLength(0);
    expect(s.deltas).toHaveLength(0);
    expect(s.ends).toHaveLength(0);
    expect(result?.content).toContain('<p>page3</p>');
  });

  it('stays silent when only one page may be merged', async () => {
    const s = setup();
    const result = await s.merger.merge(s.startDoc, s.startUrl, { ...s.handlers, maxPages: 1 });

    expect(s.firstPages).toHaveLength(0);
    expect(s.deltas).toHaveLength(0);
    expect(result?.content).toBe('<p>page1</p>');
  });

  it('reports a section total when every page agrees on its marker', async () => {
    const s = setup({ marker: page => `(${page}/3)` });
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.progressTotals).toEqual([3, 3, 3]);
    expect(s.ends[0]?.total).toBe(3);
  });

  it('accepts the Chinese 第n/m页 marker form', async () => {
    const s = setup({ marker: page => `(第${page}/3页)` });
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.ends[0]?.total).toBe(3);
  });

  it('drops the total when a page disagrees with its own position', async () => {
    const s = setup({ marker: page => (page === 2 ? '(1/3)' : `(${page}/3)`) });
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.progressTotals).toEqual([3, undefined, undefined]);
    expect(s.ends[0]?.total).toBeUndefined();
  });

  it('never substitutes the page cap for a missing marker', async () => {
    const s = setup({ advanced: { sectionMaxPages: 3 } });
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.progressTotals.every(total => total === undefined)).toBe(true);
    expect(s.ends[0]?.total).toBeUndefined();
  });

  it('reports a clean end when the last page is reached', async () => {
    const s = setup();
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.ends).toEqual([{ loaded: 3, total: undefined, truncated: false }]);
  });

  it('reports truncation when a section page cannot be fetched', async () => {
    const s = setup({ missing: [3] });
    await s.merger.merge(s.startDoc, s.startUrl, s.handlers);

    expect(s.deltas).toHaveLength(1);
    expect(s.ends[0]).toMatchObject({ loaded: 2, truncated: true });
  });

  it('reports truncation when the page cap is reached early', async () => {
    const s = setup();
    await s.merger.merge(s.startDoc, s.startUrl, { ...s.handlers, maxPages: 2 });

    expect(s.deltas).toHaveLength(1);
    expect(s.ends[0]).toMatchObject({ loaded: 2, truncated: true });
  });

  it('stops emitting and reports truncation once aborted mid-merge', async () => {
    const s = setup();
    const controller = new AbortController();

    await s.merger.merge(s.startDoc, s.startUrl, {
      ...s.handlers,
      signal: controller.signal,
      onSectionPage: (delta: SectionPageDelta) => {
        s.deltas.push(delta);
        controller.abort();
      },
    });

    expect(s.deltas).toHaveLength(1);
    expect(s.ends[0]).toMatchObject({ loaded: 2, truncated: true });
  });
});
