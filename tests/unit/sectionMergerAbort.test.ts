import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/utils/network', () => ({
  fetchAndParseUrl: vi.fn(),
}));

import { fetchAndParseUrl } from '@/core/utils/network';
import type { Parser } from '../../src/core/parser/Parser';
import { SectionMerger } from '../../src/core/auto-enable/SectionMerger';

describe('SectionMerger (signal abort)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should abort in-flight section fetch when signal aborts', async () => {
    vi.useFakeTimers();
    const abort = vi.fn();
    vi.mocked(fetchAndParseUrl).mockReturnValue({
      promise: new Promise(() => {}),
      abort,
    });

    const parser = {
      parse: vi.fn().mockResolvedValue({
        title: 't',
        content: '<p>c1</p>',
        rawContent: '<p>c1</p>',
        url: 'https://example.com/chapter.html',
        confidence: 1,
        method: 'detection',
      }),
      detectSection: vi.fn().mockReturnValue({
        isSection: true,
        nextSectionUrl: 'https://example.com/chapter_2.html',
        nextChapterUrl: null,
        confidence: 1,
      }),
    } satisfies Pick<Parser, 'detectSection' | 'parse'>;

    const merger = new SectionMerger(parser as unknown as Parser);
    const startDoc = new DOMParser().parseFromString('<html><body>1</body></html>', 'text/html');
    const controller = new AbortController();

    const mergePromise = merger.merge(startDoc, 'https://example.com/chapter.html', {
      maxPages: 5,
      signal: controller.signal,
    });

    await vi.advanceTimersByTimeAsync(1200);

    expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    controller.abort();

    const result = await mergePromise;
    expect(result?.content).toContain('c1');
    expect(abort).toHaveBeenCalledTimes(1);
  });
});
