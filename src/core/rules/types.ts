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
  /**
   * Declarative override for how multi-page chapter (分页章节) URLs are shaped on this site.
   *
   * Generic derivation assumes `/…/{chapterId}_{page}.html`. Declare this when the chapter id
   * itself contains the separator, so the generic split would otherwise read a plain chapter as
   * "page N of a shorter id". Without it the generic layer would need to know the host name.
   */
  sectionUrl?: SectionUrlShape;
  /**
   * This site serves its chapter container empty and fills it from script (encrypted or
   * lazily decoded), while subscription copy may sit elsewhere on the page. Generic VIP
   * heuristics read that copy as a paywall, so when `content.selector` is present and carries
   * no subscription copy of its own, the document is treated as a chapter shell.
   *
   * Opt in only for sites that genuinely do this. On an ordinary paywall the preview prose
   * sits inside the container and the notice is a sibling — Qidian's locked chapters look
   * exactly like that — so inferring the exemption from any content selector would clear
   * real paywalls.
   */
  lazyChapterShell?: boolean;
}

/** Site-declared shape of a section (multi-page chapter) URL. */
export interface SectionUrlShape {
  /** Regex source matched against the full URL. */
  pattern: string;
  /** Replacement producing the page-1 chapter *pathname*; $1…$9 reference capture groups. */
  chapterPath: string;
  /** Capture group holding the page number. An unmatched group means page 1. */
  pageGroup: number;
}

/** Result of applying a SectionUrlShape. */
export interface ParsedSectionUrl {
  /** Page-1 URL of the chapter, query preserved and hash dropped. */
  chapterUrl: string;
  /** 1-based page number within the chapter. */
  page: number;
}

/** Parses a URL into its chapter/page parts, or null when no site shape applies. */
export type SectionUrlParser = (url: string) => ParsedSectionUrl | null;

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

/** Reference chapter that a fetch is navigating from. */
export interface FetchDocumentContext {
  /** Book title as parsed from the referring chapter, when known. */
  bookTitle?: string;
  /** TOC/index URL of the referring chapter, when known. */
  indexUrl?: string;
  /** URL of the referring chapter; use it to resolve relative links. */
  refererUrl: string;
}

/**
 * Build a chapter document for `url` without a normal page fetch.
 *
 * Sites that serve chapter bodies from a private API register this so the generic loader
 * never has to name them. Return `null` to fall through to the standard fetch path.
 */
export type FetchDocumentHook = (
  url: string,
  context: FetchDocumentContext
) => Promise<Document | null>;

/** JavaScript hooks for built-in site adapters */
interface HooksConfig {
  /** Typed hook to run before parsing. */
  beforeParse?: BeforeParseHook;
  /** Typed hook that supplies a chapter document from a site API instead of a page fetch. */
  fetchDocument?: FetchDocumentHook;
  /**
   * Redirect a non-chapter entry page to the chapter that should actually be read.
   *
   * Some sites land the user on a book page that embeds the first chapter. Such a URL is
   * deliberately outside this rule's `match`, so the hook self-guards and returns null for
   * anything it does not recognise. Keeps the generic entry flow free of host names.
   */
  resolveEntryUrl?: (doc: Document, url: string) => string | null;
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
