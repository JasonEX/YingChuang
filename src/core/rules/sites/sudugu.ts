import type { SiteRule } from '../types';

// 速读谷
// - 章节页：/{bookId}/{chapterId}.html
// - 分页章节：/{bookId}/{chapterId}-{pageNo}.html
// - 目录页：/{bookId}/#dir
export const suduguRule: SiteRule = {
  id: 'sudugu',
  name: '速读谷',
  version: 1,
  match: { pattern: '^https?://www\\.shudugu\\.org/\\d+/\\d+(?:-\\d+)?\\.html(?:[?#].*)?$' },
  content: {
    selector: '.con',
    remove: 'ins',
  },
  navigation: {
    prev: '.prenext span:first-child a',
    index: '.prenext > a[href*="#dir"]',
    next: '.prenext span:last-child a',
  },
  title: {
    selector: '.submenu h1',
    replace: '^.*?>\\s*',
    bookSelector: '.submenu h1 > a[href^="/"][href$="/"]',
  },
  toc: { excludeAncestors: '.new, .item, h1, h2' },
  advanced: { checkSection: true },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.shudugu.org/109/1226047.html',
  },
};
