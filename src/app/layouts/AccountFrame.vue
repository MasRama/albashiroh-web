<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { AbToaster } from '../../shared/ui';
import BrandMark from '../brand/BrandMark.vue';

/**
 * The frame of the screens outside the admin shell (sign in, a forced new
 * password, a missing page): one white card on paper, with the Yayasan's
 * forest block beside it on wide screens.
 */
</script>

<template>
  <div class="ab af">
    <aside class="af-block" aria-hidden="true">
      <BrandMark tone="light" />
      <div class="af-block-text">
        <p class="af-block-title ab-display">Generasi Qur'ani yang <em>bertaqwa, berilmu,</em> dan mandiri.</p>
        <p class="af-block-sub">Panel admin situs Yayasan, SMP IT dan SMA IT Al Bashiroh.</p>
      </div>
      <div class="af-block-foot">
        <span><b>30</b> juz</span>
        <span>Takhosus Al-Qur'an</span>
      </div>
    </aside>
    <main class="af-main">
      <RouterLink :to="{ name: 'home' }" class="af-brand"><BrandMark /></RouterLink>
      <div class="af-card"><slot /></div>
      <p class="af-foot">© {{ new Date().getFullYear() }} Yayasan Bashiroh Robbaniyah</p>
    </main>
    <AbToaster />
  </div>
</template>

<style scoped>
.af { display: grid; min-height: 100dvh; grid-template-columns: 1fr; }
.af-block { display: none; }
.af-main { display: flex; min-width: 0; flex-direction: column; align-items: center; padding: calc(20px + var(--ab-safe-top)) 16px calc(24px + var(--ab-safe-bottom)); }
.af-brand { align-self: flex-start; }
.af-card { width: 100%; max-width: 460px; margin: auto 0; padding: 32px 28px; border: 1px solid var(--ab-line); border-radius: var(--ab-radius-xl); background: var(--ab-card); }
.af-foot { margin: 24px 0 0; color: var(--ab-mute); font-size: 13px; }

@media (max-width: 719px) {
  .af-card { margin-top: 28px; padding: 26px 20px; border-radius: var(--ab-radius-l); }
}

@media (min-width: 1024px) {
  .af { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0; padding: 16px; }
  .af-block {
    display: flex;
    flex-direction: column;
    padding: 40px 48px;
    border-radius: 32px;
    background: var(--ab-forest);
    color: #fff;
  }
  .af-block-text { margin-top: auto; }
  .af-block-title { max-width: 520px; margin: 0; font-size: clamp(44px, 4.6vw, 68px); }
  .af-block-title em { color: var(--ab-sun); font-style: normal; }
  .af-block-sub { max-width: 440px; margin: 22px 0 0; color: rgba(255, 255, 255, .74); font-size: 17px; }
  .af-block-foot { display: flex; align-items: baseline; gap: 14px; margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, .14); color: rgba(255, 255, 255, .7); font-size: 14px; font-weight: 600; }
  .af-block-foot span:first-child { color: #fff; font-family: var(--ab-display); font-size: 24px; font-weight: 800; }
  .af-block-foot b { color: var(--ab-sun); font-size: 40px; letter-spacing: -.04em; }
  .af-main { padding: 32px 40px; }
  .af-brand { visibility: hidden; }
}
</style>
