export type DebugJsonValue =
  null | string | number | boolean | DebugJsonValue[] | { [key: string]: DebugJsonValue };

const SENSITIVE_QUERY_KEY =
  /(?:^|[_-])(?:token|auth|session|sid|key|sign|signature|ticket|password|passwd|pwd|jwt|credential|access|refresh|challenge|chl)(?:[_-]|$)|^__cf_|^_csrfToken$/i;

export function redactUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    parsed.username = parsed.username ? '__redacted__' : '';
    parsed.password = parsed.password ? '__redacted__' : '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEY.test(key)) {
        parsed.searchParams.set(key, '__redacted__');
      }
    }
    return parsed.toString();
  } catch {
    return truncateDebugString(url);
  }
}

export function truncateDebugString(value: string, limit = 500): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...<truncated:${value.length - limit}>`;
}

function sanitizeDebugString(value: string, limit = 500): string {
  const redacted = value.replace(/https?:\/\/[^\s"'<>）)]+/gi, match => redactUrl(match) || match);
  return truncateDebugString(redacted, limit);
}

export function hashText(value: string | null | undefined): string {
  const text = value || '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function htmlTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim().length;
}

export function tailStrings(values: Iterable<string>, limit = 8): string[] {
  return Array.from(values)
    .slice(-limit)
    .map(value => redactUrl(value) || '');
}

export function toDebugValue(value: unknown, depth = 3): DebugJsonValue {
  return toDebugValueInternal(value, depth, new WeakSet<object>());
}

function toDebugValueInternal(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): DebugJsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return looksLikeUrl(value) ? redactUrl(value) : sanitizeDebugString(value);
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return null;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeDebugString(value.message),
      stack: value.stack ? sanitizeDebugString(value.stack, 1200) : null,
    };
  }

  if (value instanceof URL) return redactUrl(value.toString());

  if (typeof value !== 'object') return truncateDebugString(String(value));
  if (seen.has(value)) return '[Circular]';
  if (depth <= 0) return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, 30).map(item => toDebugValueInternal(item, depth - 1, seen));
    if (value.length > 30) result.push(`...<truncated:${value.length - 30}>`);
    seen.delete(value);
    return result;
  }

  if (value instanceof Map) {
    const result: Record<string, DebugJsonValue> = {};
    let count = 0;
    for (const [key, item] of value) {
      if (count >= 30) break;
      result[String(key)] = toDebugValueInternal(item, depth - 1, seen);
      count += 1;
    }
    seen.delete(value);
    return result;
  }

  if (value instanceof Set) {
    const result = Array.from(value)
      .slice(0, 30)
      .map(item => toDebugValueInternal(item, depth - 1, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, DebugJsonValue> = {};
  let count = 0;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 40) {
      result.__truncated__ = 'true';
      break;
    }
    result[key] = toDebugValueInternal(item, depth - 1, seen);
    count += 1;
  }

  seen.delete(value);
  return result;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^\/[^\s]*\?/.test(value);
}
