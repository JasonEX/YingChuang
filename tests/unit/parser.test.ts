import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import type {
  DetectionEngineResult,
  NavigationResult,
  SectionDetectionResult,
} from '@/core/detection';
import type { SiteRule } from '@/core/rules/types';

type HookFetchOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  referrer?: string;
  withCredentials?: boolean;
};

type DetectionEngineLike = {
  detect: (doc: Document, url: string) => DetectionEngineResult;
  detectNavigation: (doc: Document, url: string) => NavigationResult;
  detectSection: (doc: Document, url: string) => SectionDetectionResult;
  quickCheck: (doc: Document) => boolean;
};

type WaitForDynamicContentOptions = {
  selector?: string;
  minChildCount?: number;
  timeoutMs?: number;
  minTextLength?: number;
  scroll?: boolean;
};

const { mockMatchRule } = vi.hoisted(() => ({
  mockMatchRule: vi.fn(),
}));

vi.mock('@/core/rules/RuleManager', () => ({
  getRuleManager: () => ({
    matchRule: mockMatchRule,
  }),
}));

import { DetectionEngine, TitleDetector } from '@/core/detection';
import { Parser } from '@/core/parser/Parser';

describe('Parser', () => {
  let dom: JSDOM;
  let parser: Parser;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head><title></title></head><body></body></html>', {
      url: 'https://example.com/chapter/1',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('location', dom.window.location);

    parser = new Parser();

    mockMatchRule.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('supports jQuery-like selectors in smartSelect', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    dom.window.document.body.innerHTML = `
      <div class="box">
        <p>one</p>
        <p>two</p>
        <p>three</p>
      </div>
      <div class="other">
        <p>alpha</p>
      </div>
    `;

    const doc = dom.window.document;
    const smartSelect = (
      parser as unknown as { smartSelect: (doc: Document, sel: string) => Element | null }
    ).smartSelect;

    expect(smartSelect(doc, 'p:eq(1)')?.textContent).toBe('two');
    expect(smartSelect(doc, 'p:eq(-1)')?.textContent).toBe('alpha');
    expect(smartSelect(doc, 'p:first')?.textContent).toBe('one');
    expect(smartSelect(doc, 'p:last')?.textContent).toBe('alpha');
    expect(smartSelect(doc, 'div.box p:contains(two)')?.textContent).toBe('two');
    expect(smartSelect(doc, 'div:contains(one):contains(two)')?.className).toBe('box');
    expect(smartSelect(doc, 'p:first-child')?.textContent).toBe('one');
    doc.querySelector('p')!.setAttribute('data-label', ':contains(two)');
    expect(doc.querySelector('p:is([data-label=":contains(two)"])')?.textContent).toBe('one');
    expect(smartSelect(doc, 'p:is([data-label=":contains(two)"])')?.textContent).toBe('one');
    expect(smartSelect(doc, '.missing')).toBeNull();
    expect(debug).not.toHaveBeenCalled();
    expect(smartSelect(doc, 'p>>')).toBeNull();
    expect(debug).toHaveBeenCalledWith(
      '[Parser] Invalid selector:',
      'p>>',
      expect.objectContaining({ name: 'SyntaxError' })
    );
  });

  it('returns null for invalid base selectors in :eq/:first/:last/:contains', () => {
    const doc = dom.window.document;
    const smartSelect = (
      parser as unknown as { smartSelect: (doc: Document, sel: string) => Element | null }
    ).smartSelect;

    expect(smartSelect(doc, '[invalid:eq(0)')).toBeNull();
    expect(smartSelect(doc, '[invalid:first')).toBeNull();
    expect(smartSelect(doc, '[invalid:last')).toBeNull();
    expect(smartSelect(doc, '[invalid:contains("x")')).toBeNull();
  });

  it('supports smartSelect edge-cases (:eq/* base, out-of-range, empty results, contains base "*")', () => {
    dom.window.document.body.innerHTML = `
      <div class="box">
        <p>one</p>
        <p>two</p>
      </div>
    `;

    const doc = dom.window.document;
    const smartSelect = (
      parser as unknown as { smartSelect: (doc: Document, sel: string) => Element | null }
    ).smartSelect;

    expect(smartSelect(doc, ':eq(0)')).not.toBeNull();
    expect(smartSelect(doc, 'p:eq(99)')).toBeNull();

    expect(smartSelect(doc, ':first')).not.toBeNull();
    expect(smartSelect(doc, ':last')).not.toBeNull();
    expect(smartSelect(doc, 'nope:first')).toBeNull();
    expect(smartSelect(doc, 'nope:last')).toBeNull();

    expect(smartSelect(doc, ':contains(two)')?.textContent).toContain('two');
    expect(smartSelect(doc, 'p:contains(zzz)')).toBeNull();
  });

  it('allows cross-origin hook fetchText via GM_xmlhttpRequest (http/https only)', async () => {
    const doc = dom.window.document;

    const gmXhr = vi.fn(
      (opts: { url: string; onload: (resp: { responseText: string; status: number }) => void }) => {
        opts.onload({ responseText: 'ok', status: 200 });
      }
    );
    vi.stubGlobal('GM_xmlhttpRequest', gmXhr);

    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      hooks: {
        beforeParse: async (doc, _url, helpers) => {
          const t = await helpers?.fetchText('https://cross.origin.test/data');
          doc.body.setAttribute('data-fetched', t || '');
        },
      },
      meta: { source: 'builtin' },
    };

    const runBeforeParseHook = (
      parser as unknown as {
        runBeforeParseHook: (rule: SiteRule, doc: Document, url?: string) => Promise<void>;
      }
    ).runBeforeParseHook.bind(parser);
    await runBeforeParseHook(rule, doc, dom.window.location.href);

    expect(doc.body.getAttribute('data-fetched')).toBe('ok');
    expect(gmXhr).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: 'https://cross.origin.test/data' })
    );
  });

  it('blocks hook fetchText to private-network hosts (e.g. 127.0.0.1) when cross-origin', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const gmXhr = vi.fn();
    vi.stubGlobal('GM_xmlhttpRequest', gmXhr);

    const doc = dom.window.document;
    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      hooks: {
        beforeParse: async (doc, _url, helpers) => {
          const t = await helpers?.fetchText('http://127.0.0.1/private');
          doc.body.setAttribute('data-fetched', String(t));
        },
      },
      meta: { source: 'builtin' },
    };

    const runBeforeParseHook = (
      parser as unknown as {
        runBeforeParseHook: (rule: SiteRule, doc: Document, url?: string) => Promise<void>;
      }
    ).runBeforeParseHook.bind(parser);
    await runBeforeParseHook(rule, doc, dom.window.location.href);

    expect(doc.body.getAttribute('data-fetched')).toBe('null');
    expect(gmXhr).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[Parser] Fetch blocked: invalid or unsafe URL:',
      'http://127.0.0.1/private'
    );
  });

  it('handles hook errors without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const doc = dom.window.document;
    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      hooks: {
        beforeParse: () => {
          throw new Error('boom');
        },
      },
      meta: { source: 'builtin' },
    };

    const runBeforeParseHook = (
      parser as unknown as {
        runBeforeParseHook: (rule: SiteRule, doc: Document, url?: string) => Promise<void>;
      }
    ).runBeforeParseHook.bind(parser);

    await expect(runBeforeParseHook(rule, doc, dom.window.location.href)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('fills missing navigation fields from detection when rule does not define them', async () => {
    dom.window.document.title = '第1章 测试';
    dom.window.document.body.innerHTML = `
      <div id="content">
        <h1>第1章 测试</h1>
        <p>${'这是小说正文内容。'.repeat(120)}</p>
        <a rel="prev" href="/chapter/1.html">上一章</a>
        <a rel="next" href="/chapter/3.html">下一章</a>
        <a href="/book/1/index.html">目录</a>
      </div>
    `;

    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      meta: { source: 'builtin' },
    };

    mockMatchRule.mockReturnValue({
      rule,
      source: 'builtin',
      matchedPattern: '.*',
    });

    const out = await parser.parse(dom.window.document, 'https://example.com/chapter/2.html');

    expect(out?.nextUrl).toContain('/chapter/3.html');
    expect(out?.prevUrl).toContain('/chapter/1.html');
    expect(out?.indexUrl).toContain('/book/1/index.html');
    expect(out?.title).toContain('第1章');
  });

  it('parses with rule and respects rule.processing flags', async () => {
    dom.window.document.title = '第1章 测试';
    dom.window.document.body.innerHTML = `
      <h1 id="title">第1章</h1>
      <div id="content">${'正文'.repeat(60)}</div>
      <div id="not-a" href="/prev">not-a</div>
    `;

    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      title: { selector: '#title' },
      navigation: { prev: '#not-a' },
      processing: {
        removeAds: false,
        normalizeWhitespace: false,
        fixImages: false,
        useRawContent: true,
      },
      meta: { source: 'builtin' },
    };

    mockMatchRule.mockReturnValue({ rule, source: 'builtin', matchedPattern: '.*' });

    const out = await parser.parse(dom.window.document, dom.window.location.href);

    expect(out?.method).toBe('rule');
    expect(out?.title).toBe('第1章');
    expect(out?.prevUrl).toBeUndefined();
  });

  it('does not leak rule processing flags into later detection parses', async () => {
    dom.window.document.title = '第1章 测试';
    dom.window.document.body.innerHTML = `
      <h1 id="title">第1章</h1>
      <div id="content"><p>正文内容。手机用户请到m.test.com阅读。</p></div>
    `;

    const rawRule: SiteRule = {
      id: 'raw-rule',
      version: 1,
      match: { pattern: '.*', type: 'regex' },
      content: { selector: '#content' },
      title: { selector: '#title' },
      processing: {
        removeAds: false,
        useRawContent: true,
      },
      meta: { source: 'builtin' },
    };

    mockMatchRule.mockReturnValueOnce({
      rule: rawRule,
      source: 'builtin',
      matchedPattern: '.*',
    });

    const first = await parser.parse(dom.window.document, dom.window.location.href);
    expect(first?.content).toContain('手机用户请到');

    dom.window.document.body.innerHTML = `
      <div id="detected-content">
        <p>正文内容。手机用户请到m.test.com阅读。继续阅读。</p>
      </div>
    `;
    const detectedElement = dom.window.document.getElementById('detected-content');
    const detected: DetectionEngineResult = {
      results: {
        content: {
          element: detectedElement,
          selector: '#detected-content',
          confidence: 0.9,
          method: 'selector',
        },
        navigation: { next: null, prev: null, index: null },
        title: { chapterTitle: '第2章', confidence: 0.8, method: 'pattern' },
      },
      confidence: {
        overall: 0.9,
        content: 0.9,
        navigation: 0,
        title: 0.8,
        isReliable: true,
        reasons: [],
      },
    };

    (parser as unknown as { detectionEngine: DetectionEngineLike }).detectionEngine = {
      detect: vi.fn(() => detected) as unknown as DetectionEngineLike['detect'],
      detectNavigation: vi.fn(
        () => detected.results.navigation
      ) as unknown as DetectionEngineLike['detectNavigation'],
      detectSection: vi.fn(
        () => detected.results.section as SectionDetectionResult
      ) as unknown as DetectionEngineLike['detectSection'],
      quickCheck: vi.fn(() => true) as unknown as DetectionEngineLike['quickCheck'],
    };
    mockMatchRule.mockReturnValueOnce(null);

    const second = await parser.parse(dom.window.document, dom.window.location.href);

    expect(second?.method).toBe('detection');
    expect(second?.content).not.toContain('手机用户请到');
    expect(second?.content).toContain('正文内容');
  });

  it('returns null when detection cannot find a content element', async () => {
    mockMatchRule.mockReturnValue(null);
    dom.window.document.body.innerHTML = '<div>short</div>';

    const out = await parser.parse(dom.window.document, 'https://example.com/chapter/1');
    expect(out).toBeNull();
  });

  it('uses window.location.href when doc.location is missing', async () => {
    mockMatchRule.mockReturnValue(null);

    const doc = new DOMParser().parseFromString(
      '<!doctype html><html><body><div id="content">正文' +
        'x'.repeat(200) +
        '</div></body></html>',
      'text/html'
    );

    const contentEl = doc.getElementById('content');
    const detect = vi.fn((_doc: Document, _url: string) => ({
      results: {
        content: { element: contentEl, selector: '#content', confidence: 1, method: 'selector' },
        navigation: { next: null, prev: null, index: null },
        title: { chapterTitle: 'detected', bookTitle: undefined, confidence: 1, method: 'pattern' },
      },
      confidence: {
        overall: 1,
        content: 1,
        navigation: 0,
        title: 1,
        isReliable: true,
        reasons: [],
      },
    })) as unknown as DetectionEngineLike['detect'];

    (parser as unknown as { detectionEngine: DetectionEngineLike }).detectionEngine = {
      detect,
      detectNavigation: vi.fn(() => ({
        next: null,
        prev: null,
        index: null,
      })) as unknown as DetectionEngineLike['detectNavigation'],
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })) as unknown as DetectionEngineLike['detectSection'],
      quickCheck: vi.fn(() => true) as unknown as DetectionEngineLike['quickCheck'],
    };

    const out = await parser.parse(doc);
    expect(out?.url).toBe(dom.window.location.href);
    expect(detect).toHaveBeenCalledWith(doc, dom.window.location.href);
  });

  it('quickCheck delegates to DetectionEngine', () => {
    dom.window.document.title = '第1章 测试';
    dom.window.document.body.innerHTML = '<div id="content"><p>短内容</p></div>';
    expect(typeof parser.quickCheck(dom.window.document)).toBe('boolean');
  });

  it('waitForDynamicContent returns true when minChildCount is satisfied', async () => {
    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: {
            selector?: string;
            minChildCount?: number;
            timeoutMs?: number;
            minTextLength?: number;
            scroll?: boolean;
          }
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    dom.window.document.body.innerHTML = '<div id="content"><span></span><span></span></div>';
    const ok = await waitForDynamicContent(dom.window.document, {
      selector: '#content',
      minChildCount: 2,
      minTextLength: 9999,
      timeoutMs: 10,
    });

    expect(ok).toBe(true);
  });

  it('waitForDynamicContent triggers lazyLoadScroll and handles no selector', async () => {
    vi.useFakeTimers();

    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: {
            selector?: string;
            minChildCount?: number;
            timeoutMs?: number;
            minTextLength?: number;
            scroll?: boolean;
          }
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    Object.defineProperty(dom.window, 'scrollBy', { value: vi.fn(), configurable: true });
    Object.defineProperty(dom.window, 'scrollTo', { value: vi.fn(), configurable: true });
    Object.defineProperty(dom.window, 'scrollY', { value: 0, configurable: true });

    dom.window.document.body.innerHTML = '';

    const pending = waitForDynamicContent(dom.window.document, {
      timeoutMs: 300,
      minTextLength: 10,
      scroll: true,
    });

    await vi.runAllTimersAsync();
    const ok = await pending;
    expect(ok).toBe(false);
  });

  it('waitForDynamicContent returns false when there is no body/documentElement', async () => {
    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: WaitForDynamicContentOptions
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    const fakeDoc = { body: null, documentElement: null } as unknown as Document;
    await expect(waitForDynamicContent(fakeDoc, { timeoutMs: 10 })).resolves.toBe(false);
  });

  it('waitForDynamicContent does not treat placeholder text as ready unless minChildCount is satisfied', async () => {
    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: WaitForDynamicContentOptions
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    dom.window.document.body.innerHTML = '<div id="content">加载中<span></span></div>';
    await expect(
      waitForDynamicContent(dom.window.document, {
        selector: '#content',
        minTextLength: 1,
        minChildCount: 1,
        timeoutMs: 10,
      })
    ).resolves.toBe(true);
  });

  it('waitForDynamicContent can resolve twice safely when clearTimeout is ineffective (branch coverage)', async () => {
    vi.useFakeTimers();

    const clearTimeoutMock = vi.fn();
    Object.defineProperty(dom.window, 'clearTimeout', {
      value: clearTimeoutMock,
      configurable: true,
    });

    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: WaitForDynamicContentOptions
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    dom.window.document.body.innerHTML = '<div id="content">加载中</div>';
    const content = dom.window.document.getElementById('content')!;

    const pending = waitForDynamicContent(dom.window.document, {
      selector: '#content',
      minTextLength: 2,
      timeoutMs: 50,
    });

    content.textContent = 'ok';

    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBe(true);
    expect(clearTimeoutMock).toHaveBeenCalled();
  });

  it('waitForDynamicContent returns false when selector is provided but element is missing', async () => {
    vi.useFakeTimers();

    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: WaitForDynamicContentOptions
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    Object.defineProperty(dom.window, 'scrollBy', { value: vi.fn(), configurable: true });
    Object.defineProperty(dom.window, 'scrollTo', { value: vi.fn(), configurable: true });
    Object.defineProperty(dom.window, 'scrollY', { value: 0, configurable: true });
    Object.defineProperty(dom.window, 'innerHeight', { value: 800, configurable: true });

    dom.window.document.body.innerHTML = '';

    const pending = waitForDynamicContent(dom.window.document, {
      selector: '#missing',
      timeoutMs: 120,
      minTextLength: 10,
      scroll: true,
    });

    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(false);
  });

  it('triggerLazyLoadScroll returns early when scrollBy is missing or startY > 5', async () => {
    const triggerLazyLoadScroll = (
      parser as unknown as {
        triggerLazyLoadScroll: (getLength: () => number, timeoutMs: number) => Promise<void>;
      }
    ).triggerLazyLoadScroll.bind(parser);

    Object.defineProperty(dom.window, 'scrollBy', { value: undefined, configurable: true });
    await triggerLazyLoadScroll(() => 0, 100);

    Object.defineProperty(dom.window, 'scrollBy', { value: vi.fn(), configurable: true });
    Object.defineProperty(dom.window, 'scrollY', { value: 10, configurable: true });
    await triggerLazyLoadScroll(() => 0, 100);
  });

  it('validates hook fetch URLs (http/https only; blocks private-network hosts)', () => {
    const resolveHookFetchUrl = (
      parser as unknown as { resolveHookFetchUrl: (url: string) => string | null }
    ).resolveHookFetchUrl.bind(parser);

    expect(resolveHookFetchUrl('/a')).toBe('https://example.com/a');
    expect(resolveHookFetchUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(resolveHookFetchUrl('http://example.com/a')).toBe('http://example.com/a');

    // Cross-origin http(s) is allowed by default.
    expect(resolveHookFetchUrl('https://evil.example.net/a')).toBe('https://evil.example.net/a');

    // Non-http(s) is blocked.
    expect(resolveHookFetchUrl('file:///etc/passwd')).toBeNull();

    // GM_xmlhttpRequest bypasses CORS; block private-network/loopback hosts unless same-host.
    expect(resolveHookFetchUrl('http://127.0.0.1/a')).toBeNull();
  });

  it('fetchText blocks unsafe URLs without making requests', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const gm = vi.fn(() => ({ abort: () => {} }));
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);

    await expect(fetchText('http://127.0.0.1/a')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[Parser] Fetch blocked: invalid or unsafe URL:',
      'http://127.0.0.1/a'
    );
    expect(gm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetchText uses GM_xmlhttpRequest when available', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: 'ok',
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);
    const result = await fetchText('https://example.com/a', {
      timeoutMs: 10,
      headers: { Accept: 'text/plain' },
      withCredentials: false,
    });

    expect(result).toBe('ok');
    expect(gm).toHaveBeenCalledTimes(1);
  });

  it('fetchText ignores GM_xmlhttpRequest error pages', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: '<html>404</html>',
        status: 404,
        statusText: 'Not Found',
        finalUrl: opts.url,
      });
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);

    await expect(fetchText('https://example.com/a')).resolves.toBeNull();
  });

  it('fetchText passes referrer as Referer for GM_xmlhttpRequest', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: 'ok',
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);
    await expect(
      fetchText('https://example.com/a', {
        referrer: 'https://example.com/chapter/1',
      })
    ).resolves.toBe('ok');

    expect(gm).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Referer: 'https://example.com/chapter/1' }),
      })
    );
  });

  it('fetchText resolves null when GM_xmlhttpRequest onload returns empty responseText', async () => {
    const gm = vi.fn((opts: GM_xmlhttpRequestOptions) => {
      opts.onload?.({
        readyState: 4,
        responseHeaders: '',
        responseText: '',
        status: 200,
        statusText: 'OK',
        finalUrl: opts.url,
      });
      return { abort: () => {} };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);

    await expect(fetchText('https://example.com/empty')).resolves.toBeNull();
  });

  it('fetchText falls back to fetch and returns null on errors', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => 'hello' }))
    );

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);
    await expect(fetchText('https://example.com/a')).resolves.toBe('hello');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, text: async () => 'nope' }))
    );
    await expect(fetchText('https://example.com/b')).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      })
    );
    await expect(fetchText('https://example.com/c')).resolves.toBeNull();
  });

  it('fetchText passes credentials=omit when withCredentials is false', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);

    await expect(fetchText('https://example.com/a', { withCredentials: false })).resolves.toBe(
      'ok'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/a',
      expect.objectContaining({ credentials: 'omit' })
    );
  });

  it('fetchText passes referrer option to fetch and strips Referer header', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', undefined);

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const fetchText = (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText.bind(parser);

    await expect(
      fetchText('https://example.com/a', {
        headers: { Accept: 'text/plain', Referer: 'https://bad.example/ref' },
        referrer: 'https://example.com/chapter/1',
      })
    ).resolves.toBe('ok');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/a',
      expect.objectContaining({
        headers: { Accept: 'text/plain' },
        referrer: 'https://example.com/chapter/1',
      })
    );
  });

  it('fetchJson parses JSON and returns null for invalid JSON', async () => {
    (
      parser as unknown as {
        fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
      }
    ).fetchText = vi
      .fn()
      .mockResolvedValueOnce('{"a":1}')
      .mockResolvedValueOnce('{not-json}')
      .mockResolvedValueOnce(null);

    const fetchJson = (
      parser as unknown as {
        fetchJson: (
          url: string,
          options?: HookFetchOptions
        ) => Promise<Record<string, unknown> | null>;
      }
    ).fetchJson.bind(parser);

    await expect(fetchJson('u')).resolves.toEqual({ a: 1 });
    await expect(fetchJson('u')).resolves.toBeNull();
    await expect(fetchJson('u')).resolves.toBeNull();
  });

  it('parses with rule and applies navigation fallback rules', async () => {
    dom.window.document.title = '《MyBook》 - 第12章';
    dom.window.document.body.innerHTML = `
      <h1 id="title">第12章</h1>
      <div id="content">${'正文'.repeat(60)}</div>
      <a id="prev" href="/prev">上一章</a>
    `;

    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: 'example\\.com', type: 'regex' },
      content: { selector: '#content' },
      navigation: {
        next: '#next-missing',
        prev: '#prev',
        index: false,
      },
      title: {
        pattern: '《([^》]+)》\\s*-\\s*(第\\d+章)',
        patternIndex: 2,
        bookPatternIndex: 1,
        replace: '[',
      },
      hooks: {
        beforeParse: doc => {
          doc.body.setAttribute('data-hook', '1');
        },
      },
      meta: { source: 'builtin' },
    };

    const detected: DetectionEngineResult = {
      results: {
        content: { element: null, selector: '#content', confidence: 0.9, method: 'selector' },
        navigation: {
          next: {
            element: null as unknown as HTMLAnchorElement,
            url: 'https://example.com/next',
            confidence: 0.8,
            method: 'pattern',
            text: '下一章',
          },
          prev: null,
          index: {
            element: null as unknown as HTMLAnchorElement,
            url: 'https://example.com/index',
            confidence: 0.8,
            method: 'pattern',
            text: '目录',
          },
        },
        title: {
          chapterTitle: 'detected',
          bookTitle: 'detected-book',
          confidence: 0.8,
          method: 'pattern',
        },
      },
      confidence: {
        overall: 0.9,
        content: 0.9,
        navigation: 0.8,
        title: 0.8,
        isReliable: true,
        reasons: [],
      },
    };

    (parser as unknown as { detectionEngine: DetectionEngineLike }).detectionEngine = {
      detect: vi.fn(() => detected) as unknown as DetectionEngineLike['detect'],
      detectNavigation: vi.fn(
        () => detected.results.navigation
      ) as unknown as DetectionEngineLike['detectNavigation'],
      detectSection: vi.fn(
        () => detected.results.section as SectionDetectionResult
      ) as unknown as DetectionEngineLike['detectSection'],
      quickCheck: vi.fn(() => true) as unknown as DetectionEngineLike['quickCheck'],
    };

    mockMatchRule.mockReturnValue({
      rule,
      source: 'builtin',
      matchedPattern: rule.match.pattern,
    });

    const chapter = await parser.parse(dom.window.document, dom.window.location.href);
    expect(chapter?.method).toBe('rule');
    expect(dom.window.document.body.getAttribute('data-hook')).toBe('1');
    expect(chapter?.bookTitle).toBe('MyBook');
    expect(chapter?.title).toBe('第12章');
    expect(chapter?.prevUrl).toContain('/prev');
    // rule.navigation.index is false => explicitly disabled; do not fall back
    expect(chapter?.indexUrl).toBeUndefined();
    // rule.navigation.next exists but selector doesn't match => should not fall back
    expect(chapter?.nextUrl).toBeUndefined();
  });

  it('falls back to detection when rule selector fails and marks method as mixed', async () => {
    dom.window.document.body.innerHTML = `
      <div id="content">${'正文'.repeat(60)}</div>
      <a id="next" href="/next">下一章</a>
    `;

    const rule: SiteRule = {
      id: 'r',
      version: 1,
      match: { pattern: 'example\\.com', type: 'regex' },
      content: { selector: '#missing' },
      navigation: { next: '#next' },
      meta: { source: 'builtin' },
    };

    const detected: DetectionEngineResult = {
      results: {
        content: {
          element: dom.window.document.getElementById('content'),
          selector: '#content',
          confidence: 0.9,
          method: 'selector',
        },
        navigation: {
          next: {
            element: dom.window.document.getElementById('next') as unknown as HTMLAnchorElement,
            url: 'https://example.com/next-detected',
            confidence: 0.8,
            method: 'pattern',
            text: '下一章',
          },
          prev: null,
          index: null,
        },
        title: { chapterTitle: 'detected', bookTitle: 'book', confidence: 0.8, method: 'pattern' },
      },
      confidence: {
        overall: 0.9,
        content: 0.9,
        navigation: 0.8,
        title: 0.8,
        isReliable: true,
        reasons: [],
      },
    };

    (parser as unknown as { detectionEngine: DetectionEngineLike }).detectionEngine = {
      detect: vi.fn(() => detected) as unknown as DetectionEngineLike['detect'],
      detectNavigation: vi.fn(
        () => detected.results.navigation
      ) as unknown as DetectionEngineLike['detectNavigation'],
      detectSection: vi.fn(() => ({
        isSection: false,
        nextSectionUrl: null,
        nextChapterUrl: null,
        confidence: 0,
      })) as unknown as DetectionEngineLike['detectSection'],
      quickCheck: vi.fn(() => true) as unknown as DetectionEngineLike['quickCheck'],
    };

    mockMatchRule.mockReturnValue({
      rule,
      source: 'builtin',
      matchedPattern: rule.match.pattern,
    });

    const chapter = await parser.parse(dom.window.document, dom.window.location.href);
    expect(chapter?.method).toBe('mixed');
    // Rule navigation selector should override detected URL
    expect(chapter?.nextUrl).toContain('/next');
  });

  it('waitForDynamicContent resolves when DOM mutates and supports lazy scroll', async () => {
    vi.useFakeTimers();

    const doc = dom.window.document;
    doc.body.innerHTML = '<div id="content" data-mnr-loading>加载中</div>';
    const content = doc.getElementById('content')!;

    let scrollY = 0;
    Object.defineProperty(dom.window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    Object.defineProperty(dom.window, 'innerHeight', { value: 800, configurable: true });

    const scrollByMock = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        scrollY += y ?? 0;
        return;
      }
      scrollY += options?.top ?? 0;
    });
    Object.defineProperty(dom.window, 'scrollBy', { value: scrollByMock, configurable: true });

    const scrollToMock = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        scrollY = y ?? 0;
        return;
      }
      scrollY = options?.top ?? 0;
    });
    Object.defineProperty(dom.window, 'scrollTo', { value: scrollToMock, configurable: true });

    const waitForDynamicContent = (
      parser as unknown as {
        waitForDynamicContent: (
          doc: Document,
          options: WaitForDynamicContentOptions
        ) => Promise<boolean>;
      }
    ).waitForDynamicContent.bind(parser);

    const promise = waitForDynamicContent(doc, {
      selector: '#content',
      timeoutMs: 200,
      minTextLength: 80,
      scroll: true,
    });

    await vi.advanceTimersByTimeAsync(10);
    content.removeAttribute('data-mnr-loading');
    content.textContent = '正文'.repeat(60);

    // Also drain the lazy-scroll helper timers to let the method settle.
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(true);
  });

  it('uses title-only detection for rule fallback on a detached document', async () => {
    const doc = new DOMParser().parseFromString(
      '<title>第12章 风起，云涌 - 山海归途 - 小说网</title><h1>第12章 风起，云涌</h1><div id="content">' +
        '正文'.repeat(300) +
        '</div>',
      'text/html'
    );
    const expected = new TitleDetector().detect(doc);
    const fullDetection = vi.spyOn(DetectionEngine.prototype, 'detect');
    const titleDetection = vi.spyOn(DetectionEngine.prototype, 'detectTitle');
    const rule: SiteRule = {
      id: 'title-fallback',
      version: 1,
      match: { pattern: '.*' },
      content: { selector: '#content' },
      navigation: { prev: false, next: false, index: false },
    };
    mockMatchRule.mockReturnValue({ rule, source: 'builtin', matchedPattern: '.*' });
    const result = await parser.parse(doc, 'https://example.com/123.html');
    expect(result?.title).toBe(expected.chapterTitle);
    expect(result?.bookTitle).toBe(expected.bookTitle);
    expect(result?.content).toContain('正文');
    expect(fullDetection).not.toHaveBeenCalled();
    expect(titleDetection).toHaveBeenCalledTimes(1);
  });
});
