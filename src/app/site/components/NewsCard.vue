<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PublicEntry } from '../../../features/content/web';
import { entryPath } from '../../site-map';
import { levelLabel, longDate } from '../site';
import SitePhoto from './SitePhoto.vue';

/** A news card: photo (or its title on the school's colour), level or category, date and title. */
const props = defineProps<{ entry: PublicEntry; showLevel?: boolean }>();
const to = computed(() => entryPath(props.entry.portal, 'berita', props.entry.slug) ?? '/berita');
const tone = computed(() => (props.entry.portal === 'yayasan' ? 'forest' : props.entry.portal));
const label = computed(() => (props.showLevel ? levelLabel(props.entry) : props.entry.fields.category || 'Kabar'));
</script>

<template>
  <RouterLink :to="to" class="s-news">
    <div class="s-news-photo"><SitePhoto :image="entry.image" :title="entry.title" :tone="tone" scale="s" sizes="(max-width: 640px) 118px, 30vw" /></div>
    <div class="s-news-body">
      <div class="s-meta">
        <span class="s-lvl" :class="showLevel ? `s-lvl--${entry.portal}` : entry.portal === 'yayasan' ? 's-lvl--yayasan' : `s-lvl--${entry.portal}`">{{ label }}</span>
        <template v-if="entry.date"><span aria-hidden="true">·</span><time :datetime="entry.date">{{ longDate(entry.date) }}</time></template>
      </div>
      <h3>{{ entry.title }}</h3>
      <span class="s-news-read">Baca <ArrowRight :size="15" :stroke-width="2.3" aria-hidden="true" /></span>
    </div>
  </RouterLink>
</template>
