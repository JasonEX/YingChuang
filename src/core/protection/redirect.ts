/**
 * Redirect and dynamic injection protection.
 */

export interface RedirectProtectionOptions {
  cleanupScripts?: boolean;
}

export function blockRedirects(options: RedirectProtectionOptions = {}): () => void {
  // Block meta refresh redirects
  const metaRefresh = document.querySelectorAll('meta[http-equiv="refresh"]');
  metaRefresh.forEach(meta => meta.remove());

  // location.href/assign/replace are [LegacyUnforgeable] own, non-configurable properties in
  // Chrome and Firefox, so a userscript cannot intercept them; redirects are handled below
  // through timers, dynamic script/iframe injection and document.write instead.

  // Intercept setTimeout/setInterval for timed redirects
  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;

  const suspiciousPatterns = [/location\s*[.=]/i, /window\.open/i, /href\s*=/i, /navigate/i];

  const isSuspiciousCallback = (callback: unknown): boolean => {
    // Only check string callbacks (legacy setTimeout("code", delay) pattern)
    // Don't check function callbacks as .toString() is very expensive
    // and causes high CPU usage on sites with many timers
    if (typeof callback === 'string') {
      return suspiciousPatterns.some(p => p.test(callback));
    }
    return false;
  };

  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (isSuspiciousCallback(callback) && (delay || 0) > 0) {
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  }) as typeof window.setTimeout;

  window.setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (isSuspiciousCallback(callback)) {
      return 0;
    }
    return originalSetInterval(callback, delay, ...args);
  }) as typeof window.setInterval;

  // Block dynamic injection of third-party scripts/iframes (common on mobile ad-tech).
  // This is conservative: it only affects programmatic insertions, not static HTML.
  const isBlockedExternalUrl = (url: URL, kind: 'script' | 'iframe'): boolean => {
    // Block non-http(s) for scripts/iframes (data:, javascript:, etc.)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    if (url.origin === window.location.origin) return false;

    // Allow Cloudflare challenge scripts and iframes so CF verification can complete.
    const cfHosts = ['challenges.cloudflare.com', 'captcha.cloudflare.com'];
    if (cfHosts.some(h => url.hostname === h)) return false;
    if (url.pathname.startsWith('/cdn-cgi/')) return false;

    // Always block cross-origin dynamic scripts/iframes to prevent random redirect chains.
    // Users can still navigate manually by clicking normal links.
    return kind === 'script' || kind === 'iframe';
  };

  const isHighEntropyPath = (pathname: string): boolean => {
    // Example: /Ab12Cd34/EFgh5678iJ.js
    return /^\/[A-Za-z0-9]{6,12}\/[A-Za-z0-9]{6,24}\.js(?:$|[?#])/.test(pathname);
  };

  const isLikelyAdScriptPath = (srcUrl: URL): boolean => {
    if (srcUrl.origin !== window.location.origin) return true;
    const path = srcUrl.pathname || '';
    if (path.startsWith('/static/') || path.startsWith('/js/') || path.startsWith('/assets/')) {
      return false;
    }
    return isHighEntropyPath(path);
  };

  const NodeCtor = window.Node;
  const ScriptCtor = window.HTMLScriptElement;
  const IFrameCtor = window.HTMLIFrameElement;
  const ElementCtor = window.Element;
  const DocumentFragmentCtor = window.DocumentFragment;

  const originalAppendChild = NodeCtor.prototype.appendChild;
  const originalInsertBefore = NodeCtor.prototype.insertBefore;

  const shouldBlockNode = (node: Node): boolean => {
    const checkScript = (script: HTMLScriptElement): boolean => {
      const src = script.getAttribute('src') || script.src || '';
      if (!src) return false;
      let u: URL;
      try {
        u = new URL(src, window.location.href);
      } catch {
        return false;
      }
      if (isBlockedExternalUrl(u, 'script')) return true;
      if (options.cleanupScripts && isLikelyAdScriptPath(u)) return true;
      return false;
    };

    const checkIFrame = (iframe: HTMLIFrameElement): boolean => {
      const src = iframe.getAttribute('src') || iframe.src || '';
      if (!src) return false;
      let u: URL;
      try {
        u = new URL(src, window.location.href);
      } catch {
        return false;
      }
      if (isBlockedExternalUrl(u, 'iframe')) return true;
      return false;
    };

    if (ScriptCtor && node instanceof ScriptCtor) return checkScript(node as HTMLScriptElement);
    if (IFrameCtor && node instanceof IFrameCtor) return checkIFrame(node as HTMLIFrameElement);

    const canContainEmbeddedNodes =
      (DocumentFragmentCtor && node instanceof DocumentFragmentCtor) ||
      (ElementCtor && node instanceof ElementCtor);
    if (!canContainEmbeddedNodes) return false;

    const container = node as Element | DocumentFragment;
    if (container.childElementCount === 0) return false;

    const embeddedNodes = container.querySelectorAll('script[src], iframe[src]');
    for (const embeddedNode of Array.from(embeddedNodes)) {
      if (ScriptCtor && embeddedNode instanceof ScriptCtor) {
        if (checkScript(embeddedNode)) return true;
      } else if (IFrameCtor && embeddedNode instanceof IFrameCtor) {
        if (checkIFrame(embeddedNode)) return true;
      }
    }

    return false;
  };

  NodeCtor.prototype.appendChild = function <T extends Node>(node: T): T {
    if (shouldBlockNode(node)) {
      // Host renderers may move children in a while(firstChild) loop. Consume
      // the source node even when its destination insertion is blocked.
      node.parentNode?.removeChild(node);
      return node;
    }
    return originalAppendChild.call(this, node) as T;
  };

  NodeCtor.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (shouldBlockNode(newNode)) {
      newNode.parentNode?.removeChild(newNode);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  // Aggressive mode: filter document.write/writeln that injects suspicious external scripts.
  const originalWrite = document.write?.bind(document);
  const originalWriteln = document.writeln?.bind(document);
  let writeBuffer = '';
  let isBufferingWrite = false;
  const MAX_BUFFER_LEN = 4096;

  const bufferLooksLikeScriptTag = (buf: string): boolean => /<script/i.test(buf);
  const bufferIsClosed = (buf: string): boolean =>
    /<\/script>/i.test(buf) || /<\\\/script>/i.test(buf);

  const maybeExtractScriptSrc = (buf: string): string | null => {
    const m = buf.match(/<script[^>]*\ssrc\s*=\s*['"]([^'"]+)['"][^>]*>/i);
    return m?.[1] || null;
  };

  const flushWriteBuffer = (writer: (html: string) => void) => {
    if (!writeBuffer) return;
    writer(writeBuffer);
    writeBuffer = '';
    isBufferingWrite = false;
  };

  const handleWriteLike = (writer: (html: string) => void, args: unknown[]) => {
    if (!originalWrite || !originalWriteln) return writer(String(args.join('')));

    const chunk = args.map(a => String(a)).join('');
    const startsScriptLike =
      /<script/i.test(chunk) || (isBufferingWrite && bufferLooksLikeScriptTag(writeBuffer));

    if (!isBufferingWrite && startsScriptLike) {
      isBufferingWrite = true;
      writeBuffer = '';
    }

    if (!isBufferingWrite) {
      writer(chunk);
      return;
    }

    writeBuffer += chunk;
    if (writeBuffer.length > MAX_BUFFER_LEN) {
      // Fail-safe: don't keep buffering indefinitely.
      flushWriteBuffer(writer);
      return;
    }

    if (!bufferIsClosed(writeBuffer)) return;

    const src = maybeExtractScriptSrc(writeBuffer);
    if (src) {
      try {
        const u = new URL(src, window.location.href);
        const shouldBlock = isBlockedExternalUrl(u, 'script') || isLikelyAdScriptPath(u);
        if (shouldBlock) {
          writeBuffer = '';
          isBufferingWrite = false;
          return;
        }
      } catch {
        // Ignore invalid URL, pass through.
      }
    }

    flushWriteBuffer(writer);
  };

  if (options.cleanupScripts && originalWrite && originalWriteln) {
    document.write = (...args: unknown[]) => handleWriteLike(originalWrite, args);
    document.writeln = (...args: unknown[]) => handleWriteLike(originalWriteln, args);
  }

  return () => {
    window.setTimeout = originalSetTimeout;
    window.setInterval = originalSetInterval;

    NodeCtor.prototype.appendChild = originalAppendChild;
    NodeCtor.prototype.insertBefore = originalInsertBefore;

    if (originalWrite) {
      document.write = originalWrite;
    }
    if (originalWriteln) {
      document.writeln = originalWriteln;
    }
  };
}
