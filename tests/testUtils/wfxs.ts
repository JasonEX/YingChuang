export const wfxsOrigin = 'https://m.wfxs.tw';
export const wfxsBookId = '9074406';
export const wfxsChapterUrl = (chapter: number) =>
  `${wfxsOrigin}/xiaoshuo/${wfxsBookId}/${chapter}/`;
export const wfxsIndexUrl = `${wfxsOrigin}/booklist/${wfxsBookId}.html`;

export function wfxsChapter(chapter: number): string {
  return `<!doctype html><html><head><title>测试之旅_第${chapter}章 山间_在线阅读 - 微風小說網</title></head><body>
    <div class="h_header"><h2>测试之旅</h2><a href="/xiaoshuo/${wfxsBookId}/">简介</a></div>
    <header><h1 class="title">第${chapter}章 山间</h1></header>
    <div id="read_conent_box" class="entry">${Array.from({ length: 24 }, (_, i) => `<p>第${chapter}章正文${i}。山间清风吹过树林，旅人沿着小路走向远方。${'这是独立编写的测试正文。'.repeat(10)}</p>`).join('')}</div>
    <div class="page"><ul><li><a href="${wfxsChapterUrl(chapter - 1)}">上一章</a></li><li><a href="${wfxsIndexUrl}">目錄</a></li><li><a href="${wfxsChapterUrl(chapter + 1)}">下一章</a></li></ul></div>
    <aside><h2>猜你喜歡</h2><a href="https://other.example/">广告推荐文字</a></aside>
    </body></html>`;
}

export function wfxsCatalog(page: number): string {
  return `<!doctype html><html><body><h2>测试之旅</h2><a href="${wfxsChapterUrl(999)}">第999章 最新预览</a>
    <ul id="html_box">${Array.from({ length: 3 }, (_, i) => {
      const chapter = (page - 1) * 3 + i + 1;
      return `<li><a href="${wfxsChapterUrl(chapter)}">第${chapter}章 山间</a></li>`;
    }).join('')}</ul>
    <div class="sort"><a href="/booklist/${wfxsBookId}/1_1.html">倒序</a>
    ${[1, 2, 3].map(n => `<a href="/booklist/${wfxsBookId}/${n}.html">${(n - 1) * 3 + 1}~${n * 3}章</a>`).join('')}</div>
    </body></html>`;
}
