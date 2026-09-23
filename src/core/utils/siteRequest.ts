import { getRetryAfterHeader, type RequestOutcome, runRequest } from './requestPolicy';

export interface SiteRequestDiagnostic {
  url: string;
  finalUrl: string | null;
  transport: 'fetch' | 'gm' | null;
  status: number | null;
  reason: string;
}

interface SiteRequestOptions<T> {
  responseType: 'text' | 'json';
  parse: (data: unknown) => T | null;
  setAbort: (abort: (() => void) | null) => void;
  headers?: Record<string, string>;
  referrer?: string;
  method?: 'GET' | 'POST';
  body?: string;
  timeoutMs?: number;
  gmFallback?: boolean;
  retries?: number;
  onResult?: (result: SiteRequestDiagnostic) => void;
}

function getPageFetch(): typeof fetch | null {
  if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.fetch === 'function') {
    return unsafeWindow.fetch.bind(unsafeWindow) as typeof fetch;
  }
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch.bind(window);
  }
  return typeof fetch === 'function' ? fetch : null;
}

interface SiteResult<T> extends RequestOutcome {
  value: T | null;
  finalUrl: string | null;
  transport: 'fetch' | 'gm' | null;
}

/** Read-only site APIs: one owner spans all attempts, transports and body decoding. */
export async function requestSiteData<T>(
  url: string,
  options: SiteRequestOptions<T>
): Promise<T | null> {
  const controller = new AbortController();
  const fetcher = getPageFetch();
  const gmXhr = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
  let useGm = !fetcher;
  let lastResult: SiteResult<T> | undefined;
  const stopped = (error: string, status: number | null): SiteResult<T> => ({
    ...lastResult,
    value: null,
    finalUrl: null,
    transport: lastResult?.transport ?? null,
    error,
    status,
  });
  options.setAbort(() => controller.abort());

  const attempt = (): Promise<SiteResult<T>> =>
    new Promise(resolve => {
      const transportController = new AbortController();
      let gmRequest: { abort: () => void } | undefined;
      let settled = false;
      const result: SiteResult<T> = {
        ...stopped('network', null),
        transport: useGm ? 'gm' : 'fetch',
      };
      lastResult = result;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', abort);
        resolve(result);
      };
      const cancel = (error: string) => {
        if (settled) return;
        result.error = error;
        finish();
        transportController.abort();
        try {
          gmRequest?.abort();
        } catch (error) {
          console.debug('[MNR] Site request abort failed:', error);
        }
      };
      const abort = () => cancel('abort');
      const timer = setTimeout(() => cancel('timeout'), options.timeoutMs ?? 10_000);
      controller.signal.addEventListener('abort', abort, { once: true });
      const parse = (data: unknown) => {
        try {
          result.value = options.parse(data);
        } catch (error) {
          console.debug('[MNR] Invalid site response:', error);
        }
        result.error = result.value === null ? 'parse' : null;
      };
      const fallback = () => {
        // Preserve the established session/format fallback, but never change transport on 429/5xx.
        if (
          !useGm &&
          gmXhr &&
          options.gmFallback !== false &&
          (result.error === 'network' || result.error === 'parse' || result.status === 403)
        ) {
          useGm = true;
          result.error = 'fallback';
        }
        finish();
      };

      if (useGm) {
        if (!gmXhr) {
          result.error = 'unavailable';
          finish();
          return;
        }
        try {
          gmRequest = gmXhr({
            method: options.method ?? 'GET',
            url,
            data: options.body,
            headers: {
              ...options.headers,
              ...(options.referrer ? { Referer: options.referrer } : {}),
            },
            timeout: options.timeoutMs ?? 10_000,
            withCredentials: true,
            onload: response => {
              if (settled) return;
              result.status = response.status;
              result.finalUrl = response.finalUrl || url;
              result.retryAfter = getRetryAfterHeader(response.responseHeaders);
              result.error = 'http';
              if (response.status >= 200 && response.status < 300) {
                try {
                  parse(
                    options.responseType === 'json'
                      ? JSON.parse(response.responseText)
                      : response.responseText
                  );
                } catch (error) {
                  result.error = 'parse';
                  console.debug('[MNR] Invalid GM site response:', error);
                }
              }
              finish();
            },
            onerror: () => finish(),
            onabort: () => cancel('abort'),
            ontimeout: () => cancel('timeout'),
          });
        } catch (error) {
          console.warn('[MNR] Site request failed:', error);
          finish();
        }
        return;
      }
      void (async () => {
        try {
          const response = await fetcher!(url, {
            method: options.method ?? 'GET',
            credentials: 'include',
            headers: options.headers,
            ...(options.body === undefined ? {} : { body: options.body }),
            signal: transportController.signal,
          });
          if (settled) return;
          result.status = response.status ?? (response.ok ? 200 : null);
          result.finalUrl = response.url || url;
          result.retryAfter = response.headers?.get?.('Retry-After') ?? null;
          result.error = 'http';
          if (response.ok) {
            try {
              const data = await response[options.responseType]();
              if (settled) return;
              parse(data);
            } catch (error) {
              if (settled) return;
              result.error = 'parse';
              console.debug('[MNR] Invalid native site response:', error);
            }
          }
        } catch (error) {
          if (settled) return;
          result.error = 'network';
          console.debug('[MNR] Native site request failed:', error);
        }
        fallback();
      })();
    });

  try {
    const result = await runRequest(url, {
      signal: controller.signal,
      attempt,
      stopped,
      retries: options.retries,
      retryRateLimit: false,
    });
    options.onResult?.({
      url,
      finalUrl: result.finalUrl,
      transport: result.transport,
      status: result.status,
      reason: result.error === 'abort' ? 'cancelled' : (result.error ?? 'success'),
    });
    return result.value;
  } finally {
    options.setAbort(null);
  }
}
