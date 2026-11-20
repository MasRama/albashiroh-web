<script setup lang="ts">
import { useId } from 'vue';

/** A labelled native select, the field's sibling for a short list of choices. */
defineProps<{
  label: string;
  modelValue: string | number | null | undefined;
  options: readonly { value: string | number; label: string }[];
  error?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const id = useId();
</script>

<template>
  <div class="ab-select-field" :class="{ 'ab-select-field--error': error }">
    <label :for="id" class="ab-select-label">{{ label }}</label>
    <select
      :id="id"
      class="ab-select"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <p v-if="error" class="ab-select-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="ab-select-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.ab-select-field { display: grid; gap: 7px; min-width: 0; }
.ab-select-label { font-size: 14px; font-weight: 700; }
.ab-select-field--error .ab-select { border-color: var(--ab-red); }
.ab-select-error { margin: 0; color: var(--ab-red); font-size: 13.5px; font-weight: 600; }
.ab-select-hint { margin: 0; color: var(--ab-mute); font-size: 13.5px; }
</style>
