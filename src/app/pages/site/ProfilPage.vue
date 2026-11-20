<script setup lang="ts">
import { ArrowRight, UserRound } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PageHead from '../../site/components/PageHead.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { LOGO, pageTitle, portalImage, usePortal, useTitle } from '../../site/site';
import { siteRouteName, SITE_PORTAL_NAMES, type SitePortal } from '../../site-map';

/**
 * A portal's profile: its history and description, vision and mission, the
 * head's foreword, and its figures. The Yayasan's also leads to its two
 * schools and its programmes.
 */
const props = defineProps<{ portal: SitePortal }>();
const data = usePortal(() => props.portal);
const settings = computed(() => data.value?.settings);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
useTitle(() => pageTitle(props.portal, 'Profil'));

const prakataPhoto = computed(() => portalImage(data.value, settings.value?.prakata.photoId));
const stats = computed(() => (settings.value?.stats ?? []).filter((stat) => stat.value));
const hasProfile = computed(() => Boolean(settings.value && (settings.value.profil || settings.value.visi || settings.value.misi.length)));
</script>

<template>
  <div class="pp">
    <PageHead
      kicker="Profil"
      :title="names.name"
      :intro="settings?.tagline || undefined"
      :crumbs="[{ label: 'Beranda', to: { name: siteRouteName(portal, 'home') } }]"
    />

    <section class="s-body">
      <div class="s-wrap">
        <div v-if="data === null" class="s-skeleton pp-skeleton" />
        <div v-else-if="!hasProfile" class="s-empty"><b>Profil sedang disiapkan.</b><span>Sejarah, visi, dan misi akan tampil di sini.</span></div>
        <div v-else class="pp-grid">
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
          <article v-if="settings?.profil" class="s-card pp-story ab-prose" v-html="settings.profil" />
          <aside class="pp-side">
            <div v-if="settings?.visi" class="pp-visi">
              <div class="s-kick">Visi</div>
              <p>{{ settings.visi }}</p>
            </div>
            <div v-if="settings?.misi.length" class="s-card pp-misi">
              <div class="s-kick">Misi</div>
              <ol>
                <li v-for="(line, index) in settings.misi" :key="index"><b>{{ String(index + 1).padStart(2, '0') }}</b><span>{{ line }}</span></li>
              </ol>
            </div>
            <dl v-if="stats.length" class="pp-stats">
              <div v-for="stat in stats" :key="stat.label + stat.value"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div>
            </dl>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="settings?.prakata.body" class="s-sec">
      <div class="s-wrap">
        <div class="pp-head">
          <div class="pp-head-photo">
            <SitePhoto v-if="prakataPhoto" :image="prakataPhoto" :title="settings.prakata.name || 'Sambutan'" sizes="(max-width: 640px) 100vw, 360px" />
            <div v-else class="pp-head-empty"><UserRound :size="44" :stroke-width="1.4" aria-hidden="true" /></div>
          </div>
          <div class="pp-head-text">
            <div class="s-kick">{{ portal === 'yayasan' ? 'Sambutan ketua yayasan' : 'Prakata kepala sekolah' }}</div>
            <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
            <div class="ab-prose pp-prakata" v-html="settings.prakata.body" />
            <p v-if="settings.prakata.name" class="pp-sign"><b>{{ settings.prakata.name }}</b><span v-if="settings.prakata.role">{{ settings.prakata.role }}</span></p>
          </div>
        </div>
      </div>
    </section>

    <section v-if="portal === 'yayasan'" class="s-sec">
      <div class="s-wrap">
        <div class="s-head"><div><div class="s-kick">Di bawah yayasan</div><h2 class="s-h2">Dua sekolah dan dua program.</h2></div></div>
        <div class="pp-links">
          <RouterLink v-for="school in (['smp', 'sma'] as const)" :key="school" :to="{ name: siteRouteName(school, 'home') }" class="s-tile" :class="school === 'smp' ? 'pp-smp' : 'pp-sma'">
            <span class="pp-logo"><img :src="LOGO[school]" alt="" width="52" height="52" loading="lazy" /></span>
            <div><h3>{{ SITE_PORTAL_NAMES[school].name }}</h3><p>Portal jenjang {{ school.toUpperCase() }}</p></div>
          </RouterLink>
          <RouterLink :to="{ name: siteRouteName('yayasan', 'takhosus') }" class="s-tile s-tile--ink">
            <span class="pp-num" aria-hidden="true">30</span>
            <div><h3>Takhosus Al-Qur'an</h3><p>Program hafalan 30 juz</p></div>
          </RouterLink>
          <RouterLink :to="{ name: siteRouteName('yayasan', 'keasramaan') }" class="s-tile s-tile--sun">
            <span class="pp-num" aria-hidden="true"><ArrowRight :size="30" /></span>
            <div><h3>Keasramaan</h3><p>Kehidupan asrama santri</p></div>
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pp-skeleton { height: 420px; }
.pp-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); align-items: start; gap: 24px; }
.pp-story { font-size: 17.5px; }
.pp-side { display: grid; gap: 20px; }
.pp-grid > .pp-side:only-child { grid-column: span 2; grid-template-columns: 1fr 1fr; }
.pp-visi { padding: 36px; border-radius: 28px; background: var(--ab-ink); color: #fff; }
.pp-visi .s-kick { color: var(--ab-sun); }
.pp-visi p { margin: 14px 0 0; font-family: var(--ab-display); font-size: 28px; font-weight: 800; letter-spacing: -.025em; line-height: 1.15; }
.pp-misi ol { display: grid; gap: 16px; margin: 16px 0 0; padding: 0; list-style: none; }
.pp-misi li { display: flex; gap: 14px; font-size: 15.5px; font-weight: 600; line-height: 1.45; }
.pp-misi li b { flex: none; color: var(--acc); font-family: var(--ab-display); font-size: 20px; font-weight: 800; line-height: 1.1; }
.pp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 0; }
.pp-stats div { display: flex; flex-direction: column-reverse; padding: 20px; border-radius: 20px; background: var(--acc); color: #fff; }
.pp-stats dd { margin: 0; font-family: var(--ab-display); font-size: 32px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.pp-stats dt { margin-top: 6px; font-size: 13.5px; font-weight: 600; opacity: .85; }

.pp-head { display: grid; grid-template-columns: 360px 1fr; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 28px; background: #fff; }
.pp-head-photo { min-height: 420px; background: var(--ab-paper-2); }
.pp-head-empty { display: grid; height: 100%; place-items: center; color: var(--ab-mute); }
.pp-head-text { padding: 48px 52px; }
.pp-prakata { margin-top: 18px; font-size: 17px; }
.pp-sign { margin: 26px 0 0; padding-top: 18px; border-top: 1px solid var(--ab-line); }
.pp-sign b { display: block; font-size: 17px; font-weight: 800; }
.pp-sign span { color: var(--ab-mute); font-size: 14.5px; }

.pp-links { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 260px; gap: 20px; }
.pp-smp { background: var(--ab-smp); }
.pp-sma { background: var(--ab-sma); }
.pp-logo { display: grid; width: 60px; height: 60px; place-items: center; margin-bottom: auto; padding: 9px; border-radius: 16px; background: #fff; }
.pp-logo img { width: 100%; height: 100%; object-fit: contain; }
.pp-num { margin-bottom: auto; font-family: var(--ab-display); font-size: 56px; font-weight: 800; letter-spacing: -.05em; line-height: .9; }
.s-tile--ink .pp-num { color: var(--ab-sun); }

@media (max-width: 960px) {
  .pp-grid, .pp-head { grid-template-columns: minmax(0, 1fr); }
  .pp-grid > .pp-side:only-child { grid-column: auto; grid-template-columns: minmax(0, 1fr); }
  .pp-head-photo { min-height: 340px; }
  .pp-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .pp-story { font-size: 16px; }
  .pp-visi { padding: 26px 22px; border-radius: 24px; }
  .pp-visi p { font-size: 23px; }
  .pp-head { border-radius: 24px; }
  .pp-head-photo { min-height: 280px; }
  .pp-head-text { padding: 26px 22px; }
  .pp-prakata { font-size: 15.5px; }
  .pp-links { grid-auto-rows: 190px; gap: 12px; }
  .pp-logo { width: 48px; height: 48px; padding: 7px; border-radius: 13px; }
  .pp-num { font-size: 42px; }
}
</style>
