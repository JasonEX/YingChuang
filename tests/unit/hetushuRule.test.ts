import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { builtInRules } from '@/core/rules/builtInRules';
import { hetushuRule } from '@/core/rules/sites/hetushu';
import { Parser } from '@/core/parser';

function makeDoc(): Document {
  const url = 'https://www.hetushu.com/book/9145/6567989.html';
  const dom = new JSDOM(
    `
      <!doctype html>
      <html>
        <head>
          <title>木叶：让宇智波再次伟大_第一章 还不如不激活呢_和图书</title>
          <style>
            #content .shown { display: block; }
            #content .noise { display: none; }
          </style>
        </head>
        <body>
          <div id="left"><h3><a href="/book/9145/">木叶：让宇智波再次伟大</a></h3></div>
          <a id="pre" href="/book/9145/6567988.html">上一章</a>
          <a id="next" href="/book/9145/6567990.html">下一章</a>
          <div id="content">
            <h2>第一章 还不如不激活呢</h2>
            <div id="second" class="shown">第二段正文<acronym>www.hetushu.com</acronym></div>
            <div id="first" class="shown">第一段正文</div>
            <div id="hidden" class="noise">隐藏广告</div>
          </div>
        </body>
      </html>
    `,
    { url, pretendToBeVisual: true }
  );

  return dom.window.document;
}

describe('Hetushu rule', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is auto-discovered as a site rule', () => {
    expect(builtInRules).toContain(hetushuRule);
    expect(hetushuRule.version).toBe(3);
    expect(
      new RegExp(hetushuRule.match.pattern, 'i').test(
        'https://www.hetushu.com/book/9145/6567989.html'
      )
    ).toBe(true);
  });

  it('keeps visible paragraphs and removes watermark tags', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const chapter = await new Parser().parse(makeDoc(), url);

    expect(chapter?.rule?.id).toBe('hetushu');
    expect(chapter?.title).toContain('第一章');
    expect(chapter?.bookTitle).toBe('木叶：让宇智波再次伟大');
    expect(chapter?.prevUrl).toBe('https://www.hetushu.com/book/9145/6567988.html');
    expect(chapter?.nextUrl).toBe('https://www.hetushu.com/book/9145/6567990.html');
    expect(chapter?.indexUrl).toBe('https://www.hetushu.com/book/9145/');

    const content = chapter?.content || '';
    expect(content).toContain('第一段正文');
    expect(content).toContain('第二段正文');
    expect(content).not.toContain('隐藏广告');
    expect(content).not.toContain('hetushu.com');
  });

  it('loads external visibility rules before filtering paragraphs', async () => {
    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const dom = new JSDOM(
      '<!doctype html><html><head><link rel="stylesheet" href="/command/section.css"></head>' +
        '<body><div id="left"><h3>测试书名</h3></div><div id="content"><h2>第一章</h2>' +
        '<div class="shown">外部样式标记的正文</div>' +
        '<div class="noise">外部样式隐藏的干扰内容</div></div></body></html>',
      { url, pretendToBeVisual: true }
    );
    const fetchMock = vi.fn(
      async () =>
        new Response('#content .shown{display:block}#content .noise{display:none}', {
          status: 200,
        })
    );
    vi.stubGlobal('GM_xmlhttpRequest', undefined);
    vi.stubGlobal('fetch', fetchMock);

    const chapter = await new Parser().parse(dom.window.document, url);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.hetushu.com/command/section.css',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(chapter?.content).toContain('外部样式标记的正文');
    expect(chapter?.content).not.toContain('外部样式隐藏的干扰内容');
  });

  it('waits for the live page to restore substep paragraph order', async () => {
    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const dom = new JSDOM(
      '<!doctype html><html><head><style>#content .shown{display:block}</style></head>' +
        '<body data-randomtype="substep"><div id="left"><h3>测试书名</h3></div>' +
        '<div id="content"><div class="mask"></div><h2>第一章</h2>' +
        '<div id="second">第二段正文</div><div id="first">第一段正文</div></div></body></html>',
      { url, pretendToBeVisual: true }
    );
    const contentEl = dom.window.document.querySelector('#content');
    const first = dom.window.document.querySelector('#first');
    const second = dom.window.document.querySelector('#second');

    dom.window.setTimeout(() => {
      contentEl?.querySelector('.mask')?.remove();
      first?.classList.add('shown');
      second?.classList.add('shown');
      if (first && second) contentEl?.append(first, second);
    }, 10);

    const parser = new Parser();
    const chapter = await parser.parse(dom.window.document, url);
    const parsedContent = chapter?.content || '';

    expect(parsedContent.indexOf('第一段正文')).toBeLessThan(parsedContent.indexOf('第二段正文'));

    const reparsed = await parser.parse(dom.window.document, url);
    expect((reparsed?.content || '').indexOf('第一段正文')).toBeLessThan(
      (reparsed?.content || '').indexOf('第二段正文')
    );
  });

  it('waits for the live page to restore a temporarily detached content container', async () => {
    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const dom = new JSDOM(
      '<!doctype html><html><head><style>#content .shown{display:block}</style></head>' +
        '<body data-randomtype="substep"><div id="left"><h3>测试书名</h3></div></body></html>',
      { url, pretendToBeVisual: true }
    );

    dom.window.setTimeout(() => {
      const contentEl = dom.window.document.createElement('div');
      contentEl.id = 'content';
      contentEl.innerHTML = '<h2>第一章</h2><div class="shown">延迟出现的正文</div>';
      dom.window.document.body.appendChild(contentEl);
    }, 10);

    const chapter = await new Parser().parse(dom.window.document, url);

    expect(chapter?.content).toContain('延迟出现的正文');
  });

  it('recovers when the live page removes its mask without restoring paragraph order', async () => {
    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const dom = new JSDOM(
      '<!doctype html><html><body data-randomtype="substep">' +
        '<div id="left"><h3>测试书名</h3></div><div id="content"><h2>第一章</h2>' +
        '<div>第二段正文</div><div>第一段正文</div></div></body></html>',
      { url, pretendToBeVisual: true }
    );
    const token = dom.window.btoa('1A%0');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204, headers: { token } }))
    );

    const chapter = await new Parser().parse(dom.window.document, url);
    const parsedContent = chapter?.content || '';

    expect(parsedContent.indexOf('第一段正文')).toBeLessThan(parsedContent.indexOf('第二段正文'));
  });

  it('restores substep order from the token header for detached documents', async () => {
    const url = 'https://www.hetushu.com/book/9145/6567989.html';
    const dom = new JSDOM('', { url });
    const doc = new dom.window.DOMParser().parseFromString(
      '<!doctype html><html><head><link rel="stylesheet" href="/unused.css"></head>' +
        '<body data-randomtype="substep">' +
        '<div id="left"><h3>测试书名</h3></div><div id="content"><div class="mask"></div>' +
        '<h2>第一章</h2><div>第二段正文</div><div>第一段正文</div></div></body></html>',
      'text/html'
    );
    const token = dom.window.btoa('1A%0');
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 204,
          headers: { token },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const chapter = await new Parser().parse(doc, url);
    const parsedContent = chapter?.content || '';

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.hetushu.com/book/9145/r6567989.json',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parsedContent).toContain('第一段正文');
    expect(parsedContent).toContain('第二段正文');
    expect(parsedContent.indexOf('第一段正文')).toBeLessThan(parsedContent.indexOf('第二段正文'));
  });

  it('still loads visibility CSS when only some rows have an explicit mapping', async () => {
    const doc = new DOMParser().parseFromString(
      '<link rel="stylesheet" href="/visibility.css"><div id="content">' +
        '<p data-mnr-hetushu-visible="true">映射确认的正文。</p>' +
        '<div class="shown">依赖样式的正文。</div><div class="noise">隐藏干扰。</div></div>',
      'text/html'
    );
    const fetchText = vi.fn(async () => {
      // A live renderer may replace rows while the stylesheet request is pending.
      doc.querySelector('.shown')!.outerHTML = '<div class="shown">等待期间更新的正文。</div>';
      return '#content .shown{display:block}#content .noise{display:none}';
    });
    await hetushuRule.hooks!.beforeParse!(doc, 'https://www.hetushu.com/book/1/2.html', {
      fetchText,
      fetchJson: vi.fn(),
    });
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(doc.querySelector('#content')?.textContent).toBe('映射确认的正文。等待期间更新的正文。');
  });
});
