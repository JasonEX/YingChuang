import { isCloudflareChallenge } from '@/core/protection';

export type ChapterDocumentBlockReason = 'cloudflare' | 'vip';

export function normalizeTextForVipDetection(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[\u3000]/g, '')
    .replace(/[，。！？、""''（）()【】[\]<>《》:：;；·~…—-]/g, '')
    .toLowerCase();
}

/**
 * Detect whether a fetched page is a VIP / locked chapter page.
 * The heuristics stay conservative to avoid false positives from author requests for subscriptions.
 */
export function isVipChapterPage(doc: Document): boolean {
  try {
    const url =
      (doc as Document & { _mnrUrl?: string })._mnrUrl || doc.location?.href || doc.baseURI || '';
    if (/^https?:\/\/(?:www|wap)\.ciweimao\.com\/chapter\/\d+/i.test(url)) {
      const hasChapterShell = !!doc.querySelector('#J_BookCnt, #J_BookRead');
      if (hasChapterShell) return false;
    }
  } catch {
    // Fall through to generic VIP detection.
  }

  const rawText = doc.body?.textContent || '';
  if (!rawText) return false;

  const text = normalizeTextForVipDetection(rawText);
  const patterns: RegExp[] = [
    /本章(?:为|是)?vip章节/,
    /(vip|付费|收费)(?:章节|内容)/,
    /(未订阅|未购买|未解锁).{0,10}(本章|本章节|章节|内容)/,
    /(本章|本章节|章节|内容).{0,12}(?:已)?锁定/,
    /(本章|本章节|章节|内容).{0,12}(?:需|需要).{0,6}(订阅|购买|付费|解锁)/,
    /(订阅|购买|付费|解锁).{0,12}(后|即可|才能|方可|才可).{0,12}(阅读|查看|继续阅读|继续查看)/,
    /(请|需).{0,6}(订阅|购买|付费|解锁).{0,12}(阅读|查看|继续阅读|继续查看)/,
    /立即(订阅|购买|解锁|充值)/,
    /(订阅|购买|解锁)本章/,
  ];

  if (patterns.some(re => re.test(text))) return true;

  const ctaText = Array.from(
    doc.querySelectorAll('a,button,input[type="button"],input[type="submit"]')
  )
    .map(element => {
      if (element instanceof HTMLInputElement) return element.value || '';
      return element.textContent || '';
    })
    .join(' ');
  const cta = normalizeTextForVipDetection(ctaText);
  if (/立即(订阅|购买|解锁|充值)/.test(cta) && /(vip|付费|订阅|购买|解锁|锁定)/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Classify documents that must not enter the chapter parser or cache pipeline.
 * The function is intentionally pure; callers own navigation and UI policy.
 */
export function getChapterDocumentBlockReason(doc: Document): ChapterDocumentBlockReason | null {
  if (isCloudflareChallenge(doc)) return 'cloudflare';
  if (isVipChapterPage(doc)) return 'vip';
  return null;
}
