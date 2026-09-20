// Reduced DOM from the live 2wxsl desktop/responsive and Kudushu mobile pages.
// Keep the repeated preview/start link and pager placement: those caused the
// catalog to move chapter 1 and the latest chapters away from their real order.
export const pagedCatalogSites = [
  {
    id: 'wxsl',
    origin: 'http://www.2wxsl.com',
    chapterPath: (chapter: number): string => `/book/132139/${50722791 + chapter}.html`,
    tocPath: (page: number): string =>
      page === 1 ? '/book/132139/' : `/book/132139/index_${page}.html`,
  },
  {
    id: 'kudushu',
    origin: 'https://m.kudushu.org',
    chapterPath: (chapter: number): string => `/html/1088392/${146537086 + chapter}/`,
    tocPath: (page: number): string =>
      page === 1 ? '/book/1088392/' : `/html/1088392/asc-${page}/`,
  },
] as const;

export type PagedCatalogSite = (typeof pagedCatalogSites)[number];
export const catalogChapterCount = 46;
export const catalogPageCount = 3;

export function makePagedCatalog(site: PagedCatalogSite, page: number): string {
  const links = (numbers: number[]): string =>
    numbers
      .map(chapter => `<li><a href="${site.chapterPath(chapter)}">第${chapter}章 测试正文</a></li>`)
      .join('');
  const latest = links([46, 45, 44, 43, 42, 41, 40, 39]);
  const main = links(
    Array.from(
      { length: Math.min(20, catalogChapterCount - (page - 1) * 20) },
      (_, i) => (page - 1) * 20 + i + 1
    )
  );
  const pager = `<div class="listpage">
    ${page > 1 ? `<a href="${site.tocPath(page - 1)}">上一页</a>` : '<a>上一页</a>'}
    <select name="pageselect">${[1, 2, 3]
      .map(
        p =>
          `<option value="${site.tocPath(p)}" ${p === page ? 'selected' : ''}>第${(p - 1) * 20 + 1} - ${p * 20}章</option>`
      )
      .join('')}</select>
    ${page < catalogPageCount ? `<a href="${site.tocPath(page + 1)}">下一页</a>` : '<a>下一页</a>'}
  </div>`;
  const outside = `<div class="info"><a href="${site.chapterPath(1)}">开始阅读</a></div>`;
  const lists =
    site.id === 'wxsl'
      ? `<div class="row-section"><div class="layout-col1">
          <h2 class="layout-tit">最新章节</h2>
          <div class="section-box"><ul class="section-list">${latest}</ul></div>
          <h2 class="layout-tit">正文</h2>
          <div class="section-box"><ul class="section-list">${main}</ul></div>
          ${pager}
        </div></div>`
      : `<div class="info_menu1"><h3>最新章节预览</h3>
          <div class="list_xm"><ul>${latest}</ul></div></div>
        <div class="info_menu1"><h3>正文</h3>
          <div class="conterpic"></div><div class="rightpic"></div>
          <div class="list_xm"><ul>${main}</ul>${pager}</div></div>`;
  return `<!doctype html><html><head><title>测试书名目录</title></head><body>
    ${outside}${lists}<aside><a href="/book/999999/123.html">第1章 其他书推荐</a></aside>
  </body></html>`;
}

export function makePagedCatalogChapter(site: PagedCatalogSite, chapter: number): string {
  const contentId = site.id === 'wxsl' ? 'content' : 'novelcontent';
  return `<!doctype html><html><head><title>第${chapter}章 测试正文_测试书名</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
    ${site.id === 'kudushu' ? `<div class="content_top"><a href="${site.tocPath(1)}">返回书页</a></div>` : ''}
    <h1>第${chapter}章 测试正文</h1>
    <nav><a href="${site.chapterPath(chapter - 1)}">上一章</a>
      <a href="${site.tocPath(1)}">${site.id === 'wxsl' ? '章节列表' : '返&nbsp;回&nbsp;目&nbsp;录'}</a>
      <a href="${site.chapterPath(chapter + 1)}">下一章</a></nav>
    <div id="${contentId}">${'<p>山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。</p>'.repeat(60)}</div>
  </body></html>`;
}
