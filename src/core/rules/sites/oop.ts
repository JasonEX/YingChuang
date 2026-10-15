import type { SiteRule } from '../types';

const CHAPTER_URL =
  /^https?:\/\/www\.oop\.tw(\/areada\/a\d+a\/a\d+)(?:_([1-9]\d*))?a\.html(?:[?#].*)?$/;

export const oopRule: SiteRule = {
  id: 'oop',
  name: '短篇小說',
  version: 1,
  match: { pattern: CHAPTER_URL.source },
  content: {
    selector: '#article',
    remove: ':scope > div, ins',
    replace: [
      {
        pattern: '請前往(?:ｏｏｐ．ｔｗ|oop\\.tw)閱讀本書最新內容',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: '#prev_url[href*="/areada/"]',
    next: '#next_url[href*="/areada/"]',
    index: '#info_url',
  },
  title: { selector: 'h1.chapter-title', bookSelector: '.book-title a' },
  toc: {
    // Exclude latest previews and any trap.php links hidden among the main entries.
    selector: '#ul_all_chapters > li:has(> a[href^="/areada/"])',
  },
  advanced: { checkSection: true },
  hooks: {
    parseSectionUrl: url => {
      const match = url.match(CHAPTER_URL);
      if (!match) return null;
      const parsed = new URL(url);
      parsed.pathname = `${match[1]}a.html`;
      parsed.hash = '';
      return { chapterUrl: parsed.href, page: Number(match[2] || 1) };
    },
    beforeParse: doc => {
      const article = doc.querySelector<HTMLElement>('#article[data-ct]');
      if (!article) return;
      const count = parseInt(article.getAttribute('data-ct') || '0', 10);
      // reader.js sets this inline size immediately before reversing the tail, but
      // leaves data-ct behind. Preserve already-rendered live pages and their clones.
      if (!article.style.fontSize && count > 0) {
        const paragraphs = Array.from(article.querySelectorAll('p'));
        if (paragraphs.length >= count) {
          for (const paragraph of paragraphs.slice(-count)) {
            paragraph.textContent = Array.from(paragraph.textContent || '')
              .reverse()
              .join('');
          }
        }
      }
      // A later host DOMContentLoaded callback must not reverse the same text again.
      article.removeAttribute('data-ct');
    },
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.oop.tw/areada/a33080432a/a835960a.html',
  },
};
