/**
 * Network Utilities
 *
 * Handles HTTP requests, CORS (via GM_xmlhttpRequest), and basic parsing.
 */

import { normalizeCiwemaoChapterUrl, normalizeRedundantFirstPageParam } from './index';

/** Result of fetchAndParseUrl operation */
export interface FetchAndParseResult {
  doc: Document | null;
  status: number | null;
  finalUrl: string | null;
  error:
    'abort' | 'http' | 'network' | 'parse' | 'timeout' | 'missing-gm-xhr' | 'invalid-url' | null;
}

/** Return type of GM_xmlhttpRequest call */
interface GmXhrReturn {
  abort: () => void;
}

/**
 * Get GM_xmlhttpRequest function
 */
export function getGmXhr(): typeof GM_xmlhttpRequest | null {
  if (typeof GM_xmlhttpRequest === 'function') {
    return GM_xmlhttpRequest;
  }
  return null;
}

/**
 * Normalize URL for fetching (removes hash, handles special cases)
 */
export function normalizeUrlForFetch(url: string): string {
  const normalized = normalizeRedundantFirstPageParam(normalizeCiwemaoChapterUrl(url));
  try {
    const u = new URL(normalized);
    u.hash = '';
    return u.toString();
  } catch {
    return normalized.replace(/#.*$/, '');
  }
}

function getDefaultBaseUrl(): string | undefined {
  if (typeof location !== 'undefined' && typeof location.href === 'string') {
    return location.href;
  }
  if (typeof document !== 'undefined' && typeof document.baseURI === 'string') {
    return document.baseURI;
  }
  return undefined;
}

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).toLowerCase();
  }
  // URL keeps the root-label dot in fully-qualified hostnames (for example localhost.).
  return trimmed.toLowerCase().replace(/\.$/, '');
}

function isPrivateNetworkHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0') return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(n => parseInt(n, 10));
    if (parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return true;

    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    return false;
  }

  // IPv6 (URL.hostname includes brackets in some runtimes, normalizeHostname removes them)
  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1') return true; // unspecified / loopback
  // IPv4-mapped (::ffff:a.b.c.d); URL serializes the IPv4 part as two hex groups.
  const mapped = host.match(
    /^::ffff:(?:([0-9a-f]{1,4}):([0-9a-f]{1,4})|(\d{1,3}(?:\.\d{1,3}){3}))$/
  );
  if (mapped) {
    if (mapped[3]) return isPrivateNetworkHost(mapped[3]);
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return isPrivateNetworkHost(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  const firstHextet = parseInt(host.slice(0, host.indexOf(':')) || '0', 16);
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // link-local (fe80::/10)
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // unique local (fc00::/7)

  return false;
}

function parseHttpUrl(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function isCurrentOriginRequest(url: string): boolean {
  try {
    if (typeof location === 'undefined' || !location.origin) return false;
    return new URL(url).origin === location.origin;
  } catch {
    return false;
  }
}

function getPageNativeFetch(): typeof fetch | null {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
  // Userscript window proxies can return a new bound function on each access.
  // Function identity does not tell us whether this is the page's fetch.
  return window.fetch.bind(window);
}

function normalizeCharset(charset: string | null | undefined): string | null {
  const normalized = (charset || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
  if (!normalized) return null;
  if (normalized === 'utf8') return 'utf-8';
  if (normalized === 'gbk' || normalized === 'gb2312' || normalized === 'gb18030') {
    return 'gb18030';
  }
  return normalized;
}

function extractCharsetFromMime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/charset\s*=\s*["']?([^;"'\s>]+)/i);
  return normalizeCharset(match?.[1]);
}

function extractCharsetFromHtmlBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
  let ascii = '';
  for (const byte of bytes) {
    ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ' ';
  }

  const charsetMeta = ascii.match(/<meta[^>]+charset\s*=\s*["']?([^"' />]+)/i);
  if (charsetMeta?.[1]) return normalizeCharset(charsetMeta[1]);

  const contentTypeMeta = ascii.match(
    /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["']([^"']+)["']/i
  );
  return extractCharsetFromMime(contentTypeMeta?.[1]);
}

function getCurrentDocumentCharset(): string | null {
  if (typeof document === 'undefined') return null;
  return normalizeCharset(document.characterSet || document.charset);
}

function decodeHtmlBytes(
  buffer: ArrayBuffer,
  contentType?: string | null,
  fallbackCharset?: string | null
): string {
  const charset =
    extractCharsetFromMime(contentType) ||
    extractCharsetFromHtmlBytes(buffer) ||
    normalizeCharset(fallbackCharset) ||
    getCurrentDocumentCharset() ||
    'utf-8';

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function extractContentTypeFromResponseHeaders(headers: string): string | null {
  for (const line of headers.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    if (line.slice(0, separator).trim().toLowerCase() === 'content-type') {
      return line.slice(separator + 1).trim() || null;
    }
  }
  return null;
}

async function readFetchResponseText(response: Response): Promise<string> {
  if (typeof response.arrayBuffer !== 'function' || typeof TextDecoder === 'undefined') {
    return response.text();
  }

  const contentType =
    typeof response.headers?.get === 'function' ? response.headers.get('content-type') : null;
  const buffer = await response.arrayBuffer();
  return decodeHtmlBytes(buffer, contentType);
}

export function resolveAndValidateHttpUrl(url: string, base?: string): string | null {
  const normalized = normalizeUrlForFetch(url);

  let resolved: string;
  try {
    resolved = base ? new URL(normalized, base).toString() : new URL(normalized).toString();
  } catch {
    try {
      const fallbackBase = getDefaultBaseUrl();
      if (!fallbackBase) return null;
      resolved = new URL(normalized, fallbackBase).toString();
    } catch {
      return null;
    }
  }

  try {
    const u = new URL(resolved);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

    // Security: GM_xmlhttpRequest bypasses browser CORS and can be abused to fetch intranet/localhost content.
    // We block private-network/loopback/link-local hosts (both IPv4 and IPv6) unless the current page is on the
    // same host, which keeps same-origin "chapter fetch" working while mitigating accidental data leakage.
    if (isPrivateNetworkHost(u.hostname)) {
      const baseUrl = parseHttpUrl(base || '') || parseHttpUrl(getDefaultBaseUrl() || '');
      if (!baseUrl || normalizeHostname(baseUrl.hostname) !== normalizeHostname(u.hostname)) {
        return null;
      }
    }

    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Fetch a URL and parse it to a Document
 *
 * @param url - URL to fetch
 * @param referer - Referer URL
 * @param options - Options for timeout and retries
 * @returns Object with promise and abort function
 */
export function fetchAndParseUrl(
  url: string,
  referer?: string,
  options: { timeoutMs?: number; retries?: number } = {}
): { promise: Promise<FetchAndParseResult>; abort: () => void } {
  const gmXhr = getGmXhr();
  const requestUrl = resolveAndValidateHttpUrl(url, referer);
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxRetries = Math.max(0, options.retries ?? 1);

  if (!requestUrl) {
    console.error('[MNR] Invalid or unsupported URL:', url);
    return {
      promise: Promise.resolve({
        doc: null,
        status: null,
        finalUrl: null,
        error: 'invalid-url',
      }),
      abort: () => {},
    };
  }

  const parseHtmlToDoc = (html: string, finalUrl: string | null): FetchAndParseResult => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const base = doc.createElement('base');
      base.href = finalUrl || requestUrl;
      if (doc.head) {
        doc.head.insertBefore(base, doc.head.firstChild);
      } else {
        doc.documentElement?.insertBefore(base, doc.documentElement.firstChild);
      }
      (doc as Document & { _mnrUrl: string })._mnrUrl = finalUrl || requestUrl;
      return {
        doc,
        status: 200,
        finalUrl,
        error: null,
      };
    } catch (e) {
      console.error('[MNR] Parse error:', e);
      return {
        doc: null,
        status: null,
        finalUrl,
        error: 'parse',
      };
    }
  };

  let request: GmXhrReturn | null = null;
  let aborted = false;
  let fetchAbortController: AbortController | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const doRequest = (): Promise<FetchAndParseResult> => {
    const headers: Record<string, string> = {
      Accept: 'text/html,application/xhtml+xml,application/xml',
    };

    // `Referer` is a forbidden header for `fetch` in browsers; only apply it for GM XHR.
    const normalizedReferer = referer ? resolveAndValidateHttpUrl(referer) : undefined;

    // Prefer native fetch for same-origin requests. It uses the page's live browser session,
    // which is more reliable on sites with active anti-bot probes.
    const pageFetch = isCurrentOriginRequest(requestUrl) ? getPageNativeFetch() : null;

    // Prefer GM_xmlhttpRequest for cross-origin requests when available (bypasses CORS and supports legacy encodings).
    if (gmXhr && !pageFetch) {
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
      if (normalizedReferer) {
        headers['Referer'] = normalizedReferer;
      }

      return new Promise(resolve => {
        request = gmXhr({
          method: 'GET',
          url: requestUrl,
          headers,
          timeout: timeoutMs,
          responseType: 'arraybuffer',
          onload: response => {
            const finalUrl = response.finalUrl
              ? resolveAndValidateHttpUrl(response.finalUrl, requestUrl)
              : null;
            if (response.status >= 200 && response.status < 300) {
              const responseBytes = response.response;
              let html: string;
              try {
                html =
                  responseBytes && typeof responseBytes.byteLength === 'number'
                    ? decodeHtmlBytes(
                        responseBytes,
                        extractContentTypeFromResponseHeaders(response.responseHeaders)
                      )
                    : response.responseText;
              } catch (e) {
                // A throw inside onload would leave this request unsettled forever.
                console.error('[MNR] Decode error:', e);
                resolve({ doc: null, status: response.status, finalUrl, error: 'parse' });
                return;
              }
              const parsed = parseHtmlToDoc(html, finalUrl);
              resolve({
                ...parsed,
                status: response.status,
                finalUrl,
              });
              return;
            }

            console.error('[MNR] HTTP error:', response.status);
            resolve({
              doc: null,
              status: response.status,
              finalUrl,
              error: 'http',
            });
          },
          onerror: () => {
            resolve({ doc: null, status: null, finalUrl: null, error: 'network' });
          },
          onabort: () => {
            resolve({ doc: null, status: null, finalUrl: null, error: 'abort' });
          },
          ontimeout: () => {
            console.error('[MNR] Request timeout');
            resolve({ doc: null, status: null, finalUrl: null, error: 'timeout' });
          },
        } as GM_xmlhttpRequestOptions);
      });
    }

    const fetchRequest = pageFetch ?? (typeof fetch === 'function' ? fetch : null);
    if (!fetchRequest) {
      console.error('[MNR] GM_xmlhttpRequest not available and fetch is missing');
      return Promise.resolve({
        doc: null,
        status: null,
        finalUrl: null,
        error: 'missing-gm-xhr',
      });
    }

    fetchAbortController = new AbortController();
    timedOut = false;
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      fetchAbortController?.abort();
    }, timeoutMs);

    const fetchInit: RequestInit = {
      method: 'GET',
      headers,
      signal: fetchAbortController.signal,
      credentials: 'include',
      redirect: 'follow',
    };

    // `referrer` is supported in browsers; ignore failures in non-browser runtimes.
    if (normalizedReferer) {
      try {
        fetchInit.referrer = normalizedReferer;
      } catch {
        // ignore
      }
    }

    return fetchRequest(requestUrl, fetchInit)
      .then(async response => {
        const finalUrl = response.url ? resolveAndValidateHttpUrl(response.url, requestUrl) : null;
        const status = response.status;
        if (status >= 200 && status < 300) {
          const html = await readFetchResponseText(response);
          const parsed = parseHtmlToDoc(html, finalUrl);
          const result: FetchAndParseResult = { ...parsed, status, finalUrl };
          return result;
        }

        console.error('[MNR] HTTP error:', status);
        const result: FetchAndParseResult = {
          doc: null,
          status,
          finalUrl,
          error: 'http',
        };
        return result;
      })
      .catch(err => {
        if (aborted) {
          const result: FetchAndParseResult = {
            doc: null,
            status: null,
            finalUrl: null,
            error: 'abort',
          };
          return result;
        }
        if (timedOut) {
          console.error('[MNR] Request timeout');
          const result: FetchAndParseResult = {
            doc: null,
            status: null,
            finalUrl: null,
            error: 'timeout',
          };
          return result;
        }
        console.error('[MNR] Network error:', err);
        const result: FetchAndParseResult = {
          doc: null,
          status: null,
          finalUrl: null,
          error: 'network',
        };
        return result;
      })
      .finally(() => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      });
  };

  const shouldRetry = (res: FetchAndParseResult): boolean => {
    if (aborted) return false;
    if (res.error === 'timeout' || res.error === 'network') return true;
    if (res.error === 'http' && res.status && (res.status >= 500 || res.status === 429)) {
      return true;
    }
    return false;
  };

  const promise = (async (): Promise<FetchAndParseResult> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (aborted) return { doc: null, status: null, finalUrl: null, error: 'abort' };

      const res = await doRequest();
      if (!shouldRetry(res) || attempt === maxRetries) {
        return res;
      }

      const delay = Math.min(400 * Math.pow(2, attempt), 2000);
      await new Promise<void>(resolve => globalThis.setTimeout(resolve, delay));
    }

    return { doc: null, status: null, finalUrl: null, error: 'network' };
  })();

  const abort = () => {
    aborted = true;
    try {
      request?.abort();
    } catch {
      // ignore
    }
    try {
      fetchAbortController?.abort();
    } catch {
      // ignore
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  return { promise, abort };
}
