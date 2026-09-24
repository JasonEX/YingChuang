/**
 * Unit tests for SiteProtection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  getSiteProtection,
  isCloudflareChallenge,
  SiteProtection,
} from '@/core/protection/SiteProtection';

describe('SiteProtection', () => {
  let protection: SiteProtection;
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com',
      runScripts: 'dangerously',
    });

    // Set up global environment
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('window', dom.window);

    protection = new SiteProtection();
  });

  afterEach(() => {
    if (protection) {
      protection.deactivate();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const p = new SiteProtection();
      expect(p).toBeInstanceOf(SiteProtection);
    });

    it('should merge custom options with defaults', () => {
      const p = new SiteProtection({
        blockRedirects: false,
        enableRightClick: false,
      });
      expect(p).toBeInstanceOf(SiteProtection);
    });
  });

  describe('isCloudflareChallenge', () => {
    it('does not misclassify generic "challenge" UI elements', () => {
      const localDom = new JSDOM(
        '<!DOCTYPE html><html><body><div id="daily-challenge"></div></body></html>',
        { url: 'https://example.com/' }
      );

      expect(isCloudflareChallenge(localDom.window.document)).toBe(false);
    });

    it.each(['jsd', 'precursor'])(
      'does not misclassify readable pages with Cloudflare %s detection',
      detection => {
        const localDom = new JSDOM(
          `<!DOCTYPE html>
        <html>
          <head>
            <title>第一章 - 示例小说</title>
            <link rel="preload" as="script" href="/cdn-cgi/challenge-platform/scripts/${detection}/main.js">
            <script src="/cdn-cgi/challenge-platform/scripts/${detection}/main.js"></script>
          </head>
          <body>
            <main id="content"><p>这是正常显示的章节正文。</p></main>
            <script>
              window.__CF$cv$params = { r: 'ray-id' };
              const script = document.createElement('script');
              script.src = '/cdn-cgi/challenge-platform/scripts/${detection}/main.js';
            </script>
          </body>
        </html>`,
          { url: 'https://www.hetushu.com/book/9145/6567989.html' }
        );

        expect(isCloudflareChallenge(localDom.window.document)).toBe(false);
      }
    );

    it.each([
      '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>',
      '<script>window._cf_chl_opt = { cType: "managed" };</script>',
      '<iframe src="https://challenges.cloudflare.com/turnstile/v0/"></iframe>',
      '<title>Just a moment...</title>',
    ])('still detects a challenge alongside Precursor: %s', marker => {
      const localDom = new JSDOM(
        `<!doctype html><html><head>
          <script src="/cdn-cgi/challenge-platform/scripts/precursor/main.js"></script>
        </head><body>${marker}</body></html>`,
        { url: 'https://twkan.com/txt/93181/53052605' }
      );

      expect(isCloudflareChallenge(localDom.window.document)).toBe(true);
    });

    it('detects Cloudflare challenge pages by /cdn-cgi/ path', () => {
      const localDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.com/cdn-cgi/l/chk_jschl',
      });

      expect(isCloudflareChallenge(localDom.window.document)).toBe(true);
    });

    it('detects Cloudflare challenge pages by /cdn-cgi/ markers', () => {
      const localDom = new JSDOM(
        '<!DOCTYPE html><html><body><form action="/cdn-cgi/challenge-platform/h/g/orchestrate"></form></body></html>',
        { url: 'https://example.com/' }
      );

      expect(isCloudflareChallenge(localDom.window.document)).toBe(true);
    });

    it('detects Cloudflare managed challenge script resources', () => {
      const localDom = new JSDOM(
        '<!DOCTYPE html><html><head><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script></head><body></body></html>',
        { url: 'https://example.com/' }
      );

      expect(isCloudflareChallenge(localDom.window.document)).toBe(true);
    });

    it('detects inline Cloudflare managed challenge pages', () => {
      const localDom = new JSDOM(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Just a moment...</title>
            <script>
              window._cf_chl_opt = { cType: 'managed', cZone: 'www.69shuba.com' };
            </script>
          </head>
          <body>
            <noscript>Enable JavaScript and cookies to continue</noscript>
          </body>
        </html>`,
        { url: 'https://www.69shuba.com/txt/54141/34953497' }
      );

      expect(isCloudflareChallenge(localDom.window.document)).toBe(true);
    });
  });

  describe('activate / deactivate', () => {
    it('should activate protection', () => {
      // Should not throw
      expect(() => protection.activate()).not.toThrow();
    });

    it('should not activate twice', () => {
      protection.activate();
      // Second activation should be no-op
      expect(() => protection.activate()).not.toThrow();
    });

    it('should deactivate protection', () => {
      protection.activate();
      // Should not throw
      expect(() => protection.deactivate()).not.toThrow();
    });

    it('should not deactivate if not active', () => {
      // Should not throw
      expect(() => protection.deactivate()).not.toThrow();
    });

    it.each(['appendChild', 'insertBefore'] as const)(
      'restores host %s behavior on exit and protects again on re-entry',
      method => {
        const doc = dom.window.document;
        const original = dom.window.Node.prototype[method];
        const target = doc.createElement('div');

        for (const enabled of [true, false, true]) {
          if (enabled) protection.activate();
          else protection.deactivate();

          const source = doc.createElement('template');
          source.innerHTML = '<script src="https://evil.example/x.js"></script>';
          const script = source.content.firstChild!;
          const result =
            method === 'appendChild'
              ? target.appendChild(script)
              : target.insertBefore(script, null);

          expect(result).toBe(script);
          expect(source.content.childNodes).toHaveLength(0);
          expect(target.contains(script)).toBe(!enabled);
          if (!enabled) expect(dom.window.Node.prototype[method]).toBe(original);
          target.replaceChildren();
        }
      }
    );
  });

  describe('enableRightClick', () => {
    it('should restore right-click menu', () => {
      // Set up a contextmenu blocker
      const handler = vi.fn((e: Event) => e.preventDefault());
      dom.window.document.addEventListener('contextmenu', handler);

      protection.activate();

      // Create and dispatch a contextmenu event
      const event = new dom.window.Event('contextmenu', { cancelable: true });
      dom.window.document.dispatchEvent(event);

      // After protection activation, the event should not be prevented
      // Note: In real browser, this would allow right-click menu
    });
  });

  describe('enableSelection', () => {
    it('should restore text selection capability', () => {
      // Add CSS that disables selection
      const style = dom.window.document.createElement('style');
      style.textContent = `
        body { user-select: none; -webkit-user-select: none; }
        * { -moz-user-select: none; }
      `;
      dom.window.document.head.appendChild(style);

      protection.activate();

      // Protection should add override styles
      const styles = dom.window.document.querySelectorAll('style');
      expect(styles.length).toBeGreaterThanOrEqual(1);
    });

    it('should remove onselectstart attribute', () => {
      // Add onselectstart to body
      dom.window.document.body.setAttribute('onselectstart', 'return false;');

      protection.activate();

      // The attribute should be removed
      expect(dom.window.document.body.getAttribute('onselectstart')).toBeNull();
    });
  });

  describe('enableCopy', () => {
    it('should restore copy functionality', () => {
      // Add oncopy that blocks copying
      dom.window.document.body.setAttribute('oncopy', 'return false;');

      protection.activate();

      // The attribute should be removed
      expect(dom.window.document.body.getAttribute('oncopy')).toBeNull();
    });

    it('should remove oncut attribute', () => {
      dom.window.document.body.setAttribute('oncut', 'return false;');

      protection.activate();

      expect(dom.window.document.body.getAttribute('oncut')).toBeNull();
    });
  });

  describe('blockRedirects', () => {
    it('should remove meta refresh tags', () => {
      // Add a meta refresh tag
      const meta = dom.window.document.createElement('meta');
      meta.setAttribute('http-equiv', 'refresh');
      meta.setAttribute('content', '5; url=https://redirect.com');
      dom.window.document.head.appendChild(meta);

      protection.activate();

      // Meta refresh should be removed
      const refreshTags = dom.window.document.querySelectorAll('meta[http-equiv="refresh"]');
      expect(refreshTags.length).toBe(0);
    });

    it('should block dynamically injected cross-origin scripts', () => {
      protection.activate();

      const script = dom.window.document.createElement('script');
      script.setAttribute('src', 'https://evil.example/x.js');
      dom.window.document.body.appendChild(script);

      const injected = dom.window.document.querySelector('script[src="https://evil.example/x.js"]');
      expect(injected).toBeNull();
    });

    it.each(['appendChild', 'insertBefore'] as const)(
      'consumes blocked nodes so host %s transfer loops can finish',
      method => {
        protection.activate();
        const source = dom.window.document.createElement('div');
        source.innerHTML =
          '<p>before</p><script src="https://evil.example/x.js"></script><p>after</p>';
        const target = dom.window.document.body;
        let moves = 0;

        // Bound the host's while(firstChild) loop so a regression fails instead of hanging.
        while (source.firstChild && moves < 4) {
          const child = source.firstChild;
          const result =
            method === 'appendChild' ? target.appendChild(child) : target.insertBefore(child, null);
          expect(result).toBe(child);
          moves++;
        }

        expect(source.childNodes).toHaveLength(0);
        expect(moves).toBe(3);
        expect(target.textContent).toBe('beforeafter');
        expect(target.querySelector('script')).toBeNull();
      }
    );

    it('does not scan descendants for plain leaf nodes', () => {
      const p = new SiteProtection({
        blockRedirects: true,
        enableRightClick: false,
        enableSelection: false,
        enableCopy: false,
        unlockKeyboard: false,
        blockPopups: false,
        removeEventHijacking: false,
        blockVisibilityDetection: false,
        clearTimers: false,
      });
      p.activate();

      const queryAllSpy = vi.spyOn(dom.window.Element.prototype, 'querySelectorAll');
      const div = dom.window.document.createElement('div');
      div.textContent = 'normal content';
      dom.window.document.body.appendChild(div);

      expect(queryAllSpy).not.toHaveBeenCalled();
      expect(div.isConnected).toBe(true);

      p.deactivate();
    });

    it('still blocks nested cross-origin scripts in inserted fragments', () => {
      protection.activate();

      const wrapper = dom.window.document.createElement('div');
      wrapper.innerHTML = '<p>text</p><script src="https://evil.example/x.js"></script>';
      dom.window.document.body.appendChild(wrapper);

      expect(wrapper.isConnected).toBe(false);
      expect(
        dom.window.document.querySelector('script[src="https://evil.example/x.js"]')
      ).toBeNull();
    });

    it('should block suspicious document.writeln script injection in aggressive mode', () => {
      const doc = dom.window.document as unknown as Document & {
        writeln: (...args: unknown[]) => void;
      };

      const originalWriteln = vi.fn();
      doc.writeln = originalWriteln;

      const p = new SiteProtection({ cleanupScripts: true });
      p.activate();

      // Simulate common ad-tech pattern: build a script tag in pieces via writeln()
      doc.writeln('<script src="/');
      doc.writeln('Ab12Cd34');
      doc.writeln('/EFgh5678iJ.js');
      doc.writeln('"><\\/script>');

      // Should be blocked entirely (not forwarded to original writeln)
      expect(originalWriteln).toHaveBeenCalledTimes(0);

      // Allow typical same-site scripts
      doc.writeln('<script src="/js/app.js"></script>');
      expect(originalWriteln).toHaveBeenCalledTimes(1);

      p.deactivate();
    });

    it('should allow redirects to Cloudflare challenge pages', () => {
      protection.activate();

      // In JSDOM we can't fully test location behavior, but we verify
      // our code doesn't throw and the protection module initializes correctly
      expect(() => protection.activate()).not.toThrow();

      // Verify that Cloudflare domains are recognized
      // Note: Full integration testing requires a real browser environment
      // Here we just ensure the code path doesn't break
      protection.deactivate();
    });
  });

  describe('blockPopups', () => {
    it('should intercept window.open calls', () => {
      // Stub JSDOM's window.open to avoid noisy "navigation not implemented" logs.
      const originalOpen = vi.fn(() => ({}) as unknown as Window);
      Object.defineProperty(dom.window, 'open', { value: originalOpen, configurable: true });

      protection.activate();

      // After protection, window.open should be intercepted
      // In JSDOM this may not fully work, but the code should not throw
      expect(() => {
        const result = dom.window.open('https://popup.com');
        // Protection should return null for blocked popups
        expect(result).toBeNull();
        expect(originalOpen).toHaveBeenCalledTimes(0);
      }).not.toThrow();
    });
  });

  describe('removeOverlays', () => {
    it('should remove fixed position full-page overlays', () => {
      // Create a fixed overlay element
      const overlay = dom.window.document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '9999';
      overlay.id = 'test-overlay';
      overlay.getBoundingClientRect = () =>
        ({
          width: dom.window.innerWidth,
          height: dom.window.innerHeight,
          top: 0,
          left: 0,
          bottom: dom.window.innerHeight,
          right: dom.window.innerWidth,
        }) as DOMRect;
      dom.window.document.body.appendChild(overlay);

      protection.removeOverlays();

      // Overlay should be hidden
      expect(overlay.style.display).toBe('none');
    });

    it('should remove invisible fixed click layers near top', () => {
      const layer = dom.window.document.createElement('a');
      layer.href = 'https://evil.example/';
      layer.style.position = 'fixed';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.width = '100%';
      layer.style.height = '80px';
      layer.style.zIndex = '2147483647';
      layer.style.opacity = '0';
      layer.id = 'test-click-layer';
      layer.getBoundingClientRect = () =>
        ({
          width: dom.window.innerWidth,
          height: 80,
          top: 0,
          left: 0,
          bottom: 80,
          right: dom.window.innerWidth,
        }) as DOMRect;
      dom.window.document.body.appendChild(layer);

      protection.removeOverlays();
      expect(layer.style.display).toBe('none');
    });

    it('should remove transparent background click layers (no opacity)', () => {
      const layer = dom.window.document.createElement('a');
      layer.href = 'https://evil.example/';
      layer.style.position = 'fixed';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.width = '100%';
      layer.style.height = '80px';
      layer.style.zIndex = '2147483647';
      layer.style.opacity = '1';
      layer.style.backgroundColor = 'transparent';
      layer.id = 'test-click-layer-transparent';
      layer.getBoundingClientRect = () =>
        ({
          width: dom.window.innerWidth,
          height: 80,
          top: 0,
          left: 0,
          bottom: 80,
          right: dom.window.innerWidth,
        }) as DOMRect;
      dom.window.document.body.appendChild(layer);

      protection.removeOverlays();
      expect(layer.style.display).toBe('none');
    });

    it('should not remove visible fixed headers', () => {
      const header = dom.window.document.createElement('div');
      header.textContent = 'Menu';
      header.style.position = 'fixed';
      header.style.top = '0';
      header.style.left = '0';
      header.style.width = '100%';
      header.style.height = '60px';
      header.style.zIndex = '9999';
      header.style.opacity = '1';
      header.style.backgroundColor = 'rgb(255, 255, 255)';
      header.id = 'test-header';
      header.getBoundingClientRect = () =>
        ({
          width: dom.window.innerWidth,
          height: 60,
          top: 0,
          left: 0,
          bottom: 60,
          right: dom.window.innerWidth,
        }) as DOMRect;
      dom.window.document.body.appendChild(header);

      protection.removeOverlays();
      expect(header.style.display).not.toBe('none');
    });
  });

  describe('getSiteProtection singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getSiteProtection();
      const b = getSiteProtection();

      expect(a).toBeInstanceOf(SiteProtection);
      expect(a).toBe(b);
    });
  });

  describe('cleanupScripts', () => {
    it('should remove tracking scripts', () => {
      // Add a script with known tracking patterns
      const script = dom.window.document.createElement('script');
      script.src = 'https://example.com/tracking.js';
      script.textContent = 'setInterval(function(){}, 1000);';
      dom.window.document.body.appendChild(script);

      protection.cleanupScripts();

      // Script handling should complete without error
    });
  });

  describe('options control', () => {
    it('should not block redirects when option is false', () => {
      const p = new SiteProtection({ blockRedirects: false });

      // Add a meta refresh tag
      const meta = dom.window.document.createElement('meta');
      meta.setAttribute('http-equiv', 'refresh');
      meta.setAttribute('content', '5; url=https://redirect.com');
      dom.window.document.head.appendChild(meta);

      p.activate();

      // Meta refresh should still exist
      const refreshTags = dom.window.document.querySelectorAll('meta[http-equiv="refresh"]');
      expect(refreshTags.length).toBe(1);
    });

    it('should not enable right-click when option is false', () => {
      const p = new SiteProtection({ enableRightClick: false });
      // Should not throw
      expect(() => p.activate()).not.toThrow();
      p.deactivate();
    });

    it('should not enable selection when option is false', () => {
      const p = new SiteProtection({ enableSelection: false });
      dom.window.document.body.setAttribute('onselectstart', 'return false;');

      p.activate();

      // The attribute should still exist
      expect(dom.window.document.body.getAttribute('onselectstart')).toBe('return false;');
      p.deactivate();
    });

    it('should not enable copy when option is false', () => {
      const p = new SiteProtection({ enableCopy: false });
      dom.window.document.body.setAttribute('oncopy', 'return false;');

      p.activate();

      // The attribute should still exist
      expect(dom.window.document.body.getAttribute('oncopy')).toBe('return false;');
      p.deactivate();
    });

    it('should not block popups when option is false', () => {
      const p = new SiteProtection({ blockPopups: false });
      expect(() => p.activate()).not.toThrow();
      p.deactivate();
    });

    it('should not clear timers when option is false', () => {
      const p = new SiteProtection({ clearTimers: false });
      expect(() => p.activate()).not.toThrow();
      p.deactivate();
    });
  });

  describe('edge cases', () => {
    it('should handle document without head element', () => {
      // Create a minimal DOM without head
      const minimalDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      vi.stubGlobal('document', minimalDom.window.document);
      vi.stubGlobal('window', minimalDom.window);

      const p = new SiteProtection();
      // Should not throw
      expect(() => p.activate()).not.toThrow();
      p.deactivate();
    });

    it('should handle document without body element', () => {
      // Create a document without body
      const minimalDom = new JSDOM('<!DOCTYPE html><html></html>');
      vi.stubGlobal('document', minimalDom.window.document);
      vi.stubGlobal('window', minimalDom.window);

      const p = new SiteProtection();
      // Should not throw even without body
      expect(() => p.activate()).not.toThrow();
      p.deactivate();
    });

    it('should handle multiple activate/deactivate cycles', () => {
      for (let i = 0; i < 5; i++) {
        protection.activate();
        protection.deactivate();
      }
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should clean up all registered cleanup functions on deactivate', () => {
      protection.activate();
      protection.deactivate();

      // After deactivation, reactivation should work cleanly
      protection.activate();
      expect(true).toBe(true);
    });
  });

  describe('clearTimers', () => {
    it('should clear existing intervals', () => {
      // Create some intervals
      const intervalId1 = dom.window.setInterval(() => {}, 1000);
      const intervalId2 = dom.window.setInterval(() => {}, 2000);

      protection.activate();

      // Intervals should be cleared
      // Note: In JSDOM, we can't easily verify this, but the code should run
      expect(intervalId1).toBeDefined();
      expect(intervalId2).toBeDefined();
    });

    it('should clear existing timeouts', () => {
      // Create some timeouts
      const timeoutId1 = dom.window.setTimeout(() => {}, 5000);
      const timeoutId2 = dom.window.setTimeout(() => {}, 10000);

      protection.activate();

      // Timeouts should be cleared
      expect(timeoutId1).toBeDefined();
      expect(timeoutId2).toBeDefined();
    });
  });

  describe('blockVisibilityDetection', () => {
    it('should block visibility change detection', () => {
      const visibilityHandler = vi.fn();
      dom.window.document.addEventListener('visibilitychange', visibilityHandler);

      protection.activate();

      // Visibility change events should be intercepted
      // Note: Full testing requires a real browser environment
    });
  });

  describe('removeEventHijacking', () => {
    it('should remove click event hijacking', () => {
      // Add a click hijacker
      const hijacker = vi.fn((e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      });
      dom.window.document.addEventListener('click', hijacker, true);

      protection.activate();

      // Event hijacking should be mitigated
      // Note: Full testing requires a real browser environment
    });

    it('should remove onclick event hijacking from body', () => {
      // Add an onclick hijacker to body
      dom.window.document.body.onclick = () => false;

      protection.activate();

      // The onclick should be cleared
      expect(dom.window.document.body.onclick).toBeNull();
    });
  });
});
