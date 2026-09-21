import type { ChapterEntry, LoadSource } from './types';
import { normalizeUrl, normalizeUrlForBlock, normalizeUrlForFetch } from './utils';
import { SECTION_MERGING_TOAST, VIP_BLOCK_TOAST } from './types';
import {
  shouldPersistNavigationBlock,
  shouldUseNavigationFailureCooldown,
} from './navigationPolicy';

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
      ctx.showToast(refChapter?.sectionProgress ? SECTION_MERGING_TOAST : endMessage, 'info');
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

  if (
    refChapter.chapter.indexUrl &&
    normalizeUrl(targetUrl) === normalizeUrl(refChapter.chapter.indexUrl)
  ) {
    if (shouldPersistNavigationBlock(source)) {
      ctx.blockedNavUrls.value.add(normalizeUrlForBlock(targetUrl));
    }
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

  const failure = ctx.navFailures.get(navKey);
  if (shouldUseNavigationFailureCooldown(source) && failure && Date.now() < failure.nextRetryAt) {
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

export function validateTargetChapterUrl(
  ctx: NavigationContext,
  load: PreparedChapterLoad,
  source: LoadSource
): boolean {
  if (!isInvalidChapterUrl(load.targetUrl, load.refChapter.chapter.url)) {
    return true;
  }

  load.isLoadingRef.value = false;
  if (shouldPersistNavigationBlock(source)) {
    ctx.blockedNavUrls.value.add(load.navKey);
  }
  if (source === 'manual') {
    ctx.showToast(load.endMessage, 'info');
  }
  return false;
}
