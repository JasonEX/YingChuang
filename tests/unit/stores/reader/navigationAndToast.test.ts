import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReaderStore } from '@/ui/stores/reader';

import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { createDom } from '../../../testUtils/dom';
import { setupPinia } from '../../../testUtils/pinia';

describe('ReaderStore - navigation & toast', () => {
  beforeEach(() => {
    setupPinia();
    createDom('https://example.com/book/1/1.html');

    const gm = createGmStorageMock();
    stubGmStorage(gm);

    vi.restoreAllMocks();
  });

  it('setChapter syncs host page title, URL, and history state', () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      bookTitle: '示例书',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    expect(document.title).toBe('第1章 - 示例书');
    expect(window.location.href).toBe('https://example.com/book/1/1.html');
    expect(window.history.state).toMatchObject({
      mnr: true,
      mnrChapter: 0,
      chapterUrl: 'https://example.com/book/1/1.html',
    });
  });

  it('loadNextChapter(manual) shows end toast when no nextUrl', async () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    const ok = await store.loadNextChapter('manual');
    expect(ok).toBe(false);
    expect(store.error).toBe('已经是最后一章了');

    store.clearError();
  });

  it('setError auto-dismisses after 3 seconds', () => {
    vi.useFakeTimers();

    const store = useReaderStore();
    store.setError('boom');
    expect(store.toastType).toBe('error');
    expect(store.error).toBe('boom');

    vi.advanceTimersByTime(3000);
    expect(store.error).toBeNull();

    vi.useRealTimers();
  });

  it('cancels the toast timer on close and gives a new session its full duration', () => {
    vi.useFakeTimers();
    const store = useReaderStore();
    store.setError('old error');
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    store.deactivate();
    expect(clearTimeout).toHaveBeenCalled();
    expect(store.error).toBeNull();
    store.activate();
    store.showToast('new session', 'info', 4000);
    vi.advanceTimersByTime(3000);
    expect(store.error).toBe('new session');
    vi.advanceTimersByTime(1000);
    expect(store.error).toBeNull();
    vi.useRealTimers();
  });

  it('setCurrentChapter ignores replaceState errors', () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    store.chapters.push({
      id: 'c2',
      chapter: {
        title: '第2章',
        content: '<p>c2</p>',
        rawContent: '<p>c2</p>',
        url: 'https://example.com/book/1/2.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
    });

    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => store.setCurrentChapter(1)).not.toThrow();
    expect(store.currentChapterIndex).toBe(1);
    expect(document.title).toBe('第2章');

    replaceState.mockRestore();
  });

  it('setCurrentChapter syncs host page to the visible chapter', () => {
    const store = useReaderStore();
    store.setChapter({
      title: '第1章',
      bookTitle: '示例书',
      content: '<p>init</p>',
      rawContent: '<p>init</p>',
      url: 'https://example.com/book/1/1.html',
      indexUrl: 'https://example.com/book/1/index.html',
      confidence: 1,
      method: 'rule',
    });

    store.chapters.push({
      id: 'c2',
      chapter: {
        title: '第2章',
        bookTitle: '示例书',
        content: '<p>c2</p>',
        rawContent: '<p>c2</p>',
        url: 'https://example.com/book/1/2.html',
        indexUrl: 'https://example.com/book/1/index.html',
        confidence: 1,
        method: 'rule',
      },
    });

    store.setCurrentChapter(1);

    expect(document.title).toBe('第2章 - 示例书');
    expect(window.location.href).toBe('https://example.com/book/1/2.html');
    expect(window.history.state).toMatchObject({
      mnr: true,
      mnrChapter: 1,
      chapterUrl: 'https://example.com/book/1/2.html',
    });
  });
});
