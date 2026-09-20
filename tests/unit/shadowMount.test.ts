import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  createShadowMount,
  injectShadowCSS,
  setShadowCustomCSS,
  setShadowStyleProperties,
} from '@/ui/shadowMount';

describe('shadowMount', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html lang="zh-TW"><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a shadow root mount point and cleans up', () => {
    const { host, shadowRoot, mountPoint, cleanup } = createShadowMount('mnr-test-root');

    expect(host.id).toBe('mnr-test-root');
    expect(host.lang).toBe('zh-CN');
    expect(document.getElementById('mnr-test-root')).toBe(host);
    expect(shadowRoot).toBe(host.shadowRoot);
    expect(mountPoint.id).toBe('mnr-test-root-mount');
    expect(shadowRoot.contains(mountPoint)).toBe(true);
    expect(shadowRoot.querySelector('style')?.textContent).toContain("'Microsoft YaHei UI'");

    expect(window.__MY_NOVEL_READER__?.shadowRoots?.has(shadowRoot)).toBe(true);

    cleanup();
    expect(document.getElementById('mnr-test-root')).toBeNull();
    expect(window.__MY_NOVEL_READER__?.shadowRoots).toBeUndefined();
  });

  it('injects previously collected CSS and supports injecting extra CSS', () => {
    window.__MY_NOVEL_READER__ = { styles: 'body{background:red;}' };

    const { shadowRoot } = createShadowMount('mnr-style-root');
    const appStyle = shadowRoot.querySelector('#mnr-app-styles') as HTMLStyleElement | null;
    expect(appStyle).not.toBeNull();
    expect(appStyle?.textContent).toContain('background:red');

    injectShadowCSS(shadowRoot, 'a{color:blue;}');
    expect(shadowRoot.querySelectorAll('style').length).toBeGreaterThan(1);
    expect(shadowRoot.textContent).toContain('color:blue');
  });

  it('applies runtime style properties and custom CSS to registered Shadow DOM roots', () => {
    const first = createShadowMount('mnr-runtime-root-a');
    const second = createShadowMount('mnr-runtime-root-b');

    setShadowStyleProperties({ '--mnr-bg': '#123456', '--mnr-font-size': '20px' });
    setShadowCustomCSS('.mnr-test{color:red;}');

    for (const { host, shadowRoot } of [first, second]) {
      expect(host.style.getPropertyValue('--mnr-bg')).toBe('#123456');
      expect(host.style.getPropertyValue('--mnr-font-size')).toBe('20px');
      expect(shadowRoot.querySelector('#mnr-custom-css')?.textContent).toBe(
        '.mnr-test{color:red;}'
      );
    }
    expect(document.getElementById('mnr-custom-css')).toBeNull();

    setShadowCustomCSS('');
    expect(first.shadowRoot.querySelector('#mnr-custom-css')).toBeNull();
    expect(second.shadowRoot.querySelector('#mnr-custom-css')).toBeNull();
  });

  it('updates only changed runtime styles and keeps custom CSS independent', () => {
    const { host, shadowRoot } = createShadowMount('mnr-incremental-style-root');
    setShadowStyleProperties({ '--mnr-font-size': '18px', '--mnr-line-height': '1.8' });
    const setProperty = vi.spyOn(host.style, 'setProperty');

    setShadowStyleProperties({ '--mnr-font-size': '20px' });
    expect(setProperty).toHaveBeenCalledOnce();
    expect(setProperty).toHaveBeenCalledWith('--mnr-font-size', '20px');

    setShadowCustomCSS('.incremental{display:block;}');
    expect(setProperty).toHaveBeenCalledOnce();
    expect(shadowRoot.querySelector('#mnr-custom-css')?.textContent).toContain('incremental');
  });

  it('queues runtime styles before a Shadow DOM root exists', () => {
    setShadowStyleProperties({ '--mnr-text': '#abcdef' });
    setShadowCustomCSS('.queued{display:block;}');

    const { host, shadowRoot } = createShadowMount('mnr-queued-root');

    expect(host.style.getPropertyValue('--mnr-text')).toBe('#abcdef');
    expect(shadowRoot.querySelector('#mnr-custom-css')?.textContent).toBe(
      '.queued{display:block;}'
    );
  });
});
