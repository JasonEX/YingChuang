import type { ChapterEntry, LoadSource } from './types';
import { normalizeUrl, normalizeUrlForBlock, normalizeUrlForFetch } from './utils';
import { SECTION_INCOMPLETE_TOAST, SECTION_MERGING_TOAST, VIP_BLOCK_TOAST } from './types';

import { isInvalidChapterUrl } from './detection';
import type { NavigationContext } from './navigationContext';
import type { PendingSectionMerge } from './section';
import type { Ref } from 'vue';

export interface PreparedChapterLoad {
  direction: 'next' | 'prev';
  endMessage: string;
  errorMessage: string;
  isLoadingRef: Ref<boolean>;
  isNext: boolean;
  navKey: string;
  pendingAbortRef: Ref<(() => void) | null>;
  refChapter: ChapterEntry;
  /** Set once a progressive merge hands back its handle; not reactive state. */
  sectionMerge: PendingSectionMerge | null;
  targetUrl: string;
}

function isBookIndexUrl(targetUrl: string, refChapter: ChapterEntry): boolean {
  const indexUrl = refChapter.chapter.indexUrl;
  return !!indexUrl && normalizeUrl(normalizeUrlForFetch(targetUrl)) === normalizeUrl(indexUrl);
}

/**
 * The book index is a boundary; other URL checks are heuristics.
 * Cached chapters take precedence over those heuristics, including offline cache candidates.
 */
export function leadsOutOfBook(
  targetUrl: string,
  refChapter: ChapterEntry,
  hasCacheCandidate = false
): boolean {
  return (
    isBookIndexUrl(targetUrl, refChapter) ||
    (!hasCacheCandidate && isInvalidChapterUrl(targetUrl, refChapter.chapter.url))
  );
}

/** An end-of-book claim is only honest once the boundary chapter has all of its pages. */
function boundaryMessage(refChapter: ChapterEntry | undefined, endMessage: string): string {
  if (refChapter?.sectionProgress) return SECTION_MERGING_TOAST;
  if (refChapter?.sectionsIncomplete) return SECTION_INCOMPLETE_TOAST;
  return endMessage;
}

export function prepareChapterLoad(
  ctx: NavigationContext,
  direction: 'next' | 'prev',
  source: LoadSource
): PreparedChapterLoad | null {
  const isNext = direction === 'next';
  const refChapter = isNext
    ? ctx.chapters.value[ctx.chapters.value.length - 1]
    : ctx.chapters.value[0];
  const isLoadingRef = isNext ? ctx.isLoadingNext : ctx.isLoadingPrev;
  const pendingAbortRef = isNext ? ctx.pendingNextAbort : ctx.pendingPrevAbort;
  const endMessage = isNext ? '已经是最后一章了' : '已经是第一章了';
  const errorMessage = isNext ? '加载下一章失败' : '加载上一章失败';

  if (isLoadingRef.value) {
    return null;
  }

  const rawTargetUrl = isNext ? refChapter?.chapter.nextUrl : refChapter?.chapter.prevUrl;
  if (!rawTargetUrl || !refChapter) {
    if (source === 'manual') {
      // A merging chapter withholds its next URL, so an end-of-book claim would be wrong.
      ctx.showToast(boundaryMessage(refChapter, endMessage), 'info');
    }
    return null;
  }

  const targetUrl = normalizeUrlForFetch(rawTargetUrl);
  if (targetUrl !== rawTargetUrl) {
    if (isNext) {
      refChapter.chapter.nextUrl = targetUrl;
    } else {
      refChapter.chapter.prevUrl = targetUrl;
    }
  }

  // Availability uses the same cache-aware check, so no block needs recording.
  const hasCacheCandidate =
    ctx.cachedContents.value.has(targetUrl) || ctx.persistedUrls.value.has(targetUrl);
  if (leadsOutOfBook(targetUrl, refChapter, hasCacheCandidate)) {
    if (source === 'manual') {
      ctx.showToast(endMessage, 'info');
    }
    return null;
  }

  if (ctx.vipBlockedUrls.value.has(normalizeUrlForBlock(targetUrl))) {
    ctx.showToast(VIP_BLOCK_TOAST, 'info', 3000);
    return null;
  }

  const navKey = normalizeUrlForBlock(targetUrl);
  if (ctx.blockedNavUrls.value.has(navKey)) {
    if (source === 'manual') {
      ctx.showToast(endMessage, 'info');
    }
    return null;
  }

  if (ctx.loadedUrls.value.has(targetUrl)) {
    return null;
  }

  return {
    direction,
    endMessage,
    errorMessage,
    isLoadingRef,
    isNext,
    navKey,
    pendingAbortRef,
    refChapter,
    sectionMerge: null,
    targetUrl,
  };
}
