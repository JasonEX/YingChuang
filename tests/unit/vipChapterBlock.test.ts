/**
 * VIP chapter paging should be blocked with a toast instead of loading.
 */

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { isVipChapterPage } from '@/core/detection';
import { JSDOM } from 'jsdom';
import { useReaderStore } from '@/ui/stores/reader';

type MockGmXhrOpts = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  overrideMimeType?: string;
  onload: (resp: { status: number; responseText: string }) => void;
  onerror: (err: unknown) => void;
  onabort?: () => void;
  ontimeout: () => void;
};

describe('VIP chapter block', () => {
  it('does not pre-block Ciweimao encrypted chapter shells as VIP pages', () => {
    const doc = new JSDOM(
      `<!DOCTYPE html>
      <html><body>
        <div id="J_BookCnt" data-id="113914324"></div>
        <div id="J_BookRead"></div>
        <div class="dialog">本章为VIP章节，订阅后可阅读 <a>立即订阅</a></div>
      </body></html>`,
      { url: 'https://www.ciweimao.com/chapter/113914324' }
    ).window.document;

    expect(isVipChapterPage(doc)).toBe(false);
  });

  it('blocks VIP page on loadNextChapter and shows toast', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://x.test/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('Node', dom.window.Node);

    setActivePinia(createPinia());

    const currentUrl = 'https://example.com/book/1/1.html';
    const vipUrl = 'https://example.com/book/1/2.html';
    const vipHtml = `
      <!DOCTYPE html>
      <html><body>
        <div class="content">本章为VIP章节，订阅后可阅读</div>
        <a href="/buy">立即订阅</a>
      </body></html>
    `;

    const gm = vi.fn((opts: MockGmXhrOpts) => {
      setTimeout(() => opts.onload({ status: 200, responseText: vipHtml }), 0);
      return { abort: () => opts.onabort?.() };
    });

    // @ts-expect-error - userscript global stub
    globalThis.GM_xmlhttpRequest = gm;

    const store = useReaderStore();

    store.setChapter({
      title: '第1章',
      content: 'init',
      rawContent: 'init',
      nextUrl: vipUrl,
      url: currentUrl,
      confidence: 1,
      method: 'rule',
      rule: {
        id: 't',
        version: 1,
        match: { pattern: '.*' },
        content: { selector: 'body' },
        meta: { source: 'builtin' },
      },
    });

    const ok = await store.loadNextChapter();
    expect(ok).toBe(false);
    expect(store.chapters.length).toBe(1);
    expect(store.error).toBe('该章节为VIP/付费内容，无法加载');
    expect(store.hasNext).toBe(false);

    // Cancel pending toast timer so the test process can exit promptly.
    store.clearError();
  });
});
