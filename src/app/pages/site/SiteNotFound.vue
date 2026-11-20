<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { portalOfPath, siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';
import { useTitle } from '../../site/site';

/** An address the site does not have, inside the site's own frame, with the ways back. */
const props = defineProps<{ portal?: SitePortal }>();
const route = useRoute();
// The catch-all route knows no portal; an address under /smp or /sma still belongs to that school.
const portal = computed<SitePortal>(() => props.portal ?? portalOfPath(route.path));
useTitle(() => `Halaman tidak ditemukan | ${SITE_PORTAL_NAMES[portal.value].short}`);
</script>

<template>
  <section class="s-pagehead" data-testid="not-found-page">
    <div class="s-wrap">
      <div class="s-pagehead-box nf">
        <p class="nf-code" aria-hidden="true">404</p>
        <h1>Halaman tidak ditemukan.</h1>
        <p>Alamatnya mungkin salah ketik, atau halamannya sudah dipindah.</p>
        <div class="nf-go">
          <RouterLink :to="{ name: siteRouteName(portal, 'home') }" class="s-btn s-btn--or">Ke beranda <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
          <RouterLink :to="{ name: siteRouteName(portal, 'berita') }" class="s-btn s-btn--ghost">Berita terbaru</RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nf-code { margin: 0; color: var(--ab-sun); font-family: var(--ab-display); font-size: 120px; font-weight: 800; letter-spacing: -.06em; line-height: .85; }
.nf h1 { margin-top: 22px; }
.nf-go { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
@media (max-width: 640px) {
  .nf-code { font-size: 88px; }
  .nf-go { flex-direction: column; }
}
</style>
