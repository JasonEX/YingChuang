<template>
  <Transition name="mnr-toast">
    <div
      v-if="visible"
      class="mnr-toast"
      :class="{ 'mnr-toast--error': type === 'error' }"
      :role="type === 'error' ? 'alert' : 'status'"
      @click="$emit('dismiss')"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string;
    type?: 'info' | 'error';
    visible: boolean;
  }>(),
  { type: 'info' }
);

defineEmits<{
  dismiss: [];
}>();
</script>

<style scoped>
.mnr-toast {
  position: fixed;
  bottom: max(32px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--mnr-inverse-bg);
  color: var(--mnr-bg);
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
  z-index: 1001;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  max-width: calc(100vw - 32px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mnr-toast--error {
  background: var(--mnr-danger);
}

.mnr-toast-enter-active,
.mnr-toast-leave-active {
  transition: opacity 0.2s ease;
}

.mnr-toast-enter-from,
.mnr-toast-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mnr-toast-enter-active,
  .mnr-toast-leave-active {
    transition: none;
  }
}
</style>
