/**
 * Config Store - Manages user settings
 */

import { ref, watch } from 'vue';
import { setShadowCustomCSS, setShadowStyleProperties } from '@/ui/shadowMount';
import { defineStore } from 'pinia';
import type { ProtectionOptions } from '@/core/protection';

/** Theme definition */
export interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  onLink: string;
  border: string;
  /** Destructive actions and errors; readable on this theme's background. */
  danger: string;
}

/** Reading settings */
export interface ReadingSettings {
  /** Font family */
  fontFamily: string;
  /** Font size (px) */
  fontSize: number;
  /** Line height (em) */
  lineHeight: number;
  /** Letter spacing (em) */
  letterSpacing: number;
  /** Paragraph indent (em) */
  paragraphIndent: number;
  /** Content max width (px) */
  maxWidth: number;
  /** Content padding (px) */
  padding: number;
  /** Text conversion mode: 'none' | 'sc' (simplified) | 'tc' (traditional) */
  textConversion: 'none' | 'sc' | 'tc';
}

/** Behavior settings */
export interface BehaviorSettings {
  /** Enable keyboard navigation */
  keyboardNavigation: boolean;
  /** Enable swipe gestures */
  swipeGestures: boolean;
  /** Auto hide header on scroll */
  autoHideHeader: boolean;
  /** Preload next chapter */
  preloadNext: boolean;
  /** Show progress indicator */
  showProgress: boolean;
}

/** Protection settings */
type ProtectionMode = 'standard' | 'aggressive';

export interface ProtectionSettings {
  /** Protection mode */
  mode: ProtectionMode;
  /** Block redirects */
  blockRedirects: boolean;
  /** Enable right-click */
  enableRightClick: boolean;
  /** Enable text selection */
  enableSelection: boolean;
  /** Block popups */
  blockPopups: boolean;
}

// Built-in reading themes. Long-form text keeps >= 8:1 contrast without the glare of pure
// black on pure white; muted UI text is derived in CSS (see shadowMount).
export const PAPER_THEME: Theme = {
  id: 'light',
  name: '纸白',
  background: '#f6f4ef',
  text: '#2e2c29',
  link: '#2b5f9e',
  onLink: '#ffffff',
  border: '#e2ddd3',
  danger: '#b3261e',
};

export const NIGHT_THEME: Theme = {
  id: 'dark',
  name: '夜间',
  background: '#1c1c1e',
  text: '#b8b4ab',
  link: '#8ab4d8',
  onLink: '#111111',
  border: '#34332f',
  danger: '#f28b82',
};

export const THEMES: Theme[] = [
  // Never applied itself: resolves to paper or night. Its colors only back the swatch.
  { ...PAPER_THEME, id: 'system', name: '自动' },
  PAPER_THEME,
  {
    id: 'sepia',
    name: '米黄',
    background: '#f3e9d2',
    text: '#433526',
    link: '#7a4a1e',
    onLink: '#ffffff',
    border: '#e0d3b8',
    danger: '#a8261b',
  },
  {
    id: 'green',
    name: '豆沙绿',
    background: '#d6e8d0',
    text: '#26342a',
    link: '#2c5f36',
    onLink: '#ffffff',
    border: '#bcd3b5',
    danger: '#9c2218',
  },
  NIGHT_THEME,
];

// Default settings
const DEFAULT_READING: ReadingSettings = {
  fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  paragraphIndent: 2,
  maxWidth: 800,
  padding: 20,
  textConversion: 'none',
};

const DEFAULT_BEHAVIOR: BehaviorSettings = {
  keyboardNavigation: true,
  swipeGestures: true,
  autoHideHeader: true,
  preloadNext: true,
  showProgress: true,
};

const DEFAULT_PROTECTION: ProtectionSettings = {
  mode: 'standard',
  blockRedirects: true,
  enableRightClick: true,
  enableSelection: true,
  blockPopups: true,
};

export function toProtectionOptions(settings: ProtectionSettings): ProtectionOptions {
  const aggressive = settings.mode === 'aggressive';

  return {
    blockRedirects: settings.blockRedirects,
    enableRightClick: settings.enableRightClick,
    enableSelection: settings.enableSelection,
    blockPopups: settings.blockPopups,
    clearTimers: aggressive,
    unlockKeyboard: true,
    cleanupScripts: aggressive,
    // The reader shares the host document: faking visibility would also hide tab switches from
    // the reader's own position flush and preload pause.
    blockVisibilityDetection: false,
  };
}

// Storage key
const STORAGE_KEY = 'mnr-config';
const SAVE_DEBOUNCE_MS = 300;

export const useConfigStore = defineStore('config', () => {
  // State
  const themeId = ref('system');
  const reading = ref<ReadingSettings>({ ...DEFAULT_READING });
  const behavior = ref<BehaviorSettings>({ ...DEFAULT_BEHAVIOR });
  const protection = ref<ProtectionSettings>({ ...DEFAULT_PROTECTION });
  const customCSS = ref('');
  const customCleanupRegex = ref('');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let savePending = false;
  let saveQueue = Promise.resolve();
  let isHydrating = false;

  // Computed
  const theme = (): Theme => {
    if (themeId.value === 'system') {
      const prefersDark =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? NIGHT_THEME : PAPER_THEME;
    }
    return THEMES.find(t => t.id === themeId.value) || PAPER_THEME;
  };

  // Actions
  function setTheme(id: string) {
    if (THEMES.some(t => t.id === id)) {
      themeId.value = id;
      applyTheme();
    }
  }

  function updateReading(settings: Partial<ReadingSettings>) {
    Object.assign(reading.value, settings);
    applyReading(settings);
  }

  function updateBehavior(settings: Partial<BehaviorSettings>) {
    Object.assign(behavior.value, settings);
  }

  function updateProtection(settings: Partial<ProtectionSettings>) {
    Object.assign(protection.value, settings);
  }

  function setCustomCSS(css: string) {
    customCSS.value = css;
    applyCustomCSS();
  }

  function setCustomCleanupRegex(source: string) {
    customCleanupRegex.value = source;
  }

  function applyTheme() {
    const t = theme();
    setShadowStyleProperties({
      '--mnr-bg': t.background,
      '--mnr-text': t.text,
      '--mnr-link': t.link,
      '--mnr-on-link': t.onLink,
      '--mnr-border': t.border,
      '--mnr-danger': t.danger,
    });
  }

  function applyReading(settings: Partial<ReadingSettings> = reading.value) {
    const properties: Record<string, string> = {};
    if (settings.fontFamily !== undefined) {
      properties['--mnr-font-family'] = settings.fontFamily;
    }
    if (settings.fontSize !== undefined) {
      properties['--mnr-font-size'] = `${settings.fontSize}px`;
    }
    if (settings.lineHeight !== undefined) {
      properties['--mnr-line-height'] = `${settings.lineHeight}`;
    }
    if (settings.letterSpacing !== undefined) {
      properties['--mnr-letter-spacing'] = `${settings.letterSpacing}em`;
    }
    if (settings.paragraphIndent !== undefined) {
      properties['--mnr-paragraph-indent'] = `${settings.paragraphIndent}em`;
    }
    if (settings.maxWidth !== undefined) {
      properties['--mnr-max-width'] = `${settings.maxWidth}px`;
    }
    if (settings.padding !== undefined) {
      properties['--mnr-padding'] = `${settings.padding}px`;
    }
    if (Object.keys(properties).length > 0) setShadowStyleProperties(properties);
  }

  function applyCustomCSS() {
    setShadowCustomCSS(customCSS.value);
  }

  function applyAll() {
    applyTheme();
    applyReading();
    applyCustomCSS();
  }

  // Persistence
  async function load() {
    isHydrating = true;
    try {
      let data: unknown = null;
      let hasInvalidData = false;

      // Try GM_getValue first
      if (typeof GM_getValue !== 'undefined') {
        data = await GM_getValue<unknown>(STORAGE_KEY, null);
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        data = stored;
      }

      if (data) {
        let parsed: unknown;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            console.error('[ConfigStore] Failed to parse config JSON:', e);
            hasInvalidData = true;
            parsed = null;
          }
        } else {
          parsed = data;
        }

        // Validate parsed data is an object
        if (!hasInvalidData && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
          console.warn('[ConfigStore] Invalid config data, expected object');
          hasInvalidData = true;
        }

        if (!hasInvalidData) {
          const config = parsed as Record<string, unknown>;

          // Validate and apply each field with type checking
          if (THEMES.some(t => t.id === config.themeId)) {
            themeId.value = config.themeId as string;
          }
          if (config.reading && typeof config.reading === 'object') {
            reading.value = {
              ...DEFAULT_READING,
              ...(config.reading as Partial<typeof DEFAULT_READING>),
            };
          }
          if (config.behavior && typeof config.behavior === 'object') {
            behavior.value = {
              ...DEFAULT_BEHAVIOR,
              ...(config.behavior as Partial<typeof DEFAULT_BEHAVIOR>),
            };
          }
          if (config.protection && typeof config.protection === 'object') {
            protection.value = {
              ...DEFAULT_PROTECTION,
              ...(config.protection as Partial<typeof DEFAULT_PROTECTION>),
            };
          }
          if (typeof config.customCSS === 'string') {
            customCSS.value = config.customCSS;
          }
          if (typeof config.customCleanupRegex === 'string') {
            customCleanupRegex.value = config.customCleanupRegex;
          }
        }
      }

      applyAll();

      // Repair corrupted data so users aren't stuck with repeated parse failures.
      if (hasInvalidData) {
        console.warn('[ConfigStore] Corrupted config detected; resetting to defaults');
        await save();
      }
    } catch (e) {
      console.error('[ConfigStore] Load error:', e);
    } finally {
      isHydrating = false;
    }
  }

  function serialize(): string {
    return JSON.stringify({
      themeId: themeId.value,
      reading: reading.value,
      behavior: behavior.value,
      protection: protection.value,
      customCSS: customCSS.value,
      customCleanupRegex: customCleanupRegex.value,
    });
  }

  function save(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    savePending = false;
    const data = serialize();

    saveQueue = saveQueue
      .then(async () => {
        if (typeof GM_setValue !== 'undefined') {
          await GM_setValue(STORAGE_KEY, data);
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, data);
        }
      })
      .catch(e => console.error('[ConfigStore] Save error:', e));

    return saveQueue;
  }

  function scheduleSave(): void {
    savePending = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void save();
    }, SAVE_DEBOUNCE_MS);
  }

  function flushSave(): Promise<void> {
    return savePending ? save() : saveQueue;
  }

  // Auto-save on changes
  watch(
    [themeId, reading, behavior, protection, customCSS, customCleanupRegex],
    () => {
      if (!isHydrating) scheduleSave();
    },
    { deep: true, flush: 'sync' }
  );

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    systemTheme.addEventListener?.('change', () => {
      if (themeId.value === 'system') applyTheme();
    });
  }

  function $reset() {
    themeId.value = 'system';
    reading.value = { ...DEFAULT_READING };
    behavior.value = { ...DEFAULT_BEHAVIOR };
    protection.value = { ...DEFAULT_PROTECTION };
    customCSS.value = '';
    customCleanupRegex.value = '';
    applyAll();
    void save();
  }

  function resetReading() {
    reading.value = { ...DEFAULT_READING };
    applyReading();
  }

  return {
    // State
    themeId,
    reading,
    behavior,
    protection,
    customCSS,
    customCleanupRegex,

    // Getters
    theme,

    // Actions
    setTheme,
    updateReading,
    updateBehavior,
    updateProtection,
    setCustomCSS,
    setCustomCleanupRegex,
    resetReading,
    applyTheme,
    applyReading,
    applyAll,
    load,
    save,
    flushSave,
    $reset,
  };
});
