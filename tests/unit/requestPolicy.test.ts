import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRequestCooldown,
  recordRequestCooldown,
  runRequest,
  waitForRequestDelay,
} from '@/core/utils/requestPolicy';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const stopped = (error: string, status: number | null) => ({ error, status });

describe('request retry ownership', () => {
  it('spends at most three attempts with 2s and 4s backoff', async () => {
    const attempt = vi.fn(async () => ({ status: 502, error: 'http' }));
    const pending = runRequest('https://retry-budget.test/a', {
      signal: new AbortController().signal,
      attempt,
      stopped,
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(attempt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempt).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toEqual({ status: 502, error: 'http' });
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([403, 404, 501])('does not retry HTTP %i', async status => {
    const attempt = vi.fn(async () => ({ status, error: 'http' }));
    await runRequest('https://terminal.test/a', {
      signal: new AbortController().signal,
      attempt,
      stopped,
    });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('cancels a retry wait immediately with no next attempt', async () => {
    const controller = new AbortController();
    const attempt = vi.fn(async () => ({ status: null, error: 'network' }));
    const pending = runRequest('https://cancel-retry.test/a', {
      signal: controller.signal,
      attempt,
      stopped,
    });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    expect(await pending).toEqual(stopped('abort', null));
    await vi.runAllTimersAsync();
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles cancellation even when a transport ignores abort and later succeeds', async () => {
    const controller = new AbortController();
    let release!: (value: { status: number; error: null }) => void;
    const pending = runRequest('https://late.test/a', {
      signal: controller.signal,
      stopped,
      attempt: () =>
        new Promise<{ status: number | null; error: string | null }>(resolve => {
          release = resolve;
        }),
    });
    controller.abort();
    expect(await pending).toEqual(stopped('abort', null));
    release({ status: 200, error: null });
  });

  it('gives the rate-limited operation one recovery attempt while blocking other same-origin requests', async () => {
    const url = 'https://rate-owner.test/a';
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, error: 'http', retryAfter: '3' })
      .mockResolvedValue({ status: 200, error: null });
    const pending = runRequest(url, { signal: new AbortController().signal, attempt, stopped });
    await vi.advanceTimersByTimeAsync(1);
    const other = vi.fn();
    expect(
      await runRequest('https://rate-owner.test/b', {
        signal: new AbortController().signal,
        attempt: other,
        stopped,
      })
    ).toEqual(stopped('http', 429));
    expect(other).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2999);
    expect(await pending).toEqual({ status: 200, error: null });
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(getRequestCooldown(url)).toBeUndefined();
  });

  it('stops after a second 429 and keeps a longer cooldown without a background timer', async () => {
    const url = 'https://twice-limited.test/a';
    const attempt = vi.fn(async () => ({ status: 429, error: 'http' }));
    const pending = runRequest(url, { signal: new AbortController().signal, attempt, stopped });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toEqual(stopped('http', 429));
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(getRequestCooldown(url)?.until).toBe(Date.now() + 60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps server dates and long cooldowns without keeping the operation waiting', async () => {
    const url = 'https://long-cooldown.test/a';
    const until = Math.ceil(Date.now() / 1000) * 1000 + 120_000;
    const attempt = vi.fn(async () => ({
      status: 503,
      error: 'http',
      retryAfter: new Date(until).toUTCString(),
    }));
    expect(
      (await runRequest(url, { signal: new AbortController().signal, attempt, stopped })).status
    ).toBe(503);
    expect(getRequestCooldown(url)?.until).toBe(until);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('speculative requests stop at the first 429 and other origins remain available', async () => {
    const attempt = vi.fn(async () => ({ status: 429, error: 'http', retryAfter: 'invalid' }));
    await runRequest('https://speculative.test/a', {
      signal: new AbortController().signal,
      attempt,
      stopped,
      retryRateLimit: false,
    });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(getRequestCooldown('https://another-origin.test/a')).toBeUndefined();
  });

  it('never shortens an existing cooldown and ignores non-rate failures', () => {
    const url = 'https://cooldown-record.test/a';
    const first = recordRequestCooldown(url, 429, '120');
    expect(recordRequestCooldown(url, 429, '1')).toEqual(first);
    expect(recordRequestCooldown(url, 503, 'bad')).toBeUndefined();
    expect(recordRequestCooldown(url, 403)).toBeUndefined();
  });

  it('releases delay listeners on success and abort', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = waitForRequestDelay(1200, controller.signal);
    await vi.advanceTimersByTimeAsync(1200);
    expect(await pending).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    controller.abort();
    expect(await waitForRequestDelay(1200, controller.signal)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
