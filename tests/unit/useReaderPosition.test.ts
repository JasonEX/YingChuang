import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';
import {
  flushReadingPositions,
  getReadingPosition,
  saveReadingPosition,
} from '@/ui/stores/reader/readingPosition';
import type { ChapterEntry } from '@/ui/stores/reader/types';
import { createDom } from '../testUtils/dom';
import { useReaderPosition } from '@/ui/composables/reader/useReaderPosition';
import type { useReaderStore } from '@/ui/stores/reader';

vi.mock('@/ui/stores/reader/readingPosition', () => ({
  getReadingPosition: vi.fn(),
  saveReadingPosition: vi.fn(),
  flushReadingPositions: vi.fn(),
}));

const url = 'https://example.com/book/1';
const scopes: ReturnType<typeof effectScope>[] = [];
function setup(merging = true) {
  const main = document.createElement('main');
  const article = document.createElement('article');
  let height = 1200;
  Object.defineProperty(main, 'clientHeight', { value: 600 });
  Object.defineProperty(article, 'offsetHeight', { get: () => height });
  main.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  article.getBoundingClientRect = () => ({ top: -main.scrollTop }) as DOMRect;
  const store = reactive({
    chapters: [
      { id: 'entry-1', chapter: { url }, ...(merging ? { sectionProgress: { loaded: 1 } } : {}) },
    ] as ChapterEntry[],
    currentChapterIndex: 0,
    updateScroll: vi.fn(),
    showToast: vi.fn(),
  });
  const isNavigating = ref(false);
  const scope = effectScope();
  scopes.push(scope);
  const position = scope.run(() =>
    useReaderPosition({
      mainRef: ref(main),
      chapterRefs: new Map([[url, article]]),
      readerStore: store as unknown as ReturnType<typeof useReaderStore>,
      isNavigating,
    })
  )!;
  return {
    position,
    store,
    main,
    scope,
    isNavigating,
    setHeight: (value: number) => {
      height = value;
    },
  };
}

beforeEach(() => {
  createDom();
  vi.resetAllMocks();
  vi.mocked(getReadingPosition).mockResolvedValue(70);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    queueMicrotask(() => fn(0));
    return 1;
  });
});
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  vi.unstubAllGlobals();
});

describe('reader positions across section merging', () => {
  it('waits for the complete height, then restores the saved position once', async () => {
    const { position, store, main, setHeight } = setup();
    await position.restorePosition();
    position.savePosition(url, 24);
    position.flushPosition();
    expect(saveReadingPosition).not.toHaveBeenCalled();
    expect(main.scrollTop).toBe(0);
    setHeight(3600);
    delete store.chapters[0].sectionProgress;
    await vi.waitFor(() => expect(main.scrollTop).toBe(2310));
    expect(store.updateScroll).toHaveBeenCalledWith(70);
    expect(store.showToast).toHaveBeenCalledTimes(1);
    position.flushPosition();
    expect(saveReadingPosition).toHaveBeenCalledWith(url, 70);
  });

  it.each(['input', 'navigation', 'replacement', 'close', 'truncated'] as const)(
    'drops restoration after %s',
    async action => {
      const { position, store, main, scope, isNavigating } = setup();
      await position.restorePosition();
      if (action === 'input') position.cancelRestore();
      if (action === 'navigation') isNavigating.value = true;
      if (action === 'replacement') store.chapters[0] = { ...store.chapters[0], id: 'replacement' };
      if (action === 'close') scope.stop();
      if (action === 'truncated') store.chapters[0].sectionsIncomplete = true;
      await nextTick();
      delete store.chapters[0].sectionProgress;
      await nextTick();
      await Promise.resolve();
      await Promise.resolve();
      expect(main.scrollTop).toBe(0);
      expect(store.showToast).not.toHaveBeenCalled();
    }
  );

  it('cannot restore after user input during the storage read', async () => {
    let resolve!: (value: number) => void;
    vi.mocked(getReadingPosition).mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );
    const { position, main } = setup(false);
    const pending = position.restorePosition();
    position.cancelRestore();
    resolve(70);
    await pending;
    expect(main.scrollTop).toBe(0);
  });

  it('does not overwrite a saved position when closing before its frame commits', async () => {
    let frame!: FrameRequestCallback;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      frame = fn;
      return 1;
    });
    const { position, scope, main } = setup(false);
    const pending = position.restorePosition();
    await vi.waitFor(() => expect(frame).toBeTypeOf('function'));
    scope.stop();
    position.flushPosition();
    frame(0);
    await pending;
    expect(saveReadingPosition).not.toHaveBeenCalled();
    expect(main.scrollTop).toBe(0);
  });

  it.each([null, 0, 100])(
    'allows normal saving without a restorable position (%s)',
    async value => {
      vi.mocked(getReadingPosition).mockResolvedValue(value);
      const { position, main } = setup(false);
      await position.restorePosition();
      position.savePosition(url, 20);
      position.savePosition(url, 21);
      expect(saveReadingPosition).toHaveBeenCalledTimes(1);
      main.scrollTop = 450;
      position.flushPosition();
      expect(saveReadingPosition).toHaveBeenLastCalledWith(url, 50);
      expect(flushReadingPositions).toHaveBeenCalled();
    }
  );

  it('never saves truncated or still-growing content after restoration is cancelled', async () => {
    const { position, store } = setup();
    position.cancelRestore();
    position.savePosition(url, 50);
    position.flushPosition();
    delete store.chapters[0].sectionProgress;
    store.chapters[0].sectionsIncomplete = true;
    position.savePosition(url, 100);
    position.flushPosition();
    expect(saveReadingPosition).not.toHaveBeenCalled();
  });
});
