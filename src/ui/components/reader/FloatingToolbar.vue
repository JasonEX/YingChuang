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
withDefaults(defineProps<{ visible?: boolean }>(), { visible: true });

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
  justify-content: space-between;
  pointer-events: none;
  z-index: 100;
}

.mnr-fab {
  pointer-events: auto;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  background: var(--mnr-bg, #fff);
  color: var(--mnr-text, #333);
  border: 1px solid var(--mnr-border, #e5e5e5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  position: relative;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  -webkit-tap-highlight-color: transparent;
}

.mnr-fab:hover {
  background: var(--mnr-border, #f0f0f0);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.mnr-fab:active {
  transform: scale(0.95);
}

.mnr-fab:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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
  outline: 3px solid color-mix(in srgb, var(--mnr-link, #1976d2) 55%, transparent);
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
