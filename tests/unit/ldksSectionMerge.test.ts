/**
 * Unit tests for ldks section merge behavior (multi-page chapters)
 */

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { useReaderStore } from '@/ui/stores/reader';

// Helper: minimal GM_xmlhttpRequest mock type
type MockGmXhrOpts = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  overrideMimeType?: string;
  onload: (resp: { status: number; responseText: string }) => void;
  onerror: (err: unknown) => void;
  ontimeout: () => void;
};

describe('ldks section merge', () => {
  it('should merge /42509750.html + /42509750_2.html and set nextUrl to next chapter', async () => {
    // Pinia store requires a DOM; create jsdom global.
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://x.test/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);

    // Pinia store setup
    setActivePinia(createPinia());

    const page1Url = 'http://23.225.121.247/ldks/111291/42509750.html';
    const page2Url = 'http://23.225.121.247/ldks/111291/42509750_2.html';
    const nextChapterUrl = 'http://23.225.121.247/ldks/111291/42509751.html';

    // Real page structure from the website
    const page1Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="section-opt">
          <a href="/ldks/111291/42509749.html">上一章</a>
          <a href="/ldks/111291/">章节列表</a>
          <a href="/ldks/111291/42509750_2.html">下一页</a>
        </div>
        <div id="content" class="content">
          <h1 class="title">第十八章 外挂的正确用法</h1>
          第十八章 外挂的正确用法 (第1/2页)<br /><br />PAGE1_CONTENT<br /><br />（本章未完，请点击下一页继续阅读）
        </div>
      </body></html>
    `;

    const page2Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="section-opt">
          <a href="/ldks/111291/42509750.html">上一页</a>
          <a href="/ldks/111291/">章节列表</a>
          <a href="/ldks/111291/42509751.html">下一章</a>
        </div>
        <div id="content" class="content">
          <h1 class="title">第十八章 外挂的正确用法</h1>
          第十八章 外挂的正确用法 (第2/2页)<br /><br />PAGE2_CONTENT
        </div>
      </body></html>
    `;

    // Stub GM_* storage APIs
    // userscript global stub
    globalThis.GM_listValues = () => [];
    // userscript global stub
    globalThis.GM_getValue = <T>(_name: string, defaultValue?: T): T => defaultValue as T;
    // userscript global stub
    globalThis.GM_setValue = () => {};
    // userscript global stub
    globalThis.GM_deleteValue = () => {};

    // Mock GM_xmlhttpRequest
    const gm = vi.fn((opts: MockGmXhrOpts) => {
      const u = opts.url;
      let responseText = page1Html;
      if (u === page2Url || u.includes('42509750_2')) {
        responseText = page2Html;
      }
      setTimeout(() => opts.onload({ status: 200, responseText }), 0);
      return { abort: () => {} };
    });

    // userscript global stub
    globalThis.GM_xmlhttpRequest = gm as unknown as typeof GM_xmlhttpRequest;

    const store = useReaderStore();

    // Set initial chapter with nextUrl pointing to page2 (section page)
    store.setChapter({
      title: '第十八章 外挂的正确用法',
      bookTitle: '苟在初圣魔门当人材',
      content: 'PAGE1_CONTENT',
      rawContent: 'PAGE1_CONTENT',
      prevUrl: 'http://23.225.121.247/ldks/111291/42509749.html',
      nextUrl: page2Url, // Points to section page, not next chapter
      indexUrl: 'http://23.225.121.247/ldks/111291/',
      url: page1Url,
      confidence: 1,
      method: 'rule',
      rule: {
        id: 'ldks-2baoe',
        version: 1,
        match: { pattern: '.*' },
        content: { selector: '#content' },
        navigation: {
          prev: '.section-opt a:contains("上一章"), .section-opt a:contains("上一页")',
          index: '.section-opt a:contains("章节列表")',
          next: '.section-opt a:contains("下一章"), .section-opt a:contains("下一页")',
        },
        advanced: { checkSection: true },
        meta: { source: 'builtin' },
      },
    });

    // Load next chapter - should merge sections
    const ok = await store.loadNextChapter();
    expect(ok).toBe(true);

    // Remaining section pages merge in the background once the first page is on screen.
    await vi.waitFor(
      () => {
        expect(store.isSectionMerging).toBe(false);
      },
      { timeout: 8000 }
    );

    const last = store.chapters[store.chapters.length - 1]?.chapter;
    // URL should be normalized to first page
    expect(last.url).toBe(page1Url);
    // nextUrl should point to next chapter, not section
    expect(last.nextUrl).toBe(nextChapterUrl);
    // Content should contain both pages
    expect(last.content).toContain('PAGE1_CONTENT');
    expect(last.content).toContain('PAGE2_CONTENT');
  }, 15000);

  it('should merge /id.html + /id_2.html and set nextUrl to next chapter', async () => {
    // Pinia store requires a DOM; create jsdom global.
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://x.test/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);

    // Pinia store setup
    setActivePinia(createPinia());

    const page1Url = 'http://23.225.121.247/ldks/111291/42509753.html';
    const page2Url = 'http://23.225.121.247/ldks/111291/42509753_2.html';
    const nextChapterUrl = 'http://23.225.121.247/ldks/111291/42509754.html';

    const page1Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="section-opt">
          <a href="/ldks/111291/42509752.html">上一章</a>
          <a href="/ldks/111291/">章节列表</a>
          <a href="/ldks/111291/42509753_2.html">下一页</a>
        </div>
        <div id="content" class="content">
          <h1 class="title">第二十一章 无妄之灾</h1>
          第二十一章 无妄之灾 (第1/2页)<br /><br />PAGE1<br /><br />（本章未完，请点击下一页继续阅读）
        </div>
      </body></html>
    `;

    const page2Html = `
      <!DOCTYPE html>
      <html><body>
        <div class="section-opt">
          <a href="/ldks/111291/42509753.html">上一页</a>
          <a href="/ldks/111291/">章节列表</a>
          <a href="/ldks/111291/42509754.html">下一章</a>
        </div>
        <div id="content" class="content">
          <h1 class="title">第二十一章 无妄之灾</h1>
          第二十一章 无妄之灾 (第2/2页)<br /><br />PAGE2
        </div>
      </body></html>
    `;

    // Stub GM_* storage APIs used by RuleStorage in tests (RuleManager initializes on parse()).
    // userscript global stub
    globalThis.GM_listValues = () => [];
    // userscript global stub
    globalThis.GM_getValue = <T>(_name: string, defaultValue?: T): T => defaultValue as T;
    // userscript global stub
    globalThis.GM_setValue = () => {};
    // userscript global stub
    globalThis.GM_deleteValue = () => {};

    // Mock GM_xmlhttpRequest used by fetchAndParseUrl inside reader store.
    const gm = vi.fn((opts: MockGmXhrOpts) => {
      const u = opts.url;
      const responseText = u === page2Url ? page2Html : page1Html;
      // Async like real XHR
      setTimeout(() => opts.onload({ status: 200, responseText }), 0);
      return { abort: () => {} };
    });

    // userscript global stub
    globalThis.GM_xmlhttpRequest = gm as unknown as typeof GM_xmlhttpRequest;

    const store = useReaderStore();

    // Simulate loading "next chapter" as page1Url (which has next=page2)
    // First set initial chapter to page1 with nextUrl=page2 (what parser would produce pre-merge).
    store.setChapter({
      title: '第二十一章 无妄之灾',
      bookTitle: '苟在初圣魔门当人材',
      content: 'init',
      rawContent: 'init',
      prevUrl: 'http://23.225.121.247/ldks/111291/42509752.html',
      nextUrl: page2Url,
      indexUrl: 'http://23.225.121.247/ldks/111291/',
      url: page1Url,
      confidence: 1,
      method: 'rule',
      rule: {
        id: 'ldks-2baoe',
        version: 1,
        match: { pattern: '.*' },
        content: { selector: '#content' },
        advanced: { checkSection: true },
        meta: { source: 'builtin' },
      },
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

    const last = store.chapters[store.chapters.length - 1]?.chapter;
    expect(last.url).toBe(page2Url.replace(/_2\.html$/i, '.html'));
    expect(last.nextUrl).toBe(nextChapterUrl);
    expect(last.content).toContain('PAGE1');
    expect(last.content).toContain('PAGE2');
  }, 15000);
});
