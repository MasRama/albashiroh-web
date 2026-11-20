<script setup lang="ts">
import { ArrowRight, ExternalLink } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../../features/auth/web';
import { AbPage } from '../../../shared/ui';
import { adminNavigation } from '../../navigation';

/**
 * Beranda admin: a greeting and a tile for every screen this account may
 * open, from the same list the sidebar shows.
 */
const router = useRouter();
const session = useAuthSession();
const firstName = computed(() => session.user.value?.name.trim().split(/\s+/)[0] ?? '');
const tiles = computed(() =>
  adminNavigation(router.options.routes, session.allows)
    .flatMap((group) => group.links.map((link) => ({ ...link, group: group.label })))
    .filter((link) => link.name !== 'dashboard'),
);
</script>

<template>
  <AbPage title="Beranda" data-testid="dashboard-page">
    <section class="db-hero">
      <p class="db-hello ab-display">Assalamu'alaikum{{ firstName ? `, ${firstName}` : '' }}.</p>
      <p class="db-lead">Dari panel ini Anda mengelola situs Yayasan Bashiroh Robbaniyah, portal SMP IT dan SMA IT Al Bashiroh, serta pendaftaran PPDB.</p>
      <a href="/" target="_blank" rel="noopener" class="db-site"><ExternalLink :size="17" />Lihat situs</a>
    </section>

    <div class="db-grid">
      <RouterLink v-for="tile in tiles" :key="tile.name" :to="{ name: tile.name }" class="db-tile">
        <span class="db-tile-icon"><component :is="tile.icon" v-if="tile.icon" :size="22" /></span>
        <span class="db-tile-group">{{ tile.group ?? 'Utama' }}</span>
        <b>{{ tile.label }}</b>
        <ArrowRight :size="18" class="db-tile-go" />
      </RouterLink>
    </div>
  </AbPage>
</template>

<style scoped>
.db-hero { display: grid; justify-items: start; gap: 14px; padding: 36px 40px; border-radius: var(--ab-radius-xl); background: var(--ab-forest); color: #fff; }
.db-hello { margin: 0; font-size: 44px; }
.db-lead { max-width: 640px; margin: 0; color: rgba(255, 255, 255, .78); font-size: 16.5px; }
.db-site { display: inline-flex; align-items: center; gap: 8px; height: 44px; margin-top: 6px; padding: 0 18px; border-radius: 12px; background: #fff; color: var(--ab-ink); font-size: 14.5px; font-weight: 700; }
.db-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.db-tile { position: relative; display: grid; gap: 4px; padding: 22px; border: 1px solid var(--ab-line); border-radius: var(--ab-radius-l); background: var(--ab-card); transition: border-color .15s; }
.db-tile:hover { border-color: var(--ab-line-strong); }
.db-tile-icon { display: grid; width: 46px; height: 46px; margin-bottom: 14px; place-items: center; border-radius: 13px; background: var(--ab-paper); color: var(--ab-forest); }
.db-tile-group { color: var(--ab-mute); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.db-tile b { font-family: var(--ab-display); font-size: 21px; font-weight: 800; letter-spacing: -.02em; }
.db-tile-go { position: absolute; top: 24px; right: 22px; color: var(--ab-mute); }
@media (max-width: 719px) {
  .db-hero { padding: 26px 22px; border-radius: var(--ab-radius-l); }
  .db-hello { font-size: 32px; }
}
</style>
