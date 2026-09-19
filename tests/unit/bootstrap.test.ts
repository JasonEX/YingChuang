import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let configStore: {
  load: () => Promise<void>;
  flushSave: () => Promise<void>;
  updateProtection: (settings: { mode: 'standard' | 'aggressive' }) => void;
  protection: {
    blockRedirects: boolean;
    enableRightClick: boolean;
    enableSelection: boolean;
    blockPopups: boolean;
    mode: 'standard' | 'aggressive';
  };
};
let readerStore: {
  activate: () => void;
  deactivate: () => void;
  setChapter: (chapter: { url?: string }, rule?: unknown) => void;
  updateChapter: (chapter: { url?: string }, rule?: unknown) => boolean;
  showToast: (message: string, type?: 'info' | 'error') => void;
  currentChapterIndex: number;
  chapters: Array<{ chapter: { url?: string } }>;
};

const {
  mockActivateProtection,
  mockDeactivateProtection,
  mockGetAutoEnableManager,
  mockGetRuleManager,
  mockGetSitePreference,
  mockRemoveOverlays,
  mockSetSitePreference,
} = vi.hoisted(() => ({
  mockActivateProtection: vi.fn(),
  mockDeactivateProtection: vi.fn(),
  mockGetAutoEnableManager: vi.fn(),
  mockGetRuleManager: vi.fn(),
  mockGetSitePreference: vi.fn(),
  mockRemoveOverlays: vi.fn(),
  mockSetSitePreference: vi.fn(),
}));

vi.mock('@/core/AutoEnableManager', () => ({
  getAutoEnableManager: (opts: unknown) => mockGetAutoEnableManager(opts),
}));

vi.mock('@/core/rules/RuleManager', () => ({
  getRuleManager: () => mockGetRuleManager(),
}));

vi.mock('@/core/protection', () => ({
  getSiteProtection: () => ({
    activate: mockActivateProtection,
    deactivate: mockDeactivateProtection,
    removeOverlays: mockRemoveOverlays,
  }),
}));

vi.mock('@/core/rules/RuleStorage', () => ({
  getRuleStorage: () => ({
    getSitePreference: mockGetSitePreference,
    setSitePreference: mockSetSitePreference,
  }),
}));

vi.mock('@/ui/stores/config', () => ({
  toProtectionOptions: (protection: unknown) => protection,
  useConfigStore: () => configStore,
}));

vi.mock('@/ui/stores/reader', () => ({
  useReaderStore: () => readerStore,
}));

vi.mock('@/ui/components/reader', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    ReaderView: defineComponent({
      name: 'ReaderViewStub',
      props: {
        onProtectionModeChange: { type: Function, required: false },
      },
      setup(props) {
        return () =>
          h('div', { id: 'reader-view-stub' }, [
            h(
              'button',
              {
                id: 'protection-mode-trigger',
                onClick: () => props.onProtectionModeChange?.('aggressive'),
              },
              'aggressive'
            ),
          ]);
      },
    }),
  };
});

vi.mock('@/ui/components/entry', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    ReaderEntryPrompt: defineComponent({
      name: 'ReaderEntryPromptStub',
      emits: ['respond'],
      setup(_props, { emit }) {
        Promise.resolve().then(() => {
          emit('respond', { accepted: true, rememberForSite: false });
        });
        return () => null;
      },
    }),
    ReaderEntryButton: defineComponent({
      name: 'ReaderEntryButtonStub',
      emits: ['enter'],
      setup(_props, { emit }) {
        return () =>
          h('button', { id: 'mnr-entry-button', onClick: () => emit('enter') }, '进入阅读模式');
      },
    }),
  };
});

describe('bootstrap', () => {
  let dom: JSDOM;
  let tabState: Record<string, unknown>;

  async function loadExitDestination(): Promise<typeof import('@/bootstrap')> {
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
    const bootstrap = await import('@/bootstrap');
    await vi.waitFor(() => expect(document.getElementById('mnr-entry-root')).not.toBeNull());
    return bootstrap;
  }

  beforeEach(() => {
    vi.resetModules();
    tabState = {};
    vi.stubGlobal(
      'GM_getTab',
      vi.fn(callback => queueMicrotask(() => callback(tabState)))
    );
    vi.stubGlobal('GM_saveTab', vi.fn());
    mockActivateProtection.mockReset();
    mockDeactivateProtection.mockReset();
    mockGetAutoEnableManager.mockReset();
    mockGetRuleManager.mockReset();
    mockGetSitePreference.mockReset();
    mockRemoveOverlays.mockReset();
    mockSetSitePreference.mockReset();
    mockGetRuleManager.mockReturnValue({
      initialize: vi.fn(async () => {}),
      matchRule: vi.fn(async () => null),
    });

    configStore = {
      load: vi.fn(async () => {}),
      flushSave: vi.fn(async () => {}),
      updateProtection: vi.fn(settings => {
        configStore.protection = { ...configStore.protection, ...settings };
      }),
      protection: {
        blockRedirects: true,
        enableRightClick: false,
        enableSelection: false,
        blockPopups: true,
        mode: 'standard',
      },
    };
    readerStore = {
      activate: vi.fn(),
      deactivate: vi.fn(),
      setChapter: vi.fn((chapter: { url?: string }) => {
        readerStore.chapters = [{ chapter: { url: chapter.url } }];
        readerStore.currentChapterIndex = 0;
      }),
      updateChapter: vi.fn(() => true),
      showToast: vi.fn(),
      currentChapterIndex: 0,
      chapters: [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('activates early protection for chapter-like URLs (conservative)', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/12345.html',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    await import('@/bootstrap');

    expect(mockActivateProtection).toHaveBeenCalledWith(
      expect.objectContaining({
        blockRedirects: true,
        blockPopups: true,
        clearTimers: false,
      })
    );
  });

  it('shows an isolated manual entry for the matching exit destination', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    const manager = {
      check: vi.fn(async () => ({ shouldEnable: true })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn(),
      execute: vi.fn(async () => {}),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    tabState.mnr_exit_navigation = {
      targetUrl: window.location.href,
      cleanupHostOverlays: false,
    };
    await loadExitDestination();

    const entryHost = document.getElementById('mnr-entry-root');
    expect(entryHost).not.toBeNull();
    expect(entryHost?.querySelector('#mnr-entry-button')).toBeNull();
    expect(entryHost?.shadowRoot?.querySelector('#mnr-entry-button')?.textContent).toBe(
      '进入阅读模式'
    );
    expect(tabState).not.toHaveProperty('mnr_exit_navigation');
    expect(manager.check).not.toHaveBeenCalled();
    expect(mockRemoveOverlays).not.toHaveBeenCalled();
    expect(configStore.load).not.toHaveBeenCalled();
  });

  it('consumes matching deferred overlay cleanup on a skipped destination load', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/2/',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'complete',
    });
    mockGetSitePreference.mockReturnValue({ enabled: false, timestamp: Date.now() });

    tabState.mnr_exit_navigation = {
      targetUrl: 'https://example.com/chapter/2',
      cleanupHostOverlays: true,
    };
    await import('@/bootstrap');

    await vi.waitFor(() => expect(document.getElementById('mnr-entry-root')).not.toBeNull());
    expect(mockDeactivateProtection).toHaveBeenCalled();
    expect(mockRemoveOverlays).toHaveBeenCalledTimes(1);
    expect(tabState).not.toHaveProperty('mnr_exit_navigation');
    expect(mockDeactivateProtection.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mockRemoveOverlays.mock.invocationCallOrder[0]
    );
    expect(configStore.load).not.toHaveBeenCalled();
    expect(mockGetSitePreference).not.toHaveBeenCalled();
    expect(mockGetAutoEnableManager).not.toHaveBeenCalled();
    expect(GM_getTab).toHaveBeenCalledTimes(1);
  });

  it('consumes exit state after a canonical cross-origin redirect in the same tab', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://www.example.com/chapter/2/',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'complete',
    });

    const tabState: Record<string, unknown> = {
      mnr_exit_navigation: {
        targetUrl: 'http://example.com/chapter/2',
        cleanupHostOverlays: true,
      },
    };
    const getTab = vi.fn((callback: (tab: Record<string, unknown>) => void) => {
      callback(tabState);
    });
    const saveTab = vi.fn((tab: Record<string, unknown>) => {
      expect(tab).toBe(tabState);
    });
    vi.stubGlobal('GM_getTab', getTab);
    vi.stubGlobal('GM_saveTab', saveTab);

    await import('@/bootstrap');

    await vi.waitFor(() => expect(document.getElementById('mnr-entry-root')).not.toBeNull());
    expect(tabState).not.toHaveProperty('mnr_exit_navigation');
    expect(getTab).toHaveBeenCalledTimes(1);
    expect(saveTab).toHaveBeenCalledTimes(1);
    expect(mockRemoveOverlays).toHaveBeenCalledTimes(1);
    expect(configStore.load).not.toHaveBeenCalled();
    expect(mockGetAutoEnableManager).not.toHaveBeenCalled();
  });

  it('discards an exit intent for another destination without cleaning or skipping detection', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/3',
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
    tabState.mnr_exit_navigation = {
      targetUrl: 'https://example.com/chapter/2',
      cleanupHostOverlays: true,
    };
    const manager = { check: vi.fn(async () => ({ shouldEnable: false })) };
    mockGetAutoEnableManager.mockReturnValue(manager);
    await import('@/bootstrap');
    await vi.waitFor(() => expect(manager.check).toHaveBeenCalledTimes(1));
    expect(tabState).not.toHaveProperty('mnr_exit_navigation');
    expect(mockRemoveOverlays).not.toHaveBeenCalled();
    expect(GM_getTab).toHaveBeenCalledTimes(1);
  });

  it('auto-bootstraps ambiguous section pages when an explicit rule matches', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/24/18442_6.html',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'complete',
    });

    const ruleManager = {
      initialize: vi.fn(async () => {}),
      matchRule: vi.fn(async () => ({
        rule: {
          id: 'paged-section',
          version: 1,
          match: { pattern: 'example' },
          content: { selector: '.con' },
        },
        source: 'builtin',
        matchedPattern: 'example',
      })),
    };
    mockGetRuleManager.mockReturnValue(ruleManager);

    const manager = {
      check: vi.fn(async () => ({ shouldEnable: true, method: 'builtin-rule' })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn(),
      execute: vi.fn(async () => {}),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    await import('@/bootstrap');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ruleManager.matchRule).toHaveBeenCalledWith('https://example.com/24/18442_6.html');
    expect(configStore.load).toHaveBeenCalledTimes(1);
    expect(manager.check).toHaveBeenCalledTimes(1);
    expect(manager.execute).toHaveBeenCalledTimes(1);
    expect(GM_getTab).toHaveBeenCalledTimes(1);
    expect(GM_saveTab).not.toHaveBeenCalled();
  });

  it('runs auto-enable prompt and mounts reader UI when accepted', async () => {
    vi.useFakeTimers();

    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/book/1',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    const decision = { shouldEnable: true, method: 'detection' };
    const chapter = { title: 't', content: 'c', rawContent: 'c', url: dom.window.location.href };

    let promptCb: (() => Promise<unknown>) | null = null;
    let launchCb: ((c: unknown, r?: unknown) => void) | null = null;

    const manager = {
      check: vi.fn(async () => decision),
      setPromptCallback: vi.fn((cb: () => Promise<unknown>) => {
        promptCb = cb;
      }),
      setLaunchCallback: vi.fn((cb: (c: unknown, r?: unknown) => void) => {
        launchCb = cb;
      }),
      execute: vi.fn(async () => {
        if (promptCb) {
          const res = (await promptCb()) as { accepted?: boolean };
          if (res?.accepted && launchCb) launchCb(chapter);
        } else if (launchCb) {
          launchCb(chapter);
        }
      }),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    const bootstrap = await import('@/bootstrap');

    const initPromise = bootstrap.initialize();
    await vi.runAllTimersAsync();
    await initPromise;

    expect(bootstrap.isActive()).toBe(true);
    expect(document.getElementById('mnr-reader-root')).not.toBeNull();
    expect(document.getElementById('mnr-hide-original')).not.toBeNull();
    expect(readerStore.activate).toHaveBeenCalledTimes(1);
    expect(readerStore.setChapter).toHaveBeenCalledTimes(1);
    expect(document.getElementById('mnr-entry-prompt-root')).toBeNull();

    const host = document.getElementById('mnr-reader-root') as HTMLElement;
    expect(host.shadowRoot?.querySelector('#reader-view-stub')).not.toBeNull();

    const protectionTrigger = host.shadowRoot?.querySelector(
      '#protection-mode-trigger'
    ) as HTMLButtonElement;
    protectionTrigger.click();
    await vi.waitFor(() => expect(configStore.flushSave).toHaveBeenCalledTimes(1));
    expect(configStore.updateProtection).toHaveBeenCalledWith({ mode: 'aggressive' });
    expect(mockActivateProtection).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'aggressive' })
    );
    expect(mockRemoveOverlays).not.toHaveBeenCalled();

    mockRemoveOverlays.mockImplementationOnce(() => {
      expect(document.getElementById('mnr-hide-original')).toBeNull();
    });
    bootstrap.closeReader();
    expect(mockRemoveOverlays).toHaveBeenCalledTimes(1);
  });

  it('updates a progressive chapter without mounting a second reader', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/1',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    const first = {
      title: '第1章',
      content: '<p>第一页</p>',
      rawContent: '<p>第一页</p>',
      url: dom.window.location.href,
    };
    const merged = { ...first, content: '<p>第一页</p><p>第二页</p>' };
    let launchCb:
      | ((chapter: unknown, rule?: unknown, stage?: 'initial' | 'update' | 'complete') => void)
      | null = null;
    const manager = {
      check: vi.fn(async () => ({ shouldEnable: true, method: 'builtin-rule' })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn(
        (
          callback: (
            chapter: unknown,
            rule?: unknown,
            stage?: 'initial' | 'update' | 'complete'
          ) => void
        ) => {
          launchCb = callback;
        }
      ),
      execute: vi.fn(async () => {
        launchCb?.(first, undefined, 'initial');
        launchCb?.(merged, undefined, 'update');
      }),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    const bootstrap = await import('@/bootstrap');
    await bootstrap.initialize();

    expect(bootstrap.isActive()).toBe(true);
    expect(readerStore.setChapter).toHaveBeenCalledWith(first, undefined);
    expect(readerStore.updateChapter).toHaveBeenCalledWith(merged, undefined);
    expect(readerStore.activate).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#mnr-reader-root')).toHaveLength(1);
  });

  it('closeReader restores page without changing the site auto-enable preference', async () => {
    // Import the module on a non-chapter page to avoid auto-bootstrap side effects.
    const domInit = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domInit.window);
    vi.stubGlobal('document', domInit.window.document);
    vi.stubGlobal('sessionStorage', domInit.window.sessionStorage);

    const bootstrap = await import('@/bootstrap');

    // Switch to a chapter URL before initializing (entryPageKind should be 'chapter').
    const domChapter = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/1',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domChapter.window);
    vi.stubGlobal('document', domChapter.window.document);
    vi.stubGlobal('sessionStorage', domChapter.window.sessionStorage);
    document.title = 'Original Chapter Title';
    window.history.replaceState({ site: 'original' }, '', window.location.href);

    const decision = { shouldEnable: true, method: 'detection' };
    const chapter = {
      title: 't',
      content: 'c',
      rawContent: 'c',
      url: domChapter.window.location.href,
    };
    let launchCb: ((c: unknown) => void) | null = null;

    const manager = {
      check: vi.fn(async () => decision),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn((cb: (c: unknown) => void) => {
        launchCb = cb;
      }),
      execute: vi.fn(async () => {
        launchCb?.(chapter);
      }),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    await bootstrap.initialize();
    expect(bootstrap.isActive()).toBe(true);

    document.title = '第1章 - 示例书';
    window.history.replaceState({ mnr: true, mnrChapter: 0 }, '', window.location.href);

    bootstrap.closeReader();

    expect(mockSetSitePreference).not.toHaveBeenCalled();
    expect(readerStore.deactivate).toHaveBeenCalledTimes(1);
    expect(mockDeactivateProtection).toHaveBeenCalled();
    expect(document.getElementById('mnr-reader-root')).toBeNull();
    expect(document.getElementById('mnr-hide-original')).toBeNull();
    expect(document.getElementById('mnr-entry-root')).not.toBeNull();
    expect(document.title).toBe('Original Chapter Title');
    expect(window.history.state).toEqual({ site: 'original' });
    expect(bootstrap.isActive()).toBe(false);
  });

  it('closeReader restores in place when only the entry URL hash differs', async () => {
    const domInit = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domInit.window);
    vi.stubGlobal('document', domInit.window.document);
    vi.stubGlobal('sessionStorage', domInit.window.sessionStorage);

    const bootstrap = await import('@/bootstrap');

    const domChapter = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/1#comments',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domChapter.window);
    vi.stubGlobal('document', domChapter.window.document);
    vi.stubGlobal('sessionStorage', domChapter.window.sessionStorage);
    document.title = 'Original Chapter Title';

    const chapter = {
      title: 't',
      content: 'c',
      rawContent: 'c',
      url: 'https://example.com/chapter/1',
    };
    let launchCb: ((c: unknown) => void) | null = null;
    mockGetAutoEnableManager.mockReturnValue({
      check: vi.fn(async () => ({ shouldEnable: true, method: 'detection' })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn((cb: (c: unknown) => void) => {
        launchCb = cb;
      }),
      execute: vi.fn(async () => {
        launchCb?.(chapter);
      }),
      manualEnable: vi.fn(async () => {}),
    });

    await bootstrap.initialize();
    expect(bootstrap.isActive()).toBe(true);

    bootstrap.closeReader();

    expect(tabState).not.toHaveProperty('mnr_exit_navigation');
    expect(window.location.href).toBe('https://example.com/chapter/1#comments');
    expect(document.title).toBe('Original Chapter Title');
    expect(document.getElementById('mnr-entry-root')).not.toBeNull();
  });

  it('closeReader keeps manual entry for rule-matched ambiguous chapter URLs', async () => {
    const domInit = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domInit.window);
    vi.stubGlobal('document', domInit.window.document);
    vi.stubGlobal('sessionStorage', domInit.window.sessionStorage);

    const bootstrap = await import('@/bootstrap');

    const domChapter = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://www.deqixs.org/24/18442_6.html',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', domChapter.window);
    vi.stubGlobal('document', domChapter.window.document);
    vi.stubGlobal('sessionStorage', domChapter.window.sessionStorage);

    const rule = {
      id: 'deqixs',
      version: 1,
      match: { pattern: 'deqixs' },
      content: { selector: '.con' },
      meta: { source: 'builtin' },
    };
    const chapter = {
      title: 't',
      content: 'c',
      rawContent: 'c',
      url: domChapter.window.location.href,
    };
    let launchCb: ((c: unknown, r?: unknown) => void) | null = null;

    const manager = {
      check: vi.fn(async () => ({ shouldEnable: true, method: 'builtin-rule', rule })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn((cb: (c: unknown, r?: unknown) => void) => {
        launchCb = cb;
      }),
      execute: vi.fn(async () => {
        launchCb?.(chapter, rule);
      }),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    await bootstrap.initialize();
    expect(bootstrap.isActive()).toBe(true);

    bootstrap.closeReader();

    expect(mockSetSitePreference).not.toHaveBeenCalled();
    expect(document.getElementById('mnr-entry-root')).not.toBeNull();
  });

  it('manual entry owns its lifecycle while manualEnable runs', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    const manager = {
      check: vi.fn(async () => ({ shouldEnable: false })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn(),
      execute: vi.fn(async () => {}),
      manualEnable: vi.fn(async () => {}),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);

    tabState.mnr_exit_navigation = {
      targetUrl: window.location.href,
      cleanupHostOverlays: false,
    };
    await loadExitDestination();

    const entryHost = document.getElementById('mnr-entry-root');
    const entryButton = entryHost?.shadowRoot?.querySelector(
      '#mnr-entry-button'
    ) as HTMLButtonElement | null;
    expect(entryButton).not.toBeNull();
    entryButton?.click();

    await vi.waitFor(() => expect(manager.manualEnable).toHaveBeenCalledTimes(1));
    expect(document.getElementById('mnr-entry-root')).toBeNull();
    expect(GM_getTab).toHaveBeenCalledTimes(1);
  });

  it('restores manual entry when reader launch fails on a chapter page', async () => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/chapter/1',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);

    const launchError = new Error('parse failed');
    const manager = {
      check: vi.fn(async () => ({ shouldEnable: false })),
      setPromptCallback: vi.fn(),
      setLaunchCallback: vi.fn(),
      execute: vi.fn(async () => {}),
      manualEnable: vi.fn(async () => {
        throw launchError;
      }),
    };
    mockGetAutoEnableManager.mockReturnValue(manager);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    tabState.mnr_exit_navigation = {
      targetUrl: window.location.href,
      cleanupHostOverlays: false,
    };
    await loadExitDestination();

    const entryButton = document
      .getElementById('mnr-entry-root')
      ?.shadowRoot?.querySelector('#mnr-entry-button') as HTMLButtonElement | null;
    expect(entryButton).not.toBeNull();
    entryButton?.click();

    await vi.waitFor(() => expect(manager.manualEnable).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.getElementById('mnr-entry-root')).not.toBeNull());
    expect(consoleError).toHaveBeenCalledWith('[MNR] Manual enable error:', launchError);
  });
});
