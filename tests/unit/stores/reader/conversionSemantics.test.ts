import { beforeEach, expect, it } from 'vitest';
import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { applyTocConversion } from '@/ui/stores/reader/conversion';
import { createDom } from '../../../testUtils/dom';
import type { ParsedChapter } from '@/core/parser';
import { setupPinia } from '../../../testUtils/pinia';
import { useReaderStore } from '@/ui/stores/reader';

beforeEach(() => {
  setupPinia();
  createDom('https://example.com/book/1/1.html');
  stubGmStorage(createGmStorageMock());
});

it('converts original titles and cached content consistently across modes and navigation', async () => {
  const original = '<p>沈默與芸芸眾生，曹雪芹著。鐘聲響徹。</p>';
  const first: ParsedChapter = {
    title: '沈默的鐘樓',
    bookTitle: '芸芸眾生',
    content: original,
    rawContent: original,
    url: location.href,
    nextUrl: 'https://example.com/book/1/2.html',
    indexUrl: 'https://example.com/book/1/index.html',
    sourceScript: 'hans',
    confidence: 1,
    method: 'rule',
  };
  const store = useReaderStore();
  store.setChapter(first);
  await store.applyTextConversion('sc');
  expect(store.chapter?.content).toBe('<p>沈默与芸芸众生，曹雪芹著。钟声响彻。</p>');
  expect(store.chapter?.title).toBe('沈默的钟楼');
  expect(store.chapter?.bookTitle).toBe('芸芸众生');
  expect(store.cachedContents.get(first.url)?.chapter.content).toBe(original);

  const second = {
    ...first,
    url: first.nextUrl!,
    sourceScript: 'hant' as const,
    nextUrl: undefined,
  };
  store.cachedContents.set(second.url, { chapter: second, cachedAt: Date.now() });
  expect(await store.loadNextChapter('manual')).toBe(true);
  expect(store.chapters).toHaveLength(2);
  expect(store.chapters[1].chapter.content).toBe(store.chapters[0].chapter.content);
  expect(store.chapters[1].chapter.title).toBe('沈默的钟楼');

  await store.applyTextConversion('tc');
  await store.applyTextConversion('none');
  expect(store.chapters.map(entry => entry.chapter.content)).toEqual([original, original]);
  expect(store.chapters.map(entry => entry.chapter.title)).toEqual([first.title, first.title]);
  await store.applyTextConversion('sc');
  expect(store.chapters[1].chapter.content).toBe(store.chapters[0].chapter.content);
  store.deactivate();
});

it('does not let the current chapter language veto Simplified TOC titles', async () => {
  const toc = [{ title: '沈默的鐘樓', url: 'https://example.com/book/1/2.html' }];
  const fromHans = await applyTocConversion(toc, 'sc', 'hans');
  expect(await applyTocConversion(toc, 'sc', 'hant')).toEqual(fromHans);
  expect(fromHans).toEqual([{ ...toc[0], title: '沈默的钟楼' }]);
  expect(toc[0].title).toBe('沈默的鐘樓');
  expect(await applyTocConversion(toc, 'none', 'hans')).toEqual(toc);
});

it('keeps appended source and the latest mode when conversion overlaps a section delivery', async () => {
  const store = useReaderStore();
  const first = '<p>鐘聲響徹，曹雪芹著。</p>';
  const entryId = store.setChapter({
    title: '沈默的鐘樓',
    content: first,
    rawContent: first,
    url: location.href,
    sourceScript: 'unknown',
    confidence: 1,
    method: 'rule',
  });
  store.beginChapterSections(entryId, { loaded: 1, total: 2 }, () => {});
  const converting = store.applyTextConversion('sc');
  const appending = store.appendChapterSection(entryId, {
    content: '<p>他走进房间。</p>',
    rawContent: '<p>他走进房间。</p>',
    sourceScript: 'hans',
    loaded: 2,
    total: 2,
  });
  await Promise.all([converting, appending]);
  expect(store.chapter?.content).toContain('钟声响彻，曹雪芹著。');
  expect(store.chapter?.content).toContain('他走进房间。');
  const changing = store.applyTextConversion('tc');
  await store.applyTextConversion('none');
  await changing;
  expect(store.chapter?.content).toContain('鐘聲響徹，曹雪芹著。');
  expect(store.chapter?.content).toContain('他走进房间。');
  expect(store.chapter?.title).toBe('沈默的鐘樓');
  store.deactivate();
});
