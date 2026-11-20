<script setup lang="ts">
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-vue-next';
import { computed } from 'vue';
import PageHead from '../../site/components/PageHead.vue';
import { mapEmbed, mapLink, pageTitle, usePortal, useTitle, whatsappLink } from '../../site/site';
import { siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';

/** How to reach a portal: address, phone, WhatsApp and email as cards, and the map. */
const props = defineProps<{ portal: SitePortal }>();
const data = usePortal(() => props.portal);
const contact = computed(() => data.value?.settings.contact);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
useTitle(() => pageTitle(props.portal, 'Kontak'));

const whatsapp = computed(() => (contact.value?.whatsapp ? whatsappLink(contact.value.whatsapp, `Assalamualaikum, saya ingin bertanya tentang ${names.value.name}.`) : null));
const mapQuery = computed(() => contact.value?.mapQuery || [contact.value?.address, contact.value?.area].filter(Boolean).join(', '));
const socials = computed(() => {
  const value = contact.value;
  if (!value) return [];
  return ([['Instagram', value.instagram], ['Facebook', value.facebook], ['YouTube', value.youtube], ['TikTok', value.tiktok]] as const).filter(([, href]) => /^https?:\/\//i.test(href));
});
const hasAny = computed(() => Boolean(contact.value && (contact.value.address || contact.value.phone || contact.value.whatsapp || contact.value.email)));
</script>

<template>
  <div class="kp">
    <PageHead kicker="Kontak" :title="`Hubungi ${names.short}.`" intro="Datang langsung, telepon, atau kirim pesan WhatsApp. Kami senang membantu." :crumbs="[{ label: 'Beranda', to: { name: siteRouteName(portal, 'home') } }]" />

    <section class="s-body">
      <div class="s-wrap">
        <div v-if="data === null" class="s-skeleton kp-skeleton" />
        <div v-else-if="!hasAny" class="s-empty"><b>Kontak sedang disiapkan.</b><span>Alamat dan nomor telepon akan tampil di sini.</span></div>
        <div v-else class="kp-grid">
          <div class="kp-cards">
            <div v-if="contact?.address || contact?.area" class="kp-card kp-card--wide">
              <span class="kp-icon" aria-hidden="true"><MapPin :size="22" /></span>
              <div><small>Alamat</small><p>{{ contact.address }}<template v-if="contact.address && contact.area"><br /></template>{{ contact.area }}</p></div>
            </div>
            <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="kp-card kp-card--wa">
              <span class="kp-icon" aria-hidden="true"><MessageCircle :size="22" /></span>
              <div><small>WhatsApp</small><p>{{ contact?.whatsapp }}</p></div>
            </a>
            <a v-if="contact?.phone" :href="`tel:${contact.phone.replace(/[^\d+]/g, '')}`" class="kp-card">
              <span class="kp-icon" aria-hidden="true"><Phone :size="22" /></span>
              <div><small>Telepon</small><p>{{ contact.phone }}</p></div>
            </a>
            <a v-if="contact?.email" :href="`mailto:${contact.email}`" class="kp-card">
              <span class="kp-icon" aria-hidden="true"><Mail :size="22" /></span>
              <div><small>Email</small><p>{{ contact.email }}</p></div>
            </a>
            <div v-if="socials.length" class="kp-socials">
              <a v-for="[label, href] in socials" :key="label" :href="href" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--line s-btn--sm">{{ label }} <ArrowUpRight :size="15" aria-hidden="true" /></a>
            </div>
          </div>
          <div v-if="mapQuery" class="kp-map">
            <iframe :src="mapEmbed(mapQuery)" :title="`Peta lokasi ${names.name}`" loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
            <a :href="mapLink(mapQuery)" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--wh s-btn--sm kp-maplink">Buka di Google Maps <ArrowUpRight :size="15" aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kp-skeleton { height: 420px; }
.kp-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 24px; }
.kp-cards { display: grid; align-content: start; grid-template-columns: 1fr 1fr; gap: 14px; }
.kp-card { display: flex; gap: 16px; padding: 22px; border: 1px solid var(--ab-line); border-radius: 22px; background: #fff; }
a.kp-card:hover { border-color: var(--ab-line-strong); }
.kp-card--wide { grid-column: span 2; }
.kp-card--wa { grid-column: span 2; border-color: transparent; background: var(--acc); color: #fff; }
a.kp-card--wa:hover { border-color: transparent; background: var(--acc-deep); }
.kp-icon { display: grid; width: 46px; height: 46px; flex: none; place-items: center; border-radius: 14px; background: var(--ab-paper); color: var(--acc); }
.kp-card--wa .kp-icon { background: rgba(255, 255, 255, .18); color: #fff; }
.kp-card small { display: block; color: var(--ab-mute); font-size: 12.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.kp-card--wa small { color: rgba(255, 255, 255, .8); }
.kp-card p { margin: 4px 0 0; font-size: 17px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.kp-socials { display: flex; flex-wrap: wrap; grid-column: span 2; gap: 10px; margin-top: 6px; }
.kp-map { position: relative; min-height: 480px; overflow: hidden; border-radius: 28px; background: var(--ab-paper-2); }
.kp-map iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.kp-maplink { position: absolute; bottom: 18px; left: 18px; }
@media (max-width: 960px) {
  .kp-grid { grid-template-columns: minmax(0, 1fr); }
  .kp-map { min-height: 380px; }
}
@media (max-width: 640px) {
  .kp-cards { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .kp-card--wide, .kp-card--wa, .kp-socials { grid-column: auto; }
  .kp-card { padding: 18px; border-radius: 18px; }
  .kp-card p { font-size: 16px; }
  .kp-map { min-height: 320px; border-radius: 22px; }
}
</style>
