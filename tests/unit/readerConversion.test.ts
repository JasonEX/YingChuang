import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyConversionToChapterEntry, applyTocConversion } from '@/ui/stores/reader/conversion';
import type { ChapterEntry, TocEntry } from '@/ui/stores/reader/types';
import { type ChineseScript, convertHTML, convertText } from '@/core/converter';

// Mock the converter module
vi.mock('@/core/converter', () => ({
  convertHTML: vi.fn(
    async (html: string, mode: string, options?: { sourceScript?: ChineseScript }) => {
      if (mode === 'tc' && options?.sourceScript === 'hant') return html;
      return mode === 'sc' ? html.replace(/東/g, '东') : html.replace(/东/g, '東');
    }
  ),
  convertText: vi.fn(
    async (text: string, mode: string, options?: { sourceScript?: ChineseScript }) => {
      if (mode === 'tc' && options?.sourceScript === 'hant') return text;
      return mode === 'sc' ? text.replace(/東/g, '东') : text.replace(/东/g, '東');
    }
  ),
}));

function makeEntry(
  id: string,
  content: string,
  title = 'title',
  bookTitle?: string,
  sourceScript?: ChineseScript
): ChapterEntry {
  return {
    id,
    chapter: {
      title,
      content,
      rawContent: content,
      url: id,
      confidence: 1,
      method: 'detection',
      ...(bookTitle ? { bookTitle } : {}),
      ...(sourceScript ? { sourceScript } : {}),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyConversionToChapterEntry', () => {
  it('returns early when entry is not found', async () => {
    const chapters = [makeEntry('a', 'hello')];
    const origContents = new Map([['a', 'hello']]);
    const origTitles = new Map([['a', { title: 'title' }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'nonexistent', 'sc');
    // Chapter should be unchanged
    expect(chapters[0].chapter.content).toBe('hello');
  });

  it('mode=none restores original content and titles', async () => {
    const chapters = [makeEntry('a', 'converted', 'converted-title', 'converted-book')];
    const origContents = new Map([['a', 'original']]);
    const origTitles = new Map([['a', { title: 'orig-title', bookTitle: 'orig-book' }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'none');

    expect(chapters[0].chapter.content).toBe('original');
    expect(chapters[0].chapter.title).toBe('orig-title');
    expect(chapters[0].chapter.bookTitle).toBe('orig-book');
  });

  it('mode=none skips content update when already matching original', async () => {
    const chapters = [makeEntry('a', 'same', 'title')];
    const origContents = new Map([['a', 'same']]);
    const origTitles = new Map<string, { title: string; bookTitle?: string }>();

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'none');
    // No updates applied since content matches and no title in origTitles
    expect(chapters[0].chapter.content).toBe('same');
  });

  it('mode=sc converts content and titles', async () => {
    const chapters = [makeEntry('a', '東京', '東京タワー', '東京物語')];
    const origContents = new Map([['a', '東京']]);
    const origTitles = new Map([['a', { title: '東京タワー', bookTitle: '東京物語' }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'sc');

    expect(chapters[0].chapter.content).toBe('东京');
    expect(chapters[0].chapter.title).toBe('东京タワー');
    expect(chapters[0].chapter.bookTitle).toBe('东京物語');
  });

  it('mode=tc converts content and titles', async () => {
    const chapters = [makeEntry('a', '东京', '东京塔', '东京故事')];
    const origContents = new Map([['a', '东京']]);
    const origTitles = new Map([['a', { title: '东京塔', bookTitle: '东京故事' }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'tc');

    expect(chapters[0].chapter.content).toBe('東京');
    expect(chapters[0].chapter.title).toBe('東京塔');
    expect(chapters[0].chapter.bookTitle).toBe('東京故事');
  });

  it('handles entry with no original content or title stored', async () => {
    const chapters = [makeEntry('a', 'content', 'title')];
    const origContents = new Map<string, string>();
    const origTitles = new Map<string, { title: string; bookTitle?: string }>();

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'sc');
    // No updates since no originals stored
    expect(chapters[0].chapter.content).toBe('content');
    expect(chapters[0].chapter.title).toBe('title');
  });

  it('handles bookTitle being undefined in original titles', async () => {
    const chapters = [makeEntry('a', '東京', '東京')];
    const origContents = new Map([['a', '東京']]);
    const origTitles = new Map([['a', { title: '東京', bookTitle: undefined }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'sc');

    expect(chapters[0].chapter.title).toBe('东京');
    expect(chapters[0].chapter.bookTitle).toBeUndefined();
  });

  it('passes the source metadata without skipping Simplified-mode conversion', async () => {
    const chapters = [makeEntry('a', '搁这说我坏话是吧', '坏话标题', '坏话书名', 'hans')];
    const origContents = new Map([['a', '搁这说我坏话是吧']]);
    const origTitles = new Map([['a', { title: '坏话标题', bookTitle: '坏话书名' }]]);

    await applyConversionToChapterEntry(chapters, origContents, origTitles, 'a', 'sc');

    expect(chapters[0].chapter.content).toBe('搁这说我坏话是吧');
    expect(chapters[0].chapter.title).toBe('坏话标题');
    expect(chapters[0].chapter.bookTitle).toBe('坏话书名');
    expect(convertHTML).toHaveBeenCalledWith('搁这说我坏话是吧', 'sc', {
      sourceScript: 'hans',
    });
    expect(convertText).toHaveBeenCalledWith('坏话标题', 'sc', { sourceScript: 'hans' });
    expect(convertText).toHaveBeenCalledWith('坏话书名', 'sc', { sourceScript: 'hans' });
  });
});

describe('applyTocConversion', () => {
  it('returns empty array for empty toc', async () => {
    const result = await applyTocConversion([], 'sc');
    expect(result).toEqual([]);
  });

  it('mode=none returns a shallow copy', async () => {
    const toc: TocEntry[] = [
      { title: '第一章', url: 'http://example.com/1' },
      { title: '第二章', url: 'http://example.com/2' },
    ];
    const result = await applyTocConversion(toc, 'none');
    expect(result).toEqual(toc);
    expect(result).not.toBe(toc); // new array
  });

  it('mode=sc converts toc titles', async () => {
    const toc: TocEntry[] = [{ title: '東京第一章', url: 'http://example.com/1' }];
    const result = await applyTocConversion(toc, 'sc');
    expect(result[0].title).toBe('东京第一章');
    expect(result[0].url).toBe('http://example.com/1');
  });

  it('mode=sc keeps Simplified toc titles when sourceScript is hans', async () => {
    const toc: TocEntry[] = [{ title: '坏话目录', url: 'http://example.com/1' }];
    const result = await applyTocConversion(toc, 'sc', 'hans');
    expect(result[0].title).toBe('坏话目录');
    expect(convertText).toHaveBeenCalledWith('坏话目录', 'sc', { sourceScript: 'hans' });
  });
});
