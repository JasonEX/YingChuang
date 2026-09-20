/**
 * VIP chapter paging should be blocked with a toast instead of loading.
 */

import { chapterShellSelector, isVipChapterPage } from '@/core/detection';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { ciweimaoRule } from '@/core/rules/sites/ciweimao';
import { JSDOM } from 'jsdom';
import { qidianMobileRule } from '@/core/rules/sites/qidian';
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
  it('treats a rule content container without subscription copy as a chapter shell', () => {
    // Ciweimao ships an empty, JavaScript-filled shell next to a subscription dialog. The
    // container is empty on purpose, so "has text" cannot be the discriminator — what proves
    // this is a chapter is that the VIP copy lives outside the rule's content container.
    const doc = new JSDOM(
      `<!DOCTYPE html>
      <html><body>
        <div id="J_BookCnt" data-id="113914324"></div>
        <div id="J_BookRead"></div>
        <div class="dialog">本章为VIP章节，订阅后可阅读 <a>立即订阅</a></div>
      </body></html>`,
      { url: 'https://www.ciweimao.com/chapter/113914324' }
    ).window.document;

    expect(isVipChapterPage(doc, { chapterShellSelector: '#J_BookRead' })).toBe(false);
    // Without a matched rule there is nothing to prove the shell, so the generic heuristic wins.
    expect(isVipChapterPage(doc)).toBe(true);
  });

  it('still blocks when the subscription copy sits inside the content container', () => {
    const doc = new JSDOM(
      `<!DOCTYPE html>
      <html><body>
        <div id="J_BookRead">本章为VIP章节，订阅后可阅读</div>
      </body></html>`,
      { url: 'https://www.ciweimao.com/chapter/113914324' }
    ).window.document;

    expect(isVipChapterPage(doc, { chapterShellSelector: '#J_BookRead' })).toBe(true);
  });

  it('ignores a degenerate body selector so a real paywall is not whitelisted', () => {
    const doc = new JSDOM(
      `<!DOCTYPE html>
      <html><body><div class="content">本章为VIP章节，订阅后可阅读</div></body></html>`,
      { url: 'https://example.com/book/1/2.html' }
    ).window.document;

    expect(isVipChapterPage(doc, { chapterShellSelector: 'body' })).toBe(true);
  });

  it('only exempts rules that opted into the chapter-shell escape hatch', () => {
    // Qidian's locked chapters look the opposite way round: preview prose sits *inside*
    // main[id^="c-"] and the 登录订阅本章 notice is a sibling. Inferring the exemption from
    // any content selector would let a paid preview through as a normal chapter.
    const qidianLocked = new JSDOM(
      `<!doctype html><html><body>
        <main id="c-711273151" class="lock-mask"><p>两三句预览正文……</p></main>
        <p>登录订阅本章: 16点</p>
      </body></html>`,
      { url: 'https://m.qidian.com/chapter/1234/711273151/' }
    ).window.document;

    expect(qidianMobileRule.advanced?.lazyChapterShell).toBeUndefined();
    expect(chapterShellSelector(qidianMobileRule)).toBeUndefined();
    expect(
      isVipChapterPage(qidianLocked, {
        chapterShellSelector: chapterShellSelector(qidianMobileRule),
      })
    ).toBe(true);

    // Ciweimao opts in, so the same call shape clears its encrypted shell.
    expect(ciweimaoRule.advanced?.lazyChapterShell).toBe(true);
    expect(chapterShellSelector(ciweimaoRule)).toBe('#J_BookRead');
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
