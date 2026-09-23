import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDom } from '../testUtils/dom';
import { ixdzsTocLoader } from '@/ui/stores/reader/tocProviders/ixdzs';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';

const currentUrl = 'https://ixdzs8.com/read/644554/p120.html';
const indexUrl = 'https://ixdzs8.com/read/644554/';

describe('ixdzs TOC', () => {
  beforeEach(() => {
    createDom(currentUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads the complete book catalog and excludes volume headings and invalid rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rs: 200,
        data: [
          { ctype: '1', ordernum: '1', title: '第一卷' },
          { ctype: '0', ordernum: '1', title: ' 第1章 开始 ' },
          { ctype: 0, ordernum: 120, title: '第120章 分身下海' },
          { ctype: '0', ordernum: '457', title: '第457章 完' },
          { ctype: '0', ordernum: '1', title: '重复' },
          { ctype: '0', ordernum: '../other', title: '无效链接' },
          { ctype: '0', ordernum: '3', title: ' ' },
          { ctype: '0', ordernum: '4', title: null },
          null,
        ],
      }),
    });
    vi.stubGlobal('unsafeWindow', { fetch: fetchMock });
    const setAbort = vi.fn();
    const entries = await loadTocEntriesPaged(indexUrl, currentUrl, undefined, setAbort);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ixdzs8.com/novel/clist/',
      expect.objectContaining({ method: 'POST', body: 'bid=644554', credentials: 'include' })
    );
    expect(entries).toEqual([
      { title: '第1章 开始', url: 'https://ixdzs8.com/read/644554/p1.html' },
      { title: '第120章 分身下海', url: currentUrl },
      { title: '第457章 完', url: 'https://ixdzs8.com/read/644554/p457.html' },
    ]);
    expect(setAbort).toHaveBeenLastCalledWith(null);
  });

  it.each([
    { ok: false, status: 503 },
    { ok: true, json: async () => ({ rs: 500, data: [] }) },
    {
      ok: true,
      json: async () => {
        throw new Error('challenge HTML');
      },
    },
  ])('does not fall back to unrelated book recommendations on API failure', async response => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('unsafeWindow', { fetch: fetchMock });
    expect(await loadTocEntriesPaged(indexUrl, currentUrl, undefined, vi.fn())).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(response.status === 503 ? 3 : 1);
  });

  it('aborts the pending catalog request and clears its handle', async () => {
    vi.stubGlobal('unsafeWindow', {
      fetch: vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      ),
    });
    const setAbort = vi.fn();
    const promise = loadTocEntriesPaged(indexUrl, currentUrl, undefined, setAbort);
    setAbort.mock.calls[0][0]();
    expect(await promise).toEqual([]);
    expect(setAbort).toHaveBeenLastCalledWith(null);
  });

  it('matches only book and chapter URLs on the supported host', () => {
    const context = { currentUrl, indexUrl, setAbort: vi.fn() };
    expect(ixdzsTocLoader.matches(context)).toBe(true);
    expect(ixdzsTocLoader.matches({ ...context, currentUrl: 'invalid' })).toBe(true);
    expect(
      ixdzsTocLoader.matches({
        ...context,
        currentUrl: 'https://other.com/read/1/p1.html',
        indexUrl: '',
      })
    ).toBe(false);
  });
});
