import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDom } from '../testUtils/dom';
import { requestSiteData } from '@/core/utils/siteRequest';

const url = 'https://twkan.com/ajax_novels/chapterlist/1.html';
const parse = (data: unknown) =>
  typeof data === 'string' && data.startsWith('chapter:') ? data : null;
const response = (text: string, status = 200): GmXhrResponse => ({
  readyState: 4,
  responseHeaders: '',
  responseText: text,
  status,
  statusText: '',
  finalUrl: url,
});

beforeEach(() => {
  createDom(url);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('site request lifecycle', () => {
  it.each(['cancelled', 'timeout'] as const)(
    'reports %s once even when a late response arrives',
    async reason => {
      let respond!: (value: Response) => void;
      vi.stubGlobal('unsafeWindow', {
        fetch: vi.fn(
          () =>
            new Promise(resolve => {
              respond = resolve;
            })
        ),
      });
      const onResult = vi.fn();
      const setAbort = vi.fn();
      const pending = requestSiteData(url, {
        responseType: 'text',
        parse,
        setAbort,
        onResult,
        timeoutMs: 100,
        retries: 0,
      });
      if (reason === 'cancelled') setAbort.mock.calls[0][0]();
      else await vi.advanceTimersByTimeAsync(100);
      expect(await pending).toBeNull();
      respond(new Response('chapter:late'));
      await Promise.resolve();
      expect(onResult).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ url, transport: 'fetch', reason })
      );
    }
  );

  it('reports the final GM response after native fallback without exposing response content', async () => {
    vi.stubGlobal('unsafeWindow', {
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 403, url }),
    });
    vi.stubGlobal('GM_xmlhttpRequest', (options: GM_xmlhttpRequestOptions) => {
      options.onload?.(response('chapter:private-content'));
      return { abort: vi.fn() };
    });
    const onResult = vi.fn();
    expect(
      await requestSiteData(url, { responseType: 'text', parse, setAbort: vi.fn(), onResult })
    ).toBe('chapter:private-content');
    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      url,
      finalUrl: url,
      transport: 'gm',
      status: 200,
      reason: 'success',
    });
  });

  it('binds page fetch and keeps POST headers, body and cookies', async () => {
    const owner = {
      fetch: vi.fn(function (this: unknown, _url: string, init: RequestInit) {
        expect(this).toBe(owner);
        expect(init).toMatchObject({
          method: 'POST',
          body: 'bid=1',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return Promise.resolve({ ok: true, json: async () => ({ value: 42 }) });
      }),
    };
    vi.stubGlobal('unsafeWindow', owner);
    const setAbort = vi.fn();
    expect(
      await requestSiteData(url, {
        responseType: 'json',
        parse: data => (data as { value: number }).value,
        setAbort,
        method: 'POST',
        body: 'bid=1',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    ).toBe(42);
    expect(setAbort).toHaveBeenCalledTimes(2);
    expect(setAbort).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['headers', 'body'] as const)(
    'discards late %s even when fetch ignores cancellation',
    async stage => {
      let complete!: (value: unknown) => void;
      const delayed = new Promise(resolve => {
        complete = resolve;
      });
      const readBody = vi.fn(() => delayed);
      vi.stubGlobal(
        'fetch',
        vi.fn(() => (stage === 'headers' ? delayed : Promise.resolve({ ok: true, text: readBody })))
      );
      const gm = vi.fn();
      vi.stubGlobal('GM_xmlhttpRequest', gm);
      const setAbort = vi.fn();
      const decode = vi.fn(parse);
      const pending = requestSiteData(url, { responseType: 'text', parse: decode, setAbort });
      await Promise.resolve();
      const abort = setAbort.mock.calls[0][0];
      abort();
      expect(await pending).toBeNull();
      complete(
        stage === 'headers' ? { ok: true, text: async () => 'chapter:late' } : 'chapter:late'
      );
      await Promise.resolve();
      await Promise.resolve();
      abort();
      expect(decode).not.toHaveBeenCalled();
      expect(gm).not.toHaveBeenCalled();
      expect(setAbort).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('stops before starting transport when its owner immediately cancels', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await requestSiteData(url, { responseType: 'text', parse, setAbort: abort => abort?.() })
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stuck body without starting fallback', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: () => new Promise(() => {}) }));
    const gm = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('GM_xmlhttpRequest', gm);
    const setAbort = vi.fn();
    const pending = requestSiteData(url, {
      responseType: 'text',
      parse,
      setAbort,
      timeoutMs: 100,
      retries: 0,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBeNull();
    expect(gm).not.toHaveBeenCalled();
    expect(setAbort).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['http', 'invalid-body', 'network'] as const)(
    'falls back once on %s failure, including synchronous GM completion',
    async failure => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          if (failure === 'network') throw new Error('offline');
          return {
            status: failure === 'http' ? 403 : 200,
            ok: failure !== 'http',
            text: async () => '<html>challenge</html>',
          };
        })
      );
      const gm = vi.fn((options: GM_xmlhttpRequestOptions) => {
        options.onload(response('chapter:good'));
        return { abort: vi.fn() };
      });
      vi.stubGlobal('GM_xmlhttpRequest', gm);
      const setAbort = vi.fn();
      expect(
        await requestSiteData(url, {
          responseType: 'text',
          parse,
          setAbort,
          referrer: 'https://twkan.com/txt/1/2',
        })
      ).toBe('chapter:good');
      expect(gm).toHaveBeenCalledTimes(1);
      expect(gm.mock.calls[0][0].headers?.Referer).toBe('https://twkan.com/txt/1/2');
      expect(setAbort).toHaveBeenCalledTimes(2);
      expect(setAbort).toHaveBeenLastCalledWith(null);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each(['cancel', 'timeout'] as const)(
    'settles GM only once on %s and ignores late callbacks',
    async reason => {
      vi.stubGlobal('fetch', undefined);
      let callbacks!: GM_xmlhttpRequestOptions;
      const abortRequest = vi.fn(() => {
        callbacks.onabort?.(response(''));
      });
      vi.stubGlobal(
        'GM_xmlhttpRequest',
        vi.fn((options: GM_xmlhttpRequestOptions) => {
          callbacks = options;
          return { abort: abortRequest };
        })
      );
      const setAbort = vi.fn();
      const pending = requestSiteData(url, {
        responseType: 'text',
        parse,
        setAbort,
        timeoutMs: 100,
        retries: 0,
      });
      if (reason === 'cancel') setAbort.mock.calls[0][0]();
      else await vi.advanceTimersByTimeAsync(100);
      expect(await pending).toBeNull();
      callbacks.onload(response('chapter:late'));
      callbacks.onerror?.(response(''));
      expect(abortRequest).toHaveBeenCalledTimes(1);
      expect(setAbort).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each([response('not-json'), response('{}', 503)])(
    'rejects unusable GM responses',
    async value => {
      vi.stubGlobal('fetch', undefined);
      vi.stubGlobal('GM_xmlhttpRequest', (options: GM_xmlhttpRequestOptions) => {
        options.onload(value);
        return { abort: vi.fn() };
      });
      expect(
        await requestSiteData(url, { responseType: 'json', parse, setAbort: vi.fn(), retries: 0 })
      ).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('does not introduce fallback for native-only sites', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    );
    const gm = vi.fn();
    vi.stubGlobal('GM_xmlhttpRequest', gm);
    expect(
      await requestSiteData(url, {
        responseType: 'text',
        parse,
        setAbort: vi.fn(),
        gmFallback: false,
      })
    ).toBeNull();
    expect(gm).not.toHaveBeenCalled();
  });
});

it('does not switch to GM or retry a rate-limited directory request', async () => {
  const rateUrl = 'https://site-rate-limit.test/catalog';
  const native = vi.fn(
    async () => new Response('', { status: 429, headers: { 'Retry-After': '30' } })
  );
  const gm = vi.fn();
  vi.stubGlobal('unsafeWindow', { fetch: native });
  vi.stubGlobal('GM_xmlhttpRequest', gm);
  const onResult = vi.fn();
  expect(
    await requestSiteData(rateUrl, { responseType: 'text', parse, setAbort: vi.fn(), onResult })
  ).toBeNull();
  expect(native).toHaveBeenCalledTimes(1);
  expect(gm).not.toHaveBeenCalled();
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 429, reason: 'http' }));
  expect(vi.getTimerCount()).toBe(0);
});

it('counts a transport fallback within the three-attempt operation budget', async () => {
  vi.stubGlobal('unsafeWindow', { fetch: vi.fn(async () => ({ ok: false, status: 403 })) });
  const gm = vi.fn((options: GM_xmlhttpRequestOptions) => {
    options.onload(response('', 503));
    return { abort: vi.fn() };
  });
  vi.stubGlobal('GM_xmlhttpRequest', gm);
  const pending = requestSiteData(url, { responseType: 'text', parse, setAbort: vi.fn() });
  await vi.runAllTimersAsync();
  expect(await pending).toBeNull();
  expect(gm).toHaveBeenCalledTimes(2);
});
