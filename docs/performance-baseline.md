# Performance baseline

Measured on 2026-07-10 with Playwright Chromium and the readable, non-minified userscript build.

Environment: Intel Core Ultra 9 285H (16 logical CPUs), WSL2 Linux 6.6, Node.js 24.11.0,
Playwright 1.61.1. Wall-clock values naturally vary with browser cold start and system load, so the
tables report the range observed during final validation. The JSON files contain the latest run, while
the CPU profiles are the source of truth for hotspot analysis.

## Reproduce

```bash
npm run profile:performance
npm run profile:performance:real
```

The commands write Chrome CPU profiles and metric summaries to `.test/performance/`:

- `local-ui-profile.cpuprofile`
- `local-ui-profile.json`
- `storage-write-profile.json`
- `real-site-startup-profile.cpuprofile`
- `real-site-startup-profile.json`

Open a `.cpuprofile` file in Chrome DevTools Performance or JavaScript Profiler.

## Deterministic stress page

The local profile uses a 180-paragraph chapter and a 5,000-chapter table of contents.

| Measurement                           |              Observed range (6 runs) |
| ------------------------------------- | -----------------------------------: |
| Reader startup wall time              |                         964-2,259 ms |
| Load and open 5,000-chapter TOC       |                           162-472 ms |
| Search the 5,000-chapter TOC          |                             14-30 ms |
| Rendered TOC rows                     | 28 initially, 20 after search/scroll |
| Drawer scroll CPU profile wall window |                           319-341 ms |
| Reader scroll CPU profile wall window |                           485-499 ms |
| Interaction task duration             |                           422-933 ms |
| Interaction layout duration           |                            74-128 ms |
| Interaction script duration           |                             23-42 ms |

The scroll loops deliberately wait for animation frames, so their wall times are not CPU times. Across
the six CPU profiles, `handleScroll` used about 10-19 ms self time in total for the complete drawer and
reader stress sequence. The fixed-window TOC kept the live list below 50 rows while processing all 5,000
entries.

## Userscript storage writes

The storage profile drives the font-size slider for two seconds and continuously scrolls the reader for
five seconds. It counts actual `GM_setValue` calls made by the built userscript.

| Scenario                |             Before coalescing |                            Current result |
| ----------------------- | ----------------------------: | ----------------------------------------: |
| Font-size input         | 120 events, 120 config writes |            121-122 events, 1 config write |
| Reader scrolling        | 5 seconds, 10 position writes | 5 seconds / 302 events, 2 position writes |
| Position write interval |              about 502-515 ms |                            4,016-4,033 ms |

Reading styles still update on every input event. Only persistence is delayed, and pending state is
flushed when settings close, chapters change, the reader unmounts, or the page becomes hidden.

## Real Ciweimao startup

Target: `https://www.ciweimao.com/chapter/102930784` through the configured test proxy.

| Measurement                  |         Observed range (4 runs) |
| ---------------------------- | ------------------------------: |
| Navigation to reader mounted |                  2,178-4,017 ms |
| Extracted content            | 3,184 characters, 88 paragraphs |
| Total task duration          |                  1,349-2,003 ms |
| Total script duration        |                      255-530 ms |
| Total layout duration        |                    874-1,160 ms |

All profiles were dominated by host-page code: `jquery.nicescroll` used 268-489 ms self time, and jQuery
request handling used roughly 192-441 ms. No individual MyNovelReader function exceeded 8.2 ms self time;
the measured entries included `removeAdPatterns`, DOM text-node visiting, and app style application. This
does not justify a riskier parser shortcut that could reduce extraction correctness.

## Build budget

`npm run check:size` enforces the non-minified artifact budget:

- raw: at most 900 KiB
- gzip: at most 250 KiB

The 9.4.5 build after dependency trimming is about 829 KiB raw and 221 KiB gzip, down from
900 KiB / 248 KiB before trimming. Minification remains disabled so the installed userscript stays
inspectable. The build excludes Vue's unused Options API and imports only OpenCC's t2s dictionaries.
At that measurement point, compatibility-ideograph normalization ran before phrase/character conversion;
Japanese repairs, source-script guards and the separate Simplified-to-Traditional converter were preserved.

The subsequent conversion-correctness change uses one lazy Simplified converter for every source hint.
Phrase exceptions may protect character spellings, but cannot rewrite otherwise unchanged characters;
already-simplified exception spellings are retained too. It removes the Japanese repair map and the
blanket 著-to-着 replacement. Source hints remain relevant only to the existing Traditional-mode
protection, so a hint change no longer reconverts a growing Simplified chapter.

`check:size` reports exact byte counts and remaining budget. To compare against a saved userscript:

```bash
npm run check:size -- /path/to/baseline.user.js
```

The gzip value measures compressibility, not browser memory or per-chapter network usage. Review
growth by its source and browser behavior before adjusting these budgets.

### Conversion correctness follow-up

Compared with master `b3f8af2`, the conservative Simplified converter was measured with a
local Playwright/CDP fixture containing 500 paragraphs and 5,000 TOC entries. Three alternating
baseline/rewrite samples were collected for each case, without concurrent test runs.

| Source content     | SC switch TaskDuration, before / after | Click to visible, before / after |
| ------------------ | -------------------------------------: | -------------------------------: |
| Mixed Chinese      |                         99.5 / 99.4 ms |                 318.7 / 321.6 ms |
| Simplified Chinese |                         89.3 / 96.5 ms |                 307.9 / 318.3 ms |

Values are medians, include UI work and profiler overhead, and are not a performance guarantee.
The already-Simplified case now checks actual text instead of skipping it based on a chapter
language guess. This adds about 7 ms in this fixture; mixed-text cost stayed comparable.
The generated userscript decreased by 2,322 raw bytes / 580 gzip bytes relative to that baseline.
