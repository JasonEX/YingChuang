/**
 * Shared text patterns for chapter/section detection
 * Used by NavigationDetector and AutoEnableManager
 */

/** Section link text patterns - "页" indicates section/page */
export const SECTION_TEXT_PATTERNS = [
  /[下上]一?页/, // 下一页, 上一页
  /[下上]一?頁/, // 繁体
  /第\d+页/, // 第2页
  /\(\d+\/\d+\)/, // (2/5) 分页指示
];

/** Chapter link text patterns - indicates real chapter navigation */
export const CHAPTER_TEXT_PATTERNS = [
  /[下上]一?章/, // 下一章, 上一章
  /[下上]一?[节節]/, // 下一节 / 下一節
  /第.+[章节節]/, // 第X章 / 第X节 / 第X節
];

/**
 * Site AJAX endpoints that sit under a chapter-shaped path but never serve a chapter.
 *
 * These are matched against both the full URL and the pathname, so they stay host-agnostic:
 * any site exposing the same endpoint names is filtered too. Both the navigation-link filter
 * (NavigationDetector) and the pre-fetch chapter guard (reader store) consume this single list
 * so a fix to one cannot silently miss the other.
 *
 * Origin: Ciweimao (`wap.ciweimao.com/chapter/get_par_tsu_list?chapter_id=...` and friends).
 */
export const NON_CHAPTER_ENDPOINT_PATTERNS = [
  /\/chapter\/get_par_tsu_list(?:$|[/?#])/i,
  /\/chapter\/ajax_get_session_code(?:$|[/?#])/i,
  /\/chapter\/get_book_chapter_detail_info(?:$|[/?#])/i,
];
