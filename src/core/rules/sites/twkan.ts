import type { SiteRule } from '../types';

function restoreCanvasText(doc: Document): void {
  const content = doc.querySelector('#txtcontent0') || doc.querySelector('.txtnav');
  if (!content) return;

  // Same public text format as /js/reader-sec.js?v=20260916b. Decode before the
  // generic processor clones/serializes content: canvas pixels cannot survive that path.
  const key = 'jieqi2026abcd12';
  const replacements = Array.from(content.querySelectorAll('canvas.sec-last'), canvas => {
    const encoded = canvas.getAttribute('data-c');
    const salt = canvas.getAttribute('data-v');
    if (!encoded || !salt) throw new Error('TWKAN canvas text payload is missing');

    const bytes = Uint8Array.from(
      atob(encoded),
      (char, index) =>
        char.charCodeAt(0) ^
        key.charCodeAt(index % key.length) ^
        salt.charCodeAt(index % salt.length)
    );
    // The host renders decoded HTML as text. Keep its entity decoding without
    // inserting executable markup or loading embedded resources into the page.
    const template = doc.createElement('template');
    template.innerHTML = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const text = template.content.textContent || '';
    if (!text.trim()) throw new Error('TWKAN canvas text is empty');

    const replacement = doc.createDocumentFragment();
    replacement.append(doc.createElement('br'));
    for (const line of text.split(/\r?\n/)) {
      replacement.append(doc.createTextNode(line), doc.createElement('br'));
    }
    return { canvas, replacement };
  });

  // Decode the whole chapter first; a failed payload leaves the host intact and
  // uses the parser's existing failure path instead of accepting missing text.
  for (const { canvas, replacement } of replacements) canvas.replaceWith(replacement);
}

// 台灣小說網
// - 章节页：/txt/{bookId}/{chapterId}
// - 目录页：/book/{bookId}/index.html
export const twkanRule: SiteRule = {
  id: 'twkan',
  name: '台灣小說網',
  version: 1,
  match: { pattern: '^https?://twkan\\.com/txt/\\d+/\\d+/?(?:[?#].*)?$' },
  content: {
    selector: '#txtcontent0, .txtnav',
    remove: 'ins, .page1, .readinline, .read-link, .ad_content, .top-ad, .bottom-ad',
    replace: [
      {
        pattern:
          '^[\\s\\u00a0\\u3000\\u2000-\\u200a]*第[一二三四五六七八九十百千\\d]+(?:章|节|節|回|话|話|篇|集|卷)[^<]{0,120}(?:<br\\s*/?>\\s*)+',
        replacement: '',
      },
      {
        pattern: '（?請記住臺灣小説網[^<\\n]*?）?',
        replacement: '',
      },
      {
        pattern: '（?请记住[臺台]湾小[説说]网[^<\\n]{0,160}(?:章节更新|網站|网站)[^<\\n]{0,40}）?',
        replacement: '',
      },
      {
        pattern: '〖[^〗]*分享[^〗]*運營[^〗]*〗',
        replacement: '',
      },
      {
        pattern: '【[^】]{0,100}(?:域名|[臺台]湾小[説说]网|[臺台]湾好书)[^】]{0,160}】',
        replacement: '',
      },
      {
        pattern: '本章完。?',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: 'a:contains("上一章")',
    index: 'a:contains("目錄"), a:contains("目录"), a:contains("書頁"), a:contains("书页")',
    next: 'a:contains("下一章")',
  },
  title: {
    selector: '.txtnav > h1, h1',
    pattern: '^(.+?)-(.+?)-[^-]+-.*?台灣小說網$',
    bookPatternIndex: 2,
    bookSelector: 'a[href*="/book/"][href$="/index.html"]',
  },
  advanced: { useIframe: true },
  hooks: { beforeParse: restoreCanvasText },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://twkan.com/txt/93181/53052605',
  },
};
