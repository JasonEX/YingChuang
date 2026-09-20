import { describe, expect, it, vi } from 'vitest';
import {
  makeNovel543Chapter,
  makeNovel543Toc,
  novel543BookTitle,
  novel543ChapterPath,
  novel543Origin,
  novel543RawVipPromotion,
  novel543VipPromotion,
} from '../testUtils/novel543';

import { getSectionBaseUrl, isSectionLikeUrl } from '@/core/utils';
import { builtInRules } from '@/core/rules/builtInRules';
import { collectTocCandidates } from '@/ui/stores/reader/tocEntries';
import { getRuleManager } from '@/core/rules/RuleManager';
import { novel543Rule } from '@/core/rules/sites/novel543';
import { Parser } from '@/core/parser';
import { SectionMerger } from '@/core/auto-enable/SectionMerger';

const url = (chapter: number, page = 1) => novel543Origin + novel543ChapterPath(chapter, page);
// The site declares its section-URL shape on the rule; the generic helpers read it from there.
const parseSectionUrl = (value: string) => getRuleManager().parseSectionUrl(value);
const doc = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const base = parsed.createElement('base');
  base.href = novel543Origin;
  parsed.head.prepend(base);
  return parsed;
};

describe('Novel543 rule', () => {
  it('removes the VIP promotion before paragraph normalization wraps its image', async () => {
    const parsedDoc = doc(makeNovel543Chapter(570));
    parsedDoc
      .querySelector('.chapter-content > .content')!
      .insertAdjacentHTML('beforeend', novel543RawVipPromotion);
    const parsed = await new Parser().parse(parsedDoc, url(570));
    expect(parsed?.content).not.toContain('/auth/govip.html');
    expect(parsed?.content).not.toContain('/images/vip.png');
    expect(parsed?.content).toContain('第1頁末句');
  });

  it('matches only its chapter URLs', () => {
    expect(builtInRules).toContain(novel543Rule);
    const match = new RegExp(novel543Rule.match.pattern);
    expect(match.test(url(941))).toBe(true);
    expect(match.test(url(941, 2))).toBe(true);
    expect(match.test(`${novel543Origin}/1019622989/dir`)).toBe(false);
    expect(parseSectionUrl('https://example.com/1019622989/8096_941.html')).toBeNull();
    expect(parseSectionUrl(`${novel543Origin}/1019622989/dir`)).toBeNull();
    expect(parseSectionUrl('invalid')).toBeNull();
    expect(parseSectionUrl(url(941, 2))).toEqual({ chapterUrl: url(941), page: 2 });
  });

  it.each([1, 2, 99, 941])('keeps chapter %i separate from section suffixes', chapter => {
    expect(getSectionBaseUrl(url(chapter), parseSectionUrl)).toBeNull();
    expect(getSectionBaseUrl(`${url(chapter, 2)}?lang=zh#top`, parseSectionUrl)).toBe(
      `${url(chapter)}?lang=zh`
    );
    expect(isSectionLikeUrl(url(chapter), url(chapter, 2), parseSectionUrl)).toBe(true);
    expect(isSectionLikeUrl(url(chapter), url(chapter + 1), parseSectionUrl)).toBe(false);
    expect(isSectionLikeUrl(url(chapter, 2), url(chapter + 1), parseSectionUrl)).toBe(false);
    expect(
      isSectionLikeUrl(url(chapter), `${novel543Origin}/1019622989/dir`, parseSectionUrl)
    ).toBe(false);
    // Without the site shape the generic split would mis-read the chapter id as a page number.
    expect(getSectionBaseUrl(url(chapter, 2))).not.toBe(`${url(chapter)}`);
  });

  it.each([1, 2])('merges the whole chapter when opened at page %i', async page => {
    const parser = new Parser();
    const fetcher = vi.fn(async (target: string) => {
      if (target === url(941)) return doc(makeNovel543Chapter(941));
      if (target === url(941, 2)) return doc(makeNovel543Chapter(941, 2));
      throw new Error(`Unexpected section fetch: ${target}`);
    });
    const parsed = await new SectionMerger(parser).merge(
      doc(makeNovel543Chapter(941, page)),
      url(941, page),
      { fetcher }
    );
    expect(parsed?.url).toBe(url(941));
    expect(parsed?.title).toBe('第941章 百倍獎勵');
    expect(parsed?.bookTitle).toBe(novel543BookTitle);
    expect(parsed?.content).toContain('第1頁末句');
    expect(parsed?.content).toContain('第2頁末句');
    expect(parsed?.content).not.toContain('站內信');
    expect(parsed?.content).not.toContain('廣告干擾');
    expect(parsed?.content).not.toContain('现推出VIP会员免广告功能');
    expect(parsed?.content).not.toContain('/images/vip.png');
    expect(parsed?.content).toContain('他看到一張紙');
    expect(parsed?.nextUrl).toBe(url(942));
    expect(parsed?.prevUrl).toBe(url(940));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['https://www.novel543.com', ''])(
    'removes the VIP promotion with %s links while preserving narrative content',
    async origin => {
      const parsedDoc = doc(makeNovel543Chapter(559));
      const content = parsedDoc.querySelector('.chapter-content > .content')!;
      content.insertAdjacentHTML(
        'beforeend',
        novel543VipPromotion.replaceAll('https://www.novel543.com', origin) +
          '<div><p>她說：「VIP会员免广告功能聽起來不錯。」</p>' +
          '<p><a href="/auth/govip.html">他打開會員頁面，繼續閱讀。</a></p></div>' +
          '<div><p><img src="/images/vip.png" alt="故事中的會員徽章"></p>' +
          '<p>她收起了故事中的會員徽章。</p></div>'
      );
      const parsed = await new Parser().parse(parsedDoc, url(559));
      expect(parsed?.content).not.toContain('应广大读者的要求');
      expect(parsed?.content).not.toContain('点击查看');
      expect(parsed?.content).toContain('VIP会员免广告功能聽起來不錯');
      expect(parsed?.content).toContain('他打開會員頁面，繼續閱讀');
      expect(parsed?.content).toContain('故事中的會員徽章');
      expect(parsed?.nextUrl).toBe(url(559, 2));
    }
  );

  it.each([
    '如果覺得本書不錯, 避免下次找不到, 請記得加入書架哦',
    '搜書名找不到, 可以試試搜作者哦, 也許只是改名了!',
    '大家遇到 「你是真人嗎」 這樣的廣告, 無需理會, 關閉即可, 切勿掃碼和發送簡訊!',
  ])('removes the site notice widget regardless of its message: %s', async message => {
    const parsedDoc = doc(makeNovel543Chapter(941));
    const notice = parsedDoc.querySelector('#chapterWarp .content > div > p')!;
    notice.innerHTML = '<span style="color:#ff6666">溫馨提示: </span>';
    notice.append(message);
    const content = parsedDoc.querySelector('.chapter-content > .content')!;
    const narrative = parsedDoc.createElement('div');
    narrative.innerHTML =
      '<p>溫馨提示: 這張紙上的字跡有些模糊。</p><p>他念出紙上的<span>溫馨提示: </span>字樣。</p>';
    content.append(narrative);
    const parsed = await new Parser().parse(parsedDoc, url(941));
    expect(parsed?.content).not.toContain(message);
    expect(parsed?.content).toContain('溫馨提示: 這張紙上的字跡有些模糊');
    expect(parsed?.content).toContain('他念出紙上的');
    expect(parsed?.content).toContain('他看到一張紙');
  });

  it('does not treat the directory as a missing next chapter', async () => {
    const parsedDoc = doc(makeNovel543Chapter(946, 2));
    parsedDoc.querySelector('.foot-nav a:last-of-type')?.remove();
    const parsed = await new Parser().parse(parsedDoc, url(946, 2));
    expect(parsed?.nextUrl).toBeUndefined();
    expect(parsed?.indexUrl).toBe(`${novel543Origin}/1019622989/dir`);
  });

  it('reads the full catalog in order without the latest-chapters preview', () => {
    const entries = collectTocCandidates(
      doc(makeNovel543Toc()),
      `${novel543Origin}/1019622989/dir`,
      novel543Rule
    );
    expect(entries.map(entry => entry.url)).toEqual(
      [940, 941, 942, 943].map(chapter => url(chapter))
    );
  });
});
