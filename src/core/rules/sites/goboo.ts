import type { BeforeParseHook, SiteRule } from '../types';
import { appendHiddenLink } from '../helpers/scriptNavigation';

const gobooBeforeParse: BeforeParseHook = (doc, url) => {
  try {
    const fallbackUrl =
      typeof location !== 'undefined' && typeof location.href === 'string' ? location.href : '';
    const pageUrl = url || doc.location?.href || fallbackUrl;
    const path = pageUrl ? new URL(pageUrl).pathname : '';
    const match = path.match(/^\/gb_(\d+)\/(\d+)\/\d+/);
    if (match) {
      appendHiddenLink(doc, 'mnr-goboo-index', `/ml_${match[1]}/${match[2]}`, '目录', pageUrl);
    }

    const hasEncodedContent = Array.from(doc.scripts).some(script =>
      /p_key\s*=\s*['"][A-Za-z0-9+/=]{80,}['"]/.test(script.textContent || '')
    );

    doc.querySelectorAll('.content p').forEach(p => {
      const text = (p.textContent || '').replace(/\s+/g, '');
      const isPromotion = /小说免费阅读，请收藏.*goboo\.cc/i.test(text);
      const isLoadMoreBlocker =
        /阅\|读\|模\|式\|或\|畅\|读\|模\|式/.test(text) || /加\|载\|更\|多/.test(text);
      if (isPromotion || (!hasEncodedContent && isLoadMoreBlocker)) {
        p.remove();
      }
    });
  } catch (e) {
    console.warn('[YingChuang] Goboo beforeParse error:', e);
  }
};

// 钢笔小说 (m.goboo.cc)
// - 章节页：/gb_1/{bookId}/{chapterNo}
// - 分页章节：/gb_1/{bookId}/{chapterNo}/{pageNo}
// - 目录页：/ml_1/{bookId}
export const gobooRule: SiteRule = {
  id: 'goboo-m',
  name: '钢笔小说(手机版)',
  version: 1,
  match: { pattern: '^https?://m\\.goboo\\.cc/gb_\\d+/\\d+/\\d+(?:/\\d+)?/?$' },
  content: {
    selector: '.content',
    remove: 'ins, .page, .emgoouqv_b',
    replace: [
      {
        pattern: '【[^】]+】小说免费阅读，请收藏\\s*钢笔小说【goboo\\.cc】',
        replacement: '',
      },
      {
        pattern:
          '阅\\|读\\|模\\|式\\|或\\|畅\\|读\\|模\\|式\\|下，?无\\|法\\|显\\|示\\|本\\|章\\|节\\|全\\|部\\|内\\|容，请\\|返\\|回\\|原\\|网\\|页阅\\|读。?加\\|载\\|更\\|多',
        replacement: '',
      },
      {
        pattern: '本章未完，点击\\[下一页\\]继续阅读-->',
        replacement: '',
      },
    ],
  },
  navigation: {
    prev: '.page .left a',
    index: '#mnr-goboo-index, .page .center a, a[href*="/ml_"]',
    next: '.page .right a',
  },
  title: {
    pattern: '^(.+?)(?:\\(\\d+/\\d+\\))?\\s+-\\s+(.+?)小说\\s+-\\s+钢笔小说$',
    bookPatternIndex: 2,
  },
  hooks: { beforeParse: gobooBeforeParse },
  advanced: { checkSection: true },
  meta: {
    source: 'builtin',
    exampleUrl: 'https://m.goboo.cc/gb_1/94443/1',
  },
};
