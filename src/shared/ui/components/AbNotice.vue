<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-vue-next';

/** A block of information inside a page or dialog. */
withDefaults(defineProps<{ tone?: 'info' | 'warn' | 'bad' | 'good' }>(), { tone: 'info' });
</script>

<template>
  <div class="ab-notice" :class="`ab-notice--${tone}`" :role="tone === 'bad' ? 'alert' : 'status'">
    <CircleAlert v-if="tone === 'bad'" :size="19" class="ab-notice-icon" />
    <TriangleAlert v-else-if="tone === 'warn'" :size="19" class="ab-notice-icon" />
    <CircleCheck v-else-if="tone === 'good'" :size="19" class="ab-notice-icon" />
    <Info v-else :size="19" class="ab-notice-icon" />
    <div class="ab-notice-text"><slot /></div>
  </div>
</template>

<style scoped>
.ab-notice { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 1.5px solid var(--ab-line); border-radius: 14px; background: var(--ab-card); font-size: 14.5px; }
.ab-notice-icon { flex: none; margin-top: 1px; }
.ab-notice-text { min-width: 0; }
.ab-notice--info .ab-notice-icon { color: var(--ab-forest); }
.ab-notice--good { border-color: var(--ab-smp); }
.ab-notice--good .ab-notice-icon { color: var(--ab-smp); }
.ab-notice--warn { border-color: var(--ab-sun); background: var(--ab-sun-soft); }
.ab-notice--warn .ab-notice-icon { color: #8A5A00; }
.ab-notice--bad { border-color: var(--ab-red); background: var(--ab-red-soft); }
.ab-notice--bad .ab-notice-icon { color: var(--ab-red); }
</style>
