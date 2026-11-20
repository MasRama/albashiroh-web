<script setup lang="ts">
import { Search, X } from '@lucide/vue';

/** A search box for a list; the clear button empties it. */
withDefaults(defineProps<{ modelValue: string; placeholder?: string; label?: string }>(), { placeholder: 'Cari', label: 'Cari' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="ab-search">
    <Search :size="18" class="ab-search-icon" aria-hidden="true" />
    <input
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="label"
      autocomplete="off"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button v-if="modelValue" type="button" class="ab-search-clear" aria-label="Kosongkan pencarian" @click="emit('update:modelValue', '')"><X :size="16" /></button>
  </div>
</template>

<style scoped>
.ab-search { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 6px 0 14px; border: 1.5px solid var(--ab-line); border-radius: 12px; background: var(--ab-card); }
.ab-search:focus-within { border-color: var(--ab-forest); box-shadow: var(--ab-focus); }
.ab-search-icon { flex: none; color: var(--ab-mute); }
.ab-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: none; font-size: 15px; }
.ab-search input::-webkit-search-cancel-button { display: none; }
.ab-search-clear { display: grid; flex: none; width: 32px; height: 32px; place-items: center; border-radius: 8px; color: var(--ab-mute); }
.ab-search-clear:hover { background: var(--ab-paper-2); color: var(--ab-ink); }
</style>
