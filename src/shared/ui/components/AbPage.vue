<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

/**
 * An admin screen: an optional way back, the title in Bricolage, one line
 * of description, the screen's actions on the right, then its content.
 */
defineProps<{
  title: string;
  description?: string;
  back?: { label: string; to: RouteLocationRaw };
  narrow?: boolean;
}>();
</script>

<template>
  <div class="ab-page" :class="{ 'ab-page--narrow': narrow }">
    <RouterLink v-if="back" :to="back.to" class="ab-page-back"><ArrowLeft :size="16" />{{ back.label }}</RouterLink>
    <header class="ab-page-head">
      <div class="ab-page-heading">
        <h1 class="ab-page-title">{{ title }}</h1>
        <p v-if="description" class="ab-page-description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ab-page-actions"><slot name="actions" /></div>
    </header>
    <div class="ab-page-body"><slot /></div>
  </div>
</template>

<style scoped>
.ab-page { width: 100%; max-width: 1120px; margin: 0 auto; padding: 36px 40px 72px; }
.ab-page--narrow { max-width: 760px; }
.ab-page-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; color: var(--ab-mute); font-size: 14px; font-weight: 700; }
.ab-page-back:hover { color: var(--ab-ink); }
.ab-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px 24px; }
.ab-page-heading { min-width: 0; }
.ab-page-title { margin: 0; font-family: var(--ab-display); font-size: 40px; font-weight: 800; letter-spacing: -.035em; line-height: 1; overflow-wrap: anywhere; }
.ab-page-description { max-width: 620px; margin: 10px 0 0; color: var(--ab-ink-2); font-size: 15.5px; }
.ab-page-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.ab-page-body { display: grid; gap: 20px; margin-top: 28px; }
@media (max-width: 719px) {
  .ab-page { padding: 22px 16px 56px; }
  .ab-page-title { font-size: 30px; }
  .ab-page-body { gap: 16px; margin-top: 20px; }
}
</style>
