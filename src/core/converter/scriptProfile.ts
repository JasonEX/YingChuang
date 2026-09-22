export type ChineseScript = 'hans' | 'hant' | 'jpan' | 'mixed' | 'unknown';

const TEXT_SAMPLE_LIMIT = 12000;
const HANS_MARKERS =
  '体台湾万与书说话网个们这为来会国时后对开关无点风云电长门问间从学见让读听觉发现经过还进远连当应义实战区马龙鸟鱼猫坏搁';
const HANT_MARKERS =
  '體臺灣萬與書說話網個們這為來會國時後對開關無點風雲電長門問間從學見讓讀聽覺發現經過還進遠連當應義實戰區馬龍鳥魚貓壞漢聯續乾廣';
const JPAN_MARKERS =
  '亜仏仮価児円剣剤労単囲団図壊実対専巣帯広弾悪応抜拡揺桜様権歓歩歳気沢涙渋浜満滝焼獣発県絵絶継続緑縄総芸薬蛍説読転鉄黒竜';

const HANS_PATTERN = new RegExp(`[${HANS_MARKERS}]`, 'g');
const HANT_PATTERN = new RegExp(`[${HANT_MARKERS}]`, 'g');
const JPAN_PATTERN = new RegExp(`[${JPAN_MARKERS}]`, 'g');

function scriptFromLocale(locale: string): ChineseScript {
  const tag = locale.trim().toLowerCase().replace(/_/g, '-').split(';')[0];
  if (!tag) return 'unknown';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'jpan';
  if (tag.includes('hans') || /^zh-(?:cn|sg|my)(?:-|$)/.test(tag)) return 'hans';
  if (tag.includes('hant') || /^zh-(?:tw|hk|mo)(?:-|$)/.test(tag)) return 'hant';
  return 'unknown';
}

function mergeScript(current: ChineseScript, next: ChineseScript): ChineseScript {
  if (next === 'unknown') return current;
  if (current === 'unknown') return next;
  return current === next ? current : 'mixed';
}

function readLocaleHints(doc: Document): string[] {
  const hints = [
    doc.documentElement?.getAttribute('lang') || '',
    doc.documentElement?.getAttribute('xml:lang') || '',
  ];

  for (const meta of Array.from(doc.querySelectorAll('meta'))) {
    const content = meta.getAttribute('content')?.trim();
    if (!content) continue;
    const key = `${meta.getAttribute('http-equiv') || ''} ${meta.getAttribute('name') || ''} ${
      meta.getAttribute('property') || ''
    }`.toLowerCase();
    if (key.includes('content-language') || key.includes('og:locale')) {
      hints.push(...content.split(','));
    }
  }

  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const text = script.textContent || '';
    const matches = text.matchAll(/"inLanguage"\s*:\s*"([^"]+)"/gi);
    for (const match of matches) {
      hints.push(match[1] || '');
    }
  }

  return hints;
}

function countMatches(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text)) count += 1;
  return count;
}

export function detectChineseScriptFromText(text: string): ChineseScript {
  const sample = text.slice(0, TEXT_SAMPLE_LIMIT);
  if (!sample) return 'unknown';

  const scores: Array<[ChineseScript, number]> = [
    ['hans', countMatches(sample, HANS_PATTERN)],
    ['hant', countMatches(sample, HANT_PATTERN)],
    ['jpan', countMatches(sample, JPAN_PATTERN)],
  ];
  const max = Math.max(...scores.map(([, score]) => score));
  if (max === 0) return 'unknown';

  return scores.reduce<ChineseScript>(
    (script, [candidate, score]) => (score >= max * 0.5 ? mergeScript(script, candidate) : script),
    'unknown'
  );
}

export function inferChineseScript(doc: Document, contentText = ''): ChineseScript {
  let script: ChineseScript = 'unknown';
  for (const hint of readLocaleHints(doc)) {
    script = mergeScript(script, scriptFromLocale(hint));
  }
  if (script !== 'unknown') return script;

  return detectChineseScriptFromText(contentText || doc.body?.textContent || '');
}
