<script setup lang="ts">
import { ArrowDown, ArrowRight, Download, FileText, MessageCircle } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { createPpdbFormClient, type PpdbForm as PpdbFormState } from '../../../features/ppdb/web';
import FaqList from '../../site/components/FaqList.vue';
import PageHead from '../../site/components/PageHead.vue';
import PpdbForm from '../../site/components/PpdbForm.vue';
import { LOGO, pageTitle, useEntries, usePortal, useTitle, whatsappLink } from '../../site/site';
import { siteRouteName, SITE_PORTAL_NAMES } from '../../site-map';

/**
 * PPDB: one page for both schools, with the level picked in `?jenjang=`.
 * Each level shows its own introduction, registration flow, brochure and
 * WhatsApp, falling back to the Yayasan's where the school wrote none.
 * The online form sits below, open or closed as the committee set it.
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

const formClient = createPpdbFormClient();
// undefined while opening, null when the form could not be reached.
const form = ref<PpdbFormState | null | undefined>(undefined);
async function refresh(): Promise<PpdbFormState | null> {
  const result = await formClient.open();
  form.value = result.ok ? result.form : null;
  return form.value;
}
onMounted(() => void refresh());
const yearText = computed(() => (form.value?.academicYear ? ` tahun ajaran ${form.value.academicYear}` : ''));
const levelName = computed(() => SITE_PORTAL_NAMES[level.value].short);
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
            <div class="pd-form">
              <div class="s-kick">Formulir online</div>
              <h2>Daftar ke {{ levelName }}.</h2>
              <p v-if="form?.open">Pendaftaran{{ yearText }} dibuka. Isi formulir online di halaman ini, sekitar 10 menit.</p>
              <p v-else-if="form === undefined">Memeriksa formulir pendaftaran…</p>
              <p v-else>Pendaftaran online sedang ditutup. Panitia siap membantu lewat WhatsApp.</p>
              <div class="pd-form-actions">
                <a v-if="form?.open" href="#formulir" class="s-btn s-btn--wh"><ArrowDown :size="18" aria-hidden="true" /> Isi formulir</a>
                <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-btn" :class="form?.open ? 's-btn--ghost' : 's-btn--wh'">
                  <MessageCircle :size="18" aria-hidden="true" /> Tanya panitia PPDB
                </a>
              </div>
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

    <section id="formulir" class="s-sec pd-reg" :class="`site--${level}`" aria-labelledby="pd-reg-title">
      <div class="s-wrap">
        <div class="pd-reg-grid">
          <div class="pd-reg-intro">
            <div class="s-kick">Pendaftaran online</div>
            <h2 id="pd-reg-title" class="s-h2">Formulir {{ levelName }}{{ form?.academicYear ? ` ${form.academicYear}` : '' }}.</h2>
            <p>Siapkan dulu supaya cepat:</p>
            <ul>
              <li>NISN calon siswa (ada di rapor atau ijazah)</li>
              <li>Kartu Keluarga, untuk NIK ayah dan ibu</li>
              <li>Nomor HP orang tua yang aktif di WhatsApp</li>
            </ul>
            <p class="pd-reg-small">Setelah terkirim, Anda mendapat nomor pendaftaran dan langkah pembayaran infaq.</p>
          </div>
          <div class="pd-reg-body">
            <div v-if="form === undefined" class="s-skeleton pd-reg-skeleton" />
            <PpdbForm v-else-if="form?.open" :level="level" :form="form" :client="formClient" :refresh="refresh" :whatsapp="whatsapp" @level="pick" />
            <div v-else class="s-empty pd-reg-closed">
              <b>{{ form === null ? 'Formulir belum bisa dibuka.' : 'Pendaftaran online sedang ditutup.' }}</b>
              <span>{{ form === null ? 'Periksa koneksi internet lalu muat ulang halaman ini.' : 'Jadwal pendaftaran berikutnya diumumkan di halaman ini. Untuk pertanyaan, hubungi panitia.' }}</span>
              <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--ink s-btn--sm"><MessageCircle :size="16" aria-hidden="true" /> Tanya panitia PPDB</a>
            </div>
          </div>
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
.pd-form-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.pd-reg { scroll-margin-top: 90px; border-top: 1px solid var(--ab-line); }
.pd-reg-grid { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1.6fr); align-items: start; gap: 48px; }
.pd-reg-intro { position: sticky; top: 110px; }
.pd-reg-intro p { margin: 18px 0 0; color: var(--ab-ink-2); font-size: 16px; }
.pd-reg-intro ul { display: grid; gap: 10px; margin: 12px 0 0; padding: 0; list-style: none; }
.pd-reg-intro li { position: relative; padding-left: 26px; font-size: 15.5px; font-weight: 600; }
.pd-reg-intro li::before { content: ''; position: absolute; top: 7px; left: 2px; width: 10px; height: 10px; border-radius: 3px; background: var(--acc); }
.pd-reg-intro .pd-reg-small { color: var(--ab-mute); font-size: 14px; }
.pd-reg-skeleton { height: 640px; border-radius: 24px; }
.pd-reg-closed .s-btn { margin-top: 10px; }
.pd-file { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid var(--ab-line); border-radius: 20px; background: #fff; }
.pd-file:hover { border-color: var(--ab-line-strong); }
.pd-file-icon { display: grid; width: 46px; height: 46px; flex: none; place-items: center; border-radius: 14px; background: var(--ab-paper); color: var(--ab-sma); }
.pd-file b { display: block; font-size: 16px; font-weight: 800; }
.pd-file small { display: block; color: var(--ab-mute); font-size: 13.5px; overflow-wrap: anywhere; }
.pd-file-go { flex: none; margin-left: auto; }
.pd-faq { display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; }
@media (max-width: 960px) {
  .pd-grid, .pd-faq, .pd-reg-grid { grid-template-columns: minmax(0, 1fr); }
  .pd-reg-grid { gap: 24px; }
  .pd-reg-intro { position: static; }
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
