/**
 * CSS selectors for content processing
 */

/** Default selectors for elements to remove during content processing */
export const REMOVE_SELECTORS = [
  'script',
  'style',
  'iframe',
  'noscript',
  '.ad',
  '.ads',
  '.advertisement',
  '[class*="ad-"]',
  '[id*="ad-"]',
  '.sponsor',
  '.recommend',
  '.related',
  '.comment',
  '.share',
  '[class*="share"]',
  '[id*="share"]',
  '.div_feedback',
  '[class*="feedback"]',
  '[id*="feedback"]',
  '.anchor_bookmark',
  '[class*="bookmark"]',
  '[id*="bookmark"]',
  '.social_share_frame',
  '.social_share_inner_frame',
  '.page-separator',
  '.page_separator_first',
  '.page_separator_last',
  '.prev_page',
  '.next_page',
  '.more_recommend',
  '[class*="recommend"]',
  '[id*="recommend"]',
  '.txtcenter',
  '.mobadsq',
  'amp-social-share',
  'ins.adsbygoogle',
];

/** Advertisement text patterns to remove from content */
export const AD_PATTERNS = [
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
  // Common site ads
  /手机用户请到.*阅读/gi,
  /请记住本书.*网址/gi,
  /【[^】\r\n]{1,120}】(?:小说|小說)(?:免费|免費)(?:阅读|閱讀)[，,][ \t\u3000]*(?:请|請)收藏[ \t\u3000]*[^【】\r\n]{1,32}【1qxs\.com】/giu,
  /(?:[请請]?[记記]住首[发發][网網]站(?:域名)?|[请請][记記]住[网網]址)[^<\n]*/gi,
  /百度搜索.*最新章节/gi,
  /一秒记住.*为您提供/gi,
  /天才一秒记住/gi,
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
  /幻[^\u4e00-\u9fff]{0,3}想[^\u4e00-\u9fff]{0,3}姬[^\u4e00-\u9fff]{0,6}免[^\u4e00-\u9fff]{0,3}费[^\u4e00-\u9fff]{0,3}(?:阅|讀)[^\u4e00-\u9fff]{0,3}(?:读|讀)/gi,
  /萝[^\u4e00-\u9fff]{0,3}拉[^\u4e00-\u9fff]{0,3}小[^\u4e00-\u9fff]{0,3}说[^\u4e00-\u9fff]{0,3}\d{1,3}[^\u4e00-\u9fff]{0,3}最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
  /(天天看小说|天天看小說)[^<\n]*ttks\.tw/gi,
  /⚡?\s*天天看[小小說]{2}[^<\n]*/gi,
  /https?:\/\/[^\s<>"]+/gi,
  /www\.[a-z0-9]+\.(com|net|org|cc)/gi,
];
