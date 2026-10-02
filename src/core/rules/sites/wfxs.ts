import type { SiteRule } from '../types';

/** Follow only the ascending, same-book page links actually supplied by the site. */
export function nextWfxsTocPage(doc: Document, currentUrl: string): string | null {
  const current = new URL(currentUrl);
  const match = current.pathname.match(/^\/booklist\/(\d+)(?:\/(\d+))?\.html$/);
  if (current.hostname !== 'm.wfxs.tw' || !match) return null;
  const [, bookId, page] = match;
  const currentPage = Number(page || 1);
  const pages = new Map<number, string>();
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    let url: URL;
    try {
      url = new URL(anchor.getAttribute('href')!, currentUrl);
    } catch {
      continue;
    }
    if (url.origin !== current.origin) continue;
    const candidate = url.pathname.match(/^\/booklist\/(\d+)\/(\d+)\.html$/);
    if (candidate?.[1] !== bookId) continue;
    pages.set(Number(candidate[2]), url.href);
  }
  if (!pages.has(currentPage)) {
    throw new Error('Wfxs catalog pagination controls are missing');
  }
  const next = pages.get(currentPage + 1);
  if (next) return next;
  if ([...pages.keys()].some(value => value > currentPage)) {
    throw new Error('Wfxs catalog is missing the next page link');
  }
  return null;
}

export const wfxsRule: SiteRule = {
  id: 'wfxs',
  name: '微风小说网（移动版）',
  version: 1,
  match: { pattern: '^https?://m\\.wfxs\\.tw/xiaoshuo/\\d+/\\d+/(?:[?#].*)?$' },
  content: { selector: '#read_conent_box' },
  title: { selector: 'h1.title', bookSelector: '.h_header h2' },
  navigation: {
    prev: '.page li:first-child a',
    index: '.page a[href*="/booklist/"]',
    next: '.page li:last-child a',
  },
  toc: { selector: '#html_box' },
  hooks: { nextTocPage: nextWfxsTocPage },
  meta: { source: 'builtin', exampleUrl: 'https://m.wfxs.tw/xiaoshuo/9074406/84446392/' },
};
