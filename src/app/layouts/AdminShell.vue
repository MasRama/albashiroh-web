<script setup lang="ts">
import { ExternalLink, LogOut, Menu, ShieldCheck, UserRound, X } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';
import { provideMediaClient } from '../../features/media/web';
import { AbAvatar, AbToaster } from '../../shared/ui';
import { roleLabel } from '../account';
import { mediaClient } from '../cms';
import BrandMark from '../brand/BrandMark.vue';
import { adminNavigation, sectionOf } from '../navigation';

/**
 * The admin panel's frame: a forest sidebar on wide screens, a white top bar
 * with a drawer on phones. The sidebar lists every admin screen the session
 * may open (the same rule its API enforces), grouped as `navigation.ts`
 * says, with the account and the way out at the bottom.
 */
const route = useRoute();
// Every photo and document field in the panel uploads through this client.
provideMediaClient(mediaClient);
const router = useRouter();
const session = useAuthSession();

const groups = computed(() => adminNavigation(router.options.routes, session.allows));
const section = computed(() => sectionOf(route));
const user = computed(() => session.user.value);
const roles = computed(() => (user.value?.roles ?? []).map((slug) => roleLabel({ slug, name: slug })).join(', ') || 'Tanpa peran');

const drawer = ref(false);
watch(() => route.fullPath, () => (drawer.value = false));
watch(drawer, (open) => document.body.classList.toggle('ab-locked', open));

const leaving = ref(false);
async function signOut(): Promise<void> {
  if (leaving.value) return;
  leaving.value = true;
  await session.logout();
  leaving.value = false;
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="ab admin" data-testid="admin-shell">
    <a href="#admin-main" class="admin-skip">Lompat ke isi</a>

    <header class="admin-bar">
      <RouterLink :to="{ name: 'dashboard' }" class="admin-bar-brand" aria-label="Beranda admin"><BrandMark caption="Panel admin" /></RouterLink>
      <button type="button" class="admin-bar-menu" aria-label="Buka menu" :aria-expanded="drawer" aria-controls="admin-side" @click="drawer = true">
        <Menu :size="22" />
      </button>
    </header>

    <div v-if="drawer" class="admin-scrim" aria-hidden="true" @click="drawer = false" />

    <aside id="admin-side" class="admin-side" :class="{ 'admin-side--open': drawer }" aria-label="Navigasi admin">
      <div class="admin-side-top">
        <RouterLink :to="{ name: 'dashboard' }" class="admin-side-brand"><BrandMark tone="light" caption="Panel admin" /></RouterLink>
        <button type="button" class="admin-side-close" aria-label="Tutup menu" @click="drawer = false"><X :size="20" /></button>
      </div>

      <nav class="admin-nav">
        <div v-for="group in groups" :key="group.key" class="admin-nav-group">
          <p v-if="group.label" class="admin-nav-label">{{ group.label }}</p>
          <RouterLink
            v-for="link in group.links"
            :key="link.name"
            :to="{ name: link.name }"
            class="admin-nav-link"
            :class="{ on: section === link.section }"
            :aria-current="section === link.section ? 'page' : undefined"
          >
            <component :is="link.icon" v-if="link.icon" :size="19" />
            {{ link.label }}
          </RouterLink>
        </div>
      </nav>

      <div class="admin-side-foot">
        <a href="/" class="admin-nav-link" target="_blank" rel="noopener"><ExternalLink :size="19" />Lihat situs</a>
        <div v-if="user" class="admin-me">
          <AbAvatar :name="user.name" :size="38" />
          <div class="admin-me-text">
            <b>{{ user.name }}</b>
            <span>{{ roles }}</span>
          </div>
        </div>
        <div class="admin-me-links">
          <RouterLink :to="{ name: 'profile' }" class="admin-me-link" :class="{ on: section === 'profile' }"><UserRound :size="17" />Profil</RouterLink>
          <RouterLink :to="{ name: 'security' }" class="admin-me-link" :class="{ on: section === 'security' }"><ShieldCheck :size="17" />Keamanan</RouterLink>
          <button type="button" class="admin-me-link" :disabled="leaving" @click="signOut"><LogOut :size="17" />Keluar</button>
        </div>
      </div>
    </aside>

    <main id="admin-main" class="admin-main" tabindex="-1"><slot /></main>
    <AbToaster />
  </div>
</template>

<style scoped>
.admin { min-height: 100dvh; }
.admin-skip { position: absolute; top: -60px; left: 16px; z-index: 3000; padding: 10px 14px; border-radius: 10px; background: var(--ab-sun); color: var(--ab-ink); font-weight: 800; }
.admin-skip:focus { top: 12px; }

.admin-bar {
  position: sticky;
  top: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: calc(64px + var(--ab-safe-top));
  padding: var(--ab-safe-top) 12px 0 16px;
  border-bottom: 1px solid var(--ab-line);
  background: var(--ab-card);
}
.admin-bar-menu { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 12px; background: var(--ab-paper-2); }

.admin-scrim { position: fixed; inset: 0; z-index: 1490; background: rgba(10, 24, 16, .5); }
.admin-side {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 1500;
  display: flex;
  width: min(300px, 86vw);
  flex-direction: column;
  overflow-y: auto;
  padding: calc(18px + var(--ab-safe-top)) 14px calc(18px + var(--ab-safe-bottom));
  background: var(--ab-forest);
  color: #fff;
  transform: translateX(-100%);
  transition: transform .28s cubic-bezier(.32, .72, 0, 1);
  visibility: hidden;
}
.admin-side--open { transform: none; visibility: visible; }
.admin-side-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 6px 22px; }
.admin-side-close { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; background: rgba(255, 255, 255, .1); color: #fff; }

.admin-nav { display: grid; gap: 18px; }
.admin-nav-group { display: grid; gap: 2px; }
.admin-nav-label { margin: 0 0 6px; padding: 0 12px; color: rgba(255, 255, 255, .5); font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.admin-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  color: rgba(255, 255, 255, .78);
  font-size: 14.5px;
  font-weight: 700;
}
.admin-nav-link:hover { background: rgba(255, 255, 255, .08); color: #fff; }
.admin-nav-link.on { background: #fff; color: var(--ab-forest); }
.admin-nav-link :deep(svg) { flex: none; }

.admin-side-foot { display: grid; gap: 10px; margin-top: auto; padding-top: 24px; }
.admin-me { display: flex; align-items: center; gap: 12px; padding: 14px 12px 4px; border-top: 1px solid rgba(255, 255, 255, .14); }
.admin-me :deep(.ab-avatar) { background: var(--ab-sun); color: var(--ab-ink); }
.admin-me-text { min-width: 0; }
.admin-me-text b { display: block; overflow: hidden; font-size: 14.5px; text-overflow: ellipsis; white-space: nowrap; }
.admin-me-text span { display: block; overflow: hidden; color: rgba(255, 255, 255, .62); font-size: 12.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.admin-me-links { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 6px; }
.admin-me-link { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 10px; color: rgba(255, 255, 255, .78); font-size: 13px; font-weight: 700; }
.admin-me-link:hover, .admin-me-link.on { background: rgba(255, 255, 255, .1); color: #fff; }

.admin-main { min-width: 0; outline: 0; }

@media (min-width: 1024px) {
  .admin { display: grid; grid-template-columns: 272px minmax(0, 1fr); }
  .admin-bar, .admin-scrim, .admin-side-close { display: none; }
  .admin-side {
    position: sticky;
    width: auto;
    height: 100dvh;
    transform: none;
    transition: none;
    visibility: visible;
  }
}
@media (prefers-reduced-motion: reduce) {
  .admin-side { transition: none; }
}
</style>
