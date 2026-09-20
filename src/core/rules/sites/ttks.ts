import type { BeforeParseHook, SiteRule } from '../types';

const WATERMARK_TAIL_PATTERN =
  /\s*(?:[（(【]\s*)?(?:[寫写]到[這这][裡里]我希望[讀读]者[記记]一下我[們们]域名|由[於于][緩缓]存原因[，,]?[請请]用[戶户]直接(?:瀏覽|浏览)器(?:訪問|访问)|本[書书]首[發发]|天天看[小小說说]{2}解[書书]荒|[記记]住本站域名)[\s\S]*$/u;

const ttksBeforeParse: BeforeParseHook = doc => {
  const content = doc.querySelector('.frame_body > .title + .content');
  if (!content) return;

  const paragraphs = Array.from(content.querySelectorAll(':scope > p'));
  for (const paragraph of paragraphs) {
    const text = paragraph.textContent || '';
    const cleaned = text.replace(WATERMARK_TAIL_PATTERN, '').trimEnd();
    if (cleaned !== text) {
      if (cleaned) paragraph.textContent = cleaned;
      else paragraph.remove();
    }
  }

  const trailingParagraphs = Array.from(content.querySelectorAll(':scope > p'));
  for (let index = trailingParagraphs.length - 1; index >= 0; index--) {
    const paragraph = trailingParagraphs[index];
    const text = (paragraph.textContent || '').replace(/\s+/g, '').trim();
    if (!text) {
      paragraph.remove();
      continue;
    }
    if (/^(?:>|福)$/.test(text)) {
      paragraph.remove();
      continue;
    }
    break;
  }
};

// 天天看小說：正文、控制区和章节导航都使用 `.content`，短篇作者单章无法由通用检测识别。
export const ttksRule: SiteRule = {
  id: 'ttks',
  name: '天天看小說',
  version: 1,
  match: {
    pattern: '^https?://(?:www\\.)?ttks\\.tw/novel/chapters/[^/?#]+/\\d+\\.html(?:[?#].*)?$',
  },
  content: {
    selector: '.frame_body > .title + .content',
    remove: '.anchor_bookmark, .txtcenter, .div_feedback, .social_share_frame',
  },
  navigation: {
    prev: '#linkPrev',
    index: '.breadcrumb_nav a[href$="/index.html"]',
    next: '#linkNext',
  },
  title: {
    selector: '.frame_body > .title h1, .frame_body > .title',
    bookSelector: '.breadcrumb_nav a[href$="/index.html"]',
  },
  hooks: {
    beforeParse: ttksBeforeParse,
  },
  advanced: {
    noSection: true,
    useIframe: true,
  },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/83.html',
  },
};
