<script setup lang="ts">
import { MessageCircle, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthSession } from '../../../features/auth/web';
import {
  BOARDING_LABEL,
  GENDER_LABEL,
  LEVEL_LABEL,
  PAYMENT_LABEL,
  ppdbRefusalText,
  STATUS_LABEL,
  STATUSES,
  type Application,
  type ApplicationStatus,
  type Parent,
} from '../../../features/ppdb/web';
import { AbBadge, AbButton, AbCard, AbDialog, AbEmpty, AbField, AbNotice, AbPage, AbSelect, AbSpinner, dateTimeShort, showToast } from '../../../shared/ui';
import { ppdbClient } from '../../cms';

/**
 * One registration as the family sent it, with the committee's status and
 * note. Saving checks the version that was opened, so two committee members
 * never overwrite each other unknowingly.
 */
const props = defineProps<{ id: string }>();
const router = useRouter();
const session = useAuthSession();
const manages = computed(() => session.can('ppdb.manage'));

const application = ref<Application | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const status = ref<ApplicationStatus>('baru');
const note = ref('');
/** After a stale save: the note another member saved meanwhile, when it differs from this draft. */
const theirNote = ref<string | null>(null);
const noteHint = computed(() =>
  theirNote.value === null ? 'Hanya terlihat oleh panitia, ikut di file unduhan.' : `Catatan yang baru disimpan panitia lain: ${theirNote.value || '(kosong)'}`,
);
const saving = ref(false);
const confirming = ref(false);
const removing = ref(false);

function show(next: Application): void {
  application.value = next;
  status.value = next.status;
  note.value = next.note;
  theirNote.value = null;
}

async function load(): Promise<void> {
  loading.value = true;
  const result = await ppdbClient.get(props.id);
  loading.value = false;
  if (!result.ok) {
    loadError.value = ppdbRefusalText(result);
    return;
  }
  loadError.value = null;
  show(result.data.application);
}
watch(() => props.id, () => void load(), { immediate: true });

const changed = computed(() => Boolean(application.value) && (status.value !== application.value!.status || note.value !== application.value!.note));

async function save(): Promise<void> {
  const current = application.value;
  if (!current || saving.value) return;
  saving.value = true;
  const result = await ppdbClient.review(current.id, { status: status.value, note: note.value, revision: current.revision });
  saving.value = false;
  if (result.ok) {
    show(result.data.application);
    showToast('Status pendaftar disimpan.', 'good');
    return;
  }
  if (result.code === 'STALE_REVISION' && result.current) {
    // Keep what this member chose; show the newer version underneath so they can decide.
    const mine = { status: status.value, note: note.value };
    const current = result.current as Application;
    application.value = current;
    status.value = mine.status;
    note.value = mine.note;
    theirNote.value = current.note === mine.note ? null : current.note;
    showToast(ppdbRefusalText(result), 'warn');
    return;
  }
  showToast(ppdbRefusalText(result), 'bad');
}

async function remove(): Promise<void> {
  const current = application.value;
  if (!current || removing.value) return;
  removing.value = true;
  const result = await ppdbClient.remove(current.id);
  removing.value = false;
  if (!result.ok) {
    showToast(ppdbRefusalText(result), 'bad');
    return;
  }
  confirming.value = false;
  showToast(`Data ${current.code} dihapus.`, 'good');
  await router.push({ name: 'ppdb', query: { jenjang: current.level } });
}

const STATUS_TONE: Record<ApplicationStatus, 'orange' | 'sun' | 'green' | 'gray'> = { baru: 'orange', diverifikasi: 'sun', diterima: 'green', ditolak: 'gray' };
const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }));

const birthDate = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const whatsapp = (phone: string) => `https://wa.me/${phone}`;
const phoneText = (phone: string) => `+${phone.slice(0, 2)} ${phone.slice(2, 5)}-${phone.slice(5, 9)}-${phone.slice(9)}`;

const studentRows = computed(() => {
  const a = application.value;
  if (!a) return [];
  return [
    ['Nama lengkap', a.student.name],
    ['Tempat, tanggal lahir', `${a.student.birthPlace}, ${birthDate(a.student.birthDate)}`],
    ['Jenis kelamin', GENDER_LABEL[a.student.gender]],
    ['NISN', a.student.nisn],
    ['Asal sekolah', a.student.previousSchool],
  ] as const;
});
const parentRows = (parent: Parent) =>
  [
    ['Nama', parent.name],
    ['NIK', parent.nik],
    ['Tahun lahir', String(parent.birthYear)],
    ['Pendidikan terakhir', parent.education],
    ['Pekerjaan', parent.job],
    ['Penghasilan per bulan', parent.income],
  ] as const;
const familyRows = computed(() => {
  const a = application.value;
  if (!a) return [];
  return [
    ['Alamat', a.address],
    ['Kode pos', a.postalCode],
    ['Asrama', BOARDING_LABEL[a.boarding]],
    ['Infaq pendaftaran', PAYMENT_LABEL[a.payment]],
  ] as const;
});
</script>

<template>
  <AbPage
    :title="application ? application.student.name : 'Pendaftar'"
    :description="application ? `${application.code} · daftar ${dateTimeShort(application.createdAt)}` : undefined"
    :back="{ label: 'Pendaftar PPDB', to: { name: 'ppdb', query: application ? { jenjang: application.level } : {} } }"
  >
    <template v-if="application" #actions>
      <AbButton variant="outline" :href="whatsapp(application.phone)"><MessageCircle :size="18" />WhatsApp</AbButton>
    </template>

    <div v-if="loading && !application" class="apl-state"><AbSpinner /></div>
    <AbEmpty v-else-if="loadError" title="Tidak bisa dibuka" :text="loadError">
      <AbButton variant="outline" :to="{ name: 'ppdb' }">Kembali ke daftar</AbButton>
    </AbEmpty>
    <div v-else-if="application" class="apl">
      <div class="apl-main">
        <AbCard>
          <header class="apl-head">
            <span class="apl-level" :class="`apl-level--${application.level}`">{{ LEVEL_LABEL[application.level] }}</span>
            <h2>Data calon siswa</h2>
            <AbBadge :tone="STATUS_TONE[application.status]" dot>{{ STATUS_LABEL[application.status] }}</AbBadge>
          </header>
          <dl class="apl-rows">
            <div v-for="[label, value] in studentRows" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div>
          </dl>
        </AbCard>

        <AbCard v-for="who in (['father', 'mother'] as const)" :key="who" :title="who === 'father' ? 'Ayah' : 'Ibu'">
          <dl class="apl-rows">
            <div v-for="[label, value] in parentRows(application[who])" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div>
          </dl>
        </AbCard>

        <AbCard title="Alamat dan pilihan">
          <dl class="apl-rows">
            <div>
              <dt>Nomor HP / WhatsApp</dt>
              <dd><a class="apl-link" :href="whatsapp(application.phone)">{{ phoneText(application.phone) }}</a></dd>
            </div>
            <div v-for="[label, value] in familyRows" :key="label"><dt>{{ label }}</dt><dd class="apl-pre">{{ value }}</dd></div>
          </dl>
        </AbCard>
      </div>

      <aside class="apl-side">
        <AbCard title="Status pendaftaran">
          <template v-if="manages">
            <form class="apl-form" @submit.prevent="save">
              <AbSelect :model-value="status" label="Status" :options="STATUS_OPTIONS" @update:model-value="status = $event as ApplicationStatus" />
              <AbField v-model="note" label="Catatan panitia" multiline :rows="5" :maxlength="2000" :hint="noteHint" />
              <AbButton type="submit" block :loading="saving" :disabled="!changed">Simpan status</AbButton>
            </form>
          </template>
          <template v-else>
            <p class="apl-status"><AbBadge :tone="STATUS_TONE[application.status]" dot>{{ STATUS_LABEL[application.status] }}</AbBadge></p>
            <p v-if="application.note" class="apl-note">{{ application.note }}</p>
            <AbNotice>Hanya pengurus PPDB yang bisa mengubah status.</AbNotice>
          </template>
          <p class="apl-updated">Diubah {{ dateTimeShort(application.updatedAt) }}</p>
        </AbCard>
        <AbButton v-if="manages" variant="danger" block @click="confirming = true"><Trash2 :size="18" />Hapus data pendaftar</AbButton>
      </aside>
    </div>

    <AbDialog :open="confirming" title="Hapus data pendaftar?" size="sm" @close="confirming = false">
      <p v-if="application">Data {{ application.student.name }} ({{ application.code }}) hilang permanen dan nomornya tidak dipakai lagi. Untuk pendaftar yang tidak lolos, pilih status Tidak diterima saja.</p>
      <template #footer>
        <AbButton variant="ghost" @click="confirming = false">Batal</AbButton>
        <AbButton variant="danger" :loading="removing" @click="remove">Hapus permanen</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.apl-state { display: grid; place-items: center; padding: 80px 0; }
.apl { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
.apl-main { display: grid; gap: 16px; min-width: 0; }
.apl-side { position: sticky; top: 88px; display: grid; gap: 12px; }
.apl-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.apl-head h2 { flex: 1; margin: 0; font-family: var(--ab-display); font-size: 19px; font-weight: 800; }
.apl-level { display: grid; width: 44px; height: 44px; flex: none; place-items: center; border-radius: 12px; color: #fff; font-size: 13px; font-weight: 800; }
.apl-level--smp { background: var(--ab-smp); }
.apl-level--sma { background: var(--ab-sma); }
.apl-rows { margin: 0; }
.apl-rows > div { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 12px; padding: 11px 0; border-top: 1px solid var(--ab-line); }
.apl-rows dt { color: var(--ab-mute); font-size: 14px; font-weight: 600; }
.apl-rows dd { margin: 0; overflow-wrap: anywhere; font-size: 15px; font-weight: 600; }
.apl-pre { white-space: pre-line; }
.apl-link { color: var(--ab-smp-deep); text-decoration: underline; text-underline-offset: 3px; }
.apl-form { display: grid; gap: 14px; }
.apl-status { margin: 0 0 10px; }
.apl-note { margin: 0 0 12px; white-space: pre-line; font-size: 15px; }
.apl-updated { margin: 12px 0 0; color: var(--ab-mute); font-size: 13px; }
@media (max-width: 959px) {
  .apl { grid-template-columns: minmax(0, 1fr); }
  .apl-side { position: static; order: -1; }
}
@media (max-width: 559px) {
  .apl-rows > div { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 9px 0; }
}
</style>
