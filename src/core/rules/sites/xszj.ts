import type { SiteRule } from '../types';

// 小说之家（xszj.org）
// - 章节页：/b/{bookId}/c/{chapterId}
// - 分页章节：/b/{bookId}/c/{chapterId}?page={n}，首页无 page 参数（?page=1 与首页等价）
// - 目录页：/b/{bookId}/cs/{n}，由目录分类处理，规则不匹配
// - m.xszj.org 为繁体镜像，DOM 结构相同，导航文字为繁体（下一頁/上一頁/目錄）
// - 站点缺陷：分页时“下一页”链接的 rel 错标为 prev，导航选择器只能依赖链接文字
// - 已观测到至少 80 页的长章节；首屏先显示，其余页面限速合并
// - 99 是与共享查询分页识别范围一致的实现保护上限，并非站点真实最大值
export const xszjRule: SiteRule = {
  id: 'xszj',
  name: '小说之家',
  version: 1,
  match: {
    pattern: '^https?://(?:m\\.)?xszj\\.org/b/\\d+/c/\\d+(?:[?#].*)?$',
  },
  content: {
    selector: '#booktxt',
    remove: 'script, style, iframe, ins',
  },
  navigation: {
    prev: '.bottem1 a:contains("上一章"), .bottem1 a:contains("上一页"), .bottem1 a:contains("上一頁")',
    index: '.bottem1 a[href*="/cs/"], .bottem1 a:contains("目录"), .bottem1 a:contains("目錄")',
    next: '.bottem1 a:contains("下一章"), .bottem1 a:contains("下一页"), .bottem1 a:contains("下一頁")',
  },
  title: {
    selector: 'h1.bookname',
    replace: '\\s*[（(]\\d+/\\d+[)）]\\s*$',
    bookSelector: '.con_top a[href^="/b/"]',
  },
  advanced: {
    checkSection: true,
    sectionMaxPages: 99,
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://xszj.org/b/490346/c/1534359',
  },
};
