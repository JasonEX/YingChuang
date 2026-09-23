import type { SiteRule } from '../types';

const CHAPTER_URL =
  /^https?:\/\/www\.novels\.com\.tw(\/novels\/[^/?#]+\/\d+)(?:_(\d+))?\.html(?:[?#].*)?$/;

function normalizeNovelsUrl(url: string): string | null {
  if (!CHAPTER_URL.test(url)) return null;
  const parsed = new URL(url);
  // The book is already identified by the path. Catalog links omit this redundant parameter.
  parsed.searchParams.delete('aid');
  return parsed.href;
}

export const novelsRule: SiteRule = {
  id: 'novels',
  name: '繁體小說',
  version: 1,
  match: { pattern: CHAPTER_URL.source },
  content: {
    selector: '#article',
    // The rendered body consists of paragraphs; direct div children are ad slots.
    remove: ':scope > div, ins',
  },
  navigation: { prev: '#prev_url', next: '#next_url', index: '#info_url' },
  title: {
    selector: '.text_title h1',
    replace: '\\s*[（(]\\d+\\s*/\\s*\\d+[）)]\\s*$',
    bookSelector: '.text_info a:first-child',
  },
  advanced: { checkSection: true },
  hooks: {
    normalizeChapterUrl: normalizeNovelsUrl,
    parseSectionUrl: url => {
      const match = url.match(CHAPTER_URL);
      if (!match) return null;
      const parsed = new URL(normalizeNovelsUrl(url)!);
      parsed.pathname = `${match[1]}.html`;
      parsed.hash = '';
      return { chapterUrl: parsed.href, page: Number(match[2] || 1) };
    },
    beforeParse: async doc => {
      const article = doc.querySelector('#article');
      const script = article?.querySelector('#chapter-content script')?.textContent;
      const encoded = script?.match(/window\.encryptedContent\s*=\s*("(?:\\.|[^"\\])*")/);
      if (article && encoded) {
        // Same public client-side format as /static/shipsay/js/gfncgd.js:
        // base64 AES-128-CBC, a zero IV, and the site's fixed public rendering key.
        const bytes = Uint8Array.from(atob(JSON.parse(encoded[1])), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode('WZc0cbzgY3lhz3X6'),
          'AES-CBC',
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: new Uint8Array(16) },
          key,
          bytes
        );
        let text = new TextDecoder().decode(decrypted);
        // The site applies an additional padding layer before Web Crypto's own padding.
        const padding = text.charCodeAt(text.length - 1);
        if (
          padding >= 1 &&
          padding <= 16 &&
          text.endsWith(String.fromCharCode(padding).repeat(padding))
        ) {
          text = text.slice(0, -padding);
        }
        if (/<[a-z][\s\S]*>/i.test(text)) {
          article.innerHTML = text;
        } else {
          article.replaceChildren(
            ...text.split('\n').map(line => {
              const paragraph = doc.createElement('p');
              paragraph.textContent = line;
              return paragraph;
            })
          );
        }
      }

      // The host keeps these originals because its ads can rewrite hrefs.
      for (const link of doc.querySelectorAll<HTMLAnchorElement>(
        '#prev_url[data-real-href], #next_url[data-real-href], #info_url[data-real-href]'
      )) {
        link.setAttribute('href', link.getAttribute('data-real-href')!);
      }
    },
  },
  meta: {
    source: 'builtin',
    exampleUrl:
      'https://www.novels.com.tw/novels/no689ecf9c709950ae5cadd90cff89ffd6257bf537a60d904c9e6084f4aa2c12ca/199107755.html?aid=1092650',
  },
};
