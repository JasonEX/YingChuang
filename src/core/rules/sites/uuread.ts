import type { SiteRule } from '../types';

// UU看书
// - 章节页：/chapter/{bookId}/{chapterId}.html
// - 分页章节：/chapter/{bookId}/{chapterId}_{pageNo}.html
// - 目录页：/{bookId}
export const uureadRule: SiteRule = {
  id: 'uuread',
  name: 'UU看书',
  version: 2,
  match: { pattern: '^https?://www\\.uuread\\.tw/chapter/\\d+/\\d+(?:_\\d+)?\\.html$' },
  content: { selector: '.txt_tcontent' },
  navigation: {
    next: 'a.btn-primary:nth-child(4)',
    prev: 'a.btn-primary:nth-child(1)',
    index: 'a.btn-primary:nth-child(3)',
  },
  title: {
    selector: '.chatit',
    replace: '\\s*[（(]\\s*\\d+\\s*/\\s*\\d+\\s*[）)]\\s*$',
    bookSelector: '.bread > li:nth-child(4) > a:nth-child(1)',
  },
  advanced: { checkSection: true },
  meta: { source: 'builtin', exampleUrl: 'https://www.uuread.tw/chapter/1880014/2545609.html' },
};
