<script setup lang="ts">
import { ArrowRight, ArrowUpRight, CalendarDays, Download, FileText, Play, Trophy } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { ContentType, PublicEntry } from '../../../features/content/web';
import FaqList from '../../site/components/FaqList.vue';
import GalleryLightbox from '../../site/components/GalleryLightbox.vue';
import NewsCard from '../../site/components/NewsCard.vue';
import PageHead from '../../site/components/PageHead.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { agendaTile, levelLabel, longDate, pageTitle, useEntries, useTitle, videoThumb } from '../../site/site';
import { entryPath, sitePage, siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';

/**
 * A page that lists one content type: news in cards, the agenda by date,
 * the gallery with its lightbox, achievements, facilities, staff,
 * documents to download, clubs, academics, questions and alumni. Long
 * lists page through `?halaman=`.
 */
const props = defineProps<{ portal: SitePortal; pageKey: string }>();
const route = useRoute();
const router = useRouter();

const page = computed(() => sitePage(props.portal, props.pageKey)!);
const type = computed(() => page.value.type as ContentType);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
useTitle(() => pageTitle(props.portal, page.value.label));

// Lists a visitor reads to the end (staff, facilities, questions, clubs) load whole; the rest page by twelve.
const WHOLE: readonly ContentType[] = ['agenda', 'fasilitas', 'guru', 'dokumen', 'ekskul', 'akademik', 'faq'];
const whole = computed(() => WHOLE.includes(type.value));
const perPage = computed(() => (whole.value ? 60 : type.value === 'galeri' ? 24 : 12));
const current = computed(() => {
  const value = Number(route.query.halaman);
  return Number.isInteger(value) && value > 1 ? value : 1;
});
const list = useEntries(() => ({ portal: props.portal, type: type.value, query: { page: current.value, limit: perPage.value, upcoming: type.value === 'agenda' } }));
const items = computed(() => list.page.value?.items ?? []);
const pages = computed(() => (list.page.value ? Math.max(1, Math.ceil(list.page.value.total / perPage.value)) : 1));
const loading = computed(() => list.page.value === null);
const aggregated = computed(() => props.portal === 'yayasan');

function goTo(target: number) {
  void router.push({ query: { ...route.query, halaman: target > 1 ? String(target) : undefined } });
}

const viewing = ref<number | null>(null);
watch(() => [props.portal, props.pageKey, current.value], () => (viewing.value = null));

const tone = (entry: PublicEntry, index = 0) => (entry.portal === 'yayasan' ? (index % 2 ? 'ink' : 'forest') : entry.portal);
const detail = (entry: PublicEntry) => entryPath(props.portal, entry.type, entry.slug) ?? '';
const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const fileKind = (mime: string, name: string) => (mime === 'application/pdf' ? 'PDF' : (name.split('.').pop() ?? '').toUpperCase());

const EMPTY: Partial<Record<ContentType, string>> = {
  berita: 'Kabar kegiatan akan tampil di sini.',
  agenda: 'Agenda berikutnya segera diumumkan.',
  galeri: 'Foto dan video kegiatan akan tampil di sini.',
  prestasi: 'Capaian siswa akan tampil di sini.',
  dokumen: 'Brosur dan formulir akan tersedia di sini.',
};
</script>

<template>
  <div class="lp">
    <PageHead
      :kicker="names.short"
      :title="page.label"
      :intro="page.description.replace('{name}', names.name)"
      :crumbs="[{ label: 'Beranda', to: { name: siteRouteName(portal, 'home') } }]"
    />

    <section class="s-body">
      <div class="s-wrap">
        <div v-if="loading" class="lp-grid lp-grid--3"><div v-for="index in 3" :key="index" class="s-skeleton lp-skeleton" /></div>

        <div v-else-if="items.length === 0" class="s-empty">
          <b>{{ list.failed.value ? 'Halaman belum bisa dimuat.' : `Belum ada ${page.label.toLowerCase()}.` }}</b>
          <span>{{ list.failed.value ? 'Periksa sambungan internet, lalu muat ulang halaman.' : EMPTY[type] ?? 'Isinya sedang disiapkan.' }}</span>
        </div>

        <!-- Berita -->
        <div v-else-if="type === 'berita'" class="lp-grid lp-grid--3">
          <NewsCard v-for="entry in items" :key="entry.id" :entry="entry" :show-level="aggregated" />
        </div>

        <!-- Agenda -->
        <div v-else-if="type === 'agenda'" class="lp-agenda">
          <article v-for="entry in items" :key="entry.id" class="lp-ag">
            <time class="lp-ag-date" :datetime="entry.date ?? undefined"><b>{{ agendaTile(entry.date).top }}</b><span>{{ agendaTile(entry.date).bottom }}</span></time>
            <div>
              <div class="s-meta">
                <span v-if="aggregated" class="s-lvl" :class="`s-lvl--${entry.portal}`">{{ levelLabel(entry) }}</span>
                <span v-if="entry.fields.label" class="lp-tag">{{ entry.fields.label }}</span>
                <span>{{ entry.date ? longDate(entry.date) : 'Tanggal segera diumumkan' }}</span>
              </div>
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.summary">{{ entry.summary }}</p>
            </div>
          </article>
        </div>

        <!-- Galeri -->
        <template v-else-if="type === 'galeri'">
          <div class="lp-gal">
            <button v-for="(entry, index) in items" :key="entry.id" type="button" class="lp-gal-item" :aria-label="`Buka ${entry.title}`" @click="viewing = index">
              <img v-if="videoThumb(entry)" :src="videoThumb(entry)!" :alt="entry.title" loading="lazy" />
              <SitePhoto v-else :image="entry.image" :title="entry.title" :tone="tone(entry, index)" scale="s" sizes="(max-width: 640px) 50vw, 25vw" />
              <span v-if="entry.fields.video" class="s-play" aria-hidden="true"><Play :size="22" fill="currentColor" /></span>
            </button>
          </div>
          <GalleryLightbox v-model="viewing" :items="items" />
        </template>

        <!-- Prestasi -->
        <div v-else-if="type === 'prestasi'" class="lp-grid lp-grid--3">
          <article v-for="(entry, index) in items" :key="entry.id" class="lp-card">
            <div class="lp-card-photo"><SitePhoto :image="entry.image" :title="entry.title" :tone="tone(entry, index)" scale="s" sizes="(max-width: 640px) 100vw, 30vw" /></div>
            <div class="lp-card-body">
              <div class="s-meta">
                <span class="lp-medal" aria-hidden="true"><Trophy :size="15" /></span>
                <span v-if="entry.fields.level">{{ entry.fields.level }}</span>
                <span v-if="aggregated" class="s-lvl" :class="`s-lvl--${entry.portal}`">{{ levelLabel(entry) }}</span>
              </div>
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.fields.student" class="lp-who">{{ entry.fields.student }}</p>
              <p v-if="entry.summary">{{ entry.summary }}</p>
              <time v-if="entry.date" :datetime="entry.date" class="lp-date">{{ longDate(entry.date) }}</time>
            </div>
          </article>
        </div>

        <!-- Fasilitas -->
        <div v-else-if="type === 'fasilitas'" class="lp-grid lp-grid--2">
          <article v-for="(entry, index) in items" :key="entry.id" class="lp-fac">
            <div class="lp-fac-photo"><SitePhoto :image="entry.image" :title="entry.title" :tone="tone(entry, index)" sizes="(max-width: 640px) 100vw, 45vw" /></div>
            <div class="lp-fac-body">
              <span v-if="aggregated && entry.portal !== 'yayasan'" class="s-lvl" :class="`s-lvl--${entry.portal}`">{{ levelLabel(entry) }}</span>
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.summary">{{ entry.summary }}</p>
            </div>
          </article>
        </div>

        <!-- Guru & staf -->
        <div v-else-if="type === 'guru'" class="lp-grid lp-grid--4">
          <article v-for="(entry, index) in items" :key="entry.id" class="lp-person">
            <div class="lp-person-photo"><SitePhoto :image="entry.image" :title="entry.title" :tone="index % 3 === 1 ? 'sun' : tone(entry, index)" scale="s" sizes="(max-width: 640px) 50vw, 22vw" /></div>
            <h2>{{ entry.title }}</h2>
            <p v-if="entry.fields.position">{{ entry.fields.position }}</p>
            <span v-if="aggregated && entry.portal !== 'yayasan'" class="s-lvl" :class="`s-lvl--${entry.portal}`">{{ levelLabel(entry) }}</span>
          </article>
        </div>

        <!-- Dokumen -->
        <div v-else-if="type === 'dokumen'" class="lp-docs">
          <article v-for="entry in items" :key="entry.id" class="lp-doc">
            <span class="lp-doc-icon" aria-hidden="true"><FileText :size="24" /></span>
            <div class="lp-doc-text">
              <div class="s-meta">
                <span v-if="entry.fields.kind">{{ entry.fields.kind }}</span>
                <span v-if="aggregated" class="s-lvl" :class="`s-lvl--${entry.portal}`">{{ levelLabel(entry) }}</span>
                <span v-if="entry.file">{{ fileKind(entry.file.mimeType, entry.file.name) }} · {{ fileSize(entry.file.size) }}</span>
              </div>
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.summary">{{ entry.summary }}</p>
            </div>
            <a v-if="entry.file" :href="entry.file.url" class="s-btn s-btn--ink s-btn--sm" :download="entry.file.name">
              <Download :size="17" aria-hidden="true" /> Unduh<span class="lp-sr"> {{ entry.title }}</span>
            </a>
            <span v-else class="lp-doc-none">Berkas segera tersedia</span>
          </article>
        </div>

        <!-- Ekstrakurikuler -->
        <div v-else-if="type === 'ekskul'" class="lp-grid lp-grid--2">
          <RouterLink v-for="(entry, index) in items" :key="entry.id" :to="detail(entry)" class="s-tile s-tile--photo lp-eks" :class="{ 's-tile--cover': !entry.image }">
            <div class="s-tile-bg"><SitePhoto :image="entry.image" :title="entry.title" :tone="index % 2 ? 'ink' : tone(entry)" sizes="(max-width: 640px) 100vw, 45vw" /></div>
            <span class="s-tile-arrow" aria-hidden="true"><ArrowUpRight :size="20" /></span>
            <div v-if="entry.image">
              <h2 class="lp-tile-title">{{ entry.title }}</h2>
              <p v-if="entry.fields.coach || entry.fields.schedule">{{ [entry.fields.coach && `Pembina: ${entry.fields.coach}`, entry.fields.schedule].filter(Boolean).join(' · ') }}</p>
            </div>
          </RouterLink>
        </div>

        <!-- Akademik -->
        <div v-else-if="type === 'akademik'" class="lp-grid lp-grid--3">
          <RouterLink v-for="(entry, index) in items" :key="entry.id" :to="detail(entry)" class="lp-card lp-card--link">
            <div class="lp-card-photo"><SitePhoto :image="entry.image" :title="entry.title" :tone="index % 2 ? 'ink' : tone(entry)" scale="s" sizes="(max-width: 640px) 100vw, 30vw" /></div>
            <div class="lp-card-body">
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.summary">{{ entry.summary }}</p>
              <span class="lp-read">Baca <ArrowRight :size="15" :stroke-width="2.3" aria-hidden="true" /></span>
            </div>
          </RouterLink>
        </div>

        <!-- Tanya jawab -->
        <div v-else-if="type === 'faq'" class="lp-faq">
          <FaqList :items="items" />
        </div>

        <!-- Alumni -->
        <div v-else-if="type === 'alumni'" class="lp-grid lp-grid--3">
          <article v-for="(entry, index) in items" :key="entry.id" class="lp-card">
            <div class="lp-card-photo lp-card-photo--tall"><SitePhoto :image="entry.image" :title="entry.title" :tone="index % 2 ? 'sun' : 'sma'" scale="s" sizes="(max-width: 640px) 100vw, 30vw" /></div>
            <div class="lp-card-body">
              <div class="s-meta"><span v-if="entry.fields.year">Angkatan {{ entry.fields.year }}</span></div>
              <h2>{{ entry.title }}</h2>
              <p v-if="entry.fields.now" class="lp-who">{{ entry.fields.now }}</p>
              <p v-if="entry.summary">{{ entry.summary }}</p>
            </div>
          </article>
        </div>

        <nav v-if="!whole && pages > 1" class="s-pager" aria-label="Halaman">
          <button type="button" class="s-btn s-btn--line s-btn--sm" :disabled="current <= 1" @click="goTo(current - 1)">Sebelumnya</button>
          <span>Halaman {{ current }} dari {{ pages }}</span>
          <button type="button" class="s-btn s-btn--line s-btn--sm" :disabled="current >= pages" @click="goTo(current + 1)">Berikutnya</button>
        </nav>

        <p v-if="type === 'agenda'" class="lp-note"><CalendarDays :size="16" aria-hidden="true" /> Agenda yang sudah lewat tidak ditampilkan.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lp-grid { display: grid; gap: 20px; }
.lp-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.lp-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.lp-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.lp-skeleton { min-height: 340px; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.lp-agenda { display: grid; gap: 12px; }
.lp-ag { display: flex; gap: 22px; padding: 22px 26px; border: 1px solid var(--ab-line); border-radius: 22px; background: #fff; }
.lp-ag-date { display: grid; width: 74px; height: 78px; flex: none; place-content: center; border-radius: 16px; background: var(--ab-ink); color: #fff; line-height: 1; text-align: center; }
.lp-ag-date b { display: block; font-family: var(--ab-display); font-size: 26px; font-weight: 800; }
.lp-ag-date span { display: block; margin-top: 4px; color: rgba(255, 255, 255, .7); font-size: 12px; font-weight: 700; }
.lp-ag h2 { margin: 6px 0 0; font-size: 20px; font-weight: 800; letter-spacing: -.015em; line-height: 1.3; }
.lp-ag p { margin: 6px 0 0; color: var(--ab-ink-2); font-size: 15.5px; }
.lp-tag { color: var(--acc); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.lp-note { display: flex; align-items: center; gap: 8px; margin: 24px 0 0; color: var(--ab-mute); font-size: 14px; font-weight: 600; }

.lp-gal { display: grid; grid-auto-rows: 220px; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.lp-gal-item { position: relative; overflow: hidden; padding: 0; border-radius: 20px; cursor: zoom-in; }
.lp-gal-item:nth-child(6n + 1) { grid-row: span 2; grid-column: span 2; }
.lp-gal-item img { width: 100%; height: 100%; object-fit: cover; }

.lp-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 22px; background: #fff; }
.lp-card--link { transition: border-color .15s; }
.lp-card--link:hover { border-color: var(--ab-line-strong); }
.lp-card-photo { height: 220px; flex: none; }
.lp-card-photo--tall { height: 300px; }
.lp-card-body { display: flex; flex: 1; flex-direction: column; padding: 20px 22px 24px; }
.lp-card h2 { margin: 10px 0 0; font-size: 19px; font-weight: 800; letter-spacing: -.015em; line-height: 1.3; }
.lp-card p { margin: 8px 0 0; color: var(--ab-ink-2); font-size: 15px; }
.lp-card .lp-who { color: var(--ab-ink); font-weight: 700; }
.lp-date { margin-top: auto; padding-top: 14px; color: var(--ab-mute); font-size: 13.5px; font-weight: 700; }
.lp-read { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 18px; font-size: 14px; font-weight: 700; }
.lp-medal { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 8px; background: var(--acc); color: #fff; }

.lp-fac { overflow: hidden; border: 1px solid var(--ab-line); border-radius: 24px; background: #fff; }
.lp-fac-photo { height: 320px; }
.lp-fac-body { padding: 22px 26px 26px; }
.lp-fac h2 { margin: 4px 0 0; font-family: var(--ab-display); font-size: 26px; font-weight: 800; letter-spacing: -.03em; }
.lp-fac p { margin: 8px 0 0; color: var(--ab-ink-2); font-size: 15.5px; }

.lp-person h2 { margin: 14px 0 0; font-size: 17px; font-weight: 800; line-height: 1.3; }
.lp-person p { margin: 4px 0 0; color: var(--ab-mute); font-size: 14px; font-weight: 600; }
.lp-person-photo { overflow: hidden; border-radius: 20px; aspect-ratio: 4 / 5; }

.lp-docs { display: grid; gap: 12px; }
.lp-doc { display: flex; align-items: center; gap: 20px; padding: 20px 24px; border: 1px solid var(--ab-line); border-radius: 22px; background: #fff; }
.lp-doc-icon { display: grid; width: 54px; height: 54px; flex: none; place-items: center; border-radius: 15px; background: var(--ab-paper); color: var(--acc); }
.lp-doc-text { min-width: 0; flex: 1; }
.lp-doc h2 { margin: 4px 0 0; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
.lp-doc p { margin: 4px 0 0; color: var(--ab-ink-2); font-size: 14.5px; }
.lp-doc-none { flex: none; color: var(--ab-mute); font-size: 14px; font-weight: 600; }

.lp-eks { min-height: 380px; }
.lp-tile-title { margin: 0; font-family: var(--ab-display); font-size: 30px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.lp-faq { max-width: 860px; }

@media (max-width: 1100px) {
  .lp-grid--4 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lp-gal { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 960px) {
  .lp-grid--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .lp-grid { gap: 14px; }
  .lp-grid--2, .lp-grid--3 { grid-template-columns: minmax(0, 1fr); }
  .lp-grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
  .lp-skeleton { min-height: 220px; }
  .lp-ag { gap: 14px; padding: 16px; border-radius: 18px; }
  .lp-ag-date { width: 60px; height: 64px; border-radius: 14px; }
  .lp-ag-date b { font-size: 21px; }
  .lp-ag h2 { font-size: 16.5px; }
  .lp-ag p { font-size: 14.5px; }
  .lp-gal { grid-auto-rows: 150px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .lp-gal-item { border-radius: 16px; }
  .lp-gal-item:nth-child(6n + 1) { grid-row: span 1; }
  .lp-card { border-radius: 18px; }
  .lp-card-photo { height: 200px; }
  .lp-card-photo--tall { height: 260px; }
  .lp-card-body { padding: 16px 18px 20px; }
  .lp-card h2 { font-size: 17px; }
  .lp-fac { border-radius: 20px; }
  .lp-fac-photo { height: 220px; }
  .lp-fac-body { padding: 16px 18px 20px; }
  .lp-fac h2 { font-size: 22px; }
  .lp-person h2 { margin-top: 10px; font-size: 15px; }
  .lp-person p { font-size: 13px; }
  .lp-person-photo { border-radius: 16px; }
  .lp-doc { flex-wrap: wrap; gap: 14px; padding: 16px; border-radius: 18px; }
  .lp-doc-icon { width: 46px; height: 46px; }
  .lp-doc-text { flex-basis: calc(100% - 60px); }
  .lp-doc h2 { font-size: 16px; }
  .lp-doc .s-btn { width: 100%; }
  .lp-eks { min-height: 260px; }
  .lp-tile-title { font-size: 23px; }
}
</style>
