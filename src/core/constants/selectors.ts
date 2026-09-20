/**
 * CSS selectors for content processing
 */

/** Default selectors for elements to remove during content processing */
export const REMOVE_SELECTORS = [
  // Structural noise.
  'script',
  'style',
  'iframe',
  'noscript',

  // Ad containers. `ad-` must be anchored to the start of a class token: a bare
  // [class*="ad-"] also matches read-, head-, load-, thread- and upload- prefixed classes,
  // which can silently delete real content nested inside the chapter container.
  '.ad',
  '.ads',
  '.advertisement',
  '[class^="ad-"]',
  '[class*=" ad-"]',
  '[id^="ad-"]',
  'ins.adsbygoogle',
  'amp-social-share',

  // On-page recommendation / interaction widgets.
  '.sponsor',
  '.recommend',
  '[class*="recommend"]',
  '[id*="recommend"]',
  '.related',
  '.comment',
  '.share',
  '[class*="share"]',
  '[id*="share"]',
  '[class*="feedback"]',
  '[id*="feedback"]',
  '[class*="bookmark"]',
  '[id*="bookmark"]',

  // In-chapter pagination controls.
  '.page-separator',
  '.page_separator_first',
  '.page_separator_last',
  '.prev_page',
  '.next_page',

  // Ad class names whose originating site is no longer known. Do not grow this group:
  // a class name that belongs to one site belongs in src/core/rules/sites/*.
  '.mobadsq',
];

/**
 * Generic in-content spam shapes.
 *
 * Every entry here must describe a *shape* that any site could produce — pagination hints,
 * page counters, "remember our domain" boilerplate. A pattern keyed to one site's brand or
 * host belongs in SITE_WATERMARK_PATTERNS below, or better, in that site's own rule.
 */
export const GENERIC_AD_PATTERNS = [
  // Section/page navigation hints (分页提示) - use [（(] and [）)] to match both full-width and half-width
  /[（(]本章未完[，,]?请?点击下一页继续阅读[）)]/gi,
  /本章未完[，,]?请?点击下一页继续.*/gi,
  /请点击下一页继续阅读/gi,
  /点击下一页继续阅读/gi,
  // Page number indicators (页码指示) - match both full-width and half-width parentheses
  /[（(]第\d+[/／]\d+页[）)]/gi,
  /第\d+[/／]\d+页/gi,
  // Standalone orphan parentheses left after cleaning (孤立括号清理)
  /[（(]\s*[）)]/g, // Empty parentheses
  /[（(]\s*$/gm, // Orphan opening parenthesis at end of line
  /^\s*[）)]/gm, // Orphan closing parenthesis at start of line
  // "Remember our domain" / SEO boilerplate, not tied to any one host
  /手机用户请到.*阅读/gi,
  /请记住本书.*网址/gi,
  /(?:[请請]?[记記]住首[发發][网網]站(?:域名)?|[请請][记記]住[网網]址)[^<\n]*/gi,
  /百度搜索.*最新章节/gi,
  /一秒记住.*为您提供/gi,
  /天才一秒记住/gi,
  // 笔趣阁 is a clone-site family rather than a single host, so it stays generic.
  /笔趣阁.*www\.[a-z]+\.(com|net|org)/gi,
  /添加书签\s*返回目录\s*章节报错\s*分享给朋友[:：]?\s*/gi,
  /添加書籤\s*返回目錄\s*章節報錯\s*分享給朋友[:：]?\s*/gi,
  /由於[緩缓存]原因[^<\n]{0,120}(?:更新|網站|网站|站)/gi,
  /[请請][用戶用户]直接[瀏覽浏览]器[訪访]問[^<\n]{0,120}/gi,
  // "阅读模式/畅读模式" anti-reader hint (often obfuscated with | between characters)
  /(?:阅[|｜\s]*读[|｜\s]*模[|｜\s]*式|畅[|｜\s]*读[|｜\s]*模[|｜\s]*式)[^<\n]{0,60}无[|｜\s]*法[|｜\s]*显[|｜\s]*示[|｜\s]*本[|｜\s]*章[|｜\s]*节[|｜\s]*全[|｜\s]*部[|｜\s]*内[|｜\s]*容[^<\n]{0,120}/gi,
  /请[|｜\s]*返[|｜\s]*回[|｜\s]*原[|｜\s]*网[|｜\s]*页[|｜\s]*阅[|｜\s]*读/gi,
  /加[|｜\s]*载[|｜\s]*更[|｜\s]*多/gi,
  // Obfuscated "小说网最新章节更新快" spam (allow noise between characters)
  /小[^\u4e00-\u9fff]{0,3}说[^\u4e00-\u9fff]{0,3}网[^\u4e00-\u9fff]{0,6}最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
  /最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
];

/**
 * Watermarks keyed to one specific site that has no rule file of its own.
 *
 * These run against every site's content forever, so the list is a liability, not an asset.
 * Policy for new entries:
 *   1. If the site has (or deserves) a file in src/core/rules/sites/*, put the pattern in that
 *      rule's \`content.replace\` or \`hooks.beforeParse\` instead of adding it here.
 *   2. Only add here when the site is not adapted at all and the watermark breaks reading.
 *   3. Record the host, so the entry can be retired once a rule file covers it.
 *
 * Known migration debt: the 天天看小說 entries duplicate ttks.ts's own watermark cleanup and
 * should move into that rule — that changes ContentProcessor's replace-rule code path, so it
 * needs browser validation rather than a blind move.
 */
export const SITE_WATERMARK_PATTERNS = [
  // 1qxs.com
  /【[^】\r\n]{1,120}】(?:小说|小說)(?:免费|免費)(?:阅读|閱讀)[，,][ \t\u3000]*(?:请|請)收藏[ \t\u3000]*[^【】\r\n]{1,32}【1qxs\.com】/giu,
  // 幻想姬
  /幻[^\u4e00-\u9fff]{0,3}想[^\u4e00-\u9fff]{0,3}姬[^\u4e00-\u9fff]{0,6}免[^\u4e00-\u9fff]{0,3}费[^\u4e00-\u9fff]{0,3}(?:阅|讀)[^\u4e00-\u9fff]{0,3}(?:读|讀)/gi,
  // 萝拉小说
  /萝[^\u4e00-\u9fff]{0,3}拉[^\u4e00-\u9fff]{0,3}小[^\u4e00-\u9fff]{0,3}说[^\u4e00-\u9fff]{0,3}\d{1,3}[^\u4e00-\u9fff]{0,3}最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
  // ttks.tw (天天看小說) — see migration debt above.
  /(天天看小说|天天看小說)[^<\n]*ttks\.tw/gi,
  /⚡?\s*天天看[小小說]{2}[^<\n]*/gi,
];

/**
 * Bare-URL scrubbing. Must run last: these would otherwise consume the host name that the
 * site watermark patterns above use as their anchor.
 */
export const BARE_URL_PATTERNS = [/https?:\/\/[^\s<>"]+/gi, /www\.[a-z0-9]+\.(com|net|org|cc)/gi];

/** Advertisement text patterns to remove from content, in execution order. */
export const AD_PATTERNS = [
  ...GENERIC_AD_PATTERNS,
  ...SITE_WATERMARK_PATTERNS,
  ...BARE_URL_PATTERNS,
];
