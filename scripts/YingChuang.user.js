// ==UserScript==
// @name               YingChuang
// @name:zh-CN         萤窗
// @name:zh-TW         螢窗
// @namespace          https://github.com/JasonEX
// @version            1.0.7
// @author             JasonEX
// @description        萤窗：小说阅读脚本，智能正文识别、连续阅读、阅读位置恢复、简繁转换
// @description:zh-CN  萤窗：小说阅读脚本，智能正文识别、连续阅读、阅读位置恢复、简繁转换
// @description:zh-TW  螢窗：小說閱讀腳本，智慧正文識別、連續閱讀、閱讀位置恢復、簡繁轉換
// @license            GPL version 3
// @homepage           https://github.com/JasonEX/YingChuang#readme
// @homepageURL        https://github.com/JasonEX/YingChuang#readme
// @source             https://github.com/JasonEX/YingChuang.git
// @supportURL         https://github.com/JasonEX/YingChuang/issues
// @downloadURL        https://raw.githubusercontent.com/JasonEX/YingChuang/master/scripts/YingChuang.user.js
// @updateURL          https://raw.githubusercontent.com/JasonEX/YingChuang/master/scripts/YingChuang.user.js
// @match              *://*/*.html
// @match              *://*/*.htm
// @match              *://*/*.shtml
// @match              *://*/*/*.html
// @match              *://*/*/*.htm
// @match              *://*/*/*/*.html
// @match              *://*/*/*/*.htm
// @match              *://*/*/*/*/*.html
// @match              *://*/txt/*/*
// @match              *://*/book/*/*
// @match              *://*/read/*/*
// @match              *://*/chapter/*/*
// @match              *://*/novel/*/*
// @match              *://*/xs_*/*/*
// @match              *://*/xs_*/*/*/*
// @match              *://*/gb_*/*/*
// @match              *://*/gb_*/*/*/*
// @match              *://www.qidian.com/chapter/*/*
// @match              *://m.qidian.com/chapter/*/*
// @match              *://read.qidian.com/chapter/*
// @match              *://vipreader.qidian.com/chapter/*/*
// @match              *://book.sfacg.com/Novel/*/*/*/
// @match              *://www.ciweimao.com/chapter/*
// @match              *://wap.ciweimao.com/chapter/*
// @match              *://www.tadu.com/book/*/*/
// @match              *://dingdianzww.org/*
// @match              *://www.dingdianzww.org/*
// @match              *://deqixs.org/*
// @match              *://www.deqixs.org/*
// @match              *://deqixs.co/*
// @match              *://www.deqixs.co/*
// @match              *://xszj.org/*
// @match              *://m.xszj.org/*
// @match              *://m.kudushu.org/html/*/*
// @match              *://www.novels.com.tw/novels/*
// @match              *://*/*.php?*
// @match              *://*/*_*.html
// @match              *://*/book/*/*.html
// @match              *://*/chapter/*/*.html
// @match              *://*/read/*/*.html
// @exclude            *://*/*/index.html
// @exclude            *://*/*/list.html
// @exclude            *://*/*/catalog.html
// @exclude            *://*/search/*
// @exclude            *://*/login*
// @exclude            *://*/register*
// @exclude            *://www.tadu.com/book/*/toc/
// @connect            *
// @grant              GM_deleteValue
// @grant              GM_getTab
// @grant              GM_getValue
// @grant              GM_info
// @grant              GM_listValues
// @grant              GM_registerMenuCommand
// @grant              GM_saveTab
// @grant              GM_setClipboard
// @grant              GM_setValue
// @grant              GM_xmlhttpRequest
// @grant              unsafeWindow
// @run-at             document-start
// ==/UserScript==

(function() {
	"use strict";
	var __defProp = Object.defineProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	var SECTION_TEXT_PATTERNS = [
		/[下上]一?页/,
		/[下上]一?頁/,
		/第\d+页/,
		/\(\d+\/\d+\)/
	];
	var CHAPTER_TEXT_PATTERNS = [
		/[下上]一?章/,
		/[下上]一?[节節]/,
		/第.+[章节節]/
	];
	var REMOVE_SELECTORS = [
		"script",
		"style",
		"iframe",
		"noscript",
		".ad",
		".ads",
		".advertisement",
		"[class*=\"ad-\"]",
		"[id*=\"ad-\"]",
		".sponsor",
		".recommend",
		".related",
		".comment",
		".share",
		"[class*=\"share\"]",
		"[id*=\"share\"]",
		".div_feedback",
		"[class*=\"feedback\"]",
		"[id*=\"feedback\"]",
		".anchor_bookmark",
		"[class*=\"bookmark\"]",
		"[id*=\"bookmark\"]",
		".social_share_frame",
		".social_share_inner_frame",
		".page-separator",
		".page_separator_first",
		".page_separator_last",
		".prev_page",
		".next_page",
		".more_recommend",
		"[class*=\"recommend\"]",
		"[id*=\"recommend\"]",
		".txtcenter",
		".mobadsq",
		"amp-social-share",
		"ins.adsbygoogle"
	];
	var AD_PATTERNS = [
		/[（(]本章未完[，,]?请?点击下一页继续阅读[）)]/gi,
		/本章未完[，,]?请?点击下一页继续.*/gi,
		/请点击下一页继续阅读/gi,
		/点击下一页继续阅读/gi,
		/[（(]第\d+[/／]\d+页[）)]/gi,
		/第\d+[/／]\d+页/gi,
		/[（(]\s*[）)]/g,
		/[（(]\s*$/gm,
		/^\s*[）)]/gm,
		/手机用户请到.*阅读/gi,
		/请记住本书.*网址/gi,
		/【[^】\r\n]{1,120}】(?:小说|小說)(?:免费|免費)(?:阅读|閱讀)[，,][ \t\u3000]*(?:请|請)收藏[ \t\u3000]*[^【】\r\n]{1,32}【1qxs\.com】/giu,
		/(?:[请請]?[记記]住首[发發][网網]站(?:域名)?|[请請][记記]住[网網]址)[^<\n]*/gi,
		/百度搜索.*最新章节/gi,
		/一秒记住.*为您提供/gi,
		/天才一秒记住/gi,
		/笔趣阁.*www\.[a-z]+\.(com|net|org)/gi,
		/添加书签\s*返回目录\s*章节报错\s*分享给朋友[:：]?\s*/gi,
		/添加書籤\s*返回目錄\s*章節報錯\s*分享給朋友[:：]?\s*/gi,
		/由於[緩缓存]原因[^<\n]{0,120}(?:更新|網站|网站|站)/gi,
		/[请請][用戶用户]直接[瀏覽浏览]器[訪访]問[^<\n]{0,120}/gi,
		/(?:阅[|｜\s]*读[|｜\s]*模[|｜\s]*式|畅[|｜\s]*读[|｜\s]*模[|｜\s]*式)[^<\n]{0,60}无[|｜\s]*法[|｜\s]*显[|｜\s]*示[|｜\s]*本[|｜\s]*章[|｜\s]*节[|｜\s]*全[|｜\s]*部[|｜\s]*内[|｜\s]*容[^<\n]{0,120}/gi,
		/请[|｜\s]*返[|｜\s]*回[|｜\s]*原[|｜\s]*网[|｜\s]*页[|｜\s]*阅[|｜\s]*读/gi,
		/加[|｜\s]*载[|｜\s]*更[|｜\s]*多/gi,
		/小[^\u4e00-\u9fff]{0,3}说[^\u4e00-\u9fff]{0,3}网[^\u4e00-\u9fff]{0,6}最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
		/最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
		/幻[^\u4e00-\u9fff]{0,3}想[^\u4e00-\u9fff]{0,3}姬[^\u4e00-\u9fff]{0,6}免[^\u4e00-\u9fff]{0,3}费[^\u4e00-\u9fff]{0,3}(?:阅|讀)[^\u4e00-\u9fff]{0,3}(?:读|讀)/gi,
		/萝[^\u4e00-\u9fff]{0,3}拉[^\u4e00-\u9fff]{0,3}小[^\u4e00-\u9fff]{0,3}说[^\u4e00-\u9fff]{0,3}\d{1,3}[^\u4e00-\u9fff]{0,3}最[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}章[^\u4e00-\u9fff]{0,3}节[^\u4e00-\u9fff]{0,6}更[^\u4e00-\u9fff]{0,3}新[^\u4e00-\u9fff]{0,3}快/gi,
		/(天天看小说|天天看小說)[^<\n]*ttks\.tw/gi,
		/⚡?\s*天天看[小小說]{2}[^<\n]*/gi,
		/https?:\/\/[^\s<>"]+/gi,
		/www\.[a-z0-9]+\.(com|net|org|cc)/gi
	];
	function cssEscape(str) {
		if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(str);
		return str.replace(/([!"#$%&'()*+,.:;<=>?@[\\\]^`{|}~])/g, "\\$1");
	}
	function isUniqueSelector(doc, selector) {
		try {
			return doc.querySelectorAll(selector).length === 1;
		} catch {
			return false;
		}
	}
	function buildPathSelector(element, doc, maxDepth) {
		const path = [];
		let current = element;
		while (current && current !== doc.body && current !== doc.documentElement && path.length < maxDepth) {
			let segment = current.tagName.toLowerCase();
			const id = current.id;
			if (id) {
				segment = `#${cssEscape(id)}`;
				path.unshift(segment);
				break;
			}
			const parent = current.parentElement;
			if (parent) {
				const tagName = current.tagName;
				let index = 1;
				let hasSameType = false;
				for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
					if (sibling.tagName !== tagName) continue;
					index++;
					hasSameType = true;
				}
				for (let sibling = current.nextElementSibling; !hasSameType && sibling; sibling = sibling.nextElementSibling) if (sibling.tagName === tagName) hasSameType = true;
				if (hasSameType) segment += `:nth-of-type(${index})`;
			}
			path.unshift(segment);
			current = parent;
		}
		return path.join(" > ");
	}
	function generateCssSelector(element, options = {}) {
		const doc = options.doc || element.ownerDocument || (typeof document !== "undefined" ? document : void 0);
		if (!doc) return element.tagName.toLowerCase();
		const maxDepth = Math.max(1, options.maxDepth ?? Number.POSITIVE_INFINITY);
		const id = element.id;
		if (id) return `#${cssEscape(id)}`;
		const classes = Array.from(element.classList || []).filter(Boolean);
		for (const cls of classes) {
			const selector = `.${cssEscape(cls)}`;
			if (isUniqueSelector(doc, selector)) return selector;
		}
		if (options.allowClassCombination && classes.length >= 2) {
			const maxClasses = Math.max(2, options.maxClassCombination ?? 3);
			const selector = classes.slice(0, Math.min(maxClasses, classes.length)).map((cls) => `.${cssEscape(cls)}`).join("");
			if (isUniqueSelector(doc, selector)) return selector;
		}
		return buildPathSelector(element, doc, maxDepth) || element.tagName.toLowerCase();
	}
	function parseChapterSectionFromPathname(pathname) {
		if (!pathname) return null;
		const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
		let match = normalized.match(/^(.*\/\d+)[_-](\d+)\.html?$/i);
		if (match) {
			const section = parseInt(match[2], 10);
			if (section >= 1 && section <= 99) return {
				chapterKey: match[1],
				section
			};
		}
		match = normalized.match(/^(.*\/\d{5,})_(\d{1,2})\/?$/);
		if (match) {
			const section = parseInt(match[2], 10);
			if (section >= 1 && section <= 99) return {
				chapterKey: match[1],
				section
			};
		}
		match = normalized.match(/^(.*\/\d+)\/(\d+)\.html?$/i);
		if (match) {
			const section = parseInt(match[2], 10);
			if (section >= 1 && section <= 99) return {
				chapterKey: match[1],
				section
			};
		}
		match = normalized.match(/^(.*\/\d+)\.html?$/i);
		if (match) return {
			chapterKey: match[1],
			section: 1
		};
		const parts = normalized.split("/").filter(Boolean);
		if (parts.length >= 4) {
			const pagePart = parts[parts.length - 1];
			const chapterPart = parts[parts.length - 2];
			const hasStableBookId = parts.slice(0, -2).some((p) => /^\d{3,}$/.test(p));
			if (/^\d{1,2}$/.test(pagePart) && /^\d{1,6}$/.test(chapterPart) && hasStableBookId) {
				const section = parseInt(pagePart, 10);
				if (section >= 1 && section <= 99) return {
					chapterKey: `/${parts.slice(0, -1).join("/")}`,
					section
				};
			}
		}
		if (parts.length >= 3) {
			const pagePart = parts[parts.length - 1];
			const chapterPart = parts[parts.length - 2];
			if (/^\d{1,2}$/.test(pagePart) && /^\d{3,}$/.test(chapterPart)) {
				const section = parseInt(pagePart, 10);
				if (parts.slice(0, -1).filter((p) => /^\d{3,}$/.test(p)).length >= 2 && section >= 1 && section <= 99) return {
					chapterKey: `/${parts.slice(0, -1).join("/")}`,
					section
				};
			}
		}
		if (parts.length >= 3) {
			const chapterPart = parts[parts.length - 1];
			const hasStableBookId = parts.slice(0, -1).some((p) => /^\d{3,}$/.test(p));
			if (/^\d{1,6}$/.test(chapterPart) && hasStableBookId) return {
				chapterKey: `/${parts.join("/")}`,
				section: 1
			};
		}
		match = normalized.match(/^(.*\/\d{3,})(?:\/)?$/);
		if (match) return {
			chapterKey: match[1],
			section: 1
		};
		return null;
	}
	function normalizeAbsoluteUrl(href, base) {
		const baseCandidates = [base];
		if (typeof document !== "undefined") baseCandidates.push(document.baseURI);
		if (typeof location !== "undefined") baseCandidates.push(location.href);
		for (const candidate of baseCandidates) {
			if (!candidate) continue;
			try {
				return new URL(href, candidate).toString();
			} catch {}
		}
		try {
			return new URL(href).toString();
		} catch {
			return href;
		}
	}
	function getSectionBaseUrl(url, parseSectionUrl) {
		const declared = parseSectionUrl?.(url);
		if (declared) return declared.page > 1 ? declared.chapterUrl : null;
		const m = url.match(/^(.*\/\d+)[_-]\d+(\.html?)$/i);
		if (m) return `${m[1]}${m[2]}`;
		try {
			const u = new URL(url);
			const dirSection = u.pathname.match(/^(.*\/\d{5,})_(\d{1,2})(\/?)$/);
			if (dirSection && Number(dirSection[2]) >= 1) {
				u.pathname = `${dirSection[1]}${dirSection[3]}`;
				return u.toString();
			}
			const parts = u.pathname.split("/").filter(Boolean);
			const hasTrailingSlash = u.pathname.endsWith("/");
			if (parts.length >= 3) {
				const pagePart = parts[parts.length - 1];
				const chapterPart = parts[parts.length - 2];
				if (/^\d{1,2}$/.test(pagePart) && /^\d{3,}$/.test(chapterPart)) {
					if (parts.slice(0, -1).filter((p) => /^\d{3,}$/.test(p)).length >= 2) {
						parts[parts.length - 1] = "1";
						u.pathname = `/${parts.join("/")}${hasTrailingSlash ? "/" : ""}`;
						return u.toString();
					}
				}
			}
			if (parts.length >= 4) {
				const pagePart = parts[parts.length - 1];
				const chapterPart = parts[parts.length - 2];
				const hasStableBookId = parts.slice(0, -2).some((p) => /^\d{3,}$/.test(p));
				if (/^\d{1,2}$/.test(pagePart) && /^\d{1,6}$/.test(chapterPart) && hasStableBookId) {
					const page = parseInt(pagePart, 10);
					if (page > 1 && page <= 99) {
						parts.pop();
						u.pathname = `/${parts.join("/")}${hasTrailingSlash ? "/" : ""}`;
						return u.toString();
					}
				}
			}
		} catch {}
		try {
			const u = new URL(url);
			const PAGE_PARAM_KEYS = [
				"page",
				"p",
				"pg",
				"pageno",
				"page_no",
				"pagenum",
				"pageindex",
				"pn"
			];
			for (const [name, value] of u.searchParams) {
				const keyLower = name.toLowerCase();
				if (!PAGE_PARAM_KEYS.includes(keyLower)) continue;
				if (!/^\d+$/.test(value)) continue;
				if (parseInt(value, 10) <= 1) continue;
				u.searchParams.set(name, "1");
				return u.toString();
			}
		} catch {}
		return null;
	}
	function isSectionLikeUrl(currentUrl, nextUrl, parseSectionUrl) {
		try {
			const current = new URL(currentUrl);
			const next = new URL(nextUrl, current);
			if (current.host !== next.host) return false;
			const currentPage = parseSectionUrl?.(current.href) ?? null;
			const nextPage = parseSectionUrl?.(next.href) ?? null;
			if (currentPage || nextPage) return currentPage?.chapterUrl === nextPage?.chapterUrl && nextPage?.page === (currentPage?.page ?? 0) + 1;
			const currentPath = current.pathname;
			const nextPath = next.pathname;
			const c = parseChapterSectionFromPathname(currentPath);
			const n = parseChapterSectionFromPathname(nextPath);
			if (c && n && c.chapterKey === n.chapterKey) {
				if (n.section === c.section + 1 && n.section > 1) return true;
			}
			if (currentPath === nextPath) {
				const PAGE_PARAM_KEYS = [
					"page",
					"p",
					"pg",
					"pageno",
					"page_no",
					"pagenum",
					"pageindex",
					"pn"
				];
				const getParamValueCI = (params, keyLower) => {
					for (const [name, value] of params) if (name.toLowerCase() === keyLower) return value;
					return null;
				};
				const extractPageInfo = (u) => {
					for (const keyLower of PAGE_PARAM_KEYS) {
						const raw = getParamValueCI(u.searchParams, keyLower);
						if (!raw || !/^\d+$/.test(raw)) continue;
						const page = parseInt(raw, 10);
						if (page >= 1 && page <= 99) return {
							keyLower,
							page
						};
					}
					return null;
				};
				const nextPageInfo = extractPageInfo(next);
				if (nextPageInfo) {
					const rawCurrentPage = getParamValueCI(current.searchParams, nextPageInfo.keyLower);
					const currentPage = rawCurrentPage && /^\d+$/.test(rawCurrentPage) ? parseInt(rawCurrentPage, 10) : 1;
					const normalizeNonPageParams = (u, pageKeyLower) => {
						const items = [];
						for (const [name, value] of u.searchParams) {
							if (name.toLowerCase() === pageKeyLower) continue;
							items.push(`${name.toLowerCase()}=${value}`);
						}
						items.sort();
						return items;
					};
					const currentRest = normalizeNonPageParams(current, nextPageInfo.keyLower);
					const nextRest = normalizeNonPageParams(next, nextPageInfo.keyLower);
					if (currentRest.length === nextRest.length && currentRest.every((v, i) => v === nextRest[i]) && nextPageInfo.page === currentPage + 1 && nextPageInfo.page > 1) return true;
				}
			}
			return false;
		} catch {
			return false;
		}
	}
	function joinHtml(a, b) {
		const left = (a || "").trim();
		const right = (b || "").trim();
		if (!left) return right;
		if (!right) return left;
		return `${left}<p></p>${right}`;
	}
	function normalizeCiwemaoChapterUrl(url) {
		try {
			const u = new URL(url);
			if ((u.hostname === "wap.ciweimao.com" || u.hostname === "mip.ciweimao.com") && (u.pathname === "/chapter/get_par_tsu_list" || u.pathname === "/chapter/get_par_tsu_list/")) {
				const chapterId = u.searchParams.get("chapter_id");
				if (chapterId && /^\d+$/.test(chapterId)) return `${u.origin}/chapter/${chapterId}`;
			}
			return url;
		} catch {
			return url;
		}
	}
	function normalizeRedundantFirstPageParam(url) {
		try {
			const u = new URL(url);
			if (!/\.html?$/i.test(u.pathname)) return url;
			const params = Array.from(u.searchParams.entries());
			if (params.length !== 1) return url;
			const [name, value] = params[0];
			if (![
				"page",
				"p",
				"pg",
				"pageno",
				"page_no",
				"pagenum",
				"pageindex",
				"pn"
			].includes(name.toLowerCase()) || value !== "1") return url;
			u.search = "";
			return u.toString();
		} catch {
			return url;
		}
	}
	function _arrayLikeToArray(r, a) {
		(null == a || a > r.length) && (a = r.length);
		for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
		return n;
	}
	function _arrayWithHoles(r) {
		if (Array.isArray(r)) return r;
	}
	function _iterableToArrayLimit(r, l) {
		var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
		if (null != t) {
			var e, n, i, u, a = [], f = true, o = false;
			try {
				if (i = (t = t.call(r)).next, 0 === l);
				else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
			} catch (r) {
				o = true, n = r;
			} finally {
				try {
					if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
				} finally {
					if (o) throw n;
				}
			}
			return a;
		}
	}
	function _nonIterableRest() {
		throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function _slicedToArray(r, e) {
		return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
	}
	function _unsupportedIterableToArray(r, a) {
		if (r) {
			if ("string" == typeof r) return _arrayLikeToArray(r, a);
			var t = {}.toString.call(r).slice(8, -1);
			return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
		}
	}
	var entries = Object.entries;
	var setPrototypeOf = Object.setPrototypeOf;
	var isFrozen = Object.isFrozen;
	var getPrototypeOf = Object.getPrototypeOf;
	var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
	var freeze = Object.freeze;
	var seal = Object.seal;
	var create = Object.create;
	var _ref = typeof Reflect !== "undefined" && Reflect;
	var apply$1 = _ref.apply;
	var construct = _ref.construct;
	if (!freeze) freeze = function freeze(x) {
		return x;
	};
	if (!seal) seal = function seal(x) {
		return x;
	};
	if (!apply$1) apply$1 = function apply(func, thisArg) {
		for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
		return func.apply(thisArg, args);
	};
	if (!construct) construct = function construct(Func) {
		for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
		return new Func(...args);
	};
	var arrayForEach = unapply(Array.prototype.forEach);
	var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
	var arrayPop = unapply(Array.prototype.pop);
	var arrayPush = unapply(Array.prototype.push);
	var arraySplice = unapply(Array.prototype.splice);
	var arrayIsArray = Array.isArray;
	var stringToLowerCase = unapply(String.prototype.toLowerCase);
	var stringToString = unapply(String.prototype.toString);
	var stringMatch = unapply(String.prototype.match);
	var stringReplace = unapply(String.prototype.replace);
	var stringIndexOf = unapply(String.prototype.indexOf);
	var stringTrim = unapply(String.prototype.trim);
	var numberToString = unapply(Number.prototype.toString);
	var booleanToString = unapply(Boolean.prototype.toString);
	var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
	var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
	var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
	var objectToString$1 = unapply(Object.prototype.toString);
	var regExpTest = unapply(RegExp.prototype.test);
	var typeErrorCreate = unconstruct(TypeError);
	function unapply(func) {
		return function(thisArg) {
			if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
			for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
			return apply$1(func, thisArg, args);
		};
	}
	function unconstruct(Func) {
		return function() {
			for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
			return construct(Func, args);
		};
	}
	function addToSet(set, array) {
		let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
		if (setPrototypeOf) setPrototypeOf(set, null);
		if (!arrayIsArray(array)) return set;
		let l = array.length;
		while (l--) {
			let element = array[l];
			if (typeof element === "string") {
				const lcElement = transformCaseFunc(element);
				if (lcElement !== element) {
					if (!isFrozen(array)) array[l] = lcElement;
					element = lcElement;
				}
			}
			set[element] = true;
		}
		return set;
	}
	function cleanArray(array) {
		for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
		return array;
	}
	function clone(object) {
		const newObject = create(null);
		for (const _ref2 of entries(object)) {
			var _ref3 = _slicedToArray(_ref2, 2);
			const property = _ref3[0];
			const value = _ref3[1];
			if (objectHasOwnProperty(object, property)) {
				if (arrayIsArray(value)) newObject[property] = cleanArray(value);
				else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
				else newObject[property] = value;
			}
		}
		return newObject;
	}
	function stringifyValue(value) {
		switch (typeof value) {
			case "string": return value;
			case "number": return numberToString(value);
			case "boolean": return booleanToString(value);
			case "bigint": return bigintToString ? bigintToString(value) : "0";
			case "symbol": return symbolToString ? symbolToString(value) : "Symbol()";
			case "undefined": return objectToString$1(value);
			case "function":
			case "object": {
				if (value === null) return objectToString$1(value);
				const valueAsRecord = value;
				const valueToString = lookupGetter(valueAsRecord, "toString");
				if (typeof valueToString === "function") {
					const stringified = valueToString(valueAsRecord);
					return typeof stringified === "string" ? stringified : objectToString$1(stringified);
				}
				return objectToString$1(value);
			}
			default: return objectToString$1(value);
		}
	}
	function lookupGetter(object, prop) {
		while (object !== null) {
			const desc = getOwnPropertyDescriptor(object, prop);
			if (desc) {
				if (desc.get) return unapply(desc.get);
				if (typeof desc.value === "function") return unapply(desc.value);
			}
			object = getPrototypeOf(object);
		}
		function fallbackValue() {
			return null;
		}
		return fallbackValue;
	}
	function isRegex(value) {
		try {
			regExpTest(value, "");
			return true;
		} catch (_unused) {
			return false;
		}
	}
	var html$1 = freeze([
		"a",
		"abbr",
		"acronym",
		"address",
		"area",
		"article",
		"aside",
		"audio",
		"b",
		"bdi",
		"bdo",
		"big",
		"blink",
		"blockquote",
		"body",
		"br",
		"button",
		"canvas",
		"caption",
		"center",
		"cite",
		"code",
		"col",
		"colgroup",
		"content",
		"data",
		"datalist",
		"dd",
		"decorator",
		"del",
		"details",
		"dfn",
		"dialog",
		"dir",
		"div",
		"dl",
		"dt",
		"element",
		"em",
		"fieldset",
		"figcaption",
		"figure",
		"font",
		"footer",
		"form",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"head",
		"header",
		"hgroup",
		"hr",
		"html",
		"i",
		"img",
		"input",
		"ins",
		"kbd",
		"label",
		"legend",
		"li",
		"main",
		"map",
		"mark",
		"marquee",
		"menu",
		"menuitem",
		"meter",
		"nav",
		"nobr",
		"ol",
		"optgroup",
		"option",
		"output",
		"p",
		"picture",
		"pre",
		"progress",
		"q",
		"rp",
		"rt",
		"ruby",
		"s",
		"samp",
		"search",
		"section",
		"select",
		"shadow",
		"slot",
		"small",
		"source",
		"spacer",
		"span",
		"strike",
		"strong",
		"style",
		"sub",
		"summary",
		"sup",
		"table",
		"tbody",
		"td",
		"template",
		"textarea",
		"tfoot",
		"th",
		"thead",
		"time",
		"tr",
		"track",
		"tt",
		"u",
		"ul",
		"var",
		"video",
		"wbr"
	]);
	var svg$1 = freeze([
		"svg",
		"a",
		"altglyph",
		"altglyphdef",
		"altglyphitem",
		"animatecolor",
		"animatemotion",
		"animatetransform",
		"circle",
		"clippath",
		"defs",
		"desc",
		"ellipse",
		"enterkeyhint",
		"exportparts",
		"filter",
		"font",
		"g",
		"glyph",
		"glyphref",
		"hkern",
		"image",
		"inputmode",
		"line",
		"lineargradient",
		"marker",
		"mask",
		"metadata",
		"mpath",
		"part",
		"path",
		"pattern",
		"polygon",
		"polyline",
		"radialgradient",
		"rect",
		"stop",
		"style",
		"switch",
		"symbol",
		"text",
		"textpath",
		"title",
		"tref",
		"tspan",
		"view",
		"vkern"
	]);
	var svgFilters = freeze([
		"feBlend",
		"feColorMatrix",
		"feComponentTransfer",
		"feComposite",
		"feConvolveMatrix",
		"feDiffuseLighting",
		"feDisplacementMap",
		"feDistantLight",
		"feDropShadow",
		"feFlood",
		"feFuncA",
		"feFuncB",
		"feFuncG",
		"feFuncR",
		"feGaussianBlur",
		"feImage",
		"feMerge",
		"feMergeNode",
		"feMorphology",
		"feOffset",
		"fePointLight",
		"feSpecularLighting",
		"feSpotLight",
		"feTile",
		"feTurbulence"
	]);
	var svgDisallowed = freeze([
		"animate",
		"color-profile",
		"cursor",
		"discard",
		"font-face",
		"font-face-format",
		"font-face-name",
		"font-face-src",
		"font-face-uri",
		"foreignobject",
		"hatch",
		"hatchpath",
		"mesh",
		"meshgradient",
		"meshpatch",
		"meshrow",
		"missing-glyph",
		"script",
		"set",
		"solidcolor",
		"unknown",
		"use"
	]);
	var mathMl$1 = freeze([
		"math",
		"menclose",
		"merror",
		"mfenced",
		"mfrac",
		"mglyph",
		"mi",
		"mlabeledtr",
		"mmultiscripts",
		"mn",
		"mo",
		"mover",
		"mpadded",
		"mphantom",
		"mroot",
		"mrow",
		"ms",
		"mspace",
		"msqrt",
		"mstyle",
		"msub",
		"msup",
		"msubsup",
		"mtable",
		"mtd",
		"mtext",
		"mtr",
		"munder",
		"munderover",
		"mprescripts"
	]);
	var mathMlDisallowed = freeze([
		"maction",
		"maligngroup",
		"malignmark",
		"mlongdiv",
		"mscarries",
		"mscarry",
		"msgroup",
		"mstack",
		"msline",
		"msrow",
		"semantics",
		"annotation",
		"annotation-xml",
		"mprescripts",
		"none"
	]);
	var text = freeze(["#text"]);
	var html = freeze([
		"accept",
		"action",
		"align",
		"alt",
		"autocapitalize",
		"autocomplete",
		"autopictureinpicture",
		"autoplay",
		"background",
		"bgcolor",
		"border",
		"capture",
		"cellpadding",
		"cellspacing",
		"checked",
		"cite",
		"class",
		"clear",
		"color",
		"cols",
		"colspan",
		"command",
		"commandfor",
		"controls",
		"controlslist",
		"coords",
		"crossorigin",
		"datetime",
		"decoding",
		"default",
		"dir",
		"disabled",
		"disablepictureinpicture",
		"disableremoteplayback",
		"download",
		"draggable",
		"enctype",
		"enterkeyhint",
		"exportparts",
		"face",
		"for",
		"headers",
		"height",
		"hidden",
		"high",
		"href",
		"hreflang",
		"id",
		"inert",
		"inputmode",
		"integrity",
		"ismap",
		"kind",
		"label",
		"lang",
		"list",
		"loading",
		"loop",
		"low",
		"max",
		"maxlength",
		"media",
		"method",
		"min",
		"minlength",
		"multiple",
		"muted",
		"name",
		"nonce",
		"noshade",
		"novalidate",
		"nowrap",
		"open",
		"optimum",
		"part",
		"pattern",
		"placeholder",
		"playsinline",
		"popover",
		"popovertarget",
		"popovertargetaction",
		"poster",
		"preload",
		"pubdate",
		"radiogroup",
		"readonly",
		"rel",
		"required",
		"rev",
		"reversed",
		"role",
		"rows",
		"rowspan",
		"spellcheck",
		"scope",
		"selected",
		"shape",
		"size",
		"sizes",
		"slot",
		"span",
		"srclang",
		"start",
		"src",
		"srcset",
		"step",
		"style",
		"summary",
		"tabindex",
		"title",
		"translate",
		"type",
		"usemap",
		"valign",
		"value",
		"width",
		"wrap",
		"xmlns"
	]);
	var svg = freeze([
		"accent-height",
		"accumulate",
		"additive",
		"alignment-baseline",
		"amplitude",
		"ascent",
		"attributename",
		"attributetype",
		"azimuth",
		"basefrequency",
		"baseline-shift",
		"begin",
		"bias",
		"by",
		"class",
		"clip",
		"clippathunits",
		"clip-path",
		"clip-rule",
		"color",
		"color-interpolation",
		"color-interpolation-filters",
		"color-profile",
		"color-rendering",
		"cx",
		"cy",
		"d",
		"dx",
		"dy",
		"diffuseconstant",
		"direction",
		"display",
		"divisor",
		"dominant-baseline",
		"dur",
		"edgemode",
		"elevation",
		"end",
		"exponent",
		"fill",
		"fill-opacity",
		"fill-rule",
		"filter",
		"filterunits",
		"flood-color",
		"flood-opacity",
		"font-family",
		"font-size",
		"font-size-adjust",
		"font-stretch",
		"font-style",
		"font-variant",
		"font-weight",
		"fx",
		"fy",
		"g1",
		"g2",
		"glyph-name",
		"glyphref",
		"gradientunits",
		"gradienttransform",
		"height",
		"href",
		"id",
		"image-rendering",
		"in",
		"in2",
		"intercept",
		"k",
		"k1",
		"k2",
		"k3",
		"k4",
		"kerning",
		"keypoints",
		"keysplines",
		"keytimes",
		"lang",
		"lengthadjust",
		"letter-spacing",
		"kernelmatrix",
		"kernelunitlength",
		"lighting-color",
		"local",
		"marker-end",
		"marker-mid",
		"marker-start",
		"markerheight",
		"markerunits",
		"markerwidth",
		"maskcontentunits",
		"maskunits",
		"max",
		"mask",
		"mask-type",
		"media",
		"method",
		"mode",
		"min",
		"name",
		"numoctaves",
		"offset",
		"operator",
		"opacity",
		"order",
		"orient",
		"orientation",
		"origin",
		"overflow",
		"paint-order",
		"path",
		"pathlength",
		"patterncontentunits",
		"patterntransform",
		"patternunits",
		"pointer-events",
		"points",
		"preservealpha",
		"preserveaspectratio",
		"primitiveunits",
		"r",
		"rx",
		"ry",
		"radius",
		"refx",
		"refy",
		"repeatcount",
		"repeatdur",
		"restart",
		"result",
		"rotate",
		"scale",
		"seed",
		"shape-rendering",
		"slope",
		"specularconstant",
		"specularexponent",
		"spreadmethod",
		"startoffset",
		"stddeviation",
		"stitchtiles",
		"stop-color",
		"stop-opacity",
		"stroke-dasharray",
		"stroke-dashoffset",
		"stroke-linecap",
		"stroke-linejoin",
		"stroke-miterlimit",
		"stroke-opacity",
		"stroke",
		"stroke-width",
		"style",
		"surfacescale",
		"systemlanguage",
		"tabindex",
		"tablevalues",
		"targetx",
		"targety",
		"transform",
		"transform-origin",
		"text-anchor",
		"text-decoration",
		"text-orientation",
		"text-rendering",
		"textlength",
		"type",
		"u1",
		"u2",
		"unicode",
		"values",
		"vector-effect",
		"viewbox",
		"visibility",
		"version",
		"vert-adv-y",
		"vert-origin-x",
		"vert-origin-y",
		"width",
		"word-spacing",
		"wrap",
		"writing-mode",
		"xchannelselector",
		"ychannelselector",
		"x",
		"x1",
		"x2",
		"xmlns",
		"y",
		"y1",
		"y2",
		"z",
		"zoomandpan"
	]);
	var mathMl = freeze([
		"accent",
		"accentunder",
		"align",
		"bevelled",
		"close",
		"columnalign",
		"columnlines",
		"columnspacing",
		"columnspan",
		"denomalign",
		"depth",
		"dir",
		"display",
		"displaystyle",
		"encoding",
		"fence",
		"frame",
		"height",
		"href",
		"id",
		"largeop",
		"length",
		"linethickness",
		"lquote",
		"lspace",
		"mathbackground",
		"mathcolor",
		"mathsize",
		"mathvariant",
		"maxsize",
		"minsize",
		"movablelimits",
		"notation",
		"numalign",
		"open",
		"rowalign",
		"rowlines",
		"rowspacing",
		"rowspan",
		"rspace",
		"rquote",
		"scriptlevel",
		"scriptminsize",
		"scriptsizemultiplier",
		"selection",
		"separator",
		"separators",
		"stretchy",
		"subscriptshift",
		"supscriptshift",
		"symmetric",
		"voffset",
		"width",
		"xmlns"
	]);
	var xml = freeze([
		"xlink:href",
		"xml:id",
		"xlink:title",
		"xml:space",
		"xmlns:xlink"
	]);
	var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
	var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
	var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
	var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
	var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
	var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
	var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
	var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
	var DOCTYPE_NAME = seal(/^html$/i);
	var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
	var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
	var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
	var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
	var SELF_CLOSING_TAG = seal(/\/>/i);
	var NODE_TYPE = {
		element: 1,
		attribute: 2,
		text: 3,
		cdataSection: 4,
		entityReference: 5,
		entityNode: 6,
		processingInstruction: 7,
		comment: 8,
		document: 9,
		documentType: 10,
		documentFragment: 11,
		notation: 12
	};
	var LITERAL_TEXT_ELEMENT_NAMES = [
		"style",
		"script",
		"xmp",
		"iframe",
		"noembed",
		"noframes",
		"plaintext",
		"noscript"
	];
	var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, LITERAL_TEXT_ELEMENT_NAMES));
	var LITERAL_TEXT_CLOSE = function() {
		const map = {};
		arrayForEach(LITERAL_TEXT_ELEMENT_NAMES, (name) => {
			map[name] = seal(new RegExp("</" + name + "(?=[\\t\\n\\f\\r />])", "i"));
		});
		return freeze(map);
	}();
	var getGlobal = function getGlobal() {
		return typeof window === "undefined" ? null : window;
	};
	var _createTrustedTypesPolicy = function _createTrustedTypesPolicy(trustedTypes, purifyHostElement) {
		if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
		let suffix = null;
		const ATTR_NAME = "data-tt-policy-suffix";
		if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
		const policyName = "dompurify" + (suffix ? "#" + suffix : "");
		try {
			return trustedTypes.createPolicy(policyName, {
				createHTML(html) {
					return html;
				},
				createScriptURL(scriptUrl) {
					return scriptUrl;
				}
			});
		} catch (_) {
			console.warn("TrustedTypes policy " + policyName + " could not be created.");
			return null;
		}
	};
	var _createHooksMap = function _createHooksMap() {
		return {
			afterSanitizeAttributes: [],
			afterSanitizeElements: [],
			afterSanitizeShadowDOM: [],
			beforeSanitizeAttributes: [],
			beforeSanitizeElements: [],
			beforeSanitizeShadowDOM: [],
			uponSanitizeAttribute: [],
			uponSanitizeElement: [],
			uponSanitizeShadowNode: []
		};
	};
	var _resolveSetOption = function _resolveSetOption(cfg, key, fallback, options) {
		return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
	};
	var _resolveObjectOption = function _resolveObjectOption(cfg, key, makeFallback) {
		const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
		return value && typeof value === "object" ? clone(value) : makeFallback();
	};
	function createDOMPurify() {
		let window = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
		const DOMPurify = (root) => createDOMPurify(root);
		DOMPurify.version = "3.4.15";
		DOMPurify.removed = [];
		if (!window || !window.document || window.document.nodeType !== NODE_TYPE.document || !window.Element) {
			DOMPurify.isSupported = false;
			return DOMPurify;
		}
		let document = window.document;
		const originalDocument = document;
		const currentScript = originalDocument.currentScript;
		window.DocumentFragment;
		const HTMLTemplateElement = window.HTMLTemplateElement, Node = window.Node, Element = window.Element, NodeFilter = window.NodeFilter;
		window.NamedNodeMap === void 0 && (window.NamedNodeMap || window.MozNamedAttrMap);
		window.HTMLFormElement;
		const DOMParser = window.DOMParser, trustedTypes = window.trustedTypes;
		const ElementPrototype = Element.prototype;
		const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
		const remove = lookupGetter(ElementPrototype, "remove");
		const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
		const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
		const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
		const getParentNode = lookupGetter(ElementPrototype, "parentNode");
		const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
		const getAttributes = lookupGetter(ElementPrototype, "attributes");
		const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
		const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
		const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
		const _readNodeType = function _readNodeType(node) {
			return getNodeType ? getNodeType(node) : node.nodeType;
		};
		const _readNodeName = function _readNodeName(node) {
			return getNodeName ? getNodeName(node) : node.nodeName;
		};
		if (typeof HTMLTemplateElement === "function") {
			const template = document.createElement("template");
			if (template.content && template.content.ownerDocument) document = template.content.ownerDocument;
		}
		let trustedTypesPolicy;
		let emptyHTML = "";
		let defaultTrustedTypesPolicy;
		let defaultTrustedTypesPolicyResolved = false;
		let IN_TRUSTED_TYPES_POLICY = 0;
		const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
			if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
		};
		const _createTrustedHTML = function _createTrustedHTML(html) {
			_assertNotInTrustedTypesPolicy();
			IN_TRUSTED_TYPES_POLICY++;
			try {
				return trustedTypesPolicy.createHTML(html);
			} finally {
				IN_TRUSTED_TYPES_POLICY--;
			}
		};
		const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
			_assertNotInTrustedTypesPolicy();
			IN_TRUSTED_TYPES_POLICY++;
			try {
				return trustedTypesPolicy.createScriptURL(scriptUrl);
			} finally {
				IN_TRUSTED_TYPES_POLICY--;
			}
		};
		const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
			if (!defaultTrustedTypesPolicyResolved) {
				defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
				defaultTrustedTypesPolicyResolved = true;
			}
			return defaultTrustedTypesPolicy;
		};
		const _document = document, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
		const importNode = originalDocument.importNode;
		let hooks = _createHooksMap();
		DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
		const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
		let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
		let ALLOWED_TAGS = null;
		const DEFAULT_ALLOWED_TAGS = addToSet({}, [
			...html$1,
			...svg$1,
			...svgFilters,
			...mathMl$1,
			...text
		]);
		let ALLOWED_ATTR = null;
		const DEFAULT_ALLOWED_ATTR = addToSet({}, [
			...html,
			...svg,
			...mathMl,
			...xml
		]);
		let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
			tagNameCheck: {
				writable: true,
				configurable: false,
				enumerable: true,
				value: null
			},
			attributeNameCheck: {
				writable: true,
				configurable: false,
				enumerable: true,
				value: null
			},
			allowCustomizedBuiltInElements: {
				writable: true,
				configurable: false,
				enumerable: true,
				value: false
			}
		}));
		let FORBID_TAGS = null;
		let FORBID_ATTR = null;
		const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
			tagCheck: {
				writable: true,
				configurable: false,
				enumerable: true,
				value: null
			},
			attributeCheck: {
				writable: true,
				configurable: false,
				enumerable: true,
				value: null
			}
		}));
		let ALLOW_ARIA_ATTR = true;
		let ALLOW_DATA_ATTR = true;
		let ALLOW_UNKNOWN_PROTOCOLS = false;
		let ALLOW_SELF_CLOSE_IN_ATTR = true;
		let SAFE_FOR_TEMPLATES = false;
		let SAFE_FOR_XML = true;
		let WHOLE_DOCUMENT = false;
		let SET_CONFIG = false;
		let SET_CONFIG_ALLOWED_TAGS = null;
		let SET_CONFIG_ALLOWED_ATTR = null;
		let FORCE_BODY = false;
		let RETURN_DOM = false;
		let RETURN_DOM_FRAGMENT = false;
		let RETURN_TRUSTED_TYPE = false;
		let SANITIZE_DOM = true;
		let SANITIZE_NAMED_PROPS = false;
		const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
		let KEEP_CONTENT = true;
		let IN_PLACE = false;
		let USE_PROFILES = {};
		let FORBID_CONTENTS = null;
		const DEFAULT_FORBID_CONTENTS = addToSet({}, [
			"annotation-xml",
			"audio",
			"colgroup",
			"desc",
			"foreignobject",
			"head",
			"iframe",
			"math",
			"mi",
			"mn",
			"mo",
			"ms",
			"mtext",
			"noembed",
			"noframes",
			"noscript",
			"plaintext",
			"script",
			"selectedcontent",
			"style",
			"svg",
			"template",
			"thead",
			"title",
			"video",
			"xmp"
		]);
		let DATA_URI_TAGS = null;
		const DEFAULT_DATA_URI_TAGS = addToSet({}, [
			"audio",
			"video",
			"img",
			"source",
			"image",
			"track"
		]);
		let URI_SAFE_ATTRIBUTES = null;
		const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
			"alt",
			"class",
			"for",
			"id",
			"label",
			"name",
			"pattern",
			"placeholder",
			"role",
			"summary",
			"title",
			"value",
			"style",
			"xmlns"
		]);
		const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
		const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
		const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
		let NAMESPACE = HTML_NAMESPACE;
		let IS_EMPTY_INPUT = false;
		let ALLOWED_NAMESPACES = null;
		const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
			MATHML_NAMESPACE,
			SVG_NAMESPACE,
			HTML_NAMESPACE
		], stringToString);
		const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
			"mi",
			"mo",
			"mn",
			"ms",
			"mtext"
		]);
		let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
		const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
		let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
		const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
			"title",
			"style",
			"font",
			"a",
			"script"
		]);
		let PARSER_MEDIA_TYPE = null;
		const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
		const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
		let transformCaseFunc = null;
		let CONFIG = null;
		const formElement = document.createElement("form");
		const isRegexOrFunction = function isRegexOrFunction(testValue) {
			return testValue instanceof RegExp || testValue instanceof Function;
		};
		const _parseConfig = function _parseConfig() {
			let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
			if (CONFIG && CONFIG === cfg) return;
			if (!cfg || typeof cfg !== "object") cfg = {};
			cfg = clone(cfg);
			PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
			transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
			ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
			ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
			ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
			URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
				transform: transformCaseFunc,
				base: DEFAULT_URI_SAFE_ATTRIBUTES
			});
			DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
				transform: transformCaseFunc,
				base: DEFAULT_DATA_URI_TAGS
			});
			FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
			FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
			FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
			USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
			ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
			ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
			ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
			ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
			SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
			SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
			WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
			RETURN_DOM = cfg.RETURN_DOM || false;
			RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
			RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
			FORCE_BODY = cfg.FORCE_BODY || false;
			SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
			SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
			KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
			IN_PLACE = cfg.IN_PLACE || false;
			IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
			NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
			MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
			HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
			const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
			CUSTOM_ELEMENT_HANDLING = create(null);
			if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
			if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
			if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
			seal(CUSTOM_ELEMENT_HANDLING);
			if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
			if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
			if (USE_PROFILES) {
				ALLOWED_TAGS = addToSet({}, text);
				ALLOWED_ATTR = create(null);
				if (USE_PROFILES.html === true) {
					addToSet(ALLOWED_TAGS, html$1);
					addToSet(ALLOWED_ATTR, html);
				}
				if (USE_PROFILES.svg === true) {
					addToSet(ALLOWED_TAGS, svg$1);
					addToSet(ALLOWED_ATTR, svg);
					addToSet(ALLOWED_ATTR, xml);
				}
				if (USE_PROFILES.svgFilters === true) {
					addToSet(ALLOWED_TAGS, svgFilters);
					addToSet(ALLOWED_ATTR, svg);
					addToSet(ALLOWED_ATTR, xml);
				}
				if (USE_PROFILES.mathMl === true) {
					addToSet(ALLOWED_TAGS, mathMl$1);
					addToSet(ALLOWED_ATTR, mathMl);
					addToSet(ALLOWED_ATTR, xml);
				}
			}
			EXTRA_ELEMENT_HANDLING.tagCheck = null;
			EXTRA_ELEMENT_HANDLING.attributeCheck = null;
			if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
				if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
				else if (arrayIsArray(cfg.ADD_TAGS)) {
					if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
					addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
				}
			}
			if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
				if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
				else if (arrayIsArray(cfg.ADD_ATTR)) {
					if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
					addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
				}
			}
			if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
				if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
				addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
			}
			if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
			if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
				"html",
				"head",
				"body"
			]);
			if (ALLOWED_TAGS.table) {
				addToSet(ALLOWED_TAGS, ["tbody"]);
				delete FORBID_TAGS.tbody;
			}
			if (cfg.TRUSTED_TYPES_POLICY) {
				if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
				if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
				const previousTrustedTypesPolicy = trustedTypesPolicy;
				trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
				try {
					emptyHTML = _createTrustedHTML("");
				} catch (error) {
					trustedTypesPolicy = previousTrustedTypesPolicy;
					throw error;
				}
			} else if (cfg.TRUSTED_TYPES_POLICY === null) {
				trustedTypesPolicy = void 0;
				emptyHTML = "";
			} else {
				if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
				if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
			}
			if (freeze) freeze(cfg);
			CONFIG = cfg;
		};
		const ALL_SVG_TAGS = addToSet({}, [
			...svg$1,
			...svgFilters,
			...svgDisallowed
		]);
		const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
		const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
			if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
			if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
			return Boolean(ALL_SVG_TAGS[tagName]);
		};
		const _checkMathMlNamespace = function _checkMathMlNamespace(tagName, parent, parentTagName) {
			if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
			if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
			return Boolean(ALL_MATHML_TAGS[tagName]);
		};
		const _checkHtmlNamespace = function _checkHtmlNamespace(tagName, parent, parentTagName) {
			if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
			if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
			return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
		};
		const _checkValidNamespace = function _checkValidNamespace(element) {
			let parent = getParentNode(element);
			if (!parent || !parent.tagName) parent = {
				namespaceURI: NAMESPACE,
				tagName: "template"
			};
			const tagName = stringToLowerCase(element.tagName);
			const parentTagName = stringToLowerCase(parent.tagName);
			if (!ALLOWED_NAMESPACES[element.namespaceURI]) return false;
			if (element.namespaceURI === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
			if (element.namespaceURI === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
			if (element.namespaceURI === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
			if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) return true;
			return false;
		};
		const _forceRemove = function _forceRemove(node) {
			arrayPush(DOMPurify.removed, { element: node });
			try {
				getParentNode(node).removeChild(node);
			} catch (_) {
				remove(node);
				if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
			}
		};
		const _stripAttributeNode = function _stripAttributeNode(element, attribute, name) {
			try {
				removeAttributeNode(element, attribute);
			} catch (_) {
				try {
					element.removeAttribute(name);
				} catch (_) {}
			}
		};
		const _neutralizeRoot = function _neutralizeRoot(root) {
			_neutralizeSubtree(root);
			const childNodes = getChildNodes(root);
			if (childNodes) {
				const snapshot = [];
				arrayForEach(childNodes, (child) => {
					arrayPush(snapshot, child);
				});
				arrayForEach(snapshot, (child) => {
					try {
						remove(child);
					} catch (_) {}
				});
			}
			const attributes = getAttributes(root);
			if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
				const attribute = attributes[i];
				const name = attribute && attribute.name;
				if (typeof name === "string") _stripAttributeNode(root, attribute, name);
			}
		};
		const _removeAttribute = function _removeAttribute(name, element, attr) {
			if (!attr) try {
				attr = element.getAttributeNode(name);
			} catch (_) {
				attr = null;
			}
			arrayPush(DOMPurify.removed, {
				attribute: attr || null,
				from: element
			});
			try {
				if (attr) removeAttributeNode(element, attr);
				else element.removeAttribute(name);
			} catch (_) {
				try {
					element.removeAttribute(name);
				} catch (_) {}
			}
			if (name === "is") {
				if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
					_forceRemove(element);
				} catch (_) {}
				else try {
					element.setAttribute(name, "");
				} catch (_) {}
			}
		};
		const _stripDisallowedAttributes = function _stripDisallowedAttributes(element) {
			const attributes = getAttributes(element);
			if (!attributes) return;
			for (let i = attributes.length - 1; i >= 0; --i) {
				const attribute = attributes[i];
				const name = attribute && attribute.name;
				if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
				_stripAttributeNode(element, attribute, name);
			}
		};
		const _neutralizeSubtree = function _neutralizeSubtree(root) {
			const stack = [root];
			while (stack.length > 0) {
				const node = stack.pop();
				if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
				const childNodes = getChildNodes(node);
				if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
			}
		};
		const _isPatchLinkageAttribute = function _isPatchLinkageAttribute(lcName, lcTag) {
			if (!SAFE_FOR_XML) return false;
			if (lcName === "patchsrc") return true;
			return lcName === "for" && lcTag !== "label" && lcTag !== "output";
		};
		const _neutralizePatchLinkage = function _neutralizePatchLinkage(root) {
			if (!SAFE_FOR_XML) return;
			const stack = [root];
			while (stack.length > 0) {
				const node = stack.pop();
				const nodeType = _readNodeType(node);
				if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
					try {
						remove(node);
					} catch (_) {}
					continue;
				}
				if (nodeType === NODE_TYPE.element) {
					const element = node;
					const lcTag = transformCaseFunc(_readNodeName(node));
					try {
						if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
						if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
					} catch (_) {}
				}
				const childNodes = getChildNodes(node);
				if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
			}
		};
		const _initDocument = function _initDocument(dirty) {
			let doc = null;
			let leadingWhitespace = null;
			if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
			else {
				const matches = stringMatch(dirty, /^[\r\n\t ]+/);
				leadingWhitespace = matches && matches[0];
			}
			if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + dirty + "</body></html>";
			const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
			if (NAMESPACE === HTML_NAMESPACE) try {
				doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
			} catch (_) {}
			if (!doc || !doc.documentElement) {
				doc = implementation.createDocument(NAMESPACE, "template", null);
				try {
					doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
				} catch (_) {}
			}
			const body = doc.body || doc.documentElement;
			if (dirty && leadingWhitespace) body.insertBefore(document.createTextNode(leadingWhitespace), body.childNodes[0] || null);
			if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
			return WHOLE_DOCUMENT ? doc.documentElement : body;
		};
		const _createNodeIterator = function _createNodeIterator(root) {
			const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
			return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
		};
		const _stripTemplateExpressions = function _stripTemplateExpressions(value) {
			value = stringReplace(value, MUSTACHE_EXPR$1, " ");
			value = stringReplace(value, ERB_EXPR$1, " ");
			value = stringReplace(value, TMPLIT_EXPR$1, " ");
			return value;
		};
		const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
			var _node$querySelectorAl;
			node.normalize();
			const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
			const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
			let currentNode = walker.nextNode();
			while (currentNode) {
				currentNode.data = _stripTemplateExpressions(currentNode.data);
				currentNode = walker.nextNode();
			}
			const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
			if (templates) arrayForEach(templates, (tmpl) => {
				if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
			});
		};
		const _isClobbered = function _isClobbered(element) {
			const realTagName = getNodeName ? getNodeName(element) : null;
			if (typeof realTagName !== "string") return false;
			if (transformCaseFunc(realTagName) !== "form") return false;
			return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
		};
		const _isDocumentFragment = function _isDocumentFragment(value) {
			if (!getNodeType || typeof value !== "object" || value === null) return false;
			try {
				return getNodeType(value) === NODE_TYPE.documentFragment;
			} catch (_) {
				return false;
			}
		};
		const _isNode = function _isNode(value) {
			if (!getNodeType || typeof value !== "object" || value === null) return false;
			try {
				return typeof getNodeType(value) === "number";
			} catch (_) {
				return false;
			}
		};
		function _executeHooks(hooks, currentNode, data) {
			if (hooks.length === 0) return;
			arrayForEach(hooks, (hook) => {
				hook.call(DOMPurify, currentNode, data, CONFIG);
			});
		}
		const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
			if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
			if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) return true;
			if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
			if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
			return false;
		};
		const _matchesNameCheck = function _matchesNameCheck(check, name) {
			if (check instanceof RegExp) return regExpTest(check, name);
			if (check instanceof Function) {
				for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
				return Boolean(check(name, ...args));
			}
			return false;
		};
		const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName, root) {
			if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
			if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
				const parentNode = getParentNode(currentNode);
				const childNodes = getChildNodes(currentNode);
				if (childNodes && parentNode) {
					const childCount = childNodes.length;
					for (let i = childCount - 1; i >= 0; --i) {
						const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
						parentNode.insertBefore(hoisted, getNextSibling(currentNode));
					}
				}
			}
			_forceRemove(currentNode);
			return true;
		};
		const _forkSharedAllowlist = function _forkSharedAllowlist(hookList, set, defaultSet, setConfigSet) {
			if (hookList.length === 0) return set;
			return set === defaultSet || set === setConfigSet ? clone(set) : set;
		};
		const _handleHookDetachedNode = function _handleHookDetachedNode(currentNode, root) {
			if (currentNode === root || getParentNode(currentNode) !== null) return false;
			if (IN_PLACE) _neutralizeSubtree(currentNode);
			return true;
		};
		const _sanitizeElements = function _sanitizeElements(currentNode, root) {
			_executeHooks(hooks.beforeSanitizeElements, currentNode, null);
			if (_handleHookDetachedNode(currentNode, root)) return true;
			if (_isClobbered(currentNode)) {
				_forceRemove(currentNode);
				return true;
			}
			const tagName = transformCaseFunc(_readNodeName(currentNode));
			ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
			_executeHooks(hooks.uponSanitizeElement, currentNode, {
				tagName,
				allowedTags: ALLOWED_TAGS
			});
			if (_handleHookDetachedNode(currentNode, root)) return true;
			if (_isUnsafeNode(currentNode, tagName)) {
				_forceRemove(currentNode);
				return true;
			}
			if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
				const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
				if (removed === false) _executeHooks(hooks.afterSanitizeElements, currentNode, null);
				return removed;
			}
			if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
				_forceRemove(currentNode);
				return true;
			}
			if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
				_forceRemove(currentNode);
				return true;
			}
			if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
				const content = _stripTemplateExpressions(currentNode.textContent);
				if (currentNode.textContent !== content) {
					arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
					currentNode.textContent = content;
				}
			}
			_executeHooks(hooks.afterSanitizeElements, currentNode, null);
			return false;
		};
		const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
			if (FORBID_ATTR[lcName]) return false;
			if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
			if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document || value in formElement)) return false;
			const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
			if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
			if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
			if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
			if (URI_SAFE_ATTRIBUTES[lcName]) return true;
			if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
			if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
			if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
			return !value;
		};
		const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
			"annotation-xml",
			"color-profile",
			"font-face",
			"font-face-format",
			"font-face-name",
			"font-face-src",
			"font-face-uri",
			"missing-glyph"
		]);
		const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
			return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
		};
		const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
			if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
				case "TrustedHTML": return _createTrustedHTML(value);
				case "TrustedScriptURL": return _createTrustedScriptURL(value);
			}
			return value;
		};
		const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
			try {
				if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
				else currentNode.setAttribute(name, value);
				if (_isClobbered(currentNode)) {
					_forceRemove(currentNode);
					return false;
				}
				return true;
			} catch (_) {
				_removeAttribute(name, currentNode);
				return false;
			}
		};
		const _sanitizeAttributes = function _sanitizeAttributes(currentNode) {
			_executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
			const attributes = currentNode.attributes;
			if (!attributes || _isClobbered(currentNode)) return;
			ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
			const hookEvent = {
				attrName: "",
				attrValue: "",
				keepAttr: true,
				allowedAttributes: ALLOWED_ATTR,
				forceKeepAttr: void 0
			};
			let l = attributes.length;
			const lcTag = transformCaseFunc(currentNode.nodeName);
			while (l--) {
				const attr = attributes[l];
				const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
				const lcName = transformCaseFunc(name);
				const initValue = attrValue;
				let value = name === "value" ? initValue : stringTrim(initValue);
				let recreatedNamedProp = false;
				hookEvent.attrName = lcName;
				hookEvent.attrValue = value;
				hookEvent.keepAttr = true;
				hookEvent.forceKeepAttr = void 0;
				_executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
				value = hookEvent.attrValue;
				if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
					_removeAttribute(name, currentNode, attr);
					value = SANITIZE_NAMED_PROPS_PREFIX + value;
					recreatedNamedProp = true;
				}
				if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
					_removeAttribute(name, currentNode, attr);
					continue;
				}
				if (lcName === "attributename" && stringMatch(value, "href")) {
					_removeAttribute(name, currentNode, attr);
					continue;
				}
				if (hookEvent.forceKeepAttr) continue;
				if (!hookEvent.keepAttr) {
					_removeAttribute(name, currentNode, attr);
					continue;
				}
				if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
					_removeAttribute(name, currentNode, attr);
					continue;
				}
				if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
				if (!_isValidAttribute(lcTag, lcName, value)) {
					_removeAttribute(name, currentNode, attr);
					continue;
				}
				value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
				if (value !== initValue) {
					if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
				}
			}
			_executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
		};
		const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
			let shadowNode = null;
			const shadowIterator = _createNodeIterator(fragment);
			_executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
			while (shadowNode = shadowIterator.nextNode()) {
				_executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
				_sanitizeElements(shadowNode, fragment);
				_sanitizeAttributes(shadowNode);
				if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
				if (_readNodeType(shadowNode) === NODE_TYPE.element) {
					const innerSr = getShadowRoot(shadowNode);
					if (_isDocumentFragment(innerSr)) {
						_sanitizeAttachedShadowRoots(innerSr);
						_sanitizeShadowDOM2(innerSr);
					}
				}
			}
			_executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
		};
		const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
			const stack = [{
				node: root,
				shadow: null
			}];
			while (stack.length > 0) {
				const item = stack.pop();
				if (item.shadow) {
					_sanitizeShadowDOM2(item.shadow);
					continue;
				}
				const node = item.node;
				const isElement = _readNodeType(node) === NODE_TYPE.element;
				const childNodes = getChildNodes(node);
				if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
					node: childNodes[i],
					shadow: null
				});
				if (isElement) {
					const rootName = getNodeName ? getNodeName(node) : null;
					if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
						const content = node.content;
						if (_isDocumentFragment(content)) stack.push({
							node: content,
							shadow: null
						});
					}
				}
				if (isElement) {
					const sr = getShadowRoot(node);
					if (_isDocumentFragment(sr)) stack.push({
						node: null,
						shadow: sr
					}, {
						node: sr,
						shadow: null
					});
				}
			}
		};
		DOMPurify.sanitize = function(dirty) {
			let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
			let body = null;
			let importedNode = null;
			let currentNode = null;
			let returnNode = null;
			IS_EMPTY_INPUT = !dirty;
			if (IS_EMPTY_INPUT) dirty = "<!-->";
			if (typeof dirty !== "string" && !_isNode(dirty)) {
				dirty = stringifyValue(dirty);
				if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
			}
			if (!DOMPurify.isSupported) return dirty;
			if (SET_CONFIG) {
				ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
				ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
			} else _parseConfig(cfg);
			if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
			if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
			DOMPurify.removed = [];
			const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
			if (inPlace) {
				_neutralizePatchLinkage(dirty);
				const nn = _readNodeName(dirty);
				if (typeof nn === "string") {
					const tagName = transformCaseFunc(nn);
					if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
						_neutralizeRoot(dirty);
						throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
					}
				}
				if (_isClobbered(dirty)) {
					_neutralizeRoot(dirty);
					throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
				}
				try {
					_sanitizeAttachedShadowRoots(dirty);
				} catch (error) {
					_neutralizeRoot(dirty);
					throw error;
				}
			} else if (_isNode(dirty)) {
				body = _initDocument("<!---->");
				importedNode = body.ownerDocument.importNode(dirty, true);
				if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
				else if (importedNode.nodeName === "HTML") body = importedNode;
				else body.appendChild(importedNode);
				_sanitizeAttachedShadowRoots(body);
			} else {
				if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
				body = _initDocument(dirty);
				if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
			}
			if (body && FORCE_BODY) _forceRemove(body.firstChild);
			const walkRoot = inPlace ? dirty : body;
			try {
				const nodeIterator = _createNodeIterator(walkRoot);
				while (currentNode = nodeIterator.nextNode()) {
					_sanitizeElements(currentNode, walkRoot);
					_sanitizeAttributes(currentNode);
					if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
				}
			} catch (error) {
				if (inPlace) {
					_neutralizeRoot(dirty);
					arrayForEach(DOMPurify.removed, (entry) => {
						if (entry.element) _neutralizeSubtree(entry.element);
					});
				}
				throw error;
			}
			if (inPlace) {
				arrayForEach(DOMPurify.removed, (entry) => {
					if (entry.element) _neutralizeSubtree(entry.element);
				});
				if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
				return dirty;
			}
			if (RETURN_DOM) {
				if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
				if (RETURN_DOM_FRAGMENT) {
					returnNode = createDocumentFragment.call(body.ownerDocument);
					while (body.firstChild) returnNode.appendChild(body.firstChild);
				} else returnNode = body;
				if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
				return returnNode;
			}
			let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
			if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
			if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
			return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
		};
		DOMPurify.setConfig = function() {
			let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
			_parseConfig(cfg);
			SET_CONFIG = true;
			SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
			SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
		};
		DOMPurify.clearConfig = function() {
			CONFIG = null;
			SET_CONFIG = false;
			SET_CONFIG_ALLOWED_TAGS = null;
			SET_CONFIG_ALLOWED_ATTR = null;
			trustedTypesPolicy = defaultTrustedTypesPolicy;
			emptyHTML = "";
		};
		DOMPurify.isValidAttribute = function(tag, attr, value) {
			if (!CONFIG) _parseConfig({});
			const lcTag = transformCaseFunc(tag);
			const lcName = transformCaseFunc(attr);
			return _isValidAttribute(lcTag, lcName, value);
		};
		DOMPurify.addHook = function(entryPoint, hookFunction) {
			if (typeof hookFunction !== "function") return;
			if (!objectHasOwnProperty(hooks, entryPoint)) return;
			arrayPush(hooks[entryPoint], hookFunction);
		};
		DOMPurify.removeHook = function(entryPoint, hookFunction) {
			if (!objectHasOwnProperty(hooks, entryPoint)) return;
			if (hookFunction !== void 0) {
				const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
				return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
			}
			return arrayPop(hooks[entryPoint]);
		};
		DOMPurify.removeHooks = function(entryPoint) {
			if (!objectHasOwnProperty(hooks, entryPoint)) return;
			hooks[entryPoint] = [];
		};
		DOMPurify.removeAllHooks = function() {
			hooks = _createHooksMap();
		};
		return DOMPurify;
	}
	var purify = createDOMPurify();
	var DEFAULT_CONFIG = {
		USE_PROFILES: {
			html: true,
			svg: true
		},
		ADD_DATA_URI_TAGS: ["img"],
		ADD_ATTR: [
			"data-src",
			"data-original",
			"data-lazy-src",
			"data-original-src",
			"data-srcset",
			"data-url",
			"data-actualsrc",
			"data-echo"
		],
		ALLOW_DATA_ATTR: false,
		FORBID_TAGS: [
			"script",
			"iframe",
			"object",
			"embed",
			"link",
			"meta",
			"style",
			"form",
			"input",
			"button"
		],
		FORBID_ATTR: [
			"onload",
			"onclick",
			"onerror",
			"onmouseover",
			"onfocus",
			"onmouseenter",
			"onmouseleave",
			"onkeydown",
			"onkeyup",
			"onkeypress",
			"onmousedown",
			"onmouseup",
			"onmousemove",
			"ontouchstart",
			"ontouchend",
			"onfocusin",
			"onfocusout",
			"onblur",
			"onscroll",
			"onresize",
			"onsubmit",
			"onreset",
			"onchange",
			"oninput"
		],
		SANITIZE_DOM: true,
		KEEP_CONTENT: true
	};
	var domPurifyHooksInstalled = false;
	function sanitizeSvgContent(html) {
		return html.replace(/<svg[^>]*>/gi, (match) => {
			return match.replace(/\s+on\w+\s*=\s*(["'][^"']*["']|[^\s>]*)/gi, "");
		}).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
	}
	function isUnsafeInlineStyle(value) {
		let compact = "";
		for (const character of value) if (character.charCodeAt(0) > 32) compact += character.toLowerCase();
		return compact.includes("expression(") || compact.includes("url(javascript:") || compact.includes("url('javascript:") || compact.includes("url(\"javascript:") || compact.includes("url(vbscript:") || compact.includes("url('vbscript:") || compact.includes("url(\"vbscript:");
	}
	function basicSanitize(html) {
		if (typeof document === "undefined") return html;
		html = sanitizeSvgContent(html);
		const container = document.createElement("div");
		container.innerHTML = html;
		[
			"script",
			"iframe",
			"object",
			"embed",
			"link",
			"meta",
			"style",
			"input",
			"button",
			"textarea",
			"select"
		].forEach((tag) => {
			container.querySelectorAll(tag).forEach((el) => el.remove());
		});
		container.querySelectorAll("form").forEach((form) => {
			const parent = form.parentNode;
			if (!parent) {
				form.remove();
				return;
			}
			while (form.firstChild) parent.insertBefore(form.firstChild, form);
			form.remove();
		});
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
		while (walker.nextNode()) {
			const el = walker.currentNode;
			const attrsToRemove = [];
			for (const attr of Array.from(el.attributes)) {
				const name = attr.name.toLowerCase();
				const value = attr.value.trim().toLowerCase();
				if (name.startsWith("on")) {
					attrsToRemove.push(attr.name);
					continue;
				}
				if (name === "href" || name === "xlink:href") {
					if (value.startsWith("javascript:") || value.startsWith("vbscript:") || value.startsWith("data:")) {
						attrsToRemove.push(attr.name);
						continue;
					}
				}
				if (name === "src") {
					if (value.startsWith("javascript:") || value.startsWith("vbscript:")) {
						attrsToRemove.push(attr.name);
						continue;
					}
					if (value.startsWith("data:")) {
						if (el.tagName.toLowerCase() !== "img" || !isSafeDataImageUrl(attr.value)) {
							attrsToRemove.push(attr.name);
							continue;
						}
					}
				}
				if (name === "style") {
					attrsToRemove.push(attr.name);
					continue;
				}
			}
			attrsToRemove.forEach((attrName) => el.removeAttribute(attrName));
		}
		return container.innerHTML;
	}
	function sanitizeHtml(html, config = DEFAULT_CONFIG) {
		if (!html) return html;
		try {
			html = sanitizeSvgContent(html);
			if (typeof window === "undefined" || typeof purify?.sanitize !== "function") return basicSanitize(html);
			if (!domPurifyHooksInstalled && typeof purify?.addHook === "function") {
				purify.addHook("uponSanitizeAttribute", (_node, data) => {
					if (data.attrName.toLowerCase() === "style" && isUnsafeInlineStyle(data.attrValue)) data.keepAttr = false;
				});
				purify.addHook("afterSanitizeAttributes", (node) => {
					const el = node;
					if (!el || el.nodeType !== 1) return;
					if (el.tagName.toLowerCase() !== "img") return;
					const src = el.getAttribute("src");
					if (!src || !src.trim().toLowerCase().startsWith("data:")) return;
					if (!isSafeDataImageUrl(src)) el.removeAttribute("src");
				});
				domPurifyHooksInstalled = true;
			}
			return purify.sanitize(html, config);
		} catch {
			return basicSanitize(html);
		}
	}
	var SAFE_DATA_IMAGE_MIME_TYPES = new Set([
		"image/apng",
		"image/avif",
		"image/bmp",
		"image/gif",
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/webp"
	]);
	function isSafeDataImageUrl(url) {
		const trimmed = url.trim();
		const lower = trimmed.toLowerCase();
		if (!lower.startsWith("data:image/")) return false;
		const commaIndex = trimmed.indexOf(",");
		if (commaIndex === -1) return false;
		const meta = lower.slice(5, commaIndex);
		const mime = meta.split(";")[0] || "";
		if (!SAFE_DATA_IMAGE_MIME_TYPES.has(mime)) return false;
		if (!meta.includes(";base64")) return false;
		return true;
	}
	function sanitizeUrl(url, options = {}) {
		if (!url || typeof url !== "string") return "";
		const trimmed = url.trim();
		const lower = trimmed.toLowerCase();
		if (options.allowDataImage && isSafeDataImageUrl(trimmed)) return trimmed;
		if ([
			"javascript:",
			"vbscript:",
			"data:",
			"file:"
		].some((protocol) => lower.startsWith(protocol))) return "";
		if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
		if (lower.startsWith("//")) return trimmed;
		if (/^[a-z][a-z0-9+.-]*:/i.test(lower)) {
			if ((options.mode ?? "relaxed") === "strict") return "";
			if ([
				"mailto:",
				"tel:",
				"blob:",
				"ftp:"
			].some((protocol) => lower.startsWith(protocol))) return trimmed;
			return "";
		}
		return trimmed;
	}
	function getGmXhr() {
		if (typeof GM_xmlhttpRequest === "function") return GM_xmlhttpRequest;
		return null;
	}
	function normalizeUrlForFetch$1(url) {
		const normalized = normalizeRedundantFirstPageParam(normalizeCiwemaoChapterUrl(url));
		try {
			const u = new URL(normalized);
			u.hash = "";
			return u.toString();
		} catch {
			return normalized.replace(/#.*$/, "");
		}
	}
	function getDefaultBaseUrl() {
		if (typeof location !== "undefined" && typeof location.href === "string") return location.href;
		if (typeof document !== "undefined" && typeof document.baseURI === "string") return document.baseURI;
	}
	function normalizeHostname(hostname) {
		const trimmed = hostname.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed.slice(1, -1).toLowerCase();
		return trimmed.toLowerCase().replace(/\.$/, "");
	}
	function isPrivateNetworkHost(hostname) {
		const host = normalizeHostname(hostname);
		if (!host) return true;
		if (host === "localhost" || host.endsWith(".localhost")) return true;
		if (host === "0.0.0.0") return true;
		const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (ipv4) {
			const parts = ipv4.slice(1).map((n) => parseInt(n, 10));
			if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
			const [a, b] = parts;
			if (a === 0) return true;
			if (a === 10) return true;
			if (a === 100 && b >= 64 && b <= 127) return true;
			if (a === 127) return true;
			if (a === 169 && b === 254) return true;
			if (a === 172 && b >= 16 && b <= 31) return true;
			if (a === 192 && b === 168) return true;
			return false;
		}
		if (!host.includes(":")) return false;
		if (host === "::" || host === "::1") return true;
		const mapped = host.match(/^::ffff:(?:([0-9a-f]{1,4}):([0-9a-f]{1,4})|(\d{1,3}(?:\.\d{1,3}){3}))$/);
		if (mapped) {
			if (mapped[3]) return isPrivateNetworkHost(mapped[3]);
			const high = parseInt(mapped[1], 16);
			const low = parseInt(mapped[2], 16);
			return isPrivateNetworkHost(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
		}
		const firstHextet = parseInt(host.slice(0, host.indexOf(":")) || "0", 16);
		if ((firstHextet & 65472) === 65152) return true;
		if ((firstHextet & 65024) === 64512) return true;
		return false;
	}
	function parseHttpUrl$1(url) {
		try {
			const u = new URL(url);
			if (u.protocol !== "http:" && u.protocol !== "https:") return null;
			return u;
		} catch {
			return null;
		}
	}
	function isCurrentOriginRequest(url) {
		try {
			if (typeof location === "undefined" || !location.origin) return false;
			return new URL(url).origin === location.origin;
		} catch {
			return false;
		}
	}
	function getPageNativeFetch() {
		if (typeof window === "undefined" || typeof window.fetch !== "function") return null;
		return window.fetch.bind(window);
	}
	function normalizeCharset(charset) {
		const normalized = (charset || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
		if (!normalized) return null;
		if (normalized === "utf8") return "utf-8";
		if (normalized === "gbk" || normalized === "gb2312" || normalized === "gb18030") return "gb18030";
		return normalized;
	}
	function extractCharsetFromMime(value) {
		if (!value) return null;
		return normalizeCharset(value.match(/charset\s*=\s*["']?([^;"'\s>]+)/i)?.[1]);
	}
	function extractCharsetFromHtmlBytes(buffer) {
		const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
		let ascii = "";
		for (const byte of bytes) ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : " ";
		const charsetMeta = ascii.match(/<meta[^>]+charset\s*=\s*["']?([^"' />]+)/i);
		if (charsetMeta?.[1]) return normalizeCharset(charsetMeta[1]);
		return extractCharsetFromMime(ascii.match(/<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["']([^"']+)["']/i)?.[1]);
	}
	function getCurrentDocumentCharset() {
		if (typeof document === "undefined") return null;
		return normalizeCharset(document.characterSet || document.charset);
	}
	function decodeHtmlBytes(buffer, contentType, fallbackCharset) {
		const charset = extractCharsetFromMime(contentType) || extractCharsetFromHtmlBytes(buffer) || normalizeCharset(fallbackCharset) || getCurrentDocumentCharset() || "utf-8";
		try {
			return new TextDecoder(charset).decode(buffer);
		} catch {
			return new TextDecoder("utf-8").decode(buffer);
		}
	}
	function extractContentTypeFromResponseHeaders(headers) {
		for (const line of headers.split(/\r?\n/)) {
			const separator = line.indexOf(":");
			if (separator === -1) continue;
			if (line.slice(0, separator).trim().toLowerCase() === "content-type") return line.slice(separator + 1).trim() || null;
		}
		return null;
	}
	async function readFetchResponseText(response) {
		if (typeof response.arrayBuffer !== "function" || typeof TextDecoder === "undefined") return response.text();
		const contentType = typeof response.headers?.get === "function" ? response.headers.get("content-type") : null;
		return decodeHtmlBytes(await response.arrayBuffer(), contentType);
	}
	function resolveAndValidateHttpUrl(url, base) {
		const normalized = normalizeUrlForFetch$1(url);
		let resolved;
		try {
			resolved = base ? new URL(normalized, base).toString() : new URL(normalized).toString();
		} catch {
			try {
				const fallbackBase = getDefaultBaseUrl();
				if (!fallbackBase) return null;
				resolved = new URL(normalized, fallbackBase).toString();
			} catch {
				return null;
			}
		}
		try {
			const u = new URL(resolved);
			if (u.protocol !== "http:" && u.protocol !== "https:") return null;
			if (isPrivateNetworkHost(u.hostname)) {
				const baseUrl = parseHttpUrl$1(base || "") || parseHttpUrl$1(getDefaultBaseUrl() || "");
				if (!baseUrl || normalizeHostname(baseUrl.hostname) !== normalizeHostname(u.hostname)) return null;
			}
			u.hash = "";
			return u.toString();
		} catch {
			return null;
		}
	}
	function fetchAndParseUrl(url, referer, options = {}) {
		const gmXhr = getGmXhr();
		const requestUrl = resolveAndValidateHttpUrl(url, referer);
		const timeoutMs = options.timeoutMs ?? 15e3;
		const maxRetries = Math.max(0, options.retries ?? 1);
		if (!requestUrl) {
			console.error("[MNR] Invalid or unsupported URL:", url);
			return {
				promise: Promise.resolve({
					doc: null,
					status: null,
					finalUrl: null,
					error: "invalid-url"
				}),
				abort: () => {}
			};
		}
		const parseHtmlToDoc = (html, finalUrl) => {
			try {
				const doc = new DOMParser().parseFromString(html, "text/html");
				const base = doc.createElement("base");
				base.href = finalUrl || requestUrl;
				if (doc.head) doc.head.insertBefore(base, doc.head.firstChild);
				else doc.documentElement?.insertBefore(base, doc.documentElement.firstChild);
				doc._mnrUrl = finalUrl || requestUrl;
				return {
					doc,
					status: 200,
					finalUrl,
					error: null
				};
			} catch (e) {
				console.error("[MNR] Parse error:", e);
				return {
					doc: null,
					status: null,
					finalUrl,
					error: "parse"
				};
			}
		};
		let request = null;
		let aborted = false;
		let fetchAbortController = null;
		let timeoutTimer = null;
		let timedOut = false;
		const doRequest = () => {
			const headers = { Accept: "text/html,application/xhtml+xml,application/xml" };
			const normalizedReferer = referer ? resolveAndValidateHttpUrl(referer) : void 0;
			const pageFetch = isCurrentOriginRequest(requestUrl) ? getPageNativeFetch() : null;
			if (gmXhr && !pageFetch) {
				headers["Accept-Language"] = "zh-CN,zh;q=0.9";
				if (normalizedReferer) headers["Referer"] = normalizedReferer;
				return new Promise((resolve) => {
					request = gmXhr({
						method: "GET",
						url: requestUrl,
						headers,
						timeout: timeoutMs,
						responseType: "arraybuffer",
						onload: (response) => {
							const finalUrl = response.finalUrl ? resolveAndValidateHttpUrl(response.finalUrl, requestUrl) : null;
							if (response.status >= 200 && response.status < 300) {
								const responseBytes = response.response;
								let html;
								try {
									html = responseBytes && typeof responseBytes.byteLength === "number" ? decodeHtmlBytes(responseBytes, extractContentTypeFromResponseHeaders(response.responseHeaders)) : response.responseText;
								} catch (e) {
									console.error("[MNR] Decode error:", e);
									resolve({
										doc: null,
										status: response.status,
										finalUrl,
										error: "parse"
									});
									return;
								}
								resolve({
									...parseHtmlToDoc(html, finalUrl),
									status: response.status,
									finalUrl
								});
								return;
							}
							console.error("[MNR] HTTP error:", response.status);
							resolve({
								doc: null,
								status: response.status,
								finalUrl,
								error: "http"
							});
						},
						onerror: () => {
							resolve({
								doc: null,
								status: null,
								finalUrl: null,
								error: "network"
							});
						},
						onabort: () => {
							resolve({
								doc: null,
								status: null,
								finalUrl: null,
								error: "abort"
							});
						},
						ontimeout: () => {
							console.error("[MNR] Request timeout");
							resolve({
								doc: null,
								status: null,
								finalUrl: null,
								error: "timeout"
							});
						}
					});
				});
			}
			const fetchRequest = pageFetch ?? (typeof fetch === "function" ? fetch : null);
			if (!fetchRequest) {
				console.error("[MNR] GM_xmlhttpRequest not available and fetch is missing");
				return Promise.resolve({
					doc: null,
					status: null,
					finalUrl: null,
					error: "missing-gm-xhr"
				});
			}
			fetchAbortController = new AbortController();
			timedOut = false;
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
				timeoutTimer = null;
			}
			timeoutTimer = setTimeout(() => {
				timedOut = true;
				fetchAbortController?.abort();
			}, timeoutMs);
			const fetchInit = {
				method: "GET",
				headers,
				signal: fetchAbortController.signal,
				credentials: "include",
				redirect: "follow"
			};
			if (normalizedReferer) try {
				fetchInit.referrer = normalizedReferer;
			} catch {}
			return fetchRequest(requestUrl, fetchInit).then(async (response) => {
				const finalUrl = response.url ? resolveAndValidateHttpUrl(response.url, requestUrl) : null;
				const status = response.status;
				if (status >= 200 && status < 300) {
					const html = await readFetchResponseText(response);
					return {
						...parseHtmlToDoc(html, finalUrl),
						status,
						finalUrl
					};
				}
				console.error("[MNR] HTTP error:", status);
				return {
					doc: null,
					status,
					finalUrl,
					error: "http"
				};
			}).catch((err) => {
				if (aborted) return {
					doc: null,
					status: null,
					finalUrl: null,
					error: "abort"
				};
				if (timedOut) {
					console.error("[MNR] Request timeout");
					return {
						doc: null,
						status: null,
						finalUrl: null,
						error: "timeout"
					};
				}
				console.error("[MNR] Network error:", err);
				return {
					doc: null,
					status: null,
					finalUrl: null,
					error: "network"
				};
			}).finally(() => {
				if (timeoutTimer) {
					clearTimeout(timeoutTimer);
					timeoutTimer = null;
				}
			});
		};
		const shouldRetry = (res) => {
			if (aborted) return false;
			if (res.error === "timeout" || res.error === "network") return true;
			if (res.error === "http" && res.status && (res.status >= 500 || res.status === 429)) return true;
			return false;
		};
		const promise = (async () => {
			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				if (aborted) return {
					doc: null,
					status: null,
					finalUrl: null,
					error: "abort"
				};
				const res = await doRequest();
				if (!shouldRetry(res) || attempt === maxRetries) return res;
				const delay = Math.min(400 * Math.pow(2, attempt), 2e3);
				await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
			}
			return {
				doc: null,
				status: null,
				finalUrl: null,
				error: "network"
			};
		})();
		const abort = () => {
			aborted = true;
			try {
				request?.abort();
			} catch {}
			try {
				fetchAbortController?.abort();
			} catch {}
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
				timeoutTimer = null;
			}
		};
		return {
			promise,
			abort
		};
	}
	var ciweimao_exports = __exportAll({
		ciweimaoRule: () => ciweimaoRule,
		ciweimaoWapRule: () => ciweimaoWapRule
	});
	function asRecord(value) {
		return value && typeof value === "object" ? value : null;
	}
	function isSuccessCode(value) {
		return value === 1e5 || value === "100000";
	}
	function getUnsafeWindow() {
		return typeof unsafeWindow !== "undefined" ? unsafeWindow : null;
	}
	function getCrypto() {
		return (typeof window !== "undefined" ? window : null)?.CryptoJS || getUnsafeWindow()?.CryptoJS || null;
	}
	function normalizeCiweimaoUrl(value, baseUrl) {
		if (!value) return "";
		try {
			return new URL(value, baseUrl).href;
		} catch {
			return value;
		}
	}
	function getCiweimaoChapterId(url) {
		return (url.match(/\/chapter\/(\d+)/) || [])[1] || "";
	}
	function getCiweimaoBookIdFromIndex(url) {
		if (!url) return "";
		return (url.match(/\/chapter-list\/(\d+)/) || [])[1] || "";
	}
	function fixCiweimaoNavHref(doc, selector, pageUrl) {
		const el = doc.querySelector(selector);
		if (!el) return;
		let href = el.getAttribute("data-href") || el.getAttribute("data-url") || el.getAttribute("data-next") || el.getAttribute("data-prev") || el.getAttribute("data-link") || "";
		if (!href) href = el.getAttribute("href") || "";
		if (!href || href.startsWith("javascript")) {
			const match = (el.outerHTML || "").match(/https?:\/\/(?:www|wap)\.ciweimao\.com\/chapter\/\d+/);
			if (match) href = match[0];
		}
		if (href && !href.startsWith("javascript")) el.setAttribute("href", normalizeCiweimaoUrl(href, pageUrl));
		else el.removeAttribute("href");
	}
	async function fetchCiweimaoJson(target, pageUrl, helpers) {
		try {
			const unsafeWin = getUnsafeWindow();
			const currentWin = typeof window !== "undefined" ? window : null;
			const fetcher = unsafeWin?.fetch || currentWin?.fetch || (typeof fetch === "function" ? fetch : null);
			if (fetcher) {
				const fetchThis = unsafeWin?.fetch ? unsafeWin : currentWin?.fetch ? currentWin : void 0;
				const response = await fetcher.call(fetchThis, target, {
					credentials: "include",
					referrer: pageUrl
				});
				if (response?.ok) return asRecord(await response.json());
			}
		} catch {}
		if (!helpers?.fetchJson) return null;
		return helpers.fetchJson(target, {
			headers: { Referer: pageUrl },
			withCredentials: true
		});
	}
	async function fetchCiweimaoText(target, referrer) {
		try {
			const unsafeWin = getUnsafeWindow();
			const currentWin = typeof window !== "undefined" ? window : null;
			const fetcher = unsafeWin?.fetch || currentWin?.fetch || (typeof fetch === "function" ? fetch : null);
			if (!fetcher) return null;
			const fetchThis = unsafeWin?.fetch ? unsafeWin : currentWin?.fetch ? currentWin : void 0;
			const response = await fetcher.call(fetchThis, target, {
				credentials: "include",
				referrer
			});
			if (!response?.ok) return null;
			return response.text();
		} catch {
			return null;
		}
	}
	function decryptCiweimaoContent(chapterContent, encryptedKeys, accessKey, crypto) {
		const chars = accessKey.split("");
		const total = encryptedKeys.length;
		if (!total || !chars.length) return "";
		const keyChain = [encryptedKeys[chars[chars.length - 1].charCodeAt(0) % total], encryptedKeys[chars[0].charCodeAt(0) % total]];
		const decode = (str) => atob(str);
		const encode = (str) => btoa(str);
		let current = chapterContent;
		for (let i = 0; i < keyChain.length; i++) {
			const decoded = decode(typeof current === "string" ? current : current.toString());
			const key = keyChain[i];
			const iv = encode(decoded.substring(0, 16));
			const encrypted = encode(decoded.substring(16));
			const parsed = crypto.format.OpenSSL.parse(encrypted);
			const decrypted = crypto.AES.decrypt(parsed, crypto.enc.Base64.parse(key), {
				iv: crypto.enc.Base64.parse(iv),
				format: crypto.format.OpenSSL
			});
			current = i < keyChain.length - 1 ? decode(decrypted.toString(crypto.enc.Base64)) : decrypted;
		}
		return typeof current === "string" ? current : current.toString(crypto.enc.Utf8);
	}
	async function fetchCiweimaoContent(chapterId, pageUrl, helpers) {
		const origin = new URL(pageUrl).origin;
		const session = await fetchCiweimaoJson(`${origin}/chapter/ajax_get_session_code?chapter_id=${chapterId}`, pageUrl, helpers);
		if (!session || !isSuccessCode(session.code)) return "";
		const accessKeyValue = session.chapter_access_key;
		if (accessKeyValue === void 0 || accessKeyValue === null) return "";
		const accessKey = String(accessKeyValue);
		const data = await fetchCiweimaoJson(`${origin}/chapter/get_book_chapter_detail_info?chapter_id=${chapterId}&chapter_access_key=${accessKey}`, pageUrl, helpers);
		if (!data || !isSuccessCode(data.code)) return "";
		const chapterContent = data.chapter_content;
		const encryptedKeys = Array.isArray(data.encryt_keys) ? data.encryt_keys.filter((key) => typeof key === "string") : [];
		const crypto = getCrypto();
		if (typeof chapterContent !== "string" || encryptedKeys.length === 0 || !crypto) return "";
		return decryptCiweimaoContent(chapterContent, encryptedKeys, accessKey, crypto);
	}
	async function decryptCiweimaoIfNeeded(doc, contentEl, pageUrl, helpers) {
		const hasWatermark = !!contentEl.querySelector("#J_BookRead_WaterMark, .watermark");
		const text = (contentEl.textContent || "").replace(/\s+/g, "").trim();
		const chapterParas = contentEl.querySelectorAll("p.chapter").length;
		if (!(hasWatermark || text.length < 200 || chapterParas < 3)) return;
		const chapterId = doc.querySelector("#J_BookCnt")?.getAttribute("data-id") || (pageUrl.match(/chapter\/(\d+)/) || [])[1];
		if (!chapterId) return;
		const html = await fetchCiweimaoContent(chapterId, pageUrl, helpers);
		if (html) contentEl.innerHTML = html;
	}
	function normalizeWatermarkText(value) {
		return value.replace(/\s+/g, "").replace(/[\u200b-\u200d\ufeff]/g, "").trim();
	}
	function isLikelyWatermarkToken(token) {
		if (!/^[A-Za-z0-9]{4,12}$/.test(token)) return false;
		const hasDigit = /\d/.test(token);
		const hasLower = /[a-z]/.test(token);
		const hasUpper = /[A-Z]/.test(token);
		return hasDigit && (hasLower || hasUpper) || hasLower && hasUpper;
	}
	function isCjk(ch) {
		return /[\u4e00-\u9fff]/.test(ch);
	}
	function isCjkPunct(ch) {
		return /[，。！？、“”‘’（）()【】[\]<>《》:：;；·~…—-]/.test(ch);
	}
	function getPrevNonSpace(text, index) {
		for (let i = index - 1; i >= 0; i--) {
			const ch = text[i];
			if (!/\s/.test(ch)) return ch;
		}
		return "";
	}
	function getNextNonSpace(text, index) {
		for (let i = index; i < text.length; i++) {
			const ch = text[i];
			if (!/\s/.test(ch)) return ch;
		}
		return "";
	}
	function shouldStripWatermarkToken(token, before, after) {
		if (!isLikelyWatermarkToken(token)) return false;
		const beforeCjk = before && (isCjk(before) || isCjkPunct(before));
		const afterCjk = after && (isCjk(after) || isCjkPunct(after));
		if (!beforeCjk && !afterCjk) return false;
		const beforeAscii = before && /[A-Za-z0-9]/.test(before);
		const afterAscii = after && /[A-Za-z0-9]/.test(after);
		if (beforeAscii && afterAscii) return false;
		return true;
	}
	function stripWatermarkText(value) {
		if (!value || !/[\u4e00-\u9fff]/.test(value)) return value;
		let result = "";
		let i = 0;
		while (i < value.length) {
			const ch = value[i];
			if (/[A-Za-z0-9]/.test(ch)) {
				let j = i + 1;
				while (j < value.length && /[A-Za-z0-9]/.test(value[j])) j++;
				const token = value.slice(i, j);
				if (token.length >= 4 && token.length <= 12) {
					if (shouldStripWatermarkToken(token, getPrevNonSpace(value, i), getNextNonSpace(value, j))) {
						i = j;
						continue;
					}
				}
				result += token;
				i = j;
				continue;
			}
			result += ch;
			i += 1;
		}
		return result;
	}
	function cleanupCiweimaoWatermarks(doc, contentEl) {
		contentEl.querySelectorAll("span, i, em, b, strong, font").forEach((node) => {
			if (isLikelyWatermarkToken(normalizeWatermarkText(node.textContent || ""))) node.remove();
		});
		const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
		const walker = doc.createTreeWalker(contentEl, showText);
		const textNodes = [];
		while (walker.nextNode()) textNodes.push(walker.currentNode);
		textNodes.forEach((node) => {
			const parent = node.parentElement;
			if (!parent) return;
			const tag = parent.tagName;
			if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
			const text = node.nodeValue || "";
			const cleaned = stripWatermarkText(text);
			if (cleaned !== text) node.nodeValue = cleaned;
		});
		contentEl.querySelectorAll("p.chapter span").forEach((span) => span.remove());
		contentEl.querySelectorAll("p.chapter").forEach((p) => {
			const hasImg = p.querySelector("img");
			const text = (p.textContent || "").replace(/\s+/g, "").trim();
			if (hasImg && text.length <= 6) p.remove();
		});
	}
	var tocCache = new Map();
	function parseCiweimaoToc(html, tocUrl, fallbackBookTitle = "") {
		const doc = new DOMParser().parseFromString(html, "text/html");
		const seen = new Set();
		const entries = [];
		doc.querySelectorAll("a[href*=\"/chapter/\"]").forEach((anchor) => {
			const url = normalizeCiweimaoUrl(anchor.getAttribute("href") || "", tocUrl);
			if (!/\/chapter\/\d+/.test(url) || seen.has(url)) return;
			const title = (anchor.textContent || "").replace(/\s+/g, " ").trim();
			if (!title) return;
			seen.add(url);
			entries.push({
				title,
				url
			});
		});
		const titleText = (doc.querySelector("title")?.textContent || "").trim();
		return {
			bookTitle: fallbackBookTitle || titleText.replace(/最新章节.*$/u, "").replace(/无弹窗全文阅读.*$/u, "").trim(),
			entries
		};
	}
	async function getCiweimaoToc(indexUrl, referrer, fallbackBookTitle = "") {
		const cacheKey = getCiweimaoBookIdFromIndex(indexUrl) || indexUrl;
		if (!cacheKey) return null;
		let cached = tocCache.get(cacheKey);
		if (!cached) {
			cached = (async () => {
				const html = await fetchCiweimaoText(indexUrl, referrer);
				if (!html || /man-machine-verify|验证码|人机验证/i.test(html)) return null;
				return parseCiweimaoToc(html, indexUrl, fallbackBookTitle);
			})();
			cached.then((toc) => {
				if (!toc) tocCache.delete(cacheKey);
			});
			tocCache.set(cacheKey, cached);
		}
		return cached;
	}
	function createCiweimaoApiDocument(options) {
		const doc = document.implementation.createHTMLDocument(options.title);
		const safeSetText = (el, text) => {
			el.textContent = text;
			return el;
		};
		const breadcrumb = doc.createElement("div");
		breadcrumb.className = "breadcrumb";
		const bookLink = doc.createElement("a");
		bookLink.href = options.indexUrl || options.url;
		safeSetText(bookLink, options.bookTitle);
		breadcrumb.append(bookLink);
		const box = doc.createElement("div");
		box.className = "book-read-box";
		const cnt = doc.createElement("div");
		cnt.id = "J_BookCnt";
		cnt.setAttribute("data-id", getCiweimaoChapterId(options.url));
		const header = doc.createElement("div");
		header.className = "read-hd";
		const h1 = doc.createElement("h1");
		h1.className = "chapter";
		safeSetText(h1, options.title);
		header.append(h1);
		const content = doc.createElement("div");
		content.className = "read-bd";
		content.id = "J_BookRead";
		content.innerHTML = options.contentHtml;
		const nav = doc.createElement("div");
		nav.className = "book-read-page";
		if (options.prevUrl) {
			const prev = doc.createElement("a");
			prev.id = "J_BtnPagePrev";
			prev.href = options.prevUrl;
			safeSetText(prev, "上一章");
			nav.append(prev);
		}
		if (options.indexUrl) {
			const index = doc.createElement("a");
			index.href = options.indexUrl;
			safeSetText(index, "目录");
			nav.append(index);
		}
		if (options.nextUrl) {
			const next = doc.createElement("a");
			next.id = "J_BtnPageNext";
			next.href = options.nextUrl;
			safeSetText(next, "下一章");
			nav.append(next);
		}
		cnt.append(header, content);
		box.append(cnt, nav);
		doc.body.append(breadcrumb, box);
		return doc;
	}
	async function fetchCiweimaoApiDocument(targetUrl, refChapter) {
		try {
			const chapterId = getCiweimaoChapterId(targetUrl);
			if (!chapterId || !/\/\/(?:www|wap)\.ciweimao\.com\/chapter\//.test(targetUrl)) return null;
			const indexUrl = refChapter.indexUrl || "";
			const toc = indexUrl ? await getCiweimaoToc(indexUrl, refChapter.url, refChapter.bookTitle || "") : null;
			const normalizedTargetUrl = normalizeCiweimaoUrl(targetUrl, refChapter.url);
			const tocIndex = toc?.entries.findIndex((entry) => normalizeCiweimaoUrl(entry.url, refChapter.url) === normalizedTargetUrl) ?? -1;
			if (!toc || tocIndex < 0) return null;
			const entry = toc.entries[tocIndex];
			const prevUrl = toc.entries[tocIndex - 1]?.url || "";
			const nextUrl = toc.entries[tocIndex + 1]?.url || "";
			const html = await fetchCiweimaoContent(chapterId, normalizedTargetUrl);
			if (!html) return null;
			const doc = createCiweimaoApiDocument({
				bookTitle: toc.bookTitle || refChapter.bookTitle || "",
				contentHtml: html,
				indexUrl,
				nextUrl,
				prevUrl,
				title: entry.title,
				url: normalizedTargetUrl
			});
			const contentEl = doc.querySelector("#J_BookRead");
			if (contentEl) cleanupCiweimaoWatermarks(doc, contentEl);
			return doc;
		} catch (e) {
			console.warn("[YingChuang] Ciweimao API document error:", e);
			return null;
		}
	}
	var ciweimaoBeforeParse = async (doc, url, helpers) => {
		try {
			const contentEl = doc.querySelector("#J_BookRead");
			if (!contentEl) return;
			const fallbackUrl = typeof window !== "undefined" && typeof window.location?.href === "string" ? window.location.href : "";
			const pageUrl = url || doc.location?.href || fallbackUrl;
			if (!pageUrl) return;
			fixCiweimaoNavHref(doc, "#J_BtnPagePrev", pageUrl);
			fixCiweimaoNavHref(doc, ".J_BtnPagePrev", pageUrl);
			fixCiweimaoNavHref(doc, "#J_BtnPageNext", pageUrl);
			fixCiweimaoNavHref(doc, ".J_BtnPageNext", pageUrl);
			await decryptCiweimaoIfNeeded(doc, contentEl, pageUrl, helpers);
			cleanupCiweimaoWatermarks(doc, contentEl);
		} catch (e) {
			console.warn("[YingChuang] Ciweimao beforeParse error:", e);
		}
	};
	var ciweimaoContent = {
		selector: "#J_BookRead",
		remove: "i.J_Num, .chapter span, #J_BookRead_WaterMark, .watermark"
	};
	var ciweimaoHooks = {
		isVipChapter: (doc, url) => {
			if (!/^https?:\/\/(?:www|wap)\.ciweimao\.com\/chapter\/\d+/i.test(url)) return null;
			return doc.querySelector("#J_BookCnt, #J_BookRead") ? false : null;
		},
		beforeParse: ciweimaoBeforeParse,
		fetchDocument: (url, context) => fetchCiweimaoApiDocument(url, {
			bookTitle: context.bookTitle,
			indexUrl: context.indexUrl,
			url: context.refererUrl
		})
	};
	var ciweimaoRule = {
		id: "ciweimao",
		name: "刺猬猫",
		version: 2,
		match: { pattern: "^https?://www\\.ciweimao\\.com/chapter/\\d+" },
		content: { ...ciweimaoContent },
		navigation: {
			prev: "#J_BtnPagePrev[href^=\"http\"]",
			index: ".book-read-page a[href*=\"/chapter-list/\"]",
			next: "#J_BtnPageNext[href^=\"http\"]"
		},
		title: {
			selector: ".read-hd .chapter",
			bookSelector: ".breadcrumb > a:last()"
		},
		hooks: { ...ciweimaoHooks },
		advanced: {
			mutationSelector: "#J_BookRead",
			mutationChildCount: 2,
			timeout: 3e3
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.ciweimao.com/chapter/113909523"
		}
	};
	var ciweimaoWapRule = {
		id: "ciweimao-wap",
		name: "刺猬猫(移动端)",
		version: 2,
		match: { pattern: "^https?://wap\\.ciweimao\\.com/chapter/\\d+/?(?:[?#].*)?$" },
		content: { ...ciweimaoContent },
		navigation: {
			prev: ".J_BtnPagePrev[href^=\"http\"]",
			index: ".book-read-page .btn-list[href*=\"/chapter/\"]",
			next: ".J_BtnPageNext[href^=\"http\"]"
		},
		title: { selector: "h1.read-hd" },
		hooks: { ...ciweimaoHooks },
		advanced: {
			mutationSelector: "#J_BookRead",
			mutationChildCount: 2,
			timeout: 3e3
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://wap.ciweimao.com/chapter/113489050"
		}
	};
	function getScriptText(doc) {
		return Array.from(doc.scripts).map((script) => script.textContent || "").join("\n");
	}
	function appendHiddenLink(doc, id, href, text, base) {
		if (!href || href === "#" || /^javascript:/i.test(href) || doc.getElementById(id)) return;
		try {
			const link = doc.createElement("a");
			link.id = id;
			link.href = new URL(href, base).toString();
			link.textContent = text;
			link.style.display = "none";
			doc.body?.appendChild(link);
		} catch {}
	}
	function extractChapterNav(scriptText) {
		const match = scriptText.match(/if\s*\(\s*direction\s*===\s*['"]prev['"]\s*\)\s*\{[\s\S]*?chapterUrl\s*=\s*['"]([^'"]+)['"][\s\S]*?\}\s*else\s*\{[\s\S]*?chapterUrl\s*=\s*['"]([^'"]+)['"]/);
		return {
			prev: match?.[1] || null,
			next: match?.[2] || null
		};
	}
	var deqixs_exports = __exportAll({
		deqixsCoRule: () => deqixsCoRule,
		deqixsRule: () => deqixsRule
	});
	function extractJsValue(source, name) {
		const pattern = new RegExp(`(?:var|let|const)\\s+${name}\\s*=\\s*(?:['"]([^'"]+)['"]|([^;\\s]+))\\s*;`);
		const match = source.match(pattern);
		return match?.[1] || match?.[2] || null;
	}
	var deqixsCoBeforeParse = async (doc, url, helpers) => {
		try {
			const pageUrl = url || doc.location?.href || location.href;
			const pathMatch = new URL(pageUrl).pathname.match(/^\/books\/(\d+)\/(\d+)\.html$/);
			if (!pathMatch) return;
			const [, articleId, chapterId] = pathMatch;
			const nav = extractChapterNav(getScriptText(doc));
			appendHiddenLink(doc, "mnr-deqixs-co-prev", nav.prev, "上一章", pageUrl);
			appendHiddenLink(doc, "mnr-deqixs-co-next", nav.next, "下一章", pageUrl);
			const tokenScriptSrc = doc.querySelector("script[src*=\"/scripts/chapter.js.php\"]")?.getAttribute("src");
			if (!tokenScriptSrc || !helpers) return;
			const tokenScriptUrl = new URL(tokenScriptSrc, pageUrl).toString();
			const tokenScript = await helpers.fetchText(tokenScriptUrl, {
				timeoutMs: 15e3,
				referrer: pageUrl,
				withCredentials: true
			});
			if (!tokenScript) return;
			const token = extractJsValue(tokenScript, "chapterToken");
			const timestamp = extractJsValue(tokenScript, "timestamp");
			const nonce = extractJsValue(tokenScript, "nonce");
			if (!token || !timestamp || !nonce) return;
			const params = new URLSearchParams({
				aid: articleId,
				cid: chapterId,
				token,
				timestamp,
				nonce
			});
			const ajaxUrl = new URL(`/modules/article/ajax2.php?${params.toString()}`, pageUrl).toString();
			const responseText = await helpers.fetchText(ajaxUrl, {
				timeoutMs: 2e4,
				referrer: pageUrl,
				withCredentials: true,
				headers: {
					Accept: "application/json, text/javascript, */*; q=0.01",
					"X-Requested-With": "XMLHttpRequest"
				}
			});
			if (!responseText) return;
			const payload = JSON.parse(responseText);
			const content = payload.data?.content;
			if (payload.status !== 1 || typeof content !== "string" || !content.trim()) return;
			const contentEl = doc.querySelector("#chapter-content");
			if (contentEl) {
				contentEl.innerHTML = content;
				contentEl.setAttribute("data-mnr-deqixs-full", "1");
			}
		} catch (e) {
			console.warn("[YingChuang] Deqixs.co beforeParse error:", e);
		}
	};
	var deqixsRule = {
		id: "deqixs",
		name: "得奇小说网",
		version: 1,
		match: { pattern: "^https?://www\\.deqixs\\.org/\\d+/\\d+(?:_\\d+)?\\.html(?:[?#].*)?$" },
		content: {
			selector: ".con",
			remove: "script, style, iframe, ins"
		},
		navigation: {
			prev: ".prenext span:first-child a[href$=\".html\"]",
			index: ".prenext > a",
			next: ".prenext span:last-child a[href$=\".html\"]"
		},
		title: {
			selector: ".submenu h1",
			replace: "^.*?>\\s*",
			bookSelector: ".submenu h1 > a[href$=\"/\"]"
		},
		toc: { excludeAncestors: ".new, .item, h1, h2" },
		advanced: {
			checkSection: true,
			sectionDelayMs: 800
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.deqixs.org/24/18442_6.html"
		}
	};
	var deqixsCoRule = {
		id: "deqixs-co",
		name: "得奇小说网(.co)",
		version: 2,
		match: { pattern: "^https?://www\\.deqixs\\.co/books/\\d+/\\d+\\.html(?:[?#].*)?$" },
		content: {
			selector: "#chapter-content",
			remove: "script, style, iframe, ins, .loading, .error",
			replace: [{
				pattern: "当&前@章#节\\$内%容\\^不&完\\*整！要~查!看-完_整\\|章;节\\)请\\(退&出%阅#读\\|模\\*式！",
				replacement: "",
				flags: "g"
			}, {
				pattern: "本章节未完.+?请订阅",
				replacement: "",
				flags: "g"
			}]
		},
		navigation: {
			prev: "#mnr-deqixs-co-prev",
			index: ".breadcrumb a[href*=\"/books/\"][href$=\"/\"]",
			next: "#mnr-deqixs-co-next"
		},
		title: {
			selector: "h1.pt10",
			replace: "\\(第[^)]*页\\)\\s*$",
			bookSelector: ".breadcrumb a[href*=\"/books/\"][href$=\"/\"]"
		},
		hooks: { beforeParse: deqixsCoBeforeParse },
		meta: {
			source: "builtin",
			exampleUrl: "https://www.deqixs.co/books/325/266271.html"
		}
	};
	var dingdianzww_exports = __exportAll({ dingdianzwwRule: () => dingdianzwwRule });
	function extractChapterIds(pageUrl, scriptText) {
		const pathMatch = new URL(pageUrl).pathname.match(/^\/(\d+)\/(\d+)(?:_\d+)?\.html$/);
		const articleId = pathMatch?.[1] || scriptText.match(/const\s+articleId\s*=\s*(\d+)/)?.[1];
		const chapterId = pathMatch?.[2] || scriptText.match(/const\s+chapterId\s*=\s*(\d+)/)?.[1];
		if (!articleId || !chapterId) return null;
		return {
			articleId,
			chapterId
		};
	}
	function fixPageIndexLink(doc, base) {
		const index = doc.querySelector(".page1 .page-index[data-href]");
		const dataHref = index?.getAttribute("data-href");
		if (!index || !dataHref) return;
		try {
			index.href = new URL(dataHref, base).toString();
		} catch {}
	}
	var dingdianzwwBeforeParse = async (doc, url, helpers) => {
		try {
			const pageUrl = url || doc.location?.href || location.href;
			const scriptText = getScriptText(doc);
			const nav = extractChapterNav(scriptText);
			appendHiddenLink(doc, "mnr-dingdianzww-prev", nav.prev, "上一章", pageUrl);
			appendHiddenLink(doc, "mnr-dingdianzww-next", nav.next, "下一章", pageUrl);
			fixPageIndexLink(doc, pageUrl);
			appendHiddenLink(doc, "mnr-dingdianzww-index", doc.querySelector(".page1 .page-index")?.href || doc.querySelector(".bread a[href$=\"/\"]:not([href=\"/\"])")?.href || null, "目录", pageUrl);
			const contentEl = doc.querySelector("#chapter-content");
			if (!contentEl || !helpers?.fetchText) return;
			const ids = extractChapterIds(pageUrl, scriptText);
			if (!ids) return;
			const ajaxUrl = new URL("/modules/article/ajax_chapter.php", pageUrl);
			ajaxUrl.searchParams.set("aid", ids.articleId);
			ajaxUrl.searchParams.set("cid", ids.chapterId);
			const responseText = await helpers.fetchText(ajaxUrl.toString(), {
				timeoutMs: 2e4,
				withCredentials: true,
				headers: {
					Accept: "application/json, text/javascript, */*; q=0.01",
					"X-Requested-With": "XMLHttpRequest"
				}
			});
			if (!responseText) return;
			const payload = JSON.parse(responseText);
			const content = payload.data?.content;
			if (payload.status !== 1 || typeof content !== "string" || !content.trim()) return;
			contentEl.innerHTML = content;
			contentEl.setAttribute("data-mnr-dingdianzww-full", "1");
		} catch (e) {
			console.warn("[YingChuang] Dingdianzww beforeParse error:", e);
		}
	};
	var dingdianzwwRule = {
		id: "dingdianzww",
		name: "顶点小说",
		version: 2,
		match: { pattern: "^https?://dingdianzww\\.org/\\d+/\\d+\\.html(?:[?#].*)?$" },
		content: {
			selector: ".txtnav",
			remove: "script, style, iframe, ins, .txtinfo.hide720, .readinline, .ad_content",
			replace: [{
				pattern: "PC站点如章节文字不全请用手机访问dingdianzww\\.org",
				replacement: "",
				flags: "g"
			}, {
				pattern: "当&前@章#节\\$内%容\\^不&完\\*整！要~查!看-完_整\\|章;节\\)请\\(退&出%阅#读\\|模\\*式！",
				replacement: "",
				flags: "g"
			}]
		},
		navigation: {
			prev: "#mnr-dingdianzww-prev, .page1 a:contains(\"上一章\")",
			index: "#mnr-dingdianzww-index, .page1 a:contains(\"章节目录\"), .page1 a:contains(\"目录\")",
			next: "#mnr-dingdianzww-next, .page1 a:contains(\"下一章\")"
		},
		title: {
			selector: ".txtnav > h1, h1",
			replace: "\\(第[^)]*页\\)\\s*$",
			bookSelector: ".bread a[href^=\"/\"]:not([href=\"/\"]):not([href=\"/index.html\"])[href$=\"/\"]"
		},
		hooks: { beforeParse: dingdianzwwBeforeParse },
		advanced: {
			useIframe: true,
			noSection: true
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://dingdianzww.org/27543/13341609.html?page=1"
		}
	};
	var goboo_exports$1 = __exportAll({ gobooRule: () => gobooRule });
	var gobooBeforeParse = (doc, url) => {
		try {
			const fallbackUrl = typeof location !== "undefined" && typeof location.href === "string" ? location.href : "";
			const pageUrl = url || doc.location?.href || fallbackUrl;
			const match = (pageUrl ? new URL(pageUrl).pathname : "").match(/^\/gb_(\d+)\/(\d+)\/\d+/);
			if (match && !doc.querySelector("#mnr-goboo-index")) {
				const index = doc.createElement("a");
				index.id = "mnr-goboo-index";
				index.href = `/ml_${match[1]}/${match[2]}`;
				index.textContent = "目录";
				index.style.display = "none";
				doc.body.appendChild(index);
			}
			const hasEncodedContent = Array.from(doc.scripts).some((script) => /p_key\s*=\s*['"][A-Za-z0-9+/=]{80,}['"]/.test(script.textContent || ""));
			doc.querySelectorAll(".content p").forEach((p) => {
				const text = (p.textContent || "").replace(/\s+/g, "");
				const isPromotion = /小说免费阅读，请收藏.*goboo\.cc/i.test(text);
				const isLoadMoreBlocker = /阅\|读\|模\|式\|或\|畅\|读\|模\|式/.test(text) || /加\|载\|更\|多/.test(text);
				if (isPromotion || !hasEncodedContent && isLoadMoreBlocker) p.remove();
			});
		} catch (e) {
			console.warn("[YingChuang] Goboo beforeParse error:", e);
		}
	};
	var gobooRule = {
		id: "goboo-m",
		name: "钢笔小说(手机版)",
		version: 1,
		match: { pattern: "^https?://m\\.goboo\\.cc/gb_\\d+/\\d+/\\d+(?:/\\d+)?/?$" },
		content: {
			selector: ".content",
			remove: "script, iframe, ins, .page, .emgoouqv_b",
			replace: [
				{
					pattern: "【[^】]+】小说免费阅读，请收藏\\s*钢笔小说【goboo\\.cc】",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "阅\\|读\\|模\\|式\\|或\\|畅\\|读\\|模\\|式\\|下，?无\\|法\\|显\\|示\\|本\\|章\\|节\\|全\\|部\\|内\\|容，请\\|返\\|回\\|原\\|网\\|页阅\\|读。?加\\|载\\|更\\|多",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "本章未完，点击\\[下一页\\]继续阅读-->",
					replacement: "",
					flags: "g"
				}
			]
		},
		navigation: {
			prev: ".page .left a",
			index: "#mnr-goboo-index, .page .center a, a[href*=\"/ml_\"]",
			next: ".page .right a"
		},
		title: {
			pattern: "^(.+?)(?:\\(\\d+/\\d+\\))?\\s+-\\s+(.+?)小说\\s+-\\s+钢笔小说$",
			patternIndex: 1,
			bookPatternIndex: 2
		},
		hooks: { beforeParse: gobooBeforeParse },
		advanced: {
			checkSection: true,
			sectionDelayMs: 1200
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://m.goboo.cc/gb_1/94443/1"
		}
	};
	var hetushu_exports = __exportAll({ hetushuRule: () => hetushuRule });
	var SUBSTEP_READY_TIMEOUT_MS = 4e3;
	var MAPPED_VISIBLE_ATTRIBUTE = "data-mnr-hetushu-visible";
	async function waitForLiveContentElement(doc) {
		const existing = doc.querySelector("#content");
		const view = doc.defaultView;
		if (existing || !view || !doc.documentElement) return existing;
		return new Promise((resolve) => {
			let settled = false;
			let observer = null;
			const finish = (contentEl) => {
				if (settled) return;
				settled = true;
				view.clearTimeout(timeoutId);
				observer?.disconnect();
				resolve(contentEl);
			};
			const timeoutId = view.setTimeout(() => finish(null), SUBSTEP_READY_TIMEOUT_MS);
			observer = new view.MutationObserver(() => {
				const contentEl = doc.querySelector("#content");
				if (contentEl) finish(contentEl);
			});
			observer.observe(doc.documentElement, {
				attributes: true,
				attributeFilter: ["id"],
				childList: true,
				subtree: true
			});
			const contentEl = doc.querySelector("#content");
			if (contentEl) finish(contentEl);
		});
	}
	function hasPendingSubstepContent(doc, contentEl) {
		return doc.body?.dataset.randomtype === "substep" && contentEl.firstElementChild?.classList.contains("mask") === true;
	}
	function hasRestoredSubstepContent(doc, contentEl) {
		if (doc.body?.dataset.randomtype !== "substep") return true;
		if (hasPendingSubstepContent(doc, contentEl)) return false;
		if (Array.from(contentEl.children).some((element) => element.tagName === "P")) return true;
		const rows = Array.from(contentEl.children).filter((element) => element.tagName === "DIV" && !element.classList.contains("chapter"));
		return rows.length > 0 && rows.every((element) => element.classList.length > 0 || element.hasAttribute(MAPPED_VISIBLE_ATTRIBUTE));
	}
	async function waitForLiveSubstepContent(doc, contentEl) {
		const view = doc.defaultView;
		if (!view || !hasPendingSubstepContent(doc, contentEl)) return true;
		return new Promise((resolve) => {
			let settled = false;
			let observer = null;
			const finish = (ready) => {
				if (settled) return;
				settled = true;
				view.clearTimeout(timeoutId);
				observer?.disconnect();
				resolve(ready);
			};
			const timeoutId = view.setTimeout(() => finish(false), SUBSTEP_READY_TIMEOUT_MS);
			observer = new view.MutationObserver(() => {
				if (!hasPendingSubstepContent(doc, contentEl)) finish(true);
			});
			observer.observe(contentEl, { childList: true });
			if (!hasPendingSubstepContent(doc, contentEl)) finish(true);
		});
	}
	function decodeSubstepMapping(token) {
		try {
			if (typeof atob !== "function") return null;
			const values = atob(token).split(/[A-Z]+%/);
			if (!values.length || values.some((value) => !/^\d+$/.test(value))) return null;
			return values.map(Number);
		} catch {
			return null;
		}
	}
	function applySubstepMapping(contentEl, mapping) {
		const firstElement = contentEl.firstElementChild;
		const mask = firstElement?.classList.contains("mask") ? firstElement : null;
		const nodes = Array.from(contentEl.childNodes).filter((node) => node !== mask && (node.nodeType !== 3 || !!node.textContent?.trim()));
		let contentStart = 0;
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index];
			if (node.nodeType !== 1) continue;
			const element = node;
			if (element.tagName === "H2") contentStart = index + 1;
			if (element.tagName === "DIV" && element.className !== "chapter") break;
		}
		const sourceNodes = nodes.slice(contentStart);
		if (mapping.length !== sourceNodes.length) return false;
		const ordered = new Array(sourceNodes.length);
		let lowTargetCount = 0;
		for (let index = 0; index < mapping.length; index++) {
			const encodedTarget = mapping[index];
			const target = encodedTarget < 5 ? encodedTarget : encodedTarget - lowTargetCount;
			if (encodedTarget < 5) lowTargetCount++;
			if (target < 0 || target >= ordered.length || ordered[target]) return false;
			ordered[target] = sourceNodes[index];
		}
		if (ordered.some((node) => !node)) return false;
		for (const node of ordered) if (node?.nodeType === 1) node.setAttribute(MAPPED_VISIBLE_ATTRIBUTE, "true");
		contentEl.replaceChildren(...nodes.slice(0, contentStart), ...ordered);
		return true;
	}
	async function restoreSubstepContent(doc, contentEl, pageUrl) {
		if (doc.body?.dataset.randomtype !== "substep") return true;
		if (typeof fetch !== "function") return false;
		let parsedUrl;
		try {
			parsedUrl = new URL(pageUrl);
		} catch {
			return false;
		}
		const chapterId = parsedUrl.pathname.match(/\/(\d+)\.html$/)?.[1];
		if (!chapterId || parsedUrl.hostname !== "www.hetushu.com") return false;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), SUBSTEP_READY_TIMEOUT_MS);
		try {
			const response = await fetch(new URL(`r${chapterId}.json`, parsedUrl).href, {
				credentials: "include",
				headers: { "X-Requested-With": "XMLHttpRequest" },
				signal: controller.signal
			});
			if (!response.ok) return false;
			const token = response.headers.get("token");
			const mapping = token ? decodeSubstepMapping(token) : null;
			return mapping ? applySubstepMapping(contentEl, mapping) : false;
		} catch {
			return false;
		} finally {
			clearTimeout(timeoutId);
		}
	}
	var hetushuBeforeParse = async (doc, url, helpers) => {
		try {
			const contentEl = await waitForLiveContentElement(doc);
			if (!contentEl) return;
			const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
			const fallbackUrl = typeof window !== "undefined" && typeof window.location?.href === "string" ? window.location.href : "";
			const pageUrl = url || doc.location?.href || fallbackUrl;
			if (!hasRestoredSubstepContent(doc, contentEl)) {
				if (doc.defaultView && hasPendingSubstepContent(doc, contentEl)) await waitForLiveSubstepContent(doc, contentEl);
				let ready = hasRestoredSubstepContent(doc, contentEl);
				if (!ready && (!doc.defaultView || !hasPendingSubstepContent(doc, contentEl))) ready = await restoreSubstepContent(doc, contentEl, pageUrl);
				if (!ready) console.warn("[YingChuang] Hetushu content reorder did not complete:", pageUrl);
			}
			const titleEl = contentEl.querySelector("h2");
			const watermarkSelector = "acronym, bdo, big, cite, code, dfn, kbd, q, s, samp, strike, tt, u, var, ins";
			const normalizeWatermarkText = (value) => value.replace(/[\s\u3000]+/g, "").replace(/[ｗwＷW]+[.．•·。]*[hｈ][eｅ][tｔ][uｕ][sｓ][hｈ][uｕ][.．。]*(?:com|ｃｏｍ)(?:[.．。]*(?:com|ｃｏｍ))?/gi, "");
			const collectStyleText = async () => {
				const texts = Array.from(doc.querySelectorAll("style")).map((style) => style.textContent || "").filter(Boolean);
				const links = Array.from(doc.querySelectorAll("link[rel~=\"stylesheet\"][href]"));
				for (const link of links) {
					if (!helpers?.fetchText) continue;
					try {
						const href = link.getAttribute("href");
						if (!href) continue;
						const styleUrl = new URL(href, pageUrl).href;
						const text = await helpers.fetchText(styleUrl, {
							timeoutMs: 4e3,
							withCredentials: true
						});
						if (text) texts.push(text);
					} catch {}
				}
				return texts.join("\n");
			};
			const extractDisplayClasses = (cssText) => {
				const block = new Set();
				const none = new Set();
				const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
				let match;
				while (match = ruleRe.exec(cssText)) {
					const selector = match[1] || "";
					const body = match[2] || "";
					if (!selector.includes("#content")) continue;
					const displayBlock = /display\s*:\s*block\b/i.test(body);
					const displayNone = /display\s*:\s*none\b/i.test(body);
					if (!displayBlock && !displayNone) continue;
					const classRe = /#content\s+\.([A-Za-z0-9_-]+)/g;
					let classMatch;
					while (classMatch = classRe.exec(selector)) {
						if (displayBlock) block.add(classMatch[1]);
						if (displayNone) none.add(classMatch[1]);
					}
				}
				return {
					block,
					none
				};
			};
			const styleClasses = extractDisplayClasses(await collectStyleText());
			const hasLayout = (el) => {
				if (!win) return false;
				const rect = el.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			};
			const isVisibleByClass = (el) => {
				const classes = Array.from(el.classList || []);
				if (!classes.length) return false;
				if (classes.some((cls) => styleClasses.none.has(cls))) return false;
				if (styleClasses.block.size > 0) return classes.some((cls) => styleClasses.block.has(cls));
				return true;
			};
			const isVisible = (el) => {
				if (el.hasAttribute(MAPPED_VISIBLE_ATTRIBUTE)) return true;
				if (!win || !hasLayout(el)) return isVisibleByClass(el);
				const style = win.getComputedStyle(el);
				if (style.display === "none") return false;
				if (style.visibility === "hidden" || style.visibility === "collapse") return false;
				if (Number(style.opacity) === 0) return false;
				return true;
			};
			const cleanClone = (el) => {
				const clone = el.cloneNode(true);
				clone.querySelectorAll(watermarkSelector).forEach((node) => node.remove());
				const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
				const walker = doc.createTreeWalker(clone, showText);
				const textNodes = [];
				while (walker.nextNode()) textNodes.push(walker.currentNode);
				textNodes.forEach((node) => {
					const cleaned = normalizeWatermarkText(node.nodeValue || "");
					if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
				});
				return clone;
			};
			const rows = Array.from(contentEl.children).filter((el) => el !== titleEl && el.tagName !== "SCRIPT" && el.tagName !== "STYLE").filter(isVisible).map((el, index) => {
				const rect = win && hasLayout(el) ? el.getBoundingClientRect() : {
					top: index,
					left: 0
				};
				return {
					index,
					top: rect.top + (win ? win.scrollY : 0),
					left: rect.left + (win ? win.scrollX : 0),
					el
				};
			}).sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index);
			if (!rows.length) return;
			const fragment = doc.createDocumentFragment();
			if (titleEl) fragment.appendChild(titleEl.cloneNode(true));
			rows.forEach(({ el }) => {
				const paragraph = doc.createElement("p");
				const clone = cleanClone(el);
				paragraph.innerHTML = clone.innerHTML || clone.textContent || "";
				if (paragraph.textContent && paragraph.textContent.replace(/\s+/g, "").trim()) fragment.appendChild(paragraph);
			});
			contentEl.innerHTML = "";
			contentEl.appendChild(fragment);
		} catch (e) {
			console.warn("[YingChuang] Hetushu beforeParse error:", e);
		}
	};
	var hetushuRule = {
		id: "hetushu",
		name: "和图书",
		version: 3,
		match: { pattern: "^https?://www\\.hetushu\\.com/book/\\d+/\\d+\\.html$" },
		content: {
			selector: "#content",
			remove: "h2, acronym, bdo, big, cite, code, dfn, kbd, q, s, samp, strike, tt, u, var, ins"
		},
		navigation: {
			next: "a#next",
			prev: "a#pre",
			index: "#left h3 a"
		},
		title: { bookSelector: "#left h3" },
		hooks: { beforeParse: hetushuBeforeParse },
		advanced: { useIframe: true },
		meta: {
			source: "builtin",
			exampleUrl: "https://www.hetushu.com/book/9145/6567989.html"
		}
	};
	var kudushu_exports = __exportAll({
		kudushuPcRule: () => kudushuPcRule,
		kudushuRule: () => kudushuRule
	});
	var kudushuRule = {
		id: "kudushu",
		name: "苦读书（移动版）",
		version: 2,
		match: { pattern: "^https?://m\\.kudushu\\.org/html/\\d+/\\d+(?:_\\d+)?/(?:[?#].*)?$" },
		content: {
			selector: "#novelcontent",
			remove: "#content_tip, ul.novelbutton",
			replace: [{
				pattern: "^[\\s\\S]*?[（(]第\\d+[/／]\\d+页[）)]",
				replacement: "",
				flags: ""
			}]
		},
		navigation: {
			prev: ".content_novel > ul.novelbutton p.p1:not(.p3) > a[href*=\"/html/\"]",
			next: ".content_novel > ul.novelbutton p.p3 > a[href*=\"/html/\"]",
			index: ".content_novel > ul.novelbutton p.p2 > a[href*=\"/book/\"]"
		},
		title: { selector: "#chaptertitle" },
		toc: { selector: ".info_menu1 .list_xm:has(> .listpage) > ul" },
		advanced: {
			checkSection: true,
			sectionDelayMs: 800
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://m.kudushu.org/html/1088392/146537150/"
		}
	};
	var kudushuPcRule = {
		id: "kudushu-pc",
		name: "苦读书（PC版）",
		version: 1,
		match: { pattern: "^https?://www\\.kudushu\\.org/html/\\d+/\\d+/\\d+\\.html(?:[?#].*)?$" },
		content: {
			selector: "#clickeye_content",
			remove: ".style3",
			replace: [{
				pattern: "[（(]?\\s*苦读书\\s*www\\.kudushu\\.org\\s*[）)]?",
				replacement: "",
				flags: "g"
			}]
		},
		navigation: {
			prev: ".P_Nav .inforight a:not([href$=\"index.html\"]):contains(\"上一页\")",
			next: ".P_Nav .inforight a:not([href$=\"index.html\"]):contains(\"下一页\")",
			index: ".P_Nav .inforight a[href$=\"index.html\"]"
		},
		title: { selector: "#cont h1" },
		toc: { selector: ".index > ul.chapters" },
		meta: {
			source: "builtin",
			exampleUrl: "https://www.kudushu.org/html/1088/1088392/146537150.html"
		}
	};
	var novel543_exports = __exportAll({ novel543Rule: () => novel543Rule });
	var CHAPTER_URL$1 = /^https?:\/\/(?:www\.)?novel543\.com(\/\d+\/\d+_\d+)(?:_(\d+))?\.html(?:[?#].*)?$/;
	function parseNovel543Url(url) {
		const match = url.match(CHAPTER_URL$1);
		if (!match) return null;
		const parsed = new URL(url);
		parsed.pathname = `${match[1]}.html`;
		parsed.hash = "";
		return {
			chapterUrl: parsed.href,
			page: Number(match[2] || 1)
		};
	}
	var novel543Rule = {
		id: "novel543",
		name: "稷下書院",
		version: 1,
		match: { pattern: CHAPTER_URL$1.source },
		content: {
			selector: ".chapter-content > .content",
			remove: ".adBlock, .gadBlock, [id^=div-onead-], div:has(> img[src=\"/images/vip.png\"]):has(> a[href$=\"/auth/govip.html\"]), div:has(> p img[src=\"/images/vip.png\"]):has(> a[href$=\"/auth/govip.html\"])"
		},
		navigation: {
			prev: ".foot-nav a:contains(上一章)",
			index: ".foot-nav a[href$=\"/dir\"]",
			next: ".foot-nav a:contains(下一章)"
		},
		title: {
			selector: ".chapter-content > h1",
			replace: "\\s*[（(]\\d+\\s*/\\s*\\d+[）)]\\s*$",
			bookSelector: ".header .nav li:last-child a"
		},
		toc: { excludeAncestors: ".chaplist > ul:not(.all)" },
		hooks: {
			parseSectionUrl: parseNovel543Url,
			beforeParse: (doc) => {
				const bookLink = doc.querySelector(".header .nav li:last-child a");
				const bookTitle = doc.querySelector("meta[name=keywords]")?.content.match(/^(.+?)官方首[發发](?:[,，]|$)/)?.[1];
				if (bookLink && !bookLink.textContent?.trim() && bookTitle) bookLink.textContent = bookTitle;
				for (const p of doc.querySelectorAll("#chapterWarp .content > div > p")) {
					const label = p.firstChild;
					if (label?.nodeName === "SPAN" && /^[溫温]馨提示[:：]$/.test(label.textContent?.trim() || "")) p.remove();
				}
			}
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.novel543.com/1019622989/8096_941.html"
		}
	};
	var novels_exports = __exportAll({ novelsRule: () => novelsRule });
	var CHAPTER_URL = /^https?:\/\/www\.novels\.com\.tw(\/novels\/[^/?#]+\/\d+)(?:_(\d+))?\.html(?:[?#].*)?$/;
	function normalizeNovelsUrl(url) {
		if (!CHAPTER_URL.test(url)) return null;
		const parsed = new URL(url);
		parsed.searchParams.delete("aid");
		return parsed.href;
	}
	var novelsRule = {
		id: "novels",
		name: "繁體小說",
		version: 1,
		match: { pattern: CHAPTER_URL.source },
		content: {
			selector: "#article",
			remove: ":scope > div, script, style, iframe, ins"
		},
		navigation: {
			prev: "#prev_url",
			next: "#next_url",
			index: "#info_url"
		},
		title: {
			selector: ".text_title h1",
			replace: "\\s*[（(]\\d+\\s*/\\s*\\d+[）)]\\s*$",
			bookSelector: ".text_info a:first-child"
		},
		advanced: {
			checkSection: true,
			sectionDelayMs: 1e3
		},
		hooks: {
			normalizeChapterUrl: normalizeNovelsUrl,
			parseSectionUrl: (url) => {
				const match = url.match(CHAPTER_URL);
				if (!match) return null;
				const parsed = new URL(normalizeNovelsUrl(url));
				parsed.pathname = `${match[1]}.html`;
				parsed.hash = "";
				return {
					chapterUrl: parsed.href,
					page: Number(match[2] || 1)
				};
			},
			beforeParse: async (doc) => {
				const article = doc.querySelector("#article");
				const encoded = (article?.querySelector("#chapter-content script")?.textContent)?.match(/window\.encryptedContent\s*=\s*("(?:\\.|[^"\\])*")/);
				if (article && encoded) {
					const bytes = Uint8Array.from(atob(JSON.parse(encoded[1])), (c) => c.charCodeAt(0));
					const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("WZc0cbzgY3lhz3X6"), "AES-CBC", false, ["decrypt"]);
					const decrypted = await crypto.subtle.decrypt({
						name: "AES-CBC",
						iv: new Uint8Array(16)
					}, key, bytes);
					let text = new TextDecoder().decode(decrypted);
					const padding = text.charCodeAt(text.length - 1);
					if (padding >= 1 && padding <= 16 && text.endsWith(String.fromCharCode(padding).repeat(padding))) text = text.slice(0, -padding);
					if (/<[a-z][\s\S]*>/i.test(text)) article.innerHTML = text;
					else article.replaceChildren(...text.split("\n").map((line) => {
						const paragraph = doc.createElement("p");
						paragraph.textContent = line;
						return paragraph;
					}));
				}
				for (const link of doc.querySelectorAll("#prev_url[data-real-href], #next_url[data-real-href], #info_url[data-real-href]")) link.setAttribute("href", link.getAttribute("data-real-href"));
			}
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.novels.com.tw/novels/no689ecf9c709950ae5cadd90cff89ffd6257bf537a60d904c9e6084f4aa2c12ca/199107755.html?aid=1092650"
		}
	};
	var qidian_exports$1 = __exportAll({
		qidianMobileRule: () => qidianMobileRule,
		qidianRule: () => qidianRule
	});
	function hasQidianChapterId(value) {
		return value !== void 0 && value !== null && String(value) !== "-1" && String(value) !== "";
	}
	function readQidianPageContext(doc) {
		const script = doc.querySelector("#vite-plugin-ssr_pageContext");
		if (!script) return null;
		try {
			return JSON.parse(script.textContent || "{}");
		} catch {
			return null;
		}
	}
	function extractBookIdFromQidianUrl(url) {
		if (!url) return null;
		try {
			return new URL(url, typeof location !== "undefined" ? location.href : void 0).pathname.match(/\/(?:book|chapter)\/(\d+)(?:\/|$)/)?.[1] || null;
		} catch {
			return null;
		}
	}
	function extractChapterIdFromQidianUrl(url) {
		if (!url) return null;
		try {
			return new URL(url, typeof location !== "undefined" ? location.href : void 0).pathname.match(/\/chapter\/\d+\/(\d+)(?:\/|$)/)?.[1] || null;
		} catch {
			return null;
		}
	}
	function resolveQidianBookId(data, url) {
		const bookId = data?.pageContext?.pageProps?.pageData?.bookInfo?.bookId ?? data?.pageContext?.routeParams?.bookId ?? extractBookIdFromQidianUrl(url);
		return bookId === void 0 || bookId === null || String(bookId) === "" ? null : String(bookId);
	}
	function resolveQidianFirstChapterId(data) {
		const pageData = data?.pageContext?.pageProps?.pageData;
		return pageData?.firstChapterId ?? pageData?.chapterContentInfo?.firstChapterId;
	}
	function resolveQidianNextPreviewChapterId(data) {
		const pageData = data?.pageContext?.pageProps?.pageData;
		return pageData?.nextChapterId ?? pageData?.chapterContentInfo?.nextChapterId;
	}
	function normalizeQidianHydratedParagraphIndent(doc) {
		const spans = doc.querySelectorAll("main[id^=\"c-\"] p > span.content-text:first-child");
		for (const span of spans) {
			const firstChild = span.firstChild;
			if (!firstChild || firstChild.nodeType !== 3) continue;
			const text = firstChild.nodeValue || "";
			const normalized = text.replace(/^[\s\u3000]+/u, "");
			if (normalized !== text) firstChild.nodeValue = normalized;
		}
	}
	function resolveQidianMobileBookPreviewChapterUrl(doc, url) {
		let parsedUrl;
		try {
			parsedUrl = new URL(url);
		} catch {
			return null;
		}
		if (parsedUrl.hostname !== "m.qidian.com") return null;
		if (!/^\/book\/\d+\/?$/.test(parsedUrl.pathname)) return null;
		const data = readQidianPageContext(doc);
		const bookId = resolveQidianBookId(data, url);
		const firstChapterId = resolveQidianFirstChapterId(data);
		if (!bookId || !hasQidianChapterId(firstChapterId)) return null;
		return new URL(`/chapter/${bookId}/${String(firstChapterId)}/`, parsedUrl.origin).toString();
	}
	var qidianBeforeParse = (doc, url) => {
		normalizeQidianHydratedParagraphIndent(doc);
		try {
			doc.querySelectorAll("h1 .review, h2 .review").forEach((el) => el.remove());
		} catch (e) {
			console.debug("[MNR] Failed to remove review elements:", e);
		}
		try {
			const data = readQidianPageContext(doc);
			const pageData = data?.pageContext?.pageProps?.pageData;
			if (!pageData) return;
			const bookId = resolveQidianBookId(data, url);
			const currentChapterId = extractChapterIdFromQidianUrl(url);
			const firstChapterId = resolveQidianFirstChapterId(data);
			const chapterInfo = pageData.chapterInfo;
			const prevChapterId = chapterInfo?.prev;
			let nextChapterId = chapterInfo?.next;
			if (!hasQidianChapterId(nextChapterId) && currentChapterId && hasQidianChapterId(firstChapterId) && String(firstChapterId) === currentChapterId) nextChapterId = resolveQidianNextPreviewChapterId(data);
			const host = url ? new URL(url).hostname : location.hostname;
			const navContainer = doc.createElement("div");
			navContainer.id = "mnr-qidian-nav";
			navContainer.style.display = "none";
			if (bookId && hasQidianChapterId(prevChapterId)) {
				const prev = doc.createElement("a");
				prev.id = "mnr-qidian-prev";
				prev.href = `//${host}/chapter/${bookId}/${prevChapterId}/`;
				prev.textContent = "上一章";
				navContainer.appendChild(prev);
			}
			if (bookId && hasQidianChapterId(nextChapterId)) {
				const next = doc.createElement("a");
				next.id = "mnr-qidian-next";
				next.href = `//${host}/chapter/${bookId}/${nextChapterId}/`;
				next.textContent = "下一章";
				navContainer.appendChild(next);
			}
			if (bookId) {
				const index = doc.createElement("a");
				index.id = "mnr-qidian-index";
				index.href = `//${host}/book/${bookId}/`;
				index.textContent = "目录";
				navContainer.appendChild(index);
			}
			doc.body.appendChild(navContainer);
		} catch (e) {
			console.warn("[YingChuang] Qidian beforeParse error:", e);
		}
	};
	var qidianContent = {
		selector: "main[id^=\"c-\"]",
		remove: ".review, #r-titlePage, .tooltip-wrapper, .chapter-end-qrcode, section[id^=\"r-\"]"
	};
	var qidianNavigation = {
		prev: "#mnr-qidian-prev, .nav-btn-group a:contains(\"上一章\"), a.nav-btn:contains(\"上一章\")",
		index: "#mnr-qidian-index",
		next: "#mnr-qidian-next, .nav-btn-group a:contains(\"下一章\"), a.nav-btn:contains(\"下一章\")"
	};
	var qidianTitle = { selector: "h1.title, h2.title, h1.text-1\\.3em, h2.text-1\\.3em, #r-nav-chapter-title" };
	var qidianHooks = { beforeParse: qidianBeforeParse };
	var qidianMobileRule = {
		id: "qidian-mobile",
		name: "起点中文网手机版",
		version: 1,
		match: { pattern: "^https?://m\\.qidian\\.com/chapter/.*" },
		content: { ...qidianContent },
		navigation: { ...qidianNavigation },
		title: { ...qidianTitle },
		hooks: {
			...qidianHooks,
			resolveEntryUrl: resolveQidianMobileBookPreviewChapterUrl
		},
		advanced: {
			mutationSelector: "main[id^=\"c-\"]",
			mutationChildCount: 0
		},
		meta: { source: "builtin" }
	};
	var qidianRule = {
		id: "qidian",
		name: "起点中文网",
		version: 9,
		match: { pattern: "^https?://www\\.qidian\\.com/chapter/.*" },
		content: { ...qidianContent },
		navigation: { ...qidianNavigation },
		title: { ...qidianTitle },
		hooks: { ...qidianHooks },
		advanced: {
			useIframe: true,
			mutationSelector: "main[id^=\"c-\"]",
			mutationChildCount: 0
		},
		meta: { source: "builtin" }
	};
	var shu69_exports = __exportAll({ shu69Rule: () => shu69Rule });
	var shu69BeforeParse = (doc, url) => {
		try {
			const fallbackUrl = typeof location !== "undefined" && typeof location.href === "string" ? location.href : "";
			const pageUrl = url || doc.location?.href || fallbackUrl;
			const text = Array.from(doc.querySelectorAll("script")).find((item) => (item.textContent || "").includes("bookinfo"))?.textContent || "";
			if (!text) return;
			const extractString = (key) => {
				return text.match(new RegExp(`${key}\\s*:\\s*(["'])([^"'\\r\\n]{1,300})\\1`, "i"))?.[2]?.trim() || "";
			};
			const normalizeUrl = (value) => {
				if (!value) return "";
				try {
					return new URL(value, pageUrl).href;
				} catch {
					return value;
				}
			};
			const ensureAnchor = (id, href, label) => {
				if (!href || doc.querySelector(`#${id}`)) return;
				const parent = doc.body || doc.documentElement;
				if (!parent) return;
				const anchor = doc.createElement("a");
				anchor.id = id;
				anchor.href = normalizeUrl(href);
				anchor.textContent = label;
				anchor.style.display = "none";
				parent.appendChild(anchor);
			};
			const bookTitle = extractString("articlename");
			const chapterTitle = extractString("chaptername");
			const indexUrl = extractString("index_page");
			const prevUrl = extractString("preview_page");
			const nextUrl = extractString("next_page");
			ensureAnchor("mnr-69shu-book", indexUrl || prevUrl, bookTitle);
			ensureAnchor("mnr-69shu-index", indexUrl, "目录");
			ensureAnchor("mnr-69shu-prev", prevUrl, "上一章");
			ensureAnchor("mnr-69shu-next", nextUrl, "下一章");
			if (chapterTitle && !doc.querySelector("#mnr-69shu-title")) {
				const parent = doc.body || doc.documentElement;
				if (!parent) return;
				const title = doc.createElement("h1");
				title.id = "mnr-69shu-title";
				title.textContent = chapterTitle;
				title.style.display = "none";
				parent.appendChild(title);
			}
		} catch (e) {
			console.warn("[YingChuang] 69shu beforeParse error:", e);
		}
	};
	var shu69Rule = {
		id: "69shu",
		name: "69书吧",
		version: 2,
		match: { pattern: "^https?://(?:www\\.)?69(?:shu|yuedu)[a-z0-9]*?\\.(?:pro|top|com|cx|net|co|me|biz)/(?:txt|c|r)/\\d+/\\d+/?(?:[?#].*)?$" },
		content: {
			selector: "#txtcontent, .txtnav",
			remove: "script, style, iframe, ins, .txtinfo.hide720, #txtright, .bottom-ad, .bottom-ad2, .page1, .readinline, .ad_content",
			replace: [{
				pattern: ".*[6六].*[9九].*书.*吧.*",
				replacement: "",
				flags: "g"
			}, {
				pattern: "请收藏本站.*?最新网址.*?(?:<br\\s*/?>)?",
				replacement: "",
				flags: "g"
			}]
		},
		navigation: {
			prev: "#mnr-69shu-prev, .page1 a:contains(\"上一章\"), .page1 a:nth-child(1)",
			index: "#mnr-69shu-index, .page1 a:contains(\"目录\"), .page1 a:contains(\"書目\"), .page1 a:nth-child(3)",
			next: "#mnr-69shu-next, .page1 a:contains(\"下一章\"), .page1 a:nth-child(4)"
		},
		title: {
			selector: "#mnr-69shu-title, h1",
			bookSelector: "#mnr-69shu-book, .mytitle .bread a[href*=\"/book/\"][href$=\".htm\"], .txtinfo a:first-child, .con_top a:nth-child(3)"
		},
		hooks: { beforeParse: shu69BeforeParse },
		advanced: {
			noSection: true,
			useIframe: true
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.69shuba.com/txt/58672/38147713"
		}
	};
	var sto9_exports$1 = __exportAll({ sto9Rule: () => sto9Rule });
	var sto9BeforeParse = (doc) => {
		const content = doc.querySelector(".txtnav");
		if (!content) return;
		const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
		const walker = doc.createTreeWalker(content, showText);
		let node;
		while (node = walker.nextNode()) if ((node.nodeValue || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes("sto9com")) node.nodeValue = "";
	};
	var sto9Rule = {
		id: "sto9",
		name: "思兔阅读",
		version: 2,
		match: { pattern: "^https?://(?:www\\.)?sto9\\.com/txt/\\d+/\\d+\\.html(?:[?#].*)?$" },
		content: {
			selector: ".txtnav",
			remove: "script, style, iframe, ins, .txtright, .txtad, .txtcenter",
			replace: [{
				pattern: "[（(]\\s*還有更新耶\\s*[）)]",
				replacement: "",
				flags: "g"
			}]
		},
		navigation: {
			prev: ".page1 a:contains(\"上一章\")",
			index: ".page1 a:contains(\"目錄\"), .page1 a:contains(\"目录\")",
			next: ".page1 a:not([href$=\"/end.html\"]):contains(\"下一章\")"
		},
		title: {
			selector: ".txtnav > h1",
			bookSelector: ".bread a[href*=\"/book/\"][href$=\"/index.html\"]"
		},
		hooks: { beforeParse: sto9BeforeParse },
		meta: {
			source: "builtin",
			exampleUrl: "https://sto9.com/txt/7974/7627078.html"
		}
	};
	var sudugu_exports = __exportAll({ suduguRule: () => suduguRule });
	var suduguRule = {
		id: "sudugu",
		name: "速读谷",
		version: 1,
		match: { pattern: "^https?://www\\.shudugu\\.org/\\d+/\\d+(?:-\\d+)?\\.html(?:[?#].*)?$" },
		content: {
			selector: ".con",
			remove: "script, style, iframe, ins"
		},
		navigation: {
			prev: ".prenext span:first-child a",
			index: ".prenext > a[href*=\"#dir\"]",
			next: ".prenext span:last-child a"
		},
		title: {
			selector: ".submenu h1",
			replace: "^.*?>\\s*",
			bookSelector: ".submenu h1 > a[href^=\"/\"][href$=\"/\"]"
		},
		toc: { excludeAncestors: ".new, .item, h1, h2" },
		advanced: {
			checkSection: true,
			sectionDelayMs: 800
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.shudugu.org/109/1226047.html"
		}
	};
	var tiantang_exports = __exportAll({ tiantangRule: () => tiantangRule });
	var tiantangRule = {
		id: "tiantang",
		name: "格格党（tiantang100）",
		version: 1,
		match: { pattern: "^https?://www\\.tiantang100\\.org/\\d+/\\d+/\\d+(?:_\\d+)?\\.html(?:[?#].*)?$" },
		content: { selector: "#content" },
		navigation: { index: "#mnr-tiantang-index" },
		hooks: { beforeParse(doc, url) {
			if (!url || !new RegExp(tiantangRule.match.pattern).test(url)) return;
			appendHiddenLink(doc, "mnr-tiantang-index", ".", "目录", url);
		} },
		meta: {
			source: "builtin",
			exampleUrl: "http://www.tiantang100.org/337/337644/1889083.html"
		}
	};
	var ttks_exports = __exportAll({ ttksRule: () => ttksRule });
	var WATERMARK_TAIL_PATTERN = /\s*(?:[（(【]\s*)?(?:[寫写]到[這这][裡里]我希望[讀读]者[記记]一下我[們们]域名|由[於于][緩缓]存原因[，,]?[請请]用[戶户]直接(?:瀏覽|浏览)器(?:訪問|访问)|本[書书]首[發发]|天天看[小小說说]{2}解[書书]荒|[記记]住本站域名)[\s\S]*$/u;
	var ttksBeforeParse = (doc) => {
		const content = doc.querySelector(".frame_body > .title + .content");
		if (!content) return;
		const paragraphs = Array.from(content.querySelectorAll(":scope > p"));
		for (const paragraph of paragraphs) {
			const text = paragraph.textContent || "";
			const cleaned = text.replace(WATERMARK_TAIL_PATTERN, "").trimEnd();
			if (cleaned !== text) {
				if (cleaned) paragraph.textContent = cleaned;
				else paragraph.remove();
			}
		}
		const trailingParagraphs = Array.from(content.querySelectorAll(":scope > p"));
		for (let index = trailingParagraphs.length - 1; index >= 0; index--) {
			const paragraph = trailingParagraphs[index];
			const text = (paragraph.textContent || "").replace(/\s+/g, "").trim();
			if (!text) {
				paragraph.remove();
				continue;
			}
			if (/^(?:>|福)$/.test(text)) {
				paragraph.remove();
				continue;
			}
			break;
		}
	};
	var ttksRule = {
		id: "ttks",
		name: "天天看小說",
		version: 1,
		match: { pattern: "^https?://(?:www\\.)?ttks\\.tw/novel/chapters/[^/?#]+/\\d+\\.html(?:[?#].*)?$" },
		content: {
			selector: ".frame_body > .title + .content",
			remove: ".anchor_bookmark, .txtcenter, .div_feedback, .social_share_frame"
		},
		navigation: {
			prev: "#linkPrev",
			index: ".breadcrumb_nav a[href$=\"/index.html\"]",
			next: "#linkNext"
		},
		title: {
			selector: ".frame_body > .title h1, .frame_body > .title",
			bookSelector: ".breadcrumb_nav a[href$=\"/index.html\"]"
		},
		hooks: { beforeParse: ttksBeforeParse },
		advanced: {
			noSection: true,
			useIframe: true
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://ttks.tw/novel/chapters/kaijuxiangqinnvshenbuhuodugujiujian/83.html"
		}
	};
	var twkan_exports$1 = __exportAll({ twkanRule: () => twkanRule });
	var twkanRule = {
		id: "twkan",
		name: "台灣小說網",
		version: 1,
		match: { pattern: "^https?://twkan\\.com/txt/\\d+/\\d+/?(?:[?#].*)?$" },
		content: {
			selector: "#txtcontent0, .txtnav",
			remove: "script, style, iframe, ins, .page1, .readinline, .read-link, .ad_content, .top-ad, .bottom-ad",
			replace: [
				{
					pattern: "^[\\s\\u00a0\\u3000\\u2000-\\u200a]*第[一二三四五六七八九十百千\\d]+(?:章|节|節|回|话|話|篇|集|卷)[^<]{0,120}(?:<br\\s*/?>\\s*)+",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "（?請記住臺灣小説網[^<\\n]*?）?",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "（?请记住[臺台]湾小[説说]网[^<\\n]{0,160}(?:章节更新|網站|网站)[^<\\n]{0,40}）?",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "〖[^〗]*分享[^〗]*運營[^〗]*〗",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "【[^】]{0,100}(?:域名|[臺台]湾小[説说]网|[臺台]湾好书)[^】]{0,160}】",
					replacement: "",
					flags: "g"
				},
				{
					pattern: "本章完。?",
					replacement: "",
					flags: "g"
				}
			]
		},
		navigation: {
			prev: "a:contains(\"上一章\")",
			index: "a:contains(\"目錄\"), a:contains(\"目录\"), a:contains(\"書頁\"), a:contains(\"书页\")",
			next: "a:contains(\"下一章\")"
		},
		title: {
			selector: ".txtnav > h1, h1",
			pattern: "^(.+?)-(.+?)-[^-]+-.*?台灣小說網$",
			patternIndex: 1,
			bookPatternIndex: 2,
			bookSelector: "a[href*=\"/book/\"][href$=\"/index.html\"]"
		},
		advanced: { useIframe: true },
		meta: {
			source: "builtin",
			exampleUrl: "https://twkan.com/txt/93181/53052605"
		}
	};
	var uuread_exports = __exportAll({ uureadRule: () => uureadRule });
	var uureadRule = {
		id: "uuread",
		name: "UU看书",
		version: 2,
		match: { pattern: "^https?://www\\.uuread\\.tw/chapter/\\d+/\\d+(?:_\\d+)?\\.html$" },
		content: { selector: ".txt_tcontent" },
		navigation: {
			next: "a.btn-primary:nth-child(4)",
			prev: "a.btn-primary:nth-child(1)",
			index: "a.btn-primary:nth-child(3)"
		},
		title: {
			selector: ".chatit",
			replace: "\\s*[（(]\\s*\\d+\\s*/\\s*\\d+\\s*[）)]\\s*$",
			bookSelector: ".bread > li:nth-child(4) > a:nth-child(1)"
		},
		advanced: { checkSection: true },
		meta: {
			source: "builtin",
			exampleUrl: "https://www.uuread.tw/chapter/1880014/2545609.html"
		}
	};
	var wxsl_exports = __exportAll({ wxslRule: () => wxslRule });
	var wxslRule = {
		id: "wxsl",
		name: "森林文学",
		version: 1,
		match: { pattern: "^https?://www\\.2wxsl\\.com/book/\\d+/\\d+(?:_\\d+)?\\.html(?:[?#].*)?$" },
		content: { selector: "#content" },
		toc: { selector: ".row-section .section-box:has(+ .listpage) > .section-list" },
		meta: {
			source: "builtin",
			exampleUrl: "http://www.2wxsl.com/book/132139/50723047.html"
		}
	};
	var xszj_exports = __exportAll({ xszjRule: () => xszjRule });
	var xszjRule = {
		id: "xszj",
		name: "小说之家",
		version: 1,
		match: { pattern: "^https?://(?:m\\.)?xszj\\.org/b/\\d+/c/\\d+(?:[?#].*)?$" },
		content: {
			selector: "#booktxt",
			remove: "script, style, iframe, ins"
		},
		navigation: {
			prev: ".bottem1 a:contains(\"上一章\"), .bottem1 a:contains(\"上一页\"), .bottem1 a:contains(\"上一頁\")",
			index: ".bottem1 a[href*=\"/cs/\"], .bottem1 a:contains(\"目录\"), .bottem1 a:contains(\"目錄\")",
			next: ".bottem1 a:contains(\"下一章\"), .bottem1 a:contains(\"下一页\"), .bottem1 a:contains(\"下一頁\")"
		},
		title: {
			selector: "h1.bookname",
			replace: "\\s*[（(]\\d+/\\d+[)）]\\s*$",
			bookSelector: ".con_top a[href^=\"/b/\"]"
		},
		advanced: {
			checkSection: true,
			sectionMaxPages: 99,
			sectionDelayMs: 800
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://xszj.org/b/490346/c/1534359"
		}
	};
	var modules$1 = Object.assign({
		"./ciweimao.ts": ciweimao_exports,
		"./deqixs.ts": deqixs_exports,
		"./dingdianzww.ts": dingdianzww_exports,
		"./goboo.ts": goboo_exports$1,
		"./hetushu.ts": hetushu_exports,
		"./kudushu.ts": kudushu_exports,
		"./novel543.ts": novel543_exports,
		"./novels.ts": novels_exports,
		"./qidian.ts": qidian_exports$1,
		"./shu69.ts": shu69_exports,
		"./sto9.ts": sto9_exports$1,
		"./sudugu.ts": sudugu_exports,
		"./tiantang.ts": tiantang_exports,
		"./ttks.ts": ttks_exports,
		"./twkan.ts": twkan_exports$1,
		"./uuread.ts": uuread_exports,
		"./wxsl.ts": wxsl_exports,
		"./xszj.ts": xszj_exports
	});
	function isSiteRule(value) {
		if (!value || typeof value !== "object") return false;
		const maybe = value;
		return typeof maybe.id === "string" && typeof maybe.version === "number" && !!maybe.match && typeof maybe.match.pattern === "string" && !!maybe.content && typeof maybe.content.selector === "string";
	}
	var siteRules = Object.keys(modules$1).sort().flatMap((path) => Object.values(modules$1[path]).filter(isSiteRule));
	var specialRules = [{
		id: "gongzicp",
		name: "长佩文学网",
		version: 1,
		match: { pattern: "^https?://www\\.gongzicp\\.com/read-\\d+\\.html" },
		content: {
			selector: ".content",
			replace: [{
				pattern: "来源长佩文学网（https://www\\.gongzicp\\.com）",
				replacement: ""
			}]
		},
		title: { bookSelector: ".novel" },
		advanced: {
			useIframe: true,
			mutationSelector: ".novel",
			mutationChildCount: 2
		},
		meta: {
			source: "builtin",
			exampleUrl: "https://www.gongzicp.com/read-246381.html"
		}
	}];
	var simplifiedRules = [
		{
			id: "ldks-2baoe",
			name: "零点看书（ldks）",
			version: 1,
			match: { pattern: "^https?://(?:23\\.225\\.121\\.247|www\\.2baoe\\.com)/ldks/\\d+/\\d+(?:[_-]\\d+)?\\.html$" },
			content: {
				selector: "#content",
				remove: "h1.title, script"
			},
			navigation: {
				prev: ".section-opt a:contains(\"上一章\"), .section-opt a:contains(\"上一页\")",
				index: ".section-opt a:contains(\"章节列表\"), a:contains(\"章节列表\")",
				next: ".section-opt a:contains(\"下一章\"), .section-opt a:contains(\"下一页\")"
			},
			title: { selector: "h1.title" },
			advanced: { checkSection: true },
			meta: {
				source: "builtin",
				exampleUrl: "http://23.225.121.247/ldks/111291/42509753_2.html"
			}
		},
		{
			id: "tadu",
			name: "塔读文学",
			version: 1,
			match: { pattern: "^https?://www\\.tadu\\.com/book/\\d+/\\d+/?" },
			content: { selector: "#partContent" },
			title: {
				selector: "h4",
				bookSelector: ".chapter_details > span"
			},
			advanced: {
				useIframe: true,
				mutationSelector: "#partContent",
				mutationChildCount: 0
			},
			meta: { source: "builtin" }
		},
		{
			id: "sfacg",
			name: "SF 轻小说",
			version: 1,
			match: { pattern: "^https?://book.sfacg.com/Novel/\\d+/\\d+/\\d+/" },
			content: { selector: "#ChapterBody" },
			title: { pattern: "(.*?)-(.*?)-.*" },
			meta: {
				source: "builtin",
				exampleUrl: "https://book.sfacg.com/Novel/601991/795722/7137683/"
			}
		},
		{
			id: "piaotia",
			name: "飘天文学",
			version: 1,
			match: { pattern: "^https?://www\\.piaotia\\.com/html/\\d+/\\d+/\\d+\\.html" },
			content: {
				selector: "#content",
				remove: "h1, table, .toplink"
			},
			title: { bookSelector: "#content > h1 > a" },
			advanced: { useIframe: true },
			meta: {
				source: "builtin",
				exampleUrl: "https://www.piaotia.com/html/15/15083/10323993.html"
			}
		},
		{
			id: "shushan",
			name: "书山中文网",
			version: 1,
			match: { pattern: "https?://shushan\\.zhangyue\\.net/book/\\d+/\\d+/" },
			content: { selector: ".art_con" },
			navigation: {
				next: ".next-cha",
				prev: ".last-cha",
				index: "a:contains(书页)"
			},
			meta: {
				source: "builtin",
				exampleUrl: "https://shushan.zhangyue.net/book/105835/15038074/"
			}
		},
		{
			id: "esjzone",
			name: "ESJ",
			version: 1,
			match: { pattern: "^https?://www\\.esjzone\\.(?:me|cc)/forum/\\d+/\\d+\\.html" },
			content: { selector: ".mt-3.forum-content" },
			navigation: {
				next: ".btn-next.btn-sm.btn-outline-secondary.btn",
				prev: ".btn-prev.btn-sm.btn-outline-secondary.btn",
				index: ".view-all.btn-outline-secondary.btn"
			},
			title: { selector: "h2" },
			meta: {
				source: "builtin",
				exampleUrl: "https://www.esjzone.cc/forum/1677032544/162585.html"
			}
		},
		{
			id: "ixdzs",
			name: "爱下电子书",
			version: 1,
			match: { pattern: "https://ixdzs8.com/read/\\d+/p\\d+.html" },
			content: { selector: ".page-content section" },
			navigation: {
				next: ".chapter-next",
				prev: ".chapter-pre",
				index: "a:contains(书籍页)"
			},
			meta: {
				source: "builtin",
				exampleUrl: "https://ixdzs8.com/read/42730/p1.html"
			}
		},
		{
			id: "xs321",
			name: "小说321",
			version: 1,
			match: { pattern: "https?://www\\.xs321\\.net/book/\\d+/\\d+/\\d+(_\\d+)?\\.html" },
			content: { selector: "#content" },
			advanced: { checkSection: true },
			meta: {
				source: "builtin",
				exampleUrl: "http://www.xs321.net/book/671/671539/1.html"
			}
		},
		{
			id: "ilwxs",
			name: "乐文小说",
			version: 2,
			match: { pattern: "https://m\\.ilwxs\\.com/shu/\\d+/\\d+\\.html" },
			content: { selector: ".content" },
			navigation: {
				prev: ".pager a:contains(\"上一章\"), .pager a:contains(\"上一页\")",
				next: ".pager a:contains(\"下一章\"), .pager a:contains(\"下一页\")",
				index: ".pager a[href^=\"/shu/\"][href$=\"/\"], .pager a[href*=\"/shu/\"][href$=\"/\"], .pager a:contains(\"目 录\"), .pager a:contains(\"目录\")"
			},
			title: {
				selector: ".headline",
				bookSelector: ".path > a:nth-child(2)"
			},
			advanced: { checkSection: true },
			meta: {
				source: "builtin",
				exampleUrl: "https://m.ilwxs.com/shu/36354/171272950.html"
			}
		},
		{
			id: "faloo",
			name: "飞卢小说网",
			version: 1,
			match: { pattern: "^https?://[a-z]\\.faloo\\.com/\\d+_\\d+\\.html" },
			content: { selector: ".noveContent" },
			navigation: {
				prev: "#pre_page, a:contains(\"上一章\")",
				next: "#next_page, a:contains(\"下一章\")",
				index: "#huimulu, a:contains(\"目录\")"
			},
			toc: { excludeAncestors: ".c_con_relation" },
			title: {
				selector: ".c_l_title > h1, h1",
				bookSelector: "#novelName",
				replace: "^\\s*\\S+\\s+"
			},
			meta: {
				source: "builtin",
				exampleUrl: "https://b.faloo.com/412421_1.html"
			}
		},
		{
			id: "kanunu8",
			name: "努努书坊",
			version: 1,
			match: { pattern: "^https?://www\\.kanunu8\\.com/.+/\\d+\\.html$" },
			content: { selector: "td[width=\"820\"] > p, td[width=\"820\"] p" },
			navigation: {
				prev: "table[width=\"700\"] td:first-child a",
				index: "table[width=\"700\"] td:nth-child(2) a",
				next: "table[width=\"700\"] td:last-child a"
			},
			title: { selector: "font[color=\"#dc143c\"][size=\"4\"]" },
			toc: { excludeAncestors: "#header, .nav, .nav2, td[bgcolor=\"#A5BDC6\"], td[bgcolor=\"#CEDFE5\"]" },
			advanced: { noSection: true },
			meta: {
				source: "builtin",
				exampleUrl: "https://www.kanunu8.com/book3/7748/170164.html"
			}
		}
	];
	var builtInRules = [
		...siteRules,
		...specialRules,
		...simplifiedRules
	];
	function globToRegex(glob) {
		const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
		return new RegExp(`^${escaped}$`, "i");
	}
	function toRegExp(pattern, type = "regex") {
		if (type === "glob") return globToRegex(pattern);
		return new RegExp(pattern, "i");
	}
	var RuleManager = class {
		constructor() {
			this.builtInRules = builtInRules;
			this.compiledCache = new WeakMap();
			this.sectionUrlParsers = this.builtInRules.flatMap((rule) => rule.hooks?.parseSectionUrl ? [rule.hooks.parseSectionUrl] : []);
			this.chapterUrlNormalizers = this.builtInRules.flatMap((rule) => rule.hooks?.normalizeChapterUrl ? [rule.hooks.normalizeChapterUrl] : []);
			this.entryResolvers = this.builtInRules.flatMap((rule) => rule.hooks?.resolveEntryUrl ? [rule.hooks.resolveEntryUrl] : []);
			this.vipClassifiers = [...new Set(this.builtInRules.flatMap((rule) => rule.hooks?.isVipChapter ? [rule.hooks.isVipChapter] : []))];
			this.parseSectionUrl = (url) => {
				for (const parse of this.sectionUrlParsers) {
					const parsed = parse(url);
					if (parsed) return parsed;
				}
				return null;
			};
		}
		isVipChapter(doc, url) {
			for (const classify of this.vipClassifiers) {
				const result = classify(doc, url);
				if (result !== null) return result;
			}
			return null;
		}
		normalizeChapterUrl(url) {
			for (const normalize of this.chapterUrlNormalizers) {
				const normalized = normalize(url);
				if (normalized) return normalized;
			}
			return url;
		}
		resolveEntryUrl(doc, url) {
			for (const resolve of this.entryResolvers) {
				const resolved = resolve(doc, url);
				if (resolved) return resolved;
			}
			return null;
		}
		matchRule(url) {
			for (const rule of this.builtInRules) if (this.matchesUrl(rule, url)) return {
				rule,
				source: "builtin",
				matchedPattern: rule.match.pattern
			};
			return null;
		}
		getCompiledRule(rule) {
			const cached = this.compiledCache.get(rule);
			if (cached) return cached;
			const compiled = {
				main: toRegExp(rule.match.pattern, rule.match.type),
				excludes: (rule.match.exclude ?? []).map((e) => new RegExp(e, "i"))
			};
			this.compiledCache.set(rule, compiled);
			return compiled;
		}
		matchesUrl(rule, url) {
			try {
				const { main, excludes } = this.getCompiledRule(rule);
				if (!main.test(url)) return false;
				for (const exclude of excludes) if (exclude.test(url)) return false;
				return true;
			} catch (e) {
				console.debug("[RuleManager] Rule match error for pattern:", rule.match.pattern, e);
				return false;
			}
		}
	};
	var ruleManagerInstance = null;
	function getRuleManager() {
		if (!ruleManagerInstance) ruleManagerInstance = new RuleManager();
		return ruleManagerInstance;
	}
	var parseSectionUrl = (url) => getRuleManager().parseSectionUrl(url);
	var getDocumentKey = (url, base) => getRuleManager().normalizeChapterUrl(normalizeAbsoluteUrl(url, base));
	var SECTION_TOTAL_PATTERN = /[（(]\s*(?:第\s*)?(\d+)\s*[/／]\s*(\d+)\s*(?:页|頁)?\s*[）)]/;
	var SectionMerger = class {
		constructor(parser) {
			this.parser = parser;
		}
		async merge(doc, url, options = {}) {
			const confidenceThreshold = options.confidenceThreshold ?? .8;
			if (options.signal?.aborted) return null;
			const entryUrl = getRuleManager().resolveEntryUrl(doc, url);
			if (entryUrl) {
				const entryChapter = await this.parser.parse(doc, entryUrl);
				if (entryChapter) return entryChapter;
			}
			const startPage = await this.resolveStartPage(doc, url, options);
			if (!startPage) return null;
			const first = await this.parser.parse(startPage.doc, startPage.url);
			if (!first) return null;
			const state = this.decideSectionMerge(startPage, first, confidenceThreshold, !!options.fetcher);
			if (state.kind === "done") return state.chapter;
			const maxPages = Math.max(1, options.maxPages ?? first.rule?.advanced?.sectionMaxPages ?? 10);
			const progressive = !!state.nextSectionUrl && maxPages > 1;
			const marker = this.readSectionMarker(startPage.doc);
			const totalPages = marker?.page === 1 ? marker.total : void 0;
			if (progressive) {
				await options.onFirstPage?.({
					...first,
					url: state.chapterUrl,
					nextUrl: state.nextChapterUrl || void 0
				}, {
					url: state.chapterUrl,
					loaded: 1,
					total: totalPages
				});
				if (options.signal?.aborted) return null;
			}
			return this.mergeSections(startPage, first, state, maxPages, options, progressive, totalPages);
		}
		async resolveStartPage(doc, url, options) {
			if (options.signal?.aborted) return null;
			let startUrl = url;
			let startDoc = doc;
			const knownDocs = new Map([[getDocumentKey(url, url), doc]]);
			const baseUrl = getSectionBaseUrl(url, parseSectionUrl);
			if (baseUrl && baseUrl !== url) {
				const baseDoc = await this.fetchUrl(baseUrl, url, options.fetcher, options.signal);
				if (options.signal?.aborted) return null;
				if (baseDoc) {
					startUrl = baseUrl;
					startDoc = baseDoc;
					knownDocs.set(getDocumentKey(baseUrl, url), baseDoc);
				}
			}
			return {
				doc: startDoc,
				url: startUrl,
				knownDocs
			};
		}
		decideSectionMerge(startPage, first, confidenceThreshold, hasCustomFetcher) {
			if (first.rule?.advanced?.noSection) return {
				kind: "done",
				chapter: first
			};
			const enableByRule = !!first.rule?.advanced?.checkSection;
			const section = this.parser.detectSection(startPage.doc, startPage.url);
			const hasNextSectionUrl = !!section?.isSection && !!section.nextSectionUrl;
			if (!(enableByRule || !!section?.isSection && (section.confidence || 0) >= confidenceThreshold)) {
				if (!hasNextSectionUrl && first.nextUrl && isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl)) {
					const realNextChapterUrl = this.findNextChapterUrl(startPage.doc, startPage.url);
					if (realNextChapterUrl) return {
						kind: "done",
						chapter: {
							...first,
							nextUrl: realNextChapterUrl
						}
					};
				}
				return {
					kind: "done",
					chapter: first
				};
			}
			const nextSectionUrl = section?.nextSectionUrl || (first.nextUrl && isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl) ? first.nextUrl : null);
			return {
				kind: "merge",
				chapterUrl: this.getChapterUrl(startPage.url, nextSectionUrl),
				nextSectionUrl,
				nextChapterUrl: section?.nextChapterUrl || (first.nextUrl && !isSectionLikeUrl(startPage.url, first.nextUrl, parseSectionUrl) ? first.nextUrl : null),
				sectionDelayMs: hasCustomFetcher ? 0 : Math.max(0, first.rule?.advanced?.sectionDelayMs ?? 0)
			};
		}
		readSectionMarker(doc) {
			for (const source of [doc.title, doc.querySelector("h1")?.textContent]) {
				const match = source?.match(SECTION_TOTAL_PATTERN);
				if (!match) continue;
				const page = Number(match[1]);
				const total = Number(match[2]);
				if (Number.isSafeInteger(total) && page >= 1 && page <= total) return {
					page,
					total
				};
			}
		}
		isTruncatedMerge(cursor, signal) {
			return !!cursor.nextSectionUrl || !!signal?.aborted || cursor.totalPages !== void 0 && cursor.loadedPages < cursor.totalPages;
		}
		getChapterUrl(startUrl, nextSectionUrl) {
			if (!nextSectionUrl || !isSectionLikeUrl(startUrl, nextSectionUrl, parseSectionUrl)) return startUrl;
			try {
				const start = new URL(startUrl);
				const next = new URL(nextSectionUrl, startUrl);
				const startParams = Array.from(start.searchParams.entries());
				const nextParams = Array.from(next.searchParams.entries());
				if (startParams.length === 1 && nextParams.length === 1 && startParams[0][0].toLowerCase() === nextParams[0][0].toLowerCase() && startParams[0][1] === "1" && nextParams[0][1] === "2") {
					start.search = "";
					return start.toString();
				}
			} catch {}
			return startUrl;
		}
		async mergeSections(startPage, first, state, maxPages, options, progressive, totalPages) {
			const { fetcher, signal } = options;
			const cursor = this.createMergeCursor(startPage, first, state, maxPages);
			cursor.totalPages = totalPages;
			while (cursor.remainingPages > 0 && cursor.nextSectionUrl) {
				if (signal?.aborted) break;
				if (state.sectionDelayMs > 0) {
					await this.sleep(state.sectionDelayMs, signal);
					if (signal?.aborted) break;
				}
				const page = await this.loadNextSectionPage(cursor, startPage.knownDocs, fetcher, signal);
				if (!page) break;
				const nextParsed = await this.parseLoadedSection(page, cursor.lastUrl, startPage.knownDocs, fetcher, signal);
				if (signal?.aborted || !nextParsed) break;
				const marker = this.readSectionMarker(page.doc);
				if (marker && (marker.page !== cursor.loadedPages + 1 || cursor.totalPages !== void 0 && marker.total !== cursor.totalPages)) break;
				const section = this.parser.detectSection(page.doc, page.url);
				this.advanceMergeCursor(cursor, page.url, nextParsed, section);
				cursor.remainingPages -= 1;
				cursor.loadedPages += 1;
				cursor.totalPages ??= marker?.total;
				if (progressive) await options.onSectionPage?.({
					content: nextParsed.content,
					rawContent: nextParsed.rawContent,
					sourceScript: cursor.sourceScript,
					nextUrl: cursor.nextChapterUrl || void 0
				}, {
					url: cursor.chapterUrl,
					loaded: cursor.loadedPages,
					total: cursor.totalPages
				});
			}
			options.onMergeEnd?.({
				loaded: cursor.loadedPages,
				total: cursor.totalPages,
				truncated: this.isTruncatedMerge(cursor, signal)
			});
			return this.buildMergedChapter(first, cursor);
		}
		createMergeCursor(startPage, first, state, maxPages) {
			return {
				chapterUrl: state.chapterUrl,
				lastUrl: startPage.url,
				mergedContent: first.content,
				mergedRaw: first.rawContent,
				nextSectionUrl: state.nextSectionUrl,
				nextChapterUrl: state.nextChapterUrl,
				seen: new Set([getDocumentKey(startPage.url, startPage.url)]),
				remainingPages: Math.max(0, maxPages - 1),
				loadedPages: 1,
				sourceScript: first.sourceScript
			};
		}
		async loadNextSectionPage(cursor, knownDocs, fetcher, signal) {
			if (signal?.aborted || !cursor.nextSectionUrl) return null;
			const url = normalizeAbsoluteUrl(cursor.nextSectionUrl, cursor.lastUrl);
			const key = getDocumentKey(url, cursor.lastUrl);
			if (cursor.seen.has(key)) return null;
			cursor.seen.add(key);
			const cachedDoc = knownDocs.get(key) ?? null;
			if (cachedDoc) return {
				doc: cachedDoc,
				url,
				fromCache: true
			};
			const doc = await this.fetchUrl(url, cursor.lastUrl, fetcher, signal);
			if (!doc) return null;
			knownDocs.set(key, doc);
			return {
				doc,
				url,
				fromCache: false
			};
		}
		async parseLoadedSection(page, referrer, knownDocs, fetcher, signal) {
			let parsed = await this.parser.parse(page.doc, page.url);
			if (parsed || !page.fromCache || signal?.aborted) return parsed;
			const doc = await this.fetchUrl(page.url, referrer, fetcher, signal);
			if (!doc) return null;
			knownDocs.set(getDocumentKey(page.url, referrer), doc);
			page.doc = doc;
			parsed = await this.parser.parse(doc, page.url);
			return parsed;
		}
		advanceMergeCursor(cursor, pageUrl, parsed, section) {
			cursor.mergedContent = joinHtml(cursor.mergedContent, parsed.content);
			cursor.mergedRaw = joinHtml(cursor.mergedRaw, parsed.rawContent);
			cursor.sourceScript = this.mergeSourceScript(cursor.sourceScript, parsed.sourceScript);
			if (section?.nextChapterUrl) cursor.nextChapterUrl = section.nextChapterUrl;
			cursor.nextSectionUrl = section?.nextSectionUrl || null;
			if (!cursor.nextSectionUrl && parsed.nextUrl) {
				if (isSectionLikeUrl(pageUrl, parsed.nextUrl, parseSectionUrl)) cursor.nextSectionUrl = parsed.nextUrl;
				else if (!cursor.nextChapterUrl) cursor.nextChapterUrl = parsed.nextUrl;
			}
			cursor.lastUrl = pageUrl;
		}
		buildMergedChapter(first, cursor) {
			return {
				...first,
				url: cursor.chapterUrl,
				content: cursor.mergedContent,
				rawContent: cursor.mergedRaw,
				nextUrl: cursor.nextChapterUrl || void 0,
				sourceScript: cursor.sourceScript
			};
		}
		mergeSourceScript(current, next) {
			if (!next || next === "unknown") return current;
			if (!current || current === "unknown") return next;
			if (current === next) return current;
			return "mixed";
		}
		async sleep(ms, signal) {
			if (ms <= 0 || signal?.aborted) return;
			await new Promise((resolve) => {
				const timer = globalThis.setTimeout(resolve, ms);
				if (!signal) return;
				signal.addEventListener("abort", () => {
					globalThis.clearTimeout(timer);
					resolve();
				}, { once: true });
			});
		}
		async fetchUrl(url, referrer, customFetcher, signal) {
			if (signal?.aborted) return null;
			if (customFetcher) return await customFetcher(url, referrer);
			const { promise, abort } = fetchAndParseUrl(url, referrer);
			if (!signal) return (await promise).doc;
			if (signal.aborted) {
				abort();
				return null;
			}
			let abortListener = null;
			const abortPromise = new Promise((resolve) => {
				abortListener = () => {
					abort();
					resolve({
						doc: null,
						status: null,
						finalUrl: null,
						error: "abort"
					});
				};
				signal.addEventListener("abort", abortListener, { once: true });
			});
			try {
				return (await Promise.race([promise, abortPromise])).doc;
			} finally {
				if (abortListener) signal.removeEventListener("abort", abortListener);
			}
		}
		findNextChapterUrl(doc, currentUrl) {
			const links = doc.querySelectorAll("a[href]");
			const candidates = [];
			for (const link of links) {
				const anchor = link;
				const href = anchor.getAttribute("href");
				if (!href) continue;
				const absUrl = normalizeAbsoluteUrl(href, currentUrl);
				if (absUrl === currentUrl || isSectionLikeUrl(currentUrl, absUrl, parseSectionUrl)) continue;
				const text = anchor.textContent?.trim() || "";
				if (!text) continue;
				const normalizedText = text.replace(/\s+/g, "").trim();
				if (!normalizedText) continue;
				const lowerText = normalizedText.toLowerCase();
				if (!(/下一/.test(normalizedText) || /下[章节篇话]/.test(normalizedText) || /后一章/.test(normalizedText) || /继续阅读/.test(normalizedText) || /next/i.test(normalizedText))) continue;
				const isChapterText = CHAPTER_TEXT_PATTERNS.some((p) => p.test(text));
				const isSectionText = SECTION_TEXT_PATTERNS.some((p) => p.test(text)) || lowerText.includes("next") && lowerText.includes("page") && !lowerText.includes("chapter");
				const isEnglishNextChapter = lowerText.includes("next") && lowerText.includes("chapter");
				if (isSectionText && !isChapterText && !isEnglishNextChapter) continue;
				let score = 0;
				if (isChapterText) score += 50;
				if (isEnglishNextChapter) score += 45;
				if (lowerText === "next" || lowerText === ">" || lowerText === "»") score += 10;
				if (lowerText.includes("next")) score += 2;
				if (normalizedText.length <= 5) score += 1;
				if ((anchor.getAttribute("rel") || "").toLowerCase().includes("next")) score += 2;
				if (score > 0) candidates.push({
					url: absUrl,
					score
				});
			}
			if (candidates.length === 0) return null;
			candidates.sort((a, b) => b.score - a.score);
			return candidates[0].url;
		}
	};
	function createSectionMerger(parser) {
		return new SectionMerger(parser);
	}
	async function streamSectionMerge(merger, doc, url, signal, first) {
		const target = {};
		let truncated = false;
		try {
			const chapter = await merger.merge(doc, url, {
				signal,
				onFirstPage: async (chapter, progress) => {
					target.delivery = await first(chapter, progress) || void 0;
				},
				onSectionPage: async (delta, progress) => {
					await target.delivery?.({
						stage: "append",
						delta,
						progress
					});
				},
				onMergeEnd: (end) => {
					truncated = end.truncated;
				}
			});
			if (!chapter || signal.aborted) {
				await target.delivery?.({
					stage: "cancel",
					reason: signal.aborted ? "aborted" : "failed"
				});
				return null;
			}
			await target.delivery?.({
				stage: "complete",
				chapter,
				rule: chapter.rule,
				truncated
			});
			return truncated && !target.delivery ? null : chapter;
		} catch (error) {
			await target.delivery?.({
				stage: "cancel",
				reason: "failed"
			});
			throw error;
		}
	}
	var DEFAULT_THRESHOLD = .6;
	var DEFAULT_WEIGHTS = {
		content: .5,
		navigation: .3,
		title: .2
	};
	var ConfidenceScorer = class {
		constructor(threshold = DEFAULT_THRESHOLD, weights = DEFAULT_WEIGHTS) {
			this.threshold = threshold;
			this.weights = weights;
		}
		score(results) {
			const contentScore = results.content.confidence;
			const navigationScore = this.scoreNavigation(results.navigation);
			const titleScore = results.title.confidence;
			const overall = contentScore * this.weights.content + navigationScore * this.weights.navigation + titleScore * this.weights.title;
			const reasons = this.generateReasons(results, {
				content: contentScore,
				navigation: navigationScore,
				title: titleScore
			});
			return {
				overall,
				content: contentScore,
				navigation: navigationScore,
				title: titleScore,
				isReliable: overall >= this.threshold,
				reasons
			};
		}
		scoreNavigation(nav) {
			let score = 0;
			let count = 0;
			if (nav.next) {
				score += nav.next.confidence * 1.5;
				count += 1.5;
			} else return .2;
			if (nav.prev) {
				score += nav.prev.confidence;
				count++;
			}
			if (nav.index) {
				score += nav.index.confidence * .5;
				count += .5;
			}
			return count > 0 ? score / count : 0;
		}
		generateReasons(results, scores) {
			const reasons = [];
			if (scores.content > .8) reasons.push("找到清晰的内容区域");
			else if (scores.content > .5) reasons.push("找到可能的内容区域");
			else if (scores.content > 0) reasons.push("内容区域检测不确定");
			else reasons.push("未找到内容区域");
			if (results.navigation.next) reasons.push("找到下一章链接");
			else reasons.push("未找到下一章链接");
			if (results.navigation.prev) reasons.push("找到上一章链接");
			if (results.navigation.index) reasons.push("找到目录链接");
			if (scores.title > .7) reasons.push(`检测到章节标题: "${results.title.chapterTitle.substring(0, 20)}..."`);
			else if (scores.title > .4) reasons.push("章节标题检测不确定");
			if (results.title.bookTitle) reasons.push(`书名: ${results.title.bookTitle}`);
			return reasons;
		}
		createSummary(report) {
			return `检测置信度: ${Math.round(report.overall * 100)}% (${report.isReliable ? "可信" : "不确定"})`;
		}
	};
	var KNOWN_CONTENT_SELECTORS = [
		"#pagecontent",
		"#contentbox",
		"#bmsy_content",
		"#bookpartinfo",
		"#htmlContent",
		"#text_area",
		"#chapter_content",
		"#chapterContent",
		"#chaptercontent",
		"#partbody",
		"#BookContent",
		"#read-content",
		"#article_content",
		"#article-content",
		"#BookTextRead",
		"#booktext",
		"#book_text",
		"#BookText",
		"#BookTextt",
		"#readtext",
		"#readcon",
		"#read",
		"#TextContent",
		"#txtContent",
		"#text_c",
		"#txt_td",
		"#TXT",
		"#txt",
		"#zjneirong",
		"#contentTxt",
		"#oldtext",
		"#a_content",
		"#contents",
		"#content2",
		"#contentts",
		"#content1",
		"#content",
		"#booktxt",
		"#nr",
		"#rtext",
		"#articlecontent",
		"#novelcontent",
		"#text-content",
		"#articlebody",
		"#ChapterContents",
		"#acontent",
		"#chapterinfo",
		"#read_content",
		"#chapter-content",
		"#readerFt",
		"#partContent",
		"#ChapterBody",
		"#showcontent",
		"#luf_news_contents",
		"#tt_text",
		"#J_BookRead",
		"#zjny",
		"#cont-body",
		"#Lab_Contents",
		"#auto-chapter",
		"#readpage_leftntxt",
		".novel_content",
		".readmain_inner",
		".noveltext",
		".booktext",
		".yd_text2",
		".articlecontent",
		".readcontent",
		".txtnav",
		".content",
		".art_con",
		".article",
		".read-content",
		".bookreadercontent",
		".novelbody",
		".chapter-item",
		".noveContent",
		".con",
		".Text",
		".TxtContent",
		".article-content",
		".nvl-content",
		".box_box",
		".txt_tcontent",
		".story_content",
		".chapter_content",
		".chapter-box",
		"article"
	];
	var NAV_PATTERNS = {
		next: [
			/下一[页頁章节節篇话話]/,
			/下[页頁章节節话話]/,
			/next/i,
			/^\s*>\s*$/,
			/翻下[页頁]/,
			/[后後]一章/,
			/[继繼][续續][阅閱][读讀]/,
			/下篇/,
			/[后後]篇/
		],
		prev: [
			/上一[页頁章节節篇话話]/,
			/上[页頁章节節话話]/,
			/prev/i,
			/^\s*<\s*$/,
			/翻上[页頁]/,
			/前一章/,
			/上篇/,
			/前篇/
		],
		index: [
			/^目[录錄]$/,
			/章[节節]目[录錄]/,
			/章[节節]列表/,
			/返回目[录錄]/,
			/回目[录錄]/,
			/回[书書]目/,
			/[书書]目/,
			/[书書][页頁]/,
			/index/i,
			/catalog/i
		]
	};
	var TITLE_PATTERN = /第?\s*[一二两三四五六七八九十○零百千万亿0-9１２３４５６７８９０〇]{1,6}\s*[章回卷节折篇幕集话話]|序章|楔子|番外|后记|尾声|前言|引子|Chapter\s*\d+/i;
	var POSITIVE_PATTERNS = [/^(content|chapter|article|text|body|main|read|book|novel)/i, /内容|正文|章节|小说|阅读/];
	var NEGATIVE_PATTERNS = [/^(nav|header|footer|sidebar|menu|ad|comment|discuss|recommend)/i, /(广告|评论|推荐|相关|热门|排行|导航|页眉|页脚)/];
	var WEIGHTS = {
		CONTENT_ID_CLASS: 25,
		ARTICLE_TAG: 15,
		HIGH_TEXT_DENSITY: 20,
		PARAGRAPH_COUNT: 10,
		CHINESE_RATIO: 15,
		TEXT_LENGTH_BONUS: 20,
		NAV_HEADER_FOOTER: -25,
		AD_CLASS: -30,
		COMMENT_CLASS: -20,
		HIGH_LINK_DENSITY: -20
	};
	var MIN_TEXT_LENGTH = 500;
	var MIN_CHINESE_RATIO = .3;
	function compileKnownContentSelector(selector) {
		if (/^#[A-Za-z0-9_-]+$/.test(selector)) return {
			selector,
			type: "id",
			name: selector.slice(1)
		};
		if (/^\.[A-Za-z0-9_-]+$/.test(selector)) return {
			selector,
			type: "class",
			name: selector.slice(1)
		};
		if (/^[A-Za-z][A-Za-z0-9-]*$/.test(selector)) return {
			selector,
			type: "tag",
			name: selector
		};
		return {
			selector,
			type: "complex"
		};
	}
	var KNOWN_CONTENT_SELECTOR_ENTRIES = KNOWN_CONTENT_SELECTORS.map(compileKnownContentSelector);
	function isWhitespaceCode(code) {
		return code >= 9 && code <= 13 || code === 32 || code === 160 || code === 5760 || code >= 8192 && code <= 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279;
	}
	var ContentDetector = class {
		detect(doc) {
			const selectorResult = this.tryKnownSelectors(doc);
			if (selectorResult) return selectorResult;
			const scored = this.scoreCandidates(doc);
			if (scored.length === 0) return this.createEmptyResult();
			scored.sort((a, b) => b.score - a.score);
			const best = scored[0];
			if (best.score < 10 || best.textLength < MIN_TEXT_LENGTH) return this.createEmptyResult();
			return {
				element: best.element,
				selector: this.generateSelector(best.element),
				confidence: this.normalizeScore(best.score),
				method: "heuristic",
				preview: this.getPreview(best.element)
			};
		}
		tryKnownSelectors(doc) {
			for (const entry of KNOWN_CONTENT_SELECTOR_ENTRIES) {
				const el = this.resolveKnownSelector(doc, entry);
				if (!el) continue;
				if (!this.isVisibleContentElement(el, true)) continue;
				const isValidContent = this.isValidContent(el);
				const isPKeyLoadMoreContent = !isValidContent && this.isPKeyLoadMoreContent(el, doc);
				if (isValidContent || isPKeyLoadMoreContent) return {
					element: el,
					selector: entry.selector,
					confidence: isValidContent ? .9 : .78,
					method: "selector",
					preview: this.getPreview(el)
				};
			}
			return null;
		}
		resolveKnownSelector(doc, entry) {
			try {
				if (entry.type === "id") return doc.getElementById(entry.name);
				if (entry.type === "class") return doc.getElementsByClassName(entry.name).item(0);
				if (entry.type === "tag") return doc.getElementsByTagName(entry.name).item(0);
				return doc.querySelector(entry.selector);
			} catch {
				return null;
			}
		}
		isPKeyLoadMoreContent(element, doc) {
			const rawText = (element.textContent || "").replace(/\s+/g, "").trim();
			if (!rawText) return false;
			const normalized = rawText.replace(/[|｜]/g, "");
			const hasLoadMore = normalized.includes("加载更多");
			const hasBlockedHint = normalized.includes("无法显示本章节全部内容") || normalized.includes("阅读模式") && normalized.includes("无法显示");
			if (!hasLoadMore && !hasBlockedHint) return false;
			return this.hasInlinePKeyDeclaration(doc);
		}
		hasInlinePKeyDeclaration(doc) {
			for (const script of doc.querySelectorAll("script")) {
				const text = script.textContent || "";
				if (!text || !text.includes("p_key")) continue;
				if (/\bp_key\s*=\s*(['"])[A-Za-z0-9+/=]*\1/.test(text)) return true;
			}
			return false;
		}
		scoreCandidates(doc) {
			const containers = doc.querySelectorAll("div, article, section, main, td");
			const candidates = [];
			for (const element of containers) {
				let score = 0;
				const text = element.textContent || "";
				const textLength = text.length;
				if (textLength < MIN_TEXT_LENGTH) continue;
				const idClass = ((element.id || "") + " " + (element.className || "")).toLowerCase();
				if (this.isNavigationElement(element, idClass)) continue;
				if (!this.isVisibleContentElement(element)) continue;
				const htmlLength = element.innerHTML.length;
				const textDensity = textLength / Math.max(htmlLength, 1);
				const chineseRatio = this.calculateChineseRatio(text);
				const linkDensity = this.calculateLinkDensity(element, textLength);
				const paragraphCount = element.querySelectorAll("p, br").length;
				if (POSITIVE_PATTERNS.some((p) => p.test(idClass))) score += WEIGHTS.CONTENT_ID_CLASS;
				const tagName = element.tagName.toUpperCase();
				if (tagName === "ARTICLE" || tagName === "MAIN") score += WEIGHTS.ARTICLE_TAG;
				if (textDensity > .5) score += WEIGHTS.HIGH_TEXT_DENSITY;
				if (paragraphCount > 3) score += WEIGHTS.PARAGRAPH_COUNT;
				if (chineseRatio > .7) score += WEIGHTS.CHINESE_RATIO;
				if (NEGATIVE_PATTERNS.some((p) => p.test(idClass))) score += WEIGHTS.NAV_HEADER_FOOTER;
				if (/ad|sponsor|banner|promo/i.test(idClass)) score += WEIGHTS.AD_CLASS;
				if (/comment|discuss|reply/i.test(idClass)) score += WEIGHTS.COMMENT_CLASS;
				if (linkDensity > .3) score += WEIGHTS.HIGH_LINK_DENSITY;
				score += Math.min(textLength / 1e3, WEIGHTS.TEXT_LENGTH_BONUS);
				candidates.push({
					element,
					score,
					textLength,
					linkDensity,
					chineseRatio
				});
			}
			return candidates;
		}
		isValidContent(element) {
			const text = element.textContent || "";
			if (text.length < MIN_TEXT_LENGTH) return false;
			if (this.calculateChineseRatio(text) < MIN_CHINESE_RATIO) return false;
			if (this.calculateLinkDensity(element, text.length) > .5) return false;
			return true;
		}
		isVisibleContentElement(element, checkAncestors = false) {
			const doc = element.ownerDocument;
			const win = doc.defaultView;
			let current = element;
			while (current) {
				if (current.hidden) return false;
				try {
					const style = win ? win.getComputedStyle(current) : current.style;
					if (style?.display === "none") return false;
					if (style?.visibility === "hidden" || style?.visibility === "collapse") return false;
				} catch {}
				if (!checkAncestors || current === doc.body || current === doc.documentElement) break;
				current = current.parentElement;
			}
			return true;
		}
		isNavigationElement(element, idClass) {
			const tagName = element.tagName.toUpperCase();
			if ([
				"NAV",
				"HEADER",
				"FOOTER",
				"ASIDE"
			].includes(tagName)) return true;
			const names = idClass ?? ((element.id || "") + " " + (element.className || "")).toLowerCase();
			return /nav|menu|sidebar|footer|header/.test(names);
		}
		calculateLinkDensity(element, totalTextLength) {
			const links = element.querySelectorAll("a");
			let linkText = 0;
			for (const link of links) linkText += link.textContent?.length || 0;
			const totalText = totalTextLength || element.textContent?.length || 1;
			return linkText / totalText;
		}
		calculateChineseRatio(text) {
			let chineseChars = 0;
			let nonWhitespace = 0;
			for (let index = 0; index < text.length; index++) {
				const code = text.charCodeAt(index);
				if (code >= 19968 && code <= 40959) chineseChars += 1;
				if (!isWhitespaceCode(code)) nonWhitespace += 1;
			}
			return chineseChars / Math.max(nonWhitespace, 1);
		}
		generateSelector(element) {
			return generateCssSelector(element);
		}
		normalizeScore(score) {
			return Math.min(Math.max(score / 100, 0), 1);
		}
		getPreview(element) {
			const text = element.textContent || "";
			return text.trim().substring(0, 200) + (text.length > 200 ? "..." : "");
		}
		createEmptyResult() {
			return {
				element: null,
				selector: "",
				confidence: 0,
				method: "fallback"
			};
		}
	};
	var INVALID_URL_PATTERNS = [
		/(?:index|list|last|LastPage|end)\.(?:html?|php|aspx)/i,
		/^javascript:/i,
		/BuyChapterUnLogin/i,
		/\/0\.html$/i,
		/\/chapter\/get_par_tsu_list(?:$|[/?#])/i,
		/\/chapter\/ajax_get_session_code(?:$|[/?#])/i,
		/\/chapter\/get_book_chapter_detail_info(?:$|[/?#])/i,
		/^https?:\/\/[^/]+\/?$/i,
		/^https?:\/\/[^/]+\/(?:index|home|main)?\.?(?:html?|php|aspx)?$/i,
		/^https?:\/\/[^/]+\/\?/i
	];
	var NAV_PURPOSES = [
		"next",
		"prev",
		"index"
	];
	function normalizeLinkText(text) {
		return text.replace(/\s+/g, "").trim();
	}
	function resolveLinkTarget(anchor, baseUrl) {
		const rawHref = anchor.getAttribute("href");
		if (!rawHref) return null;
		let parsedUrl;
		try {
			parsedUrl = new URL(rawHref, baseUrl);
		} catch {
			return null;
		}
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return null;
		return {
			href: parsedUrl.toString(),
			url: parsedUrl
		};
	}
	function isValidSignalLink(signal, purpose, currentUrl) {
		const { href, text, url: parsedUrl } = signal;
		for (const pattern of INVALID_URL_PATTERNS) if (pattern.test(href)) {
			if (purpose === "index") {
				const looksLikeIndex = NAV_PATTERNS.index.some((p) => p.test(text));
				const looksLikeBookTitle = /^《.+》$/.test(text);
				if (looksLikeIndex || looksLikeBookTitle) continue;
			}
			return false;
		}
		if (href.includes("#") && !href.includes("#chapter")) try {
			const currentPathname = new URL(currentUrl).pathname;
			if (parsedUrl.pathname === currentPathname) return false;
		} catch {}
		try {
			const pathname = parsedUrl.pathname;
			if (pathname === "/" || pathname.length < 3) {
				if (purpose === "index" && pathname.length >= 3) {
					if (/^《.+》$/.test(text)) return true;
				}
				return false;
			}
			const pathParts = pathname.split("/").filter(Boolean);
			if (pathParts.length < 2) {
				const part = pathParts[0] || "";
				if (!/\d/.test(part)) {
					if (!(NAV_PATTERNS[purpose].some((p) => p.test(text)) || CHAPTER_TEXT_PATTERNS.some((p) => p.test(text)) || SECTION_TEXT_PATTERNS.some((p) => p.test(text)))) return false;
				}
			}
			if (purpose === "index" && pathname.endsWith("/")) return true;
			for (const pattern of [/^\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)/i, /^\/(?:book|novel|xiaoshuo|info)\/?\d*\/?$/i]) if (pattern.test(pathname)) return false;
		} catch {}
		return true;
	}
	var NavigationDetector = class {
		constructor() {
			this._lastSignals = [];
			this._lastBaseUrl = "";
		}
		resolveBaseUrl(doc, currentUrl) {
			const candidates = [
				currentUrl,
				doc.location?.href,
				doc._mnrUrl,
				typeof window !== "undefined" ? window.location.href : void 0
			];
			for (const candidate of candidates) {
				if (!candidate) continue;
				try {
					const u = new URL(candidate);
					if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
				} catch {}
			}
			return candidates.find(Boolean) || "";
		}
		resolveLinkTarget(anchor, baseUrl) {
			return resolveLinkTarget(anchor, baseUrl);
		}
		collectLinkSignals(doc, baseUrl) {
			const anchors = doc.querySelectorAll("a[href]");
			const signals = [];
			for (const anchor of anchors) {
				const target = this.resolveLinkTarget(anchor, baseUrl);
				if (!target) continue;
				const text = anchor.textContent?.trim() || "";
				const title = anchor.title || "";
				signals.push({
					anchor,
					href: target.href,
					url: target.url,
					text,
					normalizedText: normalizeLinkText(text),
					title,
					rel: (anchor.getAttribute("rel") || "").toLowerCase()
				});
			}
			return signals;
		}
		detect(doc, currentUrl) {
			const resolvedCurrentUrl = this.resolveBaseUrl(doc, currentUrl);
			const signals = this.collectLinkSignals(doc, resolvedCurrentUrl);
			this._lastSignals = signals;
			this._lastBaseUrl = resolvedCurrentUrl;
			const candidates = this.scoreNavigationLinks(signals, resolvedCurrentUrl);
			return {
				next: this.pickNavLink(candidates.next),
				prev: this.pickNavLink(candidates.prev),
				index: this.pickNavLink(candidates.index)
			};
		}
		scoreNavigationLinks(signals, currentUrl) {
			const candidates = {
				next: [],
				prev: [],
				index: []
			};
			for (const signal of signals) for (const type of NAV_PURPOSES) {
				const candidate = this.scoreSignalForNav(signal, type, currentUrl);
				if (candidate) candidates[type].push(candidate);
			}
			return candidates;
		}
		scoreSignalForNav(signal, type, currentUrl) {
			const patterns = NAV_PATTERNS[type];
			if (type !== "index" && signal.rel === type && isValidSignalLink(signal, type, currentUrl)) return {
				element: signal.anchor,
				href: signal.href,
				score: 1e3,
				confidence: .95,
				method: "rel-attribute",
				text: signal.text
			};
			let score = 0;
			let matchedTextPattern = false;
			for (const pattern of patterns) if (pattern.test(signal.text)) {
				matchedTextPattern = true;
				score += 10;
				if (signal.text.length <= 5) score += 5;
			}
			if ((type === "next" || type === "prev") && matchedTextPattern) {
				const isChapter = CHAPTER_TEXT_PATTERNS.some((p) => p.test(signal.text));
				const isSection = SECTION_TEXT_PATTERNS.some((p) => p.test(signal.text));
				if (isChapter) score += 3;
				if (isSection && !isChapter) score -= 2;
			}
			if (type === "index") {
				if (/^《.+》$/.test(signal.text)) score += 8;
				if (signal.href.endsWith("/") || /\/index\.html?$/i.test(signal.href)) score += 3;
			}
			if (signal.title) {
				for (const pattern of patterns) if (pattern.test(signal.title)) score += 5;
			}
			if (signal.text.length > 20) score -= 5;
			if (score <= 0) return null;
			if (!isValidSignalLink(signal, type, currentUrl)) return null;
			return {
				element: signal.anchor,
				score: score + this.getPositionBonus(signal.anchor),
				text: signal.text,
				href: signal.href,
				method: "text-matching"
			};
		}
		pickNavLink(candidates) {
			if (candidates.length === 0) return null;
			candidates.sort((a, b) => b.score - a.score);
			const best = candidates[0];
			return {
				element: best.element,
				url: best.href,
				selector: this.generateSelector(best.element),
				confidence: best.confidence ?? Math.min(best.score / 15, .9),
				method: best.method,
				text: best.text
			};
		}
		getPositionBonus(anchor) {
			try {
				const rect = anchor.getBoundingClientRect();
				const scrollHeight = anchor.ownerDocument.documentElement?.scrollHeight || 0;
				if (rect.top < 300 || scrollHeight > 0 && rect.top > scrollHeight - 300) return 2;
			} catch {}
			return 0;
		}
		validateNavigation(currentUrl, navigation) {
			const currentNum = this.extractChapterNumber(currentUrl);
			if (currentNum === null) return navigation;
			if (navigation.next) {
				const nextNum = this.extractChapterNumber(navigation.next.url);
				if (nextNum !== null && nextNum !== currentNum + 1) navigation.next.confidence *= .7;
			}
			if (navigation.prev) {
				const prevNum = this.extractChapterNumber(navigation.prev.url);
				if (prevNum !== null && prevNum !== currentNum - 1) navigation.prev.confidence *= .7;
			}
			return navigation;
		}
		extractChapterNumber(url) {
			for (const pattern of [
				/\/(\d+)\.html?$/i,
				/\/chapter\/(\d+)/i,
				/\/(\d+)_\d+\.html?$/i,
				/_(\d+)\.html?$/i
			]) {
				const match = url.match(pattern);
				if (match) return parseInt(match[1], 10);
			}
			return null;
		}
		detectSection(doc, currentUrl, navigation) {
			const baseUrl = this.resolveBaseUrl(doc, currentUrl);
			const signals = this._lastSignals.length > 0 && this._lastBaseUrl === baseUrl ? this._lastSignals : this.collectLinkSignals(doc, baseUrl);
			const result = {
				isSection: false,
				currentSection: null,
				nextSectionUrl: null,
				nextChapterUrl: null,
				confidence: 0,
				method: "none"
			};
			const urlSectionInfo = this.extractSectionFromUrl(currentUrl);
			if (urlSectionInfo) {
				result.isSection = true;
				result.currentSection = urlSectionInfo.section;
				result.confidence = .8;
				result.method = "url-pattern";
			}
			if (navigation.next) {
				const nextText = navigation.next.text || "";
				const isNextSection = SECTION_TEXT_PATTERNS.some((p) => p.test(nextText));
				const isNextChapter = CHAPTER_TEXT_PATTERNS.some((p) => p.test(nextText));
				if (isNextSection && !isNextChapter) {
					const nextUrl = navigation.next.url;
					if (this.compareUrlsForSection(currentUrl, nextUrl).isSection) {
						result.isSection = true;
						result.nextSectionUrl = nextUrl;
						result.confidence = Math.max(result.confidence, .9);
						result.method = "link-text";
					} else result.nextChapterUrl = result.nextChapterUrl || nextUrl;
				} else if (isNextChapter) result.nextChapterUrl = navigation.next.url;
			}
			if (navigation.next && !result.isSection) {
				const nextUrl = navigation.next.url;
				const comparison = this.compareUrlsForSection(currentUrl, nextUrl);
				if (comparison.isSection) {
					result.isSection = true;
					result.nextSectionUrl = nextUrl;
					result.confidence = Math.max(result.confidence, comparison.confidence);
					result.method = "url-comparison";
				}
			}
			if (!result.isSection && !result.nextSectionUrl) {
				const nextSectionUrl = this.findNextSectionUrlByPattern(signals, currentUrl);
				if (nextSectionUrl) {
					result.isSection = true;
					result.nextSectionUrl = nextSectionUrl;
					result.confidence = Math.max(result.confidence, .85);
					result.method = "url-comparison";
				}
			}
			if (navigation.prev && !result.isSection) {
				const prevText = navigation.prev.text || "";
				if (SECTION_TEXT_PATTERNS.some((p) => p.test(prevText))) {
					const prevUrl = navigation.prev.url;
					if (this.compareUrlsForSection(prevUrl, currentUrl).isSection) {
						result.isSection = true;
						result.currentSection = this.extractSectionFromUrl(currentUrl)?.section ?? null;
						result.confidence = Math.max(result.confidence, .85);
						result.method = "link-text";
					}
				}
			}
			if (!result.nextSectionUrl) {
				const nextSectionUrl = this.findNextSectionUrl(signals, currentUrl);
				if (nextSectionUrl) {
					result.isSection = true;
					result.nextSectionUrl = nextSectionUrl;
					result.confidence = Math.max(result.confidence, .9);
					if (result.method === "none") result.method = "link-text";
				}
			}
			if (result.isSection && !result.nextChapterUrl) result.nextChapterUrl = this.findNextChapterUrl(signals, currentUrl);
			return result;
		}
		extractSectionFromUrl(url) {
			try {
				const info = parseChapterSectionFromPathname(new URL(url).pathname);
				if (!info) return null;
				if (info.section > 1) return { section: info.section };
				return null;
			} catch {
				return null;
			}
		}
		compareUrlsForSection(currentUrl, nextUrl) {
			try {
				const current = new URL(currentUrl);
				const next = new URL(nextUrl);
				if (current.host !== next.host) return {
					isSection: false,
					confidence: 0
				};
				const currentPath = current.pathname;
				const nextPath = next.pathname;
				if (currentPath === nextPath && current.search === next.search) return {
					isSection: false,
					confidence: 0
				};
				if (isSectionLikeUrl(currentUrl, nextUrl, getRuleManager().parseSectionUrl)) {
					const currentInfo = parseChapterSectionFromPathname(currentPath);
					const nextInfo = parseChapterSectionFromPathname(nextPath);
					if (currentInfo && nextInfo && currentInfo.chapterKey === nextInfo.chapterKey && nextInfo.section === currentInfo.section + 1 && nextInfo.section > 1) return {
						isSection: true,
						confidence: .95
					};
					return {
						isSection: true,
						confidence: .85
					};
				}
				return {
					isSection: false,
					confidence: 0
				};
			} catch {
				return {
					isSection: false,
					confidence: 0
				};
			}
		}
		findNextSectionUrl(signals, currentUrl) {
			const isNextSectionText = (normalizedText) => {
				if (!normalizedText) return false;
				if (normalizedText.includes("下一页") || normalizedText.includes("下页") || normalizedText.includes("下一頁") || normalizedText.includes("下頁")) return true;
				const lowerText = normalizedText.toLowerCase();
				if (lowerText.includes("next") && !lowerText.includes("chapter")) return true;
				return false;
			};
			const candidates = [];
			for (const signal of signals) {
				const { anchor, href, normalizedText, text, rel } = signal;
				if (!text) continue;
				const isSection = SECTION_TEXT_PATTERNS.some((p) => p.test(text));
				const isChapter = CHAPTER_TEXT_PATTERNS.some((p) => p.test(text));
				if (!isSection || isChapter) continue;
				if (!isNextSectionText(normalizedText)) continue;
				if (!isValidSignalLink(signal, "next", currentUrl)) continue;
				const comparison = this.compareUrlsForSection(currentUrl, href);
				if (!comparison.isSection) continue;
				let score = 50;
				if (text.length <= 5) score += 5;
				if (rel.includes("next")) score += 5;
				if (anchor.closest(".pager, .pagination, .page, nav, footer")) score += 2;
				score += Math.round(comparison.confidence * 10);
				candidates.push({
					url: href,
					score
				});
			}
			if (candidates.length === 0) return null;
			candidates.sort((a, b) => b.score - a.score);
			return candidates[0].url;
		}
		findNextSectionUrlByPattern(signals, currentUrl) {
			const candidates = [];
			for (const signal of signals) {
				const { href, normalizedText, rel } = signal;
				if (/上一|上页|上一頁|上頁|prev(?:ious)?/i.test(normalizedText)) continue;
				if (!isValidSignalLink(signal, "next", currentUrl)) continue;
				const comparison = this.compareUrlsForSection(currentUrl, href);
				if (!comparison.isSection) continue;
				let score = Math.round(comparison.confidence * 100);
				if (rel.includes("next")) score += 5;
				candidates.push({
					url: href,
					score
				});
			}
			if (candidates.length === 0) return null;
			candidates.sort((a, b) => b.score - a.score);
			return candidates[0].url;
		}
		findNextChapterUrl(signals, currentUrl) {
			for (const signal of signals) {
				const { href, normalizedText, text } = signal;
				if (!(/下一/.test(normalizedText) || /下[章节篇话]/.test(normalizedText) || /后一章/.test(normalizedText) || /next/i.test(normalizedText))) continue;
				const isChapter = CHAPTER_TEXT_PATTERNS.some((p) => p.test(text));
				const isSection = SECTION_TEXT_PATTERNS.some((p) => p.test(text));
				if (isChapter && !isSection && isValidSignalLink(signal, "next", currentUrl)) {
					if (!this.compareUrlsForSection(currentUrl, href).isSection) return href;
				}
			}
			return null;
		}
		generateSelector(element) {
			return generateCssSelector(element);
		}
	};
	var KNOWN_TITLE_SELECTORS = [
		"h1.chapter-title",
		"h1.chapter_title",
		".chapter-title",
		".chapter_title",
		".bookname h1",
		"h1.title",
		".title h1",
		"#chapter_title",
		".readtitle h1",
		"article h1",
		"h1"
	];
	function compileKnownTitleSelector(selector) {
		let match = selector.match(/^([a-z][a-z0-9-]*)\.([A-Za-z0-9_-]+)$/i);
		if (match) return {
			selector,
			type: "tag-class",
			tagName: match[1].toLowerCase(),
			className: match[2]
		};
		match = selector.match(/^\.(\S+)\s+([a-z][a-z0-9-]*)$/i);
		if (match && /^[A-Za-z0-9_-]+$/.test(match[1])) return {
			selector,
			type: "class-descendant",
			className: match[1],
			tagName: match[2].toLowerCase()
		};
		match = selector.match(/^([a-z][a-z0-9-]*)\s+([a-z][a-z0-9-]*)$/i);
		if (match) return {
			selector,
			type: "tag-descendant",
			parentTagName: match[1].toLowerCase(),
			tagName: match[2].toLowerCase()
		};
		if (/^#[A-Za-z0-9_-]+$/.test(selector)) return {
			selector,
			type: "id",
			name: selector.slice(1)
		};
		if (/^\.[A-Za-z0-9_-]+$/.test(selector)) return {
			selector,
			type: "class",
			name: selector.slice(1)
		};
		if (/^[A-Za-z][A-Za-z0-9-]*$/.test(selector)) return {
			selector,
			type: "tag",
			name: selector.toLowerCase()
		};
		return {
			selector,
			type: "complex"
		};
	}
	var KNOWN_TITLE_SELECTOR_ENTRIES = KNOWN_TITLE_SELECTORS.map(compileKnownTitleSelector);
	var BOOK_TITLE_CLASS_NAMES = [
		"bookname",
		"book-title",
		"book_title",
		"book-name",
		"book_name",
		"novel-title"
	];
	var BOOK_TITLE_HEADING_CONTAINER_IDS = ["book-info", "info"];
	var TITLE_CLEANUP_PATTERNS = [
		/^章节目录/,
		/^文章正文/,
		/^正文卷?/,
		/全文免费阅读$/,
		/最新章节$/,
		/[（(]\s*\d+\s*[/／]\s*\d+\s*[）)]\s*$/,
		/\(文\)$/,
		/_.*$/,
		/-.*小说.*$/i
	];
	var STRONG_BOOK_TITLE_SCORE = 3;
	var DIRECTORY_LINK_SCAN_LIMIT = 200;
	var GENERIC_BOOK_LABEL_PATTERN = /^(?:首页|主页|home|index|返回|返回目录|目录|章节目录|章節目錄|章节列表|章節列表|章节|章節|最新章节|最新章節|正文|内容|內容|简介|簡介|作品信息|书籍信息|書籍信息|小说|小說|阅读|閱讀|catalog|toc|contents?)$/i;
	var BREADCRUMB_IGNORE_PATTERN = /^(?:首页|主页|home|index|返回|返回目录|目录|章节目录|章節目錄|章节列表|章節列表|章节|章節)$/i;
	var SITE_TITLE_WORDS = [
		"起点中文网",
		"起点中文網",
		"顶点小说",
		"頂點小說",
		"笔趣阁",
		"筆趣閣",
		"小说网",
		"小說網",
		"小说阅读网",
		"小說閱讀網",
		"小说阅读",
		"小說閱讀",
		"阅读网",
		"閱讀網",
		"书吧",
		"書吧",
		"69书吧",
		"69書吧"
	];
	var BREADCRUMB_SELECTORS = [
		"[class*=\"breadcrumb\"]",
		"[class*=\"crumb\"]",
		"[class*=\"bread\"]",
		"nav[aria-label*=\"breadcrumb\"]"
	];
	var BREADCRUMB_CLASS_NAMES = [
		"breadcrumb",
		"breadcrumbs",
		"crumb",
		"crumbs",
		"bread",
		"breadnav",
		"bread-nav",
		"bread_crumb",
		"bread-crumb"
	];
	var EXPLICIT_BOOK_META_NAMES = [
		"og:novel:book_name",
		"og:book:title",
		"book_name"
	];
	var GENERIC_TITLE_META_NAMES = ["og:title", "twitter:title"];
	var SCRIPT_TEXT_SELECTORS = [
		"script:not([type])",
		"script[type=\"text/javascript\"]",
		"script[type=\"application/javascript\"]"
	];
	var SCRIPT_BOOK_TITLE_PATTERNS = [
		/bookName\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		/book_name\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		/bookTitle\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		/book_title\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		/novelName\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		/novel_title\s*[:=]\s*["']([^"'\n]{2,80})["']/i,
		new RegExp("lastread\\.set\\([^,]*,[^,]*,\\s*[\"\\']([^\"\\'\\r\\n]{2,80})[\"\\']", "i")
	];
	var STRUCTURED_BOOK_TITLE_KEYS = [
		"bookName",
		"book_name",
		"bookTitle",
		"book_title",
		"novelName",
		"novel_name",
		"novelTitle",
		"novel_title"
	];
	var STRUCTURED_BOOK_CONTAINER_KEYS = [
		"bookInfo",
		"book",
		"novel",
		"novelInfo",
		"info",
		"data"
	];
	var TitleDetector = class {
		detect(doc) {
			let best = this.detectFromSelector(doc);
			if (!best) {
				const results = [this.detectFromDocumentTitle(doc), this.detectFromHeadings(doc)].filter(Boolean);
				if (results.length === 0) return this.createEmptyResult();
				results.sort((a, b) => b.confidence - a.confidence);
				best = results[0];
			}
			const bookTitle = this.detectBookTitle(doc);
			if (bookTitle) best.bookTitle = bookTitle;
			return best;
		}
		detectFromSelector(doc) {
			for (const entry of KNOWN_TITLE_SELECTOR_ENTRIES) {
				const el = this.resolveKnownSelector(doc, entry);
				if (!el) continue;
				const text = this.cleanTitle(el.textContent || "");
				if (this.isValidTitle(text)) return {
					chapterTitle: text,
					selector: entry.selector,
					confidence: .9,
					method: "selector"
				};
			}
			return null;
		}
		resolveKnownSelector(doc, entry) {
			try {
				if (entry.type === "id") return doc.getElementById(entry.name);
				if (entry.type === "class") return doc.getElementsByClassName(entry.name).item(0);
				if (entry.type === "tag") return doc.getElementsByTagName(entry.name).item(0);
				if (entry.type === "tag-class") {
					for (const el of Array.from(doc.getElementsByClassName(entry.className))) if (el.tagName.toLowerCase() === entry.tagName) return el;
					return null;
				}
				if (entry.type === "class-descendant") {
					for (const container of Array.from(doc.getElementsByClassName(entry.className))) {
						const el = container.getElementsByTagName(entry.tagName).item(0);
						if (el) return el;
					}
					return null;
				}
				if (entry.type === "tag-descendant") {
					for (const container of Array.from(doc.getElementsByTagName(entry.parentTagName))) {
						const el = container.getElementsByTagName(entry.tagName).item(0);
						if (el) return el;
					}
					return null;
				}
				return doc.querySelector(entry.selector);
			} catch {
				return null;
			}
		}
		detectFromDocumentTitle(doc) {
			const docTitle = doc.title;
			if (!docTitle) return null;
			if (docTitle.match(TITLE_PATTERN)) {
				const parts = docTitle.split(/[-_|,，]/).map((s) => s.trim());
				for (const part of parts) if (TITLE_PATTERN.test(part)) {
					const cleaned = this.cleanTitle(part);
					if (this.isValidTitle(cleaned)) return {
						chapterTitle: cleaned,
						confidence: .7,
						method: "document-title"
					};
				}
			}
			const firstPart = docTitle.split(/[-_|,，]/)[0].trim();
			const cleaned = this.cleanTitle(firstPart);
			if (this.isValidTitle(cleaned)) return {
				chapterTitle: cleaned,
				confidence: .5,
				method: "document-title"
			};
			return null;
		}
		detectFromHeadings(doc) {
			const h1s = doc.getElementsByTagName("h1");
			for (const h1 of Array.from(h1s)) {
				const text = this.cleanTitle(h1.textContent || "");
				if (this.isValidTitle(text) && TITLE_PATTERN.test(text)) return {
					chapterTitle: text,
					selector: this.generateSelector(h1),
					confidence: .8,
					method: "heading"
				};
			}
			const h2s = doc.getElementsByTagName("h2");
			for (const h2 of Array.from(h2s)) {
				const text = this.cleanTitle(h2.textContent || "");
				if (this.isValidTitle(text) && TITLE_PATTERN.test(text)) return {
					chapterTitle: text,
					selector: this.generateSelector(h2),
					confidence: .7,
					method: "heading"
				};
			}
			return null;
		}
		detectBookTitle(doc) {
			const candidates = new Map();
			this.collectBookTitleFromKnownDom(doc, candidates);
			this.collectBookTitleFromBreadcrumbs(doc, candidates);
			this.collectBookTitleFromMeta(doc, candidates);
			this.collectBookTitleFromDocumentTitle(doc, candidates);
			const strongCandidate = this.pickBookTitleCandidate(candidates, STRONG_BOOK_TITLE_SCORE);
			if (strongCandidate) return strongCandidate;
			this.collectBookTitleFromStructuredData(doc, candidates);
			this.collectBookTitleFromScriptText(doc, candidates);
			this.collectBookTitleFromDirectoryLinks(doc, candidates);
			return this.pickBookTitleCandidate(candidates);
		}
		addBookTitleCandidate(candidates, text, weight = 1) {
			if (!text) return;
			const cleaned = this.cleanBookTitle(text);
			if (!cleaned || !this.isValidBookTitle(cleaned)) return;
			candidates.set(cleaned, (candidates.get(cleaned) || 0) + weight);
		}
		pickBookTitleCandidate(candidates, minScore = 0) {
			return Array.from(candidates.entries()).filter(([, score]) => score >= minScore).sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1];
				return b[0].length - a[0].length;
			})[0]?.[0];
		}
		isValidBookTitle(text) {
			if (!text || text.length < 2 || text.length > 100) return false;
			if (TITLE_PATTERN.test(text)) return false;
			if (GENERIC_BOOK_LABEL_PATTERN.test(text.trim())) return false;
			const normalized = text.replace(/\s+/g, "").toLowerCase();
			if (normalized.includes("天天看小说") || normalized.includes("天天看小說")) return false;
			if (SITE_TITLE_WORDS.some((word) => normalized.includes(word) && normalized.length <= word.length + 4)) return false;
			if (normalized.startsWith("⚡")) return false;
			return true;
		}
		collectBookTitleFromKnownDom(doc, candidates) {
			this.addBookTitleCandidate(candidates, doc.getElementById("bookname")?.textContent, 3);
			for (const id of BOOK_TITLE_HEADING_CONTAINER_IDS) this.collectHeadingText(doc.getElementById(id), candidates, 3);
			for (const className of BOOK_TITLE_CLASS_NAMES) for (const el of Array.from(doc.getElementsByClassName(className))) this.addBookTitleCandidate(candidates, el.textContent, 3);
			for (const container of Array.from(doc.getElementsByClassName("bookinfo"))) this.collectHeadingText(container, candidates, 3);
			for (const h2 of Array.from(doc.getElementsByTagName("h2"))) if (h2.classList.contains("title")) this.addBookTitleCandidate(candidates, h2.textContent, 3);
			for (const container of Array.from(doc.getElementsByClassName("layout-tit"))) {
				const link = container.querySelector("a[title]");
				this.addBookTitleCandidate(candidates, link?.textContent, 3);
			}
			for (const container of Array.from(doc.getElementsByClassName("booknav"))) {
				const link = container.querySelector("a");
				this.addBookTitleCandidate(candidates, link?.textContent, 3);
			}
			for (const container of Array.from(doc.getElementsByClassName("chapter-nav"))) {
				const links = container.getElementsByTagName("a");
				const link = links.item(links.length - 1);
				this.addBookTitleCandidate(candidates, link?.textContent, 3);
			}
		}
		collectHeadingText(container, candidates, weight) {
			if (!container) return;
			for (const tagName of ["h1", "h2"]) {
				const heading = container.getElementsByTagName(tagName).item(0);
				if (heading) this.addBookTitleCandidate(candidates, heading.textContent, weight);
			}
		}
		collectBookTitleFromBreadcrumbs(doc, candidates) {
			for (const container of this.collectBreadcrumbContainers(doc)) {
				const links = Array.from(container.querySelectorAll("a"));
				if (links.length === 0) continue;
				const filtered = links.map(this.getAnchorLabel).filter(Boolean).filter((t) => !TITLE_PATTERN.test(t) && !BREADCRUMB_IGNORE_PATTERN.test(t));
				if (filtered.length === 0) continue;
				const best = filtered.reduce((a, b) => b.length > a.length ? b : a);
				this.addBookTitleCandidate(candidates, best, 3);
			}
		}
		collectBreadcrumbContainers(doc) {
			const containers = [];
			const seen = new Set();
			const add = (element) => {
				if (!element || seen.has(element)) return;
				seen.add(element);
				containers.push(element);
			};
			for (const className of BREADCRUMB_CLASS_NAMES) for (const element of Array.from(doc.getElementsByClassName(className))) add(element);
			for (const nav of Array.from(doc.getElementsByTagName("nav"))) if ((nav.getAttribute("aria-label") || "").toLowerCase().includes("breadcrumb")) add(nav);
			if (containers.length === 0 && doc.links.length <= DIRECTORY_LINK_SCAN_LIMIT) for (const element of Array.from(doc.querySelectorAll(BREADCRUMB_SELECTORS.join(", ")))) add(element);
			return containers;
		}
		collectBookTitleFromMeta(doc, candidates) {
			const metaContents = this.collectMetaContents(doc);
			const metaDescription = metaContents.get("description");
			for (const name of EXPLICIT_BOOK_META_NAMES) this.addBookTitleCandidate(candidates, metaContents.get(name.toLowerCase()), 4);
			for (const name of GENERIC_TITLE_META_NAMES) this.addBookTitleCandidate(candidates, metaContents.get(name.toLowerCase()), 2);
			const keywordsContent = metaContents.get("keywords");
			if (keywordsContent) {
				const keywords = keywordsContent.split(/[，,|｜]/).map((s) => s.trim()).filter(Boolean);
				const descriptionStart = (metaDescription || "").trim().replace(/^[《【]/, "");
				const corroboratedKeyword = keywords.find((keyword) => {
					const cleaned = this.cleanBookTitle(keyword);
					return this.isValidBookTitle(cleaned) && doc.title.includes(cleaned) && descriptionStart.startsWith(cleaned);
				});
				if (corroboratedKeyword) this.addBookTitleCandidate(candidates, corroboratedKeyword, 3);
				else if (keywords.length > 0) this.addBookTitleCandidate(candidates, keywords[0], 1);
			}
			if (metaDescription) {
				const bracket = metaDescription.match(/《([^》]+)》/);
				if (bracket) this.addBookTitleCandidate(candidates, bracket[1], 2);
			}
		}
		collectMetaContents(doc) {
			const contents = new Map();
			const metas = doc.querySelectorAll("meta[name], meta[property]");
			for (const meta of Array.from(metas)) {
				const key = (meta.getAttribute("name") || meta.getAttribute("property") || "").trim().toLowerCase();
				const content = meta.getAttribute("content");
				if (key && content && !contents.has(key)) contents.set(key, content);
			}
			return contents;
		}
		collectBookTitleFromDocumentTitle(doc, candidates) {
			const docTitle = doc.title;
			const bracketMatch = docTitle.match(/《([^》]+)》/);
			if (bracketMatch) this.addBookTitleCandidate(candidates, bracketMatch[1], 1);
			const parts = docTitle.split(/[-_|]/.test(docTitle) ? /[-_|]/ : /[,，]/).map((s) => s.trim()).filter(Boolean);
			if (parts.length > 0) {
				const firstPart = parts[0];
				this.addBookTitleCandidate(candidates, firstPart.replace(TITLE_PATTERN, "").replace(/《|》/g, ""), 1);
				for (const part of parts) {
					if (TITLE_PATTERN.test(part)) continue;
					this.addBookTitleCandidate(candidates, part.replace(/《|》/g, ""), 1);
				}
			}
			if (parts.length >= 2) {
				const bookPart = parts[1] || parts[parts.length - 1];
				this.addBookTitleCandidate(candidates, bookPart, 1);
			}
		}
		collectBookTitleFromStructuredData(doc, candidates) {
			const scripts = doc.querySelectorAll("script[type=\"application/ld+json\"], script[type=\"application/json\"]");
			for (const script of Array.from(scripts)) {
				const text = script.textContent?.trim();
				if (!text) continue;
				let data;
				try {
					data = JSON.parse(text);
				} catch {
					continue;
				}
				const found = this.findBookTitleInStructuredData(data);
				if (found) this.addBookTitleCandidate(candidates, found, 4);
			}
		}
		findBookTitleInStructuredData(value, depth = 0) {
			if (!value || depth > 4) return void 0;
			if (Array.isArray(value)) {
				for (const item of value) {
					const found = this.findBookTitleInStructuredData(item, depth + 1);
					if (found) return found;
				}
				return;
			}
			if (typeof value !== "object") return void 0;
			const obj = value;
			for (const key of STRUCTURED_BOOK_TITLE_KEYS) {
				const candidate = obj[key];
				if (typeof candidate === "string") return candidate;
			}
			const type = obj["@type"];
			if (typeof type === "string" && /book|novel/i.test(type)) {
				const candidate = obj.name || obj.title;
				if (typeof candidate === "string") return candidate;
			}
			for (const key of STRUCTURED_BOOK_CONTAINER_KEYS) {
				const found = this.findBookTitleInStructuredData(obj[key], depth + 1);
				if (found) return found;
			}
			for (const key of Object.keys(obj)) {
				if (STRUCTURED_BOOK_TITLE_KEYS.includes(key) || STRUCTURED_BOOK_CONTAINER_KEYS.includes(key)) continue;
				const found = this.findBookTitleInStructuredData(obj[key], depth + 1);
				if (found) return found;
			}
		}
		collectBookTitleFromScriptText(doc, candidates) {
			const scripts = doc.querySelectorAll(SCRIPT_TEXT_SELECTORS.join(", "));
			for (const script of Array.from(scripts)) {
				const text = script.textContent;
				if (!text || text.length > 2e5) continue;
				for (const pattern of SCRIPT_BOOK_TITLE_PATTERNS) {
					const match = text.match(pattern);
					if (match?.[1]) this.addBookTitleCandidate(candidates, match[1], 3);
				}
			}
		}
		collectBookTitleFromDirectoryLinks(doc, candidates) {
			if (doc.links.length > DIRECTORY_LINK_SCAN_LIMIT) return;
			for (const link of Array.from(doc.links)) {
				const text = link.textContent || "";
				if (!/目录|章节/.test(text)) continue;
				const bracket = text.match(/《([^》]+)》/);
				if (bracket) {
					this.addBookTitleCandidate(candidates, bracket[1], 2);
					continue;
				}
				const cleaned = text.replace(/目录|章节|列表|返回|最新|TXT/gi, "").trim();
				if (cleaned) this.addBookTitleCandidate(candidates, cleaned, 1);
			}
		}
		getAnchorLabel(el) {
			return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
		}
		cleanTitle(text) {
			let cleaned = text.trim();
			for (const pattern of TITLE_CLEANUP_PATTERNS) cleaned = cleaned.replace(pattern, "");
			cleaned = cleaned.replace(/\s+/g, " ").trim();
			return cleaned;
		}
		cleanBookTitle(text) {
			let cleaned = text.trim();
			const bracketMatch = cleaned.match(/《([^》]+)》/);
			if (bracketMatch) cleaned = bracketMatch[1].trim();
			cleaned = cleaned.replace(/^[\]\s"'“”‘’【】[（）()<>《》·•\-—–_~!！?？★☆⚡]+/, "").replace(/[\]\s"'“”‘’【】[（）()<>《》·•\-—–_~★☆⚡]+$/, "").trim();
			const chapterMatch = cleaned.match(TITLE_PATTERN);
			if (chapterMatch?.index !== void 0 && chapterMatch.index > 0) cleaned = cleaned.slice(0, chapterMatch.index).trim();
			for (const pattern of [
				/(?:小说|小說)?(?:全文|在线|線上|免费|免費)?阅读$/i,
				/(?:小说|小說)?(?:最新章节|最新章節)$/i,
				/(?:章节目录|章節目錄|章节列表|章節列表|目录|目錄|列表)$/i,
				/(?:TXT|txt)(?:全集|下载|下載)?$/i,
				/(?:无弹窗|無彈窗)$/i
			]) cleaned = cleaned.replace(pattern, "").trim();
			const siteSuffixPattern = new RegExp("[-_|—–]\\s*[^-|—–|_]{0,40}(?:小说|小說|阅读|閱讀|网|網|站|书屋|書屋|书吧|書吧|笔趣阁|筆趣閣|顶点|頂點|起点|起點|中文网|中文網|手机版|手機版|官网|官網|小说网|小說網|阅读网|閱讀網).*$", "i");
			cleaned = cleaned.replace(siteSuffixPattern, "").trim();
			cleaned = cleaned.replace(/\s+/g, " ").trim();
			return cleaned;
		}
		isValidTitle(text) {
			if (!text || text.length < 2) return false;
			if (text.length > 100) return false;
			if (!/\S/.test(text)) return false;
			return true;
		}
		generateSelector(element) {
			if (element.id) return `#${cssEscape(element.id)}`;
			const tagName = element.tagName.toLowerCase();
			const className = element.className;
			if (className) {
				const firstClass = className.split(/\s+/)[0];
				return `${tagName}.${cssEscape(firstClass)}`;
			}
			return tagName;
		}
		createEmptyResult() {
			return {
				chapterTitle: "",
				confidence: 0,
				method: "pattern"
			};
		}
	};
	function enableRightClick() {
		const handler = (e) => {
			e.stopPropagation();
			return true;
		};
		document.addEventListener("contextmenu", handler, true);
		const originalOnContextMenu = document.oncontextmenu;
		document.oncontextmenu = null;
		if (document.body) document.body.oncontextmenu = null;
		document.querySelectorAll("[oncontextmenu]").forEach((el) => {
			el.removeAttribute("oncontextmenu");
		});
		return () => {
			document.removeEventListener("contextmenu", handler, true);
			document.oncontextmenu = originalOnContextMenu;
		};
	}
	function enableSelection() {
		const handler = (e) => {
			e.stopPropagation();
			return true;
		};
		document.addEventListener("selectstart", handler, true);
		const style = document.createElement("style");
		style.id = "mnr-enable-selection";
		style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
		document.head.appendChild(style);
		document.querySelectorAll("[onselectstart]").forEach((el) => {
			el.removeAttribute("onselectstart");
		});
		document.querySelectorAll("[unselectable]").forEach((el) => {
			el.removeAttribute("unselectable");
		});
		return () => {
			document.removeEventListener("selectstart", handler, true);
			style.remove();
		};
	}
	function enableCopy() {
		const handler = (e) => {
			e.stopPropagation();
			return true;
		};
		document.addEventListener("copy", handler, true);
		document.addEventListener("cut", handler, true);
		document.querySelectorAll("[oncopy], [oncut]").forEach((el) => {
			el.removeAttribute("oncopy");
			el.removeAttribute("oncut");
		});
		return () => {
			document.removeEventListener("copy", handler, true);
			document.removeEventListener("cut", handler, true);
		};
	}
	function unlockKeyboard() {
		const handler = (e) => {
			const ke = e;
			if (isMnrEvent(ke) && !isMnrReaderShortcutEvent(ke)) return;
			ke.stopImmediatePropagation();
			ke.stopPropagation();
		};
		const types = [
			"keydown",
			"keyup",
			"keypress"
		];
		types.forEach((type) => document.addEventListener(type, handler, true));
		const originalDocumentHandlers = {
			keydown: document.onkeydown,
			keyup: document.onkeyup,
			keypress: document.onkeypress
		};
		const originalWindowHandlers = {
			keydown: window.onkeydown,
			keyup: window.onkeyup,
			keypress: window.onkeypress
		};
		const originalBodyHandlers = document.body ? {
			keydown: document.body.onkeydown,
			keyup: document.body.onkeyup,
			keypress: document.body.onkeypress
		} : null;
		const originalHtmlHandlers = {
			keydown: document.documentElement.onkeydown,
			keyup: document.documentElement.onkeyup,
			keypress: document.documentElement.onkeypress
		};
		document.onkeydown = null;
		document.onkeyup = null;
		document.onkeypress = null;
		window.onkeydown = null;
		window.onkeyup = null;
		window.onkeypress = null;
		document.documentElement.onkeydown = null;
		document.documentElement.onkeyup = null;
		document.documentElement.onkeypress = null;
		if (document.body) {
			document.body.onkeydown = null;
			document.body.onkeyup = null;
			document.body.onkeypress = null;
		}
		document.querySelectorAll("[onkeydown], [onkeyup], [onkeypress]").forEach((el) => {
			el.removeAttribute("onkeydown");
			el.removeAttribute("onkeyup");
			el.removeAttribute("onkeypress");
		});
		return () => {
			types.forEach((type) => document.removeEventListener(type, handler, true));
			document.onkeydown = originalDocumentHandlers.keydown;
			document.onkeyup = originalDocumentHandlers.keyup;
			document.onkeypress = originalDocumentHandlers.keypress;
			window.onkeydown = originalWindowHandlers.keydown;
			window.onkeyup = originalWindowHandlers.keyup;
			window.onkeypress = originalWindowHandlers.keypress;
			document.documentElement.onkeydown = originalHtmlHandlers.keydown;
			document.documentElement.onkeyup = originalHtmlHandlers.keyup;
			document.documentElement.onkeypress = originalHtmlHandlers.keypress;
			if (document.body && originalBodyHandlers) {
				document.body.onkeydown = originalBodyHandlers.keydown;
				document.body.onkeyup = originalBodyHandlers.keyup;
				document.body.onkeypress = originalBodyHandlers.keypress;
			}
		};
	}
	function isMnrEvent(e) {
		const path = typeof e.composedPath === "function" ? e.composedPath() : [];
		for (const node of path) {
			if (node instanceof ShadowRoot) {
				if (node.host?.id?.startsWith("mnr-")) return true;
			}
			if (node instanceof Element) {
				if (node.id?.startsWith("mnr-")) return true;
				for (const cls of Array.from(node.classList)) if (cls.startsWith("mnr-")) return true;
			}
		}
		return false;
	}
	function isMnrReaderShortcutEvent(e) {
		if (e.ctrlKey || e.altKey || e.metaKey) return false;
		const key = e.key.toLowerCase();
		if (!new Set([
			"escape",
			"tab",
			"enter",
			"s",
			",",
			"e",
			"q",
			"arrowleft",
			"arrowright",
			"arrowup",
			"arrowdown",
			" ",
			"spacebar",
			"n",
			"p"
		]).has(key)) return false;
		const path = typeof e.composedPath === "function" ? e.composedPath() : [];
		if (path.some(isEditableKeyboardTarget)) return false;
		return path.some((node) => {
			if (!(node instanceof Element)) return false;
			if (node.id === "mnr-reader-root") return true;
			return Array.from(node.classList).some((cls) => cls === "mnr-reader" || cls.startsWith("mnr-"));
		});
	}
	function isEditableKeyboardTarget(node) {
		if (!(node instanceof Element)) return false;
		const tagName = node.tagName;
		return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || node.isContentEditable === true;
	}
	var DEFAULT_PROTECTION_OPTIONS = {
		blockRedirects: true,
		enableRightClick: true,
		enableSelection: true,
		enableCopy: true,
		unlockKeyboard: true,
		blockPopups: true,
		removeEventHijacking: true,
		blockVisibilityDetection: true,
		clearTimers: false,
		cleanupScripts: false
	};
	var isCloudflareChallenge = (doc = document) => {
		if ((doc.location?.pathname || (typeof window !== "undefined" ? window.location.pathname : "")).startsWith("/cdn-cgi/")) return true;
		if (doc.querySelector([
			"[id*=\"cf-chl\"]",
			"[class*=\"cf-chl\"]",
			"form[action*=\"/cdn-cgi/\"]",
			"iframe[src*=\"challenges.cloudflare.com\"]",
			"iframe[src*=\"captcha.cloudflare.com\"]"
		].join(",")) !== null) return true;
		if (Array.from(doc.querySelectorAll("script[src], link[href]")).some((element) => {
			const resourceUrl = element.getAttribute("src") || element.getAttribute("href") || "";
			if (!/\/cdn-cgi\/challenge-platform\//i.test(resourceUrl)) return false;
			return !/\/cdn-cgi\/challenge-platform\/scripts\/jsd\//i.test(resourceUrl);
		})) return true;
		const title = (doc.title || "").trim().toLowerCase();
		if (title === "just a moment..." || title === "attention required! | cloudflare") return true;
		const scriptText = Array.from(doc.querySelectorAll("script")).map((script) => `${script.getAttribute("src") || ""}\n${script.textContent || ""}`).join("\n");
		if (/_cf_chl_opt|cf_chl_|challenges\.cloudflare\.com/i.test(scriptText)) return true;
		const bodyText = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
		return /enable javascript and cookies to continue/i.test(bodyText);
	};
	function withDefaultProtectionOptions(options = {}) {
		return {
			...DEFAULT_PROTECTION_OPTIONS,
			...options
		};
	}
	function getEffectiveProtectionOptions(options, doc = document) {
		if (!isCloudflareChallenge(doc)) return options;
		return {
			...options,
			blockRedirects: false,
			clearTimers: false,
			removeEventHijacking: false
		};
	}
	function blockPopups() {
		const originalOpen = window.open;
		window.open = (url, target, features) => {
			if (window.event?.isTrusted) {
				const urlStr = url?.toString() || "";
				try {
					if (new URL(urlStr, window.location.href).origin === window.location.origin) return originalOpen.call(window, url, target, features);
				} catch {}
			}
			return null;
		};
		return () => {
			window.open = originalOpen;
		};
	}
	function blockRedirects(options = {}) {
		document.querySelectorAll("meta[http-equiv=\"refresh\"]").forEach((meta) => meta.remove());
		const originalSetTimeout = window.setTimeout;
		const originalSetInterval = window.setInterval;
		const suspiciousPatterns = [
			/location\s*[.=]/i,
			/window\.open/i,
			/href\s*=/i,
			/navigate/i
		];
		const isSuspiciousCallback = (callback) => {
			if (typeof callback === "string") return suspiciousPatterns.some((p) => p.test(callback));
			return false;
		};
		window.setTimeout = ((callback, delay, ...args) => {
			if (isSuspiciousCallback(callback) && (delay || 0) > 0) return 0;
			return originalSetTimeout(callback, delay, ...args);
		});
		window.setInterval = ((callback, delay, ...args) => {
			if (isSuspiciousCallback(callback)) return 0;
			return originalSetInterval(callback, delay, ...args);
		});
		const isBlockedExternalUrl = (url, kind) => {
			if (url.protocol !== "http:" && url.protocol !== "https:") return true;
			if (url.origin === window.location.origin) return false;
			if (["challenges.cloudflare.com", "captcha.cloudflare.com"].some((h) => url.hostname === h)) return false;
			if (url.pathname.startsWith("/cdn-cgi/")) return false;
			return kind === "script" || kind === "iframe";
		};
		const isHighEntropyPath = (pathname) => {
			return /^\/[A-Za-z0-9]{6,12}\/[A-Za-z0-9]{6,24}\.js(?:$|[?#])/.test(pathname);
		};
		const isLikelyAdScriptPath = (srcUrl) => {
			if (srcUrl.origin !== window.location.origin) return true;
			const path = srcUrl.pathname || "";
			if (path.startsWith("/static/") || path.startsWith("/js/") || path.startsWith("/assets/")) return false;
			return isHighEntropyPath(path);
		};
		const NodeCtor = window.Node;
		const ScriptCtor = window.HTMLScriptElement;
		const IFrameCtor = window.HTMLIFrameElement;
		const ElementCtor = window.Element;
		const DocumentFragmentCtor = window.DocumentFragment;
		const originalAppendChild = NodeCtor.prototype.appendChild;
		const originalInsertBefore = NodeCtor.prototype.insertBefore;
		const shouldBlockNode = (node) => {
			const checkScript = (script) => {
				const src = script.getAttribute("src") || script.src || "";
				if (!src) return false;
				let u;
				try {
					u = new URL(src, window.location.href);
				} catch {
					return false;
				}
				if (isBlockedExternalUrl(u, "script")) return true;
				if (options.cleanupScripts && isLikelyAdScriptPath(u)) return true;
				return false;
			};
			const checkIFrame = (iframe) => {
				const src = iframe.getAttribute("src") || iframe.src || "";
				if (!src) return false;
				let u;
				try {
					u = new URL(src, window.location.href);
				} catch {
					return false;
				}
				if (isBlockedExternalUrl(u, "iframe")) return true;
				return false;
			};
			if (ScriptCtor && node instanceof ScriptCtor) return checkScript(node);
			if (IFrameCtor && node instanceof IFrameCtor) return checkIFrame(node);
			if (!(DocumentFragmentCtor && node instanceof DocumentFragmentCtor || ElementCtor && node instanceof ElementCtor)) return false;
			const container = node;
			if (container.childElementCount === 0) return false;
			const embeddedNodes = container.querySelectorAll("script[src], iframe[src]");
			for (const embeddedNode of Array.from(embeddedNodes)) if (ScriptCtor && embeddedNode instanceof ScriptCtor) {
				if (checkScript(embeddedNode)) return true;
			} else if (IFrameCtor && embeddedNode instanceof IFrameCtor) {
				if (checkIFrame(embeddedNode)) return true;
			}
			return false;
		};
		NodeCtor.prototype.appendChild = function(node) {
			if (shouldBlockNode(node)) return node;
			return originalAppendChild.call(this, node);
		};
		NodeCtor.prototype.insertBefore = function(newNode, referenceNode) {
			if (shouldBlockNode(newNode)) return newNode;
			return originalInsertBefore.call(this, newNode, referenceNode);
		};
		const originalWrite = document.write?.bind(document);
		const originalWriteln = document.writeln?.bind(document);
		let writeBuffer = "";
		let isBufferingWrite = false;
		const MAX_BUFFER_LEN = 4096;
		const bufferLooksLikeScriptTag = (buf) => /<script/i.test(buf);
		const bufferIsClosed = (buf) => /<\/script>/i.test(buf) || /<\\\/script>/i.test(buf);
		const maybeExtractScriptSrc = (buf) => {
			return buf.match(/<script[^>]*\ssrc\s*=\s*['"]([^'"]+)['"][^>]*>/i)?.[1] || null;
		};
		const flushWriteBuffer = (writer) => {
			if (!writeBuffer) return;
			writer(writeBuffer);
			writeBuffer = "";
			isBufferingWrite = false;
		};
		const handleWriteLike = (writer, args) => {
			if (!originalWrite || !originalWriteln) return writer(String(args.join("")));
			const chunk = args.map((a) => String(a)).join("");
			const startsScriptLike = /<script/i.test(chunk) || isBufferingWrite && bufferLooksLikeScriptTag(writeBuffer);
			if (!isBufferingWrite && startsScriptLike) {
				isBufferingWrite = true;
				writeBuffer = "";
			}
			if (!isBufferingWrite) {
				writer(chunk);
				return;
			}
			writeBuffer += chunk;
			if (writeBuffer.length > MAX_BUFFER_LEN) {
				flushWriteBuffer(writer);
				return;
			}
			if (!bufferIsClosed(writeBuffer)) return;
			const src = maybeExtractScriptSrc(writeBuffer);
			if (src) try {
				const u = new URL(src, window.location.href);
				if (isBlockedExternalUrl(u, "script") || isLikelyAdScriptPath(u)) {
					writeBuffer = "";
					isBufferingWrite = false;
					return;
				}
			} catch {}
			flushWriteBuffer(writer);
		};
		if (options.cleanupScripts && originalWrite && originalWriteln) {
			document.write = (...args) => handleWriteLike(originalWrite, args);
			document.writeln = (...args) => handleWriteLike(originalWriteln, args);
		}
		return () => {
			window.setTimeout = originalSetTimeout;
			window.setInterval = originalSetInterval;
			NodeCtor.prototype.appendChild = originalAppendChild;
			NodeCtor.prototype.insertBefore = originalInsertBefore;
			if (originalWrite) document.write = originalWrite;
			if (originalWriteln) document.writeln = originalWriteln;
		};
	}
	function clearAllTimers() {
		const highestId = window.setInterval(() => {}, 0);
		for (let i = 0; i <= highestId; i++) window.clearInterval(i);
		const highestTimeoutId = window.setTimeout(() => {}, 0);
		for (let i = 0; i <= highestTimeoutId; i++) window.clearTimeout(i);
	}
	function removeOverlays() {
		if (!document.body) return;
		const hideElement = (el) => {
			el.style.setProperty("display", "none", "important");
			el.style.setProperty("pointer-events", "none", "important");
		};
		document.querySelectorAll([
			"[class*=\"overlay\"]",
			"[class*=\"modal\"]",
			"[class*=\"popup\"]",
			"[class*=\"mask\"]",
			"[class*=\"blocker\"]",
			"[id*=\"overlay\"]",
			"[id*=\"modal\"]",
			"[id*=\"popup\"]"
		].join(", ")).forEach((el) => {
			const style = window.getComputedStyle(el);
			const rect = el.getBoundingClientRect();
			const isFullPage = rect.width >= window.innerWidth * .8 && rect.height >= window.innerHeight * .8;
			const isFixed = style.position === "fixed" || style.position === "absolute";
			const zIndex = parseInt(style.zIndex, 10);
			if (isFullPage && isFixed && Number.isFinite(zIndex) && zIndex > 1e3) hideElement(el);
		});
		const isTransparentColor = (color) => {
			const c = (color || "").trim().toLowerCase();
			return c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "rgba(0,0,0,0)";
		};
		const isMnrHost = (el) => el.id.startsWith("mnr-");
		const hasVisibleContent = (el) => {
			if ((el.textContent || "").trim().length > 0) return true;
			return el.querySelector("img, svg, canvas, video") !== null;
		};
		const looksLikeClickLayer = (el) => {
			if (isMnrHost(el)) return false;
			const style = window.getComputedStyle(el);
			if (style.display === "none" || style.visibility === "hidden") return false;
			if (style.pointerEvents === "none") return false;
			if (style.position !== "fixed" && style.position !== "absolute") return false;
			const zIndex = parseInt(style.zIndex, 10);
			if (!Number.isFinite(zIndex) || zIndex <= 1e3) return false;
			const rect = el.getBoundingClientRect();
			if (!rect || rect.width <= 0 || rect.height <= 0) return false;
			const minWidth = window.innerWidth * .6;
			const minHeight = 40;
			const maxHeight = window.innerHeight * .6;
			if (rect.width < minWidth || rect.height < minHeight || rect.height > maxHeight) return false;
			const nearTop = rect.top <= 2;
			const nearBottom = rect.bottom >= window.innerHeight - 2;
			if (!nearTop && !nearBottom) return false;
			if (hasVisibleContent(el)) return false;
			const rawOpacity = style.opacity || el.style.opacity || "1";
			const opacity = parseFloat(rawOpacity);
			const bg = style.backgroundColor || el.style.backgroundColor || "";
			if (!(Number.isFinite(opacity) && opacity <= .08 || isTransparentColor(bg))) return false;
			const AnchorCtor = window.HTMLAnchorElement;
			if (AnchorCtor && el instanceof AnchorCtor) return true;
			if (el.tagName.toLowerCase() === "a" && el.hasAttribute("href")) return true;
			if (el.querySelector("a[href]")) return true;
			if (el.hasAttribute("onclick")) return true;
			if (typeof el.onclick === "function") return true;
			return false;
		};
		const candidates = Array.from(document.body.querySelectorAll("a, div, span, section, header, footer, nav"));
		for (const el of candidates) if (looksLikeClickLayer(el)) hideElement(el);
		document.body.style.overflow = "";
		document.documentElement.style.overflow = "";
	}
	var SiteProtection = class {
		constructor(options = {}) {
			this.cleanupFunctions = [];
			this.isActive = false;
			this.options = withDefaultProtectionOptions(options);
		}
		activate(options) {
			if (options) this.options = withDefaultProtectionOptions(options);
			if (this.isActive) {
				if (!options) return;
				this.deactivate();
			}
			this.isActive = true;
			const effectiveOptions = getEffectiveProtectionOptions(this.options);
			if (effectiveOptions.clearTimers) clearAllTimers();
			if (effectiveOptions.blockRedirects) this.cleanupFunctions.push(blockRedirects({ cleanupScripts: !!effectiveOptions.cleanupScripts }));
			if (effectiveOptions.enableRightClick) this.cleanupFunctions.push(enableRightClick());
			if (effectiveOptions.enableSelection) this.cleanupFunctions.push(enableSelection());
			if (effectiveOptions.enableCopy) this.cleanupFunctions.push(enableCopy());
			if (effectiveOptions.unlockKeyboard) this.cleanupFunctions.push(unlockKeyboard());
			if (effectiveOptions.blockPopups) this.cleanupFunctions.push(blockPopups());
			if (effectiveOptions.cleanupScripts) this.cleanupScripts();
			if (effectiveOptions.removeEventHijacking) this.removeEventHijacking();
			if (effectiveOptions.blockVisibilityDetection) this.blockVisibilityDetection();
		}
		deactivate() {
			if (!this.isActive) return;
			this.cleanupFunctions.forEach((cleanup) => cleanup());
			this.cleanupFunctions = [];
			this.isActive = false;
		}
		removeOverlays() {
			removeOverlays();
		}
		cleanupScripts() {
			const suspiciousPatterns = [
				/(^|[\\/._-])(adservice|adserver|adsystem|adsbygoogle|pagead)([\\/._-]|$)/i,
				/(^|[\\/._-])ads([\\/._-]|$)/i,
				/doubleclick/i,
				/googlesyndication|googletagmanager|gtag/i,
				/google-analytics/i,
				/(^|[\\/._-])(analytics|track(er|ing)?|pixel|beacon|telemetry)([\\/._-]|$)/i
			];
			const siteHost = window.location.hostname;
			const isSameSite = (host) => {
				return host === siteHost || host.endsWith(`.${siteHost}`);
			};
			document.querySelectorAll("script[src]").forEach((script) => {
				const src = script.getAttribute("src") || "";
				let url;
				try {
					url = new URL(src, window.location.href);
				} catch {
					return;
				}
				const target = `${url.hostname}${url.pathname}`;
				if (!suspiciousPatterns.some((p) => p.test(target))) return;
				const isThirdParty = !isSameSite(url.hostname);
				const isHighConfidence = /(^|[\\/._-])(adservice|adserver|adsystem|adsbygoogle|pagead)([\\/._-]|$)/i.test(target);
				if (isThirdParty || isHighConfidence) script.remove();
			});
		}
		removeEventHijacking() {
			const clickBlocker = (e) => {
				const clickableParent = e.target.closest("a, button, [role=\"button\"]");
				if (clickableParent) {
					if (clickableParent instanceof HTMLAnchorElement) {
						const href = clickableParent.getAttribute("href");
						if (href && !href.startsWith("javascript:") && href !== "#") return true;
					}
				}
				if (e.target === document.body || e.target === document.documentElement) e.stopPropagation();
			};
			document.addEventListener("click", clickBlocker, true);
			if (document.body) document.body.onclick = null;
			document.documentElement.onclick = null;
			const mouseBlocker = (e) => {
				if (e.target === document.body || e.target === document.documentElement) e.stopPropagation();
			};
			document.addEventListener("mousedown", mouseBlocker, true);
			document.addEventListener("mouseup", mouseBlocker, true);
			this.cleanupFunctions.push(() => {
				document.removeEventListener("click", clickBlocker, true);
				document.removeEventListener("mousedown", mouseBlocker, true);
				document.removeEventListener("mouseup", mouseBlocker, true);
			});
		}
		blockVisibilityDetection() {
			const docProto = Object.getPrototypeOf(document);
			const savedHidden = (() => {
				const ownDesc = Object.getOwnPropertyDescriptor(document, "hidden");
				if (ownDesc) return {
					descriptor: ownDesc,
					owner: "instance"
				};
				if (docProto) {
					const protoDesc = Object.getOwnPropertyDescriptor(docProto, "hidden");
					if (protoDesc) return {
						descriptor: protoDesc,
						owner: "prototype"
					};
				}
				return {
					descriptor: void 0,
					owner: "none"
				};
			})();
			const savedVisibilityState = (() => {
				const ownDesc = Object.getOwnPropertyDescriptor(document, "visibilityState");
				if (ownDesc) return {
					descriptor: ownDesc,
					owner: "instance"
				};
				if (docProto) {
					const protoDesc = Object.getOwnPropertyDescriptor(docProto, "visibilityState");
					if (protoDesc) return {
						descriptor: protoDesc,
						owner: "prototype"
					};
				}
				return {
					descriptor: void 0,
					owner: "none"
				};
			})();
			Object.defineProperty(document, "hidden", {
				configurable: true,
				get: () => false
			});
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "visible"
			});
			const visibilityBlocker = (e) => {
				e.stopImmediatePropagation();
			};
			document.addEventListener("visibilitychange", visibilityBlocker, true);
			const blurBlocker = (e) => {
				if (e.target === window || e.target === document) e.stopImmediatePropagation();
			};
			window.addEventListener("blur", blurBlocker, true);
			window.addEventListener("focus", blurBlocker, true);
			const restoreDescriptor = (prop, saved) => {
				try {
					if (saved.owner === "instance" && saved.descriptor) Object.defineProperty(document, prop, saved.descriptor);
					else delete document[prop];
				} catch {}
			};
			this.cleanupFunctions.push(() => {
				document.removeEventListener("visibilitychange", visibilityBlocker, true);
				window.removeEventListener("blur", blurBlocker, true);
				window.removeEventListener("focus", blurBlocker, true);
				restoreDescriptor("hidden", savedHidden);
				restoreDescriptor("visibilityState", savedVisibilityState);
			});
		}
	};
	var protectionInstance = null;
	function getSiteProtection() {
		if (!protectionInstance) protectionInstance = new SiteProtection();
		return protectionInstance;
	}
	function normalizeTextForVipDetection(text) {
		return text.replace(/\s+/g, "").replace(/[\u3000]/g, "").replace(/[，。！？、""''（）()【】[\]<>《》:：;；·~…—-]/g, "").toLowerCase();
	}
	function isVipChapterPage(doc) {
		const url = doc._mnrUrl || doc.location?.href || doc.baseURI || "";
		const siteResult = getRuleManager().isVipChapter(doc, url);
		if (siteResult !== null) return siteResult;
		const rawText = doc.body?.textContent || "";
		if (!rawText) return false;
		const text = normalizeTextForVipDetection(rawText);
		if ([
			/本章(?:为|是)?vip章节/,
			/(vip|付费|收费)(?:章节|内容)/,
			/(未订阅|未购买|未解锁).{0,10}(本章|本章节|章节|内容)/,
			/(本章|本章节|章节|内容).{0,12}(?:已)?锁定/,
			/(本章|本章节|章节|内容).{0,12}(?:需|需要).{0,6}(订阅|购买|付费|解锁)/,
			/(订阅|购买|付费|解锁).{0,12}(后|即可|才能|方可|才可).{0,12}(阅读|查看|继续阅读|继续查看)/,
			/(请|需).{0,6}(订阅|购买|付费|解锁).{0,12}(阅读|查看|继续阅读|继续查看)/,
			/立即(订阅|购买|解锁|充值)/,
			/(订阅|购买|解锁)本章/
		].some((re) => re.test(text))) return true;
		const cta = normalizeTextForVipDetection(Array.from(doc.querySelectorAll("a,button,input[type=\"button\"],input[type=\"submit\"]")).map((element) => {
			if (element instanceof HTMLInputElement) return element.value || "";
			return element.textContent || "";
		}).join(" "));
		if (/立即(订阅|购买|解锁|充值)/.test(cta) && /(vip|付费|订阅|购买|解锁|锁定)/.test(text)) return true;
		return false;
	}
	function getChapterDocumentBlockReason(doc) {
		if (isCloudflareChallenge(doc)) return "cloudflare";
		if (isVipChapterPage(doc)) return "vip";
		return null;
	}
	var DetectionEngine = class {
		constructor() {
			this.contentDetector = new ContentDetector();
			this.navigationDetector = new NavigationDetector();
			this.titleDetector = new TitleDetector();
			this.confidenceScorer = new ConfidenceScorer();
		}
		detect(doc = document, currentUrl = window.location.href) {
			const content = this.contentDetector.detect(doc);
			const navigation = this.detectNavigation(doc, currentUrl);
			const results = {
				content,
				navigation,
				title: this.detectTitle(doc),
				section: this.detectSection(doc, currentUrl, navigation)
			};
			return {
				results,
				confidence: this.confidenceScorer.score(results)
			};
		}
		detectTitle(doc = document) {
			return this.titleDetector.detect(doc);
		}
		detectNavigation(doc = document, currentUrl = window.location.href) {
			const navigation = this.navigationDetector.detect(doc, currentUrl);
			return this.navigationDetector.validateNavigation(currentUrl, navigation);
		}
		detectSection(doc = document, currentUrl = window.location.href, navigation) {
			const resolvedNavigation = navigation ?? this.detectNavigation(doc, currentUrl);
			return this.navigationDetector.detectSection(doc, currentUrl, resolvedNavigation);
		}
		quickCheck(doc = document) {
			const currentUrl = doc.location?.href || window.location.href;
			const indicators = [
				() => {
					const title = doc.title;
					return /第.{1,10}章|chapter|小说|阅读/i.test(title);
				},
				() => {
					return [
						"#content",
						"#chapter_content",
						".noveltext",
						"#BookText"
					].some((s) => doc.querySelector(s) !== null);
				},
				() => {
					return Array.from(doc.querySelectorAll("a")).some((a) => /下一[章页节篇回]|下页/i.test(a.textContent || ""));
				},
				() => {
					return (doc.body?.textContent || "").length > 3e3;
				},
				() => {
					const text = doc.body?.textContent || "";
					return /\/chapters?\//i.test(currentUrl) && text.length > 1200;
				}
			];
			let matches = 0;
			for (const check of indicators) try {
				if (check()) {
					matches++;
					if (matches >= 2) return true;
				}
			} catch {}
			return false;
		}
		generateSelector(element) {
			return this.contentDetector.generateSelector(element);
		}
	};
	var TOC_TITLE_PATTERN = /(?:章节目录|章節目錄|章节列表|章節列表|目录|目錄|书目|書目|toc|catalog|contents?)/i;
	var TOC_URL_PATTERN = /(?:^|\/)(?:catalog|toc|contents?|mulu|dir(?:ectory)?|chapterlist|chapters)(?:\/|$)/i;
	var TOC_QUERY_PATTERN = /[?&](?:catalog|toc|contents?)=|[?&](?:mulu|dir)=/i;
	var CHAPTER_URL_STRONG_PATTERN = /\/(?:chapter|chapters?|read|txt|article|novel\/chapters)\/[^?#]*\d/i;
	var CHAPTER_URL_TERMINAL_PATTERN = /\/(?:chapter|chapters?|read|txt|article|novel\/chapters)\/(?:[^/?#]+\/)*\d+(?:\.html?)?\/?$/i;
	var CHAPTER_LINK_TEXT_PATTERN = /第\s*[一二两三四五六七八九十○零百千万亿0-9]{1,9}\s*[章回卷节折篇幕集话話]|Chapter\s*\d+/i;
	var NAV_LINK_TEXT_PATTERN = /(?:下一[章页]|上一[章页]|下一章|上一章|next|prev)/i;
	function parseHttpUrl(url) {
		try {
			const u = new URL(url);
			if (u.protocol !== "http:" && u.protocol !== "https:") return null;
			return u;
		} catch {
			return null;
		}
	}
	function getKindFromUrl(url) {
		const parsed = parseHttpUrl(url);
		if (!parsed) return "other";
		const pathname = parsed.pathname.toLowerCase();
		const search = parsed.search.toLowerCase();
		if (CHAPTER_URL_TERMINAL_PATTERN.test(pathname)) return "chapter";
		if (TOC_URL_PATTERN.test(pathname) || TOC_QUERY_PATTERN.test(search)) return "toc";
		if (CHAPTER_URL_STRONG_PATTERN.test(pathname)) return "chapter";
		return "other";
	}
	function getKindFromTitle(title) {
		if (!title) return "other";
		if (TOC_TITLE_PATTERN.test(title)) return "toc";
		return "other";
	}
	function getKindFromDom(doc) {
		const body = doc.body;
		if (!body) return "other";
		const titleKind = getKindFromTitle(doc.title);
		if (titleKind !== "other") return titleKind;
		const anchors = Array.from(body.querySelectorAll("a[href]"));
		let linkTextLength = 0;
		let chapterLikeLinkCount = 0;
		let navLinkCount = 0;
		for (const anchor of anchors) {
			const text = (anchor.textContent || "").trim();
			if (!text) continue;
			linkTextLength += text.length;
			if (CHAPTER_LINK_TEXT_PATTERN.test(text)) chapterLikeLinkCount++;
			if (NAV_LINK_TEXT_PATTERN.test(text)) navLinkCount++;
		}
		const totalTextLength = (body.textContent || "").length;
		const linkDensity = linkTextLength / Math.max(1, totalTextLength);
		const paragraphCount = body.querySelectorAll("p").length;
		if (chapterLikeLinkCount >= 25 && linkDensity >= .12) return "toc";
		if (anchors.length >= 120 && chapterLikeLinkCount >= 15 && linkDensity >= .08) return "toc";
		if (navLinkCount > 0 && totalTextLength >= 2e3 && chapterLikeLinkCount <= 12 && linkDensity < .25) return "chapter";
		if (totalTextLength >= 8e3 && chapterLikeLinkCount <= 12 && linkDensity < .25) return "chapter";
		if (paragraphCount >= 8 && totalTextLength >= 4e3 && chapterLikeLinkCount <= 12 && linkDensity < .25) return "chapter";
		return "other";
	}
	function getPageKind(url, doc) {
		const kindFromUrl = getKindFromUrl(url);
		if (kindFromUrl !== "other") return kindFromUrl;
		if (!doc) return "other";
		return getKindFromDom(doc);
	}
	function getPageKindFromUrl(url) {
		return getKindFromUrl(url);
	}
	var TEXT_SAMPLE_LIMIT = 12e3;
	var HANS_MARKERS = "体台湾万与书说话网个们这为来会国时后对开关无点风云电长门问间从学见让读听觉发现经过还进远连当应义实战区马龙鸟鱼猫坏搁";
	var HANT_MARKERS = "體臺灣萬與書說話網個們這為來會國時後對開關無點風雲電長門問間從學見讓讀聽覺發現經過還進遠連當應義實戰區馬龍鳥魚貓壞漢聯續乾廣";
	var JPAN_MARKERS = "亜仏仮価児円剣剤労単囲団図壊実対専巣帯広弾悪応抜拡揺桜様権歓歩歳気沢涙渋浜満滝焼獣発県絵絶継続緑縄総芸薬蛍説読転鉄黒竜";
	var HANS_PATTERN = new RegExp(`[${HANS_MARKERS}]`, "g");
	var HANT_PATTERN = new RegExp(`[${HANT_MARKERS}]`, "g");
	var JPAN_PATTERN = new RegExp(`[${JPAN_MARKERS}]`, "g");
	function scriptFromLocale(locale) {
		const tag = locale.trim().toLowerCase().replace(/_/g, "-").split(";")[0];
		if (!tag) return "unknown";
		if (tag === "ja" || tag.startsWith("ja-")) return "jpan";
		if (tag.includes("hans") || /^zh-(?:cn|sg|my)(?:-|$)/.test(tag)) return "hans";
		if (tag.includes("hant") || /^zh-(?:tw|hk|mo)(?:-|$)/.test(tag)) return "hant";
		return "unknown";
	}
	function mergeScript(current, next) {
		if (next === "unknown") return current;
		if (current === "unknown") return next;
		return current === next ? current : "mixed";
	}
	function readLocaleHints(doc) {
		const hints = [doc.documentElement?.getAttribute("lang") || "", doc.documentElement?.getAttribute("xml:lang") || ""];
		for (const meta of Array.from(doc.querySelectorAll("meta"))) {
			const content = meta.getAttribute("content")?.trim();
			if (!content) continue;
			const key = `${meta.getAttribute("http-equiv") || ""} ${meta.getAttribute("name") || ""} ${meta.getAttribute("property") || ""}`.toLowerCase();
			if (key.includes("content-language") || key.includes("og:locale")) hints.push(...content.split(","));
		}
		for (const script of Array.from(doc.querySelectorAll("script[type=\"application/ld+json\"]"))) {
			const matches = (script.textContent || "").matchAll(/"inLanguage"\s*:\s*"([^"]+)"/gi);
			for (const match of matches) hints.push(match[1] || "");
		}
		return hints;
	}
	function countMatches(text, pattern) {
		pattern.lastIndex = 0;
		let count = 0;
		while (pattern.exec(text)) count += 1;
		return count;
	}
	function detectChineseScriptFromText(text) {
		const sample = text.slice(0, TEXT_SAMPLE_LIMIT);
		if (!sample) return "unknown";
		const scores = [
			["hans", countMatches(sample, HANS_PATTERN)],
			["hant", countMatches(sample, HANT_PATTERN)],
			["jpan", countMatches(sample, JPAN_PATTERN)]
		];
		const max = Math.max(...scores.map(([, score]) => score));
		if (max === 0) return "unknown";
		return scores.reduce((script, [candidate, score]) => score >= max * .5 ? mergeScript(script, candidate) : script, "unknown");
	}
	function inferChineseScript(doc, contentText = "") {
		let script = "unknown";
		for (const hint of readLocaleHints(doc)) script = mergeScript(script, scriptFromLocale(hint));
		if (script !== "unknown") return script;
		return detectChineseScriptFromText(contentText || doc.body?.textContent || "");
	}
	var ANTI_COPY_GLYPH_REPAIRS = [{
		source: "伱",
		replacement: "你"
	}];
	function repairAntiCopyText(text) {
		let repaired = text;
		for (const { source, replacement } of ANTI_COPY_GLYPH_REPAIRS) if (repaired.includes(source)) repaired = repaired.split(source).join(replacement);
		return repaired;
	}
	var REMOVE_SELECTOR_QUERY = REMOVE_SELECTORS.join(",");
	var READER_UI_LABELS = new Set([
		"投票推荐",
		"投票推薦",
		"加入书签",
		"加入書籤",
		"添加书签",
		"添加書籤",
		"小说报错",
		"小說報錯",
		"章节报错",
		"章節報錯",
		"关灯",
		"關燈",
		"字体-",
		"字体+",
		"字體-",
		"字體+",
		"上一章",
		"下一章",
		"上一页",
		"下一页",
		"上一頁",
		"下一頁",
		"目录",
		"目錄",
		"章节目录",
		"章節目錄",
		"章节列表",
		"章節列表",
		"返回书目",
		"返回書目",
		"返回目录",
		"返回目錄",
		"加入收藏",
		"加入收藏夹"
	]);
	var READER_UI_BLOCK_SELECTOR = "div, p, span, li, section, nav, header, footer";
	var PARAGRAPH_BLOCK_TAGS = new Set([
		"ADDRESS",
		"ARTICLE",
		"ASIDE",
		"BLOCKQUOTE",
		"CAPTION",
		"COLGROUP",
		"DD",
		"DETAILS",
		"DIV",
		"DL",
		"DT",
		"FIELDSET",
		"FIGCAPTION",
		"FIGURE",
		"FOOTER",
		"FORM",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
		"HEADER",
		"HR",
		"LI",
		"MAIN",
		"MENU",
		"NAV",
		"OL",
		"P",
		"PRE",
		"SECTION",
		"SUMMARY",
		"TABLE",
		"TBODY",
		"TD",
		"TFOOT",
		"TH",
		"THEAD",
		"TR",
		"UL"
	]);
	var PARAGRAPH_CONTAINER_TAGS = new Set([
		"ARTICLE",
		"ASIDE",
		"BLOCKQUOTE",
		"DIV",
		"FIGCAPTION",
		"MAIN",
		"SECTION"
	]);
	var DEFAULT_PROCESSING_OPTIONS = {
		removeAds: true,
		normalizeWhitespace: true,
		fixImages: true,
		stripInlineStyles: true
	};
	var ContentProcessor = class {
		constructor(options = {}) {
			this.regexCache = new Map();
			this.defaultOptions = {
				...DEFAULT_PROCESSING_OPTIONS,
				...options
			};
			this.options = { ...this.defaultOptions };
		}
		process(element, doc) {
			if (this.options.useRawContent) {
				let html = element.innerHTML;
				if (this.options.fixImages) html = this.fixImages(html, doc, { center: false });
				return sanitizeHtml(html);
			}
			const clone = element.cloneNode(true);
			this.expandEncodedLoadMoreContent(clone, doc);
			this.removeUnwantedElements(clone);
			if (this.options.removeSelectors) this.removeBySelector(clone, this.options.removeSelectors);
			this.removeReaderUiNoise(clone);
			if (this.options.stripInlineStyles) this.stripInlineStyles(clone);
			const replaceRules = this.options.replaceRules?.length ? this.options.replaceRules : null;
			this.cleanTextNodes(clone, doc, !!this.options.removeAds && !replaceRules);
			let html = clone.innerHTML;
			if (replaceRules) html = this.applyReplaceRules(html, replaceRules);
			if (this.options.removeAds && replaceRules) {
				const temp = doc.createElement("div");
				temp.innerHTML = html;
				this.cleanTextNodes(temp, doc, true);
				html = temp.innerHTML;
			}
			if (this.options.normalizeWhitespace) html = this.normalizeWhitespace(html);
			if (this.options.fixImages) html = this.fixImages(html, doc);
			html = this.convertBrToParagraphs(html, doc);
			html = this.cleanDuplicateInfo(html, doc);
			html = sanitizeHtml(html);
			return html;
		}
		removeReaderUiNoise(container) {
			const normalize = (text) => text.replace(/\s+/g, "").trim();
			const isUiLabel = (text) => {
				const t = normalize(text);
				if (!t) return false;
				if (READER_UI_LABELS.has(t)) return true;
				if (/^字体[+-]$/.test(t) || /^字體[+-]$/.test(t)) return true;
				if (/^(?:上一|下一)(?:章|页|頁)$/.test(t)) return true;
				if (/^(?:章?节|章節)?(?:目录|目錄|列表)$/.test(t)) return true;
				return false;
			};
			const clickables = Array.from(container.querySelectorAll("a, button, label"));
			for (const el of clickables) {
				const t = normalize((el.textContent || "").trim());
				if (!t) continue;
				if (t.length > 12) continue;
				if (isUiLabel(t)) el.remove();
			}
			const blocks = Array.from(container.querySelectorAll(READER_UI_BLOCK_SELECTOR));
			for (const el of blocks) {
				const text = normalize(el.textContent || "");
				if (!text) continue;
				if (text.length > 240) continue;
				const hasPrevNext = (text.includes("上一章") || text.includes("上一頁") || text.includes("上一页")) && (text.includes("下一章") || text.includes("下一頁") || text.includes("下一页"));
				const hasCatalog = text.includes("目录") || text.includes("目錄") || text.includes("章节目录");
				const hasBookmark = text.includes("书签") || text.includes("書籤");
				const hasVote = text.includes("投票推荐") || text.includes("投票推薦");
				const hasReport = text.includes("报错") || text.includes("報錯");
				const hasLight = text.includes("关灯") || text.includes("關燈");
				const hasFont = text.includes("字体") || text.includes("字體");
				const isNavBar = hasPrevNext && (hasCatalog || text.includes("章節目錄"));
				const isTopBar = hasVote && hasBookmark || hasBookmark && hasReport;
				const isFontBar = hasLight && hasFont;
				if ((text.includes("温馨提示") || text.includes("溫馨提示")) && (text.toLowerCase().includes("enter") || text.includes("回车") || text.includes("回車") || text.includes("←") || text.includes("→") || text.includes("按"))) {
					el.remove();
					continue;
				}
				if (isNavBar && text.length <= 120) {
					el.remove();
					continue;
				}
				if ((isTopBar || isFontBar) && text.length <= 160) {
					el.remove();
					continue;
				}
			}
		}
		processToText(element) {
			const clone = element.cloneNode(true);
			this.removeUnwantedElements(clone);
			let text = repairAntiCopyText(clone.textContent || "");
			if (this.options.removeAds) text = this.removeAdPatterns(text);
			if (this.options.normalizeWhitespace) text = text.replace(/\s+/g, " ").trim();
			return text;
		}
		removeUnwantedElements(element) {
			try {
				this.smartQueryAll(element, REMOVE_SELECTOR_QUERY).forEach((el) => el.remove());
				return;
			} catch {
				for (const selector of REMOVE_SELECTORS) try {
					this.smartQueryAll(element, selector).forEach((el) => el.remove());
				} catch {}
			}
		}
		removeBySelector(element, selectors) {
			const selectorList = selectors.split(",").map((s) => s.trim());
			for (const selector of selectorList) try {
				this.smartQueryAll(element, selector).forEach((el) => el.remove());
			} catch {}
		}
		stripInlineStyles(element) {
			element.removeAttribute("style");
			element.querySelectorAll("[style]").forEach((el) => {
				el.removeAttribute("style");
			});
			element.removeAttribute("bgcolor");
			element.querySelectorAll("[bgcolor]").forEach((el) => {
				el.removeAttribute("bgcolor");
			});
		}
		getCachedRegex(pattern, flags) {
			const key = `${pattern}\0${flags}`;
			if (this.regexCache.has(key)) return this.regexCache.get(key);
			try {
				const regex = new RegExp(pattern, flags);
				this.regexCache.set(key, regex);
				return regex;
			} catch {
				this.regexCache.set(key, null);
				return null;
			}
		}
		applyReplaceRules(html, rules) {
			let result = html;
			for (const rule of rules) {
				const regex = this.getCachedRegex(rule.pattern, rule.flags || "g");
				if (regex) result = result.replace(regex, rule.replacement);
			}
			return result;
		}
		removeAdPatterns(text) {
			let result = text;
			for (const pattern of AD_PATTERNS) result = result.replace(pattern, "");
			return result;
		}
		cleanTextNodes(container, doc, removeAds) {
			const showText = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4;
			const walker = doc.createTreeWalker(container, showText);
			let node;
			while (node = walker.nextNode()) {
				const value = node.nodeValue || "";
				const repaired = repairAntiCopyText(value);
				const cleaned = removeAds ? this.removeAdPatterns(repaired) : repaired;
				if (cleaned !== value) node.nodeValue = cleaned;
			}
		}
		normalizeWhitespace(html) {
			return html.replace(/<p>\s*<\/p>/gi, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/<p>\s+/gi, "<p>").replace(/\s+<\/p>/gi, "</p>");
		}
		fixImages(html, doc, options = { center: true }) {
			if (!/<img[\s>/]/i.test(html)) return html;
			const temp = doc.createElement("div");
			temp.innerHTML = html;
			temp.querySelectorAll("img").forEach((img) => {
				const srcAttr = img.getAttribute("src")?.trim() || "";
				if (!srcAttr || srcAttr === "#" || srcAttr === "about:blank" || srcAttr.startsWith("data:") || srcAttr.startsWith("javascript:") || srcAttr.startsWith("vbscript:")) for (const attrName of [
					"data-src",
					"data-original",
					"data-lazy-src",
					"data-original-src",
					"data-url",
					"data-actualsrc",
					"data-echo",
					"data-srcset"
				]) {
					const rawValue = img.getAttribute(attrName)?.trim();
					if (!rawValue) continue;
					const safeUrl = sanitizeUrl(attrName === "data-srcset" ? rawValue.split(",")[0]?.trim().split(/\s+/)[0] : rawValue, {
						allowDataImage: true,
						mode: "strict"
					});
					if (!safeUrl) continue;
					img.setAttribute("src", safeUrl);
					break;
				}
				if (options.center) {
					img.style.display = "block";
					img.style.maxWidth = "100%";
					img.style.margin = "10px auto";
				}
			});
			return temp.innerHTML;
		}
		convertBrToParagraphs(html, doc) {
			const container = doc.createElement("div");
			container.innerHTML = html;
			const hasVisibleContent = (node) => {
				if (node.nodeType === 3) return !!node.nodeValue?.trim();
				return node.nodeType === 1;
			};
			const stripSourceIndent = (paragraph) => {
				const showText = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4;
				const walker = doc.createTreeWalker(paragraph, showText);
				let node;
				while (node = walker.nextNode()) {
					const value = node.nodeValue || "";
					const normalized = value.replace(/^[\s\u00a0\u2000-\u200b\u202f\u205f\u3000]+/u, "");
					if (normalized !== value) node.nodeValue = normalized;
					if (normalized) break;
				}
			};
			const splitWrappedParagraph = (paragraph) => {
				const nodes = Array.from(paragraph.childNodes);
				if (!nodes.some((node) => node.nodeType === 1 && node.tagName === "BR")) return;
				const segments = [];
				let segment = [];
				const flushSegment = () => {
					if (segment.some(hasVisibleContent)) segments.push(segment);
					segment = [];
				};
				for (const node of nodes) if (node.nodeType === 1 && node.tagName === "BR") flushSegment();
				else segment.push(node);
				flushSegment();
				const sourceIndent = /^[\t\r\n ]*[\u00a0\u2000-\u200b\u202f\u205f\u3000]{2,}/u;
				const followingSegments = segments.slice(1);
				const indentedSegments = followingSegments.filter((nodes) => sourceIndent.test(nodes.map((node) => node.textContent || "").join(""))).length;
				if (segments.length < 2 || indentedSegments < Math.ceil(followingSegments.length * .8)) return;
				const replacements = segments.map((nodes, index) => {
					const replacement = paragraph.cloneNode(false);
					if (index > 0) replacement.removeAttribute("id");
					nodes.forEach((node) => replacement.appendChild(node));
					stripSourceIndent(replacement);
					return replacement;
				});
				paragraph.replaceWith(...replacements);
			};
			const normalizeContainer = (parent) => {
				for (const child of Array.from(parent.children)) if (PARAGRAPH_CONTAINER_TAGS.has(child.tagName)) normalizeContainer(child);
				const nodes = Array.from(parent.childNodes);
				const hasInlineContent = nodes.some((node) => node.nodeType === 3 ? !!node.nodeValue?.trim() : node.nodeType === 1 && node.tagName !== "BR" && !PARAGRAPH_BLOCK_TAGS.has(node.tagName));
				const hasDirectBreak = nodes.some((node) => node.nodeType === 1 && node.tagName === "BR");
				if (!hasInlineContent && !hasDirectBreak) return;
				const fragment = doc.createDocumentFragment();
				let paragraph = null;
				const ensureParagraph = () => {
					if (!paragraph) paragraph = doc.createElement("p");
					return paragraph;
				};
				const flushParagraph = () => {
					if (!paragraph) return;
					if (Array.from(paragraph.childNodes).some(hasVisibleContent)) {
						stripSourceIndent(paragraph);
						if (paragraph.textContent?.trim() || paragraph.querySelector("*")) fragment.appendChild(paragraph);
					}
					paragraph = null;
				};
				for (const node of nodes) {
					if (node.nodeType === 1) {
						const element = node;
						if (element.tagName === "BR") {
							flushParagraph();
							continue;
						}
						if (PARAGRAPH_BLOCK_TAGS.has(element.tagName)) {
							flushParagraph();
							fragment.appendChild(element);
							continue;
						}
					}
					if (node.nodeType === 3 && !node.nodeValue?.trim() && !paragraph) continue;
					ensureParagraph().appendChild(node);
				}
				flushParagraph();
				parent.replaceChildren(fragment);
			};
			Array.from(container.querySelectorAll("p")).forEach(splitWrappedParagraph);
			normalizeContainer(container);
			container.querySelectorAll("p").forEach(stripSourceIndent);
			return container.innerHTML;
		}
		setOptions(options) {
			this.options = {
				...this.defaultOptions,
				...options
			};
			this.regexCache.clear();
		}
		cleanDuplicateInfo(html, doc) {
			const { chapterTitle, bookTitle } = this.options;
			let result = html;
			if (chapterTitle && chapterTitle.length > 2) {
				const chapterNumMatch = chapterTitle.match(/^(第[一二三四五六七八九十百千\d]+[章节回话篇集卷])/);
				const chapterNum = chapterNumMatch ? chapterNumMatch[1] : "";
				const titlePatterns = [];
				const escapedTitle = this.escapeRegExp(chapterTitle);
				titlePatterns.push(new RegExp(`^\\s*${escapedTitle}\\s*`, "i"));
				const titleCore = chapterTitle.replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*/, "").trim();
				if (titleCore.length > 1) {
					const escapedCore = this.escapeRegExp(titleCore);
					if (chapterNum) {
						const escapedNum = this.escapeRegExp(chapterNum);
						titlePatterns.push(new RegExp(`^\\s*${escapedNum}\\s*[·•.\\s]*${escapedCore}\\s*`, "i"));
					}
				}
				if (chapterNum) {
					const escapedNum = this.escapeRegExp(chapterNum);
					titlePatterns.push(new RegExp(`^\\s*${escapedNum}[^<]{0,50}\\s*(?=<|$)`, "i"));
				}
				for (const pattern of titlePatterns) {
					result = result.replace(pattern, "");
					result = result.replace(new RegExp(`(<p[^>]*>)\\s*${pattern.source}`, "gi"), "$1").replace(new RegExp(`(<div[^>]*>)\\s*${pattern.source}`, "gi"), "$1").replace(new RegExp(`(<span[^>]*>)\\s*${pattern.source}`, "gi"), "$1");
				}
			}
			const tempDiv = doc.createElement("div");
			tempDiv.innerHTML = result;
			const combinedTitleFingerprint = chapterTitle && bookTitle ? `${bookTitle}${chapterTitle}`.replace(/\s+/g, "").toLowerCase() : "";
			const isRemovableEmptyNode = (node) => {
				if (node.nodeType === Node.TEXT_NODE) return true;
				if (node.nodeType !== Node.ELEMENT_NODE) return true;
				const el = node;
				const tag = el.tagName.toLowerCase();
				if (new Set([
					"img",
					"svg",
					"picture",
					"video",
					"audio",
					"canvas"
				]).has(tag)) return false;
				if (el.children.length > 0) return false;
				return true;
			};
			const children = Array.from(tempDiv.childNodes);
			let removedCount = 0;
			const maxRemove = 3;
			for (const child of children) {
				if (removedCount >= maxRemove) break;
				const text = (child.textContent || "").trim();
				if (!text) {
					if (isRemovableEmptyNode(child)) child.parentNode?.removeChild(child);
					continue;
				}
				if (text.length < 100 && this.looksLikeDuplicateTitle(text)) {
					child.parentNode?.removeChild(child);
					removedCount++;
					continue;
				}
				break;
			}
			for (const child of Array.from(tempDiv.children)) {
				if (child.children.length > 0) continue;
				const text = (child.textContent || "").trim();
				if (!!combinedTitleFingerprint && text.replace(/\s+/g, "").toLowerCase() === combinedTitleFingerprint || /^>+$/.test(text)) child.remove();
			}
			const tailNodes = Array.from(tempDiv.childNodes);
			let tailRemoved = 0;
			const maxTailRemove = 3;
			for (let i = tailNodes.length - 1; i >= 0 && tailRemoved < maxTailRemove; i--) {
				const node = tailNodes[i];
				const text = (node.textContent || "").trim();
				if (!text) {
					if (isRemovableEmptyNode(node)) {
						node.parentNode?.removeChild(node);
						tailRemoved++;
						continue;
					}
					break;
				}
				if (/^>+$/.test(text)) {
					node.parentNode?.removeChild(node);
					tailRemoved++;
					continue;
				}
				break;
			}
			const trailingPatterns = [
				/\s*本章完\s*$/i,
				/\s*\(本章完\)\s*$/i,
				/\s*---+\s*$/,
				/\s*===+\s*$/,
				/\s*\*{3,}\s*$/
			];
			result = tempDiv.innerHTML;
			for (const pattern of trailingPatterns) result = result.replace(pattern, "");
			result = result.replace(/<p>\s*<\/p>/gi, "").replace(/<div>\s*<\/div>/gi, "");
			return result;
		}
		looksLikeDuplicateTitle(text) {
			const { chapterTitle, bookTitle } = this.options;
			const trimmed = text.trim();
			if (chapterTitle) {
				const normalizedTitle = chapterTitle.replace(/\s+/g, "").toLowerCase();
				const normalizedText = trimmed.replace(/\s+/g, "").replace(/[·•.]/g, "").toLowerCase();
				if (normalizedText === normalizedTitle) return true;
				if (normalizedText.includes(normalizedTitle) || normalizedTitle.includes(normalizedText)) return true;
				const titleCore = chapterTitle.replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*/, "").trim();
				const textCore = trimmed.replace(/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]\s*[·•.\s]*/, "").trim();
				if (titleCore && textCore && this.fuzzyMatch(textCore, titleCore)) return true;
			}
			if (bookTitle && this.fuzzyMatch(trimmed, bookTitle)) return true;
			if (/^第[一二三四五六七八九十百千\d]+[章节回话篇集卷]/.test(trimmed)) return true;
			if (/^作者[：:]/i.test(trimmed)) return true;
			return false;
		}
		fuzzyMatch(text, target) {
			if (!text || !target) return false;
			const t1 = text.replace(/\s+/g, "").toLowerCase();
			const t2 = target.replace(/\s+/g, "").toLowerCase();
			if (t1 === t2) return true;
			if (t1.includes(t2) || t2.includes(t1)) return true;
			if (t2.length >= 3) {
				let matches = 0;
				for (const char of t2) if (t1.includes(char)) matches++;
				if (matches / t2.length >= .7) return true;
			}
			return false;
		}
		escapeRegExp(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		smartQueryAll(root, selector) {
			if (!/:(?:contains\(|eq\(|first\b|last\b)/.test(selector)) try {
				return Array.from(root.querySelectorAll(selector));
			} catch {}
			const eqMatch = selector.match(/^(.*):eq\(([-]?\d+)\)$/);
			if (eqMatch) {
				const baseSel = eqMatch[1] || "*";
				const index = parseInt(eqMatch[2], 10);
				try {
					const nodes = Array.from(root.querySelectorAll(baseSel));
					if (nodes.length === 0) return [];
					const idx = index >= 0 ? index : nodes.length + index;
					return nodes[idx] ? [nodes[idx]] : [];
				} catch {
					return [];
				}
			}
			const lastMatch = selector.match(/^(.*):last(?:\(\))?$/);
			if (lastMatch) {
				const baseSel = lastMatch[1] || "*";
				try {
					const nodes = Array.from(root.querySelectorAll(baseSel));
					return nodes.length ? [nodes[nodes.length - 1]] : [];
				} catch {
					return [];
				}
			}
			const firstMatch = selector.match(/^(.*):first(?:\(\))?$/);
			if (firstMatch) {
				const baseSel = firstMatch[1] || "*";
				try {
					const nodes = Array.from(root.querySelectorAll(baseSel));
					return nodes.length ? [nodes[0]] : [];
				} catch {
					return [];
				}
			}
			let currentSel = selector;
			const containsTexts = [];
			const containsRegex = /^(.*):contains\((['"]?)(.*?)\2\)$/;
			while (true) {
				const match = currentSel.match(containsRegex);
				if (!match) break;
				containsTexts.unshift(match[3]);
				currentSel = match[1];
			}
			if (containsTexts.length > 0) {
				const baseSel = currentSel.trim() || "*";
				try {
					let candidates = Array.from(root.querySelectorAll(baseSel));
					for (const text of containsTexts) candidates = candidates.filter((el) => (el.textContent || "").includes(text));
					return candidates;
				} catch {
					return [];
				}
			}
			return [];
		}
		expandEncodedLoadMoreContent(container, doc) {
			const normalizedText = this.normalizeObfuscatedText(container.textContent || "");
			const hasLoadMore = normalizedText.includes("加载更多");
			const hasBlockedHint = normalizedText.includes("无法显示本章节全部内容") || normalizedText.includes("阅读模式") && normalizedText.includes("无法显示");
			if (!hasLoadMore && !hasBlockedHint) return;
			const pKey = this.extractInlinePKey(doc);
			if (!pKey) return;
			const decoded = this.decodeBase64Utf8(pKey);
			if (!decoded) return;
			if (!decoded.includes("<p") || !/[\u4e00-\u9fff]/.test(decoded)) return;
			const decodedPlain = this.normalizeObfuscatedText(decoded.replace(/<[^>]+>/g, ""));
			const decodedTextHead = decodedPlain.slice(0, 60);
			const decodedTextTail = decodedPlain.slice(-60);
			if (decodedTextHead && normalizedText.includes(decodedTextHead)) {
				this.removeLoadMoreUi(container);
				if (decodedTextTail && !normalizedText.includes(decodedTextTail)) container.innerHTML = decoded;
				return;
			}
			this.removeLoadMoreUi(container);
			try {
				container.insertAdjacentHTML("beforeend", decoded);
			} catch {
				const p = doc.createElement("p");
				p.textContent = decoded.replace(/<[^>]+>/g, "");
				container.appendChild(p);
			}
		}
		removeLoadMoreUi(container) {
			for (const p of Array.from(container.querySelectorAll("p"))) {
				const t = this.normalizeObfuscatedText(p.textContent || "");
				if (t.includes("无法显示本章节全部内容") || t.includes("阅读模式") && t.includes("无法显示") || t.includes("请返回原网页阅读")) p.remove();
			}
			const candidates = Array.from(container.querySelectorAll("button, a"));
			for (const el of candidates) {
				const t = this.normalizeObfuscatedText(el.textContent || "");
				if (!t) continue;
				if (t.includes("加载更多") || t.includes("展开更多") || t.includes("查看更多")) {
					const wrapper = el.closest("p");
					if (wrapper) wrapper.remove();
					else el.remove();
				}
			}
		}
		normalizeObfuscatedText(text) {
			return text.replace(/\s+/g, "").replace(/[|｜]/g, "").trim();
		}
		extractInlinePKey(doc) {
			const scripts = Array.from(doc.querySelectorAll("script"));
			for (const script of scripts) {
				const text = script.textContent || "";
				if (!text || !text.includes("p_key")) continue;
				const match = text.match(/p_key\s*=\s*'([^']+)'/);
				if (match?.[1]) return match[1];
				const match2 = text.match(/p_key\s*=\s*"([^"]+)"/);
				if (match2?.[1]) return match2[1];
			}
			return null;
		}
		decodeBase64Utf8(input) {
			const value = (input || "").trim();
			if (!value) return null;
			try {
				if (typeof atob === "function" && typeof TextDecoder !== "undefined") {
					const binary = atob(value);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
					return new TextDecoder("utf-8").decode(bytes);
				}
			} catch {}
			try {
				const B = globalThis.Buffer;
				if (!B || typeof B.from !== "function") return null;
				return String(B.from(value, "base64").toString("utf8"));
			} catch {
				return null;
			}
		}
	};
	var MIN_DYNAMIC_TEXT_LENGTH = 80;
	var GLOBAL_DYNAMIC_WAIT_MS = 600;
	var RULE_DYNAMIC_WAIT_MS = 1500;
	var DYNAMIC_SCROLL_STABLE_MS = 200;
	var DYNAMIC_SCROLL_DELAY_MS = 120;
	var DYNAMIC_SCROLL_MAX_STEPS = 10;
	var Parser = class {
		constructor(options = {}) {
			this.detectionEngine = new DetectionEngine();
			this.contentProcessor = new ContentProcessor(options.processing);
			this.options = options;
		}
		async parse(doc = document, explicitUrl) {
			const url = explicitUrl || doc.location?.href || window.location.href;
			const ruleMatch = getRuleManager().matchRule(url);
			if (ruleMatch && !this.options.forceDetection) return await this.parseWithRule(doc, url, ruleMatch);
			return await this.parseWithDetection(doc, url);
		}
		async parseWithRule(doc, url, ruleMatch) {
			const rule = ruleMatch.rule;
			if (!await this.runBeforeParseHook(rule, doc, url)) return null;
			let contentElement = this.selectElement(doc, rule.content.selector);
			if (this.shouldWaitForRuleContent(rule, contentElement)) {
				await this.waitForRuleContent(doc, rule);
				contentElement = this.selectElement(doc, rule.content.selector);
			}
			if (!contentElement) return await this.parseWithDetection(doc, url, rule);
			let navigation = this.extractNavigation(doc, rule);
			const hasRulePrev = rule.navigation?.prev !== void 0;
			const hasRuleNext = rule.navigation?.next !== void 0;
			const hasRuleIndex = rule.navigation?.index !== void 0;
			if (!navigation.next || !navigation.prev || !navigation.index) {
				const detectedNav = this.detectionEngine.detectNavigation(doc, url);
				if (!hasRuleNext && !navigation.next && detectedNav.next?.url) navigation.next = detectedNav.next.url;
				if (!hasRulePrev && !navigation.prev && detectedNav.prev?.url) navigation.prev = detectedNav.prev.url;
				if (!hasRuleIndex && !navigation.index && detectedNav.index?.url) navigation.index = detectedNav.index.url;
			}
			const title = this.extractTitle(doc, rule);
			const processingOptions = {
				removeSelectors: rule.content.remove,
				replaceRules: rule.content.replace,
				removeAds: rule.processing?.removeAds !== false,
				normalizeWhitespace: rule.processing?.normalizeWhitespace !== false,
				fixImages: rule.processing?.fixImages !== false,
				useRawContent: rule.processing?.useRawContent,
				chapterTitle: title.chapter,
				bookTitle: title.book
			};
			this.contentProcessor.setOptions(processingOptions);
			const rawContent = contentElement.innerHTML;
			const sourceScript = inferChineseScript(doc, this.buildSourceScriptSample(title.chapter, title.book, contentElement));
			const content = this.contentProcessor.process(contentElement, doc);
			return {
				title: title.chapter,
				bookTitle: title.book,
				content,
				rawContent,
				prevUrl: navigation.prev,
				nextUrl: navigation.next,
				indexUrl: navigation.index,
				url,
				confidence: 1,
				rule,
				method: "rule",
				sourceScript
			};
		}
		async parseWithDetection(doc, url, fallbackRule) {
			let detection = this.detectionEngine.detect(doc, url);
			if (this.shouldWaitForDetectionContent(detection.results.content.element)) {
				const selector = detection.results.content.selector || fallbackRule?.content.selector;
				await this.waitForDynamicContent(doc, {
					selector,
					timeoutMs: GLOBAL_DYNAMIC_WAIT_MS,
					minTextLength: MIN_DYNAMIC_TEXT_LENGTH
				});
				detection = this.detectionEngine.detect(doc, url);
			}
			if (!detection.results.content.element) return null;
			const contentElement = detection.results.content.element;
			const navigation = {
				prev: detection.results.navigation.prev?.url,
				next: detection.results.navigation.next?.url,
				index: detection.results.navigation.index?.url
			};
			if (fallbackRule?.navigation) {
				const ruleNav = this.extractNavigation(doc, fallbackRule);
				if (ruleNav.prev) navigation.prev = ruleNav.prev;
				if (ruleNav.next) navigation.next = ruleNav.next;
				if (ruleNav.index) navigation.index = ruleNav.index;
			}
			const chapterTitle = detection.results.title.chapterTitle || "";
			const bookTitle = detection.results.title.bookTitle;
			const processingOptions = {
				removeSelectors: fallbackRule?.content.remove,
				replaceRules: fallbackRule?.content.replace,
				chapterTitle,
				bookTitle
			};
			this.contentProcessor.setOptions(processingOptions);
			const rawContent = contentElement.innerHTML;
			const sourceScript = inferChineseScript(doc, this.buildSourceScriptSample(chapterTitle, bookTitle, contentElement));
			const content = this.contentProcessor.process(contentElement, doc);
			return {
				title: chapterTitle || "Unknown Chapter",
				bookTitle,
				content,
				rawContent,
				prevUrl: navigation.prev,
				nextUrl: navigation.next,
				indexUrl: navigation.index,
				url,
				confidence: detection.confidence.overall,
				rule: fallbackRule,
				method: fallbackRule ? "mixed" : "detection",
				sourceScript
			};
		}
		quickCheck(doc = document) {
			return this.detectionEngine.quickCheck(doc);
		}
		detect(doc = document, url) {
			return this.detectionEngine.detect(doc, url || doc.location?.href || window.location.href);
		}
		detectNavigation(doc = document, url) {
			return this.detectionEngine.detectNavigation(doc, url || doc.location?.href || window.location.href);
		}
		detectSection(doc = document, url) {
			return this.detectionEngine.detectSection(doc, url || doc.location?.href || window.location.href);
		}
		extractNavigation(doc, rule) {
			const result = {};
			const asAnchor = (el) => {
				if (!el) return null;
				if (el.tagName?.toLowerCase() === "a") return el;
				return null;
			};
			const prevSelector = rule.navigation?.prev;
			if (typeof prevSelector === "string" && prevSelector.trim()) {
				const anchor = asAnchor(this.selectElement(doc, prevSelector));
				if (anchor) result.prev = anchor.href;
			}
			const nextSelector = rule.navigation?.next;
			if (typeof nextSelector === "string" && nextSelector.trim()) {
				const anchor = asAnchor(this.selectElement(doc, nextSelector));
				if (anchor) result.next = anchor.href;
			}
			const indexSelector = rule.navigation?.index;
			if (typeof indexSelector === "string" && indexSelector.trim()) {
				const anchor = asAnchor(this.selectElement(doc, indexSelector));
				if (anchor) result.index = anchor.href;
			}
			return result;
		}
		extractTitle(doc, rule) {
			let chapter = "";
			let book;
			let detection = null;
			const getDetection = () => {
				detection ??= this.detectionEngine.detectTitle(doc);
				return detection;
			};
			if (rule.title?.selector) {
				const el = this.selectElement(doc, rule.title.selector);
				if (el) chapter = el.textContent?.trim() || "";
			}
			if (!chapter && rule.title?.pattern) {
				const match = doc.title.match(new RegExp(rule.title.pattern));
				if (match) {
					chapter = match[rule.title.patternIndex ?? 1] || match[1] || match[0];
					const bookPatternIndex = rule.title.bookPatternIndex;
					if (bookPatternIndex && match[bookPatternIndex]) book = match[bookPatternIndex];
				}
			}
			if (!chapter) {
				const detected = getDetection();
				chapter = detected.chapterTitle;
				book = book || detected.bookTitle;
			}
			if (!book && rule.title?.bookSelector) {
				const el = this.selectElement(doc, rule.title.bookSelector);
				if (el) book = el.textContent?.trim();
			}
			if (!book) book = getDetection().bookTitle;
			if (rule.title?.replace && chapter) try {
				chapter = chapter.replace(new RegExp(rule.title.replace), "").trim();
			} catch (e) {
				console.debug("[Parser] Invalid title replace regex:", rule.title.replace, e);
			}
			return {
				chapter,
				book
			};
		}
		selectElement(doc, selector) {
			const selectors = selector.split(",").map((s) => s.trim()).filter(Boolean);
			for (const sel of selectors) {
				const el = this.smartSelect(doc, sel);
				if (el) return el;
			}
			return null;
		}
		buildSourceScriptSample(chapterTitle, bookTitle, contentElement) {
			return [
				chapterTitle,
				bookTitle,
				contentElement.textContent || ""
			].filter(Boolean).join("\n");
		}
		shouldWaitForRuleContent(rule, element) {
			const advanced = rule.advanced;
			if (advanced?.mutationSelector || advanced?.lazyLoadScroll) return true;
			return this.isContentInsufficient(element);
		}
		shouldWaitForDetectionContent(element) {
			return this.isContentInsufficient(element);
		}
		isContentInsufficient(element) {
			if (!element) return true;
			if (element instanceof Element && element.hasAttribute("data-mnr-loading")) return true;
			const text = (element.textContent || "").replace(/\s+/g, "").trim();
			if (!text) return true;
			if (text.length < MIN_DYNAMIC_TEXT_LENGTH) return true;
			if (this.isPlaceholderText(text)) return true;
			return false;
		}
		isPlaceholderText(text) {
			return /加载中|正在加载|内容加载|请稍候|请等待|点击加载|下滑|滚动加载/i.test(text);
		}
		async waitForRuleContent(doc, rule) {
			const advanced = rule.advanced;
			const selector = advanced?.mutationSelector || rule.content.selector;
			const timeoutMs = advanced?.timeout ?? RULE_DYNAMIC_WAIT_MS;
			const minChildCount = advanced?.mutationChildCount;
			const shouldScroll = !!advanced?.lazyLoadScroll;
			await this.waitForDynamicContent(doc, {
				selector,
				minChildCount,
				timeoutMs,
				minTextLength: MIN_DYNAMIC_TEXT_LENGTH,
				scroll: shouldScroll
			});
		}
		async waitForDynamicContent(doc, options) {
			const selector = options.selector?.trim();
			const minTextLength = options.minTextLength ?? MIN_DYNAMIC_TEXT_LENGTH;
			const timeoutMs = options.timeoutMs ?? GLOBAL_DYNAMIC_WAIT_MS;
			const minChildCount = typeof options.minChildCount === "number" && options.minChildCount > 0 ? options.minChildCount : void 0;
			const target = doc.body || doc.documentElement;
			if (!target) return false;
			const getLength = () => {
				if (!selector) return (doc.body?.textContent || "").replace(/\s+/g, "").length;
				const el = this.selectElement(doc, selector);
				if (!el) return 0;
				return (el.textContent || "").replace(/\s+/g, "").length;
			};
			const isReady = () => {
				if (selector) {
					const el = this.selectElement(doc, selector);
					if (!el) return false;
					if ((el.textContent || "").replace(/\s+/g, "").length >= minTextLength && !this.isPlaceholderText(el.textContent || "")) return true;
					if (minChildCount && el.children.length >= minChildCount) return true;
					return false;
				}
				return (doc.body?.textContent || "").replace(/\s+/g, "").length >= minTextLength;
			};
			if (isReady()) return true;
			let resolvePromise = () => {};
			let observer = null;
			let timeoutId;
			let resolved = false;
			const done = (value) => {
				if (resolved) return;
				resolved = true;
				if (observer) observer.disconnect();
				if (timeoutId) window.clearTimeout(timeoutId);
				resolvePromise(value);
			};
			const waitPromise = new Promise((resolve) => {
				resolvePromise = resolve;
				observer = new MutationObserver(() => {
					if (isReady()) done(true);
				});
				observer.observe(target, {
					childList: true,
					subtree: true,
					characterData: true
				});
				timeoutId = window.setTimeout(() => done(isReady()), timeoutMs);
			});
			let scrollPromise = null;
			if (options.scroll) scrollPromise = this.triggerLazyLoadScroll(getLength, timeoutMs);
			const ready = await waitPromise;
			if (scrollPromise) await scrollPromise;
			return ready || isReady();
		}
		async triggerLazyLoadScroll(getLength, timeoutMs) {
			if (typeof window === "undefined" || typeof window.scrollBy !== "function") return;
			const startY = window.scrollY;
			if (startY > 5) return;
			const step = Math.max(window.innerHeight * .8, 400);
			const maxSteps = Math.min(DYNAMIC_SCROLL_MAX_STEPS, Math.max(3, Math.floor(timeoutMs / 130)));
			let lastLength = getLength();
			let stableFor = 0;
			for (let i = 0; i < maxSteps && stableFor < DYNAMIC_SCROLL_STABLE_MS; i++) {
				window.scrollBy({
					top: step,
					behavior: "auto"
				});
				await this.sleep(DYNAMIC_SCROLL_DELAY_MS);
				const length = getLength();
				if (length > lastLength) {
					lastLength = length;
					stableFor = 0;
				} else stableFor += DYNAMIC_SCROLL_DELAY_MS;
			}
			if (window.scrollY !== startY) window.scrollTo({
				top: startY,
				behavior: "auto"
			});
		}
		sleep(ms) {
			return new Promise((resolve) => window.setTimeout(resolve, ms));
		}
		resolveHookFetchUrl(url) {
			return resolveAndValidateHttpUrl(url, window.location.href);
		}
		smartSelect(doc, selector) {
			let nativeError;
			try {
				const native = doc.querySelector(selector);
				if (native) return native;
			} catch (e) {
				nativeError = e;
			}
			const eqMatch = selector.match(/^(.*):eq\(([-]?\d+)\)$/);
			if (eqMatch) {
				const baseSel = eqMatch[1] || "*";
				const index = parseInt(eqMatch[2], 10);
				try {
					const nodes = doc.querySelectorAll(baseSel);
					return nodes[index >= 0 ? index : nodes.length + index] || null;
				} catch (e) {
					console.debug("[Parser] :eq selector failed:", baseSel, e);
					return null;
				}
			}
			const lastMatch = selector.match(/^(.*):last(?:\(\))?$/);
			if (lastMatch) {
				const baseSel = lastMatch[1] || "*";
				try {
					const nodes = doc.querySelectorAll(baseSel);
					return nodes[nodes.length - 1] || null;
				} catch (e) {
					console.debug("[Parser] :last selector failed:", baseSel, e);
					return null;
				}
			}
			const firstMatch = selector.match(/^(.*):first(?:\(\))?$/);
			if (firstMatch) {
				const baseSel = firstMatch[1] || "*";
				try {
					return doc.querySelectorAll(baseSel)[0] || null;
				} catch (e) {
					console.debug("[Parser] :first selector failed:", baseSel, e);
					return null;
				}
			}
			let currentSel = selector;
			const containsTexts = [];
			const containsRegex = /^(.*):contains\((['"]?)(.*?)\2\)$/;
			while (true) {
				const match = currentSel.match(containsRegex);
				if (!match) break;
				containsTexts.unshift(match[3]);
				currentSel = match[1];
			}
			if (containsTexts.length > 0) {
				const baseSel = currentSel.trim() || "*";
				try {
					let candidates = Array.from(doc.querySelectorAll(baseSel));
					for (const text of containsTexts) candidates = candidates.filter((el) => (el.textContent || "").includes(text));
					return candidates[0] || null;
				} catch (e) {
					console.debug("[Parser] :contains selector failed:", baseSel, e);
					return null;
				}
			}
			if (nativeError) console.debug("[Parser] Invalid selector:", selector, nativeError);
			return null;
		}
		async runBeforeParseHook(rule, doc, url) {
			const beforeParse = rule.hooks?.beforeParse;
			if (!beforeParse) return true;
			try {
				await beforeParse(doc, url, this.getHookHelpers());
				return true;
			} catch (e) {
				console.warn("[Parser] beforeParse hook error:", e);
				return false;
			}
		}
		getHookHelpers() {
			return {
				fetchJson: (url, options) => this.fetchJson(url, options),
				fetchText: (url, options) => this.fetchText(url, options)
			};
		}
		async fetchJson(url, options = {}) {
			const responseText = await this.fetchText(url, options);
			if (!responseText) return null;
			try {
				return JSON.parse(responseText);
			} catch {
				return null;
			}
		}
		async fetchText(url, options = {}) {
			const resolved = this.resolveHookFetchUrl(url);
			if (!resolved) {
				console.warn("[Parser] Fetch blocked: invalid or unsafe URL:", url);
				return null;
			}
			const resolvedUrl = new URL(resolved);
			const timeoutMs = options.timeoutMs ?? 4e3;
			const headers = options.headers ?? {};
			const referrer = options.referrer ? resolveAndValidateHttpUrl(options.referrer, window.location.href) || void 0 : void 0;
			const withCredentials = options.withCredentials ?? true;
			const gmXhr = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;
			if (gmXhr) return new Promise((resolve) => {
				const gmHeaders = { ...headers };
				if (referrer && !Object.keys(gmHeaders).some((name) => name.toLowerCase() === "referer")) gmHeaders.Referer = referrer;
				gmXhr({
					method: "GET",
					url: resolvedUrl.href,
					headers: gmHeaders,
					timeout: timeoutMs,
					withCredentials,
					onload: (resp) => resolve(resp.status >= 200 && resp.status < 300 ? resp.responseText || null : null),
					onerror: () => resolve(null),
					ontimeout: () => resolve(null)
				});
			});
			try {
				const controller = new AbortController();
				const timer = window.setTimeout(() => controller.abort(), timeoutMs);
				const fetchHeaders = { ...headers };
				for (const name of Object.keys(fetchHeaders)) if (name.toLowerCase() === "referer") delete fetchHeaders[name];
				const resp = await fetch(resolvedUrl.href, {
					credentials: withCredentials ? "include" : "omit",
					headers: fetchHeaders,
					referrer,
					signal: controller.signal
				});
				window.clearTimeout(timer);
				if (!resp.ok) return null;
				return await resp.text();
			} catch {
				return null;
			}
		}
	};
	var parserInstance = null;
	function getParser() {
		if (!parserInstance) parserInstance = new Parser();
		return parserInstance;
	}
	var STORAGE_KEYS = { SITE_PREFERENCES: "mnr_site_prefs" };
	var RuleStorage = class {
		getSitePreference(domain) {
			try {
				const stored = GM_getValue(STORAGE_KEYS.SITE_PREFERENCES, {});
				return (typeof stored === "object" && stored !== null ? stored : {})[domain] || null;
			} catch (e) {
				console.debug("[RuleStorage] Failed to get site preference:", domain, e);
				return null;
			}
		}
		setSitePreference(domain, pref) {
			try {
				const stored = GM_getValue(STORAGE_KEYS.SITE_PREFERENCES, {});
				const prefs = typeof stored === "object" && stored !== null ? stored : {};
				prefs[domain] = pref;
				GM_setValue(STORAGE_KEYS.SITE_PREFERENCES, prefs);
			} catch (e) {
				console.error("[MNR] Failed to save site preference:", e);
			}
		}
		deleteSitePreference(domain) {
			try {
				const stored = GM_getValue(STORAGE_KEYS.SITE_PREFERENCES, {});
				const prefs = typeof stored === "object" && stored !== null ? stored : {};
				delete prefs[domain];
				GM_setValue(STORAGE_KEYS.SITE_PREFERENCES, prefs);
			} catch (e) {
				console.error("[MNR] Failed to delete site preference:", e);
			}
		}
	};
	var storageInstance = null;
	function getRuleStorage() {
		if (!storageInstance) storageInstance = new RuleStorage();
		return storageInstance;
	}
	var DEFAULT_OPTIONS = {
		confidenceThreshold: .6,
		autoLaunchThreshold: .9,
		enableProtection: true,
		skipPatterns: [
			/\/(login|register|auth|account)/i,
			/\/(search|find)/i,
			/\/(cart|checkout|pay)/i,
			/\/(user|profile|setting)/i,
			/\/(forum|comment|review)/i,
			/\/(download|upload)/i
		]
	};
	var AutoEnableManager = class {
		recordDecision(url, decision) {
			this.currentDecision = decision;
			this.currentDecisionUrl = url;
			return decision;
		}
		activateProtection() {
			if (!this.options.enableProtection) return;
			const protection = getSiteProtection();
			protection.activate(this.options.protectionOptions);
			if (this.options.protectionOptions?.cleanupScripts) protection.removeOverlays();
		}
		deactivateProtection() {
			if (this.options.enableProtection) getSiteProtection().deactivate();
		}
		constructor(options = {}) {
			this.hasRun = false;
			this.launchVersion = 0;
			this.pendingLaunch = null;
			this.options = {
				...DEFAULT_OPTIONS,
				...options
			};
			this.detectionEngine = new DetectionEngine();
			this.parser = new Parser({ forceDetection: options.forceDetection });
			this.sectionMerger = createSectionMerger(this.parser);
		}
		updateOptions(options = {}) {
			this.options = {
				...this.options,
				...options
			};
			if (Object.prototype.hasOwnProperty.call(options, "forceDetection")) {
				this.parser = new Parser({ forceDetection: options.forceDetection });
				this.sectionMerger = createSectionMerger(this.parser);
			}
		}
		setPromptCallback(callback) {
			this.promptCallback = callback;
		}
		setLaunchCallback(callback) {
			this.launchCallback = callback;
		}
		check(doc = document) {
			const url = doc.location?.href || window.location.href;
			const decide = (decision) => this.recordDecision(url, decision);
			const blockReason = getChapterDocumentBlockReason(doc);
			if (blockReason === "cloudflare") return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["Cloudflare Challenge 页面，等待验证完成"]
			});
			if (blockReason === "vip") return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["VIP/付费章节，跳过阅读器解析"]
			});
			if (this.shouldSkip(url)) return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["URL matches skip pattern"]
			});
			const urlPageKind = getPageKindFromUrl(url);
			if (urlPageKind === "toc") return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["目录页，跳过自动启用"]
			});
			const hostname = (() => {
				try {
					return new URL(url).hostname;
				} catch {
					return null;
				}
			})();
			const sitePreference = hostname ? getRuleStorage().getSitePreference(hostname) : null;
			if (urlPageKind === "chapter") {
				if (sitePreference?.enabled === false) return decide({
					shouldEnable: false,
					method: "user-disabled",
					confidence: 0,
					reasons: ["用户已关闭该站点自动启用"],
					showManualEntry: true
				});
				if (sitePreference?.enabled === true) return decide({
					shouldEnable: true,
					method: "site-preference",
					confidence: 1,
					reasons: ["用户已为该站点开启自动启用"]
				});
			}
			if (!this.options.forceDetection) {
				const ruleMatch = getRuleManager().matchRule(url);
				if (ruleMatch) {
					if (sitePreference?.enabled === false) return decide({
						shouldEnable: false,
						method: "user-disabled",
						confidence: 0,
						reasons: ["用户已关闭该站点自动启用"],
						showManualEntry: true
					});
					return decide({
						shouldEnable: true,
						method: "builtin-rule",
						confidence: 1,
						rule: ruleMatch.rule,
						reasons: [`Matched builtin rule: ${ruleMatch.rule.name || ruleMatch.rule.id}`]
					});
				}
			}
			const pageKind = urlPageKind === "other" ? getPageKind(url, doc) : urlPageKind;
			if (pageKind === "toc") return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["目录页，跳过自动启用"]
			});
			if (sitePreference?.enabled === false) return decide({
				shouldEnable: false,
				method: "user-disabled",
				confidence: 0,
				reasons: ["用户已关闭该站点自动启用"],
				showManualEntry: true
			});
			if (sitePreference?.enabled === true) return decide({
				shouldEnable: true,
				method: "site-preference",
				confidence: 1,
				reasons: ["用户已为该站点开启自动启用"]
			});
			if (pageKind !== "chapter") return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["非正文页，跳过自动启用"]
			});
			if (!this.detectionEngine.quickCheck(doc)) return decide({
				shouldEnable: false,
				method: "manual",
				confidence: 0,
				reasons: ["Page does not appear to be novel content"]
			});
			const detection = this.detectionEngine.detect(doc, doc.location?.href || window.location.href);
			return decide({
				shouldEnable: detection.confidence.overall >= (this.options.confidenceThreshold || .6),
				method: "detection",
				confidence: detection.confidence.overall,
				detection,
				reasons: detection.confidence.reasons
			});
		}
		async execute(doc = document) {
			if (this.hasRun) return;
			this.hasRun = true;
			const currentUrl = doc.location?.href || window.location.href;
			const decision = this.currentDecision && this.currentDecisionUrl === currentUrl ? this.currentDecision : this.check(doc);
			if (!decision.shouldEnable) {
				this.deactivateProtection();
				return;
			}
			if (decision.method === "builtin-rule" || decision.confidence >= (this.options.autoLaunchThreshold || .9)) {
				await this.launch(doc, decision.rule);
				return;
			}
			if (this.promptCallback) {
				this.deactivateProtection();
				const launchVersion = this.launchVersion;
				const response = await this.promptCallback();
				if (launchVersion !== this.launchVersion) return;
				if (response.accepted) {
					if (await this.launch(doc, decision.rule) && response.rememberForSite) this.rememberSiteEnabled(doc);
				}
				return;
			}
			this.deactivateProtection();
		}
		launch(doc, rule) {
			if (!this.pendingLaunch) {
				this.launchVersion++;
				this.pendingLaunch = this.parseAndLaunch(doc, rule).finally(() => {
					this.pendingLaunch = null;
				});
			}
			return this.pendingLaunch;
		}
		async parseAndLaunch(doc, rule) {
			this.activateProtection();
			const controller = new AbortController();
			let launchedEarly = false;
			try {
				const currentUrl = doc.location?.href || window.location.href;
				const chapter = await streamSectionMerge(this.sectionMerger, doc, currentUrl, controller.signal, (firstPage, progress) => {
					if (!this.launchCallback) return;
					launchedEarly = true;
					return this.launchCallback({
						stage: "initial",
						chapter: firstPage,
						rule: rule || firstPage.rule,
						progress,
						abort: () => controller.abort()
					});
				});
				if (launchedEarly) return chapter ? "complete" : "initial";
				if (chapter && this.launchCallback) {
					this.launchCallback({
						stage: "complete",
						chapter,
						rule: rule || chapter.rule
					});
					return "complete";
				}
				this.deactivateProtection();
				return false;
			} catch (e) {
				console.error("[AutoEnableManager] Parse error:", e);
				if (launchedEarly) return "initial";
				this.deactivateProtection();
				return false;
			}
		}
		rememberSiteEnabled(doc) {
			const url = doc.location?.href || window.location.href;
			if (getPageKind(url, doc) !== "chapter") return;
			try {
				const hostname = new URL(url).hostname;
				const storage = getRuleStorage();
				if (storage.getSitePreference(hostname)) return;
				storage.setSitePreference(hostname, {
					enabled: true,
					timestamp: Date.now()
				});
			} catch (e) {
				console.error("[AutoEnableManager] Failed to save site preference:", e);
			}
		}
		shouldSkip(url) {
			return (this.options.skipPatterns || []).some((pattern) => pattern.test(url));
		}
		getDecision() {
			return this.currentDecision;
		}
		reset() {
			this.hasRun = false;
			this.currentDecision = void 0;
			this.currentDecisionUrl = void 0;
		}
		async manualEnable(doc = document) {
			const blockReason = getChapterDocumentBlockReason(doc);
			if (blockReason) {
				console.info(`[AutoEnableManager] Manual enable skipped: ${blockReason}`);
				this.deactivateProtection();
				return;
			}
			if (await this.launch(doc) === "complete") this.rememberSiteEnabled(doc);
		}
	};
	var managerInstance = null;
	function getAutoEnableManager(options) {
		if (!managerInstance) managerInstance = new AutoEnableManager(options);
		else if (options) managerInstance.updateOptions(options);
		return managerInstance;
	}
	var VERSION = "1.0.7";
	var BUILD_DATE = "2026-09-21";
	var SENSITIVE_QUERY_KEY = /(?:^|[_-])(?:token|auth|session|sid|key|sign|signature|ticket|password|passwd|pwd|jwt|credential|access|refresh|challenge|chl)(?:[_-]|$)|^__cf_|^_csrfToken$/i;
	function redactUrl(url) {
		if (!url) return null;
		try {
			const parsed = new URL(url, typeof window !== "undefined" ? window.location.href : void 0);
			parsed.username = parsed.username ? "__redacted__" : "";
			parsed.password = parsed.password ? "__redacted__" : "";
			for (const key of Array.from(parsed.searchParams.keys())) if (SENSITIVE_QUERY_KEY.test(key)) parsed.searchParams.set(key, "__redacted__");
			return parsed.toString();
		} catch {
			return truncateDebugString(url);
		}
	}
	function truncateDebugString(value, limit = 500) {
		if (value.length <= limit) return value;
		return `${value.slice(0, limit)}...<truncated:${value.length - limit}>`;
	}
	function sanitizeDebugString(value, limit = 500) {
		return truncateDebugString(value.replace(/https?:\/\/[^\s"'<>）)]+/gi, (match) => redactUrl(match) || match), limit);
	}
	function hashText(value) {
		const text = value || "";
		let hash = 2166136261;
		for (let i = 0; i < text.length; i += 1) {
			hash ^= text.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
	}
	function htmlTextLength(html) {
		if (!html) return 0;
		return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/gi, " ").trim().length;
	}
	function tailStrings(values, limit = 8) {
		return Array.from(values).slice(-limit).map((value) => redactUrl(value) || "");
	}
	function toDebugValue(value, depth = 3) {
		return toDebugValueInternal(value, depth, new WeakSet());
	}
	function toDebugValueInternal(value, depth, seen) {
		if (value === null || value === void 0) return null;
		if (typeof value === "string") return looksLikeUrl(value) ? redactUrl(value) : sanitizeDebugString(value);
		if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
		if (typeof value === "boolean") return value;
		if (typeof value === "bigint") return value.toString();
		if (typeof value === "function" || typeof value === "symbol") return null;
		if (value instanceof Error) return {
			name: value.name,
			message: sanitizeDebugString(value.message),
			stack: value.stack ? sanitizeDebugString(value.stack, 1200) : null
		};
		if (value instanceof URL) return redactUrl(value.toString());
		if (typeof value !== "object") return truncateDebugString(String(value));
		if (seen.has(value)) return "[Circular]";
		if (depth <= 0) return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;
		seen.add(value);
		if (Array.isArray(value)) {
			const result = value.slice(0, 30).map((item) => toDebugValueInternal(item, depth - 1, seen));
			if (value.length > 30) result.push(`...<truncated:${value.length - 30}>`);
			seen.delete(value);
			return result;
		}
		if (value instanceof Map) {
			const result = {};
			let count = 0;
			for (const [key, item] of value) {
				if (count >= 30) break;
				result[String(key)] = toDebugValueInternal(item, depth - 1, seen);
				count += 1;
			}
			seen.delete(value);
			return result;
		}
		if (value instanceof Set) {
			const result = Array.from(value).slice(0, 30).map((item) => toDebugValueInternal(item, depth - 1, seen));
			seen.delete(value);
			return result;
		}
		const result = {};
		let count = 0;
		for (const [key, item] of Object.entries(value)) {
			if (count >= 40) {
				result.__truncated__ = "true";
				break;
			}
			result[key] = toDebugValueInternal(item, depth - 1, seen);
			count += 1;
		}
		seen.delete(value);
		return result;
	}
	function looksLikeUrl(value) {
		return /^https?:\/\//i.test(value) || /^\/[^\s]*\?/.test(value);
	}
	var MAX_DEBUG_EVENTS = 50;
	var events = [];
	function recordDebugEvent(type, detail, level = "info") {
		events.push({
			at: new Date().toISOString(),
			t: Date.now(),
			level,
			type,
			detail: detail === void 0 ? void 0 : toDebugValue(detail)
		});
		if (events.length > MAX_DEBUG_EVENTS) events.splice(0, events.length - MAX_DEBUG_EVENTS);
	}
	function getDebugEvents() {
		return events.map((event) => ({ ...event }));
	}
	function installGlobalDebugErrorListeners() {
		if (typeof window === "undefined") return;
		const marker = "__mnrDebugErrorListenersInstalled__";
		const target = window;
		if (target[marker]) return;
		target[marker] = true;
		window.addEventListener("error", (event) => {
			recordDebugEvent("window.error", {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				error: event.error instanceof Error ? event.error.message : null
			}, "error");
		});
		window.addEventListener("unhandledrejection", (event) => {
			recordDebugEvent("window.unhandledrejection", { reason: event.reason instanceof Error ? event.reason.message : event.reason }, "error");
		});
	}
	function buildDiagnosticInfo(options = {}) {
		return {
			schema: "mnr-debug-v1",
			generatedAt: new Date().toISOString(),
			app: {
				version: VERSION,
				buildDate: BUILD_DATE,
				bootstrap: options.bootstrap,
				gm: getGmSnapshot()
			},
			browser: getBrowserSnapshot(),
			page: getPageSnapshot(),
			config: options.configStore ? getConfigSnapshot(options.configStore) : null,
			reader: options.readerStore?.getDebugSnapshot ? toDebugValue(options.readerStore.getDebugSnapshot(), 5) : null,
			recentEvents: getDebugEvents().map((event) => toDebugValue(event, 4))
		};
	}
	async function copyDiagnosticInfo(options = {}) {
		recordDebugEvent("debug.copy.request", { readerActive: Boolean(options.readerStore?.isActive) });
		const info = buildDiagnosticInfo(options);
		const text = JSON.stringify(info, null, 2);
		try {
			await writeClipboard(text);
			recordDebugEvent("debug.copy.success", {
				bytes: text.length,
				readerActive: Boolean(options.readerStore?.isActive)
			});
			options.notify?.("诊断信息已复制", "info");
			return {
				ok: true,
				text,
				info
			};
		} catch (error) {
			recordDebugEvent("debug.copy.failure", { error }, "error");
			options.notify?.("诊断信息复制失败", "error");
			return {
				ok: false,
				text,
				info,
				error
			};
		}
	}
	async function writeClipboard(text) {
		let gmError;
		if (typeof GM_setClipboard !== "undefined") try {
			GM_setClipboard(text);
			return;
		} catch (error) {
			gmError = error;
		}
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return;
		}
		if (gmError) throw gmError;
		throw new Error("No clipboard API available");
	}
	function getGmSnapshot() {
		if (typeof GM_info === "undefined") return null;
		return toDebugValue({
			scriptName: GM_info.script?.name,
			scriptVersion: GM_info.script?.version,
			managerVersion: GM_info.version
		});
	}
	function getBrowserSnapshot() {
		if (typeof window === "undefined" || typeof navigator === "undefined") return null;
		return toDebugValue({
			userAgent: navigator.userAgent,
			platform: navigator.platform,
			language: navigator.language,
			languages: Array.from(navigator.languages || []),
			viewport: {
				innerWidth: window.innerWidth,
				innerHeight: window.innerHeight,
				devicePixelRatio: window.devicePixelRatio
			},
			screen: typeof screen !== "undefined" ? {
				width: screen.width,
				height: screen.height,
				availWidth: screen.availWidth,
				availHeight: screen.availHeight
			} : null,
			visibilityState: document.visibilityState,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
		});
	}
	function getPageSnapshot() {
		if (typeof window === "undefined" || typeof document === "undefined") return null;
		const bodyText = document.body?.textContent || "";
		const bodyHtml = document.body?.innerHTML || "";
		return toDebugValue({
			href: redactUrl(window.location.href),
			origin: window.location.origin,
			pathname: window.location.pathname,
			title: truncateDebugString(document.title || ""),
			readyState: document.readyState,
			visibilityState: document.visibilityState,
			bodyTextChars: bodyText.length,
			bodyHtmlChars: bodyHtml.length,
			bodyTextHash: hashText(bodyText),
			bodyTextApproxChars: htmlTextLength(bodyHtml),
			pageFlags: getPageFlags(),
			mnrRoots: {
				readerRoot: Boolean(document.getElementById("mnr-reader-root")),
				entryPromptRoot: Boolean(document.getElementById("mnr-entry-prompt-root")),
				readerEntryRoot: Boolean(document.getElementById("mnr-entry-root")),
				hideOriginalStyle: Boolean(document.getElementById("mnr-hide-original"))
			},
			historyState: toDebugValue(window.history.state)
		});
	}
	function getPageFlags() {
		const title = (document.title || "").toLowerCase();
		const text = (document.body?.textContent || "").toLowerCase();
		const html = document.documentElement?.innerHTML?.toLowerCase() || "";
		return toDebugValue({
			cloudflareLike: title.includes("just a moment") || text.includes("cloudflare") || html.includes("cf-challenge") || Boolean(document.querySelector(".cf-turnstile, input[name=\"cf-turnstile-response\"]")),
			loginLike: /登录|登錄|login|sign in|注册|註冊/.test(text.slice(0, 5e3)),
			noBody: !document.body
		});
	}
	function getConfigSnapshot(configStore) {
		return toDebugValue({
			themeId: configStore.themeId,
			reading: {
				fontSize: configStore.reading.fontSize,
				lineHeight: configStore.reading.lineHeight,
				letterSpacing: configStore.reading.letterSpacing,
				paragraphIndent: configStore.reading.paragraphIndent,
				maxWidth: configStore.reading.maxWidth,
				padding: configStore.reading.padding,
				textConversion: configStore.reading.textConversion,
				fontFamily: configStore.reading.fontFamily
			},
			behavior: configStore.behavior,
			protection: configStore.protection,
			customCssChars: configStore.customCSS.length
		});
	}
	function captureHostPageSnapshot() {
		if (typeof window === "undefined" || typeof document === "undefined") return null;
		return {
			url: window.location.href,
			title: document.title,
			state: window.history.state
		};
	}
	function syncHostPageToChapter(chapter, index) {
		if (!chapter) return;
		if (typeof window === "undefined" || typeof document === "undefined") return;
		const chapterTitle = chapter.title.trim();
		const bookTitle = chapter.bookTitle?.trim() || "";
		const title = chapterTitle && bookTitle && chapterTitle !== bookTitle ? `${chapterTitle} - ${bookTitle}` : chapterTitle || bookTitle;
		if (!chapter.url) {
			if (title) document.title = title;
			return;
		}
		const currentState = window.history.state;
		const stateBase = currentState && typeof currentState === "object" && !Array.isArray(currentState) ? currentState : {};
		try {
			window.history.replaceState({
				...stateBase,
				mnr: true,
				mnrChapter: index,
				chapterUrl: chapter.url
			}, "", chapter.url);
		} catch {}
		if (title) document.title = title;
	}
	function restoreHostPageSnapshot(snapshot) {
		if (!snapshot) return;
		if (typeof window === "undefined" || typeof document === "undefined") return;
		try {
			window.history.replaceState(snapshot.state ?? null, "", snapshot.url);
		} catch {}
		document.title = snapshot.title;
	}
	function makeMap(str) {
		const map = Object.create(null);
		for (const key of str.split(",")) map[key] = 1;
		return (val) => val in map;
	}
	var EMPTY_OBJ = {};
	var EMPTY_ARR = [];
	var NOOP = () => {};
	var NO = () => false;
	var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
	var isModelListener = (key) => key.startsWith("onUpdate:");
	var extend = Object.assign;
	var remove = (arr, el) => {
		const i = arr.indexOf(el);
		if (i > -1) arr.splice(i, 1);
	};
	var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
	var hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
	var isArray = Array.isArray;
	var isMap = (val) => toTypeString(val) === "[object Map]";
	var isSet = (val) => toTypeString(val) === "[object Set]";
	var isDate = (val) => toTypeString(val) === "[object Date]";
	var isFunction = (val) => typeof val === "function";
	var isString = (val) => typeof val === "string";
	var isSymbol = (val) => typeof val === "symbol";
	var isObject = (val) => val !== null && typeof val === "object";
	var isPromise = (val) => {
		return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
	};
	var objectToString = Object.prototype.toString;
	var toTypeString = (value) => objectToString.call(value);
	var toRawType = (value) => {
		return toTypeString(value).slice(8, -1);
	};
	var isPlainObject$1 = (val) => toTypeString(val) === "[object Object]";
	var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
	var isReservedProp = makeMap(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted");
	var cacheStringFunction = (fn) => {
		const cache = Object.create(null);
		return ((str) => {
			return cache[str] || (cache[str] = fn(str));
		});
	};
	var camelizeRE = /-\w/g;
	var camelize = cacheStringFunction((str) => {
		return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
	});
	var hyphenateRE = /\B([A-Z])/g;
	var hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, "-$1").toLowerCase());
	var capitalize = cacheStringFunction((str) => {
		return str.charAt(0).toUpperCase() + str.slice(1);
	});
	var toHandlerKey = cacheStringFunction((str) => {
		return str ? `on${capitalize(str)}` : ``;
	});
	var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
	var invokeArrayFns = (fns, ...arg) => {
		for (let i = 0; i < fns.length; i++) fns[i](...arg);
	};
	var def = (obj, key, value, writable = false) => {
		Object.defineProperty(obj, key, {
			configurable: true,
			enumerable: false,
			writable,
			value
		});
	};
	var looseToNumber = (val) => {
		const n = parseFloat(val);
		return isNaN(n) ? val : n;
	};
	var toNumber = (val) => {
		const n = isString(val) ? Number(val) : NaN;
		return isNaN(n) ? val : n;
	};
	var _globalThis;
	var getGlobalThis = () => {
		return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
	};
	function normalizeStyle(value) {
		if (isArray(value)) {
			const res = {};
			for (let i = 0; i < value.length; i++) {
				const item = value[i];
				const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
				if (normalized) for (const key in normalized) res[key] = normalized[key];
			}
			return res;
		} else if (isString(value) || isObject(value)) return value;
	}
	var listDelimiterRE = /;(?![^(]*\))/g;
	var propertyDelimiterRE = /:([^]+)/;
	var styleCommentRE = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
	function parseStringStyle(cssText) {
		const ret = {};
		cssText.replace(styleCommentRE, (match) => match.startsWith("/*") ? "" : match).split(listDelimiterRE).forEach((item) => {
			if (item) {
				const tmp = item.split(propertyDelimiterRE);
				tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
			}
		});
		return ret;
	}
	function normalizeClass(value) {
		let res = "";
		if (isString(value)) res = value;
		else if (isArray(value)) for (let i = 0; i < value.length; i++) {
			const normalized = normalizeClass(value[i]);
			if (normalized) res += normalized + " ";
		}
		else if (isObject(value)) {
			for (const name in value) if (value[name]) res += name + " ";
		}
		return res.trim();
	}
	var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
	var isSpecialBooleanAttr = makeMap(specialBooleanAttrs);
	specialBooleanAttrs + "";
	function includeBooleanAttr(value) {
		return !!value || value === "";
	}
	function looseCompareArrays(a, b, seen) {
		if (a.length !== b.length) return false;
		let equal = true;
		for (let i = 0; equal && i < a.length; i++) equal = looseEqual(a[i], b[i], seen);
		return equal;
	}
	function looseCompareCollections(a, b, seen) {
		if (a.size !== b.size) return false;
		const candidates = Array.from(b);
		const matched = new Uint8Array(candidates.length);
		for (const item of a) {
			let index = -1;
			for (let i = 0; i < candidates.length; i++) if (!matched[i] && looseEqual(item, candidates[i], seen)) {
				index = i;
				break;
			}
			if (index < 0) return false;
			matched[index] = 1;
		}
		return true;
	}
	function looseCompareObjects(a, b, seen) {
		let aValidType = isMap(a);
		let bValidType = isMap(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
		aValidType = isSet(a);
		bValidType = isSet(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
		if (Object.keys(a).length !== Object.keys(b).length) return false;
		for (const key in a) {
			const aHasKey = a.hasOwnProperty(key);
			const bHasKey = b.hasOwnProperty(key);
			if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key], seen)) return false;
		}
		return String(a) === String(b);
	}
	function looseCompareNested(a, b, seen, compare) {
		if (!seen) seen = [new Map(), new Map()];
		const [seenA, seenB] = seen;
		if (seenA.has(a) || seenB.has(b)) return seenA.get(a) === b && seenB.get(b) === a;
		seenA.set(a, b);
		seenB.set(b, a);
		const equal = compare(a, b, seen);
		seenA.delete(a);
		seenB.delete(b);
		return equal;
	}
	function looseEqual(a, b, seen) {
		if (a === b) return true;
		let aValidType = isDate(a);
		let bValidType = isDate(b);
		if (aValidType || bValidType) return aValidType && bValidType ? a.getTime() === b.getTime() : false;
		aValidType = isSymbol(a);
		bValidType = isSymbol(b);
		if (aValidType || bValidType) return a === b;
		aValidType = isArray(a);
		bValidType = isArray(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareNested(a, b, seen, looseCompareArrays) : false;
		aValidType = isObject(a);
		bValidType = isObject(b);
		if (aValidType || bValidType) {
			if (!aValidType || !bValidType) return false;
			return looseCompareNested(a, b, seen, looseCompareObjects);
		}
		return String(a) === String(b);
	}
	function looseIndexOf(arr, val) {
		return arr.findIndex((item) => looseEqual(item, val));
	}
	var isRef$1 = (val) => {
		return !!(val && val["__v_isRef"] === true);
	};
	var toDisplayString = (val) => {
		return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
	};
	var replacer = (_key, val) => {
		if (isRef$1(val)) return replacer(_key, val.value);
		else if (isMap(val)) return { [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val2], i) => {
			entries[stringifySymbol(key, i) + " =>"] = val2;
			return entries;
		}, {}) };
		else if (isSet(val)) return { [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v)) };
		else if (isSymbol(val)) return stringifySymbol(val);
		else if (isObject(val) && !isArray(val) && !isPlainObject$1(val)) return String(val);
		return val;
	};
	var stringifySymbol = (v, i = "") => {
		var _a;
		return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
	};
	var activeEffectScope;
	var EffectScope = class {
		constructor(detached = false) {
			this.detached = detached;
			this._active = true;
			this._on = 0;
			this.effects = [];
			this.cleanups = [];
			this._isPaused = false;
			this._warnOnRun = true;
			this.__v_skip = true;
			if (!detached && activeEffectScope) {
				if (activeEffectScope.active) {
					this.parent = activeEffectScope;
					this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
				} else {
					this._active = false;
					this._warnOnRun = false;
				}
			}
		}
		get active() {
			return this._active;
		}
		pause() {
			if (this._active) {
				this._isPaused = true;
				let i, l;
				if (this.scopes) {
					const scopes = this.scopes.slice();
					for (i = 0, l = scopes.length; i < l; i++) scopes[i].pause();
				}
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].pause();
			}
		}
		resume() {
			if (this._active) {
				if (this._isPaused) {
					this._isPaused = false;
					let i, l;
					if (this.scopes) {
						const scopes = this.scopes.slice();
						for (i = 0, l = scopes.length; i < l; i++) scopes[i].resume();
					}
					const effects = this.effects.slice();
					for (i = 0, l = effects.length; i < l; i++) effects[i].resume();
				}
			}
		}
		run(fn) {
			if (this._active) {
				const currentEffectScope = activeEffectScope;
				try {
					activeEffectScope = this;
					return fn();
				} finally {
					activeEffectScope = currentEffectScope;
				}
			}
		}
		on() {
			if (++this._on === 1) {
				this.prevScope = activeEffectScope;
				activeEffectScope = this;
			}
		}
		off() {
			if (this._on > 0 && --this._on === 0) {
				if (activeEffectScope === this) activeEffectScope = this.prevScope;
				else {
					let current = activeEffectScope;
					while (current) {
						if (current.prevScope === this) {
							current.prevScope = this.prevScope;
							break;
						}
						current = current.prevScope;
					}
				}
				this.prevScope = void 0;
			}
		}
		stop(fromParent) {
			if (this._active) {
				this._active = false;
				let i, l;
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].stop();
				this.effects.length = 0;
				for (i = 0, l = this.cleanups.length; i < l; i++) this.cleanups[i]();
				this.cleanups.length = 0;
				if (this.scopes) {
					const scopes = this.scopes.slice();
					for (i = 0, l = scopes.length; i < l; i++) scopes[i].stop(true);
					this.scopes.length = 0;
				}
				if (!this.detached && this.parent && !fromParent) {
					const last = this.parent.scopes.pop();
					if (last && last !== this) {
						this.parent.scopes[this.index] = last;
						last.index = this.index;
					}
				}
				this.parent = void 0;
			}
		}
	};
	function effectScope(detached) {
		return new EffectScope(detached);
	}
	function getCurrentScope() {
		return activeEffectScope;
	}
	function onScopeDispose(fn, failSilently = false) {
		if (activeEffectScope) activeEffectScope.cleanups.push(fn);
	}
	var activeSub;
	var pausedQueueEffects = new WeakSet();
	var ReactiveEffect = class {
		constructor(fn) {
			this.fn = fn;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 5;
			this.next = void 0;
			this.cleanup = void 0;
			this.scheduler = void 0;
			if (activeEffectScope) {
				if (activeEffectScope.active) activeEffectScope.effects.push(this);
				else this.flags &= -2;
			}
		}
		pause() {
			this.flags |= 64;
		}
		resume() {
			if (this.flags & 64) {
				this.flags &= -65;
				if (pausedQueueEffects.has(this)) {
					pausedQueueEffects.delete(this);
					this.trigger();
				}
			}
		}
		notify() {
			if (this.flags & 2 && !(this.flags & 32)) return;
			if (!(this.flags & 8)) batch(this);
		}
		run() {
			if (!(this.flags & 1)) return this.fn();
			this.flags |= 2;
			cleanupEffect(this);
			prepareDeps(this);
			const prevEffect = activeSub;
			const prevShouldTrack = shouldTrack;
			activeSub = this;
			shouldTrack = true;
			try {
				return this.fn();
			} finally {
				cleanupDeps(this);
				activeSub = prevEffect;
				shouldTrack = prevShouldTrack;
				this.flags &= -3;
			}
		}
		stop() {
			if (this.flags & 1) {
				for (let link = this.deps; link; link = link.nextDep) removeSub(link);
				this.deps = this.depsTail = void 0;
				cleanupEffect(this);
				this.onStop && this.onStop();
				this.flags &= -2;
			}
		}
		trigger() {
			if (this.flags & 64) pausedQueueEffects.add(this);
			else if (this.scheduler) this.scheduler();
			else this.runIfDirty();
		}
		runIfDirty() {
			if (isDirty(this)) this.run();
		}
		get dirty() {
			return isDirty(this);
		}
	};
	var batchDepth = 0;
	var batchedSub;
	var batchedComputed;
	function batch(sub, isComputed = false) {
		sub.flags |= 8;
		if (isComputed) {
			sub.next = batchedComputed;
			batchedComputed = sub;
			return;
		}
		sub.next = batchedSub;
		batchedSub = sub;
	}
	function startBatch() {
		batchDepth++;
	}
	function endBatch() {
		if (--batchDepth > 0) return;
		if (batchedComputed) {
			let e = batchedComputed;
			batchedComputed = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				e = next;
			}
		}
		let error;
		while (batchedSub) {
			let e = batchedSub;
			batchedSub = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				if (e.flags & 1) try {
					e.trigger();
				} catch (err) {
					if (!error) error = err;
				}
				e = next;
			}
		}
		if (error) throw error;
	}
	function prepareDeps(sub) {
		for (let link = sub.deps; link; link = link.nextDep) {
			link.version = -1;
			link.prevActiveLink = link.dep.activeLink;
			link.dep.activeLink = link;
		}
	}
	function cleanupDeps(sub) {
		let head;
		let tail = sub.depsTail;
		let link = tail;
		while (link) {
			const prev = link.prevDep;
			if (link.version === -1) {
				if (link === tail) tail = prev;
				removeSub(link);
				removeDep(link);
			} else head = link;
			link.dep.activeLink = link.prevActiveLink;
			link.prevActiveLink = void 0;
			link = prev;
		}
		sub.deps = head;
		sub.depsTail = tail;
	}
	function isDirty(sub) {
		for (let link = sub.deps; link; link = link.nextDep) if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) return true;
		if (sub._dirty) return true;
		return false;
	}
	function refreshComputed(computed) {
		if (computed.flags & 4 && !(computed.flags & 16)) return;
		computed.flags &= -17;
		if (computed.globalVersion === globalVersion) return;
		computed.globalVersion = globalVersion;
		if (!computed.isSSR && computed.flags & 128 && (!computed.deps && !computed._dirty || !isDirty(computed))) return;
		computed.flags |= 2;
		const dep = computed.dep;
		const prevSub = activeSub;
		const prevShouldTrack = shouldTrack;
		activeSub = computed;
		shouldTrack = true;
		try {
			prepareDeps(computed);
			const value = computed.fn(computed._value);
			if (dep.version === 0 || hasChanged(value, computed._value)) {
				computed.flags |= 128;
				computed._value = value;
				dep.version++;
			}
		} catch (err) {
			dep.version++;
			throw err;
		} finally {
			activeSub = prevSub;
			shouldTrack = prevShouldTrack;
			cleanupDeps(computed);
			computed.flags &= -3;
		}
	}
	function removeSub(link, soft = false) {
		const { dep, prevSub, nextSub } = link;
		if (prevSub) {
			prevSub.nextSub = nextSub;
			link.prevSub = void 0;
		}
		if (nextSub) {
			nextSub.prevSub = prevSub;
			link.nextSub = void 0;
		}
		if (dep.subs === link) {
			dep.subs = prevSub;
			if (!prevSub && dep.computed) {
				dep.computed.flags &= -5;
				for (let l = dep.computed.deps; l; l = l.nextDep) removeSub(l, true);
			}
		}
		if (!soft && !--dep.sc && dep.map) dep.map.delete(dep.key);
	}
	function removeDep(link) {
		const { prevDep, nextDep } = link;
		if (prevDep) {
			prevDep.nextDep = nextDep;
			link.prevDep = void 0;
		}
		if (nextDep) {
			nextDep.prevDep = prevDep;
			link.nextDep = void 0;
		}
	}
	var shouldTrack = true;
	var trackStack = [];
	function pauseTracking() {
		trackStack.push(shouldTrack);
		shouldTrack = false;
	}
	function resetTracking() {
		const last = trackStack.pop();
		shouldTrack = last === void 0 ? true : last;
	}
	function cleanupEffect(e) {
		const { cleanup } = e;
		e.cleanup = void 0;
		if (cleanup) {
			const prevSub = activeSub;
			activeSub = void 0;
			try {
				cleanup();
			} finally {
				activeSub = prevSub;
			}
		}
	}
	var globalVersion = 0;
	var Link = class {
		constructor(sub, dep) {
			this.sub = sub;
			this.dep = dep;
			this.version = dep.version;
			this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
		}
	};
	var Dep = class {
		constructor(computed) {
			this.computed = computed;
			this.version = 0;
			this.activeLink = void 0;
			this.subs = void 0;
			this.map = void 0;
			this.key = void 0;
			this.sc = 0;
			this.__v_skip = true;
		}
		track(debugInfo) {
			if (!activeSub || !shouldTrack || activeSub === this.computed) return;
			let link = this.activeLink;
			if (link === void 0 || link.sub !== activeSub) {
				link = this.activeLink = new Link(activeSub, this);
				if (!activeSub.deps) activeSub.deps = activeSub.depsTail = link;
				else {
					link.prevDep = activeSub.depsTail;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
				}
				addSub(link);
			} else if (link.version === -1) {
				link.version = this.version;
				if (link.nextDep) {
					const next = link.nextDep;
					next.prevDep = link.prevDep;
					if (link.prevDep) link.prevDep.nextDep = next;
					link.prevDep = activeSub.depsTail;
					link.nextDep = void 0;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
					if (activeSub.deps === link) activeSub.deps = next;
				}
			}
			return link;
		}
		trigger(debugInfo) {
			this.version++;
			globalVersion++;
			this.notify(debugInfo);
		}
		notify(debugInfo) {
			startBatch();
			try {
				for (let link = this.subs; link; link = link.prevSub) if (link.sub.notify()) link.sub.dep.notify();
			} finally {
				endBatch();
			}
		}
	};
	function addSub(link) {
		link.dep.sc++;
		if (link.sub.flags & 4) {
			const computed = link.dep.computed;
			if (computed && !link.dep.subs) {
				computed.flags |= 20;
				for (let l = computed.deps; l; l = l.nextDep) addSub(l);
			}
			const currentTail = link.dep.subs;
			if (currentTail !== link) {
				link.prevSub = currentTail;
				if (currentTail) currentTail.nextSub = link;
			}
			link.dep.subs = link;
		}
	}
	var targetMap = new WeakMap();
	var ITERATE_KEY = Symbol("");
	var MAP_KEY_ITERATE_KEY = Symbol("");
	var ARRAY_ITERATE_KEY = Symbol("");
	function track(target, type, key) {
		if (shouldTrack && activeSub) {
			let depsMap = targetMap.get(target);
			if (!depsMap) targetMap.set(target, depsMap = new Map());
			let dep = depsMap.get(key);
			if (!dep) {
				depsMap.set(key, dep = new Dep());
				dep.map = depsMap;
				dep.key = key;
			}
			dep.track();
		}
	}
	function trigger(target, type, key, newValue, oldValue, oldTarget) {
		const depsMap = targetMap.get(target);
		if (!depsMap) {
			globalVersion++;
			return;
		}
		const run = (dep) => {
			if (dep) dep.trigger();
		};
		startBatch();
		if (type === "clear") depsMap.forEach(run);
		else {
			const targetIsArray = isArray(target);
			const isArrayIndex = targetIsArray && isIntegerKey(key);
			if (targetIsArray && key === "length") {
				const newLength = Number(newValue);
				depsMap.forEach((dep, key2) => {
					if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) run(dep);
				});
			} else {
				if (key !== void 0 || depsMap.has(void 0)) run(depsMap.get(key));
				if (isArrayIndex) run(depsMap.get(ARRAY_ITERATE_KEY));
				switch (type) {
					case "add":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						} else if (isArrayIndex) run(depsMap.get("length"));
						break;
					case "delete":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						}
						break;
					case "set": if (isMap(target)) run(depsMap.get(ITERATE_KEY));
				}
			}
		}
		endBatch();
	}
	function getDepFromReactive(object, key) {
		const depMap = targetMap.get(object);
		return depMap && depMap.get(key);
	}
	function reactiveReadArray(array) {
		const raw = toRaw(array);
		if (raw === array) return raw;
		track(raw, "iterate", ARRAY_ITERATE_KEY);
		if (isShallow(array)) return raw;
		if (!isReadonly(array)) return raw.map(toReactive);
		return isReactive(array) ? raw.map((item) => toReadonly(toReactive(item))) : raw.map(toReadonly);
	}
	function shallowReadArray(arr) {
		track(arr = toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
		return arr;
	}
	function toWrapped(target, item) {
		if (isReadonly(target)) return isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
		return toReactive(item);
	}
	var arrayInstrumentations = {
		__proto__: null,
		[Symbol.iterator]() {
			return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
		},
		concat(...args) {
			return reactiveReadArray(this).concat(...args.map((x) => isArray(x) ? reactiveReadArray(x) : x));
		},
		entries() {
			return iterator(this, "entries", (value) => {
				value[1] = toWrapped(this, value[1]);
				return value;
			});
		},
		every(fn, thisArg) {
			return apply(this, "every", fn, thisArg, void 0, arguments);
		},
		filter(fn, thisArg) {
			return apply(this, "filter", fn, thisArg, (v) => v.map((item) => toWrapped(this, item)), arguments);
		},
		find(fn, thisArg) {
			return apply(this, "find", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findIndex(fn, thisArg) {
			return apply(this, "findIndex", fn, thisArg, void 0, arguments);
		},
		findLast(fn, thisArg) {
			return apply(this, "findLast", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findLastIndex(fn, thisArg) {
			return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
		},
		forEach(fn, thisArg) {
			return apply(this, "forEach", fn, thisArg, void 0, arguments);
		},
		includes(...args) {
			return searchProxy(this, "includes", args);
		},
		indexOf(...args) {
			return searchProxy(this, "indexOf", args);
		},
		join(separator) {
			return reactiveReadArray(this).join(separator);
		},
		lastIndexOf(...args) {
			return searchProxy(this, "lastIndexOf", args);
		},
		map(fn, thisArg) {
			return apply(this, "map", fn, thisArg, void 0, arguments);
		},
		pop() {
			return noTracking(this, "pop");
		},
		push(...args) {
			return noTracking(this, "push", args);
		},
		reduce(fn, ...args) {
			return reduce(this, "reduce", fn, args);
		},
		reduceRight(fn, ...args) {
			return reduce(this, "reduceRight", fn, args);
		},
		shift() {
			return noTracking(this, "shift");
		},
		some(fn, thisArg) {
			return apply(this, "some", fn, thisArg, void 0, arguments);
		},
		splice(...args) {
			return noTracking(this, "splice", args);
		},
		toReversed() {
			return reactiveReadArray(this).toReversed();
		},
		toSorted(comparer) {
			return reactiveReadArray(this).toSorted(comparer);
		},
		toSpliced(...args) {
			return reactiveReadArray(this).toSpliced(...args);
		},
		unshift(...args) {
			return noTracking(this, "unshift", args);
		},
		values() {
			return iterator(this, "values", (item) => toWrapped(this, item));
		}
	};
	function iterator(self, method, wrapValue) {
		const arr = shallowReadArray(self);
		const iter = arr[method]();
		if (arr !== self && !isShallow(self)) {
			iter._next = iter.next;
			iter.next = () => {
				const result = iter._next();
				if (!result.done) result.value = wrapValue(result.value);
				return result;
			};
		}
		return iter;
	}
	var arrayProto = Array.prototype;
	function apply(self, method, fn, thisArg, wrappedRetFn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		const methodFn = arr[method];
		if (methodFn !== arrayProto[method]) {
			const result2 = methodFn.apply(self, args);
			return needsWrap ? toReactive(result2) : result2;
		}
		let wrappedFn = fn;
		if (arr !== self) {
			if (needsWrap) wrappedFn = function(item, index) {
				return fn.call(this, toWrapped(self, item), index, self);
			};
			else if (fn.length > 2) wrappedFn = function(item, index) {
				return fn.call(this, item, index, self);
			};
		}
		const result = methodFn.call(arr, wrappedFn, thisArg);
		return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
	}
	function reduce(self, method, fn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		let wrappedFn = fn;
		let wrapInitialAccumulator = false;
		if (arr !== self) {
			if (needsWrap) {
				wrapInitialAccumulator = args.length === 0;
				wrappedFn = function(acc, item, index) {
					if (wrapInitialAccumulator) {
						wrapInitialAccumulator = false;
						acc = toWrapped(self, acc);
					}
					return fn.call(this, acc, toWrapped(self, item), index, self);
				};
			} else if (fn.length > 3) wrappedFn = function(acc, item, index) {
				return fn.call(this, acc, item, index, self);
			};
		}
		const result = arr[method](wrappedFn, ...args);
		return wrapInitialAccumulator ? toWrapped(self, result) : result;
	}
	function searchProxy(self, method, args) {
		const arr = toRaw(self);
		track(arr, "iterate", ARRAY_ITERATE_KEY);
		const res = arr[method](...args);
		if ((res === -1 || res === false) && isProxy(args[0])) {
			args[0] = toRaw(args[0]);
			return arr[method](...args);
		}
		return res;
	}
	function noTracking(self, method, args = []) {
		pauseTracking();
		startBatch();
		const res = toRaw(self)[method].apply(self, args);
		endBatch();
		resetTracking();
		return res;
	}
	var isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`);
	var builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol));
	function hasOwnProperty(key) {
		if (!isSymbol(key)) key = String(key);
		const obj = toRaw(this);
		track(obj, "has", key);
		return obj.hasOwnProperty(key);
	}
	var BaseReactiveHandler = class {
		constructor(_isReadonly = false, _isShallow = false) {
			this._isReadonly = _isReadonly;
			this._isShallow = _isShallow;
		}
		get(target, key, receiver) {
			if (key === "__v_skip") return target["__v_skip"];
			const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_isShallow") return isShallow2;
			else if (key === "__v_raw") {
				if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) return target;
				return;
			}
			const targetIsArray = isArray(target);
			if (!isReadonly2) {
				let fn;
				if (targetIsArray && (fn = arrayInstrumentations[key])) return fn;
				if (key === "hasOwnProperty") return hasOwnProperty;
			}
			const res = Reflect.get(target, key, isRef(target) ? target : receiver);
			if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) return res;
			if (!isReadonly2) track(target, "get", key);
			if (isShallow2) return res;
			if (isRef(res)) {
				const value = targetIsArray && isIntegerKey(key) ? res : res.value;
				return isReadonly2 && isObject(value) ? readonly(value) : value;
			}
			if (isObject(res)) return isReadonly2 ? readonly(res) : reactive(res);
			return res;
		}
	};
	var MutableReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(false, isShallow2);
		}
		set(target, key, value, receiver) {
			let oldValue = target[key];
			const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
			if (!this._isShallow) {
				const isOldValueReadonly = isReadonly(oldValue);
				if (!isShallow(value) && !isReadonly(value)) {
					oldValue = toRaw(oldValue);
					value = toRaw(value);
				}
				if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) {
					if (isOldValueReadonly) return true;
					else {
						oldValue.value = value;
						return true;
					}
				}
			}
			const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
			const result = Reflect.set(target, key, value, isRef(target) ? target : receiver);
			if (target === toRaw(receiver) && result) {
				if (!hadKey) trigger(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
			}
			return result;
		}
		deleteProperty(target, key) {
			const hadKey = hasOwn(target, key);
			const oldValue = target[key];
			const result = Reflect.deleteProperty(target, key);
			if (result && hadKey) trigger(target, "delete", key, void 0, oldValue);
			return result;
		}
		has(target, key) {
			const result = Reflect.has(target, key);
			if (!isSymbol(key) || !builtInSymbols.has(key)) track(target, "has", key);
			return result;
		}
		ownKeys(target) {
			track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
			return Reflect.ownKeys(target);
		}
	};
	var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(true, isShallow2);
		}
		set(target, key) {
			return true;
		}
		deleteProperty(target, key) {
			return true;
		}
	};
	var mutableHandlers = new MutableReactiveHandler();
	var readonlyHandlers = new ReadonlyReactiveHandler();
	var shallowReactiveHandlers = new MutableReactiveHandler(true);
	var toShallow = (value) => value;
	var getProto = (v) => Reflect.getPrototypeOf(v);
	function createIterableMethod(method, isReadonly2, isShallow2) {
		return function(...args) {
			const target = this["__v_raw"];
			const rawTarget = toRaw(target);
			const targetIsMap = isMap(rawTarget);
			const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
			const isKeyOnly = method === "keys" && targetIsMap;
			const innerIterator = target[method](...args);
			const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
			!isReadonly2 && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
			return extend(Object.create(innerIterator), { next() {
				const { value, done } = innerIterator.next();
				return done ? {
					value,
					done
				} : {
					value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
					done
				};
			} });
		};
	}
	function createReadonlyMethod(type) {
		return function(...args) {
			return type === "delete" ? false : type === "clear" ? void 0 : this;
		};
	}
	function createInstrumentations(readonly, shallow) {
		const instrumentations = {
			get(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "get", key);
					track(rawTarget, "get", rawKey);
				}
				const { has } = getProto(rawTarget);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				if (has.call(rawTarget, key)) return wrap(target.get(key));
				else if (has.call(rawTarget, rawKey)) return wrap(target.get(rawKey));
				else if (target !== rawTarget) target.get(key);
			},
			get size() {
				const target = this["__v_raw"];
				!readonly && track(toRaw(target), "iterate", ITERATE_KEY);
				return target.size;
			},
			has(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "has", key);
					track(rawTarget, "has", rawKey);
				}
				return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
			},
			forEach(callback, thisArg) {
				const observed = this;
				const target = observed["__v_raw"];
				const rawTarget = toRaw(target);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				!readonly && track(rawTarget, "iterate", ITERATE_KEY);
				return target.forEach((value, key) => {
					return callback.call(thisArg, wrap(value), wrap(key), observed);
				});
			}
		};
		extend(instrumentations, readonly ? {
			add: createReadonlyMethod("add"),
			set: createReadonlyMethod("set"),
			delete: createReadonlyMethod("delete"),
			clear: createReadonlyMethod("clear")
		} : {
			add(value) {
				const target = toRaw(this);
				const proto = getProto(target);
				const rawValue = toRaw(value);
				const valueToAdd = !shallow && !isShallow(value) && !isReadonly(value) ? rawValue : value;
				if (!(proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue))) {
					target.add(valueToAdd);
					trigger(target, "add", valueToAdd, valueToAdd);
				}
				return this;
			},
			set(key, value) {
				if (!shallow && !isShallow(value) && !isReadonly(value)) value = toRaw(value);
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get.call(target, key);
				target.set(key, value);
				if (!hadKey) trigger(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
				return this;
			},
			delete(key) {
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get ? get.call(target, key) : void 0;
				const result = target.delete(key);
				if (hadKey) trigger(target, "delete", key, void 0, oldValue);
				return result;
			},
			clear() {
				const target = toRaw(this);
				const hadItems = target.size !== 0;
				const oldTarget = void 0;
				const result = target.clear();
				if (hadItems) trigger(target, "clear", void 0, void 0, oldTarget);
				return result;
			}
		});
		[
			"keys",
			"values",
			"entries",
			Symbol.iterator
		].forEach((method) => {
			instrumentations[method] = createIterableMethod(method, readonly, shallow);
		});
		return instrumentations;
	}
	function createInstrumentationGetter(isReadonly2, shallow) {
		const instrumentations = createInstrumentations(isReadonly2, shallow);
		return (target, key, receiver) => {
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_raw") return target;
			return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
		};
	}
	var mutableCollectionHandlers = { get: createInstrumentationGetter(false, false) };
	var shallowCollectionHandlers = { get: createInstrumentationGetter(false, true) };
	var readonlyCollectionHandlers = { get: createInstrumentationGetter(true, false) };
	var reactiveMap = new WeakMap();
	var shallowReactiveMap = new WeakMap();
	var readonlyMap = new WeakMap();
	var shallowReadonlyMap = new WeakMap();
	function targetTypeMap(rawType) {
		switch (rawType) {
			case "Object":
			case "Array": return 1;
			case "Map":
			case "Set":
			case "WeakMap":
			case "WeakSet": return 2;
			default: return 0;
		}
	}
	function reactive(target) {
		if (isReadonly(target)) return target;
		return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
	}
	function shallowReactive(target) {
		return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
	}
	function readonly(target) {
		return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
	}
	function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
		if (!isObject(target)) return target;
		if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) return target;
		if (target["__v_skip"] || !Object.isExtensible(target)) return target;
		const existingProxy = proxyMap.get(target);
		if (existingProxy) return existingProxy;
		const targetType = targetTypeMap(toRawType(target));
		if (targetType === 0) return target;
		const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
		proxyMap.set(target, proxy);
		return proxy;
	}
	function isReactive(value) {
		if (isReadonly(value)) return isReactive(value["__v_raw"]);
		return !!(value && value["__v_isReactive"]);
	}
	function isReadonly(value) {
		return !!(value && value["__v_isReadonly"]);
	}
	function isShallow(value) {
		return !!(value && value["__v_isShallow"]);
	}
	function isProxy(value) {
		return value ? !!value["__v_raw"] : false;
	}
	function toRaw(observed) {
		const raw = observed && observed["__v_raw"];
		return raw ? toRaw(raw) : observed;
	}
	function markRaw(value) {
		if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) def(value, "__v_skip", true);
		return value;
	}
	var toReactive = (value) => isObject(value) ? reactive(value) : value;
	var toReadonly = (value) => isObject(value) ? readonly(value) : value;
	function isRef(r) {
		return r ? r["__v_isRef"] === true : false;
	}
	function ref(value) {
		return createRef(value, false);
	}
	function createRef(rawValue, shallow) {
		if (isRef(rawValue)) return rawValue;
		return new RefImpl(rawValue, shallow);
	}
	var RefImpl = class {
		constructor(value, isShallow2) {
			this.dep = new Dep();
			this["__v_isRef"] = true;
			this["__v_isShallow"] = false;
			this._rawValue = isShallow2 ? value : toRaw(value);
			this._value = isShallow2 ? value : toReactive(value);
			this["__v_isShallow"] = isShallow2;
		}
		get value() {
			this.dep.track();
			return this._value;
		}
		set value(newValue) {
			const oldValue = this._rawValue;
			const useDirectValue = this["__v_isShallow"] || isShallow(newValue) || isReadonly(newValue);
			newValue = useDirectValue ? newValue : toRaw(newValue);
			if (hasChanged(newValue, oldValue)) {
				this._rawValue = newValue;
				this._value = useDirectValue ? newValue : toReactive(newValue);
				this.dep.trigger();
			}
		}
	};
	function unref(ref2) {
		return isRef(ref2) ? ref2.value : ref2;
	}
	var shallowUnwrapHandlers = {
		get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
		set: (target, key, value, receiver) => {
			const oldValue = target[key];
			if (isRef(oldValue) && !isRef(value)) {
				oldValue.value = value;
				return true;
			} else return Reflect.set(target, key, value, receiver);
		}
	};
	function proxyRefs(objectWithRefs) {
		return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
	}
	function toRefs(object) {
		const ret = isArray(object) ? new Array(object.length) : {};
		for (const key in object) ret[key] = propertyToRef(object, key);
		return ret;
	}
	var ObjectRefImpl = class {
		constructor(_object, key, _defaultValue) {
			this._object = _object;
			this._defaultValue = _defaultValue;
			this["__v_isRef"] = true;
			this._value = void 0;
			this._key = isSymbol(key) ? key : String(key);
			this._raw = toRaw(_object);
			let shallow = true;
			let obj = _object;
			if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) do
				shallow = !isProxy(obj) || isShallow(obj);
			while (shallow && (obj = obj["__v_raw"]));
			this._shallow = shallow;
		}
		get value() {
			let val = this._object[this._key];
			if (this._shallow) val = unref(val);
			return this._value = val === void 0 ? this._defaultValue : val;
		}
		set value(newVal) {
			if (this._shallow && isRef(this._raw[this._key])) {
				const nestedRef = this._object[this._key];
				if (isRef(nestedRef)) {
					nestedRef.value = newVal;
					return;
				}
			}
			this._object[this._key] = newVal;
		}
		get dep() {
			return getDepFromReactive(this._raw, this._key);
		}
	};
	function propertyToRef(source, key, defaultValue) {
		return new ObjectRefImpl(source, key, defaultValue);
	}
	var ComputedRefImpl = class {
		constructor(fn, setter, isSSR) {
			this.fn = fn;
			this.setter = setter;
			this._value = void 0;
			this.dep = new Dep(this);
			this.__v_isRef = true;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 16;
			this.globalVersion = globalVersion - 1;
			this.next = void 0;
			this.effect = this;
			this["__v_isReadonly"] = !setter;
			this.isSSR = isSSR;
		}
		notify() {
			this.flags |= 16;
			if (!(this.flags & 8) && activeSub !== this) {
				batch(this, true);
				return true;
			}
		}
		get value() {
			const link = this.dep.track();
			refreshComputed(this);
			if (link) link.version = this.dep.version;
			return this._value;
		}
		set value(newValue) {
			if (this.setter) this.setter(newValue);
		}
	};
	function computed$1(getterOrOptions, debugOptions, isSSR = false) {
		let getter;
		let setter;
		if (isFunction(getterOrOptions)) getter = getterOrOptions;
		else {
			getter = getterOrOptions.get;
			setter = getterOrOptions.set;
		}
		return new ComputedRefImpl(getter, setter, isSSR);
	}
	var INITIAL_WATCHER_VALUE = {};
	var cleanupMap = new WeakMap();
	var activeWatcher = void 0;
	function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
		if (owner) {
			let cleanups = cleanupMap.get(owner);
			if (!cleanups) cleanupMap.set(owner, cleanups = []);
			cleanups.push(cleanupFn);
		}
	}
	function watch$1(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, once, scheduler, augmentJob, call } = options;
		const reactiveGetter = (source2) => {
			if (deep) return source2;
			if (isShallow(source2) || deep === false || deep === 0) return traverse(source2, 1);
			return traverse(source2);
		};
		let effect;
		let getter;
		let cleanup;
		let boundCleanup;
		let forceTrigger = false;
		let isMultiSource = false;
		if (isRef(source)) {
			getter = () => source.value;
			forceTrigger = isShallow(source);
		} else if (isReactive(source)) {
			getter = () => reactiveGetter(source);
			forceTrigger = true;
		} else if (isArray(source)) {
			isMultiSource = true;
			forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
			getter = () => source.map((s) => {
				if (isRef(s)) return s.value;
				else if (isReactive(s)) return reactiveGetter(s);
				else if (isFunction(s)) return call ? call(s, 2) : s();
			});
		} else if (isFunction(source)) {
			if (cb) getter = call ? () => call(source, 2) : source;
			else getter = () => {
				if (cleanup) {
					pauseTracking();
					try {
						cleanup();
					} finally {
						resetTracking();
					}
				}
				const currentEffect = activeWatcher;
				activeWatcher = effect;
				try {
					return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
				} finally {
					activeWatcher = currentEffect;
				}
			};
		} else getter = NOOP;
		if (cb && deep) {
			const baseGetter = getter;
			const depth = deep === true ? Infinity : deep;
			getter = () => traverse(baseGetter(), depth);
		}
		const scope = getCurrentScope();
		const watchHandle = () => {
			effect.stop();
			if (scope && scope.active) remove(scope.effects, effect);
		};
		if (once && cb) {
			const _cb = cb;
			cb = (...args) => {
				const res = _cb(...args);
				watchHandle();
				return res;
			};
		}
		let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
		const job = (immediateFirstRun) => {
			if (!(effect.flags & 1) || !effect.dirty && !immediateFirstRun) return;
			if (cb) {
				const newValue = effect.run();
				if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
					if (cleanup) cleanup();
					const currentWatcher = activeWatcher;
					activeWatcher = effect;
					try {
						const args = [
							newValue,
							oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
							boundCleanup
						];
						oldValue = newValue;
						call ? call(cb, 3, args) : cb(...args);
					} finally {
						activeWatcher = currentWatcher;
					}
				}
			} else effect.run();
		};
		if (augmentJob) augmentJob(job);
		effect = new ReactiveEffect(getter);
		effect.scheduler = scheduler ? () => scheduler(job, false) : job;
		boundCleanup = (fn) => onWatcherCleanup(fn, false, effect);
		cleanup = effect.onStop = () => {
			const cleanups = cleanupMap.get(effect);
			if (cleanups) {
				if (call) call(cleanups, 4);
				else for (const cleanup2 of cleanups) cleanup2();
				cleanupMap.delete(effect);
			}
		};
		if (cb) {
			if (immediate) job(true);
			else oldValue = effect.run();
		} else if (scheduler) scheduler(job.bind(null, true), true);
		else effect.run();
		watchHandle.pause = effect.pause.bind(effect);
		watchHandle.resume = effect.resume.bind(effect);
		watchHandle.stop = watchHandle;
		return watchHandle;
	}
	function traverse(value, depth = Infinity, seen) {
		if (depth <= 0 || !isObject(value) || value["__v_skip"]) return value;
		seen = seen || new Map();
		if ((seen.get(value) || 0) >= depth) return value;
		seen.set(value, depth);
		depth--;
		if (isRef(value)) traverse(value.value, depth, seen);
		else if (isArray(value)) for (let i = 0; i < value.length; i++) traverse(value[i], depth, seen);
		else if (isSet(value) || isMap(value)) value.forEach((v) => {
			traverse(v, depth, seen);
		});
		else if (isPlainObject$1(value)) {
			for (const key in value) traverse(value[key], depth, seen);
			for (const key of Object.getOwnPropertySymbols(value)) if (Object.prototype.propertyIsEnumerable.call(value, key)) traverse(value[key], depth, seen);
		}
		return value;
	}
	function callWithErrorHandling(fn, instance, type, args) {
		try {
			return args ? fn(...args) : fn();
		} catch (err) {
			handleError(err, instance, type);
		}
	}
	function callWithAsyncErrorHandling(fn, instance, type, args) {
		if (isFunction(fn)) {
			const res = callWithErrorHandling(fn, instance, type, args);
			if (res && isPromise(res)) res.catch((err) => {
				handleError(err, instance, type);
			});
			return res;
		}
		if (isArray(fn)) {
			const values = [];
			for (let i = 0; i < fn.length; i++) values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
			return values;
		}
	}
	function handleError(err, instance, type, throwInDev = true) {
		const contextVNode = instance ? instance.vnode : null;
		const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
		if (instance) {
			let cur = instance.parent;
			const exposedInstance = instance.proxy;
			const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
			while (cur) {
				const errorCapturedHooks = cur.ec;
				if (errorCapturedHooks) {
					for (let i = 0; i < errorCapturedHooks.length; i++) if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) return;
				}
				cur = cur.parent;
			}
			if (errorHandler) {
				pauseTracking();
				callWithErrorHandling(errorHandler, null, 10, [
					err,
					exposedInstance,
					errorInfo
				]);
				resetTracking();
				return;
			}
		}
		logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
	}
	function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
		if (throwInProd) throw err;
		else console.error(err);
	}
	var queue = [];
	var flushIndex = -1;
	var pendingPostFlushCbs = [];
	var activePostFlushCbs = null;
	var postFlushIndex = 0;
	var resolvedPromise = Promise.resolve();
	var currentFlushPromise = null;
	function nextTick(fn) {
		const p = currentFlushPromise || resolvedPromise;
		return fn ? p.then(this ? fn.bind(this) : fn) : p;
	}
	function findInsertionIndex(id) {
		let start = flushIndex + 1;
		let end = queue.length;
		while (start < end) {
			const middle = start + end >>> 1;
			const middleJob = queue[middle];
			const middleJobId = getId(middleJob);
			if (middleJobId < id || middleJobId === id && middleJob.flags & 2) start = middle + 1;
			else end = middle;
		}
		return start;
	}
	function queueJob(job) {
		if (!(job.flags & 1)) {
			const jobId = getId(job);
			const lastJob = queue[queue.length - 1];
			if (!lastJob || !(job.flags & 2) && jobId >= getId(lastJob)) queue.push(job);
			else queue.splice(findInsertionIndex(jobId), 0, job);
			job.flags |= 1;
			queueFlush();
		}
	}
	function queueFlush() {
		if (!currentFlushPromise) currentFlushPromise = resolvedPromise.then(flushJobs);
	}
	function queuePostFlushCb(cb) {
		if (!isArray(cb)) {
			if (activePostFlushCbs && cb.id === -1) activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
			else if (!(cb.flags & 1)) {
				pendingPostFlushCbs.push(cb);
				cb.flags |= 1;
			}
		} else for (let i = 0; i < cb.length; i++) pendingPostFlushCbs.push(cb[i]);
		queueFlush();
	}
	function flushPreFlushCbs(instance, seen, i = flushIndex + 1) {
		for (; i < queue.length; i++) {
			const cb = queue[i];
			if (cb && cb.flags & 2) {
				if (instance && cb.id !== instance.uid) continue;
				queue.splice(i, 1);
				i--;
				if (cb.flags & 4) cb.flags &= -2;
				cb();
				if (!(cb.flags & 4)) cb.flags &= -2;
			}
		}
	}
	function flushPostFlushCbs(seen) {
		if (pendingPostFlushCbs.length) {
			const deduped = [...new Set(pendingPostFlushCbs)].sort((a, b) => getId(a) - getId(b));
			pendingPostFlushCbs.length = 0;
			if (activePostFlushCbs) {
				for (let i = 0; i < deduped.length; i++) activePostFlushCbs.push(deduped[i]);
				return;
			}
			activePostFlushCbs = deduped;
			for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
				const cb = activePostFlushCbs[postFlushIndex];
				if (cb.flags & 4) cb.flags &= -2;
				if (!(cb.flags & 8)) cb();
				cb.flags &= -2;
			}
			activePostFlushCbs = null;
			postFlushIndex = 0;
		}
	}
	var getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
	function flushJobs(seen) {
		try {
			for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job && !(job.flags & 8)) {
					if (job.flags & 4) job.flags &= -2;
					callWithErrorHandling(job, job.i, job.i ? 15 : 14);
					if (!(job.flags & 4)) job.flags &= -2;
				}
			}
		} finally {
			for (; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job) job.flags &= -2;
			}
			flushIndex = -1;
			queue.length = 0;
			flushPostFlushCbs(seen);
			currentFlushPromise = null;
			if (queue.length || pendingPostFlushCbs.length) flushJobs(seen);
		}
	}
	var currentRenderingInstance = null;
	var currentScopeId = null;
	function setCurrentRenderingInstance(instance) {
		const prev = currentRenderingInstance;
		currentRenderingInstance = instance;
		currentScopeId = instance && instance.type.__scopeId || null;
		return prev;
	}
	function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
		if (!ctx) return fn;
		if (fn._n) return fn;
		const renderFnWithContext = (...args) => {
			if (renderFnWithContext._d) setBlockTracking(-1);
			const prevInstance = setCurrentRenderingInstance(ctx);
			const prevStackSize = blockStack.length;
			let res;
			try {
				res = fn(...args);
			} finally {
				for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
				setCurrentRenderingInstance(prevInstance);
				if (renderFnWithContext._d) setBlockTracking(1);
			}
			return res;
		};
		renderFnWithContext._n = true;
		renderFnWithContext._c = true;
		renderFnWithContext._d = true;
		return renderFnWithContext;
	}
	function withDirectives(vnode, directives) {
		if (currentRenderingInstance === null) return vnode;
		const instance = getComponentPublicInstance(currentRenderingInstance);
		const bindings = vnode.dirs || (vnode.dirs = []);
		for (let i = 0; i < directives.length; i++) {
			let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
			if (dir) {
				if (isFunction(dir)) dir = {
					mounted: dir,
					updated: dir
				};
				if (dir.deep) traverse(value);
				bindings.push({
					dir,
					instance,
					value,
					oldValue: void 0,
					arg,
					modifiers
				});
			}
		}
		return vnode;
	}
	function invokeDirectiveHook(vnode, prevVNode, instance, name) {
		const bindings = vnode.dirs;
		const oldBindings = prevVNode && prevVNode.dirs;
		for (let i = 0; i < bindings.length; i++) {
			const binding = bindings[i];
			if (oldBindings) binding.oldValue = oldBindings[i].value;
			let hook = binding.dir[name];
			if (hook) {
				pauseTracking();
				callWithAsyncErrorHandling(hook, instance, 8, [
					vnode.el,
					binding,
					vnode,
					prevVNode
				]);
				resetTracking();
			}
		}
	}
	function inject(key, defaultValue, treatDefaultAsFactory = false) {
		const instance = getCurrentInstance();
		if (instance || currentApp) {
			let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
			if (provides && key in provides) return provides[key];
			else if (arguments.length > 1) return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
		}
	}
	function hasInjectionContext() {
		return !!(getCurrentInstance() || currentApp);
	}
	var ssrContextKey = Symbol.for("v-scx");
	var useSSRContext = () => {
		{
			const ctx = inject(ssrContextKey);
			if (!ctx) {}
			return ctx;
		}
	};
	function watch(source, cb, options) {
		return doWatch(source, cb, options);
	}
	function doWatch(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, flush, once } = options;
		const baseWatchOptions = extend({}, options);
		const runsImmediately = cb && immediate || !cb && flush !== "post";
		let ssrCleanup;
		if (isInSSRComponentSetup) {
			if (flush === "sync") {
				const ctx = useSSRContext();
				ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
			} else if (!runsImmediately) {
				const watchStopHandle = () => {};
				watchStopHandle.stop = NOOP;
				watchStopHandle.resume = NOOP;
				watchStopHandle.pause = NOOP;
				return watchStopHandle;
			}
		}
		const instance = currentInstance;
		baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
		let isPre = false;
		if (flush === "post") baseWatchOptions.scheduler = (job) => {
			queuePostRenderEffect(job, instance && instance.suspense);
		};
		else if (flush !== "sync") {
			isPre = true;
			baseWatchOptions.scheduler = (job, isFirstRun) => {
				if (isFirstRun) job();
				else queueJob(job);
			};
		}
		baseWatchOptions.augmentJob = (job) => {
			if (cb) job.flags |= 4;
			if (isPre) {
				job.flags |= 2;
				if (instance) {
					job.id = instance.uid;
					job.i = instance;
				}
			}
		};
		const watchHandle = watch$1(source, cb, baseWatchOptions);
		if (isInSSRComponentSetup) {
			if (ssrCleanup) ssrCleanup.push(watchHandle);
			else if (runsImmediately) watchHandle();
		}
		return watchHandle;
	}
	var TeleportEndKey = Symbol("_vte");
	var isTeleport = (type) => type.__isTeleport;
	var leaveCbKey = Symbol("_leaveCb");
	var enterCbKey = Symbol("_enterCb");
	function useTransitionState() {
		const state = {
			isMounted: false,
			isLeaving: false,
			isUnmounting: false,
			leavingVNodes: new Map()
		};
		onMounted(() => {
			state.isMounted = true;
		});
		onBeforeUnmount(() => {
			state.isUnmounting = true;
		});
		return state;
	}
	var TransitionHookValidator = [Function, Array];
	var BaseTransitionPropsValidators = {
		mode: String,
		appear: Boolean,
		persisted: Boolean,
		onBeforeEnter: TransitionHookValidator,
		onEnter: TransitionHookValidator,
		onAfterEnter: TransitionHookValidator,
		onEnterCancelled: TransitionHookValidator,
		onBeforeLeave: TransitionHookValidator,
		onLeave: TransitionHookValidator,
		onAfterLeave: TransitionHookValidator,
		onLeaveCancelled: TransitionHookValidator,
		onBeforeAppear: TransitionHookValidator,
		onAppear: TransitionHookValidator,
		onAfterAppear: TransitionHookValidator,
		onAppearCancelled: TransitionHookValidator
	};
	var recursiveGetSubtree = (instance) => {
		const subTree = instance.subTree;
		return subTree.component ? recursiveGetSubtree(subTree.component) : subTree;
	};
	var BaseTransitionImpl = {
		name: `BaseTransition`,
		props: BaseTransitionPropsValidators,
		setup(props, { slots }) {
			const instance = getCurrentInstance();
			const state = useTransitionState();
			return () => {
				const children = slots.default && getTransitionRawChildren(slots.default(), true);
				const child = children && children.length ? findNonCommentChild(children) : instance.subTree ? createCommentVNode() : void 0;
				if (!child) return;
				const rawProps = toRaw(props);
				const { mode } = rawProps;
				if (state.isLeaving) return emptyPlaceholder(child);
				const innerChild = getInnerChild$1(child);
				if (!innerChild) return emptyPlaceholder(child);
				let enterHooks = resolveTransitionHooks(innerChild, rawProps, state, instance, (hooks) => enterHooks = hooks);
				if (innerChild.type !== Comment) setTransitionHooks(innerChild, enterHooks);
				let oldInnerChild = instance.subTree && getInnerChild$1(instance.subTree);
				if (oldInnerChild && oldInnerChild.type !== Comment && !isSameVNodeType(oldInnerChild, innerChild) && recursiveGetSubtree(instance).type !== Comment) {
					let leavingHooks = resolveTransitionHooks(oldInnerChild, rawProps, state, instance);
					setTransitionHooks(oldInnerChild, leavingHooks);
					if (mode === "out-in" && innerChild.type !== Comment) {
						state.isLeaving = true;
						leavingHooks.afterLeave = () => {
							state.isLeaving = false;
							if (!(instance.job.flags & 8)) instance.update();
							delete leavingHooks.afterLeave;
							oldInnerChild = void 0;
						};
						return emptyPlaceholder(child);
					} else if (mode === "in-out" && innerChild.type !== Comment) leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
						const leavingVNodesCache = getLeavingNodesForType(state, oldInnerChild);
						leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
						el[leaveCbKey] = () => {
							earlyRemove();
							el[leaveCbKey] = void 0;
							delete enterHooks.delayedLeave;
							oldInnerChild = void 0;
						};
						enterHooks.delayedLeave = () => {
							delayedLeave();
							delete enterHooks.delayedLeave;
							oldInnerChild = void 0;
						};
					};
					else oldInnerChild = void 0;
				} else if (oldInnerChild) oldInnerChild = void 0;
				return child;
			};
		}
	};
	function findNonCommentChild(children) {
		let child = children[0];
		if (children.length > 1) {
			for (const c of children) if (c.type !== Comment) {
				child = c;
				break;
			}
		}
		return child;
	}
	var BaseTransition = BaseTransitionImpl;
	function getLeavingNodesForType(state, vnode) {
		const { leavingVNodes } = state;
		let leavingVNodesCache = leavingVNodes.get(vnode.type);
		if (!leavingVNodesCache) {
			leavingVNodesCache = Object.create(null);
			leavingVNodes.set(vnode.type, leavingVNodesCache);
		}
		return leavingVNodesCache;
	}
	function resolveTransitionHooks(vnode, props, state, instance, postClone) {
		const { appear, mode, persisted = false, onBeforeEnter, onEnter, onAfterEnter, onEnterCancelled, onBeforeLeave, onLeave, onAfterLeave, onLeaveCancelled, onBeforeAppear, onAppear, onAfterAppear, onAppearCancelled } = props;
		const key = String(vnode.key);
		const leavingVNodesCache = getLeavingNodesForType(state, vnode);
		const callHook = (hook, args) => {
			hook && callWithAsyncErrorHandling(hook, instance, 9, args);
		};
		const callAsyncHook = (hook, args) => {
			const done = args[1];
			callHook(hook, args);
			if (isArray(hook)) {
				if (hook.every((hook2) => hook2.length <= 1)) done();
			} else if (hook.length <= 1) done();
		};
		const hooks = {
			mode,
			persisted,
			beforeEnter(el) {
				let hook = onBeforeEnter;
				if (!state.isMounted) {
					if (appear) hook = onBeforeAppear || onBeforeEnter;
					else return;
				}
				if (el[leaveCbKey]) el[leaveCbKey](true);
				const leavingVNode = leavingVNodesCache[key];
				if (leavingVNode && isSameVNodeType(vnode, leavingVNode) && leavingVNode.el[leaveCbKey]) leavingVNode.el[leaveCbKey]();
				callHook(hook, [el]);
			},
			enter(el) {
				if (leavingVNodesCache[key] === vnode) return;
				let hook = onEnter;
				let afterHook = onAfterEnter;
				let cancelHook = onEnterCancelled;
				if (!state.isMounted) {
					if (appear) {
						hook = onAppear || onEnter;
						afterHook = onAfterAppear || onAfterEnter;
						cancelHook = onAppearCancelled || onEnterCancelled;
					} else return;
				}
				let called = false;
				el[enterCbKey] = (cancelled) => {
					if (called) return;
					called = true;
					if (cancelled) callHook(cancelHook, [el]);
					else callHook(afterHook, [el]);
					if (hooks.delayedLeave) hooks.delayedLeave();
					el[enterCbKey] = void 0;
				};
				const done = el[enterCbKey].bind(null, false);
				if (hook) callAsyncHook(hook, [el, done]);
				else done();
			},
			leave(el, remove) {
				const key2 = String(vnode.key);
				if (el[enterCbKey]) el[enterCbKey](true);
				if (state.isUnmounting) return remove();
				callHook(onBeforeLeave, [el]);
				let called = false;
				el[leaveCbKey] = (cancelled) => {
					if (called) return;
					called = true;
					remove();
					if (cancelled) callHook(onLeaveCancelled, [el]);
					else callHook(onAfterLeave, [el]);
					el[leaveCbKey] = void 0;
					if (leavingVNodesCache[key2] === vnode) delete leavingVNodesCache[key2];
				};
				const done = el[leaveCbKey].bind(null, false);
				leavingVNodesCache[key2] = vnode;
				if (onLeave) callAsyncHook(onLeave, [el, done]);
				else done();
			},
			clone(vnode2) {
				const hooks2 = resolveTransitionHooks(vnode2, props, state, instance, postClone);
				if (postClone) postClone(hooks2);
				return hooks2;
			}
		};
		return hooks;
	}
	function emptyPlaceholder(vnode) {
		if (isKeepAlive(vnode)) {
			vnode = cloneVNode(vnode);
			vnode.children = null;
			return vnode;
		}
	}
	function getInnerChild$1(vnode) {
		if (!isKeepAlive(vnode)) {
			if (isTeleport(vnode.type) && vnode.children) return findNonCommentChild(vnode.children);
			return vnode;
		}
		if (vnode.component) return vnode.component.subTree;
		const { shapeFlag, children } = vnode;
		if (children) {
			if (shapeFlag & 16) return children[0];
			if (shapeFlag & 32 && isFunction(children.default)) return children.default();
		}
	}
	function setTransitionHooks(vnode, hooks) {
		if (vnode.shapeFlag & 6 && vnode.component) {
			vnode.transition = hooks;
			const subTree = vnode.component.subTree;
			setTransitionHooks(isTeleport(subTree.type) ? getInnerChild$1(subTree) || subTree : subTree, hooks);
		} else if (vnode.shapeFlag & 128) {
			vnode.ssContent.transition = hooks.clone(vnode.ssContent);
			vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
		} else vnode.transition = hooks;
	}
	function getTransitionRawChildren(children, keepComment = false, parentKey) {
		let ret = [];
		let keyedFragmentCount = 0;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			const key = parentKey == null ? child.key : String(parentKey) + String(child.key != null ? child.key : i);
			if (child.type === Fragment) {
				if (child.patchFlag & 128) keyedFragmentCount++;
				ret = ret.concat(getTransitionRawChildren(child.children, keepComment, key));
			} else if (keepComment || child.type !== Comment) ret.push(key != null ? cloneVNode(child, { key }) : child);
		}
		if (keyedFragmentCount > 1) for (let i = 0; i < ret.length; i++) ret[i].patchFlag = -2;
		return ret;
	}
	function defineComponent(options, extraOptions) {
		return isFunction(options) ? (() => extend({ name: options.name }, extraOptions, { setup: options }))() : options;
	}
	function markAsyncBoundary(instance) {
		instance.ids = [
			instance.ids[0] + instance.ids[2]++ + "-",
			0,
			0
		];
	}
	function isTemplateRefKey(refs, key) {
		let desc;
		return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
	}
	var pendingSetRefMap = new WeakMap();
	function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
		if (isArray(rawRef)) {
			rawRef.forEach((r, i) => setRef(r, oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef), parentSuspense, vnode, isUnmount));
			return;
		}
		if (isAsyncWrapper(vnode) && !isUnmount) {
			if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
			return;
		}
		const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
		const value = isUnmount ? null : refValue;
		const { i: owner, r: ref } = rawRef;
		const oldRef = oldRawRef && oldRawRef.r;
		const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
		const setupState = owner.setupState;
		const rawSetupState = toRaw(setupState);
		const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
			if (isTemplateRefKey(refs, key)) return false;
			return hasOwn(rawSetupState, key);
		};
		const canSetRef = (ref2, key) => {
			if (key && isTemplateRefKey(refs, key)) return false;
			return true;
		};
		if (oldRef != null && oldRef !== ref) {
			invalidatePendingSetRef(oldRawRef);
			if (isString(oldRef)) {
				refs[oldRef] = null;
				if (canSetSetupRef(oldRef)) setupState[oldRef] = null;
			} else if (isRef(oldRef)) {
				const oldRawRefAtom = oldRawRef;
				if (canSetRef(oldRef, oldRawRefAtom.k)) oldRef.value = null;
				if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
			}
		}
		if (isFunction(ref)) callWithErrorHandling(ref, owner, 12, [value, refs]);
		else {
			const _isString = isString(ref);
			const _isRef = isRef(ref);
			if (_isString || _isRef) {
				const doSet = () => {
					if (rawRef.f) {
						const existing = _isString ? canSetSetupRef(ref) ? setupState[ref] : refs[ref] : canSetRef(ref) || !rawRef.k ? ref.value : refs[rawRef.k];
						if (isUnmount) isArray(existing) && remove(existing, refValue);
						else if (!isArray(existing)) {
							if (_isString) {
								refs[ref] = [refValue];
								if (canSetSetupRef(ref)) setupState[ref] = refs[ref];
							} else {
								const newVal = [refValue];
								if (canSetRef(ref, rawRef.k)) ref.value = newVal;
								if (rawRef.k) refs[rawRef.k] = newVal;
							}
						} else if (!existing.includes(refValue)) existing.push(refValue);
					} else if (_isString) {
						refs[ref] = value;
						if (canSetSetupRef(ref)) setupState[ref] = value;
					} else if (_isRef) {
						if (canSetRef(ref, rawRef.k)) ref.value = value;
						if (rawRef.k) refs[rawRef.k] = value;
					}
				};
				if (value) {
					const job = () => {
						doSet();
						pendingSetRefMap.delete(rawRef);
					};
					job.id = -1;
					pendingSetRefMap.set(rawRef, job);
					queuePostRenderEffect(job, parentSuspense);
				} else {
					invalidatePendingSetRef(rawRef);
					doSet();
				}
			}
		}
	}
	function invalidatePendingSetRef(rawRef) {
		const pendingSetRef = pendingSetRefMap.get(rawRef);
		if (pendingSetRef) {
			pendingSetRef.flags |= 8;
			pendingSetRefMap.delete(rawRef);
		}
	}
	getGlobalThis().requestIdleCallback;
	getGlobalThis().cancelIdleCallback;
	var isAsyncWrapper = (i) => !!i.type.__asyncLoader;
	var isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
	function injectHook(type, hook, target = currentInstance, prepend = false) {
		if (target) {
			const hooks = target[type] || (target[type] = []);
			const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
				pauseTracking();
				const reset = setCurrentInstance(target);
				const res = callWithAsyncErrorHandling(hook, target, type, args);
				reset();
				resetTracking();
				return res;
			});
			if (prepend) hooks.unshift(wrappedHook);
			else hooks.push(wrappedHook);
			return wrappedHook;
		}
	}
	var createHook = (lifecycle) => (hook, target = currentInstance) => {
		if (!isInSSRComponentSetup || lifecycle === "sp") injectHook(lifecycle, (...args) => hook(...args), target);
	};
	var onMounted = createHook("m");
	var onBeforeUnmount = createHook("bum");
	var onUnmounted = createHook("um");
	var NULL_DYNAMIC_COMPONENT = Symbol.for("v-ndc");
	function renderList(source, renderItem, cache, index) {
		let ret;
		const cached = cache && cache[index];
		const sourceIsArray = isArray(source);
		if (sourceIsArray || isString(source)) {
			const sourceIsReactiveArray = sourceIsArray && isReactive(source);
			let needsWrap = false;
			let isReadonlySource = false;
			if (sourceIsReactiveArray) {
				needsWrap = !isShallow(source);
				isReadonlySource = isReadonly(source);
				source = shallowReadArray(source);
			}
			ret = new Array(source.length);
			for (let i = 0, l = source.length; i < l; i++) ret[i] = renderItem(needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i], i, void 0, cached && cached[i]);
		} else if (typeof source === "number") {
			ret = new Array(source);
			for (let i = 0; i < source; i++) ret[i] = renderItem(i + 1, i, void 0, cached && cached[i]);
		} else if (isObject(source)) {
			if (source[Symbol.iterator]) ret = Array.from(source, (item, i) => renderItem(item, i, void 0, cached && cached[i]));
			else {
				const keys = Object.keys(source);
				ret = new Array(keys.length);
				for (let i = 0, l = keys.length; i < l; i++) {
					const key = keys[i];
					ret[i] = renderItem(source[key], key, i, cached && cached[i]);
				}
			}
		} else ret = [];
		if (cache) cache[index] = ret;
		return ret;
	}
	var getPublicInstance = (i) => {
		if (!i) return null;
		if (isStatefulComponent(i)) return getComponentPublicInstance(i);
		return getPublicInstance(i.parent);
	};
	var publicPropertiesMap = extend(Object.create(null), {
		$: (i) => i,
		$el: (i) => i.vnode.el,
		$data: (i) => i.data,
		$props: (i) => i.props,
		$attrs: (i) => i.attrs,
		$slots: (i) => i.slots,
		$refs: (i) => i.refs,
		$parent: (i) => getPublicInstance(i.parent),
		$root: (i) => getPublicInstance(i.root),
		$host: (i) => i.ce,
		$emit: (i) => i.emit,
		$options: (i) => i.type,
		$forceUpdate: (i) => i.f || (i.f = () => {
			queueJob(i.update);
		}),
		$nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
		$watch: (i) => NOOP
	});
	var hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
	var PublicInstanceProxyHandlers = {
		get({ _: instance }, key) {
			if (key === "__v_skip") return true;
			const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
			if (key[0] !== "$") {
				const n = accessCache[key];
				if (n !== void 0) switch (n) {
					case 1: return setupState[key];
					case 2: return data[key];
					case 4: return ctx[key];
					case 3: return props[key];
				}
				else if (hasSetupBinding(setupState, key)) {
					accessCache[key] = 1;
					return setupState[key];
				} else if (hasOwn(props, key)) {
					accessCache[key] = 3;
					return props[key];
				} else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
					accessCache[key] = 4;
					return ctx[key];
				} else accessCache[key] = 0;
			}
			const publicGetter = publicPropertiesMap[key];
			let cssModule, globalProperties;
			if (publicGetter) {
				if (key === "$attrs") track(instance.attrs, "get", "");
				return publicGetter(instance);
			} else if ((cssModule = type.__cssModules) && (cssModule = cssModule[key])) return cssModule;
			else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
				accessCache[key] = 4;
				return ctx[key];
			} else if (globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)) return globalProperties[key];
		},
		set({ _: instance }, key, value) {
			const { data, setupState, ctx } = instance;
			if (hasSetupBinding(setupState, key)) {
				setupState[key] = value;
				return true;
			} else if (hasOwn(instance.props, key)) return false;
			if (key[0] === "$" && key.slice(1) in instance) return false;
			else ctx[key] = value;
			return true;
		},
		has({ _: { data, setupState, accessCache, ctx, appContext, props, type } }, key) {
			let cssModules;
			return !!(accessCache[key] || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
		},
		defineProperty(target, key, descriptor) {
			if (descriptor.get != null) target._.accessCache[key] = 0;
			else if (hasOwn(descriptor, "value")) this.set(target, key, descriptor.value, null);
			return Reflect.defineProperty(target, key, descriptor);
		}
	};
	function createAppContext() {
		return {
			app: null,
			config: {
				isNativeTag: NO,
				performance: false,
				globalProperties: {},
				optionMergeStrategies: {},
				errorHandler: void 0,
				warnHandler: void 0,
				compilerOptions: {}
			},
			mixins: [],
			components: {},
			directives: {},
			provides: Object.create(null),
			optionsCache: new WeakMap(),
			propsCache: new WeakMap(),
			emitsCache: new WeakMap()
		};
	}
	var uid$1 = 0;
	function createAppAPI(render, hydrate) {
		return function createApp(rootComponent, rootProps = null) {
			if (!isFunction(rootComponent)) rootComponent = extend({}, rootComponent);
			if (rootProps != null && !isObject(rootProps)) rootProps = null;
			const context = createAppContext();
			const installedPlugins = new WeakSet();
			const pluginCleanupFns = [];
			let isMounted = false;
			const app = context.app = {
				_uid: uid$1++,
				_component: rootComponent,
				_props: rootProps,
				_container: null,
				_context: context,
				_instance: null,
				version,
				get config() {
					return context.config;
				},
				set config(v) {},
				use(plugin, ...options) {
					if (installedPlugins.has(plugin)) {} else if (plugin && isFunction(plugin.install)) {
						installedPlugins.add(plugin);
						plugin.install(app, ...options);
					} else if (isFunction(plugin)) {
						installedPlugins.add(plugin);
						plugin(app, ...options);
					}
					return app;
				},
				mixin(mixin) {
					return app;
				},
				component(name, component) {
					if (!component) return context.components[name];
					context.components[name] = component;
					return app;
				},
				directive(name, directive) {
					if (!directive) return context.directives[name];
					context.directives[name] = directive;
					return app;
				},
				mount(rootContainer, isHydrate, namespace) {
					if (!isMounted) {
						const vnode = app._ceVNode || createVNode(rootComponent, rootProps);
						vnode.appContext = context;
						if (namespace === true) namespace = "svg";
						else if (namespace === false) namespace = void 0;
						if (isHydrate && hydrate) hydrate(vnode, rootContainer);
						else render(vnode, rootContainer, namespace);
						isMounted = true;
						app._container = rootContainer;
						rootContainer.__vue_app__ = app;
						return getComponentPublicInstance(vnode.component);
					}
				},
				onUnmount(cleanupFn) {
					pluginCleanupFns.push(cleanupFn);
				},
				unmount() {
					if (isMounted) {
						callWithAsyncErrorHandling(pluginCleanupFns, app._instance, 16);
						render(null, app._container);
						delete app._container.__vue_app__;
					}
				},
				provide(key, value) {
					context.provides[key] = value;
					return app;
				},
				runWithContext(fn) {
					const lastApp = currentApp;
					currentApp = app;
					try {
						return fn();
					} finally {
						currentApp = lastApp;
					}
				}
			};
			return app;
		};
	}
	var currentApp = null;
	var getModelModifiers = (props, modelName) => {
		return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
	};
	function emit(instance, event, ...rawArgs) {
		if (instance.isUnmounted) return;
		const props = instance.vnode.props || EMPTY_OBJ;
		let args = rawArgs;
		const isModelListener = event.startsWith("update:");
		const modifiers = isModelListener && getModelModifiers(props, event.slice(7));
		if (modifiers) {
			if (modifiers.trim) args = rawArgs.map((a) => isString(a) ? a.trim() : a);
			if (modifiers.number) args = args.map(looseToNumber);
		}
		let handlerName;
		let handler = props[handlerName = toHandlerKey(event)] || props[handlerName = toHandlerKey(camelize(event))];
		if (!handler && isModelListener) handler = props[handlerName = toHandlerKey(hyphenate(event))];
		if (handler) callWithAsyncErrorHandling(handler, instance, 6, args);
		const onceHandler = props[handlerName + `Once`];
		if (onceHandler) {
			if (!instance.emitted) instance.emitted = {};
			else if (instance.emitted[handlerName]) return;
			instance.emitted[handlerName] = true;
			callWithAsyncErrorHandling(onceHandler, instance, 6, args);
		}
	}
	function normalizeEmitsOptions(comp, appContext, asMixin = false) {
		const cache = appContext.emitsCache;
		const cached = cache.get(comp);
		if (cached !== void 0) return cached;
		const raw = comp.emits;
		let normalized = {};
		if (!raw && true) {
			if (isObject(comp)) cache.set(comp, null);
			return null;
		}
		if (isArray(raw)) raw.forEach((key) => normalized[key] = null);
		else extend(normalized, raw);
		if (isObject(comp)) cache.set(comp, normalized);
		return normalized;
	}
	function isEmitListener(options, key) {
		if (!options || !isOn(key)) return false;
		key = key.slice(2);
		key = key === "Once" ? key : key.replace(/Once$/, "");
		return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
	}
	function renderComponentRoot(instance) {
		const { type: Component, vnode, proxy, withProxy, propsOptions: [propsOptions], slots, attrs, emit, render, renderCache, props, data, setupState, ctx, inheritAttrs } = instance;
		const prev = setCurrentRenderingInstance(instance);
		let result;
		let fallthroughAttrs;
		try {
			if (vnode.shapeFlag & 4) {
				const proxyToUse = withProxy || proxy;
				const thisProxy = proxyToUse;
				result = normalizeVNode(render.call(thisProxy, proxyToUse, renderCache, props, setupState, data, ctx));
				fallthroughAttrs = attrs;
			} else {
				const render2 = Component;
				result = normalizeVNode(render2.length > 1 ? render2(props, {
					attrs,
					slots,
					emit
				}) : render2(props, null));
				fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
			}
		} catch (err) {
			blockStack.length = 0;
			handleError(err, instance, 1);
			result = createVNode(Comment);
		}
		let root = result;
		if (fallthroughAttrs && inheritAttrs !== false) {
			const keys = Object.keys(fallthroughAttrs);
			const { shapeFlag } = root;
			if (keys.length) {
				if (shapeFlag & 7) {
					if (propsOptions && keys.some(isModelListener)) fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions);
					root = cloneVNode(root, fallthroughAttrs, false, true);
				}
			}
		}
		if (vnode.dirs) {
			root = cloneVNode(root, null, false, true);
			root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
		}
		if (vnode.transition) setTransitionHooks(isTeleport(root.type) ? getInnerChild$1(root) || root : root, vnode.transition);
		result = root;
		setCurrentRenderingInstance(prev);
		return result;
	}
	var getFunctionalFallthrough = (attrs) => {
		let res;
		for (const key in attrs) if (key === "class" || key === "style" || isOn(key)) (res || (res = {}))[key] = attrs[key];
		return res;
	};
	var filterModelListeners = (attrs, props) => {
		const res = {};
		for (const key in attrs) if (!isModelListener(key) || !(key.slice(9) in props)) res[key] = attrs[key];
		return res;
	};
	function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
		const { props: prevProps, children: prevChildren, component } = prevVNode;
		const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
		const emits = component.emitsOptions;
		if (nextVNode.dirs || nextVNode.transition) return true;
		if (optimized && patchFlag >= 0) {
			if (patchFlag & 1024) return true;
			if (patchFlag & 16) {
				if (!prevProps) return !!nextProps;
				return hasPropsChanged(prevProps, nextProps, emits);
			} else if (patchFlag & 8) {
				const dynamicProps = nextVNode.dynamicProps;
				for (let i = 0; i < dynamicProps.length; i++) {
					const key = dynamicProps[i];
					if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) return true;
				}
			}
		} else {
			if (prevChildren || nextChildren) {
				if (!nextChildren || !nextChildren.$stable) return true;
			}
			if (prevProps === nextProps) return false;
			if (!prevProps) return !!nextProps;
			if (!nextProps) return true;
			return hasPropsChanged(prevProps, nextProps, emits);
		}
		return false;
	}
	function hasPropsChanged(prevProps, nextProps, emitsOptions) {
		const nextKeys = Object.keys(nextProps);
		if (nextKeys.length !== Object.keys(prevProps).length) return true;
		for (let i = 0; i < nextKeys.length; i++) {
			const key = nextKeys[i];
			if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) return true;
		}
		return false;
	}
	function hasPropValueChanged(nextProps, prevProps, key) {
		const nextProp = nextProps[key];
		const prevProp = prevProps[key];
		if (key === "style" && isObject(nextProp) && isObject(prevProp)) return !looseEqual(nextProp, prevProp);
		return nextProp !== prevProp;
	}
	function updateHOCHostEl({ vnode, parent, suspense }, el) {
		while (parent) {
			const root = parent.subTree;
			if (root.suspense && root.suspense.activeBranch === vnode) {
				root.suspense.vnode.el = root.el = el;
				vnode = root;
			}
			if (root === vnode) {
				(vnode = parent.vnode).el = el;
				parent = parent.parent;
			} else break;
		}
		if (suspense && suspense.activeBranch === vnode) suspense.vnode.el = el;
	}
	var internalObjectProto = {};
	var createInternalObject = () => Object.create(internalObjectProto);
	var isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
	function initProps(instance, rawProps, isStateful, isSSR = false) {
		const props = {};
		const attrs = createInternalObject();
		instance.propsDefaults = Object.create(null);
		setFullProps(instance, rawProps, props, attrs);
		for (const key in instance.propsOptions[0]) if (!(key in props)) props[key] = void 0;
		if (isStateful) instance.props = isSSR ? props : shallowReactive(props);
		else if (!instance.type.props) instance.props = attrs;
		else instance.props = props;
		instance.attrs = attrs;
	}
	function updateProps(instance, rawProps, rawPrevProps, optimized) {
		const { props, attrs, vnode: { patchFlag } } = instance;
		const rawCurrentProps = toRaw(props);
		const [options] = instance.propsOptions;
		let hasAttrsChanged = false;
		if ((optimized || patchFlag > 0) && !(patchFlag & 16)) {
			if (patchFlag & 8) {
				const propsToUpdate = instance.vnode.dynamicProps;
				for (let i = 0; i < propsToUpdate.length; i++) {
					let key = propsToUpdate[i];
					if (isEmitListener(instance.emitsOptions, key)) continue;
					const value = rawProps[key];
					if (options) {
						if (hasOwn(attrs, key)) {
							if (value !== attrs[key]) {
								attrs[key] = value;
								hasAttrsChanged = true;
							}
						} else {
							const camelizedKey = camelize(key);
							props[camelizedKey] = resolvePropValue(options, rawCurrentProps, camelizedKey, value, instance, false);
						}
					} else if (value !== attrs[key]) {
						attrs[key] = value;
						hasAttrsChanged = true;
					}
				}
			}
		} else {
			if (setFullProps(instance, rawProps, props, attrs)) hasAttrsChanged = true;
			let kebabKey;
			for (const key in rawCurrentProps) if (!rawProps || !hasOwn(rawProps, key) && ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
				if (options) {
					if (rawPrevProps && (rawPrevProps[key] !== void 0 || rawPrevProps[kebabKey] !== void 0)) props[key] = resolvePropValue(options, rawCurrentProps, key, void 0, instance, true);
				} else delete props[key];
			}
			if (attrs !== rawCurrentProps) {
				for (const key in attrs) if (!rawProps || !hasOwn(rawProps, key) && true) {
					delete attrs[key];
					hasAttrsChanged = true;
				}
			}
		}
		if (hasAttrsChanged) trigger(instance.attrs, "set", "");
	}
	function setFullProps(instance, rawProps, props, attrs) {
		const [options, needCastKeys] = instance.propsOptions;
		let hasAttrsChanged = false;
		let rawCastValues;
		if (rawProps) for (let key in rawProps) {
			if (isReservedProp(key)) continue;
			const value = rawProps[key];
			let camelKey;
			if (options && hasOwn(options, camelKey = camelize(key))) {
				if (!needCastKeys || !needCastKeys.includes(camelKey)) props[camelKey] = value;
				else (rawCastValues || (rawCastValues = {}))[camelKey] = value;
			} else if (!isEmitListener(instance.emitsOptions, key)) {
				if (!(key in attrs) || value !== attrs[key]) {
					attrs[key] = value;
					hasAttrsChanged = true;
				}
			}
		}
		if (needCastKeys) {
			const rawCurrentProps = toRaw(props);
			const castValues = rawCastValues || EMPTY_OBJ;
			for (let i = 0; i < needCastKeys.length; i++) {
				const key = needCastKeys[i];
				props[key] = resolvePropValue(options, rawCurrentProps, key, castValues[key], instance, !hasOwn(castValues, key));
			}
		}
		return hasAttrsChanged;
	}
	function resolvePropValue(options, props, key, value, instance, isAbsent) {
		const opt = options[key];
		if (opt != null) {
			const hasDefault = hasOwn(opt, "default");
			if (hasDefault && value === void 0) {
				const defaultValue = opt.default;
				if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
					const { propsDefaults } = instance;
					if (key in propsDefaults) value = propsDefaults[key];
					else {
						const reset = setCurrentInstance(instance);
						value = propsDefaults[key] = defaultValue.call(null, props);
						reset();
					}
				} else value = defaultValue;
				if (instance.ce) instance.ce._setProp(key, value);
			}
			if (opt[0]) {
				if (isAbsent && !hasDefault) value = false;
				else if (opt[1] && (value === "" || value === hyphenate(key))) value = true;
			}
		}
		return value;
	}
	function normalizePropsOptions(comp, appContext, asMixin = false) {
		const cache = appContext.propsCache;
		const cached = cache.get(comp);
		if (cached) return cached;
		const raw = comp.props;
		const normalized = {};
		const needCastKeys = [];
		if (!raw && true) {
			if (isObject(comp)) cache.set(comp, EMPTY_ARR);
			return EMPTY_ARR;
		}
		if (isArray(raw)) for (let i = 0; i < raw.length; i++) {
			const normalizedKey = camelize(raw[i]);
			if (validatePropName(normalizedKey)) normalized[normalizedKey] = EMPTY_OBJ;
		}
		else if (raw) for (const key in raw) {
			const normalizedKey = camelize(key);
			if (validatePropName(normalizedKey)) {
				const opt = raw[key];
				const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
				const propType = prop.type;
				let shouldCast = false;
				let shouldCastTrue = true;
				if (isArray(propType)) for (let index = 0; index < propType.length; ++index) {
					const type = propType[index];
					const typeName = isFunction(type) && type.name;
					if (typeName === "Boolean") {
						shouldCast = true;
						break;
					} else if (typeName === "String") shouldCastTrue = false;
				}
				else shouldCast = isFunction(propType) && propType.name === "Boolean";
				prop[0] = shouldCast;
				prop[1] = shouldCastTrue;
				if (shouldCast || hasOwn(prop, "default")) needCastKeys.push(normalizedKey);
			}
		}
		const res = [normalized, needCastKeys];
		if (isObject(comp)) cache.set(comp, res);
		return res;
	}
	function validatePropName(key) {
		if (key[0] !== "$" && !isReservedProp(key)) return true;
		return false;
	}
	var isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
	var normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
	var normalizeSlot = (key, rawSlot, ctx) => {
		if (rawSlot._n) return rawSlot;
		const normalized = withCtx((...args) => {
			return normalizeSlotValue(rawSlot(...args));
		}, ctx);
		normalized._c = false;
		return normalized;
	};
	var normalizeObjectSlots = (rawSlots, slots, instance) => {
		const ctx = rawSlots._ctx;
		for (const key in rawSlots) {
			if (isInternalKey(key)) continue;
			const value = rawSlots[key];
			if (isFunction(value)) slots[key] = normalizeSlot(key, value, ctx);
			else if (value != null) {
				const normalized = normalizeSlotValue(value);
				slots[key] = () => normalized;
			}
		}
	};
	var normalizeVNodeSlots = (instance, children) => {
		const normalized = normalizeSlotValue(children);
		instance.slots.default = () => normalized;
	};
	var assignSlots = (slots, children, optimized) => {
		for (const key in children) if (optimized || !isInternalKey(key)) slots[key] = children[key];
	};
	var initSlots = (instance, children, optimized) => {
		const slots = instance.slots = createInternalObject();
		if (instance.vnode.shapeFlag & 32) {
			const type = children._;
			if (type) {
				assignSlots(slots, children, optimized);
				if (optimized) def(slots, "_", type, true);
			} else normalizeObjectSlots(children, slots);
		} else if (children) normalizeVNodeSlots(instance, children);
	};
	var updateSlots = (instance, children, optimized) => {
		const { vnode, slots } = instance;
		let needDeletionCheck = true;
		let deletionComparisonTarget = EMPTY_OBJ;
		if (vnode.shapeFlag & 32) {
			const type = children._;
			if (type) {
				if (optimized && type === 1) needDeletionCheck = false;
				else assignSlots(slots, children, optimized);
			} else {
				needDeletionCheck = !children.$stable;
				normalizeObjectSlots(children, slots);
			}
			deletionComparisonTarget = children;
		} else if (children) {
			normalizeVNodeSlots(instance, children);
			deletionComparisonTarget = { default: 1 };
		}
		if (needDeletionCheck) {
			for (const key in slots) if (!isInternalKey(key) && deletionComparisonTarget[key] == null) delete slots[key];
		}
	};
	var queuePostRenderEffect = queueEffectWithSuspense;
	function createRenderer(options) {
		return baseCreateRenderer(options);
	}
	function baseCreateRenderer(options, createHydrationFns) {
		const target = getGlobalThis();
		target.__VUE__ = true;
		const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, setScopeId: hostSetScopeId = NOOP, insertStaticContent: hostInsertStaticContent } = options;
		const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
			if (n1 === n2) return;
			if (n1 && !isSameVNodeType(n1, n2)) {
				anchor = getNextHostNode(n1);
				unmount(n1, parentComponent, parentSuspense, true);
				n1 = null;
			}
			if (n2.patchFlag === -2) {
				optimized = false;
				n2.dynamicChildren = null;
			}
			if (n2.dynamicChildren && n1 && n1.dynamicChildren && n1.dynamicChildren.hasOnce) {
				if (n2.dynamicChildren === EMPTY_ARR) n2.dynamicChildren = [];
				n2.dynamicChildren.hasOnce = true;
			}
			const { type, ref, shapeFlag } = n2;
			switch (type) {
				case Text:
					processText(n1, n2, container, anchor);
					break;
				case Comment:
					processCommentNode(n1, n2, container, anchor);
					break;
				case Static:
					if (n1 == null) mountStaticNode(n2, container, anchor, namespace);
					break;
				case Fragment:
					processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					break;
				default: if (shapeFlag & 1) processElement(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 6) processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 64) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
				else if (shapeFlag & 128) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
			}
			if (ref != null && parentComponent) setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
			else if (ref == null && n1 && n1.ref != null) setRef(n1.ref, null, parentSuspense, n1, true);
		};
		const processText = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateText(n2.children), container, anchor);
			else {
				const el = n2.el = n1.el;
				if (n2.children !== n1.children) hostSetText(el, n2.children);
			}
		};
		const processCommentNode = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateComment(n2.children || ""), container, anchor);
			else n2.el = n1.el;
		};
		const mountStaticNode = (n2, container, anchor, namespace) => {
			[n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, namespace, n2.el, n2.anchor);
		};
		const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostInsert(el, container, nextSibling);
				el = next;
			}
			hostInsert(anchor, container, nextSibling);
		};
		const removeStaticNode = ({ el, anchor }) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostRemove(el);
				el = next;
			}
			hostRemove(anchor);
		};
		const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			if (n2.type === "svg") namespace = "svg";
			else if (n2.type === "math") namespace = "mathml";
			if (n1 == null) mountElement(n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			else {
				const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
				try {
					if (customElement) customElement._beginPatch();
					patchElement(n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				} finally {
					if (customElement) customElement._endPatch();
				}
			}
		};
		const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let el;
			let vnodeHook;
			const { props, shapeFlag, transition, dirs } = vnode;
			el = vnode.el = hostCreateElement(vnode.type, namespace, props && props.is, props);
			if (shapeFlag & 8) hostSetElementText(el, vnode.children);
			else if (shapeFlag & 16) mountChildren(vnode.children, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(vnode, namespace), slotScopeIds, optimized);
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "created");
			setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
			if (props) {
				for (const key in props) if (key !== "value" && !isReservedProp(key)) hostPatchProp(el, key, null, props[key], namespace, parentComponent);
				if ("value" in props) hostPatchProp(el, "value", null, props.value, namespace);
				if (vnodeHook = props.onVnodeBeforeMount) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			}
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
			const needCallTransitionHooks = needTransition(parentSuspense, transition);
			if (needCallTransitionHooks) transition.beforeEnter(el);
			hostInsert(el, container, anchor);
			if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) queuePostRenderEffect(() => {
				try {
					vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
					needCallTransitionHooks && transition.enter(el);
					dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
				} finally {}
			}, parentSuspense);
		};
		const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
			if (scopeId) hostSetScopeId(el, scopeId);
			if (slotScopeIds) for (let i = 0; i < slotScopeIds.length; i++) hostSetScopeId(el, slotScopeIds[i]);
			if (parentComponent) {
				let subTree = parentComponent.subTree;
				if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
					const parentVNode = parentComponent.vnode;
					setScopeId(el, parentVNode, parentVNode.scopeId, parentVNode.slotScopeIds, parentComponent.parent);
				}
			}
		};
		const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
			for (let i = start; i < children.length; i++) {
				const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
				patch(null, child, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
		};
		const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const el = n2.el = n1.el;
			let { patchFlag, dynamicChildren, dirs } = n2;
			patchFlag |= n1.patchFlag & 16;
			const oldProps = n1.props || EMPTY_OBJ;
			const newProps = n2.props || EMPTY_OBJ;
			let vnodeHook;
			parentComponent && toggleRecurse(parentComponent, false);
			if (vnodeHook = newProps.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
			if (dirs) invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
			parentComponent && toggleRecurse(parentComponent, true);
			if (dynamicChildren && (!n1.dynamicChildren || n1.dynamicChildren.length !== dynamicChildren.length)) {
				patchFlag = 0;
				optimized = false;
				dynamicChildren = null;
			}
			if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) hostSetElementText(el, "");
			if (dynamicChildren) patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds);
			else if (!optimized) patchChildren(n1, n2, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds, false);
			if (patchFlag > 0) {
				if (patchFlag & 16) patchProps(el, oldProps, newProps, parentComponent, namespace);
				else {
					if (patchFlag & 2) {
						if (oldProps.class !== newProps.class) hostPatchProp(el, "class", null, newProps.class, namespace);
					}
					if (patchFlag & 4) hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
					if (patchFlag & 8) {
						const propsToUpdate = n2.dynamicProps;
						for (let i = 0; i < propsToUpdate.length; i++) {
							const key = propsToUpdate[i];
							const prev = oldProps[key];
							const next = newProps[key];
							if (next !== prev || key === "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
						}
					}
				}
				if (patchFlag & 1) {
					if (n1.children !== n2.children) hostSetElementText(el, n2.children);
				}
			} else if (!optimized && dynamicChildren == null) patchProps(el, oldProps, newProps, parentComponent, namespace);
			if ((vnodeHook = newProps.onVnodeUpdated) || dirs) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
				dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
			}, parentSuspense);
		};
		const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
			for (let i = 0; i < newChildren.length; i++) {
				const oldVNode = oldChildren[i];
				const newVNode = newChildren[i];
				const container = oldVNode.el && (oldVNode.type === Fragment || !isSameVNodeType(oldVNode, newVNode) || oldVNode.shapeFlag & 198) ? hostParentNode(oldVNode.el) : fallbackContainer;
				patch(oldVNode, newVNode, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, true);
			}
		};
		const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
			if (oldProps !== newProps) {
				if (oldProps !== EMPTY_OBJ) {
					for (const key in oldProps) if (!isReservedProp(key) && !(key in newProps)) hostPatchProp(el, key, oldProps[key], null, namespace, parentComponent);
				}
				for (const key in newProps) {
					if (isReservedProp(key)) continue;
					const next = newProps[key];
					const prev = oldProps[key];
					if (next !== prev && key !== "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
				}
				if ("value" in newProps) hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
			}
		};
		const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
			const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
			let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
			if (fragmentSlotScopeIds) slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
			if (n1 == null) {
				hostInsert(fragmentStartAnchor, container, anchor);
				hostInsert(fragmentEndAnchor, container, anchor);
				mountChildren(n2.children || [], container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			} else if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
				patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent, parentSuspense, namespace, slotScopeIds);
				if (n2.key != null || parentComponent && n2 === parentComponent.subTree) traverseStaticChildren(n1, n2, true);
			} else patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
		};
		const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			n2.slotScopeIds = slotScopeIds;
			if (n1 == null) {
				if (n2.shapeFlag & 512) parentComponent.ctx.activate(n2, container, anchor, namespace, optimized);
				else mountComponent(n2, container, anchor, parentComponent, parentSuspense, namespace, optimized);
			} else updateComponent(n1, n2, optimized);
		};
		const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
			const instance = initialVNode.component = createComponentInstance(initialVNode, parentComponent, parentSuspense);
			if (isKeepAlive(initialVNode)) instance.ctx.renderer = internals;
			setupComponent(instance, false, optimized);
			if (instance.asyncDep) {
				parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect, optimized);
				if (!initialVNode.el) {
					const placeholder = instance.subTree = createVNode(Comment);
					processCommentNode(null, placeholder, container, anchor);
					initialVNode.placeholder = placeholder.el;
				}
			} else setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, namespace, optimized);
		};
		const updateComponent = (n1, n2, optimized) => {
			const instance = n2.component = n1.component;
			if (shouldUpdateComponent(n1, n2, optimized)) {
				if (instance.asyncDep && !instance.asyncResolved) {
					n2.el = n1.el;
					updateComponentPreRender(instance, n2, optimized);
					return;
				} else {
					instance.next = n2;
					instance.update();
				}
			} else {
				n2.el = n1.el;
				instance.vnode = n2;
			}
		};
		const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
			const componentUpdateFn = () => {
				if (!instance.isMounted) {
					let vnodeHook;
					const { el, props } = initialVNode;
					const { bm, m, parent, root, type } = instance;
					const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
					toggleRecurse(instance, false);
					if (bm) invokeArrayFns(bm);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) invokeVNodeHook(vnodeHook, parent, initialVNode);
					toggleRecurse(instance, true);
					if (el && hydrateNode) {
						const hydrateSubTree = () => {
							instance.subTree = renderComponentRoot(instance);
							hydrateNode(el, instance.subTree, instance, parentSuspense, null);
						};
						if (isAsyncWrapperVNode && type.__asyncHydrate) type.__asyncHydrate(el, instance, hydrateSubTree);
						else hydrateSubTree();
					} else {
						if (root.ce && root.ce._hasShadowRoot()) root.ce._injectChildStyle(type, instance.parent ? instance.parent.type : void 0);
						const subTree = instance.subTree = renderComponentRoot(instance);
						patch(null, subTree, container, anchor, instance, parentSuspense, namespace);
						initialVNode.el = subTree.el;
					}
					if (m) queuePostRenderEffect(m, parentSuspense);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
						const scopedInitialVNode = initialVNode;
						queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode), parentSuspense);
					}
					if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) instance.a && queuePostRenderEffect(instance.a, parentSuspense);
					instance.isMounted = true;
					initialVNode = container = anchor = null;
				} else {
					let { next, bu, u, parent, vnode } = instance;
					{
						const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
						if (nonHydratedAsyncRoot) {
							if (next) {
								next.el = vnode.el;
								updateComponentPreRender(instance, next, optimized);
							}
							nonHydratedAsyncRoot.asyncDep.then(() => {
								queuePostRenderEffect(() => {
									if (!instance.isUnmounted) update();
								}, parentSuspense);
							});
							return;
						}
					}
					let originNext = next;
					let vnodeHook;
					toggleRecurse(instance, false);
					if (next) {
						next.el = vnode.el;
						updateComponentPreRender(instance, next, optimized);
					} else next = vnode;
					if (bu) invokeArrayFns(bu);
					if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parent, next, vnode);
					toggleRecurse(instance, true);
					const nextTree = renderComponentRoot(instance);
					const prevTree = instance.subTree;
					instance.subTree = nextTree;
					patch(prevTree, nextTree, hostParentNode(prevTree.el), getNextHostNode(prevTree), instance, parentSuspense, namespace);
					next.el = nextTree.el;
					if (originNext === null) updateHOCHostEl(instance, nextTree.el);
					if (u) queuePostRenderEffect(u, parentSuspense);
					if (vnodeHook = next.props && next.props.onVnodeUpdated) queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, next, vnode), parentSuspense);
				}
			};
			instance.scope.on();
			const effect = instance.effect = new ReactiveEffect(componentUpdateFn);
			instance.scope.off();
			const update = instance.update = effect.run.bind(effect);
			const job = instance.job = effect.runIfDirty.bind(effect);
			job.i = instance;
			job.id = instance.uid;
			effect.scheduler = () => queueJob(job);
			toggleRecurse(instance, true);
			update();
		};
		const updateComponentPreRender = (instance, nextVNode, optimized) => {
			nextVNode.component = instance;
			const prevProps = instance.vnode.props;
			instance.vnode = nextVNode;
			instance.next = null;
			updateProps(instance, nextVNode.props, prevProps, optimized);
			updateSlots(instance, nextVNode.children, optimized);
			pauseTracking();
			flushPreFlushCbs(instance);
			resetTracking();
		};
		const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
			const c1 = n1 && n1.children;
			const prevShapeFlag = n1 ? n1.shapeFlag : 0;
			const c2 = n2.children;
			const { patchFlag, shapeFlag } = n2;
			if (patchFlag > 0) {
				if (patchFlag & 128) {
					patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				} else if (patchFlag & 256) {
					patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				}
			}
			if (shapeFlag & 8) {
				if (prevShapeFlag & 16) unmountChildren(c1, parentComponent, parentSuspense);
				if (c2 !== c1) hostSetElementText(container, c2);
			} else if (prevShapeFlag & 16) {
				if (shapeFlag & 16) patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else unmountChildren(c1, parentComponent, parentSuspense, true);
			} else {
				if (prevShapeFlag & 8) hostSetElementText(container, "");
				if (shapeFlag & 16) mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
		};
		const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			c1 = c1 || EMPTY_ARR;
			c2 = c2 || EMPTY_ARR;
			const oldLength = c1.length;
			const newLength = c2.length;
			const commonLength = Math.min(oldLength, newLength);
			let i = 0;
			for (; i < commonLength; i++) {
				const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
			if (oldLength > newLength) unmountChildren(c1, parentComponent, parentSuspense, true, false, commonLength);
			else mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, commonLength);
		};
		const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let i = 0;
			const l2 = c2.length;
			let e1 = c1.length - 1;
			let e2 = l2 - 1;
			while (i <= e1 && i <= e2) {
				const n1 = c1[i];
				const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				i++;
			}
			while (i <= e1 && i <= e2) {
				const n1 = c1[e1];
				const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				e1--;
				e2--;
			}
			if (i > e1) {
				if (i <= e2) {
					const nextPos = e2 + 1;
					const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
					while (i <= e2) {
						patch(null, c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]), container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						i++;
					}
				}
			} else if (i > e2) while (i <= e1) {
				unmount(c1[i], parentComponent, parentSuspense, true);
				i++;
			}
			else {
				const s1 = i;
				const s2 = i;
				const keyToNewIndexMap = new Map();
				for (i = s2; i <= e2; i++) {
					const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
					if (nextChild.key != null) keyToNewIndexMap.set(nextChild.key, i);
				}
				let j;
				let patched = 0;
				const toBePatched = e2 - s2 + 1;
				let moved = false;
				let maxNewIndexSoFar = 0;
				const newIndexToOldIndexMap = new Array(toBePatched);
				for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
				for (i = s1; i <= e1; i++) {
					const prevChild = c1[i];
					if (patched >= toBePatched) {
						unmount(prevChild, parentComponent, parentSuspense, true);
						continue;
					}
					let newIndex;
					if (prevChild.key != null) newIndex = keyToNewIndexMap.get(prevChild.key);
					else for (j = s2; j <= e2; j++) if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
						newIndex = j;
						break;
					}
					if (newIndex === void 0) unmount(prevChild, parentComponent, parentSuspense, true);
					else {
						newIndexToOldIndexMap[newIndex - s2] = i + 1;
						if (newIndex >= maxNewIndexSoFar) maxNewIndexSoFar = newIndex;
						else moved = true;
						patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						patched++;
					}
				}
				const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
				j = increasingNewIndexSequence.length - 1;
				for (i = toBePatched - 1; i >= 0; i--) {
					const nextIndex = s2 + i;
					const nextChild = c2[nextIndex];
					const anchorVNode = c2[nextIndex + 1];
					const anchor = nextIndex + 1 < l2 ? anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode) : parentAnchor;
					if (newIndexToOldIndexMap[i] === 0) patch(null, nextChild, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					else if (moved) {
						if (j < 0 || i !== increasingNewIndexSequence[j]) move(nextChild, container, anchor, 2);
						else j--;
					}
				}
			}
		};
		const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
			const { el, type, transition, children, shapeFlag } = vnode;
			if (shapeFlag & 6) {
				move(vnode.component.subTree, container, anchor, moveType);
				return;
			}
			if (shapeFlag & 128) {
				vnode.suspense.move(container, anchor, moveType);
				return;
			}
			if (shapeFlag & 64) {
				type.move(vnode, container, anchor, internals);
				return;
			}
			if (type === Fragment) {
				hostInsert(el, container, anchor);
				for (let i = 0; i < children.length; i++) move(children[i], container, anchor, moveType);
				hostInsert(vnode.anchor, container, anchor);
				return;
			}
			if (type === Static) {
				moveStaticNode(vnode, container, anchor);
				return;
			}
			if (moveType !== 2 && shapeFlag & 1 && transition) {
				if (moveType === 0) {
					if (transition.persisted && !el[leaveCbKey]) hostInsert(el, container, anchor);
					else {
						transition.beforeEnter(el);
						hostInsert(el, container, anchor);
						queuePostRenderEffect(() => transition.enter(el), parentSuspense);
					}
				} else {
					const { leave, delayLeave, afterLeave } = transition;
					const remove2 = () => {
						if (vnode.ctx.isUnmounted) hostRemove(el);
						else hostInsert(el, container, anchor);
					};
					const performLeave = () => {
						const wasLeaving = el._isLeaving || !!el[leaveCbKey];
						if (el._isLeaving) el[leaveCbKey](true);
						if (transition.persisted && !wasLeaving) remove2();
						else leave(el, () => {
							remove2();
							afterLeave && afterLeave();
						});
					};
					if (delayLeave) delayLeave(el, remove2, performLeave);
					else performLeave();
				}
			} else hostInsert(el, container, anchor);
		};
		const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
			const { type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs, cacheIndex, memo } = vnode;
			if (patchFlag === -2 || dynamicChildren && dynamicChildren.hasOnce) optimized = false;
			if (ref != null) {
				pauseTracking();
				setRef(ref, null, parentSuspense, vnode, true);
				resetTracking();
			}
			if (cacheIndex != null && (!vnode.ctx || vnode.ctx === parentComponent)) parentComponent.renderCache[cacheIndex] = void 0;
			if (shapeFlag & 256) {
				parentComponent.ctx.deactivate(vnode);
				return;
			}
			const shouldInvokeDirs = shapeFlag & 1 && dirs;
			const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
			let vnodeHook;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			if (shapeFlag & 6) unmountComponent(vnode.component, parentSuspense, doRemove);
			else {
				if (shapeFlag & 128) {
					vnode.suspense.unmount(parentSuspense, doRemove);
					return;
				}
				if (shouldInvokeDirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
				if (shapeFlag & 64) vnode.type.remove(vnode, parentComponent, parentSuspense, internals, doRemove);
				else if (dynamicChildren && !dynamicChildren.hasOnce && (type !== Fragment || patchFlag > 0 && patchFlag & 64)) unmountChildren(dynamicChildren, parentComponent, parentSuspense, false, true);
				else if (type === Fragment && patchFlag & 384 || !optimized && shapeFlag & 16) unmountChildren(children, parentComponent, parentSuspense);
				if (doRemove) remove(vnode);
			}
			const shouldInvalidateMemo = memo != null && cacheIndex == null;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
				shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
				if (shouldInvalidateMemo) vnode.el = null;
			}, parentSuspense);
		};
		const remove = (vnode) => {
			const { type, el, anchor, transition } = vnode;
			if (type === Fragment) {
				removeFragment(el, anchor);
				return;
			}
			if (type === Static) {
				removeStaticNode(vnode);
				if (transition && !transition.persisted && transition.afterLeave) transition.afterLeave();
				return;
			}
			const performRemove = () => {
				hostRemove(el);
				if (transition && !transition.persisted && transition.afterLeave) transition.afterLeave();
			};
			if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
				const { leave, delayLeave } = transition;
				const performLeave = () => leave(el, performRemove);
				if (delayLeave) delayLeave(vnode.el, performRemove, performLeave);
				else performLeave();
			} else performRemove();
		};
		const removeFragment = (cur, end) => {
			let next;
			while (cur !== end) {
				next = hostNextSibling(cur);
				hostRemove(cur);
				cur = next;
			}
			hostRemove(end);
		};
		const unmountComponent = (instance, parentSuspense, doRemove) => {
			const { bum, scope, job, subTree, um, m, a } = instance;
			invalidateMount(m);
			invalidateMount(a);
			if (bum) invokeArrayFns(bum);
			scope.stop();
			if (job) {
				job.flags |= 8;
				unmount(subTree, instance, parentSuspense, doRemove);
			} else if (instance.vnode.el && subTree) {
				subTree.transition = instance.vnode.transition;
				unmount(subTree, instance, parentSuspense, doRemove);
			}
			if (um) queuePostRenderEffect(um, parentSuspense);
			queuePostRenderEffect(() => {
				instance.isUnmounted = true;
			}, parentSuspense);
		};
		const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
			for (let i = start; i < children.length; i++) unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
		};
		const getNextHostNode = (vnode) => {
			if (vnode.shapeFlag & 6) return getNextHostNode(vnode.component.subTree);
			if (vnode.shapeFlag & 128) return vnode.suspense.next();
			const el = hostNextSibling(vnode.anchor || vnode.el);
			const teleportEnd = el && el[TeleportEndKey];
			return teleportEnd ? hostNextSibling(teleportEnd) : el;
		};
		let isFlushing = false;
		const render = (vnode, container, namespace) => {
			let instance;
			if (vnode == null) {
				if (container._vnode) {
					unmount(container._vnode, null, null, true);
					instance = container._vnode.component;
				}
			} else patch(container._vnode || null, vnode, container, null, null, null, namespace);
			container._vnode = vnode;
			if (!isFlushing) {
				isFlushing = true;
				flushPreFlushCbs(instance);
				flushPostFlushCbs();
				isFlushing = false;
			}
		};
		const internals = {
			p: patch,
			um: unmount,
			m: move,
			r: remove,
			mt: mountComponent,
			mc: mountChildren,
			pc: patchChildren,
			pbc: patchBlockChildren,
			n: getNextHostNode,
			o: options
		};
		let hydrate;
		let hydrateNode;
		if (createHydrationFns) [hydrate, hydrateNode] = createHydrationFns(internals);
		return {
			render,
			hydrate,
			createApp: createAppAPI(render, hydrate)
		};
	}
	function resolveChildrenNamespace({ type, props }, currentNamespace) {
		return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
	}
	function toggleRecurse({ effect, job }, allowed) {
		if (allowed) {
			effect.flags |= 32;
			job.flags |= 4;
		} else {
			effect.flags &= -33;
			job.flags &= -5;
		}
	}
	function needTransition(parentSuspense, transition) {
		return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
	}
	function traverseStaticChildren(n1, n2, shallow = false) {
		const ch1 = n1.children;
		const ch2 = n2.children;
		if (isArray(ch1) && isArray(ch2)) for (let i = 0; i < ch1.length; i++) {
			const c1 = ch1[i];
			let c2 = ch2[i];
			if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
				if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
					c2 = ch2[i] = cloneIfMounted(ch2[i]);
					c2.el = c1.el;
				}
				if (!shallow && c2.patchFlag !== -2) traverseStaticChildren(c1, c2);
			}
			if (c2.type === Text) {
				if (c2.patchFlag === -1) c2 = ch2[i] = cloneIfMounted(c2);
				c2.el = c1.el;
			}
			if (c2.type === Comment && !c2.el) c2.el = c1.el;
		}
	}
	function getSequence(arr) {
		const p = arr.slice();
		const result = [0];
		let i, j, u, v, c;
		const len = arr.length;
		for (i = 0; i < len; i++) {
			const arrI = arr[i];
			if (arrI !== 0) {
				j = result[result.length - 1];
				if (arr[j] < arrI) {
					p[i] = j;
					result.push(i);
					continue;
				}
				u = 0;
				v = result.length - 1;
				while (u < v) {
					c = u + v >> 1;
					if (arr[result[c]] < arrI) u = c + 1;
					else v = c;
				}
				if (arrI < arr[result[u]]) {
					if (u > 0) p[i] = result[u - 1];
					result[u] = i;
				}
			}
		}
		u = result.length;
		v = result[u - 1];
		while (u-- > 0) {
			result[u] = v;
			v = p[v];
		}
		return result;
	}
	function locateNonHydratedAsyncRoot(instance) {
		const subComponent = instance.subTree.component;
		if (subComponent) {
			if (subComponent.asyncDep && !subComponent.asyncResolved) return subComponent;
			else return locateNonHydratedAsyncRoot(subComponent);
		}
	}
	function invalidateMount(hooks) {
		if (hooks) for (let i = 0; i < hooks.length; i++) hooks[i].flags |= 8;
	}
	function resolveAsyncComponentPlaceholder(anchorVnode) {
		if (anchorVnode.placeholder) return anchorVnode.placeholder;
		const instance = anchorVnode.component;
		if (instance) return resolveAsyncComponentPlaceholder(instance.subTree);
		return null;
	}
	var isSuspense = (type) => type.__isSuspense;
	function queueEffectWithSuspense(fn, suspense) {
		if (suspense && suspense.pendingBranch) {
			if (isArray(fn)) suspense.effects.push(...fn);
			else suspense.effects.push(fn);
		} else queuePostFlushCb(fn);
	}
	var Fragment = Symbol.for("v-fgt");
	var Text = Symbol.for("v-txt");
	var Comment = Symbol.for("v-cmt");
	var Static = Symbol.for("v-stc");
	var blockStack = [];
	var currentBlock = null;
	function openBlock(disableTracking = false) {
		blockStack.push(currentBlock = disableTracking ? null : []);
	}
	function closeBlock() {
		blockStack.pop();
		currentBlock = blockStack[blockStack.length - 1] || null;
	}
	var isBlockTreeEnabled = 1;
	function setBlockTracking(value, inVOnce = false) {
		isBlockTreeEnabled += value;
		if (value < 0 && currentBlock && inVOnce) currentBlock.hasOnce = true;
	}
	function setupBlock(vnode) {
		vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
		closeBlock();
		if (isBlockTreeEnabled > 0 && currentBlock) currentBlock.push(vnode);
		return vnode;
	}
	function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
		return setupBlock(createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, true));
	}
	function createBlock(type, props, children, patchFlag, dynamicProps) {
		return setupBlock(createVNode(type, props, children, patchFlag, dynamicProps, true));
	}
	function isVNode(value) {
		return value ? value.__v_isVNode === true : false;
	}
	function isSameVNodeType(n1, n2) {
		return n1.type === n2.type && n1.key === n2.key;
	}
	var normalizeKey = ({ key }) => key != null ? key : null;
	var normalizeRef = ({ ref, ref_key, ref_for }) => {
		if (typeof ref === "number") ref = "" + ref;
		return ref != null ? isString(ref) || isRef(ref) || isFunction(ref) ? {
			i: currentRenderingInstance,
			r: ref,
			k: ref_key,
			f: !!ref_for
		} : ref : null;
	};
	function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
		const vnode = {
			__v_isVNode: true,
			__v_skip: true,
			type,
			props,
			key: props && normalizeKey(props),
			ref: props && normalizeRef(props),
			scopeId: currentScopeId,
			slotScopeIds: null,
			children,
			component: null,
			suspense: null,
			ssContent: null,
			ssFallback: null,
			dirs: null,
			transition: null,
			el: null,
			anchor: null,
			target: null,
			targetStart: null,
			targetAnchor: null,
			staticCount: 0,
			shapeFlag,
			patchFlag,
			dynamicProps,
			dynamicChildren: null,
			appContext: null,
			ctx: currentRenderingInstance
		};
		if (needFullChildrenNormalization) {
			normalizeChildren(vnode, children);
			if (shapeFlag & 128) type.normalize(vnode);
		} else if (children) vnode.shapeFlag |= isString(children) ? 8 : 16;
		if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock && (vnode.patchFlag > 0 || shapeFlag & 6) && vnode.patchFlag !== 32) currentBlock.push(vnode);
		return vnode;
	}
	var createVNode = _createVNode;
	function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
		if (!type || type === NULL_DYNAMIC_COMPONENT) type = Comment;
		if (isVNode(type)) {
			const cloned = cloneVNode(type, props, true);
			if (children) normalizeChildren(cloned, children);
			if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
				if (cloned.shapeFlag & 6) currentBlock[currentBlock.indexOf(type)] = cloned;
				else currentBlock.push(cloned);
			}
			cloned.patchFlag = -2;
			return cloned;
		}
		if (isClassComponent(type)) type = type.__vccOpts;
		if (props) {
			props = guardReactiveProps(props);
			let { class: klass, style } = props;
			if (klass && !isString(klass)) props.class = normalizeClass(klass);
			if (isObject(style)) {
				if (isProxy(style) && !isArray(style)) style = extend({}, style);
				props.style = normalizeStyle(style);
			}
		}
		const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
		return createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, isBlockNode, true);
	}
	function guardReactiveProps(props) {
		if (!props) return null;
		return isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
	}
	function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
		const { props, ref, patchFlag, children, transition } = vnode;
		const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
		const cloned = {
			__v_isVNode: true,
			__v_skip: true,
			type: vnode.type,
			props: mergedProps,
			key: mergedProps && normalizeKey(mergedProps),
			ref: extraProps && extraProps.ref ? mergeRef && ref ? isArray(ref) ? ref.concat(normalizeRef(extraProps)) : [ref, normalizeRef(extraProps)] : normalizeRef(extraProps) : ref,
			scopeId: vnode.scopeId,
			slotScopeIds: vnode.slotScopeIds,
			children,
			target: vnode.target,
			targetStart: vnode.targetStart,
			targetAnchor: vnode.targetAnchor,
			staticCount: vnode.staticCount,
			shapeFlag: vnode.shapeFlag,
			patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
			dynamicProps: vnode.dynamicProps,
			dynamicChildren: vnode.dynamicChildren,
			appContext: vnode.appContext,
			dirs: vnode.dirs,
			transition,
			component: vnode.component,
			suspense: vnode.suspense,
			ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
			ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
			placeholder: vnode.placeholder,
			el: vnode.el,
			anchor: vnode.anchor,
			ctx: vnode.ctx,
			ce: vnode.ce,
			cacheIndex: vnode.cacheIndex
		};
		if (transition && cloneTransition) setTransitionHooks(cloned, transition.clone(cloned));
		return cloned;
	}
	function createTextVNode(text = " ", flag = 0) {
		return createVNode(Text, null, text, flag);
	}
	function createStaticVNode(content, numberOfNodes) {
		const vnode = createVNode(Static, null, content);
		vnode.staticCount = numberOfNodes;
		return vnode;
	}
	function createCommentVNode(text = "", asBlock = false) {
		return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
	}
	function normalizeVNode(child) {
		if (child == null || typeof child === "boolean") return createVNode(Comment);
		else if (isArray(child)) return createVNode(Fragment, null, child.slice());
		else if (isVNode(child)) return cloneIfMounted(child);
		else return createVNode(Text, null, String(child));
	}
	function cloneIfMounted(child) {
		return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
	}
	function normalizeChildren(vnode, children) {
		let type = 0;
		const { shapeFlag } = vnode;
		if (children == null) children = null;
		else if (isArray(children)) type = 16;
		else if (typeof children === "object") {
			if (shapeFlag & 65) {
				const slot = children.default;
				if (slot) {
					slot._c && (slot._d = false);
					normalizeChildren(vnode, slot());
					slot._c && (slot._d = true);
				}
				return;
			} else {
				type = 32;
				const slotFlag = children._;
				if (!slotFlag && !isInternalObject(children)) children._ctx = currentRenderingInstance;
				else if (slotFlag === 3 && currentRenderingInstance) {
					if (currentRenderingInstance.slots._ === 1) children._ = 1;
					else {
						children._ = 2;
						vnode.patchFlag |= 1024;
					}
				}
			}
		} else if (isFunction(children)) {
			if (shapeFlag & 65) {
				normalizeChildren(vnode, { default: children });
				return;
			}
			children = {
				default: children,
				_ctx: currentRenderingInstance
			};
			type = 32;
		} else {
			children = String(children);
			if (shapeFlag & 64) {
				type = 16;
				children = [createTextVNode(children)];
			} else type = 8;
		}
		vnode.children = children;
		vnode.shapeFlag |= type;
	}
	function mergeProps(...args) {
		const ret = {};
		for (let i = 0; i < args.length; i++) {
			const toMerge = args[i];
			for (const key in toMerge) if (key === "class") {
				if (ret.class !== toMerge.class) ret.class = normalizeClass([ret.class, toMerge.class]);
			} else if (key === "style") ret.style = normalizeStyle([ret.style, toMerge.style]);
			else if (isOn(key)) {
				const existing = ret[key];
				const incoming = toMerge[key];
				if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) ret[key] = existing ? [].concat(existing, incoming) : incoming;
				else if (incoming == null && existing == null && !isModelListener(key)) ret[key] = incoming;
			} else if (key !== "") ret[key] = toMerge[key];
		}
		return ret;
	}
	function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
		callWithAsyncErrorHandling(hook, instance, 7, [vnode, prevVNode]);
	}
	var emptyAppContext = createAppContext();
	var uid = 0;
	function createComponentInstance(vnode, parent, suspense) {
		const type = vnode.type;
		const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
		const instance = {
			uid: uid++,
			vnode,
			type,
			parent,
			appContext,
			root: null,
			next: null,
			subTree: null,
			effect: null,
			update: null,
			job: null,
			scope: new EffectScope(true),
			render: null,
			proxy: null,
			exposed: null,
			exposeProxy: null,
			withProxy: null,
			provides: parent ? parent.provides : Object.create(appContext.provides),
			ids: parent ? parent.ids : [
				"",
				0,
				0
			],
			accessCache: null,
			renderCache: [],
			components: null,
			directives: null,
			propsOptions: normalizePropsOptions(type, appContext),
			emitsOptions: normalizeEmitsOptions(type, appContext),
			emit: null,
			emitted: null,
			propsDefaults: EMPTY_OBJ,
			inheritAttrs: type.inheritAttrs,
			ctx: EMPTY_OBJ,
			data: EMPTY_OBJ,
			props: EMPTY_OBJ,
			attrs: EMPTY_OBJ,
			slots: EMPTY_OBJ,
			refs: EMPTY_OBJ,
			setupState: EMPTY_OBJ,
			setupContext: null,
			suspense,
			suspenseId: suspense ? suspense.pendingId : 0,
			asyncDep: null,
			asyncResolved: false,
			isMounted: false,
			isUnmounted: false,
			isDeactivated: false,
			bc: null,
			c: null,
			bm: null,
			m: null,
			bu: null,
			u: null,
			um: null,
			bum: null,
			da: null,
			a: null,
			rtg: null,
			rtc: null,
			ec: null,
			sp: null
		};
		instance.ctx = { _: instance };
		instance.root = parent ? parent.root : instance;
		instance.emit = emit.bind(null, instance);
		if (vnode.ce) vnode.ce(instance);
		return instance;
	}
	var currentInstance = null;
	var getCurrentInstance = () => currentInstance || currentRenderingInstance;
	var internalSetCurrentInstance;
	var setInSSRSetupState;
	{
		const g = getGlobalThis();
		const registerGlobalSetter = (key, setter) => {
			let setters;
			if (!(setters = g[key])) setters = g[key] = [];
			setters.push(setter);
			return (v) => {
				if (setters.length > 1) setters.forEach((set) => set(v));
				else setters[0](v);
			};
		};
		internalSetCurrentInstance = registerGlobalSetter(`__VUE_INSTANCE_SETTERS__`, (v) => currentInstance = v);
		setInSSRSetupState = registerGlobalSetter(`__VUE_SSR_SETTERS__`, (v) => isInSSRComponentSetup = v);
	}
	var setCurrentInstance = (instance) => {
		const prev = currentInstance;
		internalSetCurrentInstance(instance);
		instance.scope.on();
		return () => {
			instance.scope.off();
			internalSetCurrentInstance(prev);
		};
	};
	var unsetCurrentInstance = () => {
		currentInstance && currentInstance.scope.off();
		internalSetCurrentInstance(null);
	};
	function isStatefulComponent(instance) {
		return instance.vnode.shapeFlag & 4;
	}
	var isInSSRComponentSetup = false;
	function setupComponent(instance, isSSR = false, optimized = false) {
		isSSR && setInSSRSetupState(isSSR);
		const { props, children } = instance.vnode;
		const isStateful = isStatefulComponent(instance);
		initProps(instance, props, isStateful, isSSR);
		initSlots(instance, children, optimized || isSSR);
		const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
		isSSR && setInSSRSetupState(false);
		return setupResult;
	}
	function setupStatefulComponent(instance, isSSR) {
		const Component = instance.type;
		instance.accessCache = Object.create(null);
		instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
		const { setup } = Component;
		if (setup) {
			pauseTracking();
			const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
			const reset = setCurrentInstance(instance);
			const setupResult = callWithErrorHandling(setup, instance, 0, [instance.props, setupContext]);
			const isAsyncSetup = isPromise(setupResult);
			resetTracking();
			reset();
			if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) markAsyncBoundary(instance);
			if (isAsyncSetup) {
				setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
				if (isSSR) return setupResult.then((resolvedResult) => {
					setInSSRSetupState(true);
					try {
						handleSetupResult(instance, resolvedResult, isSSR);
					} finally {
						setInSSRSetupState(false);
					}
				}).catch((e) => {
					handleError(e, instance, 0);
				});
				else instance.asyncDep = setupResult;
			} else handleSetupResult(instance, setupResult, isSSR);
		} else finishComponentSetup(instance, isSSR);
	}
	function handleSetupResult(instance, setupResult, isSSR) {
		if (isFunction(setupResult)) {
			if (instance.type.__ssrInlineRender) instance.ssrRender = setupResult;
			else instance.render = setupResult;
		} else if (isObject(setupResult)) instance.setupState = proxyRefs(setupResult);
		finishComponentSetup(instance, isSSR);
	}
	function finishComponentSetup(instance, isSSR, skipOptions) {
		const Component = instance.type;
		if (!instance.render) instance.render = Component.render || NOOP;
	}
	var attrsProxyHandlers = { get(target, key) {
		track(target, "get", "");
		return target[key];
	} };
	function createSetupContext(instance) {
		const expose = (exposed) => {
			instance.exposed = exposed || {};
		};
		return {
			attrs: new Proxy(instance.attrs, attrsProxyHandlers),
			slots: instance.slots,
			emit: instance.emit,
			expose
		};
	}
	function getComponentPublicInstance(instance) {
		if (instance.exposed) return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
			get(target, key) {
				if (key in target) return target[key];
				else if (key in publicPropertiesMap) return publicPropertiesMap[key](instance);
			},
			has(target, key) {
				return key in target || key in publicPropertiesMap;
			}
		}));
		else return instance.proxy;
	}
	function isClassComponent(value) {
		return isFunction(value) && "__vccOpts" in value;
	}
	var computed = (getterOrOptions, debugOptions) => {
		return computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
	};
	function h(type, propsOrChildren, children) {
		try {
			setBlockTracking(-1);
			const l = arguments.length;
			if (l === 2) {
				if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
					if (isVNode(propsOrChildren)) return createVNode(type, null, [propsOrChildren]);
					return createVNode(type, propsOrChildren);
				} else return createVNode(type, null, propsOrChildren);
			} else {
				if (l > 3) children = Array.prototype.slice.call(arguments, 2);
				else if (l === 3 && isVNode(children)) children = [children];
				return createVNode(type, propsOrChildren, children);
			}
		} finally {
			setBlockTracking(1);
		}
	}
	var version = "3.5.43";
	var policy = void 0;
	var tt = typeof window !== "undefined" && window.trustedTypes;
	if (tt) try {
		policy = tt.createPolicy("vue", { createHTML: (val) => val });
	} catch (e) {}
	var unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
	var svgNS = "http://www.w3.org/2000/svg";
	var mathmlNS = "http://www.w3.org/1998/Math/MathML";
	var doc = typeof document !== "undefined" ? document : null;
	var templateContainer = doc && doc.createElement("template");
	var nodeOps = {
		insert: (child, parent, anchor) => {
			parent.insertBefore(child, anchor || null);
		},
		remove: (child) => {
			const parent = child.parentNode;
			if (parent) parent.removeChild(child);
		},
		createElement: (tag, namespace, is, props) => {
			const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
			if (tag === "select" && props && props.multiple != null) el.setAttribute("multiple", props.multiple);
			return el;
		},
		createText: (text) => doc.createTextNode(text),
		createComment: (text) => doc.createComment(text),
		setText: (node, text) => {
			node.nodeValue = text;
		},
		setElementText: (el, text) => {
			el.textContent = text;
		},
		parentNode: (node) => node.parentNode,
		nextSibling: (node) => node.nextSibling,
		querySelector: (selector) => doc.querySelector(selector),
		setScopeId(el, id) {
			el.setAttribute(id, "");
		},
		insertStaticContent(content, parent, anchor, namespace, start, end) {
			const before = anchor ? anchor.previousSibling : parent.lastChild;
			if (start && (start === end || start.nextSibling)) while (true) {
				parent.insertBefore(start.cloneNode(true), anchor);
				if (start === end || !(start = start.nextSibling)) break;
			}
			else {
				templateContainer.innerHTML = unsafeToTrustedHTML(namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content);
				const template = templateContainer.content;
				if (namespace === "svg" || namespace === "mathml") {
					const wrapper = template.firstChild;
					while (wrapper.firstChild) template.appendChild(wrapper.firstChild);
					template.removeChild(wrapper);
				}
				parent.insertBefore(template, anchor);
			}
			return [before ? before.nextSibling : parent.firstChild, anchor ? anchor.previousSibling : parent.lastChild];
		}
	};
	var TRANSITION = "transition";
	var ANIMATION = "animation";
	var vtcKey = Symbol("_vtc");
	var DOMTransitionPropsValidators = {
		name: String,
		type: String,
		css: {
			type: Boolean,
			default: true
		},
		duration: [
			String,
			Number,
			Object
		],
		enterFromClass: String,
		enterActiveClass: String,
		enterToClass: String,
		appearFromClass: String,
		appearActiveClass: String,
		appearToClass: String,
		leaveFromClass: String,
		leaveActiveClass: String,
		leaveToClass: String
	};
	var TransitionPropsValidators = extend({}, BaseTransitionPropsValidators, DOMTransitionPropsValidators);
	var decorate$1 = (t) => {
		t.displayName = "Transition";
		t.props = TransitionPropsValidators;
		return t;
	};
	var Transition = decorate$1((props, { slots }) => h(BaseTransition, resolveTransitionProps(props), slots));
	var callHook = (hook, args = []) => {
		if (isArray(hook)) hook.forEach((h2) => h2(...args));
		else if (hook) hook(...args);
	};
	var hasExplicitCallback = (hook) => {
		return hook ? isArray(hook) ? hook.some((h2) => h2.length > 1) : hook.length > 1 : false;
	};
	function resolveTransitionProps(rawProps) {
		const baseProps = {};
		for (const key in rawProps) if (!(key in DOMTransitionPropsValidators)) baseProps[key] = rawProps[key];
		if (rawProps.css === false) return baseProps;
		const { name = "v", type, duration, enterFromClass = `${name}-enter-from`, enterActiveClass = `${name}-enter-active`, enterToClass = `${name}-enter-to`, appearFromClass = enterFromClass, appearActiveClass = enterActiveClass, appearToClass = enterToClass, leaveFromClass = `${name}-leave-from`, leaveActiveClass = `${name}-leave-active`, leaveToClass = `${name}-leave-to` } = rawProps;
		const durations = normalizeDuration(duration);
		const enterDuration = durations && durations[0];
		const leaveDuration = durations && durations[1];
		const { onBeforeEnter, onEnter, onEnterCancelled, onLeave, onLeaveCancelled, onBeforeAppear = onBeforeEnter, onAppear = onEnter, onAppearCancelled = onEnterCancelled } = baseProps;
		const finishEnter = (el, isAppear, done, isCancelled) => {
			el._enterCancelled = isCancelled;
			removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
			removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
			done && done();
		};
		const finishLeave = (el, done) => {
			el._isLeaving = false;
			removeTransitionClass(el, leaveFromClass);
			removeTransitionClass(el, leaveToClass);
			removeTransitionClass(el, leaveActiveClass);
			done && done();
		};
		const makeEnterHook = (isAppear) => {
			return (el, done) => {
				const hook = isAppear ? onAppear : onEnter;
				const resolve = () => finishEnter(el, isAppear, done);
				callHook(hook, [el, resolve]);
				nextFrame(() => {
					removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
					addTransitionClass(el, isAppear ? appearToClass : enterToClass);
					if (!hasExplicitCallback(hook)) whenTransitionEnds(el, type, enterDuration, resolve);
				});
			};
		};
		return extend(baseProps, {
			onBeforeEnter(el) {
				callHook(onBeforeEnter, [el]);
				addTransitionClass(el, enterFromClass);
				addTransitionClass(el, enterActiveClass);
			},
			onBeforeAppear(el) {
				callHook(onBeforeAppear, [el]);
				addTransitionClass(el, appearFromClass);
				addTransitionClass(el, appearActiveClass);
			},
			onEnter: makeEnterHook(false),
			onAppear: makeEnterHook(true),
			onLeave(el, done) {
				el._isLeaving = true;
				const resolve = () => finishLeave(el, done);
				addTransitionClass(el, leaveFromClass);
				if (!el._enterCancelled) {
					forceReflow(el);
					addTransitionClass(el, leaveActiveClass);
				} else {
					addTransitionClass(el, leaveActiveClass);
					forceReflow(el);
				}
				nextFrame(() => {
					if (!el._isLeaving) return;
					removeTransitionClass(el, leaveFromClass);
					addTransitionClass(el, leaveToClass);
					if (!hasExplicitCallback(onLeave)) whenTransitionEnds(el, type, leaveDuration, resolve);
				});
				callHook(onLeave, [el, resolve]);
			},
			onEnterCancelled(el) {
				finishEnter(el, false, void 0, true);
				callHook(onEnterCancelled, [el]);
			},
			onAppearCancelled(el) {
				finishEnter(el, true, void 0, true);
				callHook(onAppearCancelled, [el]);
			},
			onLeaveCancelled(el) {
				finishLeave(el);
				callHook(onLeaveCancelled, [el]);
			}
		});
	}
	function normalizeDuration(duration) {
		if (duration == null) return null;
		else if (isObject(duration)) return [NumberOf(duration.enter), NumberOf(duration.leave)];
		else {
			const n = NumberOf(duration);
			return [n, n];
		}
	}
	function NumberOf(val) {
		return toNumber(val);
	}
	function addTransitionClass(el, cls) {
		cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
		(el[vtcKey] || (el[vtcKey] = new Set())).add(cls);
	}
	function removeTransitionClass(el, cls) {
		cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
		const _vtc = el[vtcKey];
		if (_vtc) {
			_vtc.delete(cls);
			if (!_vtc.size) el[vtcKey] = void 0;
		}
	}
	function nextFrame(cb) {
		requestAnimationFrame(() => {
			requestAnimationFrame(cb);
		});
	}
	var endId = 0;
	function whenTransitionEnds(el, expectedType, explicitTimeout, resolve) {
		const id = el._endId = ++endId;
		const resolveIfNotStale = () => {
			if (id === el._endId) resolve();
		};
		if (explicitTimeout != null) return setTimeout(resolveIfNotStale, explicitTimeout);
		const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
		if (!type) return resolve();
		const endEvent = type + "end";
		let ended = 0;
		const end = () => {
			el.removeEventListener(endEvent, onEnd);
			resolveIfNotStale();
		};
		const onEnd = (e) => {
			if (e.target === el && ++ended >= propCount) end();
		};
		setTimeout(() => {
			if (ended < propCount) end();
		}, timeout + 1);
		el.addEventListener(endEvent, onEnd);
	}
	function getTransitionInfo(el, expectedType) {
		const styles = window.getComputedStyle(el);
		const getStyleProperties = (key) => (styles[key] || "").split(", ");
		const transitionDelays = getStyleProperties(`${TRANSITION}Delay`);
		const transitionDurations = getStyleProperties(`${TRANSITION}Duration`);
		const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
		const animationDelays = getStyleProperties(`${ANIMATION}Delay`);
		const animationDurations = getStyleProperties(`${ANIMATION}Duration`);
		const animationTimeout = getTimeout(animationDelays, animationDurations);
		let type = null;
		let timeout = 0;
		let propCount = 0;
		if (expectedType === TRANSITION) {
			if (transitionTimeout > 0) {
				type = TRANSITION;
				timeout = transitionTimeout;
				propCount = transitionDurations.length;
			}
		} else if (expectedType === ANIMATION) {
			if (animationTimeout > 0) {
				type = ANIMATION;
				timeout = animationTimeout;
				propCount = animationDurations.length;
			}
		} else {
			timeout = Math.max(transitionTimeout, animationTimeout);
			type = timeout > 0 ? transitionTimeout > animationTimeout ? TRANSITION : ANIMATION : null;
			propCount = type ? type === TRANSITION ? transitionDurations.length : animationDurations.length : 0;
		}
		const hasTransform = type === TRANSITION && /\b(?:transform|all)(?:,|$)/.test(getStyleProperties(`${TRANSITION}Property`).toString());
		return {
			type,
			timeout,
			propCount,
			hasTransform
		};
	}
	function getTimeout(delays, durations) {
		while (delays.length < durations.length) delays = delays.concat(delays);
		return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
	}
	function toMs(s) {
		if (s === "auto") return 0;
		return Number(s.slice(0, -1).replace(",", ".")) * 1e3;
	}
	function forceReflow(el) {
		return (el ? el.ownerDocument : document).body.offsetHeight;
	}
	function patchClass(el, value, isSVG) {
		const transitionClasses = el[vtcKey];
		if (transitionClasses) value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
		if (value == null) el.removeAttribute("class");
		else if (isSVG) el.setAttribute("class", value);
		else el.className = value;
	}
	var vShowOriginalDisplay = Symbol("_vod");
	var vShowHidden = Symbol("_vsh");
	var vShow = {
		name: "show",
		beforeMount(el, { value }, { transition }) {
			el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
			if (transition && value) transition.beforeEnter(el);
			else setDisplay(el, value);
		},
		mounted(el, { value }, { transition }) {
			if (transition && value) transition.enter(el);
		},
		updated(el, { value, oldValue }, { transition }) {
			if (!value === !oldValue) return;
			if (transition) {
				if (value) {
					transition.beforeEnter(el);
					setDisplay(el, true);
					transition.enter(el);
				} else transition.leave(el, () => {
					setDisplay(el, false);
				});
			} else setDisplay(el, value);
		},
		beforeUnmount(el, { value }) {
			setDisplay(el, value);
		}
	};
	function setDisplay(el, value) {
		el.style.display = value ? el[vShowOriginalDisplay] : "none";
		el[vShowHidden] = !value;
	}
	var CSS_VAR_TEXT = Symbol("");
	var displayRE = /(?:^|;)\s*display\s*:/;
	function patchStyle(el, prev, next) {
		const style = el.style;
		const isCssString = isString(next);
		let hasControlledDisplay = false;
		if (next && !isCssString) {
			if (prev) {
				if (!isString(prev)) {
					for (const key in prev) if (next[key] == null) setStyle(style, key, "");
				} else for (const prevStyle of prev.split(";")) {
					const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
					if (next[key] == null) setStyle(style, key, "");
				}
			}
			for (const key in next) {
				if (key === "display") hasControlledDisplay = true;
				const value = next[key];
				if (value != null) {
					if (!shouldPreserveTextareaResizeStyle(el, key, !isString(prev) && prev ? prev[key] : void 0, value)) setStyle(style, key, value);
				} else setStyle(style, key, "");
			}
		} else if (isCssString) {
			if (prev !== next) {
				const cssVarText = style[CSS_VAR_TEXT];
				if (cssVarText) next += ";" + cssVarText;
				style.cssText = next;
				hasControlledDisplay = displayRE.test(next);
			}
		} else if (prev) el.removeAttribute("style");
		if (vShowOriginalDisplay in el) {
			el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
			if (el[vShowHidden]) style.display = "none";
		}
	}
	var importantRE = /\s*!important$/;
	function setStyle(style, name, val) {
		if (isArray(val)) val.forEach((v) => setStyle(style, name, v));
		else {
			if (val == null) val = "";
			if (name.startsWith("--")) {
				if (importantRE.test(val)) style.setProperty(name, val.replace(importantRE, ""), "important");
				else style.setProperty(name, val);
			} else {
				const prefixed = autoPrefix(style, name);
				if (importantRE.test(val)) style.setProperty(hyphenate(prefixed), val.replace(importantRE, ""), "important");
				else style[prefixed] = val;
			}
		}
	}
	var prefixes = [
		"Webkit",
		"Moz",
		"ms"
	];
	var prefixCache = {};
	function autoPrefix(style, rawName) {
		const cached = prefixCache[rawName];
		if (cached) return cached;
		let name = camelize(rawName);
		if (name !== "filter" && name in style) return prefixCache[rawName] = name;
		name = capitalize(name);
		for (let i = 0; i < prefixes.length; i++) {
			const prefixed = prefixes[i] + name;
			if (prefixed in style) return prefixCache[rawName] = prefixed;
		}
		return rawName;
	}
	function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
		return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
	}
	var xlinkNS = "http://www.w3.org/1999/xlink";
	function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
		if (isSVG && key.startsWith("xlink:")) {
			if (value == null) el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
			else el.setAttributeNS(xlinkNS, key, value);
		} else if (value == null || isBoolean && !includeBooleanAttr(value)) el.removeAttribute(key);
		else el.setAttribute(key, isBoolean ? "" : isSymbol(value) ? String(value) : value);
	}
	function patchDOMProp(el, key, value, parentComponent, attrName) {
		if (key === "innerHTML" || key === "textContent") {
			if (value != null) el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
			return;
		}
		const tag = el.tagName;
		if (key === "value" && tag !== "PROGRESS" && !tag.includes("-")) {
			const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
			const newValue = value == null ? el.type === "checkbox" ? "on" : "" : String(value);
			if (oldValue !== newValue || !("_value" in el)) el.value = newValue;
			if (value == null) el.removeAttribute(key);
			el._value = value;
			return;
		}
		let needRemove = false;
		if (value === "" || value == null) {
			const type = typeof el[key];
			if (type === "boolean") value = includeBooleanAttr(value);
			else if (value == null && type === "string") {
				value = "";
				needRemove = true;
			} else if (type === "number") {
				value = 0;
				needRemove = true;
			}
		}
		try {
			el[key] = value;
		} catch (e) {}
		needRemove && el.removeAttribute(attrName || key);
	}
	function addEventListener(el, event, handler, options) {
		el.addEventListener(event, handler, options);
	}
	function removeEventListener(el, event, handler, options) {
		el.removeEventListener(event, handler, options);
	}
	var veiKey = Symbol("_vei");
	function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
		const invokers = el[veiKey] || (el[veiKey] = {});
		const existingInvoker = invokers[rawName];
		if (nextValue && existingInvoker) existingInvoker.value = nextValue;
		else {
			const [name, options] = parseName(rawName);
			if (nextValue) addEventListener(el, name, invokers[rawName] = createInvoker(nextValue, instance), options);
			else if (existingInvoker) {
				removeEventListener(el, name, existingInvoker, options);
				invokers[rawName] = void 0;
			}
		}
	}
	var optionsModifierRE = /(Once|Passive|Capture)$/;
	var optionsModifierEventRE = /^on:?(?:Once|Passive|Capture)$/;
	function parseName(name) {
		let options;
		let m;
		while ((m = name.match(optionsModifierRE)) && !optionsModifierEventRE.test(name)) {
			if (!options) options = {};
			name = name.slice(0, name.length - m[1].length);
			options[m[1].toLowerCase()] = true;
		}
		return [name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2)), options];
	}
	var cachedNow = 0;
	var p = Promise.resolve();
	var getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
	function createInvoker(initialValue, instance) {
		const invoker = (e) => {
			if (!e._vts) e._vts = Date.now();
			else if (e._vts <= invoker.attached) return;
			const value = invoker.value;
			if (isArray(value)) {
				const originalStop = e.stopImmediatePropagation;
				e.stopImmediatePropagation = () => {
					originalStop.call(e);
					e._stopped = true;
				};
				const handlers = value.slice();
				const args = [e];
				for (let i = 0; i < handlers.length; i++) {
					if (e._stopped) break;
					const handler = handlers[i];
					if (handler) callWithAsyncErrorHandling(handler, instance, 5, args);
				}
			} else callWithAsyncErrorHandling(value, instance, 5, [e]);
		};
		invoker.value = initialValue;
		invoker.attached = getNow();
		return invoker;
	}
	var isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
	var patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
		const isSVG = namespace === "svg";
		if (key === "class") patchClass(el, nextValue, isSVG);
		else if (key === "style") patchStyle(el, prevValue, nextValue);
		else if (isOn(key)) {
			if (!isModelListener(key)) patchEvent(el, key, prevValue, nextValue, parentComponent);
		} else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
			patchDOMProp(el, key, nextValue);
			if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
		} else if (el._isVueCE && (shouldSetAsPropForVueCE(el, key) || el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))) patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
		else {
			if (key === "true-value") el._trueValue = nextValue;
			else if (key === "false-value") el._falseValue = nextValue;
			patchAttr(el, key, nextValue, isSVG);
		}
	};
	function shouldSetAsProp(el, key, value, isSVG) {
		if (isSVG) {
			if (key === "innerHTML" || key === "textContent") return true;
			if (key in el && isNativeOn(key) && isFunction(value)) return true;
			return false;
		}
		if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") return false;
		if (key === "sandbox" && el.tagName === "IFRAME") return false;
		if (key === "form") return false;
		if (key === "list" && el.tagName === "INPUT") return false;
		if (key === "type" && el.tagName === "TEXTAREA") return false;
		if (key === "width" || key === "height") {
			const tag = el.tagName;
			if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") return false;
		}
		if (isNativeOn(key) && isString(value)) return false;
		return key in el;
	}
	function shouldSetAsPropForVueCE(el, key) {
		const props = el._def.props;
		if (!props) return false;
		const camelKey = camelize(key);
		return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
	}
	var getModelAssigner = (vnode) => {
		const fn = vnode.props["onUpdate:modelValue"] || false;
		return isArray(fn) ? (value) => invokeArrayFns(fn, value) : fn;
	};
	function onCompositionStart(e) {
		e.target.composing = true;
	}
	function onCompositionEnd(e) {
		const target = e.target;
		if (target.composing) {
			target.composing = false;
			target.dispatchEvent(new Event("input"));
		}
	}
	var assignKey = Symbol("_assign");
	var initialValueKey = Symbol("_initialValue");
	function castValue(value, trim, number) {
		if (trim) value = value.trim();
		if (number) value = looseToNumber(value);
		return value;
	}
	var vModelText = {
		created(el, { modifiers: { lazy, trim, number } }, vnode) {
			if (el.parentNode) {
				if (el.type === "text") el[initialValueKey] = el.defaultValue.replace(/[\r\n]/g, "");
				else if (el.type === "textarea") el[initialValueKey] = el.defaultValue.replace(/\r\n?/g, "\n");
			}
			el[assignKey] = getModelAssigner(vnode);
			const castToNumber = number || vnode.props && vnode.props.type === "number";
			addEventListener(el, lazy ? "change" : "input", (e) => {
				if (e.target.composing) return;
				el[assignKey](castValue(el.value, trim, castToNumber));
			});
			if (trim || castToNumber) addEventListener(el, "change", () => {
				el.value = castValue(el.value, trim, castToNumber);
			});
			if (!lazy) {
				addEventListener(el, "compositionstart", onCompositionStart);
				addEventListener(el, "compositionend", onCompositionEnd);
				addEventListener(el, "change", onCompositionEnd);
			}
		},
		mounted(el, { value, modifiers: { trim, number } }) {
			const newValue = value == null ? "" : value;
			const initialValue = el[initialValueKey];
			delete el[initialValueKey];
			if (initialValue !== void 0 && (el.type === "text" || el.type === "textarea") && el.value !== initialValue) el[assignKey](castValue(el.value, trim, number));
			else el.value = newValue;
		},
		beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			if (el.composing) return;
			const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
			const newValue = value == null ? "" : value;
			if (elValue === newValue) return;
			const rootNode = el.getRootNode();
			if ((rootNode instanceof Document || rootNode instanceof ShadowRoot) && rootNode.activeElement === el && el.type !== "range") {
				if (lazy && value === oldValue) return;
				if (trim && el.value.trim() === newValue) return;
			}
			el.value = newValue;
		}
	};
	var vModelCheckbox = {
		deep: true,
		created(el, _, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			addEventListener(el, "change", () => {
				const modelValue = el._modelValue;
				const elementValue = getValue(el);
				const checked = el.checked;
				const assign = el[assignKey];
				if (isArray(modelValue)) {
					const index = looseIndexOf(modelValue, elementValue);
					const found = index !== -1;
					if (checked && !found) assign(modelValue.concat(elementValue));
					else if (!checked && found) {
						const filtered = [...modelValue];
						filtered.splice(index, 1);
						assign(filtered);
					}
				} else if (isSet(modelValue)) {
					const cloned = new Set(modelValue);
					if (checked) cloned.add(elementValue);
					else cloned.delete(elementValue);
					assign(cloned);
				} else assign(getCheckboxValue(el, checked));
			});
		},
		mounted: setChecked,
		beforeUpdate(el, binding, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			setChecked(el, binding, vnode);
		}
	};
	function setChecked(el, { value, oldValue }, vnode) {
		el._modelValue = value;
		let checked;
		if (isArray(value)) checked = looseIndexOf(value, vnode.props.value) > -1;
		else if (isSet(value)) checked = value.has(vnode.props.value);
		else {
			if (value === oldValue) return;
			checked = looseEqual(value, getCheckboxValue(el, true));
		}
		if (el.checked !== checked) el.checked = checked;
	}
	function getValue(el) {
		return "_value" in el ? el._value : el.value;
	}
	function getCheckboxValue(el, checked) {
		const key = checked ? "_trueValue" : "_falseValue";
		return key in el ? el[key] : checked;
	}
	var systemModifiers = [
		"ctrl",
		"shift",
		"alt",
		"meta"
	];
	var modifierGuards = {
		stop: (e) => e.stopPropagation(),
		prevent: (e) => e.preventDefault(),
		self: (e) => e.target !== e.currentTarget,
		ctrl: (e) => !e.ctrlKey,
		shift: (e) => !e.shiftKey,
		alt: (e) => !e.altKey,
		meta: (e) => !e.metaKey,
		left: (e) => "button" in e && e.button !== 0,
		middle: (e) => "button" in e && e.button !== 1,
		right: (e) => "button" in e && e.button !== 2,
		exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
	};
	var withModifiers = (fn, modifiers) => {
		if (!fn) return fn;
		const cache = fn._withMods || (fn._withMods = {});
		const cacheKey = modifiers.join(".");
		return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
			for (let i = 0; i < modifiers.length; i++) {
				const guard = modifierGuards[modifiers[i]];
				if (guard && guard(event, modifiers)) return;
			}
			return fn(event, ...args);
		}));
	};
	var rendererOptions = extend({ patchProp }, nodeOps);
	var renderer;
	function ensureRenderer() {
		return renderer || (renderer = createRenderer(rendererOptions));
	}
	var createApp = ((...args) => {
		const app = ensureRenderer().createApp(...args);
		const { mount } = app;
		app.mount = (containerOrSelector) => {
			const container = normalizeContainer(containerOrSelector);
			if (!container) return;
			const component = app._component;
			if (!isFunction(component) && !component.render && !component.template) component.template = container.innerHTML;
			if (container.nodeType === 1) container.textContent = "";
			const proxy = mount(container, false, resolveRootNamespace(container));
			if (container instanceof Element) {
				container.removeAttribute("v-cloak");
				container.setAttribute("data-v-app", "");
			}
			return proxy;
		};
		return app;
	});
	function resolveRootNamespace(container) {
		if (container instanceof SVGElement) return "svg";
		if (typeof MathMLElement === "function" && container instanceof MathMLElement) return "mathml";
	}
	function normalizeContainer(container) {
		if (isString(container)) return document.querySelector(container);
		return container;
	}
	var ReaderEntryButton_vue_vue_type_script_setup_true_lang_default = defineComponent({
		__name: "ReaderEntryButton",
		emits: ["enter"],
		setup(__props, { emit: __emit }) {
			const emit = __emit;
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("button", {
					id: "mnr-entry-button",
					class: "mnr-reader-entry",
					type: "button",
					title: "进入阅读模式",
					"aria-label": "进入阅读模式",
					onClick: _cache[0] || (_cache[0] = ($event) => emit("enter"))
				}, [..._cache[1] || (_cache[1] = [createStaticVNode("<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" data-v-e6dad6e3><path d=\"M12 7v14\" data-v-e6dad6e3></path><path d=\"M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15\" data-v-e6dad6e3></path><path d=\"M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3\" data-v-e6dad6e3></path><path d=\"M3 18h6a3 3 0 0 1 3 3\" data-v-e6dad6e3></path><path d=\"M21 18h-6a3 3 0 0 0-3 3\" data-v-e6dad6e3></path></svg><span data-v-e6dad6e3>进入阅读模式</span>", 2)])]);
			};
		}
	});
	var _plugin_vue_export_helper_default = (sfc, props) => {
		const target = sfc.__vccOpts || sfc;
		for (const [key, val] of props) target[key] = val;
		return target;
	};
	var ReaderEntryButton_default = _plugin_vue_export_helper_default(ReaderEntryButton_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-e6dad6e3"]]);
	function useEventListener(type, listener, options = {}) {
		const { target = window, passive = false, capture = false } = options;
		let attached = false;
		const add = (currentTarget) => {
			const element = unref(currentTarget);
			if (element && !attached) {
				element.addEventListener(type, listener, {
					capture,
					passive
				});
				attached = true;
			}
		};
		const remove = (currentTarget) => {
			const element = unref(currentTarget);
			if (element && attached) {
				element.removeEventListener(type, listener, capture);
				attached = false;
			}
		};
		onMounted(() => add(target));
		onScopeDispose(() => remove(target));
		if (isRef(target)) watch(target, (newTarget, oldTarget) => {
			remove(oldTarget);
			add(newTarget);
		});
		return () => remove(target);
	}
	function getDeepActiveElement() {
		let active = document.activeElement;
		while (active instanceof window.HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
		return active instanceof window.HTMLElement ? active : null;
	}
	var _hoisted_1$7 = { class: "mnr-entry-preference" };
	var _hoisted_2$5 = { class: "mnr-entry-prompt-actions" };
	var ReaderEntryPrompt_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "ReaderEntryPrompt",
		props: { visible: { type: Boolean } },
		emits: ["respond"],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const rememberForSite = ref(true);
			const cardRef = ref(null);
			const acceptButtonRef = ref(null);
			let previouslyFocused = null;
			function handleAccept() {
				emit("respond", {
					accepted: true,
					rememberForSite: rememberForSite.value
				});
			}
			function handleDismiss() {
				emit("respond", {
					accepted: false,
					rememberForSite: false
				});
			}
			function trapFocus(event) {
				const card = cardRef.value;
				if (!card) return;
				const focusable = Array.from(card.querySelectorAll("button:not([disabled]), input:not([disabled])"));
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				const activeElement = getDeepActiveElement();
				if (event.shiftKey && activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
			function handleDialogKeydown(event) {
				const keyboardEvent = event;
				const card = cardRef.value;
				if (!props.visible || !card || !keyboardEvent.composedPath().includes(card)) return;
				if (keyboardEvent.key === "Escape") {
					keyboardEvent.preventDefault();
					keyboardEvent.stopImmediatePropagation();
					handleDismiss();
				} else if (keyboardEvent.key === "Tab") {
					keyboardEvent.stopImmediatePropagation();
					trapFocus(keyboardEvent);
				}
			}
			useEventListener("keydown", handleDialogKeydown, { capture: true });
			watch(() => props.visible, async (visible) => {
				if (visible) {
					previouslyFocused = getDeepActiveElement();
					await nextTick();
					acceptButtonRef.value?.focus({ preventScroll: true });
				} else {
					await nextTick();
					previouslyFocused?.focus?.({ preventScroll: true });
					previouslyFocused = null;
				}
			}, { immediate: true });
			return (_ctx, _cache) => {
				return openBlock(), createBlock(Transition, { name: "mnr-entry-prompt-fade" }, {
					default: withCtx(() => [__props.visible ? (openBlock(), createElementBlock("div", {
						key: 0,
						class: "mnr-entry-prompt-overlay",
						onClick: withModifiers(handleDismiss, ["self"])
					}, [createBaseVNode("section", {
						ref_key: "cardRef",
						ref: cardRef,
						class: "mnr-entry-prompt-card",
						role: "dialog",
						"aria-modal": "true",
						"aria-labelledby": "mnr-entry-prompt-title",
						"aria-describedby": "mnr-entry-prompt-description"
					}, [
						_cache[2] || (_cache[2] = createBaseVNode("header", { class: "mnr-entry-prompt-header" }, [createBaseVNode("span", {
							class: "mnr-entry-prompt-icon",
							"aria-hidden": "true"
						}, [createBaseVNode("svg", { viewBox: "0 0 24 24" }, [
							createBaseVNode("path", { d: "M12 7v14" }),
							createBaseVNode("path", { d: "M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15" }),
							createBaseVNode("path", { d: "M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3" }),
							createBaseVNode("path", { d: "M3 18h6a3 3 0 0 1 3 3" }),
							createBaseVNode("path", { d: "M21 18h-6a3 3 0 0 0-3 3" })
						])]), createBaseVNode("div", null, [createBaseVNode("h3", { id: "mnr-entry-prompt-title" }, "检测到小说正文"), createBaseVNode("p", { id: "mnr-entry-prompt-description" }, " 是否使用阅读模式打开本章？正文将采用统一排版并支持连续滚动阅读。 ")])], -1)),
						createBaseVNode("label", _hoisted_1$7, [withDirectives(createBaseVNode("input", {
							"onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => rememberForSite.value = $event),
							type: "checkbox"
						}, null, 512), [[vModelCheckbox, rememberForSite.value]]), _cache[1] || (_cache[1] = createBaseVNode("span", null, [createBaseVNode("strong", null, "以后在本站自动进入"), createBaseVNode("small", null, "下次打开本站章节时直接进入阅读模式")], -1))]),
						createBaseVNode("div", _hoisted_2$5, [createBaseVNode("button", {
							type: "button",
							class: "mnr-entry-button secondary",
							onClick: handleDismiss
						}, " 暂不 "), createBaseVNode("button", {
							ref_key: "acceptButtonRef",
							ref: acceptButtonRef,
							type: "button",
							class: "mnr-entry-button primary",
							onClick: handleAccept
						}, " 进入阅读模式 ", 512)])
					], 512)])) : createCommentVNode("", true)]),
					_: 1
				});
			};
		}
	}), [["__scopeId", "data-v-2c14cbfa"]]);
	function getMnrGlobalState() {
		if (!window.__MY_NOVEL_READER__) window.__MY_NOVEL_READER__ = {};
		return window.__MY_NOVEL_READER__;
	}
	function getRegisteredShadowRoots(state) {
		if (!state.shadowRoots) state.shadowRoots = new Set();
		return state.shadowRoots;
	}
	var BASE_RESET_CSS = `
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
	function ensureStyleElement(shadowRoot, id) {
		const existing = shadowRoot.querySelector(`#${id}`);
		if (existing?.tagName?.toLowerCase() === "style") return existing;
		const style = document.createElement("style");
		style.id = id;
		shadowRoot.appendChild(style);
		return style;
	}
	function applyStyleProperties(shadowRoot, properties) {
		const host = shadowRoot.host;
		if (!host?.style) return;
		for (const [name, value] of Object.entries(properties)) host.style.setProperty(name, value);
	}
	function applyCustomCSS(shadowRoot, css) {
		const customStyle = shadowRoot.querySelector("#mnr-custom-css");
		if (css) {
			const style = customStyle || ensureStyleElement(shadowRoot, "mnr-custom-css");
			style.textContent = css;
		} else customStyle?.remove();
	}
	function applyRuntimeStyles(shadowRoot, state = getMnrGlobalState()) {
		if (state.styleProperties) applyStyleProperties(shadowRoot, state.styleProperties);
		applyCustomCSS(shadowRoot, state.customCSS || "");
	}
	function applyAppStyles(shadowRoot, state = getMnrGlobalState()) {
		if (!state.styles) return;
		const appStyle = ensureStyleElement(shadowRoot, "mnr-app-styles");
		appStyle.textContent = state.styles;
	}
	function setShadowStyleProperties(properties) {
		const state = getMnrGlobalState();
		state.styleProperties ||= {};
		Object.assign(state.styleProperties, properties);
		for (const shadowRoot of getRegisteredShadowRoots(state)) applyStyleProperties(shadowRoot, properties);
	}
	function setShadowCustomCSS(css) {
		const state = getMnrGlobalState();
		state.customCSS = css;
		for (const shadowRoot of getRegisteredShadowRoots(state)) applyCustomCSS(shadowRoot, css);
	}
	function createShadowMount(hostId) {
		const globalState = getMnrGlobalState();
		const host = document.createElement("div");
		host.id = hostId;
		host.lang = "zh-CN";
		document.body.appendChild(host);
		const shadowRoot = host.attachShadow({ mode: "open" });
		getRegisteredShadowRoots(globalState).add(shadowRoot);
		const resetStyle = document.createElement("style");
		resetStyle.textContent = BASE_RESET_CSS;
		shadowRoot.appendChild(resetStyle);
		applyAppStyles(shadowRoot, globalState);
		applyRuntimeStyles(shadowRoot, globalState);
		const mountPoint = document.createElement("div");
		mountPoint.id = `${hostId}-mount`;
		shadowRoot.appendChild(mountPoint);
		const cleanup = () => {
			host.remove();
			globalState.shadowRoots?.delete(shadowRoot);
			if (globalState.shadowRoots?.size === 0) globalState.shadowRoots = void 0;
		};
		return {
			host,
			shadowRoot,
			mountPoint,
			cleanup
		};
	}
	var IS_CLIENT = typeof window !== "undefined";
	var activePinia;
	var setActivePinia = (pinia) => activePinia = pinia;
	var piniaSymbol = Symbol();
	function isPlainObject(o) {
		return o && typeof o === "object" && Object.prototype.toString.call(o) === "[object Object]" && typeof o.toJSON !== "function";
	}
	var _global = (() => typeof window === "object" && window.window === window ? window : typeof self === "object" && self.self === self ? self : typeof global === "object" && global.global === global ? global : typeof globalThis === "object" ? globalThis : { HTMLElement: null })();
	function bom(blob, { autoBom = false } = {}) {
		if (autoBom && /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) return new Blob([String.fromCharCode(65279), blob], { type: blob.type });
		return blob;
	}
	function download(url, name, opts) {
		const xhr = new XMLHttpRequest();
		xhr.open("GET", url);
		xhr.responseType = "blob";
		xhr.onload = function() {
			saveAs(xhr.response, name, opts);
		};
		xhr.onerror = function() {
			console.error("could not download file");
		};
		xhr.send();
	}
	function corsEnabled(url) {
		const xhr = new XMLHttpRequest();
		xhr.open("HEAD", url, false);
		try {
			xhr.send();
		} catch (e) {}
		return xhr.status >= 200 && xhr.status <= 299;
	}
	function click(node) {
		try {
			node.dispatchEvent(new MouseEvent("click"));
		} catch (e) {
			const evt = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				view: window,
				detail: 0,
				screenX: 80,
				screenY: 20,
				clientX: 80,
				clientY: 20,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				metaKey: false,
				button: 0,
				relatedTarget: null
			});
			node.dispatchEvent(evt);
		}
	}
	var _navigator = typeof navigator === "object" ? navigator : { userAgent: "" };
	var isMacOSWebView = (() => /Macintosh/.test(_navigator.userAgent) && /AppleWebKit/.test(_navigator.userAgent) && !/Safari/.test(_navigator.userAgent))();
	var saveAs = !IS_CLIENT ? () => {} : typeof HTMLAnchorElement !== "undefined" && "download" in HTMLAnchorElement.prototype && !isMacOSWebView ? downloadSaveAs : "msSaveOrOpenBlob" in _navigator ? msSaveAs : fileSaverSaveAs;
	function downloadSaveAs(blob, name = "download", opts) {
		const a = document.createElement("a");
		a.download = name;
		a.rel = "noopener";
		if (typeof blob === "string") {
			a.href = blob;
			if (a.origin !== location.origin) if (corsEnabled(a.href)) download(blob, name, opts);
			else {
				a.target = "_blank";
				click(a);
			}
			else click(a);
		} else {
			a.href = URL.createObjectURL(blob);
			setTimeout(function() {
				URL.revokeObjectURL(a.href);
			}, 4e4);
			setTimeout(function() {
				click(a);
			}, 0);
		}
	}
	function msSaveAs(blob, name = "download", opts) {
		if (typeof blob === "string") if (corsEnabled(blob)) download(blob, name, opts);
		else {
			const a = document.createElement("a");
			a.href = blob;
			a.target = "_blank";
			setTimeout(function() {
				click(a);
			});
		}
		else navigator.msSaveOrOpenBlob(bom(blob, opts), name);
	}
	function fileSaverSaveAs(blob, name, opts, popup) {
		popup = popup || open("", "_blank");
		if (popup) popup.document.title = popup.document.body.innerText = "downloading...";
		if (typeof blob === "string") return download(blob, name, opts);
		const force = blob.type === "application/octet-stream";
		const isSafari = /constructor/i.test(String(_global.HTMLElement)) || "safari" in _global;
		const isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);
		if ((isChromeIOS || force && isSafari || isMacOSWebView) && typeof FileReader !== "undefined") {
			const reader = new FileReader();
			reader.onloadend = function() {
				let url = reader.result;
				if (typeof url !== "string") {
					popup = null;
					throw new Error("Wrong reader.result type");
				}
				url = isChromeIOS ? url : url.replace(/^data:[^;]*;/, "data:attachment/file;");
				if (popup) popup.location.href = url;
				else location.assign(url);
				popup = null;
			};
			reader.readAsDataURL(blob);
		} else {
			const url = URL.createObjectURL(blob);
			if (popup) popup.location.assign(url);
			else location.href = url;
			popup = null;
			setTimeout(function() {
				URL.revokeObjectURL(url);
			}, 4e4);
		}
	}
	var { assign: assign$1 } = Object;
	function createPinia() {
		const scope = effectScope(true);
		const state = scope.run(() => ref({}));
		let _p = [];
		let toBeInstalled = [];
		const pinia = markRaw({
			install(app) {
				setActivePinia(pinia);
				pinia._a = app;
				app.provide(piniaSymbol, pinia);
				app.config.globalProperties.$pinia = pinia;
				toBeInstalled.forEach((plugin) => _p.push(plugin));
				toBeInstalled = [];
			},
			use(plugin) {
				if (!this._a) toBeInstalled.push(plugin);
				else _p.push(plugin);
				return this;
			},
			_p,
			_a: null,
			_e: scope,
			_s: new Map(),
			state
		});
		return pinia;
	}
	var noop = () => {};
	function addSubscription(subscriptions, callback, detached, onCleanup = noop) {
		subscriptions.add(callback);
		const removeSubscription = () => {
			subscriptions.delete(callback) && onCleanup();
		};
		if (!detached && getCurrentScope()) onScopeDispose(removeSubscription);
		return removeSubscription;
	}
	function triggerSubscriptions(subscriptions, ...args) {
		subscriptions.forEach((callback) => {
			callback(...args);
		});
	}
	var fallbackRunWithContext = (fn) => fn();
	var ACTION_MARKER = Symbol();
	var ACTION_NAME = Symbol();
	function mergeReactiveObjects(target, patchToApply) {
		if (target instanceof Map && patchToApply instanceof Map) patchToApply.forEach((value, key) => target.set(key, value));
		else if (target instanceof Set && patchToApply instanceof Set) patchToApply.forEach(target.add, target);
		for (const key in patchToApply) {
			if (!Object.hasOwn(patchToApply, key)) continue;
			const subPatch = patchToApply[key];
			const targetValue = target[key];
			if (isPlainObject(targetValue) && isPlainObject(subPatch) && Object.hasOwn(target, key) && !isRef(subPatch) && !isReactive(subPatch)) target[key] = mergeReactiveObjects(targetValue, subPatch);
			else target[key] = subPatch;
		}
		return target;
	}
	var skipHydrateSymbol = Symbol();
	function shouldHydrate(obj) {
		return !obj || typeof obj !== "object" || !Object.hasOwn(obj, skipHydrateSymbol);
	}
	var { assign } = Object;
	function isComputed(o) {
		return !!(isRef(o) && o.effect);
	}
	function createOptionsStore(id, options, pinia, hot) {
		const { state, actions, getters } = options;
		const initialState = pinia.state.value[id];
		let store;
		function setup() {
			if (!initialState && true) pinia.state.value[id] = state ? state() : {};
			return assign(toRefs(pinia.state.value[id]), actions, Object.keys(getters || {}).reduce((computedGetters, name) => {
				computedGetters[name] = markRaw(computed(() => {
					setActivePinia(pinia);
					const store = pinia._s.get(id);
					return getters[name].call(store, store);
				}));
				return computedGetters;
			}, {}));
		}
		store = createSetupStore(id, setup, options, pinia, hot, true);
		return store;
	}
	function createSetupStore($id, setup, options = {}, pinia, hot, isOptionsStore) {
		let scope;
		const optionsForPlugin = assign({ actions: {} }, options);
		const $subscribeOptions = { deep: true };
		let isListening;
		let isSyncListening;
		let subscriptions = new Set();
		let actionSubscriptions = new Set();
		let debuggerEvents;
		const initialState = pinia.state.value[$id];
		if (!isOptionsStore && !initialState && true) pinia.state.value[$id] = {};
		let activeListener;
		function $patch(partialStateOrMutator) {
			let subscriptionMutation;
			isListening = isSyncListening = false;
			if (typeof partialStateOrMutator === "function") {
				partialStateOrMutator(pinia.state.value[$id]);
				subscriptionMutation = {
					type: "patch function",
					storeId: $id,
					events: debuggerEvents
				};
			} else {
				mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator);
				subscriptionMutation = {
					type: "patch object",
					payload: partialStateOrMutator,
					storeId: $id,
					events: debuggerEvents
				};
			}
			const myListenerId = activeListener = Symbol();
			nextTick().then(() => {
				if (activeListener === myListenerId) isListening = true;
			});
			isSyncListening = true;
			triggerSubscriptions(subscriptions, subscriptionMutation, pinia.state.value[$id]);
		}
		const $reset = isOptionsStore ? function $reset() {
			const { state } = options;
			const newState = state ? state() : {};
			this.$patch(($state) => {
				assign($state, newState);
			});
		} : noop;
		function $dispose() {
			scope.stop();
			subscriptions.clear();
			actionSubscriptions.clear();
			pinia._s.delete($id);
		}
		const action = (fn, name = "") => {
			if (ACTION_MARKER in fn) {
				fn[ACTION_NAME] = name;
				return fn;
			}
			const wrappedAction = function() {
				setActivePinia(pinia);
				const args = Array.from(arguments);
				const afterCallbackSet = new Set();
				const onErrorCallbackSet = new Set();
				function after(callback) {
					afterCallbackSet.add(callback);
				}
				function onError(callback) {
					onErrorCallbackSet.add(callback);
				}
				triggerSubscriptions(actionSubscriptions, {
					args,
					name: wrappedAction[ACTION_NAME],
					store,
					after,
					onError
				});
				let ret;
				try {
					ret = fn.apply(this && this.$id === $id ? this : store, args);
				} catch (error) {
					triggerSubscriptions(onErrorCallbackSet, error);
					throw error;
				}
				if (ret instanceof Promise) return ret.then((value) => {
					triggerSubscriptions(afterCallbackSet, value);
					return value;
				}).catch((error) => {
					triggerSubscriptions(onErrorCallbackSet, error);
					return Promise.reject(error);
				});
				triggerSubscriptions(afterCallbackSet, ret);
				return ret;
			};
			wrappedAction[ACTION_MARKER] = true;
			wrappedAction[ACTION_NAME] = name;
			return wrappedAction;
		};
		const store = reactive({
			_p: pinia,
			$id,
			$onAction: addSubscription.bind(null, actionSubscriptions),
			$patch,
			$reset,
			$subscribe(callback, options = {}) {
				if (subscriptions.has(callback)) return noop;
				const removeSubscription = addSubscription(subscriptions, callback, options.detached, () => stopWatcher());
				const stopWatcher = scope.run(() => watch(() => pinia.state.value[$id], (state) => {
					if (options.flush === "sync" ? isSyncListening : isListening) callback({
						storeId: $id,
						type: "direct",
						events: debuggerEvents
					}, state);
				}, assign({}, $subscribeOptions, options)));
				return removeSubscription;
			},
			$dispose
		});
		pinia._s.set($id, store);
		const setupStore = (pinia._a && pinia._a.runWithContext || fallbackRunWithContext)(() => pinia._e.run(() => (scope = effectScope()).run(() => setup({ action }))));
		for (const key in setupStore) {
			const prop = setupStore[key];
			if (isRef(prop) && !isComputed(prop) || isReactive(prop)) {
				if (!isOptionsStore) {
					if (initialState && shouldHydrate(prop)) if (isRef(prop)) prop.value = initialState[key];
					else {
						if (prop instanceof Set || prop instanceof Map) prop.clear();
						mergeReactiveObjects(prop, initialState[key]);
					}
					pinia.state.value[$id][key] = prop;
				}
			} else if (typeof prop === "function") {
				setupStore[key] = action(prop, key);
				optionsForPlugin.actions[key] = prop;
			}
		}
		assign(store, setupStore);
		assign(toRaw(store), setupStore);
		Object.defineProperty(store, "$state", {
			get: () => pinia.state.value[$id],
			set: (state) => {
				$patch(($state) => {
					assign($state, state);
				});
			}
		});
		pinia._p.forEach((extender) => {
			const extensions = scope.run(() => extender({
				store,
				app: pinia._a,
				pinia,
				options: optionsForPlugin
			}));
			assign(store, extensions);
		});
		if (initialState && isOptionsStore && options.hydrate) options.hydrate(store.$state, initialState);
		isListening = true;
		isSyncListening = true;
		return store;
	}
	function defineStore(id, setup, setupOptions) {
		let options;
		const isSetupStore = typeof setup === "function";
		options = isSetupStore ? setupOptions : setup;
		function useStore(pinia, hot) {
			const hasContext = hasInjectionContext();
			pinia = pinia || (hasContext ? inject(piniaSymbol, null) : null);
			if (pinia) setActivePinia(pinia);
			pinia = activePinia;
			if (!pinia._s.has(id)) {
				if (isSetupStore) createSetupStore(id, setup, options, pinia);
				else createOptionsStore(id, options, pinia);
			}
			return pinia._s.get(id);
		}
		useStore.$id = id;
		return useStore;
	}
	var THEMES = [
		{
			id: "system",
			name: "跟随系统",
			background: "#f5f5f5",
			text: "#242424",
			link: "#2563a8",
			onLink: "#ffffff",
			border: "#d8d8d8"
		},
		{
			id: "light",
			name: "明亮",
			background: "#ffffff",
			text: "#1a1a1a",
			link: "#0066cc",
			onLink: "#ffffff",
			border: "#e5e5e5"
		},
		{
			id: "sepia",
			name: "米黄",
			background: "#f8f1e3",
			text: "#4a4137",
			link: "#7a4f26",
			onLink: "#ffffff",
			border: "#e8dcc8"
		},
		{
			id: "green",
			name: "绿色",
			background: "#edf6ed",
			text: "#243429",
			link: "#2f6f3d",
			onLink: "#ffffff",
			border: "#c9ddc9"
		},
		{
			id: "blue",
			name: "蓝色",
			background: "#eaf3fb",
			text: "#263746",
			link: "#2563a8",
			onLink: "#ffffff",
			border: "#c7d8e8"
		},
		{
			id: "dark",
			name: "深色",
			background: "#1e1e1e",
			text: "#c8c8c8",
			link: "#78bdf2",
			onLink: "#111111",
			border: "#3a3a3a"
		}
	];
	var DEFAULT_READING = {
		fontFamily: "system-ui, -apple-system, \"Microsoft YaHei\", sans-serif",
		fontSize: 18,
		lineHeight: 1.8,
		letterSpacing: 0,
		paragraphIndent: 2,
		maxWidth: 800,
		padding: 20,
		textConversion: "none"
	};
	var DEFAULT_BEHAVIOR = {
		keyboardNavigation: true,
		swipeGestures: true,
		autoHideHeader: true,
		preloadNext: true,
		showProgress: true
	};
	var DEFAULT_PROTECTION = {
		mode: "standard",
		blockRedirects: true,
		enableRightClick: true,
		enableSelection: true,
		blockPopups: true
	};
	function toProtectionOptions(settings) {
		const aggressive = settings.mode === "aggressive";
		return {
			blockRedirects: settings.blockRedirects,
			enableRightClick: settings.enableRightClick,
			enableSelection: settings.enableSelection,
			blockPopups: settings.blockPopups,
			clearTimers: aggressive,
			unlockKeyboard: true,
			cleanupScripts: aggressive,
			blockVisibilityDetection: false
		};
	}
	var STORAGE_KEY$1 = "mnr-config";
	var SAVE_DEBOUNCE_MS = 300;
	var useConfigStore = defineStore("config", () => {
		const themeId = ref("system");
		const reading = ref({ ...DEFAULT_READING });
		const behavior = ref({ ...DEFAULT_BEHAVIOR });
		const protection = ref({ ...DEFAULT_PROTECTION });
		const customCSS = ref("");
		const customCleanupRegex = ref("");
		let saveTimer = null;
		let savePending = false;
		let saveQueue = Promise.resolve();
		let isHydrating = false;
		const theme = () => {
			if (themeId.value === "system") {
				const prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
				return THEMES.find((t) => t.id === (prefersDark ? "dark" : "light")) || THEMES[1];
			}
			return THEMES.find((t) => t.id === themeId.value) || THEMES[1];
		};
		function setTheme(id) {
			if (THEMES.some((t) => t.id === id)) {
				themeId.value = id;
				applyTheme();
			}
		}
		function updateReading(settings) {
			Object.assign(reading.value, settings);
			applyReading(settings);
		}
		function updateBehavior(settings) {
			Object.assign(behavior.value, settings);
		}
		function updateProtection(settings) {
			Object.assign(protection.value, settings);
		}
		function setCustomCSS(css) {
			customCSS.value = css;
			applyCustomCSS();
		}
		function setCustomCleanupRegex(source) {
			customCleanupRegex.value = source;
		}
		function applyTheme() {
			const t = theme();
			setShadowStyleProperties({
				"--mnr-bg": t.background,
				"--mnr-text": t.text,
				"--mnr-link": t.link,
				"--mnr-on-link": t.onLink,
				"--mnr-border": t.border
			});
		}
		function applyReading(settings = reading.value) {
			const properties = {};
			if (settings.fontFamily !== void 0) properties["--mnr-font-family"] = settings.fontFamily;
			if (settings.fontSize !== void 0) properties["--mnr-font-size"] = `${settings.fontSize}px`;
			if (settings.lineHeight !== void 0) properties["--mnr-line-height"] = `${settings.lineHeight}`;
			if (settings.letterSpacing !== void 0) properties["--mnr-letter-spacing"] = `${settings.letterSpacing}em`;
			if (settings.paragraphIndent !== void 0) properties["--mnr-paragraph-indent"] = `${settings.paragraphIndent}em`;
			if (settings.maxWidth !== void 0) properties["--mnr-max-width"] = `${settings.maxWidth}px`;
			if (settings.padding !== void 0) properties["--mnr-padding"] = `${settings.padding}px`;
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
		async function load() {
			isHydrating = true;
			try {
				let data = null;
				let hasInvalidData = false;
				if (typeof GM_getValue !== "undefined") data = await GM_getValue(STORAGE_KEY$1, null);
				else if (typeof localStorage !== "undefined") data = localStorage.getItem(STORAGE_KEY$1);
				if (data) {
					let parsed;
					if (typeof data === "string") try {
						parsed = JSON.parse(data);
					} catch (e) {
						console.error("[ConfigStore] Failed to parse config JSON:", e);
						hasInvalidData = true;
						parsed = null;
					}
					else parsed = data;
					if (!hasInvalidData && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
						console.warn("[ConfigStore] Invalid config data, expected object");
						hasInvalidData = true;
					}
					if (!hasInvalidData) {
						const config = parsed;
						if (typeof config.themeId === "string") themeId.value = config.themeId;
						if (config.reading && typeof config.reading === "object") reading.value = {
							...DEFAULT_READING,
							...config.reading
						};
						if (config.behavior && typeof config.behavior === "object") behavior.value = {
							...DEFAULT_BEHAVIOR,
							...config.behavior
						};
						if (config.protection && typeof config.protection === "object") protection.value = {
							...DEFAULT_PROTECTION,
							...config.protection
						};
						if (typeof config.customCSS === "string") customCSS.value = config.customCSS;
						if (typeof config.customCleanupRegex === "string") customCleanupRegex.value = config.customCleanupRegex;
					}
				}
				applyAll();
				if (hasInvalidData) {
					console.warn("[ConfigStore] Corrupted config detected; resetting to defaults");
					await save();
				}
			} catch (e) {
				console.error("[ConfigStore] Load error:", e);
			} finally {
				isHydrating = false;
			}
		}
		function serialize() {
			return JSON.stringify({
				themeId: themeId.value,
				reading: reading.value,
				behavior: behavior.value,
				protection: protection.value,
				customCSS: customCSS.value,
				customCleanupRegex: customCleanupRegex.value
			});
		}
		function save() {
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = null;
			}
			savePending = false;
			const data = serialize();
			saveQueue = saveQueue.then(async () => {
				if (typeof GM_setValue !== "undefined") await GM_setValue(STORAGE_KEY$1, data);
				else if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY$1, data);
			}).catch((e) => console.error("[ConfigStore] Save error:", e));
			return saveQueue;
		}
		function scheduleSave() {
			savePending = true;
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				saveTimer = null;
				save();
			}, SAVE_DEBOUNCE_MS);
		}
		function flushSave() {
			return savePending ? save() : saveQueue;
		}
		watch([
			themeId,
			reading,
			behavior,
			protection,
			customCSS,
			customCleanupRegex
		], () => {
			if (!isHydrating) scheduleSave();
		}, {
			deep: true,
			flush: "sync"
		});
		if (typeof window !== "undefined" && typeof window.matchMedia === "function") window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
			if (themeId.value === "system") applyTheme();
		});
		function $reset() {
			themeId.value = "system";
			reading.value = { ...DEFAULT_READING };
			behavior.value = { ...DEFAULT_BEHAVIOR };
			protection.value = { ...DEFAULT_PROTECTION };
			customCSS.value = "";
			customCleanupRegex.value = "";
			applyAll();
			save();
		}
		function resetReading() {
			reading.value = { ...DEFAULT_READING };
			applyReading();
		}
		return {
			themeId,
			reading,
			behavior,
			protection,
			customCSS,
			customCleanupRegex,
			theme,
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
			$reset
		};
	});
	var VIP_BLOCK_TOAST = "该章节为VIP/付费内容，无法加载";
	var SECTION_MERGING_TOAST = "本章正在加载后续内容，请稍候";
	var SECTION_INCOMPLETE_TOAST = "本章内容不完整，无法确认下一章";
	var nextChapterEntryId = 0;
	function createChapterEntryId() {
		return `chapter-${++nextChapterEntryId}`;
	}
	function isChapterComplete(entry) {
		return !!entry && !entry.sectionProgress && !entry.sectionsIncomplete;
	}
	var Trie = class {
		constructor() {
			this.map = new Map();
		}
		addWord(s, v) {
			let { map } = this;
			for (const c of s) {
				const cp = c.codePointAt(0);
				const nextMap = map.get(cp);
				if (nextMap == null) {
					const tmp = new Map();
					map.set(cp, tmp);
					map = tmp;
				} else map = nextMap;
			}
			map.trie_val = v;
		}
		loadDict(d) {
			if (typeof d === "string") {
				d = d.split("|");
				for (const line of d) {
					const [l, r] = line.split(" ");
					if (typeof r !== "string") throw new TypeError("Invalid dictionary entry: expected string entries to use \"source replacement\" format.");
					this.addWord(l, r);
				}
			} else for (const arr of d) {
				if (!Array.isArray(arr) || typeof arr[0] !== "string" || typeof arr[1] !== "string") throw new TypeError("Invalid dictionary entry: expected [source, replacement] pairs. If you are passing locale dictionaries to ConverterFactory, spread them, for example: ConverterFactory(...Locale.from.cn, ...Locale.to.hk).");
				const [l, r] = arr;
				this.addWord(l, r);
			}
		}
		loadDictGroup(arr) {
			arr.slice().reverse().forEach((d) => {
				this.loadDict(d);
			});
		}
		matchPrefix(s, i) {
			const n = s.length;
			let t_curr = this.map, k = 0, v;
			for (let j = i; j < n;) {
				const x = s.codePointAt(j);
				j += x > 65535 ? 2 : 1;
				const t_next = t_curr.get(x);
				if (typeof t_next === "undefined") break;
				t_curr = t_next;
				const v_curr = t_curr.trie_val;
				if (typeof v_curr !== "undefined") {
					k = j;
					v = v_curr;
				}
			}
			if (k > 0) return {
				end: k,
				value: v
			};
			return null;
		}
		segment(s) {
			const n = s.length, segments = [];
			let orig_i = null;
			for (let i = 0; i < n;) {
				const matched = this.matchPrefix(s, i);
				if (matched) {
					if (orig_i !== null) {
						segments.push(s.slice(orig_i, i));
						orig_i = null;
					}
					segments.push(s.slice(i, matched.end));
					i = matched.end;
				} else {
					if (orig_i === null) orig_i = i;
					i += getUnmatchedLength(s, i);
				}
			}
			if (orig_i !== null) segments.push(s.slice(orig_i, n));
			return segments;
		}
		convert(s) {
			const n = s.length, arr = [];
			let orig_i = null;
			for (let i = 0; i < n;) {
				const matched = this.matchPrefix(s, i);
				if (matched) {
					if (orig_i !== null) {
						arr.push(s.slice(orig_i, i));
						orig_i = null;
					}
					arr.push(matched.value);
					i = matched.end;
				} else {
					if (orig_i === null) orig_i = i;
					i += getUnmatchedLength(s, i);
				}
			}
			if (orig_i !== null) arr.push(s.slice(orig_i, n));
			return arr.join("");
		}
	};
	function getCodePointLength(s, i) {
		return s.codePointAt(i) > 65535 ? 2 : 1;
	}
	function getIdeographicDescriptionArity(cp) {
		if (cp >= 12272 && cp <= 12273) return 2;
		if (cp >= 12274 && cp <= 12275) return 3;
		if (cp >= 12276 && cp <= 12287) return 2;
		return 0;
	}
	function getIdeographicDescriptionSequenceEnd(s, i) {
		const arity = getIdeographicDescriptionArity(s.codePointAt(i));
		if (arity === 0) return 0;
		let end = i + getCodePointLength(s, i);
		for (let n = 0; n < arity; n += 1) {
			if (end >= s.length) return 0;
			end = getIdeographicDescriptionSequenceEnd(s, end) || end + getCodePointLength(s, end);
		}
		return end;
	}
	function getUnmatchedLength(s, i) {
		const idsEnd = getIdeographicDescriptionSequenceEnd(s, i);
		if (idsEnd > i) return idsEnd - i;
		return getCodePointLength(s, i);
	}
	function ConverterFactory(...dictGroups) {
		const trieArr = normalizeConverterFactoryDictGroups(dictGroups).map((grp) => {
			const t = new Trie();
			t.loadDictGroup(grp);
			return t;
		});
		function convert(s) {
			return trieArr.reduce((res, t) => {
				return t.convert(res);
			}, s);
		}
		return convert;
	}
	function isDictPair(entry) {
		return Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string";
	}
	function isSerializedDict(dict) {
		return typeof dict === "string" && (dict === "" || dict.includes(" "));
	}
	function isDictLike(dict) {
		return typeof dict === "string" || Array.isArray(dict) && dict.every(isDictPair);
	}
	function isDictGroup(dictGroup) {
		return Array.isArray(dictGroup) && dictGroup.every((dict) => {
			return isSerializedDict(dict) || Array.isArray(dict) && dict.every(isDictPair);
		});
	}
	function isDictGroupCollection(dictGroups) {
		return Array.isArray(dictGroups) && dictGroups.every(isDictGroup);
	}
	function normalizeConverterFactoryDictGroups(dictGroups) {
		return dictGroups.flatMap((dictGroup) => {
			if (isDictGroupCollection(dictGroup)) return dictGroup;
			if (isDictGroup(dictGroup)) return [dictGroup];
			if (!Array.isArray(dictGroup)) throw new TypeError("Invalid ConverterFactory argument: expected a dictionary group or locale dictionary collection.");
			const groups = [];
			let i = 0;
			while (i < dictGroup.length && isDictGroup(dictGroup[i])) {
				groups.push(dictGroup[i].slice());
				i += 1;
			}
			const appendedDicts = dictGroup.slice(i);
			if (groups.length > 0 && appendedDicts.length > 0 && appendedDicts.every(isDictLike)) {
				groups[groups.length - 1].push(...appendedDicts);
				return groups;
			}
			return [dictGroup];
		});
	}
	var CJK_Compatibility_Ideographs_default = "豈 豈|更 更|車 車|賈 賈|滑 滑|串 串|句 句|龜 龜|龜 龜|契 契|金 金|喇 喇|奈 奈|懶 懶|癩 癩|羅 羅|蘿 蘿|螺 螺|裸 裸|邏 邏|樂 樂|洛 洛|烙 烙|珞 珞|落 落|酪 酪|駱 駱|亂 亂|卵 卵|欄 欄|爛 爛|蘭 蘭|鸞 鸞|嵐 嵐|濫 濫|藍 藍|襤 襤|拉 拉|臘 臘|蠟 蠟|廊 廊|朗 朗|浪 浪|狼 狼|郎 郎|來 來|冷 冷|勞 勞|擄 擄|櫓 櫓|爐 爐|盧 盧|老 老|蘆 蘆|虜 虜|路 路|露 露|魯 魯|鷺 鷺|碌 碌|祿 祿|綠 綠|菉 菉|錄 錄|鹿 鹿|論 論|壟 壟|弄 弄|籠 籠|聾 聾|牢 牢|磊 磊|賂 賂|雷 雷|壘 壘|屢 屢|樓 樓|淚 淚|漏 漏|累 累|縷 縷|陋 陋|勒 勒|肋 肋|凜 凜|凌 凌|稜 稜|綾 綾|菱 菱|陵 陵|讀 讀|拏 拏|樂 樂|諾 諾|丹 丹|寧 寧|怒 怒|率 率|異 異|北 北|磻 磻|便 便|復 復|不 不|泌 泌|數 數|索 索|參 參|塞 塞|省 省|葉 葉|說 說|殺 殺|辰 辰|沈 沈|拾 拾|若 若|掠 掠|略 略|亮 亮|兩 兩|凉 凉|梁 梁|糧 糧|良 良|諒 諒|量 量|勵 勵|呂 呂|女 女|廬 廬|旅 旅|濾 濾|礪 礪|閭 閭|驪 驪|麗 麗|黎 黎|力 力|曆 曆|歷 歷|轢 轢|年 年|憐 憐|戀 戀|撚 撚|漣 漣|煉 煉|璉 璉|秊 秊|練 練|聯 聯|輦 輦|蓮 蓮|連 連|鍊 鍊|列 列|劣 劣|咽 咽|烈 烈|裂 裂|說 說|廉 廉|念 念|捻 捻|殮 殮|簾 簾|獵 獵|令 令|囹 囹|寧 寧|嶺 嶺|怜 怜|玲 玲|瑩 瑩|羚 羚|聆 聆|鈴 鈴|零 零|靈 靈|領 領|例 例|禮 禮|醴 醴|隸 隸|惡 惡|了 了|僚 僚|寮 寮|尿 尿|料 料|樂 樂|燎 燎|療 療|蓼 蓼|遼 遼|龍 龍|暈 暈|阮 阮|劉 劉|杻 杻|柳 柳|流 流|溜 溜|琉 琉|留 留|硫 硫|紐 紐|類 類|六 六|戮 戮|陸 陸|倫 倫|崙 崙|淪 淪|輪 輪|律 律|慄 慄|栗 栗|率 率|隆 隆|利 利|吏 吏|履 履|易 易|李 李|梨 梨|泥 泥|理 理|痢 痢|罹 罹|裏 裏|裡 裡|里 里|離 離|匿 匿|溺 溺|吝 吝|燐 燐|璘 璘|藺 藺|隣 隣|鱗 鱗|麟 麟|林 林|淋 淋|臨 臨|立 立|笠 笠|粒 粒|狀 狀|炙 炙|識 識|什 什|茶 茶|刺 刺|切 切|度 度|拓 拓|糖 糖|宅 宅|洞 洞|暴 暴|輻 輻|行 行|降 降|見 見|廓 廓|兀 兀|嗀 嗀|塚 塚|晴 晴|凞 凞|猪 猪|益 益|礼 礼|神 神|祥 祥|福 福|靖 靖|精 精|羽 羽|蘒 蘒|諸 諸|逸 逸|都 都|飯 飯|飼 飼|館 館|鶴 鶴|郞 郞|隷 隷|侮 侮|僧 僧|免 免|勉 勉|勤 勤|卑 卑|喝 喝|嘆 嘆|器 器|塀 塀|墨 墨|層 層|屮 屮|悔 悔|慨 慨|憎 憎|懲 懲|敏 敏|既 既|暑 暑|梅 梅|海 海|渚 渚|漢 漢|煮 煮|爫 爫|琢 琢|碑 碑|社 社|祉 祉|祈 祈|祐 祐|祖 祖|祝 祝|禍 禍|禎 禎|穀 穀|突 突|節 節|練 練|縉 縉|繁 繁|署 署|者 者|臭 臭|艹 艹|艹 艹|著 著|褐 褐|視 視|謁 謁|謹 謹|賓 賓|贈 贈|辶 辶|逸 逸|難 難|響 響|頻 頻|恵 恵|𤋮 𤋮|舘 舘|並 並|况 况|全 全|侀 侀|充 充|冀 冀|勇 勇|勺 勺|喝 喝|啕 啕|喙 喙|嗢 嗢|塚 塚|墳 墳|奄 奄|奔 奔|婢 婢|嬨 嬨|廒 廒|廙 廙|彩 彩|徭 徭|惘 惘|慎 慎|愈 愈|憎 憎|慠 慠|懲 懲|戴 戴|揄 揄|搜 搜|摒 摒|敖 敖|晴 晴|朗 朗|望 望|杖 杖|歹 歹|殺 殺|流 流|滛 滛|滋 滋|漢 漢|瀞 瀞|煮 煮|瞧 瞧|爵 爵|犯 犯|猪 猪|瑱 瑱|甆 甆|画 画|瘝 瘝|瘟 瘟|益 益|盛 盛|直 直|睊 睊|着 着|磌 磌|窱 窱|節 節|类 类|絛 絛|練 練|缾 缾|者 者|荒 荒|華 華|蝹 蝹|襁 襁|覆 覆|視 視|調 調|諸 諸|請 請|謁 謁|諾 諾|諭 諭|謹 謹|變 變|贈 贈|輸 輸|遲 遲|醙 醙|鉶 鉶|陼 陼|難 難|靖 靖|韛 韛|響 響|頋 頋|頻 頻|鬒 鬒|龜 龜|𢡊 𢡊|𢡄 𢡄|𣏕 𣏕|㮝 㮝|䀘 䀘|䀹 䀹|𥉉 𥉉|𥳐 𥳐|𧻓 𧻓|齃 齃|龎 龎|丽 丽|丸 丸|乁 乁|𠄢 𠄢|你 你|侮 侮|侻 侻|倂 倂|偺 偺|備 備|僧 僧|像 像|㒞 㒞|𠘺 𠘺|免 免|兔 兔|兤 兤|具 具|𠔜 𠔜|㒹 㒹|內 內|再 再|𠕋 𠕋|冗 冗|冤 冤|仌 仌|冬 冬|况 况|𩇟 𩇟|凵 凵|刃 刃|㓟 㓟|刻 刻|剆 剆|割 割|剷 剷|㔕 㔕|勇 勇|勉 勉|勤 勤|勺 勺|包 包|匆 匆|北 北|卉 卉|卑 卑|博 博|即 即|卽 卽|卿 卿|卿 卿|卿 卿|𠨬 𠨬|灰 灰|及 及|叟 叟|𠭣 𠭣|叫 叫|叱 叱|吆 吆|咞 咞|吸 吸|呈 呈|周 周|咢 咢|哶 哶|唐 唐|啓 啓|啣 啣|善 善|善 善|喙 喙|喫 喫|喳 喳|嗂 嗂|圖 圖|嘆 嘆|圗 圗|噑 噑|噴 噴|切 切|壮 壮|城 城|埴 埴|堍 堍|型 型|堲 堲|報 報|墬 墬|𡓤 𡓤|売 売|壷 壷|夆 夆|多 多|夢 夢|奢 奢|𡚨 𡚨|𡛪 𡛪|姬 姬|娛 娛|娧 娧|姘 姘|婦 婦|㛮 㛮|㛼 㛼|嬈 嬈|嬾 嬾|嬾 嬾|𡧈 𡧈|寃 寃|寘 寘|寧 寧|寳 寳|𡬘 𡬘|寿 寿|将 将|当 当|尢 尢|㞁 㞁|屠 屠|屮 屮|峀 峀|岍 岍|𡷤 𡷤|嵃 嵃|𡷦 𡷦|嵮 嵮|嵫 嵫|嵼 嵼|巡 巡|巢 巢|㠯 㠯|巽 巽|帨 帨|帽 帽|幩 幩|㡢 㡢|𢆃 𢆃|㡼 㡼|庰 庰|庳 庳|庶 庶|廊 廊|𪎒 𪎒|廾 廾|𢌱 𢌱|𢌱 𢌱|舁 舁|弢 弢|弢 弢|㣇 㣇|𣊸 𣊸|𦇚 𦇚|形 形|彫 彫|㣣 㣣|徚 徚|忍 忍|志 志|忹 忹|悁 悁|㤺 㤺|㤜 㤜|悔 悔|𢛔 𢛔|惇 惇|慈 慈|慌 慌|慎 慎|慌 慌|慺 慺|憎 憎|憲 憲|憤 憤|憯 憯|懞 懞|懲 懲|懶 懶|成 成|戛 戛|扝 扝|抱 抱|拔 拔|捐 捐|𢬌 𢬌|挽 挽|拼 拼|捨 捨|掃 掃|揤 揤|𢯱 𢯱|搢 搢|揅 揅|掩 掩|㨮 㨮|摩 摩|摾 摾|撝 撝|摷 摷|㩬 㩬|敏 敏|敬 敬|𣀊 𣀊|旣 旣|書 書|晉 晉|㬙 㬙|暑 暑|㬈 㬈|㫤 㫤|冒 冒|冕 冕|最 最|暜 暜|肭 肭|䏙 䏙|朗 朗|望 望|朡 朡|杞 杞|杓 杓|𣏃 𣏃|㭉 㭉|柺 柺|枅 枅|桒 桒|梅 梅|𣑭 𣑭|梎 梎|栟 栟|椔 椔|㮝 㮝|楂 楂|榣 榣|槪 槪|檨 檨|𣚣 𣚣|櫛 櫛|㰘 㰘|次 次|𣢧 𣢧|歔 歔|㱎 㱎|歲 歲|殟 殟|殺 殺|殻 殻|𣪍 𣪍|𡴋 𡴋|𣫺 𣫺|汎 汎|𣲼 𣲼|沿 沿|泍 泍|汧 汧|洖 洖|派 派|海 海|流 流|浩 浩|浸 浸|涅 涅|𣴞 𣴞|洴 洴|港 港|湮 湮|㴳 㴳|滋 滋|滇 滇|𣻑 𣻑|淹 淹|潮 潮|𣽞 𣽞|𣾎 𣾎|濆 濆|瀹 瀹|瀞 瀞|瀛 瀛|㶖 㶖|灊 灊|災 災|灷 灷|炭 炭|𠔥 𠔥|煅 煅|𤉣 𤉣|熜 熜|𤎫 𤎫|爨 爨|爵 爵|牐 牐|𤘈 𤘈|犀 犀|犕 犕|𤜵 𤜵|𤠔 𤠔|獺 獺|王 王|㺬 㺬|玥 玥|㺸 㺸|㺸 㺸|瑇 瑇|瑜 瑜|瑱 瑱|璅 璅|瓊 瓊|㼛 㼛|甤 甤|𤰶 𤰶|甾 甾|𤲒 𤲒|異 異|𢆟 𢆟|瘐 瘐|𤾡 𤾡|𤾸 𤾸|𥁄 𥁄|㿼 㿼|䀈 䀈|直 直|𥃳 𥃳|𥃲 𥃲|𥄙 𥄙|𥄳 𥄳|眞 眞|真 真|真 真|睊 睊|䀹 䀹|瞋 瞋|䁆 䁆|䂖 䂖|𥐝 𥐝|硎 硎|碌 碌|磌 磌|䃣 䃣|𥘦 𥘦|祖 祖|𥚚 𥚚|𥛅 𥛅|福 福|秫 秫|䄯 䄯|穀 穀|穊 穊|穏 穏|𥥼 𥥼|𥪧 𥪧|𥪧 𥪧|竮 竮|䈂 䈂|𥮫 𥮫|篆 篆|築 築|䈧 䈧|𥲀 𥲀|糒 糒|䊠 䊠|糨 糨|糣 糣|紀 紀|𥾆 𥾆|絣 絣|䌁 䌁|緇 緇|縂 縂|繅 繅|䌴 䌴|𦈨 𦈨|𦉇 𦉇|䍙 䍙|𦋙 𦋙|罺 罺|𦌾 𦌾|羕 羕|翺 翺|者 者|𦓚 𦓚|𦔣 𦔣|聠 聠|𦖨 𦖨|聰 聰|𣍟 𣍟|䏕 䏕|育 育|脃 脃|䐋 䐋|脾 脾|媵 媵|𦞧 𦞧|𦞵 𦞵|𣎓 𣎓|𣎜 𣎜|舁 舁|舄 舄|辞 辞|䑫 䑫|芑 芑|芋 芋|芝 芝|劳 劳|花 花|芳 芳|芽 芽|苦 苦|𦬼 𦬼|若 若|茝 茝|荣 荣|莭 莭|茣 茣|莽 莽|菧 菧|著 著|荓 荓|菊 菊|菌 菌|菜 菜|𦰶 𦰶|𦵫 𦵫|𦳕 𦳕|䔫 䔫|蓱 蓱|蓳 蓳|蔖 蔖|𧏊 𧏊|蕤 蕤|𦼬 𦼬|䕝 䕝|䕡 䕡|𦾱 𦾱|𧃒 𧃒|䕫 䕫|虐 虐|虜 虜|虧 虧|虩 虩|蚩 蚩|蚈 蚈|蜎 蜎|蛢 蛢|蝹 蝹|蜨 蜨|蝫 蝫|螆 螆|䗗 䗗|蟡 蟡|蠁 蠁|䗹 䗹|衠 衠|衣 衣|𧙧 𧙧|裗 裗|裞 裞|䘵 䘵|裺 裺|㒻 㒻|𧢮 𧢮|𧥦 𧥦|䚾 䚾|䛇 䛇|誠 誠|諭 諭|變 變|豕 豕|𧲨 𧲨|貫 貫|賁 賁|贛 贛|起 起|𧼯 𧼯|𠠄 𠠄|跋 跋|趼 趼|跰 跰|𠣞 𠣞|軔 軔|輸 輸|𨗒 𨗒|𨗭 𨗭|邔 邔|郱 郱|鄑 鄑|𨜮 𨜮|鄛 鄛|鈸 鈸|鋗 鋗|鋘 鋘|鉼 鉼|鏹 鏹|鐕 鐕|𨯺 𨯺|開 開|䦕 䦕|閷 閷|𨵷 𨵷|䧦 䧦|雃 雃|嶲 嶲|霣 霣|𩅅 𩅅|𩈚 𩈚|䩮 䩮|䩶 䩶|韠 韠|𩐊 𩐊|䪲 䪲|𩒖 𩒖|頋 頋|頋 頋|頩 頩|𩖶 𩖶|飢 飢|䬳 䬳|餩 餩|馧 馧|駂 駂|駾 駾|䯎 䯎|𩬰 𩬰|鬒 鬒|鱀 鱀|鳽 鳽|䳎 䳎|䳭 䳭|鵧 鵧|𪃎 𪃎|䳸 䳸|𪄅 𪄅|𪈎 𪈎|𪊑 𪊑|麻 麻|䵖 䵖|黹 黹|黾 黾|鼅 鼅|鼏 鼏|鼖 鼖|鼻 鼻|𪘀 𪘀";
	var s = {
		"·": "‧",
		"―": "─",
		"‖": "∥",
		"‘": "『",
		"’": "』",
		"“": "「",
		"”": "」",
		"″": "〞",
		"∏": "Π",
		"∑": "Σ",
		"∧": "︿",
		"∨": "﹀",
		"∶": "︰",
		"≈": "≒",
		"≤": "≦",
		"≥": "≧",
		"━": "─",
		"┃": "│",
		"┏": "┌",
		"┓": "┐",
		"┗": "└",
		"┛": "┘",
		"┣": "├",
		"┫": "┤",
		"┳": "┬",
		"┻": "┴",
		"╋": "┼",
		"〖": "【",
		"〗": "】",
		㑇: "㑳",
		㖞: "喎",
		㘎: "㘚",
		㤘: "㥮",
		㧏: "掆",
		㧐: "㩳",
		㧟: "擓",
		㭎: "棡",
		㳠: "澾",
		䁖: "瞜",
		䅟: "穇",
		䌷: "紬",
		䎬: "䎱",
		䏝: "膞",
		䓖: "藭",
		䙌: "䙡",
		䜣: "訢",
		䜩: "讌",
		䞍: "䝼",
		䥺: "釾",
		䥽: "鏺",
		䦂: "䥇",
		䦃: "鐯",
		䦅: "鐥",
		䦆: "钁",
		䦶: "䦛",
		䦷: "䦟",
		䲟: "鮣",
		䲡: "鰌",
		䲢: "鰧",
		䲣: "䱷",
		䴓: "鳾",
		䴔: "鵁",
		䴕: "鴷",
		䴖: "鶄",
		䴗: "鶪",
		䴘: "鷉",
		䴙: "鸊",
		䶮: "龑",
		万: "萬",
		与: "與",
		专: "專",
		业: "業",
		丛: "叢",
		东: "東",
		丝: "絲",
		丢: "丟",
		两: "兩",
		严: "嚴",
		丧: "喪",
		个: "個",
		丰: "豐",
		临: "臨",
		为: "為",
		丽: "麗",
		举: "舉",
		么: "麼",
		义: "義",
		乌: "烏",
		乐: "樂",
		乔: "喬",
		习: "習",
		乡: "鄉",
		书: "書",
		买: "買",
		乱: "亂",
		争: "爭",
		于: "於",
		亏: "虧",
		云: "雲",
		亘: "亙",
		亚: "亞",
		产: "產",
		亩: "畝",
		亲: "親",
		亵: "褻",
		亿: "億",
		仅: "僅",
		仆: "僕",
		从: "從",
		仑: "侖",
		仓: "倉",
		仪: "儀",
		们: "們",
		价: "價",
		众: "眾",
		优: "優",
		会: "會",
		伛: "傴",
		伞: "傘",
		伟: "偉",
		传: "傳",
		伤: "傷",
		伥: "倀",
		伦: "倫",
		伧: "傖",
		伪: "偽",
		伫: "佇",
		伲: "你",
		体: "體",
		佣: "傭",
		佥: "僉",
		侠: "俠",
		侣: "侶",
		侥: "僥",
		侦: "偵",
		侧: "側",
		侨: "僑",
		侩: "儈",
		侪: "儕",
		侬: "儂",
		俣: "俁",
		俦: "儔",
		俨: "儼",
		俩: "倆",
		俪: "儷",
		俭: "儉",
		倮: "裸",
		债: "債",
		倾: "傾",
		偬: "傯",
		偻: "僂",
		偾: "僨",
		偿: "償",
		傥: "儻",
		傧: "儐",
		储: "儲",
		傩: "儺",
		儿: "兒",
		兑: "兌",
		兖: "兗",
		党: "黨",
		兰: "蘭",
		关: "關",
		兴: "興",
		兹: "茲",
		养: "養",
		兽: "獸",
		冁: "囅",
		内: "內",
		冈: "岡",
		册: "冊",
		写: "寫",
		军: "軍",
		农: "農",
		冯: "馮",
		冲: "沖",
		决: "決",
		况: "況",
		冻: "凍",
		净: "淨",
		凄: "淒",
		凇: "淞",
		凉: "涼",
		减: "減",
		凑: "湊",
		凛: "凜",
		几: "幾",
		凤: "鳳",
		処: "處",
		凫: "鳧",
		凭: "憑",
		凯: "凱",
		击: "擊",
		凼: "幽",
		凿: "鑿",
		刍: "芻",
		划: "劃",
		刘: "劉",
		则: "則",
		刚: "剛",
		创: "創",
		删: "刪",
		别: "別",
		刬: "剗",
		刭: "剄",
		刹: "剎",
		刽: "劊",
		刿: "劌",
		剀: "剴",
		剂: "劑",
		剐: "剮",
		剑: "劍",
		剥: "剝",
		剧: "劇",
		剳: "劄",
		劝: "勸",
		办: "辦",
		务: "務",
		劢: "勱",
		动: "動",
		励: "勵",
		劲: "勁",
		劳: "勞",
		势: "勢",
		勋: "勳",
		勚: "勩",
		勛: "勳",
		勦: "剿",
		匀: "勻",
		匦: "匭",
		匮: "匱",
		区: "區",
		医: "醫",
		华: "華",
		协: "協",
		单: "單",
		卖: "賣",
		占: "佔",
		卢: "盧",
		卤: "鹵",
		卧: "臥",
		卫: "衛",
		却: "卻",
		卺: "巹",
		厂: "廠",
		厅: "廳",
		历: "歷",
		厉: "厲",
		压: "壓",
		厌: "厭",
		厍: "厙",
		厕: "廁",
		厘: "釐",
		厢: "廂",
		厣: "厴",
		厦: "廈",
		厨: "廚",
		厩: "廄",
		厮: "廝",
		县: "縣",
		叁: "參",
		参: "參",
		叆: "靉",
		叇: "靆",
		双: "雙",
		发: "發",
		变: "變",
		叙: "敘",
		叠: "疊",
		叶: "葉",
		号: "號",
		叹: "嘆",
		叽: "嘰",
		吁: "籲",
		后: "後",
		吓: "嚇",
		吕: "呂",
		吗: "嗎",
		吨: "噸",
		听: "聽",
		启: "啟",
		吴: "吳",
		呐: "吶",
		呒: "嘸",
		呓: "囈",
		呕: "嘔",
		呖: "嚦",
		呗: "唄",
		员: "員",
		呙: "咼",
		呛: "嗆",
		呜: "嗚",
		咏: "詠",
		咙: "嚨",
		咛: "嚀",
		咝: "噝",
		哌: "呱",
		响: "響",
		哑: "啞",
		哒: "噠",
		哓: "嘵",
		哔: "嗶",
		哕: "噦",
		哗: "嘩",
		哙: "噲",
		哜: "嚌",
		哝: "噥",
		哟: "喲",
		唛: "嘜",
		唝: "嗊",
		唠: "嘮",
		唡: "啢",
		唢: "嗩",
		唤: "喚",
		啓: "啟",
		啧: "嘖",
		啬: "嗇",
		啭: "囀",
		啮: "齧",
		啰: "囉",
		啸: "嘯",
		喷: "噴",
		喽: "嘍",
		喾: "嚳",
		嗫: "囁",
		嗬: "呵",
		嗳: "噯",
		嘘: "噓",
		嘤: "嚶",
		嘩: "譁",
		嘱: "囑",
		噜: "嚕",
		嚣: "囂",
		嚮: "向",
		团: "團",
		园: "園",
		囯: "國",
		囱: "囪",
		围: "圍",
		囵: "圇",
		国: "國",
		图: "圖",
		圆: "圓",
		圣: "聖",
		圹: "壙",
		场: "場",
		坂: "阪",
		坏: "壞",
		块: "塊",
		坚: "堅",
		坛: "壇",
		坜: "壢",
		坝: "壩",
		坞: "塢",
		坟: "墳",
		坠: "墜",
		垄: "壟",
		垅: "壟",
		垆: "壚",
		垒: "壘",
		垦: "墾",
		垩: "堊",
		垫: "墊",
		垭: "埡",
		垲: "塏",
		垴: "堖",
		埘: "塒",
		埙: "壎",
		埚: "堝",
		堑: "塹",
		堕: "墮",
		墒: "墑",
		墙: "牆",
		壮: "壯",
		声: "聲",
		壳: "殼",
		壶: "壺",
		处: "處",
		备: "備",
		复: "復",
		够: "夠",
		头: "頭",
		夸: "誇",
		夹: "夾",
		夺: "奪",
		奁: "奩",
		奂: "奐",
		奋: "奮",
		奖: "獎",
		奥: "奧",
		奬: "獎",
		妆: "妝",
		妇: "婦",
		妈: "媽",
		妩: "嫵",
		妪: "嫗",
		妫: "媯",
		姗: "姍",
		娄: "婁",
		娅: "婭",
		娆: "嬈",
		娇: "嬌",
		娈: "孌",
		娱: "娛",
		娲: "媧",
		娴: "嫻",
		婳: "嫿",
		婴: "嬰",
		婵: "嬋",
		婶: "嬸",
		媪: "媼",
		嫒: "嬡",
		嫔: "嬪",
		嫱: "嬙",
		嬷: "嬤",
		孙: "孫",
		学: "學",
		孪: "孿",
		宁: "寧",
		宝: "寶",
		实: "實",
		宠: "寵",
		审: "審",
		宪: "憲",
		宫: "宮",
		宽: "寬",
		宾: "賓",
		寀: "采",
		寝: "寢",
		对: "對",
		寻: "尋",
		导: "導",
		寿: "壽",
		将: "將",
		尔: "爾",
		尘: "塵",
		尜: "嘎",
		尝: "嘗",
		尧: "堯",
		尴: "尷",
		尸: "屍",
		尽: "盡",
		层: "層",
		屉: "屜",
		届: "屆",
		属: "屬",
		屡: "屢",
		屦: "屨",
		屿: "嶼",
		岁: "歲",
		岂: "豈",
		岖: "嶇",
		岗: "崗",
		岘: "峴",
		岚: "嵐",
		岛: "島",
		岭: "嶺",
		岽: "崠",
		岿: "巋",
		峃: "嶨",
		峄: "嶧",
		峡: "峽",
		峣: "嶢",
		峤: "嶠",
		峥: "崢",
		峦: "巒",
		峯: "峰",
		崂: "嶗",
		崃: "崍",
		崐: "崑",
		崭: "嶄",
		嵘: "嶸",
		嵚: "嶔",
		嵛: "崳",
		嵝: "嶁",
		巅: "巔",
		巌: "巖",
		巩: "鞏",
		巯: "巰",
		币: "幣",
		帅: "帥",
		师: "師",
		帏: "幃",
		帐: "帳",
		帘: "簾",
		帜: "幟",
		带: "帶",
		帧: "幀",
		帮: "幫",
		帱: "幬",
		帻: "幘",
		帼: "幗",
		幂: "冪",
		幵: "開",
		并: "並",
		幷: "並",
		广: "廣",
		庄: "莊",
		庆: "慶",
		庐: "廬",
		庑: "廡",
		库: "庫",
		应: "應",
		庙: "廟",
		庞: "龐",
		废: "廢",
		庼: "廎",
		廪: "廩",
		开: "開",
		异: "異",
		弃: "棄",
		弑: "弒",
		张: "張",
		弥: "彌",
		弪: "弳",
		弯: "彎",
		弹: "彈",
		强: "強",
		归: "歸",
		当: "當",
		彔: "录",
		录: "錄",
		彚: "彙",
		彦: "彥",
		彻: "徹",
		径: "徑",
		徕: "徠",
		忆: "憶",
		忏: "懺",
		忧: "憂",
		忾: "愾",
		怀: "懷",
		态: "態",
		怂: "慫",
		怃: "憮",
		怄: "慪",
		怅: "悵",
		怆: "愴",
		怜: "憐",
		总: "總",
		怼: "懟",
		怿: "懌",
		恋: "戀",
		恒: "恆",
		恳: "懇",
		恶: "惡",
		恸: "慟",
		恹: "懨",
		恺: "愷",
		恻: "惻",
		恼: "惱",
		恽: "惲",
		悦: "悅",
		悫: "愨",
		悬: "懸",
		悭: "慳",
		悯: "憫",
		惊: "驚",
		惧: "懼",
		惨: "慘",
		惩: "懲",
		惫: "憊",
		惬: "愜",
		惭: "慚",
		惮: "憚",
		惯: "慣",
		愠: "慍",
		愤: "憤",
		愦: "憒",
		愿: "願",
		慑: "懾",
		懑: "懣",
		懒: "懶",
		懔: "懍",
		戆: "戇",
		戋: "戔",
		戏: "戲",
		戗: "戧",
		战: "戰",
		戬: "戩",
		户: "戶",
		扑: "撲",
		执: "執",
		扩: "擴",
		扪: "捫",
		扫: "掃",
		扬: "揚",
		扰: "擾",
		抚: "撫",
		抛: "拋",
		抟: "摶",
		抠: "摳",
		抡: "掄",
		抢: "搶",
		护: "護",
		报: "報",
		担: "擔",
		拟: "擬",
		拢: "攏",
		拣: "揀",
		拥: "擁",
		拦: "攔",
		拧: "擰",
		拨: "撥",
		择: "擇",
		挂: "掛",
		挚: "摯",
		挛: "攣",
		挜: "掗",
		挝: "撾",
		挞: "撻",
		挟: "挾",
		挠: "撓",
		挡: "擋",
		挢: "撟",
		挣: "掙",
		挤: "擠",
		挥: "揮",
		挦: "撏",
		捜: "搜",
		捞: "撈",
		损: "損",
		捡: "撿",
		换: "換",
		捣: "搗",
		据: "據",
		掳: "擄",
		掴: "摑",
		掷: "擲",
		掸: "撣",
		掺: "摻",
		掼: "摜",
		揽: "攬",
		揿: "撳",
		搀: "攙",
		搁: "擱",
		搂: "摟",
		搅: "攪",
		携: "攜",
		摄: "攝",
		摅: "攄",
		摆: "擺",
		摇: "搖",
		摈: "擯",
		摊: "攤",
		撄: "攖",
		撑: "撐",
		撵: "攆",
		撷: "擷",
		撸: "擼",
		撺: "攛",
		擀: "搟",
		擞: "擻",
		攒: "攢",
		敌: "敵",
		敛: "斂",
		数: "數",
		斋: "齋",
		斓: "斕",
		斩: "斬",
		断: "斷",
		无: "無",
		旧: "舊",
		时: "時",
		旷: "曠",
		旸: "暘",
		昙: "曇",
		昵: "暱",
		昼: "晝",
		昽: "曨",
		显: "顯",
		晋: "晉",
		晒: "曬",
		晓: "曉",
		晔: "曄",
		晕: "暈",
		晖: "暉",
		暂: "暫",
		暧: "曖",
		暸: "瞭",
		朮: "術",
		术: "術",
		机: "機",
		杀: "殺",
		杂: "雜",
		权: "權",
		杆: "桿",
		杠: "槓",
		条: "條",
		来: "來",
		杨: "楊",
		杩: "榪",
		杰: "傑",
		极: "極",
		构: "構",
		枞: "樅",
		枢: "樞",
		枣: "棗",
		枥: "櫪",
		枧: "梘",
		枨: "棖",
		枪: "槍",
		枫: "楓",
		枭: "梟",
		柜: "櫃",
		柠: "檸",
		柽: "檉",
		栀: "梔",
		栅: "柵",
		标: "標",
		栈: "棧",
		栉: "櫛",
		栊: "櫳",
		栋: "棟",
		栌: "櫨",
		栎: "櫟",
		栏: "欄",
		树: "樹",
		栖: "棲",
		样: "樣",
		栾: "欒",
		桔: "橘",
		桠: "椏",
		桡: "橈",
		桢: "楨",
		档: "檔",
		桤: "榿",
		桥: "橋",
		桦: "樺",
		桧: "檜",
		桨: "槳",
		桩: "樁",
		梦: "夢",
		检: "檢",
		棂: "櫺",
		椁: "槨",
		椟: "櫝",
		椠: "槧",
		椤: "欏",
		椭: "橢",
		楼: "樓",
		榄: "欖",
		榇: "櫬",
		榈: "櫚",
		榉: "櫸",
		榘: "矩",
		槚: "檟",
		槛: "檻",
		槟: "檳",
		槠: "櫧",
		槼: "規",
		横: "橫",
		樯: "檣",
		樱: "櫻",
		橥: "櫫",
		橱: "櫥",
		橹: "櫓",
		橼: "櫞",
		檐: "簷",
		檩: "檁",
		欢: "歡",
		欤: "歟",
		欧: "歐",
		歎: "嘆",
		歼: "殲",
		殁: "歿",
		殇: "殤",
		残: "殘",
		殒: "殞",
		殓: "殮",
		殚: "殫",
		殡: "殯",
		殴: "毆",
		毁: "毀",
		毂: "轂",
		毕: "畢",
		毙: "斃",
		毡: "氈",
		毵: "毿",
		氇: "氌",
		气: "氣",
		氢: "氫",
		氩: "氬",
		氲: "氳",
		氽: "汆",
		汇: "匯",
		汉: "漢",
		汤: "湯",
		汹: "洶",
		沟: "溝",
		没: "沒",
		沣: "灃",
		沤: "漚",
		沥: "瀝",
		沦: "淪",
		沧: "滄",
		沨: "渢",
		沩: "溈",
		沪: "滬",
		沲: "沱",
		泄: "洩",
		泞: "濘",
		泪: "淚",
		泶: "澩",
		泷: "瀧",
		泸: "瀘",
		泺: "濼",
		泻: "瀉",
		泼: "潑",
		泽: "澤",
		泾: "涇",
		洁: "潔",
		洒: "灑",
		洼: "窪",
		浃: "浹",
		浅: "淺",
		浆: "漿",
		浇: "澆",
		浈: "湞",
		浉: "溮",
		浊: "濁",
		测: "測",
		浍: "澮",
		济: "濟",
		浏: "瀏",
		浐: "滻",
		浑: "渾",
		浒: "滸",
		浓: "濃",
		浔: "潯",
		浕: "濜",
		浜: "濱",
		涌: "湧",
		涛: "濤",
		涝: "澇",
		涞: "淶",
		涟: "漣",
		涠: "潿",
		涡: "渦",
		涢: "溳",
		涣: "渙",
		涤: "滌",
		润: "潤",
		涧: "澗",
		涨: "漲",
		涩: "澀",
		渊: "淵",
		渌: "淥",
		渍: "漬",
		渎: "瀆",
		渐: "漸",
		渑: "澠",
		渔: "漁",
		渖: "瀋",
		渗: "滲",
		温: "溫",
		湾: "灣",
		湿: "濕",
		溃: "潰",
		溅: "濺",
		溆: "漵",
		溇: "漊",
		溼: "濕",
		滗: "潷",
		滚: "滾",
		滞: "滯",
		滟: "灩",
		滠: "灄",
		满: "滿",
		滢: "瀅",
		滤: "濾",
		滥: "濫",
		滦: "灤",
		滨: "濱",
		滩: "灘",
		滪: "澦",
		潆: "瀠",
		潇: "瀟",
		潋: "瀲",
		潍: "濰",
		潜: "潛",
		潴: "瀦",
		澜: "瀾",
		濑: "瀨",
		濒: "瀕",
		灏: "灝",
		灭: "滅",
		灯: "燈",
		灵: "靈",
		灾: "災",
		灿: "燦",
		炀: "煬",
		炉: "爐",
		炖: "燉",
		炜: "煒",
		炝: "熗",
		炤: "照",
		点: "點",
		炼: "煉",
		炽: "熾",
		烁: "爍",
		烂: "爛",
		烃: "烴",
		烛: "燭",
		烟: "煙",
		烦: "煩",
		烧: "燒",
		烨: "燁",
		烩: "燴",
		烫: "燙",
		烬: "燼",
		热: "熱",
		焕: "煥",
		焖: "燜",
		焘: "燾",
		煅: "鍛",
		爱: "愛",
		爲: "為",
		爷: "爺",
		牀: "床",
		牍: "牘",
		牦: "犛",
		牵: "牽",
		牺: "犧",
		犊: "犢",
		状: "狀",
		犷: "獷",
		犸: "獁",
		犹: "猶",
		狈: "狽",
		狝: "獮",
		狞: "獰",
		独: "獨",
		狭: "狹",
		狮: "獅",
		狯: "獪",
		狰: "猙",
		狱: "獄",
		狲: "猻",
		猃: "獫",
		猎: "獵",
		猕: "獼",
		猡: "玀",
		猪: "豬",
		猫: "貓",
		猬: "蝟",
		献: "獻",
		獃: "呆",
		獭: "獺",
		玑: "璣",
		玛: "瑪",
		玮: "瑋",
		环: "環",
		现: "現",
		玱: "瑲",
		玺: "璽",
		珉: "玟",
		珏: "玨",
		珐: "琺",
		珑: "瓏",
		珲: "琿",
		琎: "璡",
		琏: "璉",
		琐: "瑣",
		琯: "管",
		琼: "瓊",
		瑶: "瑤",
		瑷: "璦",
		璎: "瓔",
		瓒: "瓚",
		瓮: "甕",
		瓯: "甌",
		産: "產",
		电: "電",
		画: "畫",
		畅: "暢",
		畲: "畬",
		畴: "疇",
		疖: "癤",
		疗: "療",
		疟: "瘧",
		疠: "癘",
		疡: "瘍",
		疬: "癧",
		疮: "瘡",
		疯: "瘋",
		疱: "皰",
		疴: "痾",
		痈: "癰",
		痉: "痙",
		痒: "癢",
		痖: "瘂",
		痨: "癆",
		痪: "瘓",
		痫: "癇",
		痹: "痺",
		瘅: "癉",
		瘗: "瘞",
		瘘: "瘻",
		瘪: "癟",
		瘫: "癱",
		瘾: "癮",
		瘿: "癭",
		癞: "癩",
		癡: "痴",
		癣: "癬",
		癫: "癲",
		皑: "皚",
		皰: "疱",
		皱: "皺",
		皲: "皸",
		盏: "盞",
		盐: "鹽",
		监: "監",
		盖: "蓋",
		盗: "盜",
		盘: "盤",
		眍: "瞘",
		眎: "視",
		眦: "眥",
		眬: "矓",
		着: "著",
		睁: "睜",
		睐: "睞",
		睑: "瞼",
		瞒: "瞞",
		瞩: "矚",
		矫: "矯",
		矶: "磯",
		矾: "礬",
		矿: "礦",
		砀: "碭",
		码: "碼",
		砖: "磚",
		砗: "硨",
		砚: "硯",
		砜: "碸",
		砺: "礪",
		砻: "礱",
		砾: "礫",
		础: "礎",
		硕: "碩",
		硖: "硤",
		硗: "磽",
		硙: "磑",
		硚: "礄",
		确: "確",
		硷: "鹼",
		碍: "礙",
		碛: "磧",
		碜: "磣",
		碱: "鹼",
		礡: "礴",
		礼: "禮",
		祎: "禕",
		祯: "禎",
		祷: "禱",
		祸: "禍",
		禀: "稟",
		禄: "祿",
		禅: "禪",
		禰: "祢",
		离: "離",
		秃: "禿",
		秆: "稈",
		种: "種",
		积: "積",
		称: "稱",
		秽: "穢",
		税: "稅",
		稣: "穌",
		稭: "秸",
		稳: "穩",
		穑: "穡",
		穷: "窮",
		窃: "竊",
		窍: "竅",
		窎: "窵",
		窑: "窯",
		窜: "竄",
		窝: "窩",
		窥: "窺",
		窦: "竇",
		窭: "窶",
		竖: "豎",
		竞: "競",
		笃: "篤",
		笋: "筍",
		笔: "筆",
		笕: "筧",
		笺: "箋",
		笼: "籠",
		笾: "籩",
		筑: "築",
		筚: "篳",
		筛: "篩",
		筝: "箏",
		筹: "籌",
		签: "簽",
		简: "簡",
		箓: "籙",
		箦: "簀",
		箧: "篋",
		箨: "籜",
		箩: "籮",
		箪: "簞",
		箫: "簫",
		篑: "簣",
		篓: "簍",
		篮: "籃",
		篱: "籬",
		簖: "籪",
		籁: "籟",
		籴: "糴",
		类: "類",
		籼: "秈",
		粜: "糶",
		粝: "糲",
		粤: "粵",
		粪: "糞",
		粮: "糧",
		糁: "糝",
		糇: "餱",
		糍: "餈",
		紥: "紮",
		紧: "緊",
		絷: "縶",
		綫: "線",
		纠: "糾",
		纡: "紆",
		红: "紅",
		纣: "紂",
		纤: "纖",
		纥: "紇",
		约: "約",
		级: "級",
		纨: "紈",
		纩: "纊",
		纪: "紀",
		纫: "紉",
		纬: "緯",
		纭: "紜",
		纮: "紘",
		纯: "純",
		纰: "紕",
		纱: "紗",
		纲: "綱",
		纳: "納",
		纴: "紝",
		纵: "縱",
		纶: "綸",
		纷: "紛",
		纸: "紙",
		纹: "紋",
		纺: "紡",
		纼: "紖",
		纽: "紐",
		纾: "紓",
		线: "線",
		绀: "紺",
		绁: "紲",
		绂: "紱",
		练: "練",
		组: "組",
		绅: "紳",
		细: "細",
		织: "織",
		终: "終",
		绉: "縐",
		绊: "絆",
		绋: "紼",
		绌: "絀",
		绍: "紹",
		绎: "繹",
		经: "經",
		绐: "紿",
		绑: "綁",
		绒: "絨",
		结: "結",
		绔: "絝",
		绕: "繞",
		绖: "絰",
		绗: "絎",
		绘: "繪",
		给: "給",
		绚: "絢",
		绛: "絳",
		络: "絡",
		绝: "絕",
		绞: "絞",
		统: "統",
		绠: "綆",
		绡: "綃",
		绢: "絹",
		绣: "繡",
		绥: "綏",
		绦: "絛",
		继: "繼",
		绨: "綈",
		绩: "績",
		绪: "緒",
		绫: "綾",
		续: "續",
		绮: "綺",
		绯: "緋",
		绰: "綽",
		绱: "緔",
		绲: "緄",
		绳: "繩",
		维: "維",
		绵: "綿",
		绶: "綬",
		绷: "繃",
		绸: "綢",
		绺: "綹",
		绻: "綣",
		综: "綜",
		绽: "綻",
		绾: "綰",
		绿: "綠",
		缀: "綴",
		缁: "緇",
		缂: "緙",
		缃: "緗",
		缄: "緘",
		缅: "緬",
		缆: "纜",
		缇: "緹",
		缈: "緲",
		缉: "緝",
		缊: "縕",
		缋: "繢",
		缌: "緦",
		缍: "綞",
		缎: "緞",
		缏: "緶",
		缑: "緱",
		缒: "縋",
		缓: "緩",
		缔: "締",
		缕: "縷",
		编: "編",
		缗: "緡",
		缘: "緣",
		缙: "縉",
		缚: "縛",
		缛: "縟",
		缜: "縝",
		缝: "縫",
		缞: "縗",
		缟: "縞",
		缠: "纏",
		缡: "縭",
		缢: "縊",
		缣: "縑",
		缤: "繽",
		缥: "縹",
		缦: "縵",
		缧: "縲",
		缨: "纓",
		缩: "縮",
		缪: "繆",
		缫: "繅",
		缬: "纈",
		缭: "繚",
		缮: "繕",
		缯: "繒",
		缰: "韁",
		缱: "繾",
		缲: "繰",
		缳: "繯",
		缴: "繳",
		缵: "纘",
		罂: "罌",
		罎: "罈",
		网: "網",
		罗: "羅",
		罚: "罰",
		罢: "罷",
		罴: "羆",
		羁: "羈",
		羟: "羥",
		羡: "羨",
		翘: "翹",
		翚: "翬",
		耢: "耮",
		耧: "耬",
		耸: "聳",
		耻: "恥",
		聂: "聶",
		聋: "聾",
		职: "職",
		聍: "聹",
		联: "聯",
		聩: "聵",
		聪: "聰",
		肀: "聿",
		肃: "肅",
		肠: "腸",
		肤: "膚",
		肮: "骯",
		肾: "腎",
		肿: "腫",
		胀: "脹",
		胁: "脅",
		胆: "膽",
		胜: "勝",
		胧: "朧",
		胨: "腖",
		胪: "臚",
		胫: "脛",
		胶: "膠",
		脉: "脈",
		脍: "膾",
		脏: "髒",
		脐: "臍",
		脑: "腦",
		脓: "膿",
		脔: "臠",
		脚: "腳",
		脣: "唇",
		脩: "修",
		脱: "脫",
		脶: "腡",
		脸: "臉",
		腊: "臘",
		腌: "醃",
		腘: "膕",
		腭: "顎",
		腻: "膩",
		腼: "靦",
		腽: "膃",
		腾: "騰",
		膑: "臏",
		膻: "羶",
		臜: "臢",
		舆: "輿",
		舣: "艤",
		舰: "艦",
		舱: "艙",
		舻: "艫",
		艰: "艱",
		艳: "豔",
		艺: "藝",
		节: "節",
		芈: "羋",
		芗: "薌",
		芜: "蕪",
		芦: "蘆",
		苁: "蓯",
		苇: "葦",
		苈: "藶",
		苋: "莧",
		苌: "萇",
		苍: "蒼",
		苎: "苧",
		苏: "蘇",
		苹: "蘋",
		茎: "莖",
		茏: "蘢",
		茑: "蔦",
		茔: "塋",
		茕: "煢",
		茧: "繭",
		荆: "荊",
		荐: "薦",
		荚: "莢",
		荛: "蕘",
		荜: "蓽",
		荞: "蕎",
		荟: "薈",
		荠: "薺",
		荡: "蕩",
		荣: "榮",
		荤: "葷",
		荥: "滎",
		荦: "犖",
		荧: "熒",
		荨: "蕁",
		荩: "藎",
		荪: "蓀",
		荫: "蔭",
		荬: "蕒",
		荭: "葒",
		荮: "葤",
		药: "藥",
		莅: "蒞",
		莱: "萊",
		莲: "蓮",
		莳: "蒔",
		莴: "萵",
		莶: "薟",
		获: "獲",
		莸: "蕕",
		莹: "瑩",
		莺: "鶯",
		莼: "蓴",
		萚: "蘀",
		萝: "蘿",
		萤: "螢",
		营: "營",
		萦: "縈",
		萧: "蕭",
		萨: "薩",
		著: "著",
		葯: "藥",
		葱: "蔥",
		蒇: "蕆",
		蒉: "蕢",
		蒋: "蔣",
		蒌: "蔞",
		蓝: "藍",
		蓟: "薊",
		蓠: "蘺",
		蓣: "蕷",
		蓥: "鎣",
		蓦: "驀",
		蔴: "麻",
		蔷: "薔",
		蔹: "蘞",
		蔺: "藺",
		蔼: "藹",
		蕲: "蘄",
		蕴: "蘊",
		薮: "藪",
		藓: "蘚",
		蘖: "蘗",
		虏: "虜",
		虑: "慮",
		虚: "虛",
		虫: "蟲",
		虬: "虯",
		虮: "蟣",
		虱: "蝨",
		虽: "雖",
		虾: "蝦",
		虿: "蠆",
		蚀: "蝕",
		蚁: "蟻",
		蚂: "螞",
		蚕: "蠶",
		蚬: "蜆",
		蛊: "蠱",
		蛎: "蠣",
		蛏: "蟶",
		蛮: "蠻",
		蛰: "蟄",
		蛱: "蛺",
		蛲: "蟯",
		蛳: "螄",
		蛴: "蠐",
		蜕: "蛻",
		蜗: "蝸",
		蜡: "蠟",
		蝇: "蠅",
		蝈: "蟈",
		蝉: "蟬",
		蝎: "蠍",
		蝰: "虺",
		蝼: "螻",
		蝾: "蠑",
		螨: "蟎",
		蟏: "蠨",
		蟮: "蟺",
		衅: "釁",
		衆: "眾",
		衔: "銜",
		补: "補",
		衬: "襯",
		衮: "袞",
		袄: "襖",
		袅: "裊",
		袜: "襪",
		袭: "襲",
		装: "裝",
		裆: "襠",
		裏: "裡",
		裢: "褳",
		裣: "襝",
		裤: "褲",
		裥: "襉",
		褛: "褸",
		褴: "襤",
		见: "見",
		观: "觀",
		觃: "覎",
		规: "規",
		觅: "覓",
		视: "視",
		觇: "覘",
		览: "覽",
		觉: "覺",
		觊: "覬",
		觋: "覡",
		觌: "覿",
		觎: "覦",
		觏: "覯",
		觐: "覲",
		觑: "覷",
		觞: "觴",
		触: "觸",
		觯: "觶",
		証: "證",
		誉: "譽",
		誊: "謄",
		计: "計",
		订: "訂",
		讣: "訃",
		认: "認",
		讥: "譏",
		讦: "訐",
		讧: "訌",
		讨: "討",
		让: "讓",
		讪: "訕",
		讫: "訖",
		训: "訓",
		议: "議",
		讯: "訊",
		记: "記",
		讲: "講",
		讳: "諱",
		讴: "謳",
		讵: "詎",
		讶: "訝",
		讷: "訥",
		许: "許",
		讹: "訛",
		论: "論",
		讻: "訩",
		讼: "訟",
		讽: "諷",
		设: "設",
		访: "訪",
		诀: "訣",
		证: "證",
		诂: "詁",
		诃: "訶",
		评: "評",
		诅: "詛",
		识: "識",
		诇: "詗",
		诈: "詐",
		诉: "訴",
		诊: "診",
		诋: "詆",
		诌: "謅",
		词: "詞",
		诎: "詘",
		诏: "詔",
		译: "譯",
		诒: "詒",
		诓: "誆",
		诔: "誄",
		试: "試",
		诖: "詿",
		诗: "詩",
		诘: "詰",
		诙: "詼",
		诚: "誠",
		诛: "誅",
		诜: "詵",
		话: "話",
		诞: "誕",
		诟: "詬",
		诠: "詮",
		诡: "詭",
		询: "詢",
		诣: "詣",
		诤: "諍",
		该: "該",
		详: "詳",
		诧: "詫",
		诨: "諢",
		诩: "詡",
		诫: "誡",
		诬: "誣",
		语: "語",
		诮: "誚",
		误: "誤",
		诰: "誥",
		诱: "誘",
		诲: "誨",
		诳: "誑",
		说: "說",
		诵: "誦",
		诶: "誒",
		请: "請",
		诸: "諸",
		诹: "諏",
		诺: "諾",
		读: "讀",
		诼: "諑",
		诽: "誹",
		课: "課",
		诿: "諉",
		谀: "諛",
		谁: "誰",
		谂: "諗",
		调: "調",
		谄: "諂",
		谅: "諒",
		谆: "諄",
		谇: "誶",
		谈: "談",
		谉: "讅",
		谊: "誼",
		谋: "謀",
		谌: "諶",
		谍: "諜",
		谎: "謊",
		谏: "諫",
		谐: "諧",
		谑: "謔",
		谒: "謁",
		谓: "謂",
		谔: "諤",
		谕: "諭",
		谖: "諼",
		谗: "讒",
		谘: "諮",
		谙: "諳",
		谚: "諺",
		谛: "諦",
		谜: "謎",
		谝: "諞",
		谞: "諝",
		谟: "謨",
		谠: "讜",
		谡: "謖",
		谢: "謝",
		谣: "謠",
		谤: "謗",
		谥: "謚",
		谦: "謙",
		谧: "謐",
		谨: "謹",
		谩: "謾",
		谪: "謫",
		谫: "譾",
		谬: "謬",
		谭: "譚",
		谮: "譖",
		谯: "譙",
		谰: "讕",
		谱: "譜",
		谲: "譎",
		谳: "讞",
		谴: "譴",
		谵: "譫",
		谶: "讖",
		豮: "豶",
		贜: "贓",
		贝: "貝",
		贞: "貞",
		负: "負",
		贡: "貢",
		财: "財",
		责: "責",
		贤: "賢",
		败: "敗",
		账: "賬",
		货: "貨",
		质: "質",
		贩: "販",
		贪: "貪",
		贫: "貧",
		贬: "貶",
		购: "購",
		贮: "貯",
		贯: "貫",
		贰: "貳",
		贱: "賤",
		贲: "賁",
		贳: "貰",
		贴: "貼",
		贵: "貴",
		贶: "貺",
		贷: "貸",
		贸: "貿",
		费: "費",
		贺: "賀",
		贻: "貽",
		贼: "賊",
		贽: "贄",
		贾: "賈",
		贿: "賄",
		赀: "貲",
		赁: "賃",
		赂: "賂",
		赃: "贓",
		资: "資",
		赅: "賅",
		赆: "贐",
		赇: "賕",
		赈: "賑",
		赉: "賚",
		赊: "賒",
		赋: "賦",
		赌: "賭",
		赍: "齎",
		赎: "贖",
		赏: "賞",
		赐: "賜",
		赒: "賙",
		赓: "賡",
		赔: "賠",
		赕: "賧",
		赖: "賴",
		赗: "賵",
		赘: "贅",
		赙: "賻",
		赚: "賺",
		赛: "賽",
		赜: "賾",
		赝: "贋",
		赞: "贊",
		赟: "贇",
		赠: "贈",
		赡: "贍",
		赢: "贏",
		赣: "贛",
		赵: "趙",
		赶: "趕",
		趋: "趨",
		趱: "趲",
		趸: "躉",
		跃: "躍",
		跄: "蹌",
		跞: "躒",
		践: "踐",
		跷: "蹺",
		跸: "蹕",
		跹: "躚",
		跻: "躋",
		踊: "踴",
		踌: "躊",
		踪: "蹤",
		踬: "躓",
		踯: "躑",
		蹑: "躡",
		蹒: "蹣",
		蹰: "躕",
		蹿: "躥",
		躏: "躪",
		躜: "躦",
		躯: "軀",
		躰: "體",
		车: "車",
		轧: "軋",
		轨: "軌",
		轩: "軒",
		轫: "軔",
		转: "轉",
		轭: "軛",
		轮: "輪",
		软: "軟",
		轰: "轟",
		轱: "軲",
		轲: "軻",
		轳: "轤",
		轴: "軸",
		轵: "軹",
		轶: "軼",
		轷: "軤",
		轸: "軫",
		轹: "轢",
		轺: "軺",
		轻: "輕",
		轼: "軾",
		载: "載",
		轾: "輊",
		轿: "轎",
		辁: "輇",
		辂: "輅",
		较: "較",
		辄: "輒",
		辅: "輔",
		辆: "輛",
		辇: "輦",
		辈: "輩",
		辉: "輝",
		辊: "輥",
		辋: "輞",
		辍: "輟",
		辎: "輜",
		辏: "輳",
		辐: "輻",
		辑: "輯",
		输: "輸",
		辔: "轡",
		辕: "轅",
		辖: "轄",
		辗: "輾",
		辘: "轆",
		辙: "轍",
		辚: "轔",
		辞: "辭",
		辩: "辯",
		辫: "辮",
		边: "邊",
		辽: "遼",
		达: "達",
		迁: "遷",
		过: "過",
		迈: "邁",
		运: "運",
		还: "還",
		这: "這",
		进: "進",
		远: "遠",
		违: "違",
		连: "連",
		迟: "遲",
		迩: "邇",
		迳: "逕",
		迹: "跡",
		适: "適",
		选: "選",
		逊: "遜",
		递: "遞",
		逦: "邐",
		逻: "邏",
		遗: "遺",
		遥: "遙",
		邓: "鄧",
		邝: "鄺",
		邬: "鄔",
		邮: "郵",
		邹: "鄒",
		邺: "鄴",
		邻: "鄰",
		郃: "合",
		郄: "隙",
		郏: "郟",
		郐: "鄶",
		郑: "鄭",
		郓: "鄆",
		郦: "酈",
		郧: "鄖",
		郸: "鄲",
		酝: "醞",
		酱: "醬",
		酽: "釅",
		酾: "釃",
		酿: "釀",
		醖: "醞",
		释: "釋",
		里: "裡",
		鈈: "鈽",
		鈡: "鐘",
		鉆: "鑽",
		鉴: "鑑",
		銮: "鑾",
		銼: "剉",
		鋻: "鑑",
		錘: "鎚",
		録: "錄",
		錾: "鏨",
		鑒: "鑑",
		钆: "釓",
		钇: "釔",
		针: "針",
		钉: "釘",
		钊: "釗",
		钋: "釙",
		钌: "釕",
		钍: "釷",
		钎: "釺",
		钏: "釧",
		钐: "釤",
		钒: "釩",
		钓: "釣",
		钔: "鍆",
		钕: "釹",
		钖: "鍚",
		钗: "釵",
		钘: "鈃",
		钙: "鈣",
		钚: "鈈",
		钛: "鈦",
		钜: "鉅",
		钝: "鈍",
		钞: "鈔",
		钟: "鐘",
		钠: "鈉",
		钡: "鋇",
		钢: "鋼",
		钣: "鈑",
		钤: "鈐",
		钥: "鑰",
		钦: "欽",
		钧: "鈞",
		钨: "鎢",
		钩: "鉤",
		钪: "鈧",
		钫: "鈁",
		钬: "鈥",
		钭: "鈄",
		钮: "鈕",
		钯: "鈀",
		钰: "鈺",
		钱: "錢",
		钲: "鉦",
		钳: "鉗",
		钴: "鈷",
		钵: "缽",
		钶: "鈳",
		钷: "鉕",
		钸: "鈽",
		钹: "鈸",
		钺: "鉞",
		钻: "鑽",
		钼: "鉬",
		钽: "鉭",
		钾: "鉀",
		钿: "鈿",
		铀: "鈾",
		铁: "鐵",
		铂: "鉑",
		铃: "鈴",
		铄: "鑠",
		铅: "鉛",
		铆: "鉚",
		铈: "鈰",
		铉: "鉉",
		铊: "鉈",
		铋: "鉍",
		铌: "鈮",
		铍: "鈹",
		铎: "鐸",
		铏: "鉶",
		铐: "銬",
		铑: "銠",
		铒: "鉺",
		铓: "鋩",
		铕: "銪",
		铖: "鋮",
		铗: "鋏",
		铘: "鋣",
		铙: "鐃",
		铛: "鐺",
		铜: "銅",
		铝: "鋁",
		铞: "銱",
		铟: "銦",
		铠: "鎧",
		铡: "鍘",
		铢: "銖",
		铣: "銑",
		铤: "鋌",
		铥: "銩",
		铧: "鏵",
		铨: "銓",
		铩: "鎩",
		铪: "鉿",
		铫: "銚",
		铬: "鉻",
		铭: "銘",
		铮: "錚",
		铯: "銫",
		铰: "鉸",
		铱: "銥",
		铲: "鏟",
		铳: "銃",
		铴: "鐋",
		铵: "銨",
		银: "銀",
		铷: "銣",
		铸: "鑄",
		铹: "鐒",
		铺: "鋪",
		铼: "錸",
		铽: "鋱",
		链: "鏈",
		铿: "鏗",
		销: "銷",
		锁: "鎖",
		锂: "鋰",
		锃: "鋥",
		锄: "鋤",
		锅: "鍋",
		锆: "鋯",
		锇: "鋨",
		锈: "鏽",
		锉: "銼",
		锊: "鋝",
		锋: "鋒",
		锌: "鋅",
		锍: "鋶",
		锎: "鐦",
		锏: "鐧",
		锐: "銳",
		锑: "銻",
		锒: "鋃",
		锓: "鋟",
		锔: "鋦",
		锕: "錒",
		锖: "錆",
		锗: "鍺",
		锘: "鍩",
		错: "錯",
		锚: "錨",
		锛: "錛",
		锜: "錡",
		锝: "鍀",
		锞: "錁",
		锟: "錕",
		锡: "錫",
		锢: "錮",
		锣: "鑼",
		锤: "錘",
		锥: "錐",
		锦: "錦",
		锧: "鑕",
		锨: "鍁",
		锩: "錈",
		锪: "鍃",
		锫: "錇",
		锬: "錟",
		锭: "錠",
		键: "鍵",
		锯: "鋸",
		锰: "錳",
		锱: "錙",
		锲: "鍥",
		锴: "鍇",
		锵: "鏘",
		锶: "鍶",
		锷: "鍔",
		锸: "鍤",
		锹: "鍬",
		锺: "鍾",
		锻: "鍛",
		锼: "鎪",
		锾: "鍰",
		锿: "鎄",
		镀: "鍍",
		镁: "鎂",
		镂: "鏤",
		镃: "鎡",
		镄: "鐨",
		镅: "鎇",
		镆: "鏌",
		镇: "鎮",
		镉: "鎘",
		镊: "鑷",
		镋: "钂",
		镌: "鐫",
		镍: "鎳",
		镎: "鎿",
		镏: "鎦",
		镐: "鎬",
		镑: "鎊",
		镒: "鎰",
		镓: "鎵",
		镔: "鑌",
		镕: "鎔",
		镖: "鏢",
		镗: "鏜",
		镘: "鏝",
		镙: "鏍",
		镚: "鏰",
		镛: "鏞",
		镜: "鏡",
		镝: "鏑",
		镞: "鏃",
		镟: "鏇",
		镡: "鐔",
		镢: "鐝",
		镣: "鐐",
		镤: "鏷",
		镥: "鑥",
		镦: "鐓",
		镧: "鑭",
		镨: "鐠",
		镩: "鑹",
		镪: "鏹",
		镫: "鐙",
		镬: "鑊",
		镭: "鐳",
		镮: "鐶",
		镯: "鐲",
		镰: "鐮",
		镱: "鐿",
		镲: "鑔",
		镳: "鑣",
		镴: "鑞",
		镶: "鑲",
		长: "長",
		閑: "閒",
		閧: "鬨",
		门: "門",
		闩: "閂",
		闪: "閃",
		闫: "閆",
		闭: "閉",
		问: "問",
		闯: "闖",
		闰: "閏",
		闱: "闈",
		闲: "閒",
		闳: "閎",
		间: "間",
		闵: "閔",
		闶: "閌",
		闷: "悶",
		闸: "閘",
		闹: "鬧",
		闺: "閨",
		闻: "聞",
		闼: "闥",
		闽: "閩",
		闾: "閭",
		闿: "闓",
		阀: "閥",
		阁: "閣",
		阂: "閡",
		阃: "閫",
		阄: "鬮",
		阅: "閱",
		阆: "閬",
		阈: "閾",
		阉: "閹",
		阊: "閶",
		阋: "鬩",
		阌: "閿",
		阍: "閽",
		阎: "閻",
		阏: "閼",
		阐: "闡",
		阑: "闌",
		阒: "闃",
		阔: "闊",
		阕: "闋",
		阖: "闔",
		阗: "闐",
		阙: "闕",
		阚: "闞",
		队: "隊",
		阳: "陽",
		阴: "陰",
		阵: "陣",
		阶: "階",
		际: "際",
		陆: "陸",
		陇: "隴",
		陈: "陳",
		陉: "陘",
		陕: "陝",
		陧: "隉",
		陨: "隕",
		险: "險",
		随: "隨",
		隐: "隱",
		隶: "隸",
		隽: "雋",
		难: "難",
		雏: "雛",
		雠: "讎",
		雳: "靂",
		雾: "霧",
		霁: "霽",
		霉: "黴",
		霭: "靄",
		靓: "靚",
		静: "靜",
		靣: "面",
		靥: "靨",
		鞑: "韃",
		鞒: "橇",
		鞯: "韉",
		韦: "韋",
		韧: "韌",
		韨: "韍",
		韩: "韓",
		韪: "韙",
		韫: "韞",
		韬: "韜",
		韵: "韻",
		页: "頁",
		顶: "頂",
		顷: "頃",
		顸: "頇",
		项: "項",
		顺: "順",
		须: "須",
		顼: "頊",
		顽: "頑",
		顾: "顧",
		顿: "頓",
		颀: "頎",
		颁: "頒",
		颂: "頌",
		颃: "頏",
		预: "預",
		颅: "顱",
		领: "領",
		颇: "頗",
		颈: "頸",
		颉: "頡",
		颊: "頰",
		颋: "頲",
		颌: "頜",
		颍: "潁",
		颏: "頦",
		颐: "頤",
		频: "頻",
		颓: "頹",
		颔: "頷",
		颖: "穎",
		颗: "顆",
		题: "題",
		颙: "顒",
		颚: "顎",
		颛: "顓",
		颜: "顏",
		额: "額",
		颞: "顳",
		颟: "顢",
		颠: "顛",
		颡: "顙",
		颢: "顥",
		颤: "顫",
		颥: "顬",
		颦: "顰",
		颧: "顴",
		风: "風",
		飑: "颮",
		飒: "颯",
		飓: "颶",
		飔: "颸",
		飕: "颼",
		飗: "飀",
		飘: "飄",
		飙: "飆",
		飚: "飈",
		飞: "飛",
		飨: "饗",
		餍: "饜",
		饥: "飢",
		饦: "飥",
		饧: "餳",
		饨: "飩",
		饩: "餼",
		饪: "飪",
		饫: "飫",
		饬: "飭",
		饭: "飯",
		饮: "飲",
		饯: "餞",
		饰: "飾",
		饱: "飽",
		饲: "飼",
		饳: "飿",
		饴: "飴",
		饵: "餌",
		饶: "饒",
		饷: "餉",
		饸: "餄",
		饹: "餎",
		饺: "餃",
		饻: "餏",
		饼: "餅",
		饽: "餑",
		饿: "餓",
		馀: "餘",
		馁: "餒",
		馃: "餜",
		馄: "餛",
		馅: "餡",
		馆: "館",
		馇: "餷",
		馈: "饋",
		馉: "餶",
		馊: "餿",
		馋: "饞",
		馍: "饃",
		馎: "餺",
		馏: "餾",
		馐: "饈",
		馑: "饉",
		馒: "饅",
		馓: "饊",
		馔: "饌",
		馕: "饟",
		騃: "呆",
		马: "馬",
		驭: "馭",
		驮: "馱",
		驯: "馴",
		驰: "馳",
		驱: "驅",
		驳: "駁",
		驴: "驢",
		驵: "駔",
		驶: "駛",
		驷: "駟",
		驸: "駙",
		驹: "駒",
		驺: "騶",
		驻: "駐",
		驼: "駝",
		驽: "駑",
		驾: "駕",
		驿: "驛",
		骀: "駘",
		骁: "驍",
		骂: "罵",
		骄: "驕",
		骅: "驊",
		骆: "駱",
		骇: "駭",
		骈: "駢",
		骊: "驪",
		骋: "騁",
		验: "驗",
		骎: "駸",
		骏: "駿",
		骐: "騏",
		骑: "騎",
		骒: "騍",
		骓: "騅",
		骖: "驂",
		骗: "騙",
		骘: "騭",
		骚: "騷",
		骛: "騖",
		骜: "驁",
		骝: "騮",
		骞: "騫",
		骟: "騸",
		骠: "驃",
		骡: "騾",
		骢: "驄",
		骣: "驏",
		骤: "驟",
		骥: "驥",
		骧: "驤",
		髅: "髏",
		髋: "髖",
		髌: "髕",
		鬓: "鬢",
		魇: "魘",
		魉: "魎",
		鱼: "魚",
		鱽: "魛",
		鱿: "魷",
		鲁: "魯",
		鲂: "魴",
		鲅: "鮁",
		鲆: "鮃",
		鲇: "鯰",
		鲈: "鱸",
		鲊: "鮓",
		鲋: "鮒",
		鲍: "鮑",
		鲎: "鱟",
		鲏: "鮍",
		鲐: "鮐",
		鲑: "鮭",
		鲒: "鮚",
		鲔: "鮪",
		鲕: "鮞",
		鲖: "鮦",
		鲗: "鰂",
		鲙: "鱠",
		鲚: "鱭",
		鲛: "鮫",
		鲜: "鮮",
		鲝: "鮺",
		鲞: "鯗",
		鲟: "鱘",
		鲠: "鯁",
		鲡: "鱺",
		鲢: "鰱",
		鲣: "鰹",
		鲤: "鯉",
		鲥: "鰣",
		鲦: "鰷",
		鲧: "鯀",
		鲨: "鯊",
		鲩: "鯇",
		鲫: "鯽",
		鲭: "鯖",
		鲮: "鯪",
		鲰: "鯫",
		鲱: "鯡",
		鲲: "鯤",
		鲳: "鯧",
		鲴: "鯝",
		鲵: "鯢",
		鲶: "鯰",
		鲷: "鯛",
		鲸: "鯨",
		鲺: "鯴",
		鲻: "鯔",
		鲼: "鱝",
		鲽: "鰈",
		鲿: "鱨",
		鳁: "鰛",
		鳃: "鰓",
		鳄: "鱷",
		鳅: "鰍",
		鳆: "鰒",
		鳇: "鰉",
		鳊: "鯿",
		鳋: "鰠",
		鳌: "鰲",
		鳍: "鰭",
		鳎: "鰨",
		鳏: "鰥",
		鳐: "鰩",
		鳑: "鰟",
		鳒: "鰜",
		鳓: "鰳",
		鳔: "鰾",
		鳕: "鱈",
		鳖: "鱉",
		鳗: "鰻",
		鳘: "鰵",
		鳙: "鱅",
		鳛: "鰼",
		鳜: "鱖",
		鳝: "鱔",
		鳞: "鱗",
		鳟: "鱒",
		鳢: "鱧",
		鳣: "鱣",
		鶏: "雞",
		鷄: "雞",
		鸟: "鳥",
		鸠: "鳩",
		鸡: "雞",
		鸢: "鳶",
		鸣: "鳴",
		鸥: "鷗",
		鸦: "鴉",
		鸧: "鶬",
		鸨: "鴇",
		鸩: "鴆",
		鸪: "鴣",
		鸫: "鶇",
		鸬: "鸕",
		鸭: "鴨",
		鸮: "鴞",
		鸯: "鴦",
		鸰: "鴒",
		鸱: "鴟",
		鸲: "鴝",
		鸳: "鴛",
		鸵: "鴕",
		鸶: "鷥",
		鸷: "鷙",
		鸸: "鴯",
		鸹: "鴰",
		鸺: "鵂",
		鸻: "鴴",
		鸼: "鵃",
		鸽: "鴿",
		鸾: "鸞",
		鸿: "鴻",
		鹁: "鵓",
		鹂: "鸝",
		鹃: "鵑",
		鹄: "鵠",
		鹅: "鵝",
		鹆: "鵒",
		鹇: "鷴",
		鹈: "鵜",
		鹉: "鵡",
		鹊: "鵲",
		鹋: "鶓",
		鹌: "鵪",
		鹎: "鵯",
		鹏: "鵬",
		鹐: "鵮",
		鹑: "鶉",
		鹒: "鶊",
		鹕: "鶘",
		鹖: "鶡",
		鹗: "鶚",
		鹘: "鶻",
		鹙: "鶖",
		鹚: "鶿",
		鹛: "鶥",
		鹜: "鶩",
		鹞: "鷂",
		鹡: "鶺",
		鹣: "鶼",
		鹤: "鶴",
		鹥: "鷖",
		鹦: "鸚",
		鹧: "鷓",
		鹨: "鷚",
		鹩: "鷯",
		鹪: "鷦",
		鹫: "鷲",
		鹬: "鷸",
		鹭: "鷺",
		鹯: "鸇",
		鹰: "鷹",
		鹱: "鸌",
		鹳: "鸛",
		鹾: "鹺",
		麦: "麥",
		麸: "麩",
		麽: "麼",
		黄: "黃",
		黉: "黌",
		黡: "黶",
		黩: "黷",
		黪: "黲",
		黾: "黽",
		鼋: "黿",
		鼍: "鼉",
		鼹: "鼴",
		齐: "齊",
		齑: "齏",
		齶: "顎",
		齿: "齒",
		龀: "齔",
		龃: "齟",
		龄: "齡",
		龅: "齙",
		龆: "齠",
		龇: "齜",
		龈: "齦",
		龉: "齬",
		龊: "齪",
		龋: "齲",
		龌: "齷",
		龙: "龍",
		龚: "龔",
		龛: "龕",
		龟: "龜",
		"": "　"
	};
	function r(e) {
		const n = typeof e == "string";
		return n || console.error("The expected text signature is undefined | null | string, but an unexpected value was passed in:", typeof e), (n ? e : "").replace(i, o);
	}
	var i = /[^\x00-\xFF]/g;
	function o(e) {
		return s[e] ?? e;
	}
	var cn_default = [["一坏 一坯|一目瞭然 一目了然|七逕 七迳|上逕 上迳|上鍊 上链|不可貲計 不可赀計|不瞭解 不了解|么麼 幺麽|么麽 幺麽|九逕山 九迳山|乾乾淨淨 干干净净|乾乾脆脆 干干脆脆|乾佑縣 乾佑县|乾元 乾元|乾卦 乾卦|乾嘉 乾嘉|乾圖 乾图|乾坤 乾坤|乾坤一擲 乾坤一掷|乾坤再造 乾坤再造|乾坤大挪移 乾坤大挪移|乾宅 乾宅|乾安縣 乾安县|乾安鎮 乾安镇|乾州 乾州|乾斷 乾断|乾斷食 干断食|乾旦 乾旦|乾曜 乾曜|乾清宮 乾清宫|乾盛世 乾盛世|乾紅 干红|乾綱 乾纲|乾縣 乾县|乾象 乾象|乾造 乾造|乾道 乾道|乾闥婆 乾闼婆|乾陵 乾陵|乾隆 乾隆|乾隆年間 乾隆年间|乾隆皇帝 乾隆皇帝|二噁英 二𫫇英|仇讎 仇雠|以免藉口 以免借口|以功覆過 以功覆过|任筆沈詩 任笔沈诗|侔德覆載 侔德覆载|傢俱 家具|傷亡枕藉 伤亡枕藉|允祕 允祕|八濛山 八濛山|其陰多蒐 其阴多蒐|凌藉 凌借|出醜狼藉 出丑狼藉|函覆 函复|剋架 剋架|剋毒 剋毒|千鍾粟 千锺粟|南氾 南氾|南逕 南迳|反反覆覆 反反复复|反覆 反复|反覆思維 反复思维|反覆思量 反复思量|反覆性 反复性|名覆金甌 名复金瓯|吳祕 吴祕|吳育昇 吴育昇|哪吒 哪吒|回覆 回复|土坏 土坯|坏土 坯土|坏子 坯子|坏布 坯布|坏戶 坯户|墨沈沈 墨沉沉|壺裏乾坤 壶里乾坤|大目乾連冥間救母變文 大目乾连冥间救母变文|宫商角徵羽 宫商角徵羽|射覆 射覆|尼乾子 尼乾子|尼乾陀 尼乾陀|年釐 年釐|幺麼 幺麽|幺麼小丑 幺麽小丑|幺麼小醜 幺麽小丑|康乾 康乾|張昇 张昇|張法乾 张法乾|彷彿 仿佛|彷徨 彷徨|徐胤昇 徐胤昇|復甦 复苏|徵弦 徵弦|徵絃 徵弦|徵羽摩柯 徵羽摩柯|徵聲 徵声|徵調 徵调|徵音 徵音|情有獨鍾 情有独钟|想像 想像|意志消沈 意志消沉|慰藉 慰藉|慰藉着 慰藉着|憑藉 凭借|憑藉着 凭借着|懷釐 怀釐|成甦 成甦|所費不貲 所费不赀|手鍊 手链|打坏 打坯|扞格 扞格|扭轉乾坤 扭转乾坤|批覆 批复|找藉口 找借口|折戟沈沙 折戟沉沙|折戟沈河 折戟沉河|拉坏 拉坯|拉鍊 拉链|拉鍊工程 拉链工程|拜覆 拜复|挨剋 挨剋|捏坏 捏坯|擊沈 击沉|據瞭解 据了解|文錦覆阱 文锦覆阱|於世成 於世成|於乎 於乎|於仲完 於仲完|於倫 於伦|於其一 於其一|於則 於则|於勇明 於勇明|於呼哀哉 於呼哀哉|於單 於单|於坦 於坦|於崇文 於崇文|於忠祥 於忠祥|於惟一 於惟一|於戲 於戏|於敖 於敖|於梨華 於梨华|於清言 於清言|於潛 於潜|於琳 於琳|於穆 於穆|於竹屋 於竹屋|於菟 於菟|於邑 於邑|於陵子 於陵子|旋乾轉坤 旋乾转坤|旋轉乾坤 旋转乾坤|旋轉乾坤之力 旋转乾坤之力|明瞭 明了|明覆 明复|昏沈 昏沉|春蒐 春蒐|春釐 春釐|暗沈沈 暗沉沉|書中自有千鍾粟 书中自有千锺粟|有序 有序|朝乾夕惕 朝乾夕惕|木吒 木吒|李乾德 李乾德|李昇 李昇|李昇勳 李昇勋|李澤鉅 李泽钜|李祕 李祕|李鍊福 李链福|李鍾郁 李锺郁|束脩 束脩|東氾 东氾|林甦 林甦|校讎 校雠|梁昇卿 梁昇卿|梁章鉅 梁章钜|楊甦棣 杨甦棣|楊聯陞 杨联陞|樊於期 樊於期|橡椀 橡椀|死氣沈沈 死气沉沉|段脩 段脩|毛坏 毛坯|水逕 水迳|氾勝之 氾胜之|氾南 氾南|氾國 氾国|氾水 氾水|沈下 沉下|沈不住氣 沉不住气|沈住氣 沉住气|沈冤 沉冤|沈厚 沉厚|沈吟 沉吟|沈寂 沉寂|沈得住氣 沉得住气|沈思 沉思|沈思往事 沉思往事|沈悶 沉闷|沈沒 沉没|沈沒成本 沉没成本|沈浮 沉浮|沈浸 沉浸|沈浸於 沉浸于|沈淪 沉沦|沈湎 沉湎|沈湎酒色 沉湎酒色|沈溺 沉溺|沈滯 沉滞|沈滯性 沉滞性|沈澱 沉淀|沈澱出來 沉淀出来|沈澱劑 沉淀剂|沈澱法 沉淀法|沈澱物 沉淀物|沈濁 沉浊|沈甸甸 沉甸甸|沈痛 沉痛|沈痼 沉痼|沈痾 沉疴|沈睡 沉睡|沈睡不醒 沉睡不醒|沈砂池 沉砂池|沈積 沉积|沈積岩 沉积岩|沈積石 沉积石|沈筒 沉筒|沈船 沉船|沈落 沉落|沈詩任筆 沈诗任笔|沈迷 沉迷|沈迷不醒 沉迷不醒|沈醉 沉醉|沈重 沉重|沈降 沉降|沈陷 沉陷|沈靜 沉静|沈靜下來 沉静下来|沈香 沉香|沈鬱 沉郁|沈魚落雁 沉鱼落雁|沈默 沉默|沈默不語 沉默不语|沈默寡言 沉默寡言|沙逕 沙迳|河逕 河迳|流徵 流徵|浪蕩乾坤 浪荡乾坤|浮沈 浮沉|海哩 海里|深沈 深沉|深沈不露 深沉不露|溫昇豪 温昇豪|滑藉 滑借|烏昇 乌昇|烏沈沈 乌沉沉|烏逕 乌迳|無序 无序|狐藉虎威 狐借虎威|王彥昇 王彦昇|珍珠項鍊 珍珠项链|甚鉅 甚钜|甦生 苏生|甦醒 苏醒|申昇勳 申昇勋|申覆 申复|畢昇 毕昇|發覆 发覆|盧象昇 卢象昇|目劄 目劄|瞭哨 瞭哨|瞭如 了如|瞭如指掌 了如指掌|瞭望 瞭望|瞭然 了然|瞭然於心 了然于心|瞭若指掌 了若指掌|瞭解 了解|瞭解到 了解到|破釜沈舟 破釜沉舟|磚坏 砖坯|示覆 示复|社逕 社迳|祕丕笈 祕丕笈|祕彭祖 祕彭祖|祕瓊 祕琼|祝釐 祝釐|神祇 神祇|稟覆 禀复|竺乾 竺乾|答覆 答复|篤麼 笃麽|簡單明瞭 简单明了|籌畫 筹划|素藉 素借|老態龍鍾 老态龙钟|耳沈 耳沉|肉脩 肉脩|肘手鍊足 肘手链足|胤祕 胤祕|脩敬 脩敬|脩炳 脩炳|脩脡 脩脡|脩脯 脩脯|脩金 脩金|脫坏 脱坯|腶脩 腶脩|英哩 英里|茅蒐 茅蒐|茵藉 茵借|萬鍾 万锺|落雁沈魚 落雁沉鱼|蒐于紅 蒐于红|蒐於紅 蒐于红|蒐狩 蒐狩|蒐獮 蒐狝|蒐獵 蒐猎|蒐田 蒐田|蒐畋 蒐畋|蒐苗 蒐苗|蒜薹 蒜薹|蔣昇 蒋昇|蕓薹 芸薹|蕩覆 荡覆|蕭乾 萧乾|藉代 借代|藉以 借以|藉助 借助|藉助於 借助于|藉卉 借卉|藉口 借口|藉喻 借喻|藉寇兵 借寇兵|藉寇兵齎盜糧 借寇兵赍盗粮|藉手 借手|藉據 借据|藉故 借故|藉故推辭 借故推辞|藉方 借方|藉條 借条|藉槁 借槁|藉機 借机|藉此 借此|藉此機會 借此机会|藉甚 借甚|藉由 借由|藉着 借着|藉端 借端|藉端生事 借端生事|藉箸代籌 借箸代筹|藉草枕塊 借草枕块|藉藉 藉藉|藉藉无名 藉藉无名|藉詞 借词|藉讀 借读|藉資 借资|衹得 只得|衹見樹木 只见树木|衹見樹木不見森林 只见树木不见森林|袁祕 袁祕|袖裏乾坤 袖里乾坤|袷袢 袷袢|製坏 制坯|覆上 覆上|覆住 覆住|覆信 复信|覆冒 覆冒|覆呈 复呈|覆命 复命|覆墓 复墓|覆宗 覆宗|覆帳 复帐|覆幬 覆帱|覆成 覆成|覆按 复按|覆文 复文|覆杯 覆杯|覆校 复校|覆瓿 覆瓿|覆盂 覆盂|覆盆 覆盆|覆盆子 覆盆子|覆盤 覆盘|覆育 覆育|覆蕉尋鹿 覆蕉寻鹿|覆逆 覆逆|覆醢 覆醢|覆醬瓿 覆酱瓿|覆電 复电|覆露 覆露|覆鹿尋蕉 覆鹿寻蕉|覆鹿遺蕉 覆鹿遗蕉|覆鼎 覆鼎|見覆 见复|角徵 角徵|角徵羽 角徵羽|計畫 计划|許甦魂 许甦魂|變徵 变徵|變徵之聲 变徵之声|變徵之音 变徵之音|讎定 雠定|谿工 谿工|貂覆額 貂覆额|買臣覆水 买臣覆水|赤石逕 赤石迳|踅門瞭戶 踅门了户|躪藉 躏借|載沈載浮 载沉载浮|載浮載沈 载浮载沉|辛祕 辛祕|逆釐 逆釐|逕口 迳口|逕聯 迳联|逕頭 迳头|郭子乾 郭子乾|酒逢知己千鍾少 酒逢知己千锺少|醞藉 酝借|重覆 重复|金吒 金吒|金昇玟 金昇玟|金鍊 金链|鈞覆 钧复|鉅子 钜子|鉅萬 钜万|鉅防 钜防|鉸鍊 铰链|銀鍊 银链|鋼坏 钢坯|錢鍾書 钱锺书|鍊墜 链坠|鍊子 链子|鍊形 链形|鍊條 链条|鍊錘 链锤|鍊鎖 链锁|鍛鍾 锻锺|鍾繇 锺繇|鍾萬梅 锺万梅|鍾重發 锺重发|鍾鍛 锺锻|鍾馗 锺馗|鎖鍊 锁链|鐵鍊 铁链|鑽石項鍊 钻石项链|鑿坏 凿坯|閻鶴昇 阎鹤昇|陰沈 阴沉|陰沈沈 阴沉沉|陰陰沈沈 阴阴沉沉|陳志昇 陈志昇|陳昇 陈昇|陳甦 陈甦|陶坏 陶坯|雁杳魚沈 雁杳鱼沉|雖覆能復 虽覆能复|電覆 电复|露覆 露覆|韓昇延 韩昇延|韓甦 韩甦|項鍊 项链|頗覆 颇覆|頸鍊 颈链|顛乾倒坤 颠乾倒坤|顛倒乾坤 颠倒乾坤|顧藉 顾借|馮甦 冯甦|魏徵 魏徵|魚沈雁杳 鱼沉雁杳|麪坏兒 面坯儿|麼些族 麽些族|黃甦 黄甦|黃鍾公 黄锺公|黑沈沈 黑沉沉|龍鍾 龙钟|龔昇 龚昇", "㑯 㑔|㑳 㑇|㑶 㐹|㓨 刾|㗲 𠵾|㘚 㘎|㜄 㚯|㜏 㛣|㜢 𡞱|㠏 㟆|㠣 𫵷|㥮 㤘|㩜 㨫|㩳 㧐|㩵 擜|㺏 𤠋|䁪 𥇢|䁻 䀥|䃮 鿎|䊷 䌶|䋙 䌺|䋚 䌻|䋹 䌿|䋻 䌾|䍦 䍠|䎱 䎬|䓣 𬜯|䙡 䙌|䜀 䜧|䝼 䞍|䡵 𫟦|䥇 䦂|䥑 鿏|䥕 𬭯|䥱 䥾|䦛 䦶|䦟 䦷|䧢 𨸟|䮄 𫠊|䯀 䯅|䰾 鲃|䱷 䲣|䱽 䲝|䲁 鳚|䲘 鳤|䴉 鹮|丟 丢|並 并|乾 干|亂 乱|亙 亘|亞 亚|佇 伫|佈 布|佔 占|併 并|來 来|侖 仑|侶 侣|侷 局|俁 俣|係 系|俔 伣|俠 侠|俥 伡|俬 私|倀 伥|倆 俩|倈 俫|倉 仓|個 个|們 们|倖 幸|倫 伦|倲 㑈|偉 伟|偑 㐽|側 侧|偵 侦|偽 伪|傌 㐷|傑 杰|傖 伧|傘 伞|備 备|傢 家|傭 佣|傯 偬|傳 传|傴 伛|債 债|傷 伤|傾 倾|僂 偻|僅 仅|僉 佥|僑 侨|僕 仆|僞 伪|僤 𫢸|僥 侥|僨 偾|僱 雇|價 价|儀 仪|儁 俊|儂 侬|億 亿|儈 侩|儉 俭|儎 傤|儐 傧|儔 俦|儕 侪|儘 尽|償 偿|優 优|儲 储|儷 俪|儸 㑩|儺 傩|儻 傥|儼 俨|兇 凶|兌 兑|兒 儿|兗 兖|內 内|兩 两|冊 册|冑 胄|冪 幂|凈 净|凍 冻|凜 凛|凱 凯|別 别|刪 删|剄 刭|則 则|剋 克|剎 刹|剗 刬|剛 刚|剝 剥|剮 剐|剴 剀|創 创|剷 铲|劃 划|劄 札|劇 剧|劉 刘|劊 刽|劌 刿|劍 剑|劏 㓥|劑 剂|劚 㔉|勁 劲|動 动|務 务|勛 勋|勝 胜|勞 劳|勢 势|勣 𪟝|勩 勚|勱 劢|勳 勋|勵 励|勸 劝|勻 匀|匭 匦|匯 汇|匱 匮|區 区|協 协|卹 恤|卻 却|卽 即|厙 厍|厠 厕|厤 历|厭 厌|厲 厉|厴 厣|參 参|叄 叁|叢 丛|吒 咤|吳 吴|吶 呐|呂 吕|咼 呙|員 员|唄 呗|唸 念|問 问|啓 启|啞 哑|啟 启|啢 唡|喎 㖞|喚 唤|喪 丧|喫 吃|喬 乔|單 单|喲 哟|嗆 呛|嗇 啬|嗊 唝|嗎 吗|嗚 呜|嗩 唢|嗰 𠮶|嗶 哔|嘆 叹|嘍 喽|嘓 啯|嘔 呕|嘖 啧|嘗 尝|嘜 唛|嘩 哗|嘮 唠|嘯 啸|嘰 叽|嘵 哓|嘸 呒|嘽 啴|噁 恶|噓 嘘|噚 㖊|噝 咝|噠 哒|噥 哝|噦 哕|噯 嗳|噲 哙|噴 喷|噸 吨|噹 当|嚀 咛|嚇 吓|嚌 哜|嚐 尝|嚕 噜|嚙 啮|嚥 咽|嚦 呖|嚧 𠰷|嚨 咙|嚮 向|嚲 亸|嚳 喾|嚴 严|嚶 嘤|囀 啭|囁 嗫|囂 嚣|囅 冁|囈 呓|囉 啰|囌 苏|囑 嘱|囪 囱|圇 囵|國 国|圍 围|園 园|圓 圆|圖 图|團 团|垻 坝|埡 垭|埨 𫭢|埰 采|執 执|堅 坚|堊 垩|堖 垴|堝 埚|堯 尧|報 报|場 场|塊 块|塋 茔|塏 垲|塒 埘|塗 涂|塚 冢|塢 坞|塤 埙|塵 尘|塸 𫭟|塹 堑|塿 𪣻|墊 垫|墜 坠|墠 𫮃|墮 堕|墰 坛|墳 坟|墶 垯|墻 墙|墾 垦|壇 坛|壋 垱|壎 埙|壓 压|壗 𡋤|壘 垒|壙 圹|壚 垆|壜 坛|壞 坏|壟 垄|壠 垅|壢 坜|壩 坝|壪 塆|壯 壮|壺 壶|壼 壸|壽 寿|夠 够|夢 梦|夥 伙|夾 夹|奐 奂|奧 奥|奩 奁|奪 夺|奬 奖|奮 奋|奼 姹|妝 妆|姍 姗|姦 奸|娙 𫰛|娛 娱|婁 娄|婦 妇|婭 娅|媧 娲|媯 妫|媰 㛀|媼 媪|媽 妈|嫋 袅|嫗 妪|嫵 妩|嫺 娴|嫻 娴|嫿 婳|嬀 妫|嬃 媭|嬈 娆|嬋 婵|嬌 娇|嬙 嫱|嬡 嫒|嬤 嬷|嬪 嫔|嬰 婴|嬸 婶|孃 娘|孋 㛤|孌 娈|孫 孙|學 学|孻 𡥧|孿 孪|宮 宫|寀 采|寢 寝|實 实|寧 宁|審 审|寫 写|寬 宽|寵 宠|寶 宝|將 将|專 专|尋 寻|對 对|導 导|尷 尴|屆 届|屍 尸|屓 屃|屜 屉|屢 屡|層 层|屨 屦|屬 属|岡 冈|峯 峰|峴 岘|島 岛|峽 峡|崍 崃|崑 昆|崗 岗|崙 仑|崢 峥|崬 岽|嵐 岚|嵗 岁|嵽 𫶇|嵾 㟥|嶁 嵝|嶄 崭|嶇 岖|嶔 嵚|嶗 崂|嶠 峤|嶢 峣|嶧 峄|嶨 峃|嶮 崄|嶸 嵘|嶺 岭|嶼 屿|嶽 岳|巋 岿|巒 峦|巔 巅|巖 岩|巘 𪩘|巰 巯|巹 卺|帥 帅|師 师|帳 帐|帶 带|幀 帧|幃 帏|幓 㡎|幗 帼|幘 帻|幟 帜|幣 币|幫 帮|幬 帱|幷 并|幹 干|幾 几|庫 库|廁 厕|廂 厢|廄 厩|廈 厦|廎 庼|廕 荫|廚 厨|廝 厮|廞 𫷷|廟 庙|廠 厂|廡 庑|廢 废|廣 广|廩 廪|廬 庐|廳 厅|弒 弑|弔 吊|弳 弪|張 张|強 强|彄 𫸩|彆 别|彈 弹|彌 弥|彎 弯|彔 录|彙 汇|彠 彟|彥 彦|彫 雕|彲 彨|彿 佛|後 后|徑 径|從 从|徠 徕|復 复|徵 征|徹 彻|恆 恒|恥 耻|悅 悦|悞 悮|悵 怅|悶 闷|悽 凄|惡 恶|惱 恼|惲 恽|惻 恻|愛 爱|愜 惬|愨 悫|愴 怆|愷 恺|愾 忾|慄 栗|態 态|慍 愠|慘 惨|慚 惭|慟 恸|慣 惯|慤 悫|慪 怄|慫 怂|慮 虑|慳 悭|慶 庆|慺 㥪|慼 戚|慾 欲|憂 忧|憊 惫|憐 怜|憑 凭|憒 愦|憖 慭|憚 惮|憤 愤|憫 悯|憮 怃|憲 宪|憶 忆|懇 恳|應 应|懌 怿|懍 懔|懞 蒙|懟 怼|懣 懑|懤 㤽|懨 恹|懲 惩|懶 懒|懷 怀|懸 悬|懺 忏|懼 惧|懾 慑|戀 恋|戇 戆|戔 戋|戧 戗|戩 戬|戰 战|戱 戯|戲 戏|戶 户|扞 捍|拋 抛|拚 拼|挩 捝|挱 挲|挾 挟|捨 舍|捫 扪|捱 挨|捲 卷|掃 扫|掄 抡|掆 㧏|掗 挜|掙 挣|掛 挂|採 采|揀 拣|揚 扬|換 换|揮 挥|揯 搄|損 损|搖 摇|搗 捣|搧 扇|搵 揾|搶 抢|摑 掴|摜 掼|摟 搂|摯 挚|摳 抠|摶 抟|摺 折|摻 掺|撈 捞|撏 挦|撐 撑|撓 挠|撝 㧑|撟 挢|撣 掸|撥 拨|撫 抚|撲 扑|撳 揿|撻 挞|撾 挝|撿 捡|擁 拥|擄 掳|擇 择|擊 击|擋 挡|擓 㧟|擔 担|據 据|擠 挤|擡 抬|擣 捣|擬 拟|擯 摈|擰 拧|擱 搁|擲 掷|擴 扩|擷 撷|擺 摆|擻 擞|擼 撸|擽 㧰|擾 扰|攄 摅|攆 撵|攏 拢|攔 拦|攖 撄|攙 搀|攛 撺|攜 携|攝 摄|攢 攒|攣 挛|攤 摊|攪 搅|攬 揽|敎 教|敓 敚|敗 败|敘 叙|敵 敌|數 数|斂 敛|斃 毙|斆 敩|斕 斓|斬 斩|斷 断|於 于|旂 旗|旣 既|昇 升|時 时|晉 晋|晛 𬀪|晝 昼|暈 晕|暉 晖|暐 𬀩|暘 旸|暢 畅|暫 暂|曄 晔|曆 历|曇 昙|曉 晓|曏 向|曖 暧|曠 旷|曥 𣆐|曨 昽|曬 晒|書 书|會 会|朥 𦛨|朧 胧|朮 术|東 东|枴 拐|柵 栅|柺 拐|査 查|桱 𣐕|桿 杆|梔 栀|梘 枧|梜 𬂩|條 条|梟 枭|梲 棁|棄 弃|棊 棋|棖 枨|棗 枣|棟 栋|棡 㭎|棧 栈|棲 栖|棶 梾|椏 桠|椲 㭏|楊 杨|楓 枫|楨 桢|業 业|極 极|榘 矩|榦 干|榪 杩|榮 荣|榲 榅|榿 桤|構 构|槍 枪|槓 杠|槤 梿|槧 椠|槨 椁|槮 椮|槳 桨|槶 椢|槼 椝|樁 桩|樂 乐|樅 枞|樑 梁|樓 楼|標 标|樞 枢|樢 㭤|樣 样|樧 榝|樫 㭴|樳 桪|樸 朴|樹 树|樺 桦|樿 椫|橈 桡|橋 桥|機 机|橢 椭|橫 横|橯 𣓿|檁 檩|檉 柽|檔 档|檜 桧|檟 槚|檢 检|檣 樯|檮 梼|檯 台|檳 槟|檸 柠|檻 槛|櫃 柜|櫍 𬃊|櫓 橹|櫚 榈|櫛 栉|櫝 椟|櫞 橼|櫟 栎|櫥 橱|櫧 槠|櫨 栌|櫪 枥|櫫 橥|櫬 榇|櫱 蘖|櫳 栊|櫸 榉|櫻 樱|欄 栏|欅 榉|權 权|欏 椤|欒 栾|欓 𣗋|欖 榄|欞 棂|欽 钦|歎 叹|歐 欧|歟 欤|歡 欢|歲 岁|歷 历|歸 归|歿 殁|殘 残|殞 殒|殤 殇|殨 㱮|殫 殚|殭 僵|殮 殓|殯 殡|殰 㱩|殲 歼|殺 杀|殻 壳|殼 壳|毀 毁|毆 殴|毿 毵|氂 牦|氈 毡|氌 氇|氣 气|氫 氢|氬 氩|氳 氲|氾 泛|汎 泛|汙 污|決 决|沒 没|沖 冲|況 况|泝 溯|洩 泄|洶 汹|浹 浃|浿 𬇙|涇 泾|涗 涚|涼 凉|淒 凄|淚 泪|淥 渌|淨 净|淩 凌|淪 沦|淵 渊|淶 涞|淺 浅|渙 涣|減 减|渢 沨|渦 涡|測 测|渾 浑|湊 凑|湋 𣲗|湞 浈|湧 涌|湯 汤|溈 沩|準 准|溝 沟|溫 温|溮 浉|溳 涢|溼 湿|滄 沧|滅 灭|滌 涤|滎 荥|滙 汇|滬 沪|滯 滞|滲 渗|滷 卤|滸 浒|滻 浐|滾 滚|滿 满|漁 渔|漊 溇|漍 𬇹|漚 沤|漢 汉|漣 涟|漬 渍|漲 涨|漵 溆|漸 渐|漿 浆|潁 颍|潑 泼|潔 洁|潕 𣲘|潙 沩|潚 㴋|潛 潜|潤 润|潯 浔|潰 溃|潷 滗|潿 涠|澀 涩|澆 浇|澇 涝|澐 沄|澗 涧|澠 渑|澤 泽|澦 滪|澩 泶|澫 𬇕|澮 浍|澱 淀|澾 㳠|濁 浊|濃 浓|濄 㳡|濆 𣸣|濕 湿|濘 泞|濚 溁|濛 蒙|濜 浕|濟 济|濤 涛|濧 㳔|濫 滥|濰 潍|濱 滨|濺 溅|濼 泺|濾 滤|瀂 澛|瀅 滢|瀆 渎|瀇 㲿|瀉 泻|瀋 沈|瀏 浏|瀕 濒|瀘 泸|瀝 沥|瀟 潇|瀠 潆|瀦 潴|瀧 泷|瀨 濑|瀰 弥|瀲 潋|瀾 澜|灃 沣|灄 滠|灑 洒|灒 𪷽|灕 漓|灘 滩|灙 𣺼|灝 灏|灡 㳕|灣 湾|灤 滦|灧 滟|灩 滟|災 灾|為 为|烏 乌|烴 烃|無 无|煉 炼|煒 炜|煙 烟|煢 茕|煥 焕|煩 烦|煬 炀|煱 㶽|熅 煴|熒 荧|熗 炝|熰 𬉼|熱 热|熲 颎|熾 炽|燀 𬊤|燁 烨|燈 灯|燉 炖|燒 烧|燖 𬊈|燙 烫|燜 焖|營 营|燦 灿|燬 毁|燭 烛|燴 烩|燶 㶶|燻 熏|燼 烬|燾 焘|爍 烁|爐 炉|爛 烂|爭 争|爲 为|爺 爷|爾 尔|牀 床|牆 墙|牘 牍|牴 抵|牽 牵|犖 荦|犛 牦|犢 犊|犧 牺|狀 状|狹 狭|狽 狈|猙 狰|猶 犹|猻 狲|獁 犸|獃 呆|獄 狱|獅 狮|獎 奖|獨 独|獪 狯|獫 猃|獮 狝|獰 狞|獱 㺍|獲 获|獵 猎|獷 犷|獸 兽|獺 獭|獻 献|獼 猕|玀 猡|現 现|琱 雕|琺 珐|琿 珲|瑋 玮|瑒 玚|瑣 琐|瑤 瑶|瑩 莹|瑪 玛|瑲 玱|璉 琏|璊 𫞩|璕 𬍤|璗 𬍡|璡 琎|璣 玑|璦 瑷|璫 珰|璯 㻅|環 环|璵 玙|璸 瑸|璽 玺|璿 璇|瓅 𬍛|瓊 琼|瓏 珑|瓔 璎|瓚 瓒|瓛 𤩽|甌 瓯|甕 瓮|產 产|産 产|畝 亩|畢 毕|畫 画|異 异|畵 画|當 当|疇 畴|疊 叠|痙 痉|痠 酸|痾 疴|瘂 痖|瘋 疯|瘍 疡|瘓 痪|瘞 瘗|瘡 疮|瘧 疟|瘮 瘆|瘲 疭|瘺 瘘|瘻 瘘|療 疗|癆 痨|癇 痫|癉 瘅|癒 愈|癘 疠|癟 瘪|癡 痴|癢 痒|癤 疖|癥 症|癧 疬|癩 癞|癬 癣|癭 瘿|癮 瘾|癰 痈|癱 瘫|癲 癫|發 发|皁 皂|皚 皑|皰 疱|皸 皲|皺 皱|盃 杯|盜 盗|盞 盏|盡 尽|監 监|盤 盘|盧 卢|盪 荡|眞 真|眥 眦|眾 众|睍 𪾢|睏 困|睜 睁|睞 睐|瞘 眍|瞜 䁖|瞞 瞒|瞶 瞆|瞼 睑|矇 蒙|矓 眬|矚 瞩|矯 矫|硃 朱|硜 硁|硤 硖|硨 砗|硯 砚|碕 埼|碩 硕|碭 砀|碸 砜|確 确|碼 码|碽 䂵|磑 硙|磚 砖|磠 硵|磣 碜|磧 碛|磯 矶|磽 硗|磾 䃅|礄 硚|礎 础|礐 𬒈|礙 碍|礦 矿|礪 砺|礫 砾|礬 矾|礱 砻|祕 秘|祿 禄|禍 祸|禎 祯|禕 祎|禡 祃|禦 御|禪 禅|禮 礼|禰 祢|禱 祷|禿 秃|秈 籼|稅 税|稈 秆|稏 䅉|稜 棱|稟 禀|種 种|稱 称|穀 谷|穇 䅟|穌 稣|積 积|穎 颖|穠 秾|穡 穑|穢 秽|穩 稳|穫 获|穭 穞|窩 窝|窪 洼|窮 穷|窯 窑|窵 窎|窶 窭|窺 窥|竄 窜|竅 窍|竇 窦|竈 灶|竊 窃|竪 竖|競 竞|筆 笔|筍 笋|筧 笕|筴 䇲|箇 个|箋 笺|箏 筝|箚 札|節 节|範 范|築 筑|篋 箧|篔 筼|篠 筿|篢 𬕂|篤 笃|篩 筛|篳 筚|篸 𥮾|簀 箦|簍 篓|簑 蓑|簞 箪|簡 简|簣 篑|簫 箫|簹 筜|簽 签|簾 帘|籃 篮|籅 𥫣|籌 筹|籔 䉤|籙 箓|籛 篯|籜 箨|籟 籁|籠 笼|籤 签|籩 笾|籪 簖|籬 篱|籮 箩|籲 吁|粵 粤|糉 粽|糝 糁|糞 粪|糧 粮|糰 团|糲 粝|糴 籴|糶 粜|糹 纟|糾 纠|紀 纪|紂 纣|紃 𬘓|約 约|紅 红|紆 纡|紇 纥|紈 纨|紉 纫|紋 纹|納 纳|紐 纽|紓 纾|純 纯|紕 纰|紖 纼|紗 纱|紘 纮|紙 纸|級 级|紛 纷|紜 纭|紝 纴|紞 𬘘|紡 纺|紬 䌷|紮 扎|細 细|紱 绂|紲 绁|紳 绅|紵 纻|紹 绍|紺 绀|紼 绋|紿 绐|絀 绌|終 终|絃 弦|組 组|絅 䌹|絆 绊|絎 绗|結 结|絕 绝|絛 绦|絝 绔|絞 绞|絡 络|絢 绚|給 给|絨 绒|絪 𬘡|絰 绖|統 统|絲 丝|絳 绛|絶 绝|絹 绢|絺 𫄨|綁 绑|綃 绡|綄 𬘫|綆 绠|綈 绨|綉 绣|綌 绤|綎 𬘩|綏 绥|綐 䌼|綑 捆|經 经|綖 𫄧|綜 综|綝 𬘭|綞 缍|綠 绿|綡 𫟅|綢 绸|綣 绻|綧 𬘯|綪 𬘬|綫 线|綬 绶|維 维|綯 绹|綰 绾|綱 纲|網 网|綳 绷|綴 缀|綵 彩|綸 纶|綹 绺|綺 绮|綻 绽|綽 绰|綾 绫|綿 绵|緄 绲|緇 缁|緊 紧|緋 绯|緑 绿|緒 绪|緓 绬|緔 绱|緗 缃|緘 缄|緙 缂|線 线|緝 缉|緞 缎|締 缔|緡 缗|緣 缘|緦 缌|編 编|緩 缓|緬 缅|緯 纬|緱 缑|緲 缈|練 练|緶 缏|緹 缇|緻 致|緼 缊|縈 萦|縉 缙|縊 缢|縋 缒|縐 绉|縑 缣|縕 缊|縗 缞|縛 缚|縝 缜|縞 缟|縟 缛|縣 县|縧 绦|縫 缝|縭 缡|縮 缩|縯 𬙂|縱 纵|縲 缧|縳 䌸|縴 纤|縵 缦|縶 絷|縷 缕|縹 缥|總 总|績 绩|繃 绷|繅 缫|繆 缪|繒 缯|織 织|繕 缮|繚 缭|繞 绕|繡 绣|繢 缋|繩 绳|繪 绘|繫 系|繭 茧|繮 缰|繯 缳|繰 缲|繳 缴|繶 𫄷|繸 䍁|繹 绎|繻 𦈡|繼 继|繽 缤|繾 缱|繿 䍀|纁 𫄸|纆 𬙊|纇 颣|纈 缬|纊 纩|續 续|纍 累|纏 缠|纓 缨|纔 才|纕 𬙋|纖 纤|纘 缵|纜 缆|缽 钵|罃 䓨|罈 坛|罌 罂|罎 坛|罰 罚|罵 骂|罷 罢|羅 罗|羆 罴|羈 羁|羋 芈|羣 群|羥 羟|羨 羡|義 义|羶 膻|習 习|翫 玩|翬 翚|翹 翘|翽 翙|耬 耧|耮 耢|聖 圣|聞 闻|聯 联|聰 聪|聲 声|聳 耸|聵 聩|聶 聂|職 职|聹 聍|聽 听|聾 聋|肅 肃|脅 胁|脈 脉|脛 胫|脣 唇|脩 修|脫 脱|脹 胀|腎 肾|腖 胨|腡 脶|腦 脑|腫 肿|腳 脚|腸 肠|膃 腽|膕 腘|膚 肤|膞 䏝|膠 胶|膢 𦝼|膩 腻|膽 胆|膾 脍|膿 脓|臉 脸|臍 脐|臏 膑|臘 腊|臚 胪|臟 脏|臠 脔|臢 臜|臥 卧|臨 临|臺 台|與 与|興 兴|舉 举|舊 旧|舖 铺|舘 馆|艙 舱|艤 舣|艦 舰|艫 舻|艱 艰|艷 艳|芻 刍|苧 苎|茲 兹|荊 荆|莊 庄|莖 茎|莢 荚|莧 苋|華 华|菴 庵|菸 烟|萇 苌|萊 莱|萬 万|萴 荝|萵 莴|葉 叶|葒 荭|葤 荮|葦 苇|葯 药|葷 荤|蒍 𫇭|蒐 搜|蒓 莼|蒔 莳|蒕 蒀|蒞 莅|蒼 苍|蓀 荪|蓆 席|蓋 盖|蓮 莲|蓯 苁|蓴 莼|蓽 荜|蔄 𬜬|蔔 卜|蔘 参|蔞 蒌|蔣 蒋|蔥 葱|蔦 茑|蔭 荫|蔯 𫈟|蔿 𫇭|蕁 荨|蕆 蒇|蕎 荞|蕒 荬|蕓 芸|蕕 莸|蕘 荛|蕢 蒉|蕩 荡|蕪 芜|蕭 萧|蕷 蓣|薀 蕰|薈 荟|薊 蓟|薌 芗|薑 姜|薔 蔷|薘 荙|薟 莶|薦 荐|薩 萨|薳 䓕|薴 苧|薵 䓓|薹 苔|薺 荠|藍 蓝|藎 荩|藝 艺|藥 药|藪 薮|藭 䓖|藴 蕴|藶 苈|藹 蔼|藺 蔺|蘀 萚|蘄 蕲|蘆 芦|蘇 苏|蘊 蕴|蘋 苹|蘚 藓|蘞 蔹|蘟 𦻕|蘢 茏|蘭 兰|蘺 蓠|蘿 萝|虆 蔂|虉 𬟁|處 处|虛 虚|虜 虏|號 号|虧 亏|虯 虬|蛺 蛱|蛻 蜕|蜆 蚬|蝀 𬟽|蝕 蚀|蝟 猬|蝦 虾|蝨 虱|蝸 蜗|螄 蛳|螞 蚂|螢 萤|螮 䗖|螻 蝼|螿 螀|蟄 蛰|蟈 蝈|蟎 螨|蟣 虮|蟬 蝉|蟯 蛲|蟲 虫|蟳 𫊻|蟶 蛏|蟻 蚁|蠁 蚃|蠅 蝇|蠆 虿|蠍 蝎|蠐 蛴|蠑 蝾|蠔 蚝|蠟 蜡|蠣 蛎|蠨 蟏|蠱 蛊|蠶 蚕|蠻 蛮|衆 众|衊 蔑|術 术|衕 同|衚 胡|衛 卫|衝 冲|袞 衮|袷 夹|裊 袅|裏 里|補 补|裝 装|裡 里|製 制|複 复|褌 裈|褘 袆|褲 裤|褳 裢|褸 褛|褻 亵|襀 𫌀|襇 裥|襉 裥|襏 袯|襖 袄|襝 裣|襠 裆|襤 褴|襪 袜|襬 摆|襯 衬|襲 袭|襴 襕|覈 核|見 见|覎 觃|規 规|覓 觅|視 视|覘 觇|覡 觋|覥 觍|覦 觎|親 亲|覬 觊|覯 觏|覲 觐|覷 觑|覺 觉|覽 览|覿 觌|觀 观|觴 觞|觶 觯|觸 触|訁 讠|訂 订|訃 讣|計 计|訊 讯|訌 讧|討 讨|訏 𬣙|訐 讦|訒 讱|訓 训|訕 讪|訖 讫|託 托|記 记|訛 讹|訝 讶|訟 讼|訢 䜣|訣 诀|訥 讷|訩 讻|訪 访|設 设|許 许|訴 诉|訶 诃|診 诊|註 注|証 证|詀 𧮪|詁 诂|詆 诋|詎 讵|詐 诈|詒 诒|詔 诏|評 评|詖 诐|詗 诇|詘 诎|詛 诅|詝 𬣞|詞 词|詠 咏|詡 诩|詢 询|詣 诣|試 试|詩 诗|詪 𬣳|詫 诧|詬 诟|詭 诡|詮 诠|詰 诘|話 话|該 该|詳 详|詵 诜|詷 𫍣|詼 诙|詿 诖|誄 诔|誅 诛|誆 诓|誇 夸|誌 志|認 认|誑 诳|誒 诶|誕 诞|誘 诱|誚 诮|語 语|誠 诚|誡 诫|誣 诬|誤 误|誥 诰|誦 诵|誨 诲|說 说|説 说|誰 谁|課 课|誶 谇|誹 诽|誼 谊|誾 訚|調 调|諂 谄|諄 谆|談 谈|諉 诿|請 请|諍 诤|諏 诹|諑 诼|諒 谅|諓 𬣡|論 论|諗 谂|諛 谀|諜 谍|諝 谞|諞 谝|諟 𬤊|諡 谥|諢 诨|諤 谔|諦 谛|諧 谐|諫 谏|諭 谕|諮 咨|諱 讳|諲 𬤇|諳 谙|諴 𫍯|諶 谌|諷 讽|諸 诸|諺 谚|諼 谖|諾 诺|謀 谋|謁 谒|謂 谓|謄 誊|謅 诌|謊 谎|謎 谜|謏 𫍲|謐 谧|謔 谑|謖 谡|謗 谤|謙 谦|謚 谥|講 讲|謝 谢|謠 谣|謡 谣|謨 谟|謫 谪|謬 谬|謭 谫|謳 讴|謹 谨|謾 谩|譁 哗|證 证|譎 谲|譏 讥|譓 𬤝|譖 谮|識 识|譙 谯|譚 谭|譜 谱|譞 𫍽|譟 噪|譫 谵|譭 毁|譯 译|議 议|譴 谴|護 护|譸 诪|譽 誉|譾 谫|讀 读|讅 谉|變 变|讋 詟|讌 䜩|讎 雠|讒 谗|讓 让|讕 谰|讖 谶|讚 赞|讜 谠|讞 谳|谿 溪|豈 岂|豎 竖|豐 丰|豔 艳|豬 猪|豶 豮|貍 狸|貓 猫|貙 䝙|貝 贝|貞 贞|貟 贠|負 负|財 财|貢 贡|貧 贫|貨 货|販 贩|貪 贪|貫 贯|責 责|貯 贮|貰 贳|貲 赀|貳 贰|貴 贵|貶 贬|買 买|貸 贷|貺 贶|費 费|貼 贴|貽 贻|貿 贸|賀 贺|賁 贲|賂 赂|賃 赁|賄 贿|賅 赅|資 资|賈 贾|賊 贼|賑 赈|賒 赊|賓 宾|賕 赇|賙 赒|賚 赉|賜 赐|賞 赏|賠 赔|賡 赓|賢 贤|賣 卖|賤 贱|賦 赋|賧 赕|質 质|賫 赍|賬 账|賭 赌|賰 䞐|賴 赖|賵 赗|賺 赚|賻 赙|購 购|賽 赛|賾 赜|贄 贽|贅 赘|贇 赟|贈 赠|贊 赞|贋 赝|贍 赡|贏 赢|贐 赆|贓 赃|贔 赑|贖 赎|贗 赝|贛 赣|贜 赃|赬 赪|趕 赶|趙 赵|趨 趋|趲 趱|跡 迹|踐 践|踰 逾|踴 踊|蹌 跄|蹕 跸|蹟 迹|蹠 跖|蹣 蹒|蹤 踪|蹺 跷|躂 跶|躉 趸|躊 踌|躋 跻|躍 跃|躎 䟢|躑 踯|躒 跞|躓 踬|躕 蹰|躚 跹|躡 蹑|躥 蹿|躦 躜|躪 躏|軀 躯|車 车|軋 轧|軌 轨|軍 军|軏 𫐄|軑 轪|軒 轩|軔 轫|軛 轭|軝 𬨂|軟 软|軤 轷|軫 轸|軲 轱|軸 轴|軹 轵|軺 轺|軻 轲|軼 轶|軾 轼|較 较|輄 𨐈|輅 辂|輇 辁|輈 辀|載 载|輊 轾|輋 𪨶|輒 辄|輓 挽|輔 辅|輕 轻|輗 𫐐|輛 辆|輜 辎|輝 辉|輞 辋|輟 辍|輥 辊|輦 辇|輩 辈|輪 轮|輬 辌|輮 𫐓|輯 辑|輳 辏|輶 𬨎|輸 输|輻 辐|輼 辒|輾 辗|輿 舆|轀 辒|轂 毂|轄 辖|轅 辕|轆 辘|轉 转|轍 辙|轎 轿|轔 辚|轟 轰|轡 辔|轢 轹|轤 轳|辦 办|辭 辞|辮 辫|辯 辩|農 农|迴 回|逕 径|這 这|連 连|週 周|進 进|遊 游|運 运|過 过|達 达|違 违|遙 遥|遜 逊|遞 递|遠 远|遡 溯|適 适|遲 迟|遶 绕|遷 迁|選 选|遺 遗|遼 辽|邁 迈|還 还|邇 迩|邊 边|邏 逻|邐 逦|郟 郏|郵 邮|鄆 郓|鄉 乡|鄒 邹|鄔 邬|鄖 郧|鄧 邓|鄩 𬩽|鄭 郑|鄰 邻|鄲 郸|鄳 𫑡|鄴 邺|鄶 郐|鄺 邝|酇 酂|酈 郦|醃 腌|醖 酝|醜 丑|醞 酝|醟 蒏|醣 糖|醫 医|醬 酱|醱 酦|醲 𬪩|釀 酿|釁 衅|釃 酾|釅 酽|釋 释|釐 厘|釒 钅|釓 钆|釔 钇|釕 钌|釗 钊|釘 钉|釙 钋|針 针|釣 钓|釤 钐|釦 扣|釧 钏|釩 钒|釴 𬬩|釵 钗|釷 钍|釹 钕|釺 钎|釾 䥺|釿 𬬱|鈀 钯|鈁 钫|鈃 钘|鈄 钭|鈅 钥|鈇 𫓧|鈈 钚|鈉 钠|鈍 钝|鈎 钩|鈐 钤|鈑 钣|鈒 钑|鈔 钞|鈕 钮|鈞 钧|鈡 钟|鈣 钙|鈥 钬|鈦 钛|鈧 钪|鈮 铌|鈰 铈|鈳 钶|鈴 铃|鈷 钴|鈸 钹|鈹 铍|鈺 钰|鈽 钸|鈾 铀|鈿 钿|鉀 钾|鉅 巨|鉆 钻|鉈 铊|鉉 铉|鉊 𬬿|鉋 铇|鉍 铋|鉑 铂|鉕 钷|鉗 钳|鉚 铆|鉛 铅|鉝 𫟷|鉞 钺|鉢 钵|鉤 钩|鉥 𬬸|鉦 钲|鉧 𬭁|鉬 钼|鉭 钽|鉮 𬬹|鉳 锫|鉶 铏|鉷 𫟹|鉸 铰|鉺 铒|鉻 铬|鉿 铪|銀 银|銃 铳|銅 铜|銈 𫓯|銍 铚|銑 铣|銓 铨|銖 铢|銘 铭|銚 铫|銛 铦|銜 衔|銠 铑|銣 铷|銥 铱|銦 铟|銨 铵|銩 铥|銪 铕|銫 铯|銬 铐|銱 铞|銳 锐|銶 𨱇|銷 销|銹 锈|銻 锑|銼 锉|鋁 铝|鋃 锒|鋅 锌|鋇 钡|鋌 铤|鋏 铗|鋐 𬭎|鋒 锋|鋗 𫓶|鋙 铻|鋝 锊|鋟 锓|鋣 铘|鋤 锄|鋥 锃|鋦 锔|鋨 锇|鋩 铓|鋪 铺|鋭 锐|鋮 铖|鋯 锆|鋰 锂|鋱 铽|鋶 锍|鋸 锯|鋹 𬬮|鋼 钢|錀 𬬭|錁 锞|錄 录|錆 锖|錇 锫|錈 锩|錏 铔|錐 锥|錒 锕|錕 锟|錘 锤|錙 锱|錚 铮|錛 锛|錞 𬭚|錟 锬|錠 锭|錡 锜|錢 钱|錤 𫓹|錦 锦|錨 锚|錩 锠|錫 锡|錮 锢|錯 错|録 录|錳 锰|錶 表|錸 铼|錼 镎|鍀 锝|鍁 锨|鍃 锪|鍅 钫|鍆 钔|鍇 锴|鍈 锳|鍊 炼|鍋 锅|鍍 镀|鍔 锷|鍘 铡|鍚 钖|鍛 锻|鍠 锽|鍤 锸|鍥 锲|鍩 锘|鍬 锹|鍭 𬭤|鍰 锾|鍵 键|鍶 锶|鍺 锗|鍼 针|鍾 钟|鎂 镁|鎄 锿|鎇 镅|鎊 镑|鎌 镰|鎓 𬭩|鎔 镕|鎖 锁|鎘 镉|鎚 锤|鎛 镈|鎝 𨱏|鎡 镃|鎢 钨|鎣 蓥|鎦 镏|鎧 铠|鎩 铩|鎪 锼|鎬 镐|鎭 镇|鎮 镇|鎰 镒|鎲 镋|鎳 镍|鎵 镓|鎶 鿔|鎸 镌|鎿 镎|鏃 镞|鏇 旋|鏈 链|鏌 镆|鏍 镙|鏏 𬭬|鏐 镠|鏑 镝|鏗 铿|鏘 锵|鏜 镗|鏝 镘|鏞 镛|鏟 铲|鏡 镜|鏢 镖|鏤 镂|鏨 錾|鏰 镚|鏵 铧|鏷 镤|鏹 镪|鏺 䥽|鏻 𬭸|鏽 锈|鐃 铙|鐄 𨱑|鐇 𫔍|鐋 铴|鐍 𫔎|鐏 𨱔|鐐 镣|鐒 铹|鐓 镦|鐔 镡|鐘 钟|鐙 镫|鐝 镢|鐠 镨|鐥 䦅|鐦 锎|鐧 锏|鐨 镄|鐩 𬭼|鐫 镌|鐮 镰|鐯 䦃|鐲 镯|鐳 镭|鐵 铁|鐶 镮|鐸 铎|鐺 铛|鐽 𫟼|鐿 镱|鑄 铸|鑊 镬|鑌 镔|鑑 鉴|鑒 鉴|鑔 镲|鑕 锧|鑞 镴|鑠 铄|鑣 镳|鑥 镥|鑪 𬬻|鑭 镧|鑰 钥|鑱 镵|鑲 镶|鑷 镊|鑹 镩|鑼 锣|鑽 钻|鑾 銮|鑿 凿|钁 镢|钂 镋|長 长|門 门|閂 闩|閃 闪|閆 闫|閈 闬|閉 闭|開 开|閌 闶|閎 闳|閏 闰|閑 闲|閒 闲|間 间|閔 闵|閘 闸|閡 阂|閣 阁|閤 合|閥 阀|閨 闺|閩 闽|閫 阃|閬 阆|閭 闾|閱 阅|閲 阅|閶 阊|閹 阉|閻 阎|閼 阏|閽 阍|閾 阈|閿 阌|闃 阒|闆 板|闇 暗|闈 闱|闉 𬮱|闊 阔|闋 阕|闌 阑|闍 阇|闐 阗|闑 𫔶|闒 阘|闓 闿|闔 阖|闕 阙|闖 闯|關 关|闞 阚|闠 阓|闡 阐|闢 辟|闤 阛|闥 闼|陘 陉|陝 陕|陞 升|陣 阵|陰 阴|陳 陈|陸 陆|陽 阳|隉 陧|隊 队|階 阶|隑 𬮿|隕 陨|際 际|隤 𬯎|隨 随|險 险|隮 𬯀|隯 陦|隱 隐|隴 陇|隸 隶|隻 只|雋 隽|雖 虽|雙 双|雛 雏|雜 杂|雞 鸡|離 离|難 难|雲 云|電 电|霑 沾|霢 霡|霧 雾|霽 霁|靂 雳|靄 霭|靆 叇|靈 灵|靉 叆|靚 靓|靜 静|靝 靔|靦 腼|靨 靥|鞏 巩|鞝 绱|鞦 秋|鞽 鞒|韁 缰|韃 鞑|韆 千|韉 鞯|韋 韦|韌 韧|韍 韨|韓 韩|韙 韪|韜 韬|韝 鞲|韞 韫|韻 韵|響 响|頁 页|頂 顶|頃 顷|項 项|順 顺|頇 顸|須 须|頊 顼|頌 颂|頍 𫠆|頎 颀|頏 颃|預 预|頑 顽|頒 颁|頓 顿|頔 𬱖|頗 颇|領 领|頜 颌|頠 𬱟|頡 颉|頤 颐|頦 颏|頫 𫖯|頭 头|頮 颒|頰 颊|頲 颋|頴 颕|頵 𫖳|頷 颔|頸 颈|頹 颓|頻 频|頽 颓|顆 颗|題 题|額 额|顎 颚|顏 颜|顒 颙|顓 颛|顔 颜|顗 𫖮|願 愿|顙 颡|顛 颠|類 类|顢 颟|顥 颢|顧 顾|顫 颤|顬 颥|顯 显|顰 颦|顱 颅|顳 颞|顴 颧|風 风|颭 飐|颮 飑|颯 飒|颱 台|颳 刮|颶 飓|颸 飔|颺 飏|颻 飖|颼 飕|飀 飗|飄 飘|飆 飙|飈 飚|飛 飞|飠 饣|飢 饥|飣 饤|飥 饦|飩 饨|飪 饪|飫 饫|飭 饬|飯 饭|飱 飧|飲 饮|飴 饴|飼 饲|飽 饱|飾 饰|飿 饳|餃 饺|餄 饸|餅 饼|餈 糍|餉 饷|養 养|餌 饵|餎 饹|餏 饻|餑 饽|餒 馁|餓 饿|餕 馂|餖 饾|餗 𫗧|餘 余|餚 肴|餛 馄|餜 馃|餞 饯|餡 馅|館 馆|餬 糊|餱 糇|餳 饧|餵 喂|餶 馉|餷 馇|餸 𩠌|餺 馎|餼 饩|餾 馏|餿 馊|饁 馌|饃 馍|饅 馒|饈 馐|饉 馑|饊 馓|饋 馈|饌 馔|饑 饥|饒 饶|饗 飨|饘 𫗴|饜 餍|饞 馋|饢 馕|馬 马|馭 驭|馮 冯|馱 驮|馳 驰|馴 驯|馹 驲|馼 𫘜|駁 驳|駃 𫘝|駉 𬳶|駐 驻|駑 驽|駒 驹|駓 𬳵|駔 驵|駕 驾|駘 骀|駙 驸|駛 驶|駝 驼|駟 驷|駡 骂|駢 骈|駪 𬳽|駭 骇|駰 骃|駱 骆|駸 骎|駼 𬳿|駿 骏|騁 骋|騂 骍|騄 𫘧|騅 骓|騊 𫘦|騌 骔|騍 骒|騎 骑|騏 骐|騑 𬴂|騖 骛|騙 骗|騞 𬴃|騠 𫘨|騤 骙|騧 䯄|騫 骞|騭 骘|騮 骝|騰 腾|騱 𫘬|騵 𫘪|騶 驺|騷 骚|騸 骟|騾 骡|驀 蓦|驁 骜|驂 骖|驃 骠|驄 骢|驅 驱|驊 骅|驌 骕|驍 骁|驎 𬴊|驏 骣|驕 骄|驗 验|驚 惊|驛 驿|驟 骤|驢 驴|驤 骧|驥 骥|驦 骦|驪 骊|驫 骉|骯 肮|髏 髅|髒 脏|體 体|髕 髌|髖 髋|髮 发|鬆 松|鬍 胡|鬚 须|鬢 鬓|鬥 斗|鬧 闹|鬨 哄|鬩 阋|鬮 阄|鬱 郁|鬹 鬶|魎 魉|魘 魇|魚 鱼|魛 鱽|魟 𫚉|魢 鱾|魨 鲀|魯 鲁|魴 鲂|魷 鱿|魺 鲄|鮀 𬶍|鮁 鲅|鮃 鲆|鮆 𫚖|鮈 𬶋|鮊 鲌|鮋 鲉|鮍 鲏|鮎 鲇|鮐 鲐|鮑 鲍|鮒 鲋|鮓 鲊|鮚 鲒|鮜 鲘|鮝 鲞|鮞 鲕|鮟 𩽾|鮠 𬶏|鮡 𬶐|鮣 䲟|鮦 鲖|鮪 鲔|鮫 鲛|鮭 鲑|鮮 鲜|鮳 鲓|鮶 鲪|鮸 𩾃|鮺 鲝|鯀 鲧|鯁 鲠|鯇 鲩|鯉 鲤|鯊 鲨|鯒 鲬|鯔 鲻|鯕 鲯|鯖 鲭|鯗 鲞|鯛 鲷|鯝 鲴|鯡 鲱|鯢 鲵|鯤 鲲|鯧 鲳|鯨 鲸|鯪 鲮|鯫 鲰|鯰 鲶|鯴 鲺|鯷 鳀|鯻 𬶟|鯽 鲫|鯿 鳊|鰁 鳈|鰂 鲗|鰃 鳂|鰆 䲠|鰈 鲽|鰉 鳇|鰊 𬶠|鰌 䲡|鰍 鳅|鰏 鲾|鰐 鳄|鰒 鳆|鰓 鳃|鰛 鳁|鰜 鳒|鰟 鳑|鰠 鳋|鰣 鲥|鰤 𫚕|鰥 鳏|鰧 䲢|鰨 鳎|鰩 鳐|鰭 鳍|鰮 鳁|鰱 鲢|鰲 鳌|鰳 鳓|鰵 鳘|鰶 𬶭|鰷 鲦|鰹 鲣|鰺 鲹|鰻 鳗|鰼 鳛|鰾 鳔|鱀 𬶨|鱂 鳉|鱅 鳙|鱇 𩾌|鱈 鳕|鱉 鳖|鱒 鳟|鱔 鳝|鱖 鳜|鱗 鳞|鱘 鲟|鱚 𬶮|鱝 鲼|鱟 鲎|鱠 鲙|鱣 鳣|鱤 鳡|鱧 鳢|鱨 鲿|鱭 鲚|鱯 鳠|鱲 𫚭|鱷 鳄|鱸 鲈|鱺 鲡|鳥 鸟|鳧 凫|鳩 鸠|鳬 凫|鳲 鸤|鳳 凤|鳴 鸣|鳶 鸢|鳾 䴓|鴆 鸩|鴇 鸨|鴉 鸦|鴒 鸰|鴕 鸵|鴛 鸳|鴝 鸲|鴞 鸮|鴟 鸱|鴣 鸪|鴦 鸯|鴨 鸭|鴯 鸸|鴰 鸹|鴴 鸻|鴷 䴕|鴻 鸿|鴿 鸽|鵁 䴔|鵂 鸺|鵃 鸼|鵏 𬷕|鵐 鹀|鵑 鹃|鵒 鹆|鵓 鹁|鵜 鹈|鵝 鹅|鵟 𫛭|鵠 鹄|鵡 鹉|鵪 鹌|鵬 鹏|鵮 鹐|鵯 鹎|鵰 雕|鵲 鹊|鵷 鹓|鵾 鹍|鶄 䴖|鶇 鸫|鶉 鹑|鶊 鹒|鶓 鹋|鶖 鹙|鶘 鹕|鶚 鹗|鶠 𬸘|鶡 鹖|鶥 鹛|鶩 鹜|鶪 䴗|鶬 鸧|鶯 莺|鶱 𬸣|鶲 鹟|鶴 鹤|鶹 鹠|鶺 鹡|鶻 鹘|鶼 鹣|鶿 鹚|鷀 鹚|鷁 鹢|鷂 鹞|鷄 鸡|鷉 䴘|鷊 鹝|鷓 鹧|鷖 鹥|鷗 鸥|鷙 鸷|鷚 鹨|鷟 𬸦|鷥 鸶|鷦 鹪|鷫 鹔|鷭 𬸪|鷯 鹩|鷲 鹫|鷳 鹇|鷴 鹇|鷸 鹬|鷹 鹰|鷺 鹭|鷽 鸴|鸂 㶉|鸇 鹯|鸊 䴙|鸌 鹱|鸏 鹲|鸑 𬸚|鸕 鸬|鸘 鹴|鸚 鹦|鸛 鹳|鸝 鹂|鸞 鸾|鹵 卤|鹹 咸|鹺 鹾|鹼 碱|鹽 盐|麗 丽|麥 麦|麩 麸|麪 面|麫 面|麬 𤿲|麯 曲|麳 𪎌|麴 曲|麵 面|麼 么|麽 么|黃 黄|黌 黉|點 点|黨 党|黲 黪|黴 霉|黶 黡|黷 黩|黽 黾|黿 鼋|鼂 鼌|鼉 鼍|鼕 冬|鼴 鼹|齊 齐|齋 斋|齎 赍|齏 齑|齒 齿|齔 龀|齕 龁|齗 龂|齘 𬹼|齙 龅|齜 龇|齟 龃|齠 龆|齡 龄|齣 出|齦 龈|齧 啮|齪 龊|齬 龉|齮 𬺈|齯 𫠜|齲 龋|齶 腭|齷 龌|齼 𬺓|龍 龙|龎 厐|龐 庞|龑 䶮|龔 龚|龕 龛|龜 龟|鿁 䜤|鿓 鿒|𠁞 𠀾|𠌥 𠌥|𠏢 𠏢|𠐊 𠐊|𠗣 㓆|𠞆 𠞆|𠠎 𠠎|𠬙 𠬙|𠼤 𠼤|𠽃 𠽃|𠿕 𠿕|𡂡 𡂡|𡃄 𡃄|𡃕 𠴛|𡃤 𡃤|𡄔 𡄔|𡄣 𡄣|𡅏 𠲥|𡅯 𡅯|𡑍 𫭼|𡑭 𡋗|𡓁 𡓁|𡓾 𡋀|𡔖 𡍣|𡞵 㛟|𡟫 𡟫|𡠹 㛿|𡢃 㛠|𡮉 𡭜|𡮣 𡭬|𡳳 𡳃|𡸗 𡸗|𡹬 𡹬|𡻕 岁|𡽗 𡽗|𡾱 㟜|𡿖 𡿖|𢍰 𢍰|𢠼 𢠼|𢣐 𢣐|𢣚 𢘝|𢣭 𢣭|𢤩 𢤩|𢤱 𢤱|𢤿 𢤿|𢯷 𢯷|𢶒 𢶒|𢶫 𢫞|𢷮 𢷮|𢹿 𢬦|𢺳 𢺳|𣈶 暅|𣋋 𣋋|𣍐 𣍐|𣙎 㭣|𣜬 𣜬|𣝕 𣝕|𣞻 𣘓|𣠩 𣞎|𣠲 𣑶|𣯩 𣯩|𣯴 𣯴|𣯶 毶|𣽏 𣽏|𣾷 㳢|𣿉 𣿉|𤁣 𣺽|𤄷 𤄷|𤅶 𣷷|𤑳 𤑳|𤑹 𤑹|𤒎 𤒎|𤒻 𤒻|𤓌 𤓌|𤓎 𤓎|𤓩 𤊰|𤘀 𤘀|𤛮 𤛮|𤛱 𤛱|𤜆 𤜆|𤠮 𤠮|𤢟 𤢟|𤢻 𤢻|𤩂 𤩂|𤪺 㻘|𤫩 㻏|𤬅 𤬅|𤳷 𤳷|𤳸 𤳄|𤷃 𤷃|𤸫 𤸫|𤺔 𤺔|𥊝 𥅿|𥌃 𥅘|𥏝 𥏝|𥕥 𥐰|𥖅 𥐯|𥖲 𥖲|𥗇 𥗇|𥗽 𬒗|𥜐 𥜐|𥜰 𥜰|𥞵 𥞵|𥢢 䅪|𥢶 𥢶|𥢷 𥢷|𥨐 𥨐|𥪂 𥪂|𥯤 𥯤|𥴨 𥴨|𥴼 𥴼|𥵃 𥵃|𥵊 𥵊|𥶽 𥶽|𥸠 𥮋|𥻦 𥻦|𥼽 𥹥|𥽖 𥽖|𥾯 𥾯|𥿊 𥿊|𦀖 𦀖|𦂅 𦂅|𦃄 𦃄|𦃩 𦃩|𦅇 𦅇|𦅈 𦅈|𦆲 𦆲|𦒀 𦒀|𦔖 𦔖|𦘧 𡳒|𦟼 𦟼|𦠅 𦠅|𦡝 𦡝|𦢈 𦢈|𦣎 𦟗|𦧺 𦧺|𦪙 䑽|𦪽 𦪽|𦱌 𦱌|𦾟 𦾟|𧎈 𧎈|𧒯 𧒯|𧔥 𧔥|𧕟 𧕟|𧜗 䘞|𧜵 䙊|𧝞 䘛|𧞫 𧞫|𧟀 𧝧|𧡴 𧡴|𧢄 𧢄|𧦝 𧦝|𧦧 𧦧|𧩕 𧩕|𧩙 䜥|𧩼 𧩼|𧫝 𧫝|𧬤 𧬤|𧭈 𧭈|𧭹 𧭹|𧳟 𧳟|𧵳 䞌|𧶔 𧶔|𧶧 䞎|𧷎 𧷎|𧸘 𧸘|𧹈 𧹈|𧽯 𧽯|𨂐 𨂐|𨄣 𨄣|𨅍 𨅍|𨆪 𨆪|𨇁 𨇁|𨇞 𨇞|𨇤 𨇤|𨇰 𨇰|𨇽 𨇽|𨈊 𨈊|𨈌 𨈌|𨊰 䢀|𨊸 䢁|𨊻 𨊻|𨋢 䢂|𨌈 𨌈|𨍰 𨍰|𨎌 𨎌|𨎮 𨎮|𨏠 𨏠|𨏥 𨏥|𨞺 𨞺|𨟊 𨟊|𨢿 𨢿|𨣈 𨣈|𨣞 𨣞|𨣧 𨣧|𨤻 𨤰|𨥛 𨥛|𨥟 𨥟|𨦫 䦀|𨧀 𬭊|𨧜 䦁|𨧰 𨧰|𨧱 𨧱|𨨏 𬭛|𨨛 𨨛|𨨢 𨨢|𨩰 𨩰|𨪕 𨪕|𨫒 𨫒|𨬖 𨬖|𨭆 𬭶|𨭎 𬭳|𨭖 𨭖|𨭸 𨭸|𨮂 𨮂|𨮳 𨮳|𨯅 䥿|𨯟 𨯟|𨰃 𨰃|𨰋 𨰋|𨰥 𨰥|𨰲 𨰲|𨲳 𨲳|𨳑 𨳑|𨳕 𨳕|𨴗 𨴗|𨴹 𨴹|𨵩 𨵩|𨵸 𨵸|𨶀 𨶀|𨶏 𨶏|𨶮 𨶮|𨶲 𨶲|𨷲 𨷲|𨼳 𨼳|𨽏 𨽏|𩀨 𩀨|𩅙 𩅙|𩎖 𩎖|𩎢 𩎢|𩏂 𩏂|𩏠 𩏠|𩏪 𩏪|𩏷 𩏷|𩑔 𩑔|𩒎 𩒎|𩓣 𩓣|𩓥 𩓥|𩔑 𩔑|𩔳 𩔳|𩖰 𩖰|𩗀 𩗀|𩗓 𩗓|𩗴 𩗴|𩘀 𩘀|𩘝 𩘝|𩘹 𩘹|𩘺 𩘺|𩙈 𩙈|𩚛 𩚛|𩚥 𩚥|𩚩 𩚩|𩚵 𩚵|𩛆 𩛆|𩛌 𩛌|𩛡 𩛡|𩛩 𩛩|𩜇 𩜇|𩜦 𩜦|𩜵 𩜵|𩝔 𩝔|𩝽 𩝽|𩞄 𩞄|𩞦 𩞦|𩞯 䭪|𩟐 𩟐|𩟗 𩟗|𩠴 𩠠|𩡣 𩡣|𩡺 𩡺|𩢡 𩢡|𩢴 𩢴|𩢸 𩢸|𩢾 𩢾|𩣏 𩣏|𩣑 䯃|𩣫 𩣫|𩣵 𩣵|𩣺 𩣺|𩤊 𩤊|𩤙 𩤙|𩤲 𩤲|𩤸 𩤸|𩥄 𩥄|𩥇 𩥇|𩥉 𩥉|𩥑 𩥑|𩦠 𩦠|𩧆 𩧆|𩭙 𩭙|𩯁 𩯁|𩯳 𩯳|𩰀 𩰀|𩰹 𩰹|𩳤 𩳤|𩴵 𩴵|𩵦 𩵦|𩵩 𩵩|𩵹 𩵹|𩶁 𩶁|𩶘 䲞|𩶰 𩶰|𩶱 𩶱|𩷰 𩷰|𩸃 𩸃|𩸄 𩸄|𩸡 𩸡|𩸦 𩸦|𩻗 𩻗|𩻬 𩻬|𩻮 𩻮|𩼶 𩼶|𩽇 𩽇|𩿅 𩿅|𩿤 𩿤|𩿪 𩿪|𪀖 𪀖|𪀦 𪀦|𪀾 𪀾|𪁈 𪁈|𪁖 𪁖|𪂆 𪂆|𪃍 𪃍|𪃏 𪃏|𪃒 𪃒|𪃧 𪃧|𪄆 𪄆|𪄕 𪄕|𪅂 𪅂|𪆷 𪆷|𪇳 𪇳|𪈼 𪈼|𪉸 𪉸|𪋿 𪋿|𪌭 𪌭|𪍠 𪍠|𪓰 𪓰|𪔵 𪔵|𪘀 𪘀|𪘯 𪘯|𪙏 𪙏|𪟖 𪟖|𪷓 𪷓|𫒡 𫒡|𫜦 𫜦|𰻞 𰻝"]];
	var simplifiedConverter = null;
	var japaneseVariantMap = {
		亜: "亚",
		仏: "佛",
		仮: "假",
		価: "价",
		児: "儿",
		円: "圆",
		剣: "剑",
		剤: "剂",
		労: "劳",
		単: "单",
		囲: "围",
		団: "团",
		図: "图",
		圧: "压",
		壊: "坏",
		実: "实",
		対: "对",
		専: "专",
		峡: "峡",
		巣: "巢",
		帯: "带",
		広: "广",
		弾: "弹",
		徳: "德",
		悪: "恶",
		応: "应",
		抜: "拔",
		拡: "扩",
		揺: "摇",
		桜: "樱",
		様: "样",
		権: "权",
		欧: "欧",
		歓: "欢",
		歩: "步",
		歳: "岁",
		殻: "壳",
		気: "气",
		沢: "泽",
		涙: "泪",
		渋: "涩",
		浜: "滨",
		満: "满",
		滝: "泷",
		焼: "烧",
		獣: "兽",
		発: "发",
		県: "县",
		絵: "绘",
		絶: "绝",
		継: "继",
		続: "续",
		緑: "绿",
		縄: "绳",
		総: "总",
		芸: "艺",
		薬: "药",
		蛍: "萤",
		説: "说",
		読: "读",
		転: "转",
		鉄: "铁",
		黒: "黑",
		竜: "龙"
	};
	var japaneseVariantPattern = new RegExp(`[${Object.keys(japaneseVariantMap).join("")}]`, "g");
	var protectedZhuWords = [
		"著作",
		"著名",
		"著称",
		"著書",
		"著书",
		"著述",
		"著錄",
		"著录",
		"著者",
		"著於",
		"著于",
		"著有",
		"著成",
		"著文",
		"名著",
		"原著",
		"巨著",
		"專著",
		"专著",
		"編著",
		"编著",
		"譯著",
		"译著",
		"合著",
		"拙著",
		"新著",
		"舊著",
		"旧著",
		"遺著",
		"遗著",
		"土著",
		"顯著",
		"显著",
		"卓著",
		"昭著",
		"較著",
		"较著",
		"見微知著",
		"见微知著",
		"臭名昭著",
		"彰明較著",
		"彰明较著"
	];
	function getSimplifiedConverter() {
		simplifiedConverter ??= ConverterFactory([CJK_Compatibility_Ideographs_default], ...cn_default);
		return simplifiedConverter;
	}
	function normalizeJapaneseVariantsForSimplified(text) {
		return text.replace(japaneseVariantPattern, (char) => japaneseVariantMap[char] || char);
	}
	function normalizeZheForSimplified(text) {
		if (!text.includes("著")) return text;
		const placeholders = [];
		let converted = text;
		for (const word of protectedZhuWords) {
			if (!converted.includes(word)) continue;
			const token = `\uE000${placeholders.length}\uE001`;
			placeholders.push(word);
			converted = converted.split(word).join(token);
		}
		converted = converted.replace(/著/g, "着");
		return converted.replace(/\uE000(\d+)\uE001/g, (_, index) => placeholders[Number(index)]);
	}
	function getConverter(mode) {
		if (mode === "sc") {
			const converter = getSimplifiedConverter();
			return (text) => normalizeZheForSimplified(normalizeJapaneseVariantsForSimplified(converter(text)));
		}
		return r;
	}
	function shouldSkipConversion(mode, options) {
		const sourceScript = options.sourceScript || "unknown";
		return mode === "sc" ? sourceScript === "hans" : sourceScript === "hant";
	}
	async function convertText(text, mode, options = {}) {
		if (mode === "none" || !text) return text;
		if (shouldSkipConversion(mode, options)) return text;
		try {
			return getConverter(mode)(text);
		} catch (error) {
			console.error("[ChineseConverter] Text conversion error:", error);
			return text;
		}
	}
	async function convertHTML(html, mode, options = {}) {
		if (mode === "none" || !html) return html;
		if (shouldSkipConversion(mode, options)) return html;
		try {
			const converter = getConverter(mode);
			const template = document.createElement("template");
			template.innerHTML = html;
			const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, null);
			const textNodes = [];
			let node;
			while (node = walker.nextNode()) textNodes.push(node);
			for (const textNode of textNodes) if (textNode.textContent) textNode.textContent = converter(textNode.textContent);
			return template.innerHTML;
		} catch (error) {
			console.error("[ChineseConverter] HTML conversion error:", error);
			return html;
		}
	}
	async function applyConversionToChapterEntry(chapters, originalContents, originalTitles, entryId, mode, isCurrent = () => true) {
		const entry = chapters.find((e) => e.id === entryId);
		if (!entry) return;
		const originalContent = originalContents.get(entryId);
		const originalTitle = originalTitles.get(entryId);
		const updates = {};
		const conversionOptions = { sourceScript: entry.chapter.sourceScript };
		if (mode === "none") {
			if (originalContent && entry.chapter.content !== originalContent) updates.content = originalContent;
			if (originalTitle) {
				updates.title = originalTitle.title;
				updates.bookTitle = originalTitle.bookTitle;
			}
		} else {
			if (originalContent) updates.content = await convertHTML(originalContent, mode, conversionOptions);
			if (originalTitle) {
				updates.title = await convertText(originalTitle.title, mode, conversionOptions);
				updates.bookTitle = originalTitle.bookTitle ? await convertText(originalTitle.bookTitle, mode, conversionOptions) : originalTitle.bookTitle;
			}
		}
		if (isCurrent() && originalContents.get(entryId) === originalContent && originalTitles.get(entryId) === originalTitle && Object.keys(updates).length > 0) entry.chapter = {
			...entry.chapter,
			...updates
		};
	}
	async function applyTocConversion(tocOriginal, mode, sourceScript) {
		if (tocOriginal.length === 0) return [];
		if (mode === "none") return [...tocOriginal];
		return Promise.all(tocOriginal.map(async (entry) => ({
			...entry,
			title: await convertText(entry.title, mode, { sourceScript })
		})));
	}
	var CACHE_V2_INDEX_PREFIX = "mnr_cache_v2_index_";
	var CACHE_V2_CHAPTER_PREFIX = "mnr_cache_v2_chapter_";
	var DAY_MS = 864e5;
	var PERSISTED_CACHE_MAX_AGE_MS = 30 * DAY_MS;
	var PERSISTED_CACHE_GC_INTERVAL_MS = DAY_MS;
	var PERSISTED_CACHE_TOUCH_INTERVAL_MS = DAY_MS;
	var PERSISTED_CACHE_GC_IDLE_TIMEOUT_MS = 2e3;
	var PERSISTED_CACHE_GC_SLICE_BUDGET_MS = 6;
	var PERSISTED_CACHE_GC_SLICE_STEPS = 128;
	var PERSISTED_CACHE_GC_LAST_RUN_KEY = "mnr_cache_v2_gc_last_run";
	var scheduledCacheCleanup = null;
	function generateBookId(indexUrl) {
		try {
			const url = new URL(indexUrl);
			const pathId = url.hostname + url.pathname.replace(/\//g, "_");
			return url.search ? `${pathId}~q~${encodeBase64UrlUtf8(url.search)}` : pathId;
		} catch {
			return btoa(indexUrl).slice(0, 32);
		}
	}
	function encodeBase64UrlUtf8(value) {
		const bytes = new TextEncoder().encode(value);
		let binary = "";
		for (const b of bytes) binary += String.fromCharCode(b);
		return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
	}
	function decodeBase64UrlUtf8(value) {
		try {
			const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
			const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
			let hasNonAsciiByte = false;
			for (let index = 0; index < binary.length; index += 1) if (binary.charCodeAt(index) > 127) {
				hasNonAsciiByte = true;
				break;
			}
			if (!hasNonAsciiByte) return binary;
			const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		} catch {
			return null;
		}
	}
	function parseStoredJson(stored) {
		if (stored === null || stored === void 0) return null;
		if (typeof stored === "string") try {
			return JSON.parse(stored);
		} catch {
			return null;
		}
		if (typeof stored === "object") return stored;
		return null;
	}
	function getCacheV2IndexKey(bookId) {
		return `${CACHE_V2_INDEX_PREFIX}${bookId}`;
	}
	function getCacheV2ChapterKey(bookId, url) {
		return `${CACHE_V2_CHAPTER_PREFIX}${bookId}_${encodeBase64UrlUtf8(url)}`;
	}
	function normalizeTimestamp(value) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	}
	function getIndexAccessTime(index) {
		return normalizeTimestamp(index.lastAccessed) ?? normalizeTimestamp(index.lastUpdated);
	}
	function isPersistedCacheIndex(data) {
		return data?.version === 2 && Array.isArray(data.urls);
	}
	function getCacheV2ChapterBookPrefix(bookId) {
		return `${CACHE_V2_CHAPTER_PREFIX}${bookId}_`;
	}
	function isProtectedChapterKey(key, protectedBookIds) {
		for (const bookId of protectedBookIds) if (key.startsWith(getCacheV2ChapterBookPrefix(bookId))) return true;
		return false;
	}
	function getMonotonicTime() {
		return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
	}
	function scheduleCacheCleanupSlice(callback) {
		if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
			window.requestIdleCallback((deadline) => callback(deadline), { timeout: PERSISTED_CACHE_GC_IDLE_TIMEOUT_MS });
			return;
		}
		setTimeout(() => callback(null), 0);
	}
	function getCurrentBookCacheKey(indexUrl) {
		if (!indexUrl) return null;
		return {
			bookId: generateBookId(indexUrl),
			indexUrl
		};
	}
	function persistCachedChapter(cacheBook, url, cached) {
		if (typeof GM_setValue === "undefined") return false;
		try {
			GM_setValue(getCacheV2ChapterKey(cacheBook.bookId, url), JSON.stringify(cached));
			return true;
		} catch (e) {
			console.error("[MNR] Failed to persist cached chapter:", e);
			return false;
		}
	}
	function getPersistedCachedChapter(cacheBook, url) {
		if (typeof GM_getValue === "undefined") return null;
		try {
			const cachedV2 = parseStoredJson(GM_getValue(getCacheV2ChapterKey(cacheBook.bookId, url), null));
			if (cachedV2?.chapter?.url) return cachedV2;
		} catch (e) {
			console.error("[MNR] Failed to load persisted chapter:", e);
		}
		return null;
	}
	function persistCache(cacheBook, cachedContents, persistedUrls, skipChapterUrls = new Set()) {
		if (typeof GM_setValue === "undefined") return persistedUrls;
		const persistedSet = new Set(persistedUrls);
		for (const [url, cached] of cachedContents) {
			if (persistedSet.has(url) && skipChapterUrls.has(url)) continue;
			if (persistCachedChapter(cacheBook, url, cached)) persistedSet.add(url);
		}
		if (persistedSet.size === 0) return persistedSet;
		persistCacheIndex(cacheBook, persistedSet);
		return persistedSet;
	}
	function persistCacheIndex(cacheBook, persistedUrls, now = Date.now()) {
		if (typeof GM_setValue === "undefined" || persistedUrls.size === 0) return false;
		const indexData = {
			version: 2,
			bookId: cacheBook.bookId,
			indexUrl: cacheBook.indexUrl,
			urls: Array.from(persistedUrls),
			lastUpdated: now,
			lastAccessed: now
		};
		try {
			GM_setValue(getCacheV2IndexKey(cacheBook.bookId), JSON.stringify(indexData));
			return true;
		} catch (e) {
			console.error("[MNR] Failed to persist cache index:", e);
			return false;
		}
	}
	function deletePersistedCacheIndex(cacheBook) {
		if (typeof GM_deleteValue === "undefined") return false;
		try {
			GM_deleteValue(getCacheV2IndexKey(cacheBook.bookId));
			return true;
		} catch (e) {
			console.error("[MNR] Failed to delete cache index:", e);
			return false;
		}
	}
	function restoreCache(cacheBook) {
		if (typeof GM_getValue === "undefined") return null;
		try {
			const dataV2 = parseStoredJson(GM_getValue(getCacheV2IndexKey(cacheBook.bookId), null));
			if (dataV2?.version === 2 && Array.isArray(dataV2.urls)) return new Set(dataV2.urls);
		} catch (e) {
			console.error("[MNR] Failed to restore cache:", e);
		}
		return null;
	}
	function touchPersistedCache(cacheBook, now = Date.now(), touchIntervalMs = PERSISTED_CACHE_TOUCH_INTERVAL_MS) {
		if (typeof GM_getValue === "undefined" || typeof GM_setValue === "undefined") return false;
		try {
			const indexKey = getCacheV2IndexKey(cacheBook.bookId);
			const data = parseStoredJson(GM_getValue(indexKey, null));
			if (data?.version !== 2 || !Array.isArray(data.urls)) return false;
			const lastAccessed = getIndexAccessTime(data);
			if (lastAccessed !== null && now - lastAccessed < touchIntervalMs) return false;
			GM_setValue(indexKey, JSON.stringify({
				...data,
				lastAccessed: now
			}));
			return true;
		} catch (e) {
			console.error("[MNR] Failed to touch cache index:", e);
			return false;
		}
	}
	function shouldKeepOrphanedChapter(cached, now, protectedBookIds, indexStates) {
		const indexUrl = cached.chapter?.indexUrl;
		const chapterUrl = cached.chapter?.url;
		if (typeof indexUrl !== "string" || typeof chapterUrl !== "string") return false;
		const cacheBook = getCurrentBookCacheKey(indexUrl);
		if (!cacheBook) return false;
		if (protectedBookIds.has(cacheBook.bookId)) return true;
		let state = indexStates.get(cacheBook.bookId);
		if (!state) {
			const index = parseStoredJson(GM_getValue(getCacheV2IndexKey(cacheBook.bookId), null));
			const lastAccessed = isPersistedCacheIndex(index) ? getIndexAccessTime(index) : null;
			state = {
				recentlyAccessed: lastAccessed !== null && now - lastAccessed <= PERSISTED_CACHE_TOUCH_INTERVAL_MS,
				urls: isPersistedCacheIndex(index) ? index.urls : []
			};
			indexStates.set(cacheBook.bookId, state);
		}
		return state.recentlyAccessed || state.urls.includes(chapterUrl);
	}
	function cleanupOrphanedChapter(key, now, maxAgeMs, protectedBookIds, indexStates) {
		if (isProtectedChapterKey(key, protectedBookIds)) return;
		const cached = parseStoredJson(GM_getValue(key, null));
		if (cached?.chapter?.url) {
			const cachedAt = normalizeTimestamp(cached.cachedAt);
			if (cachedAt !== null && now - cachedAt <= maxAgeMs) return;
			if (shouldKeepOrphanedChapter(cached, now, protectedBookIds, indexStates)) return;
		}
		GM_deleteValue(key);
	}
	function* createPersistedCacheCleanupSteps(now, maxAgeMs, protectedBookIds) {
		const storageKeys = GM_listValues();
		const chapterKeys = [];
		const activeIndexes = [];
		const expiredIndexes = [];
		const invalidIndexes = [];
		for (const key of storageKeys) {
			if (key.startsWith(CACHE_V2_CHAPTER_PREFIX)) {
				chapterKeys.push(key);
				yield;
				continue;
			}
			if (!key.startsWith(CACHE_V2_INDEX_PREFIX)) {
				yield;
				continue;
			}
			const bookId = key.slice(19);
			const data = parseStoredJson(GM_getValue(key, null));
			if (!bookId || !isPersistedCacheIndex(data)) {
				invalidIndexes.push({
					key,
					bookId
				});
				yield;
				continue;
			}
			const record = {
				key,
				bookId,
				data
			};
			const lastAccessed = getIndexAccessTime(data);
			if (!protectedBookIds.has(bookId) && lastAccessed !== null && now - lastAccessed > maxAgeMs) expiredIndexes.push(record);
			else activeIndexes.push(record);
			yield;
		}
		const indexGroups = [...activeIndexes, ...expiredIndexes].map((record) => ({
			...record,
			chapterKeys: [],
			chapterPrefix: getCacheV2ChapterBookPrefix(record.bookId)
		}));
		const indexGroupsByPrefixLength = new Map();
		for (const group of indexGroups) {
			let groupsAtLength = indexGroupsByPrefixLength.get(group.chapterPrefix.length);
			if (!groupsAtLength) {
				groupsAtLength = new Map();
				indexGroupsByPrefixLength.set(group.chapterPrefix.length, groupsAtLength);
			}
			groupsAtLength.set(group.chapterPrefix, group);
		}
		const indexPrefixLengths = Array.from(indexGroupsByPrefixLength.keys()).sort((a, b) => b - a);
		const unindexedChapterKeys = [];
		for (const key of chapterKeys) {
			let group;
			for (const prefixLength of indexPrefixLengths) {
				if (prefixLength > key.length) continue;
				group = indexGroupsByPrefixLength.get(prefixLength)?.get(key.slice(0, prefixLength));
				if (group) break;
			}
			if (group) group.chapterKeys.push(key);
			else unindexedChapterKeys.push(key);
			yield;
		}
		const expiredIndexKeys = new Set(expiredIndexes.map((record) => record.key));
		const activeIndexGroups = [];
		for (const group of indexGroups) {
			if (!expiredIndexKeys.has(group.key)) {
				activeIndexGroups.push(group);
				yield;
				continue;
			}
			if (protectedBookIds.has(group.bookId)) {
				activeIndexGroups.push(group);
				yield;
				continue;
			}
			const current = parseStoredJson(GM_getValue(group.key, null));
			if (!isPersistedCacheIndex(current)) {
				invalidIndexes.push({
					key: group.key,
					bookId: group.bookId
				});
				for (const key of group.chapterKeys) {
					unindexedChapterKeys.push(key);
					yield;
				}
				continue;
			}
			const lastAccessed = getIndexAccessTime(current);
			if (protectedBookIds.has(group.bookId) || lastAccessed === null || now - lastAccessed <= maxAgeMs) {
				activeIndexGroups.push({
					...group,
					data: current
				});
				yield;
				continue;
			}
			const indexedUrls = new Set();
			for (const url of current.urls) {
				if (typeof url === "string") indexedUrls.add(url);
				yield;
			}
			let deletionAborted = false;
			for (const key of group.chapterKeys) {
				if (protectedBookIds.has(group.bookId)) {
					deletionAborted = true;
					break;
				}
				const chapterUrl = decodeBase64UrlUtf8(key.slice(group.chapterPrefix.length));
				if (chapterUrl !== null && indexedUrls.has(chapterUrl)) GM_deleteValue(key);
				else unindexedChapterKeys.push(key);
				yield;
			}
			if (deletionAborted) continue;
			const latest = parseStoredJson(GM_getValue(group.key, null));
			const latestAccessed = isPersistedCacheIndex(latest) ? getIndexAccessTime(latest) : null;
			if (protectedBookIds.has(group.bookId)) {
				yield;
				continue;
			}
			if (isPersistedCacheIndex(latest) && (latestAccessed === null || now - latestAccessed <= maxAgeMs)) {
				yield;
				continue;
			}
			GM_deleteValue(group.key);
			yield;
		}
		for (const { key, bookId } of invalidIndexes) {
			if (!bookId || protectedBookIds.has(bookId)) {
				yield;
				continue;
			}
			GM_deleteValue(key);
			yield;
		}
		const orphanIndexStates = new Map();
		for (const key of unindexedChapterKeys) {
			cleanupOrphanedChapter(key, now, maxAgeMs, protectedBookIds, orphanIndexStates);
			yield;
		}
		for (const group of activeIndexGroups) {
			const index = group.data;
			if (group.chapterKeys.length === index.urls.length) {
				yield;
				continue;
			}
			const reachableUrls = new Set();
			for (const url of index.urls) {
				if (typeof url === "string") reachableUrls.add(url);
				yield;
			}
			for (const key of group.chapterKeys) {
				const chapterUrl = decodeBase64UrlUtf8(key.slice(group.chapterPrefix.length));
				if (chapterUrl === null || !reachableUrls.has(chapterUrl)) cleanupOrphanedChapter(key, now, maxAgeMs, protectedBookIds, orphanIndexStates);
				yield;
			}
		}
	}
	function runScheduledCacheCleanup(state) {
		scheduleCacheCleanupSlice((deadline) => {
			if (scheduledCacheCleanup !== state) return;
			try {
				state.iterator ??= createPersistedCacheCleanupSteps(state.now, state.maxAgeMs, state.protectedBookIds);
				const startedAt = getMonotonicTime();
				let steps = 0;
				while (steps < PERSISTED_CACHE_GC_SLICE_STEPS) {
					if (state.iterator.next().done) {
						scheduledCacheCleanup = null;
						return;
					}
					steps += 1;
					const budgetExhausted = getMonotonicTime() - startedAt >= PERSISTED_CACHE_GC_SLICE_BUDGET_MS;
					const idleTimeExhausted = deadline !== null && !deadline.didTimeout && deadline.timeRemaining() <= 1;
					if (budgetExhausted || idleTimeExhausted) break;
				}
				runScheduledCacheCleanup(state);
			} catch (e) {
				scheduledCacheCleanup = null;
				console.error("[MNR] Failed to cleanup expired caches:", e);
			}
		});
	}
	function cleanupExpiredCaches(options = {}) {
		if (typeof GM_getValue === "undefined" || typeof GM_setValue === "undefined" || typeof GM_deleteValue === "undefined" || typeof GM_listValues !== "function") return;
		const now = options.now ?? Date.now();
		const gcIntervalMs = options.gcIntervalMs ?? PERSISTED_CACHE_GC_INTERVAL_MS;
		const maxAgeMs = options.maxAgeMs ?? PERSISTED_CACHE_MAX_AGE_MS;
		try {
			if (!options.force && scheduledCacheCleanup) {
				if (options.currentBookId) scheduledCacheCleanup.protectedBookIds.add(options.currentBookId);
				return;
			}
			if (!options.force) {
				const lastRun = normalizeTimestamp(GM_getValue(PERSISTED_CACHE_GC_LAST_RUN_KEY, 0));
				if (lastRun !== null && now - lastRun < gcIntervalMs) return;
			}
			const protectedBookIds = new Set();
			if (options.currentBookId) protectedBookIds.add(options.currentBookId);
			if (options.force) {
				scheduledCacheCleanup = null;
				const iterator = createPersistedCacheCleanupSteps(now, maxAgeMs, protectedBookIds);
				while (!iterator.next().done);
				GM_setValue(PERSISTED_CACHE_GC_LAST_RUN_KEY, now);
				return;
			}
			GM_setValue(PERSISTED_CACHE_GC_LAST_RUN_KEY, now);
			const state = {
				iterator: null,
				maxAgeMs,
				now,
				protectedBookIds
			};
			scheduledCacheCleanup = state;
			runScheduledCacheCleanup(state);
		} catch (e) {
			console.error("[MNR] Failed to cleanup expired caches:", e);
		}
	}
	function clearPersistedCache(cacheBook, persistedUrls) {
		if (typeof GM_deleteValue === "undefined") return;
		let urls = new Set(persistedUrls);
		if (typeof GM_getValue !== "undefined") {
			const dataV2 = parseStoredJson(GM_getValue(getCacheV2IndexKey(cacheBook.bookId), null));
			if (dataV2?.version === 2 && Array.isArray(dataV2.urls)) urls = new Set(dataV2.urls);
		}
		try {
			const chapterKeyPrefix = `${CACHE_V2_CHAPTER_PREFIX}${cacheBook.bookId}_`;
			if (urls.size > 0) for (const url of urls) GM_deleteValue(getCacheV2ChapterKey(cacheBook.bookId, url));
			else if (typeof GM_listValues === "function") {
				for (const key of GM_listValues()) if (key.startsWith(chapterKeyPrefix)) GM_deleteValue(key);
			}
			GM_deleteValue(getCacheV2IndexKey(cacheBook.bookId));
		} catch (e) {
			console.error("[MNR] Failed to clear cache:", e);
		}
	}
	function normalizeUrlForFetch(url) {
		const normalized = getRuleManager().normalizeChapterUrl(normalizeRedundantFirstPageParam(normalizeCiwemaoChapterUrl(url)));
		try {
			const u = new URL(normalized);
			u.hash = "";
			return u.toString();
		} catch {
			return normalized.replace(/#.*$/, "");
		}
	}
	function normalizeUrl(url) {
		return url.replace(/\/$/, "").replace(/\/index\.html?$/, "");
	}
	function normalizeUrlForBlock(url) {
		const normalized = getRuleManager().normalizeChapterUrl(normalizeCiwemaoChapterUrl(url));
		try {
			const u = new URL(normalized);
			u.hash = "";
			return normalizeUrl(u.toString());
		} catch {
			return normalizeUrl(normalized.replace(/#.*$/, ""));
		}
	}
	function resolveUrl(href, base) {
		try {
			return new URL(href, base).toString();
		} catch {
			return null;
		}
	}
	function extractUrlPattern(url) {
		try {
			return new URL(url).pathname.replace(/\d+/g, "{N}");
		} catch {
			return url.replace(/\d+/g, "{N}");
		}
	}
	function extractBookId$1(url) {
		try {
			const u = new URL(url);
			for (const p of [
				/\/book\/(\d+)/,
				/\/chapter\/(\d+)\//,
				/\/(\d+)\/\d+(?:\.html?)?$/,
				/\/(\d+)_\d+(?:\.html?)?$/,
				/[?&](?:book_?id|bid|id)=(\d+)/i
			]) {
				const m = u.pathname.match(p) || u.search.match(p);
				if (m) return m[1];
			}
		} catch {}
		return null;
	}
	function extractChapterNumber(title) {
		const match1 = title.match(/第\s*(\d+)\s*[章节回话篇集卷]/);
		if (match1) return parseInt(match1[1], 10);
		const match2 = title.match(/^(\d+)[.、\s]/);
		if (match2) return parseInt(match2[1], 10);
		const match3 = title.match(/Chapter\s*(\d+)/i);
		if (match3) return parseInt(match3[1], 10);
		return null;
	}
	function normalizeTocPagerText(text) {
		return text.replace(/\s+/g, "").trim();
	}
	function isTocNextPageText(text) {
		const t = normalizeTocPagerText(text).toLowerCase();
		if (!t) return false;
		if (t.includes("下一页") || t.includes("下页") || t.includes("下一頁") || t.includes("下頁")) return true;
		if (t.includes("next") && !t.includes("chapter") && (t.includes("page") || t === "next")) return true;
		return false;
	}
	function normalizeUrlForCompare(url) {
		try {
			const u = new URL(url);
			u.hash = "";
			return u.toString();
		} catch {
			return url;
		}
	}
	function extractTocPaginationSeed(indexUrl) {
		try {
			return new URL(indexUrl).pathname.match(/\/(\d{3,})(?:[/?]|$)/)?.[1] || null;
		} catch {
			return null;
		}
	}
	function isValidTocPaginationUrl(candidateUrl, indexUrl) {
		try {
			const c = new URL(candidateUrl);
			const idx = new URL(indexUrl);
			if (c.protocol !== "http:" && c.protocol !== "https:") return false;
			if (c.origin !== idx.origin) return false;
			const seed = extractTocPaginationSeed(indexUrl);
			if (seed && !c.pathname.includes(seed)) return false;
			return true;
		} catch {
			return false;
		}
	}
	function calculateBackoff(failureCount, baseMs = 1500, maxMs = 3e4) {
		return Math.min(baseMs * Math.pow(2, failureCount - 1), maxMs);
	}
	function getPageFetch() {
		if (typeof unsafeWindow !== "undefined" && typeof unsafeWindow.fetch === "function") return unsafeWindow.fetch.bind(unsafeWindow);
		if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch.bind(window);
		return typeof fetch === "function" ? fetch : null;
	}
	function requestSiteData(url, options) {
		return new Promise((resolve) => {
			const controller = new AbortController();
			let gmRequest;
			let settled = false;
			const timeoutMs = options.timeoutMs ?? 1e4;
			const diagnostic = {
				url,
				finalUrl: null,
				transport: null,
				status: null,
				reason: "unavailable"
			};
			const finish = (value) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				options.setAbort(null);
				options.onResult?.({
					...diagnostic,
					reason: value === null ? diagnostic.reason : "success"
				});
				resolve(value);
			};
			const cancel = (reason = "cancelled") => {
				if (settled) return;
				diagnostic.reason = reason;
				finish(null);
				controller.abort();
				try {
					gmRequest?.abort();
				} catch (error) {
					console.debug("[MNR] Site request abort failed:", error);
				}
			};
			const timer = setTimeout(() => cancel("timeout"), timeoutMs);
			options.setAbort(cancel);
			const parse = (data) => {
				try {
					return options.parse(data);
				} catch (error) {
					console.debug("[MNR] Invalid site response:", error);
					return null;
				}
			};
			(async () => {
				try {
					if (settled) return;
					const fetcher = getPageFetch();
					if (fetcher) {
						diagnostic.transport = "fetch";
						diagnostic.reason = "network";
						try {
							const response = await fetcher(url, {
								method: options.method ?? "GET",
								credentials: "include",
								headers: options.headers,
								...options.body === void 0 ? {} : { body: options.body },
								signal: controller.signal
							});
							if (settled) return;
							diagnostic.status = response.status;
							diagnostic.finalUrl = response.url || url;
							diagnostic.reason = response.ok ? "parse" : "http";
							if (response.ok) {
								const data = await response[options.responseType]();
								if (settled) return;
								const value = parse(data);
								if (value !== null) {
									finish(value);
									return;
								}
							}
						} catch (error) {
							if (!settled) console.debug("[MNR] Native site request failed:", error);
						}
					}
					if (settled) return;
					const gmXhr = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;
					if (options.gmFallback === false || !gmXhr) {
						finish(null);
						return;
					}
					diagnostic.transport = "gm";
					diagnostic.status = null;
					diagnostic.finalUrl = null;
					diagnostic.reason = "network";
					gmRequest = gmXhr({
						method: options.method ?? "GET",
						url,
						data: options.body,
						headers: {
							...options.headers,
							...options.referrer ? { Referer: options.referrer } : {}
						},
						timeout: timeoutMs,
						withCredentials: true,
						onload: (response) => {
							if (settled) return;
							diagnostic.status = response.status;
							diagnostic.finalUrl = response.finalUrl || url;
							diagnostic.reason = "http";
							if (response.status < 200 || response.status >= 300) {
								finish(null);
								return;
							}
							diagnostic.reason = "parse";
							try {
								const data = options.responseType === "json" ? JSON.parse(response.responseText) : response.responseText;
								finish(parse(data));
							} catch (error) {
								console.debug("[MNR] Invalid GM site response:", error);
								finish(null);
							}
						},
						onerror: () => finish(null),
						onabort: () => {
							diagnostic.reason = "cancelled";
							finish(null);
						},
						ontimeout: () => cancel("timeout")
					});
				} catch (error) {
					console.warn("[MNR] Site request failed:", error);
					finish(null);
				}
			})();
		});
	}
	var ajaxChapterList_exports = __exportAll({ createAjaxChapterListLoader: () => createAjaxChapterListLoader });
	function resolvePageUrl(indexUrl, currentUrl, options) {
		const fallbackBase = typeof location !== "undefined" && typeof location.href === "string" && location.href || "https://example.invalid/";
		for (const candidate of [currentUrl, indexUrl]) {
			const absolute = resolveUrl(candidate, fallbackBase);
			if (!absolute) continue;
			try {
				const url = new URL(absolute);
				if (options.matchesHost(url.hostname)) return url;
			} catch {}
		}
		return null;
	}
	function extractBookId(indexUrl, currentUrl, pageUrl, options) {
		for (const candidate of [currentUrl, indexUrl]) {
			const absolute = resolveUrl(candidate, pageUrl.href);
			if (!absolute) continue;
			try {
				const url = new URL(absolute);
				if (!options.matchesHost(url.hostname)) continue;
				const match = url.pathname.match(/^\/(?:txt|book)\/(\d+)(?:\/|\.html?$)/);
				if (match) return match[1];
			} catch {}
		}
		return null;
	}
	function buildChapterListUrl(indexUrl, currentUrl, options) {
		const pageUrl = resolvePageUrl(indexUrl, currentUrl, options);
		if (!pageUrl) return null;
		const bookId = extractBookId(indexUrl, currentUrl, pageUrl, options);
		if (!bookId) return null;
		return new URL(`/ajax_novels/chapterlist/${bookId}.html`, pageUrl.origin).toString();
	}
	function parseChapterList(html, apiUrl, options) {
		if (!html.trim() || typeof DOMParser === "undefined") return [];
		const doc = new DOMParser().parseFromString(html, "text/html");
		const anchors = Array.from(doc.querySelectorAll("ul li a[href], a[href*=\"/txt/\"]"));
		const seen = new Set();
		const entries = [];
		for (const anchor of anchors) {
			const rawHref = anchor.getAttribute("href")?.trim();
			if (!rawHref) continue;
			const absolute = resolveUrl(rawHref, apiUrl);
			if (!absolute) continue;
			let url;
			try {
				url = new URL(absolute);
			} catch {
				continue;
			}
			if (!options.matchesHost(url.hostname) || !options.matchesChapterPath(url.pathname)) continue;
			const normalizedUrl = normalizeUrlForFetch(url.toString());
			if (seen.has(normalizedUrl)) continue;
			const rawTitle = (anchor.textContent || "").trim();
			const title = (options.cleanTitle?.(rawTitle) || rawTitle).trim();
			seen.add(normalizedUrl);
			entries.push({
				title: title || `章节 ${entries.length + 1}`,
				url: normalizedUrl
			});
		}
		return entries;
	}
	async function loadChapterList(context, options) {
		const apiUrl = buildChapterListUrl(context.indexUrl, context.currentUrl, options);
		if (!apiUrl) return [];
		return await requestSiteData(apiUrl, {
			responseType: "text",
			setAbort: context.setAbort,
			onResult: context.onRequest,
			referrer: context.currentUrl || context.indexUrl,
			headers: {
				Accept: "text/html, */*; q=0.01",
				"X-Requested-With": "XMLHttpRequest"
			},
			parse: (data) => {
				const entries = typeof data === "string" ? parseChapterList(data, apiUrl, options) : [];
				return entries.length ? entries : null;
			}
		}) || [];
	}
	function createAjaxChapterListLoader(options) {
		return {
			id: options.id,
			matches: (context) => options.ruleIds.includes(context.rule?.id || "") || resolvePageUrl(context.indexUrl, context.currentUrl, options) !== null,
			load: (context) => loadChapterList(context, options)
		};
	}
	var goboo_exports = __exportAll({ gobooTocTitleCleaner: () => gobooTocTitleCleaner });
	function cleanGobooTocTitleForUrl(title, url) {
		const trimmed = title.trim();
		try {
			const gobooChapter = new URL(url).pathname.match(/^\/gb_\d+\/\d+\/(\d+)(?:\/|$)/);
			if (!gobooChapter) return trimmed;
			const chapterPathId = gobooChapter[1];
			if (!trimmed.startsWith(chapterPathId)) return trimmed;
			const rest = trimmed.slice(chapterPathId.length).trimStart();
			if (/^(?:\d{3,4}|第)/.test(rest)) return rest;
		} catch {}
		return trimmed;
	}
	var gobooTocTitleCleaner = {
		id: "goboo",
		clean: cleanGobooTocTitleForUrl
	};
	var ixdzs_exports = __exportAll({ ixdzsTocLoader: () => ixdzsTocLoader });
	function getBookUrl(context) {
		for (const candidate of [context.currentUrl, context.indexUrl]) try {
			const url = new URL(candidate);
			if (/^https?:$/.test(url.protocol) && url.hostname === "ixdzs8.com" && /^\/read\/\d+\/(?:p\d+\.html)?$/.test(url.pathname)) return url;
		} catch {}
		return null;
	}
	var ixdzsTocLoader = {
		id: "ixdzs",
		matches: (context) => getBookUrl(context) !== null,
		async load(context) {
			const pageUrl = getBookUrl(context);
			if (!pageUrl) return [];
			const bookId = pageUrl.pathname.split("/")[2];
			return await requestSiteData(new URL("/novel/clist/", pageUrl.origin).href, {
				responseType: "json",
				setAbort: context.setAbort,
				onResult: context.onRequest,
				timeoutMs: 15e3,
				gmFallback: false,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"X-Requested-With": "XMLHttpRequest"
				},
				body: new URLSearchParams({ bid: bookId }).toString(),
				parse: (data) => {
					const payload = data;
					if (payload?.rs !== 200 || !Array.isArray(payload.data)) throw new Error("Invalid chapter-list response");
					const entries = [];
					const seen = new Set();
					for (const row of payload.data) {
						if (!row || String(row.ctype) !== "0") continue;
						const number = String(row.ordernum);
						if (!/^[1-9]\d*$/.test(number) || typeof row.title !== "string") continue;
						const title = row.title.trim();
						if (!title || seen.has(number)) continue;
						seen.add(number);
						entries.push({
							title,
							url: new URL(`/read/${bookId}/p${number}.html`, pageUrl.origin).href
						});
					}
					return entries;
				}
			}) || [];
		}
	};
	var qidian_exports = __exportAll({ qidianTocLoader: () => qidianTocLoader });
	function isQidianHost(hostname) {
		return /(^|\.)qidian\.com$/i.test(hostname);
	}
	function getCookieValue(name) {
		if (typeof document === "undefined" || !document.cookie) return null;
		const encodedName = encodeURIComponent(name);
		for (const part of document.cookie.split(";")) {
			const trimmed = part.trim();
			const eq = trimmed.indexOf("=");
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq);
			if (key === name || key === encodedName) return decodeURIComponent(trimmed.slice(eq + 1));
		}
		return null;
	}
	function resolveQidianPageUrl(indexUrl, currentUrl) {
		const fallbackBase = typeof location !== "undefined" && typeof location.href === "string" && location.href || "https://www.qidian.com/";
		for (const candidate of [currentUrl, indexUrl]) {
			const abs = resolveUrl(candidate, fallbackBase);
			if (!abs) continue;
			try {
				const url = new URL(abs);
				if (isQidianHost(url.hostname)) return url;
			} catch {}
		}
		return null;
	}
	function isQidianTocRequest(indexUrl, currentUrl, rule) {
		if (rule?.id === "qidian" || rule?.id === "qidian-mobile") return true;
		return !!resolveQidianPageUrl(indexUrl, currentUrl);
	}
	function buildQidianCategoryUrl(indexUrl, currentUrl) {
		const bookId = extractBookId$1(currentUrl) || extractBookId$1(indexUrl);
		const pageUrl = resolveQidianPageUrl(indexUrl, currentUrl);
		if (!bookId || !pageUrl) return null;
		const apiUrl = new URL("/webcommon/book/category", pageUrl.origin);
		const csrfToken = getCookieValue("_csrfToken");
		if (csrfToken) apiUrl.searchParams.set("_csrfToken", csrfToken);
		apiUrl.searchParams.set("bookId", bookId);
		return apiUrl.toString();
	}
	function dedupeQidianTocEntries(candidates) {
		const seenUrls = new Set();
		const results = [];
		for (let i = candidates.length - 1; i >= 0; i--) {
			const entry = candidates[i];
			if (seenUrls.has(entry.url)) continue;
			seenUrls.add(entry.url);
			results.unshift(entry);
		}
		return results;
	}
	function qidianCategoryToEntries(response, indexUrl, currentUrl) {
		if (!response || response.code !== 0) return [];
		const bookId = extractBookId$1(currentUrl) || extractBookId$1(indexUrl);
		const pageUrl = resolveQidianPageUrl(indexUrl, currentUrl);
		if (!bookId || !pageUrl) return [];
		const entries = [];
		const volumes = response.data?.vs || [];
		const isAnonymous = response.data?.loginStatus === 0;
		for (const volume of volumes) for (const chapter of volume.cs || []) {
			const title = (chapter.cN || chapter.chapterName || "").trim() || `章节 ${entries.length + 1}`;
			const explicitUrl = typeof chapter.cU === "string" ? chapter.cU.trim() : "";
			const chapterId = chapter.id ?? chapter.chapterId;
			let url = explicitUrl ? resolveUrl(explicitUrl, pageUrl.href) : null;
			if (!url && chapterId !== void 0 && chapterId !== null) url = new URL(`/chapter/${bookId}/${String(chapterId)}/`, pageUrl.origin).toString();
			if (!url) continue;
			entries.push({
				title,
				url: normalizeUrlForFetch(url),
				...isAnonymous && chapter.sS === 0 ? { access: "locked" } : {}
			});
		}
		return dedupeQidianTocEntries(entries);
	}
	async function loadQidianTocEntries(indexUrl, currentUrl, context) {
		const apiUrl = buildQidianCategoryUrl(indexUrl, currentUrl);
		if (!apiUrl) return [];
		return await requestSiteData(apiUrl, {
			responseType: "json",
			setAbort: context.setAbort,
			onResult: context.onRequest,
			referrer: currentUrl || indexUrl,
			headers: {
				Accept: "application/json, text/javascript, */*; q=0.01",
				"X-Requested-With": "XMLHttpRequest"
			},
			parse: (data) => {
				const response = data;
				return response?.code === 0 ? qidianCategoryToEntries(response, indexUrl, currentUrl) : null;
			}
		}) || [];
	}
	var qidianTocLoader = {
		id: "qidian",
		matches: (context) => isQidianTocRequest(context.indexUrl, context.currentUrl, context.rule),
		load: (context) => loadQidianTocEntries(context.indexUrl, context.currentUrl, context)
	};
	var sto9_exports = __exportAll({ sto9TocLoader: () => sto9TocLoader });
	var sto9TocLoader = createAjaxChapterListLoader({
		id: "sto9",
		ruleIds: ["sto9"],
		matchesHost: (hostname) => /^(?:www\.)?sto9\.com$/i.test(hostname),
		matchesChapterPath: (pathname) => /^\/txt\/\d+\/\d+\.html?$/i.test(pathname)
	});
	var twkan_exports = __exportAll({ twkanTocLoader: () => twkanTocLoader });
	var twkanTocLoader = createAjaxChapterListLoader({
		id: "twkan",
		ruleIds: ["twkan"],
		matchesHost: (hostname) => /^twkan\.com$/i.test(hostname),
		matchesChapterPath: (pathname) => /^\/txt\/\d+\/\d+\/?$/i.test(pathname),
		cleanTitle: (title) => title.replace(/^\s*\d+[.、\s]+/, "").trim()
	});
	var modules = Object.assign({
		"./ajaxChapterList.ts": ajaxChapterList_exports,
		"./goboo.ts": goboo_exports,
		"./ixdzs.ts": ixdzs_exports,
		"./qidian.ts": qidian_exports,
		"./sto9.ts": sto9_exports,
		"./twkan.ts": twkan_exports
	});
	function isSpecialTocLoader(value) {
		if (!value || typeof value !== "object") return false;
		const maybe = value;
		return typeof maybe.id === "string" && typeof maybe.matches === "function" && typeof maybe.load === "function";
	}
	function isSpecialTocTitleCleaner(value) {
		if (!value || typeof value !== "object") return false;
		const maybe = value;
		return typeof maybe.id === "string" && typeof maybe.clean === "function";
	}
	var specialTocLoaders = Object.keys(modules).sort().flatMap((path) => Object.values(modules[path]).filter(isSpecialTocLoader));
	var specialTocTitleCleaners = Object.keys(modules).sort().flatMap((path) => Object.values(modules[path]).filter(isSpecialTocTitleCleaner));
	var CHAPTER_TITLE_PATTERNS = [
		/^.{0,10}第.{1,10}[章节回话篇集卷]/,
		/^\d{1,4}[.、\s]/,
		/^(序章|序幕|楔子|引子|终章|尾声|番外|后记|前言)/,
		/^chapter\s*\d+/i,
		/^(prologue|epilogue|preface)/i
	];
	var NON_CHAPTER_TITLE_PATTERNS = [
		/^(公告|通知|声明|说明|必读|注意|警告|温馨提示)/,
		/上架感言|完本感言|请假|推迟|停更|断更|更新|爆更|上架通知|卷末感言/,
		/必看|必读|请务必阅读|读者必看/,
		/^(作者|关于作者|作品相关|设定|世界观|人物介绍|角色)/,
		/求.*票|求.*收藏|求.*订阅|求.*打赏|求.*推荐|求.*支持/,
		/新书|推荐|安利|宣传|书单|书评/,
		/^(目录|封面|简介|内容简介|书籍信息|作品信息)/,
		/^(VIP|付费|锁定|未解锁|需订阅|加入书架)$/i,
		/官网|公众号|微信|QQ群|粉丝群|书友群|交流群|读者群/,
		/登[录陆]|注册|充值|书架|书城|排行|分类|搜索|设置/,
		/首页|返回|上一页|下一页|翻页/,
		/^(章节|分卷|卷|部|篇)\s*[\d一二三四五六七八九十百千]+\s*$/,
		/^(正文|番外|VIP卷?|免费章节?)\s*$/
	];
	function isLikelyChapterTitle(title) {
		const t = title.trim();
		return CHAPTER_TITLE_PATTERNS.some((p) => p.test(t));
	}
	function isNonChapterTitle(title) {
		const t = title.trim();
		if (t.length < 2) return true;
		return NON_CHAPTER_TITLE_PATTERNS.some((p) => p.test(t));
	}
	function isPlaceholderTocTitle(title) {
		return /^章节\s*\d+$/i.test(title.trim());
	}
	function isBetterTocTitle(oldTitle, newTitle) {
		const oldWhitelist = isLikelyChapterTitle(oldTitle);
		const newWhitelist = isLikelyChapterTitle(newTitle);
		if (newWhitelist && !oldWhitelist) return true;
		if (oldWhitelist && !newWhitelist) return false;
		if (!isPlaceholderTocTitle(oldTitle) && isPlaceholderTocTitle(newTitle)) return false;
		if (isPlaceholderTocTitle(oldTitle) && !isPlaceholderTocTitle(newTitle)) return true;
		return newTitle.length > oldTitle.length;
	}
	function extractTocLinkTitle(a) {
		for (const sel of [
			"[class*=\"chapterItemTitle\"]",
			"[class*=\"chapter-title\"]",
			"[class*=\"chapterTitle\"]",
			".line_1",
			"h2",
			"h3"
		]) {
			const el = a.querySelector(sel);
			if (el) {
				const text = (el.textContent || "").trim();
				if (text) return text;
			}
		}
		const firstP = a.querySelector("p");
		if (firstP) {
			if (a.querySelectorAll("p").length > 1) {
				const text = (firstP.textContent || "").trim();
				if (text) return text;
			}
		}
		let directText = "";
		for (const node of Array.from(a.childNodes)) if (node.nodeType === Node.TEXT_NODE) directText += node.textContent || "";
		directText = directText.trim();
		if (directText) return directText;
		return (a.textContent || "").trim();
	}
	function cleanTocTitleForUrl(title, url) {
		let cleaned = title.trim();
		for (const cleaner of specialTocTitleCleaners) cleaned = cleaner.clean(cleaned, url);
		return cleaned;
	}
	function filterTocEntries(entries) {
		if (entries.length < 5) return entries;
		const bookIdCounts = new Map();
		for (const entry of entries) {
			const bookId = extractBookId$1(entry.url);
			if (bookId) bookIdCounts.set(bookId, (bookIdCounts.get(bookId) || 0) + 1);
		}
		let dominantBookId = null;
		let maxCount = 0;
		for (const [bookId, count] of bookIdCounts) if (count > maxCount) {
			maxCount = count;
			dominantBookId = bookId;
		}
		const sameBookEntries = dominantBookId && maxCount >= 5 ? entries.filter((entry) => {
			const bookId = extractBookId$1(entry.url);
			return !bookId || bookId === dominantBookId;
		}) : entries;
		const patternCounts = new Map();
		for (const entry of sameBookEntries) {
			const pattern = extractUrlPattern(entry.url);
			patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
		}
		const sortedPatterns = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1]);
		const dominantPatterns = new Set();
		const totalEntries = sameBookEntries.length;
		for (const [pattern, count] of sortedPatterns) {
			const ratio = count / totalEntries;
			if (count >= 5 || ratio > .3) {
				dominantPatterns.add(pattern);
				if (Array.from(dominantPatterns).reduce((sum, p) => sum + (patternCounts.get(p) || 0), 0) / totalEntries > .9) break;
			}
		}
		if (dominantPatterns.size === 0 && sortedPatterns.length > 0) dominantPatterns.add(sortedPatterns[0][0]);
		const filtered = sameBookEntries.map((entry) => {
			let score = 0;
			const pattern = extractUrlPattern(entry.url);
			if (dominantPatterns.has(pattern)) score += 2;
			const matchesWhitelist = isLikelyChapterTitle(entry.title);
			if (matchesWhitelist) score += 1;
			if (!matchesWhitelist && isNonChapterTitle(entry.title)) score -= 2;
			return {
				entry,
				score
			};
		}).filter(({ score }) => score >= 1).map(({ entry }) => entry);
		if (filtered.length < sameBookEntries.length * .3 || filtered.length < 10) {
			const lenientFiltered = sameBookEntries.filter((entry) => !isNonChapterTitle(entry.title));
			if (lenientFiltered.length >= filtered.length) return sortTocEntries(lenientFiltered);
		}
		return sortTocEntries(filtered);
	}
	function sortTocEntries(entries) {
		if (entries.length < 5) return entries;
		const entriesWithNum = entries.map((entry, index) => ({
			index,
			entry,
			num: extractChapterNumber(entry.title)
		})).filter((item) => item.num !== null);
		if (entriesWithNum.length < entries.length * .3 || entriesWithNum.length < 3) return entries;
		let descendingPairs = 0;
		let ascendingPairs = 0;
		for (let i = 0; i < entriesWithNum.length - 1; i++) {
			const diff = entriesWithNum[i + 1].num - entriesWithNum[i].num;
			if (diff < 0) descendingPairs++;
			else if (diff > 0) ascendingPairs++;
		}
		const totalPairs = descendingPairs + ascendingPairs;
		if (totalPairs > 0 && descendingPairs / totalPairs > .6) return [...entries].reverse();
		return entries;
	}
	function dedupeTocEntries(candidates) {
		const seenUrls = new Map();
		const results = [];
		for (let i = candidates.length - 1; i >= 0; i--) {
			const entry = candidates[i];
			if (seenUrls.has(entry.url)) {
				const existing = seenUrls.get(entry.url);
				if (isBetterTocTitle(existing.title, entry.title)) existing.title = entry.title;
			} else {
				seenUrls.set(entry.url, entry);
				results.unshift(entry);
			}
		}
		return results;
	}
	function collectTocCandidates(doc, base, rule) {
		const textPattern = /(第.{1,20}[章节回话篇集卷幕]|[章回节話幕]|chapter|\d+)/i;
		const urlPattern = /(chapter|read|book|novel|txt|\/\d+)[/_-]\d+|\/\d+\.html?$|\/xs_[^/]+\/\d+\/\d+(?:\/\d+)?/i;
		const excludeAncestors = (rule?.toc?.excludeAncestors || "").split(",").map((s) => s.trim()).filter(Boolean);
		const candidates = [];
		const collect = (root) => {
			for (const a of root.querySelectorAll("a[href], template")) {
				if (excludeAncestors.length > 0) {
					let excluded = false;
					for (const sel of excludeAncestors) try {
						if (a.closest(sel)) {
							excluded = true;
							break;
						}
					} catch {}
					if (excluded) continue;
				}
				if (a.tagName === "TEMPLATE") {
					collect(a.content);
					continue;
				}
				const text = extractTocLinkTitle(a);
				const href = a.getAttribute("href") || "";
				const abs = resolveUrl(href, base);
				if (!abs) continue;
				const url = normalizeUrlForFetch(abs);
				if (!(textPattern.test(text) || urlPattern.test(href))) continue;
				const title = cleanTocTitleForUrl(text || `章节 ${candidates.length + 1}`, url);
				candidates.push({
					title,
					url
				});
			}
		};
		if (rule?.toc?.selector) for (const root of doc.querySelectorAll(rule.toc.selector)) collect(root);
		else collect(doc);
		return candidates;
	}
	function findNextTocPageUrl(doc, currentPageUrl, indexUrl) {
		const currentNorm = normalizeUrlForCompare(currentPageUrl);
		const pushCandidate = (candidates, href, score) => {
			const abs = resolveUrl(href, currentPageUrl);
			if (!abs) return;
			if (normalizeUrlForCompare(abs) === currentNorm) return;
			if (!isValidTocPaginationUrl(abs, indexUrl)) return;
			candidates.push({
				url: abs,
				score
			});
		};
		const candidates = [];
		const linkNext = doc.querySelector("link[rel=\"next\"][href]")?.getAttribute("href");
		if (linkNext) pushCandidate(candidates, linkNext, 100);
		const aRelNext = doc.querySelector("a[rel~=\"next\"][href]")?.getAttribute("href");
		if (aRelNext) pushCandidate(candidates, aRelNext, 90);
		for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
			if (!isTocNextPageText(a.textContent || "")) continue;
			const href = a.getAttribute("href");
			if (!href) continue;
			let score = 50;
			if ((a.getAttribute("rel") || "").toLowerCase().includes("next")) score += 10;
			if ((a.getAttribute("class") || "").toLowerCase().includes("next")) score += 3;
			if (a.closest(".pager, .pagination, .page, .pagebar, .caption, nav")) score += 2;
			pushCandidate(candidates, href, score);
		}
		if (candidates.length === 0) return null;
		candidates.sort((a, b) => b.score - a.score);
		return candidates[0].url;
	}
	var MAX_TOC_PAGES = 120;
	async function loadTocEntriesPaged(indexUrl, currentUrl, rule, setAbort, report = () => {}) {
		const loaderContext = {
			indexUrl,
			currentUrl,
			rule,
			setAbort,
			onRequest: (request) => report({ request })
		};
		const loader = specialTocLoaders.find((item) => item.matches(loaderContext));
		report({ loader: loader?.id ?? "paged" });
		if (loader) {
			const entries = await loader.load(loaderContext);
			report({
				pages: entries.length ? 1 : 0,
				entries: entries.length,
				reason: entries.length ? "provider-complete" : "empty"
			});
			return entries;
		}
		const visitedPages = new Set();
		const seenChapterUrls = new Set();
		const allCandidates = [];
		let currentAbort = null;
		let aborted = false;
		setAbort(() => {
			aborted = true;
			currentAbort?.();
		});
		try {
			let pageUrl = indexUrl;
			let referer = currentUrl || indexUrl;
			while (pageUrl && !aborted) {
				const pageKey = normalizeUrlForCompare(pageUrl);
				if (visitedPages.has(pageKey)) {
					report({ reason: "repeated-page" });
					break;
				}
				if (visitedPages.size >= MAX_TOC_PAGES) {
					report({
						reason: "page-limit",
						nextUrl: pageUrl
					});
					throw new Error(`TOC page limit reached before: ${pageUrl}`);
				}
				visitedPages.add(pageKey);
				report({ request: {
					url: pageUrl,
					finalUrl: null,
					status: null,
					transport: null,
					reason: "pending"
				} });
				const { promise, abort } = fetchAndParseUrl(pageUrl, referer);
				currentAbort = abort;
				if (aborted) abort();
				const result = await promise;
				currentAbort = null;
				report({ request: {
					url: pageUrl,
					finalUrl: result.finalUrl,
					status: result.status,
					transport: null,
					reason: result.error || (result.doc ? "success" : "empty")
				} });
				if (aborted || result.error === "abort") {
					report({ reason: "cancelled" });
					return [];
				}
				if (!result.doc || result.error) {
					report({ reason: result.error || "empty-response" });
					if (allCandidates.length === 0) return [];
					throw new Error(`TOC page request failed: ${pageUrl} (${result.error})`);
				}
				const effectivePageUrl = result.finalUrl || pageUrl;
				const pageCandidates = collectTocCandidates(result.doc, effectivePageUrl, rule);
				if (pageCandidates.length === 0 && (rule?.toc?.selector || allCandidates.length > 0)) {
					report({ reason: "empty-page" });
					if (allCandidates.length === 0) return [];
					throw new Error(`TOC page has no chapter entries: ${effectivePageUrl}`);
				}
				allCandidates.push(...pageCandidates);
				const previousCount = seenChapterUrls.size;
				for (const entry of pageCandidates) seenChapterUrls.add(entry.url);
				report({
					pages: visitedPages.size,
					entries: seenChapterUrls.size
				});
				if (visitedPages.size >= 2 && seenChapterUrls.size === previousCount) {
					report({ reason: "no-new-chapters" });
					break;
				}
				const nextPageUrl = findNextTocPageUrl(result.doc, effectivePageUrl, indexUrl);
				report({ nextUrl: nextPageUrl });
				if (!nextPageUrl) {
					report({ reason: "last-page" });
					break;
				}
				referer = effectivePageUrl;
				pageUrl = nextPageUrl;
			}
		} finally {
			setAbort(null);
		}
		if (aborted) {
			report({ reason: "cancelled" });
			return [];
		}
		const entries = filterTocEntries(dedupeTocEntries(allCandidates));
		report({ entries: entries.length });
		return entries;
	}
	function createTocActions(ctx) {
		const _loadTocEntriesPaged = ctx.loadTocEntriesPaged ?? loadTocEntriesPaged;
		async function setTocEntries(entries) {
			ctx.tocOriginal.value = entries;
			await ctx.applyTocConversion(ctx.currentConversionMode.value);
		}
		async function ensureIndexUrl() {
			const current = ctx.chapter.value;
			const currentUrl = current?.url || "";
			const existing = current?.indexUrl;
			if (existing && (!currentUrl || normalizeUrlForBlock(existing) !== normalizeUrlForBlock(currentUrl))) return existing;
			if (!currentUrl) return void 0;
			try {
				const detected = getParser().detect(document, currentUrl).results.navigation.index?.url;
				if (!detected) return void 0;
				const normalized = normalizeUrlForFetch(detected);
				for (const entry of ctx.chapters.value) {
					const existingIndex = entry.chapter.indexUrl;
					const entryUrl = entry.chapter.url;
					const looksLikeSelf = existingIndex && entryUrl ? normalizeUrlForBlock(existingIndex) === normalizeUrlForBlock(entryUrl) : false;
					if (!existingIndex || looksLikeSelf) entry.chapter.indexUrl = normalized;
				}
				return normalized;
			} catch (e) {
				console.error("[MNR] Failed to detect indexUrl:", e);
				return;
			}
		}
		let lastLoad = null;
		let inflight = null;
		function loadToc() {
			const runId = ctx.runtime.sessionId();
			if (ctx.toc.value.length > 0) return Promise.resolve();
			if (inflight?.runId === runId) return inflight.promise;
			const promise = runLoadToc(runId).finally(() => {
				if (inflight?.promise === promise) inflight = null;
			});
			inflight = {
				runId,
				promise
			};
			return promise;
		}
		async function runLoadToc(runId) {
			ctx.tocLoading.value = true;
			const diagnostic = {
				currentUrl: ctx.chapter.value?.url || "",
				indexUrl: ctx.chapter.value?.indexUrl || null,
				ruleId: ctx.rule.value?.id || null,
				attempt: 0,
				loader: "pending",
				pages: 0,
				entries: 0,
				outcome: "loading",
				reason: null
			};
			lastLoad = diagnostic;
			try {
				const currentUrl = ctx.chapter.value?.url || "";
				let indexUrl = ctx.chapter.value?.indexUrl;
				if (!indexUrl || currentUrl && normalizeUrlForBlock(indexUrl) === normalizeUrlForBlock(currentUrl)) indexUrl = await ensureIndexUrl() || void 0;
				if (ctx.runtime.isSessionStale(runId)) return;
				diagnostic.indexUrl = indexUrl || null;
				if (!indexUrl) {
					diagnostic.outcome = "empty";
					diagnostic.reason = "missing-index";
					ctx.showToast("未检测到目录链接", "info", 2500);
					return;
				}
				const fetchEntries = () => {
					diagnostic.attempt++;
					diagnostic.pages = 0;
					diagnostic.entries = 0;
					diagnostic.reason = null;
					diagnostic.request = void 0;
					diagnostic.nextUrl = void 0;
					return _loadTocEntriesPaged(indexUrl, currentUrl || indexUrl, ctx.rule.value ?? void 0, (abort) => {
						if (!ctx.runtime.isSessionStale(runId)) ctx.tocAbort.value = abort;
						else abort?.();
					}, (update) => Object.assign(diagnostic, update));
				};
				let entries = await fetchEntries();
				if (ctx.runtime.isSessionStale(runId)) return;
				if (entries.length === 0) {
					recordDebugEvent("toc.retry", diagnostic);
					await new Promise((resolve) => window.setTimeout(resolve, 400));
					if (ctx.runtime.isSessionStale(runId)) return;
					entries = await fetchEntries();
					if (ctx.runtime.isSessionStale(runId)) return;
				}
				await setTocEntries(entries);
				if (ctx.runtime.isSessionStale(runId)) return;
				diagnostic.entries = entries.length;
				diagnostic.outcome = entries.length ? "complete" : "empty";
				if (entries.length === 0) ctx.showToast("目录解析为空，可稍后重试或刷新页面", "info", 2500);
			} catch (e) {
				if (!ctx.runtime.isSessionStale(runId)) {
					diagnostic.outcome = "failed";
					diagnostic.error = String(e);
					diagnostic.reason ??= "exception";
					console.error("[MNR] Failed to load TOC:", e);
					ctx.showToast("目录加载失败，可稍后重试", "error", 2500);
				}
			} finally {
				if (ctx.runtime.isSessionStale(runId)) diagnostic.outcome = "cancelled";
				recordDebugEvent("toc.load", diagnostic, diagnostic.outcome === "failed" ? "error" : "info");
				if (!ctx.runtime.isSessionStale(runId)) {
					ctx.tocLoading.value = false;
					ctx.tocAbort.value = null;
				}
			}
		}
		return {
			loadToc,
			getLoadDiagnostic: () => lastLoad
		};
	}
	async function parseWithSectionMerge(parser, initialDoc, url, options = {}) {
		const merger = createSectionMerger(parser);
		let truncated = false;
		const chapter = await merger.merge(initialDoc, url, {
			...options,
			onMergeEnd: (end) => {
				truncated = end.truncated;
			}
		});
		return truncated || options.signal?.aborted ? null : chapter;
	}
	async function startProgressiveSectionMerge(parser, initialDoc, url, options) {
		const { controller, sink } = options;
		let resolveFirst;
		const firstReady = new Promise((resolve) => {
			resolveFirst = resolve;
		});
		let releaseGate;
		const gate = new Promise((resolve) => {
			releaseGate = resolve;
		});
		let progress = null;
		streamSectionMerge(createSectionMerger(parser), initialDoc, url, controller.signal, (chapter, info) => {
			progress = {
				loaded: info.loaded,
				total: info.total
			};
			resolveFirst(chapter);
			return gate;
		}).then(resolveFirst).catch((error) => {
			console.error("[MNR] Background section merge failed:", error);
			resolveFirst(null);
		});
		const chapter = await firstReady;
		if (!progress) return {
			chapter,
			merge: null
		};
		return {
			chapter,
			merge: {
				progress,
				abort: () => controller.abort(),
				commit: (id) => {
					releaseGate(sink(id));
				},
				reject: () => {
					controller.abort();
					releaseGate();
				}
			}
		};
	}
	function trimCachedContents(cachedContents, maxSessionCache) {
		if (cachedContents.size <= maxSessionCache) return;
		const entries = Array.from(cachedContents.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
		const toDelete = entries.slice(0, entries.length - maxSessionCache);
		for (const [url] of toDelete) cachedContents.delete(url);
	}
	function trimNavFailures(navFailures, maxNavFailures) {
		const limit = Math.max(0, maxNavFailures);
		if (navFailures.size <= limit) return;
		const entries = Array.from(navFailures.entries()).sort((a, b) => a[1].nextRetryAt - b[1].nextRetryAt);
		const toDeleteCount = Math.min(entries.length, navFailures.size - limit);
		for (let i = 0; i < toDeleteCount; i++) navFailures.delete(entries[i][0]);
	}
	function createSectionMergeSink(ctx) {
		return (entryId) => async (update) => {
			if (update.stage === "append") await appendChapterSection(ctx, entryId, {
				...update.delta,
				...update.progress
			});
			else if (update.stage === "complete") await completeChapterSections(ctx, entryId, update.chapter, update.rule, update);
			else cancelChapterSections(ctx, entryId, update.reason);
		};
	}
	function findMergingEntry(ctx, entryId, merge) {
		if (ctx.sectionMerges.value.get(entryId) !== merge) return null;
		return ctx.chapters.value.find((item) => item.id === entryId) ?? null;
	}
	function beginChapterSections(ctx, entryId, progress, abort) {
		const entry = ctx.chapters.value.find((item) => item.id === entryId);
		if (!entry) return false;
		entry.sectionProgress = { ...progress };
		delete entry.sectionsIncomplete;
		ctx.sectionMerges.value.set(entryId, {
			abort,
			convertedMode: ctx.currentConversionMode.value,
			convertedScript: entry.chapter.sourceScript
		});
		ctx.cachedContents.value.delete(entry.chapter.url);
		ctx.cachedContents.value.delete(normalizeUrlForFetch(entry.chapter.url));
		recordDebugEvent("reader.sectionMerge.begin", {
			entryId,
			loaded: progress.loaded,
			total: progress.total
		});
		return true;
	}
	async function appendChapterSection(ctx, entryId, delta) {
		const merge = ctx.sectionMerges.value.get(entryId);
		if (!merge) return false;
		const entry = findMergingEntry(ctx, entryId, merge);
		if (!entry) return false;
		const folded = joinHtml(ctx.originalContents.value.get(entryId) ?? entry.chapter.content, delta.content);
		entry.chapter = {
			...entry.chapter,
			rawContent: joinHtml(entry.chapter.rawContent, delta.rawContent),
			sourceScript: delta.sourceScript,
			...delta.nextUrl ? { nextUrl: normalizeUrlForFetch(delta.nextUrl) } : {}
		};
		const mode = ctx.currentConversionMode.value;
		const displayBefore = entry.chapter.content;
		ctx.originalContents.value.set(entryId, folded);
		if (mode !== merge.convertedMode || delta.sourceScript !== merge.convertedScript) await ctx.applyConversionToChapterEntry(entryId, mode);
		else {
			const displayDelta = mode === "none" ? delta.content : await convertHTML(delta.content, mode, { sourceScript: delta.sourceScript });
			const current = findMergingEntry(ctx, entryId, merge);
			if (!current) return false;
			if (mode !== ctx.currentConversionMode.value || current.chapter.content !== displayBefore) await ctx.applyConversionToChapterEntry(entryId, ctx.currentConversionMode.value);
			else current.chapter = {
				...current.chapter,
				content: joinHtml(displayBefore, displayDelta)
			};
		}
		merge.convertedMode = mode;
		const committed = findMergingEntry(ctx, entryId, merge);
		if (!committed) return false;
		merge.convertedScript = delta.sourceScript;
		committed.sectionProgress = {
			loaded: delta.loaded,
			total: delta.total
		};
		return true;
	}
	async function completeChapterSections(ctx, entryId, chapter, rule, info = {}) {
		const merge = ctx.sectionMerges.value.get(entryId);
		if (!merge) return false;
		const url = normalizeUrlForFetch(chapter.url);
		const merged = {
			...chapter,
			url,
			prevUrl: chapter.prevUrl ? normalizeUrlForFetch(chapter.prevUrl) : chapter.prevUrl,
			nextUrl: chapter.nextUrl ? normalizeUrlForFetch(chapter.nextUrl) : chapter.nextUrl,
			indexUrl: chapter.indexUrl ? normalizeUrlForFetch(chapter.indexUrl) : chapter.indexUrl
		};
		const entry = ctx.chapters.value.find((item) => item.id === entryId);
		const effectiveRule = rule ?? merged.rule ?? entry?.rule;
		if (!info.truncated) {
			ctx.cachedContents.value.set(url, {
				chapter: merged,
				rule: effectiveRule,
				cachedAt: Date.now()
			});
			trimCachedContents(ctx.cachedContents.value, 500);
		}
		recordDebugEvent("reader.sectionMerge.complete", {
			entryId,
			truncated: !!info.truncated,
			url
		});
		if (info.truncated) ctx.showToast("本章后续内容加载不完整", "info", 2500);
		if (!entry) {
			ctx.sectionMerges.value.delete(entryId);
			return !info.truncated;
		}
		ctx.originalContents.value.set(entryId, merged.content);
		entry.rule = effectiveRule;
		entry.chapter = {
			...entry.chapter,
			rawContent: merged.rawContent,
			prevUrl: merged.prevUrl,
			nextUrl: merged.nextUrl,
			indexUrl: merged.indexUrl,
			sourceScript: merged.sourceScript
		};
		await reconcileMergedConversion(ctx, entryId, entry, merged, merge.convertedScript, merge.convertedMode);
		if (ctx.sectionMerges.value.get(entryId) !== merge) return false;
		ctx.sectionMerges.value.delete(entryId);
		delete entry.sectionProgress;
		if (info.truncated) entry.sectionsIncomplete = true;
		else delete entry.sectionsIncomplete;
		return true;
	}
	async function reconcileMergedConversion(ctx, entryId, entry, merged, convertedScript, convertedMode) {
		const mode = ctx.currentConversionMode.value;
		if (mode === "none") {
			entry.chapter = {
				...entry.chapter,
				content: merged.content
			};
			return;
		}
		if (convertedScript !== merged.sourceScript || convertedMode !== mode) await ctx.applyConversionToChapterEntry(entryId, mode);
	}
	function cancelChapterSections(ctx, entryId, reason) {
		const merge = ctx.sectionMerges.value.get(entryId);
		if (!merge) return;
		ctx.sectionMerges.value.delete(entryId);
		merge.abort();
		const entry = ctx.chapters.value.find((item) => item.id === entryId);
		if (entry) {
			delete entry.sectionProgress;
			if (reason === "failed") entry.sectionsIncomplete = true;
		}
		recordDebugEvent("reader.sectionMerge.cancel", {
			entryId,
			reason
		});
		if (reason === "failed") ctx.showToast("本章后续内容加载失败", "info", 2500);
	}
	function cancelAllSectionMerges(ctx) {
		for (const entryId of Array.from(ctx.sectionMerges.value.keys())) cancelChapterSections(ctx, entryId, "aborted");
	}
	function recordNavFailure(failures, key, opts) {
		const count = (failures.get(key)?.count || 0) + 1;
		const backoffMs = calculateBackoff(count);
		failures.set(key, {
			count,
			nextRetryAt: Date.now() + backoffMs
		});
		trimNavFailures(failures, opts.maxFailures);
		return count;
	}
	function clearNavFailure(failures, key) {
		failures.delete(key);
	}
	function loadDocumentInIframe(url, timeoutMs = 15e3) {
		let iframe = null;
		let timeoutId = null;
		let settled = false;
		let resolveResult = null;
		const clearTimer = () => {
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
				timeoutId = null;
			}
		};
		const cleanup = () => {
			clearTimer();
			if (iframe) {
				iframe.remove();
				iframe = null;
			}
		};
		const finish = (result) => {
			if (settled) return;
			settled = true;
			if (result) clearTimer();
			else cleanup();
			resolveResult?.(result);
		};
		return {
			promise: new Promise((resolve) => {
				resolveResult = resolve;
				iframe = document.createElement("iframe");
				iframe.setAttribute("aria-hidden", "true");
				iframe.tabIndex = -1;
				iframe.style.cssText = [
					"position:absolute",
					"display:block!important",
					"left:-10000px",
					"top:0",
					"width:1200px",
					"height:8000px",
					"opacity:0",
					"pointer-events:none",
					"border:0"
				].join(";");
				iframe.onload = () => {
					window.setTimeout(() => {
						try {
							if (iframe?.contentWindow?.location.href === "about:blank") return;
							const doc = iframe?.contentDocument;
							if (!doc?.body || doc.body.childNodes.length === 0) return;
							finish({
								doc,
								cleanup
							});
						} catch {
							finish(null);
						}
					}, 300);
				};
				iframe.onerror = () => finish(null);
				timeoutId = window.setTimeout(() => finish(null), timeoutMs);
				const parent = document.body || document.documentElement;
				if (!parent) {
					finish(null);
					return;
				}
				iframe.src = url;
				parent.appendChild(iframe);
			}),
			abort: () => {
				cleanup();
				finish(null);
			}
		};
	}
	async function loadFetchDocument(ctx, load, runId, referer) {
		const ruleDoc = await loadRuleApiDocument(load.targetUrl, load.refChapter.chapter);
		if (ctx.runtime.isViewStale(runId)) return "abort";
		if (ruleDoc) return ruleDoc;
		const fetchLoader = fetchAndParseUrl(load.targetUrl, referer);
		const abort = fetchLoader.abort;
		if (ctx.runtime.isViewStale(runId)) {
			abort();
			return "abort";
		}
		load.pendingAbortRef.value = abort;
		const fetchResult = await fetchLoader.promise;
		if (ctx.runtime.isViewStale(runId)) {
			abort();
			return "abort";
		}
		clearPendingAbort(load, abort);
		if (fetchResult.error === "abort") return "abort";
		if (!fetchResult.doc) recordDebugEvent("chapter.fetch.failed", {
			url: load.targetUrl,
			reason: fetchResult.error,
			status: fetchResult.status
		});
		return fetchResult.doc;
	}
	async function loadRuleApiDocument(url, reference) {
		const fetchDocument = getRuleManager().matchRule(url)?.rule.hooks?.fetchDocument;
		if (!fetchDocument) return null;
		return fetchDocument(url, {
			bookTitle: reference.bookTitle,
			indexUrl: reference.indexUrl,
			refererUrl: reference.url
		});
	}
	async function parseCandidateDocument(ctx, load, parser, doc, runId, _referer, source) {
		if (ctx.runtime.isViewStale(runId)) return "abort";
		const blockReason = getChapterDocumentBlockReason(doc);
		if (blockReason) recordDebugEvent("chapter.rejected", {
			url: load.targetUrl,
			reason: blockReason
		});
		if (blockReason === "cloudflare") {
			const count = recordNavFailure(ctx.navFailures, load.navKey, { maxFailures: 200 });
			if (source === "manual" || count === 1) ctx.showToast("Cloudflare 验证页面，请在新标签页中完成验证后重试", "info", 4e3);
			return "blocked";
		}
		if (blockReason === "vip") {
			ctx.vipBlockedUrls.value.add(normalizeUrlForBlock(load.targetUrl));
			ctx.showToast(VIP_BLOCK_TOAST, "info", 3e3);
			return "blocked";
		}
		const controller = new AbortController();
		const abort = () => controller.abort();
		load.pendingAbortRef.value = abort;
		try {
			if (!load.isNext) {
				const parsed = await parseWithSectionMerge(parser, doc, load.targetUrl, { signal: controller.signal });
				if (controller.signal.aborted || ctx.runtime.isViewStale(runId)) return "abort";
				return parsed;
			}
			const { chapter, merge } = await startProgressiveSectionMerge(parser, doc, load.targetUrl, {
				controller,
				sink: createSectionMergeSink(ctx)
			});
			if (controller.signal.aborted || ctx.runtime.isViewStale(runId)) {
				merge?.reject();
				return "abort";
			}
			load.sectionMerge = merge;
			return chapter;
		} finally {
			clearPendingAbort(load, abort);
		}
	}
	function clearPendingAbort(load, abort) {
		if (load.pendingAbortRef.value === abort) load.pendingAbortRef.value = null;
	}
	function isInvalidChapterUrl(url, currentChapterUrl) {
		try {
			const normalizedUrl = normalizeCiwemaoChapterUrl(url);
			const parsed = new URL(normalizedUrl);
			const pathname = parsed.pathname;
			if (pathname === "/" || pathname === "") return true;
			const pathParts = pathname.split("/").filter(Boolean);
			if (pathParts.length < 2) {
				const part = pathParts[0] || "";
				if (!/\d/.test(part)) return true;
			}
			for (const pattern of [
				/^https?:\/\/[^/]+\/?$/i,
				/^https?:\/\/[^/]+\/(?:index|home|main)?\.?(?:html?|php)?$/i,
				/\/(?:book|novel|xiaoshuo|info)\/?\d*\/?$/i,
				/\/(?:list|catalog|toc|contents?)\.?(?:html?)?$/i,
				/\/(?:index|list|last|LastPage|end)\.(?:html?|php|aspx)/i,
				/\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)\.(?:html?|php|aspx)$/i,
				/\/chapter\/get_par_tsu_list(?:$|[/?#])/i,
				/\/chapter\/ajax_get_session_code(?:$|[/?#])/i,
				/\/chapter\/get_book_chapter_detail_info(?:$|[/?#])/i
			]) if (pattern.test(normalizedUrl) || pattern.test(pathname)) return true;
			if (/\/(?:user|login|register|search|rank|category|tag|author|help|about|contact|faq)(?:\/|$)/i.test(pathname)) return true;
			if (currentChapterUrl) {
				const currentParsed = new URL(currentChapterUrl);
				const currentParts = currentParsed.pathname.split("/").filter(Boolean);
				if (currentParts.length >= 3 && pathParts.length < currentParts.length - 1) return true;
				if (parsed.host !== currentParsed.host) return true;
			}
			return false;
		} catch {
			return false;
		}
	}
	function detectTocPage(content, pageUrl, currentChapterUrl) {
		for (const pattern of [
			/\/book\/\d+\.html?$/i,
			/\/book\/\d+\/?$/i,
			/\/novel\/\d+\/?$/i,
			/\/xiaoshuo\/\d+\/?$/i,
			/\/info\/\d+\.html?$/i,
			/\/\d+\/index\.html?$/i,
			/\/booklist/i,
			/\/catalog/i,
			/\/contents?\.html?$/i,
			/\/list\.html?$/i,
			/\/toc\.html?$/i
		]) if (pattern.test(pageUrl)) return true;
		try {
			const currentPath = new URL(currentChapterUrl).pathname;
			const pagePath = new URL(pageUrl).pathname;
			if (/\/(txt|read|chapter|article)\/\d+\/\d+/i.test(currentPath) && /\/(book|novel|info|xiaoshuo)\/\d+/i.test(pagePath)) return true;
		} catch {}
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = content;
		const textContent = tempDiv.textContent || "";
		const textLength = textContent.length;
		const links = tempDiv.querySelectorAll("a");
		const linkCount = links.length;
		if (textLength < 500 && linkCount > 10) return true;
		const linkTextLength = Array.from(links).reduce((sum, a) => sum + (a.textContent?.length || 0), 0);
		if ((textLength > 0 ? linkTextLength / textLength : 0) > .6 && linkCount > 8) return true;
		const chapterLinkPattern = /\/(chapter|txt|read|book|novel|article)\/|\d+\.html?$|\/xs_[^/]+\/\d+\/\d+(?:\/\d+)?/i;
		if (Array.from(links).filter((a) => {
			const href = a.getAttribute("href") || "";
			return chapterLinkPattern.test(href);
		}).length > 10) return true;
		const normalizeUrlLocal = (url) => {
			try {
				return new URL(url, pageUrl).pathname.replace(/\/$/, "");
			} catch {
				return url.replace(/\/$/, "");
			}
		};
		const currentPath = normalizeUrlLocal(currentChapterUrl);
		if (Array.from(links).some((a) => {
			const href = a.getAttribute("href");
			if (!href) return false;
			return normalizeUrlLocal(href) === currentPath;
		}) && linkCount > 5) return true;
		const keywordMatches = [
			/目录/,
			/章节列表/,
			/章节目录/,
			/全部章节/,
			/最新章节/,
			/小说目录/,
			/\btable of contents\b/i,
			/\btoc\b/i,
			/\bcatalog\b/i,
			/\bindex\b/i
		].filter((kw) => kw.test(textContent));
		if (keywordMatches.length >= 2 || keywordMatches.length >= 1 && linkCount > 15) return true;
		const linkTexts = Array.from(links).map((a) => a.textContent?.trim() || "").filter((t) => t.length > 0);
		const chapterNamePattern = /^第.{1,10}[章节回话篇集卷]/;
		if (linkTexts.filter((t) => chapterNamePattern.test(t)).length > 5) return true;
		return false;
	}
	function createCacheAll(ctx) {
		let taskId = 0;
		let lastTask = null;
		async function startCacheAll(urls) {
			const runId = ctx.runtime.sessionId();
			if (ctx.cacheProgress.value.running) return;
			const task = {
				chapterUrl: ctx.chapter.value?.url ?? null,
				requested: 0,
				firstUrls: [],
				lastUrls: [],
				currentUrl: null
			};
			lastTask = task;
			const fullBook = urls === void 0;
			const currentTask = ++taskId;
			const isCurrent = () => currentTask === taskId && !ctx.runtime.isSessionStale(runId);
			ctx.cacheProgress.value = {
				done: 0,
				total: 0,
				failed: 0,
				running: true
			};
			try {
				const seenUrls = new Set();
				const knownLockedUrls = new Set();
				ctx.cacheFailedUrls.value = [];
				if (fullBook) {
					await ctx.loadToc();
					if (!isCurrent()) return;
					if (ctx.tocOriginal.value.length === 0) return;
				}
				ctx.restoreCache();
				const persistedSet = new Set(ctx.persistedUrls.value);
				const cacheBook = getCurrentBookCacheKey(ctx.chapter.value?.indexUrl);
				const indexUrlKey = cacheBook ? normalizeUrlForBlock(cacheBook.indexUrl) : null;
				const isIndexUrl = (url) => indexUrlKey !== null && normalizeUrlForBlock(url) === indexUrlKey;
				let cacheableChapterCount = 0;
				let taskList = urls ? urls.map(normalizeUrlForFetch).filter((url) => !isIndexUrl(url)) : [];
				if (fullBook) {
					const tocEntries = ctx.tocOriginal.value;
					const tocLinks = new Set();
					let removedPersistedLocked = false;
					for (const entry of tocEntries.slice(0, 1e4)) {
						const url = normalizeUrlForFetch(entry.url);
						if (entry.access === "locked") {
							knownLockedUrls.add(url);
							ctx.cachedContents.value.delete(url);
							removedPersistedLocked = persistedSet.delete(url) || removedPersistedLocked;
						} else if (!isIndexUrl(url)) tocLinks.add(url);
					}
					if (removedPersistedLocked && cacheBook) {
						ctx.persistedUrls.value = new Set(persistedSet);
						if (persistedSet.size > 0) persistCacheIndex(cacheBook, persistedSet);
						else deletePersistedCacheIndex(cacheBook);
					}
					cacheableChapterCount = tocLinks.size;
					taskList = Array.from(tocLinks).filter((url) => !ctx.cachedContents.value.has(url) && !persistedSet.has(url));
				}
				const estimatedTotal = taskList.length;
				task.requested = estimatedTotal;
				task.firstUrls = taskList.slice(0, 4);
				task.lastUrls = taskList.slice(-4);
				if (!isCurrent()) return;
				if (estimatedTotal === 0) {
					if (fullBook) {
						if (cacheableChapterCount === 0) {
							ctx.showToast("目录中没有可缓存的章节", "info");
							return;
						}
						ctx.persistCache();
						ctx.showToast("本书章节已全部缓存", "info");
					}
					return;
				}
				ctx.cacheProgress.value = {
					done: 0,
					total: estimatedTotal,
					failed: 0,
					running: true
				};
				let nextUrl = taskList.shift();
				let referer = ctx.chapters.value[ctx.chapters.value.length - 1]?.chapter.url || ctx.chapter.value?.url;
				let persistedSinceIndexWrite = 0;
				let hasWrittenIndexCheckpoint = false;
				const writtenUrls = new Set();
				while (isCurrent() && ctx.cacheProgress.value.running && nextUrl) {
					const targetUrl = normalizeUrlForFetch(nextUrl);
					task.currentUrl = targetUrl;
					if (seenUrls.has(targetUrl) || ctx.cachedContents.value.has(targetUrl) || persistedSet.has(targetUrl)) {
						ctx.cacheProgress.value = {
							...ctx.cacheProgress.value,
							done: ctx.cacheProgress.value.done + 1
						};
						nextUrl = taskList.shift() ?? null;
						continue;
					}
					let cleanupIframe;
					try {
						const parseDocument = async (doc) => {
							const controller = new AbortController();
							const abortMerge = () => {
								controller.abort();
								cleanupIframe?.();
							};
							ctx.cacheAbort.value = abortMerge;
							try {
								const parsed = await parseWithSectionMerge(getParser(), doc, targetUrl, { signal: controller.signal });
								return controller.signal.aborted || !isCurrent() ? null : parsed;
							} finally {
								if (ctx.cacheAbort.value === abortMerge) ctx.cacheAbort.value = null;
							}
						};
						let parsed = null;
						let blockReason = null;
						const reference = ctx.chapter.value;
						if ((ctx.rule.value ?? reference?.rule)?.advanced?.useIframe) {
							const loader = loadDocumentInIframe(targetUrl);
							ctx.cacheAbort.value = loader.abort;
							const loaded = await loader.promise;
							cleanupIframe = loaded?.cleanup;
							if (!isCurrent()) break;
							ctx.cacheAbort.value = null;
							if (loaded) {
								blockReason = getChapterDocumentBlockReason(loaded.doc);
								if (!blockReason) parsed = await parseDocument(loaded.doc);
							}
							cleanupIframe?.();
							cleanupIframe = void 0;
							if (!isCurrent()) break;
						}
						if (!parsed && !blockReason) {
							const apiDoc = reference ? await loadRuleApiDocument(targetUrl, reference) : null;
							if (!isCurrent()) break;
							let doc = apiDoc;
							if (!doc) {
								const { promise, abort } = fetchAndParseUrl(targetUrl, referer);
								ctx.cacheAbort.value = abort;
								const result = await promise;
								if (!isCurrent()) break;
								ctx.cacheAbort.value = null;
								if (result.error === "abort") break;
								doc = result.doc;
								if (!doc) recordDebugEvent("cache.chapter.failed", {
									url: targetUrl,
									reason: result.error,
									status: result.status
								});
							}
							if (doc) {
								blockReason = getChapterDocumentBlockReason(doc);
								if (!blockReason) parsed = await parseDocument(doc);
							}
						}
						if (!isCurrent()) break;
						const isToc = parsed && detectTocPage(parsed.content, parsed.url, reference?.url || targetUrl);
						if (blockReason || !parsed || isToc) {
							recordDebugEvent("cache.chapter.rejected", {
								url: targetUrl,
								reason: blockReason || (isToc ? "toc" : "parse-empty")
							});
							if (blockReason !== "vip") ctx.cacheFailedUrls.value.push(targetUrl);
							ctx.cacheProgress.value = {
								...ctx.cacheProgress.value,
								done: ctx.cacheProgress.value.done + 1,
								failed: ctx.cacheProgress.value.failed + (blockReason === "vip" ? 0 : 1)
							};
							nextUrl = taskList.shift() ?? null;
							continue;
						}
						const cached = {
							chapter: parsed,
							rule: parsed.rule,
							cachedAt: Date.now()
						};
						ctx.cachedContents.value.set(parsed.url, cached);
						seenUrls.add(parsed.url);
						trimCachedContents(ctx.cachedContents.value, 500);
						if (cacheBook) {
							if (persistCachedChapter(cacheBook, parsed.url, cached)) {
								persistedSet.add(parsed.url);
								writtenUrls.add(parsed.url);
								persistedSinceIndexWrite += 1;
								if (!hasWrittenIndexCheckpoint || persistedSinceIndexWrite >= 50) {
									if (persistCacheIndex(cacheBook, persistedSet)) {
										persistedSinceIndexWrite = 0;
										hasWrittenIndexCheckpoint = true;
									}
								}
							}
						}
						ctx.cacheProgress.value = {
							...ctx.cacheProgress.value,
							done: ctx.cacheProgress.value.done + 1
						};
						referer = parsed.url;
						nextUrl = taskList.shift() ?? (parsed.nextUrl ? normalizeUrlForFetch(parsed.nextUrl) : null);
						if (nextUrl && (isIndexUrl(nextUrl) || knownLockedUrls.has(normalizeUrlForFetch(nextUrl)))) nextUrl = null;
						if (taskList.length === 0 && nextUrl) {
							const normalizedNext = normalizeUrlForFetch(nextUrl);
							if (!seenUrls.has(normalizedNext) && !ctx.cachedContents.value.has(normalizedNext) && !persistedSet.has(normalizedNext)) ctx.cacheProgress.value = {
								...ctx.cacheProgress.value,
								total: ctx.cacheProgress.value.done + 1
							};
						}
					} finally {
						cleanupIframe?.();
					}
				}
				if (!isCurrent() || !ctx.cacheProgress.value.running) return;
				if (cacheBook && persistedSet.size > 0) ctx.persistedUrls.value = persistedSet;
				ctx.persistCache(writtenUrls);
				if (ctx.cacheProgress.value.failed > 0) ctx.showToast(`缓存完成，${ctx.cacheProgress.value.failed} 章失败`, "error", 3500);
				else ctx.showToast("离线缓存完成", "info", 2500);
			} catch (error) {
				if (isCurrent()) {
					console.error("[MNR] Cache task failed:", error);
					recordDebugEvent("cache.failed", {
						reason: "exception",
						error: String(error)
					}, "error");
					ctx.showToast("离线缓存失败，可重试", "error", 3500);
				}
			} finally {
				if (isCurrent()) {
					ctx.cacheAbort.value?.();
					ctx.cacheAbort.value = null;
					ctx.cacheProgress.value = {
						...ctx.cacheProgress.value,
						running: false
					};
				}
			}
		}
		function cancelCacheAll() {
			taskId += 1;
			ctx.cacheProgress.value = {
				done: 0,
				total: 0,
				failed: 0,
				running: false
			};
			ctx.cacheFailedUrls.value = [];
			ctx.cacheAbort.value?.();
			ctx.cacheAbort.value = null;
		}
		function retryFailedCache() {
			const urls = [...ctx.cacheFailedUrls.value];
			if (urls.length === 0) return Promise.resolve();
			return startCacheAll(urls);
		}
		return {
			startCacheAll,
			cancelCacheAll,
			retryFailedCache,
			getCacheDebugSnapshot: () => lastTask
		};
	}
	async function insertCachedChapter(ctx, cached, position) {
		const runId = ctx.runtime.viewId();
		const id = createChapterEntryId();
		const entry = {
			chapter: { ...cached.chapter },
			rule: cached.rule,
			id
		};
		if (position === "append") ctx.chapters.value.push(entry);
		else {
			ctx.chapters.value.unshift(entry);
			ctx.currentChapterIndex.value++;
		}
		ctx.originalContents.value.set(id, cached.chapter.content);
		ctx.originalTitles.value.set(id, {
			title: cached.chapter.title,
			bookTitle: cached.chapter.bookTitle
		});
		if (ctx.currentConversionMode.value !== "none") await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
		if (ctx.runtime.isViewStale(runId)) return false;
		trimDisplayChapters(ctx, position === "append");
		return true;
	}
	async function insertParsedChapter(ctx, load, parsed) {
		const runId = ctx.runtime.viewId();
		const id = createChapterEntryId();
		const entry = {
			chapter: parsed,
			rule: parsed.rule,
			id,
			sectionProgress: load.sectionMerge?.progress
		};
		if (load.isNext) ctx.chapters.value.push(entry);
		else {
			ctx.chapters.value.unshift(entry);
			ctx.currentChapterIndex.value++;
		}
		ctx.originalContents.value.set(id, parsed.content);
		ctx.originalTitles.value.set(id, {
			title: parsed.title,
			bookTitle: parsed.bookTitle
		});
		if (!load.sectionMerge) {
			ctx.cachedContents.value.set(parsed.url, {
				chapter: parsed,
				rule: parsed.rule,
				cachedAt: Date.now()
			});
			trimCachedContents(ctx.cachedContents.value, 500);
		}
		if (ctx.currentConversionMode.value !== "none") await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
		if (ctx.runtime.isViewStale(runId)) return null;
		trimDisplayChapters(ctx, load.isNext);
		return id;
	}
	async function rebuildChaptersFromCache(ctx, cached) {
		const runId = ctx.runtime.viewId();
		ctx.chapters.value = [];
		ctx.currentChapterIndex.value = 0;
		ctx.originalContents.value.clear();
		ctx.originalTitles.value.clear();
		const id = createChapterEntryId();
		ctx.chapters.value.push({
			chapter: { ...cached.chapter },
			rule: cached.rule,
			id
		});
		ctx.originalContents.value.set(id, cached.chapter.content);
		ctx.originalTitles.value.set(id, {
			title: cached.chapter.title,
			bookTitle: cached.chapter.bookTitle
		});
		if (ctx.currentConversionMode.value !== "none") await ctx.applyConversionToChapterEntry(id, ctx.currentConversionMode.value);
		if (ctx.runtime.isViewStale(runId)) return false;
		return true;
	}
	function trimDisplayChapters(ctx, isAppend) {
		if (ctx.chapters.value.length <= 6) return;
		if (isAppend && ctx.currentChapterIndex.value > 2) {
			const removed = ctx.chapters.value.shift();
			if (removed) {
				ctx.originalContents.value.delete(removed.id);
				ctx.originalTitles.value.delete(removed.id);
				ctx.currentChapterIndex.value = Math.max(0, ctx.currentChapterIndex.value - 1);
			}
			return;
		}
		if (!isAppend) {
			const removed = ctx.chapters.value.pop();
			if (removed) {
				ctx.originalContents.value.delete(removed.id);
				ctx.originalTitles.value.delete(removed.id);
			}
		}
	}
	function shouldPersistNavigationBlock(source) {
		return source === "manual";
	}
	function shouldUseNavigationFailureCooldown(source) {
		return source === "auto";
	}
	function boundaryMessage(refChapter, endMessage) {
		if (refChapter?.sectionProgress) return SECTION_MERGING_TOAST;
		if (refChapter?.sectionsIncomplete) return SECTION_INCOMPLETE_TOAST;
		return endMessage;
	}
	function prepareChapterLoad(ctx, direction, source) {
		const isNext = direction === "next";
		const refChapter = isNext ? ctx.chapters.value[ctx.chapters.value.length - 1] : ctx.chapters.value[0];
		const isLoadingRef = isNext ? ctx.isLoadingNext : ctx.isLoadingPrev;
		const pendingAbortRef = isNext ? ctx.pendingNextAbort : ctx.pendingPrevAbort;
		const endMessage = isNext ? "已经是最后一章了" : "已经是第一章了";
		const errorMessage = isNext ? "加载下一章失败" : "加载上一章失败";
		if (isLoadingRef.value) return null;
		const rawTargetUrl = isNext ? refChapter?.chapter.nextUrl : refChapter?.chapter.prevUrl;
		if (!rawTargetUrl || !refChapter) {
			if (source === "manual") ctx.showToast(boundaryMessage(refChapter, endMessage), "info");
			return null;
		}
		const targetUrl = normalizeUrlForFetch(rawTargetUrl);
		if (targetUrl !== rawTargetUrl) {
			if (isNext) refChapter.chapter.nextUrl = targetUrl;
			else refChapter.chapter.prevUrl = targetUrl;
		}
		if (refChapter.chapter.indexUrl && normalizeUrl(targetUrl) === normalizeUrl(refChapter.chapter.indexUrl)) {
			if (shouldPersistNavigationBlock(source)) ctx.blockedNavUrls.value.add(normalizeUrlForBlock(targetUrl));
			if (source === "manual") ctx.showToast(endMessage, "info");
			return null;
		}
		if (ctx.vipBlockedUrls.value.has(normalizeUrlForBlock(targetUrl))) {
			ctx.showToast(VIP_BLOCK_TOAST, "info", 3e3);
			return null;
		}
		const navKey = normalizeUrlForBlock(targetUrl);
		if (ctx.blockedNavUrls.value.has(navKey)) {
			if (source === "manual") ctx.showToast(endMessage, "info");
			return null;
		}
		const failure = ctx.navFailures.get(navKey);
		if (shouldUseNavigationFailureCooldown(source) && failure && Date.now() < failure.nextRetryAt) return null;
		if (ctx.loadedUrls.value.has(targetUrl)) return null;
		return {
			direction,
			endMessage,
			errorMessage,
			isLoadingRef,
			isNext,
			navKey,
			pendingAbortRef,
			refChapter,
			sectionMerge: null,
			targetUrl
		};
	}
	function validateTargetChapterUrl(ctx, load, source) {
		if (!isInvalidChapterUrl(load.targetUrl, load.refChapter.chapter.url)) return true;
		load.isLoadingRef.value = false;
		if (shouldPersistNavigationBlock(source)) ctx.blockedNavUrls.value.add(load.navKey);
		if (source === "manual") ctx.showToast(load.endMessage, "info");
		return false;
	}
	function createNavigation(ctx) {
		async function loadChapter(direction, source) {
			const runId = ctx.runtime.viewId();
			let sectionMergeCommitted = false;
			const load = prepareChapterLoad(ctx, direction, source);
			if (!load) return false;
			load.isLoadingRef.value = true;
			let outcome = "loaded";
			try {
				const cached = ctx.cachedContents.value.get(load.targetUrl);
				if (cached) return await insertCachedChapter(ctx, cached, load.isNext ? "append" : "prepend");
				if (ctx.persistedUrls.value.has(load.targetUrl)) {
					const persisted = ctx.getPersistedCachedChapter(load.targetUrl);
					if (persisted) {
						const sessionCached = {
							...persisted,
							cachedAt: Date.now()
						};
						ctx.cachedContents.value.set(load.targetUrl, sessionCached);
						trimCachedContents(ctx.cachedContents.value, 500);
						return await insertCachedChapter(ctx, sessionCached, load.isNext ? "append" : "prepend");
					}
				}
				if (load.pendingAbortRef.value) {
					load.pendingAbortRef.value();
					load.pendingAbortRef.value = null;
				}
				if (!validateTargetChapterUrl(ctx, load, source)) {
					outcome = "invalid-url";
					return false;
				}
				const referer = load.refChapter.chapter.url;
				const parser = getParser();
				let cleanupIframe = null;
				const recordLoadFailure = () => {
					const count = recordNavFailure(ctx.navFailures, load.navKey, { maxFailures: 200 });
					if (source === "manual" || count === 1) ctx.showToast(load.errorMessage, "error", 2500);
				};
				let parsed = null;
				if (load.refChapter.rule?.advanced?.useIframe) {
					const iframeLoader = loadDocumentInIframe(load.targetUrl);
					const abort = iframeLoader.abort;
					if (ctx.runtime.isViewStale(runId)) {
						abort();
						return false;
					}
					load.pendingAbortRef.value = abort;
					const iframeResult = await iframeLoader.promise;
					if (ctx.runtime.isViewStale(runId)) {
						iframeResult?.cleanup();
						abort();
						return false;
					}
					clearPendingAbort(load, abort);
					cleanupIframe = iframeResult?.cleanup || null;
					if (iframeResult?.doc) {
						let iframeParsed = null;
						try {
							iframeParsed = await parseCandidateDocument(ctx, load, parser, iframeResult.doc, runId, referer, source);
						} finally {
							cleanupIframe?.();
							cleanupIframe = null;
						}
						if (iframeParsed === "abort" || iframeParsed === "blocked") {
							outcome = iframeParsed;
							return false;
						}
						parsed = iframeParsed;
					}
				}
				cleanupIframe?.();
				if (!parsed) {
					const fetchDoc = await loadFetchDocument(ctx, load, runId, referer);
					if (fetchDoc === "abort") {
						outcome = "abort";
						return false;
					}
					if (!fetchDoc) {
						outcome = "fetch-failed";
						recordLoadFailure();
						return false;
					}
					const fetchParsed = await parseCandidateDocument(ctx, load, parser, fetchDoc, runId, referer, source);
					if (fetchParsed === "abort" || fetchParsed === "blocked") {
						outcome = fetchParsed;
						return false;
					}
					parsed = fetchParsed;
				}
				if (ctx.runtime.isViewStale(runId)) return false;
				if (!parsed) {
					outcome = "parse-empty";
					recordLoadFailure();
					return false;
				}
				if (parsed.prevUrl) parsed.prevUrl = normalizeUrlForFetch(parsed.prevUrl);
				if (parsed.nextUrl) parsed.nextUrl = normalizeUrlForFetch(parsed.nextUrl);
				if (parsed.indexUrl) parsed.indexUrl = normalizeUrlForFetch(parsed.indexUrl);
				if (detectTocPage(parsed.content, load.targetUrl, load.refChapter.chapter.url)) {
					outcome = "toc";
					if (shouldPersistNavigationBlock(source)) ctx.blockedNavUrls.value.add(load.navKey);
					if (source === "manual") ctx.showToast(load.endMessage, "info");
					return false;
				}
				if (!load.isNext) {
					if (parsed.nextUrl && normalizeUrl(parsed.nextUrl) === normalizeUrl(load.refChapter.chapter.url)) {} else if (parsed.prevUrl && !parsed.nextUrl) {
						outcome = "invalid-prev";
						if (shouldPersistNavigationBlock(source)) ctx.blockedNavUrls.value.add(load.navKey);
						return false;
					}
				}
				clearNavFailure(ctx.navFailures, load.navKey);
				const entryId = await insertParsedChapter(ctx, load, parsed);
				if (!entryId) return false;
				const merge = load.sectionMerge;
				if (merge) {
					beginChapterSections(ctx, entryId, merge.progress, merge.abort);
					merge.commit(entryId);
					sectionMergeCommitted = true;
				}
				return true;
			} catch (e) {
				outcome = "exception";
				if (!ctx.runtime.isViewStale(runId)) {
					console.error(`[MNR] Failed to load ${direction} chapter:`, e);
					ctx.setError(load.errorMessage);
				}
				return false;
			} finally {
				if (!sectionMergeCommitted) load.sectionMerge?.reject();
				recordDebugEvent("chapter.load", {
					url: load.targetUrl,
					direction,
					source,
					outcome: ctx.runtime.isViewStale(runId) ? "stale" : outcome
				});
				if (!ctx.runtime.isViewStale(runId)) load.isLoadingRef.value = false;
			}
		}
		async function loadNextChapter(source = "auto") {
			return loadChapter("next", source);
		}
		async function loadPrevChapter(source = "manual") {
			return loadChapter("prev", source);
		}
		async function rebuildChaptersAround(targetUrl) {
			ctx.runtime.bumpView();
			const url = normalizeUrlForFetch(targetUrl);
			ctx.pendingNextAbort.value?.();
			ctx.pendingNextAbort.value = null;
			ctx.pendingPrevAbort.value?.();
			ctx.pendingPrevAbort.value = null;
			ctx.reloadAbort.value?.();
			ctx.reloadAbort.value = null;
			cancelAllSectionMerges(ctx);
			ctx.isLoadingPrev.value = false;
			ctx.isLoadingNext.value = false;
			let cached = ctx.cachedContents.value.get(url);
			if (!cached && ctx.persistedUrls.value.has(url)) {
				const persisted = ctx.getPersistedCachedChapter(url);
				if (persisted) {
					cached = {
						...persisted,
						cachedAt: Date.now()
					};
					ctx.cachedContents.value.set(url, cached);
					trimCachedContents(ctx.cachedContents.value, 500);
				}
			}
			if (!cached) return false;
			return rebuildChaptersFromCache(ctx, cached);
		}
		async function reloadCurrentChapter() {
			const runId = ctx.runtime.viewId();
			const current = ctx.chapters.value[ctx.currentChapterIndex.value];
			if (!current) return;
			const url = current.chapter.url;
			const abandonedMerge = ctx.sectionMerges.value.has(current.id);
			cancelChapterSections(ctx, current.id, "aborted");
			if (abandonedMerge) current.sectionsIncomplete = true;
			ctx.showToast("正在重新加载...", "info");
			ctx.reloadAbort.value?.();
			ctx.reloadAbort.value = null;
			const { promise, abort } = fetchAndParseUrl(url, url);
			if (!ctx.runtime.isViewStale(runId)) ctx.reloadAbort.value = abort;
			const result = await promise;
			if (ctx.runtime.isViewStale(runId)) {
				abort();
				return;
			}
			if (ctx.reloadAbort.value === abort) ctx.reloadAbort.value = null;
			if (result.error === "abort") return;
			if (!result.doc) {
				ctx.showToast("重新加载失败", "error");
				return;
			}
			const blockReason = getChapterDocumentBlockReason(result.doc);
			if (blockReason === "cloudflare") {
				ctx.showToast("Cloudflare 验证页面，请完成验证后重试", "info", 4e3);
				return;
			}
			if (blockReason === "vip") {
				ctx.vipBlockedUrls.value.add(normalizeUrlForBlock(url));
				ctx.showToast(VIP_BLOCK_TOAST, "info", 3e3);
				return;
			}
			const parser = getParser();
			const controller = new AbortController();
			const abortMerge = () => controller.abort();
			ctx.reloadAbort.value = abortMerge;
			let parsed;
			try {
				parsed = await parseWithSectionMerge(parser, result.doc, url, { signal: controller.signal });
			} finally {
				if (ctx.reloadAbort.value === abortMerge) ctx.reloadAbort.value = null;
			}
			if (controller.signal.aborted) return;
			if (ctx.runtime.isViewStale(runId)) return;
			if (parsed) {
				if (parsed.prevUrl) parsed.prevUrl = normalizeUrlForFetch(parsed.prevUrl);
				if (parsed.nextUrl) parsed.nextUrl = normalizeUrlForFetch(parsed.nextUrl);
				if (parsed.indexUrl) parsed.indexUrl = normalizeUrlForFetch(parsed.indexUrl);
				current.chapter = parsed;
				current.rule = parsed.rule || current.rule;
				delete current.sectionsIncomplete;
				ctx.originalContents.value.set(current.id, parsed.content);
				ctx.originalTitles.value.set(current.id, {
					title: parsed.title,
					bookTitle: parsed.bookTitle
				});
				ctx.cachedContents.value.set(parsed.url, {
					chapter: parsed,
					rule: current.rule,
					cachedAt: Date.now()
				});
				if (ctx.currentConversionMode.value !== "none") await ctx.applyConversionToChapterEntry(current.id, ctx.currentConversionMode.value);
				ctx.showToast("规则已应用", "info");
			} else ctx.showToast("解析失败", "error");
		}
		function insertCachedChapterForContext(cached, position) {
			return insertCachedChapter(ctx, cached, position);
		}
		return {
			sectionDelivery: createSectionMergeSink(ctx),
			appendChapterSection: (entryId, delta) => appendChapterSection(ctx, entryId, delta),
			beginChapterSections: (entryId, progress, abort) => beginChapterSections(ctx, entryId, progress, abort),
			cancelAllSectionMerges: () => cancelAllSectionMerges(ctx),
			cancelChapterSections: (entryId, reason) => cancelChapterSections(ctx, entryId, reason),
			completeChapterSections: (entryId, chapter, rule, info) => completeChapterSections(ctx, entryId, chapter, rule, info),
			insertCachedChapter: insertCachedChapterForContext,
			loadChapter,
			loadNextChapter,
			loadPrevChapter,
			rebuildChaptersAround,
			reloadCurrentChapter
		};
	}
	function createReaderRuntime() {
		let sessionId = 0;
		let viewId = 0;
		return {
			bumpSession: () => {
				sessionId += 1;
				viewId += 1;
				return sessionId;
			},
			bumpView: () => {
				viewId += 1;
				return viewId;
			},
			isSessionStale: (runId) => runId !== sessionId,
			isViewStale: (runId) => runId !== viewId,
			sessionId: () => sessionId,
			viewId: () => viewId
		};
	}
	var useReaderStore = defineStore("reader", () => {
		const isActive = ref(false);
		const isLoadingPrev = ref(false);
		const isLoadingNext = ref(false);
		const chapters = ref([]);
		const currentChapterIndex = ref(0);
		const error = ref(null);
		const toastType = ref("error");
		const toastTimer = ref(null);
		const scrollPercent = ref(0);
		const loadedUrls = computed(() => new Set(chapters.value.map((entry) => entry.chapter.url)));
		const vipBlockedUrls = ref(new Set());
		const blockedNavUrls = ref(new Set());
		const originalContents = ref(new Map());
		const originalTitles = ref(new Map());
		const currentConversionMode = ref("none");
		const pendingNextAbort = ref(null);
		const pendingPrevAbort = ref(null);
		const navFailures = new Map();
		const cacheProgress = ref({
			done: 0,
			total: 0,
			failed: 0,
			running: false
		});
		const cacheFailedUrls = ref([]);
		const cacheAbort = ref(null);
		const reloadAbort = ref(null);
		const toc = ref([]);
		const tocOriginal = ref([]);
		const tocLoading = ref(false);
		const tocAbort = ref(null);
		const cachedContents = ref(new Map());
		const sectionMerges = ref(new Map());
		const persistedUrls = ref(new Set());
		const runtime = createReaderRuntime();
		const chapter = computed(() => chapters.value[currentChapterIndex.value]?.chapter || null);
		const rule = computed(() => chapters.value[currentChapterIndex.value]?.rule || null);
		const bookTitle = computed(() => chapter.value?.bookTitle || "");
		function isVipBlockedUrl(url) {
			return vipBlockedUrls.value.has(normalizeUrlForBlock(url));
		}
		function getVipBlockedToast(direction) {
			const entry = direction === "next" ? chapters.value[chapters.value.length - 1] : chapters.value[0];
			const navUrl = direction === "next" ? entry?.chapter.nextUrl : entry?.chapter.prevUrl;
			if (!navUrl) return null;
			return isVipBlockedUrl(navUrl) ? VIP_BLOCK_TOAST : null;
		}
		const isTailSectionMerging = computed(() => !!chapters.value[chapters.value.length - 1]?.sectionProgress);
		const isTailChapterIncomplete = computed(() => {
			const lastChapter = chapters.value[chapters.value.length - 1];
			return !!lastChapter?.sectionProgress || !!lastChapter?.sectionsIncomplete;
		});
		const hasNext = computed(() => {
			const nextUrl = chapters.value[chapters.value.length - 1]?.chapter.nextUrl;
			if (!nextUrl) return false;
			if (blockedNavUrls.value.has(normalizeUrlForBlock(nextUrl))) return false;
			return !isVipBlockedUrl(nextUrl);
		});
		const hasPrev = computed(() => {
			const prevUrl = chapters.value[0]?.chapter.prevUrl;
			if (!prevUrl) return false;
			if (blockedNavUrls.value.has(normalizeUrlForBlock(prevUrl))) return false;
			return !isVipBlockedUrl(prevUrl);
		});
		const normalizedTocUrls = computed(() => toc.value.map((entry) => normalizeUrlForFetch(entry.url)));
		const tocStatusMap = computed(() => {
			const currentUrl = chapter.value?.url;
			const map = new Map();
			for (const url of normalizedTocUrls.value) map.set(url, {
				isCached: loadedUrls.value.has(url) || cachedContents.value.has(url) || persistedUrls.value.has(url),
				isPersisted: persistedUrls.value.has(url),
				isCurrent: url === currentUrl
			});
			return map;
		});
		const tocWithStatus = computed(() => {
			const urls = normalizedTocUrls.value;
			const statusMap = tocStatusMap.value;
			return toc.value.map((entry, i) => {
				const url = urls[i];
				const status = statusMap.get(url) || {
					isCached: false,
					isPersisted: false,
					isCurrent: false
				};
				return {
					...entry,
					url,
					...status
				};
			});
		});
		function syncCurrentHostPage() {
			syncHostPageToChapter(chapter.value, currentChapterIndex.value);
		}
		function setError(msg) {
			showToast(msg, "error", 3e3);
		}
		function showToast(msg, type = "info", duration = 2e3) {
			recordDebugEvent("reader.toast", {
				message: msg,
				type,
				duration
			}, type);
			error.value = msg;
			toastType.value = type;
			if (toastTimer.value) window.clearTimeout(toastTimer.value);
			toastTimer.value = window.setTimeout(() => {
				error.value = null;
				toastTimer.value = null;
			}, duration);
		}
		function clearError() {
			error.value = null;
			if (toastTimer.value) {
				window.clearTimeout(toastTimer.value);
				toastTimer.value = null;
			}
		}
		let conversionId = 0;
		let tocConversionId = 0;
		async function applyConversionToChapterEntry$1(entryId, mode) {
			const requestId = conversionId;
			const viewId = runtime.viewId();
			await applyConversionToChapterEntry(chapters.value, originalContents.value, originalTitles.value, entryId, mode, () => requestId === conversionId && mode === currentConversionMode.value && !runtime.isViewStale(viewId));
		}
		async function applyTocConversion$1(mode) {
			const requestId = ++tocConversionId;
			const sessionId = runtime.sessionId();
			const source = tocOriginal.value;
			const converted = await applyTocConversion(source, mode, chapter.value?.sourceScript);
			if (requestId === tocConversionId && !runtime.isSessionStale(sessionId) && source === tocOriginal.value && mode === currentConversionMode.value) toc.value = converted;
		}
		async function applyTextConversion(mode) {
			const requestId = ++conversionId;
			const sessionId = runtime.sessionId();
			const isCurrent = () => requestId === conversionId && !runtime.isSessionStale(sessionId);
			currentConversionMode.value = mode;
			for (const entry of chapters.value) {
				await applyConversionToChapterEntry$1(entry.id, mode);
				if (!isCurrent()) return;
			}
			await applyTocConversion$1(mode);
			if (!isCurrent()) return;
			syncCurrentHostPage();
		}
		function getPersistedCachedChapterForCurrentBook(url) {
			const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
			if (!cacheBook) return null;
			return getPersistedCachedChapter(cacheBook, url);
		}
		function persistCache$1(skipChapterUrls) {
			const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
			if (!cacheBook) return;
			persistedUrls.value = persistCache(cacheBook, cachedContents.value, persistedUrls.value, skipChapterUrls);
		}
		function restoreCache$1() {
			const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
			if (!cacheBook) return;
			const restored = restoreCache(cacheBook);
			if (restored) {
				persistedUrls.value = restored;
				touchPersistedCache(cacheBook);
			}
			cleanupExpiredCaches({ currentBookId: cacheBook.bookId });
		}
		function clearPersistedCache$1() {
			const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
			if (!cacheBook) return;
			clearPersistedCache(cacheBook, persistedUrls.value);
			persistedUrls.value.clear();
		}
		const nav = createNavigation({
			chapters,
			currentChapterIndex,
			isLoadingNext,
			isLoadingPrev,
			pendingNextAbort,
			pendingPrevAbort,
			reloadAbort,
			loadedUrls,
			vipBlockedUrls,
			blockedNavUrls,
			cachedContents,
			sectionMerges,
			persistedUrls,
			originalContents,
			originalTitles,
			currentConversionMode,
			navFailures,
			runtime,
			showToast,
			setError,
			applyConversionToChapterEntry: applyConversionToChapterEntry$1,
			getPersistedCachedChapter: getPersistedCachedChapterForCurrentBook
		});
		const tocActions = createTocActions({
			toc,
			tocOriginal,
			tocLoading,
			tocAbort,
			chapters,
			chapter,
			rule,
			currentConversionMode,
			runtime,
			showToast,
			applyTocConversion: applyTocConversion$1,
			loadTocEntriesPaged
		});
		const { startCacheAll, cancelCacheAll, retryFailedCache, getCacheDebugSnapshot } = createCacheAll({
			cacheProgress,
			cacheFailedUrls,
			cacheAbort,
			cachedContents,
			persistedUrls,
			tocOriginal,
			chapter,
			rule,
			chapters,
			runtime,
			loadToc: tocActions.loadToc,
			restoreCache: restoreCache$1,
			persistCache: persistCache$1,
			showToast
		});
		function cancelAllInFlight() {
			pendingNextAbort.value?.();
			pendingNextAbort.value = null;
			pendingPrevAbort.value?.();
			pendingPrevAbort.value = null;
			cancelCacheAll();
			reloadAbort.value?.();
			reloadAbort.value = null;
			tocAbort.value?.();
			tocAbort.value = null;
			nav.cancelAllSectionMerges();
			isLoadingPrev.value = false;
			isLoadingNext.value = false;
			tocLoading.value = false;
		}
		function clearAllData() {
			sectionMerges.value.clear();
			chapters.value = [];
			currentChapterIndex.value = 0;
			clearError();
			vipBlockedUrls.value.clear();
			blockedNavUrls.value.clear();
			navFailures.clear();
			originalContents.value.clear();
			originalTitles.value.clear();
			cachedContents.value.clear();
			persistedUrls.value.clear();
			toc.value = [];
			tocOriginal.value = [];
		}
		function activate() {
			recordDebugEvent("reader.activate");
			isActive.value = true;
			clearError();
		}
		function deactivate() {
			recordDebugEvent("reader.deactivate");
			runtime.bumpSession();
			isActive.value = false;
			cancelAllInFlight();
			clearAllData();
		}
		function setChapter(newChapter, newRule) {
			recordDebugEvent("reader.setChapter", {
				url: newChapter.url,
				title: newChapter.title,
				ruleId: newRule?.id || newChapter.rule?.id
			});
			runtime.bumpSession();
			cancelAllInFlight();
			clearAllData();
			const effectiveRule = newRule || newChapter.rule;
			if (newChapter.url) newChapter.url = normalizeUrlForFetch(newChapter.url);
			if (newChapter.prevUrl) newChapter.prevUrl = normalizeUrlForFetch(newChapter.prevUrl);
			if (newChapter.nextUrl) newChapter.nextUrl = normalizeUrlForFetch(newChapter.nextUrl);
			if (newChapter.indexUrl) newChapter.indexUrl = normalizeUrlForFetch(newChapter.indexUrl);
			const id = createChapterEntryId();
			chapters.value = [{
				chapter: newChapter,
				rule: effectiveRule,
				id
			}];
			originalContents.value.set(id, newChapter.content);
			originalTitles.value.set(id, {
				title: newChapter.title,
				bookTitle: newChapter.bookTitle
			});
			cachedContents.value.set(newChapter.url, {
				chapter: newChapter,
				rule: effectiveRule,
				cachedAt: Date.now()
			});
			if (currentConversionMode.value !== "none") applyConversionToChapterEntry$1(id, currentConversionMode.value).then(() => {
				syncCurrentHostPage();
			});
			syncCurrentHostPage();
			restoreCache$1();
			return id;
		}
		function updateScroll(percent) {
			scrollPercent.value = Math.max(0, Math.min(100, percent));
		}
		function setCurrentChapter(index) {
			if (index < 0 || index >= chapters.value.length) return;
			if (currentChapterIndex.value === index) return;
			recordDebugEvent("reader.setCurrentChapter", {
				from: currentChapterIndex.value,
				to: index,
				url: chapters.value[index]?.chapter.url
			});
			currentChapterIndex.value = index;
			syncCurrentHostPage();
		}
		async function loadNextChapter(source = "auto") {
			recordDebugEvent("reader.loadNext.start", {
				source,
				currentIndex: currentChapterIndex.value,
				currentUrl: chapter.value?.url,
				targetUrl: chapters.value[chapters.value.length - 1]?.chapter.nextUrl
			});
			const ok = await nav.loadNextChapter(source);
			recordDebugEvent("reader.loadNext.end", {
				source,
				ok,
				chapterCount: chapters.value.length,
				currentIndex: currentChapterIndex.value
			});
			return ok;
		}
		async function loadPrevChapter(source = "manual") {
			recordDebugEvent("reader.loadPrev.start", {
				source,
				currentIndex: currentChapterIndex.value,
				currentUrl: chapter.value?.url,
				targetUrl: chapters.value[0]?.chapter.prevUrl
			});
			const ok = await nav.loadPrevChapter(source);
			recordDebugEvent("reader.loadPrev.end", {
				source,
				ok,
				chapterCount: chapters.value.length,
				currentIndex: currentChapterIndex.value
			});
			return ok;
		}
		async function rebuildChaptersAround(targetUrl) {
			recordDebugEvent("reader.rebuildAround.start", { targetUrl });
			const ok = await nav.rebuildChaptersAround(targetUrl);
			if (ok) syncCurrentHostPage();
			recordDebugEvent("reader.rebuildAround.end", {
				targetUrl,
				ok
			});
			return ok;
		}
		async function reloadCurrentChapter() {
			await nav.reloadCurrentChapter();
			syncCurrentHostPage();
		}
		function getDebugSnapshot() {
			const currentEntry = chapters.value[currentChapterIndex.value] || null;
			const firstEntry = chapters.value[0] || null;
			const lastEntry = chapters.value[chapters.value.length - 1] || null;
			const cacheBook = getCurrentBookCacheKey(chapter.value?.indexUrl);
			return {
				active: isActive.value,
				loading: {
					prev: isLoadingPrev.value,
					next: isLoadingNext.value,
					toc: tocLoading.value,
					pendingNext: Boolean(pendingNextAbort.value),
					pendingPrev: Boolean(pendingPrevAbort.value),
					pendingCache: Boolean(cacheAbort.value),
					pendingReload: Boolean(reloadAbort.value),
					pendingToc: Boolean(tocAbort.value)
				},
				toast: {
					message: error.value,
					type: toastType.value
				},
				view: {
					currentChapterIndex: currentChapterIndex.value,
					chapterCount: chapters.value.length,
					scrollPercent: scrollPercent.value,
					hasNext: hasNext.value,
					hasPrev: hasPrev.value,
					hasIndex: Boolean(chapter.value?.indexUrl),
					confidence: chapter.value?.confidence || 0,
					method: chapter.value?.method || "detection",
					conversionMode: currentConversionMode.value,
					runtimeSessionId: runtime.sessionId(),
					runtimeViewId: runtime.viewId()
				},
				current: summarizeChapterForDebug(currentEntry),
				first: summarizeChapterForDebug(firstEntry),
				last: summarizeChapterForDebug(lastEntry),
				navigation: {
					loadedUrls: summarizeUrlSet(loadedUrls.value),
					vipBlockedUrls: summarizeUrlSet(vipBlockedUrls.value),
					blockedNavUrls: summarizeUrlSet(blockedNavUrls.value),
					navFailures: {
						count: navFailures.size,
						tail: Array.from(navFailures.entries()).slice(-8).map(([url, failure]) => ({
							url: redactUrl(url),
							count: failure.count,
							retryInMs: Math.max(0, failure.nextRetryAt - Date.now())
						}))
					}
				},
				cache: {
					currentBook: cacheBook ? {
						bookId: cacheBook.bookId,
						indexUrl: redactUrl(cacheBook.indexUrl)
					} : null,
					progress: { ...cacheProgress.value },
					task: getCacheDebugSnapshot(),
					memory: {
						count: cachedContents.value.size,
						tail: Array.from(cachedContents.value.entries()).slice(-8).map(([url, cached]) => ({
							url: redactUrl(url),
							title: cached.chapter.title,
							contentChars: cached.chapter.content.length,
							textChars: htmlTextLength(cached.chapter.content),
							cachedAt: cached.cachedAt
						}))
					},
					persistedUrls: summarizeUrlSet(persistedUrls.value)
				},
				toc: {
					lastLoad: tocActions.getLoadDiagnostic(),
					firstUrls: tocOriginal.value.slice(0, 4).map((entry) => redactUrl(entry.url)),
					lastUrls: tocOriginal.value.slice(-4).map((entry) => redactUrl(entry.url)),
					loading: tocLoading.value,
					count: toc.value.length,
					originalCount: tocOriginal.value.length,
					currentMatched: tocWithStatus.value.some((entry) => entry.isCurrent),
					cachedCount: tocWithStatus.value.filter((entry) => entry.isCached).length,
					persistedCount: tocWithStatus.value.filter((entry) => entry.isPersisted).length
				},
				originals: {
					contentCount: originalContents.value.size,
					titleCount: originalTitles.value.size
				}
			};
		}
		function summarizeChapterForDebug(entry) {
			if (!entry) return null;
			const chapterData = entry.chapter;
			return {
				id: entry.id,
				url: redactUrl(chapterData.url),
				title: chapterData.title,
				bookTitle: chapterData.bookTitle || null,
				prevUrl: redactUrl(chapterData.prevUrl),
				nextUrl: redactUrl(chapterData.nextUrl),
				indexUrl: redactUrl(chapterData.indexUrl),
				confidence: chapterData.confidence,
				method: chapterData.method,
				ruleId: entry.rule?.id || chapterData.rule?.id || null,
				contentChars: chapterData.content.length,
				textChars: htmlTextLength(chapterData.content),
				rawContentChars: chapterData.rawContent.length,
				contentHash: hashText(chapterData.content)
			};
		}
		function summarizeUrlSet(values) {
			return {
				count: values.size,
				tail: tailStrings(values)
			};
		}
		function $reset() {
			runtime.bumpSession();
			isActive.value = false;
			cancelAllInFlight();
			clearAllData();
			scrollPercent.value = 0;
			currentConversionMode.value = "none";
		}
		return {
			isActive,
			isLoadingPrev,
			isLoadingNext,
			chapters,
			currentChapterIndex,
			currentConversionMode,
			chapter,
			rule,
			error,
			toastType,
			scrollPercent,
			cacheProgress,
			toc,
			tocLoading,
			cachedContents,
			persistedUrls,
			bookTitle,
			hasNext,
			hasPrev,
			isTailChapterIncomplete,
			isTailSectionMerging,
			tocWithStatus,
			activate,
			deactivate,
			setChapter,
			setCurrentChapter,
			loadNextChapter,
			loadPrevChapter,
			setError,
			showToast,
			getVipBlockedToast,
			clearError,
			updateScroll,
			getDebugSnapshot,
			applyTextConversion,
			startCacheAll,
			cancelCacheAll,
			retryFailedCache,
			loadToc: tocActions.loadToc,
			sectionDelivery: nav.sectionDelivery,
			appendChapterSection: nav.appendChapterSection,
			beginChapterSections: nav.beginChapterSections,
			cancelChapterSections: nav.cancelChapterSections,
			completeChapterSections: nav.completeChapterSections,
			rebuildChaptersAround,
			reloadCurrentChapter,
			persistCache: persistCache$1,
			restoreCache: restoreCache$1,
			clearPersistedCache: clearPersistedCache$1,
			$reset
		};
	});
	function isInputElement(target) {
		const element = target;
		const tagName = element?.tagName;
		return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || element?.isContentEditable === true;
	}
	function isEditableEvent(e) {
		const path = typeof e.composedPath === "function" ? e.composedPath() : [];
		if (path.some(isInputElement)) return true;
		if (path.length === 0 && isInputElement(e.target)) return true;
		return isInputElement(getDeepActiveElement());
	}
	var SPACE_CONTROL_SELECTOR = "button, summary, [role=\"button\"]";
	var ENTER_CONTROL_SELECTOR = `${SPACE_CONTROL_SELECTOR}, a[href], [role="link"]`;
	function isControlActivationEvent(e, key) {
		if (key !== "enter" && key !== " ") return false;
		const selector = key === "enter" ? ENTER_CONTROL_SELECTOR : SPACE_CONTROL_SELECTOR;
		return (typeof e.composedPath === "function" ? e.composedPath() : [e.target]).some((node) => typeof node?.matches === "function" && node.matches(selector));
	}
	function hasModifiers(e) {
		return e.ctrlKey || e.altKey || e.metaKey;
	}
	function useKeyboardShortcuts(shortcuts, options = {}) {
		const { enabled, ignoreInputs = true, ignoreModifiers = true } = options;
		const isEnabled = computed(() => {
			if (enabled === void 0) return true;
			return unref(enabled);
		});
		function handleKeyDown(ev) {
			const e = ev;
			if (!isEnabled.value) return;
			if (e.isComposing) return;
			const key = e.key.toLowerCase();
			const editableEvent = isEditableEvent(e);
			if (isControlActivationEvent(e, key)) return;
			for (const shortcut of shortcuts) {
				if (!(Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key]).map((k) => k.toLowerCase()).includes(key)) continue;
				if (ignoreInputs && !shortcut.allowInInputs && editableEvent) continue;
				if (ignoreModifiers && !shortcut.allowModifiers && hasModifiers(e)) continue;
				if (shortcut.preventDefault) e.preventDefault();
				if (shortcut.stopPropagation) {
					e.stopPropagation();
					e.stopImmediatePropagation();
				}
				if (e.repeat && shortcut.allowRepeat === false) return;
				shortcut.handler(e);
				return;
			}
		}
		useEventListener("keydown", handleKeyDown, { capture: true });
	}
	var STORAGE_KEY = "mnr-reading-positions";
	var MAX_SAVED_POSITIONS = 200;
	var PERSIST_INTERVAL_MS = 4e3;
	var positionCache = null;
	var updateQueue = Promise.resolve();
	var persistQueue = Promise.resolve();
	var persistTimer = null;
	var dirty = false;
	function normalizeChapterUrl(url) {
		try {
			const normalized = new URL(url);
			normalized.hash = "";
			return normalized.toString();
		} catch {
			return url;
		}
	}
	function parsePositions(stored) {
		if (typeof stored === "string") stored = JSON.parse(stored);
		if (!stored || typeof stored !== "object") return {};
		const positions = {};
		for (const [url, value] of Object.entries(stored)) {
			const position = value;
			if (!position || !Number.isFinite(position.percent) || !Number.isFinite(position.updatedAt)) continue;
			positions[url] = {
				percent: position.percent,
				updatedAt: position.updatedAt
			};
		}
		return positions;
	}
	function trimPositions(positions) {
		const entries = Object.entries(positions);
		if (entries.length <= MAX_SAVED_POSITIONS) return positions;
		const trimmed = {};
		for (const [url, position] of entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt).slice(0, MAX_SAVED_POSITIONS)) trimmed[url] = position;
		return trimmed;
	}
	function mergePositions(...sources) {
		const merged = {};
		for (const source of sources) for (const [url, position] of Object.entries(source)) {
			const existing = merged[url];
			if (!existing || position.updatedAt >= existing.updatedAt) merged[url] = position;
		}
		return trimPositions(merged);
	}
	async function readStoredPositions() {
		try {
			let stored = null;
			if (typeof GM_getValue !== "undefined") stored = await GM_getValue(STORAGE_KEY, null);
			else if (typeof localStorage !== "undefined") stored = localStorage.getItem(STORAGE_KEY);
			return parsePositions(stored);
		} catch (error) {
			console.error("[MNR] Failed to load reading positions:", error);
			return {};
		}
	}
	async function loadPositions(refresh = false) {
		if (positionCache && !refresh) return positionCache;
		positionCache = mergePositions(await readStoredPositions(), positionCache ?? {});
		return positionCache;
	}
	async function persistPositions(serialized) {
		if (typeof GM_setValue !== "undefined") await GM_setValue(STORAGE_KEY, serialized);
		else if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, serialized);
	}
	async function getReadingPosition(url) {
		if (!url) return null;
		const position = (await loadPositions(true))[normalizeChapterUrl(url)];
		if (!position || !Number.isFinite(position.percent)) return null;
		return Math.max(0, Math.min(100, position.percent));
	}
	function saveReadingPosition(url, percent) {
		if (!url || !Number.isFinite(percent)) return;
		const normalizedUrl = normalizeChapterUrl(url);
		const normalizedPercent = Math.max(0, Math.min(100, Math.round(percent * 10) / 10));
		updateQueue = updateQueue.then(async () => {
			const positions = await loadPositions();
			const isNewPosition = !(normalizedUrl in positions);
			positions[normalizedUrl] = {
				percent: normalizedPercent,
				updatedAt: Date.now()
			};
			if (isNewPosition && Object.keys(positions).length > MAX_SAVED_POSITIONS) positionCache = trimPositions(positions);
			dirty = true;
			schedulePersist();
		}).catch((error) => console.error("[MNR] Failed to update reading position:", error));
	}
	function schedulePersist() {
		if (persistTimer) return;
		persistTimer = setTimeout(() => {
			persistTimer = null;
			flushReadingPositions();
		}, PERSIST_INTERVAL_MS);
	}
	async function flushReadingPositions() {
		await updateQueue;
		if (persistTimer) {
			clearTimeout(persistTimer);
			persistTimer = null;
		}
		if (!dirty) return persistQueue;
		const snapshot = mergePositions(await loadPositions());
		dirty = false;
		persistQueue = persistQueue.then(async () => {
			const merged = mergePositions(await readStoredPositions(), snapshot);
			await persistPositions(JSON.stringify(merged));
			positionCache = mergePositions(merged, positionCache ?? {});
		}).catch((error) => console.error("[MNR] Failed to save reading positions:", error));
		return persistQueue;
	}
	function getChapterPercent(mainEl, chapterEl, complete) {
		const top = mainEl.scrollTop + chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
		if (complete && chapterEl.offsetHeight <= mainEl.clientHeight) return 100;
		const height = Math.max(1, chapterEl.offsetHeight - mainEl.clientHeight * .5);
		return Math.max(0, Math.min(100, (mainEl.scrollTop - top) / height * 100));
	}
	function useReaderPosition(options) {
		const { mainRef, chapterRefs, readerStore, isNavigating } = options;
		const currentEntry = () => readerStore.chapters[readerStore.currentChapterIndex];
		const initialEntryId = currentEntry()?.id;
		let state = initialEntryId ? "pending" : "ready";
		let cancelledScrollTop = 0;
		let savedPercent = null;
		let disposed = false;
		let lastSaveAt = 0;
		function cancelRestore() {
			if (state !== "pending") return;
			state = "cancelled";
			cancelledScrollTop = mainRef.value?.scrollTop ?? 0;
		}
		function allowSaving() {
			state = "ready";
		}
		function canSave() {
			if (state === "cancelled" && mainRef.value && mainRef.value.scrollTop !== cancelledScrollTop) allowSaving();
			return state === "ready";
		}
		async function applySavedPosition() {
			const entry = currentEntry();
			if (state !== "pending" || entry?.id !== initialEntryId || savedPercent === null) return;
			if (!isChapterComplete(entry)) return;
			const id = initialEntryId;
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(() => resolve()));
			if (disposed || state !== "pending" || currentEntry()?.id !== id || !isChapterComplete(currentEntry())) return;
			const mainEl = mainRef.value;
			const chapterEl = chapterRefs.get(entry.chapter.url);
			if (!mainEl || !chapterEl) return;
			const top = mainEl.scrollTop + chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
			const height = Math.max(0, chapterEl.offsetHeight - mainEl.clientHeight * .5);
			mainEl.scrollTop = top + savedPercent / 100 * height;
			readerStore.updateScroll(savedPercent);
			allowSaving();
			readerStore.showToast("已回到上次阅读位置", "info", 1800);
		}
		async function restorePosition() {
			const entry = currentEntry();
			if (!entry || entry.id !== initialEntryId || state !== "pending") return;
			const percent = await getReadingPosition(entry.chapter.url);
			if (entry.id !== initialEntryId || state !== "pending") return;
			if (percent === null || percent < 3 || percent > 98) {
				allowSaving();
				return;
			}
			savedPercent = percent;
			await applySavedPosition();
		}
		watch(() => [
			currentEntry()?.id,
			currentEntry()?.sectionProgress !== void 0,
			currentEntry()?.sectionsIncomplete,
			isNavigating.value
		], (value, previous) => {
			if (value[0] !== previous[0]) allowSaving();
			else if (isNavigating.value || currentEntry()?.sectionsIncomplete) cancelRestore();
			else applySavedPosition();
		}, { flush: "post" });
		onScopeDispose(() => {
			disposed = true;
		});
		function savePosition(url, percent) {
			const entry = currentEntry();
			if (!canSave() || !isChapterComplete(entry) || entry.chapter.url !== url) return;
			const now = Date.now();
			if (now - lastSaveAt < 500) return;
			lastSaveAt = now;
			saveReadingPosition(url, percent);
		}
		function flushPosition() {
			const entry = currentEntry();
			const mainEl = mainRef.value;
			const chapterEl = entry && chapterRefs.get(entry.chapter.url);
			if (canSave() && isChapterComplete(entry) && mainEl && chapterEl) saveReadingPosition(entry.chapter.url, getChapterPercent(mainEl, chapterEl, true));
			flushReadingPositions();
		}
		return {
			restorePosition,
			cancelRestore,
			savePosition,
			flushPosition
		};
	}
	var SCROLL_THROTTLE_MS = 16;
	var SCROLL_SETTLE_CHECK_MS = 180;
	function useReaderScroll(options) {
		const { mainRef, chapterRefs, readerStore, autoHideHeader, showControls, isNavigating, scheduleAutoLoadNext, savePosition } = options;
		let lastScrollCall = 0;
		let pendingScrollTimer = null;
		let lastScrollTop = 0;
		let pendingScrollSettleTimer = null;
		onScopeDispose(() => {
			if (pendingScrollTimer) clearTimeout(pendingScrollTimer);
			if (pendingScrollSettleTimer) clearTimeout(pendingScrollSettleTimer);
		}, true);
		function queueScrollSettledAutoLoadCheck() {
			if (pendingScrollSettleTimer) clearTimeout(pendingScrollSettleTimer);
			pendingScrollSettleTimer = setTimeout(() => {
				pendingScrollSettleTimer = null;
				scheduleAutoLoadNext("settled");
			}, SCROLL_SETTLE_CHECK_MS);
		}
		function findCurrentChapter(mainEl) {
			const viewportCenter = mainEl.getBoundingClientRect().top + mainEl.clientHeight / 2;
			let nearest = null;
			for (let index = 0; index < readerStore.chapters.length; index++) {
				const url = readerStore.chapters[index]?.chapter.url;
				const element = url ? chapterRefs.get(url) : void 0;
				if (!element) continue;
				const rect = element.getBoundingClientRect();
				if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) return {
					index,
					element
				};
				const distance = Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter));
				if (!nearest || distance < nearest.distance) nearest = {
					index,
					element,
					distance
				};
			}
			return nearest ? {
				index: nearest.index,
				element: nearest.element
			} : null;
		}
		function handleScrollCore() {
			const mainEl = mainRef.value;
			if (!mainEl) return;
			const currentScrollTop = mainEl.scrollTop;
			if (isNavigating.value) {
				const currentIndex = Number(readerStore.currentChapterIndex ?? 0);
				const currentUrl = readerStore.chapters[currentIndex]?.chapter.url;
				const currentElement = currentUrl ? chapterRefs.get(currentUrl) : void 0;
				const fallbackHeight = mainEl.scrollHeight - mainEl.clientHeight;
				const percent = currentElement ? getChapterPercent(mainEl, currentElement, isChapterComplete(readerStore.chapters[currentIndex])) : fallbackHeight > 0 ? currentScrollTop / fallbackHeight * 100 : 100;
				readerStore.updateScroll(percent);
				return;
			}
			if (autoHideHeader.value) {
				if (currentScrollTop > lastScrollTop && currentScrollTop > 100) showControls.value = false;
				else if (currentScrollTop < lastScrollTop - 20) showControls.value = true;
			}
			lastScrollTop = currentScrollTop;
			const current = findCurrentChapter(mainEl);
			if (current) {
				const complete = isChapterComplete(readerStore.chapters[current.index]);
				const percent = getChapterPercent(mainEl, current.element, complete);
				readerStore.setCurrentChapter(current.index);
				readerStore.updateScroll(percent);
				const url = readerStore.chapters[current.index]?.chapter.url;
				if (url && complete) savePosition(url, percent);
			} else {
				const scrollableHeight = mainEl.scrollHeight - mainEl.clientHeight;
				readerStore.updateScroll(scrollableHeight > 0 ? currentScrollTop / scrollableHeight * 100 : 100);
			}
			queueScrollSettledAutoLoadCheck();
		}
		function handleScroll() {
			const remaining = SCROLL_THROTTLE_MS - (Date.now() - lastScrollCall);
			if (remaining <= 0) {
				if (pendingScrollTimer) clearTimeout(pendingScrollTimer);
				pendingScrollTimer = null;
				lastScrollCall = Date.now();
				handleScrollCore();
			} else if (!pendingScrollTimer) pendingScrollTimer = setTimeout(() => {
				pendingScrollTimer = null;
				lastScrollCall = Date.now();
				handleScrollCore();
			}, remaining);
		}
		return { handleScroll };
	}
	var INTERSECTION_ROOT_MARGIN_PX = 1600;
	function isViewportNearBottom(scrollHeight, scrollTop, clientHeight, marginPx = INTERSECTION_ROOT_MARGIN_PX) {
		return scrollHeight - (scrollTop + clientHeight) <= marginPx;
	}
	function decideAutoLoadNext(reason, input) {
		if (!canAutoLoadBase(input)) return {
			type: "idle",
			clearTimer: !input.enabled || input.unreadBufferState === "sufficient" || input.unreadBufferState === "capped"
		};
		if (input.now < input.graceUntil) return {
			type: "schedule",
			dueAt: input.graceUntil
		};
		if (input.now < input.failureCooldownUntil) return shouldRetryAfterCooldown(reason) ? {
			type: "schedule",
			dueAt: input.failureCooldownUntil
		} : {
			type: "idle",
			clearTimer: false
		};
		if (requiresNearBottom(reason) && !input.isNearBottom) return {
			type: "idle",
			clearTimer: false
		};
		return { type: "start" };
	}
	function canAutoLoadBase(input) {
		return input.enabled && input.hasChapter && !input.currentChapterMerging && input.hasNext && !input.isLoadingNext && !input.isLoadingPrev && !input.isNavigating && !input.autoLoadInFlight && !input.pageHidden && (input.unreadBufferState === "empty" || input.unreadBufferState === "short");
	}
	function shouldRetryAfterCooldown(reason) {
		return reason !== "state";
	}
	function requiresNearBottom(reason) {
		return reason === "settled" || reason === "sentinel";
	}
	var PRELOAD_DELAY_MIN_MS = 3e3;
	var PRELOAD_DELAY_MAX_MS = 5e3;
	var FAILURE_COOLDOWN_MIN_MS = 6e3;
	var FAILURE_COOLDOWN_MAX_MS = 1e4;
	function useReaderAutoLoad(options) {
		const { mainRef, chapterRefs, readerStore, configStore, isNavigating } = options;
		let autoLoadTimer = null;
		let autoLoadTimerDueAt = 0;
		let autoLoadInFlight = false;
		let sessionKey = "";
		let graceUntil = 0;
		let failureCooldownUntil = 0;
		let layoutRevision = 0;
		let layoutInvalidationFrame = null;
		let bottomObserver = null;
		let lastBufferState = "";
		const chapterScreenCache = new Map();
		function getRandomDelayMs(min, max) {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		}
		function getCurrentIndex() {
			const index = Number(readerStore.currentChapterIndex ?? 0);
			if (!Number.isFinite(index) || readerStore.chapters.length === 0) return 0;
			return Math.max(0, Math.min(readerStore.chapters.length - 1, index));
		}
		function getCurrentSessionKey() {
			const entry = readerStore.chapters[getCurrentIndex()];
			if (!entry) return "";
			return `${entry.id}:${entry.chapter.url}`;
		}
		function ensureSession() {
			const nextSessionKey = getCurrentSessionKey();
			if (!nextSessionKey) return false;
			if (nextSessionKey !== sessionKey) {
				sessionKey = nextSessionKey;
				graceUntil = Date.now() + getRandomDelayMs(PRELOAD_DELAY_MIN_MS, PRELOAD_DELAY_MAX_MS);
				failureCooldownUntil = 0;
				lastBufferState = "";
				clearAutoLoadTimer();
				recordDebugEvent("autoload.session", {
					currentIndex: getCurrentIndex(),
					currentUrl: readerStore.chapters[getCurrentIndex()]?.chapter.url,
					graceMs: Math.max(0, graceUntil - Date.now())
				});
			}
			return true;
		}
		function getChapterViewportState(entry, mainEl) {
			if (entry.sectionProgress) {
				chapterScreenCache.delete(entry.id);
				return "pending";
			}
			const viewportHeight = mainEl.clientHeight;
			const chapterEl = chapterRefs.get(entry.chapter.url);
			if (!chapterEl || viewportHeight <= 0) return "pending";
			const cached = chapterScreenCache.get(entry.id);
			if (cached && cached.layoutRevision === layoutRevision && cached.viewportHeight === viewportHeight) return cached.fillsViewport ? "sufficient" : "short";
			const chapterHeight = chapterEl.offsetHeight;
			if (chapterHeight <= 0) return "pending";
			const fillsViewport = chapterHeight >= viewportHeight;
			chapterScreenCache.set(entry.id, {
				fillsViewport,
				layoutRevision,
				viewportHeight
			});
			return fillsViewport ? "sufficient" : "short";
		}
		function getUnreadBufferState(mainEl) {
			const unreadEntries = readerStore.chapters.slice(getCurrentIndex() + 1);
			if (unreadEntries.length === 0) return "empty";
			if (unreadEntries.length >= 10) return "capped";
			let hasPendingMeasurement = false;
			for (const entry of unreadEntries) {
				const state = getChapterViewportState(entry, mainEl);
				if (state === "sufficient") return "sufficient";
				if (state === "pending") hasPendingMeasurement = true;
			}
			return hasPendingMeasurement ? "pending" : "short";
		}
		function recordBufferState(state) {
			if (state === lastBufferState) return;
			lastBufferState = state;
			recordDebugEvent("autoload.buffer", {
				state,
				currentIndex: getCurrentIndex(),
				unreadChapterCount: Math.max(0, readerStore.chapters.length - getCurrentIndex() - 1),
				limit: 10
			});
		}
		function pruneChapterScreenCache(activeIds) {
			const active = new Set(activeIds);
			for (const id of chapterScreenCache.keys()) if (!active.has(id)) chapterScreenCache.delete(id);
		}
		function invalidateChapterScreenCache() {
			layoutRevision += 1;
			chapterScreenCache.clear();
			lastBufferState = "";
		}
		function queueLayoutInvalidation() {
			if (layoutInvalidationFrame !== null) return;
			if (typeof globalThis.requestAnimationFrame !== "function") {
				invalidateChapterScreenCache();
				scheduleAutoLoadNext("state");
				return;
			}
			layoutInvalidationFrame = globalThis.requestAnimationFrame(() => {
				layoutInvalidationFrame = null;
				invalidateChapterScreenCache();
				scheduleAutoLoadNext("state");
			});
		}
		function isPageHidden() {
			return typeof document !== "undefined" && document.visibilityState === "hidden";
		}
		function clearAutoLoadTimer() {
			if (!autoLoadTimer) return;
			clearTimeout(autoLoadTimer);
			autoLoadTimer = null;
			autoLoadTimerDueAt = 0;
		}
		function scheduleTimerAt(dueAt) {
			if (autoLoadTimer && autoLoadTimerDueAt <= dueAt) return;
			clearAutoLoadTimer();
			autoLoadTimerDueAt = dueAt;
			autoLoadTimer = setTimeout(() => {
				autoLoadTimer = null;
				autoLoadTimerDueAt = 0;
				scheduleAutoLoadNext("timer");
			}, Math.max(0, dueAt - Date.now()));
		}
		async function finishLoad(ok, startedSessionKey, startedTailId) {
			recordDebugEvent("autoload.finish", {
				ok,
				chapterCount: readerStore.chapters.length,
				currentIndex: readerStore.currentChapterIndex
			});
			if (getCurrentSessionKey() !== startedSessionKey) {
				autoLoadInFlight = false;
				ensureSession();
				scheduleAutoLoadNext("state");
				return;
			}
			if (ok) {
				failureCooldownUntil = 0;
				await nextTick();
				autoLoadInFlight = false;
				const mainEl = mainRef.value;
				if (!mainEl) return;
				if (getCurrentSessionKey() !== startedSessionKey) {
					ensureSession();
					scheduleAutoLoadNext("state");
					return;
				}
				if (readerStore.chapters[readerStore.chapters.length - 1]?.id === startedTailId) return;
				const bufferState = getUnreadBufferState(mainEl);
				recordBufferState(bufferState);
				if (bufferState === "short") graceUntil = Date.now() + 300;
				scheduleAutoLoadNext("state");
				return;
			}
			autoLoadInFlight = false;
			failureCooldownUntil = Date.now() + getRandomDelayMs(FAILURE_COOLDOWN_MIN_MS, FAILURE_COOLDOWN_MAX_MS);
		}
		function startAutoLoad() {
			if (!mainRef.value) return;
			clearAutoLoadTimer();
			autoLoadInFlight = true;
			const startedSessionKey = sessionKey;
			const startedTailId = readerStore.chapters[readerStore.chapters.length - 1]?.id;
			recordDebugEvent("autoload.start", {
				currentIndex: readerStore.currentChapterIndex,
				currentUrl: readerStore.chapter?.url,
				nextUrl: readerStore.chapters[readerStore.chapters.length - 1]?.chapter.nextUrl
			});
			readerStore.loadNextChapter("auto").then((ok) => finishLoad(ok, startedSessionKey, startedTailId), () => finishLoad(false, startedSessionKey, startedTailId));
		}
		function scheduleAutoLoadNext(reason = "state") {
			const mainEl = mainRef.value;
			if (!mainEl || !ensureSession()) return;
			const currentTime = Date.now();
			const unreadBufferState = getUnreadBufferState(mainEl);
			recordBufferState(unreadBufferState);
			const decision = decideAutoLoadNext(reason, {
				autoLoadInFlight,
				currentChapterMerging: !!readerStore.chapters[getCurrentIndex()]?.sectionProgress,
				enabled: configStore.behavior.preloadNext,
				failureCooldownUntil,
				graceUntil,
				hasChapter: readerStore.chapters.length > 0,
				hasNext: readerStore.hasNext,
				isLoadingNext: readerStore.isLoadingNext,
				isLoadingPrev: readerStore.isLoadingPrev,
				isNavigating: isNavigating.value,
				isNearBottom: isViewportNearBottom(mainEl.scrollHeight, mainEl.scrollTop, mainEl.clientHeight),
				now: currentTime,
				pageHidden: isPageHidden(),
				unreadBufferState
			});
			if (decision.type === "schedule") scheduleTimerAt(decision.dueAt);
			else if (decision.type === "start") startAutoLoad();
			else if (decision.clearTimer) clearAutoLoadTimer();
		}
		function observeBottomSentinel(sentinel) {
			const root = mainRef.value;
			if (!root || !sentinel) return;
			bottomObserver?.disconnect();
			bottomObserver = new globalThis.IntersectionObserver((entries) => {
				if (entries[0]?.isIntersecting) scheduleAutoLoadNext("sentinel");
			}, {
				root,
				rootMargin: `${INTERSECTION_ROOT_MARGIN_PX}px`,
				threshold: 0
			});
			bottomObserver.observe(sentinel);
		}
		watch(() => readerStore.chapters.map((entry) => entry.id), (activeIds) => {
			pruneChapterScreenCache(activeIds);
			scheduleAutoLoadNext("state");
		}, { flush: "post" });
		watch(() => readerStore.chapters.filter((entry) => entry.sectionProgress).length, () => {
			scheduleAutoLoadNext("state");
		}, { flush: "post" });
		watch(() => readerStore.currentChapterIndex, () => {
			scheduleAutoLoadNext("state");
		});
		watch(() => readerStore.hasNext, (available) => {
			if (!available) {
				clearAutoLoadTimer();
				return;
			}
			scheduleAutoLoadNext("state");
		});
		watch(() => [
			readerStore.isLoadingNext,
			readerStore.isLoadingPrev,
			isNavigating.value
		], ([loadingNext, loadingPrev, navigating]) => {
			if (loadingNext || loadingPrev || navigating) return;
			scheduleAutoLoadNext("state");
		});
		watch(() => configStore.behavior.preloadNext, (enabled) => {
			if (!enabled) {
				clearAutoLoadTimer();
				failureCooldownUntil = 0;
				return;
			}
			scheduleAutoLoadNext("state");
		});
		watch(() => [
			configStore.reading?.fontFamily,
			configStore.reading?.fontSize,
			configStore.reading?.lineHeight,
			configStore.reading?.letterSpacing,
			configStore.reading?.paragraphIndent,
			configStore.reading?.maxWidth,
			configStore.reading?.padding,
			configStore.reading?.textConversion,
			configStore.customCSS,
			configStore.customCleanupRegex
		], () => {
			queueLayoutInvalidation();
		}, { flush: "post" });
		function handleVisibilityChange() {
			if (!isPageHidden()) scheduleAutoLoadNext("visibility");
		}
		if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibilityChange);
		if (typeof window !== "undefined") window.addEventListener("resize", queueLayoutInvalidation, { passive: true });
		scheduleAutoLoadNext("state");
		onUnmounted(() => {
			clearAutoLoadTimer();
			bottomObserver?.disconnect();
			bottomObserver = null;
			if (layoutInvalidationFrame !== null) {
				globalThis.cancelAnimationFrame?.(layoutInvalidationFrame);
				layoutInvalidationFrame = null;
			}
			if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (typeof window !== "undefined") window.removeEventListener("resize", queueLayoutInvalidation);
			chapterScreenCache.clear();
		});
		return {
			scheduleAutoLoadNext,
			clearAutoLoadTimer,
			observeBottomSentinel
		};
	}
	var SWIPE_MIN_THRESHOLD_PX = 72;
	var SWIPE_MAX_THRESHOLD_PX = 120;
	var SWIPE_VIEWPORT_RATIO = .18;
	var SWIPE_MAX_DURATION_MS = 700;
	var SWIPE_CANCEL_VERTICAL_PX = 28;
	var SWIPE_AXIS_RATIO = 1.5;
	var BOUNDARY_PULL_HINT_PX = 12;
	var BOUNDARY_PULL_TRIGGER_PX = 48;
	var BOUNDARY_AXIS_RATIO = 1.25;
	function isInteractiveElement(target) {
		if (!(target instanceof Element)) return false;
		return Boolean(target.closest("a, button, input, textarea, select, label, summary, [contenteditable], [role=\"button\"]"));
	}
	function getSwipeThreshold() {
		return Math.min(SWIPE_MAX_THRESHOLD_PX, Math.max(SWIPE_MIN_THRESHOLD_PX, window.innerWidth * SWIPE_VIEWPORT_RATIO));
	}
	function useTouchGestures(options) {
		const { swipeEnabled, getBoundaryDirection, onBoundaryPull, onSwipeLeft, onSwipeRight } = options;
		const boundaryGestureDirection = ref(null);
		const boundaryGestureReady = ref(false);
		const boundaryGestureHint = computed(() => {
			const direction = boundaryGestureDirection.value;
			if (!direction) return "";
			if (direction === "next") return boundaryGestureReady.value ? "松手加载下一章" : "继续上滑加载下一章";
			return boundaryGestureReady.value ? "松手加载上一章" : "继续下滑加载上一章";
		});
		let gestureStart = null;
		function clearBoundaryFeedback() {
			boundaryGestureDirection.value = null;
			boundaryGestureReady.value = false;
		}
		function clearGesture() {
			gestureStart = null;
			clearBoundaryFeedback();
		}
		function handleTouchStart(e) {
			clearGesture();
			if (e.touches.length !== 1) return;
			if (isInteractiveElement(e.target)) return;
			const selection = window.getSelection();
			if (selection && selection.toString().length > 0) return;
			const boundaryDirection = onBoundaryPull ? getBoundaryDirection?.() || null : null;
			const canSwipe = swipeEnabled.value;
			if (!canSwipe && !boundaryDirection) return;
			const touch = e.touches[0];
			gestureStart = {
				boundaryDirection,
				boundaryReady: false,
				swipeCancelled: false,
				swipeEnabled: canSwipe,
				id: touch.identifier,
				x: touch.clientX,
				y: touch.clientY,
				time: Date.now(),
				threshold: canSwipe ? getSwipeThreshold() : 0
			};
		}
		function handleTouchMove(e) {
			if (!gestureStart) return;
			if (e.touches.length !== 1) {
				clearGesture();
				return;
			}
			const touch = e.touches[0];
			if (touch.identifier !== gestureStart.id) return;
			const dx = touch.clientX - gestureStart.x;
			const dy = touch.clientY - gestureStart.y;
			if (gestureStart.swipeEnabled && Math.abs(dy) >= SWIPE_CANCEL_VERTICAL_PX && Math.abs(dy) >= Math.abs(dx) * SWIPE_AXIS_RATIO) gestureStart.swipeCancelled = true;
			if (!gestureStart.boundaryDirection) return;
			if (Math.abs(dx) >= BOUNDARY_PULL_HINT_PX && Math.abs(dx) > Math.abs(dy) * BOUNDARY_AXIS_RATIO) {
				gestureStart.boundaryDirection = null;
				gestureStart.boundaryReady = false;
				clearBoundaryFeedback();
				return;
			}
			const pullDistance = gestureStart.boundaryDirection === "next" ? -dy : dy;
			const showHint = pullDistance >= BOUNDARY_PULL_HINT_PX;
			gestureStart.boundaryReady = pullDistance >= BOUNDARY_PULL_TRIGGER_PX;
			boundaryGestureDirection.value = showHint ? gestureStart.boundaryDirection : null;
			boundaryGestureReady.value = showHint && gestureStart.boundaryReady;
			if (gestureStart.boundaryReady && e.cancelable) e.preventDefault();
		}
		function handleTouchEnd(e) {
			if (!gestureStart) return false;
			const start = gestureStart;
			clearGesture();
			if (start.boundaryDirection && start.boundaryReady && onBoundaryPull) {
				onBoundaryPull(start.boundaryDirection);
				return true;
			}
			if (!start.swipeEnabled || start.swipeCancelled || !swipeEnabled.value) return false;
			const selection = window.getSelection();
			if (selection && selection.toString().length > 0) return false;
			const touch = Array.from(e.changedTouches).find((t) => t.identifier === start.id);
			if (!touch) return false;
			if (Date.now() - start.time > SWIPE_MAX_DURATION_MS) return false;
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			if (Math.abs(dx) < start.threshold) return false;
			if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return false;
			if (dx < 0) onSwipeLeft();
			else onSwipeRight();
			return true;
		}
		function handleTouchCancel() {
			clearGesture();
		}
		return {
			boundaryGestureDirection,
			boundaryGestureHint,
			handleTouchStart,
			handleTouchMove,
			handleTouchEnd,
			handleTouchCancel
		};
	}
	var SCROLL_BOUNDARY_EPSILON_PX$1 = 4;
	var SMOOTH_NAVIGATION_LOCK_MS = 650;
	var PAGE_SCROLL_RATIO = .9;
	var LINE_SCROLL_STEP_PX = 150;
	function useChapterNavigation(options) {
		const { mainRef, chapterRefs, readerStore, isNavigating, onViewportSettled } = options;
		let navigationId = 0;
		let settleTimer;
		function clearSettleTimer() {
			clearTimeout(settleTimer);
			settleTimer = void 0;
		}
		onScopeDispose(() => {
			navigationId += 1;
			clearSettleTimer();
			isNavigating.value = false;
		}, true);
		async function runNavigation(action, replace = false) {
			const mainEl = mainRef.value;
			if (!mainEl || isNavigating.value && !replace) return false;
			const id = ++navigationId;
			const isCurrent = () => id === navigationId;
			clearSettleTimer();
			isNavigating.value = true;
			let behavior = void 0;
			const finish = () => {
				if (!isCurrent()) return;
				clearSettleTimer();
				isNavigating.value = false;
				if (behavior) onViewportSettled();
			};
			try {
				behavior = await action(mainEl, isCurrent);
				return isCurrent() && behavior !== void 0;
			} finally {
				if (isCurrent()) {
					if (behavior === "smooth") settleTimer = setTimeout(finish, SMOOTH_NAVIGATION_LOCK_MS);
					else finish();
				}
			}
		}
		async function scrollToChapter(mainEl, url, behavior, isCurrent) {
			await nextTick();
			if (!isCurrent()) return;
			const index = readerStore.chapters.findIndex((entry) => entry.chapter.url === url);
			const targetEl = chapterRefs.get(url);
			if (index < 0 || !targetEl) return;
			const top = targetEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top + mainEl.scrollTop;
			mainEl.scrollTo({
				top,
				behavior
			});
			readerStore.setCurrentChapter(index);
			return behavior;
		}
		function captureViewportAnchor(mainEl, direction) {
			const entries = readerStore.chapters;
			const mainTop = mainEl.getBoundingClientRect().top;
			const mainBottom = mainTop + mainEl.clientHeight;
			const start = direction === "next" ? entries.length - 1 : 0;
			const step = direction === "next" ? -1 : 1;
			for (let index = start; index >= 0 && index < entries.length; index += step) {
				const url = entries[index]?.chapter.url;
				const chapterEl = url ? chapterRefs.get(url) : void 0;
				if (!url || !chapterEl) continue;
				const rect = chapterEl.getBoundingClientRect();
				if (rect.bottom > mainTop && rect.top < mainBottom) return {
					url,
					top: rect.top - mainTop
				};
			}
			const fallbackUrl = entries[start]?.chapter.url;
			const fallbackEl = fallbackUrl ? chapterRefs.get(fallbackUrl) : void 0;
			if (!fallbackUrl || !fallbackEl) return null;
			return {
				url: fallbackUrl,
				top: fallbackEl.getBoundingClientRect().top - mainTop
			};
		}
		function restoreViewportAnchor(mainEl, anchor) {
			if (!anchor) return;
			const chapterEl = chapterRefs.get(anchor.url);
			if (!chapterEl) return;
			const nextTop = chapterEl.getBoundingClientRect().top - mainEl.getBoundingClientRect().top;
			mainEl.scrollTop += nextTop - anchor.top;
		}
		function isAtTop(mainEl) {
			return mainEl.scrollTop <= SCROLL_BOUNDARY_EPSILON_PX$1;
		}
		function isAtBottom(mainEl) {
			return mainEl.scrollHeight - (mainEl.scrollTop + mainEl.clientHeight) <= SCROLL_BOUNDARY_EPSILON_PX$1;
		}
		function preventBoundaryDefault(e) {
			if (e.cancelable === false) return;
			if (typeof e.preventDefault !== "function") return;
			e.preventDefault();
		}
		function showBoundaryEnd(direction) {
			if (direction === "next" && readerStore.isTailSectionMerging) {
				readerStore.showToast(SECTION_MERGING_TOAST, "info");
				return;
			}
			if (direction === "next" && readerStore.isTailChapterIncomplete) {
				readerStore.showToast(SECTION_INCOMPLETE_TOAST, "info");
				return;
			}
			const fallback = direction === "next" ? "已经是最后一章了" : "已经是第一章了";
			readerStore.showToast(readerStore.getVipBlockedToast(direction) || fallback, "info");
		}
		async function loadAtBoundary(mainEl, direction, isCurrent) {
			if (!(direction === "next" ? readerStore.hasNext : readerStore.hasPrev)) {
				showBoundaryEnd(direction);
				return false;
			}
			const anchor = captureViewportAnchor(mainEl, direction);
			try {
				if (!(direction === "next" ? await readerStore.loadNextChapter("manual") : await readerStore.loadPrevChapter("manual")) || !isCurrent()) return false;
				await nextTick();
				if (!isCurrent()) return false;
				restoreViewportAnchor(mainEl, anchor);
				return true;
			} catch (error) {
				console.error(`[MNR] Failed to load ${direction} chapter at reader boundary:`, error);
				return false;
			}
		}
		async function loadBoundaryChapter(direction) {
			if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return false;
			return runNavigation(async (mainEl, isCurrent) => {
				if (await loadAtBoundary(mainEl, direction, isCurrent)) return "auto";
			});
		}
		async function jumpToCachedChapter(url) {
			await runNavigation(async (mainEl, isCurrent) => {
				if (readerStore.chapters.some((entry) => entry.chapter.url === url)) return scrollToChapter(mainEl, url, "smooth", isCurrent);
				const success = await readerStore.rebuildChaptersAround(url);
				if (!isCurrent()) return;
				if (!success) {
					window.location.href = url;
					return;
				}
				await nextTick();
				if (!isCurrent()) return;
				mainEl.scrollTo({
					top: 0,
					behavior: "auto"
				});
				return "auto";
			}, true);
		}
		async function jumpToChapter(index, behavior = "smooth") {
			const url = readerStore.chapters[index]?.chapter.url;
			if (!url) return;
			await runNavigation((mainEl, isCurrent) => scrollToChapter(mainEl, url, behavior, isCurrent));
		}
		async function moveReader(direction, mode) {
			await runNavigation(async (mainEl, isCurrent) => {
				if (direction === "next" ? isAtBottom(mainEl) : isAtTop(mainEl)) {
					if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return;
					if (!(direction === "next" ? readerStore.hasNext : readerStore.hasPrev)) {
						if (mode === "page") showBoundaryEnd(direction);
						return;
					}
					if (!await loadAtBoundary(mainEl, direction, isCurrent)) return;
					if (!isCurrent()) return;
				}
				const behavior = mode === "page" ? "smooth" : "auto";
				mainEl.scrollBy({
					top: (mode === "page" ? mainEl.clientHeight * PAGE_SCROLL_RATIO : LINE_SCROLL_STEP_PX) * (direction === "next" ? 1 : -1),
					behavior
				});
				return behavior;
			});
		}
		function turnReaderPage(direction) {
			return moveReader(direction, "page");
		}
		function handleWheel(e) {
			const mainEl = mainRef.value;
			if (!mainEl) return;
			if (e.deltaY < 0 && isAtTop(mainEl)) {
				preventBoundaryDefault(e);
				if (readerStore.hasPrev) loadBoundaryChapter("prev");
				return;
			}
			if (e.deltaY > 0 && isAtBottom(mainEl)) {
				preventBoundaryDefault(e);
				if (readerStore.hasNext) loadBoundaryChapter("next");
			}
		}
		async function navigateChapter(direction) {
			const targetIndex = readerStore.currentChapterIndex + (direction === "next" ? 1 : -1);
			if (readerStore.chapters[targetIndex]) {
				await jumpToChapter(targetIndex);
				return;
			}
			await runNavigation(async (mainEl, isCurrent) => {
				if (!(direction === "next" ? readerStore.hasNext : readerStore.hasPrev)) {
					showBoundaryEnd(direction);
					return;
				}
				if (readerStore.isLoadingPrev || readerStore.isLoadingNext) return;
				if (!(direction === "next" ? await readerStore.loadNextChapter("manual") : await readerStore.loadPrevChapter("manual")) || !isCurrent()) return;
				const entry = direction === "next" ? readerStore.chapters[readerStore.chapters.length - 1] : readerStore.chapters[0];
				if (entry) return scrollToChapter(mainEl, entry.chapter.url, direction === "next" ? "smooth" : "auto", isCurrent);
			});
		}
		function scrollReader(direction) {
			return moveReader(direction === "down" ? "next" : "prev", "line");
		}
		return {
			navigateChapter,
			jumpToChapter,
			jumpToCachedChapter,
			loadBoundaryChapter,
			turnReaderPage,
			handleWheel,
			scrollReader
		};
	}
	function useReaderUIControls(options) {
		const { readerStore, showControls } = options;
		const activePanel = ref(null);
		const settingsVisible = computed(() => activePanel.value === "settings");
		const drawerOpen = computed(() => activePanel.value === "drawer");
		const hasOpenPanel = computed(() => activePanel.value !== null);
		let previouslyFocused = null;
		let controlsVisibleBeforePanel = true;
		function setActivePanel(panel) {
			if (activePanel.value === null && panel !== null) {
				previouslyFocused = getDeepActiveElement();
				controlsVisibleBeforePanel = showControls.value;
			}
			activePanel.value = panel;
			showControls.value = panel === null ? controlsVisibleBeforePanel : false;
			if (panel === null && previouslyFocused) {
				const focusTarget = previouslyFocused;
				previouslyFocused = null;
				nextTick(() => focusTarget.focus({ preventScroll: true }));
			}
		}
		function toggleDrawer() {
			const nextPanel = drawerOpen.value ? null : "drawer";
			setActivePanel(nextPanel);
			if (nextPanel === "drawer") readerStore.loadToc();
		}
		function closeDrawer() {
			if (drawerOpen.value) setActivePanel(null);
		}
		function openSettings() {
			setActivePanel("settings");
		}
		function closeSettings() {
			if (settingsVisible.value) setActivePanel(null);
		}
		function toggleSettings() {
			setActivePanel(settingsVisible.value ? null : "settings");
		}
		return {
			settingsVisible,
			drawerOpen,
			hasOpenPanel,
			toggleDrawer,
			closeDrawer,
			openSettings,
			closeSettings,
			toggleSettings
		};
	}
	var _hoisted_1$6 = ["aria-valuenow"];
	var _hoisted_2$4 = {
		key: 0,
		class: "mnr-progress-text"
	};
	var ProgressIndicator_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "ProgressIndicator",
		props: {
			percent: { default: 0 },
			showText: {
				type: Boolean,
				default: false
			},
			autoHide: {
				type: Boolean,
				default: true
			},
			hideDelay: { default: 2e3 }
		},
		setup(__props) {
			const props = __props;
			const percent = computed(() => {
				const value = Number(props.percent ?? 0);
				if (Number.isNaN(value)) return 0;
				return Math.max(0, Math.min(100, Math.round(value)));
			});
			const visible = ref(true);
			let hideTimeout = null;
			function scheduleAutoHide() {
				if (hideTimeout) {
					clearTimeout(hideTimeout);
					hideTimeout = null;
				}
				if (!props.autoHide) {
					visible.value = true;
					return;
				}
				hideTimeout = setTimeout(() => {
					visible.value = false;
				}, props.hideDelay);
			}
			watch(percent, () => {
				visible.value = true;
				scheduleAutoHide();
			}, { immediate: true });
			onUnmounted(() => {
				if (hideTimeout) clearTimeout(hideTimeout);
			});
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", {
					class: normalizeClass(["mnr-progress", { hidden: !visible.value }]),
					role: "progressbar",
					"aria-label": "本章阅读进度",
					"aria-valuemin": "0",
					"aria-valuemax": "100",
					"aria-valuenow": percent.value
				}, [createBaseVNode("div", {
					class: "mnr-progress-bar",
					style: normalizeStyle({ width: `${percent.value}%` })
				}, null, 4), __props.showText ? (openBlock(), createElementBlock("span", _hoisted_2$4, toDisplayString(percent.value) + "%", 1)) : createCommentVNode("", true)], 10, _hoisted_1$6);
			};
		}
	}), [["__scopeId", "data-v-fb6f172c"]]);
	var vChapterContent = {
		mounted(element, { value }) {
			element.innerHTML = value;
		},
		updated(element, { value, oldValue }) {
			if (value === oldValue) return;
			if (oldValue && value.startsWith(`${oldValue}<p></p>`)) element.insertAdjacentHTML("beforeend", value.slice(oldValue.length));
			else element.innerHTML = value;
		}
	};
	var _hoisted_1$5 = { class: "mnr-floating-toolbar" };
	var FloatingToolbar_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "FloatingToolbar",
		props: { visible: {
			type: Boolean,
			default: true
		} },
		emits: ["toggleDrawer", "openSettings"],
		setup(__props) {
			return (_ctx, _cache) => {
				return openBlock(), createBlock(Transition, { name: "mnr-fade-slide" }, {
					default: withCtx(() => [withDirectives(createBaseVNode("div", _hoisted_1$5, [createBaseVNode("button", {
						class: "mnr-fab",
						title: "目录 (Tab)",
						"aria-label": "打开目录",
						onClick: _cache[0] || (_cache[0] = withModifiers(($event) => _ctx.$emit("toggleDrawer"), ["stop"]))
					}, [..._cache[2] || (_cache[2] = [createBaseVNode("svg", {
						class: "mnr-icon",
						viewBox: "0 0 24 24",
						"aria-hidden": "true"
					}, [createBaseVNode("path", { d: "M5 6h14M5 12h14M5 18h14" })], -1)])]), createBaseVNode("button", {
						class: "mnr-fab",
						title: "设置 (S)",
						"aria-label": "打开设置",
						onClick: _cache[1] || (_cache[1] = withModifiers(($event) => _ctx.$emit("openSettings"), ["stop"]))
					}, [..._cache[3] || (_cache[3] = [createBaseVNode("svg", {
						class: "mnr-icon",
						viewBox: "0 0 24 24",
						"aria-hidden": "true"
					}, [createBaseVNode("circle", {
						cx: "12",
						cy: "12",
						r: "3"
					}), createBaseVNode("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" })], -1)])])], 512), [[vShow, __props.visible]])]),
					_: 1
				});
			};
		}
	}), [["__scopeId", "data-v-99e4013e"]]);
	var MnrSpinner_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "MnrSpinner",
		props: { size: { default: "medium" } },
		setup(__props) {
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", { class: normalizeClass(["mnr-spinner", __props.size]) }, null, 2);
			};
		}
	}), [["__scopeId", "data-v-c925c262"]]);
	var _hoisted_1$4 = ["role"];
	var MnrToast_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "MnrToast",
		props: {
			message: {},
			type: { default: "info" },
			visible: { type: Boolean }
		},
		emits: ["dismiss"],
		setup(__props) {
			return (_ctx, _cache) => {
				return openBlock(), createBlock(Transition, { name: "mnr-toast" }, {
					default: withCtx(() => [__props.visible ? (openBlock(), createElementBlock("div", {
						key: 0,
						class: normalizeClass(["mnr-toast", { "mnr-toast--error": __props.type === "error" }]),
						role: __props.type === "error" ? "alert" : "status",
						onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("dismiss"))
					}, toDisplayString(__props.message), 11, _hoisted_1$4)) : createCommentVNode("", true)]),
					_: 1
				});
			};
		}
	}), [["__scopeId", "data-v-baea3e69"]]);
	var _hoisted_1$3 = ["aria-hidden", "inert"];
	var _hoisted_2$3 = { class: "mnr-drawer-header" };
	var _hoisted_3$3 = { class: "mnr-drawer-heading" };
	var _hoisted_4$3 = {
		id: "mnr-drawer-title",
		class: "mnr-drawer-title"
	};
	var _hoisted_5$3 = {
		key: 0,
		class: "mnr-drawer-position"
	};
	var _hoisted_6$3 = {
		key: 0,
		class: "mnr-drawer-search"
	};
	var _hoisted_7$3 = {
		class: "mnr-offline-section",
		"aria-labelledby": "mnr-offline-title"
	};
	var _hoisted_8$3 = { class: "mnr-offline-main" };
	var _hoisted_9$2 = { class: "mnr-offline-copy" };
	var _hoisted_10$2 = { "aria-live": "polite" };
	var _hoisted_11$1 = ["disabled"];
	var _hoisted_12$1 = ["aria-valuenow"];
	var _hoisted_13$1 = {
		key: 1,
		class: "mnr-offline-secondary"
	};
	var _hoisted_14$1 = {
		key: 1,
		class: "mnr-drawer-state"
	};
	var _hoisted_15$1 = {
		key: 2,
		class: "mnr-drawer-state"
	};
	var _hoisted_16$1 = {
		key: 3,
		class: "mnr-drawer-state"
	};
	var _hoisted_17$1 = ["aria-current", "onClick"];
	var _hoisted_18$1 = {
		key: 0,
		class: "mnr-cache-mark",
		"aria-label": "已离线缓存"
	};
	var _hoisted_19$1 = { class: "mnr-chapter-title-text" };
	var SEARCH_THRESHOLD = 50;
	var ROW_HEIGHT = 44;
	var OVERSCAN = 8;
	var ChapterDrawer_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "ChapterDrawer",
		props: {
			isOpen: { type: Boolean },
			bookTitle: {},
			chapters: {},
			loading: { type: Boolean },
			cacheProgress: {},
			persistedCount: {}
		},
		emits: [
			"close",
			"select",
			"cacheAll",
			"retryCache",
			"clearCache"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const contentRef = ref(null);
			const drawerRef = ref(null);
			const closeButtonRef = ref(null);
			const query = ref("");
			const scrollTop = ref(0);
			const viewportHeight = ref(600);
			const filteredChapters = computed(() => {
				const needle = query.value.trim().toLocaleLowerCase();
				if (!needle) return props.chapters;
				return props.chapters.filter((chapter) => chapter.title.toLocaleLowerCase().includes(needle));
			});
			const currentChapterNumber = computed(() => {
				const index = props.chapters.findIndex((chapter) => chapter.isCurrent);
				return index >= 0 ? index + 1 : 0;
			});
			const offlineStatus = computed(() => {
				if (props.cacheProgress.running) return props.cacheProgress.total > 0 ? `已缓存 ${props.cacheProgress.done} / ${props.cacheProgress.total} 章` : "正在准备缓存";
				if (props.cacheProgress.failed > 0) return `有 ${props.cacheProgress.failed} 章缓存失败`;
				if (props.persistedCount > 0) return `已保存 ${props.persistedCount} 章`;
				return "尚未缓存";
			});
			const cachePercent = computed(() => {
				if (props.cacheProgress.total <= 0) return 0;
				return Math.min(100, props.cacheProgress.done / props.cacheProgress.total * 100);
			});
			const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN));
			const visibleCount = computed(() => Math.ceil(viewportHeight.value / ROW_HEIGHT) + 16);
			const endIndex = computed(() => Math.min(filteredChapters.value.length, startIndex.value + visibleCount.value));
			const visibleChapters = computed(() => filteredChapters.value.slice(startIndex.value, endIndex.value));
			const topSpacer = computed(() => startIndex.value * ROW_HEIGHT);
			const bottomSpacer = computed(() => Math.max(0, (filteredChapters.value.length - endIndex.value) * ROW_HEIGHT));
			function handleScroll() {
				const content = contentRef.value;
				if (!content) return;
				scrollTop.value = content.scrollTop;
				viewportHeight.value = content.clientHeight || 600;
			}
			function resetVirtualWindow() {
				scrollTop.value = 0;
				if (contentRef.value) contentRef.value.scrollTop = 0;
			}
			async function scrollCurrentIntoView() {
				await nextTick();
				const content = contentRef.value;
				if (!content || query.value) return;
				const currentIndex = props.chapters.findIndex((chapter) => chapter.isCurrent);
				if (currentIndex < 0) return;
				const targetTop = Math.max(0, currentIndex * ROW_HEIGHT - content.clientHeight / 2 + ROW_HEIGHT / 2);
				content.scrollTop = targetTop;
				scrollTop.value = targetTop;
				viewportHeight.value = content.clientHeight || 600;
			}
			function handleSelect(entry) {
				emit("select", entry);
				emit("close");
			}
			function trapFocus(event) {
				const drawer = drawerRef.value;
				if (!drawer) return;
				const focusable = Array.from(drawer.querySelectorAll("button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex=\"-1\"])")).filter((element) => element.offsetParent !== null || element === getDeepActiveElement());
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				const activeElement = getDeepActiveElement();
				if (event.shiftKey && activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
			function handleDialogKeydown(event) {
				const keyboardEvent = event;
				const drawer = drawerRef.value;
				if (!props.isOpen || !drawer || !keyboardEvent.composedPath().includes(drawer)) return;
				if (keyboardEvent.key === "Escape") {
					keyboardEvent.preventDefault();
					keyboardEvent.stopImmediatePropagation();
					emit("close");
				} else if (keyboardEvent.key === "Tab") {
					keyboardEvent.stopImmediatePropagation();
					trapFocus(keyboardEvent);
				}
			}
			useEventListener("keydown", handleDialogKeydown, { capture: true });
			watch(() => props.isOpen, async (open) => {
				if (open) {
					query.value = "";
					await scrollCurrentIntoView();
					closeButtonRef.value?.focus({ preventScroll: true });
				}
			}, { flush: "post" });
			watch(() => [
				props.loading,
				props.chapters.length,
				currentChapterNumber.value
			], () => {
				if (props.isOpen) scrollCurrentIntoView();
			}, { flush: "post" });
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock(Fragment, null, [createVNode(Transition, { name: "mnr-fade" }, {
					default: withCtx(() => [__props.isOpen ? (openBlock(), createElementBlock("div", {
						key: 0,
						class: "mnr-drawer-overlay",
						onClick: _cache[0] || (_cache[0] = ($event) => emit("close"))
					})) : createCommentVNode("", true)]),
					_: 1
				}), createBaseVNode("aside", {
					ref_key: "drawerRef",
					ref: drawerRef,
					class: normalizeClass(["mnr-drawer", { open: __props.isOpen }]),
					"aria-hidden": !__props.isOpen,
					inert: !__props.isOpen,
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "mnr-drawer-title"
				}, [
					createBaseVNode("header", _hoisted_2$3, [createBaseVNode("div", _hoisted_3$3, [createBaseVNode("h3", _hoisted_4$3, toDisplayString(__props.bookTitle || "目录"), 1), currentChapterNumber.value ? (openBlock(), createElementBlock("span", _hoisted_5$3, " 第 " + toDisplayString(currentChapterNumber.value) + " / " + toDisplayString(__props.chapters.length) + " 章 ", 1)) : createCommentVNode("", true)]), createBaseVNode("button", {
						ref_key: "closeButtonRef",
						ref: closeButtonRef,
						class: "mnr-drawer-close",
						"aria-label": "关闭目录",
						onClick: _cache[1] || (_cache[1] = ($event) => emit("close"))
					}, [..._cache[6] || (_cache[6] = [createBaseVNode("svg", {
						viewBox: "0 0 24 24",
						"aria-hidden": "true"
					}, [createBaseVNode("path", { d: "m6 6 12 12M18 6 6 18" })], -1)])], 512)]),
					__props.chapters.length > SEARCH_THRESHOLD ? (openBlock(), createElementBlock("div", _hoisted_6$3, [_cache[7] || (_cache[7] = createBaseVNode("label", {
						class: "mnr-visually-hidden",
						for: "mnr-chapter-search"
					}, "搜索章节", -1)), withDirectives(createBaseVNode("input", {
						id: "mnr-chapter-search",
						"onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => query.value = $event),
						type: "search",
						placeholder: "搜索章节",
						autocomplete: "off",
						onInput: resetVirtualWindow
					}, null, 544), [[
						vModelText,
						query.value,
						void 0,
						{ trim: true }
					]])])) : createCommentVNode("", true),
					createBaseVNode("section", _hoisted_7$3, [
						createBaseVNode("div", _hoisted_8$3, [createBaseVNode("div", _hoisted_9$2, [_cache[8] || (_cache[8] = createBaseVNode("strong", { id: "mnr-offline-title" }, "离线阅读", -1)), createBaseVNode("span", _hoisted_10$2, toDisplayString(offlineStatus.value), 1)]), createBaseVNode("button", {
							class: "mnr-offline-action primary",
							type: "button",
							disabled: __props.loading,
							onClick: _cache[3] || (_cache[3] = ($event) => emit("cacheAll"))
						}, toDisplayString(__props.cacheProgress.running ? "取消" : "缓存本书"), 9, _hoisted_11$1)]),
						__props.cacheProgress.running ? (openBlock(), createElementBlock("div", {
							key: 0,
							class: "mnr-cache-progress-track",
							role: "progressbar",
							"aria-label": "离线缓存进度",
							"aria-valuemin": "0",
							"aria-valuemax": "100",
							"aria-valuenow": Math.round(cachePercent.value)
						}, [createBaseVNode("div", {
							class: "mnr-cache-progress-fill",
							style: normalizeStyle({ width: `${cachePercent.value}%` })
						}, null, 4)], 8, _hoisted_12$1)) : createCommentVNode("", true),
						!__props.cacheProgress.running && (__props.cacheProgress.failed > 0 || __props.persistedCount > 0) ? (openBlock(), createElementBlock("div", _hoisted_13$1, [__props.cacheProgress.failed > 0 ? (openBlock(), createElementBlock("button", {
							key: 0,
							class: "mnr-offline-action",
							type: "button",
							onClick: _cache[4] || (_cache[4] = ($event) => emit("retryCache"))
						}, " 重试失败章节（" + toDisplayString(__props.cacheProgress.failed) + "） ", 1)) : createCommentVNode("", true), __props.persistedCount > 0 ? (openBlock(), createElementBlock("button", {
							key: 1,
							class: "mnr-offline-action danger",
							type: "button",
							onClick: _cache[5] || (_cache[5] = ($event) => emit("clearCache"))
						}, " 清除缓存 ")) : createCommentVNode("", true)])) : createCommentVNode("", true)
					]),
					__props.loading ? (openBlock(), createElementBlock("div", _hoisted_14$1, [createVNode(unref(MnrSpinner_default), { size: "small" }), _cache[9] || (_cache[9] = createBaseVNode("span", null, "加载目录中...", -1))])) : __props.chapters.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_15$1, "暂无目录")) : filteredChapters.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_16$1, "没有匹配的章节")) : (openBlock(), createElementBlock("div", {
						key: 4,
						ref_key: "contentRef",
						ref: contentRef,
						class: "mnr-drawer-content",
						onScrollPassive: handleScroll
					}, [createBaseVNode("ul", {
						class: "mnr-chapter-list",
						style: normalizeStyle({
							paddingTop: `${topSpacer.value}px`,
							paddingBottom: `${bottomSpacer.value}px`
						})
					}, [(openBlock(true), createElementBlock(Fragment, null, renderList(visibleChapters.value, (ch) => {
						return openBlock(), createElementBlock("li", { key: ch.url }, [createBaseVNode("button", {
							class: normalizeClass(["mnr-chapter-button", {
								active: ch.isCurrent,
								persisted: ch.isPersisted && !ch.isCurrent
							}]),
							"aria-current": ch.isCurrent ? "page" : void 0,
							onClick: ($event) => handleSelect(ch)
						}, [ch.isPersisted && !ch.isCurrent ? (openBlock(), createElementBlock("span", _hoisted_18$1, [..._cache[10] || (_cache[10] = [createBaseVNode("svg", {
							viewBox: "0 0 24 24",
							"aria-hidden": "true"
						}, [createBaseVNode("path", { d: "m5 12 4 4L19 6" })], -1)])])) : createCommentVNode("", true), createBaseVNode("span", _hoisted_19$1, toDisplayString(ch.title), 1)], 10, _hoisted_17$1)]);
					}), 128))], 4)], 544))
				], 10, _hoisted_1$3)], 64);
			};
		}
	}), [["__scopeId", "data-v-7f96ddd9"]]);
	var _hoisted_1$2 = { class: "mnr-reading-control" };
	var _hoisted_2$2 = { class: "mnr-reading-control-header" };
	var _hoisted_3$2 = ["id", "for"];
	var _hoisted_4$2 = ["for"];
	var _hoisted_5$2 = { class: "mnr-reading-slider-row" };
	var _hoisted_6$2 = { "aria-hidden": "true" };
	var _hoisted_7$2 = [
		"id",
		"min",
		"max",
		"step",
		"value",
		"aria-labelledby",
		"aria-valuetext"
	];
	var _hoisted_8$2 = { "aria-hidden": "true" };
	var ReadingSlider_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "ReadingSlider",
		props: {
			id: {},
			label: {},
			modelValue: {},
			min: {},
			max: {},
			step: { default: 1 },
			minLabel: {},
			maxLabel: {},
			displayValue: {}
		},
		emits: ["update:modelValue"],
		setup(__props, { emit: __emit }) {
			const emit = __emit;
			function handleInput(event) {
				emit("update:modelValue", Number(event.currentTarget.value));
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", _hoisted_1$2, [createBaseVNode("div", _hoisted_2$2, [createBaseVNode("label", {
					id: `${__props.id}-label`,
					for: __props.id
				}, toDisplayString(__props.label), 9, _hoisted_3$2), createBaseVNode("output", { for: __props.id }, toDisplayString(__props.displayValue), 9, _hoisted_4$2)]), createBaseVNode("div", _hoisted_5$2, [
					createBaseVNode("span", _hoisted_6$2, toDisplayString(__props.minLabel), 1),
					createBaseVNode("input", {
						id: __props.id,
						type: "range",
						min: __props.min,
						max: __props.max,
						step: __props.step,
						value: __props.modelValue,
						"aria-labelledby": `${__props.id}-label`,
						"aria-valuetext": __props.displayValue,
						onInput: handleInput
					}, null, 40, _hoisted_7$2),
					createBaseVNode("span", _hoisted_8$2, toDisplayString(__props.maxLabel), 1)
				])]);
			};
		}
	}), [["__scopeId", "data-v-e6745e69"]]);
	var MAX_CUSTOM_PARAGRAPH_FILTERS = 1e3;
	var CUSTOM_PARAGRAPH_FILTER_HOST_PREFIX = "@host=";
	function normalizeCustomParagraphFilterHostname(hostname) {
		const candidate = hostname.trim().toLowerCase().replace(/\.$/u, "");
		if (!candidate || /[\s\\/?#@]/u.test(candidate)) return null;
		try {
			const parsed = new URL(`https://${candidate}/`);
			if (parsed.username || parsed.password || parsed.port || parsed.pathname !== "/") return null;
			return parsed.hostname.toLowerCase().replace(/\.$/u, "") || null;
		} catch {
			return null;
		}
	}
	function getCustomParagraphFilterHostname(url) {
		if (!url) return null;
		try {
			return normalizeCustomParagraphFilterHostname(new URL(url).hostname);
		} catch {
			return null;
		}
	}
	function formatScopedCustomParagraphFilter(hostname, patternSource) {
		const normalizedHostname = normalizeCustomParagraphFilterHostname(hostname);
		const normalizedPattern = patternSource.trim();
		if (!normalizedHostname || !normalizedPattern) return null;
		return `${CUSTOM_PARAGRAPH_FILTER_HOST_PREFIX}${normalizedHostname} ${normalizedPattern}`;
	}
	function appendScopedCustomParagraphFilter(source, hostname, patternSource) {
		const normalizedHostname = normalizeCustomParagraphFilterHostname(hostname);
		if (!normalizedHostname) return {
			source,
			error: "无法识别当前章节 hostname"
		};
		const scopedRule = formatScopedCustomParagraphFilter(normalizedHostname, patternSource);
		if (!scopedRule) return {
			source,
			error: "请输入正则表达式"
		};
		const candidateError = compileCustomParagraphFilters(scopedRule).errors[0];
		if (candidateError) return {
			source,
			error: candidateError.message
		};
		if (source.split(/\r?\n/u).filter((line) => line.trim()).length >= 1e3) return {
			source,
			error: `全部网站合计最多支持 ${MAX_CUSTOM_PARAGRAPH_FILTERS} 条规则`
		};
		if ((compileCustomParagraphFilters(source).patternsByHostname.get(normalizedHostname)?.length || 0) >= 80) return {
			source,
			error: `每个网站最多支持 80 条规则`
		};
		return {
			source: `${source}${!source || /\r?\n$/u.test(source) ? "" : "\n"}${scopedRule}`,
			error: null
		};
	}
	function compileCustomParagraphFilters(source) {
		const globalPatterns = [];
		const patternsByHostname = new Map();
		const errors = [];
		const reportedSiteLimits = new Set();
		let totalRuleCount = 0;
		let reportedGlobalLimit = false;
		for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
			const line = rawLine.trim();
			if (!line) continue;
			totalRuleCount += 1;
			if (totalRuleCount > 1e3) {
				errors.push({
					line: index + 1,
					message: `全部网站合计最多支持 ${MAX_CUSTOM_PARAGRAPH_FILTERS} 条规则`
				});
				break;
			}
			let hostname = null;
			let patternSource = line;
			if (line.startsWith(CUSTOM_PARAGRAPH_FILTER_HOST_PREFIX)) {
				const scopedMatch = /^@host=(\S+)\s+(.+)$/u.exec(line);
				if (!scopedMatch) {
					errors.push({
						line: index + 1,
						message: "作用域规则格式应为 @host=域名 正则"
					});
					continue;
				}
				hostname = normalizeCustomParagraphFilterHostname(scopedMatch[1] || "");
				if (!hostname) {
					errors.push({
						line: index + 1,
						message: "hostname 无效"
					});
					continue;
				}
				patternSource = (scopedMatch[2] || "").trim();
			}
			if (patternSource.length > 256) {
				errors.push({
					line: index + 1,
					message: `单条规则不能超过 256 个字符`
				});
				continue;
			}
			let pattern;
			try {
				pattern = new RegExp(patternSource, "iu");
			} catch {
				errors.push({
					line: index + 1,
					message: "不是有效的正则表达式"
				});
				continue;
			}
			if (!hostname) {
				if (globalPatterns.length >= 20) {
					if (!reportedGlobalLimit) {
						errors.push({
							line: index + 1,
							message: `全局最多支持 20 条规则`
						});
						reportedGlobalLimit = true;
					}
					continue;
				}
				globalPatterns.push(pattern);
				continue;
			}
			const sitePatterns = patternsByHostname.get(hostname) || [];
			if (sitePatterns.length >= 80) {
				if (!reportedSiteLimits.has(hostname)) {
					errors.push({
						line: index + 1,
						message: `每个网站最多支持 80 条规则`
					});
					reportedSiteLimits.add(hostname);
				}
				continue;
			}
			sitePatterns.push(pattern);
			patternsByHostname.set(hostname, sitePatterns);
		}
		return {
			globalPatterns,
			patternsByHostname,
			errors
		};
	}
	function getCustomParagraphFiltersForHostname(compiled, hostname) {
		const normalizedHostname = hostname ? normalizeCustomParagraphFilterHostname(hostname) : null;
		const sitePatterns = normalizedHostname ? compiled.patternsByHostname.get(normalizedHostname) : void 0;
		if (!sitePatterns || sitePatterns.length === 0) return compiled.globalPatterns;
		if (compiled.globalPatterns.length === 0) return sitePatterns;
		return [...compiled.globalPatterns, ...sitePatterns];
	}
	function getCustomParagraphFiltersForUrl(compiled, url) {
		return getCustomParagraphFiltersForHostname(compiled, getCustomParagraphFilterHostname(url));
	}
	function filterCustomParagraphs(html, patterns) {
		if (!html || patterns.length === 0) return html;
		const template = document.createElement("template");
		template.innerHTML = html;
		for (const paragraph of template.content.querySelectorAll("p")) {
			const text = (paragraph.textContent || "").replace(/\s+/gu, " ").trim();
			if (patterns.some((pattern) => pattern.test(text))) paragraph.remove();
		}
		return template.innerHTML;
	}
	var _hoisted_1$1 = { class: "mnr-settings-header" };
	var _hoisted_2$1 = { class: "mnr-settings-content" };
	var _hoisted_3$1 = {
		class: "mnr-settings-section",
		"aria-labelledby": "mnr-appearance-title"
	};
	var _hoisted_4$1 = {
		class: "mnr-theme-grid",
		"aria-label": "阅读主题"
	};
	var _hoisted_5$1 = ["aria-pressed", "onClick"];
	var _hoisted_6$1 = ["value"];
	var _hoisted_7$1 = ["value"];
	var _hoisted_8$1 = { class: "mnr-settings-fieldset" };
	var _hoisted_9$1 = { class: "mnr-segmented-control" };
	var _hoisted_10$1 = ["aria-pressed", "onClick"];
	var _hoisted_11 = { class: "mnr-settings-group" };
	var _hoisted_12 = { class: "mnr-settings-group-content" };
	var _hoisted_13 = { class: "mnr-settings-group" };
	var _hoisted_14 = { class: "mnr-settings-group-content" };
	var _hoisted_15 = { class: "mnr-switch-row" };
	var _hoisted_16 = ["checked"];
	var _hoisted_17 = { class: "mnr-switch-row" };
	var _hoisted_18 = ["checked"];
	var _hoisted_19 = { class: "mnr-switch-row" };
	var _hoisted_20 = ["checked"];
	var _hoisted_21 = { class: "mnr-switch-row" };
	var _hoisted_22 = ["checked"];
	var _hoisted_23 = { class: "mnr-switch-row" };
	var _hoisted_24 = ["checked"];
	var _hoisted_25 = { class: "mnr-settings-group" };
	var _hoisted_26 = { class: "mnr-settings-group-content" };
	var _hoisted_27 = { class: "mnr-switch-row" };
	var _hoisted_28 = ["checked"];
	var _hoisted_29 = { class: "mnr-settings-fieldset" };
	var _hoisted_30 = { class: "mnr-segmented-control" };
	var _hoisted_31 = ["aria-pressed"];
	var _hoisted_32 = ["aria-pressed"];
	var _hoisted_33 = ["value"];
	var _hoisted_34 = { class: "mnr-cleanup-fields" };
	var _hoisted_35 = {
		id: "mnr-custom-cleanup-site",
		class: "mnr-field-help mnr-cleanup-site"
	};
	var _hoisted_36 = { class: "mnr-cleanup-add" };
	var _hoisted_37 = [
		"aria-describedby",
		"aria-invalid",
		"value"
	];
	var _hoisted_38 = ["disabled"];
	var _hoisted_39 = {
		key: 0,
		id: "mnr-custom-cleanup-draft-error",
		class: "mnr-field-error",
		role: "status"
	};
	var _hoisted_40 = [
		"aria-describedby",
		"aria-invalid",
		"value"
	];
	var _hoisted_41 = {
		key: 1,
		id: "mnr-custom-cleanup-error",
		class: "mnr-field-error",
		role: "status"
	};
	var _hoisted_42 = { class: "mnr-cleanup-guide" };
	var _hoisted_43 = { class: "mnr-settings-footer" };
	var SettingsPanel_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "SettingsPanel",
		props: {
			visible: { type: Boolean },
			siteAutoEnable: {
				type: Boolean,
				default: true
			},
			customCleanupHostname: { default: "" }
		},
		emits: [
			"close",
			"copyDiagnostics",
			"exit",
			"siteAutoEnableChange",
			"textConversionChange",
			"protectionModeChange"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const configStore = useConfigStore();
			const panelRef = ref(null);
			const titleRef = ref(null);
			const customCleanupDraft = ref("");
			const customCleanupDraftError = ref("");
			const compiledCustomCleanup = computed(() => compileCustomParagraphFilters(configStore.customCleanupRegex));
			const customCleanupErrors = computed(() => compiledCustomCleanup.value.errors);
			const customCleanupErrorMessage = computed(() => customCleanupErrors.value.map((error) => `第 ${error.line} 行：${error.message}`).join("；"));
			const themes = THEMES;
			const conversionOptions = [
				{
					label: "原文",
					value: "none"
				},
				{
					label: "简体",
					value: "sc"
				},
				{
					label: "繁體",
					value: "tc"
				}
			];
			const fontOptions = [
				{
					label: "系统默认",
					value: "system-ui, -apple-system, \"Microsoft YaHei\", sans-serif"
				},
				{
					label: "思源宋体",
					value: "'Noto Serif SC', 'Source Han Serif SC', serif"
				},
				{
					label: "苹方",
					value: "'PingFang SC', 'Hiragino Sans GB', sans-serif"
				},
				{
					label: "楷体",
					value: "'Kaiti SC', 'STKaiti', serif"
				}
			];
			function closePanel() {
				emit("close");
			}
			function trapFocus(event) {
				const panel = panelRef.value;
				if (!panel) return;
				const focusable = Array.from(panel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex=\"-1\"])")).filter((element) => element.offsetParent !== null || element === getDeepActiveElement());
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				const activeElement = getDeepActiveElement();
				if (activeElement === titleRef.value) {
					event.preventDefault();
					(event.shiftKey ? last : first).focus();
				} else if (event.shiftKey && activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
			function handleDialogKeydown(event) {
				const keyboardEvent = event;
				const panel = panelRef.value;
				if (!props.visible || !panel || !keyboardEvent.composedPath().includes(panel)) return;
				if (keyboardEvent.key === "Escape") {
					keyboardEvent.preventDefault();
					keyboardEvent.stopImmediatePropagation();
					closePanel();
				} else if (keyboardEvent.key === "Tab") {
					keyboardEvent.stopImmediatePropagation();
					trapFocus(keyboardEvent);
				}
			}
			useEventListener("keydown", handleDialogKeydown, { capture: true });
			function updateNumericReading(key, value) {
				configStore.updateReading({ [key]: value });
			}
			function updateFontFamily(event) {
				configStore.updateReading({ fontFamily: event.currentTarget.value });
			}
			function updateTextConversion(mode) {
				configStore.updateReading({ textConversion: mode });
				emit("textConversionChange", mode);
			}
			function updateBehavior(key, event) {
				configStore.updateBehavior({ [key]: event.currentTarget.checked });
			}
			function updateSiteAutoEnable(event) {
				emit("siteAutoEnableChange", event.currentTarget.checked);
			}
			function updateCustomCSS(event) {
				configStore.setCustomCSS(event.currentTarget.value);
			}
			function updateCustomCleanupRegex(event) {
				configStore.setCustomCleanupRegex(event.currentTarget.value);
			}
			function updateCustomCleanupDraft(event) {
				customCleanupDraft.value = event.currentTarget.value;
				customCleanupDraftError.value = "";
			}
			function addCurrentSiteCleanupRule() {
				const result = appendScopedCustomParagraphFilter(configStore.customCleanupRegex, props.customCleanupHostname, customCleanupDraft.value);
				if (result.error) {
					customCleanupDraftError.value = result.error;
					return;
				}
				configStore.setCustomCleanupRegex(result.source);
				customCleanupDraft.value = "";
				customCleanupDraftError.value = "";
			}
			function resetAppearance() {
				configStore.setTheme("system");
				configStore.resetReading();
				emit("textConversionChange", "none");
			}
			watch(() => props.visible, async (visible) => {
				if (visible) {
					await nextTick();
					titleRef.value?.focus({ preventScroll: true });
					return;
				}
				customCleanupDraft.value = "";
				customCleanupDraftError.value = "";
				configStore.flushSave();
			});
			return (_ctx, _cache) => {
				return openBlock(), createBlock(Transition, { name: "mnr-slide" }, {
					default: withCtx(() => [__props.visible ? (openBlock(), createElementBlock("div", {
						key: 0,
						class: "mnr-settings-overlay",
						onClick: withModifiers(closePanel, ["self"])
					}, [createBaseVNode("section", {
						ref_key: "panelRef",
						ref: panelRef,
						class: "mnr-settings-panel",
						role: "dialog",
						"aria-modal": "true",
						"aria-labelledby": "mnr-settings-title"
					}, [
						createBaseVNode("header", _hoisted_1$1, [createBaseVNode("h3", {
							id: "mnr-settings-title",
							ref_key: "titleRef",
							ref: titleRef,
							tabindex: "-1"
						}, "阅读设置", 512), createBaseVNode("button", {
							class: "mnr-close-btn",
							"aria-label": "关闭设置",
							onClick: closePanel
						}, [..._cache[15] || (_cache[15] = [createBaseVNode("svg", {
							viewBox: "0 0 24 24",
							"aria-hidden": "true"
						}, [createBaseVNode("path", { d: "m6 6 12 12M18 6 6 18" })], -1)])])]),
						createBaseVNode("div", _hoisted_2$1, [
							createBaseVNode("section", _hoisted_3$1, [
								_cache[17] || (_cache[17] = createBaseVNode("h4", { id: "mnr-appearance-title" }, "阅读外观", -1)),
								createBaseVNode("div", _hoisted_4$1, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(themes), (theme) => {
									return openBlock(), createElementBlock("button", {
										key: theme.id,
										class: normalizeClass(["mnr-theme-btn", { active: unref(configStore).themeId === theme.id }]),
										"aria-pressed": unref(configStore).themeId === theme.id,
										style: normalizeStyle({
											background: theme.background,
											color: theme.text,
											borderColor: unref(configStore).themeId === theme.id ? "var(--mnr-link, #1976d2)" : theme.border
										}),
										onClick: ($event) => unref(configStore).setTheme(theme.id)
									}, toDisplayString(theme.name), 15, _hoisted_5$1);
								}), 128))]),
								_cache[18] || (_cache[18] = createBaseVNode("div", {
									class: "mnr-reading-preview",
									"aria-hidden": "true"
								}, [createBaseVNode("span", null, "排版预览"), createBaseVNode("p", null, "山高月小，水落石出。愿每一页都读得舒适从容。")], -1)),
								createVNode(ReadingSlider_default, {
									id: "mnr-font-size",
									label: "字号",
									"model-value": unref(configStore).reading.fontSize,
									min: 14,
									max: 28,
									"min-label": "小",
									"max-label": "大",
									"display-value": `${unref(configStore).reading.fontSize} 像素`,
									"onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => updateNumericReading("fontSize", $event))
								}, null, 8, ["model-value", "display-value"]),
								createVNode(ReadingSlider_default, {
									id: "mnr-line-height",
									label: "行距",
									"model-value": unref(configStore).reading.lineHeight,
									min: 1.4,
									max: 2.4,
									step: .1,
									"min-label": "紧",
									"max-label": "松",
									"display-value": `${unref(configStore).reading.lineHeight} 倍`,
									"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => updateNumericReading("lineHeight", $event))
								}, null, 8, ["model-value", "display-value"]),
								_cache[19] || (_cache[19] = createBaseVNode("label", {
									class: "mnr-field-label",
									for: "mnr-font-family"
								}, "字体", -1)),
								createBaseVNode("select", {
									id: "mnr-font-family",
									class: "mnr-select",
									value: unref(configStore).reading.fontFamily,
									onChange: updateFontFamily
								}, [(openBlock(), createElementBlock(Fragment, null, renderList(fontOptions, (option) => {
									return createBaseVNode("option", {
										key: option.label,
										value: option.value
									}, toDisplayString(option.label), 9, _hoisted_7$1);
								}), 64))], 40, _hoisted_6$1),
								createBaseVNode("fieldset", _hoisted_8$1, [_cache[16] || (_cache[16] = createBaseVNode("legend", null, "简繁转换", -1)), createBaseVNode("div", _hoisted_9$1, [(openBlock(), createElementBlock(Fragment, null, renderList(conversionOptions, (option) => {
									return createBaseVNode("button", {
										key: option.value,
										class: normalizeClass(["mnr-segment", { active: unref(configStore).reading.textConversion === option.value }]),
										"aria-pressed": unref(configStore).reading.textConversion === option.value,
										onClick: ($event) => updateTextConversion(option.value)
									}, toDisplayString(option.label), 11, _hoisted_10$1);
								}), 64))])]),
								createBaseVNode("button", {
									class: "mnr-secondary-action",
									onClick: resetAppearance
								}, "恢复默认外观")
							]),
							createBaseVNode("details", _hoisted_11, [_cache[20] || (_cache[20] = createBaseVNode("summary", null, "排版细节", -1)), createBaseVNode("div", _hoisted_12, [
								createVNode(ReadingSlider_default, {
									id: "mnr-letter-spacing",
									label: "字间距",
									"model-value": unref(configStore).reading.letterSpacing,
									min: 0,
									max: .2,
									step: .01,
									"min-label": "紧",
									"max-label": "松",
									"display-value": `${Math.round(unref(configStore).reading.letterSpacing * 100)}%`,
									"onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => updateNumericReading("letterSpacing", $event))
								}, null, 8, ["model-value", "display-value"]),
								createVNode(ReadingSlider_default, {
									id: "mnr-paragraph-indent",
									label: "段落缩进",
									"model-value": unref(configStore).reading.paragraphIndent,
									min: 0,
									max: 4,
									step: .5,
									"min-label": "0",
									"max-label": "4",
									"display-value": `${unref(configStore).reading.paragraphIndent} 字`,
									"onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => updateNumericReading("paragraphIndent", $event))
								}, null, 8, ["model-value", "display-value"]),
								createVNode(ReadingSlider_default, {
									id: "mnr-max-width",
									class: "mnr-desktop-width",
									label: "桌面内容宽度",
									"model-value": unref(configStore).reading.maxWidth,
									min: 500,
									max: 1200,
									step: 50,
									"min-label": "窄",
									"max-label": "宽",
									"display-value": `${unref(configStore).reading.maxWidth} 像素`,
									"onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => updateNumericReading("maxWidth", $event))
								}, null, 8, ["model-value", "display-value"]),
								createVNode(ReadingSlider_default, {
									id: "mnr-padding",
									label: "页面边距",
									"model-value": unref(configStore).reading.padding,
									min: 12,
									max: 48,
									step: 2,
									"min-label": "窄",
									"max-label": "宽",
									"display-value": `${unref(configStore).reading.padding} 像素`,
									"onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => updateNumericReading("padding", $event))
								}, null, 8, ["model-value", "display-value"])
							])]),
							createBaseVNode("details", _hoisted_13, [_cache[26] || (_cache[26] = createBaseVNode("summary", null, "阅读行为", -1)), createBaseVNode("div", _hoisted_14, [
								createBaseVNode("label", _hoisted_15, [_cache[21] || (_cache[21] = createBaseVNode("span", null, "显示阅读进度", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: unref(configStore).behavior.showProgress,
									onChange: _cache[6] || (_cache[6] = ($event) => updateBehavior("showProgress", $event))
								}, null, 40, _hoisted_16)]),
								createBaseVNode("label", _hoisted_17, [_cache[22] || (_cache[22] = createBaseVNode("span", null, "自动加载下一章", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: unref(configStore).behavior.preloadNext,
									onChange: _cache[7] || (_cache[7] = ($event) => updateBehavior("preloadNext", $event))
								}, null, 40, _hoisted_18)]),
								createBaseVNode("label", _hoisted_19, [_cache[23] || (_cache[23] = createBaseVNode("span", null, "自动隐藏工具栏", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: unref(configStore).behavior.autoHideHeader,
									onChange: _cache[8] || (_cache[8] = ($event) => updateBehavior("autoHideHeader", $event))
								}, null, 40, _hoisted_20)]),
								createBaseVNode("label", _hoisted_21, [_cache[24] || (_cache[24] = createBaseVNode("span", null, "键盘导航", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: unref(configStore).behavior.keyboardNavigation,
									onChange: _cache[9] || (_cache[9] = ($event) => updateBehavior("keyboardNavigation", $event))
								}, null, 40, _hoisted_22)]),
								createBaseVNode("label", _hoisted_23, [_cache[25] || (_cache[25] = createBaseVNode("span", null, "左右滑动翻屏", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: unref(configStore).behavior.swipeGestures,
									onChange: _cache[10] || (_cache[10] = ($event) => updateBehavior("swipeGestures", $event))
								}, null, 40, _hoisted_24)])
							])]),
							createBaseVNode("details", _hoisted_25, [_cache[35] || (_cache[35] = createBaseVNode("summary", null, "本站与高级", -1)), createBaseVNode("div", _hoisted_26, [
								createBaseVNode("label", _hoisted_27, [_cache[27] || (_cache[27] = createBaseVNode("span", null, "在本站自动开启", -1)), createBaseVNode("input", {
									type: "checkbox",
									checked: __props.siteAutoEnable,
									onChange: updateSiteAutoEnable
								}, null, 40, _hoisted_28)]),
								createBaseVNode("fieldset", _hoisted_29, [_cache[28] || (_cache[28] = createBaseVNode("legend", null, "网站防护", -1)), createBaseVNode("div", _hoisted_30, [createBaseVNode("button", {
									class: normalizeClass(["mnr-segment", { active: unref(configStore).protection.mode === "standard" }]),
									"aria-pressed": unref(configStore).protection.mode === "standard",
									onClick: _cache[11] || (_cache[11] = ($event) => emit("protectionModeChange", "standard"))
								}, " 标准 ", 10, _hoisted_31), createBaseVNode("button", {
									class: normalizeClass(["mnr-segment", { active: unref(configStore).protection.mode === "aggressive" }]),
									"aria-pressed": unref(configStore).protection.mode === "aggressive",
									onClick: _cache[12] || (_cache[12] = ($event) => emit("protectionModeChange", "aggressive"))
								}, " 强力 ", 10, _hoisted_32)])]),
								_cache[34] || (_cache[34] = createBaseVNode("label", {
									class: "mnr-field-label",
									for: "mnr-custom-css"
								}, "自定义 CSS", -1)),
								createBaseVNode("textarea", {
									id: "mnr-custom-css",
									class: "mnr-custom-css",
									rows: "5",
									spellcheck: "false",
									placeholder: ".mnr-reader-content { ... }",
									value: unref(configStore).customCSS,
									onInput: updateCustomCSS
								}, null, 40, _hoisted_33),
								createBaseVNode("div", _hoisted_34, [
									_cache[31] || (_cache[31] = createBaseVNode("h4", { class: "mnr-field-label" }, "自定义正则清理", -1)),
									_cache[32] || (_cache[32] = createBaseVNode("p", {
										id: "mnr-custom-cleanup-help",
										class: "mnr-field-help"
									}, " 每行一条正则，匹配后隐藏整段正文。 ", -1)),
									createBaseVNode("p", _hoisted_35, " 本站 · " + toDisplayString(__props.customCleanupHostname || "无法识别"), 1),
									createBaseVNode("div", _hoisted_36, [createBaseVNode("input", {
										id: "mnr-custom-cleanup-draft",
										class: "mnr-cleanup-input",
										type: "text",
										spellcheck: "false",
										"aria-label": "本站清理正则",
										"aria-describedby": customCleanupDraftError.value ? "mnr-custom-cleanup-site mnr-custom-cleanup-draft-error" : "mnr-custom-cleanup-site",
										"aria-invalid": !!customCleanupDraftError.value,
										placeholder: "输入本站正则",
										value: customCleanupDraft.value,
										onInput: updateCustomCleanupDraft
									}, null, 40, _hoisted_37), createBaseVNode("button", {
										type: "button",
										class: "mnr-secondary-action mnr-cleanup-add-button",
										disabled: !__props.customCleanupHostname || !customCleanupDraft.value.trim(),
										onClick: addCurrentSiteCleanupRule
									}, " 添加规则 ", 8, _hoisted_38)]),
									customCleanupDraftError.value ? (openBlock(), createElementBlock("p", _hoisted_39, toDisplayString(customCleanupDraftError.value), 1)) : createCommentVNode("", true),
									_cache[33] || (_cache[33] = createBaseVNode("label", {
										class: "mnr-cleanup-editor-label",
										for: "mnr-custom-cleanup-regex"
									}, "全部规则", -1)),
									createBaseVNode("textarea", {
										id: "mnr-custom-cleanup-regex",
										class: "mnr-custom-css",
										rows: "4",
										spellcheck: "false",
										"aria-describedby": customCleanupErrors.value.length > 0 ? "mnr-custom-cleanup-help mnr-custom-cleanup-error" : "mnr-custom-cleanup-help",
										"aria-invalid": customCleanupErrors.value.length > 0,
										placeholder: "例如：小说免费阅读，请收藏.*",
										value: unref(configStore).customCleanupRegex,
										onInput: updateCustomCleanupRegex
									}, null, 40, _hoisted_40),
									customCleanupErrors.value.length > 0 ? (openBlock(), createElementBlock("p", _hoisted_41, toDisplayString(customCleanupErrorMessage.value), 1)) : createCommentVNode("", true),
									createBaseVNode("details", _hoisted_42, [
										_cache[29] || (_cache[29] = createBaseVNode("summary", null, "规则语法与数量限制", -1)),
										_cache[30] || (_cache[30] = createBaseVNode("p", null, [
											createTextVNode(" 无前缀时对所有网站生效；以 "),
											createBaseVNode("code", null, "@host=域名"),
											createTextVNode(" 开头时仅对该网站生效。 上方“添加规则”会自动填写本站前缀。 ")
										], -1)),
										createBaseVNode("p", null, " 全局最多 " + toDisplayString(unref(20)) + " 条，每站最多 " + toDisplayString(unref(80)) + " 条，合计最多 " + toDisplayString(unref(MAX_CUSTOM_PARAGRAPH_FILTERS)) + " 条；每条最多 " + toDisplayString(unref(256)) + " 字符。 ", 1)
									])
								]),
								createBaseVNode("button", {
									class: "mnr-secondary-action",
									onClick: _cache[13] || (_cache[13] = ($event) => emit("copyDiagnostics"))
								}, " 复制诊断信息 ")
							])])
						]),
						createBaseVNode("footer", _hoisted_43, [createBaseVNode("button", {
							class: "mnr-exit-btn",
							onClick: _cache[14] || (_cache[14] = ($event) => emit("exit"))
						}, "退出阅读模式")])
					], 512)])) : createCommentVNode("", true)]),
					_: 1
				});
			};
		}
	}), [["__scopeId", "data-v-c4214e4a"]]);
	var _hoisted_1 = ["inert"];
	var _hoisted_2 = {
		key: 0,
		class: "mnr-loading-prev"
	};
	var _hoisted_3 = ["data-chapter-url", "lang"];
	var _hoisted_4 = { class: "mnr-chapter-title" };
	var _hoisted_5 = {
		key: 0,
		class: "mnr-section-progress",
		role: "status",
		"aria-live": "polite"
	};
	var _hoisted_6 = {
		key: 1,
		class: "mnr-section-progress",
		role: "status"
	};
	var _hoisted_7 = {
		key: 1,
		class: "mnr-loading-next"
	};
	var _hoisted_8 = {
		key: 2,
		class: "mnr-chapter-end"
	};
	var _hoisted_9 = { class: "mnr-chapter-nav" };
	var _hoisted_10 = ["href"];
	var SCROLL_BOUNDARY_EPSILON_PX = 4;
	var ReaderView_default = _plugin_vue_export_helper_default(defineComponent({
		__name: "ReaderView",
		props: { siteAutoEnable: {
			type: Boolean,
			default: true
		} },
		emits: [
			"copyDiagnostics",
			"exit",
			"siteAutoEnableChange",
			"protectionModeChange"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const readerStore = useReaderStore();
			const configStore = useConfigStore();
			const mainRef = ref(null);
			const bottomSentinel = ref(null);
			const isNavigating = ref(false);
			const showControls = ref(true);
			const chapterRefs = new Map();
			const siteAutoEnableValue = ref(props.siteAutoEnable);
			const { settingsVisible, drawerOpen, hasOpenPanel, toggleDrawer, closeDrawer, openSettings, closeSettings, toggleSettings } = useReaderUIControls({
				readerStore,
				showControls
			});
			const autoHideHeader = computed(() => configStore.behavior.autoHideHeader);
			const contentLang = computed(() => {
				if (readerStore.currentConversionMode === "sc") return "zh-CN";
				if (readerStore.currentConversionMode === "tc") return "zh-TW";
			});
			const compiledCustomParagraphFilters = computed(() => compileCustomParagraphFilters(configStore.customCleanupRegex));
			const customCleanupHostname = computed(() => getCustomParagraphFilterHostname(readerStore.chapter?.url) || "");
			const displayChapters = computed(() => {
				const compiled = compiledCustomParagraphFilters.value;
				return readerStore.chapters.map((entry) => ({
					...entry,
					displayContent: filterCustomParagraphs(entry.chapter.content, getCustomParagraphFiltersForUrl(compiled, entry.chapter.url))
				}));
			});
			const { scheduleAutoLoadNext, observeBottomSentinel } = useReaderAutoLoad({
				mainRef,
				chapterRefs,
				readerStore,
				configStore,
				isNavigating
			});
			const { restorePosition, cancelRestore, savePosition, flushPosition } = useReaderPosition({
				mainRef,
				chapterRefs,
				readerStore,
				isNavigating
			});
			const { handleScroll } = useReaderScroll({
				mainRef,
				chapterRefs,
				readerStore,
				autoHideHeader,
				showControls,
				isNavigating,
				scheduleAutoLoadNext,
				savePosition
			});
			const { navigateChapter, jumpToCachedChapter, scrollReader, loadBoundaryChapter, turnReaderPage, handleWheel } = useChapterNavigation({
				mainRef,
				chapterRefs,
				readerStore,
				isNavigating,
				onViewportSettled: handleScroll
			});
			const gesturesIdle = computed(() => !hasOpenPanel.value && !readerStore.isLoadingPrev && !readerStore.isLoadingNext && !isNavigating.value);
			const { boundaryGestureDirection, boundaryGestureHint, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = useTouchGestures({
				swipeEnabled: computed(() => configStore.behavior.swipeGestures && gesturesIdle.value),
				getBoundaryDirection,
				onBoundaryPull: (direction) => void loadBoundaryChapter(direction),
				onSwipeLeft: () => void turnReaderPage("next"),
				onSwipeRight: () => void turnReaderPage("prev")
			});
			function shieldEvent(event) {
				event.stopPropagation();
			}
			function getBoundaryDirection() {
				const mainEl = mainRef.value;
				if (!mainEl || !gesturesIdle.value) return null;
				if (mainEl.scrollHeight - (mainEl.scrollTop + mainEl.clientHeight) <= SCROLL_BOUNDARY_EPSILON_PX && readerStore.hasNext) return "next";
				if (mainEl.scrollTop <= SCROLL_BOUNDARY_EPSILON_PX && readerStore.hasPrev) return "prev";
				return null;
			}
			function handleReaderTouchEnd(event) {
				if (!handleTouchEnd(event)) scheduleAutoLoadNext("settled");
			}
			function handleReaderTouchCancel() {
				handleTouchCancel();
				scheduleAutoLoadNext("settled");
			}
			function handleChapterSelect(entry) {
				if (entry.isCached) jumpToCachedChapter(entry.url);
				else window.location.href = entry.url;
			}
			function handleContentClick(e) {
				const target = e.target;
				if (target.tagName === "A") {
					const href = target.getAttribute("href");
					if (href && !href.startsWith("javascript:")) return;
					e.preventDefault();
					return;
				}
				const selection = window.getSelection();
				if (!selection || selection.toString().length === 0) showControls.value = !showControls.value;
			}
			function handleCacheAll() {
				if (readerStore.cacheProgress.running) {
					readerStore.cancelCacheAll();
					readerStore.showToast("已取消离线缓存", "info");
					return;
				}
				if (readerStore.tocLoading) return;
				if (readerStore.toc.length === 0) {
					readerStore.loadToc();
					return;
				}
				const remaining = readerStore.tocWithStatus.filter((entry) => entry.access !== "locked" && !entry.isPersisted).length;
				if (remaining > 0 && !window.confirm(`预计缓存 ${remaining} 章，过程可能需要一些时间。是否继续？`)) return;
				readerStore.startCacheAll();
			}
			function handleClearCache() {
				if (!window.confirm("确定要清除本书的离线缓存吗？")) return;
				readerStore.clearPersistedCache();
				readerStore.showToast("离线缓存已清除", "info");
			}
			function handleSiteAutoEnableChange(enabled) {
				siteAutoEnableValue.value = enabled;
				emit("siteAutoEnableChange", enabled);
				readerStore.showToast(enabled ? "已开启本站自动阅读" : "已关闭本站自动阅读", "info");
			}
			function sectionProgressLabel(progress) {
				return progress.total ? `正在加载本章后续内容 ${progress.loaded}/${progress.total}` : `正在加载本章后续内容 ${progress.loaded}`;
			}
			function setChapterRef(url) {
				return (el) => {
					if (!el) {
						chapterRefs.delete(url);
						return;
					}
					chapterRefs.set(url, el);
				};
			}
			function exitReader() {
				emit("exit");
			}
			const readerShortcutsEnabled = computed(() => configStore.behavior.keyboardNavigation && !hasOpenPanel.value);
			useKeyboardShortcuts([
				{
					key: "tab",
					handler: toggleDrawer,
					preventDefault: true,
					allowRepeat: false
				},
				{
					key: "enter",
					handler: () => {
						const indexUrl = readerStore.chapter?.indexUrl;
						if (indexUrl) window.location.href = indexUrl;
					},
					preventDefault: true,
					allowRepeat: false
				},
				{
					key: ["s", ","],
					handler: toggleSettings,
					preventDefault: true,
					allowRepeat: false
				},
				{
					key: "q",
					handler: exitReader,
					preventDefault: true,
					stopPropagation: true,
					allowRepeat: false
				},
				{
					key: ["arrowleft", "p"],
					handler: () => navigateChapter("prev"),
					preventDefault: true,
					stopPropagation: true,
					allowRepeat: false
				},
				{
					key: ["arrowright", "n"],
					handler: () => navigateChapter("next"),
					preventDefault: true,
					stopPropagation: true,
					allowRepeat: false
				},
				{
					key: "arrowup",
					handler: () => void scrollReader("up"),
					preventDefault: true,
					stopPropagation: true
				},
				{
					key: "arrowdown",
					handler: () => void scrollReader("down"),
					preventDefault: true,
					stopPropagation: true
				},
				{
					key: " ",
					handler: (e) => void turnReaderPage(e.shiftKey ? "prev" : "next"),
					preventDefault: true,
					stopPropagation: true,
					allowRepeat: false
				}
			], { enabled: readerShortcutsEnabled });
			watch(() => readerStore.currentChapterIndex, () => {
				flushReadingPositions();
			});
			function flushPersistentState() {
				flushPosition();
				configStore.flushSave();
			}
			function handleVisibilityChange() {
				if (document.visibilityState === "hidden") flushPersistentState();
			}
			onMounted(async () => {
				configStore.applyAll();
				const textConversion = configStore.reading.textConversion;
				if (textConversion !== "none") await readerStore.applyTextConversion(textConversion);
				if (mainRef.value) {
					mainRef.value.addEventListener("scroll", handleScroll, { passive: true });
					mainRef.value.addEventListener("wheel", handleWheel, { passive: false });
					mainRef.value.addEventListener("touchstart", handleTouchStart, { passive: true });
					mainRef.value.addEventListener("touchmove", handleTouchMove, { passive: false });
					mainRef.value.addEventListener("touchend", handleReaderTouchEnd, { passive: true });
					mainRef.value.addEventListener("touchcancel", handleReaderTouchCancel, { passive: true });
				}
				document.addEventListener("visibilitychange", handleVisibilityChange);
				window.addEventListener("pagehide", flushPersistentState);
				observeBottomSentinel(bottomSentinel.value);
				await nextTick();
				await restorePosition();
				mainRef.value?.focus();
				scheduleAutoLoadNext("state");
			});
			onUnmounted(() => {
				flushPersistentState();
				document.removeEventListener("visibilitychange", handleVisibilityChange);
				window.removeEventListener("pagehide", flushPersistentState);
				if (mainRef.value) {
					mainRef.value.removeEventListener("scroll", handleScroll);
					mainRef.value.removeEventListener("wheel", handleWheel);
					mainRef.value.removeEventListener("touchstart", handleTouchStart);
					mainRef.value.removeEventListener("touchmove", handleTouchMove);
					mainRef.value.removeEventListener("touchend", handleReaderTouchEnd);
					mainRef.value.removeEventListener("touchcancel", handleReaderTouchCancel);
				}
				chapterRefs.clear();
			});
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", {
					class: "mnr-reader",
					onWheelCapture: _cache[3] || (_cache[3] = (...args) => unref(cancelRestore) && unref(cancelRestore)(...args)),
					onTouchstartCapture: _cache[4] || (_cache[4] = (...args) => unref(cancelRestore) && unref(cancelRestore)(...args)),
					onPointerdownCapture: _cache[5] || (_cache[5] = (...args) => unref(cancelRestore) && unref(cancelRestore)(...args)),
					onKeydownCapture: _cache[6] || (_cache[6] = (...args) => unref(cancelRestore) && unref(cancelRestore)(...args)),
					onClick: shieldEvent,
					onMousedown: shieldEvent,
					onMouseup: shieldEvent,
					onWheel: shieldEvent,
					onTouchstart: shieldEvent,
					onTouchmove: shieldEvent,
					onTouchend: shieldEvent,
					onPointerdown: shieldEvent,
					onPointermove: shieldEvent,
					onPointerup: shieldEvent
				}, [
					unref(configStore).behavior.showProgress ? (openBlock(), createBlock(ProgressIndicator_default, {
						key: 0,
						percent: unref(readerStore).scrollPercent,
						"auto-hide": true
					}, null, 8, ["percent"])) : createCommentVNode("", true),
					unref(boundaryGestureHint) ? (openBlock(), createElementBlock("div", {
						key: 1,
						class: normalizeClass(["mnr-boundary-gesture-hint", `is-${unref(boundaryGestureDirection)}`]),
						role: "status",
						"aria-live": "polite"
					}, toDisplayString(unref(boundaryGestureHint)), 3)) : createCommentVNode("", true),
					createVNode(FloatingToolbar_default, {
						visible: showControls.value,
						onToggleDrawer: unref(toggleDrawer),
						onOpenSettings: unref(openSettings)
					}, null, 8, [
						"visible",
						"onToggleDrawer",
						"onOpenSettings"
					]),
					createVNode(ChapterDrawer_default, {
						"is-open": unref(drawerOpen),
						"book-title": unref(readerStore).bookTitle,
						chapters: unref(readerStore).tocWithStatus,
						loading: unref(readerStore).tocLoading,
						"cache-progress": unref(readerStore).cacheProgress,
						"persisted-count": unref(readerStore).persistedUrls.size,
						onClose: unref(closeDrawer),
						onSelect: handleChapterSelect,
						onCacheAll: handleCacheAll,
						onRetryCache: unref(readerStore).retryFailedCache,
						onClearCache: handleClearCache
					}, null, 8, [
						"is-open",
						"book-title",
						"chapters",
						"loading",
						"cache-progress",
						"persisted-count",
						"onClose",
						"onRetryCache"
					]),
					createBaseVNode("main", {
						ref_key: "mainRef",
						ref: mainRef,
						class: "mnr-reader-main",
						tabindex: "-1",
						inert: unref(hasOpenPanel)
					}, [
						unref(readerStore).isLoadingPrev ? (openBlock(), createElementBlock("div", _hoisted_2, [createVNode(unref(MnrSpinner_default), { size: "small" }), _cache[7] || (_cache[7] = createBaseVNode("span", null, "加载上一章...", -1))])) : createCommentVNode("", true),
						(openBlock(true), createElementBlock(Fragment, null, renderList(displayChapters.value, (entry) => {
							return openBlock(), createElementBlock("article", {
								key: entry.id,
								ref_for: true,
								ref: setChapterRef(entry.chapter.url),
								class: "mnr-reader-content",
								"data-chapter-url": entry.chapter.url,
								lang: contentLang.value,
								onClick: handleContentClick
							}, [
								createBaseVNode("h1", _hoisted_4, toDisplayString(entry.chapter.title), 1),
								withDirectives(createBaseVNode("div", null, null, 512), [[unref(vChapterContent), entry.displayContent]]),
								entry.sectionProgress ? (openBlock(), createElementBlock("div", _hoisted_5, [createVNode(unref(MnrSpinner_default), { size: "small" }), createBaseVNode("span", null, toDisplayString(sectionProgressLabel(entry.sectionProgress)), 1)])) : entry.sectionsIncomplete ? (openBlock(), createElementBlock("div", _hoisted_6, [..._cache[8] || (_cache[8] = [createBaseVNode("span", null, "— 本章内容不完整 —", -1)])])) : createCommentVNode("", true)
							], 8, _hoisted_3);
						}), 128)),
						createBaseVNode("div", {
							ref_key: "bottomSentinel",
							ref: bottomSentinel,
							class: "mnr-sentinel"
						}, null, 512),
						unref(readerStore).isLoadingNext ? (openBlock(), createElementBlock("div", _hoisted_7, [createVNode(unref(MnrSpinner_default), { size: "small" }), _cache[9] || (_cache[9] = createBaseVNode("span", null, "加载下一章...", -1))])) : createCommentVNode("", true),
						unref(readerStore).chapters.length > 0 && !unref(readerStore).hasNext && !unref(readerStore).isLoadingNext && !unref(readerStore).isTailChapterIncomplete ? (openBlock(), createElementBlock("div", _hoisted_8, [_cache[10] || (_cache[10] = createBaseVNode("p", { class: "mnr-chapter-end-text" }, "— 已是最后一章 —", -1)), createBaseVNode("div", _hoisted_9, [unref(readerStore).chapter?.indexUrl ? (openBlock(), createElementBlock("a", {
							key: 0,
							href: unref(readerStore).chapter.indexUrl,
							class: "mnr-chapter-link index"
						}, " 返回目录 ", 8, _hoisted_10)) : createCommentVNode("", true)])])) : createCommentVNode("", true)
					], 8, _hoisted_1),
					createVNode(SettingsPanel_default, {
						visible: unref(settingsVisible),
						"site-auto-enable": siteAutoEnableValue.value,
						"custom-cleanup-hostname": customCleanupHostname.value,
						onClose: unref(closeSettings),
						onTextConversionChange: unref(readerStore).applyTextConversion,
						onCopyDiagnostics: _cache[0] || (_cache[0] = ($event) => emit("copyDiagnostics")),
						onSiteAutoEnableChange: handleSiteAutoEnableChange,
						onProtectionModeChange: _cache[1] || (_cache[1] = ($event) => emit("protectionModeChange", $event)),
						onExit: _cache[2] || (_cache[2] = ($event) => emit("exit"))
					}, null, 8, [
						"visible",
						"site-auto-enable",
						"custom-cleanup-hostname",
						"onClose",
						"onTextConversionChange"
					]),
					createVNode(unref(MnrToast_default), {
						message: unref(readerStore).error ?? "",
						type: unref(readerStore).toastType,
						visible: !!unref(readerStore).error,
						onDismiss: unref(readerStore).clearError
					}, null, 8, [
						"message",
						"type",
						"visible",
						"onDismiss"
					])
				], 32);
			};
		}
	}), [["__scopeId", "data-v-e57f5480"]]);
	var EXIT_NAVIGATION_KEY = "mnr_exit_navigation";
	var hasTabStorage = typeof GM_getTab === "function" && typeof GM_saveTab === "function";
	var appState = {
		isInitialized: false,
		autoEnableDone: false,
		isActive: false,
		currentDecision: null,
		originalHostPage: null,
		entryPageKind: null,
		pendingHostOverlayCleanup: false
	};
	var app = null;
	var pinia = null;
	var initialization = null;
	var readerCleanup = null;
	var readerEntryApp = null;
	var readerEntryCleanup = null;
	function shouldEnableEarlyProtection(url) {
		try {
			const u = new URL(url);
			if (u.protocol !== "http:" && u.protocol !== "https:") return false;
			const path = u.pathname.toLowerCase();
			if (/(login|register|signup|search|rank|category|tag|author|help|about|contact)/.test(path)) return false;
			if (/(index|list|catalog|toc|contents?)\.html?$/.test(path) || /\/(catalog|toc)\//.test(path)) return false;
			if (/\/(chapter|txt|read|article)\//.test(path) && /\d/.test(path)) return true;
			if (/\/(book|novel|xiaoshuo)\//.test(path) && /\d/.test(path) && /\.html?$/.test(path)) return true;
			if (/\d{3,}[^/]*\.html?$/.test(path)) return true;
			return false;
		} catch {
			return false;
		}
	}
	try {
		if (shouldEnableEarlyProtection(window.location.href)) getSiteProtection().activate({
			blockRedirects: true,
			blockPopups: true,
			clearTimers: false,
			enableRightClick: false,
			enableSelection: false,
			enableCopy: false,
			unlockKeyboard: false,
			removeEventHijacking: false,
			blockVisibilityDetection: false,
			cleanupScripts: false
		});
	} catch (e) {
		console.error("[MNR] Early protection error:", e);
	}
	async function initialize() {
		await ensureInitialized();
		if (!appState.isInitialized) return;
		if (appState.autoEnableDone || appState.isActive) return;
		appState.autoEnableDone = true;
		await runAutoEnable();
	}
	async function ensureInitialized() {
		if (appState.isInitialized) return;
		if (!initialization) initialization = (async () => {
			console.log(`[MNR] YingChuang v${VERSION} (${BUILD_DATE})`);
			try {
				const stores = createPinia();
				await useConfigStore(stores).load();
				pinia = stores;
				appState.isInitialized = true;
			} catch (e) {
				console.error("[MNR] Initialization error:", e);
				getSiteProtection().deactivate();
			}
		})();
		await initialization;
		initialization = null;
	}
	async function runAutoEnable() {
		const manager = getAutoEnableManager({
			enableProtection: true,
			protectionOptions: toProtectionOptions(useConfigStore(pinia).protection)
		});
		const decision = manager.check(document);
		appState.currentDecision = decision;
		if (decision.method === "user-disabled" || decision.showManualEntry) {
			getSiteProtection().deactivate();
			showReaderEntry();
			return;
		}
		if (!decision.shouldEnable) {
			getSiteProtection().deactivate();
			return;
		}
		manager.setPromptCallback(showPrompt);
		manager.setLaunchCallback(launchReader);
		await manager.execute(document);
		if (!appState.isActive && decision.shouldEnable) {
			getSiteProtection().deactivate();
			showReaderEntry();
		}
	}
	async function showPrompt() {
		return new Promise((resolve) => {
			const { mountPoint, cleanup } = createShadowMount("mnr-entry-prompt-root");
			const promptVisible = ref(true);
			let promptApp = null;
			let settled = false;
			const finish = (response) => {
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
			const PromptWrapper = defineComponent({ setup() {
				const handleRespond = (response) => {
					finish(response);
				};
				return () => h(ReaderEntryPrompt_default, {
					visible: promptVisible.value,
					onRespond: handleRespond
				});
			} });
			try {
				promptApp = createApp(PromptWrapper);
				promptApp.mount(mountPoint);
			} catch (e) {
				settled = true;
				cleanup();
				console.error("[MNR] Failed to mount reader entry prompt:", e);
				resolve({
					accepted: false,
					rememberForSite: false
				});
			}
		});
	}
	function launchReader(event) {
		if (!pinia) {
			console.error("[MNR] Pinia not initialized");
			return;
		}
		const readerStore = useReaderStore(pinia);
		if (appState.isActive) return;
		const { chapter, rule } = event;
		hideReaderEntry();
		recordDebugEvent("bootstrap.launchReader", {
			url: chapter.url,
			title: chapter.title,
			ruleId: rule?.id || chapter.rule?.id
		});
		appState.originalHostPage = captureHostPageSnapshot();
		const pageKind = getPageKind(window.location.href, document);
		appState.entryPageKind = pageKind === "chapter" || rule || chapter.rule ? "chapter" : pageKind;
		readerStore.activate();
		const entryId = readerStore.setChapter(chapter, rule);
		if (event.stage === "initial") readerStore.beginChapterSections(entryId, event.progress, event.abort);
		appState.isActive = true;
		mountReaderUI();
		if (event.stage === "initial") return readerStore.sectionDelivery(entryId);
	}
	function mountReaderUI() {
		if (document.getElementById("mnr-reader-root")) return;
		const { mountPoint, cleanup } = createShadowMount("mnr-reader-root");
		readerCleanup = cleanup;
		app = createApp(ReaderView_default, {
			siteAutoEnable: getCurrentSiteAutoEnable(),
			onCopyDiagnostics: () => {
				copyDiagnosticsFromMenu();
			},
			onExit: closeReader,
			onProtectionModeChange: setProtectionMode,
			onSiteAutoEnableChange: setCurrentSiteAutoEnable
		});
		app.use(pinia);
		app.mount(mountPoint);
		hideOriginalContent();
	}
	function hideOriginalContent() {
		const style = document.createElement("style");
		style.id = "mnr-hide-original";
		style.textContent = `
    body > *:not(#mnr-reader-root):not(#mnr-entry-prompt-root):not(script):not(style) {
      display: none !important;
    }
  `;
		document.head.appendChild(style);
	}
	function cleanupHostPageOverlays() {
		try {
			getSiteProtection().removeOverlays();
		} catch (e) {
			console.error("[MNR] Failed to clean host page overlays:", e);
		}
	}
	function normalizeExitDestination(url) {
		const normalized = normalizeUrlForFetch$1(url);
		try {
			const parsed = new URL(normalized);
			if (parsed.protocol === "http:" || parsed.protocol === "https:") {
				parsed.protocol = "https:";
				parsed.hostname = parsed.hostname.replace(/^www\./i, "");
			}
			if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
			return parsed.toString();
		} catch {
			return normalized.replace(/\/+$/, "");
		}
	}
	function getUserscriptTabState() {
		return new Promise((resolve) => GM_getTab(resolve));
	}
	async function persistExitNavigation(transition) {
		if (!hasTabStorage) {
			sessionStorage.setItem(EXIT_NAVIGATION_KEY, JSON.stringify(transition));
			return;
		}
		const tab = await getUserscriptTabState();
		tab[EXIT_NAVIGATION_KEY] = transition;
		GM_saveTab(tab);
	}
	async function consumeExitNavigation() {
		let transition;
		if (hasTabStorage) {
			const tab = await getUserscriptTabState();
			transition = tab[EXIT_NAVIGATION_KEY];
			if (transition) {
				delete tab[EXIT_NAVIGATION_KEY];
				GM_saveTab(tab);
			}
		} else try {
			const serialized = sessionStorage.getItem(EXIT_NAVIGATION_KEY);
			if (serialized) {
				sessionStorage.removeItem(EXIT_NAVIGATION_KEY);
				transition = JSON.parse(serialized);
			}
		} catch (e) {
			console.error("[MNR] Failed to read exit navigation:", e);
		}
		if (!transition || typeof transition.targetUrl !== "string") return false;
		if (normalizeExitDestination(transition.targetUrl) !== normalizeExitDestination(window.location.href)) return false;
		appState.autoEnableDone = true;
		getSiteProtection().deactivate();
		if (transition.cleanupHostOverlays === true) cleanupHostPageOverlays();
		showReaderEntry();
		return true;
	}
	function closeReader() {
		if (!appState.isActive) return;
		recordDebugEvent("bootstrap.closeReader");
		const entryPageKind = appState.entryPageKind;
		let targetUrl = null;
		if (pinia) {
			const readerStore = useReaderStore(pinia);
			const currentIndex = readerStore.currentChapterIndex;
			const chapter = readerStore.chapters[currentIndex];
			if (chapter?.chapter.url) targetUrl = chapter.chapter.url;
		}
		const originalHostPage = appState.originalHostPage;
		const originalUrl = originalHostPage?.url || null;
		const navigationTarget = targetUrl && originalUrl && normalizeUrlForFetch$1(targetUrl) !== normalizeUrlForFetch$1(originalUrl) ? targetUrl : null;
		const cleanupHostOverlays = appState.pendingHostOverlayCleanup;
		appState.pendingHostOverlayCleanup = false;
		if (app) {
			app.unmount();
			app = null;
		}
		getSiteProtection().deactivate();
		if (readerCleanup) {
			readerCleanup();
			readerCleanup = null;
		}
		const hideStyle = document.getElementById("mnr-hide-original");
		if (hideStyle) hideStyle.remove();
		if (cleanupHostOverlays && !navigationTarget) cleanupHostPageOverlays();
		if (pinia) useReaderStore(pinia).deactivate();
		appState.isActive = false;
		appState.originalHostPage = null;
		appState.entryPageKind = null;
		if (navigationTarget) {
			persistExitNavigation({
				targetUrl: normalizeExitDestination(navigationTarget),
				cleanupHostOverlays
			}).catch((e) => console.error("[MNR] Failed to save exit navigation:", e)).finally(() => {
				window.location.href = navigationTarget;
			});
			return;
		}
		restoreHostPageSnapshot(originalHostPage);
		if (entryPageKind === "chapter") showReaderEntry();
	}
	function getCurrentSiteAutoEnable() {
		try {
			const hostname = new URL(window.location.href).hostname;
			return getRuleStorage().getSitePreference(hostname)?.enabled !== false;
		} catch {
			return true;
		}
	}
	function setCurrentSiteAutoEnable(enabled) {
		try {
			const hostname = new URL(window.location.href).hostname;
			getRuleStorage().setSitePreference(hostname, {
				enabled,
				timestamp: Date.now()
			});
		} catch (e) {
			console.error("[MNR] Failed to update site auto-enable preference:", e);
		}
	}
	async function setProtectionMode(mode) {
		if (!pinia) return;
		const configStore = useConfigStore(pinia);
		const previousMode = configStore.protection.mode;
		configStore.updateProtection({ mode });
		if (previousMode !== mode) appState.pendingHostOverlayCleanup = mode === "aggressive";
		getSiteProtection().activate(toProtectionOptions(configStore.protection));
		await configStore.flushSave();
	}
	function showReaderEntry() {
		if (appState.isActive || readerEntryApp) return;
		const { mountPoint, cleanup } = createShadowMount("mnr-entry-root");
		readerEntryCleanup = cleanup;
		try {
			readerEntryApp = createApp(ReaderEntryButton_default, { onEnter: () => {
				manualEnable().catch((e) => console.error("[MNR] Manual enable error:", e));
			} });
			readerEntryApp.mount(mountPoint);
		} catch (e) {
			readerEntryApp = null;
			readerEntryCleanup = null;
			cleanup();
			console.error("[MNR] Failed to mount reader entry:", e);
		}
	}
	function hideReaderEntry() {
		readerEntryApp?.unmount();
		readerEntryApp = null;
		readerEntryCleanup?.();
		readerEntryCleanup = null;
	}
	async function manualEnable() {
		if (appState.isActive) return;
		const currentUrl = window.location.href;
		recordDebugEvent("bootstrap.manualEnable", { url: currentUrl });
		hideReaderEntry();
		try {
			await ensureInitialized();
			if (!pinia || appState.isActive) return;
			appState.autoEnableDone = true;
			const manager = getAutoEnableManager({
				enableProtection: true,
				protectionOptions: toProtectionOptions(useConfigStore(pinia).protection)
			});
			manager.setLaunchCallback(launchReader);
			await manager.manualEnable(document);
		} finally {
			if (!appState.isActive && isReaderEntryPage(currentUrl, document)) showReaderEntry();
		}
	}
	function getAppDebugSnapshot() {
		const decision = appState.currentDecision;
		return {
			isInitialized: appState.isInitialized,
			autoEnableDone: appState.autoEnableDone,
			isActive: appState.isActive,
			entryPageKind: appState.entryPageKind,
			currentDecision: decision ? toDebugValue({
				shouldEnable: decision.shouldEnable,
				method: decision.method,
				confidence: decision.confidence,
				reasons: decision.reasons,
				showManualEntry: decision.showManualEntry,
				ruleId: decision.rule?.id
			}) : null,
			originalHostPage: appState.originalHostPage ? toDebugValue({
				url: redactUrl(appState.originalHostPage.url),
				title: appState.originalHostPage.title,
				state: appState.originalHostPage.state
			}) : null
		};
	}
	function isTopFrame() {
		try {
			return window.top === window.self;
		} catch {
			return false;
		}
	}
	function registerMenuCommands() {
		if (!isTopFrame()) return;
		if (typeof GM_registerMenuCommand !== "function") return;
		GM_registerMenuCommand("进入阅读模式", () => {
			manualEnable().catch((e) => console.error("[MNR] Manual enable error:", e));
		});
		GM_registerMenuCommand("复制诊断信息", () => {
			copyDiagnosticsFromMenu().catch((e) => console.error("[MNR] Copy diagnostics error:", e));
		});
	}
	async function copyDiagnosticsFromMenu() {
		await ensureInitialized();
		const readerStore = pinia ? useReaderStore(pinia) : null;
		const configStore = pinia ? useConfigStore(pinia) : null;
		const notify = readerStore?.isActive === true ? (message, type = "info") => readerStore.showToast(message, type) : void 0;
		const result = await copyDiagnosticInfo({
			readerStore,
			configStore,
			bootstrap: getAppDebugSnapshot(),
			notify
		});
		if (notify) return;
		if (result.ok) console.info("[MNR] 诊断信息已复制");
		else console.error("[MNR] 诊断信息复制失败:", result.error);
	}
	async function bootstrap() {
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
		try {
			const hostname = new URL(url).hostname;
			if (getRuleStorage().getSitePreference(hostname)?.enabled === false) {
				getSiteProtection().deactivate();
				showReaderEntry();
				return;
			}
		} catch (e) {
			console.debug("[MNR] Failed to read site preference:", e);
		}
		await initialize();
	}
	function isReaderEntryPage(url, doc) {
		const urlKind = getPageKindFromUrl(url);
		if (urlKind === "chapter") return true;
		if (urlKind === "toc") return false;
		try {
			if (getRuleManager().matchRule(url) !== null) return true;
		} catch (e) {
			console.debug("[MNR] Failed to match reader entry rule:", e);
		}
		return getPageKind(url, doc) === "chapter";
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => {
		bootstrap().catch((e) => console.error("[MNR] Bootstrap error:", e));
	});
	else bootstrap().catch((e) => console.error("[MNR] Bootstrap error:", e));
	(function() {
		(function(cssCode) {
			try {
				if (typeof window !== "undefined") {
					const w = window;
					const globalState = w.__MY_NOVEL_READER__ || (w.__MY_NOVEL_READER__ = {});
					globalState.styles = (globalState.styles || "") + cssCode;
					if (globalState.shadowRoots) globalState.shadowRoots.forEach(function(shadowRoot) {
						var shadowStyle = shadowRoot.querySelector("#mnr-app-styles");
						if (!shadowStyle) {
							shadowStyle = document.createElement("style");
							shadowStyle.id = "mnr-app-styles";
							shadowRoot.appendChild(shadowStyle);
						}
						shadowStyle.textContent = globalState.styles;
					});
				}
			} catch (e) {
				console.error("[MNR] CSS injection error:", e);
			}
		})(".mnr-reader-entry[data-v-e6dad6e3]{right:max(20px, env(safe-area-inset-right));bottom:max(20px, env(safe-area-inset-bottom));z-index:2147483646;background:var(--mnr-link,#1976d2);min-width:48px;height:48px;color:var(--mnr-on-link,#fff);cursor:pointer;-webkit-tap-highlight-color:transparent;border:0;border-radius:24px;justify-content:center;align-items:center;gap:8px;margin:0;padding:0 16px;font-size:14px;font-weight:600;line-height:1;transition:transform .18s,filter .18s,box-shadow .18s;animation:.2s ease-out mnr-entry-in-e6dad6e3;display:flex;position:fixed;box-shadow:0 6px 18px #0003}.mnr-reader-entry svg[data-v-e6dad6e3]{fill:none;stroke:currentColor;stroke-width:1.8px;stroke-linecap:round;stroke-linejoin:round;flex:0 0 24px;width:24px;height:24px}.mnr-reader-entry span[data-v-e6dad6e3]{white-space:nowrap}.mnr-reader-entry[data-v-e6dad6e3]:active{transform:scale(.96)}.mnr-reader-entry[data-v-e6dad6e3]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 48%, #fff);outline-offset:3px}@media (hover:hover){.mnr-reader-entry[data-v-e6dad6e3]:hover{filter:brightness(.94);transform:translateY(-2px);box-shadow:0 8px 22px #0000003d}}@media (width<=480px){.mnr-reader-entry[data-v-e6dad6e3]{width:48px;padding:0}.mnr-reader-entry span[data-v-e6dad6e3]{display:none}}@keyframes mnr-entry-in-e6dad6e3{0%{opacity:0;transform:translateY(8px)scale(.96)}}@media (prefers-reduced-motion:reduce){.mnr-reader-entry[data-v-e6dad6e3]{transition:none;animation:none}}.mnr-entry-prompt-overlay[data-v-2c14cbfa]{z-index:2147483647;padding:max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));background:#00000085;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.mnr-entry-prompt-card[data-v-2c14cbfa]{border:1px solid var(--mnr-border,#e0e0e0);background:var(--mnr-bg,#fff);width:min(100%,400px);max-height:calc(100dvh - 32px);color:var(--mnr-text,#333);border-radius:14px;padding:24px;animation:.24s ease-out mnr-entry-prompt-in-2c14cbfa;overflow:auto;box-shadow:0 18px 50px #00000047}.mnr-entry-prompt-header[data-v-2c14cbfa]{align-items:flex-start;gap:14px;display:flex}.mnr-entry-prompt-icon[data-v-2c14cbfa]{background:color-mix(in srgb, var(--mnr-link,#1976d2) 12%, transparent);width:44px;height:44px;color:var(--mnr-link,#1976d2);border-radius:12px;flex:0 0 44px;place-items:center;display:grid}.mnr-entry-prompt-icon svg[data-v-2c14cbfa]{fill:none;stroke:currentColor;stroke-width:1.8px;stroke-linecap:round;stroke-linejoin:round;width:26px;height:26px}.mnr-entry-prompt-header h3[data-v-2c14cbfa]{margin:1px 0 6px;font-size:18px;font-weight:700;line-height:1.4}.mnr-entry-prompt-header p[data-v-2c14cbfa]{opacity:.76;margin:0;font-size:14px;line-height:1.65}.mnr-entry-preference[data-v-2c14cbfa]{border:1px solid var(--mnr-border,#e0e0e0);background:color-mix(in srgb, var(--mnr-border,#e0e0e0) 34%, transparent);cursor:pointer;border-radius:10px;align-items:flex-start;gap:10px;margin:22px 0;padding:13px 14px;display:flex}.mnr-entry-preference input[data-v-2c14cbfa]{width:20px;height:20px;accent-color:var(--mnr-link,#1976d2);flex:0 0 20px;margin:1px 0 0}.mnr-entry-preference span[data-v-2c14cbfa],.mnr-entry-preference strong[data-v-2c14cbfa],.mnr-entry-preference small[data-v-2c14cbfa]{display:block}.mnr-entry-preference strong[data-v-2c14cbfa]{font-size:14px;font-weight:600}.mnr-entry-preference small[data-v-2c14cbfa]{opacity:.68;margin-top:3px;font-size:12px;line-height:1.5}.mnr-entry-prompt-actions[data-v-2c14cbfa]{grid-template-columns:1fr 1.25fr;gap:10px;display:grid}.mnr-entry-button[data-v-2c14cbfa]{cursor:pointer;border:1px solid #0000;border-radius:9px;min-height:44px;padding:10px 14px;font-size:14px;font-weight:600;transition:filter .18s,background .18s}.mnr-entry-button.secondary[data-v-2c14cbfa]{border-color:var(--mnr-border,#ddd);color:var(--mnr-text,#555);background:0 0}.mnr-entry-button.primary[data-v-2c14cbfa]{background:var(--mnr-link,#1976d2);color:var(--mnr-on-link,#fff)}.mnr-entry-button[data-v-2c14cbfa]:focus-visible,.mnr-entry-preference input[data-v-2c14cbfa]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:2px}@media (hover:hover){.mnr-entry-button[data-v-2c14cbfa]:hover{filter:brightness(.94)}.mnr-entry-button.secondary[data-v-2c14cbfa]:hover{background:var(--mnr-border,#f0f0f0)}}.mnr-entry-prompt-fade-enter-active[data-v-2c14cbfa],.mnr-entry-prompt-fade-leave-active[data-v-2c14cbfa]{transition:opacity .24s}.mnr-entry-prompt-fade-enter-from[data-v-2c14cbfa],.mnr-entry-prompt-fade-leave-to[data-v-2c14cbfa]{opacity:0}@keyframes mnr-entry-prompt-in-2c14cbfa{0%{opacity:0;transform:translateY(12px)scale(.98)}}@media (width<=480px){.mnr-entry-prompt-card[data-v-2c14cbfa]{padding:20px}.mnr-entry-prompt-header[data-v-2c14cbfa]{gap:12px}.mnr-entry-prompt-icon[data-v-2c14cbfa]{flex-basis:40px;width:40px;height:40px}}@media (prefers-reduced-motion:reduce){.mnr-entry-prompt-card[data-v-2c14cbfa],.mnr-entry-button[data-v-2c14cbfa],.mnr-entry-prompt-fade-enter-active[data-v-2c14cbfa],.mnr-entry-prompt-fade-leave-active[data-v-2c14cbfa]{transition:none;animation:none}}.mnr-progress[data-v-fb6f172c]{z-index:1000;height:3px;transition:opacity .3s;position:fixed;top:0;left:0;right:0}.mnr-progress.hidden[data-v-fb6f172c]{opacity:0}.mnr-progress-bar[data-v-fb6f172c]{background:var(--mnr-link,#1976d2);height:100%;transition:width .1s ease-out}.mnr-progress-text[data-v-fb6f172c]{color:#fff;background:#000000b3;border-radius:4px;padding:4px 8px;font-size:12px;position:absolute;top:8px;right:8px}@media (prefers-reduced-motion:reduce){.mnr-progress[data-v-fb6f172c],.mnr-progress-bar[data-v-fb6f172c]{transition:none}}.mnr-floating-toolbar[data-v-99e4013e]{top:max(12px, env(safe-area-inset-top));left:max(12px, env(safe-area-inset-left));right:max(12px, env(safe-area-inset-right));pointer-events:none;z-index:100;justify-content:space-between;display:flex;position:fixed}.mnr-fab[data-v-99e4013e]{pointer-events:auto;background:var(--mnr-bg,#fff);width:44px;height:44px;color:var(--mnr-text,#333);border:1px solid var(--mnr-border,#e5e5e5);cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:50%;justify-content:center;align-items:center;padding:0;font-size:18px;transition:all .2s cubic-bezier(.25,.8,.25,1);display:flex;position:relative;box-shadow:0 4px 12px #00000026}.mnr-fab[data-v-99e4013e]:hover{background:var(--mnr-border,#f0f0f0);transform:translateY(-2px);box-shadow:0 6px 16px #0003}.mnr-fab[data-v-99e4013e]:active{transform:scale(.95)}.mnr-fab[data-v-99e4013e]:disabled{opacity:.6;cursor:not-allowed;box-shadow:none;transform:none}.mnr-icon[data-v-99e4013e]{fill:none;stroke:currentColor;stroke-width:1.8px;stroke-linecap:round;stroke-linejoin:round;flex:none;width:22px;height:22px;display:block}.mnr-fab[data-v-99e4013e]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:2px}.mnr-fade-slide-enter-active[data-v-99e4013e],.mnr-fade-slide-leave-active[data-v-99e4013e]{transition:opacity .3s,transform .3s}.mnr-fade-slide-enter-from[data-v-99e4013e],.mnr-fade-slide-leave-to[data-v-99e4013e]{opacity:0;transform:translateY(-20px)}@media (prefers-reduced-motion:reduce){.mnr-fab[data-v-99e4013e],.mnr-fade-slide-enter-active[data-v-99e4013e],.mnr-fade-slide-leave-active[data-v-99e4013e]{transition:none}}.mnr-spinner[data-v-c925c262]{border-radius:50%;animation:.8s cubic-bezier(.4,0,.2,1) infinite mnr-spin-c925c262}.mnr-spinner.small[data-v-c925c262]{border:2px solid var(--mnr-border,#e0e0e0);border-top-color:var(--mnr-link,#1976d2);width:24px;height:24px;animation-duration:1s;animation-timing-function:linear}.mnr-spinner.medium[data-v-c925c262]{border:4px solid var(--mnr-border,#e0e0e0);border-top-color:var(--mnr-link,#1976d2);width:48px;height:48px}.mnr-spinner.large[data-v-c925c262]{border:4px solid var(--mnr-border,#e0e0e0);border-top-color:var(--mnr-link,#1976d2);width:64px;height:64px}@keyframes mnr-spin-c925c262{to{transform:rotate(360deg)}}.mnr-toast[data-v-baea3e69]{bottom:max(32px, env(safe-area-inset-bottom));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;cursor:pointer;z-index:1001;white-space:nowrap;text-overflow:ellipsis;background:#1e1e1ee6;border-radius:50px;align-items:center;gap:8px;max-width:90vw;padding:14px 28px;font-size:15px;font-weight:500;display:flex;position:fixed;left:50%;overflow:hidden;transform:translate(-50%);box-shadow:0 8px 24px #0003}.mnr-toast--error[data-v-baea3e69]{background:#d32f2ff2}.mnr-toast-enter-active[data-v-baea3e69],.mnr-toast-leave-active[data-v-baea3e69]{transition:all .4s cubic-bezier(.175,.885,.32,1.275)}.mnr-toast-enter-from[data-v-baea3e69],.mnr-toast-leave-to[data-v-baea3e69]{opacity:0;transform:translate(-50%)translateY(40px)scale(.9)}@media (prefers-reduced-motion:reduce){.mnr-toast-enter-active[data-v-baea3e69],.mnr-toast-leave-active[data-v-baea3e69]{transition:none}}.mnr-drawer[data-v-7f96ddd9]{z-index:1001;width:min(88%,340px);padding-left:env(safe-area-inset-left);background:var(--mnr-bg,#fff);color:var(--mnr-text,#333);flex-direction:column;transition:transform .24s;display:flex;position:fixed;inset:0 auto 0 0;transform:translate(-105%);box-shadow:4px 0 20px #00000026}.mnr-drawer.open[data-v-7f96ddd9]{transform:translate(0)}.mnr-drawer-overlay[data-v-7f96ddd9]{z-index:1000;background:#00000080;position:fixed;inset:0}.mnr-drawer-header[data-v-7f96ddd9]{padding:max(16px, env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid var(--mnr-border,#e5e5e5);flex-shrink:0;justify-content:space-between;align-items:center;gap:12px;display:flex}.mnr-drawer-heading[data-v-7f96ddd9]{min-width:0}.mnr-drawer-title[data-v-7f96ddd9]{overflow-wrap:anywhere;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0;font-size:16px;font-weight:600;line-height:1.5;display:-webkit-box;overflow:hidden}.mnr-drawer-position[data-v-7f96ddd9]{color:var(--mnr-text,#666);opacity:.72;margin-top:3px;font-size:12px;display:block}.mnr-drawer-close[data-v-7f96ddd9]{width:36px;height:36px;color:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:0 0 36px;place-items:center;padding:0;display:grid}.mnr-drawer-close svg[data-v-7f96ddd9]{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;width:20px;height:20px}.mnr-drawer-search[data-v-7f96ddd9]{flex-shrink:0;padding:10px 12px 6px}.mnr-drawer-search input[data-v-7f96ddd9]{border:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);width:100%;color:var(--mnr-text,#333);border-radius:8px;padding:9px 12px;font-size:14px}.mnr-offline-section[data-v-7f96ddd9]{border-bottom:1px solid var(--mnr-border,#e5e5e5);flex-shrink:0;padding:10px 12px 12px}.mnr-offline-main[data-v-7f96ddd9]{justify-content:space-between;align-items:center;gap:12px;display:flex}.mnr-offline-copy[data-v-7f96ddd9]{min-width:0}.mnr-offline-copy strong[data-v-7f96ddd9],.mnr-offline-copy span[data-v-7f96ddd9]{display:block}.mnr-offline-copy strong[data-v-7f96ddd9]{font-size:13px;font-weight:600}.mnr-offline-copy span[data-v-7f96ddd9]{color:var(--mnr-text,#666);opacity:.7;margin-top:2px;font-size:12px}.mnr-offline-action[data-v-7f96ddd9]{border:1px solid var(--mnr-border,#ddd);min-height:36px;color:var(--mnr-link,#1976d2);cursor:pointer;background:0 0;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:600}.mnr-offline-action[data-v-7f96ddd9]:disabled{cursor:wait;opacity:.6}.mnr-offline-action.primary[data-v-7f96ddd9]{border-color:var(--mnr-link,#1976d2);background:var(--mnr-link,#1976d2);color:var(--mnr-on-link,#fff);flex:none}.mnr-offline-action.danger[data-v-7f96ddd9]{color:var(--mnr-text,#555)}.mnr-offline-secondary[data-v-7f96ddd9]{flex-wrap:wrap;gap:6px;margin-top:8px;display:flex}.mnr-drawer-state[data-v-7f96ddd9]{color:var(--mnr-text,#666);text-align:center;opacity:.78;flex:1;justify-content:center;align-items:center;gap:10px;padding:40px 20px;display:flex}.mnr-drawer-content[data-v-7f96ddd9]{overscroll-behavior:contain;-webkit-overflow-scrolling:touch;flex:1;position:relative;overflow-y:auto}.mnr-cache-progress-track[data-v-7f96ddd9]{background:var(--mnr-border,#e0e0e0);border-radius:2px;height:4px;margin-top:10px;overflow:hidden}.mnr-cache-progress-fill[data-v-7f96ddd9]{background:var(--mnr-link,#1976d2);height:100%;transition:width .2s}.mnr-chapter-list[data-v-7f96ddd9]{margin:0;padding-left:0;padding-right:0;list-style:none}.mnr-chapter-list li[data-v-7f96ddd9]{height:44px}.mnr-chapter-button[data-v-7f96ddd9]{width:100%;height:44px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-left:3px solid #0000;align-items:center;gap:6px;padding:0 14px;font-size:14px;display:flex;overflow:hidden}.mnr-chapter-title-text[data-v-7f96ddd9]{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.mnr-chapter-button.active[data-v-7f96ddd9]{border-left-color:var(--mnr-link,#1976d2);background:color-mix(in srgb, var(--mnr-link,#1976d2) 10%, transparent);color:var(--mnr-link,#1976d2);font-weight:600}.mnr-chapter-button.persisted[data-v-7f96ddd9],.mnr-cache-mark[data-v-7f96ddd9]{color:#388e3c}.mnr-cache-mark[data-v-7f96ddd9]{flex:none;width:14px;height:14px}.mnr-cache-mark svg[data-v-7f96ddd9]{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;width:100%;height:100%;display:block}@media (hover:hover){.mnr-drawer-close[data-v-7f96ddd9]:hover,.mnr-chapter-button[data-v-7f96ddd9]:not(.active):hover,.mnr-offline-action[data-v-7f96ddd9]:enabled:hover{background:var(--mnr-border,#f0f0f0)}.mnr-offline-action.primary[data-v-7f96ddd9]:enabled:hover{background:var(--mnr-link,#1976d2);filter:brightness(.94)}}.mnr-drawer-close[data-v-7f96ddd9]:focus-visible,.mnr-drawer-search input[data-v-7f96ddd9]:focus-visible,.mnr-offline-action[data-v-7f96ddd9]:focus-visible,.mnr-chapter-button[data-v-7f96ddd9]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:-3px}.mnr-visually-hidden[data-v-7f96ddd9]{clip:rect(0 0 0 0);white-space:nowrap;clip-path:inset(50%);width:1px;height:1px;position:absolute;overflow:hidden}.mnr-fade-enter-active[data-v-7f96ddd9],.mnr-fade-leave-active[data-v-7f96ddd9]{transition:opacity .24s}.mnr-fade-enter-from[data-v-7f96ddd9],.mnr-fade-leave-to[data-v-7f96ddd9]{opacity:0}@media (prefers-reduced-motion:reduce){.mnr-drawer[data-v-7f96ddd9],.mnr-fade-enter-active[data-v-7f96ddd9],.mnr-fade-leave-active[data-v-7f96ddd9],.mnr-cache-progress-fill[data-v-7f96ddd9]{transition:none}}.mnr-reading-control[data-v-e6745e69]{margin-top:18px}.mnr-reading-control-header[data-v-e6745e69]{justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px;display:flex}.mnr-reading-control-header label[data-v-e6745e69]{color:var(--mnr-text,#333);font-size:14px;font-weight:600}.mnr-reading-control-header output[data-v-e6745e69]{color:var(--mnr-text,#666);opacity:.78;font-size:13px}.mnr-reading-slider-row[data-v-e6745e69]{align-items:center;gap:10px;display:flex}.mnr-reading-slider-row span[data-v-e6745e69]{color:var(--mnr-text,#666);text-align:center;flex:0 0 24px;font-size:13px}.mnr-reading-slider-row input[data-v-e6745e69]{appearance:none;cursor:pointer;touch-action:pan-y;background:0 0;flex:1;min-width:0;height:32px;margin:0}.mnr-reading-slider-row input[data-v-e6745e69]::-webkit-slider-runnable-track{background:var(--mnr-border,#e0e0e0);border-radius:2px;height:4px}.mnr-reading-slider-row input[data-v-e6745e69]::-webkit-slider-thumb{appearance:none;background:var(--mnr-link,#1976d2);border:0;border-radius:50%;width:24px;height:24px;margin-top:-10px}.mnr-reading-slider-row input[data-v-e6745e69]::-moz-range-track{background:var(--mnr-border,#e0e0e0);border-radius:2px;height:4px}.mnr-reading-slider-row input[data-v-e6745e69]::-moz-range-thumb{background:var(--mnr-link,#1976d2);border:0;border-radius:50%;width:24px;height:24px}.mnr-reading-slider-row input[data-v-e6745e69]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:2px}.mnr-settings-overlay[data-v-c4214e4a]{z-index:1000;background:#00000080;justify-content:flex-end;display:flex;position:fixed;inset:0}.mnr-settings-panel[data-v-c4214e4a]{width:min(100%,380px);height:100%;padding-right:env(safe-area-inset-right);background:var(--mnr-bg,#fff);color:var(--mnr-text,#333);flex-direction:column;display:flex;box-shadow:-4px 0 20px #00000026}.mnr-settings-header[data-v-c4214e4a]{padding:max(16px, env(safe-area-inset-top)) 16px 16px;border-bottom:1px solid var(--mnr-border,#e0e0e0);flex-shrink:0;justify-content:space-between;align-items:center;display:flex}.mnr-settings-header h3[data-v-c4214e4a],.mnr-settings-section h4[data-v-c4214e4a],.mnr-field-label[data-v-c4214e4a]{color:var(--mnr-text,#333);margin:0}.mnr-settings-header h3[data-v-c4214e4a]{border-radius:4px;font-size:18px}.mnr-close-btn[data-v-c4214e4a]{width:36px;height:36px;color:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;place-items:center;padding:0;display:grid}.mnr-close-btn svg[data-v-c4214e4a]{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;width:20px;height:20px}.mnr-settings-content[data-v-c4214e4a]{overscroll-behavior:contain;flex:1;padding:18px 16px 24px;overflow:auto}.mnr-settings-section h4[data-v-c4214e4a],.mnr-field-label[data-v-c4214e4a],.mnr-settings-fieldset legend[data-v-c4214e4a]{margin-bottom:10px;font-size:14px;font-weight:600;display:block}.mnr-theme-grid[data-v-c4214e4a]{grid-template-columns:repeat(3,1fr);gap:8px;display:grid}.mnr-theme-btn[data-v-c4214e4a]{cursor:pointer;border:2px solid #0000;border-radius:8px;min-width:0;min-height:42px;padding:8px 4px;font-size:12px}.mnr-reading-preview[data-v-c4214e4a]{border:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);color:var(--mnr-text,#333);border-radius:8px;margin-top:16px;padding:12px 14px;display:none}.mnr-reading-preview span[data-v-c4214e4a]{opacity:.65;margin-bottom:4px;font-size:12px;display:block}.mnr-reading-preview p[data-v-c4214e4a]{font-family:var(--mnr-font-family,system-ui, sans-serif);font-size:var(--mnr-font-size,18px);line-height:var(--mnr-line-height,1.8);letter-spacing:var(--mnr-letter-spacing,0);text-indent:var(--mnr-paragraph-indent,2em);margin:0}.mnr-field-label[data-v-c4214e4a]{margin-top:18px}.mnr-select[data-v-c4214e4a]{border:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);width:100%;min-height:42px;color:var(--mnr-text,#333);border-radius:8px;padding:9px 12px;font-size:14px}.mnr-settings-fieldset[data-v-c4214e4a]{border:0;min-width:0;margin:18px 0 0;padding:0}.mnr-segmented-control[data-v-c4214e4a]{border:1px solid var(--mnr-border,#ddd);border-radius:8px;display:flex;overflow:hidden}.mnr-segment[data-v-c4214e4a]{border:0;border-right:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);min-height:42px;color:var(--mnr-text,#666);cursor:pointer;flex:1;padding:9px 12px;font-size:14px}.mnr-segment[data-v-c4214e4a]:last-child{border-right:0}.mnr-segment.active[data-v-c4214e4a]{background:var(--mnr-link,#1976d2);color:var(--mnr-on-link,#fff)}.mnr-secondary-action[data-v-c4214e4a]{border:1px solid var(--mnr-border,#ddd);width:100%;min-height:42px;color:var(--mnr-text,#333);cursor:pointer;background:0 0;border-radius:8px;margin-top:16px;padding:9px 12px;font-size:14px}.mnr-settings-group[data-v-c4214e4a]{border-top:1px solid var(--mnr-border,#ddd);margin-top:18px}.mnr-settings-group summary[data-v-c4214e4a]{min-height:48px;color:var(--mnr-text,#333);cursor:pointer;padding:14px 0;font-size:14px;font-weight:600}.mnr-settings-group-content[data-v-c4214e4a]{padding-bottom:4px}.mnr-settings-group-content[data-v-c4214e4a]>:first-child{margin-top:0}.mnr-switch-row[data-v-c4214e4a]{min-height:44px;color:var(--mnr-text,#333);cursor:pointer;justify-content:space-between;align-items:center;gap:16px;display:flex}.mnr-switch-row input[data-v-c4214e4a]{width:22px;height:22px;accent-color:var(--mnr-link,#1976d2);flex:none}.mnr-custom-css[data-v-c4214e4a]{box-sizing:border-box;resize:vertical;border:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);width:100%;min-height:110px;color:var(--mnr-text,#333);border-radius:8px;padding:10px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.mnr-cleanup-fields[data-v-c4214e4a]{gap:10px;margin-top:8px;display:grid}.mnr-cleanup-fields .mnr-field-label[data-v-c4214e4a],.mnr-cleanup-fields .mnr-field-help[data-v-c4214e4a],.mnr-cleanup-fields .mnr-field-error[data-v-c4214e4a]{margin:0}.mnr-cleanup-editor-label[data-v-c4214e4a],.mnr-cleanup-guide[data-v-c4214e4a]{font-size:12px;line-height:1.6}.mnr-cleanup-guide[data-v-c4214e4a]{color:var(--mnr-text,#333)}.mnr-cleanup-guide summary[data-v-c4214e4a]{cursor:pointer;opacity:.72}.mnr-cleanup-guide p[data-v-c4214e4a]{margin:8px 0 0}.mnr-cleanup-guide code[data-v-c4214e4a]{overflow-wrap:anywhere}.mnr-cleanup-add[data-v-c4214e4a]{grid-template-columns:minmax(0,1fr) auto;gap:8px;display:grid}.mnr-cleanup-input[data-v-c4214e4a]{box-sizing:border-box;border:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);min-width:0;min-height:42px;color:var(--mnr-text,#333);border-radius:8px;padding:9px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.mnr-cleanup-add-button[data-v-c4214e4a]{white-space:nowrap;width:auto;margin-top:0}.mnr-cleanup-add-button[data-v-c4214e4a]:disabled{cursor:not-allowed;opacity:.55}.mnr-cleanup-site[data-v-c4214e4a]{overflow-wrap:anywhere}.mnr-field-help[data-v-c4214e4a],.mnr-field-error[data-v-c4214e4a]{margin:-4px 0 8px;font-size:12px;line-height:1.5}.mnr-field-help[data-v-c4214e4a]{opacity:.72}.mnr-field-error[data-v-c4214e4a]{color:#c93f49;margin-top:6px}.mnr-settings-footer[data-v-c4214e4a]{padding:10px 16px max(12px, env(safe-area-inset-bottom));border-top:1px solid var(--mnr-border,#ddd);background:var(--mnr-bg,#fff);flex-shrink:0}.mnr-exit-btn[data-v-c4214e4a]{color:#c93f49;cursor:pointer;background:0 0;border:1px solid #c93f49;border-radius:8px;width:100%;min-height:42px;padding:9px 12px;font-size:14px}@media (hover:hover){.mnr-close-btn[data-v-c4214e4a]:hover,.mnr-secondary-action[data-v-c4214e4a]:enabled:hover,.mnr-segment[data-v-c4214e4a]:not(.active):hover,.mnr-exit-btn[data-v-c4214e4a]:hover{background:var(--mnr-border,#f0f0f0)}}.mnr-settings-header h3[data-v-c4214e4a]:focus-visible,.mnr-close-btn[data-v-c4214e4a]:focus-visible,.mnr-theme-btn[data-v-c4214e4a]:focus-visible,.mnr-select[data-v-c4214e4a]:focus-visible,.mnr-segment[data-v-c4214e4a]:focus-visible,.mnr-secondary-action[data-v-c4214e4a]:focus-visible,.mnr-settings-group summary[data-v-c4214e4a]:focus-visible,.mnr-cleanup-guide summary[data-v-c4214e4a]:focus-visible,.mnr-switch-row input[data-v-c4214e4a]:focus-visible,.mnr-cleanup-input[data-v-c4214e4a]:focus-visible,.mnr-custom-css[data-v-c4214e4a]:focus-visible,.mnr-exit-btn[data-v-c4214e4a]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:2px}.mnr-slide-enter-active[data-v-c4214e4a],.mnr-slide-leave-active[data-v-c4214e4a],.mnr-settings-panel[data-v-c4214e4a]{transition:opacity .22s,transform .22s}.mnr-slide-enter-from[data-v-c4214e4a],.mnr-slide-leave-to[data-v-c4214e4a]{opacity:0}.mnr-slide-enter-from .mnr-settings-panel[data-v-c4214e4a],.mnr-slide-leave-to .mnr-settings-panel[data-v-c4214e4a]{transform:translate(100%)}@media (width<=600px){.mnr-settings-panel[data-v-c4214e4a]{width:100%}.mnr-reading-preview[data-v-c4214e4a]{display:block}.mnr-desktop-width[data-v-c4214e4a]{display:none}}@media (prefers-reduced-motion:reduce){.mnr-slide-enter-active[data-v-c4214e4a],.mnr-slide-leave-active[data-v-c4214e4a],.mnr-settings-panel[data-v-c4214e4a]{transition:none}}.mnr-reader[data-v-e57f5480]{z-index:2147483647;background:var(--mnr-bg,#fff);color:var(--mnr-text,#1a1a1a);overscroll-behavior:none;flex-direction:column;display:flex;position:fixed;inset:0;overflow:hidden}.mnr-reader-main[data-v-e57f5480]{padding-top:68px;padding-bottom:max(40px, env(safe-area-inset-bottom));overscroll-behavior:none;-webkit-overflow-scrolling:touch;touch-action:pan-y pinch-zoom;flex:1;overflow:auto}.mnr-boundary-gesture-hint[data-v-e57f5480]{z-index:4;background:color-mix(in srgb, var(--mnr-text,#1a1a1a) 86%, transparent);max-width:calc(100vw - 32px);color:var(--mnr-bg,#fff);white-space:nowrap;pointer-events:none;border-radius:999px;padding:8px 14px;font-size:14px;line-height:1.4;position:fixed;left:50%;transform:translate(-50%)}.mnr-boundary-gesture-hint.is-prev[data-v-e57f5480]{top:max(16px, env(safe-area-inset-top))}.mnr-boundary-gesture-hint.is-next[data-v-e57f5480]{bottom:max(16px, env(safe-area-inset-bottom))}.mnr-reader-content[data-v-e57f5480]{max-width:var(--mnr-max-width,800px);padding:var(--mnr-padding,20px);font-family:var(--mnr-font-family,\"Microsoft YaHei\", \"PingFang SC\", \"Noto Sans CJK SC\", system-ui, sans-serif);font-size:var(--mnr-font-size,18px);line-height:var(--mnr-line-height,1.8);letter-spacing:var(--mnr-letter-spacing,0em);margin:0 auto}.mnr-reader-content[data-v-e57f5480] p{text-indent:var(--mnr-paragraph-indent,2em);margin:0 0 1em}.mnr-reader-content[data-v-e57f5480] img{max-width:100%;height:auto;margin:1em auto;display:block}.mnr-reader-content[data-v-e57f5480] a{color:var(--mnr-link,#1976d2)}.mnr-reader-main[data-v-e57f5480]:focus-visible{outline:3px solid color-mix(in srgb, var(--mnr-link,#1976d2) 55%, transparent);outline-offset:2px}.mnr-chapter-title[data-v-e57f5480]{color:var(--mnr-text,#1a1a1a);text-align:center;margin:0 0 1em;font-size:1.5em;font-weight:700;line-height:1.4}.mnr-chapter-end[data-v-e57f5480]{max-width:var(--mnr-max-width,800px);text-align:center;margin:0 auto;padding:40px 20px}.mnr-chapter-end-text[data-v-e57f5480]{color:var(--mnr-text,#666);opacity:.7;margin-bottom:16px}.mnr-chapter-nav[data-v-e57f5480]{flex-wrap:wrap;justify-content:center;gap:24px;display:flex}.mnr-chapter-link[data-v-e57f5480]{color:var(--mnr-link,#1976d2);border:1px solid var(--mnr-border,#e0e0e0);border-radius:8px;padding:12px 24px;text-decoration:none;transition:all .2s}.mnr-chapter-link[data-v-e57f5480]:hover{background:var(--mnr-border,#f0f0f0)}.mnr-sentinel[data-v-e57f5480]{visibility:hidden;width:100%;height:1px}.mnr-loading-prev[data-v-e57f5480],.mnr-loading-next[data-v-e57f5480],.mnr-section-progress[data-v-e57f5480]{color:var(--mnr-text,#666);justify-content:center;align-items:center;gap:12px;padding:24px;display:flex}@media (width>=768px){.mnr-reader-content[data-v-e57f5480]{padding:var(--mnr-padding,30px)}}@media (width>=1024px){.mnr-reader-content[data-v-e57f5480]{padding:var(--mnr-padding,40px)}}@media (prefers-reduced-motion:reduce){.mnr-chapter-link[data-v-e57f5480]{transition:none}}\n/*$vite$:1*/", {});
	})();
})();
