/**
 * Chinese Simplified/Traditional Converter
 * Keeps Simplified -> Traditional dependency-light while using OpenCC for
 * Traditional/variant/Japanese-shinjitai -> Simplified conversion.
 */

import { ConverterFactory, type ConverterFunction } from 'opencc-js/core';
import type { ChineseScript } from '@/core/converter/scriptProfile';
import cjkCompatibility from 'opencc-js/dict/CJK_Compatibility_Ideographs';
import { tify } from 'chinese-conv';
import traditionalCharacters from 'opencc-js/dict/TSCharacters';
import traditionalPhrases from 'opencc-js/dict/TSPhrases';
import traditionalToSimplified from 'opencc-js/to/cn';

export type ConversionMode = 'none' | 'sc' | 'tc';

export interface ConversionOptions {
  sourceScript?: ChineseScript;
}

let simplifiedConverter: ConverterFunction | null = null;
let mixedSimplifiedConverter: ConverterFunction | null = null;
let simplifiedSourceCharacters: Set<string> | null = null;

const japaneseVariantMap: Record<string, string> = {
  亜: '亚',
  仏: '佛',
  仮: '假',
  価: '价',
  児: '儿',
  円: '圆',
  剣: '剑',
  剤: '剂',
  労: '劳',
  単: '单',
  囲: '围',
  団: '团',
  図: '图',
  圧: '压',
  壊: '坏',
  実: '实',
  対: '对',
  専: '专',
  峡: '峡',
  巣: '巢',
  帯: '带',
  広: '广',
  弾: '弹',
  徳: '德',
  悪: '恶',
  応: '应',
  抜: '拔',
  拡: '扩',
  揺: '摇',
  桜: '樱',
  様: '样',
  権: '权',
  欧: '欧',
  歓: '欢',
  歩: '步',
  歳: '岁',
  殻: '壳',
  気: '气',
  沢: '泽',
  涙: '泪',
  渋: '涩',
  浜: '滨',
  満: '满',
  滝: '泷',
  焼: '烧',
  獣: '兽',
  発: '发',
  県: '县',
  絵: '绘',
  絶: '绝',
  継: '继',
  続: '续',
  緑: '绿',
  縄: '绳',
  総: '总',
  芸: '艺',
  薬: '药',
  蛍: '萤',
  説: '说',
  読: '读',
  転: '转',
  鉄: '铁',
  黒: '黑',
  竜: '龙',
};

const japaneseVariantPattern = new RegExp(`[${Object.keys(japaneseVariantMap).join('')}]`, 'g');

const protectedZhuWords = [
  '著作',
  '著名',
  '著称',
  '著書',
  '著书',
  '著述',
  '著錄',
  '著录',
  '著者',
  '著於',
  '著于',
  '著有',
  '著成',
  '著文',
  '名著',
  '原著',
  '巨著',
  '專著',
  '专著',
  '編著',
  '编著',
  '譯著',
  '译著',
  '合著',
  '拙著',
  '新著',
  '舊著',
  '旧著',
  '遺著',
  '遗著',
  '土著',
  '顯著',
  '显著',
  '卓著',
  '昭著',
  '較著',
  '较著',
  '見微知著',
  '见微知著',
  '臭名昭著',
  '彰明較著',
  '彰明较著',
];

function getSimplifiedConverter(preserveSimplified: boolean): ConverterFunction {
  if (preserveSimplified) {
    // Ambiguous phrase-only rewrites (沈默 → 沉默) are unsafe in mixed prose.
    // Keep rules containing actual source characters, including exceptions such as 乾坤.
    mixedSimplifiedConverter ??= ConverterFactory(
      [cjkCompatibility],
      [
        traditionalPhrases
          .split('|')
          .filter(entry => hasSimplifiedSourceCharacters(entry.split(' ')[0]))
          .join('|'),
        traditionalCharacters,
      ]
    );
    return mixedSimplifiedConverter;
  }
  // Match OpenCC's t2s chain: normalize compatibility ideographs before phrases/characters.
  // Keep the Japanese repairs below separate from the unused regional presets.
  simplifiedConverter ??= ConverterFactory([cjkCompatibility], ...traditionalToSimplified);
  return simplifiedConverter;
}

function normalizeJapaneseVariantsForSimplified(text: string): string {
  return text.replace(japaneseVariantPattern, char => japaneseVariantMap[char] || char);
}

function normalizeZheForSimplified(text: string): string {
  if (!text.includes('著')) return text;

  const placeholders: string[] = [];
  let converted = text;

  for (const word of protectedZhuWords) {
    if (!converted.includes(word)) continue;
    const token = `\uE000${placeholders.length}\uE001`;
    placeholders.push(word);
    converted = converted.split(word).join(token);
  }

  converted = converted.replace(/著/g, '着');

  return converted.replace(/\uE000(\d+)\uE001/g, (_, index: string) => placeholders[Number(index)]);
}

function getConverter(
  mode: Exclude<ConversionMode, 'none'>,
  options: ConversionOptions
): ConverterFunction {
  if (mode === 'sc') {
    const sourceScript = options.sourceScript || 'unknown';
    const converter = getSimplifiedConverter(
      sourceScript === 'unknown' || sourceScript === 'mixed'
    );
    return text =>
      normalizeZheForSimplified(normalizeJapaneseVariantsForSimplified(converter(text)));
  }
  return tify;
}

function hasSimplifiedSourceCharacters(text: string): boolean {
  if (!simplifiedSourceCharacters) {
    // Use the conversion dictionaries, not the small alphabet used for script inference.
    // This also covers compatibility ideographs and the Japanese repairs applied below.
    simplifiedSourceCharacters = new Set([...Object.keys(japaneseVariantMap), '著']);
    for (const dictionary of [traditionalCharacters, cjkCompatibility]) {
      for (const entry of dictionary.split('|')) {
        const [source, target] = entry.split(' ');
        if (source !== target) simplifiedSourceCharacters.add(source);
      }
    }
  }
  for (const char of text) {
    if (simplifiedSourceCharacters.has(char)) return true;
  }
  return false;
}

function shouldSkipConversion(
  text: string,
  mode: Exclude<ConversionMode, 'none'>,
  options: ConversionOptions
): boolean {
  const sourceScript = options.sourceScript || 'unknown';

  if (mode === 'sc') {
    if (sourceScript === 'hans') return true;
    if (sourceScript === 'hant' || sourceScript === 'jpan') return false;
    // Phrase rules can change already-Simplified names such as 沈默.
    return !hasSimplifiedSourceCharacters(text);
  }
  return sourceScript === 'hant';
}

/**
 * Convert plain text between Simplified/Traditional
 */
export async function convertText(
  text: string,
  mode: ConversionMode,
  options: ConversionOptions = {}
): Promise<string> {
  if (mode === 'none' || !text) {
    return text;
  }

  if (shouldSkipConversion(text, mode, options)) {
    return text;
  }

  try {
    const converter = getConverter(mode, options);
    return converter(text);
  } catch (error) {
    console.error('[ChineseConverter] Text conversion error:', error);
    return text;
  }
}

/**
 * Convert HTML content while preserving tags
 * This converts only text nodes, keeping HTML structure intact
 */
export async function convertHTML(
  html: string,
  mode: ConversionMode,
  options: ConversionOptions = {}
): Promise<string> {
  if (mode === 'none' || !html) {
    return html;
  }

  if (shouldSkipConversion(html, mode, options)) {
    return html;
  }

  try {
    const converter = getConverter(mode, options);

    // Parse HTML and convert text nodes only
    const template = document.createElement('template');
    template.innerHTML = html;

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, null);

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    // Convert all text nodes
    for (const textNode of textNodes) {
      if (textNode.textContent && !shouldSkipConversion(textNode.textContent, mode, options)) {
        textNode.textContent = converter(textNode.textContent);
      }
    }

    return template.innerHTML;
  } catch (error) {
    console.error('[ChineseConverter] HTML conversion error:', error);
    return html;
  }
}
