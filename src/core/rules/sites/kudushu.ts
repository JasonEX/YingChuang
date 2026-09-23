import type { SiteRule } from '../types';

// 苦读书（移动版）
// - 章节页：/html/{bookId}/{chapterId}/
// - 分页章节：/html/{bookId}/{chapterId}_{pageNo}/
// - 目录页：/book/{bookId}/，翻页为 /html/{bookId}/asc-{pageNo}/
export const kudushuRule: SiteRule = {
  id: 'kudushu',
  name: '苦读书（移动版）',
  version: 2,
  match: {
    pattern: '^https?://m\\.kudushu\\.org/html/\\d+/\\d+(?:_\\d+)?/(?:[?#].*)?$',
  },
  content: {
    selector: '#novelcontent',
    // #novelcontent also wraps the site watermark and a repeated nav block.
    remove: '#content_tip, ul.novelbutton',
    replace: [
      // Every section page repeats the chapter heading before the body, e.g.
      // "第64章 标题 (第1/3页)". Drop it so merged chapters do not repeat the title.
      { pattern: '^[\\s\\S]*?[（(]第\\d+[/／]\\d+页[）)]', replacement: '', flags: '' },
    ],
  },
  navigation: {
    // Labels use a full-width dash ("上—章" / "下—页"), so text heuristics miss them.
    // The button row is a direct child of .content_novel; .p3 marks the forward link.
    prev: '.content_novel > ul.novelbutton p.p1:not(.p3) > a[href*="/html/"]',
    next: '.content_novel > ul.novelbutton p.p3 > a[href*="/html/"]',
    index: '.content_novel > ul.novelbutton p.p2 > a[href*="/book/"]',
  },
  title: {
    selector: '#chaptertitle',
  },
  toc: {
    // Only the main list contains the pager; the preceding list is a repeated
    // latest-chapter preview, not part of this page's catalog order.
    selector: '.info_menu1 .list_xm:has(> .listpage) > ul',
  },
  advanced: {
    // Chapters are split across /{chapterId}_{n}/ pages.
    checkSection: true,
    // Cloudflare-fronted; keep the extra section requests spaced out.
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://m.kudushu.org/html/1088392/146537150/',
  },
};

// 苦读书（PC 版）
// - 章节页：/html/{分类号}/{bookId}/{chapterId}.html
// - 目录页：/html/{分类号}/{bookId}/index.html
// PC 版一章一页，不像移动版那样拆成 _{n}/ 分页，因此不开启 checkSection。
export const kudushuPcRule: SiteRule = {
  id: 'kudushu-pc',
  name: '苦读书（PC版）',
  version: 1,
  match: {
    pattern: '^https?://www\\.kudushu\\.org/html/\\d+/\\d+/\\d+\\.html(?:[?#].*)?$',
  },
  content: {
    selector: '#clickeye_content',
    remove: '.style3',
    replace: [
      // 正文首尾各有一处站点水印：「(苦读书 www.kudushu.org)」与「苦读书 www.kudushu.org」。
      {
        pattern: '[（(]?\\s*苦读书\\s*www\\.kudushu\\.org\\s*[）)]?',
        replacement: '',
        flags: 'g',
      },
    ],
  },
  navigation: {
    // 首章的「上一页」与末章的「下一页」都指向目录页，必须排除，
    // 否则会把目录当成相邻章节。翻页文案用的是「页」而非「章」，只能按文本区分前后。
    prev: '.P_Nav .inforight a:not([href$="index.html"]):contains("上一页")',
    next: '.P_Nav .inforight a:not([href$="index.html"]):contains("下一页")',
    index: '.P_Nav .inforight a[href$="index.html"]',
  },
  title: {
    selector: '#cont h1',
  },
  toc: {
    // 源码里 <ul class="chapters"> 连开了两层，直接用 ul.chapters 会把同一批链接收集两遍。
    selector: '.index > ul.chapters',
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.kudushu.org/html/1088/1088392/146537150.html',
  },
};
