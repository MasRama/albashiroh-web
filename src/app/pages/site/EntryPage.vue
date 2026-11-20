<script setup lang="ts">
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Download, FileText, UserRound } from 'lucide-vue-next';
import { computed, shallowRef, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import type { ContentType, PublicEntryDetail } from '../../../features/content/web';
import NewsCard from '../../site/components/NewsCard.vue';
import PageHead from '../../site/components/PageHead.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { levelLabel, longDate, pageTitle, siteClient, useEntries, useTitle } from '../../site/site';
import { entryPath, sitePage, siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';
import SiteNotFound from './SiteNotFound.vue';

/**
 * One entry on its own page: a news article, a club or an academic page.
 * The photo, the details its type carries, the body, an attachment, and
 * more of the same kind under it. An unpublished or unknown slug is a 404.
 */
const props = defineProps<{ portal: SitePortal; pageKey: string; slug: string }>();
const page = computed(() => sitePage(props.portal, props.pageKey)!);
const type = computed(() => page.value.type as ContentType);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);

const entry = shallowRef<PublicEntryDetail | null>(null);
const status = shallowRef<'loading' | 'ready' | 'missing' | 'failed'>('loading');
let ticket = 0;
watchEffect(() => {
  const mine = (ticket += 1);
  const wanted = { portal: props.portal, type: type.value, slug: props.slug };
  status.value = 'loading';
  void siteClient.entry(wanted.portal, wanted.type, wanted.slug).then((result) => {
    if (mine !== ticket) return;
    entry.value = result.ok ? result.data : null;
    status.value = result.ok ? 'ready' : result.status === 404 ? 'missing' : 'failed';
  });
});
useTitle(() => (entry.value ? `${entry.value.title} | ${names.value.short}` : status.value === 'missing' ? `Halaman tidak ditemukan | ${names.value.short}` : pageTitle(props.portal, page.value.label)));

const more = useEntries(() => ({ portal: props.portal, type: type.value, query: { limit: 4 } }));
const others = computed(() => (more.page.value?.items ?? []).filter((item) => item.slug !== props.slug).slice(0, 3));
const listRoute = computed(() => ({ name: siteRouteName(props.portal, props.pageKey) }));
const tone = computed(() => (entry.value?.portal === 'yayasan' || !entry.value ? 'forest' : entry.value.portal));
const kicker = computed(() => {
  if (!entry.value) return page.value.label;
  if (type.value === 'berita') return props.portal === 'yayasan' ? `Berita · ${levelLabel(entry.value)}` : entry.value.fields.category || 'Berita';
  return page.value.label;
});
const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
</script>

<template>
  <SiteNotFound v-if="status === 'missing'" :portal="portal" />
  <div v-else class="ep">
    <PageHead
      :kicker="kicker"
      :title="entry?.title ?? (status === 'failed' ? 'Halaman belum bisa dimuat' : ' ')"
      :intro="entry?.summary || (status === 'failed' ? 'Periksa sambungan internet, lalu muat ulang halaman.' : undefined)"
      :crumbs="[
        { label: 'Beranda', to: { name: siteRouteName(portal, 'home') } },
        { label: page.label, to: listRoute },
      ]"
    >
      <div v-if="entry && (entry.date || entry.fields.coach || entry.fields.schedule)" class="ep-facts">
        <span v-if="entry.date"><CalendarDays :size="16" aria-hidden="true" /><time :datetime="entry.date">{{ longDate(entry.date) }}</time></span>
        <span v-if="entry.fields.coach"><UserRound :size="16" aria-hidden="true" />Pembina: {{ entry.fields.coach }}</span>
        <span v-if="entry.fields.schedule"><Clock :size="16" aria-hidden="true" />{{ entry.fields.schedule }}</span>
      </div>
    </PageHead>

    <section class="s-body">
      <div class="s-wrap">
        <div v-if="status === 'loading'" class="ep-article"><div class="s-skeleton ep-skeleton" /></div>
        <article v-else-if="entry" class="ep-article">
          <figure v-if="entry.image" class="ep-photo">
            <SitePhoto :image="entry.image" :title="entry.title" :tone="tone" sizes="(max-width: 960px) 100vw, 880px" eager />
            <figcaption v-if="entry.image.alt && entry.image.alt !== entry.title">{{ entry.image.alt }}</figcaption>
          </figure>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
          <div v-if="entry.body" class="ep-body ab-prose" v-html="entry.body" />
          <p v-else-if="!entry.summary" class="ep-none">Uraian lengkap segera ditambahkan.</p>
          <a v-if="entry.file" :href="entry.file.url" class="ep-file" :download="entry.file.name">
            <span class="ep-file-icon" aria-hidden="true"><FileText :size="22" /></span>
            <span><b>{{ entry.file.name }}</b><small>{{ fileSize(entry.file.size) }}</small></span>
            <span class="ep-file-go"><Download :size="18" aria-hidden="true" /> Unduh</span>
          </a>
          <RouterLink :to="listRoute" class="s-more ep-back"><ArrowLeft :size="16" :stroke-width="2.3" aria-hidden="true" /> Kembali ke {{ page.label.toLowerCase() }}</RouterLink>
        </article>
      </div>
    </section>

    <section v-if="others.length" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">{{ page.label }}</div><h2 class="s-h2">{{ type === 'berita' ? 'Kabar lainnya.' : 'Lihat juga.' }}</h2></div>
          <RouterLink :to="listRoute" class="s-more">Semua {{ page.label.toLowerCase() }} <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="ep-more">
          <template v-if="type === 'berita'"><NewsCard v-for="item in others" :key="item.id" :entry="item" :show-level="portal === 'yayasan'" /></template>
          <template v-else>
            <RouterLink v-for="(item, index) in others" :key="item.id" :to="entryPath(portal, item.type, item.slug) ?? ''" class="s-tile s-tile--photo ep-tile" :class="{ 's-tile--cover': !item.image }">
              <div class="s-tile-bg"><SitePhoto :image="item.image" :title="item.title" :tone="index % 2 ? 'ink' : tone" scale="s" sizes="(max-width: 640px) 100vw, 30vw" /></div>
              <div v-if="item.image"><h3>{{ item.title }}</h3></div>
            </RouterLink>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ep-facts { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 26px; color: rgba(255, 255, 255, .85); font-size: 15px; font-weight: 600; }
.ep-facts span { display: inline-flex; align-items: center; gap: 8px; }
.ep-article { max-width: 880px; margin: 0 auto; }
.ep-skeleton { height: 420px; }
.ep-photo { margin: 0 0 40px; overflow: hidden; border-radius: 26px; }
.ep-photo :deep(.sp) { max-height: 560px; }
.ep-photo figcaption { padding: 12px 4px 0; color: var(--ab-mute); font-size: 14px; }
.ep-body { font-size: 18px; line-height: 1.75; }
.ep-none { color: var(--ab-mute); font-size: 17px; }
.ep-file { display: flex; align-items: center; gap: 16px; margin-top: 36px; padding: 18px 20px; border: 1px solid var(--ab-line); border-radius: 20px; background: #fff; }
.ep-file:hover { border-color: var(--ab-line-strong); }
.ep-file-icon { display: grid; width: 48px; height: 48px; flex: none; place-items: center; border-radius: 14px; background: var(--ab-paper); color: var(--acc); }
.ep-file b { display: block; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.ep-file small { color: var(--ab-mute); font-size: 13.5px; }
.ep-file-go { display: inline-flex; flex: none; align-items: center; gap: 8px; margin-left: auto; font-weight: 700; }
.ep-back { margin-top: 44px; }
.ep-more { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.ep-tile { min-height: 280px; }
@media (max-width: 960px) {
  .ep-more { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .ep-facts { margin-top: 20px; font-size: 14px; }
  .ep-photo { margin-bottom: 28px; border-radius: 20px; }
  .ep-body { font-size: 16.5px; }
  .ep-file { flex-wrap: wrap; }
  .ep-file-go { margin-left: 64px; }
  .ep-more { gap: 14px; }
  .ep-tile { min-height: 220px; }
}
</style>
