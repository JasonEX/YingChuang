/**
 * RuleManager - Central rule management
 * Handles matching curated built-in rules
 */

import { ParsedSectionUrl, RuleMatchResult, SectionUrlShape, SiteRule } from './types';
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
  private initialized: boolean = false;
  private compiledCache = new WeakMap<SiteRule, { main: RegExp; excludes: RegExp[] }>();
  private sectionUrlCache = new WeakMap<SectionUrlShape, RegExp>();

  /**
   * Initialize the rule manager
   * Reserved for future async built-in rule setup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Parse a section (multi-page chapter) URL using the shape its site declared.
   *
   * Synchronous on purpose: the generic URL helpers that need it cannot await. Only rules that
   * declare `advanced.sectionUrl` are consulted, so this is a no-op for nearly every site.
   */
  parseSectionUrl = (url: string): ParsedSectionUrl | null => {
    for (const rule of this.builtInRules) {
      const shape = rule.advanced?.sectionUrl;
      if (!shape) continue;

      let match: RegExpExecArray | null;
      try {
        match = this.compileSectionUrl(shape).exec(url);
      } catch {
        continue;
      }
      if (!match) continue;

      try {
        const parsed = new URL(url);
        parsed.pathname = shape.chapterPath.replace(
          /\$(\d)/g,
          (_, group: string) => match![Number(group)] ?? ''
        );
        parsed.hash = '';
        return { chapterUrl: parsed.href, page: Number(match[shape.pageGroup] || 1) };
      } catch {
        return null;
      }
    }
    return null;
  };

  private compileSectionUrl(shape: SectionUrlShape): RegExp {
    const cached = this.sectionUrlCache.get(shape);
    if (cached) return cached;
    const compiled = new RegExp(shape.pattern);
    this.sectionUrlCache.set(shape, compiled);
    return compiled;
  }

  /**
   * Ask any rule that declares an entry resolver to redirect a non-chapter landing page
   * to the chapter that should actually be read. Returns null when none recognises the URL.
   */
  resolveEntryUrl(doc: Document, url: string): string | null {
    for (const rule of this.builtInRules) {
      const resolve = rule.hooks?.resolveEntryUrl;
      if (!resolve) continue;
      try {
        const resolved = resolve(doc, url);
        if (resolved) return resolved;
      } catch (e) {
        console.debug('[RuleManager] resolveEntryUrl hook failed:', e);
      }
    }
    return null;
  }

  /**
   * Match a URL against curated built-in rules.
   */
  async matchRule(url: string): Promise<RuleMatchResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

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
