<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';
import AccountFrame from '../layouts/AccountFrame.vue';

/** An address this site does not have: back to the admin for staff, home for everyone else. */
const session = useAuthSession();
const staff = computed(() => session.isAuthenticated.value);
</script>

<template>
  <AccountFrame>
    <div class="nf" data-testid="not-found-page">
      <p class="nf-code ab-display" aria-hidden="true">404</p>
      <h1>Halaman tidak ditemukan</h1>
      <p class="nf-lead">Alamatnya mungkin salah ketik, atau halamannya sudah dipindah.</p>
      <RouterLink :to="staff ? { name: 'dashboard' } : { name: 'home' }" class="nf-action">{{ staff ? 'Ke beranda admin' : 'Ke beranda' }}</RouterLink>
    </div>
  </AccountFrame>
</template>

<style scoped>
.nf { display: grid; gap: 10px; }
.nf-code { margin: 0; color: var(--ab-sma); font-size: 88px; }
.nf h1 { margin: 6px 0 0; font-family: var(--ab-display); font-size: 30px; font-weight: 800; letter-spacing: -.03em; }
.nf-lead { margin: 0 0 14px; color: var(--ab-ink-2); }
.nf-action { display: flex; height: 52px; align-items: center; justify-content: center; border-radius: 14px; background: var(--ab-sma); color: #fff !important; font-weight: 700; }
.nf-action:hover { background: var(--ab-sma-deep); }
</style>
