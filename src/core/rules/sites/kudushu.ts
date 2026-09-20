import type { SiteRule } from '../types';

export const kudushuRule: SiteRule = {
  id: 'kudushu',
  name: '苦读书（移动版）',
  version: 1,
  match: {
    pattern: '^https?://m\\.kudushu\\.org/html/\\d+/\\d+(?:_\\d+)?/(?:[?#].*)?$',
  },
  content: { selector: '#novelcontent' },
  toc: {
    // Only the main list contains the pager; the preceding list is a repeated
    // latest-chapter preview, not part of this page's catalog order.
    selector: '.info_menu1 .list_xm:has(> .listpage) > ul',
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://m.kudushu.org/html/1088392/146537147/',
  },
};
