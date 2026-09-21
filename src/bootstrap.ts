/**
 * Bootstrap - Application entry point
 *
 * Initializes the reader application:
 * 1. Setup Vue app with Pinia
 * 2. Initialize stores
 * 3. Run auto-enable detection
 * 4. Mount UI when needed
 */

import {
  type AutoEnableDecision,
  getAutoEnableManager,
  type LaunchContinuation,
  type LaunchEvent,
} from '@/core/AutoEnableManager';
import { type BootstrapDebugSnapshot, copyDiagnosticInfo } from '@/ui/debug/diagnostics';
import { BUILD_DATE, VERSION } from '@/version';
import {
  captureHostPageSnapshot,
  type HostPageSnapshot,
  restoreHostPageSnapshot,
} from '@/ui/stores/reader/hostPage';
import { createApp, defineComponent, h, ref } from 'vue';
import { getPageKind, getPageKindFromUrl, type PageKind } from '@/core/auto-enable/PageKind';
import { installGlobalDebugErrorListeners, recordDebugEvent } from '@/core/debug/events';
import { ReaderEntryButton, ReaderEntryPrompt } from '@/ui/components/entry';
import { redactUrl, toDebugValue } from '@/core/debug/diagnostics';
import { toProtectionOptions, useConfigStore } from '@/ui/stores/config';
import { createPinia } from 'pinia';
import { createShadowMount } from '@/ui/shadowMount';
import { getRuleManager } from '@/core/rules/RuleManager';
import { getRuleStorage } from '@/core/rules/RuleStorage';
import { getSiteProtection } from '@/core/protection';
import { normalizeUrlForFetch } from '@/core/utils/network';
import { ReaderView } from '@/ui/components/reader';
import { useReaderStore } from '@/ui/stores/reader';

const EXIT_NAVIGATION_KEY = 'mnr_exit_navigation';
// Violentmonkey supports the script but does not expose Tampermonkey's per-tab APIs.
const hasTabStorage = typeof GM_getTab === 'function' && typeof GM_saveTab === 'function';

interface ExitNavigation {
  targetUrl: string;
  cleanupHostOverlays: boolean;
}

type UserscriptTabState = Record<string, unknown> & {
  [EXIT_NAVIGATION_KEY]?: ExitNavigation;
};

/** Application state */
interface AppState {
  isInitialized: boolean;
  autoEnableDone: boolean;
  isActive: boolean;
  currentDecision: AutoEnableDecision | null;
  originalHostPage: HostPageSnapshot | null; // Host page state when reader was opened
  entryPageKind: PageKind | null; // page kind when reader was opened
  pendingHostOverlayCleanup: boolean; // deferred until the hidden host page is restored
}

// Global app state
const appState: AppState = {
  isInitialized: false,
  autoEnableDone: false,
  isActive: false,
  currentDecision: null,
  originalHostPage: null,
  entryPageKind: null,
  pendingHostOverlayCleanup: false,
};

// Vue app instance
let app: ReturnType<typeof createApp> | null = null;
let pinia: ReturnType<typeof createPinia> | null = null;
let initialization: Promise<void> | null = null;
let readerCleanup: (() => void) | null = null;
let readerEntryApp: ReturnType<typeof createApp> | null = null;
let readerEntryCleanup: (() => void) | null = null;

function shouldEnableEarlyProtection(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    const path = u.pathname.toLowerCase();
    // Exclude common non-reading pages
    if (/(login|register|signup|search|rank|category|tag|author|help|about|contact)/.test(path)) {
      return false;
    }
    if (/(index|list|catalog|toc|contents?)\.html?$/.test(path) || /\/(catalog|toc)\//.test(path)) {
      return false;
    }

    // Common chapter-ish patterns
    if (/\/(chapter|txt|read|article)\//.test(path) && /\d/.test(path)) return true;
    if (/\/(book|novel|xiaoshuo)\//.test(path) && /\d/.test(path) && /\.html?$/.test(path)) {
      return true;
    }
    if (/\d{3,}[^/]*\.html?$/.test(path)) return true;

    return false;
  } catch {
    return false;
  }
}

// Activate minimal protection as early as possible to block mobile ad-tech redirects.
// This is intentionally conservative and will be reconfigured after settings are loaded.
// Keep this phase reversible. Irreversible cleanup belongs to explicit aggressive mode.
try {
  if (shouldEnableEarlyProtection(window.location.href)) {
    getSiteProtection().activate({
      blockRedirects: true,
      blockPopups: true,
      clearTimers: false,
      enableRightClick: false,
      enableSelection: false,
      enableCopy: false,
      unlockKeyboard: false,
      removeEventHijacking: false,
      blockVisibilityDetection: false,
      cleanupScripts: false,
    });
  }
} catch (e) {
  console.error('[MNR] Early protection error:', e);
}

/**
 * Initialize the application
 */
export async function initialize(): Promise<void> {
  await ensureInitialized();
  if (!appState.isInitialized) return;
  if (appState.autoEnableDone || appState.isActive) return;

  appState.autoEnableDone = true;
  await runAutoEnable();
}

async function ensureInitialized(): Promise<void> {
  if (appState.isInitialized) return;

  if (!initialization) {
    initialization = (async () => {
      console.log(`[MNR] YingChuang v${VERSION} (${BUILD_DATE})`);
      try {
        const stores = createPinia();
        await useConfigStore(stores).load();
        pinia = stores;
        appState.isInitialized = true;
      } catch (e) {
        console.error('[MNR] Initialization error:', e);
        getSiteProtection().deactivate();
      }
    })();
  }
  await initialization;
  initialization = null;
}

/**
 * Run the auto-enable flow
 */
async function runAutoEnable(): Promise<void> {
  const configStore = useConfigStore(pinia!);
  const protectionOptions = toProtectionOptions(configStore.protection);

  // Ensure the singleton is initialized with the current runtime options even if we skip auto-enable.
  const manager = getAutoEnableManager({
    enableProtection: true,
    protectionOptions,
  });

  // First, check the decision to handle user-disabled case
  const decision = manager.check(document);
  appState.currentDecision = decision;

  // If user previously disabled auto-enable, keep only the manual entry.
  if (decision.method === 'user-disabled' || decision.showManualEntry) {
    getSiteProtection().deactivate();
    showReaderEntry();
    return;
  }

  // If no auto-enable or manual entry is needed, stop here.
  if (!decision.shouldEnable) {
    getSiteProtection().deactivate();
    return;
  }

  // Set up prompt callback
  manager.setPromptCallback(showPrompt);

  // Set up launch callback
  manager.setLaunchCallback(launchReader);

  // Execute the flow (will use cached decision)
  await manager.execute(document);

  // If an explicit/detected chapter page failed to auto-launch, keep a manual entry visible.
  if (!appState.isActive && decision.shouldEnable) {
    getSiteProtection().deactivate();
    showReaderEntry();
  }
}

/**
 * Show detection prompt to user
 */
async function showPrompt(): Promise<{
  accepted: boolean;
  rememberForSite: boolean;
}> {
  return new Promise(resolve => {
    // Create Shadow DOM mount point for CSS isolation
    const { mountPoint, cleanup } = createShadowMount('mnr-entry-prompt-root');

    // Track response
    const promptVisible = ref(true);
    let promptApp: ReturnType<typeof createApp> | null = null;
    let settled = false;

    const finish = (response: { accepted: boolean; rememberForSite: boolean }) => {
      if (settled) return;
      settled = true;
      promptVisible.value = false;
      window.setTimeout(() => {
        promptApp?.unmount();
        promptApp = null;
        cleanup();
        resolve(response);
      }, 300);
    };

    // Create prompt component wrapper
    const PromptWrapper = defineComponent({
      setup() {
        const handleRespond = (response: { accepted: boolean; rememberForSite: boolean }) => {
          finish(response);
        };

        return () =>
          h(ReaderEntryPrompt, {
            visible: promptVisible.value,
            onRespond: handleRespond,
          });
      },
    });

    try {
      promptApp = createApp(PromptWrapper);
      promptApp.mount(mountPoint);
    } catch (e) {
      settled = true;
      cleanup();
      console.error('[MNR] Failed to mount reader entry prompt:', e);
      resolve({ accepted: false, rememberForSite: false });
    }
  });
}

/**
 * Launch the reader, then keep feeding it the chapter's remaining section pages.
 */
function launchReader(event: LaunchEvent): LaunchContinuation | void {
  if (!pinia) {
    console.error('[MNR] Pinia not initialized');
    return;
  }

  const readerStore = useReaderStore(pinia);

  if (appState.isActive) return;

  const { chapter, rule } = event;

  hideReaderEntry();

  // Save host page state before the reader modifies title/URL.
  recordDebugEvent('bootstrap.launchReader', {
    url: chapter.url,
    title: chapter.title,
    ruleId: rule?.id || chapter.rule?.id,
  });
  appState.originalHostPage = captureHostPageSnapshot();
  const pageKind = getPageKind(window.location.href, document);
  appState.entryPageKind = pageKind === 'chapter' || rule || chapter.rule ? 'chapter' : pageKind;

  // Update reader store
  readerStore.activate();
  const entryId = readerStore.setChapter(chapter, rule);
  if (event.stage === 'initial') {
    // Register after setChapter, which tears down the previous session's merges.
    readerStore.beginChapterSections(entryId, event.progress, event.abort);
  }

  appState.isActive = true;

  // Mount reader UI
  mountReaderUI();

  if (event.stage === 'initial') {
    // The store owns cancellation and serialization. Late writes can only address this entry.
    return async update => {
      if (update.stage === 'append') {
        await readerStore.appendChapterSection(entryId, {
          ...update.delta,
          loaded: update.progress.loaded,
          total: update.progress.total,
        });
      } else if (update.stage === 'complete') {
        await readerStore.completeChapterSections(entryId, update.chapter, update.rule, {
          truncated: update.truncated,
        });
      } else {
        readerStore.cancelChapterSections(entryId, update.reason);
      }
    };
  }
}

/**
 * Mount the reader UI
 */
function mountReaderUI(): void {
  // Check if already mounted
  if (document.getElementById('mnr-reader-root')) {
    return;
  }

  // Create Shadow DOM mount point for CSS isolation
  const { mountPoint, cleanup } = createShadowMount('mnr-reader-root');
  readerCleanup = cleanup;

  // Create and mount app with explicit callbacks so UI components do not import bootstrap.
  app = createApp(ReaderView, {
    siteAutoEnable: getCurrentSiteAutoEnable(),
    onCopyDiagnostics: () => {
      void copyDiagnosticsFromMenu();
    },
    onExit: closeReader,
    onProtectionModeChange: setProtectionMode,
    onSiteAutoEnableChange: setCurrentSiteAutoEnable,
  });
  app.use(pinia!);
  app.mount(mountPoint);

  // Hide original page content
  hideOriginalContent();
}

/**
 * Hide the original page content
 */
function hideOriginalContent(): void {
  const style = document.createElement('style');
  style.id = 'mnr-hide-original';
  style.textContent = `
    body > *:not(#mnr-reader-root):not(#mnr-entry-prompt-root):not(script):not(style) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function cleanupHostPageOverlays(): void {
  try {
    getSiteProtection().removeOverlays();
  } catch (e) {
    console.error('[MNR] Failed to clean host page overlays:', e);
  }
}

function normalizeExitDestination(url: string): string {
  const normalized = normalizeUrlForFetch(url);
  try {
    const parsed = new URL(normalized);
    // Canonical redirects commonly change only the HTTP scheme or add/remove www.
    // Treat those as the same destination without accepting unrelated host aliases.
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      parsed.protocol = 'https:';
      parsed.hostname = parsed.hostname.replace(/^www\./i, '');
    }
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return normalized.replace(/\/+$/, '');
  }
}

function getUserscriptTabState(): Promise<UserscriptTabState> {
  return new Promise(resolve => GM_getTab(resolve));
}

async function persistExitNavigation(transition: ExitNavigation): Promise<void> {
  if (!hasTabStorage) {
    sessionStorage.setItem(EXIT_NAVIGATION_KEY, JSON.stringify(transition));
    return;
  }
  const tab = await getUserscriptTabState();
  tab[EXIT_NAVIGATION_KEY] = transition;
  GM_saveTab(tab);
}

/** Consume the one-shot transition created when the reader exits onto another chapter. */
async function consumeExitNavigation(): Promise<boolean> {
  let transition: ExitNavigation | undefined;
  if (hasTabStorage) {
    const tab = await getUserscriptTabState();
    transition = tab[EXIT_NAVIGATION_KEY];
    if (transition) {
      delete tab[EXIT_NAVIGATION_KEY];
      GM_saveTab(tab);
    }
  } else {
    // This path is tab-local and same-origin; it cannot follow cross-origin redirects.
    try {
      const serialized = sessionStorage.getItem(EXIT_NAVIGATION_KEY);
      if (serialized) {
        sessionStorage.removeItem(EXIT_NAVIGATION_KEY);
        transition = JSON.parse(serialized) as ExitNavigation;
      }
    } catch (e) {
      console.error('[MNR] Failed to read exit navigation:', e);
    }
  }
  if (!transition || typeof transition.targetUrl !== 'string') return false;
  // The next document owns this one-shot intent, even if navigation landed elsewhere.
  if (
    normalizeExitDestination(transition.targetUrl) !==
    normalizeExitDestination(window.location.href)
  ) {
    return false;
  }

  appState.autoEnableDone = true;
  getSiteProtection().deactivate();
  if (transition.cleanupHostOverlays === true) cleanupHostPageOverlays();
  showReaderEntry();
  return true;
}

/**
 * Close the reader and restore original page
 */
export function closeReader(): void {
  if (!appState.isActive) return;

  recordDebugEvent('bootstrap.closeReader');
  const entryPageKind = appState.entryPageKind;

  // Get current chapter URL before closing
  let targetUrl: string | null = null;

  if (pinia) {
    const readerStore = useReaderStore(pinia);
    const currentIndex = readerStore.currentChapterIndex;
    const chapter = readerStore.chapters[currentIndex];

    if (chapter?.chapter.url) {
      targetUrl = chapter.chapter.url;
    }
  }

  // Get the original page state (saved when reader was opened)
  const originalHostPage = appState.originalHostPage;
  const originalUrl = originalHostPage?.url || null;
  const navigationTarget =
    targetUrl &&
    originalUrl &&
    normalizeUrlForFetch(targetUrl) !== normalizeUrlForFetch(originalUrl)
      ? targetUrl
      : null;
  const cleanupHostOverlays = appState.pendingHostOverlayCleanup;
  appState.pendingHostOverlayCleanup = false;

  // Unmount app
  if (app) {
    app.unmount();
    app = null;
  }

  getSiteProtection().deactivate();

  // Cleanup Shadow DOM
  if (readerCleanup) {
    readerCleanup();
    readerCleanup = null;
  }

  // Restore original content
  const hideStyle = document.getElementById('mnr-hide-original');
  if (hideStyle) {
    hideStyle.remove();
  }

  // While the reader is open, the host page is display:none and overlay geometry is unavailable.
  // Run a newly selected aggressive-mode cleanup after revealing the host, before the next paint.
  if (cleanupHostOverlays && !navigationTarget) {
    cleanupHostPageOverlays();
  }

  // Update state
  if (pinia) {
    const readerStore = useReaderStore(pinia);
    readerStore.deactivate();
  }

  appState.isActive = false;
  appState.originalHostPage = null; // Clear saved host page state
  appState.entryPageKind = null;

  // If current chapter URL is different from the original page URL,
  // navigate to the target URL so page content matches what user was reading
  // Chapter URLs are canonicalized (no hash, no redundant ?page=1); compare the same way so
  // closing on the entry chapter restores in place instead of reloading.
  if (navigationTarget) {
    // Tampermonkey tab state follows this navigation across origins without leaking into other
    // tabs or long-lived script storage. Save it before navigating so the destination can consume
    // the one-shot transition even after a canonical redirect.
    void persistExitNavigation({
      targetUrl: normalizeExitDestination(navigationTarget),
      cleanupHostOverlays,
    })
      .catch(e => console.error('[MNR] Failed to save exit navigation:', e))
      .finally(() => {
        window.location.href = navigationTarget;
      });
    return; // The next page load will decide whether to show the manual entry.
  }

  restoreHostPageSnapshot(originalHostPage);

  // Keep a manual re-entry on chapter pages.
  if (entryPageKind === 'chapter') {
    showReaderEntry();
  }
}

function getCurrentSiteAutoEnable(): boolean {
  try {
    const hostname = new URL(window.location.href).hostname;
    return getRuleStorage().getSitePreference(hostname)?.enabled !== false;
  } catch {
    return true;
  }
}

function setCurrentSiteAutoEnable(enabled: boolean): void {
  try {
    const hostname = new URL(window.location.href).hostname;
    getRuleStorage().setSitePreference(hostname, { enabled, timestamp: Date.now() });
  } catch (e) {
    console.error('[MNR] Failed to update site auto-enable preference:', e);
  }
}

async function setProtectionMode(mode: 'standard' | 'aggressive'): Promise<void> {
  if (!pinia) return;
  const configStore = useConfigStore(pinia);
  const previousMode = configStore.protection.mode;
  configStore.updateProtection({ mode });

  if (previousMode !== mode) {
    // Overlay cleanup is intentionally destructive and needs visible host-page geometry. Defer it
    // until closeReader removes the host-hiding stylesheet; switching back cancels the pending pass.
    appState.pendingHostOverlayCleanup = mode === 'aggressive';
  }

  getSiteProtection().activate(toProtectionOptions(configStore.protection));
  await configStore.flushSave();
}

/** Show the isolated manual entry without initializing reader state. */
function showReaderEntry(): void {
  if (appState.isActive || readerEntryApp) return;

  const { mountPoint, cleanup } = createShadowMount('mnr-entry-root');
  readerEntryCleanup = cleanup;

  try {
    readerEntryApp = createApp(ReaderEntryButton, {
      onEnter: () => {
        manualEnable().catch(e => console.error('[MNR] Manual enable error:', e));
      },
    });
    readerEntryApp.mount(mountPoint);
  } catch (e) {
    readerEntryApp = null;
    readerEntryCleanup = null;
    cleanup();
    console.error('[MNR] Failed to mount reader entry:', e);
  }
}

/** Remove the manual entry and release its Shadow DOM registration. */
function hideReaderEntry(): void {
  readerEntryApp?.unmount();
  readerEntryApp = null;
  readerEntryCleanup?.();
  readerEntryCleanup = null;
}

/**
 * Manually enter reading mode.
 */
export async function manualEnable(): Promise<void> {
  // Already reading: re-parsing the host page would only repeat requests and protection setup.
  if (appState.isActive) return;
  const currentUrl = window.location.href;
  recordDebugEvent('bootstrap.manualEnable', { url: currentUrl });
  hideReaderEntry();

  try {
    await ensureInitialized();
    if (!pinia || appState.isActive) return;
    appState.autoEnableDone = true;

    const configStore = useConfigStore(pinia);
    const protectionOptions = toProtectionOptions(configStore.protection);

    const manager = getAutoEnableManager({
      enableProtection: true,
      protectionOptions,
    });
    manager.setLaunchCallback(launchReader);
    await manager.manualEnable(document);
  } finally {
    if (!appState.isActive && isReaderEntryPage(currentUrl, document)) {
      showReaderEntry();
    }
  }
}

/**
 * Check if reader is active
 */
export function isActive(): boolean {
  return appState.isActive;
}

/**
 * Get version info
 */
export function getVersion(): { version: string; buildDate: string } {
  return { version: VERSION, buildDate: BUILD_DATE };
}

export function getAppDebugSnapshot(): BootstrapDebugSnapshot {
  const decision = appState.currentDecision;

  return {
    isInitialized: appState.isInitialized,
    autoEnableDone: appState.autoEnableDone,
    isActive: appState.isActive,
    entryPageKind: appState.entryPageKind,
    currentDecision: decision
      ? toDebugValue({
          shouldEnable: decision.shouldEnable,
          method: decision.method,
          confidence: decision.confidence,
          reasons: decision.reasons,
          showManualEntry: decision.showManualEntry,
          ruleId: decision.rule?.id,
        })
      : null,
    originalHostPage: appState.originalHostPage
      ? toDebugValue({
          url: redactUrl(appState.originalHostPage.url),
          title: appState.originalHostPage.title,
          state: appState.originalHostPage.state,
        })
      : null,
  };
}

// Auto-initialize when DOM is ready
function isTopFrame(): boolean {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

function registerMenuCommands(): void {
  if (!isTopFrame()) return;
  if (typeof GM_registerMenuCommand !== 'function') return;

  GM_registerMenuCommand('进入阅读模式', () => {
    manualEnable().catch(e => console.error('[MNR] Manual enable error:', e));
  });

  GM_registerMenuCommand('复制诊断信息', () => {
    copyDiagnosticsFromMenu().catch(e => console.error('[MNR] Copy diagnostics error:', e));
  });
}

async function copyDiagnosticsFromMenu(): Promise<void> {
  await ensureInitialized();

  const readerStore = pinia ? useReaderStore(pinia) : null;
  const configStore = pinia ? useConfigStore(pinia) : null;
  const notify =
    readerStore?.isActive === true
      ? (message: string, type: 'info' | 'error' = 'info') => readerStore.showToast(message, type)
      : undefined;

  const result = await copyDiagnosticInfo({
    readerStore,
    configStore,
    bootstrap: getAppDebugSnapshot(),
    notify,
  });

  if (notify) return;
  if (result.ok) {
    console.info('[MNR] 诊断信息已复制');
  } else {
    console.error('[MNR] 诊断信息复制失败:', result.error);
  }
}

async function bootstrap(): Promise<void> {
  registerMenuCommands();

  if (!isTopFrame()) return;
  installGlobalDebugErrorListeners();
  if (appState.isActive) return;
  if (await consumeExitNavigation()) return;

  const url = window.location.href;
  if (!isReaderEntryPage(url, document)) {
    getSiteProtection().deactivate();
    return;
  }

  // If auto-enable is disabled, avoid store initialization and keep a lightweight manual entry.
  try {
    const hostname = new URL(url).hostname;
    const pref = getRuleStorage().getSitePreference(hostname);
    if (pref?.enabled === false) {
      getSiteProtection().deactivate();
      showReaderEntry();
      return;
    }
  } catch (e) {
    console.debug('[MNR] Failed to read site preference:', e);
  }

  await initialize();
}

function isReaderEntryPage(url: string, doc: Document): boolean {
  const urlKind = getPageKindFromUrl(url);
  if (urlKind === 'chapter') return true;
  if (urlKind === 'toc') return false;

  try {
    const manager = getRuleManager();
    if (manager.matchRule(url) !== null) return true;
  } catch (e) {
    console.debug('[MNR] Failed to match reader entry rule:', e);
  }

  return getPageKind(url, doc) === 'chapter';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(e => console.error('[MNR] Bootstrap error:', e));
  });
} else {
  bootstrap().catch(e => console.error('[MNR] Bootstrap error:', e));
}

// Export for manual control
export { VERSION, BUILD_DATE };
