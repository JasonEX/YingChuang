import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  catalogChapterCount,
  makeBqg5Catalog,
  makePagedCatalog,
  makePagedCatalogChapter,
  pagedCatalogSites,
} from '../testUtils/pagedCatalogs';
import { createGmStorageMock, stubGmStorage } from '../testUtils/gmStorage';
import { createPinia, setActivePinia } from 'pinia';
import { type FetchAndParseResult, fetchAndParseUrl } from '@/core/utils/network';
import { collectTocCandidates } from '@/ui/stores/reader/tocEntries';
import { kudushuRule } from '@/core/rules/sites/kudushu';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { Parser } from '@/core/parser';
import { useReaderStore } from '@/ui/stores/reader';
import { wxslRule } from '@/core/rules/sites/wxsl';

vi.mock('@/core/utils/network', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/utils/network')>()),
  fetchAndParseUrl: vi.fn(),
}));

// Mirrors production: fetched documents always carry a base URL (live pages via
// doc.location, fetched ones via the <base> tag fetchAndParseUrl injects), so
// rule-based navigation selectors resolve relative hrefs against the real origin.
const parse = (html: string, baseUrl?: string): Document => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (baseUrl) {
    const base = doc.createElement('base');
    base.href = baseUrl;
    doc.head.insertBefore(base, doc.head.firstChild);
  }
  return doc;
};

it('still follows a generic pagination landing page without a configured chapter-list scope', async () => {
  vi.mocked(fetchAndParseUrl).mockReset();
  vi.mocked(fetchAndParseUrl).mockImplementation(url => ({
    promise: Promise.resolve({
      doc: parse(
        url.endsWith('/start')
          ? '<a href="/catalog/list">下一页</a>'
          : '<a href="/book/123/1.html">第1章 正文</a>'
      ),
      finalUrl: url,
      status: 200,
      error: null,
    }),
    abort: vi.fn(),
  }));
  expect(
    await loadTocEntriesPaged('https://example.com/catalog/start', '', undefined, vi.fn())
  ).toEqual([{ title: '第1章 正文', url: 'https://example.com/book/123/1.html' }]);
  expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
});

it.each(['original', 'without-select', 'footer-preview'])(
  'orders the complete catalog with repeated start/latest links (%s)',
  async layout => {
    const origin = 'https://m.bqg5.com';
    const indexUrl = `${origin}/4_4581/`;
    vi.mocked(fetchAndParseUrl).mockReset();
    vi.mocked(fetchAndParseUrl).mockImplementation(url => {
      const page = Number(url.match(/index_(\d+)\.html$/)?.[1] || 1);
      const doc = parse(makeBqg5Catalog(page));
      if (layout === 'without-select') doc.querySelector('select')!.remove();
      if (layout === 'footer-preview') {
        doc.body.append(doc.querySelector('.synopsisArea')!, doc.querySelector('.directoryArea')!);
      }
      return {
        promise: Promise.resolve({
          doc,
          finalUrl: url,
          status: 200,
          error: null,
        }),
        abort: vi.fn(),
      };
    });

    const entries = await loadTocEntriesPaged(
      indexUrl,
      `${origin}/4_4581/2196198.html`,
      undefined,
      vi.fn()
    );
    expect(entries).toHaveLength(203);
    expect(entries.map(entry => entry.title)).toEqual(
      Array.from({ length: 203 }, (_, i) => `${i + 1}、第${i + 1}章 正文`)
    );
    expect(vi.mocked(fetchAndParseUrl).mock.calls.map(([url]) => url)).toEqual([
      indexUrl,
      ...Array.from({ length: 10 }, (_, i) => `${indexUrl}index_${i + 2}.html`),
    ]);
  }
);

for (const site of pagedCatalogSites) {
  const rule = site.id === 'wxsl' ? wxslRule : kudushuRule;
  const indexUrl = site.origin + site.tocPath(1);
  const currentUrl = site.origin + site.chapterPath(25);
  const expected = Array.from({ length: catalogChapterCount }, (_, i) => ({
    title: `第${i + 1}章 测试正文`,
    url: site.origin + site.chapterPath(i + 1),
  }));

  describe(`${site.id} main catalog`, () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });
    beforeEach(() => {
      vi.mocked(fetchAndParseUrl).mockReset();
      vi.mocked(fetchAndParseUrl).mockImplementation(url => ({
        promise: Promise.resolve({
          doc: parse(
            makePagedCatalog(
              site,
              [1, 2, 3].find(p => site.origin + site.tocPath(p) === url)!
            )
          ),
          status: 200,
          finalUrl: url,
          error: null,
        }),
        abort: vi.fn(),
      }));
    });

    it('matches only chapter URLs and keeps the native catalog entrance', async () => {
      const parsed = await new Parser().parse(
        parse(makePagedCatalogChapter(site, 25), currentUrl),
        currentUrl
      );
      expect(parsed?.rule?.id).toBe(site.id);
      expect(parsed?.indexUrl).toBe(indexUrl);
      expect(parsed?.nextUrl).toBe(site.origin + site.chapterPath(26));
      expect(parsed?.title).toBe('第25章 测试正文');
      expect(parsed?.content).toContain('沿着河岸继续赶路');
      expect(parsed?.content).not.toMatch(/第25章|第1\/3页|最新网址|进入书架|上—章|下—章/);
      expect(Array.from(parse(parsed!.content).querySelectorAll('p'), p => p.textContent)).toEqual(
        Array(60).fill('山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。')
      );
      const pattern = new RegExp(rule.match.pattern);
      expect(
        pattern.test(currentUrl.replace(/(\.html|\/)$/, '_2$1') + '?from=reader#content')
      ).toBe(true);
      expect(pattern.test(indexUrl)).toBe(false);
      expect(pattern.test(site.origin + site.tocPath(2))).toBe(false);
      expect(
        pattern.test(currentUrl.replace(new URL(site.origin).hostname, 'unrelated.test'))
      ).toBe(false);
    });

    it('loads every main-list chapter in source order without preview or start-link pollution', async () => {
      const setAbort = vi.fn();
      expect(await loadTocEntriesPaged(indexUrl, currentUrl, rule, setAbort)).toEqual(expected);
      expect(vi.mocked(fetchAndParseUrl).mock.calls.map(([url]) => url)).toEqual(
        [1, 2, 3].map(p => site.origin + site.tocPath(p))
      );
      expect(setAbort).toHaveBeenLastCalledWith(null);
    });

    it('does not fall back to previews or skip the first page when the main list is absent', async () => {
      const doc = parse(makePagedCatalog(site, 1));
      doc.querySelector(rule.toc!.selector!)!.remove();
      expect(collectTocCandidates(doc, indexUrl, rule)).toEqual([]);
      expect(collectTocCandidates(doc, indexUrl).length).toBeGreaterThan(0);
      vi.mocked(fetchAndParseUrl).mockReturnValue({
        promise: Promise.resolve({ doc, status: 200, finalUrl: indexUrl, error: null }),
        abort: vi.fn(),
      });
      expect(await loadTocEntriesPaged(indexUrl, currentUrl, rule, vi.fn())).toEqual([]);
      expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    });

    it.each(['http', 'timeout', 'empty'] as const)(
      'rejects a partial catalog after a later %s failure and allows a fresh load',
      async failure => {
        const original = vi.mocked(fetchAndParseUrl).getMockImplementation()!;
        vi.mocked(fetchAndParseUrl).mockImplementation((url, referer) =>
          url === site.origin + site.tocPath(2)
            ? {
                promise: Promise.resolve({
                  doc: failure === 'empty' ? parse('<title>Just a moment...</title>') : null,
                  status: failure === 'http' ? 403 : 200,
                  finalUrl: url,
                  error: failure === 'empty' ? null : failure,
                }),
                abort: vi.fn(),
              }
            : original(url, referer)
        );
        const setAbort = vi.fn();
        await expect(loadTocEntriesPaged(indexUrl, currentUrl, rule, setAbort)).rejects.toThrow(
          'TOC page'
        );
        expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
        expect(setAbort).toHaveBeenLastCalledWith(null);
        vi.mocked(fetchAndParseUrl).mockImplementation(original);
        expect(await loadTocEntriesPaged(indexUrl, currentUrl, rule, setAbort)).toEqual(expected);
      }
    );

    it('discards earlier pages when cancellation races with a successful response', async () => {
      const original = vi.mocked(fetchAndParseUrl).getMockImplementation()!;
      let cancel: (() => void) | null = null;
      vi.mocked(fetchAndParseUrl).mockImplementation((url, referer) => {
        const request = original(url, referer);
        if (url === site.origin + site.tocPath(2)) cancel?.();
        return request;
      });
      expect(
        await loadTocEntriesPaged(indexUrl, currentUrl, rule, abort => {
          cancel = abort;
        })
      ).toEqual([]);
      expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
      expect(cancel).toBeNull();
    });

    it.each(['failure', 'close'] as const)(
      'does not feed a partial catalog to an awaiting cache-all task after %s',
      async outcome => {
        setActivePinia(createPinia());
        stubGmStorage(createGmStorageMock());
        const store = useReaderStore();
        const chapter = await new Parser().parse(
          parse(makePagedCatalogChapter(site, 25), currentUrl),
          currentUrl
        );
        store.setChapter(chapter!);
        const original = vi.mocked(fetchAndParseUrl).getMockImplementation()!;
        let finish!: (result: FetchAndParseResult) => void;
        const abort = vi.fn();
        vi.mocked(fetchAndParseUrl).mockImplementation((url, referer) =>
          url === site.origin + site.tocPath(2)
            ? {
                promise: new Promise(resolve => {
                  finish = resolve;
                }),
                abort,
              }
            : original(url, referer)
        );
        const loading = store.loadToc();
        const caching = store.startCacheAll();
        await vi.waitFor(() => expect(fetchAndParseUrl).toHaveBeenCalledTimes(2));
        if (outcome === 'close') store.deactivate();
        finish({
          doc: outcome === 'close' ? parse(makePagedCatalog(site, 2)) : null,
          error: outcome === 'close' ? null : 'http',
          status: outcome === 'close' ? 200 : 403,
          finalUrl: site.origin + site.tocPath(2),
        });
        await Promise.all([loading, caching]);
        expect(store.toc).toEqual([]);
        expect(store.tocLoading).toBe(false);
        expect(store.cacheProgress.total).toBe(0);
        expect(store.cacheProgress.running).toBe(false);
        expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
        if (outcome === 'close') expect(abort).toHaveBeenCalledOnce();
        if (outcome === 'failure') {
          vi.mocked(fetchAndParseUrl).mockImplementation(original);
          await store.loadToc();
          expect(store.toc).toEqual(expected);
        }
      }
    );
  });
}
