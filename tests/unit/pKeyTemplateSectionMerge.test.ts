/**
 * Unit tests for p_key "load more" template + extensionless pagination merge
 */

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { useReaderStore } from '@/ui/stores/reader';

type MockGmXhrOpts = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  overrideMimeType?: string;
  onload: (resp: { status: number; responseText: string }) => void;
  onerror: (err: unknown) => void;
  ontimeout: () => void;
};

function encodeBase64Utf8(value: string, btoaFn: (s: string) => string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoaFn(binary);
}

describe('p_key template + extensionless section merge', () => {
  it('expands p_key content and keeps a short empty-payload terminal page scoped', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://x.test/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);

    setActivePinia(createPinia());

    const page1Url = 'https://m.1qxs.test/xs_bkt9oo/89812/1358/1';
    const page2Url = 'https://m.1qxs.test/xs_bkt9oo/89812/1358/2';
    const page3Url = 'https://m.1qxs.test/xs_bkt9oo/89812/1358/3';
    const nextChapterUrl = 'https://m.1qxs.test/xs_bkt9oo/89812/1359/1';

    const hidden = [
      `<p>${'隐藏内容甲。'.repeat(50)}</p>`,
      '<p>测试书名第一章 测试</p>',
      `<p>${'隐藏内容乙。'.repeat(50)}</p>`,
    ].join('');
    const pKey = encodeBase64Utf8(hidden, dom.window.btoa.bind(dom.window));

    const page1Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="page">
          <a href="/xs_bkt9oo/89812/1357/2">上一页</a>
          <a href="/xs_bkt9oo/89812/1358/2">下一页</a>
        </div>
        <h1>第一章 测试(1/3)</h1>
        <div id="bookname">测试书名</div>
        <div class="content">
          <p>开头正文。</p>
          <p>阅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。</p>
          <p style="text-align:center;"><button>加|载|更|多</button></p>
        </div>
        <script>const p_key='${pKey}';</script>
      </body></html>
    `;

    const page2Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="page">
          <a href="/xs_bkt9oo/89812/1358/1">上一页</a>
          <a href="/xs_bkt9oo/89812/1358/3">下一页</a>
          <a href="/xs_bkt9oo/89812/1359/1">下一章</a>
        </div>
        <h1>第一章 测试(2/3)</h1>
        <div class="content">
          <p>${'第二页正文。'.repeat(200)}</p>
        </div>
      </body></html>
    `;

    const page3Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="page">
          <a href="/xs_bkt9oo/89812/1358/2">上一页</a>
          <a href="/xs_bkt9oo/89812/1359/1">下一页</a>
        </div>
        <div id="main">
          <h1>第一章 测试(3/3)</h1>
          <div class="template-01">
            <a href="/xs_bkt9oo/99999">
              <div class="book">
                <img alt="随机推荐书名">
                <div class="name">随机推荐书名</div>
                <div class="author">随机作者</div>
                <div>${'随机推荐描述。'.repeat(100)}</div>
              </div>
            </a>
          </div>
          <div class="content">
            <p>第三页最后一句正文。</p>
            <p>阅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。</p>
            <p><button>加|载|更|多</button></p>
          </div>
        </div>
        <script>const p_key='';</script>
      </body></html>
    `;

    // Stub GM_* storage APIs used by RuleStorage (RuleManager initializes during parse()).
    // userscript global stub
    globalThis.GM_listValues = () => [];
    // userscript global stub
    globalThis.GM_getValue = <T>(_name: string, defaultValue?: T): T => defaultValue as T;
    // userscript global stub
    globalThis.GM_setValue = () => {};
    // userscript global stub
    globalThis.GM_deleteValue = () => {};

    const gm = vi.fn((opts: MockGmXhrOpts) => {
      const u = opts.url;
      let responseText = page1Html;
      if (u === page2Url || u.endsWith('/1358/2')) responseText = page2Html;
      if (u === page3Url || u.endsWith('/1358/3')) responseText = page3Html;
      setTimeout(() => opts.onload({ status: 200, responseText }), 0);
      return { abort: () => {} };
    });

    // userscript global stub
    globalThis.GM_xmlhttpRequest = gm as unknown as typeof GM_xmlhttpRequest;

    const store = useReaderStore();

    store.setChapter({
      title: '上一章',
      bookTitle: '测试书名',
      content: 'init',
      rawContent: 'init',
      prevUrl: 'https://m.1qxs.test/xs_bkt9oo/89812/1357',
      nextUrl: page1Url,
      indexUrl: 'https://m.1qxs.test/catalog_bkt9oo/89812',
      url: 'https://m.1qxs.test/xs_bkt9oo/89812/1357',
      confidence: 1,
      method: 'detection',
    });

    const ok = await store.loadNextChapter();
    expect(ok).toBe(true);

    // Remaining section pages merge in the background once the first page is on screen.
    await vi.waitFor(
      () => {
        expect(store.isSectionMerging).toBe(false);
      },
      { timeout: 8000 }
    );

    const loaded = store.chapters[store.chapters.length - 1]?.chapter;
    expect(loaded.url).toBe(page1Url);
    expect(loaded.title).toBe('第一章 测试');
    expect(loaded.nextUrl).toBe(nextChapterUrl);
    expect(loaded.content).toContain('开头正文');
    expect(loaded.content).toContain('隐藏内容甲');
    expect(loaded.content).toContain('第二页正文');
    expect(loaded.content).toContain('第三页最后一句正文');
    expect(loaded.content).not.toContain('随机推荐书名');
    expect(loaded.content).not.toContain('随机作者');
    expect(loaded.content).not.toContain('测试书名第一章 测试');
    expect(loaded.content).not.toContain('加载更多');
  }, 15000);
});
