<script setup lang="ts">
import type { Component } from 'vue';

/** What a list shows when it has nothing (yet), or could not load: an icon, a line, and the next step. */
defineProps<{ title: string; text?: string; icon?: Component }>();
</script>

<template>
  <div class="ab-empty">
    <span v-if="icon" class="ab-empty-icon" aria-hidden="true"><component :is="icon" :size="24" /></span>
    <p class="ab-empty-title">{{ title }}</p>
    <p v-if="text" class="ab-empty-text">{{ text }}</p>
    <div v-if="$slots.default" class="ab-empty-action"><slot /></div>
  </div>
</template>

<style scoped>
.ab-empty { display: grid; justify-items: center; gap: 6px; padding: 44px 20px; text-align: center; }
.ab-empty-icon { display: grid; width: 52px; height: 52px; margin-bottom: 8px; place-items: center; border-radius: 15px; background: var(--ab-paper); color: var(--ab-forest); }
.ab-empty-title { margin: 0; font-family: var(--ab-display); font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
.ab-empty-text { max-width: 420px; margin: 0; color: var(--ab-mute); font-size: 14.5px; }
.ab-empty-action { margin-top: 12px; }
</style>
