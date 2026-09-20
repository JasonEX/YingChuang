/**
 * SiteRule types used by curated built-in rules.
 */

/** Replace rule for content processing */
export interface ReplaceRule {
  /** Regex pattern string */
  pattern: string;
  /** Replacement string */
  replacement: string;
  /** Regex flags (default: 'g') */
  flags?: string;
}

/** URL matching configuration */
interface UrlMatcher {
  /** Regex pattern or glob string */
  pattern: string;
  /** Pattern type (default: 'regex') */
  type?: 'regex' | 'glob';
  /** URL patterns to exclude */
  exclude?: string[];
}

/** Content configuration */
interface ContentConfig {
  /** CSS selector for content area */
  selector: string;
  /** Selectors to remove from content */
  remove?: string;
  /** Text replacement rules */
  replace?: ReplaceRule[];
}

/** Navigation configuration */
interface NavigationConfig {
  /** Next chapter selector (false to disable auto-detection) */
  next?: string | false;
  /** Previous chapter selector */
  prev?: string | false;
  /** Index/TOC selector */
  index?: string | false;
}

/** Table of contents (TOC) parsing configuration */
interface TocConfig {
  /** Main chapter-list containers. When set, do not collect links outside them. */
  selector?: string;
  /**
   * Exclude TOC links that are inside these ancestor containers.
   * Comma-separated CSS selectors. If any selector matches `a.closest(sel)`,
   * the link will be skipped.
   *
   * Example (Faloo): '.c_con_relation' to exclude "作品相关/小说相关" section.
   */
  excludeAncestors?: string;
}

/** Title configuration */
interface TitleConfig {
  /** CSS selector for chapter title */
  selector?: string;
  /** Regex pattern to extract from document.title */
  pattern?: string;
  /** Capture group index for chapter title (default: 1) */
  patternIndex?: number;
  /** Capture group index for book title (optional) */
  bookPatternIndex?: number;
  /** Cleanup pattern */
  replace?: string;
  /** Book title selector */
  bookSelector?: string;
}

/** Content processing configuration */
interface ProcessingConfig {
  /** Remove common ad patterns */
  removeAds?: boolean;
  /** Normalize whitespace and newlines */
  normalizeWhitespace?: boolean;
  /** Process images (center, fix lazy load) */
  fixImages?: boolean;
  /** Skip content processing (use raw content) */
  useRawContent?: boolean;
}

/** Advanced features configuration */
interface AdvancedConfig {
  /** Use iframe to load pages */
  useIframe?: boolean;
  /** Iframe sandbox attributes */
  iframeSandbox?: string;
  /** Mutation observer selector */
  mutationSelector?: string;
  /** Mutation child count threshold */
  mutationChildCount?: number;
  /** Delay before processing (ms) */
  timeout?: number;
  /** Trigger scroll to load lazy content */
  lazyLoadScroll?: boolean;
  /**
   * Check for multi-page chapters (一章分多页)
   * When true, detects URL patterns like `_2.html` or `-2.html`
   * and merges consecutive section pages into a single chapter
   */
  checkSection?: boolean;
  /** Maximum total section pages to merge for this site (default: 10) */
  sectionMaxPages?: number;
  /**
   * Delay between fetching consecutive section pages.
   * Useful for sites with aggressive request-frequency limits.
   */
  sectionDelayMs?: number;
  /**
   * Show the first section immediately while remaining section pages are merged in the background.
   * The initial chapter omits its section URL until the complete chapter replaces it.
   */
  progressiveSectionMerge?: boolean;
  /**
   * Disable section merging
   * When true, treats each page as independent chapter even if URL looks like section
   */
  noSection?: boolean;
  /**
   * Include Referer header in requests
   * Some sites require this to prevent 403 errors
   */
  withReferer?: boolean;
}

export interface HookFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  referrer?: string;
  withCredentials?: boolean;
}

export interface HookHelpers {
  fetchJson: (url: string, options?: HookFetchOptions) => Promise<Record<string, unknown> | null>;
  fetchText: (url: string, options?: HookFetchOptions) => Promise<string | null>;
}

export type BeforeParseHook = (
  doc: Document,
  url?: string,
  helpers?: HookHelpers
) => Promise<void> | void;

/** JavaScript hooks for built-in site adapters */
interface HooksConfig {
  /** Typed hook to run before parsing. */
  beforeParse?: BeforeParseHook;
}

/** Rule metadata */
interface RuleMeta {
  /** Rule author */
  author?: string;
  /** Rule source */
  source: 'builtin';
  /** Creation timestamp */
  created?: number;
  /** Last update timestamp */
  updated?: number;
  /** Example URL for testing */
  exampleUrl?: string;
}

/**
 * SiteRule - Main rule interface.
 */
export interface SiteRule {
  // === Identification ===
  /** Unique rule ID (auto-generated UUID) */
  id: string;
  /** Human-readable site name */
  name?: string;
  /** Rule version for updates */
  version: number;

  // === URL Matching ===
  /** URL matching configuration */
  match: UrlMatcher;

  // === Content Selection ===
  /** Content area configuration (required) */
  content: ContentConfig;

  // === Optional Configurations ===
  /** Navigation link configuration */
  navigation?: NavigationConfig;
  /** TOC parsing configuration */
  toc?: TocConfig;
  /** Title extraction configuration */
  title?: TitleConfig;
  /** Content processing configuration */
  processing?: ProcessingConfig;
  /** Advanced features configuration */
  advanced?: AdvancedConfig;
  /** Built-in adapter hooks */
  hooks?: HooksConfig;
  /** Custom CSS styles */
  style?: string;

  // === Metadata ===
  /** Rule metadata */
  meta?: RuleMeta;
}

/** Rule matching result */
export interface RuleMatchResult {
  rule: SiteRule;
  source: 'builtin';
  matchedPattern: string;
}

/** Storage key constants */
export const STORAGE_KEYS = {
  SITE_PREFERENCES: 'mnr_site_prefs',
} as const;

/** Site preference for auto-enable behavior */
export interface SitePreference {
  /** Whether to auto-enable reader on this site (true=auto, false=floating-button-only) */
  enabled: boolean;
  /** When this preference was last updated */
  timestamp: number;
}
