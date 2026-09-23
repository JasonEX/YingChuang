import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { makeBqg5Section } from '../testUtils/pagedCatalogs';
import { Parser } from '@/core/parser/Parser';
import { SectionMerger } from '@/core/auto-enable/SectionMerger';

const chapterUrl = 'https://m.bqg5.com/4_4581/2196198.html';
const secondUrl = chapterUrl.replace('.html', '_2.html');

describe('generic section content', () => {
  it('preserves a live later page before first-page delivery hides and retitles the host', async () => {
    const dom = new JSDOM(makeBqg5Section(53, 2), { url: secondUrl });
    const liveDoc = dom.window.document;
    const firstDoc = new DOMParser().parseFromString(makeBqg5Section(53, 1), 'text/html');
    const fetcher = vi.fn(async () => firstDoc);
    const onSectionPage = vi.fn();
    try {
      const result = await new SectionMerger(new Parser()).merge(liveDoc, secondUrl, {
        fetcher,
        onFirstPage: chapter => {
          const style = liveDoc.createElement('style');
          style.textContent = 'body > * { display: none !important; }';
          liveDoc.head.append(style);
          liveDoc.title = chapter.title;
        },
        onSectionPage,
      });

      expect(fetcher.mock.calls).toEqual([[chapterUrl, secondUrl]]);
      expect(onSectionPage).toHaveBeenCalledOnce();
      expect(onSectionPage.mock.calls[0][0].content).not.toMatch(/第\(|首页|我的书架/);
      expect(result?.content).toContain('第2页正文段落50');
      expect(result?.content).not.toMatch(/第\(|首页|我的书架/);
      expect(result?.nextUrl).toBe('https://m.bqg5.com/4_4581/2196199.html');
    } finally {
      dom.window.close();
    }
  });

  it.each([1, 2])('cleans each page before merging from page %i', async startPage => {
    const parser = new Parser();
    const docs = [1, 2].map(section =>
      new DOMParser().parseFromString(makeBqg5Section(53, section), 'text/html')
    );
    const originalHtml = docs.map(doc => doc.body.innerHTML);
    for (const [index, doc] of docs.entries()) {
      const url = index === 0 ? chapterUrl : secondUrl;
      expect(parser.detect(doc, url).results.content.selector).toBe('#chaptercontent');
      const parsed = await parser.parse(doc, url);
      expect(parsed).toMatchObject({ method: 'detection', rule: undefined });
      expect(parsed?.content).not.toMatch(/第\(|书签|我的书架|下一章/);
    }

    const fetcher = vi.fn(async (url: string) => (url === chapterUrl ? docs[0] : docs[1]));
    const onMergeEnd = vi.fn();
    const result = await new SectionMerger(parser).merge(
      docs[startPage - 1],
      startPage === 1 ? chapterUrl : secondUrl,
      { fetcher, onMergeEnd }
    );

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      startPage === 1 ? secondUrl : chapterUrl,
    ]);
    expect(onMergeEnd).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: 2, truncated: false })
    );
    expect(result).toMatchObject({
      url: chapterUrl,
      prevUrl: 'https://m.bqg5.com/4_4581/2196197.html',
      nextUrl: 'https://m.bqg5.com/4_4581/2196199.html',
      indexUrl: 'https://m.bqg5.com/4_4581/',
    });
    const content = new DOMParser().parseFromString(result!.content, 'text/html');
    expect(
      Array.from(content.querySelectorAll('p'), p => p.textContent?.trim()).filter(Boolean)
    ).toEqual(
      [1, 2].flatMap(section =>
        Array.from(
          { length: 50 },
          (_, i) =>
            `第${section}页正文段落${i + 1}：山间的风吹过树梢，他停下来仔细查看地图，沿着河岸继续赶路。`
        )
      )
    );
    expect(docs.map(doc => doc.body.innerHTML)).toEqual(originalHtml);
  });
});
