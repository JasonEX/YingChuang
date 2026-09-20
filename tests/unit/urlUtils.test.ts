/**
 * Unit tests for URL utilities
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSectionBaseUrl,
  isSectionLikeUrl,
  normalizeAbsoluteUrl,
  normalizeCiwemaoChapterUrl,
  normalizeRedundantFirstPageParam,
} from '@/core/utils/urlUtils';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeAbsoluteUrl', () => {
  it('should resolve relative URL with provided base', () => {
    expect(normalizeAbsoluteUrl('/a/b', 'https://example.com/base/')).toBe(
      'https://example.com/a/b'
    );
  });

  it('should fall back to document.baseURI when base is missing', () => {
    const baseEl = document.createElement('base');
    baseEl.href = 'https://example.com/book/';
    document.head.prepend(baseEl);

    try {
      expect(normalizeAbsoluteUrl('chapter/1', undefined)).toBe(
        'https://example.com/book/chapter/1'
      );
    } finally {
      baseEl.remove();
    }
  });

  it('tries the next base candidate when one is invalid', () => {
    expect(normalizeAbsoluteUrl('/a', 'http://[invalid')).toContain('/a');
  });

  it('resolves absolute URLs when base/document/location are unavailable', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('location', undefined);
    expect(normalizeAbsoluteUrl('https://example.com/a')).toBe('https://example.com/a');
  });

  it('returns input when URL parsing fails everywhere', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('location', undefined);

    const href = 'not a url';
    expect(normalizeAbsoluteUrl(href)).toBe(href);
  });
});

describe('normalizeCiwemaoChapterUrl', () => {
  it('should rewrite get_par_tsu_list to chapter URL', () => {
    const input =
      'https://wap.ciweimao.com/chapter/get_par_tsu_list?chapter_id=113493242&data-pgid=0';
    const output = normalizeCiwemaoChapterUrl(input);
    expect(output).toBe('https://wap.ciweimao.com/chapter/113493242');
  });

  it('should keep original URL when not a ciweimao tsukkomi page', () => {
    const input = 'https://wap.ciweimao.com/chapter/113493242';
    expect(normalizeCiwemaoChapterUrl(input)).toBe(input);
  });

  it('should keep original URL when chapter_id is missing', () => {
    const input = 'https://wap.ciweimao.com/chapter/get_par_tsu_list?data-pgid=0';
    expect(normalizeCiwemaoChapterUrl(input)).toBe(input);
  });
});

describe('normalizeRedundantFirstPageParam', () => {
  it('removes a sole page=1 query from HTML chapter URLs', () => {
    expect(normalizeRedundantFirstPageParam('https://example.com/book/1.html?page=1')).toBe(
      'https://example.com/book/1.html'
    );
  });

  it('keeps later page markers and extra query params', () => {
    expect(normalizeRedundantFirstPageParam('https://example.com/book/1.html?page=2')).toBe(
      'https://example.com/book/1.html?page=2'
    );
    expect(normalizeRedundantFirstPageParam('https://example.com/book/1.html?cid=1&page=1')).toBe(
      'https://example.com/book/1.html?cid=1&page=1'
    );
  });

  it('keeps query-driven chapter URLs and malformed URLs unchanged', () => {
    expect(normalizeRedundantFirstPageParam('https://example.com/read.php?page=1')).toBe(
      'https://example.com/read.php?page=1'
    );
    expect(normalizeRedundantFirstPageParam('https://example.com/chapter/123?page=1')).toBe(
      'https://example.com/chapter/123?page=1'
    );
    expect(normalizeRedundantFirstPageParam('not-a-url?page=1')).toBe('not-a-url?page=1');
  });
});

describe('isSectionLikeUrl', () => {
  it('detects path-based section URLs', () => {
    expect(isSectionLikeUrl('https://example.com/123.html', 'https://example.com/123_2.html')).toBe(
      true
    );
    expect(
      isSectionLikeUrl('https://example.com/123_2.html', 'https://example.com/123_3.html')
    ).toBe(true);
    expect(
      isSectionLikeUrl('https://example.com/123/1.html', 'https://example.com/123/2.html')
    ).toBe(true);
  });

  it('detects directory-style section URLs without a file extension', () => {
    expect(
      isSectionLikeUrl(
        'https://m.kudushu.org/html/1088392/146537150/',
        'https://m.kudushu.org/html/1088392/146537150_2/'
      )
    ).toBe(true);
    expect(
      isSectionLikeUrl(
        'https://m.kudushu.org/html/1088392/146537150_2/',
        'https://m.kudushu.org/html/1088392/146537150_3/'
      )
    ).toBe(true);
  });

  it('does not treat the next chapter as a section of the current one', () => {
    expect(
      isSectionLikeUrl(
        'https://m.kudushu.org/html/1088392/146537150_3/',
        'https://m.kudushu.org/html/1088392/146537151/'
      )
    ).toBe(false);
  });

  it('does not treat date-style or short numeric slugs as sections', () => {
    // /archive/2024-12/ and /book/123-45/ are ordinary slugs, not page 12/45 of
    // /archive/2024/ or /book/123/.
    expect(
      isSectionLikeUrl(
        'https://example.com/archive/2024-12/',
        'https://example.com/archive/2024-13/'
      )
    ).toBe(false);
    expect(
      isSectionLikeUrl(
        'https://example.com/archive/2024_12/',
        'https://example.com/archive/2024_13/'
      )
    ).toBe(false);
    expect(
      isSectionLikeUrl('https://example.com/book/123-45/', 'https://example.com/book/123-46/')
    ).toBe(false);
  });

  it('detects query-based pagination (page increments)', () => {
    expect(
      isSectionLikeUrl(
        'https://example.com/chapter.html',
        'https://example.com/chapter.html?page=2'
      )
    ).toBe(true);
    expect(
      isSectionLikeUrl(
        'https://example.com/chapter.html?page=2',
        'https://example.com/chapter.html?page=3'
      )
    ).toBe(true);
    expect(
      isSectionLikeUrl(
        'https://example.com/chapter.html?page=9',
        'https://example.com/chapter.html?page=11'
      )
    ).toBe(false);
  });

  it('supports relative nextUrl for query-based pagination', () => {
    expect(isSectionLikeUrl('https://example.com/chapter.html', '?page=2')).toBe(true);
  });

  it('does not treat unrelated query changes as section-like', () => {
    expect(
      isSectionLikeUrl(
        'https://example.com/chapter.html?cid=1',
        'https://example.com/chapter.html?cid=2&page=2'
      )
    ).toBe(false);
  });

  it('returns false when query-based pagination info is missing', () => {
    expect(
      isSectionLikeUrl('https://example.com/chapter.html', 'https://example.com/chapter.html?cid=1')
    ).toBe(false);
  });

  it('returns false for malformed URLs without throwing', () => {
    expect(isSectionLikeUrl('not a url', 'https://example.com/123_2.html')).toBe(false);
  });

  it('detects extensionless pagination only when URL shape is unambiguous', () => {
    expect(
      isSectionLikeUrl(
        'https://example.com/xs_bkt9oo/89812/1358/1',
        'https://example.com/xs_bkt9oo/89812/1358/2'
      )
    ).toBe(true);
    expect(
      isSectionLikeUrl('https://m.goboo.cc/gb_1/94443/1', 'https://m.goboo.cc/gb_1/94443/1/2')
    ).toBe(true);

    // Avoid misclassifying /{bookId}/{chapterNo} as "page 2" of the same chapter.
    expect(isSectionLikeUrl('https://example.com/89812/1', 'https://example.com/89812/2')).toBe(
      false
    );
    expect(
      isSectionLikeUrl('https://example.com/book/89812/1', 'https://example.com/book/89812/2')
    ).toBe(false);
    expect(
      isSectionLikeUrl('https://m.goboo.cc/gb_1/94443/1', 'https://m.goboo.cc/gb_1/94443/2')
    ).toBe(false);
  });
});

describe('getSectionBaseUrl', () => {
  it('normalizes extensionless pagination to the first page when URL shape is unambiguous', () => {
    expect(getSectionBaseUrl('https://example.com/xs_bkt9oo/89812/1358/2')).toBe(
      'https://example.com/xs_bkt9oo/89812/1358/1'
    );
    expect(getSectionBaseUrl('https://m.goboo.cc/gb_1/94443/1/2')).toBe(
      'https://m.goboo.cc/gb_1/94443/1'
    );
  });

  it('normalizes directory-style sections to the first page', () => {
    expect(getSectionBaseUrl('https://m.kudushu.org/html/1088392/146537150_2/')).toBe(
      'https://m.kudushu.org/html/1088392/146537150/'
    );
    expect(getSectionBaseUrl('https://m.kudushu.org/html/1088392/146537150/')).toBe(null);
  });

  it('leaves date-style and short numeric slugs alone', () => {
    expect(getSectionBaseUrl('https://example.com/archive/2024-12/')).toBe(null);
    expect(getSectionBaseUrl('https://example.com/archive/2024_12/')).toBe(null);
    expect(getSectionBaseUrl('https://example.com/book/123-45/')).toBe(null);
  });

  it('normalizes query-based pagination to the first page', () => {
    expect(getSectionBaseUrl('https://example.com/chapter.html?page=2')).toBe(
      'https://example.com/chapter.html?page=1'
    );
  });

  it('returns null for malformed URLs without throwing', () => {
    expect(getSectionBaseUrl('not a url')).toBe(null);
  });

  it('does not normalize ambiguous /{bookId}/{chapterNo} patterns', () => {
    expect(getSectionBaseUrl('https://example.com/89812/2')).toBe(null);
    expect(getSectionBaseUrl('https://example.com/book/89812/2')).toBe(null);
  });
});
