<script setup lang="ts">
import { ArrowRight, ArrowUpRight, BedDouble, FileDown, Trophy, UsersRound } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import AgendaPanel from '../../site/components/AgendaPanel.vue';
import NewsCard from '../../site/components/NewsCard.vue';
import PpdbBlock from '../../site/components/PpdbBlock.vue';
import SiteHero from '../../site/components/SiteHero.vue';
import SitePhoto from '../../site/components/SitePhoto.vue';
import { LOGO, portalImage, textOf, useEntries, usePortal, useTitle, whatsappLink } from '../../site/site';
import { siteRouteName } from '../../site-map';

/**
 * The Yayasan home, as in the approved mockup: the hero, the two schools,
 * Takhosus with the graduate competencies of both, the ways into the site,
 * the latest news beside the agenda, the gallery, and PPDB.
 */
const yayasan = usePortal(() => 'yayasan');
const smp = usePortal(() => 'smp');
const sma = usePortal(() => 'sma');
const settings = computed(() => yayasan.value?.settings);
useTitle(() => 'Al Bashiroh | Yayasan Bashiroh Robbaniyah');

const news = useEntries(() => ({ portal: 'yayasan', type: 'berita', query: { limit: 3 } }));
const agenda = useEntries(() => ({ portal: 'yayasan', type: 'agenda', query: { limit: 3, upcoming: true } }));
const gallery = useEntries(() => ({ portal: 'yayasan', type: 'galeri', query: { limit: 4 } }));
const facilities = useEntries(() => ({ portal: 'yayasan', type: 'fasilitas', query: { limit: 1 } }));

const route = (key: string, portal: 'yayasan' | 'smp' | 'sma' = 'yayasan') => ({ name: siteRouteName(portal, key) });

const stats = computed(() => {
  const own = settings.value?.stats.filter((stat) => stat.value) ?? [];
  if (own.length) return own;
  const base = [
    { value: 'SMP IT', label: 'Al Bashiroh Turen' },
    { value: 'SMA IT', label: 'Al Bashiroh Turen' },
  ];
  return settings.value?.accreditation ? [...base, { value: settings.value.accreditation, label: 'Terakreditasi' }] : base;
});

const schools = computed(() =>
  (
    [
      { portal: 'smp', data: smp.value, tag: "Qur'ani, unggul, kompetitif, dan mandiri.", chips: ['Akademik', 'Ekstrakurikuler', 'Prestasi', 'Q&A'] },
      { portal: 'sma', data: sma.value, tag: 'Wujudkan generasi bertaqwa dan berprestasi.', chips: ['Akademik', 'Ekstrakurikuler', 'Prestasi', 'Alumni', 'Q&A'] },
    ] as const
  ).map((school) => ({
    ...school,
    name: `${school.portal.toUpperCase()} IT Al Bashiroh Turen`,
    tagline: school.data?.settings.tagline || school.tag,
    image: portalImage(school.data, school.data?.settings.heroImageId),
  })),
);

// Both schools' competencies side by side, matched by name, in the order the SMP lists them.
const competencies = computed(() => {
  const rows = new Map<string, { name: string; detail: string; smp: string; sma: string }>();
  for (const [level, data] of [['smp', smp.value], ['sma', sma.value]] as const) {
    for (const row of data?.settings.kompetensi ?? []) {
      if (!row.name) continue;
      const key = row.name.trim().toLowerCase();
      const current = rows.get(key) ?? { name: row.name, detail: row.detail, smp: '', sma: '' };
      current[level] = row.target;
      current.detail ||= row.detail;
      rows.set(key, current);
    }
  }
  return [...rows.values()];
});
const takhosusText = computed(() => textOf(settings.value?.takhosus ?? '', 320));
const whatsapp = computed(() => (settings.value?.contact.whatsapp ? whatsappLink(settings.value.contact.whatsapp, 'Assalamualaikum, saya ingin bertanya tentang PPDB Al Bashiroh.') : null));
</script>

<template>
  <div class="yh">
    <SiteHero
      :title="settings?.heroTitle || `Generasi Qur'ani yang *bertaqwa, berilmu,* dan mandiri.`"
      :intro="settings?.heroIntro || `Yayasan Bashiroh Robbaniyah menaungi SMP IT dan SMA IT Al Bashiroh di Turen, dengan program unggulan Takhosus Al-Qur'an 30 juz dan kehidupan asrama.`"
      :stats="stats"
      :image="portalImage(yayasan, settings?.heroImageId)"
      cover-title="Al Bashiroh"
    >
      <template #actions>
        <RouterLink :to="route('ppdb')" class="s-btn s-btn--or">Daftar PPDB <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        <RouterLink :to="route('profil')" class="s-btn s-btn--ghost">Profil yayasan</RouterLink>
      </template>
      <template #card>
        <RouterLink :to="route('takhosus')" class="yh-tahfidz">
          <span class="yh-tahfidz-n"><b>30</b><span>Juz</span></span>
          <span class="yh-tahfidz-t">Takhosus Al-Qur'an, program unggulan yayasan</span>
        </RouterLink>
      </template>
    </SiteHero>

    <section class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">Dua jenjang, satu yayasan</div><h2 class="s-h2">Pilih sekolah putra-putri Anda.</h2></div>
          <p class="s-lead yh-lead">Setiap jenjang punya portal sendiri: akademik, ekstrakurikuler, prestasi, dan tanya jawab.</p>
        </div>
        <div class="yh-portals">
          <article v-for="school in schools" :key="school.portal" class="yh-portal" :class="`yh-portal--${school.portal}`">
            <div class="yh-portal-in">
              <span class="yh-portal-logo"><img :src="LOGO[school.portal]" alt="" width="64" height="64" loading="lazy" /></span>
              <p class="yh-portal-level">Jenjang {{ school.portal.toUpperCase() }}</p>
              <h3>{{ school.name }}</h3>
              <p class="yh-portal-tag">{{ school.tagline }}</p>
              <ul class="yh-chips"><li v-for="chip in school.chips" :key="chip">{{ chip }}</li></ul>
              <RouterLink :to="route('home', school.portal)" class="s-btn s-btn--wh s-btn--sm yh-portal-go">
                Masuk portal {{ school.portal.toUpperCase() }} <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" />
              </RouterLink>
            </div>
            <div class="yh-portal-pic"><div><SitePhoto :image="school.image" :title="school.name" :tone="school.portal === 'smp' ? 'forest' : 'ink'" sizes="210px" /></div></div>
          </article>
        </div>
      </div>
    </section>

    <section class="s-sec">
      <div class="s-wrap">
        <div class="yh-quran">
          <div class="yh-quran-l">
            <div class="s-kick yh-sun">Program unggulan</div>
            <div class="yh-big">30<small>juz</small></div>
            <h3>Takhosus Al-Qur'an</h3>
            <p>Program hafalan Al-Qur'an 30 juz di bawah yayasan, berjalan bersama kehidupan asrama.</p>
            <div class="yh-quran-go"><RouterLink :to="route('takhosus')" class="s-btn s-btn--or s-btn--sm">Tentang program <ArrowRight :size="17" :stroke-width="2.3" aria-hidden="true" /></RouterLink></div>
          </div>
          <div class="yh-quran-r">
            <template v-if="competencies.length">
              <h4>Target kompetensi lulusan</h4>
              <p class="yh-sub">Yang wajib dikuasai setiap lulusan reguler.</p>
              <table class="s-skl">
                <thead>
                  <tr>
                    <th scope="col">Kompetensi</th>
                    <th scope="col" class="c"><span class="s-dot" style="background: var(--ab-smp)" />SMP</th>
                    <th scope="col" class="c"><span class="s-dot" style="background: var(--ab-sma)" />SMA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in competencies" :key="row.name">
                    <td><b>{{ row.name }}</b><small v-if="row.detail">{{ row.detail }}</small></td>
                    <td class="c">{{ row.smp || '–' }}</td>
                    <td class="c">{{ row.sma || '–' }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template v-else>
              <h4>Hafalan, adab, dan kemandirian</h4>
              <p class="yh-sub yh-sub--text">{{ takhosusText || "Santri Takhosus menghafal Al-Qur'an 30 juz dengan bimbingan musyrif, sambil menjalani kehidupan asrama yang tertib dan penuh adab." }}</p>
              <RouterLink :to="route('keasramaan')" class="s-more yh-more">Kehidupan asrama <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
            </template>
          </div>
        </div>
      </div>
    </section>

    <section class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">Kenali Al Bashiroh</div><h2 class="s-h2">Belajar, tinggal, dan tumbuh di satu lingkungan.</h2></div>
          <RouterLink :to="route('profil')" class="s-more">Profil lengkap yayasan <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="yh-bento">
          <RouterLink :to="route('fasilitas')" class="s-tile yh-big-tile" :class="facilities.page.value?.items[0]?.image ? 's-tile--photo' : 's-tile--forest'">
            <div v-if="facilities.page.value?.items[0]?.image" class="s-tile-bg"><SitePhoto :image="facilities.page.value.items[0].image" title="Fasilitas" sizes="(max-width: 640px) 100vw, 40vw" /></div>
            <span class="s-tile-arrow" aria-hidden="true"><ArrowUpRight :size="20" /></span>
            <div><h3>Fasilitas</h3><p>Sarana belajar, asrama, dan lingkungan sekolah.</p></div>
          </RouterLink>
          <RouterLink :to="route('keasramaan')" class="s-tile s-tile--acc">
            <span class="s-tile-icon" aria-hidden="true"><BedDouble :size="24" /></span>
            <div><h3>Keasramaan</h3><p>Kehidupan asrama, pembinaan ibadah, dan kegiatan harian santri.</p></div>
          </RouterLink>
          <RouterLink :to="route('guru')" class="s-tile s-tile--sun">
            <span class="s-tile-icon" aria-hidden="true"><UsersRound :size="24" /></span>
            <div><h3>Guru &amp; staf</h3><p>Pendidik dan tenaga kependidikan.</p></div>
          </RouterLink>
          <RouterLink :to="route('prestasi')" class="s-tile s-tile--ink">
            <span class="s-tile-icon" aria-hidden="true"><Trophy :size="24" /></span>
            <div><h3>Prestasi</h3><p>Capaian siswa SMP dan SMA.</p></div>
          </RouterLink>
          <RouterLink :to="route('dokumen')" class="s-tile s-tile--white">
            <span class="s-tile-icon" aria-hidden="true"><FileDown :size="24" /></span>
            <div><h3>Download dokumen</h3><p>Brosur, formulir, dan berkas resmi.</p></div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">Berita &amp; artikel</div><h2 class="s-h2">Kabar terbaru.</h2></div>
          <RouterLink :to="route('berita')" class="s-more">Semua berita <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="yh-news" :style="{ '--news': news.page.value?.items.length || 3 }">
          <template v-if="news.page.value">
            <NewsCard v-for="entry in news.page.value.items" :key="entry.id" :entry="entry" show-level />
            <div v-if="news.page.value.items.length === 0" class="s-empty yh-news-empty"><b>Belum ada berita.</b><span>Kabar kegiatan santri akan tampil di sini.</span></div>
          </template>
          <template v-else><div v-for="index in 3" :key="index" class="s-skeleton yh-news-skeleton" /></template>
          <AgendaPanel :items="agenda.page.value?.items ?? []" />
        </div>
      </div>
    </section>

    <section v-if="gallery.page.value?.items.length" class="s-sec">
      <div class="s-wrap">
        <div class="s-head">
          <div><div class="s-kick">Galeri</div><h2 class="s-h2">Suasana Al Bashiroh.</h2></div>
          <RouterLink :to="route('galeri')" class="s-more">Buka galeri <ArrowRight :size="16" :stroke-width="2.3" aria-hidden="true" /></RouterLink>
        </div>
        <div class="yh-gal">
          <RouterLink v-for="(item, index) in gallery.page.value.items" :key="item.id" :to="route('galeri')" class="yh-gal-item" :aria-label="item.title">
            <SitePhoto :image="item.image" :title="item.title" :tone="index % 2 ? 'sun' : 'forest'" scale="s" :sizes="index === 0 ? '(max-width: 640px) 100vw, 40vw' : '(max-width: 640px) 50vw, 20vw'" />
          </RouterLink>
        </div>
      </div>
    </section>

    <PpdbBlock portal="yayasan" :whatsapp="whatsapp" />
  </div>
</template>

<style scoped>
.yh-lead { max-width: 420px; }
.yh-tahfidz { position: absolute; bottom: 44px; left: -58px; display: block; width: 270px; padding: 22px 24px; border-radius: 20px; background: var(--ab-sma); color: #fff; }
.yh-tahfidz-n { display: flex; align-items: baseline; gap: 8px; font-family: var(--ab-display); font-weight: 800; }
.yh-tahfidz-n b { font-size: 64px; letter-spacing: -.05em; line-height: .85; }
.yh-tahfidz-n span { font-size: 24px; }
.yh-tahfidz-t { display: block; margin-top: 10px; font-size: 14.5px; font-weight: 600; line-height: 1.4; }

.yh-portals { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.yh-portal { display: grid; min-height: 400px; grid-template-columns: 1fr 210px; overflow: hidden; border-radius: 28px; color: #fff; }
.yh-portal--smp { background: var(--ab-smp); }
.yh-portal--sma { background: var(--ab-sma); }
.yh-portal-in { display: flex; flex-direction: column; padding: 36px 36px 34px; }
.yh-portal-logo { display: grid; width: 64px; height: 64px; place-items: center; padding: 10px; border-radius: 18px; background: #fff; }
.yh-portal-logo img { width: 100%; height: 100%; object-fit: contain; }
.yh-portal-level { margin: 26px 0 0; font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; opacity: .8; }
.yh-portal h3 { margin: 8px 0 0; font-family: var(--ab-display); font-size: 38px; font-weight: 800; letter-spacing: -.035em; line-height: .98; }
.yh-portal-tag { max-width: 330px; margin: 12px 0 0; font-size: 16px; opacity: .88; }
.yh-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 0; padding: 0; list-style: none; }
.yh-chips li { padding: 7px 12px; border: 1.5px solid rgba(255, 255, 255, .4); border-radius: 10px; font-size: 13.5px; font-weight: 700; }
.yh-portal-go { align-self: flex-start; margin-top: auto; }
.yh-portal-in .yh-chips { margin-bottom: 28px; }
.yh-portal-pic { padding: 12px 12px 12px 0; }
.yh-portal-pic > div { height: 100%; overflow: hidden; border-radius: 20px; }

.yh-quran { display: grid; grid-template-columns: 420px 1fr; overflow: hidden; border: 1px solid var(--ab-line); border-radius: 28px; background: #fff; }
.yh-quran-l { display: flex; flex-direction: column; padding: 44px 40px; background: var(--ab-ink); color: #fff; }
.yh-sun { color: var(--ab-sun); }
.yh-big { margin-top: 26px; color: var(--ab-sun); font-family: var(--ab-display); font-size: 200px; font-weight: 800; letter-spacing: -.07em; line-height: .8; }
.yh-big small { margin-left: 8px; color: #fff; font-size: 44px; letter-spacing: -.03em; }
.yh-quran-l h3 { margin: 22px 0 0; font-family: var(--ab-display); font-size: 34px; font-weight: 800; letter-spacing: -.035em; line-height: .98; }
.yh-quran-l p { margin: 14px 0 0; color: rgba(255, 255, 255, .72); font-size: 16px; }
.yh-quran-go { margin-top: auto; padding-top: 28px; }
.yh-quran-r { padding: 40px 44px; }
.yh-quran-r h4 { margin: 0; font-family: var(--ab-display); font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.yh-sub { margin: 4px 0 0; color: var(--ab-mute); font-size: 15px; }
.yh-sub--text { max-width: 560px; margin-top: 14px; color: var(--ab-ink-2); font-size: 17px; line-height: 1.65; }
.yh-more { margin-top: 24px; }

.yh-bento { display: grid; grid-template-columns: 1.25fr 1fr 1fr; grid-template-rows: 280px 280px; gap: 20px; }
.yh-big-tile { grid-row: span 2; }

/* One to three cards share the room left of the agenda, so it keeps its width. */
.yh-news { display: grid; grid-template-columns: repeat(var(--news, 3), minmax(0, 1fr)) 380px; gap: 20px; }
.yh-news-empty { grid-column: span 3; align-content: center; }
.yh-news-skeleton { min-height: 360px; }

.yh-gal { display: grid; height: 300px; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 14px; }
.yh-gal-item { overflow: hidden; border-radius: 20px; }

@media (max-width: 1100px) {
  .yh-news { grid-template-columns: 1fr 1fr; }
  .yh-news-empty { grid-column: span 2; }
  .yh-news > .s-agenda { grid-column: span 2; }
  .yh-portal { grid-template-columns: 1fr; }
  .yh-portal-pic { display: none; }
}
@media (max-width: 960px) {
  .yh-tahfidz { right: 28px; bottom: 28px; left: 28px; display: flex; width: auto; align-items: center; gap: 16px; }
  .yh-tahfidz-t { margin-top: 0; }
  .yh-quran { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .yh-tahfidz { right: 22px; bottom: 26px; left: 22px; padding: 16px 18px; border-radius: 16px; }
  .yh-tahfidz-n b { font-size: 46px; }
  .yh-tahfidz-n span { font-size: 18px; }
  .yh-tahfidz-t { font-size: 13.5px; }
  .yh-portals { grid-template-columns: 1fr; gap: 14px; }
  .yh-portal { min-height: 0; border-radius: 24px; }
  .yh-portal-in { padding: 26px 22px 24px; }
  .yh-portal-logo { width: 54px; height: 54px; border-radius: 15px; }
  .yh-portal-level { margin-top: 20px; }
  .yh-portal h3 { font-size: 30px; }
  .yh-portal-tag { font-size: 15px; }
  .yh-chips li { font-size: 12.5px; }
  .yh-quran { border-radius: 24px; }
  .yh-quran-l { padding: 30px 22px; }
  .yh-big { margin-top: 18px; font-size: 140px; }
  .yh-big small { font-size: 34px; }
  .yh-quran-l h3 { font-size: 28px; }
  .yh-quran-r { padding: 26px 22px; }
  .yh-bento { grid-template-columns: 1fr 1fr; grid-template-rows: 260px 170px 170px; gap: 12px; }
  .yh-big-tile { grid-row: auto; grid-column: span 2; }
  .yh-bento .s-tile:not(.yh-big-tile) p { display: none; }
  .yh-news { grid-template-columns: 1fr; gap: 14px; }
  .yh-news-empty, .yh-news > .s-agenda { grid-column: auto; }
  .yh-news-skeleton { min-height: 118px; }
  .yh-gal { height: auto; grid-template-columns: 1fr 1fr; grid-template-rows: 200px 120px; gap: 10px; }
  .yh-gal-item:first-child { grid-column: span 2; }
  .yh-gal-item:nth-child(4) { display: none; }
}
</style>
