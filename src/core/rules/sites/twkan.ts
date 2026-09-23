import type { SiteRule } from '../types';

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
  meta: {
    source: 'builtin',
    exampleUrl: 'https://twkan.com/txt/93181/53052605',
  },
};
