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

// Reduced mobile DOM from m.bqg5.com: every page repeats the start link and
// latest five chapters before the main list.
export function makeBqg5Catalog(page: number): string {
  const chapterPath = (chapter: number): string => `/4_4581/${2196145 + chapter}.html`;
  const link = (chapter: number, numbered = false): string =>
    `<p><a href="${chapterPath(chapter)}">${numbered ? `${chapter}、` : ''}第${chapter}章 正文</a></p>`;
  const latest = [203, 202, 201, 200, 199].map(chapter => link(chapter)).join('');
  const first = (page - 1) * 20 + 1;
  const main = Array.from({ length: Math.min(20, 204 - first) }, (_, i) =>
    link(first + i, true)
  ).join('');
  const options = Array.from({ length: 11 }, (_, i) => {
    const number = i + 1;
    return `<option value="index_${number}.html" ${number === page ? 'selected' : ''}>${
      i * 20 + 1
    } - ${(i + 1) * 20}章</option>`;
  }).join('');
  return `<html><body>
    <div class="synopsisArea"><a href="${chapterPath(203)}">第203章 正文</a>
      <a href="${chapterPath(1)}">开始阅读</a></div>
    <div class="recommend"><h2>最新免费章节</h2><div class="directoryArea">${latest}</div>
      <h2>正文 共203章</h2><div class="directoryArea">${main}
        <div class="listpage"><select name="pageselect">${options}</select>
          ${page < 11 ? `<a href="index_${page + 1}.html">下一页</a>` : '<a>下一页</a>'}
        </div>
      </div>
    </div>
  </body></html>`;
}

export function makeBqg5Chapter(chapter: number): string {
  const chapterPath = (number: number): string => `/4_4581/${2196145 + number}.html`;
  return `<html><head><title>第${chapter}章 正文_测试书名</title></head><body>
    <h1>第${chapter}章 正文</h1><nav>
      <a href="${chapterPath(chapter - 1)}">上一章</a>
      <a href="/4_4581/">目录</a>
      <a href="${chapterPath(chapter + 1)}">下一章</a>
    </nav>
    <div id="content">${'<p>山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。</p>'.repeat(130)}</div>
  </body></html>`;
}

// Preserve the live chapter template: body#read, no h1, page suffix in the
// document title, br-delimited prose and navigation labelled 下一章 even for page 2.
export function makeBqg5Section(chapter: number, section: number): string {
  const id = 2196145 + chapter;
  const title = `第${chapter}章 春游与打猎`;
  const next = section === 1 ? `${id}_2` : String(id + 1);
  const prev = section === 1 ? String(id - 1) : String(id);
  const navigation = `<p class="Readpage">
    <a href="/4_4581/${prev}.html" id="pt_prev">上一章</a>
    <a href="/4_4581/" id="pt_mulu">目录</a>
    <a href="/4_4581/${next}.html" id="pt_next">下一章</a></p>`;
  const prose = Array.from(
    { length: 50 },
    (_, i) =>
      `第${section}页正文段落${i + 1}：山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。`
  ).join('<br><br>&nbsp;&nbsp;&nbsp;&nbsp;');
  return `<html><head><title>${title}${section}_测试书名_笔趣阁</title></head>
    <body id="read" class="read">
      <header><span class="title">${title}&nbsp;&nbsp;测试书名</span></header>
      ${navigation}
      <div id="chaptercontent" class="Readarea ReadAjax_content">
        ${title}第(${section}/2)页<br>
        ${prose}<br><br>
        ${section === 1 ? `${title}第(1/2)页,点击下一页继续阅读。<br>` : ''}
        <p><a href="javascript:addBookMarkByManual(${id},4581)">『加入书签，方便阅读』</a></p>
      </div>
      ${navigation}
      <footer>首页 我的书架 阅读记录</footer>
    </body></html>`;
}

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
  const body = '<p>山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。</p>'.repeat(60);
  const head = `<!doctype html><html><head><title>第${chapter}章 测试正文_测试书名</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"></head><body>`;

  if (site.id === 'kudushu') {
    // Live mobile chapter page: nav labels use a full-width dash instead of 一,
    // and the button row plus the site watermark are repeated inside #novelcontent.
    const navRow = `<ul class="novelbutton">
      <li><p class="p1"><a href="${site.chapterPath(chapter - 1)}">上—章</a></p></li>
      <li><p class="p2"><a href="${site.tocPath(1)}">返&nbsp;回&nbsp;目&nbsp;录</a></p></li>
      <li><p class="p2"><a href="/bookcase.php">进入书架</a></p></li>
      <li><p class="p1 p3"><a href="${site.chapterPath(chapter + 1)}">下—章</a></p></li>
    </ul>`;
    return `${head}
      <div class="content_top"><a href="${site.tocPath(1)}">返回书页</a></div>
      <h1 id="chaptertitle">第${chapter}章 测试正文</h1>
      <div class="content_novel">${navRow}
        <div id="novelcontent" class="novelcontent">
          <div id="content_tip"><b>最新网址：m.kudushu.org</b></div>
          第${chapter}章 测试正文 (第1/3页)<br>
          ${body}${navRow}
        </div>
      </div>
    </body></html>`;
  }

  return `${head}
    <h1>第${chapter}章 测试正文</h1>
    <nav><a href="${site.chapterPath(chapter - 1)}">上一章</a>
      <a href="${site.tocPath(1)}">章节列表</a>
      <a href="${site.chapterPath(chapter + 1)}">下一章</a></nav>
    <div id="content">${body}</div>
  </body></html>`;
}
