<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SESSION_ENDED_REASON, useAuthSession } from '../../../features/auth/web';
import { AbButton, AbField, AbNotice } from '../../../shared/ui';
import { accountClient, redirectTarget, refusalText } from '../../account';
import AccountFrame from '../../layouts/AccountFrame.vue';

/** Staff sign in: email and password, then the authenticator code when the account has one. */
const route = useRoute();
const router = useRouter();
const session = useAuthSession();

const step = ref<'password' | 'code'>('password');
const email = ref('');
const password = ref('');
const code = ref('');
const recovery = ref(false);
const busy = ref(false);
const failure = ref('');
const errors = ref<{ email?: string; password?: string; code?: string }>({});
const form = ref<HTMLFormElement>();
const ended = computed(() => route.query.reason === SESSION_ENDED_REASON);

async function finish(): Promise<void> {
  if (!(await session.refresh())) {
    failure.value = 'Berhasil masuk, tetapi akun belum bisa dimuat. Muat ulang halaman ini.';
    return;
  }
  await router.replace(redirectTarget(route.query.redirect));
}

async function signIn(): Promise<void> {
  if (busy.value) return;
  failure.value = '';
  errors.value = {
    email: email.value.trim() ? undefined : 'Isi email akun Anda.',
    password: password.value ? undefined : 'Isi kata sandi.',
  };
  if (errors.value.email || errors.value.password) return;
  busy.value = true;
  const result = await accountClient.login(email.value.trim(), password.value);
  busy.value = false;
  if (!result.ok) {
    failure.value = refusalText(result);
    return;
  }
  if (result.data.twoFactorRequired) {
    password.value = '';
    step.value = 'code';
    await focusCode();
    return;
  }
  busy.value = true;
  await finish();
  busy.value = false;
}

async function verify(): Promise<void> {
  if (busy.value) return;
  failure.value = '';
  const value = code.value.trim();
  const valid = recovery.value ? value.length > 0 : /^\d{6}$/.test(value);
  errors.value = { code: valid ? undefined : recovery.value ? 'Isi salah satu kode pemulihan.' : 'Isi 6 angka dari aplikasi authenticator.' };
  if (!valid) return;
  busy.value = true;
  const result = await accountClient.completeTwoFactor(recovery.value ? { recovery_code: value } : { code: value });
  if (result.ok) {
    await finish();
    busy.value = false;
    return;
  }
  busy.value = false;
  if (result.code === 'TWO_FACTOR_CHALLENGE_EXPIRED' || result.code === 'TWO_FACTOR_LOCKED') startOver();
  code.value = '';
  failure.value = refusalText(result);
}

async function focusCode(): Promise<void> {
  await nextTick();
  form.value?.querySelector('input')?.focus();
}

async function toggleRecovery(): Promise<void> {
  recovery.value = !recovery.value;
  code.value = '';
  failure.value = '';
  errors.value = {};
  await focusCode();
}

function startOver(): void {
  step.value = 'password';
  recovery.value = false;
  code.value = '';
  errors.value = {};
}
</script>

<template>
  <AccountFrame>
    <div class="si" data-testid="sign-in-page">
      <template v-if="step === 'password'">
        <h1 class="si-title">Masuk ke panel admin</h1>
        <p class="si-lead">Kelola isi situs Yayasan, portal SMP dan SMA, serta data pendaftar PPDB.</p>
        <AbNotice v-if="ended" tone="info">Sesi Anda sudah berakhir. Silakan masuk lagi untuk melanjutkan.</AbNotice>
        <form ref="form" class="si-form" novalidate @submit.prevent="signIn">
          <AbField v-model="email" label="Email" type="email" inputmode="email" autocomplete="username" placeholder="nama@albashiroh.sch.id" :error="errors.email" :disabled="busy" />
          <AbField v-model="password" label="Kata sandi" type="password" autocomplete="current-password" :error="errors.password" :disabled="busy" />
          <p v-if="failure" class="si-failure" role="alert">{{ failure }}</p>
          <AbButton type="submit" size="lg" block :loading="busy">Masuk</AbButton>
        </form>
        <p class="si-foot">Belum punya akun? Minta administrator sekolah membuatkannya.</p>
      </template>

      <template v-else>
        <h1 class="si-title">Verifikasi dua langkah</h1>
        <p class="si-lead">
          {{ recovery ? 'Masukkan salah satu kode pemulihan yang Anda simpan.' : 'Buka aplikasi authenticator, lalu masukkan 6 angka untuk Al Bashiroh.' }}
        </p>
        <form ref="form" class="si-form" novalidate @submit.prevent="verify">
          <AbField
            v-model="code"
            :label="recovery ? 'Kode pemulihan' : 'Kode authenticator'"
            :inputmode="recovery ? 'text' : 'numeric'"
            autocomplete="one-time-code"
            :maxlength="recovery ? 64 : 6"
            :placeholder="recovery ? 'xxxx-xxxx' : '123456'"
            :error="errors.code"
            :disabled="busy"
          />
          <p v-if="failure" class="si-failure" role="alert">{{ failure }}</p>
          <AbButton type="submit" size="lg" block :loading="busy">Verifikasi</AbButton>
        </form>
        <div class="si-links">
          <button type="button" @click="toggleRecovery">{{ recovery ? 'Pakai kode authenticator' : 'Pakai kode pemulihan' }}</button>
          <button type="button" @click="startOver">Masuk dengan akun lain</button>
        </div>
      </template>
    </div>
  </AccountFrame>
</template>

<style scoped>
.si { display: grid; gap: 18px; }
.si-title { margin: 0; font-family: var(--ab-display); font-size: 32px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.si-lead { margin: -6px 0 4px; color: var(--ab-ink-2); font-size: 15.5px; }
.si-form { display: grid; gap: 16px; }
.si-failure { margin: 0; color: var(--ab-red); font-size: 14.5px; font-weight: 700; }
.si-foot { margin: 4px 0 0; color: var(--ab-mute); font-size: 13.5px; text-align: center; }
.si-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; }
.si-links button { padding: 6px 2px; border-bottom: 2px solid var(--ab-ink); color: var(--ab-ink); font-size: 14px; font-weight: 700; }
</style>
