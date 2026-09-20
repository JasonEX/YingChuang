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
