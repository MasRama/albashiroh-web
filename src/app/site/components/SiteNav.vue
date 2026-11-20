<script setup lang="ts">
import { ArrowLeft, ChevronDown, Menu, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BrandMark from '../../brand/BrandMark.vue';
import { sitePage, siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';
import { LOGO } from '../site';

/**
 * The floating white navbar: the portal's mark, its pages (two of them open
 * a short menu), the SMP/SMA switch on the Yayasan site or the way back to it
 * on a school's, and the orange PPDB button. Phones get a menu sheet.
 */
const props = defineProps<{ portal: SitePortal }>();
const route = useRoute();

interface Link {
  key: string;
  label?: string;
}
interface Item {
  label: string;
  links: Link[];
}

const NAV: Record<SitePortal, Item[]> = {
  yayasan: [
    { label: 'Profil', links: [{ key: 'profil', label: 'Profil yayasan' }, { key: 'takhosus' }, { key: 'keasramaan' }, { key: 'fasilitas' }, { key: 'guru' }] },
    { label: 'Informasi', links: [{ key: 'berita' }, { key: 'agenda' }, { key: 'galeri' }, { key: 'prestasi' }] },
    { label: 'Dokumen', links: [{ key: 'dokumen' }] },
    { label: 'Kontak', links: [{ key: 'kontak' }] },
  ],
  smp: [],
  sma: [],
};
for (const school of ['smp', 'sma'] as const) {
  NAV[school] = [
    { label: 'Beranda', links: [{ key: 'home' }] },
    { label: 'Profil', links: [{ key: 'profil', label: 'Profil sekolah' }, { key: 'guru' }, { key: 'fasilitas' }, { key: 'kontak' }] },
    { label: 'Akademik', links: [{ key: 'akademik', label: 'Info akademik' }, { key: 'agenda' }, { key: 'berita' }, { key: 'galeri' }, { key: 'dokumen' }] },
    { label: 'Ekstrakurikuler', links: [{ key: 'ekskul' }] },
    { label: 'Prestasi', links: [{ key: 'prestasi' }] },
    ...(school === 'sma' ? [{ label: 'Alumni', links: [{ key: 'alumni' }] }] : []),
    { label: 'Q&A', links: [{ key: 'faq' }] },
  ];
}

const items = computed(() =>
  NAV[props.portal].map((item) => ({
    ...item,
    links: item.links.map((link) => ({
      name: siteRouteName(props.portal, link.key),
      detail: siteRouteName(props.portal, link.key, true),
      label: link.label ?? sitePage(props.portal, link.key)?.label ?? link.key,
    })),
  })),
);
const isOn = (link: { name: string; detail: string }) => route.name === link.name || route.name === link.detail;

const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
const ppdb = computed(() => ({ name: siteRouteName('yayasan', 'ppdb'), query: props.portal === 'yayasan' ? {} : { jenjang: props.portal } }));

// One open menu at a time; any click outside, Escape, or a page change closes it.
const openMenu = ref<string | null>(null);
const sheet = ref(false);
const root = ref<HTMLElement>();
function closeAll(): void {
  openMenu.value = null;
  sheet.value = false;
}
watch(() => route.fullPath, closeAll);
const onDocument = (event: MouseEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) closeAll();
};
const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && (openMenu.value || sheet.value)) closeAll();
};
onMounted(() => {
  document.addEventListener('click', onDocument);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocument);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <header ref="root" class="sn" :class="`sn--${portal}`">
    <div class="sn-wrap">
      <div class="sn-bar">
        <RouterLink :to="{ name: siteRouteName(portal, 'home') }" class="sn-brand" :aria-label="`${names.name}, beranda`">
          <BrandMark v-if="portal === 'yayasan'" />
          <template v-else>
            <span class="sn-logo"><img :src="LOGO[portal]" alt="" width="40" height="40" /></span>
            <span class="sn-name"><b>{{ names.short }}</b><small>Turen · Yayasan Bashiroh Robbaniyah</small></span>
          </template>
        </RouterLink>

        <nav class="sn-links" aria-label="Menu utama">
          <template v-for="item in items" :key="item.label">
            <RouterLink v-if="item.links.length === 1" :to="{ name: item.links[0]!.name }" class="sn-link" :class="{ on: isOn(item.links[0]!) }">
              {{ item.label }}
            </RouterLink>
            <div v-else class="sn-drop">
              <button
                type="button"
                class="sn-link"
                :class="{ on: item.links.some(isOn) }"
                :aria-expanded="openMenu === item.label"
                @click.stop="openMenu = openMenu === item.label ? null : item.label"
              >
                {{ item.label }}<ChevronDown :size="14" :stroke-width="2.4" aria-hidden="true" />
              </button>
              <div v-if="openMenu === item.label" class="sn-menu">
                <RouterLink v-for="link in item.links" :key="link.name" :to="{ name: link.name }" :class="{ on: isOn(link) }">{{ link.label }}</RouterLink>
              </div>
            </div>
          </template>
        </nav>

        <div v-if="portal === 'yayasan'" class="sn-seg" role="group" aria-label="Portal sekolah">
          <RouterLink :to="{ name: siteRouteName('smp', 'home') }" class="sn-seg-smp">SMP</RouterLink>
          <RouterLink :to="{ name: siteRouteName('sma', 'home') }" class="sn-seg-sma">SMA</RouterLink>
        </div>
        <RouterLink v-else :to="{ name: 'home' }" class="sn-back"><ArrowLeft :size="14" :stroke-width="2.4" aria-hidden="true" />Yayasan</RouterLink>

        <RouterLink :to="ppdb" class="sn-ppdb">Daftar PPDB</RouterLink>
        <button type="button" class="sn-burger" :aria-expanded="sheet" aria-controls="site-menu" :aria-label="sheet ? 'Tutup menu' : 'Buka menu'" @click.stop="sheet = !sheet">
          <X v-if="sheet" :size="20" aria-hidden="true" />
          <Menu v-else :size="20" aria-hidden="true" />
        </button>
      </div>

      <div v-if="sheet" id="site-menu" class="sn-sheet">
        <div v-for="item in items" :key="item.label" class="sn-group">
          <p v-if="item.links.length > 1" class="sn-group-label">{{ item.label }}</p>
          <RouterLink v-for="link in item.links" :key="link.name" :to="{ name: link.name }" :class="{ on: isOn(link) }">
            {{ item.links.length > 1 ? link.label : item.label }}
          </RouterLink>
        </div>
        <div class="sn-sheet-foot">
          <template v-if="portal === 'yayasan'">
            <RouterLink :to="{ name: siteRouteName('smp', 'home') }" class="sn-portal sn-portal--smp">Portal SMP</RouterLink>
            <RouterLink :to="{ name: siteRouteName('sma', 'home') }" class="sn-portal sn-portal--sma">Portal SMA</RouterLink>
          </template>
          <RouterLink v-else :to="{ name: 'home' }" class="sn-portal">Situs Yayasan</RouterLink>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.sn { position: absolute; top: 20px; right: 0; left: 0; z-index: 20; }
.sn-wrap { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
.sn-bar {
  display: flex;
  height: 70px;
  align-items: center;
  gap: 18px;
  padding: 0 12px 0 22px;
  border: 1px solid rgba(19, 33, 26, .08);
  border-radius: 20px;
  background: rgba(255, 255, 255, .96);
  box-shadow: var(--ab-shadow-pop);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.sn-brand { display: flex; min-width: 0; align-items: center; gap: 12px; }
.sn-logo { display: grid; flex: none; width: 40px; height: 40px; place-items: center; padding: 6px; border-radius: 11px; background: #FFF1E6; }
.sn--smp .sn-logo { background: var(--ab-green-soft); }
.sn-logo img { width: 100%; height: 100%; object-fit: contain; }
.sn-name { min-width: 0; }
.sn-name b { display: block; font-family: var(--ab-display); font-size: 19px; font-weight: 800; letter-spacing: -.03em; line-height: 1; white-space: nowrap; }
.sn-name small { display: block; margin-top: 3px; color: var(--ab-mute); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.sn-links { display: flex; gap: 2px; margin-left: auto; }
.sn-link { display: flex; align-items: center; gap: 4px; padding: 9px 12px; border-radius: 10px; color: var(--ab-ink-2); font-size: 14.5px; font-weight: 600; white-space: nowrap; }
.sn-link:hover, .sn-link.on, .sn-link[aria-expanded='true'] { background: var(--ab-paper-2); color: var(--ab-ink); }
.sn-drop { position: relative; }
.sn-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  display: grid;
  min-width: 220px;
  padding: 8px;
  border: 1px solid var(--ab-line);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--ab-shadow-pop);
}
.sn-menu a { padding: 10px 12px; border-radius: 10px; color: var(--ab-ink-2); font-size: 14.5px; font-weight: 600; }
.sn-menu a:hover, .sn-menu a.on { background: var(--ab-paper-2); color: var(--ab-ink); }
.sn-seg { display: flex; gap: 2px; padding: 4px; border-radius: 12px; background: var(--ab-paper-2); }
.sn-seg a { display: grid; height: 34px; place-items: center; padding: 0 12px; border-radius: 9px; font-size: 13.5px; font-weight: 800; }
.sn-seg a:hover { background: #fff; }
.sn-seg-smp { color: var(--ab-smp); }
.sn-seg-sma { color: var(--ab-sma); }
.sn-back { display: flex; align-items: center; gap: 6px; padding: 9px 12px; border-radius: 10px; background: var(--ab-paper-2); color: var(--ab-mute); font-size: 13.5px; font-weight: 700; white-space: nowrap; }
.sn-back:hover { color: var(--ab-ink); }
.sn-ppdb { display: inline-flex; height: 42px; align-items: center; padding: 0 18px; border-radius: 12px; background: var(--ab-sma); color: #fff; font-size: 14px; font-weight: 700; white-space: nowrap; }
.sn-ppdb:hover { background: var(--ab-sma-deep); }
.sn-burger { display: none; width: 44px; height: 44px; flex: none; place-items: center; border-radius: 12px; background: var(--ab-paper-2); }
.sn-sheet {
  display: grid;
  max-height: calc(100dvh - 120px);
  gap: 14px;
  margin-top: 10px;
  padding: 16px;
  overflow-y: auto;
  border: 1px solid var(--ab-line);
  border-radius: 20px;
  background: #fff;
  box-shadow: var(--ab-shadow-pop);
}
.sn-group { display: grid; gap: 2px; }
.sn-group-label { margin: 4px 12px 4px; color: var(--ab-mute); font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.sn-group a { padding: 11px 12px; border-radius: 10px; font-size: 15.5px; font-weight: 700; }
.sn-group a.on { background: var(--ab-paper-2); }
.sn-sheet-foot { display: flex; gap: 8px; padding-top: 14px; border-top: 1px solid var(--ab-line); }
.sn-portal { display: grid; height: 46px; flex: 1; place-items: center; border-radius: 12px; background: var(--ab-forest); color: #fff; font-weight: 800; }
.sn-portal--smp { background: var(--ab-smp); }
.sn-portal--sma { background: var(--ab-sma); }

/* The full menu fits from about 1180px; below that, the sheet takes over. */
@media (max-width: 1179px) {
  .sn-links, .sn-seg, .sn-back { display: none; }
  .sn-ppdb { margin-left: auto; }
  .sn-burger { display: grid; }
}
@media (max-width: 640px) {
  .sn { top: 12px; }
  .sn-wrap { padding: 0 16px; }
  .sn-bar { height: 62px; gap: 8px; padding: 0 8px 0 12px; border-radius: 18px; }
  .sn-brand { gap: 8px; }
  .sn-brand :deep(.brand-text small), .sn-name small { display: none; }
  .sn-brand :deep(.brand-mark) { width: 34px; height: 34px; font-size: 13px; }
  .sn-brand :deep(.brand-text b) { font-size: 18px; }
  .sn-logo { width: 34px; height: 34px; padding: 5px; }
  .sn-name b { font-size: 15px; }
  .sn-ppdb { height: 40px; padding: 0 12px; font-size: 13px; }
  .sn-burger { width: 40px; height: 40px; }
}
</style>
