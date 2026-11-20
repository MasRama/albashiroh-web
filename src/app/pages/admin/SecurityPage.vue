<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { AUTH_SESSIONS_CHANGED_EVENT, encodeQr, qrSvgPath } from '../../../features/auth/web';
import { onServerEvent } from '../../../shared/realtime/browser';
import { AbBadge, AbButton, AbCard, AbCopy, AbDialog, AbField, AbPage, AbSpinner, dateTimeShort, showToast, useResource } from '../../../shared/ui';
import { accountClient, refusalText, type DeviceSession } from '../../account';

/**
 * Keamanan: the authenticator code asked after the password, its recovery
 * codes, and every device signed in to this account.
 */
const status = useResource(() => accountClient.twoFactor());
const twoFactor = computed(() => status.data.value?.twoFactor);
const devices = useResource(() => accountClient.sessions());
// A device signing in or out elsewhere shows here at once.
onUnmounted(onServerEvent(AUTH_SESSIONS_CHANGED_EVENT, () => void devices.reload()));
const sessions = computed(() => devices.data.value?.sessions ?? []);
const others = computed(() => sessions.value.filter((item) => !item.current).length);

/** "Chrome · Android" from a user agent, enough to tell devices apart. */
function deviceName(agent: string | null): string {
  if (!agent) return 'Perangkat tidak dikenal';
  const browser = /Edg\//.test(agent) ? 'Edge' : /SamsungBrowser/.test(agent) ? 'Samsung Internet' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const system = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iPhone' : /Windows/.test(agent) ? 'Windows' : /Mac OS X/.test(agent) ? 'Mac' : /Linux/.test(agent) ? 'Linux' : '';
  return system ? `${browser} · ${system}` : browser;
}
const deviceMeta = (item: DeviceSession) => [item.ipAddress, `aktif ${dateTimeShort(item.lastSeenAt ?? item.createdAt)}`].filter(Boolean).join(' · ');

// Turning the code on: password, then the key for the app, then one code from it.
type Step = 'password' | 'scan' | 'codes';
const enabling = ref(false);
const step = ref<Step>('password');
const password = ref('');
const code = ref('');
const secret = ref<{ secret: string; otpauthUrl: string } | null>(null);
// The QR code the authenticator app scans, with a 4-module quiet zone.
const qr = computed(() => {
  if (!secret.value) return null;
  const modules = encodeQr(secret.value.otpauthUrl);
  return { size: modules.length + 8, path: qrSvgPath(modules) };
});
const recoveryCodes = ref<string[]>([]);
const error = ref<string>();
const busy = ref(false);

function startEnable(): void {
  step.value = 'password';
  password.value = '';
  code.value = '';
  secret.value = null;
  recoveryCodes.value = [];
  error.value = undefined;
  enabling.value = true;
}

async function nextEnable(): Promise<void> {
  if (busy.value) return;
  error.value = undefined;
  if (step.value === 'codes') {
    enabling.value = false;
    return;
  }
  if (step.value === 'password') {
    if (!password.value) return void (error.value = 'Isi kata sandi Anda.');
    busy.value = true;
    const started = await accountClient.startTwoFactor(password.value);
    busy.value = false;
    password.value = '';
    if (!started.ok) return void (error.value = refusalText(started));
    secret.value = started.data;
    step.value = 'scan';
    return;
  }
  if (!/^\d{6}$/.test(code.value.trim())) return void (error.value = 'Isi 6 angka dari aplikasi authenticator.');
  busy.value = true;
  const enabled = await accountClient.enableTwoFactor(code.value.trim());
  busy.value = false;
  if (!enabled.ok) {
    code.value = '';
    return void (error.value = refusalText(enabled));
  }
  recoveryCodes.value = enabled.data.recoveryCodes;
  step.value = 'codes';
  await status.reload();
}

const enableTitle = computed(() => ({ password: 'Aktifkan verifikasi', scan: 'Hubungkan aplikasi', codes: 'Simpan kode pemulihan' })[step.value]);
const enableConfirm = computed(() => ({ password: 'Lanjut', scan: 'Aktifkan', codes: 'Selesai' })[step.value]);

// Turning it off or making new recovery codes: both need the password again.
const asking = ref<'disable' | 'codes' | null>(null);
function ask(kind: 'disable' | 'codes'): void {
  asking.value = kind;
  password.value = '';
  recoveryCodes.value = [];
  error.value = undefined;
}

async function confirmAsk(): Promise<void> {
  if (busy.value || !asking.value) return;
  if (recoveryCodes.value.length) {
    asking.value = null;
    return;
  }
  if (!password.value) return void (error.value = 'Isi kata sandi Anda.');
  busy.value = true;
  const kind = asking.value;
  const result = kind === 'disable' ? await accountClient.disableTwoFactor(password.value) : await accountClient.newRecoveryCodes(password.value);
  busy.value = false;
  password.value = '';
  if (!result.ok) return void (error.value = refusalText(result));
  await status.reload();
  if (kind === 'codes') recoveryCodes.value = (result.data as { recoveryCodes: string[] }).recoveryCodes;
  else {
    asking.value = null;
    showToast('Verifikasi dua langkah dimatikan', 'warn');
  }
}

async function revoke(item: DeviceSession): Promise<void> {
  const done = await accountClient.revokeSession(item.id);
  if (done.ok) showToast(`${deviceName(item.userAgent)} dikeluarkan`, 'good');
  else showToast(refusalText(done), 'bad');
  await devices.reload();
}

async function revokeOthers(): Promise<void> {
  const done = await accountClient.revokeOtherSessions();
  if (done.ok) showToast(done.data.revoked ? `${done.data.revoked} perangkat dikeluarkan` : 'Tidak ada perangkat lain', 'good');
  else showToast(refusalText(done), 'bad');
  await devices.reload();
}
</script>

<template>
  <AbPage title="Keamanan" description="Verifikasi dua langkah dan perangkat yang sedang masuk ke akun Anda." narrow data-testid="security-page">
    <AbCard
      title="Verifikasi dua langkah"
      :description="twoFactor?.enabled
        ? 'Setiap masuk, selain kata sandi Anda diminta 6 angka dari aplikasi authenticator.'
        : 'Tambahkan kode dari aplikasi authenticator (Google Authenticator, Authy, dan sejenisnya) setiap masuk, supaya kata sandi yang bocor saja tidak cukup.'"
    >
      <template #actions>
        <AbBadge v-if="twoFactor" :tone="twoFactor.enabled ? 'green' : 'gray'" dot>{{ twoFactor.enabled ? 'Aktif' : 'Belum aktif' }}</AbBadge>
      </template>
      <div v-if="!twoFactor && status.loading.value" class="sc-center"><AbSpinner /></div>
      <div v-else-if="twoFactor" class="sc-2fa">
        <p v-if="twoFactor.enabled" class="sc-left">
          Kode pemulihan tersisa: <b class="num" data-testid="two-factor-left">{{ twoFactor.recoveryCodesRemaining }}</b>
          <span v-if="!twoFactor.recoveryCodesRemaining"> · Buat yang baru supaya tetap bisa masuk tanpa ponsel.</span>
        </p>
        <div class="sc-actions">
          <AbButton v-if="!twoFactor.enabled" @click="startEnable">Aktifkan</AbButton>
          <template v-else>
            <AbButton variant="outline" @click="ask('codes')">Buat kode pemulihan baru</AbButton>
            <AbButton variant="danger" @click="ask('disable')">Matikan</AbButton>
          </template>
        </div>
      </div>
    </AbCard>

    <AbCard title="Perangkat yang masuk" :description="others ? undefined : 'Hanya perangkat ini yang sedang masuk ke akun Anda.'" flush>
      <template v-if="others" #actions>
        <AbButton variant="danger" size="sm" @click="revokeOthers">Keluarkan semua perangkat lain</AbButton>
      </template>
      <div v-if="!devices.data.value && devices.loading.value" class="sc-center"><AbSpinner /></div>
      <ul class="sc-devices">
        <li v-for="item in sessions" :key="item.id" class="sc-device" data-testid="session-row">
          <div>
            <b>{{ deviceName(item.userAgent) }}</b>
            <span>{{ deviceMeta(item) }}</span>
          </div>
          <AbBadge v-if="item.current" tone="green">Perangkat ini</AbBadge>
          <AbButton v-else variant="outline" size="sm" @click="revoke(item)">Keluarkan</AbButton>
        </li>
      </ul>
    </AbCard>

    <AbDialog :open="enabling" :title="enableTitle" :persistent="busy" @close="enabling = false">
      <form id="sc-enable" class="sc-form" novalidate @submit.prevent="nextEnable">
        <template v-if="step === 'password'">
          <p class="sc-text">Masukkan kata sandi Anda dulu untuk memastikan ini memang Anda.</p>
          <AbField v-model="password" label="Kata sandi" type="password" autocomplete="current-password" :error="error" />
        </template>
        <template v-else-if="step === 'scan' && secret">
          <div class="sc-step">
            <p class="sc-step-title">1. Tambahkan ke aplikasi</p>
            <p class="sc-text">Pindai kode QR ini dengan aplikasi authenticator di ponsel. Membuka halaman ini di ponsel? Tekan tombol di bawah, atau salin kuncinya dan tambahkan manual.</p>
            <svg v-if="qr" class="sc-qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" role="img" aria-label="Kode QR untuk aplikasi authenticator" shape-rendering="crispEdges" data-testid="two-factor-qr">
              <rect :width="qr.size" :height="qr.size" fill="#fff" />
              <path :d="qr.path" fill="#13211A" />
            </svg>
            <p class="sc-key" data-testid="two-factor-secret">{{ secret.secret.replace(/(.{4})/g, '$1 ').trim() }}</p>
            <div class="sc-actions">
              <AbButton variant="dark" :href="secret.otpauthUrl" data-testid="two-factor-link">Buka aplikasi authenticator</AbButton>
              <AbCopy :text="secret.secret" label="Salin kunci" />
            </div>
          </div>
          <div class="sc-step">
            <p class="sc-step-title">2. Masukkan kode dari aplikasi</p>
            <AbField v-model="code" label="Kode 6 angka" inputmode="numeric" autocomplete="one-time-code" :maxlength="6" placeholder="123456" :error="error" />
          </div>
        </template>
        <template v-else-if="step === 'codes'">
          <p class="sc-text">Simpan kode ini di tempat aman. Tiap kode bisa dipakai sekali untuk masuk bila ponsel Anda hilang.</p>
          <div class="sc-codes" data-testid="recovery-codes"><code v-for="item in recoveryCodes" :key="item">{{ item }}</code></div>
          <AbCopy :text="recoveryCodes.join('\n')" label="Salin semua kode" block />
        </template>
      </form>
      <template #footer>
        <AbButton v-if="step !== 'codes'" variant="outline" :disabled="busy" @click="enabling = false">Batal</AbButton>
        <AbButton type="submit" form="sc-enable" :loading="busy">{{ enableConfirm }}</AbButton>
      </template>
    </AbDialog>

    <AbDialog
      :open="asking !== null"
      :title="asking === 'disable' ? 'Matikan verifikasi?' : 'Kode pemulihan baru'"
      size="sm"
      :persistent="busy"
      @close="asking = null"
    >
      <template v-if="recoveryCodes.length">
        <p class="sc-text">Kode lama tidak berlaku lagi. Simpan yang baru di tempat aman.</p>
        <div class="sc-codes" data-testid="recovery-codes"><code v-for="item in recoveryCodes" :key="item">{{ item }}</code></div>
        <AbCopy :text="recoveryCodes.join('\n')" label="Salin semua kode" block />
      </template>
      <form v-else id="sc-ask" class="sc-form" novalidate @submit.prevent="confirmAsk">
        <p class="sc-text">{{ asking === 'disable' ? 'Setelah dimatikan, akun Anda cukup dibuka dengan kata sandi.' : 'Kode pemulihan yang lama langsung tidak berlaku.' }}</p>
        <AbField v-model="password" label="Kata sandi" type="password" autocomplete="current-password" :error="error" />
      </form>
      <template #footer>
        <AbButton v-if="recoveryCodes.length" @click="asking = null">Selesai</AbButton>
        <template v-else>
          <AbButton variant="outline" :disabled="busy" @click="asking = null">Batal</AbButton>
          <AbButton type="submit" form="sc-ask" :variant="asking === 'disable' ? 'danger' : 'primary'" :loading="busy">{{ asking === 'disable' ? 'Matikan' : 'Buat' }}</AbButton>
        </template>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.sc-center { display: grid; padding: 24px 0; place-items: center; }
.sc-2fa { display: grid; gap: 14px; }
.sc-left { margin: 0; color: var(--ab-ink-2); font-size: 14.5px; }
.sc-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.sc-devices { margin: 0; padding: 0; list-style: none; }
.sc-device { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 24px; border-top: 1px solid var(--ab-line); }
.sc-device b { display: block; font-size: 15px; }
.sc-device span { display: block; color: var(--ab-mute); font-size: 13.5px; }
.sc-form { display: grid; gap: 16px; }
.sc-text { margin: 0; color: var(--ab-ink-2); font-size: 14.5px; }
.sc-step { display: grid; gap: 10px; }
.sc-step-title { margin: 0; font-weight: 800; }
.sc-qr { width: 184px; height: 184px; border: 1px solid var(--ab-line); border-radius: 14px; }
.sc-key { margin: 0; padding: 12px 14px; border: 1px dashed var(--ab-line-strong); border-radius: 12px; font-family: var(--ab-mono); font-size: 15px; overflow-wrap: anywhere; }
.sc-codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sc-codes code { padding: 9px; border: 1px solid var(--ab-line); border-radius: 10px; font-family: var(--ab-mono); font-size: 14.5px; text-align: center; }
@media (max-width: 719px) { .sc-device { padding: 13px 16px; } }
</style>
