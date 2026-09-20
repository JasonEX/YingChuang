/**
 * AD_PATTERNS is split into layers so site-keyed watermarks stay visible and retirable.
 * Composition order is load-bearing: the bare-URL scrubbers would otherwise consume the
 * host names that the site watermark patterns use as their anchor.
 */

import {
  AD_PATTERNS,
  BARE_URL_PATTERNS,
  GENERIC_AD_PATTERNS,
  SITE_WATERMARK_PATTERNS,
} from '@/core/constants/selectors';
import { describe, expect, it } from 'vitest';

describe('ad pattern layers', () => {
  it('composes the layers in execution order without losing a pattern', () => {
    expect(AD_PATTERNS).toEqual([
      ...GENERIC_AD_PATTERNS,
      ...SITE_WATERMARK_PATTERNS,
      ...BARE_URL_PATTERNS,
    ]);
    expect(AD_PATTERNS).toHaveLength(
      GENERIC_AD_PATTERNS.length + SITE_WATERMARK_PATTERNS.length + BARE_URL_PATTERNS.length
    );
  });

  it('keeps bare-URL scrubbing after the site watermarks that anchor on a host name', () => {
    const firstBareUrl = AD_PATTERNS.indexOf(BARE_URL_PATTERNS[0]);
    const lastWatermark = AD_PATTERNS.indexOf(
      SITE_WATERMARK_PATTERNS[SITE_WATERMARK_PATTERNS.length - 1]
    );
    expect(lastWatermark).toBeGreaterThanOrEqual(0);
    expect(firstBareUrl).toBeGreaterThan(lastWatermark);
  });

  it('keeps host-keyed patterns out of the generic layer', () => {
    const hostKeyed = /1qxs|ttks|幻想姬|萝\[|天天看/;
    for (const pattern of GENERIC_AD_PATTERNS) {
      expect(pattern.source).not.toMatch(hostKeyed);
    }
    expect(SITE_WATERMARK_PATTERNS.length).toBeGreaterThan(0);
  });

  it('still strips the watermarks it strips today', () => {
    const apply = (text: string) =>
      AD_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, ''), text);

    expect(apply('正文结束 天天看小說 解書荒 ttks.tw')).not.toContain('ttks.tw');
    expect(apply('本章未完，请点击下一页继续阅读')).toBe('');
    expect(apply('访问 https://spam.example/x 继续')).not.toContain('https://');

    // The 1qxs watermark moved out of the generic block into the site layer, i.e. it now runs
    // after the surrounding generic patterns. Pin the outcome so that reorder stays harmless.
    const oneQxs = '正文结束【某本书】小说免费阅读，请收藏 某站【1qxs.com】';
    expect(apply(oneQxs)).toBe('正文结束');
  });
});
