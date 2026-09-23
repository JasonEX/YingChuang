import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RuleMatchResult, SiteRule } from '@/core/rules/types';
import { RuleManager } from '@/core/rules/RuleManager';

describe('RuleManager', () => {
  const makeRule = (overrides: Partial<SiteRule>): SiteRule => ({
    id: overrides.id || 'r1',
    name: overrides.name,
    version: overrides.version ?? 1,
    match: overrides.match || { pattern: '.*', type: 'regex' },
    content: overrides.content || { selector: '#content' },
    meta: overrides.meta ?? { source: 'builtin' },
    navigation: overrides.navigation,
    title: overrides.title,
    processing: overrides.processing,
    advanced: overrides.advanced,
    hooks: overrides.hooks,
    toc: overrides.toc,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches built-in rules', async () => {
    const manager = new RuleManager();
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [
      makeRule({
        id: 'builtin',
        match: { pattern: 'builtin\\.com', type: 'regex' },
      }),
    ];

    const matched = manager.matchRule('https://builtin.com/1');
    expect(matched).toMatchObject({
      source: 'builtin',
      matchedPattern: 'builtin\\.com',
      rule: { id: 'builtin' },
    });
  });

  it('supports glob matchers and exclude patterns', async () => {
    const manager = new RuleManager();
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [
      makeRule({
        id: 'glob',
        match: { pattern: 'https://*.example.com/*', type: 'glob', exclude: ['skip'] },
      }),
    ];

    expect(manager.matchRule('https://a.example.com/skip')).toBeNull();

    const matched = manager.matchRule('https://a.example.com/chapter/1');
    expect(matched?.rule.id).toBe('glob');
  });

  it('skips invalid rules without throwing', async () => {
    const manager = new RuleManager();
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [
      makeRule({ id: 'bad', match: { pattern: '[', type: 'regex' } }),
    ];

    expect(manager.matchRule('https://example.com/1')).toBeNull();
  });

  it('returns null for malformed URLs without throwing', async () => {
    const manager = new RuleManager();
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [];

    const result: RuleMatchResult | null = manager.matchRule('not a url');
    expect(result).toBeNull();
  });

  it('caches compiled regexps and does not recompile on repeated matches', async () => {
    const manager = new RuleManager();

    const rule = makeRule({
      id: 'cached',
      match: { pattern: 'cached\\.com', type: 'regex', exclude: ['skip'] },
    });
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [rule];

    const r1 = manager.matchRule('https://cached.com/1');
    expect(r1?.rule.id).toBe('cached');

    const compiledCache = (
      manager as unknown as {
        compiledCache: WeakMap<SiteRule, { main: RegExp; excludes: RegExp[] }>;
      }
    ).compiledCache;
    const entry1 = compiledCache.get(rule);
    expect(entry1).toBeDefined();

    const r2 = manager.matchRule('https://cached.com/2');
    expect(r2?.rule.id).toBe('cached');
    const entry2 = compiledCache.get(rule);
    expect(entry2).toBe(entry1);
  });

  it('invalid regex in exclude list is caught during compilation and does not throw', async () => {
    const manager = new RuleManager();
    (manager as unknown as { builtInRules: SiteRule[] }).builtInRules = [
      makeRule({
        id: 'bad-exclude',
        match: { pattern: 'example\\.com', type: 'regex', exclude: ['['] },
      }),
    ];

    expect(manager.matchRule('https://example.com/1')).toBeNull();
  });
});
