<script setup lang="ts">
import { ArrowRight, Download, FileText, MessageCircle } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import FaqList from '../../site/components/FaqList.vue';
import PageHead from '../../site/components/PageHead.vue';
import { LOGO, pageTitle, useEntries, usePortal, useTitle, whatsappLink } from '../../site/site';
import { siteRouteName, SITE_PORTAL_NAMES } from '../../site-map';

/**
 * PPDB: one page for both schools, with the level picked in `?jenjang=`.
 * Each level shows its own introduction, registration flow, brochure and
 * WhatsApp, falling back to the Yayasan's where the school wrote none.
 */
type Level = 'smp' | 'sma';
const route = useRoute();
const router = useRouter();
const level = computed<Level>(() => (route.query.jenjang === 'sma' ? 'sma' : 'smp'));
useTitle(() => pageTitle('yayasan', 'PPDB'));

const yayasan = usePortal(() => 'yayasan');
const school = usePortal(() => level.value);
const faq = useEntries(() => ({ portal: 'yayasan', type: 'faq', query: { limit: 8 } }));

function pick(next: Level) {
  if (next !== level.value) void router.replace({ query: { ...route.query, jenjang: next } });
}

const own = computed(() => school.value?.settings.ppdb);
const base = computed(() => yayasan.value?.settings.ppdb);
const intro = computed(() => own.value?.intro || base.value?.intro || `Penerimaan peserta didik baru ${SITE_PORTAL_NAMES[level.value].name}. Pilih jenjang, pelajari alurnya, lalu daftar.`);
const flow = computed(() => own.value?.flow || base.value?.flow || '');
const brochure = computed(() => {
  if (own.value?.brochureFileId) return school.value?.files[own.value.brochureFileId] ?? null;
  if (base.value?.brochureFileId) return yayasan.value?.files[base.value.brochureFileId] ?? null;
  return null;
});
const whatsapp = computed(() => {
  const number = school.value?.settings.contact.whatsapp || yayasan.value?.settings.contact.whatsapp;
  return number ? whatsappLink(number, `Assalamualaikum, saya ingin bertanya tentang PPDB ${SITE_PORTAL_NAMES[level.value].name}.`) : null;
});
const loading = computed(() => yayasan.value === null || school.value === null);
</script>

<template>
  <div class="pd">
    <PageHead kicker="PPDB Al Bashiroh" title="Penerimaan peserta didik baru." :intro="intro" :crumbs="[{ label: 'Beranda', to: { name: 'home' } }]">
      <div class="pd-levels" role="tablist" aria-label="Pilih jenjang">
        <button
          v-for="option in (['smp', 'sma'] as const)"
          :key="option"
          type="button"
          role="tab"
          class="pd-level"
          :class="[`pd-level--${option}`, { 'pd-level--on': level === option }]"
          :aria-selected="level === option"
          aria-controls="ppdb-isi"
          @click="pick(option)"
        >
          <span class="pd-level-logo"><img :src="LOGO[option]" alt="" width="40" height="40" /></span>
          <span><b>{{ option.toUpperCase() }} IT</b><small>Al Bashiroh Turen</small></span>
        </button>
      </div>
    </PageHead>

    <section id="ppdb-isi" class="s-body" role="tabpanel">
      <div class="s-wrap">
        <div class="pd-grid">
          <div class="pd-main">
            <div v-if="loading" class="s-skeleton pd-skeleton" />
            <article v-else-if="flow" class="s-card">
              <div class="s-kick">Alur pendaftaran {{ level.toUpperCase() }}</div>
              <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
              <div class="ab-prose pd-flow" v-html="flow" />
            </article>
            <div v-else class="s-empty"><b>Alur pendaftaran segera diumumkan.</b><span>Tanyakan jadwal dan syaratnya kepada panitia lewat WhatsApp.</span></div>
          </div>

          <aside class="pd-side">
            <div id="formulir" class="pd-form">
              <div class="s-kick">Formulir online</div>
              <h2>Daftar ke {{ level.toUpperCase() }} IT Al Bashiroh.</h2>
              <p>Formulir pendaftaran online dibuka di halaman ini. Sementara itu, panitia siap membantu lewat WhatsApp.</p>
              <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--wh">
                <MessageCircle :size="18" aria-hidden="true" /> Tanya panitia PPDB
              </a>
            </div>
            <a v-if="brochure" :href="brochure.url" :download="brochure.name" class="pd-file">
              <span class="pd-file-icon" aria-hidden="true"><FileText :size="22" /></span>
              <span><b>Brosur PPDB</b><small>{{ brochure.name }}</small></span>
              <Download :size="18" aria-hidden="true" class="pd-file-go" />
            </a>
            <RouterLink :to="{ name: siteRouteName(level, 'home') }" class="pd-file">
              <span class="pd-file-icon" aria-hidden="true"><img :src="LOGO[level]" alt="" width="26" height="26" /></span>
              <span><b>Kenali {{ level.toUpperCase() }} IT</b><small>Akademik, ekskul, dan prestasi</small></span>
              <ArrowRight :size="18" aria-hidden="true" class="pd-file-go" />
            </RouterLink>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="faq.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="pd-faq">
          <div><div class="s-kick">Q&amp;A</div><h2 class="s-h2">Pertanyaan seputar PPDB.</h2></div>
          <FaqList :items="faq.page.value.items" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pd-levels { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.pd-level { display: flex; min-width: 230px; align-items: center; gap: 14px; padding: 14px 18px 14px 14px; border: 2px solid rgba(255, 255, 255, .25); border-radius: 18px; color: #fff; text-align: left; }
.pd-level:hover { border-color: rgba(255, 255, 255, .6); }
.pd-level--on { border-color: #fff; background: #fff; color: var(--ab-ink); }
.pd-level-logo { display: grid; width: 44px; height: 44px; flex: none; place-items: center; padding: 6px; border-radius: 12px; background: #fff; }
.pd-level-logo img { width: 100%; height: 100%; object-fit: contain; }
.pd-level--on .pd-level-logo { background: var(--ab-paper); }
.pd-level b { display: block; font-family: var(--ab-display); font-size: 20px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
.pd-level small { font-size: 13px; font-weight: 600; opacity: .75; }

.pd-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); align-items: start; gap: 24px; }
.pd-skeleton { height: 420px; }
.pd-flow { margin-top: 16px; font-size: 17px; }
.pd-side { display: grid; gap: 14px; }
.pd-form { padding: 32px; border-radius: 28px; background: var(--ab-sma); color: #fff; }
.pd-form .s-kick { color: #fff; opacity: .85; }
.pd-form h2 { margin: 12px 0 0; font-family: var(--ab-display); font-size: 32px; font-weight: 800; letter-spacing: -.03em; line-height: 1.02; }
.pd-form p { margin: 12px 0 22px; font-size: 15.5px; opacity: .92; }
.pd-file { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid var(--ab-line); border-radius: 20px; background: #fff; }
.pd-file:hover { border-color: var(--ab-line-strong); }
.pd-file-icon { display: grid; width: 46px; height: 46px; flex: none; place-items: center; border-radius: 14px; background: var(--ab-paper); color: var(--ab-sma); }
.pd-file b { display: block; font-size: 16px; font-weight: 800; }
.pd-file small { display: block; color: var(--ab-mute); font-size: 13.5px; overflow-wrap: anywhere; }
.pd-file-go { flex: none; margin-left: auto; }
.pd-faq { display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; }
@media (max-width: 960px) {
  .pd-grid, .pd-faq { grid-template-columns: minmax(0, 1fr); }
  .pd-faq { gap: 24px; }
}
@media (max-width: 640px) {
  .pd-levels { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 24px; }
  .pd-level { min-width: 0; gap: 10px; padding: 10px; border-radius: 15px; }
  .pd-level-logo { width: 36px; height: 36px; padding: 5px; border-radius: 10px; }
  .pd-level b { font-size: 16px; }
  .pd-level small { display: none; }
  .pd-flow { font-size: 16px; }
  .pd-form { padding: 26px 22px; border-radius: 24px; }
  .pd-form h2 { font-size: 26px; }
  .pd-form .s-btn { width: 100%; }
}
</style>
