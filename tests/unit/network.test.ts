import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAndParseUrl,
  getGmXhr,
  normalizeUrlForFetch,
  resolveAndValidateHttpUrl,
} from '@/core/utils/network';

const makeXhrResponse = (
  opts: GM_xmlhttpRequestOptions,
  overrides: Partial<GmXhrResponse> = {}
): GmXhrResponse => ({
  readyState: 4,
  responseHeaders: '',
  responseText: '',
  status: 0,
  statusText: '',
  finalUrl: opts.url,
  ...overrides,
});

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

describe('network utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getGmXhr returns null when missing', () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);
    expect(getGmXhr()).toBeNull();
  });

  it('normalizeUrlForFetch strips hash', () => {
    expect(normalizeUrlForFetch('https://example.com/a#b')).toBe('https://example.com/a');
  });

  it('normalizeUrlForFetch removes redundant first-page query markers', () => {
    expect(normalizeUrlForFetch('https://example.com/a.html?page=1#b')).toBe(
      'https://example.com/a.html'
    );
  });

  it('normalizeUrlForFetch keeps query-driven chapter params', () => {
    expect(normalizeUrlForFetch('https://example.com/a.html?cid=1&page=1')).toBe(
      'https://example.com/a.html?cid=1&page=1'
    );
  });

  it('normalizeUrlForFetch tolerates non-absolute URLs', () => {
    expect(normalizeUrlForFetch('/a#b')).toBe('/a');
  });

  it('returns invalid-url when URL cannot be resolved (no default base)', async () => {
    vi.stubGlobal('location', undefined);
    vi.stubGlobal('document', undefined);

    const res = await fetchAndParseUrl('chapter/1', 'not a url').promise;

    expect(res.error).toBe('invalid-url');
  });

  it('blocks private-network hosts when referer is on a different host', async () => {
    const res = await fetchAndParseUrl('http://127.0.0.1/ch', 'https://example.com/').promise;
    expect(res.error).toBe('invalid-url');
  });

  it.each([
    'http://[::ffff:127.0.0.1]/ch',
    'http://[::ffff:c0a8:101]/ch',
    'http://[::]/ch',
    'http://0.1.2.3/ch',
    'http://100.64.0.1/ch',
  ])('blocks mapped and reserved private host %s across hosts', async url => {
    const res = await fetchAndParseUrl(url, 'https://example.com/').promise;
    expect(res.error).toBe('invalid-url');
  });

  it.each([
    'http://localhost./ch',
    'http://reader.localhost./ch',
    'http://[fe80::1]/ch',
    'http://[fe90::1]/ch',
    'http://[febf:ffff::1]/ch',
  ])('blocks canonical localhost and the full IPv6 link-local range for %s', url => {
    expect(resolveAndValidateHttpUrl(url, 'https://example.com/')).toBeNull();
  });

  it('allows public hostnames beginning with fc or fd across hosts', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><body>ok</body></html>',
        })
      );
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fd = await fetchAndParseUrl('https://fdxs.com/1/2.html', 'https://www.fdxs.com/').promise;
    const fc = await fetchAndParseUrl('https://fcxs.net/1/2.html', 'https://www.fcxs.net/').promise;

    expect(fd.error).toBeNull();
    expect(fc.error).toBeNull();
    expect(gm).toHaveBeenCalledTimes(2);
  });

  it('allows private-network hosts when referer is the same host (IPv6)', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><body>ok</body></html>',
          finalUrl: opts.url,
        })
      );
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const { promise } = fetchAndParseUrl('http://[::1]/ch#x', 'http://[::1]/');
    const res = await promise;

    expect(res.error).toBeNull();
    expect(gm).toHaveBeenCalledTimes(1);
    const calledUrl = (gm.mock.calls[0]?.[0] as GM_xmlhttpRequestOptions).url;
    expect(calledUrl).toBe('http://[::1]/ch');
  });

  it('GM_xmlhttpRequest success parses HTML and sets base', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><head></head><body><a href="/x">x</a></body></html>',
          finalUrl: opts.url,
        })
      );
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const { promise } = fetchAndParseUrl('https://example.com/ch1', 'https://example.com/');
    const res = await promise;

    expect(res.error).toBeNull();
    expect(res.doc?.querySelector('base')?.getAttribute('href')).toContain(
      'https://example.com/ch1'
    );
    expect(gm).toHaveBeenCalledTimes(1);
  });

  it('GM_xmlhttpRequest decodes legacy HTML from response bytes', async () => {
    const gbkHtml =
      '3c21646f63747970652068746d6c3e3c68746d6c3e3c686561643e3c6d65746120636861727365743d2267626b223e3c2f686561643e3c626f64793e3c6120687265663d222f7478742f31223eb5da31d5c220b2e2cad43c2f613e3c2f626f64793e3c2f68746d6c3e';
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      expect(opts.responseType).toBe('arraybuffer');
      expect(opts.overrideMimeType).toBeUndefined();
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          response: hexToArrayBuffer(gbkHtml),
          responseHeaders: 'Content-Type: text/html; charset=gbk\r\n',
        })
      );
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const result = await fetchAndParseUrl(
      'https://legacy.example/chapter/1',
      'https://reader.example/'
    ).promise;

    expect(result.error).toBeNull();
    expect(result.doc?.querySelector('a')?.textContent).toBe('第1章 测试');
  });

  it('settles GM_xmlhttpRequest as a parse failure when response bytes cannot be decoded', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          // Userscript managers may hand back a buffer-like object from another realm.
          response: { byteLength: 16 } as unknown as ArrayBuffer,
        })
      );
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const result = await fetchAndParseUrl(
      'https://legacy.example/chapter/1',
      'https://reader.example/'
    ).promise;

    expect(result).toMatchObject({ doc: null, status: 200, error: 'parse' });
    expect(gm).toHaveBeenCalledTimes(1);
  });

  it('retries on HTTP 500 and succeeds', async () => {
    let calls = 0;
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      calls++;
      if (calls === 1) {
        opts.onload?.(makeXhrResponse(opts, { status: 500, responseText: 'oops' }));
      } else {
        opts.onload?.(
          makeXhrResponse(opts, {
            status: 200,
            responseText: '<!doctype html><html><body>ok</body></html>',
            finalUrl: opts.url,
          })
        );
      }
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const { promise } = fetchAndParseUrl('https://example.com/ch2', 'https://example.com/', {
      retries: 1,
      timeoutMs: 1000,
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.error).toBeNull();
    expect(calls).toBe(2);
  });

  it('fetch fallback returns missing-gm-xhr when fetch is absent', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);
    vi.stubGlobal('fetch', undefined);

    const { promise } = fetchAndParseUrl('https://example.com/ch3', 'https://example.com/');
    const res = await promise;

    expect(res.error).toBe('missing-gm-xhr');
  });

  it('fetch fallback classifies abort and timeout', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const aborting = fetchAndParseUrl('https://example.com/ch4', 'https://example.com/', {
      timeoutMs: 1000,
      retries: 0,
    });
    aborting.abort();
    const aborted = await aborting.promise;
    expect(aborted.error).toBe('abort');

    const timingOut = fetchAndParseUrl('https://example.com/ch5', 'https://example.com/', {
      timeoutMs: 10,
      retries: 0,
    });

    await vi.advanceTimersByTimeAsync(20);
    const timedOut = await timingOut.promise;
    expect(timedOut.error).toBe('timeout');
  });

  it('fetch path parses HTML on 200', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn(async () => ({
      status: 200,
      url: 'https://example.com/final',
      text: async () => '<!doctype html><html><head></head><body><a href="/x">x</a></body></html>',
    }));
    // userscript global stub
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchAndParseUrl('https://example.com/ch', 'https://example.com/', {
      retries: 0,
      timeoutMs: 1000,
    }).promise;

    expect(res.error).toBeNull();
    expect(res.doc?.querySelector('base')?.getAttribute('href')).toContain('https://example.com/');
  });

  it('fetch path decodes legacy GBK HTML from meta charset', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const gbkHtml =
      '3c21646f63747970652068746d6c3e3c68746d6c3e3c686561643e3c6d65746120636861727365743d2267626b223e3c2f686561643e3c626f64793e3c6120687265663d222f7478742f31223eb5da31d5c220b2e2cad43c2f613e3c2f626f64793e3c2f68746d6c3e';

    const fetchMock = vi.fn(async () => ({
      status: 200,
      url: 'https://example.com/book/',
      headers: { get: () => null },
      arrayBuffer: async () => hexToArrayBuffer(gbkHtml),
      text: async () => '',
    }));
    // userscript global stub
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchAndParseUrl('https://example.com/book/', 'https://example.com/', {
      retries: 0,
      timeoutMs: 1000,
    }).promise;

    expect(res.error).toBeNull();
    expect(res.doc?.querySelector('a')?.textContent).toBe('第1章 测试');
  });

  it('fetch path returns http error for non-2xx', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn(async () => ({
      status: 404,
      url: 'https://example.com/notfound',
      text: async () => 'nope',
    }));
    // userscript global stub
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchAndParseUrl('https://example.com/ch', 'https://example.com/', {
      retries: 0,
      timeoutMs: 1000,
    }).promise;

    expect(res.error).toBe('http');
    expect(res.status).toBe(404);
  });

  it('fetch path classifies network errors', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn(async () => {
      throw new Error('boom');
    });
    // userscript global stub
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchAndParseUrl('https://example.com/ch', 'https://example.com/', {
      retries: 0,
      timeoutMs: 1000,
    }).promise;

    expect(res.error).toBe('network');
  });

  it('resolves relative URLs using document.baseURI when referer is invalid', async () => {
    vi.stubGlobal('location', undefined);
    const originalBaseUri = Object.getOwnPropertyDescriptor(document, 'baseURI');
    Object.defineProperty(document, 'baseURI', {
      value: 'https://example.com/book/',
      configurable: true,
    });

    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><body>ok</body></html>',
          finalUrl: opts.url,
        })
      );
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const { promise } = fetchAndParseUrl('chapter/1', 'not a url');
    const res = await promise;

    expect(res.error).toBeNull();
    expect(gm).toHaveBeenCalledTimes(1);
    const calledUrl = (gm.mock.calls[0]?.[0] as GM_xmlhttpRequestOptions).url;
    expect(calledUrl).toContain('https://example.com/book/chapter/1');

    if (originalBaseUri) {
      Object.defineProperty(document, 'baseURI', originalBaseUri);
    }
  });

  it('GM_xmlhttpRequest onerror/onabort/ontimeout map to network/abort/timeout', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onerror?.(makeXhrResponse(opts));
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    await expect(
      fetchAndParseUrl('https://example.com/ch', 'https://example.com/', { retries: 0 }).promise
    ).resolves.toMatchObject({ error: 'network' });

    const gmAbort = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onabort?.(makeXhrResponse(opts));
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gmAbort);
    await expect(
      fetchAndParseUrl('https://example.com/ch', 'https://example.com/', { retries: 0 }).promise
    ).resolves.toMatchObject({ error: 'abort' });

    const gmTimeout = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.ontimeout?.(makeXhrResponse(opts));
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gmTimeout);
    await expect(
      fetchAndParseUrl('https://example.com/ch', 'https://example.com/', { retries: 0 }).promise
    ).resolves.toMatchObject({ error: 'timeout' });
  });

  it('returns parse error when DOMParser throws', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><body>ok</body></html>',
          finalUrl: opts.url,
        })
      );
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    class BrokenDomParser {
      parseFromString(): Document {
        throw new Error('boom');
      }
    }

    vi.stubGlobal('DOMParser', BrokenDomParser as unknown as typeof DOMParser);

    const { promise } = fetchAndParseUrl('https://example.com/ch', 'https://example.com/');
    const res = await promise;
    expect(res.error).toBe('parse');
  });

  it('inserts <base> when parsed document lacks head', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.(
        makeXhrResponse(opts, {
          status: 200,
          responseText: '<!doctype html><html><body>ok</body></html>',
          finalUrl: opts.url,
        })
      );
      return { abort: () => {} };
    });
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const real = new DOMParser();
    class NoHeadDomParser {
      parseFromString(html: string, mime: string): Document {
        const doc = real.parseFromString(html, mime as DOMParserSupportedType);
        Object.defineProperty(doc, 'head', { value: null, configurable: true });
        return doc;
      }
    }

    vi.stubGlobal('DOMParser', NoHeadDomParser as unknown as typeof DOMParser);

    const { promise } = fetchAndParseUrl('https://example.com/ch', 'https://example.com/');
    const res = await promise;

    expect(res.error).toBeNull();
    expect(res.doc?.querySelector('base')).not.toBeNull();
  });

  it('abort() tolerates driver abort failures in GM and fetch paths', async () => {
    const gm = vi.fn((_opts: GM_xmlhttpRequestOptions) => ({
      abort: () => {
        throw new Error('abort boom');
      },
    }));
    // userscript global stub
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const gmReq = fetchAndParseUrl('https://example.com/ch', 'https://example.com/', {
      timeoutMs: 1000,
      retries: 0,
    });
    expect(() => gmReq.abort()).not.toThrow();

    vi.stubGlobal('GM_xmlhttpRequest', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );

    const RealAbortController = AbortController;
    class ThrowingAbortController {
      signal = new RealAbortController().signal;
      abort() {
        throw new Error('boom');
      }
    }
    vi.stubGlobal('AbortController', ThrowingAbortController as unknown as typeof AbortController);

    const fetchReq = fetchAndParseUrl('https://example.com/ch2', 'https://example.com/', {
      timeoutMs: 1000,
      retries: 0,
    });
    expect(() => fetchReq.abort()).not.toThrow();
  });
});

describe('shared request cooldown across native and GM transports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['native', 'gm'] as const)(
    'honors Retry-After via %s and gates a second operation',
    async transport => {
      const url = `https://cooldown-${transport}.test/chapter`;
      let calls = 0;
      const reply = () => (++calls === 1 ? 429 : 200);
      if (transport === 'gm') {
        vi.stubGlobal('GM_xmlhttpRequest', (options: GM_xmlhttpRequestOptions) => {
          options.onload?.(
            makeXhrResponse(options, {
              status: reply(),
              responseHeaders: 'Retry-After: 2\r\n',
              responseText: '<p>recovered</p>',
            })
          );
          return { abort: vi.fn() };
        });
      } else {
        vi.stubGlobal('GM_xmlhttpRequest', undefined);
        vi.stubGlobal(
          'fetch',
          vi.fn(
            async () =>
              new Response('<p>recovered</p>', {
                status: reply(),
                headers: { 'Retry-After': '2' },
              })
          )
        );
      }
      const pending = fetchAndParseUrl(url);
      await vi.advanceTimersByTimeAsync(1);
      expect((await fetchAndParseUrl(url + '/other').promise).status).toBe(429);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect((await pending.promise).doc?.body.textContent).toBe('recovered');
      expect(calls).toBe(2);
      expect(vi.getTimerCount()).toBe(0);
    }
  );
});
