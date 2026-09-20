/**
 * Core utility functions
 */

export { cssEscape } from './cssEscape';
export { generateCssSelector } from './selectorUtils';
export {
  normalizeAbsoluteUrl,
  joinHtml,
  normalizeCiwemaoChapterUrl,
  normalizeRedundantFirstPageParam,
  isSectionLikeUrl,
  getSectionBaseUrl,
} from './urlUtils';
export { sanitizeHtml, sanitizeUrl } from './sanitizeHtml';
