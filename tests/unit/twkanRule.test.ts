import { describe, expect, it, vi } from 'vitest';
import { twkanCanvasHtml, twkanCanvasLines } from '../testUtils/twkan';
import { JSDOM } from 'jsdom';

import { builtInRules } from '@/core/rules/builtInRules';
import { Parser } from '@/core/parser';
import { twkanRule } from '@/core/rules/sites/twkan';

function makeDoc(): Document {
  const url = 'https://twkan.com/txt/93181/53052605';
  const dom = new JSDOM(
    `
      <!doctype html>
      <html>
        <head>
          <title>第120章 進化〖暴龍獸〗！力量湧上來了！-誰說我做的魔法卡牌有問題？-作者-言情小說-台灣小說網</title>
        </head>
        <body>
          <div class="crumb">
            <a href="/">首頁</a>
            <a href="/book/93181/index.html">誰說我做的魔法卡牌有問題？</a>
          </div>
          <div class="topbar">
            <a href="/book/93181/index.html">書頁</a>
            <a href="/book/93181/index.html">目錄</a>
          </div>
          <div class="txtnav">
            <h1>第120章 進化〖暴龍獸〗！力量湧上來了！</h1>
            <p>第120章 進化〖暴龍獸〗！力量湧上來了！</p>
            <div id="txtcontent0">
              第120章 進化〖暴龍獸〗！力量湧上來了！<br>
              <br>
              決鬥場上的光芒正在匯聚。<br>
              <br>
              （請記住臺灣小説網，網址 twkan.com）<br>
              <br>
              〖分享給朋友一起看，請支持本站運營〗<br>
              <br>
              【写到这里我希望读者记一下我们域名 读台湾好书选台湾小说网，🆃🆆🅺🅰🅽.🅲🅾🅼超讚 】<br>
              <br>
              （请记住臺湾小説网→𝓉𝓌𝓀𝒶𝓃.𝒸ℴ𝓂网站，观看最快的章节更新）<br>
              <br>
              記住首發網站域名𝕥𝕨𝕜𝕒𝕟.𝕔𝕠𝕞<br>
              <br>
              暴龍獸在光中抬起頭，力量湧上來了。
            </div>
          </div>
          <div class="page1">
            <a href="/txt/93181/53052420">上一章</a>
            <a href="/book/93181/index.html">目錄</a>
            <a href="/txt/93181/53052783">下一章</a>
          </div>
        </body>
      </html>
    `,
    { url, pretendToBeVisual: true }
  );

  return dom.window.document;
}

describe('Twkan rule', () => {
  it('is auto-discovered as a site rule', () => {
    expect(builtInRules).toContain(twkanRule);
    expect(twkanRule.version).toBe(1);
    expect(
      new RegExp(twkanRule.match.pattern, 'i').test('https://twkan.com/txt/93181/53052605')
    ).toBe(true);
  });

  it('extracts chapter content, book title and navigation', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const url = 'https://twkan.com/txt/93181/53052605';
    const chapter = await new Parser().parse(makeDoc(), url);

    expect(chapter?.rule?.id).toBe('twkan');
    expect(chapter?.title).toBe('第120章 進化〖暴龍獸〗！力量湧上來了！');
    expect(chapter?.bookTitle).toBe('誰說我做的魔法卡牌有問題？');
    expect(chapter?.prevUrl).toBe('https://twkan.com/txt/93181/53052420');
    expect(chapter?.indexUrl).toBe('https://twkan.com/book/93181/index.html');
    expect(chapter?.nextUrl).toBe('https://twkan.com/txt/93181/53052783');

    const content = chapter?.content || '';
    expect(content).toContain('決鬥場上的光芒正在匯聚。');
    expect(content).toContain('暴龍獸在光中抬起頭');
    expect(content).not.toContain('2026-01-05');
    expect(content).not.toContain('作者');
    expect(content).not.toContain('第120章 進化〖暴龍獸〗！力量湧上來了！');
    expect(content).not.toContain('請記住臺灣小説網');
    expect(content).not.toContain('台湾好书');
    expect(content).not.toContain('章节更新');
    expect(content).not.toContain('域名');
    expect(content).not.toContain('𝕥𝕨𝕜𝕒𝕟');
    expect(content).not.toContain('支持本站運營');

    const parsedContent = makeDoc();
    parsedContent.body.innerHTML = content;
    const paragraphs = Array.from(parsedContent.querySelectorAll('p')).filter(paragraph =>
      /決鬥場|暴龍獸/.test(paragraph.textContent || '')
    );
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toBe('決鬥場上的光芒正在匯聚。');
    expect(paragraphs[1]?.textContent).toContain('暴龍獸在光中抬起頭');
    expect(
      Array.from(parsedContent.body.querySelector('div')?.childNodes || []).some(
        node => node.nodeType === 3 && !!node.nodeValue?.trim()
      )
    ).toBe(false);
  });

  it.each(['live', 'detached'])(
    'restores canvas text before cleanup in a %s document',
    async kind => {
      const source = makeDoc();
      source
        .querySelector('#txtcontent0')!
        .insertAdjacentHTML('beforeend', `<br>${twkanCanvasHtml}`);
      const doc =
        kind === 'live'
          ? source
          : new DOMParser().parseFromString(source.documentElement.outerHTML, 'text/html');
      const parser = new Parser();
      const chapter = await parser.parse(doc, 'https://twkan.com/txt/93181/53052605');
      expect(chapter).not.toBeNull();
      const content = doc.createElement('div');
      content.innerHTML = chapter!.content;
      const lines = Array.from(content.querySelectorAll('p'), p => p.textContent);
      expect(lines.slice(-twkanCanvasLines.length)).toEqual(twkanCanvasLines);
      expect(chapter!.content).not.toContain('canvas');
      expect(chapter!.rawContent).not.toContain('canvas');
      expect(chapter!.content).not.toContain('支持本站運營');
      expect(content.querySelector('約定')).toBeNull();
      // Closing restores readable host text, and manual re-entry must not duplicate it.
      expect(doc.querySelector('#txtcontent0')?.textContent).toContain(twkanCanvasLines[0]);
      const again = await parser.parse(doc, 'https://twkan.com/txt/93181/53052605');
      expect(again?.content).toBe(chapter!.content);
      expect(again?.rawContent).toBe(chapter!.rawContent);
    }
  );

  it('only decodes the site canvas inside the selected chapter container', async () => {
    const doc = makeDoc();
    doc.body.insertAdjacentHTML('beforeend', '<canvas class="sec-last" id="outside"></canvas>');
    const content = doc.querySelector('#txtcontent0')!;
    content.insertAdjacentHTML(
      'beforeend',
      `${twkanCanvasHtml}<canvas id="illustration"></canvas>`
    );
    await twkanRule.hooks!.beforeParse!(doc);
    expect(content.querySelector('canvas.sec-last')).toBeNull();
    expect(content.querySelector('#illustration')).not.toBeNull();
    expect(doc.querySelector('#outside')).not.toBeNull();

    // Older chapter markup uses .txtnav without #txtcontent0.
    content.removeAttribute('id');
    content.insertAdjacentHTML('beforeend', twkanCanvasHtml);
    await twkanRule.hooks!.beforeParse!(doc);
    expect(content.querySelector('canvas.sec-last')).toBeNull();

    doc.querySelector('.txtnav')!.remove();
    await twkanRule.hooks!.beforeParse!(doc);
    expect(doc.querySelector('#outside')).not.toBeNull();
  });

  it.each([
    ['missing payload', null, 'fixture-v1'],
    ['missing salt', 'AAAA', null],
    ['invalid base64', '!!!', 'fixture-v1'],
    ['invalid UTF-8', '/w==', 'fixture-v1'],
    ['empty text', 'LA==', 'fixture-v1'],
  ])(
    'rejects %s without publishing a partial chapter or mutating its source',
    async (_, data, salt) => {
      const doc = makeDoc();
      const content = doc.querySelector('#txtcontent0')!;
      content.insertAdjacentHTML('beforeend', twkanCanvasHtml + twkanCanvasHtml);
      const canvas = content.querySelectorAll('canvas')[1]!;
      if (data === null) canvas.removeAttribute('data-c');
      else canvas.setAttribute('data-c', data);
      if (salt === null) canvas.removeAttribute('data-v');
      else canvas.setAttribute('data-v', salt);
      const original = content.innerHTML;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await expect(
          new Parser().parse(doc, 'https://twkan.com/txt/93181/53052605')
        ).resolves.toBeNull();
        expect(content.innerHTML).toBe(original);
        expect(warn).toHaveBeenCalledWith('[Parser] beforeParse hook error:', expect.any(Error));
      } finally {
        warn.mockRestore();
      }
    }
  );
});
