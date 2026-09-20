import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CacheAllContext, createCacheAll } from '@/ui/stores/reader/cacheAll';
import { computed, ref } from 'vue';
import { createReaderRuntime } from '@/ui/stores/reader/runtime';
import type { ParsedChapter } from '@/core/parser';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  parse: vi.fn(),
  iframe: vi.fn(),
  api: vi.fn(),
}));
vi.mock('@/ui/stores/reader/chapterFetch', () => ({
  loadDocumentInIframe: mocks.iframe,
  loadRuleApiDocument: mocks.api,
}));
vi.mock('@/core/utils/network', () => ({ fetchAndParseUrl: mocks.fetch }));
vi.mock('@/core/parser', () => ({ getParser: () => ({}) }));
vi.mock('@/ui/stores/reader/section', () => ({ parseWithSectionMerge: mocks.parse }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const target = 'https://example.com/read/100/200.html';
const chapter: ParsedChapter = {
  title: '第一章',
  content: '<p>正文</p>',
  rawContent: '<p>正文</p>',
  url: target,
  confidence: 1,
  method: 'detection',
};
function makeContext(): CacheAllContext {
  return {
    cacheProgress: ref({ running: false, done: 0, total: 0, failed: 0 }),
    cacheQueue: ref([]),
    cacheFailedUrls: ref([]),
    cacheAbort: ref(null),
    cachedContents: ref(new Map()),
    persistedUrls: ref(new Set()),
    tocOriginal: ref([]),
    chapter: computed(() => chapter),
    rule: computed(() => null),
    chapters: ref([]),
    runtime: createReaderRuntime(),
    loadToc: vi.fn(async () => {}),
    restoreCache: vi.fn(() => {}),
    persistCache: vi.fn(() => {}),
    showToast: vi.fn(),
  };
}
const response = () => ({
  doc: new DOMParser().parseFromString('<p>正文</p>', 'text/html'),
  error: null,
  status: 200,
  finalUrl: target,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue(null);
  mocks.fetch.mockImplementation(() => ({ promise: Promise.resolve(response()), abort: vi.fn() }));
  mocks.parse.mockResolvedValue(chapter);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('cache task ownership', () => {
  it('reserves the task before restoring storage', async () => {
    const ctx = makeContext();
    const actions = createCacheAll(ctx);
    const first = actions.startCacheAll([target]);
    const second = actions.startCacheAll([target]);
    await Promise.all([first, second]);
    expect(ctx.restoreCache).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not resume a cancelled preparation', async () => {
    const ctx = makeContext();
    const pending = deferred<void>();
    vi.mocked(ctx.loadToc).mockReturnValue(pending.promise);
    const actions = createCacheAll(ctx);
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    const run = actions.startCacheAll();
    actions.cancelCacheAll();
    pending.resolve();
    await run;
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.showToast).not.toHaveBeenCalled();
  });
  it('ignores an old response after cancel and restart within the same session', async () => {
    const ctx = makeContext();
    const oldResponse = deferred<ReturnType<typeof response>>();
    const newResponse = deferred<ReturnType<typeof response>>();
    mocks.fetch
      .mockReturnValueOnce({ promise: oldResponse.promise, abort: vi.fn() })
      .mockReturnValueOnce({ promise: newResponse.promise, abort: vi.fn() });
    const actions = createCacheAll(ctx);
    const oldRun = actions.startCacheAll([target]);
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    actions.cancelCacheAll();
    const newRun = actions.startCacheAll([target]);
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    oldResponse.resolve(response());
    await oldRun;
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(ctx.cacheProgress.value.running).toBe(true);
    newResponse.resolve(response());
    await newRun;
    expect(ctx.cacheProgress.value).toMatchObject({ running: false, done: 1, failed: 0 });
  });
  it('does not cache a parsed directory page', async () => {
    const ctx = makeContext();
    mocks.parse.mockResolvedValue({
      ...chapter,
      content: Array.from(
        { length: 15 },
        (_, i) => `<a href="/read/100/${i + 300}.html">第${i + 1}章</a>`
      ).join(''),
    });
    await createCacheAll(ctx).startCacheAll([target]);
    expect(ctx.cachedContents.value.size).toBe(0);
    expect(ctx.cacheFailedUrls.value).toEqual([target]);
  });

  it('builds full-book tasks from the reader TOC loader', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    vi.mocked(ctx.loadToc).mockImplementation(async () => {
      ctx.tocOriginal.value = [{ title: chapter.title, url: target }];
    });

    await createCacheAll(ctx).startCacheAll();

    expect(ctx.loadToc).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('leaves missing-TOC reporting to the TOC loader', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));

    await createCacheAll(ctx).startCacheAll();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.showToast).not.toHaveBeenCalled();
    expect(ctx.cacheProgress.value.running).toBe(false);
  });

  it('reports a book whose chapters are all cached', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    ctx.tocOriginal.value = [{ title: chapter.title, url: target }];
    ctx.persistedUrls.value = new Set([target]);

    await createCacheAll(ctx).startCacheAll();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.persistCache).toHaveBeenCalledTimes(1);
    expect(ctx.showToast).toHaveBeenCalledWith('本书章节已全部缓存', 'info');
  });

  it('persists an in-memory full-book chapter without fetching it again', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    ctx.tocOriginal.value = [{ title: chapter.title, url: target }];
    ctx.cachedContents.value.set(target, { chapter, cachedAt: Date.now() });

    await createCacheAll(ctx).startCacheAll();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.persistCache).toHaveBeenCalledTimes(1);
    expect(ctx.showToast).toHaveBeenCalledWith('本书章节已全部缓存', 'info');
  });

  it('reports a locked-only TOC without claiming that the book is cached', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    ctx.tocOriginal.value = [{ title: chapter.title, url: target, access: 'locked' }];

    await createCacheAll(ctx).startCacheAll();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.persistCache).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith('目录中没有可缓存的章节', 'info');
  });

  it('stops at the book index after the final queued chapter', async () => {
    const indexUrl = 'https://example.com/read/100/';
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl }));
    ctx.tocOriginal.value = [{ title: chapter.title, url: target }];
    mocks.parse.mockResolvedValue({ ...chapter, indexUrl, nextUrl: indexUrl });

    await createCacheAll(ctx).startCacheAll();

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(target, target);
    expect(ctx.cacheProgress.value).toMatchObject({ done: 1, total: 1, failed: 0 });
    expect(ctx.cacheFailedUrls.value).toEqual([]);
  });

  it('does not turn an explicit index-only retry into another full-book request', async () => {
    const indexUrl = 'https://example.com/read/100/';
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl }));

    await createCacheAll(ctx).startCacheAll([indexUrl]);

    expect(ctx.loadToc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(ctx.cacheProgress.value).toEqual({ done: 0, total: 0, failed: 0, running: false });
  });

  it('skips only chapters written by this run during the final cache flush', async () => {
    const ctx = makeContext();
    ctx.chapter = computed(() => ({ ...chapter, indexUrl: 'https://example.com/read/100/' }));
    // Persisted earlier; its in-memory copy may be newer, so the final flush must rewrite it.
    ctx.persistedUrls.value = new Set(['https://example.com/read/100/199.html']);
    vi.stubGlobal('GM_setValue', vi.fn());

    await createCacheAll(ctx).startCacheAll([target]);

    const skipped = vi.mocked(ctx.persistCache).mock.calls[0]?.[0];
    expect(skipped).toBeInstanceOf(Set);
    expect(Array.from(skipped ?? [])).toEqual([target]);
  });
});

it('releases ownership after a preparation error so the user can retry', async () => {
  const ctx = makeContext();
  vi.mocked(ctx.restoreCache).mockImplementationOnce(() => {
    throw new Error('storage unavailable');
  });
  const actions = createCacheAll(ctx);
  await actions.startCacheAll([target]);
  expect(ctx.cacheProgress.value.running).toBe(false);
  await actions.startCacheAll([target]);
  expect(ctx.cachedContents.value.has(target)).toBe(true);
});

it('does not let old parsing clear or announce a restarted task', async () => {
  const ctx = makeContext();
  const pending = deferred<ParsedChapter>();
  mocks.parse.mockReturnValueOnce(pending.promise);
  const actions = createCacheAll(ctx);
  const oldRun = actions.startCacheAll([target]);
  await vi.waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(1));
  actions.cancelCacheAll();
  const responsePending = deferred<ReturnType<typeof response>>();
  mocks.fetch.mockReturnValueOnce({ promise: responsePending.promise, abort: vi.fn() });
  const newRun = actions.startCacheAll([target]);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  pending.resolve(chapter);
  await oldRun;
  expect(ctx.cacheProgress.value.running).toBe(true);
  expect(ctx.cachedContents.value.size).toBe(0);
  expect(ctx.showToast).not.toHaveBeenCalled();
  actions.cancelCacheAll();
  responsePending.resolve(response());
  await newRun;
});

it('does not cache or announce content after the reading session ends', async () => {
  const ctx = makeContext();
  const runtime = createReaderRuntime();
  ctx.runtime = runtime;
  const pending = deferred<ReturnType<typeof response>>();
  mocks.fetch.mockReturnValue({ promise: pending.promise, abort: vi.fn() });
  const actions = createCacheAll(ctx);
  const run = actions.startCacheAll([target]);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
  runtime.bumpSession();
  actions.cancelCacheAll();
  pending.resolve(response());
  await run;
  expect(ctx.cachedContents.value.size).toBe(0);
  expect(ctx.showToast).not.toHaveBeenCalled();
});

it('keeps the iframe alive until parsing finishes and then removes it', async () => {
  const ctx = makeContext();
  ctx.rule = computed(() => ({
    id: 'dynamic',
    version: 1,
    name: 'Dynamic',
    match: { pattern: 'example' },
    content: { selector: 'main' },
    advanced: { useIframe: true },
  }));
  const cleanup = vi.fn();
  const doc = response().doc;
  mocks.iframe.mockReturnValue({ promise: Promise.resolve({ doc, cleanup }), abort: cleanup });
  const pending = deferred<ParsedChapter>();
  mocks.parse.mockReturnValueOnce(pending.promise);
  const run = createCacheAll(ctx).startCacheAll([target]);
  await vi.waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(1));
  expect(cleanup).not.toHaveBeenCalled();
  pending.resolve(chapter);
  await run;
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(ctx.cachedContents.value.has(target)).toBe(true);
});

it('cleans up an iframe immediately when parsing is cancelled', async () => {
  const ctx = makeContext();
  ctx.rule = computed(() => ({
    id: 'dynamic',
    version: 1,
    name: 'Dynamic',
    match: { pattern: 'example' },
    content: { selector: 'main' },
    advanced: { useIframe: true },
  }));
  const cleanup = vi.fn();
  mocks.iframe.mockReturnValue({
    promise: Promise.resolve({ doc: response().doc, cleanup }),
    abort: cleanup,
  });
  const pending = deferred<ParsedChapter>();
  mocks.parse.mockReturnValueOnce(pending.promise);
  const actions = createCacheAll(ctx);
  const run = actions.startCacheAll([target]);
  await vi.waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(1));
  actions.cancelCacheAll();
  expect(cleanup).toHaveBeenCalled();
  pending.resolve(chapter);
  await run;
  expect(ctx.cachedContents.value.size).toBe(0);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('uses the rule API document without a duplicate HTML request', async () => {
  const ctx = makeContext();
  const doc = response().doc;
  mocks.api.mockResolvedValueOnce(doc);
  await createCacheAll(ctx).startCacheAll([target]);
  expect(mocks.parse.mock.calls[0][1]).toBe(doc);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(ctx.cachedContents.value.has(target)).toBe(true);
});

it('falls back to fetching when the iframe cannot load', async () => {
  const ctx = makeContext();
  ctx.rule = computed(() => ({
    id: 'dynamic',
    version: 1,
    name: 'Dynamic',
    match: { pattern: 'example' },
    content: { selector: 'main' },
    advanced: { useIframe: true },
  }));
  mocks.iframe.mockReturnValue({ promise: Promise.resolve(null), abort: vi.fn() });
  await createCacheAll(ctx).startCacheAll([target]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(ctx.cachedContents.value.has(target)).toBe(true);
});
