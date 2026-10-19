<template>
  <div class="mnr-spinner" :class="size"></div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'small' | 'medium' | 'large';
  }>(),
  { size: 'medium' }
);
</script>

<style scoped>
.mnr-spinner {
  border-radius: 50%;
  animation: mnr-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.mnr-spinner.small {
  width: 24px;
  height: 24px;
  border: 2px solid var(--mnr-border);
  border-top-color: var(--mnr-link);
  animation-duration: 1s;
  animation-timing-function: linear;
}

.mnr-spinner.medium {
  width: 48px;
  height: 48px;
  border: 4px solid var(--mnr-border);
  border-top-color: var(--mnr-link);
}

.mnr-spinner.large {
  width: 64px;
  height: 64px;
  border: 4px solid var(--mnr-border);
  border-top-color: var(--mnr-link);
}

@keyframes mnr-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
