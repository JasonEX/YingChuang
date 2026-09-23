/**
 * Built-in rules that still need explicit selectors or special processing.
 *
 * Actively maintained site modules live in ./sites. Keep the remaining inline
 * rules small and only for sites that still need selector-only handling.
 */

import type { SiteRule } from './types';
import { siteRules } from './sites';

const inlineRules: SiteRule[] = [
  {
    id: 'gongzicp',
    name: '长佩文学网',
    version: 1,
    match: { pattern: '^https?://www\\.gongzicp\\.com/read-\\d+\\.html' },
    content: {
      selector: '.content',
      replace: [{ pattern: '来源长佩文学网（https://www\\.gongzicp\\.com）', replacement: '' }],
    },
    title: { bookSelector: '.novel' },
    advanced: {
      useIframe: true,
      mutationSelector: '.novel',
      mutationChildCount: 2,
    },
    meta: { source: 'builtin', exampleUrl: 'https://www.gongzicp.com/read-246381.html' },
  },
  {
    id: 'ldks-2baoe',
    name: '零点看书（ldks）',
    version: 1,
    match: {
      pattern:
        '^https?://(?:23\\.225\\.121\\.247|www\\.2baoe\\.com)/ldks/\\d+/\\d+(?:[_-]\\d+)?\\.html$',
    },
    content: {
      selector: '#content',
      remove: 'h1.title',
    },
    navigation: {
      prev: '.section-opt a:contains("上一章"), .section-opt a:contains("上一页")',
      index: '.section-opt a:contains("章节列表"), a:contains("章节列表")',
      next: '.section-opt a:contains("下一章"), .section-opt a:contains("下一页")',
    },
    title: { selector: 'h1.title' },
    advanced: { checkSection: true },
    meta: {
      source: 'builtin',
      exampleUrl: 'http://23.225.121.247/ldks/111291/42509753_2.html',
    },
  },

  {
    id: 'tadu',
    name: '塔读文学',
    version: 1,
    match: { pattern: '^https?://www\\.tadu\\.com/book/\\d+/\\d+/?' },
    content: { selector: '#partContent' },
    title: {
      selector: 'h4',
      bookSelector: '.chapter_details > span',
    },
    advanced: {
      useIframe: true,
      mutationSelector: '#partContent',
    },
    meta: { source: 'builtin' },
  },

  {
    id: 'sfacg',
    name: 'SF 轻小说',
    version: 1,
    match: { pattern: '^https?://book.sfacg.com/Novel/\\d+/\\d+/\\d+/' },
    content: { selector: '#ChapterBody' },
    title: { pattern: '(.*?)-(.*?)-.*' },
    meta: { source: 'builtin', exampleUrl: 'https://book.sfacg.com/Novel/601991/795722/7137683/' },
  },

  {
    id: 'piaotia',
    name: '飘天文学',
    version: 1,
    match: { pattern: '^https?://www\\.piaotia\\.com/html/\\d+/\\d+/\\d+\\.html' },
    content: {
      selector: '#content',
      remove: 'h1, table, .toplink',
    },
    title: { bookSelector: '#content > h1 > a' },
    advanced: { useIframe: true },
    meta: { source: 'builtin', exampleUrl: 'https://www.piaotia.com/html/15/15083/10323993.html' },
  },

  {
    id: 'shushan',
    name: '书山中文网',
    version: 1,
    match: { pattern: 'https?://shushan\\.zhangyue\\.net/book/\\d+/\\d+/' },
    content: { selector: '.art_con' },
    navigation: {
      next: '.next-cha',
      prev: '.last-cha',
      index: 'a:contains(书页)',
    },
    meta: { source: 'builtin', exampleUrl: 'https://shushan.zhangyue.net/book/105835/15038074/' },
  },

  {
    id: 'esjzone',
    name: 'ESJ',
    version: 1,
    match: { pattern: '^https?://www\\.esjzone\\.(?:me|cc)/forum/\\d+/\\d+\\.html' },
    content: { selector: '.mt-3.forum-content' },
    navigation: {
      next: '.btn-next.btn-sm.btn-outline-secondary.btn',
      prev: '.btn-prev.btn-sm.btn-outline-secondary.btn',
      index: '.view-all.btn-outline-secondary.btn',
    },
    title: { selector: 'h2' },
    meta: { source: 'builtin', exampleUrl: 'https://www.esjzone.cc/forum/1677032544/162585.html' },
  },

  {
    id: 'ixdzs',
    name: '爱下电子书',
    version: 1,
    match: { pattern: 'https://ixdzs8.com/read/\\d+/p\\d+.html' },
    content: { selector: '.page-content section' },
    navigation: {
      next: '.chapter-next',
      prev: '.chapter-pre',
      index: 'a:contains(书籍页)',
    },
    meta: { source: 'builtin', exampleUrl: 'https://ixdzs8.com/read/42730/p1.html' },
  },

  {
    id: 'xs321',
    name: '小说321',
    version: 1,
    match: { pattern: 'https?://www\\.xs321\\.net/book/\\d+/\\d+/\\d+(_\\d+)?\\.html' },
    content: { selector: '#content' },
    advanced: { checkSection: true },
    meta: { source: 'builtin', exampleUrl: 'http://www.xs321.net/book/671/671539/1.html' },
  },

  {
    id: 'ilwxs',
    name: '乐文小说',
    version: 2,
    match: { pattern: 'https://m\\.ilwxs\\.com/shu/\\d+/\\d+\\.html' },
    content: { selector: '.content' },
    navigation: {
      prev: '.pager a:contains("上一章"), .pager a:contains("上一页")',
      next: '.pager a:contains("下一章"), .pager a:contains("下一页")',
      index:
        '.pager a[href^="/shu/"][href$="/"], .pager a[href*="/shu/"][href$="/"], .pager a:contains("目 录"), .pager a:contains("目录")',
    },
    title: {
      selector: '.headline',
      bookSelector: '.path > a:nth-child(2)',
    },
    advanced: { checkSection: true },
    meta: { source: 'builtin', exampleUrl: 'https://m.ilwxs.com/shu/36354/171272950.html' },
  },

  {
    id: 'faloo',
    name: '飞卢小说网',
    version: 1,
    match: { pattern: '^https?://[a-z]\\.faloo\\.com/\\d+_\\d+\\.html' },
    content: { selector: '.noveContent' },
    navigation: {
      prev: '#pre_page, a:contains("上一章")',
      next: '#next_page, a:contains("下一章")',
      index: '#huimulu, a:contains("目录")',
    },
    toc: { excludeAncestors: '.c_con_relation' },
    title: {
      // Chapter title is in <h1>; <h2> is site-wide slogan.
      selector: '.c_l_title > h1, h1',
      bookSelector: '#novelName',
      replace: '^\\s*\\S+\\s+',
    },
    meta: {
      source: 'builtin',
      exampleUrl: 'https://b.faloo.com/412421_1.html',
    },
  },

  {
    id: 'kanunu8',
    name: '努努书坊',
    version: 1,
    match: { pattern: '^https?://www\\.kanunu8\\.com/.+/\\d+\\.html$' },
    content: { selector: 'td[width="820"] > p, td[width="820"] p' },
    navigation: {
      prev: 'table[width="700"] td:first-child a',
      index: 'table[width="700"] td:nth-child(2) a',
      next: 'table[width="700"] td:last-child a',
    },
    title: { selector: 'font[color="#dc143c"][size="4"]' },
    toc: {
      // 排除顶部导航栏的分类链接
      excludeAncestors: '#header, .nav, .nav2, td[bgcolor="#A5BDC6"], td[bgcolor="#CEDFE5"]',
    },
    advanced: { noSection: true },
    meta: {
      source: 'builtin',
      exampleUrl: 'https://www.kanunu8.com/book3/7748/170164.html',
    },
  },
];

/**
 * All built-in rules combined
 */
export const builtInRules: SiteRule[] = [...siteRules, ...inlineRules];
