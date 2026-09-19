import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JSDOM } from 'jsdom';
import type { ProtectionOptions } from '@/core/protection';

type MockedSiteProtection = {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  removeOverlays: ReturnType<typeof vi.fn>;
};

type MockedRuleStorage = {
  getSitePreference: ReturnType<typeof vi.fn>;
  setSitePreference: ReturnType<typeof vi.fn>;
};

type MockedRuleManager = {
  initialize: ReturnType<typeof vi.fn>;
  matchRule: ReturnType<typeof vi.fn>;
};

type MockedSectionMerger = {
  merge: ReturnType<typeof vi.fn>;
};

const mockedRuleStorage: MockedRuleStorage = {
  getSitePreference: vi.fn(),
  setSitePreference: vi.fn(),
};

const mockedRuleManager: MockedRuleManager = {
  initialize: vi.fn(async () => {}),
  matchRule: vi.fn(async () => null),
};

const mockedProtection: MockedSiteProtection = {
  activate: vi.fn(),
  deactivate: vi.fn(),
  removeOverlays: vi.fn(),
};

const mockedSectionMerger: MockedSectionMerger = {
  merge: vi.fn(),
};

class MockDetectionEngine {
  quickCheck = vi.fn(() => true);
  detect = vi.fn(() => ({
    results: {},
    confidence: { overall: 0.7, reasons: ['mocked'] },
  }));
}

vi.mock('@/core/rules/RuleStorage', () => ({
  getRuleStorage: () => mockedRuleStorage,
}));

vi.mock('@/core/rules/RuleManager', () => ({
  getRuleManager: () => mockedRuleManager,
}));

vi.mock('@/core/protection', () => ({
  getSiteProtection: () => mockedProtection,
  isCloudflareChallenge: vi.fn(() => false),
}));

vi.mock('@/core/auto-enable/SectionMerger', () => ({
  createSectionMerger: () => mockedSectionMerger,
}));

vi.mock('@/core/detection', async importOriginal => ({
  ...(await importOriginal<typeof import('@/core/detection')>()),
  DetectionEngine: MockDetectionEngine,
}));

vi.mock('@/core/parser', () => ({
  Parser: class {
    constructor(_options?: unknown) {}
  },
}));

describe('AutoEnableManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedRuleStorage.getSitePreference.mockReturnValue(null);
    mockedRuleStorage.setSitePreference.mockImplementation(() => {});

    mockedRuleManager.initialize.mockResolvedValue(undefined);
    mockedRuleManager.matchRule.mockResolvedValue(null);

    mockedProtection.activate.mockImplementation(() => {});
    mockedProtection.deactivate.mockImplementation(() => {});
    mockedProtection.removeOverlays.mockImplementation(() => {});

    mockedSectionMerger.merge.mockResolvedValue({
      title: 'Chapter 1',
      content: '<p>content</p>',
      rawContent: '<p>raw</p>',
      url: 'https://example.com/chapter/1',
      prevUrl: null,
      nextUrl: null,
      indexUrl: null,
      confidence: 1,
      method: 'rule',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createDoc = (url = 'https://example.com/chapter/1') => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    return dom.window.document;
  };

  it('returns user-disabled decision and still shows floating button', async () => {
    mockedRuleStorage.getSitePreference.mockReturnValue({ enabled: false, timestamp: Date.now() });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: false,
      method: 'user-disabled',
      showManualEntry: true,
    });
  });

  it('does not auto-enable on a locked chapter document', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();
    const doc = createDoc('https://example.com/chapter/2');
    doc.body.innerHTML = '<main>预览正文</main><p>登录订阅本章: 16点</p>';

    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: false,
      method: 'manual',
      confidence: 0,
    });
    expect(decision.reasons.join(' ')).toContain('VIP/付费章节');
    expect(mockedRuleManager.initialize).not.toHaveBeenCalled();
  });

  it('returns site-preference decision when user enabled auto-enable for the site', async () => {
    mockedRuleStorage.getSitePreference.mockReturnValue({ enabled: true, timestamp: Date.now() });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: true,
      method: 'site-preference',
      confidence: 1,
    });

    expect(mockedRuleManager.initialize).not.toHaveBeenCalled();
  });

  it('skips auto-enable on toc pages even if the site preference is disabled', async () => {
    mockedRuleStorage.getSitePreference.mockReturnValue({ enabled: false, timestamp: Date.now() });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/book/1');
    doc.title = '章节目录 - 示例小说';

    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: false,
      method: 'manual',
    });
    expect(decision.showManualEntry).not.toBe(true);
  });

  it('skips URLs matching skip patterns', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ skipPatterns: [/skip/i] });

    const doc = createDoc('https://example.com/skip');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: false,
      method: 'manual',
    });
    expect(decision.reasons.join(' ')).toContain('skip');
  });

  it('returns manual decision when quickCheck fails', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const m = manager as unknown as { detectionEngine: MockDetectionEngine };
    m.detectionEngine.quickCheck.mockReturnValue(false);

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: false,
      method: 'manual',
    });
  });

  it('treats every explicit rule match as a built-in rule decision', async () => {
    mockedRuleManager.matchRule.mockResolvedValue({
      rule: {
        id: 'builtin',
        match: { pattern: 'example', type: 'regex' },
        meta: { source: 'builtin' },
      },
      source: 'builtin',
      matchedPattern: 'example',
    });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: true,
      method: 'builtin-rule',
      confidence: 1,
    });
  });

  it('returns builtin-rule decision when rule match is not from user', async () => {
    mockedRuleManager.matchRule.mockResolvedValue({
      rule: {
        id: 'builtin',
        match: { pattern: 'example', type: 'regex' },
        meta: { source: 'builtin' },
      },
      source: 'builtin',
      matchedPattern: 'example',
    });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: true,
      method: 'builtin-rule',
      confidence: 1,
    });
  });

  it('allows explicit rules to override ambiguous page-kind detection', async () => {
    mockedRuleManager.matchRule.mockResolvedValue({
      rule: {
        id: 'paged-section',
        match: { pattern: 'example', type: 'regex' },
        meta: { source: 'builtin' },
      },
      source: 'builtin',
      matchedPattern: 'example',
    });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/24/18442_6.html');
    const decision = await manager.check(doc);

    expect(decision).toMatchObject({
      shouldEnable: true,
      method: 'builtin-rule',
      confidence: 1,
    });
    expect(mockedRuleManager.matchRule).toHaveBeenCalledWith('https://example.com/24/18442_6.html');
  });

  it('getDecision returns the last decision and reset clears it', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager();

    const doc = createDoc('https://example.com/chapter/1');
    const decision = await manager.check(doc);

    expect(manager.getDecision()).toEqual(decision);

    manager.reset();
    expect(manager.getDecision()).toBeUndefined();
  });

  it('execute returns early when shouldEnable is false', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ skipPatterns: [/./] });

    const promptCallback = vi.fn();
    const launchCallback = vi.fn();
    manager.setPromptCallback(promptCallback);
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/anything');
    await manager.execute(doc);

    expect(promptCallback).not.toHaveBeenCalled();
    expect(launchCallback).not.toHaveBeenCalled();
  });

  it('execute runs only once per instance', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ skipPatterns: [/./] });

    const checkSpy = vi.spyOn(manager, 'check');

    const doc = createDoc('https://example.com/anything');
    await manager.execute(doc);
    await manager.execute(doc);

    expect(checkSpy).toHaveBeenCalledTimes(1);
  });

  it('execute auto-launches on rule match and activates protection', async () => {
    mockedRuleManager.matchRule.mockResolvedValue({
      rule: {
        id: 'builtin',
        match: { pattern: 'example', type: 'regex' },
        meta: { source: 'builtin' },
      },
      source: 'builtin',
      matchedPattern: 'example',
    });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: true });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.execute(doc);

    expect(mockedProtection.activate).toHaveBeenCalledTimes(1);
    expect(mockedProtection.removeOverlays).not.toHaveBeenCalled();
    expect(mockedSectionMerger.merge).toHaveBeenCalledTimes(1);
    expect(launchCallback).toHaveBeenCalledTimes(1);
  });

  it('launches a progressive first page before replacing it with the merged chapter', async () => {
    const rule = {
      id: 'progressive',
      version: 1,
      match: { pattern: 'example' },
      content: { selector: '#content' },
      advanced: { checkSection: true, progressiveSectionMerge: true },
      meta: { source: 'builtin' as const },
    };
    const firstPage = {
      title: 'Chapter 1',
      content: '<p>first</p>',
      rawContent: '<p>first</p>',
      url: 'https://example.com/chapter/1',
      confidence: 1,
      method: 'rule' as const,
      rule,
    };
    const merged = { ...firstPage, content: '<p>first</p><p>second</p>' };
    mockedRuleManager.matchRule.mockResolvedValue({
      rule,
      source: 'builtin',
      matchedPattern: 'example',
    });
    mockedSectionMerger.merge.mockImplementationOnce(
      async (
        _doc: Document,
        _url: string,
        options: { onFirstPage?: (chapter: typeof firstPage) => void }
      ) => {
        options.onFirstPage?.(firstPage);
        return merged;
      }
    );

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });
    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    await manager.execute(createDoc('https://example.com/chapter/1'));

    expect(launchCallback).toHaveBeenNthCalledWith(1, firstPage, rule, 'initial');
    expect(launchCallback).toHaveBeenNthCalledWith(2, merged, rule, 'update');
  });

  it('execute prompts, remembers site preference, then launches for medium-confidence detection', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({
      confidenceThreshold: 0.6,
      autoLaunchThreshold: 0.9,
      enableProtection: false,
    });

    const m = manager as unknown as { detectionEngine: MockDetectionEngine };
    const detectionResult = {
      results: { mocked: true },
      confidence: { overall: 0.7, reasons: ['ok'] },
    };
    m.detectionEngine.detect.mockReturnValue(detectionResult);

    const promptCallback = vi.fn(async () => ({ accepted: true, rememberForSite: true }));
    const launchCallback = vi.fn();
    manager.setPromptCallback(promptCallback);
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.execute(doc);

    expect(promptCallback).toHaveBeenCalledTimes(1);
    expect(mockedSectionMerger.merge).toHaveBeenCalledTimes(1);
    expect(mockedRuleStorage.setSitePreference).toHaveBeenCalledWith('example.com', {
      enabled: true,
      timestamp: expect.any(Number),
    });
    expect(launchCallback).toHaveBeenCalledTimes(1);
  });

  it('keeps protection inactive when the prompt is declined', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: true });
    const detectionEngine = manager as unknown as { detectionEngine: MockDetectionEngine };
    detectionEngine.detectionEngine.detect.mockReturnValue({
      results: {},
      confidence: { overall: 0.7, reasons: ['ok'] },
    });

    manager.setPromptCallback(vi.fn(async () => ({ accepted: false, rememberForSite: false })));
    manager.setLaunchCallback(vi.fn());

    await manager.execute(createDoc('https://example.com/chapter/1'));

    expect(mockedProtection.activate).not.toHaveBeenCalled();
    expect(mockedProtection.deactivate).toHaveBeenCalledTimes(1);
    expect(mockedSectionMerger.merge).not.toHaveBeenCalled();
  });

  it('logs and swallows launch errors', async () => {
    mockedSectionMerger.merge.mockRejectedValueOnce(new Error('boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });

    const m = manager as unknown as { detectionEngine: MockDetectionEngine };
    m.detectionEngine.detect.mockReturnValue({
      results: {},
      confidence: { overall: 1.0, reasons: ['ok'] },
    });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.execute(doc);

    expect(errorSpy).toHaveBeenCalled();
    expect(launchCallback).not.toHaveBeenCalled();
  });

  it('manualEnable does not persist site preference for invalid URLs', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = { location: { href: 'not a url' } } as unknown as Document;
    await manager.manualEnable(doc);

    expect(mockedRuleStorage.setSitePreference).not.toHaveBeenCalled();
    expect(launchCallback).toHaveBeenCalledTimes(1);
  });

  it('manualEnable activates protection and launches when merge succeeds', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: true });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.manualEnable(doc);

    expect(mockedProtection.activate).toHaveBeenCalledTimes(1);
    expect(mockedProtection.removeOverlays).not.toHaveBeenCalled();
    expect(mockedSectionMerger.merge).toHaveBeenCalledTimes(1);
    expect(launchCallback).toHaveBeenCalledTimes(1);
  });

  it('removes page overlays only in aggressive (cleanupScripts) mode', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({
      enableProtection: true,
      protectionOptions: { cleanupScripts: true },
    });
    manager.setLaunchCallback(vi.fn());

    await manager.manualEnable(createDoc('https://example.com/chapter/1'));

    expect(mockedProtection.removeOverlays).toHaveBeenCalledTimes(1);
  });

  it('manualEnable remembers an unset site preference', async () => {
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });
    manager.setLaunchCallback(vi.fn());

    await manager.manualEnable(createDoc('https://example.com/chapter/1'));

    expect(mockedRuleStorage.setSitePreference).toHaveBeenCalledWith('example.com', {
      enabled: true,
      timestamp: expect.any(Number),
    });
  });

  it('manualEnable keeps an explicit site opt-out', async () => {
    mockedRuleStorage.getSitePreference.mockReturnValue({ enabled: false, timestamp: 1 });
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });
    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    await manager.manualEnable(createDoc('https://example.com/chapter/1'));

    expect(launchCallback).toHaveBeenCalledTimes(1);
    expect(mockedRuleStorage.setSitePreference).not.toHaveBeenCalled();
  });

  it('manualEnable does not parse or launch a locked chapter document', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: true });
    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);
    const doc = createDoc('https://example.com/chapter/2');
    doc.body.innerHTML = '<main>预览正文</main><p>登录订阅本章: 16点</p>';

    await manager.manualEnable(doc);

    expect(mockedProtection.activate).not.toHaveBeenCalled();
    expect(mockedSectionMerger.merge).not.toHaveBeenCalled();
    expect(launchCallback).not.toHaveBeenCalled();
    expect(mockedProtection.deactivate).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('[AutoEnableManager] Manual enable skipped: vip');
  });

  it('manualEnable passes the parsed rule to the launch callback', async () => {
    const rule = {
      id: 'iframe-rule',
      version: 1,
      match: { pattern: 'example' },
      content: { selector: '#content' },
      advanced: { useIframe: true },
      meta: { source: 'builtin' as const },
    };
    mockedSectionMerger.merge.mockResolvedValueOnce({
      title: 'Chapter 1',
      content: '<p>content</p>',
      rawContent: '<p>raw</p>',
      url: 'https://example.com/chapter/1',
      prevUrl: null,
      nextUrl: null,
      indexUrl: null,
      confidence: 1,
      method: 'rule',
      rule,
    });

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.manualEnable(doc);

    expect(launchCallback).toHaveBeenCalledWith(
      expect.objectContaining({ rule }),
      rule,
      'complete'
    );
  });

  it('manualEnable logs and swallows merge errors', async () => {
    mockedSectionMerger.merge.mockRejectedValueOnce(new Error('merge failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: false });

    const launchCallback = vi.fn();
    manager.setLaunchCallback(launchCallback);

    const doc = createDoc('https://example.com/chapter/1');
    await manager.manualEnable(doc);

    expect(errorSpy).toHaveBeenCalled();
    expect(launchCallback).not.toHaveBeenCalled();
  });

  it('deactivates protection when manual parsing fails', async () => {
    mockedSectionMerger.merge.mockResolvedValueOnce(null);

    const { AutoEnableManager } = await import('@/core/AutoEnableManager');
    const manager = new AutoEnableManager({ enableProtection: true });
    manager.setLaunchCallback(vi.fn());

    await manager.manualEnable(createDoc('https://example.com/chapter/1'));

    expect(mockedProtection.activate).toHaveBeenCalledTimes(1);
    expect(mockedProtection.deactivate).toHaveBeenCalledTimes(1);
  });
});

describe('getAutoEnableManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('updates options when called with options after singleton created', async () => {
    vi.clearAllMocks();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getAutoEnableManager } = await import('@/core/AutoEnableManager');

    const options1: ProtectionOptions = { blockRedirects: false };
    const manager = getAutoEnableManager({
      enableProtection: true,
      protectionOptions: options1,
    });
    manager.setLaunchCallback(vi.fn());

    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/1',
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);

    await manager.manualEnable(dom.window.document);
    expect(mockedProtection.activate).toHaveBeenLastCalledWith(options1);

    const options2: ProtectionOptions = { blockRedirects: true };
    getAutoEnableManager({ enableProtection: true, protectionOptions: options2 });
    await manager.manualEnable(dom.window.document);
    expect(mockedProtection.activate).toHaveBeenLastCalledWith(options2);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
