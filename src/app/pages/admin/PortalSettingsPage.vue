<script setup lang="ts">
import { Plus, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  contentRefusalText,
  emptySettings,
  fieldError,
  PORTAL_INFO,
  RichTextEditor,
  type Portal,
  type PortalSettings,
  type PortalSettingsRecord,
} from '../../../features/content/web';
import { MediaFileField, MediaImageField } from '../../../features/media/web';
import { AbButton, AbCard, AbDialog, AbField, AbNotice, AbPage, AbSpinner, dateTimeShort, showToast } from '../../../shared/ui';
import { mergeStale } from '../../account';
import { contentClient } from '../../cms';
import { PORTAL_LABEL, portalRoute } from '../../content-admin';

/**
 * A portal's own text: the home page hero and numbers, vision and mission,
 * profile, the head's welcome, graduate competencies, contact details and
 * the PPDB page. The Yayasan also writes its Takhosus and boarding pages.
 */
const props = defineProps<{ portal: Portal }>();

const record = ref<PortalSettingsRecord | null>(null);
const draft = reactive<PortalSettings>(emptySettings());
const opened = ref<PortalSettings>(emptySettings());
const loading = ref(true);
const loadError = ref<string | null>(null);
const errors = ref<Record<string, string[]>>();
const saving = ref(false);
const school = computed(() => props.portal !== 'yayasan');
const head = computed(() => (school.value ? 'kepala sekolah' : 'ketua yayasan'));

function fill(settings: PortalSettings): void {
  Object.assign(draft, structuredClone(settings));
  opened.value = structuredClone(settings);
}

async function load(): Promise<void> {
  loading.value = true;
  const result = await contentClient.settings(props.portal);
  loading.value = false;
  if (!result.ok) {
    loadError.value = contentRefusalText(result);
    return;
  }
  loadError.value = null;
  record.value = result.data.record;
  fill(result.data.record.settings);
}
watch(() => props.portal, () => void load(), { immediate: true });

const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(opened.value));
const error = (key: string) => fieldError(errors.value, `settings.${key}`);

async function save(): Promise<void> {
  if (!record.value) return;
  saving.value = true;
  // The plain values under the form's proxy: the browser cannot clone a reactive object.
  const settings = structuredClone(toRaw(draft)) as PortalSettings;
  settings.misi = settings.misi.map((line) => line.trim()).filter(Boolean);
  for (const key of SOCIAL) settings.contact[key] = withScheme(settings.contact[key]);
  const result = await contentClient.saveSettings(props.portal, settings, record.value.revision);
  saving.value = false;
  if (result.ok) {
    errors.value = undefined;
    record.value = result.data.record;
    fill(result.data.record.settings);
    showToast('Pengaturan tersimpan dan tampil di situs', 'good');
    return;
  }
  if (result.code === 'VALIDATION_ERROR') {
    errors.value = result.errors;
    showToast(contentRefusalText(result), 'bad');
    return;
  }
  if (result.code === 'STALE_REVISION' && result.current) {
    const current = result.current as PortalSettingsRecord;
    const merged = mergeStale(opened.value, settings, current.settings);
    record.value = current;
    opened.value = structuredClone(current.settings);
    Object.assign(draft, merged);
    showToast('Pengaturan ini baru diubah orang lain. Perubahan Anda dipertahankan; periksa lalu simpan lagi.', 'warn');
    return;
  }
  showToast(contentRefusalText(result), 'bad');
}

// Social links typed as a bare address ("instagram.com/…") get their https://; anything else is left for the server to check.
const SOCIAL = ['instagram', 'facebook', 'youtube', 'tiktok'] as const;
const withScheme = (value: string) => {
  const link = value.trim();
  return link === '' || /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
};

// Lists the school grows and trims.
function addStat(): void {
  if (draft.stats.length < 4) draft.stats.push({ value: '', label: '' });
}
function addMisi(): void {
  if (draft.misi.length < 12) draft.misi.push('');
}
function addKompetensi(): void {
  if (draft.kompetensi.length < 20) draft.kompetensi.push({ name: '', detail: '', target: '' });
}

const leaving = ref<((leave: boolean) => void) | null>(null);
onBeforeRouteLeave(() => (dirty.value ? new Promise<boolean>((resolve) => (leaving.value = resolve)) : true));
function answerLeave(leave: boolean): void {
  leaving.value?.(leave);
  leaving.value = null;
}
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) event.preventDefault();
};
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>

<template>
  <AbPage
    :title="`Pengaturan ${school ? 'portal' : 'situs'}`"
    :description="`Teks dan foto ${PORTAL_INFO[portal].name}. Bagian yang dikosongkan tidak ditampilkan di situs.`"
    :back="{ label: PORTAL_LABEL[portal], to: { name: portalRoute(portal).home } }"
  >
    <AbNotice v-if="loadError" tone="bad">
      {{ loadError }}
      <AbButton variant="outline" size="sm" @click="load">Coba lagi</AbButton>
    </AbNotice>
    <div v-else-if="loading" class="ps-state"><AbSpinner /></div>
    <form v-else class="ps" novalidate @submit.prevent="save">
      <AbCard title="Beranda" description="Bagian paling atas halaman depan.">
        <div class="ps-grid">
          <div class="ps-stack">
            <AbField v-model="draft.heroTitle" label="Judul besar" :placeholder="school ? 'Wujudkan generasi bertaqwa dan berprestasi.' : 'Generasi Qur\'ani yang bertaqwa, berilmu, dan mandiri.'" :error="error('heroTitle')" hint="Apit kata dengan bintang, misalnya *bertaqwa*, agar tampil berwarna." :maxlength="140" />
            <AbField v-model="draft.heroIntro" label="Paragraf pembuka" multiline :rows="4" :error="error('heroIntro')" :maxlength="400" />
            <AbField v-model="draft.tagline" label="Slogan singkat" hint="Tampil di kartu jenjang dan kaki halaman." :error="error('tagline')" :maxlength="160" />
            <AbField v-model="draft.accreditation" label="Akreditasi" placeholder="A" :error="error('accreditation')" :maxlength="10" />
          </div>
          <MediaImageField v-model="draft.heroImageId" label="Foto utama" :error="error('heroImageId')" aspect="4 / 3" />
        </div>
        <fieldset class="ps-list">
          <legend>Angka unggulan <span>(paling banyak 4)</span></legend>
          <div v-for="(stat, index) in draft.stats" :key="index" class="ps-row ps-row--stat">
            <AbField v-model="stat.value" :label="`Angka ${index + 1}`" placeholder="30" :maxlength="16" />
            <AbField v-model="stat.label" label="Keterangan" placeholder="Juz, Takhosus Al-Qur'an" :maxlength="60" />
            <button type="button" class="ps-remove" :aria-label="`Hapus angka ${index + 1}`" @click="draft.stats.splice(index, 1)"><X :size="18" /></button>
          </div>
          <AbButton v-if="draft.stats.length < 4" variant="outline" size="sm" @click="addStat"><Plus :size="16" />Tambah angka</AbButton>
        </fieldset>
      </AbCard>

      <AbCard title="Visi dan misi">
        <div class="ps-stack">
          <AbField v-model="draft.visi" label="Visi" multiline :rows="2" :error="error('visi')" :maxlength="400" />
          <fieldset class="ps-list">
            <legend>Misi</legend>
            <div v-for="(_, index) in draft.misi" :key="index" class="ps-row">
              <AbField v-model="draft.misi[index]" :label="`Misi ${index + 1}`" :maxlength="300" :error="error(`misi.${index}`)" />
              <button type="button" class="ps-remove" :aria-label="`Hapus misi ${index + 1}`" @click="draft.misi.splice(index, 1)"><X :size="18" /></button>
            </div>
            <AbButton v-if="draft.misi.length < 12" variant="outline" size="sm" @click="addMisi"><Plus :size="16" />Tambah misi</AbButton>
          </fieldset>
        </div>
      </AbCard>

      <AbCard :title="school ? 'Profil sekolah' : 'Profil yayasan'" description="Halaman Profil: sejarah, nilai dan gambaran umum.">
        <RichTextEditor v-model="draft.profil" label="Isi profil" :error="error('profil')" />
      </AbCard>

      <AbCard :title="`Prakata ${head}`" description="Sambutan di beranda, dengan foto dan nama.">
        <div class="ps-grid">
          <div class="ps-stack">
            <AbField v-model="draft.prakata.name" :label="`Nama ${head}`" :error="error('prakata.name')" :maxlength="120" />
            <AbField v-model="draft.prakata.role" label="Jabatan" :placeholder="school ? `Kepala ${PORTAL_INFO[portal].name}` : 'Ketua Yayasan Bashiroh Robbaniyah'" :maxlength="120" />
          </div>
          <MediaImageField v-model="draft.prakata.photoId" :label="`Foto ${head}`" :error="error('prakata.photoId')" aspect="4 / 5" />
        </div>
        <RichTextEditor v-model="draft.prakata.body" label="Teks prakata" :error="error('prakata.body')" compact class="ps-gap" />
      </AbCard>

      <template v-if="!school">
        <AbCard title="Takhosus Al-Qur'an" description="Halaman program unggulan hafalan 30 juz.">
          <RichTextEditor v-model="draft.takhosus" label="Isi halaman Takhosus" :error="error('takhosus')" />
        </AbCard>
        <AbCard title="Keasramaan" description="Halaman kehidupan asrama, pembinaan ibadah dan kegiatan harian.">
          <RichTextEditor v-model="draft.keasramaan" label="Isi halaman Keasramaan" :error="error('keasramaan')" />
        </AbCard>
      </template>

      <AbCard v-if="school" title="Standar kompetensi lulusan" description="Tabel target lulusan di beranda; beranda Yayasan membandingkan SMP dan SMA per kompetensi yang namanya sama.">
        <fieldset class="ps-list">
          <legend class="ab-visually-hidden">Kompetensi</legend>
          <div v-for="(row, index) in draft.kompetensi" :key="index" class="ps-row ps-row--skl">
            <AbField v-model="row.name" label="Kompetensi" placeholder="Hafalan Al-Qur'an" :maxlength="80" />
            <AbField v-model="row.detail" label="Rincian" placeholder="Juz 28, 29, dan 30" :maxlength="160" />
            <AbField v-model="row.target" label="Target" placeholder="3 juz" :maxlength="60" />
            <button type="button" class="ps-remove" :aria-label="`Hapus kompetensi ${index + 1}`" @click="draft.kompetensi.splice(index, 1)"><X :size="18" /></button>
          </div>
          <AbButton v-if="draft.kompetensi.length < 20" variant="outline" size="sm" @click="addKompetensi"><Plus :size="16" />Tambah kompetensi</AbButton>
        </fieldset>
      </AbCard>

      <AbCard title="Kontak dan lokasi" description="Tampil di kaki setiap halaman dan halaman Kontak.">
        <div class="ps-grid ps-grid--even">
          <AbField v-model="draft.contact.address" label="Alamat" multiline :rows="2" :error="error('contact.address')" :maxlength="300" />
          <AbField v-model="draft.contact.area" label="Kecamatan dan kabupaten" placeholder="Turen, Kabupaten Malang, Jawa Timur" :maxlength="160" />
          <AbField v-model="draft.contact.phone" label="Telepon" type="tel" inputmode="tel" :error="error('contact.phone')" :maxlength="40" />
          <AbField v-model="draft.contact.whatsapp" label="WhatsApp" inputmode="tel" placeholder="6281234567890" hint="Diawali kode negara, tanpa spasi." :error="error('contact.whatsapp')" :maxlength="20" />
          <AbField v-model="draft.contact.email" label="Email" type="email" inputmode="email" :error="error('contact.email')" />
          <AbField v-model="draft.contact.mapQuery" label="Lokasi di peta" placeholder="SMP IT Al Bashiroh Turen" hint="Nama tempat atau alamat seperti dicari di Google Maps." :maxlength="300" />
          <AbField v-model="draft.contact.instagram" label="Instagram" type="url" inputmode="url" :error="error('contact.instagram')" placeholder="https://instagram.com/…" :maxlength="300" />
          <AbField v-model="draft.contact.facebook" label="Facebook" type="url" inputmode="url" :error="error('contact.facebook')" :maxlength="300" />
          <AbField v-model="draft.contact.youtube" label="YouTube" type="url" inputmode="url" :error="error('contact.youtube')" :maxlength="300" />
          <AbField v-model="draft.contact.tiktok" label="TikTok" type="url" inputmode="url" :error="error('contact.tiktok')" :maxlength="300" />
        </div>
      </AbCard>

      <AbCard title="PPDB" description="Teks halaman pendaftaran untuk jenjang ini.">
        <div class="ps-stack">
          <AbField v-model="draft.ppdb.intro" label="Pengantar" multiline :rows="3" :error="error('ppdb.intro')" :maxlength="600" />
          <RichTextEditor v-model="draft.ppdb.flow" label="Alur dan biaya pendaftaran" :error="error('ppdb.flow')" compact />
          <MediaFileField
            v-model="draft.ppdb.brochureFileId"
            label="Brosur"
            :file="draft.ppdb.brochureFileId ? record?.files[draft.ppdb.brochureFileId] : undefined"
            :error="error('ppdb.brochureFileId')"
          />
        </div>
      </AbCard>

      <div class="ps-bar">
        <span v-if="record?.updatedAt" class="ps-saved">Disimpan {{ dateTimeShort(record.updatedAt) }}</span>
        <span v-if="dirty" class="ps-dirty">Ada perubahan yang belum disimpan</span>
        <AbButton type="submit" :loading="saving" :disabled="!dirty && record?.revision !== 0">Simpan pengaturan</AbButton>
      </div>
    </form>

    <AbDialog :open="leaving !== null" title="Tinggalkan tanpa menyimpan?" size="sm" @close="answerLeave(false)">
      <p class="ps-warning">Perubahan yang belum disimpan akan hilang.</p>
      <template #footer>
        <AbButton variant="outline" @click="answerLeave(false)">Tetap di sini</AbButton>
        <AbButton variant="danger" @click="answerLeave(true)">Tinggalkan</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.ps-state { display: grid; place-items: center; padding: 56px 0; }
.ps { display: grid; gap: 18px; }
.ps-stack { display: grid; gap: 16px; }
.ps-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.ps-grid--even { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ps-gap { margin-top: 18px; }
.ps-list { display: grid; gap: 12px; margin: 20px 0 0; padding: 0; border: 0; }
.ps-list legend { margin-bottom: 10px; padding: 0; font-size: 14.5px; font-weight: 700; }
.ps-list legend span { color: var(--ab-mute); font-weight: 500; }
.ps-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.ps-row--stat { grid-template-columns: 120px minmax(0, 1fr) auto; }
.ps-row--skl { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, .7fr) auto; }
.ps-remove { display: grid; width: 44px; height: 48px; place-items: center; border-radius: 12px; color: var(--ab-mute); }
.ps-remove:hover { background: var(--ab-red-soft); color: var(--ab-red); }
.ps-bar {
  position: sticky;
  bottom: calc(12px + var(--ab-safe-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ab-line);
  border-radius: var(--ab-radius-l);
  background: var(--ab-card);
  box-shadow: var(--ab-shadow-pop);
}
.ps-saved { margin-right: auto; color: var(--ab-mute); font-size: 13px; }
.ps-dirty { color: var(--ab-ink-2); font-size: 13.5px; font-weight: 700; }
.ps-warning { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 899px) {
  .ps-grid, .ps-grid--even { grid-template-columns: minmax(0, 1fr); }
  .ps-row--skl { grid-template-columns: minmax(0, 1fr) auto; }
  .ps-row--skl > :nth-child(2), .ps-row--skl > :nth-child(3) { grid-column: 1; }
  .ps-row--skl > .ps-remove { grid-row: 1; grid-column: 2; }
}
@media (max-width: 719px) {
  .ps-saved, .ps-dirty { display: none; }
  .ps-row--stat { grid-template-columns: 90px minmax(0, 1fr) auto; }
}
</style>
