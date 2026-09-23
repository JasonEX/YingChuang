/**
 * Reading display conversion. Simplification is independent of page-language guesses:
 * the same original text must survive incremental loading and full-chapter replay.
 */
import { ConverterFactory, type ConverterFunction } from 'opencc-js/core';
import type { ChineseScript } from '@/core/converter/scriptProfile';
import cjkCompatibility from 'opencc-js/dict/CJK_Compatibility_Ideographs';
import { tify } from 'chinese-conv';
import traditionalCharacters from 'opencc-js/dict/TSCharacters';
import traditionalPhrases from 'opencc-js/dict/TSPhrases';

export type ConversionMode = 'none' | 'sc' | 'tc';

export interface ConversionOptions {
  /** Used only by the existing Traditional-mode protection. */
  sourceScript?: ChineseScript;
}

let simplifiedConverter: ConverterFunction | null = null;

function getSimplifiedConverter(): ConverterFunction {
  if (!simplifiedConverter) {
    const sourceCharacters = new Set(
      traditionalCharacters.split('|').flatMap(entry => {
        const [source, target] = entry.split(' ');
        return source === target ? [] : [source];
      })
    );
    // Retain spelling exceptions (乾坤, 乾佑縣), but never let a phrase rewrite a
    // character outside the character dictionary (沈默 → 沉默, 憑藉 → 凭借).
    // This is a display conversion, not vocabulary or proper-name normalization.
    const phrases = traditionalPhrases.split('|').filter(entry => {
      const [source, target] = entry.split(' ');
      const from = [...source];
      const to = [...target];
      return (
        from.length === to.length &&
        from.every((char, index) => char === to[index] || sourceCharacters.has(char))
      );
    });
    // Already-simplified exceptions must be stable too (乾佑县 must not become 干佑县).
    const preservedTargets = phrases
      .map(entry => entry.split(' ')[1])
      .filter(target => [...target].some(char => sourceCharacters.has(char)))
      .map(target => `${target} ${target}`);
    simplifiedConverter = ConverterFactory(
      [cjkCompatibility],
      [[...phrases, ...preservedTargets].join('|'), traditionalCharacters]
    );
  }
  return simplifiedConverter;
}

function shouldSkipConversion(mode: ConversionMode, options: ConversionOptions): boolean {
  return mode === 'none' || (mode === 'tc' && options.sourceScript === 'hant');
}

/** Conversion always starts from the reader's original text, never another display mode. */
export async function convertText(
  text: string,
  mode: ConversionMode,
  options: ConversionOptions = {}
): Promise<string> {
  if (!text || shouldSkipConversion(mode, options)) return text;
  try {
    return mode === 'sc' ? getSimplifiedConverter()(text) : tify(text);
  } catch (error) {
    console.error('[ChineseConverter] Text conversion error:', error);
    return text;
  }
}

/** Preserve attributes and markup; only text nodes participate in display conversion. */
export async function convertHTML(
  html: string,
  mode: ConversionMode,
  options: ConversionOptions = {}
): Promise<string> {
  if (!html || shouldSkipConversion(mode, options)) return html;
  try {
    const converter = mode === 'sc' ? getSimplifiedConverter() : tify;
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let changed = false;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.data;
      const converted = converter(text);
      if (converted !== text) {
        node.data = converted;
        changed = true;
      }
    }
    return changed ? template.innerHTML : html;
  } catch (error) {
    console.error('[ChineseConverter] HTML conversion error:', error);
    return html;
  }
}
