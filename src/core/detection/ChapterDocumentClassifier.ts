import { isCloudflareChallenge } from '@/core/protection';

export type ChapterDocumentBlockReason = 'cloudflare' | 'vip';

export interface ChapterDocumentClassifyOptions {
  /**
   * `content.selector` of the site rule that matched this document, when one is known.
   *
   * Used to suppress false positives: some sites render subscription copy next to a real
   * chapter (or next to an encrypted shell that JavaScript fills in later), which would
   * otherwise trip the generic VIP heuristics below.
   */
  contentSelector?: string;
}

export function normalizeTextForVipDetection(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[\u3000]/g, '')
    .replace(/[，。！？、""''（）()【】[\]<>《》:：;；·~…—-]/g, '')
    .toLowerCase();
}

/** Subscription/paywall copy, matched against normalized text. */
const VIP_COPY_PATTERNS: RegExp[] = [
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

function hasVipCopy(normalizedText: string): boolean {
  return VIP_COPY_PATTERNS.some(re => re.test(normalizedText));
}

/**
 * Decide whether a matched rule's content container proves this is a chapter, not a paywall.
 *
 * A real paywall renders its notice *inside* the reading area (or omits the container
 * entirely). When the container exists and carries no subscription copy of its own, the
 * notice belongs to surrounding page furniture and the container is the chapter shell —
 * possibly still empty, because some sites decrypt or lazily inject the text after load.
 */
function isChapterShell(doc: Document, contentSelector?: string): boolean {
  if (!contentSelector) return false;

  let container: Element | null;
  try {
    container = doc.querySelector(contentSelector);
  } catch {
    return false;
  }
  if (!container) return false;

  return !hasVipCopy(normalizeTextForVipDetection(container.textContent || ''));
}

/**
 * Detect whether a fetched page is a VIP / locked chapter page.
 * The heuristics stay conservative to avoid false positives from author requests for subscriptions.
 */
export function isVipChapterPage(
  doc: Document,
  options: ChapterDocumentClassifyOptions = {}
): boolean {
  try {
    if (isChapterShell(doc, options.contentSelector)) return false;
  } catch {
    // Fall through to generic VIP detection.
  }

  const rawText = doc.body?.textContent || '';
  if (!rawText) return false;

  const text = normalizeTextForVipDetection(rawText);
  if (hasVipCopy(text)) return true;

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
export function getChapterDocumentBlockReason(
  doc: Document,
  options: ChapterDocumentClassifyOptions = {}
): ChapterDocumentBlockReason | null {
  if (isCloudflareChallenge(doc)) return 'cloudflare';
  if (isVipChapterPage(doc, options)) return 'vip';
  return null;
}
