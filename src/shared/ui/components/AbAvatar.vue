<script setup lang="ts">
import { computed } from 'vue';
import { initials } from '../format';

/** A person's initials on a forest square. */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 38 });
const letters = computed(() => initials(props.name));
</script>

<template>
  <span class="ab-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }" aria-hidden="true">{{ letters }}</span>
</template>

<style scoped>
.ab-avatar { display: grid; flex: none; place-items: center; border-radius: 30%; background: var(--ab-forest); color: #fff; font-family: var(--ab-display); font-weight: 800; letter-spacing: -.02em; }
</style>
