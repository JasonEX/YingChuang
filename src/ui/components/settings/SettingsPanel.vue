<template>
  <Transition name="mnr-slide">
    <div v-if="visible" class="mnr-settings-overlay" @click.self="closePanel">
      <section
        ref="panelRef"
        class="mnr-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mnr-settings-title"
      >
        <header class="mnr-settings-header">
          <h3 id="mnr-settings-title" ref="titleRef" tabindex="-1">阅读设置</h3>
          <button class="mnr-close-btn" aria-label="关闭设置" @click="closePanel">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="mnr-settings-content">
          <section class="mnr-settings-section" aria-labelledby="mnr-appearance-title">
            <h4 id="mnr-appearance-title">阅读外观</h4>

            <div class="mnr-theme-grid" aria-label="阅读主题">
              <button
                v-for="theme in themes"
                :key="theme.id"
                class="mnr-theme-btn"
                :class="{ active: configStore.themeId === theme.id }"
                :aria-pressed="configStore.themeId === theme.id"
                :style="{
                  background: theme.background,
                  color: theme.text,
                  borderColor:
                    configStore.themeId === theme.id ? 'var(--mnr-link, #1976d2)' : theme.border,
                }"
                @click="configStore.setTheme(theme.id)"
              >
                {{ theme.name }}
              </button>
            </div>

            <div class="mnr-reading-preview" aria-hidden="true">
              <span>排版预览</span>
              <p>山高月小，水落石出。愿每一页都读得舒适从容。</p>
            </div>

            <ReadingSlider
              id="mnr-font-size"
              label="字号"
              :model-value="configStore.reading.fontSize"
              :min="14"
              :max="28"
              min-label="小"
              max-label="大"
              :display-value="`${configStore.reading.fontSize} 像素`"
              @update:model-value="updateNumericReading('fontSize', $event)"
            />

            <ReadingSlider
              id="mnr-line-height"
              label="行距"
              :model-value="configStore.reading.lineHeight"
              :min="1.4"
              :max="2.4"
              :step="0.1"
              min-label="紧"
              max-label="松"
              :display-value="`${configStore.reading.lineHeight} 倍`"
              @update:model-value="updateNumericReading('lineHeight', $event)"
            />

            <label class="mnr-field-label" for="mnr-font-family">字体</label>
            <select
              id="mnr-font-family"
              class="mnr-select"
              :value="configStore.reading.fontFamily"
              @change="updateFontFamily"
            >
              <option v-for="option in fontOptions" :key="option.label" :value="option.value">
                {{ option.label }}
              </option>
            </select>

            <fieldset class="mnr-settings-fieldset">
              <legend>简繁转换</legend>
              <div class="mnr-segmented-control">
                <button
                  v-for="option in conversionOptions"
                  :key="option.value"
                  class="mnr-segment"
                  :class="{ active: configStore.reading.textConversion === option.value }"
                  :aria-pressed="configStore.reading.textConversion === option.value"
                  @click="updateTextConversion(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </fieldset>

            <button class="mnr-secondary-action" @click="confirm('reset', resetAppearance)">
              {{ armed === 'reset' ? '再点一次恢复默认外观' : '恢复默认外观' }}
            </button>
          </section>

          <details class="mnr-settings-group">
            <summary>排版细节</summary>
            <div class="mnr-settings-group-content">
              <ReadingSlider
                id="mnr-letter-spacing"
                label="字间距"
                :model-value="configStore.reading.letterSpacing"
                :min="0"
                :max="0.2"
                :step="0.01"
                min-label="紧"
                max-label="松"
                :display-value="`${Math.round(configStore.reading.letterSpacing * 100)}%`"
                @update:model-value="updateNumericReading('letterSpacing', $event)"
              />

              <ReadingSlider
                id="mnr-paragraph-indent"
                label="段落缩进"
                :model-value="configStore.reading.paragraphIndent"
                :min="0"
                :max="4"
                :step="0.5"
                min-label="0"
                max-label="4"
                :display-value="`${configStore.reading.paragraphIndent} 字`"
                @update:model-value="updateNumericReading('paragraphIndent', $event)"
              />

              <ReadingSlider
                id="mnr-max-width"
                class="mnr-desktop-width"
                label="桌面内容宽度"
                :model-value="configStore.reading.maxWidth"
                :min="500"
                :max="1200"
                :step="50"
                min-label="窄"
                max-label="宽"
                :display-value="`${configStore.reading.maxWidth} 像素`"
                @update:model-value="updateNumericReading('maxWidth', $event)"
              />

              <ReadingSlider
                id="mnr-padding"
                label="页面边距"
                :model-value="configStore.reading.padding"
                :min="12"
                :max="48"
                :step="2"
                min-label="窄"
                max-label="宽"
                :display-value="`${configStore.reading.padding} 像素`"
                @update:model-value="updateNumericReading('padding', $event)"
              />
            </div>
          </details>

          <details class="mnr-settings-group">
            <summary>阅读行为</summary>
            <div class="mnr-settings-group-content">
              <label class="mnr-switch-row">
                <span>显示阅读进度</span>
                <input
                  type="checkbox"
                  :checked="configStore.behavior.showProgress"
                  @change="updateBehavior('showProgress', $event)"
                />
              </label>

              <label class="mnr-switch-row">
                <span>自动加载下一章</span>
                <input
                  type="checkbox"
                  :checked="configStore.behavior.preloadNext"
                  @change="updateBehavior('preloadNext', $event)"
                />
              </label>

              <label class="mnr-switch-row">
                <span>自动隐藏工具栏</span>
                <input
                  type="checkbox"
                  :checked="configStore.behavior.autoHideHeader"
                  @change="updateBehavior('autoHideHeader', $event)"
                />
              </label>

              <label class="mnr-switch-row">
                <span>键盘导航</span>
                <input
                  type="checkbox"
                  :checked="configStore.behavior.keyboardNavigation"
                  @change="updateBehavior('keyboardNavigation', $event)"
                />
              </label>

              <label class="mnr-switch-row">
                <span>左右滑动翻屏</span>
                <input
                  type="checkbox"
                  :checked="configStore.behavior.swipeGestures"
                  @change="updateBehavior('swipeGestures', $event)"
                />
              </label>
            </div>
          </details>

          <details class="mnr-settings-group">
            <summary>本站与高级</summary>
            <div class="mnr-settings-group-content">
              <label class="mnr-switch-row">
                <span>本站自动进入阅读模式</span>
                <input type="checkbox" :checked="siteAutoEnable" @change="updateSiteAutoEnable" />
              </label>

              <fieldset class="mnr-settings-fieldset" aria-describedby="mnr-protection-help">
                <legend>网站防护</legend>
                <div class="mnr-segmented-control">
                  <button
                    class="mnr-segment"
                    :class="{ active: configStore.protection.mode === 'standard' }"
                    :aria-pressed="configStore.protection.mode === 'standard'"
                    @click="emit('protectionModeChange', 'standard')"
                  >
                    标准
                  </button>
                  <button
                    class="mnr-segment"
                    :class="{ active: configStore.protection.mode === 'aggressive' }"
                    :aria-pressed="configStore.protection.mode === 'aggressive'"
                    @click="emit('protectionModeChange', 'aggressive')"
                  >
                    强力
                  </button>
                </div>
                <p id="mnr-protection-help" class="mnr-field-help mnr-protection-help">
                  强力模式会额外停止页面定时器，清理可疑脚本和遮罩层，退出阅读后也无法恢复。
                </p>
              </fieldset>

              <label class="mnr-field-label" for="mnr-custom-css">自定义 CSS</label>
              <textarea
                id="mnr-custom-css"
                class="mnr-custom-css"
                rows="5"
                spellcheck="false"
                placeholder=".mnr-reader-content { ... }"
                :value="configStore.customCSS"
                @input="updateCustomCSS"
              ></textarea>

              <div class="mnr-cleanup-fields">
                <h4 class="mnr-field-label">自定义正则清理</h4>
                <p id="mnr-custom-cleanup-help" class="mnr-field-help">
                  每行一条正则，匹配后隐藏整段正文。
                </p>
                <p id="mnr-custom-cleanup-site" class="mnr-field-help mnr-cleanup-site">
                  本站 · {{ customCleanupHostname || '无法识别' }}
                </p>
                <div class="mnr-cleanup-add">
                  <input
                    id="mnr-custom-cleanup-draft"
                    class="mnr-cleanup-input"
                    type="text"
                    spellcheck="false"
                    aria-label="本站清理正则"
                    :aria-describedby="
                      customCleanupDraftError
                        ? 'mnr-custom-cleanup-site mnr-custom-cleanup-draft-error'
                        : 'mnr-custom-cleanup-site'
                    "
                    :aria-invalid="!!customCleanupDraftError"
                    placeholder="输入本站正则"
                    :value="customCleanupDraft"
                    @input="updateCustomCleanupDraft"
                  />
                  <button
                    type="button"
                    class="mnr-secondary-action mnr-cleanup-add-button"
                    :disabled="!customCleanupHostname || !customCleanupDraft.trim()"
                    @click="addCurrentSiteCleanupRule"
                  >
                    添加规则
                  </button>
                </div>
                <p
                  v-if="customCleanupDraftError"
                  id="mnr-custom-cleanup-draft-error"
                  class="mnr-field-error"
                  role="status"
                >
                  {{ customCleanupDraftError }}
                </p>
                <label class="mnr-cleanup-editor-label" for="mnr-custom-cleanup-regex"
                  >全部规则</label
                >
                <textarea
                  id="mnr-custom-cleanup-regex"
                  class="mnr-custom-css"
                  rows="4"
                  spellcheck="false"
                  :aria-describedby="
                    customCleanupErrors.length > 0
                      ? 'mnr-custom-cleanup-help mnr-custom-cleanup-error'
                      : 'mnr-custom-cleanup-help'
                  "
                  :aria-invalid="customCleanupErrors.length > 0"
                  placeholder="例如：小说免费阅读，请收藏.*"
                  :value="configStore.customCleanupRegex"
                  @input="updateCustomCleanupRegex"
                ></textarea>
                <p
                  v-if="customCleanupErrors.length > 0"
                  id="mnr-custom-cleanup-error"
                  class="mnr-field-error"
                  role="status"
                >
                  {{ customCleanupErrorMessage }}
                </p>

                <details class="mnr-cleanup-guide">
                  <summary>规则语法与数量限制</summary>
                  <p>
                    无前缀时对所有网站生效；以 <code>@host=域名</code> 开头时仅对该网站生效。
                    上方“添加规则”会自动填写本站前缀。
                  </p>
                  <p>
                    全局最多 {{ MAX_CUSTOM_PARAGRAPH_GLOBAL_FILTERS }} 条，每站最多
                    {{ MAX_CUSTOM_PARAGRAPH_SITE_FILTERS }} 条，合计最多
                    {{ MAX_CUSTOM_PARAGRAPH_FILTERS }} 条；每条最多
                    {{ MAX_CUSTOM_PARAGRAPH_FILTER_LENGTH }} 字符。
                  </p>
                </details>
              </div>

              <button class="mnr-secondary-action" @click="emit('copyDiagnostics')">
                复制诊断信息
              </button>
            </div>
          </details>
        </div>

        <footer class="mnr-settings-footer">
          <button class="mnr-exit-btn" @click="emit('exit')">退出阅读模式</button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useEventListener } from '@/ui/composables/useEventListener';
import { useTwoStepConfirm } from '@/ui/composables/useTwoStepConfirm';
import { getDeepActiveElement } from '@/ui/focus';
import {
  THEMES,
  type BehaviorSettings,
  type ReadingSettings,
  useConfigStore,
} from '@/ui/stores/config';
import ReadingSlider from './ReadingSlider.vue';
import {
  appendScopedCustomParagraphFilter,
  compileCustomParagraphFilters,
  MAX_CUSTOM_PARAGRAPH_FILTER_LENGTH,
  MAX_CUSTOM_PARAGRAPH_FILTERS,
  MAX_CUSTOM_PARAGRAPH_GLOBAL_FILTERS,
  MAX_CUSTOM_PARAGRAPH_SITE_FILTERS,
} from '@/ui/contentFilters';

type NumericReadingKey =
  'fontSize' | 'lineHeight' | 'letterSpacing' | 'paragraphIndent' | 'maxWidth' | 'padding';
type BooleanBehaviorKey = keyof BehaviorSettings;

const props = withDefaults(
  defineProps<{
    visible: boolean;
    siteAutoEnable?: boolean;
    customCleanupHostname?: string;
  }>(),
  { siteAutoEnable: true, customCleanupHostname: '' }
);

const emit = defineEmits<{
  close: [];
  copyDiagnostics: [];
  exit: [];
  siteAutoEnableChange: [enabled: boolean];
  textConversionChange: [mode: 'none' | 'sc' | 'tc'];
  protectionModeChange: [mode: 'standard' | 'aggressive'];
}>();

const configStore = useConfigStore();
const { armed, confirm, disarm } = useTwoStepConfirm<'reset'>();
const panelRef = ref<HTMLElement | null>(null);
const titleRef = ref<HTMLElement | null>(null);
const customCleanupDraft = ref('');
const customCleanupDraftError = ref('');
const compiledCustomCleanup = computed(() =>
  compileCustomParagraphFilters(configStore.customCleanupRegex)
);
const customCleanupErrors = computed(() => compiledCustomCleanup.value.errors);
const customCleanupErrorMessage = computed(() =>
  customCleanupErrors.value.map(error => `第 ${error.line} 行：${error.message}`).join('；')
);

const themes = THEMES;
const conversionOptions = [
  { label: '原文', value: 'none' },
  { label: '简体', value: 'sc' },
  { label: '繁體', value: 'tc' },
] as const;
// Named by style, each listing the family names macOS, Windows and Linux actually ship,
// because a stack with no installed face silently renders as the fallback.
const fontOptions = [
  {
    label: '系统默认',
    value: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif',
  },
  {
    label: '宋体',
    value:
      "'Noto Serif SC', 'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', SimSun, serif",
  },
  { label: '楷体', value: "'Kaiti SC', STKaiti, KaiTi, serif" },
  { label: '仿宋', value: 'STFangsong, FangSong, serif' },
] as const;

function closePanel() {
  emit('close');
}

function trapFocus(event: KeyboardEvent) {
  const panel = panelRef.value;
  if (!panel) return;

  const focusable = Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(element => element.offsetParent !== null || element === getDeepActiveElement());
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

function handleDialogKeydown(event: Event) {
  const keyboardEvent = event as globalThis.KeyboardEvent;
  const panel = panelRef.value;
  if (!props.visible || !panel || !keyboardEvent.composedPath().includes(panel)) return;

  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();
    closePanel();
  } else if (keyboardEvent.key === 'Tab') {
    keyboardEvent.stopImmediatePropagation();
    trapFocus(keyboardEvent);
  }
}

useEventListener('keydown', handleDialogKeydown, { capture: true });

function updateNumericReading(key: NumericReadingKey, value: number) {
  configStore.updateReading({ [key]: value } as Partial<ReadingSettings>);
}

function updateFontFamily(event: Event) {
  configStore.updateReading({
    fontFamily: (event.currentTarget as globalThis.HTMLSelectElement).value,
  });
}

function updateTextConversion(mode: 'none' | 'sc' | 'tc') {
  configStore.updateReading({ textConversion: mode });
  emit('textConversionChange', mode);
}

function updateBehavior(key: BooleanBehaviorKey, event: Event) {
  configStore.updateBehavior({
    [key]: (event.currentTarget as globalThis.HTMLInputElement).checked,
  });
}

function updateSiteAutoEnable(event: Event) {
  emit('siteAutoEnableChange', (event.currentTarget as globalThis.HTMLInputElement).checked);
}

function updateCustomCSS(event: Event) {
  configStore.setCustomCSS((event.currentTarget as globalThis.HTMLTextAreaElement).value);
}

function updateCustomCleanupRegex(event: Event) {
  configStore.setCustomCleanupRegex((event.currentTarget as globalThis.HTMLTextAreaElement).value);
}

function updateCustomCleanupDraft(event: Event) {
  customCleanupDraft.value = (event.currentTarget as globalThis.HTMLInputElement).value;
  customCleanupDraftError.value = '';
}

function addCurrentSiteCleanupRule() {
  const result = appendScopedCustomParagraphFilter(
    configStore.customCleanupRegex,
    props.customCleanupHostname,
    customCleanupDraft.value
  );
  if (result.error) {
    customCleanupDraftError.value = result.error;
    return;
  }

  configStore.setCustomCleanupRegex(result.source);
  customCleanupDraft.value = '';
  customCleanupDraftError.value = '';
}

function resetAppearance() {
  configStore.setTheme('system');
  configStore.resetReading();
  emit('textConversionChange', 'none');
}

watch(
  () => props.visible,
  async visible => {
    if (visible) {
      await nextTick();
      titleRef.value?.focus({ preventScroll: true });
      return;
    }

    customCleanupDraft.value = '';
    customCleanupDraftError.value = '';
    disarm();
    void configStore.flushSave();
  }
);
</script>

<style scoped>
.mnr-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  /* Light enough to judge theme and typography changes live behind the panel. */
  background: rgba(0, 0, 0, 0.12);
}

.mnr-settings-panel {
  display: flex;
  width: min(100%, 380px);
  height: 100%;
  flex-direction: column;
  padding-right: env(safe-area-inset-right);
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  border-left: 1px solid var(--mnr-border, #e0e0e0);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
}

.mnr-settings-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: max(16px, env(safe-area-inset-top)) 16px 16px;
  border-bottom: 1px solid var(--mnr-border, #e0e0e0);
}

.mnr-settings-header h3,
.mnr-settings-section h4,
.mnr-field-label {
  margin: 0;
  color: var(--mnr-text, #333);
}

.mnr-settings-header h3 {
  border-radius: 4px;
  font-size: 18px;
}

.mnr-close-btn {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.mnr-close-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.mnr-settings-content {
  flex: 1;
  overflow: auto;
  padding: 18px 16px 24px;
  overscroll-behavior: contain;
}

.mnr-settings-section h4,
.mnr-field-label,
.mnr-settings-fieldset legend {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.mnr-theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.mnr-theme-btn {
  min-width: 0;
  min-height: 42px;
  padding: 8px 4px;
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.mnr-reading-preview {
  display: none;
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
}

.mnr-reading-preview span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  opacity: 0.65;
}

.mnr-reading-preview p {
  margin: 0;
  font-family: var(--mnr-font-family, system-ui, sans-serif);
  font-size: var(--mnr-font-size, 18px);
  line-height: var(--mnr-line-height, 1.8);
  letter-spacing: var(--mnr-letter-spacing, 0);
  text-indent: var(--mnr-paragraph-indent, 2em);
}

.mnr-field-label {
  margin-top: 18px;
}

.mnr-select {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  font-size: 14px;
}

.mnr-settings-fieldset {
  min-width: 0;
  margin: 18px 0 0;
  padding: 0;
  border: 0;
}

.mnr-segmented-control {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
}

.mnr-segment {
  min-height: 42px;
  flex: 1;
  padding: 9px 12px;
  border: 0;
  border-right: 1px solid var(--mnr-border, #ddd);
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #666);
  font-size: 14px;
  cursor: pointer;
}

.mnr-segment:last-child {
  border-right: 0;
}

.mnr-segment.active {
  background: var(--mnr-link, #1976d2);
  color: var(--mnr-on-link, #fff);
}

.mnr-secondary-action {
  width: 100%;
  min-height: 42px;
  margin-top: 16px;
  padding: 9px 12px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: transparent;
  color: var(--mnr-text, #333);
  font-size: 14px;
  cursor: pointer;
}

.mnr-settings-group {
  margin-top: 18px;
  border-top: 1px solid var(--mnr-border, #ddd);
}

.mnr-settings-group summary {
  min-height: 48px;
  padding: 14px 0;
  color: var(--mnr-text, #333);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.mnr-settings-group-content {
  padding-bottom: 4px;
}

.mnr-settings-group-content > :first-child {
  margin-top: 0;
}

.mnr-switch-row {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--mnr-text, #333);
  cursor: pointer;
}

.mnr-switch-row input {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  accent-color: var(--mnr-link, #1976d2);
}

.mnr-custom-css {
  box-sizing: border-box;
  width: 100%;
  min-height: 110px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  font:
    12px/1.5 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.mnr-cleanup-fields {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}

.mnr-cleanup-fields .mnr-field-label,
.mnr-cleanup-fields .mnr-field-help,
.mnr-cleanup-fields .mnr-field-error {
  margin: 0;
}

.mnr-cleanup-editor-label,
.mnr-cleanup-guide {
  font-size: 12px;
  line-height: 1.6;
}

.mnr-cleanup-guide {
  color: var(--mnr-text, #333);
}

.mnr-cleanup-guide summary {
  cursor: pointer;
  opacity: 0.72;
}

.mnr-cleanup-guide p {
  margin: 8px 0 0;
}

.mnr-cleanup-guide code {
  overflow-wrap: anywhere;
}

.mnr-cleanup-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.mnr-cleanup-input {
  box-sizing: border-box;
  min-width: 0;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--mnr-border, #ddd);
  border-radius: 8px;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  font:
    12px/1.5 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.mnr-cleanup-add-button {
  width: auto;
  margin-top: 0;
  white-space: nowrap;
}

.mnr-cleanup-add-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.mnr-cleanup-site {
  overflow-wrap: anywhere;
}

.mnr-field-help,
.mnr-field-error {
  margin: -4px 0 8px;
  font-size: 12px;
  line-height: 1.5;
}

.mnr-field-help {
  opacity: 0.72;
}

.mnr-protection-help {
  margin: 8px 0 0;
}

.mnr-field-error {
  margin-top: 6px;
  color: var(--mnr-danger, #b3261e);
}

.mnr-settings-footer {
  flex-shrink: 0;
  padding: 10px 16px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--mnr-border, #ddd);
  background: var(--mnr-bg, #fff);
}

.mnr-exit-btn {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--mnr-danger, #b3261e);
  border-radius: 8px;
  background: transparent;
  color: var(--mnr-danger, #b3261e);
  font-size: 14px;
  cursor: pointer;
}

@media (hover: hover) {
  .mnr-close-btn:hover,
  .mnr-secondary-action:enabled:hover,
  .mnr-segment:not(.active):hover,
  .mnr-exit-btn:hover {
    background: var(--mnr-border, #f0f0f0);
  }
}

.mnr-settings-header h3:focus-visible,
.mnr-close-btn:focus-visible,
.mnr-theme-btn:focus-visible,
.mnr-select:focus-visible,
.mnr-segment:focus-visible,
.mnr-secondary-action:focus-visible,
.mnr-settings-group summary:focus-visible,
.mnr-cleanup-guide summary:focus-visible,
.mnr-switch-row input:focus-visible,
.mnr-cleanup-input:focus-visible,
.mnr-custom-css:focus-visible,
.mnr-exit-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--mnr-link, #1976d2) 55%, transparent);
  outline-offset: 2px;
}

.mnr-slide-enter-active,
.mnr-slide-leave-active,
.mnr-settings-panel {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.mnr-slide-enter-from,
.mnr-slide-leave-to {
  opacity: 0;
}

.mnr-slide-enter-from .mnr-settings-panel,
.mnr-slide-leave-to .mnr-settings-panel {
  transform: translateX(100%);
}

@media (max-width: 600px) {
  .mnr-settings-panel {
    width: 100%;
  }

  .mnr-reading-preview {
    display: block;
  }

  .mnr-desktop-width {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mnr-slide-enter-active,
  .mnr-slide-leave-active,
  .mnr-settings-panel {
    transition: none;
  }
}
</style>
