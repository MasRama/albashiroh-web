<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next';
import { ref, useId } from 'vue';
import type { PublicEntry } from '../../../features/content/web';

/** Questions that open one at a time; the first starts open. Answers are the school's sanitized text. */
const props = defineProps<{ items: PublicEntry[] }>();
const id = useId();
const open = ref<string | null>(props.items[0]?.id ?? null);
</script>

<template>
  <div class="fq-list">
    <div v-for="item in items" :key="item.id" class="fq" :class="{ 'fq--open': open === item.id }">
      <h3>
        <button type="button" :aria-expanded="open === item.id" :aria-controls="`${id}-${item.id}`" @click="open = open === item.id ? null : item.id">
          <span>{{ item.title }}</span>
          <span class="fq-pm" aria-hidden="true"><Minus v-if="open === item.id" :size="16" :stroke-width="2.6" /><Plus v-else :size="16" :stroke-width="2.6" /></span>
        </button>
      </h3>
      <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
      <div v-show="open === item.id" :id="`${id}-${item.id}`" class="fq-a ab-prose" v-html="item.body" />
    </div>
  </div>
</template>

<style scoped>
.fq-list { display: grid; gap: 12px; }
.fq { padding: 20px 24px; border: 1px solid var(--ab-line); border-radius: 18px; background: #fff; }
.fq--open { border-color: var(--ab-ink); }
.fq h3 { margin: 0; }
.fq button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 16px; font-size: 16.5px; font-weight: 700; text-align: left; }
.fq-pm { display: grid; width: 32px; height: 32px; flex: none; place-items: center; border-radius: 10px; background: var(--ab-paper); }
.fq--open .fq-pm { background: var(--acc); color: #fff; }
.fq-a { max-width: 680px; margin-top: 10px; color: var(--ab-ink-2); font-size: 15px; }
@media (max-width: 640px) {
  .fq { padding: 16px 18px; }
  .fq button { font-size: 15px; }
}
</style>
