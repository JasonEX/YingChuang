<template>
  <button
    id="mnr-entry-button"
    class="mnr-reader-entry"
    type="button"
    title="进入阅读模式"
    aria-label="进入阅读模式"
    @click="emit('enter')"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15" />
      <path d="M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3" />
      <path d="M3 18h6a3 3 0 0 1 3 3" />
      <path d="M21 18h-6a3 3 0 0 0-3 3" />
    </svg>
    <span>进入阅读模式</span>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  enter: [];
}>();
</script>

<style scoped>
.mnr-reader-entry {
  position: fixed;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 2147483646;
  display: flex;
  min-width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: 24px;
  background: var(--mnr-link, #1976d2);
  color: var(--mnr-on-link, #fff);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  /* Stays out of the host page's way until pointed at or focused. */
  opacity: 0.6;
  animation: mnr-entry-in 0.2s ease-out;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    filter 0.18s ease,
    box-shadow 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.mnr-reader-entry svg {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mnr-reader-entry span {
  white-space: nowrap;
}

.mnr-reader-entry:active {
  transform: scale(0.96);
}

.mnr-reader-entry:focus-visible {
  opacity: 1;
  outline: 3px solid color-mix(in srgb, var(--mnr-link, #1976d2) 48%, #fff);
  outline-offset: 3px;
}

@media (hover: hover) {
  .mnr-reader-entry:hover {
    opacity: 1;
    filter: brightness(0.94);
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
  }
}

@media (max-width: 480px) {
  .mnr-reader-entry {
    width: 48px;
    padding: 0;
  }

  .mnr-reader-entry span {
    display: none;
  }
}

@keyframes mnr-entry-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mnr-reader-entry {
    animation: none;
    transition: none;
  }
}
</style>
