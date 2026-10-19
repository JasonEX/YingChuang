<template>
  <Transition name="mnr-fade-slide">
    <div v-show="visible" class="mnr-floating-toolbar">
      <button
        class="mnr-fab"
        title="目录 (C)"
        aria-label="打开目录"
        @click.stop="$emit('toggleDrawer')"
      >
        <svg class="mnr-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6h14M5 12h14M5 18h14" />
        </svg>
      </button>

      <!-- Where the reader is, shown only when the controls are summoned -->
      <p v-if="chapterTitle" class="mnr-toolbar-title">{{ chapterTitle }}</p>

      <button
        class="mnr-fab"
        title="设置 (S)"
        aria-label="打开设置"
        @click.stop="$emit('openSettings')"
      >
        <svg class="mnr-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
          />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ visible?: boolean; chapterTitle?: string }>(), {
  visible: true,
  chapterTitle: '',
});

defineEmits<{
  toggleDrawer: [];
  openSettings: [];
}>();
</script>

<style scoped>
.mnr-floating-toolbar {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  right: max(12px, env(safe-area-inset-right));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
  z-index: 100;
}

.mnr-toolbar-title {
  min-width: 0;
  margin: 0;
  padding: 6px 14px;
  overflow: hidden;
  border: 1px solid var(--mnr-border);
  border-radius: 999px;
  background: var(--mnr-surface);
  color: var(--mnr-muted);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mnr-fab {
  pointer-events: auto;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--mnr-surface);
  color: var(--mnr-text);
  border: 1px solid var(--mnr-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  -webkit-tap-highlight-color: transparent;
}

.mnr-fab:hover {
  background: var(--mnr-border);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.mnr-fab:active {
  transform: scale(0.95);
}

.mnr-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mnr-fab:focus-visible {
  outline: 3px solid var(--mnr-focus);
  outline-offset: 2px;
}

/* Transitions */
.mnr-fade-slide-enter-active,
.mnr-fade-slide-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.mnr-fade-slide-enter-from,
.mnr-fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (prefers-reduced-motion: reduce) {
  .mnr-fab,
  .mnr-fade-slide-enter-active,
  .mnr-fade-slide-leave-active {
    transition: none;
  }
}
</style>
