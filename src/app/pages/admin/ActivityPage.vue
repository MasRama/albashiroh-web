<script setup lang="ts">
import { History } from 'lucide-vue-next';
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import { ACTIVITY_RECORDED_EVENT } from '../../../features/activity/web';
import { useAuthSession } from '../../../features/auth/web';
import { onServerEvent } from '../../../shared/realtime/browser';
import { AbButton, AbCard, AbEmpty, AbPage, AbSelect, AbSpinner, dateLong, dayWib, skipped, timeShort, useResource } from '../../../shared/ui';
import { accountClient, type ActivityRecord, type DeclaredAction } from '../../account';

/** Aktivitas: who did what and when, newest first, for checking back on a change. */
const ACTION_LABEL: Record<string, string> = {
  'auth.registered': 'Akun didaftarkan',
  'auth.login': 'Masuk',
  'auth.logout': 'Keluar',
  'auth.password-changed': 'Kata sandi diganti',
  'auth.session-revoked': 'Perangkat dikeluarkan',
  'auth.sessions-revoked': 'Perangkat lain dikeluarkan',
  'auth.two-factor-enabled': 'Verifikasi dua langkah diaktifkan',
  'auth.two-factor-disabled': 'Verifikasi dua langkah dimatikan',
  'auth.recovery-codes-regenerated': 'Kode pemulihan dibuat ulang',
  'roles.created': 'Peran dibuat',
  'roles.updated': 'Peran diubah',
  'roles.deleted': 'Peran dihapus',
  'users.created': 'Pengguna dibuat',
  'users.updated': 'Pengguna diubah',
  'users.profile-updated': 'Profil diubah',
  'users.password-reset': 'Kata sandi diatur ulang',
  'users.deleted': 'Pengguna dihapus',
};

const PAGE_SIZE = 50;
const session = useAuthSession();
const action = ref('');
const pages = shallowRef<ActivityRecord[]>([]);
const page = ref(1);
const declared = shallowRef<DeclaredAction[]>([]);
const total = ref(0);
const loading = ref(false);
const failure = ref('');

async function load(next: number): Promise<void> {
  loading.value = true;
  const result = await accountClient.activity({ page: next, limit: PAGE_SIZE, action: action.value });
  loading.value = false;
  if (!result.ok) {
    failure.value = result.message;
    return;
  }
  failure.value = '';
  page.value = next;
  total.value = result.data.total;
  declared.value = result.data.actions;
  pages.value = next === 1 ? result.data.activities : [...pages.value, ...result.data.activities];
}
watch(action, () => void load(1), { immediate: true });

// New entries appear on top as they happen; pages already loaded below stay put.
async function followLive(): Promise<void> {
  if (loading.value) return;
  const result = await accountClient.activity({ page: 1, limit: PAGE_SIZE, action: action.value });
  if (!result.ok) return;
  const known = new Set(pages.value.map((item) => item.id));
  const fresh = result.data.activities.filter((item) => !known.has(item.id));
  if (fresh.length) pages.value = [...fresh, ...pages.value];
  total.value = result.data.total;
  declared.value = result.data.actions;
}
onUnmounted(onServerEvent(ACTIVITY_RECORDED_EVENT, () => void followLive()));

// Names of the people behind each entry, when this account may see the staff.
const team = useResource(() => (session.can('users.view') ? accountClient.users({ limit: 100 }) : skipped()));
const names = computed(() => new Map((team.data.value?.users ?? []).map((user) => [user.id, user.name])));
function actor(item: ActivityRecord): string {
  if (!item.actorId) return 'Sistem';
  if (item.actorId === session.user.value?.id) return 'Anda';
  return names.value.get(item.actorId) ?? 'Pengguna lain';
}

const labelOf = (name: string) => ACTION_LABEL[name] ?? declared.value.find((item) => item.action === name)?.label ?? name;
const options = computed(() => [
  { value: '', label: 'Semua aktivitas' },
  ...declared.value.map((item) => ({ value: item.action, label: labelOf(item.action) })).sort((a, b) => a.label.localeCompare(b.label, 'id')),
]);

// One group per Jakarta day, newest first.
const days = computed(() => {
  const groups: { day: string; items: ActivityRecord[] }[] = [];
  for (const item of pages.value) {
    const day = dayWib(item.occurredAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(item);
  }
  return groups;
});
const today = dayWib();
const dayHeader = (day: string) => (day === today ? 'Hari ini' : dateLong(day));
</script>

<template>
  <AbPage title="Aktivitas" description="Siapa mengubah apa, dan kapan. Yang terbaru di atas." data-testid="activity-page">
    <template #actions>
      <div class="ac-filter"><AbSelect v-model="action" label="Jenis aktivitas" :options="options" /></div>
    </template>

    <AbCard v-if="!pages.length">
      <div v-if="loading" class="ac-center"><AbSpinner /></div>
      <AbEmpty v-else-if="failure" title="Aktivitas belum bisa dimuat" :text="failure" :icon="History">
        <AbButton variant="outline" @click="load(1)">Coba lagi</AbButton>
      </AbEmpty>
      <AbEmpty v-else title="Belum ada aktivitas" text="Perubahan yang dibuat staf akan tercatat di sini." :icon="History" />
    </AbCard>

    <AbCard v-for="group in days" :key="group.day" :title="dayHeader(group.day)" flush>
      <ul class="ac-list">
        <li v-for="item in group.items" :key="item.id" class="ac-item">
          <span class="ac-time num">{{ timeShort(item.occurredAt) }}</span>
          <div class="ac-text">
            <b>{{ labelOf(item.action) }}</b>
            <span>{{ [actor(item), item.targetId === item.actorId ? null : item.targetLabel].filter(Boolean).join(' · ') }}</span>
          </div>
        </li>
      </ul>
    </AbCard>

    <div v-if="pages.length < total" class="ac-more">
      <AbButton variant="outline" :loading="loading" @click="load(page + 1)">Muat lebih banyak</AbButton>
    </div>
  </AbPage>
</template>

<style scoped>
.ac-filter { width: 260px; }
.ac-center { display: grid; padding: 32px 0; place-items: center; }
.ac-list { margin: 0; padding: 0; list-style: none; }
.ac-item { display: flex; gap: 18px; padding: 13px 24px; border-top: 1px solid var(--ab-line); }
.ac-time { flex: none; width: 46px; padding-top: 1px; color: var(--ab-mute); font-size: 14px; font-weight: 700; }
.ac-text b { display: block; font-size: 15px; }
.ac-text span { display: block; color: var(--ab-mute); font-size: 13.5px; }
.ac-more { display: flex; justify-content: center; }
@media (max-width: 719px) {
  .ac-filter { width: 100%; }
  .ac-item { padding: 12px 16px; }
}
</style>
