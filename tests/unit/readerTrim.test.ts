import { describe, expect, it } from 'vitest';

import type { CachedChapter, NavFailureRecord } from '@/ui/stores/reader/types';
import { trimCachedContents, trimNavFailures } from '@/ui/stores/reader/trim';

describe('Reader trim helpers', () => {
  function makeCachedChapter(url: string, cachedAt: number): CachedChapter {
    return {
      chapter: {
        title: 't',
        content: 'c',
        rawContent: 'r',
        url,
        confidence: 1,
        method: 'rule',
      },
      cachedAt,
    };
  }

  it('trimCachedContents evicts oldest entries by cachedAt', () => {
    const cachedContents = new Map<string, CachedChapter>();

    cachedContents.set('u1', makeCachedChapter('u1', 1));
    cachedContents.set('u2', makeCachedChapter('u2', 2));
    cachedContents.set('u3', makeCachedChapter('u3', 3));
    cachedContents.set('u4', makeCachedChapter('u4', 4));

    trimCachedContents(cachedContents, 2);

    expect(cachedContents.size).toBe(2);
    expect(cachedContents.has('u1')).toBe(false);
    expect(cachedContents.has('u2')).toBe(false);
    expect(cachedContents.has('u3')).toBe(true);
    expect(cachedContents.has('u4')).toBe(true);
  });

  it('trimCachedContents is a no-op when size <= limit', () => {
    const cachedContents = new Map<string, CachedChapter>();
    cachedContents.set('u1', makeCachedChapter('u1', 1));
    cachedContents.set('u2', makeCachedChapter('u2', 2));

    trimCachedContents(cachedContents, 2);
    expect(cachedContents.size).toBe(2);
  });

  it('trimNavFailures evicts oldest entries by failedAt to enforce the limit', () => {
    const navFailures = new Map<string, NavFailureRecord>();
    for (let i = 0; i < 11; i++) {
      navFailures.set(`k${i}`, { count: 1, failedAt: i });
    }

    trimNavFailures(navFailures, 10);

    expect(navFailures.size).toBe(10);
    expect(navFailures.has('k0')).toBe(false);
  });

  it('trimNavFailures trims all excess entries when massively over the limit', () => {
    const navFailures = new Map<string, NavFailureRecord>();
    for (let i = 0; i < 20; i++) {
      navFailures.set(`k${i}`, { count: 1, failedAt: i });
    }

    trimNavFailures(navFailures, 10);

    expect(navFailures.size).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(navFailures.has(`k${i}`)).toBe(false);
    }
    for (let i = 10; i < 20; i++) {
      expect(navFailures.has(`k${i}`)).toBe(true);
    }
  });
});
