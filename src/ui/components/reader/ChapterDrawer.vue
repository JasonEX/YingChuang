<template>
  <Transition name="mnr-fade">
    <div v-if="isOpen" class="mnr-drawer-overlay" @click="emit('close')" />
  </Transition>

  <aside
    ref="drawerRef"
    class="mnr-drawer"
    :class="{ open: isOpen }"
    :aria-hidden="!isOpen"
    :inert="!isOpen"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mnr-drawer-title"
  >
    <header class="mnr-drawer-header">
      <div class="mnr-drawer-heading">
        <h3 id="mnr-drawer-title" class="mnr-drawer-title">{{ bookTitle || '目录' }}</h3>
        <span v-if="currentChapterNumber" class="mnr-drawer-position">
          第 {{ currentChapterNumber }} / {{ chapters.length }} 章
        </span>
      </div>
      <button
        ref="closeButtonRef"
        class="mnr-drawer-close"
        aria-label="关闭目录"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <div v-if="chapters.length > SEARCH_THRESHOLD" class="mnr-drawer-search">
      <label class="mnr-visually-hidden" for="mnr-chapter-search">搜索章节</label>
      <input
        id="mnr-chapter-search"
        v-model.trim="query"
        type="search"
        placeholder="搜索章节"
        autocomplete="off"
        @input="resetVirtualWindow"
      />
    </div>

    <section class="mnr-offline-section" aria-labelledby="mnr-offline-title">
      <div class="mnr-offline-main">
        <div class="mnr-offline-copy">
          <strong id="mnr-offline-title">离线阅读</strong>
          <span aria-live="polite">{{ offlineStatus }}</span>
        </div>
        <button
          class="mnr-offline-action primary"
          type="button"
          :disabled="loading || chapters.length === 0"
          @click="handleCacheAction"
        >
          {{ cacheActionLabel }}
        </button>
      </div>

      <div
        v-if="cacheProgress.running"
        class="mnr-cache-progress-track"
        role="progressbar"
        aria-label="离线缓存进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(cachePercent)"
      >
        <div class="mnr-cache-progress-fill" :style="{ width: `${cachePercent}%` }"></div>
      </div>

      <div
        v-if="!cacheProgress.running && (cacheProgress.failed > 0 || persistedCount > 0)"
        class="mnr-offline-secondary"
      >
        <button
          v-if="cacheProgress.failed > 0"
          class="mnr-offline-action"
          type="button"
          @click="emit('retryCache')"
        >
          重试失败章节（{{ cacheProgress.failed }}）
        </button>
        <button
          v-if="persistedCount > 0"
          class="mnr-offline-action danger"
          type="button"
          @click="confirm('clear', () => emit('clearCache'))"
        >
          {{ armed === 'clear' ? '确认清除' : '清除缓存' }}
        </button>
      </div>
    </section>

    <div v-if="loading" class="mnr-drawer-state">
      <MnrSpinner size="small" />
      <span>加载目录中...</span>
    </div>

    <div v-else-if="chapters.length === 0" class="mnr-drawer-state">
      <span>暂无目录</span>
      <button class="mnr-offline-action" type="button" @click="emit('reloadToc')">重新加载</button>
    </div>

    <div v-else-if="filteredChapters.length === 0" class="mnr-drawer-state">没有匹配的章节</div>

    <div v-else ref="contentRef" class="mnr-drawer-content" @scroll.passive="handleScroll">
      <ul
        class="mnr-chapter-list"
        :style="{ paddingTop: `${topSpacer}px`, paddingBottom: `${bottomSpacer}px` }"
      >
        <li v-for="ch in visibleChapters" :key="ch.url">
          <button
            class="mnr-chapter-button"
            :class="{ active: ch.isCurrent }"
            :aria-current="ch.isCurrent ? 'page' : undefined"
            @click="handleSelect(ch)"
          >
            <span
              v-if="ch.access === 'locked'"
              class="mnr-chapter-mark mnr-lock-mark"
              role="img"
              aria-label="付费章节"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <span
              v-else-if="ch.isPersisted && !ch.isCurrent"
              class="mnr-chapter-mark mnr-cache-mark"
              role="img"
              aria-label="已离线缓存"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </span>
            <span class="mnr-chapter-title-text">{{ ch.title }}</span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useEventListener } from '@/ui/composables/useEventListener';
import { useTwoStepConfirm } from '@/ui/composables/useTwoStepConfirm';
import type { CacheProgressState, TocEntryWithStatus } from '@/ui/stores/reader';
import { MnrSpinner } from '@/ui/components/common';
import { getDeepActiveElement } from '@/ui/focus';

const props = defineProps<{
  isOpen: boolean;
  bookTitle?: string;
  chapters: TocEntryWithStatus[];
  loading: boolean;
  cacheProgress: CacheProgressState;
  persistedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  select: [entry: TocEntryWithStatus];
  reloadToc: [];
  cacheAll: [];
  retryCache: [];
  clearCache: [];
}>();

const SEARCH_THRESHOLD = 50;
const ROW_HEIGHT = 44;
const OVERSCAN = 8;
const contentRef = ref<HTMLElement | null>(null);
const drawerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<globalThis.HTMLButtonElement | null>(null);
const query = ref('');
const scrollTop = ref(0);
const viewportHeight = ref(600);

const filteredChapters = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return props.chapters;
  return props.chapters.filter(chapter => chapter.title.toLocaleLowerCase().includes(needle));
});

const currentChapterNumber = computed(() => {
  const index = props.chapters.findIndex(chapter => chapter.isCurrent);
  return index >= 0 ? index + 1 : 0;
});
const { armed, confirm, disarm } = useTwoStepConfirm<'cache' | 'clear'>();
/** Chapters a full-book cache would still save; locked chapters are never cached. */
const uncachedCount = computed(
  () => props.chapters.filter(chapter => chapter.access !== 'locked' && !chapter.isPersisted).length
);
const cacheActionLabel = computed(() => {
  if (props.cacheProgress.running) return '取消';
  return armed.value === 'cache' ? '开始缓存' : '缓存本书';
});
const offlineStatus = computed(() => {
  if (armed.value === 'cache') return `将缓存 ${uncachedCount.value} 章，再点一次开始`;
  if (armed.value === 'clear') return `将删除已保存的 ${props.persistedCount} 章，再点一次确认`;
  if (props.cacheProgress.running) {
    return props.cacheProgress.total > 0
      ? `已缓存 ${props.cacheProgress.done} / ${props.cacheProgress.total} 章`
      : '正在准备缓存';
  }
  if (props.cacheProgress.failed > 0) return `有 ${props.cacheProgress.failed} 章缓存失败`;
  if (props.persistedCount > 0) return `已保存 ${props.persistedCount} 章`;
  return '尚未缓存';
});
const cachePercent = computed(() => {
  if (props.cacheProgress.total <= 0) return 0;
  return Math.min(100, (props.cacheProgress.done / props.cacheProgress.total) * 100);
});
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN));
const visibleCount = computed(() => Math.ceil(viewportHeight.value / ROW_HEIGHT) + OVERSCAN * 2);
const endIndex = computed(() =>
  Math.min(filteredChapters.value.length, startIndex.value + visibleCount.value)
);
const visibleChapters = computed(() =>
  filteredChapters.value.slice(startIndex.value, endIndex.value)
);
const topSpacer = computed(() => startIndex.value * ROW_HEIGHT);
const bottomSpacer = computed(() =>
  Math.max(0, (filteredChapters.value.length - endIndex.value) * ROW_HEIGHT)
);

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
  const currentIndex = props.chapters.findIndex(chapter => chapter.isCurrent);
  if (currentIndex < 0) return;
  const targetTop = Math.max(
    0,
    currentIndex * ROW_HEIGHT - content.clientHeight / 2 + ROW_HEIGHT / 2
  );
  content.scrollTop = targetTop;
  scrollTop.value = targetTop;
  viewportHeight.value = content.clientHeight || 600;
}

function handleSelect(entry: TocEntryWithStatus) {
  emit('select', entry);
  emit('close');
}

function handleCacheAction() {
  // Cancelling, or a book with nothing left to save, starts no requests and needs no second click.
  if (props.cacheProgress.running || uncachedCount.value === 0) {
    disarm();
    emit('cacheAll');
    return;
  }
  confirm('cache', () => emit('cacheAll'));
}

function trapFocus(event: globalThis.KeyboardEvent) {
  const drawer = drawerRef.value;
  if (!drawer) return;
  const focusable = Array.from(
    drawer.querySelectorAll<globalThis.HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(element => element.offsetParent !== null || element === getDeepActiveElement());
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

function handleDialogKeydown(event: Event) {
  const keyboardEvent = event as globalThis.KeyboardEvent;
  const drawer = drawerRef.value;
  if (!props.isOpen || !drawer || !keyboardEvent.composedPath().includes(drawer)) return;

  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();
    emit('close');
  } else if (keyboardEvent.key === 'Tab') {
    keyboardEvent.stopImmediatePropagation();
    trapFocus(keyboardEvent);
  }
}

useEventListener('keydown', handleDialogKeydown, { capture: true });

watch(
  () => props.isOpen,
  async open => {
    if (!open) {
      // A confirmation armed before closing must not carry over to the next opening.
      disarm();
      return;
    }
    query.value = '';
    await scrollCurrentIntoView();
    closeButtonRef.value?.focus({
      preventScroll: true,
    });
  },
  { flush: 'post' }
);

watch(
  () => [props.loading, props.chapters.length, currentChapterNumber.value],
  () => {
    if (props.isOpen) void scrollCurrentIntoView();
  },
  { flush: 'post' }
);
</script>

<style scoped>
.mnr-drawer {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 1001;
  display: flex;
  width: min(88%, 340px);
  flex-direction: column;
  padding-left: env(safe-area-inset-left);
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
  transform: translateX(-105%);
  transition: transform 0.24s ease;
}

.mnr-drawer.open {
  transform: translateX(0);
}

.mnr-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
}

.mnr-drawer-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: max(16px, env(safe-area-inset-top)) 16px 14px;
  border-bottom: 1px solid var(--mnr-border, #e5e5e5);
}

.mnr-drawer-heading {
  min-width: 0;
}

.mnr-drawer-title {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mnr-drawer-position {
  display: block;
  margin-top: 3px;
  color: var(--mnr-text, #666);
  font-size: 12px;
  opacity: 0.72;
}

.mnr-drawer-close {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.mnr-drawer-close svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.mnr-drawer-search {
  flex-shrink: 0;
  padding: 10px 12px 6px;
}

.mnr-drawer-search input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  font-size: 14px;
}

.mnr-offline-section {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-bottom: 1px solid var(--mnr-border, #e5e5e5);
}

.mnr-offline-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mnr-offline-copy {
  min-width: 0;
}

.mnr-offline-copy strong,
.mnr-offline-copy span {
  display: block;
}

.mnr-offline-copy strong {
  font-size: 13px;
  font-weight: 600;
}

.mnr-offline-copy span {
  margin-top: 2px;
  color: var(--mnr-text, #666);
  font-size: 12px;
  opacity: 0.7;
}

.mnr-offline-action {
  min-height: 36px;
  padding: 6px 11px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: transparent;
  color: var(--mnr-link, #1976d2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.mnr-offline-action:disabled {
  cursor: wait;
  opacity: 0.6;
}

.mnr-offline-action.primary {
  flex: 0 0 auto;
  border-color: var(--mnr-link, #1976d2);
  background: var(--mnr-link, #1976d2);
  color: var(--mnr-on-link, #fff);
}

.mnr-offline-action.danger {
  color: var(--mnr-text, #555);
}

.mnr-offline-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.mnr-drawer-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  /* Dim the text only, so the retry button keeps its full contrast. */
  color: color-mix(in srgb, var(--mnr-text, #666) 78%, transparent);
  text-align: center;
}

.mnr-drawer-content {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.mnr-cache-progress-track {
  height: 4px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--mnr-border, #e0e0e0);
}

.mnr-cache-progress-fill {
  height: 100%;
  background: var(--mnr-link, #1976d2);
  transition: width 0.2s ease;
}

.mnr-chapter-list {
  margin: 0;
  padding-right: 0;
  padding-left: 0;
  list-style: none;
}

.mnr-chapter-list li {
  height: 44px;
}

.mnr-chapter-button {
  display: flex;
  width: 100%;
  height: 44px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  padding: 0 14px;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.mnr-chapter-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mnr-chapter-button.active {
  border-left-color: var(--mnr-link, #1976d2);
  background: color-mix(in srgb, var(--mnr-link, #1976d2) 10%, transparent);
  color: var(--mnr-link, #1976d2);
  font-weight: 600;
}

.mnr-chapter-mark {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

/* Only the icon carries the cached color; titles keep the readable text color. */
.mnr-cache-mark {
  color: #388e3c;
}

.mnr-lock-mark {
  opacity: 0.6;
}

.mnr-chapter-mark svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (hover: hover) {
  .mnr-drawer-close:hover,
  .mnr-chapter-button:not(.active):hover,
  .mnr-offline-action:enabled:hover {
    background: var(--mnr-border, #f0f0f0);
  }

  .mnr-offline-action.primary:enabled:hover {
    background: var(--mnr-link, #1976d2);
    filter: brightness(0.94);
  }
}

.mnr-drawer-close:focus-visible,
.mnr-drawer-search input:focus-visible,
.mnr-offline-action:focus-visible,
.mnr-chapter-button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--mnr-link, #1976d2) 55%, transparent);
  outline-offset: -3px;
}

.mnr-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.mnr-fade-enter-active,
.mnr-fade-leave-active {
  transition: opacity 0.24s ease;
}

.mnr-fade-enter-from,
.mnr-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mnr-drawer,
  .mnr-fade-enter-active,
  .mnr-fade-leave-active,
  .mnr-cache-progress-fill {
    transition: none;
  }
}
</style>
