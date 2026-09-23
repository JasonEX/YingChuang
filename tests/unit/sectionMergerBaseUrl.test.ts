import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/utils/network', () => ({
  fetchAndParseUrl: vi.fn(),
}));

import { fetchAndParseUrl } from '@/core/utils/network';
import type { Parser } from '../../src/core/parser/Parser';
import { SectionMerger } from '../../src/core/auto-enable/SectionMerger';

describe('SectionMerger (base url + maxPages)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('normalizes query-based pagination to the first page', async () => {
    const baseDoc = new DOMParser().parseFromString('<html><body>p1</body></html>', 'text/html');
    vi.mocked(fetchAndParseUrl).mockReturnValue({
      promise: Promise.resolve({ doc: baseDoc, status: 200, finalUrl: null, error: null }),
      abort: vi.fn(),
    });

    const parser = {
      parse: vi.fn().mockResolvedValue({
        title: 't',
        content: '<p>c</p>',
        rawContent: '<p>c</p>',
        url: 'https://example.com/123.html?page=1',
        confidence: 1,
        method: 'detection',
      }),
      detectSection: vi.fn().mockReturnValue(undefined),
    } satisfies Pick<Parser, 'detectSection' | 'parse'>;

    const merger = new SectionMerger(parser as unknown as Parser);
    const startDoc = new DOMParser().parseFromString('<html><body>p2</body></html>', 'text/html');

    await merger.merge(startDoc, 'https://example.com/123.html?page=2');

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(fetchAndParseUrl).toHaveBeenCalledWith(
      'https://example.com/123.html?page=1',
      'https://example.com/123.html?page=2',
      { retryRateLimit: undefined }
    );
    expect(parser.parse).toHaveBeenCalledWith(baseDoc, 'https://example.com/123.html?page=1');
  });

  it('treats maxPages as total pages (includes first page)', async () => {
    const doc2 = new DOMParser().parseFromString('<html><body>p2</body></html>', 'text/html');
    vi.mocked(fetchAndParseUrl).mockImplementation((url: string) => ({
      promise: Promise.resolve({
        doc: url.includes('_2') ? doc2 : null,
        status: 200,
        finalUrl: null,
        error: url.includes('_2') ? null : 'http',
      }),
      abort: vi.fn(),
    }));

    const parser = {
      parse: vi.fn().mockImplementation(async (_doc: Document, url: string) => {
        if (url.endsWith('123.html')) {
          return {
            title: 't',
            content: '<p>c1</p>',
            rawContent: '<p>c1</p>',
            url,
            confidence: 1,
            method: 'detection',
          };
        }
        if (url.endsWith('123_2.html')) {
          return {
            title: 't',
            content: '<p>c2</p>',
            rawContent: '<p>c2</p>',
            url,
            confidence: 1,
            method: 'detection',
          };
        }
        return null;
      }),
      detectSection: vi.fn().mockImplementation((_doc: Document, url: string) => {
        if (url.endsWith('123.html')) {
          return {
            isSection: true,
            nextSectionUrl: 'https://example.com/123_2.html',
            nextChapterUrl: null,
            confidence: 1,
          };
        }

        if (url.endsWith('123_2.html')) {
          return {
            isSection: true,
            nextSectionUrl: 'https://example.com/123_3.html',
            nextChapterUrl: null,
            confidence: 1,
          };
        }

        return undefined;
      }),
    } satisfies Pick<Parser, 'detectSection' | 'parse'>;

    const merger = new SectionMerger(parser as unknown as Parser);
    const startDoc = new DOMParser().parseFromString('<html><body>p1</body></html>', 'text/html');

    const result = await merger.merge(startDoc, 'https://example.com/123.html', { maxPages: 2 });

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    expect(result?.content).toContain('c1');
    expect(result?.content).toContain('c2');
    expect(result?.content).not.toContain('c3');
  });
});
