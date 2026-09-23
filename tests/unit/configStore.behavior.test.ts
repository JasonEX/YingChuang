import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { THEMES, useConfigStore } from '@/ui/stores/config';
import { createShadowMount } from '@/ui/shadowMount';

import { createGmStorageMock, stubGmStorage } from '../testUtils/gmStorage';
import { createDom } from '../testUtils/dom';
import { setupPinia } from '../testUtils/pinia';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const r = toLinear(parseInt(value.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(value.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(value.slice(4, 6), 16) / 255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));

  return (lighter + 0.05) / (darker + 0.05);
}

describe('ConfigStore - behavior', () => {
  beforeEach(() => {
    createDom('https://example.com/');
    setupPinia();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('setTheme updates themeId and applies CSS variables', () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const { host } = createShadowMount('mnr-config-theme-root');
    const store = useConfigStore();
    store.setTheme('dark');

    expect(store.themeId).toBe('dark');
    expect(host.style.getPropertyValue('--mnr-bg')).toBe(
      THEMES.find(t => t.id === 'dark')!.background
    );
    expect(host.style.getPropertyValue('--mnr-on-link')).toBe(
      THEMES.find(t => t.id === 'dark')!.onLink
    );
    expect(host.style.getPropertyValue('--mnr-danger')).toBe(
      THEMES.find(t => t.id === 'dark')!.danger
    );
    expect(document.documentElement.style.getPropertyValue('--mnr-bg')).toBe('');
  });

  it('keeps built-in theme colors readable for long-form reading and accent controls', () => {
    for (const theme of THEMES) {
      expect(contrastRatio(theme.background, theme.text), theme.id).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(theme.background, theme.link), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.link, theme.onLink), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.background, theme.danger), theme.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applyReading writes reading settings to CSS variables', () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const { host } = createShadowMount('mnr-config-reading-root');
    const store = useConfigStore();
    store.applyReading();
    const setProperty = vi.spyOn(host.style, 'setProperty');
    store.updateReading({ fontSize: 20, lineHeight: 2.1, paragraphIndent: 3 });

    const root = host.style;
    expect(root.getPropertyValue('--mnr-font-size')).toBe('20px');
    expect(root.getPropertyValue('--mnr-line-height')).toBe('2.1');
    expect(root.getPropertyValue('--mnr-letter-spacing')).toBe('0em');
    expect(root.getPropertyValue('--mnr-paragraph-indent')).toBe('3em');
    expect(document.documentElement.style.getPropertyValue('--mnr-font-size')).toBe('');
    expect(setProperty.mock.calls.map(([property]) => property)).toEqual([
      '--mnr-font-size',
      '--mnr-line-height',
      '--mnr-paragraph-indent',
    ]);
  });

  it('setCustomCSS injects/updates the custom style element inside Shadow DOM', () => {
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const { shadowRoot } = createShadowMount('mnr-config-custom-root');
    const store = useConfigStore();
    store.setCustomCSS('.mnr-test{color:red;}');

    const styleEl = shadowRoot.querySelector('#mnr-custom-css') as HTMLStyleElement | null;
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain('mnr-test');
    expect(document.getElementById('mnr-custom-css')).toBeNull();
  });

  it('coalesces rapid setting changes into one storage write', async () => {
    vi.useFakeTimers();
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const store = useConfigStore();
    for (let fontSize = 14; fontSize <= 28; fontSize++) {
      store.updateReading({ fontSize });
    }

    await nextTick();
    expect(gm.GM_setValue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(299);
    expect(gm.GM_setValue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(gm.GM_setValue).toHaveBeenCalledWith(
      'mnr-config',
      expect.stringContaining('"fontSize":28')
    );
    expect(gm.GM_setValue).toHaveBeenCalledTimes(1);
  });

  it('flushSave persists a pending change immediately', async () => {
    vi.useFakeTimers();
    const gm = createGmStorageMock();
    stubGmStorage(gm);

    const store = useConfigStore();
    store.updateBehavior({ keyboardNavigation: false });
    await store.flushSave();

    expect(gm.GM_setValue).toHaveBeenCalledWith(
      'mnr-config',
      expect.stringContaining('"keyboardNavigation":false')
    );
    expect(gm.GM_setValue).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite unchanged configuration after loading it', async () => {
    vi.useFakeTimers();
    const gm = createGmStorageMock({
      'mnr-config': JSON.stringify({ themeId: 'dark', reading: { fontSize: 20 } }),
    });
    stubGmStorage(gm);

    const store = useConfigStore();
    await store.load();
    await vi.advanceTimersByTimeAsync(1000);

    expect(store.themeId).toBe('dark');
    expect(gm.GM_setValue).not.toHaveBeenCalled();
  });

  it('preserves an explicitly stored letter spacing value', async () => {
    const gm = createGmStorageMock({
      'mnr-config': JSON.stringify({ reading: { letterSpacing: 0.05 } }),
    });
    stubGmStorage(gm);

    const store = useConfigStore();
    await store.load();

    expect(store.reading.letterSpacing).toBe(0.05);
    expect(gm.GM_setValue).not.toHaveBeenCalled();
  });

  it('save falls back to localStorage when GM_setValue is unavailable', async () => {
    vi.stubGlobal('GM_setValue', undefined);
    vi.stubGlobal('GM_getValue', undefined);

    const store = useConfigStore();
    store.updateReading({ fontSize: 22 });
    await store.save();

    const stored = localStorage.getItem('mnr-config');
    expect(stored).toContain('"fontSize":22');
  });
});
