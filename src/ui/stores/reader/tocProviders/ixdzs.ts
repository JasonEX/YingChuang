import type { SpecialTocLoader, SpecialTocLoaderContext } from './index';
import { requestSiteData } from '@/core/utils/siteRequest';
import type { TocEntry } from '../types';

function getBookUrl(context: SpecialTocLoaderContext): URL | null {
  for (const candidate of [context.currentUrl, context.indexUrl]) {
    try {
      const url = new URL(candidate);
      if (
        /^https?:$/.test(url.protocol) &&
        url.hostname === 'ixdzs8.com' &&
        /^\/read\/\d+\/(?:p\d+\.html)?$/.test(url.pathname)
      ) {
        return url;
      }
    } catch {
      // Try the other page URL.
    }
  }
  return null;
}

export const ixdzsTocLoader: SpecialTocLoader = {
  id: 'ixdzs',
  matches: context => getBookUrl(context) !== null,
  async load(context) {
    const pageUrl = getBookUrl(context);
    if (!pageUrl) return [];
    const bookId = pageUrl.pathname.split('/')[2];
    return (
      (await requestSiteData(new URL('/novel/clist/', pageUrl.origin).href, {
        responseType: 'json',
        setAbort: context.setAbort,
        onResult: context.onRequest,
        timeoutMs: 15_000,
        gmFallback: false,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({ bid: bookId }).toString(),
        parse: data => {
          const payload = data as {
            rs?: unknown;
            data?: Array<{ ctype?: unknown; ordernum?: unknown; title?: unknown } | null>;
          } | null;
          if (payload?.rs !== 200 || !Array.isArray(payload.data)) {
            throw new Error('Invalid chapter-list response');
          }

          const entries: TocEntry[] = [];
          const seen = new Set<string>();
          for (const row of payload.data) {
            if (!row || String(row.ctype) !== '0') continue;
            const number = String(row.ordernum);
            if (!/^[1-9]\d*$/.test(number) || typeof row.title !== 'string') continue;
            const title = row.title.trim();
            if (!title || seen.has(number)) continue;
            seen.add(number);
            entries.push({
              title,
              url: new URL(`/read/${bookId}/p${number}.html`, pageUrl.origin).href,
            });
          }
          return entries;
        },
      })) || []
    );
  },
};
