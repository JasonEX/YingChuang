import type { BeforeParseHook, SiteRule } from '../types';
import { appendHiddenLink } from '../helpers/scriptNavigation';

const shu69BeforeParse: BeforeParseHook = (doc, url) => {
  try {
    const fallbackUrl =
      typeof location !== 'undefined' && typeof location.href === 'string' ? location.href : '';
    const pageUrl = url || doc.location?.href || fallbackUrl;
    const script = Array.from(doc.querySelectorAll('script')).find(item =>
      (item.textContent || '').includes('bookinfo')
    );
    const text = script?.textContent || '';
    if (!text) return;

    const extractString = (key: string): string => {
      const match = text.match(new RegExp(`${key}\\s*:\\s*(["'])([^"'\\r\\n]{1,300})\\1`, 'i'));
      return match?.[2]?.trim() || '';
    };

    const bookTitle = extractString('articlename');
    const chapterTitle = extractString('chaptername');
    const indexUrl = extractString('index_page');
    const prevUrl = extractString('preview_page');
    const nextUrl = extractString('next_page');

    appendHiddenLink(doc, 'mnr-69shu-book', indexUrl || prevUrl, bookTitle, pageUrl);
    appendHiddenLink(doc, 'mnr-69shu-index', indexUrl, '目录', pageUrl);
    appendHiddenLink(doc, 'mnr-69shu-prev', prevUrl, '上一章', pageUrl);
    appendHiddenLink(doc, 'mnr-69shu-next', nextUrl, '下一章', pageUrl);

    if (chapterTitle && !doc.querySelector('#mnr-69shu-title')) {
      const parent = doc.body || doc.documentElement;
      if (!parent) return;
      const title = doc.createElement('h1');
      title.id = 'mnr-69shu-title';
      title.textContent = chapterTitle;
      title.style.display = 'none';
      parent.appendChild(title);
    }
  } catch (e) {
    console.warn('[YingChuang] 69shu beforeParse error:', e);
  }
};

// 69书吧
// - 章节页：/txt/{bookId}/{chapterId}
// - 同站点还会出现 /c/...、/r/... 路径模板
export const shu69Rule: SiteRule = {
  id: '69shu',
  name: '69书吧',
  version: 2,
  match: {
    pattern:
      '^https?://(?:www\\.)?69(?:shu|yuedu)[a-z0-9]*?\\.(?:pro|top|com|cx|net|co|me|biz)/(?:txt|c|r)/\\d+/\\d+/?(?:[?#].*)?$',
  },
  content: {
    selector: '#txtcontent, .txtnav',
    remove:
      'ins, .txtinfo.hide720, #txtright, .bottom-ad, .bottom-ad2, .page1, .readinline, .ad_content',
    replace: [
      {
        pattern: '.*[6六].*[9九].*书.*吧.*',
        replacement: '',
      },
      {
        pattern: '请收藏本站.*?最新网址.*?(?:<br\\s*/?>)?',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: '#mnr-69shu-prev, .page1 a:contains("上一章"), .page1 a:nth-child(1)',
    index:
      '#mnr-69shu-index, .page1 a:contains("目录"), .page1 a:contains("書目"), .page1 a:nth-child(3)',
    next: '#mnr-69shu-next, .page1 a:contains("下一章"), .page1 a:nth-child(4)',
  },
  title: {
    selector: '#mnr-69shu-title, h1',
    bookSelector:
      '#mnr-69shu-book, .mytitle .bread a[href*="/book/"][href$=".htm"], .txtinfo a:first-child, .con_top a:nth-child(3)',
  },
  hooks: { beforeParse: shu69BeforeParse },
  advanced: {
    noSection: true,
    useIframe: true,
  },
  meta: { source: 'builtin', exampleUrl: 'https://www.69shuba.com/txt/58672/38147713' },
};
