import { createCipheriv } from 'node:crypto';

export const novelsOrigin = 'https://www.novels.com.tw';
export const novelsBookPath =
  '/novels/no689ecf9c709950ae5cadd90cff89ffd6257bf537a60d904c9e6084f4aa2c12ca/';
export const novelsUrl = (chapter = 21, page = 1) =>
  `${novelsOrigin}${novelsBookPath}${199107734 + chapter}${page > 1 ? `_${page}` : ''}.html?aid=1092650`;

export function encryptNovels(text: string): string {
  const cipher = createCipheriv('aes-128-cbc', 'WZc0cbzgY3lhz3X6', Buffer.alloc(16));
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}

export function makeNovelsChapter(chapter = 21, page = 1): string {
  const text = `<p>第${page}頁起點</p>${'<p>山間晨霧慢慢散去，旅人沿著石階走向山頂，遠處傳來清脆的鐘聲。</p>'.repeat(20)}<p>第${page}頁終點</p>`;
  // Match the public page's extra padding, escaped JSON string, and navigation DOM.
  const encrypted = JSON.stringify(encryptNovels(text + '\x08'.repeat(8))).replaceAll('/', '\\/');
  const next = page < 3 ? novelsUrl(chapter, page + 1) : novelsUrl(chapter + 1);
  const prev = page > 1 ? novelsUrl(chapter, page - 1) : novelsUrl(chapter - 1);
  return `<!doctype html><html><head><title>第${chapter}章 山間行旅|繁體小說</title></head><body>
    <div class="text_title"><h1>第${chapter}章 山間行旅（${page} / 3）</h1>
      <div class="text_info"><span><a href="${novelsBookPath}">山間行旅</a></span><span><a>作者</a></span></div></div>
    <article id="article" class="content"><div id="chapter-content"><script>window.encryptedContent = ${encrypted};</script>請前往www.novels.com.tw網站繼續全文閱讀</div></article>
    <div class="read_nav"><a id="prev_url" href="${prev}">上一${page === 1 ? '章' : '頁'}</a>
      <a id="info_url" href="${novelsBookPath}">書頁/目錄</a>
      <a id="next_url" href="https://ad.invalid/" data-real-href="${next}">下一${page === 3 ? '章' : '頁'}</a></div>
    </body></html>`;
}
