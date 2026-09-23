/**
 * Reader Store - Navigation Failures
 * Records exhausted loads so speculative navigation cannot restart them.
 */

import { trimNavFailures } from './trim';

type NavFailureMap = Map<string, { count: number; failedAt: number }>;

/**
 * Record a failed load; only an explicit navigation may try again.
 * Returns the updated failure count.
 */
export function recordNavFailure(
  failures: NavFailureMap,
  key: string,
  opts: { maxFailures: number }
): number {
  const prev = failures.get(key);
  const count = (prev?.count || 0) + 1;
  failures.set(key, { count, failedAt: Date.now() });
  trimNavFailures(failures, opts.maxFailures);
  return count;
}

/**
 * Clear the failure record for a navigation key (e.g. after a successful load).
 */
export function clearNavFailure(failures: NavFailureMap, key: string): void {
  failures.delete(key);
}
