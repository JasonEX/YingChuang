<template>
  <div class="mnr-reading-control">
    <div class="mnr-reading-control-header">
      <label :id="`${id}-label`" :for="id">{{ label }}</label>
      <output :for="id">{{ displayValue }}</output>
    </div>
    <div class="mnr-reading-slider-row">
      <span aria-hidden="true">{{ minLabel }}</span>
      <input
        :id="id"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :aria-labelledby="`${id}-label`"
        :aria-valuetext="displayValue"
        @input="handleInput"
      />
      <span aria-hidden="true">{{ maxLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string;
    label: string;
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    minLabel: string;
    maxLabel: string;
    displayValue: string;
  }>(),
  { step: 1 }
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function handleInput(event: Event) {
  emit('update:modelValue', Number((event.currentTarget as globalThis.HTMLInputElement).value));
}
</script>

<style scoped>
.mnr-reading-control {
  margin-top: 18px;
}

.mnr-reading-control-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.mnr-reading-control-header label {
  color: var(--mnr-text);
  font-size: 14px;
  font-weight: 600;
}

.mnr-reading-control-header output {
  color: var(--mnr-muted);
  font-size: 13px;
}

.mnr-reading-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mnr-reading-slider-row span {
  flex: 0 0 24px;
  color: var(--mnr-muted);
  font-size: 13px;
  text-align: center;
}

.mnr-reading-slider-row input {
  flex: 1;
  min-width: 0;
  height: 32px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
  touch-action: pan-y;
}

.mnr-reading-slider-row input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: var(--mnr-border);
}

.mnr-reading-slider-row input::-webkit-slider-thumb {
  width: 24px;
  height: 24px;
  margin-top: -10px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: var(--mnr-link);
}

.mnr-reading-slider-row input::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--mnr-border);
}

.mnr-reading-slider-row input::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: var(--mnr-link);
}

.mnr-reading-slider-row input:focus-visible {
  outline: 3px solid var(--mnr-focus);
  outline-offset: 2px;
}
</style>
