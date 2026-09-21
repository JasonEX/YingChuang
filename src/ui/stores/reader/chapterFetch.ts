import { MAX_NAV_FAILURES, VIP_BLOCK_TOAST } from './types';
import type { ParsedChapter, Parser } from '@/core/parser';

import { createSectionMergeSink } from './sectionProgress';
import { fetchAndParseUrl } from '@/core/utils/network';
import { getChapterDocumentBlockReason } from '@/core/detection';
import { getRuleManager } from '@/core/rules/RuleManager';
import type { LoadSource } from './types';
import type { NavigationContext } from './navigationContext';
import { normalizeUrlForBlock } from './utils';
import type { PreparedChapterLoad } from './chapterLoadGuards';
import { recordDebugEvent } from '@/core/debug/events';
import { recordNavFailure } from './navFailure';
import { startProgressiveSectionMerge } from './section';

export type FetchDocumentResult = Document | 'abort' | null;
export type ParsedCandidateResult = ParsedChapter | 'abort' | 'blocked' | null;

export function loadDocumentInIframe(
  url: string,
  timeoutMs: number = 15000
): { promise: Promise<{ doc: Document; cleanup: () => void } | null>; abort: () => void } {
  let iframe: HTMLIFrameElement | null = null;
  let timeoutId: number | null = null;
  let settled = false;
  let resolveResult: ((result: { doc: Document; cleanup: () => void } | null) => void) | null =
    null;

  const clearTimer = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const cleanup = () => {
    clearTimer();
    if (iframe) {
      iframe.remove();
      iframe = null;
    }
  };

  const finish = (result: { doc: Document; cleanup: () => void } | null) => {
    if (settled) return;
    settled = true;
    if (result) {
      clearTimer();
    } else {
      cleanup();
    }
    resolveResult?.(result);
  };

  const promise = new Promise<{ doc: Document; cleanup: () => void } | null>(resolve => {
    resolveResult = resolve;
    iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.cssText = [
      'position:absolute',
      'display:block!important',
      'left:-10000px',
      'top:0',
      'width:1200px',
      'height:8000px',
      'opacity:0',
      'pointer-events:none',
      'border:0',
    ].join(';');

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          if (iframe?.contentWindow?.location.href === 'about:blank') return;
          const doc = iframe?.contentDocument;
          if (!doc?.body || doc.body.childNodes.length === 0) return;
          finish({ doc, cleanup });
        } catch {
          finish(null);
        }
      }, 300);
    };
    iframe.onerror = () => finish(null);

    timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    const parent = document.body || document.documentElement;
    if (!parent) {
      finish(null);
      return;
    }
    iframe.src = url;
    parent.appendChild(iframe);
  });

  return {
    promise,
    abort: () => {
      cleanup();
      finish(null);
    },
  };
}

export async function loadFetchDocument(
  ctx: NavigationContext,
  load: PreparedChapterLoad,
  runId: number,
  referer: string
): Promise<FetchDocumentResult> {
  const ruleDoc = await loadRuleApiDocument(load.targetUrl, load.refChapter.chapter);
  if (ctx.runtime.isViewStale(runId)) return 'abort';
  if (ruleDoc) return ruleDoc;

  const fetchLoader = fetchAndParseUrl(load.targetUrl, referer);
  const abort = fetchLoader.abort;
  if (ctx.runtime.isViewStale(runId)) {
    abort();
    return 'abort';
  }
  load.pendingAbortRef.value = abort;

  const fetchResult = await fetchLoader.promise;
  if (ctx.runtime.isViewStale(runId)) {
    abort();
    return 'abort';
  }
  clearPendingAbort(load, abort);

  if (fetchResult.error === 'abort') {
    return 'abort';
  }
  if (!fetchResult.doc) {
    recordDebugEvent('chapter.fetch.failed', {
      url: load.targetUrl,
      reason: fetchResult.error,
      status: fetchResult.status,
    });
  }
  return fetchResult.doc;
}

/**
 * Executable hooks come from the current rule for the target URL, never a cached rule
 * snapshot: JSON persistence retains chapter data but drops functions.
 */
export async function loadRuleApiDocument(
  url: string,
  reference: Pick<ParsedChapter, 'bookTitle' | 'indexUrl' | 'url'>
): Promise<Document | null> {
  const match = getRuleManager().matchRule(url);
  const fetchDocument = match?.rule.hooks?.fetchDocument;
  if (!fetchDocument) return null;

  return fetchDocument(url, {
    bookTitle: reference.bookTitle,
    indexUrl: reference.indexUrl,
    refererUrl: reference.url,
  });
}

export async function parseCandidateDocument(
  ctx: NavigationContext,
  load: PreparedChapterLoad,
  parser: Parser,
  doc: Document,
  runId: number,
  _referer: string,
  source: LoadSource
): Promise<ParsedCandidateResult> {
  if (ctx.runtime.isViewStale(runId)) return 'abort';
  const blockReason = getChapterDocumentBlockReason(doc);
  if (blockReason) {
    recordDebugEvent('chapter.rejected', { url: load.targetUrl, reason: blockReason });
  }
  if (blockReason === 'cloudflare') {
    const count = recordNavFailure(ctx.navFailures, load.navKey, {
      maxFailures: MAX_NAV_FAILURES,
    });
    if (source === 'manual' || count === 1) {
      ctx.showToast('Cloudflare 验证页面，请在新标签页中完成验证后重试', 'info', 4000);
    }
    return 'blocked';
  }

  if (blockReason === 'vip') {
    ctx.vipBlockedUrls.value.add(normalizeUrlForBlock(load.targetUrl));
    ctx.showToast(VIP_BLOCK_TOAST, 'info', 3000);
    return 'blocked';
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  load.pendingAbortRef.value = abort;

  try {
    const { chapter, merge } = await startProgressiveSectionMerge(parser, doc, load.targetUrl, {
      controller,
      sink: createSectionMergeSink(ctx),
    });
    if (controller.signal.aborted || ctx.runtime.isViewStale(runId)) {
      merge?.reject();
      return 'abort';
    }
    // Ownership of the abort moves to the store's merge registry once the entry is committed,
    // so navigating on to the next chapter no longer cancels the remaining section pages.
    load.sectionMerge = merge;
    return chapter;
  } finally {
    clearPendingAbort(load, abort);
  }
}

export function clearPendingAbort(load: PreparedChapterLoad, abort: () => void): void {
  if (load.pendingAbortRef.value === abort) {
    load.pendingAbortRef.value = null;
  }
}
