<script setup lang="ts">
import { CalendarDays } from '@lucide/vue';
import type { PublicEntry } from '../../../features/content/web';
import { agendaTile } from '../site';

/** The agenda panel: the nearest events, each with its date tile, or "Segera" while the date is open. */
withDefaults(defineProps<{ items: PublicEntry[]; title?: string }>(), { title: 'Agenda terdekat' });
</script>

<template>
  <section class="s-agenda" :aria-label="title">
    <h3><CalendarDays :size="22" aria-hidden="true" />{{ title }}</h3>
    <div v-for="item in items" :key="item.id" class="s-ag">
      <time class="s-ag-date" :datetime="item.date ?? undefined">
        <b>{{ agendaTile(item.date).top }}</b><span>{{ agendaTile(item.date).bottom }}</span>
      </time>
      <div>
        <span v-if="item.fields.label" class="s-ag-label">{{ item.fields.label }}</span>
        <h4>{{ item.title }}</h4>
        <p v-if="item.summary">{{ item.summary }}</p>
      </div>
    </div>
    <p v-if="items.length === 0" class="s-ag-none">Agenda berikutnya segera diumumkan.</p>
  </section>
</template>

<style scoped>
.s-ag-none { margin: 0; padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, .12); color: rgba(255, 255, 255, .7); font-size: 15px; }
</style>
