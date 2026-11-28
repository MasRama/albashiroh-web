<script setup lang="ts">
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { SitePortalData } from '../../../features/content/web';
import BrandMark from '../../brand/BrandMark.vue';
import { sitePage, siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';
import { LOGO, mapEmbed, mapLink, whatsappLink } from '../site';

/** The dark footer: contact details, the portal's pages, its map, and the way to the other portals. */
const props = defineProps<{ portal: SitePortal; data: SitePortalData | null }>();

const contact = computed(() => props.data?.settings.contact);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
const year = new Date().getFullYear();

const COLUMNS: Record<SitePortal, { title: string; keys: string[] }[]> = {
  yayasan: [
    { title: 'Yayasan', keys: ['profil', 'takhosus', 'keasramaan', 'fasilitas', 'guru'] },
    { title: 'Informasi', keys: ['berita', 'galeri', 'prestasi', 'ppdb', 'dokumen'] },
  ],
  smp: [
    { title: 'Sekolah', keys: ['profil', 'akademik', 'ekskul', 'guru', 'fasilitas'] },
    { title: 'Informasi', keys: ['berita', 'agenda', 'galeri', 'prestasi', 'faq', 'dokumen'] },
  ],
  sma: [
    { title: 'Sekolah', keys: ['profil', 'akademik', 'ekskul', 'guru', 'fasilitas', 'alumni'] },
    { title: 'Informasi', keys: ['berita', 'agenda', 'galeri', 'prestasi', 'faq', 'dokumen'] },
  ],
};
const columns = computed(() =>
  COLUMNS[props.portal].map((column) => ({
    title: column.title,
    links: column.keys.map((key) => {
      const page = sitePage(props.portal, key) ?? sitePage('yayasan', key);
      const portal = sitePage(props.portal, key) ? props.portal : 'yayasan';
      return { name: siteRouteName(portal, key), label: page?.label ?? key };
    }),
  })),
);

const socials = computed(() => {
  const value = contact.value;
  if (!value) return [];
  return (
    [
      ['Instagram', value.instagram],
      ['Facebook', value.facebook],
      ['YouTube', value.youtube],
      ['TikTok', value.tiktok],
    ] as const
  ).filter(([, href]) => /^https?:\/\//i.test(href));
});
const whatsapp = computed(() => (contact.value?.whatsapp ? whatsappLink(contact.value.whatsapp) : null));
const mapQuery = computed(() => contact.value?.mapQuery || '');
const others = computed(() => (['yayasan', 'smp', 'sma'] as const).filter((portal) => portal !== props.portal));
</script>

<template>
  <footer class="sf">
    <div class="sf-wrap">
      <div class="sf-grid">
        <div class="sf-about">
          <RouterLink :to="{ name: siteRouteName(portal, 'home') }" class="sf-brand">
            <BrandMark v-if="portal === 'yayasan'" tone="light" />
            <span v-else class="sf-school">
              <span class="sf-logo"><img :src="LOGO[portal]" alt="" width="40" height="40" loading="lazy" /></span>
              <span><b>{{ names.short }}</b><small>Turen, Malang</small></span>
            </span>
          </RouterLink>
          <ul v-if="contact" class="sf-contact">
            <li v-if="contact.address || contact.area">
              <MapPin :size="18" aria-hidden="true" />
              <span>{{ contact.address }}<template v-if="contact.address && contact.area"><br /></template>{{ contact.area }}</span>
            </li>
            <li v-if="contact.phone"><Phone :size="18" aria-hidden="true" /><a :href="`tel:${contact.phone.replace(/[^\d+]/g, '')}`">{{ contact.phone }}</a></li>
            <li v-if="whatsapp"><MessageCircle :size="18" aria-hidden="true" /><a :href="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp {{ contact.whatsapp }}</a></li>
            <li v-if="contact.email"><Mail :size="18" aria-hidden="true" /><a :href="`mailto:${contact.email}`">{{ contact.email }}</a></li>
          </ul>
          <div v-if="socials.length" class="sf-socials">
            <a v-for="[label, href] in socials" :key="label" :href="href" target="_blank" rel="noopener noreferrer">{{ label }}</a>
          </div>
        </div>

        <div v-for="column in columns" :key="column.title">
          <p class="sf-title">{{ column.title }}</p>
          <ul class="sf-links">
            <li v-for="link in column.links" :key="link.name"><RouterLink :to="{ name: link.name }">{{ link.label }}</RouterLink></li>
          </ul>
        </div>

        <div class="sf-place">
          <p class="sf-title">Lokasi</p>
          <div v-if="mapQuery" class="sf-map">
            <iframe :src="mapEmbed(mapQuery)" :title="`Peta lokasi ${names.name}`" loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
          </div>
          <a v-if="mapQuery" :href="mapLink(mapQuery)" target="_blank" rel="noopener noreferrer" class="sf-maplink">Buka di Google Maps<ArrowUpRight :size="15" aria-hidden="true" /></a>
          <ul class="sf-links sf-portals">
            <li v-for="other in others" :key="other">
              <RouterLink :to="{ name: siteRouteName(other, 'home') }">{{ other === 'yayasan' ? 'Situs Yayasan' : `Portal ${SITE_PORTAL_NAMES[other].short.split(' ')[0]} IT` }} →</RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <div class="sf-bottom">
        <span>© {{ year }} {{ names.name }}</span>
        <span>albashiroh.sch.id</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.sf { margin-top: 110px; padding: 72px 0 36px; background: var(--ab-ink); color: #fff; }
.sf-wrap { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
.sf-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1.25fr; gap: 40px; }
.sf-brand { display: inline-flex; }
.sf-brand :deep(.brand-text small) { color: rgba(255, 255, 255, .6); }
.sf-school { display: flex; align-items: center; gap: 12px; }
.sf-school b { display: block; font-family: var(--ab-display); font-size: 19px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.sf-school small { display: block; margin-top: 3px; color: rgba(255, 255, 255, .6); font-size: 11.5px; font-weight: 600; }
.sf-logo { display: grid; width: 40px; height: 40px; place-items: center; padding: 6px; border-radius: 11px; background: #fff; }
.sf-logo img { width: 100%; height: 100%; object-fit: contain; }
.sf-contact { display: grid; gap: 4px; margin: 24px 0 0; padding: 0; list-style: none; }
.sf-contact li { display: flex; gap: 12px; padding: 6px 0; color: rgba(255, 255, 255, .86); font-size: 15px; }
.sf-contact svg { flex: none; margin-top: 3px; color: var(--ab-sun); }
.sf-contact a:hover { color: #fff; text-decoration: underline; }
.sf-socials { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
.sf-socials a { padding: 9px 14px; border-radius: 12px; background: rgba(255, 255, 255, .1); font-size: 14px; font-weight: 700; }
.sf-socials a:hover { background: rgba(255, 255, 255, .18); }
.sf-title { margin: 0 0 16px; color: rgba(255, 255, 255, .5); font-size: 12.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.sf-links { margin: 0; padding: 0; list-style: none; }
.sf-links a { display: block; padding: 5px 0; color: rgba(255, 255, 255, .86); font-size: 15px; font-weight: 600; }
.sf-links a:hover { color: #fff; }
.sf-map { height: 190px; overflow: hidden; border-radius: 20px; background: #1E2E26; }
.sf-map iframe { display: block; width: 100%; height: 100%; border: 0; }
.sf-maplink { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--ab-sun); font-size: 14px; font-weight: 700; }
.sf-portals { margin-top: 14px; }
.sf-portals a { color: #fff; }
.sf-bottom { display: flex; justify-content: space-between; gap: 12px; margin-top: 56px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, .12); color: rgba(255, 255, 255, .55); font-size: 14px; }
@media (max-width: 960px) {
  .sf-grid { grid-template-columns: 1fr 1fr; gap: 32px 24px; }
  .sf-about, .sf-place { grid-column: span 2; }
}
@media (max-width: 640px) {
  .sf { margin-top: 64px; padding: 48px 0 28px; }
  .sf-wrap { padding: 0 16px; }
  .sf-grid { gap: 30px 20px; }
  .sf-bottom { flex-direction: column; gap: 6px; margin-top: 36px; }
}
</style>
