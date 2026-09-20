import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { ciweimaoRule, ciweimaoWapRule } from '@/core/rules/sites/ciweimao';
import { qidianMobileRule, qidianRule } from '@/core/rules/sites/qidian';
import { builtInRules } from '@/core/rules/builtInRules';
import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { loadRuleApiDocument } from '@/ui/stores/reader/chapterFetch';
import { Parser } from '@/core/parser';

describe('builtInRules', () => {
  it('contains active built-in rules', () => {
    expect(builtInRules.length).toBeGreaterThan(0);
    expect(builtInRules).toContain(qidianRule);
    expect(builtInRules).toContain(qidianMobileRule);
  });

  it('does not keep unsupported processing flags in built-in rules', () => {
    expect(
      builtInRules.some(
        rule => 'useSiteFont' in ((rule.processing ?? {}) as Record<string, unknown>)
      )
    ).toBe(false);
  });

  it('builds Qidian TOC URL from the stable book detail page', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const url = 'https://www.qidian.com/chapter/1045659200/850667574/';
    const pageContext = {
      pageContext: {
        pageProps: {
          pageData: {
            bookInfo: {
              bookId: 1045659200,
              bookName: '为武道狂，拳压诸天',
            },
            chapterInfo: {
              chapterName: '第一章 武当寻旧',
              content: '<p>武当山正文。</p>',
              next: 850662591,
              prev: -1,
            },
          },
        },
      },
    };
    const doc = new JSDOM(
      `<!doctype html>
      <html>
        <head><title>第一章 武当寻旧 _《为武道狂，拳压诸天》小说在线阅读 - 起点中文网</title></head>
        <body>
          <script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(
            pageContext
          )}</script>
          <main id="c-850667574"><h1 class="title">第一章 武当寻旧</h1><p>武当山正文。</p></main>
        </body>
      </html>`,
      { url }
    ).window.document;

    const chapter = await new Parser().parse(doc, url);

    expect(chapter?.indexUrl).toBe('https://www.qidian.com/book/1045659200/');
    expect(chapter?.nextUrl).toBe('https://www.qidian.com/chapter/1045659200/850662591/');
  });

  it('uses native fetch instead of iframe for mobile Qidian chapters', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const mobileUrl = 'https://m.qidian.com/chapter/1049115805/903889110/';
    expect(qidianMobileRule.match.pattern).toMatch('m\\.qidian\\.com');
    expect(qidianMobileRule.advanced?.useIframe).not.toBe(true);
    expect(qidianRule.match.pattern).toMatch('www\\.qidian\\.com');
    expect(qidianRule.advanced?.useIframe).toBe(true);

    const pageContext = {
      pageContext: {
        pageProps: {
          pageData: {
            bookInfo: {
              bookId: 1049115805,
              bookName: '苟在仙宗打铁，悄悄修成道祖',
            },
            chapterInfo: {
              chapterName: '第7章 指间陀螺',
              content: '<p>午后。</p>',
              next: 903937574,
              prev: 903692507,
            },
          },
        },
      },
    };
    const doc = new JSDOM(
      `<!doctype html>
      <html lang="zh-CN">
        <head><title>第7章 指间陀螺 _小说在线阅读 - 起点中文网手机版</title></head>
        <body>
          <script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(
            pageContext
          )}</script>
          <main id="c-903889110"><h1 class="title">第7章 指间陀螺</h1><p>午后。</p></main>
        </body>
      </html>`,
      { url: mobileUrl }
    ).window.document;

    const chapter = await new Parser().parse(doc, mobileUrl);

    expect(chapter?.rule?.id).toBe('qidian-mobile');
    expect(chapter?.sourceScript).toBe('hans');
    expect(chapter?.indexUrl).toBe('https://m.qidian.com/book/1049115805/');
    expect(chapter?.prevUrl).toBe('https://m.qidian.com/chapter/1049115805/903692507/');
    expect(chapter?.nextUrl).toBe('https://m.qidian.com/chapter/1049115805/903937574/');
  });

  it('keeps Qidian mobile content that mentions the chapter title later in the chapter', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const mobileUrl = 'https://m.qidian.com/chapter/1049102364/908854349/';
    const pageContext = {
      pageContext: {
        pageProps: {
          pageData: {
            bookInfo: {
              bookId: 1049102364,
              bookName: '日月同错，谁让他求法的？',
            },
            chapterInfo: {
              chapterName: '第49章 通天箓',
              next: 909035492,
              prev: 908708863,
            },
          },
        },
      },
    };
    const doc = new JSDOM(
      `<!doctype html>
      <html>
        <head><title>第49章 通天箓 _小说在线阅读 - 起点中文网手机版</title></head>
        <body>
          <script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(
            pageContext
          )}</script>
          <main id="c-908854349">
            <h1 class="title">第49章 通天箓</h1>
            <p>公元2020年。</p>
            <p>他停顿了一下，一字一顿地说出那个名字：</p>
            <p>“其名为——通天箓！”</p>
            <p>段星炼和周六晴咀嚼着这个有些陌生的名字：</p>
            <p>“通天箓？”</p>
            <p>“这些知识对于你们来说，是必须的。”</p>
            <p>“如果你们不学习拓扑的知识就强行修炼通天箓。</p>
          </main>
        </body>
      </html>`,
      { url: mobileUrl }
    ).window.document;

    const chapter = await new Parser().parse(doc, mobileUrl);

    expect(chapter?.rule?.id).toBe('qidian-mobile');
    expect(chapter?.content).toContain('“其名为——通天箓！”');
    expect(chapter?.content).toContain('“通天箓？”');
    expect(chapter?.content).toContain('强行修炼通天箓');
  });

  it('normalizes Qidian hydrated content-text paragraph indentation', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const mobileUrl = 'https://m.qidian.com/chapter/1049102364/908854349/';
    const pageContext = {
      pageContext: {
        pageProps: {
          pageData: {
            bookInfo: {
              bookId: 1049102364,
              bookName: '日月同错，谁让他求法的？',
            },
            chapterInfo: {
              chapterName: '第49章 通天箓',
              next: 909035492,
              prev: 908708863,
            },
          },
        },
      },
    };
    const doc = new JSDOM(
      `<!doctype html>
      <html>
        <head><title>第49章 通天箓 _小说在线阅读 - 起点中文网手机版</title></head>
        <body>
          <script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(
            pageContext
          )}</script>
          <main id="c-908854349">
            <h1 class="title">第49章 通天箓</h1>
            <p><span class="content-text" data-count="0" data-index="1">\u3000\u3000公元2020年。</span></p>
            <p><span class="content-text" data-count="1" data-index="2">\u3000\u3000蓬莱岛内。</span></p>
          </main>
        </body>
      </html>`,
      { url: mobileUrl }
    ).window.document;

    const chapter = await new Parser().parse(doc, mobileUrl);

    expect(chapter?.rule?.id).toBe('qidian-mobile');
    expect(chapter?.content).toContain('<span class="content-text">公元2020年。');
    expect(chapter?.content).toContain('<span class="content-text">蓬莱岛内。');
    expect(chapter?.content).not.toContain('>　　公元2020年。');
  });

  it('canonicalizes Qidian mobile book preview to the embedded first chapter', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const bookUrl = 'https://m.qidian.com/book/1049115805/';
    const pageContext = {
      pageContext: {
        pageProps: {
          pageData: {
            chapterContentInfo: {
              firstChapterId: 903299473,
              firstChapterT: '第1章 宗门杂役',
              nextChapterId: 903299284,
            },
          },
        },
        routeParams: {
          bookId: '1049115805',
        },
      },
    };
    const doc = new JSDOM(
      `<!doctype html>
      <html>
        <head><title>苟在仙宗打铁，悄悄修成道祖 小说在线阅读-起点中文网手机端</title></head>
        <body>
          <script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(
            pageContext
          )}</script>
          <h1 class="detail__header-detail__title">苟在仙宗打铁，悄悄修成道祖</h1>
          <div class="_bookDetailTabs_1rj30_193"><span>章节试读</span></div>
          <div id="reader">
            <h2 class="title text-1.3em">
              第1章 宗门杂役<span class="review"><span class="review-count">10</span></span>
            </h2>
            <main id="c-903299473">
              <p>玄天宗，外门杂役堂。</p>
              <p>所有人收拾好行李，一炷香之内到广场集合。</p>
            </main>
          </div>
        </body>
      </html>`,
      { url: bookUrl }
    ).window.document;

    const chapter = await createSectionMerger(new Parser()).merge(doc, bookUrl);

    expect(chapter?.rule?.id).toBe('qidian-mobile');
    expect(chapter?.url).toBe('https://m.qidian.com/chapter/1049115805/903299473/');
    expect(chapter?.title).toBe('第1章 宗门杂役');
    expect(chapter?.indexUrl).toBe('https://m.qidian.com/book/1049115805/');
    expect(chapter?.nextUrl).toBe('https://m.qidian.com/chapter/1049115805/903299284/');
    expect(chapter?.content).toContain('所有人收拾好行李');
  });

  it('parses Ciweimao chapters with typed hook navigation and watermark cleanup', async () => {
    Object.assign(globalThis, {
      GM_deleteValue: () => {},
      GM_getValue: () => null,
      GM_listValues: () => [],
      GM_setValue: () => {},
    });

    const url = 'https://www.ciweimao.com/chapter/113909523';
    const paragraph = Array.from(
      { length: 4 },
      () => '山中队员确认了眼前的异常现象，记录仪仍然保持运转，所有人都在等待下一步命令。'
    ).join('');
    const doc = new JSDOM(
      `<!doctype html>
      <html>
        <head><title>3.山中队员，你是否清醒-刺猬猫</title></head>
        <body>
          <div class="breadcrumb"><a href="/book/1001">无奥世界，但是我加载了骑士卡组</a></div>
          <div class="read-hd"><h1 class="chapter">3.山中队员，你是否清醒</h1></div>
          <div class="book-read-page">
            <a href="/chapter-list/1001">目录</a>
            <a id="J_BtnPagePrev" href="javascript:;" data-href="/chapter/113909522">上一章</a>
            <a id="J_BtnPageNext" href="javascript:;" data-next="/chapter/113909524">下一章</a>
          </div>
          <div id="J_BookCnt" data-id="113909523"></div>
          <div id="J_BookRead">
            <p class="chapter">${paragraph}正文Ab12Cd继续保持连贯。</p>
            <p class="chapter">${paragraph}<span>Qw9Er</span></p>
            <p class="chapter">${paragraph}</p>
          </div>
        </body>
      </html>`,
      { url }
    ).window.document;

    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    let chapter: Awaited<ReturnType<Parser['parse']>>;
    try {
      chapter = await new Parser().parse(doc, url);
    } finally {
      debug.mockRestore();
    }

    expect(ciweimaoRule.hooks?.beforeParse).toBeTypeOf('function');
    expect(ciweimaoRule.advanced?.useIframe).not.toBe(true);
    expect(ciweimaoWapRule.hooks?.beforeParse).toBeTypeOf('function');
    expect(ciweimaoWapRule.advanced?.useIframe).not.toBe(true);
    expect(chapter?.rule?.id).toBe('ciweimao');
    expect(chapter?.title).toBe('3.山中队员，你是否清醒');
    expect(chapter?.bookTitle).toBe('无奥世界，但是我加载了骑士卡组');
    expect(chapter?.prevUrl).toBe('https://www.ciweimao.com/chapter/113909522');
    expect(chapter?.nextUrl).toBe('https://www.ciweimao.com/chapter/113909524');
    expect(chapter?.indexUrl).toBe('https://www.ciweimao.com/chapter-list/1001');
    expect(chapter?.content).toContain('正文继续保持连贯');
    expect(chapter?.content).not.toContain('Ab12Cd');
    expect(chapter?.content).not.toContain('Qw9Er');
  });

  it('builds Ciweimao chapter documents from API and TOC when the shell page is blocked', async () => {
    const win = window as typeof window & { CryptoJS?: unknown };
    const apiParagraph =
      '南夕子认真确认了计划，北斗也点了点头，两人决定继续行动，所有队员都保持警戒。'.repeat(3);
    const decryptedHtml = `<p class="chapter">${apiParagraph}</p><p class="chapter">${apiParagraph}</p><p class="chapter">${apiParagraph}</p>`;
    let decryptCount = 0;
    const crypto = {
      AES: {
        decrypt: vi.fn(() => ({
          toString: vi.fn((encoder?: unknown) => {
            decryptCount += 1;
            if (decryptCount === 1) {
              return win.btoa(win.btoa('1234567890123456second-pass'));
            }
            return encoder ? decryptedHtml : win.btoa(decryptedHtml);
          }),
        })),
      },
      enc: {
        Base64: { parse: vi.fn(value => value) },
        Utf8: {},
      },
      format: {
        OpenSSL: { parse: vi.fn(value => value) },
      },
    };
    win.CryptoJS = crypto;
    vi.stubGlobal('unsafeWindow', win);

    const tocHtml = `<!doctype html><title>无奥世界，但是群友全是奥特曼最新章节</title>
      <a href="https://www.ciweimao.com/chapter/113926737">9.决战！异次元超人！</a>
      <a href="https://www.ciweimao.com/chapter/113927226">10.南夕子：我抄，盒！</a>
      <a href="https://www.ciweimao.com/chapter/113930500">11.月之毁灭者</a>`;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/chapter-list/100452963')) {
        return { ok: true, text: async () => tocHtml };
      }
      if (url.includes('/chapter/ajax_get_session_code')) {
        return { ok: true, json: async () => ({ code: 100000, chapter_access_key: 'abc' }) };
      }
      if (url.includes('/chapter/get_book_chapter_detail_info')) {
        return {
          ok: true,
          json: async () => ({
            code: 100000,
            chapter_content: win.btoa('1234567890123456first-pass'),
            encryt_keys: ['key-a', 'key-b', 'key-c'],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    win.fetch = fetchMock as unknown as typeof fetch;

    const apiDoc = await loadRuleApiDocument('https://www.ciweimao.com/chapter/113927226', {
      chapter: {
        bookTitle: '无奥世界，但是群友全是奥特曼',
        indexUrl: 'https://www.ciweimao.com/chapter-list/100452963',
        url: 'https://www.ciweimao.com/chapter/113926737',
        title: '9.决战！异次元超人！',
        content: '',
        rawContent: '',
        confidence: 1,
        method: 'rule',
        rule: ciweimaoRule,
      },
    });

    expect(apiDoc?.querySelector('#J_BtnPagePrev')?.getAttribute('href')).toBe(
      'https://www.ciweimao.com/chapter/113926737'
    );
    expect(apiDoc?.querySelector('#J_BtnPageNext')?.getAttribute('href')).toBe(
      'https://www.ciweimao.com/chapter/113930500'
    );

    const chapter = await (async () => {
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
      try {
        return apiDoc
          ? await new Parser().parse(apiDoc, 'https://www.ciweimao.com/chapter/113927226')
          : null;
      } finally {
        debug.mockRestore();
      }
    })();
    expect(chapter?.title).toBe('10.南夕子：我抄，盒！');
    expect(chapter?.bookTitle).toBe('无奥世界，但是群友全是奥特曼');
    expect(chapter?.prevUrl).toBe('https://www.ciweimao.com/chapter/113926737');
    expect(chapter?.nextUrl).toBe('https://www.ciweimao.com/chapter/113930500');
    expect(chapter?.content).toContain('南夕子认真确认了计划');
  });
});
