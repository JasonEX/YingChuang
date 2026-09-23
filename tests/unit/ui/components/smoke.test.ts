import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';

import { THEMES, useConfigStore } from '@/ui/stores/config';
import ChapterDrawer from '@/ui/components/reader/ChapterDrawer.vue';
import chapterDrawerSource from '@/ui/components/reader/ChapterDrawer.vue?raw';
import FloatingToolbar from '@/ui/components/reader/FloatingToolbar.vue';
import { ReaderEntryButton } from '@/ui/components/entry';
import SettingsPanel from '@/ui/components/settings/SettingsPanel.vue';
import settingsPanelSource from '@/ui/components/settings/SettingsPanel.vue?raw';

import { createGmStorageMock, stubGmStorage } from '../../../testUtils/gmStorage';
import { createDom } from '../../../testUtils/dom';
import { setupPinia } from '../../../testUtils/pinia';

function injectSfcStyle(source: string) {
  const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1];
  if (!style) {
    throw new Error('Style block not found');
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = style;
  document.head.appendChild(styleEl);
}

describe('UI component smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    createDom('https://example.com/');
    setupPinia();

    const gm = createGmStorageMock();
    stubGmStorage(gm);
  });

  it('ReaderEntryButton exposes a clear manual reading action', async () => {
    const onEnter = vi.fn();
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp({ render: () => h(ReaderEntryButton, { onEnter }) });

    app.mount(mountEl);
    await nextTick();

    const button = document.querySelector<HTMLButtonElement>('#mnr-entry-button');
    expect(button?.textContent?.trim()).toBe('进入阅读模式');
    expect(button?.getAttribute('aria-label')).toBe('进入阅读模式');
    expect(button?.querySelector('svg')).toBeInstanceOf(SVGElement);
    button?.click();
    expect(onEnter).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
  });

  it('SettingsPanel delegates protection changes and flushes pending settings on close', async () => {
    const visible = ref(true);
    const onClose = vi.fn(() => {
      visible.value = false;
    });
    const onProtectionModeChange = vi.fn();
    const configStore = useConfigStore();
    injectSfcStyle(settingsPanelSource);

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    const app = createApp({
      render: () =>
        h(SettingsPanel, {
          visible: visible.value,
          customCleanupHostname: 'm.1qxs.com',
          onClose,
          onProtectionModeChange,
        }),
    });

    app.mount(mountEl);
    await nextTick();

    expect(document.querySelectorAll('.mnr-theme-btn')).toHaveLength(THEMES.length);
    expect(
      Array.from(document.querySelectorAll('.mnr-theme-btn'), button => button.textContent?.trim())
    ).toEqual(['跟随系统', '明亮', '米黄', '绿色', '蓝色', '深色']);
    expect(
      window.getComputedStyle(document.querySelector('.mnr-theme-grid')!).gridTemplateColumns
    ).toContain('repeat(3');
    const sliderIds = [
      'mnr-font-size',
      'mnr-line-height',
      'mnr-letter-spacing',
      'mnr-paragraph-indent',
      'mnr-max-width',
      'mnr-padding',
    ];
    for (const id of sliderIds) {
      expect(document.querySelector(`input#${id}[type="range"]`)).not.toBeNull();
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(document.querySelector(`output[for="${id}"]`)).not.toBeNull();
    }

    expect(
      Array.from(document.querySelectorAll('details > summary'), summary =>
        summary.textContent?.trim()
      )
    ).toEqual(['排版细节', '阅读行为', '本站与高级', '规则语法与数量限制']);
    const customCleanup = document.querySelector<HTMLTextAreaElement>('#mnr-custom-cleanup-regex');
    const customCleanupDraft = document.querySelector<HTMLInputElement>(
      '#mnr-custom-cleanup-draft'
    );
    expect(customCleanup).not.toBeNull();
    expect(customCleanupDraft).not.toBeNull();
    expect(document.querySelector('#mnr-custom-cleanup-site')?.textContent).toContain('m.1qxs.com');
    expect(document.querySelector('#mnr-custom-css')).not.toBeNull();
    expect(document.querySelector('.mnr-cache-action')).toBeNull();
    expect(document.querySelector('.mnr-settings-footer .mnr-exit-btn')?.textContent).toContain(
      '退出阅读模式'
    );
    const fontSelect = document.querySelector<HTMLSelectElement>('#mnr-font-family');
    expect(fontSelect?.selectedOptions[0]?.textContent?.trim()).toBe('系统默认');
    expect(Array.from(fontSelect!.options, option => option.textContent?.trim())).toEqual([
      '系统默认',
      '宋体',
      '楷体',
      '仿宋',
    ]);
    // Windows ships its Kaiti face as KaiTi; without it the option would render as SimSun.
    expect(fontSelect!.options[2].value).toContain('KaiTi');
    expect(
      window.getComputedStyle(document.querySelector('.mnr-settings-overlay')!).backgroundColor
    ).toBe('rgba(0, 0, 0, 0.12)');
    expect(document.querySelector('#mnr-protection-help')?.textContent).toContain('无法恢复');
    expect(
      Array.from(document.querySelectorAll('.mnr-switch-row span'), span => span.textContent)
    ).toContain('本站自动进入阅读模式');

    configStore.updateReading({ fontSize: 24 });
    const resetButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mnr-secondary-action')
    ).find(button => button.textContent?.trim() === '恢复默认外观');
    resetButton?.click();
    await nextTick();
    expect(configStore.reading.fontSize).toBe(24);
    expect(resetButton?.textContent?.trim()).toBe('再点一次恢复默认外观');
    resetButton?.click();
    await nextTick();
    expect(configStore.reading.fontSize).toBe(18);
    expect(resetButton?.textContent?.trim()).toBe('恢复默认外观');

    customCleanupDraft!.value = '测试广告$';
    customCleanupDraft!.dispatchEvent(new window.Event('input', { bubbles: true }));
    await nextTick();
    document.querySelector<HTMLButtonElement>('.mnr-cleanup-add-button')?.click();
    await nextTick();
    expect(configStore.customCleanupRegex).toBe('@host=m.1qxs.com 测试广告$');
    expect(customCleanupDraft!.value).toBe('');

    customCleanup!.value = '[';
    customCleanup!.dispatchEvent(new window.Event('input', { bubbles: true }));
    await nextTick();
    expect(configStore.customCleanupRegex).toBe('[');
    expect(document.querySelector('#mnr-custom-cleanup-error')?.textContent).toContain('第 1 行');

    customCleanup!.value = '测试广告$';
    customCleanup!.dispatchEvent(new window.Event('input', { bubbles: true }));
    await nextTick();
    expect(document.querySelector('#mnr-custom-cleanup-error')).toBeNull();

    const aggressiveButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mnr-segment')
    ).find(button => button.textContent?.trim() === '强力');
    expect(window.getComputedStyle(aggressiveButton!).fontSize).toBe('14px');
    aggressiveButton?.click();
    await nextTick();
    expect(onProtectionModeChange).toHaveBeenCalledWith('aggressive');
    expect(configStore.protection.mode).toBe('standard');

    document.querySelectorAll<HTMLButtonElement>('.mnr-theme-btn')[THEMES.length - 1]?.click();

    const closeBtn = document.querySelector('.mnr-close-btn') as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    await nextTick();

    expect(onClose).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(GM_setValue).toHaveBeenCalledWith('mnr-config', expect.stringContaining('"dark"'))
    );

    app.unmount();
    mountEl.remove();
  });

  it('FloatingToolbar keeps only the primary directory and settings actions', async () => {
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp({ render: () => h(FloatingToolbar, { visible: true }) });

    app.mount(mountEl);
    await nextTick();

    expect(document.querySelectorAll('.mnr-fab')).toHaveLength(2);
    expect(document.querySelectorAll('.mnr-fab svg')).toHaveLength(2);
    expect(document.querySelector('[aria-label="打开目录"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="打开设置"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="缓存管理"]')).toBeNull();

    app.unmount();
    mountEl.remove();
  });

  it('ChapterDrawer searches a large TOC without rendering every row', async () => {
    const onClearCache = vi.fn();
    const onCacheAll = vi.fn();
    const chapters = Array.from({ length: 1200 }, (_, index) => ({
      title: `第 ${index + 1} 章`,
      url: `https://example.com/chapter/${index + 1}`,
      isCached: index === 0 || index === 1,
      isPersisted: false,
      isCurrent: index === 599,
    }));
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp({
      render: () =>
        h(ChapterDrawer, {
          isOpen: true,
          chapters,
          loading: false,
          cacheProgress: { done: 0, total: 0, failed: 0, running: false },
          persistedCount: 1,
          onCacheAll,
          onClearCache,
        }),
    });

    app.mount(mountEl);
    await nextTick();

    expect(document.querySelectorAll('.mnr-chapter-button').length).toBeLessThan(50);
    const search = document.querySelector<HTMLInputElement>('#mnr-chapter-search');
    expect(search).not.toBeNull();
    expect(document.querySelector('#mnr-offline-title')?.textContent).toBe('离线阅读');
    expect(document.querySelector('.mnr-offline-copy span')?.textContent).toBe('已保存 1 章');
    expect(document.querySelectorAll('.mnr-cache-mark svg')).toHaveLength(0);
    const offlineStatus = () => document.querySelector('.mnr-offline-copy span')?.textContent;
    const cacheBookButton = document.querySelector<HTMLButtonElement>(
      '.mnr-offline-action.primary'
    );
    expect(cacheBookButton?.textContent?.trim()).toBe('缓存本书');
    // The first click only states the cost; nothing is requested until the second.
    cacheBookButton?.click();
    await nextTick();
    expect(onCacheAll).not.toHaveBeenCalled();
    expect(cacheBookButton?.textContent?.trim()).toBe('开始缓存');
    expect(offlineStatus()).toBe('将缓存 1200 章，再点一次开始');
    cacheBookButton?.click();
    await nextTick();
    expect(onCacheAll).toHaveBeenCalledTimes(1);
    expect(cacheBookButton?.textContent?.trim()).toBe('缓存本书');
    const clearCacheButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mnr-offline-action')
    ).find(button => button.textContent?.trim() === '清除缓存');
    expect(clearCacheButton).not.toBeNull();
    clearCacheButton?.click();
    await nextTick();
    expect(onClearCache).not.toHaveBeenCalled();
    expect(clearCacheButton?.textContent?.trim()).toBe('确认清除');
    expect(offlineStatus()).toBe('将删除已保存的 1 章，再点一次确认');
    clearCacheButton?.click();
    expect(onClearCache).toHaveBeenCalledTimes(1);
    if (search) {
      search.value = '第 1200 章';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      expect(document.querySelectorAll('.mnr-chapter-button')).toHaveLength(1);
      expect(document.querySelector('.mnr-chapter-button')?.textContent).toContain('第 1200 章');
    }

    app.unmount();
    mountEl.remove();
  });

  it('ChapterDrawer offers cache-all only once the TOC has chapters and retries an empty TOC', async () => {
    const loading = ref(true);
    const chapters = ref<
      Array<{
        title: string;
        url: string;
        isCached: boolean;
        isPersisted: boolean;
        isCurrent: boolean;
        access?: 'locked';
      }>
    >([]);
    const onCacheAll = vi.fn();
    const onReloadToc = vi.fn();
    injectSfcStyle(chapterDrawerSource);
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp({
      render: () =>
        h(ChapterDrawer, {
          isOpen: true,
          chapters: chapters.value,
          loading: loading.value,
          cacheProgress: { done: 0, total: 0, failed: 0, running: false },
          persistedCount: 0,
          onCacheAll,
          onReloadToc,
        }),
    });

    app.mount(mountEl);
    await nextTick();

    const cacheButton = document.querySelector<HTMLButtonElement>('.mnr-offline-action.primary');
    expect(cacheButton?.disabled).toBe(true);
    cacheButton?.click();
    expect(onCacheAll).not.toHaveBeenCalled();

    loading.value = false;
    await nextTick();
    expect(cacheButton?.disabled).toBe(true);
    const retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.textContent?.trim() === '重新加载'
    );
    expect(document.querySelector('.mnr-drawer-state')?.textContent).toContain('暂无目录');
    retry?.click();
    expect(onReloadToc).toHaveBeenCalledTimes(1);

    chapters.value = [
      {
        title: '第 1 章',
        url: 'https://example.com/chapter/1',
        isCached: true,
        isPersisted: true,
        isCurrent: false,
      },
      {
        title: '第 2 章',
        url: 'https://example.com/chapter/2',
        isCached: false,
        isPersisted: false,
        isCurrent: true,
      },
      {
        title: '第 3 章',
        url: 'https://example.com/chapter/3',
        isCached: false,
        isPersisted: false,
        isCurrent: false,
        access: 'locked',
      },
    ];
    await nextTick();
    expect(cacheButton?.disabled).toBe(false);
    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('.mnr-chapter-button'));
    expect(rows[0].querySelector('.mnr-cache-mark')?.getAttribute('aria-label')).toBe('已离线缓存');
    expect(rows[2].querySelector('.mnr-lock-mark')?.getAttribute('aria-label')).toBe('付费章节');
    // Only the mark is tinted; a cached title keeps the readable text color.
    const cachedGreen = 'rgb(56, 142, 60)';
    expect(window.getComputedStyle(rows[0].querySelector('.mnr-cache-mark')!).color).toBe(
      cachedGreen
    );
    expect(window.getComputedStyle(rows[0]).color).not.toBe(cachedGreen);

    // One free chapter is still unsaved, so cache-all states its cost before requesting.
    cacheButton?.click();
    await nextTick();
    expect(document.querySelector('.mnr-offline-copy span')?.textContent).toBe(
      '将缓存 1 章，再点一次开始'
    );
    cacheButton?.click();
    expect(onCacheAll).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
  });
});
