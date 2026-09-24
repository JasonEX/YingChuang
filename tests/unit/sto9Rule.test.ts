import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { builtInRules } from '@/core/rules/builtInRules';
import { Parser } from '@/core/parser';
import { sto9Rule } from '@/core/rules/sites/sto9';

function makeDoc(): Document {
  const url = 'https://sto9.com/txt/7974/7627078.html';
  const dom = new JSDOM(
    `
      <!doctype html>
      <html lang="zh-Hant">
        <head>
          <title>三國：季漢兵仙從奇襲襄陽開始_第765章 生死存亡！|思兔sto9</title>
        </head>
        <body>
          <div class="bread">
            <a href="/">首頁</a>
            <a href="/book/7974/index.html">三國：季漢兵仙從奇襲襄陽開始</a>
          </div>
          <div class="txtnav">
            <h1>第765章 生死存亡！</h1>
            <div class="txtright">右側文字廣告</div>
            <div class="txtad">正文頂部廣告</div>
            &emsp;&emsp;城樓上的兩人看得清清楚楚。<br><br>
            &emsp;&emsp;守軍迅速調整部署，準備迎敵。
            <div class="txtcenter">章中廣告</div><br><br>
            &emsp;&emsp;將士們握緊兵器，守住房城。<br>
            &emsp;&emsp;（還有更新耶）
          </div>
          <div class="page1">
            <a href="/txt/7974/7626167.html">上一章</a>
            <a href="/book/7974/index.html">目錄</a>
            <a href="/txt/7974/7628065.html">下一章</a>
          </div>
        </body>
      </html>
    `,
    { url, pretendToBeVisual: true }
  );

  return dom.window.document;
}

const inlinePromotionVariants = [
  '獲取最新章節更新，請訪問🎈sto9.com',
  '看本書最新章節，請訪問sto9.c🎺om',
  's🎤to9.com為您提供最快的小說更新',
  'sto9.co☕️m最新最快的章節更新',
  '觀看最新章節訪問s🌶️to9.com',
  '最新小說章節盡在sto9.c🌠om',
  'sto9🐾.com提醒你可以閱讀最新章節啦',
  '實時更新，請訪問sto9.co💫m',
];

describe('Sto9 rule', () => {
  it('is auto-discovered as a site rule', () => {
    expect(builtInRules).toContain(sto9Rule);
    expect(new RegExp(sto9Rule.match.pattern, 'i').test(sto9Rule.meta?.exampleUrl || '')).toBe(
      true
    );
  });

  it('extracts clean content, title, book title and navigation', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const chapter = await new Parser().parse(makeDoc(), sto9Rule.meta?.exampleUrl);

    expect(chapter?.rule?.id).toBe('sto9');
    expect(chapter?.title).toBe('第765章 生死存亡！');
    expect(chapter?.bookTitle).toBe('三國：季漢兵仙從奇襲襄陽開始');
    expect(chapter?.prevUrl).toBe('https://sto9.com/txt/7974/7626167.html');
    expect(chapter?.indexUrl).toBe('https://sto9.com/book/7974/index.html');
    expect(chapter?.nextUrl).toBe('https://sto9.com/txt/7974/7628065.html');

    const content = chapter?.content || '';
    expect(content).toContain('城樓上的兩人看得清清楚楚。');
    expect(content).toContain('將士們握緊兵器，守住房城。');
    expect(content).not.toContain('第765章 生死存亡！');
    expect(content).not.toContain('文字廣告');
    expect(content).not.toContain('章中廣告');
    expect(content).not.toContain('還有更新耶');
  });

  it('treats the site end marker as the terminal chapter', async () => {
    const doc = makeDoc();
    doc.querySelector('.page1 a:last-child')?.setAttribute('href', '/txt/7974/end.html');

    const chapter = await new Parser().parse(doc, sto9Rule.meta?.exampleUrl);

    expect(chapter?.nextUrl).toBeUndefined();
  });

  it.each(inlinePromotionVariants)(
    'removes an emoji-obfuscated inline promotion: %s',
    async promotion => {
      const doc = makeDoc();
      doc.querySelector('.txtnav > h1')?.insertAdjacentText('afterend', promotion);

      const chapter = await new Parser().parse(doc, sto9Rule.meta?.exampleUrl);
      const normalized = (chapter?.content || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      expect(normalized).not.toContain('sto9com');
      expect(chapter?.content).toContain('城樓上的兩人看得清清楚楚。');
    }
  );

  it.each([
    ['获取最新章节更新，请访问st☕9.com', 'br'],
    ['獲取最新章節更新，請訪問st☕️9.com', 'p'],
    ['获取最新章节更新, 请访问 ST☕︎9.COM。', 'p'],
  ])('removes a standalone coffee-substituted promotion: %s (%s)', async (promotion, tag) => {
    const doc = makeDoc();
    const paragraph =
      tag === 'p' ? `<p>\u2003\u2003${promotion}</p>` : `<br><br>\u2003\u2003${promotion}<br><br>`;
    doc.querySelector('.txtnav')!.insertAdjacentHTML('beforeend', `${paragraph}援軍終於到了。`);
    const sourceHtml = doc.querySelector('.txtnav')!.innerHTML;

    const chapter = await new Parser().parse(doc, sto9Rule.meta?.exampleUrl);

    expect(chapter?.content).not.toContain(promotion);
    expect(chapter?.content).not.toContain('☕');
    expect(chapter?.content).toContain('將士們握緊兵器，守住房城。');
    expect(chapter?.content).toContain('援軍終於到了。');
    expect(doc.querySelector('.txtnav')!.innerHTML).toBe(sourceHtml);
  });

  it.each([
    '紙上寫著 st☕9.com，將士繼續趕路。',
    '他念道：「获取最新章节更新，请访问st☕9.com」。',
    '获取最新章节更新，请访问st☕9.com，這句話被他劃掉了。',
    '获取最新章节更新，请访问st9.com',
  ])('preserves prose and unconfirmed domain variants: %s', async prose => {
    const doc = makeDoc();
    doc.querySelector('.txtnav')!.insertAdjacentHTML('beforeend', `<p>${prose}</p>`);

    const chapter = await new Parser().parse(doc, sto9Rule.meta?.exampleUrl);

    expect(chapter?.content).toContain(prose);
  });
});
