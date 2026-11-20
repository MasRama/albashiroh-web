<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../../features/auth/web';
import { AbButton, AbField, showToast } from '../../../shared/ui';
import { accountClient, refusalText } from '../../account';
import AccountFrame from '../../layouts/AccountFrame.vue';

/**
 * A new password. Accounts an administrator created or reset land here
 * before anything else (the router holds them until it is changed);
 * otherwise it is reached from Profil.
 */
const router = useRouter();
const session = useAuthSession();
const forced = computed(() => session.user.value?.mustChangePassword === true);

const current = ref('');
const next = ref('');
const again = ref('');
const busy = ref(false);
const failure = ref('');
const errors = ref<{ current?: string; next?: string; again?: string }>({});

async function save(): Promise<void> {
  if (busy.value) return;
  failure.value = '';
  errors.value = {
    current: current.value ? undefined : 'Isi kata sandi yang sekarang.',
    next: next.value.length >= 8 ? undefined : 'Minimal 8 karakter.',
    again: again.value === next.value ? undefined : 'Belum sama dengan kata sandi baru.',
  };
  if (errors.value.current || errors.value.next || errors.value.again) return;
  busy.value = true;
  // Read before the refresh below clears it.
  const wasForced = forced.value;
  const result = await accountClient.changePassword(current.value, next.value);
  if (!result.ok) {
    busy.value = false;
    if (result.code === 'INVALID_PASSWORD') errors.value = { current: 'Kata sandi yang sekarang salah.' };
    else failure.value = refusalText(result);
    return;
  }
  await session.refresh();
  busy.value = false;
  showToast('Kata sandi diganti', 'good');
  await router.replace(wasForced ? { name: 'dashboard' } : { name: 'profile' });
}

async function signOut(): Promise<void> {
  await session.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <AccountFrame>
    <div class="pw" data-testid="password-page">
      <h1 class="pw-title">{{ forced ? 'Buat kata sandi baru' : 'Ganti kata sandi' }}</h1>
      <p class="pw-lead">
        {{ forced
          ? 'Kata sandi Anda dibuat oleh administrator. Ganti dengan kata sandi milik Anda sendiri sebelum melanjutkan.'
          : 'Setelah diganti, perangkat lain yang memakai akun Anda akan dikeluarkan.' }}
      </p>
      <form class="pw-form" novalidate @submit.prevent="save">
        <AbField v-model="current" label="Kata sandi sekarang" type="password" autocomplete="current-password" :error="errors.current" :disabled="busy" />
        <AbField v-model="next" label="Kata sandi baru" type="password" autocomplete="new-password" hint="Minimal 8 karakter. Kalimat pendek yang mudah diingat lebih aman daripada kata acak yang pendek." :error="errors.next" :disabled="busy" />
        <AbField v-model="again" label="Ulangi kata sandi baru" type="password" autocomplete="new-password" :error="errors.again" :disabled="busy" />
        <p v-if="failure" class="pw-failure" role="alert">{{ failure }}</p>
        <AbButton type="submit" size="lg" block :loading="busy">Simpan kata sandi</AbButton>
      </form>
      <div class="pw-links">
        <button v-if="forced" type="button" @click="signOut">Keluar</button>
        <RouterLink v-else :to="{ name: 'profile' }">Batal</RouterLink>
      </div>
    </div>
  </AccountFrame>
</template>

<style scoped>
.pw { display: grid; gap: 18px; }
.pw-title { margin: 0; font-family: var(--ab-display); font-size: 32px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.pw-lead { margin: -6px 0 4px; color: var(--ab-ink-2); font-size: 15.5px; }
.pw-form { display: grid; gap: 16px; }
.pw-failure { margin: 0; color: var(--ab-red); font-size: 14.5px; font-weight: 700; }
.pw-links { display: flex; justify-content: center; }
.pw-links button, .pw-links a { padding: 6px 2px; border-bottom: 2px solid var(--ab-ink); font-size: 14px; font-weight: 700; }
</style>
