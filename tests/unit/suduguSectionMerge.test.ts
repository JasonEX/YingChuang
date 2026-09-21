/**
 * Unit tests for sudugu (速读谷) multi-page chapter merge on initial launch/manual enable.
 */

import { describe, expect, it, vi } from 'vitest';
import { AutoEnableManager } from '@/core/AutoEnableManager';
import { JSDOM } from 'jsdom';

type MockGmXhrOpts = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  overrideMimeType?: string;
  onload: (resp: { status: number; responseText: string }) => void;
  onerror: (err: unknown) => void;
  ontimeout: () => void;
  onabort?: () => void;
};

describe('sudugu section merge', () => {
  it('should normalize to first page and merge -2/-3/-4 into one chapter, with correct prev/next', async () => {
    const page1Url = 'https://www.shudugu.org/2/1512467.html';
    const page2Url = 'https://www.shudugu.org/2/1512467-2.html';
    const page3Url = 'https://www.shudugu.org/2/1512467-3.html';
    const page4Url = 'https://www.shudugu.org/2/1512467-4.html';
    const prevChapterUrl = 'https://www.shudugu.org/2/1512466.html';
    const nextChapterUrl = 'https://www.shudugu.org/2/1570962.html';

    // Start on a later section page (common when user opens from search result / reading history).
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: page2Url });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);

    // Stub GM_* storage APIs used by RuleManager/RuleStorage.
    // userscript global stub
    globalThis.GM_listValues = () => [];
    // userscript global stub
    globalThis.GM_getValue = <T>(_name: string, defaultValue?: T): T => defaultValue as T;
    // userscript global stub
    globalThis.GM_setValue = () => {};
    // userscript global stub
    globalThis.GM_deleteValue = () => {};

    const makeHtml = (nav: string, contentToken: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <title>苟在初圣魔门当人材 第1229章 见司祟！-速读谷</title>
        </head>
        <body>
          <div class="container">
            <div class="submenu">
              <h1><a href="/2/">苟在初圣魔门当人材</a> &gt; 第1229章 见司祟！</h1>
            </div>
            <div class="con">
              <p>第1229章 见司祟！</p>
              <p>${contentToken} ${'这是一段用于测试分页合并的正文。'.repeat(80)}</p>
            </div>
            ${nav}
          </div>
        </body>
      </html>
    `;

    const page1Html = makeHtml(
      `<div class="prenext"><span><a href="/2/1512466.html">上一章</a></span><a href="/2/#dir">目录</a><span><a href="/2/1512467-2.html">下一页</a></span></div>`,
      'PAGE1_CONTENT'
    );
    const page2Html = makeHtml(
      `<div class="prenext"><span><a href="/2/1512467.html">上一页</a></span><a href="/2/#dir">目录</a><span><a href="/2/1512467-3.html">下一页</a></span></div>`,
      'PAGE2_CONTENT'
    );
    const page3Html = makeHtml(
      `<div class="prenext"><span><a href="/2/1512467-2.html">上一页</a></span><a href="/2/#dir">目录</a><span><a href="/2/1512467-4.html">下一页</a></span></div>`,
      'PAGE3_CONTENT'
    );
    const page4Html = makeHtml(
      `<div class="prenext"><span><a href="/2/1512467-3.html">上一页</a></span><a href="/2/#dir">目录</a><span><a href="/2/1570962.html">下一章</a></span></div>`,
      'PAGE4_CONTENT'
    );

    // Mock GM_xmlhttpRequest used by AutoEnableManager.fetchUrl.
    const gm = vi.fn((opts: MockGmXhrOpts) => {
      const u = opts.url;
      let responseText = page2Html;
      if (u === page1Url) responseText = page1Html;
      if (u === page2Url) responseText = page2Html;
      if (u === page3Url) responseText = page3Html;
      if (u === page4Url) responseText = page4Html;
      setTimeout(() => opts.onload?.({ status: 200, responseText }), 0);
      return { abort: () => opts.onabort?.() };
    });

    // userscript global stub
    globalThis.GM_xmlhttpRequest = gm as unknown as typeof GM_xmlhttpRequest;

    let launched: import('@/core/parser').ParsedChapter | null = null;
    const manager = new AutoEnableManager({ enableProtection: false });
    manager.setLaunchCallback(event => {
      // Progressive merging also emits the partial first page; only the merged chapter counts.
      if (event.stage === 'complete') launched = event.chapter;
      return update => {
        if (update.stage === 'complete') launched = update.chapter;
      };
    });

    await manager.manualEnable(dom.window.document);

    expect(launched).not.toBeNull();
    const chapter = launched as import('@/core/parser').ParsedChapter | null;
    if (!chapter) throw new Error('reader did not launch');
    expect(chapter.url).toBe(page1Url);
    expect(chapter.prevUrl).toBe(prevChapterUrl);
    expect(chapter.nextUrl).toBe(nextChapterUrl);
    expect(chapter.content).toContain('PAGE1_CONTENT');
    expect(chapter.content).toContain('PAGE2_CONTENT');
    expect(chapter.content).toContain('PAGE3_CONTENT');
    expect(chapter.content).toContain('PAGE4_CONTENT');
  });
});
