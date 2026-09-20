import type { CachedChapter } from './types';
import type { NavigationContext } from './navigationContext';
import type { ParsedChapter } from '@/core/parser';
import type { PreparedChapterLoad } from './chapterLoadGuards';

import { MAX_CACHED_CHAPTERS, MAX_SESSION_CACHE } from './types';
import { trimCachedContents } from './trim';

export async function insertCachedChapter(
  ctx: NavigationContext,
  cached: CachedChapter,
  position: 'append' | 'prepend'
): Promise<boolean> {
  const runId = ctx.runtime.viewId();
  const suffix = position === 'append' ? 'cached' : 'cached-prev';
  const id = `chapter-${Date.now()}-${suffix}-${ctx.chapters.value.length}`;
  const entry = {
    chapter: { ...cached.chapter },
    rule: cached.rule,
    id,
  };

  if (position === 'append') {
    ctx.chapters.value.push(entry);
  } else {
    ctx.chapters.value.unshift(entry);
    ctx.currentChapterIndex.value++;
  }

  ctx.originalContents.value.set(id, cached.chapter.content);
  ctx.originalTitles.value.set(id, {
    title: cached.chapter.title,
    bookTitle: cached.chapter.bookTitle,
  });

  if (ctx.currentConversionMode.value !== 'none') {
    await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
  }
  if (ctx.runtime.isViewStale(runId)) return false;

  trimDisplayChapters(ctx, position === 'append');

  return true;
}

export async function insertParsedChapter(
  ctx: NavigationContext,
  load: PreparedChapterLoad,
  parsed: ParsedChapter
): Promise<boolean> {
  const runId = ctx.runtime.viewId();
  const suffix = load.isNext ? '' : 'prev-';
  const id = `chapter-${Date.now()}-${suffix}${ctx.chapters.value.length}`;
  const entry = {
    chapter: parsed,
    rule: parsed.rule,
    id,
  };

  if (load.isNext) {
    ctx.chapters.value.push(entry);
  } else {
    ctx.chapters.value.unshift(entry);
    ctx.currentChapterIndex.value++;
  }

  ctx.originalContents.value.set(id, parsed.content);
  ctx.originalTitles.value.set(id, { title: parsed.title, bookTitle: parsed.bookTitle });

  ctx.cachedContents.value.set(parsed.url, {
    chapter: parsed,
    rule: parsed.rule,
    cachedAt: Date.now(),
  });

  trimCachedContents(ctx.cachedContents.value, MAX_SESSION_CACHE);

  if (ctx.currentConversionMode.value !== 'none') {
    await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
  }
  if (ctx.runtime.isViewStale(runId)) return false;

  if (!ctx.history.value.includes(parsed.url)) {
    if (load.isNext) {
      ctx.history.value.push(parsed.url);
    } else {
      ctx.history.value.unshift(parsed.url);
    }
  }

  trimDisplayChapters(ctx, load.isNext);

  return true;
}

export async function rebuildChaptersFromCache(
  ctx: NavigationContext,
  cached: CachedChapter
): Promise<boolean> {
  const runId = ctx.runtime.viewId();
  ctx.chapters.value = [];
  ctx.currentChapterIndex.value = 0;
  ctx.originalContents.value.clear();
  ctx.originalTitles.value.clear();

  const id = `chapter-${Date.now()}-jump-0`;
  ctx.chapters.value.push({
    chapter: { ...cached.chapter },
    rule: cached.rule,
    id,
  });

  ctx.originalContents.value.set(id, cached.chapter.content);
  ctx.originalTitles.value.set(id, {
    title: cached.chapter.title,
    bookTitle: cached.chapter.bookTitle,
  });

  if (ctx.currentConversionMode.value !== 'none') {
    await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
  }
  if (ctx.runtime.isViewStale(runId)) return false;

  return true;
}

function trimDisplayChapters(ctx: NavigationContext, isAppend: boolean): void {
  if (ctx.chapters.value.length <= MAX_CACHED_CHAPTERS) return;

  if (isAppend && ctx.currentChapterIndex.value > 2) {
    const removed = ctx.chapters.value.shift();
    if (removed) {
      ctx.originalContents.value.delete(removed.id);
      ctx.originalTitles.value.delete(removed.id);
      ctx.currentChapterIndex.value = Math.max(0, ctx.currentChapterIndex.value - 1);
    }
    return;
  }

  if (!isAppend) {
    const removed = ctx.chapters.value.pop();
    if (removed) {
      ctx.originalContents.value.delete(removed.id);
      ctx.originalTitles.value.delete(removed.id);
    }
  }
}
