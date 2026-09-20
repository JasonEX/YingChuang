import type { SiteRule } from '../types';

const CHAPTER_URL =
  /^https?:\/\/(?:www\.)?novel543\.com(\/\d+\/\d+_\d+)(?:_(\d+))?\.html(?:[?#].*)?$/;

// The first underscore belongs to the chapter ID; only the second is a page suffix.
function parseNovel543Url(url: string): { chapterUrl: string; page: number } | null {
  const match = url.match(CHAPTER_URL);
  if (!match) return null;
  const parsed = new URL(url);
  parsed.pathname = `${match[1]}.html`;
  parsed.hash = '';
  return { chapterUrl: parsed.href, page: Number(match[2] || 1) };
}

export const novel543Rule: SiteRule = {
  id: 'novel543',
  name: '稷下書院',
  version: 1,
  match: { pattern: CHAPTER_URL.source },
  content: {
    selector: '.chapter-content > .content',
    // Match both source markup and paragraph-wrapped markup before content normalization.
    remove:
      '.adBlock, .gadBlock, [id^=div-onead-], div:has(> img[src="/images/vip.png"]):has(> a[href$="/auth/govip.html"]), div:has(> p img[src="/images/vip.png"]):has(> a[href$="/auth/govip.html"])',
  },
  navigation: {
    prev: '.foot-nav a:contains(上一章)',
    index: '.foot-nav a[href$="/dir"]',
    next: '.foot-nav a:contains(下一章)',
  },
  title: {
    selector: '.chapter-content > h1',
    replace: '\\s*[（(]\\d+\\s*/\\s*\\d+[）)]\\s*$',
    bookSelector: '.header .nav li:last-child a',
  },
  toc: {
    excludeAncestors: '.chaplist > ul:not(.all)',
  },
  hooks: {
    parseSectionUrl: parseNovel543Url,
    beforeParse: doc => {
      const bookLink = doc.querySelector('.header .nav li:last-child a');
      const bookTitle = doc
        .querySelector<HTMLMetaElement>('meta[name=keywords]')
        ?.content.match(/^(.+?)官方首[發发](?:[,，]|$)/)?.[1];
      if (bookLink && !bookLink.textContent?.trim() && bookTitle) bookLink.textContent = bookTitle;

      for (const p of doc.querySelectorAll('#chapterWarp .content > div > p')) {
        const label = p.firstChild;
        if (
          label?.nodeName === 'SPAN' &&
          /^[溫温]馨提示[:：]$/.test(label.textContent?.trim() || '')
        ) {
          p.remove();
        }
      }
    },
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://www.novel543.com/1019622989/8096_941.html',
  },
};
