<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PageHead from '../../site/components/PageHead.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { pageTitle, useEntries, usePortal, useTitle } from '../../site/site';
import { siteRouteName } from '../../site-map';

/**
 * The Yayasan's two programme pages, Takhosus Al-Qur'an and Keasramaan:
 * the text the Yayasan writes in the admin, beside the way to the other
 * programme and to PPDB, with photos of the facilities under it.
 */
const props = defineProps<{ pageKey: 'takhosus' | 'keasramaan' }>();
const data = usePortal(() => 'yayasan');
const body = computed(() => data.value?.settings[props.pageKey] ?? '');
const facilities = useEntries(() => ({ portal: 'yayasan', type: 'fasilitas', query: { limit: 3 } }));

const COPY = {
  takhosus: {
    title: "Takhosus Al-Qur'an",
    intro: "Program unggulan Yayasan Bashiroh Robbaniyah: menghafal Al-Qur'an 30 juz dengan bimbingan musyrif, sambil tetap menempuh sekolah formal.",
    empty: 'Uraian program Takhosus sedang disiapkan.',
    other: { key: 'keasramaan', label: 'Keasramaan', line: 'Kehidupan asrama dan pembinaan harian santri.' },
  },
  keasramaan: {
    title: 'Keasramaan',
    intro: 'Kehidupan asrama yang tertib dan penuh adab: ibadah berjamaah, belajar malam, dan kemandirian sehari-hari.',
    empty: 'Uraian kehidupan asrama sedang disiapkan.',
    other: { key: 'takhosus', label: "Takhosus Al-Qur'an", line: 'Program hafalan Al-Qur\'an 30 juz.' },
  },
} as const;
const copy = computed(() => COPY[props.pageKey]);
useTitle(() => pageTitle('yayasan', copy.value.title));
</script>

<template>
  <div class="pg">
    <PageHead kicker="Program yayasan" :title="copy.title" :intro="copy.intro" :crumbs="[{ label: 'Beranda', to: { name: 'home' } }]" />

    <section class="s-body">
      <div class="s-wrap">
        <div class="pg-grid">
          <div v-if="data === null" class="s-skeleton pg-skeleton" />
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
          <article v-else-if="body" class="s-card ab-prose pg-body" v-html="body" />
          <div v-else class="s-empty"><b>{{ copy.empty }}</b><span>Hubungi kami untuk informasi lengkap.</span></div>

          <aside class="pg-side">
            <div v-if="pageKey === 'takhosus'" class="pg-big"><b>30</b><span>juz</span><small>Target hafalan santri Takhosus</small></div>
            <RouterLink :to="{ name: siteRouteName('yayasan', copy.other.key) }" class="s-tile s-tile--sun pg-tile">
              <div><h3>{{ copy.other.label }}</h3><p>{{ copy.other.line }}</p></div>
            </RouterLink>
            <RouterLink :to="{ name: siteRouteName('yayasan', 'ppdb') }" class="s-tile pg-tile pg-ppdb">
              <div><h3>Daftar PPDB</h3><p>Formulir untuk SMP IT dan SMA IT.</p></div>
              <span class="s-tile-arrow" aria-hidden="true"><ArrowRight :size="20" /></span>
            </RouterLink>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="facilities.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">Fasilitas</div><h2 class="s-h2">Lingkungan belajar dan asrama.</h2></div>
          <RouterLink :to="{ name: siteRouteName('yayasan', 'fasilitas') }" class="s-more">Semua fasilitas <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="pg-fac">
          <figure v-for="(item, index) in facilities.page.value.items" :key="item.id">
            <div class="pg-fac-photo"><SitePhoto :image="item.image" :title="item.title" :tone="index % 2 ? 'ink' : 'forest'" scale="s" sizes="(max-width: 640px) 100vw, 30vw" /></div>
            <figcaption>{{ item.title }}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pg-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); align-items: start; gap: 24px; }
.pg-skeleton { height: 420px; }
.pg-body { font-size: 17.5px; }
.pg-side { display: grid; gap: 20px; }
.pg-big { display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 10px; padding: 32px; border-radius: 28px; background: var(--ab-ink); color: var(--ab-sun); font-family: var(--ab-display); font-weight: 800; }
.pg-big b { font-size: 120px; letter-spacing: -.06em; line-height: .8; }
.pg-big span { color: #fff; font-size: 34px; }
.pg-big small { grid-column: span 2; margin-top: 18px; color: rgba(255, 255, 255, .72); font-family: var(--ab-sans, inherit); font-size: 15px; font-weight: 600; }
.pg-tile { min-height: 190px; }
.pg-ppdb { background: var(--ab-sma); }
.pg-fac { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.pg-fac figure { margin: 0; }
.pg-fac-photo { height: 260px; overflow: hidden; border-radius: 22px; }
.pg-fac figcaption { margin-top: 12px; font-size: 16px; font-weight: 700; }
@media (max-width: 960px) {
  .pg-grid { grid-template-columns: minmax(0, 1fr); }
  .pg-side { grid-template-columns: 1fr 1fr; }
  .pg-big { grid-column: span 2; }
}
@media (max-width: 640px) {
  .pg-body { font-size: 16px; }
  .pg-side { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .pg-big { grid-column: auto; padding: 24px 22px; border-radius: 24px; }
  .pg-big b { font-size: 92px; }
  .pg-tile { min-height: 150px; }
  .pg-fac { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .pg-fac-photo { height: 220px; }
}
</style>
