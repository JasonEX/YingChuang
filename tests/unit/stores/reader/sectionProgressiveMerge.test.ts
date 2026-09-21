import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCacheV2ChapterKey } from '@/ui/stores/reader/persistence';
import { joinHtml } from '@/core/utils';
import type { ParsedChapter } from '@/core/parser';
import type { SectionMergeSink } from '@/ui/stores/reader/sectionProgress';
import { startProgressiveSectionMerge } from '@/ui/stores/reader/section';
import { useReaderStore } from '@/ui/stores/reader';

import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { createDom } from '../../../testUtils/dom';
import { setupPinia } from '../../../testUtils/pinia';

const mocks = vi.hoisted(() => ({
  createSectionMerger: vi.fn(),
  html: vi.fn(),
  text: vi.fn(),
}));

vi.mock('@/core/converter', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/converter')>()),
  convertHTML: mocks.html,
  convertText: mocks.text,
}));

vi.mock('@/core/auto-enable/SectionMerger', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/auto-enable/SectionMerger')>()),
  createSectionMerger: mocks.createSectionMerger,
}));

const CHAPTER_URL = 'https://example.com/book/1/1.html';
const INDEX_URL = 'https://example.com/book/1/';

function makeChapter(overrides: Partial<ParsedChapter> = {}): ParsedChapter {
  return {
    title: '第1章',
    content: '<p>第一页</p>',
    rawContent: '<p>raw1</p>',
    url: CHAPTER_URL,
    indexUrl: INDEX_URL,
    confidence: 1,
    method: 'rule',
    ...overrides,
  };
}

const fold = (...parts: string[]): string => parts.reduce((left, right) => joinHtml(left, right));

describe('reader store - section progress', () => {
  let gm: ReturnType<typeof createGmStorageMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.html.mockImplementation(async (html: string) => html);
    mocks.text.mockImplementation(async (text: string) => text);
    setupPinia();
    createDom(CHAPTER_URL);
    gm = createGmStorageMock();
    stubGmStorage(gm);
  });

  function startMerge(store: ReturnType<typeof useReaderStore>) {
    const abort = vi.fn();
    const entryId = store.setChapter(makeChapter());
    store.beginChapterSections(entryId, { loaded: 1, total: 3 }, abort);
    return { abort, entryId };
  }

  it('folds appended pages exactly the way the merger joins them', async () => {
    const store = useReaderStore();
    const { entryId } = startMerge(store);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      loaded: 2,
      total: 3,
    });
    await store.appendChapterSection(entryId, {
      content: '<p>第三页</p>',
      rawContent: '<p>raw3</p>',
      loaded: 3,
      total: 3,
    });

    expect(store.chapters[0]?.chapter.content).toBe(
      fold('<p>第一页</p>', '<p>第二页</p>', '<p>第三页</p>')
    );
    expect(store.chapters[0]?.chapter.rawContent).toBe(
      fold('<p>raw1</p>', '<p>raw2</p>', '<p>raw3</p>')
    );
    expect(store.chapters[0]?.sectionProgress).toEqual({ loaded: 3, total: 3 });
  });

  it('keeps a merging chapter out of the session cache until it completes', async () => {
    const store = useReaderStore();
    const { entryId } = startMerge(store);

    expect(store.cachedContents.has(CHAPTER_URL)).toBe(false);
    expect(store.isSectionMerging).toBe(true);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      loaded: 2,
      total: 2,
    });
    expect(store.cachedContents.has(CHAPTER_URL)).toBe(false);

    const merged = fold('<p>第一页</p>', '<p>第二页</p>');
    await store.completeChapterSections(entryId, makeChapter({ content: merged }));

    expect(store.cachedContents.get(CHAPTER_URL)?.chapter.content).toBe(merged);
    expect(store.chapters[0]?.sectionProgress).toBeUndefined();
    expect(store.isSectionMerging).toBe(false);
  });

  it('never caches a truncated chapter, and says so', async () => {
    const store = useReaderStore();
    const { entryId } = startMerge(store);

    await store.completeChapterSections(entryId, makeChapter(), undefined, { truncated: true });

    expect(store.cachedContents.has(CHAPTER_URL)).toBe(false);
    expect(store.chapters[0]?.sectionProgress).toBeUndefined();
    expect(store.error).toBe('本章后续内容加载不完整');
  });

  it('persists nothing for a chapter that is still merging', async () => {
    const store = useReaderStore();
    startMerge(store);

    store.persistCache();

    const chapterKey = getCacheV2ChapterKey(INDEX_URL, CHAPTER_URL);
    expect(Array.from(gm.store.keys())).not.toContain(chapterKey);
  });

  it('ignores appends for an entry that was trimmed away, and still caches on completion', async () => {
    const store = useReaderStore();
    const { entryId } = startMerge(store);

    store.chapters.splice(0, store.chapters.length);

    await expect(
      store.appendChapterSection(entryId, {
        content: '<p>第二页</p>',
        rawContent: '<p>raw2</p>',
        loaded: 2,
        total: 2,
      })
    ).resolves.toBe(false);

    await expect(store.completeChapterSections(entryId, makeChapter())).resolves.toBe(true);
    expect(store.cachedContents.has(CHAPTER_URL)).toBe(true);
  });

  it('stops appending and aborts the merge when the reader tears down', async () => {
    const store = useReaderStore();
    const { abort, entryId } = startMerge(store);

    store.deactivate();

    expect(abort).toHaveBeenCalledTimes(1);
    await expect(
      store.appendChapterSection(entryId, {
        content: '<p>第二页</p>',
        rawContent: '<p>raw2</p>',
        loaded: 2,
        total: 2,
      })
    ).resolves.toBe(false);
  });

  it('re-converts everything once when the reader switches script mid-merge', async () => {
    const store = useReaderStore();
    const { entryId } = startMerge(store);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      loaded: 2,
      total: 4,
    });
    expect(mocks.html).not.toHaveBeenCalled();

    await store.applyTextConversion('tc');
    mocks.html.mockClear();

    // The mode moved on since the merge began, so this page triggers one full pass.
    await store.appendChapterSection(entryId, {
      content: '<p>第三页</p>',
      rawContent: '<p>raw3</p>',
      loaded: 3,
      total: 4,
    });
    expect(mocks.html).toHaveBeenCalledTimes(1);
    expect(mocks.html.mock.calls[0]?.[0]).toBe(
      fold('<p>第一页</p>', '<p>第二页</p>', '<p>第三页</p>')
    );

    // Once the modes agree again, only the new page is converted.
    mocks.html.mockClear();
    await store.appendChapterSection(entryId, {
      content: '<p>第四页</p>',
      rawContent: '<p>raw4</p>',
      loaded: 4,
      total: 4,
    });
    expect(mocks.html).toHaveBeenCalledTimes(1);
    expect(mocks.html.mock.calls[0]?.[0]).toBe('<p>第四页</p>');
  });

  it('runs one authoritative conversion when the merged source script changed', async () => {
    const store = useReaderStore();
    await store.applyTextConversion('tc');
    const { entryId } = startMerge(store);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      sourceScript: 'hant',
      loaded: 2,
      total: 2,
    });

    mocks.html.mockClear();
    await store.completeChapterSections(
      entryId,
      makeChapter({ content: fold('<p>第一页</p>', '<p>第二页</p>'), sourceScript: 'mixed' })
    );

    expect(mocks.html).toHaveBeenCalledTimes(1);
  });

  it('leaves the incrementally converted text alone when the script never changed', async () => {
    const store = useReaderStore();
    await store.applyTextConversion('tc');
    const { entryId } = startMerge(store);

    await store.appendChapterSection(entryId, {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      sourceScript: 'hant',
      loaded: 2,
      total: 2,
    });

    mocks.html.mockClear();
    await store.completeChapterSections(
      entryId,
      makeChapter({ content: fold('<p>第一页</p>', '<p>第二页</p>'), sourceScript: 'hant' })
    );

    expect(mocks.html).not.toHaveBeenCalled();
  });
});

describe('startProgressiveSectionMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDom(CHAPTER_URL);
  });

  function makeSink() {
    const calls: string[] = [];
    const sink: SectionMergeSink = {
      append: vi.fn(async (_entryId, delta) => {
        calls.push(`append:${delta.loaded}`);
        return true;
      }),
      complete: vi.fn(async () => {
        calls.push('complete');
        return true;
      }),
      cancel: vi.fn((_entryId, reason) => {
        calls.push(`cancel:${reason}`);
      }),
    };
    return { calls, sink };
  }

  /** Drive the merge callbacks by hand so ordering is deterministic. */
  function stubMerger(
    run: (options: {
      onFirstPage: (chapter: ParsedChapter, progress: unknown) => void | Promise<void>;
      onSectionPage: (delta: unknown, progress: unknown) => void;
      onMergeEnd: (end: unknown) => void;
    }) => Promise<ParsedChapter | null>
  ) {
    mocks.createSectionMerger.mockReturnValue({
      merge: (_doc: Document, _url: string, options: Parameters<typeof run>[0]) => run(options),
    });
  }

  const parser = {} as never;
  const doc = {} as Document;

  it('holds the merge until the caller commits the first page', async () => {
    const { sink } = makeSink();
    let released = false;
    stubMerger(async options => {
      await options.onFirstPage(makeChapter(), { url: CHAPTER_URL, loaded: 1, total: 2 });
      released = true;
      options.onSectionPage(
        { content: '<p>第二页</p>', rawContent: '<p>raw2</p>' },
        { url: CHAPTER_URL, loaded: 2, total: 2 }
      );
      options.onMergeEnd({ loaded: 2, total: 2, truncated: false });
      return makeChapter();
    });

    const { chapter, merge } = await startProgressiveSectionMerge(parser, doc, CHAPTER_URL, {
      controller: new AbortController(),
      sink,
    });

    expect(chapter?.content).toBe('<p>第一页</p>');
    expect(merge?.progress).toEqual({ loaded: 1, total: 2 });
    expect(released).toBe(false);
    expect(sink.append).not.toHaveBeenCalled();

    merge?.commit('chapter-1');
    await vi.waitFor(() => {
      expect(sink.complete).toHaveBeenCalled();
    });
    expect(sink.append).toHaveBeenCalledWith('chapter-1', {
      content: '<p>第二页</p>',
      rawContent: '<p>raw2</p>',
      loaded: 2,
      total: 2,
    });
  });

  it('serialises appends and finishes after the last one', async () => {
    const { calls, sink } = makeSink();
    let releaseFirstAppend!: () => void;
    const firstAppendGate = new Promise<void>(resolve => {
      releaseFirstAppend = resolve;
    });
    vi.mocked(sink.append).mockImplementationOnce(async (_entryId, delta) => {
      await firstAppendGate;
      calls.push(`append:${delta.loaded}`);
      return true;
    });

    stubMerger(async options => {
      await options.onFirstPage(makeChapter(), { url: CHAPTER_URL, loaded: 1 });
      options.onSectionPage(
        { content: '<p>2</p>', rawContent: '<p>2</p>' },
        { url: CHAPTER_URL, loaded: 2 }
      );
      options.onSectionPage(
        { content: '<p>3</p>', rawContent: '<p>3</p>' },
        { url: CHAPTER_URL, loaded: 3 }
      );
      options.onMergeEnd({ loaded: 3, truncated: false });
      return makeChapter();
    });

    const { merge } = await startProgressiveSectionMerge(parser, doc, CHAPTER_URL, {
      controller: new AbortController(),
      sink,
    });
    merge?.commit('chapter-1');

    // The second page must not overtake the first while it is still being written.
    await Promise.resolve();
    expect(calls).toEqual([]);

    releaseFirstAppend();
    await vi.waitFor(() => {
      expect(calls).toEqual(['append:2', 'append:3', 'complete']);
    });
  });

  it('cancels instead of completing once the caller rejects the first page', async () => {
    const { sink } = makeSink();
    const controller = new AbortController();
    stubMerger(async options => {
      await options.onFirstPage(makeChapter(), { url: CHAPTER_URL, loaded: 1 });
      options.onMergeEnd({ loaded: 1, truncated: true });
      return makeChapter();
    });

    const { merge } = await startProgressiveSectionMerge(parser, doc, CHAPTER_URL, {
      controller,
      sink,
    });
    merge?.reject();

    await vi.waitFor(() => {
      expect(controller.signal.aborted).toBe(true);
    });
    expect(sink.complete).not.toHaveBeenCalled();
    expect(sink.append).not.toHaveBeenCalled();
  });

  it('resolves like a plain parse when the chapter has nothing to merge', async () => {
    const { sink } = makeSink();
    stubMerger(async () => makeChapter({ content: '<p>whole</p>' }));

    const result = await startProgressiveSectionMerge(parser, doc, CHAPTER_URL, {
      controller: new AbortController(),
      sink,
    });

    expect(result.merge).toBeNull();
    expect(result.chapter?.content).toBe('<p>whole</p>');
    expect(sink.append).not.toHaveBeenCalled();
    expect(sink.complete).not.toHaveBeenCalled();
  });
});
