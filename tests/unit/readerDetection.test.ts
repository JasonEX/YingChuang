import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { detectTocPage, isInvalidChapterUrl } from '@/ui/stores/reader/detection';
import { getChapterDocumentBlockReason, isVipChapterPage } from '@/core/detection';

describe('Reader detection utilities', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('isInvalidChapterUrl detects obvious non-chapter URLs', () => {
    expect(isInvalidChapterUrl('https://example.com/')).toBe(true);
    expect(isInvalidChapterUrl('https://example.com/login')).toBe(true);
    expect(isInvalidChapterUrl('https://example.com/412421_1.html')).toBe(false);
  });

  it('isInvalidChapterUrl matches non-chapter sections only as whole path segments', () => {
    expect(isInvalidChapterUrl('https://example.com/search.php')).toBe(true);
    expect(isInvalidChapterUrl('https://example.com/author/12')).toBe(true);
    expect(
      isInvalidChapterUrl(
        'https://author.example.com/12/345.html',
        'https://author.example.com/12/344.html'
      )
    ).toBe(false);
    expect(
      isInvalidChapterUrl(
        'https://example.com/novel/helpful-hero/chapter-12',
        'https://example.com/novel/helpful-hero/chapter-11'
      )
    ).toBe(false);
    expect(
      isInvalidChapterUrl(
        'https://example.com/novel/about.time/chapter-12',
        'https://example.com/novel/about.time/chapter-11'
      )
    ).toBe(false);
    expect(isInvalidChapterUrl('https://example.com/b/12/tagline-3.html')).toBe(false);
  });

  it('detectTocPage ignores English TOC keywords embedded in ordinary words', () => {
    const prose = `<p>${'He checked the protocol and the photocopy in the catalogue. '.repeat(20)}</p>`;
    expect(detectTocPage(prose, 'https://e.com/n/1/2.html', 'https://e.com/n/1/1.html')).toBe(
      false
    );
    expect(
      detectTocPage(
        '<p>Table of Contents</p> <p>Index</p>',
        'https://e.com/n/1/2.html',
        'https://e.com/n/1/1.html'
      )
    ).toBe(true);
  });

  it('isInvalidChapterUrl rejects cross-host URLs when currentChapterUrl is provided', () => {
    expect(
      isInvalidChapterUrl('https://other.example.com/chapter/1', 'https://example.com/chapter/2')
    ).toBe(true);
  });

  it('isVipChapterPage detects VIP/locked chapter pages via body text', () => {
    const doc = new JSDOM('<!doctype html><html><body>本章为VIP章节，订阅后可阅读</body></html>')
      .window.document;
    expect(isVipChapterPage(doc)).toBe(true);
  });

  it('isVipChapterPage detects VIP pages via CTA text when body signals VIP', () => {
    const doc = new JSDOM(
      '<!doctype html><html><body><div>VIP专区</div><a href="/buy">立即订阅</a></body></html>'
    ).window.document;
    expect(isVipChapterPage(doc)).toBe(true);
  });

  it('classifies a Qidian subscription preview without treating short free notes as VIP', () => {
    const locked = new JSDOM(`<!doctype html><html><body>
      <main id="c-711273151" class="lock-mask"><p>两三句预览正文……</p></main>
      <p>登录订阅本章: 16点</p>
      <script>{"chapterInfo":{"isVip":1,"isBuy":0,"price":16,"vipStatus":1}}</script>
    </body></html>`).window.document;
    const freeNote = new JSDOM(`<!doctype html><html><body>
      <main id="c-713171483"><p>卷中感言，谢谢大家。</p></main>
      <script>{"chapterInfo":{"isVip":1,"isBuy":1,"price":0,"vipStatus":1}}</script>
    </body></html>`).window.document;

    expect(getChapterDocumentBlockReason(locked)).toBe('vip');
    expect(getChapterDocumentBlockReason(freeNote)).toBeNull();
  });

  it('detectTocPage detects TOC via URL patterns', () => {
    expect(
      detectTocPage(
        '<div>xx</div>',
        'https://example.com/book/123.html',
        'https://example.com/chapter/1.html'
      )
    ).toBe(true);
  });

  it('detectTocPage detects link-heavy short pages', () => {
    const links = Array.from(
      { length: 12 },
      (_, i) => `<a href="/chapter/${i}.html">第${i}章</a>`
    ).join('');
    const content = `<div>${links}</div>`;
    expect(
      detectTocPage(content, 'https://example.com/dir.html', 'https://example.com/chapter/1.html')
    ).toBe(true);
  });

  it('detectTocPage returns false for typical chapter content', () => {
    const content = `<article>
      <h1>第1章</h1>
      <p>${'正文'.repeat(300)}</p>
      <a href="/chapter/2.html">下一章</a>
    </article>`;

    expect(
      detectTocPage(
        content,
        'https://example.com/chapter/1.html',
        'https://example.com/chapter/1.html'
      )
    ).toBe(false);
  });
});
