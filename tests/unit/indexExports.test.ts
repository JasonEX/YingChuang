import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('src/index exports', () => {
  let dom: JSDOM;

  beforeEach(() => {
    vi.resetModules();

    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/index.html',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('sessionStorage', dom.window.sessionStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('re-exports bootstrap API and version constants', async () => {
    const entry = await import('@/index');

    expect(typeof entry.initialize).toBe('function');
    expect(typeof entry.closeReader).toBe('function');
    expect(typeof entry.manualEnable).toBe('function');
    expect(typeof entry.isActive).toBe('function');
    expect(typeof entry.getVersion).toBe('function');
    expect(typeof entry.VERSION).toBe('string');
    expect(typeof entry.BUILD_DATE).toBe('string');
  });
});
