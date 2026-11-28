<script setup lang="ts">
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, LayoutGrid, Trophy, UserRound } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import AgendaPanel from '../../site/components/AgendaPanel.vue';
import FaqList from '../../site/components/FaqList.vue';
import NewsCard from '../../site/components/NewsCard.vue';
import PpdbBlock from '../../site/components/PpdbBlock.vue';
import ProfileVideo from '../../site/components/ProfileVideo.vue';
import SiteHero from '../../site/components/SiteHero.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { LOGO, pageTitle, portalImage, splitTarget, useEntries, useHome, usePortal, useTitle, whatsappLink } from '../../site/site';
import { entryPath, siteRouteName, SITE_PORTAL_NAMES } from '../../site-map';

/**
 * A school's portal home, as in the approved SMA mockup: the hero with the
 * school's vision, the profile video, the head's foreword with the mission,
 * academics, clubs, graduate competencies, news beside the agenda,
 * achievements (and alumni at the SMA), questions, and PPDB. A section with
 * nothing published stays out; the school sets each section's words in the
 * admin, and may take one off.
 */
const props = defineProps<{ portal: 'smp' | 'sma' }>();
const data = usePortal(() => props.portal);
const settings = computed(() => data.value?.settings);
const home = useHome(() => props.portal, data);
const names = computed(() => SITE_PORTAL_NAMES[props.portal]);
useTitle(() => pageTitle(props.portal, null, settings.value));

const list = (type: 'berita' | 'agenda' | 'akademik' | 'ekskul' | 'prestasi' | 'alumni' | 'faq', limit: number, upcoming = false) =>
  useEntries(() => (type === 'alumni' && props.portal !== 'sma' ? null : { portal: props.portal, type, query: { limit, upcoming } }));
const news = list('berita', 3);
const agenda = list('agenda', 3, true);
const academics = list('akademik', 3);
const clubs = list('ekskul', 3);
const achievements = list('prestasi', 3);
const alumni = list('alumni', 1);
const faq = list('faq', 4);

const route = (key: string) => ({ name: siteRouteName(props.portal, key) });
const entry = (type: string, slug: string) => entryPath(props.portal, type, slug) ?? `/${props.portal}`;

const DEFAULTS = {
  smp: { title: "Generasi Qur'ani yang *unggul dan mandiri.*", intro: 'SMP Islam Terpadu di bawah Yayasan Bashiroh Robbaniyah, Turen. Hafalan Al-Qur\'an, adab, dan prestasi akademik dalam satu lingkungan belajar.' },
  sma: { title: 'Wujudkan generasi *bertaqwa & berprestasi.*', intro: 'SMA Islam Terpadu di bawah Yayasan Bashiroh Robbaniyah, Turen. Pembinaan akhlak, kecerdasan intelektual, dan kemandirian dalam satu lingkungan belajar.' },
} as const;

const stats = computed(() => {
  const own = settings.value?.stats.filter((stat) => stat.value) ?? [];
  if (own.length) return own;
  const derived = (settings.value?.kompetensi ?? []).filter((row) => row.name && splitTarget(row.target)).slice(0, 2).map((row) => ({ value: row.target, label: row.name }));
  return settings.value?.accreditation ? [{ value: settings.value.accreditation, label: 'Akreditasi' }, ...derived] : derived;
});

const prakataPhoto = computed(() => portalImage(data.value, settings.value?.prakata.photoId));
const misi = computed(() => settings.value?.misi ?? []);

// The big number on the competency block: the first target that starts with one, as "42 hadits".
const headline = computed(() => {
  for (const row of settings.value?.kompetensi ?? []) {
    const split = splitTarget(row.target);
    if (split && row.name) return { ...split, name: row.name };
  }
  return null;
});
const competencies = computed(() => (settings.value?.kompetensi ?? []).filter((row) => row.name));

const ACADEMIC_ICONS = [LayoutGrid, CalendarDays, BookOpen];
const whatsapp = computed(() =>
  settings.value?.contact.whatsapp ? whatsappLink(settings.value.contact.whatsapp, `Assalamualaikum, saya ingin bertanya tentang ${names.value.name}.`) : null,
);
const shownAchievements = computed(() => (home.shown('prestasi') ? achievements.page.value?.items ?? [] : []));
const shownAlumni = computed(() => (home.shown('alumni') ? alumni.page.value?.items[0] ?? null : null));
</script>

<template>
  <div class="sh">
    <SiteHero
      :title="settings?.heroTitle || DEFAULTS[portal].title"
      :intro="settings?.heroIntro || DEFAULTS[portal].intro"
      :stats="stats"
      :image="portalImage(data, settings?.heroImageId)"
      :cover-title="names.short"
      :dark="portal === 'sma'"
    >
      <template #actions>
        <RouterLink :to="{ name: siteRouteName('yayasan', 'ppdb'), query: { jenjang: portal } }" class="s-btn s-btn--or">{{ home.text('hero.primary') }} <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        <RouterLink :to="route('profil')" class="s-btn s-btn--ghost">{{ home.text('hero.secondary') }}</RouterLink>
      </template>
      <template #card>
        <RouterLink :to="route('profil')" class="sh-card">
          <span class="sh-card-logo"><img :src="LOGO[portal]" alt="" width="58" height="58" /></span>
          <span><small>{{ home.text('hero.cardLabel') }}</small><b>{{ settings?.visi || settings?.tagline || 'Bertaqwa, berilmu, dan mandiri.' }}</b></span>
        </RouterLink>
      </template>
    </SiteHero>

    <ProfileVideo
      v-if="settings && home.shown('video')"
      :url="settings.video.url"
      :poster="portalImage(data, settings.video.posterId)"
      :kick="home.text('video.kick')"
      :title="home.text('video.title')"
      :lead="home.text('video.lead')"
    />

    <section v-if="settings && home.shown('prakata') && (settings.prakata.body || misi.length)" class="s-sec">
      <div class="s-wrap">
        <div class="sh-head">
          <div class="sh-head-photo">
            <SitePhoto v-if="prakataPhoto" :image="prakataPhoto" :title="settings.prakata.name || 'Kepala sekolah'" sizes="(max-width: 640px) 100vw, 400px" />
            <div v-else class="sh-head-empty"><UserRound :size="44" :stroke-width="1.4" aria-hidden="true" /></div>
            <div v-if="settings.prakata.name" class="sh-who"><b>{{ settings.prakata.name }}</b><span>{{ settings.prakata.role || `Kepala ${names.name}` }}</span></div>
          </div>
          <div class="sh-head-text">
            <div class="s-kick">{{ home.text('prakata.kick') }}</div>
            <h2>{{ home.text('prakata.title') }}</h2>
            <!-- eslint-disable-next-line vue/no-v-html -- sanitized on save by the content feature -->
            <div v-if="settings.prakata.body" class="sh-prakata ab-prose" v-html="settings.prakata.body" />
            <div v-if="misi.length" class="sh-misi">
              <h3>{{ home.text('prakata.misiTitle') }}</h3>
              <ol>
                <li v-for="(line, index) in misi" :key="index"><b>{{ String(index + 1).padStart(2, '0') }}</b>{{ line }}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="home.shown('akademik') && academics.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">{{ home.text('akademik.kick') }}</div><h2 class="s-h2">{{ home.text('akademik.title') }}</h2></div>
          <RouterLink :to="route('akademik')" class="s-more">Semua info akademik <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="sh-aka" :class="`sh-aka--${academics.page.value.items.length}`">
          <RouterLink
            v-for="(item, index) in academics.page.value.items"
            :key="item.id"
            :to="entry('akademik', item.slug)"
            class="s-tile"
            :class="index === 0 ? (item.image ? 's-tile--photo sh-aka-main' : 's-tile--acc sh-aka-main') : index === 1 ? 's-tile--white' : 's-tile--sun'"
          >
            <template v-if="index === 0">
              <div v-if="item.image" class="s-tile-bg"><SitePhoto :image="item.image" :title="item.title" sizes="(max-width: 640px) 100vw, 40vw" /></div>
              <span class="s-tile-arrow" aria-hidden="true"><ArrowUpRight :size="20" /></span>
            </template>
            <span v-else class="s-tile-icon" aria-hidden="true"><component :is="ACADEMIC_ICONS[index]" :size="24" /></span>
            <div><h3>{{ item.title }}</h3><p v-if="item.summary">{{ item.summary }}</p></div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="home.shown('ekskul') && clubs.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">{{ home.text('ekskul.kick') }}</div><h2 class="s-h2">{{ home.text('ekskul.title') }}</h2></div>
          <RouterLink :to="route('ekskul')" class="s-more">Semua ekskul <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="sh-eks" :class="`sh-eks--${clubs.page.value.items.length}`">
          <RouterLink v-for="(item, index) in clubs.page.value.items" :key="item.id" :to="entry('ekskul', item.slug)" class="s-tile s-tile--photo" :class="{ 's-tile--cover': !item.image }">
            <div class="s-tile-bg"><SitePhoto :image="item.image" :title="item.title" :tone="index % 2 ? 'ink' : portal" scale="m" :sizes="index === 0 ? '(max-width: 640px) 100vw, 45vw' : '(max-width: 640px) 50vw, 28vw'" /></div>
            <span class="s-tile-arrow" aria-hidden="true"><ArrowUpRight :size="20" /></span>
            <div v-if="item.image"><h3>{{ item.title }}</h3><p v-if="item.fields.coach">Pembina: {{ item.fields.coach }}</p></div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="home.shown('kompetensi') && competencies.length" class="s-sec">
      <div class="s-wrap">
        <div class="sh-quran">
          <div class="sh-quran-l">
            <div class="s-kick">{{ home.text('kompetensi.kick') }}</div>
            <div v-if="headline" class="sh-big">{{ headline.value }}<small>{{ headline.unit }}</small></div>
            <h3>{{ home.text('kompetensi.title') }}</h3>
            <p v-if="home.text('kompetensi.text')">{{ home.text('kompetensi.text') }}</p>
            <p v-else-if="headline">Setiap lulusan menuntaskan {{ headline.name.toLowerCase() }} sebagai bagian dari standar kompetensi sekolah.</p>
            <div class="sh-quran-go">
              <RouterLink :to="{ name: siteRouteName('yayasan', 'takhosus') }" class="s-btn s-btn--or s-btn--sm">Program Takhosus 30 juz <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
            </div>
          </div>
          <div class="sh-quran-r">
            <h4>{{ home.text('kompetensi.tableTitle') }}</h4>
            <p class="sh-sub">{{ home.text('kompetensi.tableLead') }}</p>
            <table class="s-skl sh-skl">
              <thead><tr><th scope="col">Kompetensi</th><th scope="col" class="c"><span class="s-dot" style="background: var(--acc)" />Target</th></tr></thead>
              <tbody>
                <tr v-for="row in competencies" :key="row.name">
                  <td><b>{{ row.name }}</b><small v-if="row.detail">{{ row.detail }}</small></td>
                  <td class="c"><b>{{ row.target || '✓' }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section v-if="home.shown('news')" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">{{ home.text('news.kick') }}</div><h2 class="s-h2">{{ home.text('news.title') }}</h2></div>
          <RouterLink :to="route('berita')" class="s-more">Semua berita <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="sh-news" :style="{ '--news': news.page.value?.items.length || 3 }">
          <template v-if="news.page.value">
            <NewsCard v-for="item in news.page.value.items" :key="item.id" :entry="item" />
            <div v-if="news.page.value.items.length === 0" class="s-empty sh-news-empty"><b>Belum ada berita.</b><span>Kabar kegiatan siswa akan tampil di sini.</span></div>
          </template>
          <template v-else><div v-for="index in 3" :key="index" class="s-skeleton sh-news-skeleton" /></template>
          <AgendaPanel :items="agenda.page.value?.items ?? []" />
        </div>
      </div>
    </section>

    <section v-if="shownAchievements.length || shownAlumni" class="s-sec">
      <div class="s-wrap">
        <div class="sh-pa" :class="{ 'sh-pa--one': !shownAlumni || !shownAchievements.length }">
          <div v-if="shownAchievements.length" class="sh-pres">
            <div class="s-kick">{{ home.text('prestasi.kick') }}</div>
            <h3>{{ home.text('prestasi.title') }}</h3>
            <div v-for="item in shownAchievements" :key="item.id" class="sh-pr">
              <span class="sh-medal" aria-hidden="true"><Trophy :size="22" /></span>
              <span class="sh-pr-text"><b>{{ item.title }}</b><span>{{ [item.fields.student, item.fields.level].filter(Boolean).join(' · ') }}</span></span>
              <span v-if="item.date" class="sh-yr">{{ item.date.slice(0, 4) }}</span>
            </div>
            <div class="sh-pres-go"><RouterLink :to="route('prestasi')" class="s-btn s-btn--or s-btn--sm">Semua prestasi <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink></div>
          </div>
          <div v-if="shownAlumni" class="sh-alum">
            <div class="sh-alum-photo"><SitePhoto :image="shownAlumni.image" :title="shownAlumni.title" tone="sun" scale="s" sizes="(max-width: 640px) 100vw, 40vw" /></div>
            <div class="sh-alum-body">
              <div class="s-kick">{{ home.text('alumni.kick') }}</div>
              <h3>{{ home.text('alumni.title') }}</h3>
              <p>{{ home.text('alumni.text') }}</p>
              <div class="sh-alum-go"><RouterLink :to="route('alumni')" class="s-btn s-btn--ink s-btn--sm">Lihat alumni <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="home.shown('faq') && faq.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="sh-faq">
          <div>
            <div class="s-kick">{{ home.text('faq.kick') }}</div>
            <h2 class="s-h2">{{ home.text('faq.title') }}</h2>
            <p class="s-lead">{{ home.text('faq.lead') }}</p>
            <div class="sh-faq-go">
              <a v-if="whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-btn s-btn--ink">Tanya lewat WhatsApp <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></a>
              <RouterLink :to="route('faq')" class="s-btn s-btn--line">Semua pertanyaan</RouterLink>
            </div>
          </div>
          <FaqList :items="faq.page.value.items" />
        </div>
      </div>
    </section>

    <PpdbBlock v-if="home.shown('ppdb')" :portal="portal" :kick="home.text('ppdb.kick')" :title="home.text('ppdb.title')" :text="home.text('ppdb.text')" :whatsapp="whatsapp" />
  </div>
</template>

<style scoped>
.sh-card { position: absolute; bottom: clamp(28px, 5svh, 40px); left: -48px; display: flex; width: 272px; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 18px; background: var(--acc); color: #fff; }
.sh-card-logo { display: grid; width: 50px; height: 50px; flex: none; place-items: center; padding: 8px; border-radius: 14px; background: #fff; }
.sh-card-logo img { width: 100%; height: 100%; object-fit: contain; }
.sh-card small { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; opacity: .85; }
.sh-card b { display: block; margin-top: 4px; font-family: var(--ab-display); font-size: 17px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }

.sh-head { display: grid; grid-template-columns: 400px 1fr; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 28px; background: #fff; }
.sh-head-photo { position: relative; min-height: 480px; background: var(--ab-paper-2); }
.sh-head-empty { display: grid; height: 100%; place-items: center; color: var(--ab-mute); }
.sh-who { position: absolute; right: 18px; bottom: 18px; left: 18px; padding: 16px 18px; border-radius: 16px; background: var(--ab-ink); color: #fff; }
.sh-who b { display: block; font-size: 17px; font-weight: 800; }
.sh-who span { color: rgba(255, 255, 255, .65); font-size: 13.5px; }
.sh-head-text { display: flex; flex-direction: column; padding: 48px 52px; }
.sh-head-text h2 { margin: 14px 0 0; font-family: var(--ab-display); font-size: 44px; font-weight: 800; letter-spacing: -.035em; line-height: 1; }
.sh-prakata { max-width: 640px; margin-top: 18px; padding-left: 16px; border-left: 3px solid var(--acc); color: var(--ab-ink-2); font-size: 17px; }
.sh-misi { margin-top: auto; padding-top: 34px; }
.sh-misi h3 { margin: 0; color: var(--ab-mute); font-size: 12.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.sh-misi ol { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin: 14px 0 0; padding: 0; list-style: none; }
.sh-misi li { padding-top: 14px; border-top: 2px solid var(--ab-ink); font-size: 15px; font-weight: 600; line-height: 1.45; }
.sh-misi li b { display: block; margin-bottom: 8px; color: var(--acc); font-family: var(--ab-display); font-size: 28px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }

.sh-aka { display: grid; grid-template-columns: 1.25fr 1fr 1fr; grid-template-rows: 300px; gap: 20px; }
.sh-aka--1 { grid-template-columns: 1fr; }
.sh-aka--2 { grid-template-columns: 1.25fr 1fr; }

.sh-eks { display: grid; height: 440px; grid-template-columns: 1.4fr 1fr 1fr; gap: 20px; }
.sh-eks--1 { grid-template-columns: 1fr; }
.sh-eks--2 { grid-template-columns: 1.4fr 1fr; }

.sh-quran { display: grid; grid-template-columns: 420px 1fr; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 28px; background: #fff; }
.sh-quran-l { display: flex; flex-direction: column; padding: 44px 40px; background: var(--ab-ink); color: #fff; }
.site--smp .sh-quran-l { background: var(--ab-forest); }
.sh-big { margin-top: 26px; color: var(--acc); font-family: var(--ab-display); font-size: 200px; font-weight: 800; letter-spacing: -.07em; line-height: .8; }
.site--smp .sh-big { color: var(--ab-sun); }
.site--smp .sh-quran-l .s-kick { color: var(--ab-sun); }
.sh-big small { margin-left: 8px; color: #fff; font-size: 44px; letter-spacing: -.03em; }
.sh-quran-l h3 { margin: 22px 0 0; font-family: var(--ab-display); font-size: 34px; font-weight: 800; letter-spacing: -.035em; line-height: .98; }
.sh-quran-l p { margin: 14px 0 0; color: rgba(255, 255, 255, .72); font-size: 16px; }
.sh-quran-go { margin-top: auto; padding-top: 28px; }
.sh-quran-r { padding: 40px 44px; }
.sh-quran-r h4 { margin: 0; font-family: var(--ab-display); font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.sh-sub { margin: 4px 0 0; color: var(--ab-mute); font-size: 15px; }
.sh-skl .c { width: 200px; }

/* One to three cards share the room left of the agenda, so it keeps its width. */
.sh-news { display: grid; grid-template-columns: repeat(var(--news, 3), minmax(0, 1fr)) 380px; gap: 20px; }
.sh-news-empty { grid-column: span 3; align-content: center; }
.sh-news-skeleton { min-height: 360px; }

.sh-pa { display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px; }
.sh-pa--one { grid-template-columns: 1fr; }
.sh-pres { display: flex; flex-direction: column; padding: 36px; border-radius: 28px; background: var(--ab-ink); color: #fff; }
.sh-pres h3, .sh-alum h3 { margin: 12px 0 18px; font-family: var(--ab-display); font-size: 36px; font-weight: 800; letter-spacing: -.035em; line-height: 1; }
.sh-pr { display: flex; align-items: center; gap: 16px; padding: 18px 0; border-top: 1px solid rgba(255, 255, 255, .12); }
.sh-medal { display: grid; width: 48px; height: 48px; flex: none; place-items: center; border-radius: 14px; background: var(--acc); }
.sh-pr-text { min-width: 0; }
.sh-pr-text b { display: block; font-size: 16px; font-weight: 700; }
.sh-pr-text span { color: rgba(255, 255, 255, .6); font-size: 13.5px; }
.sh-yr { margin-left: auto; color: rgba(255, 255, 255, .6); font-size: 13px; font-weight: 700; }
.sh-pres-go { margin-top: auto; padding-top: 22px; }
.sh-alum { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 28px; background: #fff; }
.sh-alum-photo { height: 200px; }
.sh-alum-body { display: flex; flex: 1; flex-direction: column; padding: 30px 34px 34px; }
.sh-alum h3 { margin-bottom: 0; }
.sh-alum p { margin: 10px 0 0; color: var(--ab-ink-2); font-size: 16px; }
.sh-alum-go { margin-top: auto; padding-top: 24px; }

.sh-faq { display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; }
.sh-faq-go { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }

@media (max-width: 1100px) {
  .sh-news { grid-template-columns: 1fr 1fr; }
  .sh-news-empty, .sh-news > .s-agenda { grid-column: span 2; }
  .sh-head { grid-template-columns: 320px 1fr; }
  .sh-misi ol { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 960px) {
  .sh-card { right: 28px; bottom: 28px; left: 28px; width: auto; }
  .sh-head, .sh-quran, .sh-pa, .sh-faq { grid-template-columns: 1fr; }
  .sh-head-photo { min-height: 380px; }
  .sh-faq { gap: 28px; }
}
@media (max-width: 640px) {
  .sh-card { right: 22px; bottom: 22px; left: 22px; padding: 14px 16px; border-radius: 16px; }
  .sh-card-logo { width: 46px; height: 46px; padding: 7px; border-radius: 13px; }
  .sh-card b { font-size: 16px; }
  .sh-head { border-radius: 24px; }
  .sh-head-photo { min-height: 300px; }
  .sh-head-text { padding: 28px 22px; }
  .sh-head-text h2 { font-size: 30px; }
  .sh-prakata { font-size: 15px; }
  .sh-misi ol { grid-template-columns: 1fr; gap: 16px; }
  .sh-aka, .sh-aka--2 { grid-template-columns: 1fr 1fr; grid-template-rows: 260px 180px; gap: 12px; }
  .sh-aka--1 { grid-template-rows: 260px; }
  .sh-aka .sh-aka-main { grid-column: span 2; }
  .sh-aka .s-tile:not(.sh-aka-main) p { display: none; }
  .sh-eks, .sh-eks--2 { height: auto; grid-template-columns: 1fr 1fr; grid-template-rows: 260px 170px; gap: 12px; }
  .sh-eks--1 { grid-template-rows: 260px; }
  .sh-eks .s-tile:first-child { grid-column: span 2; }
  .sh-eks--2 .s-tile:nth-child(2) { grid-column: span 2; }
  .sh-eks .s-tile p { font-size: 12.5px; }
  .sh-quran { border-radius: 24px; }
  .sh-quran-l { padding: 30px 22px; }
  .sh-big { margin-top: 18px; font-size: 140px; }
  .sh-big small { font-size: 34px; }
  .sh-quran-l h3 { font-size: 28px; }
  .sh-quran-r { padding: 26px 22px; }
  .sh-skl .c { width: 112px; }
  .sh-news { grid-template-columns: 1fr; gap: 14px; }
  .sh-news-empty, .sh-news > .s-agenda { grid-column: auto; }
  .sh-news-skeleton { min-height: 118px; }
  .sh-pa { gap: 14px; }
  .sh-pres { padding: 26px 22px; border-radius: 24px; }
  .sh-alum { border-radius: 24px; }
  .sh-alum-body { padding: 24px 22px 26px; }
  .sh-pres h3, .sh-alum h3 { font-size: 28px; }
  .sh-yr { display: none; }
  .sh-faq { gap: 20px; }
}
</style>
