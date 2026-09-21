import { expect, type Locator, type Page, test } from '@playwright/test';
import fs from 'node:fs';

import {
  addYingChuangUserscript,
  assertMnrSmokeState,
  createConsoleCollector,
  createGmMockScript,
  getMnrE2eConfig,
  waitForMnrReader,
} from './mnrE2e';

import {
  makeNovel543Chapter,
  makeNovel543Toc,
  novel543BookTitle,
  novel543ChapterPath,
  novel543Origin,
} from '../testUtils/novel543';

import {
  catalogChapterCount,
  makePagedCatalog,
  makePagedCatalogChapter,
  pagedCatalogSites,
} from '../testUtils/pagedCatalogs';

const targetUrl = 'http://mnr.test/chapter/100.html';

async function copyReaderDiagnostic(page: Page) {
  await page.evaluate(() => {
    const target = window as Window & {
      __mnrDiagnosticText?: string;
      __mnrMenuCommands?: Array<{ caption: string; fn: () => void }>;
    };
    target.__mnrDiagnosticText = '';
    globalThis.GM_setClipboard = text => {
      target.__mnrDiagnosticText = text;
    };
    const command = target.__mnrMenuCommands?.find(item => item.caption === '复制诊断信息');
    if (!command) throw new Error('Diagnostic menu command is missing');
    command.fn();
  });
  const read = () =>
    page.evaluate(
      () => (window as Window & { __mnrDiagnosticText?: string }).__mnrDiagnosticText || ''
    );
  await expect.poll(read).not.toBe('');
  return JSON.parse(await read());
}

for (const site of pagedCatalogSites) {
  for (const width of site.id === 'wxsl' ? [1280, 390] : [390]) {
    test(`${site.id} catalog stays ordered at ${width}px and retries incomplete pagination`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const catalogRequests: number[] = [];
      let failSecondPage = true;
      await context.route(`${site.origin}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname;
        const catalogPage = [1, 2, 3].find(p => site.tocPath(p) === pathname);
        if (catalogPage) {
          catalogRequests.push(catalogPage);
          if (catalogPage === 2 && failSecondPage) {
            failSecondPage = false;
            await route.fulfill({ status: 403, body: '<title>Just a moment...</title>' });
            return;
          }
          await route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: makePagedCatalog(site, catalogPage),
          });
          return;
        }
        const chapter = Array.from({ length: catalogChapterCount }, (_, i) => i + 1).find(
          ch => site.chapterPath(ch) === pathname
        );
        if (!chapter) {
          await route.fulfill({ status: 404, body: '' });
          return;
        }
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: makePagedCatalogChapter(site, chapter),
        });
      });
      await addYingChuangUserscript(context);
      if (site.id === 'kudushu') {
        // addInitScript bypasses the userscript manager's injection gate. Check
        // the delivered header as well, otherwise missing @match goes unnoticed.
        const script = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
        expect(script.split('// ==/UserScript==')[0]).toMatch(
          /^\/\/ @match\s+\*:\/\/m\.kudushu\.org\/html\/\*\/\*\s*$/m
        );
      }
      await page.goto(site.origin + site.chapterPath(25));
      // Do not use the manual-entry fallback to mask a broken automatic startup.
      await expect(page.locator('#mnr-reader-root .mnr-reader')).toBeVisible();
      await waitForMnrReader(page);
      const root = page.locator('#mnr-reader-root');
      await root.getByRole('button', { name: '打开目录', exact: true }).click();
      await expect(root).toContainText('目录加载失败');
      await expect(root.locator('.mnr-chapter-button')).toHaveCount(0);
      expect(catalogRequests).toEqual([1, 2]);
      const failedDiagnostic = await copyReaderDiagnostic(page);
      expect(failedDiagnostic.reader.toc.lastLoad).toMatchObject({
        loader: 'paged',
        outcome: 'failed',
        pages: 1,
        request: { url: site.origin + site.tocPath(2), status: 403 },
      });
      expect(Array.isArray(failedDiagnostic.reader.navigation.loadedUrls.tail)).toBe(true);
      expect(
        failedDiagnostic.recentEvents.some((event: { type: string }) => event.type === 'toc.load')
      ).toBe(true);

      // Cache-all must retry the failed catalog, not offer to cache its first page.
      let cacheConfirmations = 0;
      page.on('dialog', async dialog => {
        cacheConfirmations++;
        await dialog.dismiss();
      });
      await root.getByRole('button', { name: '缓存本书', exact: true }).click();
      await expect(root.locator('.mnr-drawer-position')).toContainText('第 25 / 46 章');
      expect(cacheConfirmations).toBe(0);
      expect(catalogRequests).toEqual([1, 2, 1, 2, 3]);
      const completedDiagnostic = await copyReaderDiagnostic(page);
      expect(completedDiagnostic.reader.toc.lastLoad).toMatchObject({
        outcome: 'complete',
        pages: 3,
        entries: 46,
        reason: 'last-page',
      });
      expect(completedDiagnostic.reader.toc.firstUrls[0]).toBe(site.origin + site.chapterPath(1));
      expect(completedDiagnostic.reader.toc.lastUrls.at(-1)).toBe(
        site.origin + site.chapterPath(46)
      );
      // The drawer virtualizes rows. Check both ends through its scroll surface.
      const list = root.locator('.mnr-drawer-content');
      await list.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(root.locator('.mnr-chapter-button').last()).toHaveText('第46章 测试正文');
      expect((await root.locator('.mnr-chapter-button').allTextContents()).slice(-8)).toEqual(
        Array.from({ length: 8 }, (_, i) => `第${i + 39}章 测试正文`)
      );
      await list.evaluate(el => {
        el.scrollTop = 0;
      });
      await expect(root.locator('.mnr-chapter-button').first()).toHaveText('第1章 测试正文');
      await root.getByRole('button', { name: '第1章 测试正文', exact: true }).click();
      await expect(page).toHaveURL(site.origin + site.chapterPath(1));
      await expect(
        root.locator(`article[data-chapter-url="${site.origin + site.chapterPath(1)}"]`)
      ).toContainText('沿着河岸继续赶路');
    });
  }
}

test('Ciweimao keeps short closing prose across initial parsing and chapter navigation', async ({
  page,
  context,
}) => {
  const origin = 'https://www.ciweimao.com';
  await context.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    const id = Number(url.pathname.match(/^\/chapter\/(\d+)$/)?.[1]);
    if (!id) {
      await route.fulfill({ json: { code: 403 } });
      return;
    }
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><title>第${id}章 山谷归途</title></head><body>
      <div class="breadcrumb"><a href="/book/1001">山谷归途</a></div>
      <div class="read-hd"><h1 class="chapter">第${id}章 山谷归途</h1></div>
      <div class="book-read-page"><a href="/chapter-list/1001">目录</a>
        <a id="J_BtnPagePrev" href="/chapter/${id - 1}">上一章</a>
        <a id="J_BtnPageNext" href="/chapter/${id + 1}">下一章</a></div>
      <div id="J_BookCnt" data-id="${id}"></div><div id="J_BookRead">
      ${`<p class="chapter">${'队员们在山中继续寻找失踪的同伴。'.repeat(20)}</p>`.repeat(6)}
      <p class="chapter">回家。</p><p class="chapter">“我知道了。”</p><p class="chapter">他没有回头</p>
      <p class="chapter">屏幕上写着立即购买，他却关掉了页面。</p>
      <p class="chapter"><span>Qw9Er</span></p></div></body></html>`,
    });
  });
  await addYingChuangUserscript(context);
  await page.goto(`${origin}/chapter/120`);
  await expect(page.locator('#mnr-reader-root .mnr-reader')).toBeVisible();
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  for (const id of [120, 121]) {
    if (id === 121) {
      await page.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(`${origin}/chapter/121`);
    }
    const article = root.locator(`article[data-chapter-url="${origin}/chapter/${id}"]`);
    await expect(article).toContainText('屏幕上写着立即购买，他却关掉了页面。');
    await expect(article).toContainText('回家。');
    await expect(article).toContainText('“我知道了。”');
    await expect(article).toContainText('他没有回头');
    await expect(article).not.toContainText('Qw9Er');
  }
});

test('ixdzs loads its complete API catalog and navigates within the book', async ({
  page,
  context,
}) => {
  const origin = 'https://ixdzs8.com';
  const bookTitle = '高武：变身软妹后，我成了灾厄？';
  const catalogRequests: string[] = [];
  await context.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/novel/clist/') {
      catalogRequests.push(route.request().postData() || '');
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        json: {
          rs: 200,
          data: Array.from({ length: 457 }, (_, i) => ({
            ctype: '0',
            ordernum: String(i + 1),
            title: `第${i + 1}章 目录测试`,
          })),
        },
      });
      return;
    }
    const chapter = Number(url.pathname.match(/p(\d+)\.html$/)?.[1]);
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: chapter
        ? `<!doctype html><html><head><title>第${chapter}章 目录测试_${bookTitle}-爱下电子书</title></head><body>
        <h1 class="page-d-name">第${chapter}章 目录测试</h1>
        <article class="page-content"><section>${'<p>这是目录跳转后的完整正文，用于验证阅读器继续阅读。</p>'.repeat(60)}</section></article>
        <div class="chapter-act"><a class="chapter-pre" href="/read/644554/p${chapter - 1}.html">上一章</a>
        <a href="/read/644554/">书籍页</a>
        <a class="chapter-next" href="/read/644554/p${chapter + 1}.html">下一章</a></div>
        </body></html>`
        : '<a href="/read/999/p1.html">其他小说推荐</a>',
    });
  });
  await addYingChuangUserscript(context);
  await page.goto(`${origin}/read/644554/p120.html`);
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  await root.getByRole('button', { name: '打开目录', exact: true }).click();
  await expect(root.locator('.mnr-drawer-position')).toContainText('/ 457');
  await expect(root.locator('.mnr-chapter-list')).not.toContainText('其他小说推荐');
  await expect(root.locator('.mnr-drawer-title')).toHaveText(bookTitle);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    const layout = await root.locator('.mnr-drawer-title').evaluate(title => {
      const rect = title.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(title);
      const text = range.getBoundingClientRect();
      const close = title.closest('header')!.querySelector('button')!.getBoundingClientRect();
      return {
        compact: rect.height <= 2 * parseFloat(getComputedStyle(title).lineHeight) + 1,
        textFits:
          text.left >= rect.left - 1 &&
          text.right <= rect.right + 1 &&
          text.bottom <= rect.bottom + 1,
        closeFits: close.left >= rect.right && close.right <= innerWidth,
      };
    });
    expect(layout).toEqual({ compact: true, textFits: true, closeFits: true });
    await expect(root.locator('.mnr-drawer-search')).toBeInViewport();
    const titleHeights = await root.locator('.mnr-drawer-title').evaluate(title => {
      const original = title.textContent;
      const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
      title.textContent = '短书名';
      const short = title.getBoundingClientRect().height;
      title.textContent = '这是用于检查目录头部空间的特别长书名'.repeat(8);
      const long = title.getBoundingClientRect().height;
      title.textContent = original;
      return { short, long, lineHeight };
    });
    expect(titleHeights.short).toBeCloseTo(titleHeights.lineHeight);
    expect(titleHeights.long).toBeCloseTo(titleHeights.lineHeight * 2);
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await root.locator('#mnr-chapter-search').fill('第250章');
  await root.getByRole('button', { name: '第250章 目录测试', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/read/644554/p250.html`);
  await expect(root.locator('article[data-chapter-url$="/p250.html"]')).toContainText('完整正文');
  expect(catalogRequests).toEqual(['bid=644554']);
});

const paragraphs = Array.from(
  { length: 72 },
  (_, index) =>
    `<p>这是第 ${index + 1} 段测试正文，用于验证本地固定页面的内容检测、阅读器渲染和退出恢复行为。</p>`
).join('');
const textCleanupFixture = `
  <p>如果伱愿意，我们就继续验证正文防盗字修复。</p>
  <p>记住首发网站域名𝕥𝕨𝕜𝕒𝕟.𝕔𝕠𝕞</p>
  <p>正文中的数学符号 𝕥 应保持原样。</p>
  <p>【放下血仇？那我逢魔时王白当了？】小说免费阅读，请收藏\u3000一七小说【1qxs.com】</p>
  <p><span>仅供自定义过滤</span>的测试尾注 CODE-REMOVE-42</p>
  <p>正文里提到 CODE-KEEP-42，不应被默认规则删除。</p>
  <p class="br-delimited-prose">
    &nbsp;&nbsp;&nbsp;&nbsp;换行正文第一段。<br>
    &nbsp;&nbsp;&nbsp;&nbsp;换行正文第二段。<br>
    &nbsp;&nbsp;&nbsp;&nbsp;换行正文第三段。
  </p>
`;
const tocLinks = Array.from(
  { length: 1200 },
  (_, index) => `<a href="/chapter/${index + 1}.html">第 ${index + 1} 章</a>`
).join('');

const fixtureHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>第100章 本地测试 - 测试小说</title>
    <style>
      button { padding: 0 14px 0 2px !important; line-height: 3 !important; text-align: left !important; }
      button svg { margin-left: 6px !important; vertical-align: baseline !important; }
    </style>
  </head>
  <body>
    <main id="host-page">
      <h1>第100章 本地测试</h1>
      <div id="content">${paragraphs}${textCleanupFixture}</div>
      <nav>
        <a href="/chapter/99.html">上一章</a>
        <a href="/book/1/index.html">目录</a>
        <a href="/chapter/101.html">下一章</a>
      </nav>
    </main>
  </body>
</html>`;

const sto9FixtureUrl = 'https://sto9.com/txt/7974/7627078.html';
const sto9ChapterListUrl = 'https://sto9.com/ajax_novels/chapterlist/7974.html';

function makeSto9Fixture(options: {
  chapterTitle: string;
  nextChapterId: string;
  prevChapterId: string;
}): string {
  const content = Array.from(
    { length: 42 },
    (_, index) =>
      `&emsp;&emsp;${options.chapterTitle}第 ${index + 1} 段正文，用於驗證思兔站點解析與完整目錄。<br><br>`
  ).join('');

  return `<!doctype html>
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8">
        <title>測試小說_${options.chapterTitle}|思兔sto9</title>
      </head>
      <body>
        <div class="bread">
          <a href="/">首頁</a>
          <a href="/book/7974/index.html">測試小說</a>
        </div>
        <div class="txtnav">
          <h1>${options.chapterTitle}</h1>
          <div class="txtright">右側文字廣告</div>
          <div class="txtad">正文頂部廣告</div>
          &emsp;&emsp;s🎤to9.com為您提供最快的小說更新<br><br>
          ${content}
          &emsp;&emsp;黒竜看著著作，連忙穿過乾涸的河床。車龍神福。<br><br>
          <div class="txtcenter">章中廣告</div>
          &emsp;&emsp;（還有更新耶）
        </div>
        <div class="page1">
          <a href="/txt/7974/${options.prevChapterId}.html">上一章</a>
          <a href="/book/7974/index.html">目錄</a>
          <a href="/txt/7974/${options.nextChapterId}.html">下一章</a>
        </div>
      </body>
    </html>`;
}

const sto9ChapterListHtml = `
  <ul>
    <li data-num="764"><a href="/txt/7974/7626167.html">第764章 前一章</a></li>
    <li data-num="765"><a href="/txt/7974/7627078.html">第765章 生死存亡！</a></li>
    <li data-num="766"><a href="/txt/7974/7628065.html">第766章 援軍到了！</a></li>
  </ul>
`;

const nextFixtureHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>第101章 手势续读 - 测试小说</title>
  </head>
  <body>
    <main>
      <h1>第101章 手势续读</h1>
      <div id="content">${paragraphs.replaceAll('本地固定页面', '移动端手势')}</div>
      <nav>
        <a href="/chapter/100.html">上一章</a>
        <a href="/book/1/index.html">目录</a>
        <a href="/chapter/102.html">下一章</a>
      </nav>
    </main>
  </body>
</html>`;

function makeContinuousChapterFixture(chapterNumber: number): string {
  const rowCount = 32 + (chapterNumber % 3) * 8;
  const content = Array.from(
    { length: rowCount },
    (_, index) => `<p>第${chapterNumber}章第 ${index + 1} 段连续阅读窗口裁剪测试正文。</p>`
  ).join('');

  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>第${chapterNumber}章 连续阅读 - 测试小说</title>
      </head>
      <body>
        <main>
          <h1>第${chapterNumber}章 连续阅读</h1>
          <div id="content">${content}</div>
          <nav>
            <a href="/chapter/${Math.max(1, chapterNumber - 1)}.html">上一章</a>
            <a href="/book/1/index.html">目录</a>
            <a href="/chapter/${chapterNumber + 1}.html">下一章</a>
          </nav>
        </main>
      </body>
    </html>`;
}

const hetushuFirstUrl = 'https://www.hetushu.com/book/9145/6567989.html';
const hetushuSecondUrl = 'https://www.hetushu.com/book/9145/6567990.html';

function makeHetushuFixture(options: {
  chapterTitle: string;
  nextUrl: string;
  prevUrl: string;
}): string {
  const contentRows = Array.from(
    { length: 56 },
    (_, index) =>
      `<div class="shown">${options.chapterTitle}第 ${index + 1} 段正常正文，验证和图书翻页解析不会把 JS Detection 当成挑战页。<acronym>www.hetushu.com</acronym></div>`
  ).join('');

  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <title>木叶：让宇智波再次伟大_${options.chapterTitle}_虚空吟唱者_和图书</title>
        <style>#content .shown { display: block; }</style>
        <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
      </head>
      <body>
        <div id="left"><h3><a href="/book/9145/index.html">木叶：让宇智波再次伟大</a></h3></div>
        <a id="pre" href="${options.prevUrl}">上一章</a>
        <a id="next" href="${options.nextUrl}">下一章</a>
        <div id="content"><h2>${options.chapterTitle}</h2>${contentRows}</div>
      </body>
    </html>`;
}

const ttksBookPath = '/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian';

function makeTtksFixture(options: {
  body: string;
  chapterTitle: string;
  nextChapter: number;
  prevChapter: number;
  trailingNoise: string;
}): string {
  return `<!doctype html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <title>⚡ 《開局相親女神捕，獲獨孤九劍》 ${options.chapterTitle} - ⚡ 天天看小說</title>
      </head>
      <body>
        <div class="frame_body">
          <div class="breadcrumb_nav">
            <a href="/">首頁</a>
            <a href="${ttksBookPath}/index.html">《開局相親女神捕，獲獨孤九劍》</a>
          </div>
          <div class="title"><h1>${options.chapterTitle}</h1></div>
          <div class="content">
            <a class="anchor_bookmark" href="/bookmark">書籤圖示</a>
            <div class="txtcenter">loadAdv(1, 0);</div>
            <p>${options.chapterTitle}</p>
            ${options.body}
            <p>${options.trailingNoise}</p>
            <div class="txtcenter">loadAdv(3, 0);</div>
            <div class="div_feedback">添加書籤 返回目錄 章節報錯</div>
            <div class="social_share_frame">分享給朋友</div>
          </div>
          <div class="content">
            <a id="linkPrev" href="${ttksBookPath}/${options.prevChapter}.html">上一章</a>
            <a id="linkNext" href="${ttksBookPath}/${options.nextChapter}.html">下一章</a>
          </div>
        </div>
      </body>
    </html>`;
}

async function dispatchReaderTouch(
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend',
  point: { x: number; y: number }
): Promise<void> {
  await page.locator('#mnr-reader-root').evaluate(
    (host, input) => {
      const main = host.shadowRoot?.querySelector('.mnr-reader-main');
      if (!main) throw new Error('reader main element not found');

      const touch = { identifier: 1, clientX: input.point.x, clientY: input.point.y };
      const event = new Event(input.type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: input.type === 'touchend' ? [] : [touch] },
        changedTouches: { value: [touch] },
      });
      main.dispatchEvent(event);
    },
    { type, point }
  );
}

async function disableReaderPreload(readerRoot: Locator): Promise<void> {
  await readerRoot.locator('[aria-label="打开设置"]').click();
  const behaviorSettings = readerRoot.locator('details').filter({ hasText: '阅读行为' });
  await behaviorSettings.locator('summary').click();
  await expect(behaviorSettings).toHaveAttribute('open', '');

  const gestureSetting = readerRoot.locator('.mnr-switch-row').filter({ hasText: '左右滑动翻屏' });
  await expect(gestureSetting.locator('input')).toBeChecked();

  const preloadSetting = readerRoot
    .locator('.mnr-switch-row')
    .filter({ hasText: '自动加载下一章' });
  await preloadSetting.locator('input').uncheck();
  await readerRoot.locator('.mnr-close-btn').click();
}

function makeGobooPage(pageNumber: number, nextHref: string, nextText = '下一页'): string {
  const visible = `第${pageNumber}页可见正文。`.repeat(48);
  const hidden = `第${pageNumber}页编码后续正文。`.repeat(48);
  const encoded = Buffer.from(`<p>${hidden}</p>`, 'utf8').toString('base64');
  const prevHref = pageNumber === 1 ? 'javascript:void(0);' : `/gb_1/94443/1/${pageNumber - 1}`;

  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <title>001 本地分页测试(${pageNumber}/3) - 测试书小说 - 钢笔小说</title>
      </head>
      <body>
        <h1>001 本地分页测试(${pageNumber}/3)</h1>
        <div class="content">
          <p>【测试书】小说免费阅读，请收藏 钢笔小说【goboo.cc】</p>
          <p>${visible}</p>
          <p>阅|读|模|式|或|畅|读|模|式|下，无|法|显|示|本|章|节|全|部|内|容，请|返|回|原|网|页阅|读。<button>加|载|更|多</button></p>
        </div>
        <div class="page">
          <span class="left"><a href="${prevHref}">上一页</a></span>
          <span class="center"><a href="/ml_1/94443?cid=1">目录</a></span>
          <span class="right"><a href="${nextHref}">${nextText}</a></span>
        </div>
        <script>const p_key='${encoded}';</script>
      </body>
    </html>`;
}

function makeGobooNextChapter(): string {
  const content = '第2章已由共享自动加载器成功预载。'.repeat(96);

  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <title>002 通用自动预载回归 - 测试书小说 - 钢笔小说</title>
      </head>
      <body>
        <h1>002 通用自动预载回归</h1>
        <div class="content"><p>${content}</p></div>
        <div class="page">
          <a class="left" href="/gb_1/94443/1">上一章</a>
          <a class="center" href="/ml_1/94443?cid=2">目录</a>
          <a class="right" href="/gb_1/94443/3">下一章</a>
        </div>
      </body>
    </html>`;
}

function expectCentered(alignment: { x: number; y: number } | null): void {
  expect(alignment).not.toBeNull();
  expect(Math.abs(alignment?.x ?? Infinity)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(alignment?.y ?? Infinity)).toBeLessThanOrEqual(0.5);
}

async function getIconAlignments(
  buttons: Locator
): Promise<Array<{ x: number; y: number } | null>> {
  return buttons.evaluateAll(elements =>
    elements.map(button => {
      const icon = button.querySelector('svg');
      if (!icon) return null;

      const buttonRect = button.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        x: iconRect.left + iconRect.width / 2 - (buttonRect.left + buttonRect.width / 2),
        y: iconRect.top + iconRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
      };
    })
  );
}

test('runs the built userscript and restores the host page after exit', async ({
  context,
  page,
}) => {
  await context.route(targetUrl, route =>
    route.fulfill({
      body: fixtureHtml.replace('<a href="/chapter/101.html">下一章</a>', ''),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route('http://mnr.test/book/1/index.html', route =>
    route.fulfill({
      body: `<!doctype html><html><body><main>${tocLinks}</main></body></html>`,
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await addYingChuangUserscript(context);

  const logs = createConsoleCollector(page);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const state = await waitForMnrReader(page);
  assertMnrSmokeState(state);
  expect(state.href).toBe(targetUrl);
  expect(state.shadowTitle).toContain('第100章');
  const readerContent = page.locator('#mnr-reader-root').locator('.mnr-reader-content');
  await expect(readerContent).toContainText('如果你愿意');
  await expect(readerContent).toContainText('正文中的数学符号 𝕥 应保持原样');
  await expect(readerContent).not.toContainText('伱');
  await expect(readerContent).not.toContainText('首发网站域名');
  await expect(readerContent).not.toContainText('一七小说');
  await expect(readerContent).toContainText('仅供自定义过滤的测试尾注 CODE-REMOVE-42');
  await expect(readerContent).toContainText('正文里提到 CODE-KEEP-42');
  await expect(readerContent.locator('p.br-delimited-prose')).toHaveCount(3);
  await expect(readerContent.locator('p.br-delimited-prose').nth(1)).toHaveText('换行正文第二段。');

  const primaryUi = await page.locator('#mnr-reader-root').evaluate(host => {
    const shadow = host.shadowRoot;
    return {
      toolbarButtons: shadow?.querySelectorAll('.mnr-floating-toolbar .mnr-fab').length ?? 0,
      hasDirectory: !!shadow?.querySelector('[aria-label="打开目录"]'),
      hasSettings: !!shadow?.querySelector('[aria-label="打开设置"]'),
      settingsGearCircle: !!shadow?.querySelector('[aria-label="打开设置"] svg circle'),
      settingsGearPath:
        shadow?.querySelector('[aria-label="打开设置"] svg path')?.getAttribute('d') ?? '',
      hasToolbarCache: !!shadow?.querySelector('[aria-label="缓存管理"]'),
      boundaryNavigation: shadow?.querySelectorAll('.mnr-chapter-boundary-nav').length ?? 0,
    };
  });
  expect(primaryUi).toEqual({
    toolbarButtons: 2,
    hasDirectory: true,
    hasSettings: true,
    settingsGearCircle: true,
    settingsGearPath: expect.stringContaining('M12.22 2h-.44'),
    hasToolbarCache: false,
    boundaryNavigation: 0,
  });
  const toolbarIconAlignment = await getIconAlignments(
    page.locator('#mnr-reader-root').locator('.mnr-fab')
  );
  expect(toolbarIconAlignment).toHaveLength(2);
  toolbarIconAlignment.forEach(expectCentered);

  const indexLink = page.locator('#mnr-reader-root').locator('.mnr-chapter-link.index');
  await expect(indexLink).toHaveAttribute('href', 'http://mnr.test/book/1/index.html');
  const preventedBeforeTestGuard = await indexLink.evaluate(link => {
    let prevented = true;
    link.addEventListener(
      'click',
      event => {
        prevented = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true }
    );
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return prevented;
  });
  expect(preventedBeforeTestGuard).toBe(false);

  await page.locator('#mnr-reader-root').locator('[aria-label="打开目录"]').click();
  await expect
    .poll(() =>
      page.locator('#mnr-reader-root').evaluate(host => {
        const shadow = host.shadowRoot;
        return {
          drawerOpen: shadow?.querySelector('.mnr-drawer')?.classList.contains('open') ?? false,
          renderedRows: shadow?.querySelectorAll('.mnr-chapter-button').length ?? 0,
          searchVisible: !!shadow?.querySelector('#mnr-chapter-search'),
          totalText: shadow?.querySelector('.mnr-drawer-position')?.textContent?.trim() ?? '',
        };
      })
    )
    .toMatchObject({ drawerOpen: true, searchVisible: true });
  const renderedToc = await page.locator('#mnr-reader-root').evaluate(host => {
    const shadow = host.shadowRoot;
    return {
      renderedRows: shadow?.querySelectorAll('.mnr-chapter-button').length ?? 0,
      totalText: shadow?.querySelector('.mnr-drawer-position')?.textContent?.trim() ?? '',
      offlineTitle: shadow?.querySelector('#mnr-offline-title')?.textContent?.trim() ?? '',
      offlineStatus: shadow?.querySelector('.mnr-offline-copy span')?.textContent?.trim() ?? '',
      offlineAction:
        shadow?.querySelector('.mnr-offline-action.primary')?.textContent?.trim() ?? '',
      temporaryCacheMarks: shadow?.querySelectorAll('[aria-label="已临时缓存"]').length ?? 0,
    };
  });
  expect(renderedToc.renderedRows).toBeGreaterThan(0);
  expect(renderedToc.renderedRows).toBeLessThan(50);
  expect(renderedToc.totalText).toContain('1200');
  expect(renderedToc.offlineTitle).toBe('离线阅读');
  expect(renderedToc.offlineStatus).toBe('尚未缓存');
  expect(renderedToc.offlineAction).toBe('缓存本书');
  expect(renderedToc.temporaryCacheMarks).toBe(0);
  const [drawerCloseAlignment] = await getIconAlignments(
    page.locator('#mnr-reader-root').locator('.mnr-drawer-close')
  );
  expectCentered(drawerCloseAlignment ?? null);
  await page.keyboard.press('Escape');

  await page.locator('#mnr-reader-root').locator('[aria-label="打开设置"]').click();
  await expect
    .poll(() =>
      page.locator('#mnr-reader-root').evaluate(host => {
        const shadow = host.shadowRoot;
        return {
          visible: !!shadow?.querySelector('.mnr-settings-panel'),
          groups: Array.from(shadow?.querySelectorAll('details > summary') ?? [], summary =>
            summary.textContent?.trim()
          ),
          sliders: shadow?.querySelectorAll('input[type="range"]').length ?? 0,
          mainInert: shadow?.querySelector('.mnr-reader-main')?.hasAttribute('inert') ?? false,
          activeId: shadow?.activeElement?.id ?? '',
          drawerOpen: shadow?.querySelector('.mnr-drawer')?.classList.contains('open') ?? false,
          settingsCacheAction: !!shadow?.querySelector('.mnr-settings-panel .mnr-cache-action'),
        };
      })
    )
    .toEqual({
      visible: true,
      groups: ['排版细节', '阅读行为', '本站与高级', '规则语法与数量限制'],
      sliders: 6,
      mainInert: true,
      activeId: 'mnr-settings-title',
      drawerOpen: false,
      settingsCacheAction: false,
    });

  const fontSizeControl = page.locator('#mnr-reader-root').locator('#mnr-font-size');
  await expect(fontSizeControl).toHaveAttribute('aria-labelledby', 'mnr-font-size-label');
  const fontSizeBox = await fontSizeControl.boundingBox();
  expect(fontSizeBox?.height).toBeGreaterThanOrEqual(32);

  const setReadingRange = async (id: string, value: number) => {
    await page
      .locator('#mnr-reader-root')
      .locator(`#${id}`)
      .evaluate((input, nextValue) => {
        const range = input as HTMLInputElement;
        range.value = String(nextValue);
        range.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }, value);
  };
  await setReadingRange('mnr-line-height', 2.4);
  await setReadingRange('mnr-paragraph-indent', 3);
  await setReadingRange('mnr-padding', 48);
  await expect
    .poll(() =>
      readerContent.first().evaluate(article => {
        const paragraph = article.querySelector('p.br-delimited-prose');
        const articleStyle = getComputedStyle(article);
        const paragraphStyle = paragraph ? getComputedStyle(paragraph) : null;
        return {
          lineHeight: articleStyle.lineHeight,
          paddingLeft: articleStyle.paddingLeft,
          textIndent: paragraphStyle?.textIndent ?? '',
        };
      })
    )
    .toEqual({ lineHeight: '43.2px', paddingLeft: '48px', textIndent: '54px' });
  await page.locator('#mnr-reader-root').getByRole('button', { name: '恢复默认外观' }).click();
  await page.locator('#mnr-reader-root').locator('#mnr-settings-title').focus();

  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.locator('#mnr-reader-root').evaluate(host => ({
        activeLabel: host.shadowRoot?.activeElement?.getAttribute('aria-label') ?? '',
        drawerOpen:
          host.shadowRoot?.querySelector('.mnr-drawer')?.classList.contains('open') ?? false,
      }))
    )
    .toEqual({ activeLabel: '关闭设置', drawerOpen: false });

  await page.locator('#mnr-reader-root').getByRole('button', { name: '繁體' }).click();
  await expect(
    page.locator('#mnr-reader-root').locator('.mnr-reader-content').first()
  ).toHaveAttribute('lang', 'zh-TW');
  await page.locator('#mnr-reader-root').getByRole('button', { name: '原文' }).click();

  const advancedSettings = page
    .locator('#mnr-reader-root')
    .locator('details')
    .filter({ hasText: '本站与高级' });
  await advancedSettings.locator(':scope > summary').click();
  const siteAutoEnable = advancedSettings.locator('.mnr-switch-row').filter({
    hasText: '在本站自动开启',
  });
  await siteAutoEnable.locator('input').uncheck();
  await expect(siteAutoEnable.locator('input')).not.toBeChecked();
  await siteAutoEnable.locator('input').check();
  await expect(siteAutoEnable.locator('input')).toBeChecked();

  const customCss = advancedSettings.locator('textarea#mnr-custom-css');
  const customCleanupDraft = advancedSettings.locator('#mnr-custom-cleanup-draft');
  const addCustomCleanup = advancedSettings.getByRole('button', { name: '添加规则' });
  const customCleanup = advancedSettings.locator('#mnr-custom-cleanup-regex');
  await expect(advancedSettings.locator('#mnr-custom-cleanup-site')).toContainText('mnr.test');
  const editorStyles = await Promise.all(
    [customCss, customCleanup].map(editor =>
      editor.evaluate(element => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderRadius: style.borderRadius,
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          padding: style.padding,
          resize: style.resize,
        };
      })
    )
  );
  expect(editorStyles[1]).toEqual(editorStyles[0]);
  const customCssBox = await customCss.boundingBox();
  const customCleanupBox = await customCleanup.boundingBox();
  expect(customCleanupBox!.y).toBeGreaterThan(customCssBox!.y + customCssBox!.height);
  const settingsLayout = await page.locator('#mnr-reader-root').evaluate(host => {
    const root = host.shadowRoot;
    const content = root?.querySelector('.mnr-settings-content');
    const footer = root?.querySelector('.mnr-settings-footer');
    return {
      contentClientHeight: content?.clientHeight ?? 0,
      contentScrollHeight: content?.scrollHeight ?? 0,
      footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(settingsLayout.contentScrollHeight).toBeGreaterThan(settingsLayout.contentClientHeight);
  expect(settingsLayout.footerBottom).toBe(page.viewportSize()?.height);

  await customCleanup.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(customCleanupDraft).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(customCss).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(customCleanupDraft).toBeFocused();

  await customCleanup.fill('第一条');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二条');
  await expect(customCleanup).toHaveValue('第一条\n第二条');
  expect(page.url()).toBe(targetUrl);
  await expect(page.locator('#mnr-reader-root').locator('.mnr-settings-panel')).toBeVisible();

  await customCleanup.fill('');
  await customCleanupDraft.fill('^仅供自定义过滤的测试尾注 CODE-REMOVE-42$');
  await addCustomCleanup.click();
  await expect(customCleanup).toHaveValue(
    '@host=mnr.test ^仅供自定义过滤的测试尾注 CODE-REMOVE-42$'
  );
  await expect(customCleanupDraft).toHaveValue('');
  await expect(readerContent).not.toContainText('仅供自定义过滤的测试尾注 CODE-REMOVE-42');
  await expect(readerContent).toContainText('正文里提到 CODE-KEEP-42');

  await customCleanup.fill('');
  await customCleanup.focus();

  await customCleanup.fill('^仅供自定义过滤的测试尾注 CODE-REMOVE-42$');
  await expect(readerContent).not.toContainText('仅供自定义过滤的测试尾注 CODE-REMOVE-42');
  await expect(readerContent).toContainText('正文里提到 CODE-KEEP-42');

  await customCleanup.fill('[');
  await expect(readerContent).toContainText('仅供自定义过滤的测试尾注 CODE-REMOVE-42');
  await expect(advancedSettings.locator('#mnr-custom-cleanup-error')).toContainText('第 1 行');

  await customCleanup.fill('');
  await expect(advancedSettings.locator('#mnr-custom-cleanup-error')).toHaveCount(0);

  const typographyDetails = page
    .locator('#mnr-reader-root')
    .locator('details')
    .filter({ hasText: '排版细节' });
  await typographyDetails.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(typographyDetails).toHaveAttribute('open', '');
  expect(page.url()).toBe(targetUrl);

  await page.keyboard.press('q');
  await expect(page.locator('#mnr-reader-root')).toHaveCount(1);
  const [settingsCloseAlignment] = await getIconAlignments(
    page.locator('#mnr-reader-root').locator('.mnr-close-btn')
  );
  expectCentered(settingsCloseAlignment ?? null);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mnr-reader-root').locator('.mnr-settings-panel')).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator('#mnr-reader-root').evaluate(host => ({
        mainInert: host.shadowRoot?.querySelector('.mnr-reader-main')?.hasAttribute('inert'),
        activeLabel: host.shadowRoot?.activeElement?.getAttribute('aria-label') ?? '',
      }))
    )
    .toEqual({ mainInert: false, activeLabel: '打开设置' });

  await page.keyboard.press('q');
  await expect.poll(() => page.locator('#mnr-reader-root').count()).toBe(0);

  await expect(page.locator('#host-page')).toBeVisible();
  await expect(page.locator('#mnr-hide-original')).toHaveCount(0);
  const readerEntry = page.locator('#mnr-entry-root').locator('#mnr-entry-button');
  await expect(readerEntry).toBeVisible();
  await expect(readerEntry).toHaveText('进入阅读模式');
  await expect(readerEntry).toHaveCSS('background-color', 'rgb(0, 102, 204)');
  await expect(readerEntry).toHaveCSS('box-shadow', 'rgba(0, 0, 0, 0.2) 0px 6px 18px 0px');
  const entryAlignment = await readerEntry.evaluate(button => {
    const icon = button.querySelector('svg');
    if (!icon) return null;
    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      y: iconRect.top + iconRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
    };
  });
  expect(Math.abs(entryAlignment?.y ?? Infinity)).toBeLessThanOrEqual(0.5);
  await expect(page).toHaveTitle('第100章 本地测试 - 测试小说');
  expect(logs.some(line => line.includes('pageerror'))).toBe(false);
});

test('applies the Sto9 adapter and loads its complete dynamic catalog', async ({
  context,
  page,
}) => {
  await context.route(/https:\/\/sto9\.com\/txt\/7974\/\d+\.html/, route => {
    const chapterId = new URL(route.request().url()).pathname.match(/\/(\d+)\.html$/)?.[1];
    const isCurrent = chapterId === '7627078';
    return route.fulfill({
      body: makeSto9Fixture({
        chapterTitle: isCurrent ? '第765章 生死存亡！' : '第766章 援軍到了！',
        nextChapterId: isCurrent ? '7628065' : '7629000',
        prevChapterId: isCurrent ? '7626167' : '7627078',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });
  await context.route(sto9ChapterListUrl, route =>
    route.fulfill({
      body: sto9ChapterListHtml,
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await addYingChuangUserscript(context);

  await page.goto(sto9FixtureUrl, { waitUntil: 'domcontentloaded' });
  const state = await waitForMnrReader(page);
  assertMnrSmokeState(state);
  expect(state.shadowTitle).toBe('第765章 生死存亡！');

  const readerRoot = page.locator('#mnr-reader-root');
  const readerContent = readerRoot.locator('.mnr-reader-content');
  await expect(readerContent).toContainText('用於驗證思兔站點解析與完整目錄');
  await expect(readerContent).not.toContainText('文字廣告');
  await expect(readerContent).not.toContainText('章中廣告');
  await expect(readerContent).not.toContainText('還有更新耶');
  const normalizedReaderText = ((await readerContent.textContent()) || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  expect(normalizedReaderText).not.toContain('sto9com');

  await readerRoot.locator('[aria-label="打开目录"]').click();
  await expect
    .poll(() =>
      readerRoot.evaluate(host => {
        const shadow = host.shadowRoot;
        return {
          rows: shadow?.querySelectorAll('.mnr-chapter-button').length || 0,
          position: shadow?.querySelector('.mnr-drawer-position')?.textContent?.trim() || '',
        };
      })
    )
    .toEqual({ rows: 3, position: '第 2 / 3 章' });
  await expect(readerRoot.locator('.mnr-chapter-button.active')).toContainText('第765章');

  await readerRoot.getByRole('button', { name: '关闭目录', exact: true }).click();
  const originalContent = await readerContent.first().innerHTML();
  await readerRoot.getByRole('button', { name: '打开设置', exact: true }).click();
  await readerRoot.getByRole('button', { name: '简体', exact: true }).click();
  await expect(readerContent.first()).toContainText('黑龙看着著作，连忙穿过干涸的河床。车龙神福。');
  await readerRoot.getByRole('button', { name: '关闭设置', exact: true }).click();
  await readerRoot.getByRole('button', { name: '打开目录', exact: true }).click();
  await expect(readerRoot.locator('.mnr-chapter-button').last()).toContainText('援军到了');

  await readerRoot.getByRole('button', { name: '关闭目录', exact: true }).click();
  await readerRoot.getByRole('button', { name: '打开设置', exact: true }).click();
  for (const mode of ['繁體', '原文']) {
    await readerRoot.getByRole('button', { name: mode, exact: true }).click();
    await expect(readerContent.first()).toHaveJSProperty('innerHTML', originalContent);
  }
});

test('keeps normal Cloudflare JS Detection pages readable across previous navigation', async ({
  context,
  page,
}) => {
  await context.route(hetushuSecondUrl, route =>
    route.fulfill({
      body: makeHetushuFixture({
        chapterTitle: '第二章 宇智波止水',
        nextUrl: '/book/9145/6567991.html',
        prevUrl: '/book/9145/6567989.html',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route(hetushuFirstUrl, route =>
    route.fulfill({
      body: makeHetushuFixture({
        chapterTitle: '第一章 还不如不激活呢',
        nextUrl: '/book/9145/6567990.html',
        prevUrl: '/book/9145/6567988.html',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route('**/cdn-cgi/challenge-platform/scripts/jsd/main.js', route =>
    route.fulfill({ body: '', contentType: 'text/javascript', status: 200 })
  );
  await addYingChuangUserscript(context);

  await page.goto(hetushuSecondUrl, { waitUntil: 'domcontentloaded' });
  const readerRoot = page.locator('#mnr-reader-root');
  await expect(readerRoot).toHaveCount(1);
  await expect(readerRoot.locator(`article[data-chapter-url="${hetushuSecondUrl}"]`)).toContainText(
    '第二章 宇智波止水'
  );
  await expect(page.locator('script[src*="/challenge-platform/scripts/jsd/"]')).toHaveCount(1);

  await readerRoot.locator('.mnr-reader-main').focus();
  await page.keyboard.press('ArrowLeft');

  await expect.poll(() => page.url()).toBe(hetushuFirstUrl);
  await expect(readerRoot.locator(`article[data-chapter-url="${hetushuFirstUrl}"]`)).toContainText(
    '第一章 还不如不激活呢'
  );
});

test('auto-starts TTKS and preloads through a short author-note chapter', async ({
  context,
  page,
}) => {
  const firstUrl = `https://ttks.tw${ttksBookPath}/83.html`;
  const noteUrl = `https://ttks.tw${ttksBookPath}/84.html`;
  const thirdUrl = `https://ttks.tw${ttksBookPath}/85.html`;
  let noteRequests = 0;
  let thirdRequests = 0;

  await context.route(firstUrl, route =>
    route.fulfill({
      body: makeTtksFixture({
        chapterTitle: '第82章 真黑袍（求月票）',
        body: `
          <p>第一段正常正文。</p>
          <p>第一節結尾正文。\u3000\u3000【寫到這裡我希望讀者記一下我們域名 天天看小說超貼心，𝗍𝗍𝗄𝗌.𝗍𝗐等你尋 】</p>
          <p>${'本章後續正常正文。'.repeat(80)}</p>
          <p>本章結尾正文。</p>
        `,
        nextChapter: 84,
        prevChapter: 82,
        trailingNoise: '福',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route(noteUrl, route => {
    noteRequests += 1;
    return route.fulfill({
      body: makeTtksFixture({
        chapterTitle: '求點月票！',
        body: '<p>如題，兄弟們，雙倍月票最後一天了，不要留在手機了呀！</p><p>問道在此跪求一波月票！</p>',
        nextChapter: 85,
        prevChapter: 83,
        trailingNoise: '&gt;',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });
  await context.route(thirdUrl, route => {
    thirdRequests += 1;
    return route.fulfill({
      body: makeTtksFixture({
        chapterTitle: '第83章 大劫指對七絕旋風腿',
        body: `<p>${'下一章正常正文。'.repeat(80)}</p><p>下一章結尾正文。</p>`,
        nextChapter: 86,
        prevChapter: 84,
        trailingNoise: '&gt;',
      }),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });
  await addYingChuangUserscript(context);

  await page.goto(firstUrl, { waitUntil: 'domcontentloaded' });
  const readerRoot = page.locator('#mnr-reader-root');
  await expect(readerRoot).toHaveCount(1);
  await expect(readerRoot).toHaveAttribute('lang', 'zh-CN');
  expect(
    await readerRoot.evaluate(host =>
      host.shadowRoot?.querySelector('.mnr-reader')?.matches(':lang(zh-CN)')
    )
  ).toBe(true);
  await expect(page.locator('#mnr-entry-root, #mnr-entry-prompt-root')).toHaveCount(0);

  const firstChapter = readerRoot.locator(`article[data-chapter-url="${firstUrl}"]`);
  await expect(firstChapter.locator('.mnr-chapter-title')).toHaveText('第82章 真黑袍（求月票）');
  await expect(firstChapter).toContainText('第一節結尾正文。');
  await expect(firstChapter).toContainText('本章結尾正文。');
  await expect(firstChapter).not.toContainText('天天看小說');
  await expect(firstChapter).not.toContainText('loadAdv');
  await expect(firstChapter).not.toContainText('添加書籤');
  await expect(firstChapter).not.toContainText('福');

  const noteChapter = readerRoot.locator(`article[data-chapter-url="${noteUrl}"]`);
  await expect(noteChapter.locator('.mnr-chapter-title')).toHaveText('求點月票！', {
    timeout: 10_000,
  });
  await expect(noteChapter).toContainText('雙倍月票最後一天');
  await expect(noteChapter).toContainText('問道在此跪求一波月票');
  const thirdChapter = readerRoot.locator(`article[data-chapter-url="${thirdUrl}"]`);
  await expect(thirdChapter.locator('.mnr-chapter-title')).toHaveText('第83章 大劫指對七絕旋風腿', {
    timeout: 10_000,
  });
  await expect(thirdChapter).toContainText('下一章結尾正文。');
  await expect.poll(() => page.url()).toBe(firstUrl);
  expect(noteRequests).toBe(1);
  expect(thirdRequests).toBe(1);

  await readerRoot.locator('.mnr-reader-main').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.url()).toBe(noteUrl);
  expect(noteRequests).toBe(1);
  expect(thirdRequests).toBe(1);

  await page.waitForTimeout(700);
  await readerRoot.locator('.mnr-reader-main').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.url()).toBe(thirdUrl);
  expect(noteRequests).toBe(1);
  expect(thirdRequests).toBe(1);
});

test('keeps detection details internal and hands a dismissed prompt off to manual entry', async ({
  context,
  page,
}) => {
  const promptUrl = 'http://mnr.test/chapter/200.html';
  const promptHtml = `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <title>第200章 安静的正文 - 测试小说</title>
        <style>button { all: unset !important; width: 1px !important; height: 1px !important; }</style>
      </head>
      <body>
        <h1>第200章 安静的正文</h1>
        <div id="content">${paragraphs}</div>
      </body>
    </html>`;

  await context.route(promptUrl, route =>
    route.fulfill({
      body: promptHtml,
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await addYingChuangUserscript(context);
  const logs = createConsoleCollector(page);
  await page.goto(promptUrl, { waitUntil: 'domcontentloaded' });

  const prompt = page.locator('#mnr-entry-prompt-root');
  await expect(prompt.locator('[role="dialog"]')).toBeVisible();
  await expect(prompt.locator('#mnr-entry-prompt-title')).toHaveText('检测到小说正文');
  await expect(prompt.locator('text=检测置信度')).toHaveCount(0);
  await expect(prompt.locator('.mnr-result-list')).toHaveCount(0);
  await expect(prompt.locator('.mnr-entry-button.primary')).toBeFocused();
  await expect(prompt.locator('.mnr-entry-button.primary')).toHaveCSS('min-height', '44px');

  await page.keyboard.press('Escape');
  await expect(prompt).toHaveCount(0);

  const readerEntry = page.locator('#mnr-entry-root').locator('#mnr-entry-button');
  await expect(readerEntry).toBeVisible();
  await readerEntry.click();
  await expect(page.locator('#mnr-entry-root')).toHaveCount(0);
  await expect(page.locator('#mnr-reader-root').locator('.mnr-reader-content')).toContainText(
    '这是第 1 段测试正文'
  );
  expect(logs.some(line => line.includes('pageerror'))).toBe(false);
});

test('shows the first Goboo section before rate-limited background merging completes', async ({
  context,
  page,
}) => {
  const firstUrl = 'https://m.goboo.cc/gb_1/94443/1';
  const secondUrl = `${firstUrl}/2`;
  const thirdUrl = `${firstUrl}/3`;
  const nextChapterUrl = 'https://m.goboo.cc/gb_1/94443/2';
  const requestTimes = new Map<string, number>();
  const startedAt = Date.now();

  await context.route(firstUrl, route =>
    route.fulfill({
      body: makeGobooPage(1, '/gb_1/94443/1/2'),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route(secondUrl, route =>
    route.fulfill({
      body: makeGobooPage(2, '/gb_1/94443/1/3'),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route(thirdUrl, route =>
    route.fulfill({
      body: makeGobooPage(3, '/gb_1/94443/2', '下一章'),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await context.route(nextChapterUrl, route =>
    route.fulfill({
      body: makeGobooNextChapter(),
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  page.on('request', request => {
    if (request.url() === secondUrl || request.url() === thirdUrl) {
      requestTimes.set(request.url(), Date.now() - startedAt);
    }
  });
  await addYingChuangUserscript(context);
  const logs = createConsoleCollector(page);

  /** One atomic read of the merging chapter, so timing cannot split the assertions. */
  const readMergeState = () =>
    page.locator('#mnr-reader-root').evaluate(host => {
      const root = host.shadowRoot;
      return {
        text: root?.querySelector('.mnr-reader-content')?.textContent?.replace(/\s+/g, '') ?? '',
        progress: root?.querySelectorAll('.mnr-section-progress').length ?? 0,
        end: root?.querySelectorAll('.mnr-chapter-end').length ?? 0,
      };
    });

  await page.goto(firstUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#mnr-reader-root')).toHaveCount(1, { timeout: 1_000 });
  const initial = await readMergeState();

  expect(initial.text).toContain('第1页可见正文');
  expect(initial.text).toContain('第1页编码后续正文');
  expect(initial.text).not.toContain('第2页可见正文');
  expect(requestTimes.has(secondUrl)).toBe(false);
  // While pages are still arriving the reader says so, and never claims the book ended.
  expect(initial.progress).toBe(1);
  expect(initial.end).toBe(0);

  // Pages land one at a time: page 2 is readable a full rate-limit window before page 3.
  const midMerge: Array<Awaited<ReturnType<typeof readMergeState>>> = [];
  await expect
    .poll(
      async () => {
        const state = await readMergeState();
        if (midMerge.length === 0 && state.text.includes('第2页编码后续正文')) {
          midMerge.push(state);
        }
        return state.text;
      },
      { timeout: 6_000 }
    )
    .toContain('第2页编码后续正文');

  expect(midMerge[0]?.text).not.toContain('第3页编码后续正文');
  expect(midMerge[0]?.progress).toBe(1);
  expect(midMerge[0]?.end).toBe(0);

  await expect
    .poll(
      () =>
        page
          .locator('#mnr-reader-root')
          .evaluate(host =>
            host.shadowRoot?.querySelector('.mnr-reader-content')?.textContent?.replace(/\s+/g, '')
          ),
      { timeout: 6_000 }
    )
    .toContain('第3页编码后续正文');

  expect(requestTimes.get(thirdUrl)! - requestTimes.get(secondUrl)!).toBeGreaterThanOrEqual(1_000);

  // The indicator disappears once the chapter has every page.
  await expect.poll(async () => (await readMergeState()).progress, { timeout: 4_000 }).toBe(0);

  await expect
    .poll(
      () =>
        page
          .locator('#mnr-reader-root')
          .evaluate(host => host.shadowRoot?.querySelectorAll('.mnr-reader-content').length || 0),
      { timeout: 8_000 }
    )
    .toBe(2);
  await expect(
    page.locator('#mnr-reader-root').locator('.mnr-reader-content').nth(1)
  ).toContainText('第2章已由共享自动加载器成功预载');
  await expect(page.locator('#mnr-reader-root')).toHaveCount(1);
  expect(logs.some(line => line.includes('pageerror'))).toBe(false);
});

for (const focusTarget of ['pane', 'link'] as const) {
  test(`treats Space as one locked page-turn command with focused ${focusTarget}`, async ({
    context,
    page,
  }) => {
    await context.route(targetUrl, route =>
      route.fulfill({
        body: fixtureHtml,
        contentType: 'text/html; charset=utf-8',
        status: 200,
      })
    );
    await addYingChuangUserscript(context);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));

    const readerMain = page.locator('#mnr-reader-root').locator('.mnr-reader-main');
    const initial = await readerMain.evaluate(main => {
      const instrumented = main as HTMLElement & { mnrScrollByCalls: number };
      const originalScrollBy = instrumented.scrollBy.bind(instrumented);
      instrumented.mnrScrollByCalls = 0;
      instrumented.scrollBy = (arg1?: number | ScrollToOptions, arg2?: number) => {
        instrumented.mnrScrollByCalls += 1;
        if (typeof arg1 === 'number') {
          originalScrollBy(arg1, arg2 ?? 0);
        } else {
          originalScrollBy(arg1);
        }
      };
      instrumented.focus();
      return { clientHeight: instrumented.clientHeight, scrollTop: instrumented.scrollTop };
    });

    if (focusTarget === 'link') {
      await readerMain.evaluate(main => {
        const link = document.createElement('a');
        link.href = '#reading-note';
        link.textContent = '正文注释';
        main.prepend(link);
        link.focus({ preventScroll: true });
      });
    }

    await page.keyboard.down('Space');
    for (let index = 0; index < 12; index += 1) await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await page.waitForTimeout(750);

    const afterHold = await readerMain.evaluate(main => ({
      calls: (main as HTMLElement & { mnrScrollByCalls: number }).mnrScrollByCalls,
      scrollTop: main.scrollTop,
    }));
    expect(afterHold.calls).toBe(1);
    expect(
      Math.abs(afterHold.scrollTop - initial.scrollTop - initial.clientHeight * 0.9)
    ).toBeLessThan(3);

    await page.keyboard.press('Shift+Space');
    await page.waitForTimeout(750);
    await expect.poll(() => readerMain.evaluate(main => main.scrollTop)).toBeLessThan(3);
  });
}

test('leaves Enter on a focused toolbar button to native activation', async ({ context, page }) => {
  await context.route(targetUrl, route =>
    route.fulfill({
      body: fixtureHtml,
      contentType: 'text/html; charset=utf-8',
      status: 200,
    })
  );
  await addYingChuangUserscript(context);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  assertMnrSmokeState(await waitForMnrReader(page));

  const reader = page.locator('#mnr-reader-root');
  const settingsButton = reader.getByRole('button', { name: '打开设置' });
  const settingsPanel = reader.locator('.mnr-settings-panel');

  // Closing the panel restores focus to the toolbar button that opened it.
  await settingsButton.click();
  await expect(settingsPanel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settingsPanel).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  // Enter must activate the focused button, not the "open index page" reader shortcut.
  await page.keyboard.press('Enter');
  await expect(settingsPanel).toBeVisible();
  expect(page.url()).toBe(targetUrl);
});

for (const switchBack of [false, true]) {
  test(`applies deferred overlay cleanup only while aggressive remains selected (${switchBack})`, async ({
    context,
    page,
  }) => {
    const fixtureWithOverlay = fixtureHtml.replace(
      '</body>',
      `<a id="host-overlay" class="host-overlay" href="https://ads.example/"
      style="position: fixed; inset: 0; z-index: 2001; background: transparent"></a></body>`
    );
    await context.route(targetUrl, route =>
      route.fulfill({
        body: fixtureWithOverlay,
        contentType: 'text/html; charset=utf-8',
        status: 200,
      })
    );
    await addYingChuangUserscript(context);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));

    const reader = page.locator('#mnr-reader-root');
    const overlay = page.locator('#host-overlay');
    await expect
      .poll(() => overlay.evaluate(element => (element as HTMLElement).style.display))
      .toBe('');

    await reader.getByRole('button', { name: '打开设置' }).click();
    await reader.locator('summary').filter({ hasText: '本站与高级' }).click();
    const aggressiveButton = reader.getByRole('button', { name: '强力', exact: true });
    await aggressiveButton.click();
    await expect(aggressiveButton).toHaveAttribute('aria-pressed', 'true');

    // The host is display:none while reading, so the geometry-dependent pass is deferred to exit.
    expect(await overlay.evaluate(element => (element as HTMLElement).style.display)).toBe('');
    if (switchBack) {
      await reader.getByRole('button', { name: '标准', exact: true }).click();
    }
    await reader.getByRole('button', { name: '退出阅读模式' }).click();

    await expect(reader).toHaveCount(0);
    await expect
      .poll(() => overlay.evaluate(element => (element as HTMLElement).style.display))
      .toBe(switchBack ? '' : 'none');
    if (switchBack) await expect(overlay).toBeVisible();
    else await expect(overlay).toBeHidden();
  });
}

for (const tabApis of [true, false]) {
  test(`carries deferred overlay cleanup across a slow canonical exit (tab APIs: ${tabApis})`, async ({
    context,
    page,
  }) => {
    const nextUrl = 'http://mnr.test/chapter/101.html';
    const canonicalNextUrl = `http://${tabApis ? 'www.' : ''}mnr.test/chapter/101.html/`;
    const withOverlay = (html: string) =>
      html.replace(
        '</body>',
        `<a id="host-overlay" href="https://ads.example/"
        style="position: fixed; inset: 0; z-index: 2001; background: transparent"></a></body>`
      );
    let destinationNavigations = 0;

    await context.route(/^http:\/\/(?:www\.)?mnr\.test\/chapter\/.*$/, async route => {
      const request = route.request();
      if (request.url() === canonicalNextUrl) {
        return route.fulfill({
          body: withOverlay(nextFixtureHtml),
          contentType: 'text/html; charset=utf-8',
          status: 200,
        });
      }
      const isDestination = request.url() === nextUrl;
      if (isDestination && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        destinationNavigations++;
        await new Promise(resolve => setTimeout(resolve, 5_250));
        return route.fulfill({
          body: `<!doctype html><script>location.replace(${JSON.stringify(
            canonicalNextUrl
          )})</script>`,
          contentType: 'text/html; charset=utf-8',
          status: 200,
        });
      }
      return route.fulfill({
        body: withOverlay(isDestination ? nextFixtureHtml : fixtureHtml),
        contentType: 'text/html; charset=utf-8',
        status: 200,
      });
    });

    const userScript = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
    await context.addInitScript({
      content: `${createGmMockScript()}
      (() => {
        // This one-page fixture uses a domain cookie to emulate Tampermonkey's cross-origin
        // tab object; production uses GM_getTab/GM_saveTab rather than cookie storage.
        const cookieName = '__mnr_e2e_tab_state';
        const readTab = () => {
          const row = document.cookie
            .split('; ')
            .find(value => value.startsWith(cookieName + '='));
          if (!row) return {};
          try {
            return JSON.parse(decodeURIComponent(row.slice(cookieName.length + 1)));
          } catch {
            return {};
          }
        };
        window.GM_getTab = callback => queueMicrotask(() => callback(readTab()));
        window.GM_saveTab = tab => {
          document.cookie = cookieName + '=' + encodeURIComponent(JSON.stringify(tab))
            + '; Domain=mnr.test; Path=/; SameSite=Lax';
        };
      })();
      ${tabApis ? '' : 'delete window.GM_getTab; delete window.GM_saveTab;'}
      ${userScript}`,
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));
    const reader = page.locator('#mnr-reader-root');
    await expect(reader.locator(`article[data-chapter-url="${nextUrl}"]`)).toContainText(
      '第101章 手势续读'
    );
    await reader.getByRole('button', { name: '打开设置' }).click();
    await reader.locator('summary').filter({ hasText: '本站与高级' }).click();
    await reader.getByRole('button', { name: '强力', exact: true }).click();
    await page.keyboard.press('Escape');

    await page.waitForTimeout(800);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(nextUrl);
    await expect(reader).toHaveCount(1);
    await reader.getByRole('button', { name: '打开设置' }).click();
    await reader.getByRole('button', { name: '退出阅读模式' }).click();

    await expect(page).toHaveURL(canonicalNextUrl);
    await expect(reader).toHaveCount(0);
    await expect(page.locator('#mnr-entry-root')).toHaveCount(1);
    await expect.poll(() => destinationNavigations).toBe(1);
    const destinationOverlay = page.locator('#host-overlay');
    await expect
      .poll(() => destinationOverlay.evaluate(element => (element as HTMLElement).style.display))
      .toBe('none');
    await expect(destinationOverlay).toBeHidden();

    // Only the exit navigation is suppressed; a subsequent load follows normal auto-enable.
    await page.reload({ waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));
  });
}

test.describe('mobile gesture paging', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps vertical boundary loads anchored while horizontal swipes turn a page', async ({
    context,
    page,
  }) => {
    const nextUrl = 'http://mnr.test/chapter/101.html';
    let nextRequests = 0;

    await context.route(targetUrl, route =>
      route.fulfill({
        body: fixtureHtml,
        contentType: 'text/html; charset=utf-8',
        status: 200,
      })
    );
    await context.route(nextUrl, async route => {
      nextRequests += 1;
      await new Promise(resolve => setTimeout(resolve, 150));
      return route.fulfill({
        body: nextFixtureHtml,
        contentType: 'text/html; charset=utf-8',
        status: 200,
      });
    });
    await addYingChuangUserscript(context);

    const logs = createConsoleCollector(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));

    const readerRoot = page.locator('#mnr-reader-root');
    const readerMain = readerRoot.locator('.mnr-reader-main');
    await expect(readerMain).toHaveCSS('touch-action', 'pan-y pinch-zoom');

    await disableReaderPreload(readerRoot);

    const initialPosition = await readerMain.evaluate(main => ({
      scrollTop: main.scrollTop,
      clientHeight: main.clientHeight,
    }));
    await dispatchReaderTouch(page, 'touchstart', { x: 330, y: 420 });
    await dispatchReaderTouch(page, 'touchend', { x: 70, y: 420 });
    await expect
      .poll(() => readerMain.evaluate(main => main.scrollTop))
      .toBeGreaterThan(initialPosition.scrollTop + initialPosition.clientHeight * 0.75);
    expect(nextRequests).toBe(0);

    await page.waitForTimeout(700);
    await dispatchReaderTouch(page, 'touchstart', { x: 70, y: 420 });
    await dispatchReaderTouch(page, 'touchend', { x: 330, y: 420 });
    await expect.poll(() => readerMain.evaluate(main => main.scrollTop)).toBeLessThan(80);

    await page.waitForTimeout(700);
    await readerMain.evaluate(main => {
      main.scrollTop = main.scrollHeight;
    });

    await dispatchReaderTouch(page, 'touchstart', { x: 195, y: 500 });
    await dispatchReaderTouch(page, 'touchmove', { x: 195, y: 480 });
    await expect(readerRoot.locator('.mnr-boundary-gesture-hint')).toHaveText('继续上滑加载下一章');
    await dispatchReaderTouch(page, 'touchend', { x: 195, y: 480 });
    await expect(readerRoot.locator('.mnr-boundary-gesture-hint')).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(nextRequests).toBe(0);

    const boundaryBefore = await readerRoot.evaluate(host => {
      const shadow = host.shadowRoot;
      const main = shadow?.querySelector('.mnr-reader-main');
      const previous = shadow?.querySelector('.mnr-reader-content');
      if (!main || !previous) throw new Error('reader boundary not found');

      const mainTop = main.getBoundingClientRect().top;
      return {
        scrollTop: main.scrollTop,
        previousBottom: previous.getBoundingClientRect().bottom - mainTop,
        viewportHeight: main.clientHeight,
      };
    });

    await dispatchReaderTouch(page, 'touchstart', { x: 195, y: 500 });
    await dispatchReaderTouch(page, 'touchmove', { x: 195, y: 430 });
    await expect(readerRoot.locator('.mnr-boundary-gesture-hint')).toHaveText('松手加载下一章');
    await dispatchReaderTouch(page, 'touchend', { x: 195, y: 430 });

    await expect.poll(() => nextRequests).toBe(1);
    await expect(readerRoot.locator('.mnr-chapter-title')).toHaveCount(2);
    await expect(readerRoot.locator('.mnr-chapter-title').nth(1)).toHaveText('第101章 手势续读');
    const boundaryPosition = await readerRoot.evaluate(host => {
      const shadow = host.shadowRoot;
      const main = shadow?.querySelector('.mnr-reader-main');
      const visibleChapters = shadow?.querySelectorAll('.mnr-reader-content');
      const previous = visibleChapters?.[0];
      const next = visibleChapters?.[1];
      if (!main || !previous || !next) throw new Error('reader chapters not found');

      const mainTop = main.getBoundingClientRect().top;
      return {
        scrollTop: main.scrollTop,
        nextTop: next.getBoundingClientRect().top - mainTop,
        previousBottom: previous.getBoundingClientRect().bottom - mainTop,
        viewportHeight: main.clientHeight,
      };
    });
    expect(Math.abs(boundaryPosition.scrollTop - boundaryBefore.scrollTop)).toBeLessThan(3);
    expect(Math.abs(boundaryPosition.previousBottom - boundaryBefore.previousBottom)).toBeLessThan(
      3
    );
    expect(Math.abs(boundaryPosition.nextTop - boundaryPosition.previousBottom)).toBeLessThan(3);
    expect(boundaryPosition.nextTop).toBeGreaterThan(boundaryPosition.viewportHeight * 0.75);
    expect(page.url()).toBe(targetUrl);

    await page.waitForTimeout(750);
    const settledPosition = await readerRoot.evaluate(host => {
      const shadow = host.shadowRoot;
      const main = shadow?.querySelector('.mnr-reader-main');
      const next = shadow?.querySelectorAll('.mnr-reader-content')[1];
      if (!main || !next) throw new Error('reader chapters not found');

      return {
        scrollTop: main.scrollTop,
        nextTop: next.getBoundingClientRect().top - main.getBoundingClientRect().top,
      };
    });
    expect(Math.abs(settledPosition.scrollTop - boundaryPosition.scrollTop)).toBeLessThan(3);
    expect(Math.abs(settledPosition.nextTop - boundaryPosition.nextTop)).toBeLessThan(3);

    await readerMain.evaluate(main => {
      main.scrollBy({ top: main.clientHeight * 0.65, behavior: 'auto' });
    });
    await expect.poll(() => page.url()).toBe(nextUrl);
    expect(logs.some(line => line.includes('pageerror'))).toBe(false);
  });

  test('preserves the visible chapter when a boundary load trims the display window', async ({
    context,
    page,
  }) => {
    const firstUrl = 'http://mnr.test/chapter/200.html';
    const logs = createConsoleCollector(page);

    await context.route('http://mnr.test/chapter/*.html', route => {
      const chapterNumber = Number(
        new URL(route.request().url()).pathname.match(/\/(\d+)\.html$/)?.[1] || 200
      );
      return route.fulfill({
        body: makeContinuousChapterFixture(chapterNumber),
        contentType: 'text/html; charset=utf-8',
        status: 200,
      });
    });
    await addYingChuangUserscript(context);

    await page.goto(firstUrl, { waitUntil: 'domcontentloaded' });
    assertMnrSmokeState(await waitForMnrReader(page));

    const readerRoot = page.locator('#mnr-reader-root');
    const readerMain = readerRoot.locator('.mnr-reader-main');
    await disableReaderPreload(readerRoot);

    let finalAnchorBefore: { bottom: number; top: number; viewportHeight: number } | undefined;

    for (let chapterNumber = 201; chapterNumber <= 206; chapterNumber += 1) {
      await readerMain.evaluate(main => {
        main.scrollTop = main.scrollHeight;
      });
      await page.waitForTimeout(80);

      if (chapterNumber === 206) {
        finalAnchorBefore = await readerRoot.evaluate(host => {
          const shadow = host.shadowRoot;
          const main = shadow?.querySelector('.mnr-reader-main');
          const anchor = shadow?.querySelector(
            '[data-chapter-url="http://mnr.test/chapter/205.html"]'
          );
          if (!main || !anchor) throw new Error('trim anchor not found');

          const mainTop = main.getBoundingClientRect().top;
          const rect = anchor.getBoundingClientRect();
          return {
            bottom: rect.bottom - mainTop,
            top: rect.top - mainTop,
            viewportHeight: main.clientHeight,
          };
        });
      }

      await dispatchReaderTouch(page, 'touchstart', { x: 195, y: 500 });
      await dispatchReaderTouch(page, 'touchmove', { x: 195, y: 430 });
      await dispatchReaderTouch(page, 'touchend', { x: 195, y: 430 });

      await expect(readerRoot.locator('.mnr-chapter-title').last()).toHaveText(
        `第${chapterNumber}章 连续阅读`
      );
      await expect(readerRoot.locator('.mnr-chapter-title')).toHaveCount(
        Math.min(chapterNumber - 199, 6)
      );
    }

    expect(finalAnchorBefore).toBeDefined();
    await expect(readerRoot.locator('.mnr-chapter-title').first()).toHaveText('第201章 连续阅读');
    const finalPosition = await readerRoot.evaluate(host => {
      const shadow = host.shadowRoot;
      const main = shadow?.querySelector('.mnr-reader-main');
      const anchor = shadow?.querySelector('[data-chapter-url="http://mnr.test/chapter/205.html"]');
      const next = shadow?.querySelector('[data-chapter-url="http://mnr.test/chapter/206.html"]');
      if (!main || !anchor || !next) throw new Error('trimmed reader chapters not found');

      const mainTop = main.getBoundingClientRect().top;
      const anchorRect = anchor.getBoundingClientRect();
      return {
        anchorBottom: anchorRect.bottom - mainTop,
        anchorTop: anchorRect.top - mainTop,
        nextTop: next.getBoundingClientRect().top - mainTop,
      };
    });
    expect(Math.abs(finalPosition.anchorTop - finalAnchorBefore!.top)).toBeLessThan(3);
    expect(Math.abs(finalPosition.anchorBottom - finalAnchorBefore!.bottom)).toBeLessThan(3);
    expect(Math.abs(finalPosition.nextTop - finalPosition.anchorBottom)).toBeLessThan(3);
    expect(finalPosition.nextTop).toBeGreaterThan(finalAnchorBefore!.viewportHeight * 0.75);

    await page.waitForTimeout(750);
    const delayedAnchorTop = await readerRoot.evaluate(host => {
      const main = host.shadowRoot?.querySelector('.mnr-reader-main');
      const anchor = host.shadowRoot?.querySelector(
        '[data-chapter-url="http://mnr.test/chapter/205.html"]'
      );
      if (!main || !anchor) throw new Error('delayed trim anchor not found');
      return anchor.getBoundingClientRect().top - main.getBoundingClientRect().top;
    });
    expect(Math.abs(delayedAnchorTop - finalPosition.anchorTop)).toBeLessThan(3);
    expect(logs.some(line => line.includes('pageerror'))).toBe(false);
  });
});

test('keeps generic chapter extraction, template TOC and cached navigation in the reader', async ({
  context,
  page,
}) => {
  const startUrl = 'http://mnr.test/read/123/500.html';
  const requests: string[] = [];
  let documentNavigations = 0;
  await context.route('http://mnr.test/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(url.href);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentNavigations++;
    }
    const id = Number(url.pathname.match(/\/(\d+)\.html$/)?.[1]);
    const link = (chapter: number) =>
      `<a href="/read/123/${chapter}.html">第${chapter}章 风起，云涌</a>`;
    const body = url.pathname.startsWith('/book/')
      ? `<title>山海归途</title>${link(500)}<template>${[501, 502, 503, 504].map(link).join('')}</template>${link(505)}`
      : `<title>第${id}章 风起，云涌 - 山海归途 - 小说网</title>
         <a href="${url.pathname}?lang=zh">简体中文</a>
         <article>
           <h1>第${id}章 风起，云涌</h1>
           <p>山海归途</p>
           <div id="article-content">${paragraphs}</div>
           <div>分享 Facebook 下载 App</div>
           ${id > 500 ? `<a href="/read/123/${id - 1}.html">上一章</a>` : ''}
           <a href="/book/123.html">返回目录</a>
           ${id < 505 ? `<a href="/read/123/${id + 1}.html">下一章</a>` : ''}
         </article>`;
    await route.fulfill({ body, contentType: 'text/html; charset=utf-8' });
  });
  await addYingChuangUserscript(context);
  await page.goto(startUrl);
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  const first = root.locator('article[data-chapter-url$="/500.html"]');
  await expect(first).toContainText('这是第 72 段测试正文');
  await expect(first).not.toContainText('Facebook');
  await expect(first).not.toContainText('下载 App');
  await expect(page).toHaveTitle('第500章 风起，云涌 - 山海归途');

  // Wait for the shared preloader so the TOC jump exercises the cached path.
  await expect(root.locator('article[data-chapter-url$="/501.html"]')).toContainText(
    '这是第 72 段测试正文'
  );
  await root.getByRole('button', { name: '打开目录' }).click();
  await expect(root.locator('.mnr-drawer-position')).toContainText('/ 6');
  await expect(root.locator('.mnr-chapter-list li')).toHaveCount(6);
  await root.getByRole('button', { name: '第501章 风起，云涌', exact: true }).click();
  await expect(page).toHaveURL('http://mnr.test/read/123/501.html');
  await expect(root.locator('.mnr-reader')).toBeVisible();

  // Directory selection can replace an ongoing smooth jump; the latest choice owns the view.
  for (const chapter of [500, 501]) {
    await root.getByRole('button', { name: '打开目录' }).click();
    await root.getByRole('button', { name: `第${chapter}章 风起，云涌`, exact: true }).click();
    await expect(page).toHaveURL(`http://mnr.test/read/123/${chapter}.html`);
  }

  // Respect the shared smooth-navigation lock before the next keyboard command.
  await page.waitForTimeout(800);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL('http://mnr.test/read/123/502.html');
  await expect(root.locator('article[data-chapter-url$="/502.html"]')).toContainText(
    '这是第 72 段测试正文'
  );
  await page.waitForTimeout(800);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL('http://mnr.test/read/123/501.html');
  await expect(root.locator('.mnr-reader')).toBeVisible();
  expect(documentNavigations).toBe(1);
  expect(requests.some(url => url.includes('?lang='))).toBe(false);
});

test('preloads chapters beneath a dotted section-like slug', async ({ context, page }) => {
  const firstUrl = 'http://mnr.test/novel/about.time/chapter-11';
  const nextUrl = 'http://mnr.test/novel/about.time/chapter-12';
  let nextRequests = 0;

  await context.route('http://mnr.test/novel/about.time/**', async route => {
    const url = new URL(route.request().url());
    const chapter = Number(url.pathname.match(/chapter-(\d+)$/)?.[1]);
    if (url.href === nextUrl) nextRequests++;
    await route.fulfill({
      body: `<!doctype html><html><head><title>第${chapter}章 点号路径测试</title></head>
        <body><article><h1>第${chapter}章 点号路径测试</h1>
        <div id="content">${paragraphs}</div>
        ${chapter > 11 ? '<a href="/novel/about.time/chapter-11">上一章</a>' : ''}
        ${chapter < 12 ? '<a href="/novel/about.time/chapter-12">下一章</a>' : ''}
        </article></body></html>`,
      contentType: 'text/html; charset=utf-8',
    });
  });
  await addYingChuangUserscript(context);
  await page.goto(firstUrl);
  await waitForMnrReader(page);

  const nextChapter = page
    .locator('#mnr-reader-root')
    .locator(`article[data-chapter-url="${nextUrl}"]`);
  await expect(nextChapter).toContainText('第12章 点号路径测试');
  expect(nextRequests).toBeGreaterThan(0);
});

test('caches script-rendered rule chapters through an iframe and removes it afterward', async ({
  context,
  page,
}) => {
  const startUrl = 'https://twkan.com/txt/999999/500';
  const cachedUrl = 'https://twkan.com/txt/999999/501';
  let cachedRequests = 0;
  let iframeRequests = 0;
  await context.route('https://twkan.com/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.url() === cachedUrl) {
      cachedRequests++;
      if (request.isNavigationRequest() && request.frame() !== page.mainFrame()) iframeRequests++;
    }
    const id = path.endsWith('/501') ? 501 : 500;
    const content = `<p>动态缓存章节 ${id}。</p>${paragraphs}`;
    const body =
      path.startsWith('/book/') || path.startsWith('/ajax_novels/')
        ? `<title>离线测试</title><a href="${startUrl}">第500章 起程</a><a href="${cachedUrl}">第501章 归来</a>`
        : `<title>第${id}章 归来-离线测试-小说-台灣小說網</title>
         <h1>第${id}章 归来</h1><a href="/book/999999/index.html">目录</a>
         <div id="txtcontent0"></div>
         <script>document.getElementById('txtcontent0').innerHTML = ${JSON.stringify(content)};</script>`;
    await route.fulfill({ body, contentType: 'text/html; charset=utf-8' });
  });
  await addYingChuangUserscript(context);
  const logs = createConsoleCollector(page);
  await page.goto(startUrl);
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  await root.getByRole('button', { name: '打开目录' }).click();
  await expect(root.locator('.mnr-chapter-list li')).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept());
  await root.getByRole('button', { name: '缓存本书', exact: true }).click();
  await expect(
    root.locator('.mnr-chapter-list li').filter({ hasText: '第501章' }).locator('.mnr-cache-mark')
  ).toBeVisible();
  await expect(root.getByRole('button', { name: '缓存本书', exact: true })).toBeVisible();
  expect(iframeRequests).toBe(1);
  expect(cachedRequests).toBe(1);
  await expect(page.locator('iframe')).toHaveCount(0);
  await root.locator('.mnr-chapter-button').filter({ hasText: '第501章 归来' }).click();
  await expect(page).toHaveURL(cachedUrl);
  await expect(root.locator('.mnr-reader-content')).toContainText('动态缓存章节 501');
  expect(cachedRequests).toBe(1);
  expect(logs.some(line => line.includes('pageerror'))).toBe(false);
});

test('does not queue cache-all work when the drawer closes during TOC loading', async ({
  context,
  page,
}) => {
  const startUrl = 'https://twkan.com/txt/999998/500';
  const cachedUrl = 'https://twkan.com/txt/999998/501';
  let releaseToc!: () => void;
  const tocGate = new Promise<void>(resolve => {
    releaseToc = resolve;
  });
  await context.route('https://twkan.com/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/book/') || path.startsWith('/ajax_novels/')) {
      await tocGate;
      await route.fulfill({
        body: `<title>离线测试</title><a href="${startUrl}">第500章 起程</a><a href="${cachedUrl}">第501章 归来</a>`,
        contentType: 'text/html; charset=utf-8',
      });
      return;
    }
    const id = path.endsWith('/501') ? 501 : 500;
    const content = `<p>单次确认章节 ${id}。</p>${paragraphs}`;
    await route.fulfill({
      body: `<title>第${id}章 归来-离线测试-小说-台灣小說網</title>
         <h1>第${id}章 归来</h1><a href="/book/999998/index.html">目录</a>
         <div id="txtcontent0"></div>
         <script>document.getElementById('txtcontent0').innerHTML = ${JSON.stringify(content)};</script>`,
      contentType: 'text/html; charset=utf-8',
    });
  });
  await addYingChuangUserscript(context);
  await page.goto(startUrl);
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');

  let dialogs = 0;
  page.on('dialog', dialog => {
    dialogs++;
    void dialog.accept();
  });
  await root.getByRole('button', { name: '打开目录' }).click();
  const cacheButton = root.getByRole('button', { name: '缓存本书', exact: true });
  await expect(cacheButton).toBeDisabled();
  await root.getByRole('button', { name: '关闭目录' }).click();
  releaseToc();
  await page.waitForTimeout(300);
  expect(dialogs).toBe(0);

  await root.getByRole('button', { name: '打开目录' }).click();
  await expect(cacheButton).toBeEnabled();
  await cacheButton.click();
  await expect(
    root.locator('.mnr-chapter-list li').filter({ hasText: '第501章' }).locator('.mnr-cache-mark')
  ).toBeVisible();
  expect(dialogs).toBe(1);
});

test('keeps same-origin chapter requests in the page session with bound fetch wrappers', async ({
  context,
  page,
}) => {
  const nextUrl = 'http://mnr.test/chapter/101.html';
  let nextRequests = 0;
  await context.route('http://mnr.test/**', route => {
    const isNext = route.request().url() === nextUrl;
    if (isNext) nextRequests++;
    return route.fulfill({
      body: isNext ? nextFixtureHtml : fixtureHtml,
      contentType: 'text/html; charset=utf-8',
    });
  });
  const script = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
  await context.addInitScript({
    content: `${createGmMockScript()}
    // Tampermonkey 5.5.0's Window proxy binds fetch on each property access.
    const pageWindow = window;
    const pageFetch = window.fetch;
    window.__gmChapterRequests = 0;
    window.GM_xmlhttpRequest = options => {
      window.__gmChapterRequests++;
      queueMicrotask(() => options.onload({ status: 403, responseText: '', finalUrl: options.url }));
      return { abort() {} };
    };
    const proxyWindow = new Proxy(window, { set(target, key, value) { return Reflect.set(target, key, value, target); }, get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' && /^[a-z]/.test(String(key)) ? value.bind(target) : value;
    } });
    window.__fetchWrapperMismatch = proxyWindow.fetch !== pageFetch;
    (function(window, fetch) { ${script} })(proxyWindow, pageFetch.bind(pageWindow));
  `,
  });
  const logs = createConsoleCollector(page);
  await page.goto(targetUrl);
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  await expect(root.locator('article[data-chapter-url$="/101.html"]')).toContainText('手势续读');
  expect(
    await page.evaluate(
      () => (window as Window & { __fetchWrapperMismatch?: boolean }).__fetchWrapperMismatch
    )
  ).toBe(true);
  expect(
    await page.evaluate(
      () => (window as Window & { __gmChapterRequests?: number }).__gmChapterRequests
    )
  ).toBe(0);
  expect(nextRequests).toBe(1);
  expect(logs.some(line => line.includes('pageerror'))).toBe(false);
});

for (const startPage of [1, 2]) {
  test(`merges Novel543 chapters from page ${startPage} and keeps catalog jumps in the reader`, async ({
    context,
    page,
  }) => {
    let documentNavigations = 0;
    const requests: string[] = [];
    await context.route(`${novel543Origin}/**`, route => {
      const request = route.request();
      requests.push(request.url());
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documentNavigations++;
      const match = new URL(request.url()).pathname.match(/8096_(\d+)(?:_(\d+))?\.html$/);
      return route.fulfill({
        body: match
          ? makeNovel543Chapter(Number(match[1]), Number(match[2] || 1))
          : makeNovel543Toc(),
        contentType: 'text/html; charset=utf-8',
      });
    });
    await addYingChuangUserscript(context);
    const logs = createConsoleCollector(page);
    const parserLogs: string[] = [];
    page.on('console', message => {
      if (message.text().includes('[Parser]')) parserLogs.push(message.text());
    });
    await page.goto(novel543Origin + novel543ChapterPath(941, startPage));
    await waitForMnrReader(page);
    const root = page.locator('#mnr-reader-root');
    const first = root.locator('article[data-chapter-url$="/8096_941.html"]');
    await expect(first.locator('.mnr-chapter-title')).toHaveText('第941章 百倍獎勵');
    await expect(first).toContainText('第1頁末句');
    await expect(first).toContainText('第2頁末句');
    await expect(first).not.toContainText('站內信');
    await expect(first).not.toContainText('可以試試搜作者哦');
    await expect(first).not.toContainText('廣告干擾');
    await expect(first).not.toContainText('现推出VIP会员免广告功能');
    await expect(first.locator('img[src$="/images/vip.png"]')).toHaveCount(0);
    await expect(page).toHaveTitle(`第941章 百倍獎勵 - ${novel543BookTitle}`);
    const next = root.locator('article[data-chapter-url$="/8096_942.html"]');
    await expect(next).toContainText('第2頁末句');
    await expect(next).not.toContainText('现推出VIP会员免广告功能');
    await expect(next.locator('img[src$="/images/vip.png"]')).toHaveCount(0);
    await root.getByRole('button', { name: '打开目录' }).click();
    await expect(root.locator('.mnr-chapter-list li')).toHaveCount(4);
    await root.getByRole('button', { name: '第942章 百倍獎勵', exact: true }).click();
    await expect(page).toHaveURL(novel543Origin + novel543ChapterPath(942));
    await expect(root.locator('.mnr-reader')).toBeVisible();
    for (const chapter of [943, 944, 945, 946]) {
      // Respect the reader's smooth-navigation lock between keyboard commands.
      await page.waitForTimeout(800);
      await root.locator('.mnr-reader-main').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(novel543Origin + novel543ChapterPath(chapter));
      const loaded = root.locator(`article[data-chapter-url$="/8096_${chapter}.html"]`);
      await expect(loaded).toContainText('第1頁末句');
      await expect(loaded).toContainText('第2頁末句');
      await expect(loaded.locator('a[href$="/auth/govip.html"]')).toHaveCount(0);
      await expect(loaded.locator('img[src$="/images/vip.png"]')).toHaveCount(0);
    }
    expect(documentNavigations).toBe(1);
    expect(requests.some(url => url.endsWith('/8096.html'))).toBe(false);
    expect(logs.some(line => line.includes('pageerror'))).toBe(false);
    expect(parserLogs).toEqual([]);
  });
}

test('uses the Tiantang full catalog and shared pagination to navigate', async ({
  page,
  context,
}) => {
  const {
    makeTiantangOverview,
    makeTiantangToc,
    tiantangChapterPath,
    tiantangDirectory,
    tiantangIndexPath,
    tiantangOrigin,
  } = await import('../testUtils/tiantang');
  const catalogRequests: string[] = [];
  await context.route(`${tiantangOrigin}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    let body: string;
    if (pathname === tiantangIndexPath) {
      catalogRequests.push(pathname);
      body = makeTiantangOverview();
    } else if (pathname.endsWith('/')) {
      catalogRequests.push(pathname);
      const number = Number(pathname.slice(tiantangDirectory.length).replace('/', '')) || 1;
      body = makeTiantangToc(number);
    } else {
      const chapter = Number(pathname.match(/(\d+)\.html$/)?.[1]) - 1888827;
      body = `<html><head><title>第${chapter}章 测试正文_测试书名</title></head><body>
        <h1 class="bookname">第${chapter}章 测试正文</h1>
        <div class="bottem1"><a href="${tiantangChapterPath(chapter - 1)}" rel="prev">上一章</a><a href="${tiantangIndexPath}" rel="index">目录</a><a href="${tiantangChapterPath(chapter + 1)}" rel="next">下一章</a></div>
        <div id="content">${paragraphs}</div>
        </body></html>`;
    }
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  await addYingChuangUserscript(context);
  await page.goto(tiantangOrigin + tiantangChapterPath(256));
  await waitForMnrReader(page);
  const root = page.locator('#mnr-reader-root');
  await root.getByRole('button', { name: '打开目录', exact: true }).click();
  await expect(root.locator('.mnr-drawer-position')).toContainText('/ 298');
  await expect(root.getByRole('button', { name: '第256章 测试正文', exact: true })).toBeVisible();
  await root.getByRole('button', { name: '第257章 测试正文', exact: true }).click();
  await expect(page).toHaveURL(tiantangOrigin + tiantangChapterPath(257));
  await expect(
    root.locator('article[data-chapter-url$="/1889084.html"] .mnr-chapter-title')
  ).toContainText('第257章');
  expect(catalogRequests).toEqual([
    tiantangDirectory,
    ...[2, 3, 4, 5, 6].map(number => `${tiantangDirectory}${number}/`),
  ]);
});

test('does not persist a temporary section percentage on pagehide', async ({ context, page }) => {
  const url = 'https://m.goboo.cc/gb_1/94443/1';
  await context.route(url, route =>
    route.fulfill({ body: makeGobooPage(1, '/gb_1/94443/1/2'), contentType: 'text/html' })
  );
  let release!: () => void;
  const gate = new Promise<void>(r => {
    release = r;
  });
  await context.route(url + '/2', async route => {
    await gate;
    await route.fulfill({
      body: makeGobooPage(2, '/gb_1/94443/2', '下一章'),
      contentType: 'text/html',
    });
  });
  const script = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
  await context.addInitScript({ content: createGmMockScript() + '\n' + script });
  await page.goto(url);
  const root = page.locator('#mnr-reader-root');
  await expect(root.locator('.mnr-section-progress')).toBeVisible();
  await root.locator('.mnr-reader-main').evaluate(el => {
    el.scrollTop = 200;
    el.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(100);
  const stored = await page.evaluate(() =>
    (window as any).GM_getValue('mnr-reading-positions', null)
  );
  console.log('position during merge:', stored);
  release();
  expect(stored).toBeNull();
});

for (const moveWhileLoading of [false, true]) {
  test(
    moveWhileLoading
      ? 'does not restore over user scrolling during section merging'
      : 'restores a saved percentage only after the chapter finishes merging',
    async ({ context, page }) => {
      const url = 'https://m.goboo.cc/gb_1/94443/1';
      await page.setViewportSize({ width: 390, height: 844 });
      await context.route(url, route =>
        route.fulfill({ body: makeGobooPage(1, '/gb_1/94443/1/2'), contentType: 'text/html' })
      );
      let release!: () => void;
      const gate = new Promise<void>(r => {
        release = r;
      });
      await context.route(url + '/2', async route => {
        await gate;
        await route.fulfill({
          body: makeGobooPage(2, '/gb_1/94443/1/3'),
          contentType: 'text/html',
        });
      });
      await context.route(url + '/3', route =>
        route.fulfill({
          body: makeGobooPage(3, 'javascript:void(0);', '下一章'),
          contentType: 'text/html',
        })
      );
      const script = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
      const seed = `window.GM_setValue('mnr-reading-positions', JSON.stringify({[${JSON.stringify(url)}]:{percent:70,updatedAt:Date.now()}}));`;
      await context.addInitScript({ content: createGmMockScript() + '\n' + seed + '\n' + script });
      await page.goto(url);
      const root = page.locator('#mnr-reader-root');
      await expect(root.locator('.mnr-section-progress')).toBeVisible();
      await expect(root).not.toContainText('已回到上次阅读位置');
      const measure = () =>
        root.evaluate(host => {
          const main = host.shadowRoot!.querySelector('.mnr-reader-main') as HTMLElement;
          const article = host.shadowRoot!.querySelector('article') as HTMLElement;
          const top =
            main.scrollTop + article.getBoundingClientRect().top - main.getBoundingClientRect().top;
          return {
            scrollTop: main.scrollTop,
            height: article.offsetHeight,
            percent:
              (100 * (main.scrollTop - top)) / (article.offsetHeight - main.clientHeight * 0.5),
          };
        });
      if (moveWhileLoading) {
        await root.locator('.mnr-reader-main').hover();
        await page.mouse.wheel(0, 300);
        await expect.poll(async () => (await measure()).scrollTop).toBeGreaterThan(100);
        await page.waitForTimeout(200);
      }
      const before = await measure();
      release();
      await expect(root.locator('.mnr-section-progress')).toHaveCount(0);
      const after = await measure();
      console.log('restored position:', JSON.stringify({ before, after }));
      if (moveWhileLoading) {
        expect(after.scrollTop).toBe(before.scrollTop);
        await expect(root).not.toContainText('已回到上次阅读位置');
      } else {
        expect(after.percent).toBeCloseTo(70, 0);
      }
    }
  );
}

test('keeps the first-page DOM and selection while merging an 80-page Xszj chapter', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const url = 'https://xszj.org/b/490346/c/1534359';
  const pages: number[] = [];
  const times: number[] = [];
  await context.route('https://xszj.org/**', async route => {
    const requestUrl = new URL(route.request().url());
    const n = Number(requestUrl.searchParams.get('page') || 1);
    if (requestUrl.pathname !== '/b/490346/c/1534359') {
      await route.fulfill({ status: 404, body: '' });
      return;
    }
    pages.push(n);
    times.push(Date.now());
    const next = n < 80 ? `<a href="?page=${n + 1}">下一页</a>` : '';
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="zh-Hans"><head><title>第一章 长分页(${n}/80)</title></head><body>
      <h1 class="bookname">第一章 长分页(${n}/80)</h1>
      <div class="con_top"><a href="/b/490346">测试书</a></div>
      <div class="bottem1"><a href="/b/490346/cs/1">目录</a>${next}</div>
      <div id="booktxt"><p>第${n}页正文。${'山间的风吹过树林，他沿着熟悉的小路慢慢向前走去。'.repeat(60)}</p></div>
    </body></html>`,
    });
  });
  const script = fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8');
  await context.addInitScript({
    content:
      createGmMockScript() +
      `
    window.GM_setValue('mnr-config',{behavior:{preloadNext:false}});
  ` +
      script,
  });
  await page.goto(url);
  const root = page.locator('#mnr-reader-root');
  await expect(root.locator('.mnr-section-progress')).toContainText('1/80');
  await root.evaluate(host => {
    const root = host.shadowRoot!;
    const paragraph = root.querySelector('article p')!;
    const text = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const main = root.querySelector('.mnr-reader-main') as HTMLElement;
    main.scrollTop = 150;
    (window as any).__sectionProof = {
      paragraph,
      text,
      selected: selection.toString(),
      scrollTop: main.scrollTop,
    };
  });
  const retained = () =>
    root.evaluate(host => {
      const proof = (window as any).__sectionProof;
      const main = host.shadowRoot!.querySelector('.mnr-reader-main') as HTMLElement;
      return {
        sameNode: host.shadowRoot!.querySelector('article p') === proof.paragraph,
        selection: window.getSelection()?.toString(),
        expected: proof.selected,
        scrollTop: main.scrollTop,
        initialTop: proof.scrollTop,
      };
    });
  await expect(root.locator('article')).toContainText('第2页正文');
  expect((await retained()).sameNode).toBe(true);
  await expect(root.locator('.mnr-section-progress')).toHaveCount(0, { timeout: 100_000 });
  const final = await retained();
  expect(final.sameNode).toBe(true);
  expect(final.selection).toBe(final.expected);
  expect(final.expected.length).toBeGreaterThan(0);
  expect(final.scrollTop).toBe(final.initialTop);
  expect(pages).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
  expect(times[79] - times[0]).toBeGreaterThanOrEqual(79 * 750);
  console.log('80-page merge elapsed ms:', times[79] - times[0]);
});

test('cancelled position restoration preserves storage until the reader actually scrolls', async ({
  page,
  context,
}) => {
  const url = 'https://m.goboo.cc/gb_1/94443/2';
  await context.route('https://m.goboo.cc/**', route =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: makeGobooNextChapter(),
    })
  );
  const seed = `
    GM_setValue('mnr-reading-positions', JSON.stringify({[${JSON.stringify(url)}]: {percent: 70, updatedAt: Date.now() - 10000}}));
    const originalGet = GM_getValue;
    window.__readPosition = () => originalGet('mnr-reading-positions');
    const gate = new Promise(resolve => { window.__releasePosition = resolve; });
    GM_getValue = (key, ...args) => key === 'mnr-reading-positions'
      ? gate.then(() => originalGet(key, ...args)) : originalGet(key, ...args);
  `;
  await context.addInitScript({
    content:
      createGmMockScript() +
      '\n' +
      seed +
      '\n' +
      fs.readFileSync(getMnrE2eConfig().userScriptPath, 'utf8'),
  });
  await page.goto(url);
  const main = page.locator('#mnr-reader-root .mnr-reader-main');
  await expect(main).toBeVisible();
  await main.focus();
  await page.keyboard.press('Shift');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.evaluate(() =>
    (window as Window & { __releasePosition?: () => void }).__releasePosition!()
  );
  const readPercent = async () => {
    const stored = await page.evaluate(() =>
      (window as Window & { __readPosition?: () => string }).__readPosition!()
    );
    return (JSON.parse(stored) as Record<string, { percent: number }>)[url].percent;
  };
  // Allow the deferred storage read and any wrongly queued persistence to settle.
  await page.waitForTimeout(300);
  expect(await readPercent()).toBe(70);
  await expect(main).toHaveJSProperty('scrollTop', 0);
  await main.evaluate(el => {
    el.scrollTop = 300;
  });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(readPercent).not.toBe(70);
  expect(await readPercent()).toBeGreaterThan(0);
});
