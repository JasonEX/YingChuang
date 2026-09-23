import { convertHTML, convertText } from '@/core/converter/ChineseConverter';
import { expect, it } from 'vitest';
import { detectChineseScriptFromText } from '@/core/converter/scriptProfile';

it('preserves a valid author credit in mixed prose', async () => {
  expect(await convertHTML('<p>山間的風</p><p>曹雪芹著</p>', 'sc', { sourceScript: 'mixed' })).toBe(
    '<p>山间的风</p><p>曹雪芹著</p>'
  );
});
it('converts minority Traditional characters without locale metadata', async () => {
  const source = '他走进房间，听见风吹过树林。'.repeat(30) + '鐘聲響徹，燈籠搖曳。';
  const sourceScript = detectChineseScriptFromText(source);
  expect(sourceScript).toBe('hans');
  expect(await convertText(source, 'sc', { sourceScript })).toContain('钟声响彻，灯笼摇曳。');
});

it('does not turn reading conversion into author-name or vocabulary rewriting', async () => {
  const source = '曹雪芹著《紅樓夢》。沈默不語，沈淪望著鐘樓，芸芸眾生，河浜，乾坤，乾佑縣。';
  const expected = '曹雪芹著《红楼梦》。沈默不语，沈沦望著钟楼，芸芸众生，河浜，乾坤，乾佑县。';
  const simplified = await convertText(source, 'sc');
  expect(simplified).toBe(expected);
  expect(await convertText(simplified, 'sc')).toBe(expected);
});
it('converts encoded text without interpreting attribute values as prose', async () => {
  expect(
    await convertHTML('<p title="鐘聲">&#37912;&#32882;</p>', 'sc', { sourceScript: 'hans' })
  ).toBe('<p title="鐘聲">钟声</p>');
});

it('retains the existing Traditional-mode protection', async () => {
  expect(await convertText('皇后與曹雪芹著作', 'tc', { sourceScript: 'hant' })).toBe(
    '皇后與曹雪芹著作'
  );
});
