/**
 * Reader Store - Progressive Section Merging
 *
 * Tracks background merges that keep appending section pages to a chapter already on screen.
 * The display list is the only place partial content lives: a chapter reaches `cachedContents`
 * once it has merged every page, so nothing half-merged can be re-inserted or persisted.
 */

import { type ChineseScript, type ConversionMode, convertHTML } from '@/core/converter';
import { MAX_SESSION_CACHE, type SectionMergeRecord, type SectionProgressState } from './types';
import type { ChapterEntry } from './types';
import { joinHtml } from '@/core/utils';
import type { NavigationContext } from './navigationContext';
import { normalizeUrlForFetch } from './utils';
import type { ParsedChapter } from '@/core/parser';
import { recordDebugEvent } from '@/core/debug/events';
import type { SectionPageDelta } from '@/core/auto-enable/SectionMerger';
import type { SiteRule } from '@/core/rules/types';
import { trimCachedContents } from './trim';

/** Content contributed by one section page, with the progress it implies. */
export interface SectionAppendDelta extends SectionPageDelta {
  loaded: number;
  total?: number;
}

/** Where a background merge writes its pages once a display entry exists. */
export interface SectionMergeSink {
  append: (entryId: string, delta: SectionAppendDelta) => Promise<boolean>;
  complete: (
    entryId: string,
    chapter: ParsedChapter,
    rule: SiteRule | undefined,
    info: { truncated: boolean }
  ) => Promise<boolean>;
  cancel: (entryId: string, reason: 'aborted' | 'failed') => void;
}

/** Bind the section-merge operations to one navigation context. */
export function createSectionMergeSink(ctx: NavigationContext): SectionMergeSink {
  return {
    append: (entryId, delta) => appendChapterSection(ctx, entryId, delta),
    complete: (entryId, chapter, rule, info) =>
      completeChapterSections(ctx, entryId, chapter, rule, info),
    cancel: (entryId, reason) => cancelChapterSections(ctx, entryId, reason),
  };
}

/**
 * Run one write for a merge, after every write already queued against it.
 *
 * Appending converts HTML and therefore yields. The queue belongs to the merge rather than to
 * any one caller: a completion slipping in mid-append would drop the record, the resuming
 * append would then find itself disowned, and with an unchanged source script nothing
 * afterwards rewrites the content -- that page would be missing from the screen for good.
 */
function queueMergeWrite(
  merge: SectionMergeRecord,
  task: () => Promise<boolean>
): Promise<boolean> {
  const run = merge.queue.then(task, task);
  merge.queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Resolve the entry a merge still owns, or null once it was cancelled or trimmed away. */
function findMergingEntry(
  ctx: NavigationContext,
  entryId: string,
  merge: SectionMergeRecord
): ChapterEntry | null {
  if (ctx.sectionMerges.value.get(entryId) !== merge) return null;
  return ctx.chapters.value.find(item => item.id === entryId) ?? null;
}

/**
 * Register a background merge against a chapter entry that is already on screen.
 *
 * Drops the entry from the session cache: a chapter that is still growing must never be
 * re-inserted or persisted as though it were complete.
 */
export function beginChapterSections(
  ctx: NavigationContext,
  entryId: string,
  progress: SectionProgressState,
  abort: () => void
): boolean {
  const entry = ctx.chapters.value.find(item => item.id === entryId);
  if (!entry) return false;

  entry.sectionProgress = { ...progress };
  delete entry.sectionsIncomplete;
  ctx.sectionMerges.value.set(entryId, {
    abort,
    convertedMode: ctx.currentConversionMode.value,
    convertedScript: entry.chapter.sourceScript,
    queue: Promise.resolve(),
    viewId: ctx.runtime.viewId(),
  });

  ctx.cachedContents.value.delete(entry.chapter.url);
  ctx.cachedContents.value.delete(normalizeUrlForFetch(entry.chapter.url));

  recordDebugEvent('reader.sectionMerge.begin', {
    entryId,
    loaded: progress.loaded,
    total: progress.total,
  });

  return true;
}

/**
 * Append one section page to a chapter that is still merging.
 *
 * Returns false once the merge was cancelled or its entry is gone; the merge itself keeps
 * running, so its completion can still populate the session cache.
 */
export function appendChapterSection(
  ctx: NavigationContext,
  entryId: string,
  delta: SectionAppendDelta
): Promise<boolean> {
  const merge = ctx.sectionMerges.value.get(entryId);
  if (!merge) return Promise.resolve(false);
  return queueMergeWrite(merge, () => appendSectionPage(ctx, entryId, merge, delta));
}

async function appendSectionPage(
  ctx: NavigationContext,
  entryId: string,
  merge: SectionMergeRecord,
  delta: SectionAppendDelta
): Promise<boolean> {
  const entry = findMergingEntry(ctx, entryId, merge);
  if (!entry) return false;

  const folded = joinHtml(
    ctx.originalContents.value.get(entryId) ?? entry.chapter.content,
    delta.content
  );

  entry.chapter = {
    ...entry.chapter,
    rawContent: joinHtml(entry.chapter.rawContent, delta.rawContent),
    sourceScript: delta.sourceScript,
    // A later page can be the first to reveal the next chapter. Publishing it now is what
    // lets the reader move on instead of waiting out the rest of the merge.
    ...(delta.nextUrl ? { nextUrl: normalizeUrlForFetch(delta.nextUrl) } : {}),
  };

  const mode = ctx.currentConversionMode.value;
  if (mode !== merge.convertedMode) {
    // The reader switched script mid-merge: re-convert everything folded so far, once.
    merge.convertedMode = mode;
    ctx.originalContents.value.set(entryId, folded);
    await ctx.applyConversionToChapterEntry(entryId, mode);
  } else {
    const displayDelta =
      mode === 'none'
        ? delta.content
        : await convertHTML(delta.content, mode, { sourceScript: delta.sourceScript });

    // Converting yields, so re-check ownership before committing the growth.
    const current = findMergingEntry(ctx, entryId, merge);
    if (!current) return false;

    ctx.originalContents.value.set(entryId, folded);
    current.chapter = {
      ...current.chapter,
      content: joinHtml(current.chapter.content, displayDelta),
    };
  }

  const committed = findMergingEntry(ctx, entryId, merge);
  if (!committed) return false;

  merge.convertedScript = delta.sourceScript;
  committed.sectionProgress = { loaded: delta.loaded, total: delta.total };

  return true;
}

/**
 * Finish a background merge with the fully merged chapter.
 *
 * Only an untruncated chapter is cached: a partial one would be indistinguishable from a
 * complete chapter on the next visit.
 */
export function completeChapterSections(
  ctx: NavigationContext,
  entryId: string,
  chapter: ParsedChapter,
  rule?: SiteRule,
  info: { truncated?: boolean } = {}
): Promise<boolean> {
  const merge = ctx.sectionMerges.value.get(entryId);
  if (!merge) return Promise.resolve(false);
  return queueMergeWrite(merge, () =>
    finishChapterSections(ctx, entryId, merge, chapter, rule, info)
  );
}

async function finishChapterSections(
  ctx: NavigationContext,
  entryId: string,
  merge: SectionMergeRecord,
  chapter: ParsedChapter,
  rule: SiteRule | undefined,
  info: { truncated?: boolean }
): Promise<boolean> {
  // A cancellation can land while this write waits its turn.
  if (ctx.sectionMerges.value.get(entryId) !== merge) return false;
  ctx.sectionMerges.value.delete(entryId);

  const url = normalizeUrlForFetch(chapter.url);
  const merged: ParsedChapter = {
    ...chapter,
    url,
    prevUrl: chapter.prevUrl ? normalizeUrlForFetch(chapter.prevUrl) : chapter.prevUrl,
    nextUrl: chapter.nextUrl ? normalizeUrlForFetch(chapter.nextUrl) : chapter.nextUrl,
    indexUrl: chapter.indexUrl ? normalizeUrlForFetch(chapter.indexUrl) : chapter.indexUrl,
  };

  const entry = ctx.chapters.value.find(item => item.id === entryId);
  const effectiveRule = rule ?? merged.rule ?? entry?.rule;

  if (!info.truncated) {
    ctx.cachedContents.value.set(url, {
      chapter: merged,
      rule: effectiveRule,
      cachedAt: Date.now(),
    });
    trimCachedContents(ctx.cachedContents.value, MAX_SESSION_CACHE);
  }

  recordDebugEvent('reader.sectionMerge.complete', {
    entryId,
    truncated: !!info.truncated,
    url,
  });

  if (info.truncated) ctx.showToast('本章后续内容加载不完整', 'info', 2500);
  if (!entry) return !info.truncated;

  ctx.originalContents.value.set(entryId, merged.content);
  entry.rule = effectiveRule;
  entry.chapter = {
    ...entry.chapter,
    rawContent: merged.rawContent,
    prevUrl: merged.prevUrl,
    nextUrl: merged.nextUrl,
    indexUrl: merged.indexUrl,
    sourceScript: merged.sourceScript,
  };
  delete entry.sectionProgress;
  // A short chapter must keep saying so: its next-chapter URL may never have been found, and
  // silently dropping the marker would let the reader be told the book had ended.
  if (info.truncated) entry.sectionsIncomplete = true;
  else delete entry.sectionsIncomplete;

  await reconcileMergedConversion(ctx, entryId, entry, merged, merge.convertedScript);

  return true;
}

/**
 * Align the displayed text with the finished chapter.
 *
 * Deltas are converted page by page, which matches converting the whole chapter except when
 * the cumulative source script changed along the way. Redo the pass only in that case.
 */
async function reconcileMergedConversion(
  ctx: NavigationContext,
  entryId: string,
  entry: ChapterEntry,
  merged: ParsedChapter,
  convertedScript: ChineseScript | undefined
): Promise<void> {
  const mode: ConversionMode = ctx.currentConversionMode.value;

  if (mode === 'none') {
    entry.chapter = { ...entry.chapter, content: merged.content };
    return;
  }

  if (convertedScript !== merged.sourceScript) {
    await ctx.applyConversionToChapterEntry(entryId, mode);
  }
}

/** Stop one background merge and clear the progress it was reporting. */
export function cancelChapterSections(
  ctx: NavigationContext,
  entryId: string,
  reason: 'aborted' | 'failed'
): void {
  const merge = ctx.sectionMerges.value.get(entryId);
  if (!merge) return;

  ctx.sectionMerges.value.delete(entryId);
  merge.abort();

  const entry = ctx.chapters.value.find(item => item.id === entryId);
  if (entry) {
    delete entry.sectionProgress;
    // A failed merge leaves the chapter short of pages it was owed; only a deliberate
    // teardown means the chapter is being discarded anyway.
    if (reason === 'failed') entry.sectionsIncomplete = true;
  }

  recordDebugEvent('reader.sectionMerge.cancel', { entryId, reason });
  if (reason === 'failed') ctx.showToast('本章后续内容加载失败', 'info', 2500);
}

/** Stop every background merge, for reader teardown and table-of-contents jumps. */
export function cancelAllSectionMerges(ctx: NavigationContext): void {
  for (const entryId of Array.from(ctx.sectionMerges.value.keys())) {
    cancelChapterSections(ctx, entryId, 'aborted');
  }
}
