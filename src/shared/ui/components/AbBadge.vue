<script setup lang="ts">
/** A short status word in a row or a table cell (Aktif, Draf, Diterima). Never a label above a headline. */
withDefaults(defineProps<{ tone?: 'green' | 'orange' | 'gray' | 'red' | 'sun' | 'forest'; dot?: boolean }>(), { tone: 'gray' });
</script>

<template>
  <span class="ab-badge" :class="`ab-badge--${tone}`"><span v-if="dot" class="ab-badge-dot" aria-hidden="true" /><slot /></span>
</template>

<style scoped>
.ab-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1.5px solid currentColor;
  border-radius: 8px;
  background: var(--ab-card);
  font-size: 12.5px;
  font-weight: 800;
  white-space: nowrap;
}
.ab-badge-dot { width: 7px; height: 7px; border-radius: 2px; background: currentColor; }
.ab-badge--green { color: var(--ab-smp); }
.ab-badge--orange { color: var(--ab-sma-deep); }
.ab-badge--gray { color: var(--ab-mute); border-color: var(--ab-line); }
.ab-badge--red { color: var(--ab-red); }
.ab-badge--sun { border-color: var(--ab-sun); background: var(--ab-sun); color: var(--ab-ink); }
.ab-badge--forest { border-color: var(--ab-forest); background: var(--ab-forest); color: #fff; }
</style>
