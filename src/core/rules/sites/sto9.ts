import type { BeforeParseHook, SiteRule } from '../types';

const sto9BeforeParse: BeforeParseHook = doc => {
  const content = doc.querySelector('.txtnav');
  if (!content) return;

  const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(content, showText);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const normalized = (node.nodeValue || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.includes('sto9com')) {
      node.nodeValue = '';
    }
  }
};

// 思兔阅读
// - 章节页：/txt/{bookId}/{chapterId}.html
// - 目录页：/book/{bookId}/index.html
// - 完整目录：/ajax_novels/chapterlist/{bookId}.html
export const sto9Rule: SiteRule = {
  id: 'sto9',
  name: '思兔阅读',
  version: 2,
  match: { pattern: '^https?://(?:www\\.)?sto9\\.com/txt/\\d+/\\d+\\.html(?:[?#].*)?$' },
  content: {
    selector: '.txtnav',
    remove: 'ins, .txtright, .txtad',
    replace: [
      {
        pattern: '[（(]\\s*還有更新耶\\s*[）)]',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: '.page1 a:contains("上一章")',
    index: '.page1 a:contains("目錄"), .page1 a:contains("目录")',
    next: '.page1 a:not([href$="/end.html"]):contains("下一章")',
  },
  title: {
    selector: '.txtnav > h1',
    bookSelector: '.bread a[href*="/book/"][href$="/index.html"]',
  },
  hooks: { beforeParse: sto9BeforeParse },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://sto9.com/txt/7974/7627078.html',
  },
};
