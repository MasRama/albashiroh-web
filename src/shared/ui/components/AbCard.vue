<script setup lang="ts">
/**
 * A crisp white card with a hairline border, the admin's main surface. An
 * optional header carries a title, a line of description and actions.
 */
withDefaults(defineProps<{ title?: string; description?: string; flush?: boolean }>(), { flush: false });
</script>

<template>
  <section class="ab-card">
    <header v-if="title || $slots.actions" class="ab-card-head">
      <div class="ab-card-heading">
        <h2 v-if="title" class="ab-card-title">{{ title }}</h2>
        <p v-if="description" class="ab-card-description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ab-card-actions"><slot name="actions" /></div>
    </header>
    <div class="ab-card-body" :class="{ 'ab-card-body--flush': flush }"><slot /></div>
    <footer v-if="$slots.footer" class="ab-card-foot"><slot name="footer" /></footer>
  </section>
</template>

<style scoped>
.ab-card { overflow: hidden; border: 1px solid var(--ab-line); border-radius: var(--ab-radius-l); background: var(--ab-card); }
.ab-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 20px; padding: 22px 24px 0; }
.ab-card-heading { min-width: 0; }
.ab-card-title { margin: 0; font-family: var(--ab-display); font-size: 21px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
.ab-card-description { margin: 5px 0 0; color: var(--ab-mute); font-size: 14.5px; }
.ab-card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ab-card-body { padding: 20px 24px 24px; }
.ab-card-body--flush { padding: 12px 0 0; }
.ab-card-head + .ab-card-body--flush { padding-top: 16px; }
.ab-card-foot { padding: 16px 24px; border-top: 1px solid var(--ab-line); background: #FBF9F4; }
@media (max-width: 719px) {
  .ab-card-head { padding: 18px 16px 0; }
  .ab-card-body { padding: 16px 16px 18px; }
  .ab-card-body--flush { padding: 8px 0 0; }
  .ab-card-foot { padding: 14px 16px; }
}
</style>
