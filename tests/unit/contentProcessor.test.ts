/**
 * Unit tests for ContentProcessor
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentProcessor } from '@/core/parser/ContentProcessor';
import { JSDOM } from 'jsdom';

describe('ContentProcessor', () => {
  let processor: ContentProcessor;
  let dom: JSDOM;
  let doc: Document;

  beforeEach(() => {
    processor = new ContentProcessor();
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    doc = dom.window.document;
    // Set global document for tests that need it
    vi.stubGlobal('document', doc);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const p = new ContentProcessor();
      const element = doc.createElement('div');
      element.innerHTML = '<p>Test content</p>';

      // Should process without errors
      const result = p.process(element, doc);
      expect(result).toContain('Test content');
    });

    it('should merge custom options with defaults', () => {
      const p = new ContentProcessor({
        removeAds: false,
        normalizeWhitespace: true,
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>手机用户请到m.example.com阅读</p>';

      // removeAds is false, so ad text should remain
      const result = p.process(element, doc);
      expect(result).toContain('手机用户请到');
    });
  });

  describe('process', () => {
    it('should return raw content (sanitized) when useRawContent is true', () => {
      processor.setOptions({ useRawContent: true });
      const element = doc.createElement('div');
      element.innerHTML = '<script>alert(1)</script><p>Content</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('<script>');
      expect(result).toContain('Content');
    });

    it('should fix common lazy-loaded images in raw content mode', () => {
      processor.setOptions({ useRawContent: true, fixImages: true });
      const element = doc.createElement('div');
      element.innerHTML =
        '<p>Text</p><img data-lazy-src="https://example.com/a.jpg" alt="a" /><img src="about:blank" data-original="https://example.com/b.jpg" alt="b" />';

      const result = processor.process(element, doc);

      expect(result).toContain('src="https://example.com/a.jpg"');
      expect(result).toContain('src="https://example.com/b.jpg"');
      expect(result).not.toContain('margin: 10px auto');
    });

    it('should keep protocol-relative and data:image lazy-loaded images in raw content mode', () => {
      processor.setOptions({ useRawContent: true, fixImages: true });
      const element = doc.createElement('div');
      element.innerHTML =
        '<img src="about:blank" data-original="//cdn.example.com/a.jpg" alt="a" />' +
        '<img src="about:blank" data-original="data:image/png;base64,AA==" alt="b" />';

      const result = processor.process(element, doc);

      expect(result).toContain('src="//cdn.example.com/a.jpg"');
      expect(result).toContain('src="data:image/png;base64,AA=="');
    });

    it('should keep content inside forbidden tags (e.g., unwrap form)', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<form action="/submit"><p>Form content</p></form>';

      const result = processor.process(element, doc);

      expect(result).toContain('Form content');
      expect(result).not.toContain('<form');
    });

    it('should remove unwanted elements like script and style', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <script>alert(1)</script>
        <style>.foo { color: red; }</style>
        <p>Real content</p>
      `;

      const result = processor.process(element, doc);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<style>');
      expect(result).toContain('Real content');
    });

    it('should remove ad elements by class', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <div class="ad">Sponsored</div>
        <div class="advertisement">Buy now!</div>
        <p>Real content</p>
      `;

      const result = processor.process(element, doc);

      expect(result).not.toContain('Sponsored');
      expect(result).not.toContain('Buy now!');
      expect(result).toContain('Real content');
    });

    it('should remove custom selectors when specified', () => {
      processor.setOptions({ removeSelectors: '.custom-ad, #banner' });
      const element = doc.createElement('div');
      element.innerHTML = `
        <div class="custom-ad">Custom ad</div>
        <div id="banner">Banner</div>
        <p>Content</p>
      `;

      const result = processor.process(element, doc);

      expect(result).not.toContain('Custom ad');
      expect(result).not.toContain('Banner');
      expect(result).toContain('Content');
    });

    it('should strip inline styles', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p style="color: red; font-size: 12px;">Styled text</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('style=');
      expect(result).toContain('Styled text');
    });

    it('should strip bgcolor attribute', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<table bgcolor="#ff0000"><tr><td>Cell</td></tr></table>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('bgcolor');
      expect(result).toContain('Cell');
    });

    it('should preserve inline styles when stripInlineStyles is false', () => {
      processor.setOptions({ stripInlineStyles: false });
      const element = doc.createElement('div');
      element.innerHTML = '<p style="color: red;">Styled text</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('style=');
    });

    it('should expand p_key encoded content and remove 加载更多 blockers', () => {
      const encodeBase64Utf8 = (value: string): string => {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        return dom.window.btoa(binary);
      };

      const hidden = '<p>隐藏正文一。</p><p>隐藏正文二。</p>';
      const pKey = encodeBase64Utf8(hidden);

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <p>阅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。</p>
              <p style="text-align:center;"><button>加|载|更|多</button></p>
            </div>
            <script>const p_key='${pKey}';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html);
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).toContain('隐藏正文一');
      expect(result).toContain('隐藏正文二');
      expect(result).not.toContain('加载更多');
      expect(result).not.toContain('无法显示本章节全部内容');
    });

    it('replaces truncated visible prefix with decoded p_key when head matches but tail is missing', () => {
      const decoded = `<p>${'前言'.repeat(40)}</p>` + `<p>${'结尾'.repeat(40)}</p>` + '<p>END</p>';
      const pKey = Buffer.from(decoded, 'utf8').toString('base64');
      const visiblePrefix = `前言`.repeat(40);

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>${visiblePrefix}</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key="${pKey}";</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('前言');
      expect(result).toContain('结尾');
      expect(result).toContain('END');
      expect(result).not.toContain('加载更多');
    });

    it('falls back to appending decoded text when insertAdjacentHTML fails', () => {
      const decoded = '<p>隐藏正文一。</p><p>隐藏正文二。</p>';
      const pKey = Buffer.from(decoded, 'utf8').toString('base64');

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key='${pKey}';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const insertSpy = vi
        .spyOn(dom.window.Element.prototype, 'insertAdjacentHTML')
        .mockImplementation(() => {
          throw new Error('insert failed');
        });

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).toContain('隐藏正文一');
      expect(result).toContain('隐藏正文二');

      insertSpy.mockRestore();
    });

    it('decodes p_key in Node fallback when atob is unavailable', () => {
      vi.stubGlobal('atob', undefined);
      const decoded = '<p>隐藏正文一。</p><p>隐藏正文二。</p>';
      const pKey = Buffer.from(decoded, 'utf8').toString('base64');

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key='${pKey}';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('隐藏正文一');
      expect(result).toContain('隐藏正文二');
    });

    it('does not expand load-more content when p_key is missing', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).not.toContain('隐藏正文');
    });

    it('falls back to Buffer decoding when atob throws', () => {
      vi.stubGlobal('atob', () => {
        throw new Error('boom');
      });

      const decoded = '<p>隐藏正文一。</p><p>隐藏正文二。</p>';
      const pKey = Buffer.from(decoded, 'utf8').toString('base64');

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key='${pKey}';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).toContain('隐藏正文一');
      expect(result).toContain('隐藏正文二');
      expect(result).not.toContain('加载更多');
    });

    it('ignores p_key when Buffer.from throws', () => {
      vi.stubGlobal('atob', undefined);

      const decoded = '<p>隐藏正文。</p>';
      const pKey = Buffer.from(decoded, 'utf8').toString('base64');

      const bufferSpy = vi.spyOn(Buffer, 'from').mockImplementation(() => {
        throw new Error('boom');
      });

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key='${pKey}';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).not.toContain('隐藏正文');

      bufferSpy.mockRestore();
    });

    it('ignores p_key when decoding fails (missing Buffer fallback)', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="content">
              <p>开头正文。</p>
              <a href="#">加载更多</a>
            </div>
            <script>const p_key='AA==';</script>
          </body>
        </html>
      `;

      dom = new JSDOM(html, { url: 'https://example.com/ch/1' });
      doc = dom.window.document;
      vi.stubGlobal('document', doc);

      vi.stubGlobal('atob', undefined);
      vi.stubGlobal('Buffer', undefined);

      const element = doc.querySelector('.content')!;
      const result = processor.process(element, doc);

      expect(result).toContain('开头正文');
      expect(result).not.toContain('隐藏正文');
    });

    it('should remove common reader toolbars/navigation mixed into content', () => {
      processor.setOptions({ chapterTitle: '第1256章 万宝' });
      const element = doc.createElement('div');
      element.innerHTML = `
        <h1>第1256章 万宝</h1>
        <div class="toolbar">
          <a href="#">投票推荐</a>
          <a href="#">加入书签</a>
          <a href="#">小说报错</a>
          <a href="#">关灯</a>
          <a href="#">字体-</a>
          <a href="#">字体+</a>
        </div>
        <div class="nav">
          <a href="#">上一章</a>
          <a href="#">目录</a>
          <a href="#">下一章</a>
        </div>
        <p>&emsp;&emsp;第1256章 万宝</p>
        <p>话音落下，天幕并没有丝毫变动。</p>
        <p>许久过后，他才微微点头：“善！”</p>
        <p>></p>
        <div class="nav">
          <a href="#">上一章</a>
          <a href="#">章节目录</a>
          <a href="#">下一章</a>
        </div>
        <div class="tips">
          温馨提示：按 回车[Enter]键 返回书目，按 ←键 返回上一页，按 →键 进入下一页，加入书签方便您下次继续阅读。
        </div>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('话音落下');
      expect(result).toContain('微微点头');
      expect(result).not.toContain('投票推荐');
      expect(result).not.toContain('加入书签');
      expect(result).not.toContain('小说报错');
      expect(result).not.toContain('关灯');
      expect(result).not.toContain('字体-');
      expect(result).not.toContain('字体+');
      expect(result).not.toContain('上一章');
      expect(result).not.toContain('下一章');
      expect(result).not.toContain('温馨提示');
      expect(result).not.toContain('第1256章');
      expect(result).not.toMatch(/<p>\s*(?:&gt;|>)\s*<\/p>/i);
    });

    it('removes keyboard-tip blocks even when only the 按 trigger exists', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <div>温馨提示：按键返回</div>
        <p>正文内容。</p>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('温馨提示');
    });

    it('removes toolbar/nav blocks when labels are plain text (no anchors)', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <div>上一章 目录 下一章</div>
        <div>投票推荐 加入书签 小说报错</div>
        <p>正文内容。</p>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('上一章');
      expect(result).not.toContain('投票推荐');
    });

    it('keeps non-UI clickables and does not treat plain 列表 as body content', () => {
      processor.setOptions({ chapterTitle: '第一章' });
      const element = doc.createElement('div');
      element.innerHTML = `
        <a href="#">列表</a>
        <a href="#">Hello</a>
        <p>正文内容开始。</p>
      `;

      const result = processor.process(element, doc);
      expect(result).toContain('正文内容开始');
      expect(result).toContain('Hello');
      expect(result).not.toContain('列表');
    });
  });

  describe('processToText', () => {
    it('should return plain text content', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Paragraph 1</p><p>Paragraph 2</p>';

      const result = processor.processToText(element);

      expect(result).toContain('Paragraph 1');
      expect(result).toContain('Paragraph 2');
      expect(result).not.toContain('<p>');
    });

    it('should remove script content', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Text</p><script>alert(1)</script>';

      const result = processor.processToText(element);

      expect(result).toContain('Text');
      expect(result).not.toContain('alert');
    });

    it('should remove ad patterns from text', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容。手机用户请到m.test.com阅读。继续阅读。</p>';

      const result = processor.processToText(element);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('手机用户请到');
    });
  });

  describe('removeAdPatterns', () => {
    it('should remove section navigation hints', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容（本章未完，请点击下一页继续阅读）更多内容</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('本章未完');
      expect(result).toContain('更多内容');
    });

    it('should remove page number indicators', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容（第1/5页）</p><p>第2/5页</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('第1/5页');
      expect(result).not.toContain('第2/5页');
    });

    it('should remove orphan parentheses', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容（ ）剩余内容</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('（ ）');
    });

    it('should remove site ad patterns', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <p>正文内容</p>
        <p>请记住本书首发域名网址</p>
        <p>百度搜索本书名最新章节</p>
        <p>天才一秒记住</p>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('请记住本书');
      expect(result).not.toContain('百度搜索');
      expect(result).not.toContain('天才一秒记住');
    });

    it('removes the 1qxs collection banner without matching ordinary prose', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <p>【放下血仇？那我逢魔时王白当了？】小说免费阅读，请收藏\u3000一七小说【1qxs.com】</p>
        <p>她把“请收藏”写进留言，然后继续阅读这本小说。</p>
      `;

      const result = processor.process(element, doc);

      expect(result).not.toContain('一七小说');
      expect(result).not.toContain('1qxs.com');
      expect(result).toContain('她把“请收藏”写进留言，然后继续阅读这本小说。');
    });

    it('repairs confirmed anti-copy glyph substitutions without rewriting valid words', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>如果伱愿意，我们就继续往前走。</p><p>澹台去勐海看桉树和莪蒿。</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('如果你愿意，我们就继续往前走。');
      expect(result).not.toContain('伱');
      expect(result).toContain('澹台去勐海看桉树和莪蒿。');
    });

    it('removes styled domain ads by their cue without normalizing ordinary text', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <p>第一段正文。</p>
        <p>记住首发网站域名𝕥𝕨𝕜𝕒𝕟.𝕔𝕠𝕞</p>
        <p>請記住網址：𝓉𝓌𝓀𝒶𝓃.𝒸ℴ𝓂，更新最快。</p>
        <p>請記住網址：🆃🆆🅺🅰🅽.🅲🅾🅼，更新最快。</p>
        <p>正文中的数学符号 𝕥 和示例域名𝕥𝕨𝕜𝕒𝕟.𝕔𝕠𝕞应保持原样。</p>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('第一段正文。');
      expect(result).toContain('数学符号 𝕥 和示例域名𝕥𝕨𝕜𝕒𝕟.𝕔𝕠𝕞应保持原样');
      expect(result).not.toContain('首发网站域名');
      expect(result).not.toContain('更新最快');
      expect(result.match(/𝕥𝕨𝕜𝕒𝕟/g)).toHaveLength(1);
      expect(result).not.toContain('𝓉𝓌𝓀𝒶𝓃');
      expect(result).not.toContain('🆃🆆🅺🅰🅽');
    });

    it('should remove URLs', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>访问 https://example.com 或 www.test.com 获取更多</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('https://');
      expect(result).not.toContain('www.test.com');
    });

    it('should not remove ad patterns when removeAds is false', () => {
      processor.setOptions({ removeAds: false });
      const element = doc.createElement('div');
      element.innerHTML = '<p>手机用户请到m.test.com阅读</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('手机用户请到');
    });
  });

  describe('normalizeWhitespace', () => {
    it('should remove empty paragraphs', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Content</p><p>   </p><p>More</p>';

      const result = processor.process(element, doc);

      expect(result).not.toMatch(/<p>\s*<\/p>/);
    });

    it('should normalize multiple spaces', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Multiple    spaces    here</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('    ');
    });

    it('should remove leading/trailing whitespace in paragraphs', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>   Padded content   </p>';

      const result = processor.process(element, doc);

      expect(result).not.toMatch(/<p>\s+Padded/);
      expect(result).not.toMatch(/content\s+<\/p>/);
    });

    it('should preserve whitespace when normalizeWhitespace is false', () => {
      processor.setOptions({ normalizeWhitespace: false });
      const element = doc.createElement('div');
      element.innerHTML = '<p>Multiple    spaces</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('Multiple    spaces');
    });
  });

  describe('fixImages', () => {
    it('preserves existing src images and centers them by default', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Text</p><img src="https://example.com/existing.jpg" />';

      const result = processor.process(element, doc);

      // Images with existing src should be preserved and have centering styles added
      expect(result).toContain('example.com/existing.jpg');
      expect(result).toContain('margin: 10px auto');
    });

    it('fixes placeholder src like data:/javascript:/vbscript: via common lazy attributes', () => {
      const element = doc.createElement('div');
      element.innerHTML =
        '<p>Text</p>' +
        '<img src="data:image/png;base64,AA==" data-original="https://example.com/a.jpg" />' +
        '<img src="javascript:alert(1)" data-src="https://example.com/b.jpg" />' +
        '<img src="vbscript:msgbox(1)" data-url="https://example.com/c.jpg" />';

      const result = processor.process(element, doc);

      expect(result).toContain('src="https://example.com/a.jpg"');
      expect(result).toContain('src="https://example.com/b.jpg"');
      expect(result).toContain('src="https://example.com/c.jpg"');
    });

    it('does not fix images when fixImages is false', () => {
      processor.setOptions({ fixImages: false });
      const element = doc.createElement('div');
      element.innerHTML =
        '<p>Text</p><img src="about:blank" data-src="https://example.com/image.jpg" />';

      const result = processor.process(element, doc);

      // Should not have src from data-src when fixImages is false
      expect(result).toContain('data-src="https://example.com/image.jpg"');
      expect(result).not.toMatch(/\ssrc="https:\/\/example\.com\/image\.jpg"/);
    });
  });

  describe('convertBrToParagraphs', () => {
    it('should convert multiple br tags to paragraph breaks', () => {
      const element = doc.createElement('div');
      element.innerHTML = '\u2003\u2003Line 1<br><br>\u3000\u3000Line 2<br><br>Line 3';

      const result = processor.process(element, doc);
      const container = doc.createElement('div');
      container.innerHTML = result;
      const visibleNodes = Array.from(container.childNodes).filter(
        node => node.nodeType !== 3 || !!node.nodeValue?.trim()
      );

      expect(visibleNodes).toHaveLength(3);
      expect(
        visibleNodes.every(node => node instanceof doc.defaultView!.HTMLParagraphElement)
      ).toBe(true);
      expect(
        Array.from(container.querySelectorAll('p'), paragraph => paragraph.textContent)
      ).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('wraps bare text next to existing block content without leaving direct text nodes', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<h2>Title</h2><div class="content">First line<br><br>Second line</div>';

      const result = processor.process(element, doc);
      const container = doc.createElement('div');
      container.innerHTML = result;
      const content = container.querySelector('.content');
      const visibleNodes = Array.from(content?.childNodes || []).filter(
        node => node.nodeType !== 3 || !!node.nodeValue?.trim()
      );

      expect(visibleNodes.map(node => (node as Element).tagName)).toEqual(['P', 'P']);
      expect(content?.textContent).toContain('First line');
      expect(content?.textContent).toContain('Second line');
    });

    it('splits br-delimited prose already wrapped in a paragraph', () => {
      const element = doc.createElement('div');
      element.innerHTML = [
        '<p id="source-paragraph" class="chapter-prose">',
        '\u00a0\u00a0\u00a0\u00a0First line<strong> with emphasis</strong><br>',
        '\u00a0\u00a0\u00a0\u00a0Second line<br>',
        '\u3000\u3000Third line',
        '</p>',
      ].join('');

      const result = processor.process(element, doc);
      const container = doc.createElement('div');
      container.innerHTML = result;
      const paragraphs = Array.from(container.querySelectorAll('p.chapter-prose'));

      expect(paragraphs.map(paragraph => paragraph.textContent)).toEqual([
        'First line with emphasis',
        'Second line',
        'Third line',
      ]);
      expect(paragraphs.every(paragraph => !paragraph.querySelector('br'))).toBe(true);
      expect(paragraphs[0].querySelector('strong')?.textContent).toBe(' with emphasis');
      expect(paragraphs.map(paragraph => paragraph.id)).toEqual(['source-paragraph', '', '']);
    });

    it('preserves intentional line breaks without prose indentation', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p class="verse">First verse<br><em>Second verse</em></p>';

      const result = processor.process(element, doc);
      const container = doc.createElement('div');
      container.innerHTML = result;
      const paragraph = container.querySelector('p.verse');

      expect(container.querySelectorAll('p.verse')).toHaveLength(1);
      expect(paragraph?.querySelector('br')).not.toBeNull();
      expect(paragraph?.querySelector('em')?.textContent).toBe('Second verse');
    });

    it('preserves list structure while normalizing surrounding prose', () => {
      const element = doc.createElement('div');
      element.innerHTML = 'Intro<br><br><ul><li>One</li><li>Two</li></ul>';

      const result = processor.process(element, doc);
      const container = doc.createElement('div');
      container.innerHTML = result;

      expect(container.querySelector('p')?.textContent).toBe('Intro');
      expect(Array.from(container.querySelectorAll('ul > li'), item => item.textContent)).toEqual([
        'One',
        'Two',
      ]);
      expect(container.querySelector('ul > p')).toBeNull();
    });

    it('should wrap content in paragraphs if not already wrapped', () => {
      const element = doc.createElement('div');
      element.innerHTML = 'Plain text without paragraphs';

      const result = processor.process(element, doc);

      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
    });
  });

  describe('cleanDuplicateInfo', () => {
    it.each(['第53章 春游与打猎', '第53章 春游与打猎1'])(
      'removes complete section title lines for %s without touching prose',
      chapterTitle => {
        processor.setOptions({ chapterTitle });
        const element = doc.createElement('div');
        element.innerHTML = [
          '第53章 春游与打猎第(1/2)页<br>',
          '正文开始。<br><br>',
          '她翻到第(1/2)页，夹上书签。<br><br>',
          '他念道：“第53章 春游与打猎第(1/2)页”。<br><br>',
          '第53章 春游与打猎第(1/2)页,点击下一页继续阅读。<br>',
          '<p><a href="javascript:addBookMarkByManual(1,2)">『加入书签，方便阅读』</a></p>',
        ].join('');

        const result = doc.createElement('div');
        result.innerHTML = processor.process(element, doc);

        expect(Array.from(result.querySelectorAll('p'), p => p.textContent?.trim())).toEqual([
          '正文开始。',
          '她翻到第(1/2)页，夹上书签。',
          '他念道：“第53章 春游与打猎第(1/2)页”。',
        ]);
        expect(element.textContent).toContain('点击下一页继续阅读');
        expect(element.querySelector('a')).not.toBeNull();
      }
    );

    it('keeps unrelated titles, title numbers and unmarked title mentions', () => {
      processor.setOptions({ chapterTitle: '第53章 春游与打猎21' });
      const element = doc.createElement('div');
      element.innerHTML = [
        '<p>正文开始。</p>',
        '<p>第54章 春游与打猎第(1/2)页</p>',
        '<p>第53章 春游与打猎第(1/2)页</p>',
        '<p>第53章 春游与打猎21</p>',
        '<p>她写下“加入书签，方便阅读”，然后离开。</p>',
      ].join('');

      expect(processor.process(element, doc)).toBe(element.innerHTML);
    });

    it('cleans full-width section title lines even when ad removal is disabled', () => {
      processor.setOptions({ chapterTitle: '第53章 春遊與打獵', removeAds: false });
      const element = doc.createElement('div');
      element.innerHTML =
        '<p>正文開始。</p><p>第53章 春遊與打獵第（1／2）頁，點擊下一頁繼續閱讀。</p>' +
        '<p><button>「加入書籤，方便閱讀」</button></p>';

      expect(processor.process(element, doc)).toBe('<p>正文開始。</p>');
    });

    it('should remove duplicate chapter title at start', () => {
      processor.setOptions({ chapterTitle: '第一章 新的开始' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>第一章 新的开始</p><p>正文内容开始了...</p>';

      const result = processor.process(element, doc);

      // Should only contain one instance of chapter title pattern
      expect(result).toContain('正文内容开始');
    });

    it('should remove chapter number pattern at start', () => {
      processor.setOptions({ chapterTitle: '第一章 测试' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>第一章</p><p>正文内容</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
    });

    it('removes near-duplicate title lines using fuzzy match', () => {
      processor.setOptions({ chapterTitle: '第1256章 天幕并没有丝毫变动' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>第1256章 天幕并没有絲毫变动</p>' + '<p>正文内容开始。</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容开始');
      expect(result).not.toContain('絲毫');
    });

    it('removes near-duplicate book title lines using fuzzy match', () => {
      processor.setOptions({ bookTitle: '元婴修仙传' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>元婴修仙傳</p><p>正文内容</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('元婴修仙傳');
    });

    it('removes an exact combined book/chapter fingerprint without deleting later prose', () => {
      const bookTitle = '放下血仇？那我逢魔时王白当了？';
      const chapterTitle = '第75章 一切的幕后黑手就是白辰！';
      processor.setOptions({ bookTitle, chapterTitle });
      const element = doc.createElement('div');
      element.innerHTML = [
        '<p>第一段正文。</p>',
        `<p>${bookTitle}${chapterTitle}</p>`,
        `<p>众人正在追查“${chapterTitle}”所说的幕后黑手。</p>`,
        `<p>书架上仍然写着《${bookTitle}》。</p>`,
      ].join('');

      const result = processor.process(element, doc);

      expect(result).not.toContain(`${bookTitle}${chapterTitle}`);
      expect(result).toContain(`“${chapterTitle}”所说的幕后黑手`);
      expect(result).toContain(`《${bookTitle}》`);
    });

    it('keeps later正文 paragraphs that mention the chapter title core', () => {
      processor.setOptions({ chapterTitle: '第49章 通天箓' });
      const element = doc.createElement('div');
      element.innerHTML = [
        '<p>公元2020年。</p>',
        '<p>他停顿了一下，一字一顿地说出那个名字：</p>',
        '<p>“其名为——通天箓！”</p>',
        '<p>段星炼和周六晴咀嚼着这个有些陌生的名字：</p>',
        '<p>“通天箓？”</p>',
        '<p>“这些知识对于你们来说，是必须的。”</p>',
        '<p>“如果你们不学习拓扑的知识就强行修炼通天箓。</p>',
      ].join('');

      const result = processor.process(element, doc);

      expect(result).toContain('“其名为——通天箓！”');
      expect(result).toContain('“通天箓？”');
      expect(result).toContain('强行修炼通天箓');
    });

    it('removes generic chapter title patterns even without chapterTitle', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>第12章</p><p>正文内容</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('第12章');
    });

    it('should remove author line', () => {
      processor.setOptions({ chapterTitle: '第一章' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>作者：测试作者</p><p>正文内容</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toContain('作者：');
    });

    it('should remove trailing markers (text at end of content)', () => {
      const element = doc.createElement('div');
      // Trailing marker pattern works on raw text at end, not in paragraphs
      element.innerHTML = '<p>正文内容</p>本章完';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      // Note: The trailing pattern /\s*本章完\s*$/i matches text at end of HTML string
      // When content is wrapped in <p> tags, the marker may not be at the actual end
    });

    it('should remove trailing dividers', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容</p><p>---</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).not.toMatch(/---\s*$/);
    });
  });

  describe('applyReplaceRules', () => {
    it('should apply custom replace rules', () => {
      processor.setOptions({
        replaceRules: [{ pattern: '旧词', replacement: '新词', flags: 'g' }],
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>这里有旧词需要替换</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('新词');
      expect(result).not.toContain('旧词');
    });

    it('removes ad text produced by replace rules', () => {
      processor.setOptions({
        replaceRules: [
          { pattern: '广告占位', replacement: '手机用户请到m.test.com阅读', flags: 'g' },
        ],
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容 广告占位 后续正文</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('正文内容');
      expect(result).toContain('后续正文');
      expect(result).not.toContain('广告占位');
      expect(result).not.toContain('手机用户请到');
    });

    it('should apply multiple replace rules', () => {
      processor.setOptions({
        replaceRules: [
          { pattern: 'A', replacement: 'X', flags: 'g' },
          { pattern: 'B', replacement: 'Y', flags: 'g' },
        ],
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>A and B</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('X');
      expect(result).toContain('Y');
      expect(result).not.toContain('>A<');
    });

    it('should handle regex patterns', () => {
      processor.setOptions({
        replaceRules: [{ pattern: '\\d+', replacement: 'NUM', flags: 'g' }],
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>Test 123 and 456</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('NUM');
      expect(result).not.toContain('123');
    });

    it('should skip invalid regex patterns gracefully', () => {
      processor.setOptions({
        replaceRules: [
          { pattern: '[invalid', replacement: 'X', flags: 'g' }, // Invalid regex
          { pattern: 'valid', replacement: 'VALID', flags: 'g' },
        ],
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>valid content</p>';

      const result = processor.process(element, doc);

      // Should still process valid rule
      expect(result).toContain('VALID');
    });

    it('should reuse cached regex across multiple process calls', () => {
      const rules = [{ pattern: '\\d+', replacement: 'NUM', flags: 'g' }];
      processor.setOptions({ replaceRules: rules });

      const regexCache = (processor as unknown as { regexCache: Map<string, RegExp | null> })
        .regexCache;

      const el1 = doc.createElement('div');
      el1.innerHTML = '<p>Test 111</p>';
      processor.process(el1, doc);

      expect(regexCache.size).toBe(1);

      const el2 = doc.createElement('div');
      el2.innerHTML = '<p>Test 222</p>';
      const result2 = processor.process(el2, doc);

      expect(result2).toContain('NUM');
      expect(regexCache.size).toBe(1);
    });

    it('should clear regex cache when setOptions is called', () => {
      processor.setOptions({
        replaceRules: [{ pattern: 'old', replacement: 'OLD', flags: 'g' }],
      });

      const el1 = doc.createElement('div');
      el1.innerHTML = '<p>old text new text</p>';
      const result1 = processor.process(el1, doc);
      expect(result1).toContain('OLD');
      expect(result1).toContain('new text');

      // Change rules — cache should be cleared
      processor.setOptions({
        replaceRules: [{ pattern: 'new', replacement: 'NEW', flags: 'g' }],
      });

      const el2 = doc.createElement('div');
      el2.innerHTML = '<p>old text new text</p>';
      const result2 = processor.process(el2, doc);
      expect(result2).toContain('old text');
      expect(result2).toContain('NEW');
    });

    it('should cache null for invalid regex and skip on subsequent calls', () => {
      processor.setOptions({
        replaceRules: [
          { pattern: '[invalid', replacement: 'X', flags: 'g' },
          { pattern: 'good', replacement: 'GOOD', flags: 'g' },
        ],
      });

      const el1 = doc.createElement('div');
      el1.innerHTML = '<p>good [invalid content</p>';
      const result1 = processor.process(el1, doc);
      expect(result1).toContain('GOOD');
      expect(result1).toContain('[invalid');

      // Second call should also safely skip the invalid pattern
      const el2 = doc.createElement('div');
      el2.innerHTML = '<p>good [invalid again</p>';
      const result2 = processor.process(el2, doc);
      expect(result2).toContain('GOOD');
      expect(result2).toContain('[invalid');
    });
  });

  describe('smartQueryAll', () => {
    it('should handle :eq(n) selector', () => {
      processor.setOptions({ removeSelectors: 'p:eq(1)' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>First</p><p>Second</p><p>Third</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('First');
      expect(result).not.toContain('Second');
      expect(result).toContain('Third');
    });

    it('should handle negative :eq(-1) selector', () => {
      processor.setOptions({ removeSelectors: 'p:eq(-1)' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>First</p><p>Second</p><p>Third</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('First');
      expect(result).toContain('Second');
      expect(result).not.toContain('Third');
    });

    it('should handle :first selector', () => {
      processor.setOptions({ removeSelectors: 'p:first' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>First</p><p>Second</p>';

      const result = processor.process(element, doc);

      expect(result).not.toContain('First');
      expect(result).toContain('Second');
    });

    it('should handle :last selector', () => {
      processor.setOptions({ removeSelectors: 'p:last' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>First</p><p>Second</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('First');
      expect(result).not.toContain('Second');
    });

    it('should handle :contains("text") selector', () => {
      processor.setOptions({ removeSelectors: 'p:contains("广告")' });
      const element = doc.createElement('div');
      element.innerHTML = '<p>正文内容</p><p>这是广告内容</p><p>更多内容</p>';

      const result = processor.process(element, doc);

      // smartQueryAll handles :contains by filtering elements that contain the text
      expect(result).toContain('正文内容');
      expect(result).not.toContain('这是广告内容');
      expect(result).toContain('更多内容');
    });

    it('should handle chained :contains selectors', () => {
      processor.setOptions({ removeSelectors: 'div:contains("广告"):contains("点击")' });
      const element = doc.createElement('div');
      element.innerHTML = `
        <div><span>这是广告</span></div>
        <div><span>广告点击这里</span></div>
        <div><span>正文内容</span></div>
      `;

      const result = processor.process(element, doc);

      // The div containing both "广告" and "点击" should be removed
      expect(result).toContain('这是广告'); // Only contains one keyword
      expect(result).not.toContain('广告点击'); // Contains both keywords
      expect(result).toContain('正文内容');
    });

    it('handles invalid base selectors in :eq/:first/:last/:contains without throwing', () => {
      processor.setOptions({
        removeSelectors:
          '[invalid:eq(0), [invalid:first, [invalid:last, [invalid:contains("x"), :invalid(',
      });
      const element = doc.createElement('div');
      element.innerHTML = '<p>Keep me</p>';

      expect(() => processor.process(element, doc)).not.toThrow();
    });
  });

  describe('setOptions', () => {
    it('should update options', () => {
      processor.setOptions({ removeAds: false });
      const element = doc.createElement('div');
      element.innerHTML = '<p>手机用户请到m.test.com阅读</p>';

      const result = processor.process(element, doc);

      expect(result).toContain('手机用户请到');
    });

    it('should apply partial options over constructor defaults', () => {
      const p = new ContentProcessor({ removeAds: true, normalizeWhitespace: true });
      p.setOptions({ removeAds: false });

      const element = doc.createElement('div');
      element.innerHTML = '<p>手机用户请到m.test.com阅读    with spaces</p>';

      const result = p.process(element, doc);

      // removeAds should be false now
      expect(result).toContain('手机用户请到');
      // normalizeWhitespace should still be true
      expect(result).not.toContain('    ');
    });

    it('should not carry transient options into the next setOptions call', () => {
      processor.setOptions({ useRawContent: true, removeAds: false });

      const rawElement = doc.createElement('div');
      rawElement.innerHTML = '<p>正文内容。手机用户请到m.test.com阅读。</p>';
      expect(processor.process(rawElement, doc)).toContain('手机用户请到');

      processor.setOptions({ chapterTitle: '第1章 测试' });

      const cleanElement = doc.createElement('div');
      cleanElement.innerHTML = '<p>正文内容。手机用户请到m.test.com阅读。继续阅读。</p>';
      const result = processor.process(cleanElement, doc);

      expect(result).not.toContain('手机用户请到');
      expect(result).toContain('正文内容');
    });
  });

  describe('edge cases', () => {
    it('should handle empty element', () => {
      const element = doc.createElement('div');
      element.innerHTML = '';

      const result = processor.process(element, doc);

      expect(result).toBe('');
    });

    it('should handle element with only whitespace', () => {
      const element = doc.createElement('div');
      element.innerHTML = '   \n\n\t  ';

      const result = processor.process(element, doc);

      // Should not throw and should return cleaned result
      expect(typeof result).toBe('string');
    });

    it('should not modify original element', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<script>alert(1)</script><p>Content</p>';
      const originalHtml = element.innerHTML;

      processor.process(element, doc);

      expect(element.innerHTML).toBe(originalHtml);
    });

    it('should handle deeply nested elements', () => {
      const element = doc.createElement('div');
      element.innerHTML = `
        <div>
          <div>
            <div>
              <p>Deep content</p>
              <script>alert(1)</script>
            </div>
          </div>
        </div>
      `;

      const result = processor.process(element, doc);

      expect(result).toContain('Deep content');
      expect(result).not.toContain('<script>');
    });

    it('should handle malformed HTML gracefully', () => {
      const element = doc.createElement('div');
      element.innerHTML = '<p>Unclosed paragraph<div>Nested div</p></div>';

      // Should not throw
      const result = processor.process(element, doc);
      expect(typeof result).toBe('string');
    });
  });
});
