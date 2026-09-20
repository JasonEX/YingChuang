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

/** One cancellable operation, including body decoding and optional GM fallback. */
export function requestSiteData<T>(url: string, options: SiteRequestOptions<T>): Promise<T | null> {
  return new Promise(resolve => {
    const controller = new AbortController();
    let gmRequest: { abort: () => void } | undefined;
    let settled = false;
    const timeoutMs = options.timeoutMs ?? 10_000;
    const diagnostic: SiteRequestDiagnostic = {
      url,
      finalUrl: null,
      transport: null,
      status: null,
      reason: 'unavailable',
    };
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.setAbort(null);
      options.onResult?.({ ...diagnostic, reason: value === null ? diagnostic.reason : 'success' });
      resolve(value);
    };
    const cancel = (reason = 'cancelled') => {
      if (settled) return;
      diagnostic.reason = reason;
      finish(null);
      controller.abort();
      try {
        gmRequest?.abort();
      } catch (error) {
        console.debug('[MNR] Site request abort failed:', error);
      }
    };
    const timer = setTimeout(() => cancel('timeout'), timeoutMs);
    options.setAbort(cancel);

    const parse = (data: unknown): T | null => {
      try {
        return options.parse(data);
      } catch (error) {
        console.debug('[MNR] Invalid site response:', error);
        return null;
      }
    };

    void (async () => {
      try {
        if (settled) return;
        const fetcher = getPageFetch();
        if (fetcher) {
          diagnostic.transport = 'fetch';
          diagnostic.reason = 'network';
          try {
            const response = await fetcher(url, {
              method: options.method ?? 'GET',
              credentials: 'include',
              headers: options.headers,
              ...(options.body === undefined ? {} : { body: options.body }),
              signal: controller.signal,
            });
            if (settled) return;
            diagnostic.status = response.status;
            diagnostic.finalUrl = response.url || url;
            diagnostic.reason = response.ok ? 'parse' : 'http';
            if (response.ok) {
              const data = await response[options.responseType]();
              if (settled) return;
              const value = parse(data);
              if (value !== null) {
                finish(value);
                return;
              }
            }
          } catch (error) {
            if (!settled) console.debug('[MNR] Native site request failed:', error);
          }
        }
        if (settled) return;
        const gmXhr = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
        if (options.gmFallback === false || !gmXhr) {
          finish(null);
          return;
        }
        diagnostic.transport = 'gm';
        diagnostic.status = null;
        diagnostic.finalUrl = null;
        diagnostic.reason = 'network';
        gmRequest = gmXhr({
          method: options.method ?? 'GET',
          url,
          data: options.body,
          headers: {
            ...options.headers,
            ...(options.referrer ? { Referer: options.referrer } : {}),
          },
          timeout: timeoutMs,
          withCredentials: true,
          onload: response => {
            if (settled) return;
            diagnostic.status = response.status;
            diagnostic.finalUrl = response.finalUrl || url;
            diagnostic.reason = 'http';
            if (response.status < 200 || response.status >= 300) {
              finish(null);
              return;
            }
            diagnostic.reason = 'parse';
            try {
              const data =
                options.responseType === 'json'
                  ? JSON.parse(response.responseText)
                  : response.responseText;
              finish(parse(data));
            } catch (error) {
              console.debug('[MNR] Invalid GM site response:', error);
              finish(null);
            }
          },
          onerror: () => finish(null),
          onabort: () => {
            diagnostic.reason = 'cancelled';
            finish(null);
          },
          ontimeout: () => cancel('timeout'),
        });
      } catch (error) {
        console.warn('[MNR] Site request failed:', error);
        finish(null);
      }
    })();
  });
}
