/**
 * Shadow DOM Mount Utilities
 *
 * Provides CSS isolation for Vue components by mounting them inside Shadow DOM.
 * This prevents host page CSS from interfering with our UI components.
 */

interface MnrGlobalState {
  styles?: string;
  shadowRoots?: Set<ShadowRoot>;
  styleProperties?: Record<string, string>;
  customCSS?: string;
}

declare global {
  interface Window {
    __MY_NOVEL_READER__?: MnrGlobalState;
  }
}

function getMnrGlobalState(): MnrGlobalState {
  if (!window.__MY_NOVEL_READER__) {
    window.__MY_NOVEL_READER__ = {};
  }
  return window.__MY_NOVEL_READER__;
}

function getRegisteredShadowRoots(state: MnrGlobalState): Set<ShadowRoot> {
  if (!state.shadowRoots) {
    state.shadowRoots = new Set();
  }
  return state.shadowRoots;
}

interface ShadowMountResult {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  mountPoint: HTMLElement;
  cleanup: () => void;
}

/**
 * Base CSS reset for Shadow DOM container
 * Ensures our components start from a clean slate
 */
const BASE_RESET_CSS = `
/* Reset all inherited styles */
:host {
  all: initial;
  display: block;
  font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Ensure common elements have expected defaults */
*, *::before, *::after {
  box-sizing: border-box;
}

/* Reset form elements to browser defaults */
input, button, select, textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  margin: 0;
}

input[type="checkbox"],
input[type="radio"] {
  appearance: auto;
  -webkit-appearance: checkbox;
  width: auto;
  height: auto;
  margin: 3px 3px 3px 4px;
  cursor: pointer;
}

input[type="range"] {
  appearance: auto;
  -webkit-appearance: slider-horizontal;
}

button {
  appearance: auto;
  cursor: pointer;
}

select {
  appearance: auto;
  -webkit-appearance: menulist;
}

textarea {
  appearance: auto;
  -webkit-appearance: textarea;
  resize: vertical;
}

/* Link defaults */
a {
  color: var(--mnr-link, #1976d2);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* List defaults */
ul, ol {
  padding-left: 2em;
}

/* Ensure visibility */
* {
  visibility: visible !important;
}
`;

function ensureStyleElement(shadowRoot: ShadowRoot, id: string): HTMLStyleElement {
  const existing = shadowRoot.querySelector(`#${id}`);
  if (existing?.tagName?.toLowerCase() === 'style') return existing as HTMLStyleElement;

  const style = document.createElement('style');
  style.id = id;
  shadowRoot.appendChild(style);
  return style;
}

function applyStyleProperties(shadowRoot: ShadowRoot, properties: Record<string, string>): void {
  const host = shadowRoot.host as HTMLElement | null;
  if (!host?.style) return;

  for (const [name, value] of Object.entries(properties)) {
    host.style.setProperty(name, value);
  }
}

function applyCustomCSS(shadowRoot: ShadowRoot, css: string): void {
  const customStyle = shadowRoot.querySelector('#mnr-custom-css') as HTMLStyleElement | null;
  if (css) {
    const style = customStyle || ensureStyleElement(shadowRoot, 'mnr-custom-css');
    style.textContent = css;
  } else {
    customStyle?.remove();
  }
}

function applyRuntimeStyles(shadowRoot: ShadowRoot, state = getMnrGlobalState()): void {
  if (state.styleProperties) applyStyleProperties(shadowRoot, state.styleProperties);
  applyCustomCSS(shadowRoot, state.customCSS || '');
}

function applyAppStyles(shadowRoot: ShadowRoot, state = getMnrGlobalState()): void {
  if (!state.styles) return;

  const appStyle = ensureStyleElement(shadowRoot, 'mnr-app-styles');
  appStyle.textContent = state.styles;
}

export function setShadowStyleProperties(properties: Record<string, string>): void {
  const state = getMnrGlobalState();
  state.styleProperties ||= {};
  Object.assign(state.styleProperties, properties);
  for (const shadowRoot of getRegisteredShadowRoots(state)) {
    applyStyleProperties(shadowRoot, properties);
  }
}

export function setShadowCustomCSS(css: string): void {
  const state = getMnrGlobalState();
  state.customCSS = css;
  for (const shadowRoot of getRegisteredShadowRoots(state)) {
    applyCustomCSS(shadowRoot, css);
  }
}

/**
 * Create a Shadow DOM mount point for Vue components
 *
 * @param hostId - ID for the host element
 * @returns Shadow mount result with host, shadowRoot, mountPoint, and cleanup function
 */
export function createShadowMount(hostId: string): ShadowMountResult {
  const globalState = getMnrGlobalState();

  // Create host element
  const host = document.createElement('div');
  host.id = hostId;
  host.lang = 'zh-CN';
  document.body.appendChild(host);

  // Create Shadow DOM
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Store shadow root globally for CSS injection
  getRegisteredShadowRoots(globalState).add(shadowRoot);

  // Create style element with reset CSS
  const resetStyle = document.createElement('style');
  resetStyle.textContent = BASE_RESET_CSS;
  shadowRoot.appendChild(resetStyle);

  // Inject any previously collected app/config CSS
  applyAppStyles(shadowRoot, globalState);
  applyRuntimeStyles(shadowRoot, globalState);

  // Create mount point inside Shadow DOM
  const mountPoint = document.createElement('div');
  mountPoint.id = `${hostId}-mount`;
  shadowRoot.appendChild(mountPoint);

  // Cleanup function
  const cleanup = () => {
    host.remove();
    globalState.shadowRoots?.delete(shadowRoot);
    if (globalState.shadowRoots?.size === 0) {
      globalState.shadowRoots = undefined;
    }
  };

  return { host, shadowRoot, mountPoint, cleanup };
}

/**
 * Inject additional CSS into the Shadow DOM
 *
 * @param shadowRoot - Target Shadow DOM
 * @param css - CSS string to inject
 */
export function injectShadowCSS(shadowRoot: ShadowRoot, css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  shadowRoot.appendChild(style);
}
