import type { SiteRule } from '../types';

export const wxslRule: SiteRule = {
  id: 'wxsl',
  name: '森林文学',
  version: 1,
  match: {
    pattern: '^https?://www\\.2wxsl\\.com/book/\\d+/\\d+(?:_\\d+)?\\.html(?:[?#].*)?$',
  },
  content: { selector: '#content' },
  toc: {
    // Desktop and narrow layouts share this DOM. The latest-chapter preview
    // and "start reading" links are outside the list next to the pager.
    selector: '.row-section .section-box:has(+ .listpage) > .section-list',
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'http://www.2wxsl.com/book/132139/50723047.html',
  },
};
