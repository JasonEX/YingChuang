export const oopOrigin = 'https://www.oop.tw';
export const oopBookPath = '/abooka/a33080432a/';
export const oopIndexUrl = oopOrigin + oopBookPath;
export const oopChapterCount = 65;
export const oopChapterUrl = (chapter = 31, page = 1) =>
  `${oopOrigin}/areada/a33080432a/a${835869 + chapter}${page > 1 ? `_${page}` : ''}a.html`;

export function makeOopChapter(chapter = 31, page = 1, rendered = false): string {
  const tail = [`第${page}頁尾段。`, `第${page}頁終點😀。`];
  const paragraphs = tail
    .map(text => `<p>${rendered ? text : Array.from(text).reverse().join('')}</p>`)
    .join('');
  const prev = page === 1 ? oopChapterUrl(chapter - 1) : oopChapterUrl(chapter);
  const next = page === 1 ? oopChapterUrl(chapter, 2) : oopChapterUrl(chapter + 1);
  return `<!doctype html><html lang="zh"><head><title>山間行旅_第${chapter}章 山路${page > 1 ? '(第2頁)' : ''}免費閱讀-短篇小說</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head><body>
    <div class="book-title"><a href="${oopBookPath}">山間行旅</a></div>
    <h1 class="chapter-title">第${chapter}章 山路</h1>
    <article id="article" data-ct="2"${rendered ? ' style="font-size:18px"' : ''}>
      <p>【第${chapter}章 山路】</p><p>------------------------------------------</p>
      <p>第${page}頁起點。</p>${'<p>旅人沿著山間的小路向前走去，樹梢上傳來清脆的鳥鳴聲，遠處的晨霧逐漸散去。</p>'.repeat(30)}
      <p>請前往ｏｏｐ．ｔｗ閱讀本書最新內容</p>
      <div class="mid-content-ad"><p>廣告推薦文字</p></div>
      ${paragraphs}
    </article>
    <div class="reading-nav">
      <a id="prev_url" href="${chapter > 1 || page > 1 ? prev : oopIndexUrl}">上一${page === 1 ? '章' : '頁'}</a>
      <a id="info_url" href="${oopBookPath}">書頁/目錄</a>
      <select id="page-select"><option value="${oopChapterUrl(chapter)}"${page === 1 ? ' selected' : ''}>第 1 頁</option><option value="${oopChapterUrl(chapter, 2)}"${page === 2 ? ' selected' : ''}>第 2 頁</option></select>
      <a id="next_url" href="${chapter < oopChapterCount || page === 1 ? next : oopIndexUrl}">下一${page === 1 ? '頁' : '章'}</a>
    </div>
    <aside>推薦小說與 VIP 免廣告推廣</aside>
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var article = document.getElementById('article');
        article.style.fontSize = '18px';
        var count = parseInt(article.getAttribute('data-ct') || '0', 10);
        var paragraphs = article.querySelectorAll('p');
        if (count > 0 && paragraphs.length >= count) {
          for (var i = paragraphs.length - count; i < paragraphs.length; i++) {
            paragraphs[i].textContent = Array.from(paragraphs[i].textContent).reverse().join('');
          }
        }
      });
    </script>
    </body></html>`;
}

export function makeOopCatalog(page: number): string {
  const chapters = Array.from(
    { length: Math.min(30, oopChapterCount - (page - 1) * 30) },
    (_, index) => (page - 1) * 30 + index + 1
  );
  // The site swaps every fourth/fifth source entry and restores the visual order with CSS.
  for (let index = 3; index + 1 < chapters.length; index += 5) {
    [chapters[index], chapters[index + 1]] = [chapters[index + 1], chapters[index]];
  }
  const prev = page > 1 ? `<a href="${oopBookPath}?p=${page - 1}">‹ 上一頁</a>` : '';
  const next = page < 3 ? `<a href="${oopBookPath}?p=${page + 1}">下一頁 ›</a>` : '';
  return `<!doctype html><html><head><title>山間行旅-短篇小說</title></head><body>
    <h1 class="novel-title">山間行旅</h1>
    <a href="${oopChapterUrl()}">開始閱讀</a>
    <div class="chapter-list"><h2>最新章節</h2><a href="${oopChapterUrl(oopChapterCount)}">第${oopChapterCount}章 最新預覽</a></div>
    <div id="catalog-content"><div class="chapter-list"><h2>完整目錄</h2>
      <ul class="chapter-grid" id="ul_all_chapters">
        ${chapters.map(chapter => `<li class="chapter-item"><a href="${new URL(oopChapterUrl(chapter)).pathname}">第${chapter}章 山路</a></li>`).join('')}
        <li style="position:absolute;left:-9999px"><a href="/trap.php?book=308043">第999章 干擾連結</a></li>
      </ul>
      <div class="chap-pager chap-pager-bottom">${prev}${next}</div>
    </div></div>
    </body></html>`;
}
