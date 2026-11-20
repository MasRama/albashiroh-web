<script setup lang="ts">
/** A small busy ring; `light` for use on solid colour (an orange button). */
withDefaults(defineProps<{ size?: number; light?: boolean; label?: string }>(), { size: 22, label: 'Memuat' });
</script>

<template>
  <span class="ab-spinner" :class="{ 'ab-spinner--light': light }" :style="{ width: `${size}px`, height: `${size}px` }" role="status" :aria-label="label" />
</template>

<style scoped>
.ab-spinner {
  display: inline-block;
  flex: none;
  border: 2.5px solid rgba(19, 33, 26, .14);
  border-top-color: var(--ab-forest);
  border-radius: 50%;
  animation: ab-spin .7s linear infinite;
}
.ab-spinner--light { border-color: rgba(255, 255, 255, .35); border-top-color: #fff; }
@keyframes ab-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ab-spinner { animation-duration: 1.6s; } }
</style>
