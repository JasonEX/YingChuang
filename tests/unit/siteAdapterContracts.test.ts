import { afterEach, describe, expect, it, vi } from 'vitest';
import { ciweimaoRule } from '@/core/rules/sites/ciweimao';
import { createDom } from '../testUtils/dom';
import { loadTocEntriesPaged } from '@/ui/stores/reader/toc';
import { Parser } from '@/core/parser/Parser';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('site adapter behavior contracts', () => {
  it('hydrates a live Ciweimao chapter through the same session/detail protocol as API navigation', async () => {
    const url = 'https://www.ciweimao.com/chapter/113909523';
    createDom(
      url,
      '<div id="J_BookCnt" data-id="113909523"></div><div id="J_BookRead">加载中</div>'
    );
    const content = '<p class="chapter">他们终于走出了山谷。</p><p class="chapter">回家。</p>';
    const decrypt = vi
      .fn()
      .mockReturnValueOnce({ toString: () => btoa(btoa('1234567890123456second-pass')) })
      .mockReturnValueOnce({ toString: () => content })
      .mockReturnValueOnce({ toString: () => btoa(btoa('1234567890123456second-pass')) })
      .mockReturnValueOnce({ toString: () => content });
    const fetchMock = vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        input.includes('ajax_get_session_code')
          ? { code: '100000', chapter_access_key: 'abc' }
          : {
              code: 100000,
              chapter_content: btoa('1234567890123456first-pass'),
              encryt_keys: ['a', 'b', 'c'],
            },
    }));
    vi.stubGlobal('unsafeWindow', {
      fetch: fetchMock,
      CryptoJS: {
        AES: { decrypt },
        enc: { Base64: { parse: (s: string) => s }, Utf8: {} },
        format: { OpenSSL: { parse: (s: string) => s } },
      },
    });
    await ciweimaoRule.hooks?.beforeParse?.(document, url);
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      'https://www.ciweimao.com/chapter/ajax_get_session_code?chapter_id=113909523',
      'https://www.ciweimao.com/chapter/get_book_chapter_detail_info?chapter_id=113909523&chapter_access_key=abc',
    ]);
    expect(document.querySelector('#J_BookRead')!.innerHTML).toBe(content);
    expect(decrypt).toHaveBeenCalledTimes(2);

    // Live host renderers can replace a body after hydration; it must remain recoverable.
    document.querySelector('#J_BookRead')!.innerHTML = '加载中';
    await ciweimaoRule.hooks?.beforeParse?.(document, url);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(document.querySelector('#J_BookRead')!.innerHTML).toBe(content);
  });

  it('parses a short API chapter without requesting or decrypting it a second time', async () => {
    const url = 'https://www.ciweimao.com/chapter/123456780';
    const indexUrl = 'https://www.ciweimao.com/chapter-list/987654321';
    createDom(url);
    const html = '<p class="chapter">他们终于走出了山谷。</p><p class="chapter">回家。</p>';
    const decrypt = vi
      .fn()
      .mockReturnValueOnce({ toString: () => btoa(btoa('1234567890123456second-pass')) })
      .mockReturnValueOnce({ toString: () => html });
    const fetchMock = vi.fn(async (input: string) => {
      if (input === indexUrl) {
        return { ok: true, text: async () => `<a href="${url}">第一章 归途</a>` };
      }
      return {
        ok: true,
        json: async () =>
          input.includes('ajax_get_session_code')
            ? { code: 100000, chapter_access_key: 'abc' }
            : {
                code: 100000,
                chapter_content: btoa('1234567890123456first-pass'),
                encryt_keys: ['a', 'b', 'c'],
              },
      };
    });
    vi.stubGlobal('unsafeWindow', {
      fetch: fetchMock,
      CryptoJS: {
        AES: { decrypt },
        enc: { Base64: { parse: (s: string) => s }, Utf8: {} },
        format: { OpenSSL: { parse: (s: string) => s } },
      },
    });
    const doc = await ciweimaoRule.hooks!.fetchDocument!(url, {
      refererUrl: url,
      indexUrl,
      bookTitle: '山谷归途',
    });
    const chapter = await new Parser().parse(doc!, url);
    expect(chapter).toMatchObject({ title: '第一章 归途', indexUrl, bookTitle: '山谷归途' });
    expect(chapter?.content).toContain('他们终于走出了山谷。');
    expect(chapter?.content).toContain('回家。');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(decrypt).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ code: 403 }, undefined, 1],
    [{ code: 100000 }, undefined, 1],
    [{ code: 100000, chapter_access_key: 'abc' }, { code: 403 }, 2],
    [
      { code: 100000, chapter_access_key: 'abc' },
      { code: 100000, chapter_content: 'invalid', encryt_keys: [] },
      2,
    ],
  ])(
    'keeps existing text when the content protocol returns unusable data',
    async (session, detail, count) => {
      const url = 'https://www.ciweimao.com/chapter/113909523';
      createDom(url, '<div id="J_BookRead"><p>已有正文不能丢失。</p></div>');
      const fetchMock = vi.fn(async (input: string) => ({
        ok: true,
        json: async () => (input.includes('ajax_get_session_code') ? session : detail),
      }));
      vi.stubGlobal('unsafeWindow', { fetch: fetchMock });
      await ciweimaoRule.hooks?.beforeParse?.(document, url);
      expect(document.querySelector('#J_BookRead')!.innerHTML).toBe('<p>已有正文不能丢失。</p>');
      expect(fetchMock).toHaveBeenCalledTimes(count as number);
      await ciweimaoRule.hooks?.beforeParse?.(document, url);
      expect(fetchMock).toHaveBeenCalledTimes((count as number) * 2);
    }
  );

  it('preserves legitimate short closing paragraphs while removing marked watermarks', async () => {
    const url = 'https://www.ciweimao.com/chapter/113909523';
    const { window } = createDom(
      url,
      `<div id="J_BookRead">
      ${`<p class="chapter">${'队员们在山中继续寻找失踪的同伴。'.repeat(15)}</p>`.repeat(3)}
      <p class="chapter">回家。</p><p class="chapter">“我知道了。”</p>
      <p class="chapter">他没有回头</p><p class="chapter"><span>Qw9Er</span></p>
    </div>`
    );
    await ciweimaoRule.hooks?.beforeParse?.(window.document, url);
    const text = window.document.querySelector('#J_BookRead')!.textContent;
    expect(text).toContain('回家。');
    expect(text).toContain('“我知道了。”');
    expect(text).toContain('他没有回头');
    expect(text).not.toContain('Qw9Er');
  });

  it.each([
    ['https://twkan.com/txt/93181/53052605', 'https://twkan.com/book/93181/index.html'],
    [
      'https://www.qidian.com/chapter/1045659200/850667574/',
      'https://www.qidian.com/book/1045659200/',
    ],
  ])('does not launch fallback requests after cancellation: %s', async (url, index) => {
    createDom(url);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('cancelled')));
          })
      )
    );
    const gm = vi.fn((options: GM_xmlhttpRequestOptions) => {
      options.onerror?.({} as GmXhrResponse);
      return { abort: vi.fn() };
    });
    vi.stubGlobal('GM_xmlhttpRequest', gm);
    const setAbort = vi.fn();
    const pending = loadTocEntriesPaged(index, url, undefined, setAbort);
    setAbort.mock.calls[0][0]();
    expect(await pending).toEqual([]);
    expect(gm).not.toHaveBeenCalled();
    expect(setAbort).toHaveBeenLastCalledWith(null);
  });
});
