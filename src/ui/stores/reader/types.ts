/**
 * Reader Store Types and Constants
 */

import type { ChineseScript, ConversionMode } from '@/core/converter';
import type { ParsedChapter } from '@/core/parser';
import type { SiteRule } from '@/core/rules/types';

// ============ Constants ============

/** Maximum chapters kept in the display list */
export const MAX_CACHED_CHAPTERS = 6;

/** LRU cache limit for in-memory session cache */
export const MAX_SESSION_CACHE = 500;

/** Max navigation failure records */
export const MAX_NAV_FAILURES = 200;

/** VIP block toast message */
export const VIP_BLOCK_TOAST = '该章节为VIP/付费内容，无法加载';

/** Shown instead of an end-of-book message while a chapter is still merging its sections */
export const SECTION_MERGING_TOAST = '本章正在加载后续内容，请稍候';

/** Shown instead of an end-of-book message once a chapter is known to be missing pages */
export const SECTION_INCOMPLETE_TOAST = '本章内容不完整，无法确认下一章';

// ============ Types ============

/** Load source type */
export type LoadSource = 'auto' | 'manual';

/** Cache progress state for UI */
export interface CacheProgressState {
  done: number;
  total: number;
  failed: number;
  running: boolean;
}

/** Progress of a background section merge feeding one chapter entry */
export interface SectionProgressState {
  /** Section pages merged into this entry so far, first page included */
  loaded: number;
  /** Total section pages, only when the site declares a verifiable count */
  total?: number;
}

/** Bookkeeping for one in-flight section merge */
export interface SectionMergeRecord {
  abort: () => void;
  /** Conversion mode the appended deltas were converted with */
  convertedMode: ConversionMode;
  /** Source script the appended deltas were converted with */
  convertedScript?: ChineseScript;
  /** Serialises this merge's writes; see `queueMergeWrite` */
  queue: Promise<unknown>;
}

/** Chapter entry for infinite scroll */
export interface ChapterEntry {
  chapter: ParsedChapter;
  rule?: SiteRule;
  id: string; // unique ID for Vue key
  /** Present only while more section pages are still being merged into `chapter` */
  sectionProgress?: SectionProgressState;
  /** Set once a merge ended without every page, so the chapter is known to be short */
  sectionsIncomplete?: boolean;
}

let nextChapterEntryId = 0;
/** Never reused, including same-tick replacements and display-window trimming. */
export function createChapterEntryId(): string {
  return `chapter-${++nextChapterEntryId}`;
}

/** Partial chapters have no stable whole-chapter reading position. */
export function isChapterComplete(entry: ChapterEntry | undefined): entry is ChapterEntry {
  return !!entry && !entry.sectionProgress && !entry.sectionsIncomplete;
}

/** Table of contents entry */
export interface TocEntry {
  title: string;
  url: string;
  /** Present only when the TOC provider can prove the chapter is unavailable to this session. */
  access?: 'locked';
}

/** TOC entry with cache status for UI */
export interface TocEntryWithStatus extends TocEntry {
  isCached: boolean;
  isPersisted: boolean;
  isCurrent: boolean;
}

/** Cached chapter content (separate from display chapters) */
export interface CachedChapter {
  chapter: ParsedChapter;
  rule?: SiteRule;
  cachedAt: number;
}

/** Navigation failure record */
export interface NavFailureRecord {
  count: number;
  nextRetryAt: number;
}
