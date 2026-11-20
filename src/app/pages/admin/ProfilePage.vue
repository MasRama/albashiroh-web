<script setup lang="ts">
import { KeyRound, ShieldCheck } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthSession } from '../../../features/auth/web';
import { AbAvatar, AbButton, AbCard, AbEmpty, AbField, AbPage, AbSpinner, showToast, useResource } from '../../../shared/ui';
import { accountClient, mergeStale, refusalText, roleLabel, type Profile } from '../../account';

/** Profil: the signed-in account's name and email, and the way to its password and devices. */
const session = useAuthSession();
const state = useResource(() => accountClient.profile());
const profile = computed(() => state.data.value?.user);
const roles = computed(() => (session.user.value?.roles ?? []).map((slug) => roleLabel({ slug, name: slug })).join(', '));

const draft = reactive({ name: '', email: '' });
const errors = ref<{ name?: string; email?: string }>({});
const busy = ref(false);
const fields = (value: Profile) => ({ name: value.name, email: value.email });
// Filled once per account; a refused save merges into the draft instead.
watch(() => profile.value?.id, () => profile.value && Object.assign(draft, fields(profile.value)), { immediate: true });
const changed = computed(() => profile.value !== undefined && (draft.name.trim() !== profile.value.name || draft.email.trim() !== profile.value.email));

async function save(): Promise<void> {
  const value = profile.value;
  if (!value || busy.value) return;
  errors.value = {
    name: draft.name.trim() ? undefined : 'Isi nama.',
    email: /^\S+@\S+\.\S+$/.test(draft.email.trim()) ? undefined : 'Isi email yang benar.',
  };
  if (errors.value.name || errors.value.email) return;
  busy.value = true;
  const saved = await accountClient.saveProfile({ revision: value.revision, name: draft.name.trim(), email: draft.email.trim() });
  busy.value = false;
  if (saved.ok) {
    state.data.value = { user: saved.data.user };
    await session.refresh();
    showToast('Profil disimpan', 'good');
  } else if (saved.code === 'STALE_REVISION' && saved.current) {
    const current = saved.current as Profile;
    showToast('Profil baru saja diubah dari perangkat lain. Perubahan Anda digabung; periksa, lalu simpan lagi.', 'warn');
    Object.assign(draft, mergeStale(fields(value), { ...draft }, fields(current)));
    state.data.value = { user: current };
  } else if (saved.code === 'DUPLICATE_EMAIL') {
    errors.value = { email: refusalText(saved) };
  } else {
    showToast(refusalText(saved), 'bad');
  }
}
</script>

<template>
  <AbPage title="Profil" description="Nama dan email akun Anda, serta keamanannya." narrow data-testid="profile-page">
    <div v-if="!profile && state.loading.value" class="pf-center"><AbSpinner /></div>
    <AbCard v-else-if="!profile">
      <AbEmpty title="Profil belum bisa dimuat" :text="state.error.value ?? undefined">
        <AbButton variant="outline" @click="state.reload()">Coba lagi</AbButton>
      </AbEmpty>
    </AbCard>
    <template v-else>
      <AbCard>
        <div class="pf-head">
          <AbAvatar :name="profile.name" :size="64" />
          <div>
            <p class="pf-name">{{ profile.name }}</p>
            <p class="pf-roles">{{ roles || 'Belum punya peran' }}</p>
          </div>
        </div>
      </AbCard>

      <AbCard title="Data diri">
        <form class="pf-form" novalidate @submit.prevent="save">
          <AbField v-model="draft.name" label="Nama" autocomplete="name" :error="errors.name" :disabled="busy" />
          <AbField v-model="draft.email" label="Email" type="email" inputmode="email" autocomplete="email" :error="errors.email" :disabled="busy" />
          <div><AbButton type="submit" :loading="busy" :disabled="!changed">Simpan perubahan</AbButton></div>
        </form>
      </AbCard>

      <AbCard title="Keamanan" flush>
        <RouterLink :to="{ name: 'change-password' }" class="pf-link"><KeyRound :size="19" /><span>Ganti kata sandi</span></RouterLink>
        <RouterLink :to="{ name: 'security' }" class="pf-link"><ShieldCheck :size="19" /><span>Verifikasi dua langkah dan perangkat</span></RouterLink>
      </AbCard>
    </template>
  </AbPage>
</template>

<style scoped>
.pf-center { display: grid; padding: 48px 0; place-items: center; }
.pf-head { display: flex; align-items: center; gap: 18px; }
.pf-name { margin: 0; font-family: var(--ab-display); font-size: 24px; font-weight: 800; letter-spacing: -.025em; }
.pf-roles { margin: 2px 0 0; color: var(--ab-mute); font-size: 14.5px; font-weight: 600; }
.pf-form { display: grid; gap: 16px; }
.pf-link { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--ab-line); font-weight: 700; }
.pf-link:hover { background: #FBF9F4; }
.pf-link :deep(svg) { color: var(--ab-forest); }
@media (max-width: 719px) { .pf-link { padding: 15px 16px; } }
</style>
