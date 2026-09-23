import { recordDebugEvent } from '@/core/debug/events';

/** Request retries belong to one operation; cooldowns belong to this script's origin session. */
export interface RequestOutcome {
  status: number | null;
  error: string | null;
  retryAfter?: string | null;
}

interface Cooldown {
  status: number;
  until: number;
}
const cooldowns = new Map<string, Cooldown>();

export function getRequestCooldown(url: string): Cooldown | undefined {
  const origin = new URL(url).origin;
  const cooldown = cooldowns.get(origin);
  if (cooldown && cooldown.until <= Date.now()) {
    cooldowns.delete(origin);
    return undefined;
  }
  return cooldown;
}

/** Also used by the few site-specific, single-attempt API transports. */
export function recordRequestCooldown(
  url: string,
  status: number | null,
  retryAfter?: string | null,
  fallbackMs = 30_000
): Cooldown | undefined {
  if (status !== 429 && status !== 503) return undefined;
  const raw = retryAfter?.trim();
  const requested = raw
    ? /^\d+$/.test(raw)
      ? Date.now() + Number(raw) * 1000
      : Date.parse(raw)
    : NaN;
  if (status !== 429 && !Number.isFinite(requested)) return undefined;
  const until = Math.max(
    Date.now(),
    Number.isFinite(requested) ? requested : Date.now() + fallbackMs,
    getRequestCooldown(url)?.until ?? 0
  );
  const cooldown = { status, until };
  cooldowns.set(new URL(url).origin, cooldown);
  recordDebugEvent('request.cooldown', { url, status, retryAt: until });
  return cooldown;
}

export function getRetryAfterHeader(headers: string | undefined): string | null {
  return headers?.match(/^retry-after\s*:\s*(.+)$/im)?.[1].trim() ?? null;
}

/** Every wait is owned by the caller's cancellation signal and releases its listener. */
export function waitForRequestDelay(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve(ready);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function runRequest<T extends RequestOutcome>(
  url: string,
  options: {
    signal: AbortSignal;
    attempt: () => Promise<T>;
    stopped: (error: 'abort' | 'http', status: number | null) => T;
    retries?: number;
    retryRateLimit?: boolean;
  }
): Promise<T> {
  const { signal, stopped } = options;
  const retries = Math.min(2, Math.max(0, options.retries ?? 2));
  let rateLimited = false;
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) return stopped('abort', null);
    const cooling = getRequestCooldown(url);
    if (cooling) {
      recordDebugEvent('request.blocked', { url, status: cooling.status, retryAt: cooling.until });
      return stopped('http', cooling.status);
    }

    let abort!: () => void;
    const cancelled = new Promise<T>(resolve => {
      abort = () => resolve(stopped('abort', null));
      signal.addEventListener('abort', abort, { once: true });
    });
    let result: T;
    try {
      result = await Promise.race([options.attempt(), cancelled]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
    if (signal.aborted) return stopped('abort', null);

    const cooldown = recordRequestCooldown(
      url,
      result.status,
      result.retryAfter,
      rateLimited ? 60_000 : 30_000
    );
    let delay: number;
    if (result.status === 429) {
      if (rateLimited || options.retryRateLimit === false) return result;
      rateLimited = true;
      delay = cooldown!.until - Date.now();
    } else if (
      result.error === 'network' ||
      result.error === 'timeout' ||
      result.error === 'fallback' ||
      (result.error === 'http' && [500, 502, 503, 504].includes(result.status ?? 0))
    ) {
      // A transport fallback spends an attempt too; it never resets the retry budget.
      delay = result.error === 'fallback' ? 0 : 2000 * 2 ** attempt * (1 + Math.random() * 0.2);
      if (cooldown) delay = Math.max(delay, cooldown.until - Date.now());
    } else {
      return result;
    }
    // Long server cooldowns remain enforced, but do not keep a reading operation alive indefinitely.
    if (attempt >= retries || delay > 60_000) return result;
    recordDebugEvent('request.retry', {
      url,
      attempt: attempt + 2,
      status: result.status,
      reason: result.error,
      delayMs: Math.ceil(delay),
    });
    if (delay > 0 && !(await waitForRequestDelay(delay, signal))) return stopped('abort', null);
  }
}
