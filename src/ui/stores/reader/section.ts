/**
 * Reader Store Section Parsing
 * Handles section/page merging for multi-page chapters
 *
 * Delegates to the core SectionMerger for the actual merge logic.
 */

import { createSectionMerger } from '@/core/auto-enable/SectionMerger';
import { getParser } from '@/core/parser';
import type { ParsedChapter } from '@/core/parser';
import type { SectionMergeSink } from './sectionProgress';
import type { SectionProgressState } from './types';

/**
 * Parse a chapter with section merging support
 * Handles multi-page chapters by fetching and merging all sections
 */
export async function parseWithSectionMerge(
  parser: ReturnType<typeof getParser>,
  initialDoc: Document,
  url: string,
  options: { signal?: AbortSignal } = {}
): Promise<ParsedChapter | null> {
  const merger = createSectionMerger(parser);
  return merger.merge(initialDoc, url, options);
}

/** Handle the caller uses to commit or drop the first section page of a progressive merge. */
export interface PendingSectionMerge {
  progress: SectionProgressState;
  /** Attach the committed display entry, releasing the merge to fetch the next page. */
  commit: (entryId: string) => void;
  /** The first page was not committed, so stop the merge. */
  reject: () => void;
  abort: () => void;
}

export interface StartProgressiveSectionMergeOptions {
  controller: AbortController;
  sink: SectionMergeSink;
}

/**
 * Parse a chapter, handing back its first section page as soon as it is ready.
 *
 * Merging pauses until the caller commits a display entry, so no further request leaves the
 * browser before the first page is on screen and nothing can be appended to an entry that
 * does not exist yet. Remaining pages are written through the sink in order; the merge then
 * outlives this call, which is what lets the reader move on to the next chapter meanwhile.
 *
 * A chapter with nothing to merge resolves exactly as `parseWithSectionMerge` does, with a
 * null handle.
 */
export async function startProgressiveSectionMerge(
  parser: ReturnType<typeof getParser>,
  initialDoc: Document,
  url: string,
  options: StartProgressiveSectionMergeOptions
): Promise<{ chapter: ParsedChapter | null; merge: PendingSectionMerge | null }> {
  const { controller, sink } = options;

  let resolveFirst!: (chapter: ParsedChapter | null) => void;
  const firstReady = new Promise<ParsedChapter | null>(resolve => {
    resolveFirst = resolve;
  });

  let releaseGate!: () => void;
  const gate = new Promise<void>(resolve => {
    releaseGate = resolve;
  });

  let entryId: string | null = null;
  let progressive = false;
  let progress: SectionProgressState = { loaded: 1 };
  let truncated = false;

  void createSectionMerger(parser)
    .merge(initialDoc, url, {
      signal: controller.signal,
      onFirstPage: (chapter, info) => {
        progressive = true;
        progress = { loaded: info.loaded, total: info.total };
        resolveFirst(chapter);
        return gate;
      },
      onSectionPage: async (delta, info) => {
        const target = entryId;
        if (!target) return;
        await sink.append(target, { ...delta, loaded: info.loaded, total: info.total });
      },
      onMergeEnd: end => {
        truncated = end.truncated;
      },
    })
    .then(async chapter => {
      resolveFirst(chapter);
      const target = entryId;
      if (!target) return;
      if (!chapter || controller.signal.aborted) {
        sink.cancel(target, controller.signal.aborted ? 'aborted' : 'failed');
        return;
      }
      await sink.complete(target, chapter, chapter.rule, { truncated });
    })
    .catch(error => {
      console.error('[MNR] Background section merge failed:', error);
      const target = entryId;
      if (target) sink.cancel(target, 'failed');
      resolveFirst(null);
    });

  const chapter = await firstReady;
  if (!progressive) return { chapter, merge: null };

  return {
    chapter,
    merge: {
      progress,
      abort: () => controller.abort(),
      commit: (id: string) => {
        entryId = id;
        releaseGate();
      },
      reject: () => {
        controller.abort();
        releaseGate();
      },
    },
  };
}
