import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { JSDOM } from 'jsdom';

import { toProtectionOptions, useConfigStore } from '@/ui/stores/config';
import { createShadowMount } from '@/ui/shadowMount';

describe('ConfigStore (extra coverage)', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('location', dom.window.location);

    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads valid config from GM_getValue and applies theme/reading/behavior/protection', async () => {
    const config = {
      themeId: 'dark',
      reading: {
        fontSize: 20,
        lineHeight: 2.0,
        fontFamily: 'serif',
        letterSpacing: 0.05,
        paragraphIndent: 2,
        maxWidth: 800,
        padding: 20,
      },
      behavior: {
        autoLoadNext: true,
        autoLoadPrev: false,
        scrollThreshold: 200,
        preloadDistance: 500,
      },
      protection: { blockVisibility: true, blockRedirect: true, blockTimer: true },
      customCSS: '.test { color: red; }',
      customCleanupRegex: '测试广告$',
    };
    const gmGetValue = vi.fn(async () => JSON.stringify(config));
    const gmSetValue = vi.fn(async () => {});
    vi.stubGlobal('GM_getValue', gmGetValue);
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    await store.load();

    expect(store.themeId).toBe('dark');
    expect(store.reading.fontSize).toBe(20);
    expect(store.customCSS).toBe('.test { color: red; }');
    expect(store.customCleanupRegex).toBe('测试广告$');
  });

  it('loads config from GM_getValue when data is already an object (not string)', async () => {
    const config = {
      themeId: 'sepia',
      reading: { fontSize: 18 },
      behavior: { autoLoadNext: false },
      protection: { blockVisibility: false },
      customCSS: '',
    };
    const gmGetValue = vi.fn(async () => config);
    const gmSetValue = vi.fn(async () => {});
    vi.stubGlobal('GM_getValue', gmGetValue);
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    await store.load();

    expect(store.themeId).toBe('sepia');
  });

  it('handles invalid config data (array instead of object)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gmGetValue = vi.fn(async () => JSON.stringify([1, 2, 3]));
    const gmSetValue = vi.fn(async () => {});
    vi.stubGlobal('GM_getValue', gmGetValue);
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    await store.load();

    // Should fall back to defaults
    expect(store.themeId).toBe('system');
  });

  it('keeps the default theme when the stored theme no longer exists', async () => {
    vi.stubGlobal(
      'GM_getValue',
      vi.fn(async () => ({ themeId: 'blue', reading: { fontSize: 20 } }))
    );
    vi.stubGlobal(
      'GM_setValue',
      vi.fn(async () => {})
    );

    const store = useConfigStore();
    await store.load();

    expect(store.themeId).toBe('system');
    expect(store.reading.fontSize).toBe(20);
  });

  it('handles null config data gracefully', async () => {
    const gmGetValue = vi.fn(async () => null);
    const gmSetValue = vi.fn(async () => {});
    vi.stubGlobal('GM_getValue', gmGetValue);
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    await store.load();

    expect(store.themeId).toBe('system');
  });

  it('falls back to localStorage when GM_getValue is not available', async () => {
    const config = { themeId: 'dark' };
    const mockStorage = new Map<string, string>();
    mockStorage.set('mnr-config', JSON.stringify(config));
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
    });

    const store = useConfigStore();
    await store.load();

    expect(store.themeId).toBe('dark');
  });

  it('save writes to GM_setValue', async () => {
    const gmSetValue = vi.fn(async (_key: string, _value: string) => {});
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    store.setCustomCleanupRegex('测试广告$');
    await store.save();

    expect(gmSetValue).toHaveBeenCalledWith('mnr-config', expect.any(String));
    expect(JSON.parse(gmSetValue.mock.calls[0]![1] as string).customCleanupRegex).toBe('测试广告$');
  });

  it('save falls back to localStorage when GM_setValue is not available', async () => {
    const mockStorage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
    });

    const store = useConfigStore();
    await store.save();

    const stored = mockStorage.get('mnr-config');
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toHaveProperty('themeId');
  });

  it('$reset restores defaults and saves', async () => {
    const gmSetValue = vi.fn(async () => {});
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    store.themeId = 'dark';
    store.setCustomCleanupRegex('测试广告$');
    store.$reset();

    expect(store.themeId).toBe('system');
    expect(store.customCSS).toBe('');
    expect(store.customCleanupRegex).toBe('');
  });

  it('updateProtection merges settings', () => {
    const store = useConfigStore();
    store.updateProtection({ blockRedirects: false });
    expect(store.protection.blockRedirects).toBe(false);
  });

  it('only enables irreversible timer cleanup in aggressive mode', () => {
    const store = useConfigStore();

    expect(toProtectionOptions(store.protection).clearTimers).toBe(false);
    store.updateProtection({ mode: 'aggressive' });
    expect(toProtectionOptions(store.protection).clearTimers).toBe(true);
  });

  it('keeps real page visibility available to the reader', () => {
    const store = useConfigStore();

    expect(toProtectionOptions(store.protection).blockVisibilityDetection).toBe(false);
    store.updateProtection({ mode: 'aggressive' });
    expect(toProtectionOptions(store.protection).blockVisibilityDetection).toBe(false);
  });

  it('setCustomCSS applies CSS inside Shadow DOM', () => {
    const { shadowRoot } = createShadowMount('mnr-config-extra-root');
    const store = useConfigStore();
    store.setCustomCSS('.test { color: blue; }');
    expect(store.customCSS).toBe('.test { color: blue; }');
    const styleEl = shadowRoot.querySelector('#mnr-custom-css');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.textContent).toBe('.test { color: blue; }');
    expect(dom.window.document.getElementById('mnr-custom-css')).toBeNull();
  });

  it('refreshes the system theme when the OS color scheme changes', () => {
    let onChange: (() => void) | undefined;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: (_type: string, listener: () => void) => {
          onChange = listener;
        },
      })),
    });
    setActivePinia(createPinia());
    const store = useConfigStore();
    store.setTheme('system');

    onChange?.();

    expect(store.theme().id).toBe('dark');
  });

  it('load handles exception gracefully', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gmGetValue = vi.fn(async () => {
      throw new Error('storage error');
    });
    vi.stubGlobal('GM_getValue', gmGetValue);

    const store = useConfigStore();
    await store.load();

    // Should not throw, defaults should be applied
    expect(store.themeId).toBe('system');
  });

  it('save handles exception gracefully', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gmSetValue = vi.fn(async () => {
      throw new Error('storage error');
    });
    vi.stubGlobal('GM_setValue', gmSetValue);

    const store = useConfigStore();
    // Should not throw
    await store.save();
  });
});
