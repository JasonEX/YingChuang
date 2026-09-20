/**
 * RuleManager - Central rule management
 * Handles matching curated built-in rules
 */

import { ParsedSectionUrl, RuleMatchResult, SiteRule } from './types';
import { builtInRules as curatedBuiltInRules } from './builtInRules';

/** Glob to regex conversion */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Convert pattern string to RegExp */
function toRegExp(pattern: string, type: 'regex' | 'glob' = 'regex'): RegExp {
  if (type === 'glob') {
    return globToRegex(pattern);
  }
  return new RegExp(pattern, 'i');
}

export class RuleManager {
  private builtInRules: SiteRule[] = curatedBuiltInRules;
  private compiledCache = new WeakMap<SiteRule, { main: RegExp; excludes: RegExp[] }>();
  // Curated rules are static; collect only participating hooks once, not per link.
  private readonly sectionUrlParsers = this.builtInRules.flatMap(rule =>
    rule.hooks?.parseSectionUrl ? [rule.hooks.parseSectionUrl] : []
  );
  private readonly entryResolvers = this.builtInRules.flatMap(rule =>
    rule.hooks?.resolveEntryUrl ? [rule.hooks.resolveEntryUrl] : []
  );

  private readonly vipClassifiers = [
    ...new Set(
      this.builtInRules.flatMap(rule => (rule.hooks?.isVipChapter ? [rule.hooks.isVipChapter] : []))
    ),
  ];

  /** Only registered site checks run; each checks its URL before inspecting the document. */
  isVipChapter(doc: Document, url: string): boolean | null {
    for (const classify of this.vipClassifiers) {
      const result = classify(doc, url);
      if (result !== null) return result;
    }
    return null;
  }

  /** Synchronous so URL helpers and detectors can use the same site parser. */
  parseSectionUrl = (url: string): ParsedSectionUrl | null => {
    for (const parse of this.sectionUrlParsers) {
      const parsed = parse(url);
      if (parsed) return parsed;
    }
    return null;
  };

  /** Entry pages can sit outside chapter-rule matches; each hook checks its own URL. */
  resolveEntryUrl(doc: Document, url: string): string | null {
    for (const resolve of this.entryResolvers) {
      const resolved = resolve(doc, url);
      if (resolved) return resolved;
    }
    return null;
  }

  /**
   * Match a URL against curated built-in rules.
   */
  matchRule(url: string): RuleMatchResult | null {
    for (const rule of this.builtInRules) {
      if (this.matchesUrl(rule, url)) {
        return {
          rule,
          source: 'builtin',
          matchedPattern: rule.match.pattern,
        };
      }
    }

    return null;
  }

  /**
   * Get or compile and cache the RegExp objects for a rule.
   * Uses WeakMap so entries are GC'd when the rule object is no longer referenced.
   */
  private getCompiledRule(rule: SiteRule): { main: RegExp; excludes: RegExp[] } {
    const cached = this.compiledCache.get(rule);
    if (cached) return cached;

    const main = toRegExp(rule.match.pattern, rule.match.type);
    const excludes = (rule.match.exclude ?? []).map(e => new RegExp(e, 'i'));
    const compiled = { main, excludes };
    this.compiledCache.set(rule, compiled);
    return compiled;
  }

  /**
   * Check if a rule matches a URL
   */
  private matchesUrl(rule: SiteRule, url: string): boolean {
    try {
      const { main, excludes } = this.getCompiledRule(rule);
      if (!main.test(url)) return false;

      for (const exclude of excludes) {
        if (exclude.test(url)) {
          return false;
        }
      }

      return true;
    } catch (e) {
      console.debug('[RuleManager] Rule match error for pattern:', rule.match.pattern, e);
      return false;
    }
  }
}

// Singleton instance
let ruleManagerInstance: RuleManager | null = null;

/**
 * Get the singleton RuleManager instance
 */
export function getRuleManager(): RuleManager {
  if (!ruleManagerInstance) {
    ruleManagerInstance = new RuleManager();
  }
  return ruleManagerInstance;
}
