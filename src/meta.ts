/**
 * UserScript Meta Block Generator
 *
 * Centralized userscript metadata for build and runtime usage.
 * Uses simplified @match rules since we now have intelligent auto-detection.
 */

import { VERSION } from './version.ts';

// This userscript supports many sites via auto-detection.
// Keep @connect permissive so GM_xmlhttpRequest works on any supported host.
const CONNECTS = ['*'];

const SCRIPT_URL =
  'https://raw.githubusercontent.com/JasonEX/YingChuang/master/scripts/YingChuang.user.js';

type LocalizedText = Record<string, string>;
type UserscriptResourceMap = Record<string, string>;

const META_BASE = {
  name: {
    '': 'YingChuang',
    'zh-CN': '萤窗',
    'zh-TW': '螢窗',
  } satisfies LocalizedText,
  namespace: 'https://github.com/JasonEX',
  author: 'JasonEX',
  description: {
    '': '萤窗：小说阅读脚本，智能正文识别、连续阅读、阅读位置恢复、简繁转换',
    'zh-CN': '萤窗：小说阅读脚本，智能正文识别、连续阅读、阅读位置恢复、简繁转换',
    'zh-TW': '螢窗：小說閱讀腳本，智慧正文識別、連續閱讀、閱讀位置恢復、簡繁轉換',
  } satisfies LocalizedText,
  license: 'GPL version 3',
  homepage: 'https://github.com/JasonEX/YingChuang#readme',
  downloadURL: SCRIPT_URL,
  updateURL: SCRIPT_URL,
  source: 'https://github.com/JasonEX/YingChuang.git',
  supportURL: 'https://github.com/JasonEX/YingChuang/issues',

  // GM API grants
  grants: [
    'GM_xmlhttpRequest',
    'GM_getValue',
    'GM_setValue',
    'GM_deleteValue',
    'GM_listValues',
    'GM_getTab',
    'GM_saveTab',
    'GM_setClipboard',
    'GM_registerMenuCommand',
    'GM_info',
    'unsafeWindow',
  ],

  // Network connections - allow all to avoid breaking unknown/unsupported-yet sites
  connects: CONNECTS,

  // Simplified match patterns - auto-detection handles the rest
  // These cover the most common novel site URL patterns
  matches: [
    // Common novel chapter URL patterns
    '*://*/*.html',
    '*://*/*.htm',
    '*://*/*.shtml',
    '*://*/*/*.html',
    '*://*/*/*.htm',
    '*://*/*/*/*.html',
    '*://*/*/*/*.htm',
    '*://*/*/*/*/*.html',

    // Common route patterns
    '*://*/txt/*/*',
    '*://*/book/*/*',
    '*://*/read/*/*',
    '*://*/chapter/*/*',
    '*://*/novel/*/*',
    // Template-style routes used by a bunch of mobile novel sites (no .html)
    '*://*/xs_*/*/*',
    '*://*/xs_*/*/*/*',
    '*://*/gb_*/*/*',
    '*://*/gb_*/*/*/*',

    // Major novel platforms (explicit for better UX)
    '*://www.qidian.com/chapter/*/*',
    '*://m.qidian.com/chapter/*/*',
    '*://read.qidian.com/chapter/*',
    '*://vipreader.qidian.com/chapter/*/*',
    '*://book.sfacg.com/Novel/*/*/*/',
    '*://www.ciweimao.com/chapter/*',
    '*://wap.ciweimao.com/chapter/*',
    '*://www.tadu.com/book/*/*/',

    // Explicitly supported sites with numeric/custom routes. Keep these explicit so the
    // userscript menu and manual entry are available even when generic path patterns miss.
    '*://dingdianzww.org/*',
    '*://www.dingdianzww.org/*',
    '*://deqixs.org/*',
    '*://www.deqixs.org/*',
    '*://deqixs.co/*',
    '*://www.deqixs.co/*',
    '*://xszj.org/*',
    '*://m.xszj.org/*',
    '*://m.kudushu.org/html/*/*',

    // PHP patterns
    '*://*/*.php?*',

    // Numbered patterns
    '*://*/*_*.html',
    '*://*/book/*/*.html',
    '*://*/chapter/*/*.html',
    '*://*/read/*/*.html',
  ],

  // Exclude patterns
  excludes: [
    '*://*/*/index.html',
    '*://*/*/list.html',
    '*://*/*/catalog.html',
    '*://*/search/*',
    '*://*/login*',
    '*://*/register*',
    '*://www.tadu.com/book/*/toc/',
  ],

  // Resources (none needed with new architecture)
  resources: {} as UserscriptResourceMap,

  // External dependencies (minimized)
  requires: [] as string[],
};

export type UserscriptMeta = typeof META_BASE & {
  version: string;
};

export function createMeta(params: { version: string }): UserscriptMeta {
  return { ...META_BASE, version: params.version };
}

const META = createMeta({ version: VERSION });

/**
 * Export for vite-plugin-monkey or similar build tools
 */
export function toUserscriptConfig(meta: UserscriptMeta = META): Record<string, unknown> {
  const config: Record<string, unknown> = {
    name: meta.name,
    version: meta.version,
    namespace: meta.namespace,
    author: meta.author,
    description: meta.description,
    license: meta.license,
    homepage: meta.homepage,
    downloadURL: meta.downloadURL,
    updateURL: meta.updateURL,
    source: meta.source,
    supportURL: meta.supportURL,
    // Run as early as possible to block mobile ad-tech redirects (common on some novel sites).
    'run-at': 'document-start',
    match: meta.matches,
    exclude: meta.excludes,
    grant: meta.grants,
    connect: meta.connects,
    require: meta.requires,
    resource: meta.resources,
  };

  return config;
}
