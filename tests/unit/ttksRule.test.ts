import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { builtInRules } from '@/core/rules/builtInRules';
import { Parser } from '@/core/parser';
import { ttksRule } from '@/core/rules/sites/ttks';

const url = 'https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/83.html';

function makeDoc(options: { shortChapter?: boolean } = {}): Document {
  const title = options.shortChapter ? '求點月票！' : '第82章 真黑袍（求月票）';
  const body = options.shortChapter
    ? `
      <p>${title}</p>
      <p>如題，兄弟們，雙倍月票最後一天了，不要留在手機了呀！</p>
      <p>問道在此跪求一波月票！</p>
      <p>&gt;</p>
    `
    : `
      <p>${title}</p>
      <p>第一段正文。\u3000\u3000【寫到這裡我希望讀者記一下我們域名 天天看小說超貼心，𝗍𝗍𝗄𝗌.𝗍𝗐等你尋 】</p>
      <p>第二段正文。</p>
      <p>第三段正文。\u3000\u3000（由於緩存原因，請用戶直接瀏覽器訪問 追書認準天天看小說，ᴛᴛᴋs.ᴛᴡ超讚 網站，觀看最快的章節更新）</p>
      <p>結尾正文。</p>
      <p>福</p>
    `;
  const dom = new JSDOM(
    `
      <!doctype html>
      <html>
        <head><title>⚡ 《開局相親女神捕，獲獨孤九劍》 ${title} - ⚡ 天天看小說</title></head>
        <body>
          <div class="frame_body">
            <div class="breadcrumb_nav">
              <a href="/">首頁</a>
              <a href="/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/index.html">《開局相親女神捕，獲獨孤九劍》</a>
            </div>
            <div class="title"><h1>${title}</h1></div>
            <div class="content">
              <a class="anchor_bookmark" href="/bookmark">書籤圖示</a>
              <div class="txtcenter">loadAdv(1, 0);</div>
              ${body}
              <div class="txtcenter">loadAdv(3, 0);</div>
              <div class="div_feedback">添加書籤 返回目錄 章節報錯</div>
              <div class="social_share_frame">分享給朋友</div>
            </div>
            <div class="content">
              <a id="linkPrev" href="82.html">上一章</a>
              <a id="linkNext" href="84.html">下一章</a>
            </div>
          </div>
        </body>
      </html>
    `,
    { url }
  );

  return dom.window.document;
}

describe('TTKS rule', () => {
  it('preserves interior short paragraphs and formatting while removing a noisy tail', async () => {
    const doc = makeDoc();
    const content = doc.querySelector('.frame_body > .title + .content')!;
    content.innerHTML =
      '<p><em>开头。</em></p><p>福</p><p></p><p>正文。（本書首發天天看小說）</p>' +
      '<p>福</p><p> </p><p>（本書首發天天看小說）</p><p>&gt;</p>';
    await ttksRule.hooks!.beforeParse!(doc, url);
    expect(content.innerHTML).toBe('<p><em>开头。</em></p><p>福</p><p></p><p>正文。</p>');
  });

  it('is auto-discovered and matches numeric chapter pages only', () => {
    expect(builtInRules).toContain(ttksRule);
    expect(ttksRule.version).toBe(1);

    const pattern = new RegExp(ttksRule.match.pattern, 'i');
    expect(pattern.test(url)).toBe(true);
    expect(
      pattern.test('https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/index.html')
    ).toBe(false);
  });

  it('extracts navigation and removes inline and trailing site noise', async () => {
    const chapter = await new Parser().parse(makeDoc(), url);

    expect(chapter?.rule?.id).toBe('ttks');
    expect(chapter?.method).toBe('rule');
    expect(chapter?.title).toBe('第82章 真黑袍（求月票）');
    expect(chapter?.bookTitle).toBe('《開局相親女神捕，獲獨孤九劍》');
    expect(chapter?.prevUrl).toBe(
      'https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/82.html'
    );
    expect(chapter?.indexUrl).toBe(
      'https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/index.html'
    );
    expect(chapter?.nextUrl).toBe(
      'https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/84.html'
    );

    const content = chapter?.content || '';
    expect(content).toContain('第一段正文。');
    expect(content).toContain('第二段正文。');
    expect(content).toContain('第三段正文。');
    expect(content).toContain('結尾正文。');
    expect(content).not.toContain('天天看小說');
    expect(content).not.toContain('緩存原因');
    expect(content).not.toContain('loadAdv');
    expect(content).not.toContain('書籤圖示');
    expect(content).not.toContain('添加書籤');
    expect(content).not.toContain('分享給朋友');
    expect(content).not.toContain('福');
  });

  it('parses short author notes that generic detection rejects', async () => {
    const detected = await new Parser({ forceDetection: true }).parse(
      makeDoc({ shortChapter: true }),
      url
    );
    const chapter = await new Parser().parse(makeDoc({ shortChapter: true }), url);

    expect(detected).toBeNull();
    expect(chapter?.rule?.id).toBe('ttks');
    expect(chapter?.title).toBe('求點月票！');
    expect(chapter?.content).toContain('雙倍月票最後一天');
    expect(chapter?.content).toContain('問道在此跪求一波月票');
    expect(chapter?.content).not.toContain('&gt;');
  });

  it('uses browser-backed iframe loading for subsequent chapters', () => {
    expect(ttksRule.advanced?.useIframe).toBe(true);
    expect(ttksRule.advanced?.noSection).toBe(true);
  });
});
