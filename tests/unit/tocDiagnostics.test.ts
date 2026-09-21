import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearDebugEvents, recordDebugEvent } from '@/core/debug/events';
import { createGmStorageMock, stubGmStorage } from '../testUtils/gmStorage';
import { buildDiagnosticInfo } from '@/ui/debug/diagnostics';
import { createDom } from '../testUtils/dom';
import { fetchAndParseUrl } from '@/core/utils/network';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { setupPinia } from '../testUtils/pinia';
import { useReaderStore } from '@/ui/stores/reader';

vi.mock('@/core/utils/network', async original => ({
  ...(await original<typeof import('@/core/utils/network')>()),
  fetchAndParseUrl: vi.fn(),
}));
const indexUrl = 'https://example.com/book/123/';
const currentUrl = `${indexUrl}1001.html`;
const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const page = (n: number, next = true) =>
  doc(
    `<a href="${indexUrl}${1000 + n}.html">第${n}章 正文</a>` +
      (next ? `<a href="${indexUrl}index_${n + 1}.html">下一页</a>` : '')
  );
function reader() {
  const store = useReaderStore();
  store.setChapter({
    title: '第一章',
    content: '<p>正文</p>',
    rawContent: '<p>正文</p>',
    url: currentUrl,
    indexUrl,
    method: 'rule',
    confidence: 1,
  });
  return store;
}
beforeEach(() => {
  setupPinia();
  createDom(currentUrl);
  stubGmStorage(createGmStorageMock());
  clearDebugEvents();
  vi.useFakeTimers();
  vi.mocked(fetchAndParseUrl).mockReset();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('retains a failed page and HTTP status after unrelated events evict the load event', async () => {
  const failedUrl = `${indexUrl}index_2.html`;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fetchAndParseUrl).mockImplementation(url => ({
    promise: Promise.resolve({
      doc: url === failedUrl ? null : page(1),
      status: url === failedUrl ? 403 : 200,
      finalUrl: url,
      error: url === failedUrl ? 'http' : null,
    }),
    abort: vi.fn(),
  }));
  const store = reader();
  await store.loadToc();
  for (let i = 0; i < 60; i++) recordDebugEvent('other');
  const info = buildDiagnosticInfo({ readerStore: store });
  expect((info.reader as Record<string, any>).toc.lastLoad).toMatchObject({
    loader: 'paged',
    outcome: 'failed',
    reason: 'http',
    pages: 1,
    request: { url: failedUrl, status: 403 },
  });
  expect(store.toc).toEqual([]);
});

it.each([120, 121])('only publishes a complete catalog when it has %i pages', async count => {
  let pages = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fetchAndParseUrl).mockImplementation(url => {
    const n = ++pages;
    return {
      promise: Promise.resolve({
        doc: page(n, n < count),
        status: 200,
        finalUrl: url,
        error: null,
      }),
      abort: vi.fn(),
    };
  });
  const store = reader();
  const loading = store.loadToc();
  const caching = count > 120 ? store.startCacheAll() : Promise.resolve();
  await Promise.all([loading, caching]);
  expect(store.cacheProgress.total).toBe(0);
  expect(store.cacheProgress.running).toBe(false);
  expect(pages).toBe(120);
  expect(store.toc).toHaveLength(count === 120 ? 120 : 0);
  expect(store.getDebugSnapshot().toc.lastLoad).toMatchObject({
    pages: 120,
    outcome: count === 120 ? 'complete' : 'failed',
    reason: count === 120 ? 'last-page' : 'page-limit',
  });
});

it('cancels only the active page and discards earlier pages', async () => {
  let cancel: (() => void) | null = null;
  const firstAbort = vi.fn();
  const secondAbort = vi.fn();
  let finish!: (result: Awaited<ReturnType<typeof fetchAndParseUrl>['promise']>) => void;
  vi.mocked(fetchAndParseUrl)
    .mockReturnValueOnce({
      promise: Promise.resolve({ doc: page(1), status: 200, finalUrl: indexUrl, error: null }),
      abort: firstAbort,
    })
    .mockReturnValueOnce({
      promise: new Promise(resolve => {
        finish = resolve;
      }),
      abort: secondAbort,
    });
  const loading = loadTocEntriesPaged(indexUrl, currentUrl, undefined, abort => {
    cancel = abort;
  });
  await Promise.resolve();
  expect(fetchAndParseUrl).toHaveBeenCalledTimes(2);
  (cancel as (() => void) | null)?.();
  finish({ doc: page(2, false), status: 200, finalUrl: `${indexUrl}index_2.html`, error: null });
  expect(await loading).toEqual([]);
  expect(firstAbort).not.toHaveBeenCalled();
  expect(secondAbort).toHaveBeenCalledOnce();
});

it('does not let an old cancelled response overwrite the new session diagnostic', async () => {
  let finishOld!: (result: Awaited<ReturnType<typeof fetchAndParseUrl>['promise']>) => void;
  vi.mocked(fetchAndParseUrl).mockReturnValueOnce({
    promise: new Promise(resolve => {
      finishOld = resolve;
    }),
    abort: vi.fn(),
  });
  const store = reader();
  const oldLoad = store.loadToc();
  store.deactivate();
  store.setChapter({
    title: '新书',
    content: '',
    rawContent: '',
    url: 'https://example.com/book/456/1.html',
    indexUrl: 'https://example.com/book/456/',
    method: 'rule',
    confidence: 1,
  });
  vi.mocked(fetchAndParseUrl).mockReturnValueOnce({
    promise: Promise.resolve({
      doc: doc('<a href="/book/456/1.html">第1章 新书</a>'),
      status: 200,
      finalUrl: 'https://example.com/book/456/',
      error: null,
    }),
    abort: vi.fn(),
  });
  await store.loadToc();
  finishOld({ doc: page(1, false), status: 200, finalUrl: indexUrl, error: null });
  await oldLoad;
  expect(store.getDebugSnapshot().toc.lastLoad).toMatchObject({
    currentUrl: 'https://example.com/book/456/1.html',
    outcome: 'complete',
  });
  expect(store.toc[0].url).toBe('https://example.com/book/456/1.html');
});

it('exports the API failure without enabling a forbidden GM fallback', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: false, status: 403, url: 'https://ixdzs8.com/novel/clist/' });
  vi.stubGlobal('unsafeWindow', { fetch: fetcher });
  const gm = vi.fn();
  vi.stubGlobal('GM_xmlhttpRequest', gm);
  const store = reader();
  store.setChapter({
    title: 'API书',
    content: '',
    rawContent: '',
    url: 'https://ixdzs8.com/read/123/p1.html',
    indexUrl: 'https://ixdzs8.com/read/123/',
    confidence: 1,
    method: 'rule',
  });
  const loading = store.loadToc();
  await vi.advanceTimersByTimeAsync(400);
  await loading;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(gm).not.toHaveBeenCalled();
  const info = buildDiagnosticInfo({ readerStore: store });
  expect((info.reader as Record<string, any>).toc.lastLoad).toMatchObject({
    loader: 'ixdzs',
    attempt: 2,
    outcome: 'empty',
    request: {
      url: 'https://ixdzs8.com/novel/clist/',
      transport: 'fetch',
      status: 403,
      reason: 'http',
    },
  });
});
