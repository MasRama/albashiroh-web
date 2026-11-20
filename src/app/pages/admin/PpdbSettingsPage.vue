<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { emptyPpdbSettings, LEVEL_LABEL, LEVELS, ppdbRefusalText, type PpdbSettings, type PpdbSettingsRecord } from '../../../features/ppdb/web';
import { AbButton, AbCard, AbDialog, AbField, AbNotice, AbPage, AbSpinner, AbSwitch, dateTimeShort, showToast } from '../../../shared/ui';
import { mergeStale } from '../../account';
import { ppdbClient } from '../../cms';

/**
 * Whether the online form takes registrations, the academic year it is for,
 * and what each family reads once registered: payment and next steps, and
 * the parents' WhatsApp group of their level.
 */
const record = ref<PpdbSettingsRecord | null>(null);
const draft = reactive<PpdbSettings>(emptyPpdbSettings());
const opened = ref<PpdbSettings>(emptyPpdbSettings());
const loading = ref(true);
const loadError = ref<string | null>(null);
const errors = ref<Record<string, string[]>>();
const saving = ref(false);

function fill(settings: PpdbSettings): void {
  Object.assign(draft, structuredClone(settings));
  opened.value = structuredClone(settings);
}

async function load(): Promise<void> {
  loading.value = true;
  const result = await ppdbClient.settings();
  loading.value = false;
  if (!result.ok) {
    loadError.value = ppdbRefusalText(result);
    return;
  }
  loadError.value = null;
  record.value = result.data.record;
  fill(result.data.record.settings);
}
void load();

const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(opened.value));
const error = (key: string) => errors.value?.[`settings.${key}`]?.[0];

// A link typed without its scheme ("chat.whatsapp.com/…") gets https://; anything else is left for the server to check.
const withScheme = (value: string) => {
  const link = value.trim();
  return link === '' || /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
};

async function save(): Promise<void> {
  if (!record.value || saving.value) return;
  saving.value = true;
  // The plain values under the form's proxy: the browser cannot clone a reactive object.
  const settings = structuredClone(toRaw(draft)) as PpdbSettings;
  for (const level of LEVELS) settings.groupLink[level] = withScheme(settings.groupLink[level]);
  const result = await ppdbClient.saveSettings(settings, record.value.revision);
  saving.value = false;
  if (result.ok) {
    errors.value = undefined;
    record.value = result.data.record;
    fill(result.data.record.settings);
    showToast(settings.open ? 'Tersimpan. Formulir PPDB terbuka di situs.' : 'Tersimpan. Formulir PPDB ditutup.', 'good');
    return;
  }
  if (result.code === 'VALIDATION_ERROR') {
    errors.value = result.errors;
    showToast(ppdbRefusalText(result), 'bad');
    return;
  }
  if (result.code === 'STALE_REVISION' && result.current) {
    const current = result.current as PpdbSettingsRecord;
    const merged = mergeStale(opened.value, settings, current.settings);
    record.value = current;
    opened.value = structuredClone(current.settings);
    Object.assign(draft, merged);
    showToast('Pengaturan ini baru diubah orang lain. Perubahan Anda dipertahankan; periksa lalu simpan lagi.', 'warn');
    return;
  }
  showToast(ppdbRefusalText(result), 'bad');
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
  <AbPage title="Pengaturan formulir PPDB" description="Buka atau tutup pendaftaran online, dan isi informasi yang dibaca pendaftar setelah mendaftar." :back="{ label: 'Pendaftar PPDB', to: { name: 'ppdb' } }" narrow>
    <AbNotice v-if="loadError" tone="bad">
      {{ loadError }}
      <AbButton variant="outline" size="sm" @click="load">Coba lagi</AbButton>
    </AbNotice>
    <div v-else-if="loading" class="pp-state"><AbSpinner /></div>
    <form v-else class="pp" novalidate @submit.prevent="save">
      <AbCard title="Pendaftaran online">
        <div class="pp-stack">
          <div class="pp-open">
            <div>
              <b>{{ draft.open ? 'Formulir dibuka' : 'Formulir ditutup' }}</b>
              <p class="pp-help">
                {{ draft.open ? 'Calon siswa bisa mendaftar dari halaman PPDB.' : 'Halaman PPDB tetap tampil, tetapi formulirnya menyatakan pendaftaran sedang ditutup.' }}
                <a class="pp-link" href="/ppdb#formulir" target="_blank" rel="noopener">Lihat formulir <ExternalLink :size="14" aria-hidden="true" /></a>
              </p>
            </div>
            <AbSwitch v-model="draft.open" label="Formulir menerima pendaftaran" />
          </div>
          <AbField v-model="draft.academicYear" label="Tahun ajaran" placeholder="2027/2028" :error="error('academicYear')" :maxlength="20" hint="Seperti 2027/2028. Tampil di judul formulir; nomor pendaftaran dihitung per tahun ajaran." />
        </div>
      </AbCard>

      <AbCard v-for="level in LEVELS" :key="level" :title="`Setelah mendaftar ${LEVEL_LABEL[level]}`" :description="`Yang dibaca pendaftar ${LEVEL_LABEL[level]} di layar sukses, di bawah nomor pendaftarannya.`">
        <div class="pp-stack">
          <AbField
            v-model="draft.nextSteps[level]"
            label="Langkah berikutnya"
            multiline
            :rows="7"
            :maxlength="2000"
            :error="error(`nextSteps.${level}`)"
            hint="Misalnya cara membayar infaq pendaftaran, nomor rekening, dan kontak panitia. Baris baru tetap jadi baris baru."
          />
          <AbField
            v-model="draft.groupLink[level]"
            label="Tautan grup WhatsApp wali"
            inputmode="url"
            placeholder="chat.whatsapp.com/…"
            :error="error(`groupLink.${level}`)"
            hint="Kosongkan bila belum ada. Tampil sebagai tombol Gabung grup."
          />
        </div>
      </AbCard>

      <div class="pp-bar">
        <span v-if="record?.updatedAt" class="pp-saved">Disimpan {{ dateTimeShort(record.updatedAt) }}</span>
        <span v-if="dirty" class="pp-dirty">Ada perubahan yang belum disimpan</span>
        <AbButton type="submit" :loading="saving" :disabled="!dirty">Simpan pengaturan</AbButton>
      </div>
    </form>

    <AbDialog :open="leaving !== null" title="Tinggalkan tanpa menyimpan?" size="sm" @close="answerLeave(false)">
      <p class="pp-warning">Perubahan yang belum disimpan akan hilang.</p>
      <template #footer>
        <AbButton variant="outline" @click="answerLeave(false)">Tetap di sini</AbButton>
        <AbButton variant="danger" @click="answerLeave(true)">Tinggalkan</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.pp-state { display: grid; place-items: center; padding: 56px 0; }
.pp { display: grid; gap: 18px; }
.pp-stack { display: grid; gap: 16px; }
.pp-open { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--ab-line); }
.pp-open b { font-size: 15.5px; font-weight: 800; }
.pp-help { margin: 4px 0 0; color: var(--ab-ink-2); font-size: 14px; }
.pp-link { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; color: var(--ab-forest); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.pp-bar {
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
.pp-saved { margin-right: auto; color: var(--ab-mute); font-size: 13px; }
.pp-dirty { color: var(--ab-ink-2); font-size: 13.5px; font-weight: 700; }
.pp-warning { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 719px) {
  .pp-saved, .pp-dirty { display: none; }
}
</style>
