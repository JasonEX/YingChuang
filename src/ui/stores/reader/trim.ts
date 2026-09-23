/**
 * Reader Store Trim Helpers
 * Pure helpers for trimming in-memory caches/maps.
 */

import type { CachedChapter, NavFailureRecord } from './types';

/**
 * Trim cachedContents to maxSessionCache using LRU eviction (by cachedAt).
 */
export function trimCachedContents(
  cachedContents: Map<string, CachedChapter>,
  maxSessionCache: number
): void {
  if (cachedContents.size <= maxSessionCache) return;

  const entries = Array.from(cachedContents.entries()).sort(
    (a, b) => a[1].cachedAt - b[1].cachedAt
  );
  const toDelete = entries.slice(0, entries.length - maxSessionCache);
  for (const [url] of toDelete) {
    cachedContents.delete(url);
  }
}

/**
 * Trim navFailures to maxNavFailures using LRU eviction (by failedAt).
 */
export function trimNavFailures(
  navFailures: Map<string, NavFailureRecord>,
  maxNavFailures: number
): void {
  const limit = Math.max(0, maxNavFailures);
  if (navFailures.size <= limit) return;

  const entries = Array.from(navFailures.entries()).sort((a, b) => a[1].failedAt - b[1].failedAt);

  const toDeleteCount = Math.min(entries.length, navFailures.size - limit);
  for (let i = 0; i < toDeleteCount; i++) {
    navFailures.delete(entries[i][0]);
  }
}
