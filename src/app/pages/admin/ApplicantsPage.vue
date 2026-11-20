<script setup lang="ts">
import { Download, Settings, UsersRound } from 'lucide-vue-next';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthSession } from '../../../features/auth/web';
import { LEVEL_LABEL, LEVELS, ppdbRefusalText, STATUS_LABEL, STATUSES, type ApplicationPage, type ApplicationStatus, type ApplicationSummary, type Level } from '../../../features/ppdb/web';
import { AbBadge, AbButton, AbCard, AbEmpty, AbNotice, AbPage, AbSearch, AbSelect, AbSpinner, count, dateTimeShort } from '../../../shared/ui';
import { ppdbClient } from '../../cms';

/**
 * The committee's list of registrations: SMP, SMA or both, by status, found
 * by name, NISN, number or school, and downloaded as CSV or Excel with the
 * same filter.
 */
const route = useRoute();
const router = useRouter();
const session = useAuthSession();
const manages = computed(() => session.can('ppdb.manage'));

// Filters live in the address, so the back button from a registration lands on the same list.
const level = computed<Level | ''>({
  get: () => (route.query.jenjang === 'smp' || route.query.jenjang === 'sma' ? route.query.jenjang : ''),
  set: (value) => void router.replace({ query: { ...route.query, jenjang: value || undefined } }),
});
const status = computed<ApplicationStatus | ''>({
  get: () => ((STATUSES as readonly string[]).includes(String(route.query.status)) ? (route.query.status as ApplicationStatus) : ''),
  set: (value) => void router.replace({ query: { ...route.query, status: value || undefined } }),
});
const query = ref('');
const term = ref('');
let pause: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(pause);
  pause = setTimeout(() => (term.value = value.trim()), 250);
});
onUnmounted(() => clearTimeout(pause));

const LEVEL_OPTIONS: { value: Level | ''; label: string }[] = [{ value: '', label: 'Semua' }, ...LEVELS.map((value) => ({ value, label: LEVEL_LABEL[value] }))];
const STATUS_OPTIONS = [{ value: '', label: 'Semua status' }, ...STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }))];
const STATUS_TONE: Record<ApplicationStatus, 'orange' | 'sun' | 'green' | 'gray'> = { baru: 'orange', diverifikasi: 'sun', diterima: 'green', ditolak: 'gray' };

const items = ref<ApplicationSummary[]>([]);
const total = ref(0);
const counts = ref<ApplicationPage['counts'] | null>(null);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);
const LIMIT = 50;
let ticket = 0;

async function load(reset = true): Promise<void> {
  const mine = ++ticket;
  loading.value = true;
  const next = reset ? 1 : page.value + 1;
  const result = await ppdbClient.list({ page: next, limit: LIMIT, level: level.value || undefined, status: status.value || undefined, q: term.value || undefined });
  if (mine !== ticket) return;
  loading.value = false;
  if (!result.ok) {
    error.value = ppdbRefusalText(result);
    return;
  }
  error.value = null;
  page.value = next;
  total.value = result.data.total;
  counts.value = result.data.counts;
  items.value = reset ? result.data.items : [...items.value, ...result.data.items];
}
watch([level, status, term], () => void load(), { immediate: true });

const totals = computed(() =>
  LEVELS.map((key) => {
    const byStatus = counts.value?.[key];
    const all = byStatus ? Object.values(byStatus).reduce((sum, value) => sum + value, 0) : 0;
    return { key, all, fresh: byStatus?.baru ?? 0, accepted: byStatus?.diterima ?? 0 };
  }),
);

const filter = computed(() => ({ level: level.value || undefined, status: status.value || undefined, q: term.value || undefined }));
const exportLabel = computed(() => (level.value ? LEVEL_LABEL[level.value] : 'semua jenjang'));

const emptyText = computed(() => {
  if (term.value) return { title: 'Tidak ada yang cocok', text: 'Coba nama, NISN, nomor pendaftaran, atau asal sekolah lain.' };
  if (level.value || status.value) return { title: 'Tidak ada di sini', text: 'Ganti saringan untuk melihat pendaftar lain.' };
  return { title: 'Belum ada pendaftar', text: 'Pendaftar dari formulir PPDB di situs akan tampil di sini.' };
});
</script>

<template>
  <AbPage title="Pendaftar PPDB" description="Pendaftaran online SMP dan SMA dari formulir di situs.">
    <template #actions>
      <AbButton v-if="manages" variant="outline" :to="{ name: 'ppdb-settings' }"><Settings :size="18" />Pengaturan formulir</AbButton>
    </template>

    <div class="ap-totals">
      <button
        v-for="item in totals"
        :key="item.key"
        type="button"
        class="ap-total"
        :class="[`ap-total--${item.key}`, { 'is-on': level === item.key }]"
        :aria-pressed="level === item.key"
        @click="level = level === item.key ? '' : item.key"
      >
        <span class="ap-total-label">{{ LEVEL_LABEL[item.key] }}</span>
        <b>{{ item.all }}</b>
        <span class="ap-total-facts">{{ item.fresh }} baru · {{ item.accepted }} diterima</span>
      </button>
    </div>

    <AbCard>
      <div class="ap-tools">
        <div class="ap-filter" role="radiogroup" aria-label="Jenjang">
          <button
            v-for="option in LEVEL_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="level === option.value"
            class="ap-filter-option"
            :class="{ 'is-on': level === option.value }"
            @click="level = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="ap-status"><AbSelect :model-value="status" label="Status" :options="STATUS_OPTIONS" @update:model-value="status = $event as ApplicationStatus | ''" /></div>
        <AbSearch v-model="query" placeholder="Cari nama, NISN, nomor, sekolah" label="Cari pendaftar" />
      </div>

      <div class="ap-export">
        <span>Unduh {{ count(total, 'pendaftar') }} ({{ exportLabel }}{{ status ? `, ${STATUS_LABEL[status].toLowerCase()}` : '' }}):</span>
        <AbButton variant="outline" size="sm" :href="ppdbClient.exportUrl('xlsx', filter)"><Download :size="16" />Excel</AbButton>
        <AbButton variant="outline" size="sm" :href="ppdbClient.exportUrl('csv', filter)"><Download :size="16" />CSV</AbButton>
        <small class="ap-export-note">Buka di Excel lewat tombol Excel agar NIK dan NISN tetap utuh; CSV untuk aplikasi lain.</small>
      </div>

      <AbNotice v-if="error" tone="bad">
        {{ error }}
        <AbButton variant="outline" size="sm" @click="load()">Coba lagi</AbButton>
      </AbNotice>
      <div v-else-if="loading && items.length === 0" class="ap-state"><AbSpinner /></div>
      <AbEmpty v-else-if="items.length === 0" :icon="UsersRound" :title="emptyText.title" :text="emptyText.text" />
      <ol v-else class="ap-list" aria-label="Pendaftar">
        <li v-for="item in items" :key="item.id" :data-application-id="item.id">
          <RouterLink :to="{ name: 'ppdb-applicant', params: { id: item.id } }" class="ap-row">
            <span class="ap-level" :class="`ap-level--${item.level}`">{{ LEVEL_LABEL[item.level] }}</span>
            <span class="ap-text">
              <b>{{ item.name }}</b>
              <span class="ap-facts">{{ item.code }} · {{ item.previousSchool }} · {{ dateTimeShort(item.createdAt) }}</span>
            </span>
            <AbBadge :tone="STATUS_TONE[item.status]" dot>{{ STATUS_LABEL[item.status] }}</AbBadge>
          </RouterLink>
        </li>
      </ol>
      <div v-if="items.length < total" class="ap-more">
        <AbButton variant="outline" :loading="loading" @click="load(false)">Muat lebih banyak</AbButton>
      </div>
    </AbCard>
  </AbPage>
</template>

<style scoped>
.ap-totals { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.ap-total { display: grid; justify-items: start; gap: 2px; padding: 18px 20px; border: 2px solid transparent; border-radius: 20px; color: #fff; text-align: left; }
.ap-total--smp { background: var(--ab-smp); }
.ap-total--sma { background: var(--ab-sma); }
.ap-total.is-on { border-color: var(--ab-ink); box-shadow: 0 0 0 2px #fff inset; }
.ap-total-label { font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .9; }
.ap-total b { font-family: var(--ab-display); font-size: 40px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.ap-total-facts { font-size: 14px; font-weight: 600; opacity: .9; }
.ap-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 12px; }
.ap-tools > :last-child { flex: 1 1 220px; }
.ap-status { width: 190px; }
.ap-filter { display: inline-flex; padding: 4px; border-radius: 12px; background: var(--ab-paper-2); }
.ap-filter-option { padding: 8px 14px; border-radius: 9px; color: var(--ab-ink-2); font-size: 14px; font-weight: 700; }
.ap-filter-option.is-on { background: var(--ab-forest); color: #fff; }
.ap-export { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; padding: 10px 0; border-top: 1px solid var(--ab-line); color: var(--ab-ink-2); font-size: 14px; font-weight: 600; }
.ap-export > span { margin-right: auto; }
.ap-export-note { flex-basis: 100%; font-size: 13px; font-weight: 500; }
.ap-state { display: grid; place-items: center; padding: 56px 0; }
.ap-list { margin: 0; padding: 0; list-style: none; }
.ap-list li { border-top: 1px solid var(--ab-line); }
.ap-row { display: flex; min-width: 0; align-items: center; gap: 14px; padding: 12px 6px; border-radius: 12px; }
.ap-row:hover { background: var(--ab-paper); }
.ap-level { display: grid; width: 48px; height: 48px; flex: none; place-items: center; border-radius: 12px; color: #fff; font-size: 13px; font-weight: 800; }
.ap-level--smp { background: var(--ab-smp); }
.ap-level--sma { background: var(--ab-sma); }
.ap-text { display: grid; min-width: 0; flex: 1; gap: 2px; }
.ap-text b { overflow: hidden; font-size: 15.5px; text-overflow: ellipsis; white-space: nowrap; }
.ap-facts { overflow: hidden; color: var(--ab-mute); font-size: 13.5px; text-overflow: ellipsis; white-space: nowrap; }
.ap-more { display: flex; justify-content: center; margin-top: 16px; }
@media (max-width: 719px) {
  .ap-totals { gap: 10px; }
  .ap-total { padding: 14px 16px; }
  .ap-total b { font-size: 32px; }
  .ap-status { width: 100%; }
  .ap-row { gap: 10px; padding: 10px 2px; }
  .ap-level { width: 40px; height: 40px; }
}
</style>
