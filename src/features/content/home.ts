import type { Portal } from './contract';

/**
 * A portal's home page, as the school edits it: the sections it is made of,
 * and the text each one carries. A text the school leaves empty shows its
 * `fallback`, so a fresh portal reads as the approved design does. This file
 * imports nothing at run time: the public pages read it too.
 */
export interface HomeTextDef {
  /** `<section>.<part>`, the key the text is saved under. */
  key: string;
  label: string;
  /** What the page shows while the school has written nothing. */
  fallback: string;
  max: number;
  multiline?: boolean;
}

export interface HomeSectionDef {
  key: string;
  label: string;
  /** What the section shows and when, for the admin. */
  note: string;
  /** Whether the school can take the section off the page. */
  hideable: boolean;
  texts: HomeTextDef[];
}

/** What a portal saved about its home page: sections taken off, and the texts written over the fallbacks. */
export interface HomeSettings {
  hidden: string[];
  text: Record<string, string>;
}

const line = (key: string, label: string, fallback: string, max = 120): HomeTextDef => ({ key, label, fallback, max });
const para = (key: string, label: string, fallback: string, max = 400): HomeTextDef => ({ key, label, fallback, max, multiline: true });

const VIDEO_NOTE = 'Tampil setelah tautan video diisi pada kartu Video profil.';

function yayasanSections(): HomeSectionDef[] {
  return [
    {
      key: 'hero',
      label: 'Bagian atas',
      note: 'Tombol dan kartu oranye di atas foto utama. Judul, paragraf, foto dan angka ada di kartu Beranda.',
      hideable: false,
      texts: [
        line('hero.primary', 'Tombol utama', 'Daftar PPDB', 40),
        line('hero.secondary', 'Tombol kedua', 'Profil yayasan', 40),
        line('hero.cardValue', 'Angka pada kartu', '30', 6),
        line('hero.cardUnit', 'Satuan angka', 'Juz', 16),
        line('hero.cardText', 'Teks kartu', "Takhosus Al-Qur'an, program unggulan yayasan"),
      ],
    },
    {
      key: 'video',
      label: 'Video profil',
      note: VIDEO_NOTE,
      hideable: true,
      texts: [
        line('video.kick', 'Label kecil', 'Video profil', 60),
        line('video.title', 'Judul', 'Kenali Al Bashiroh lebih dekat.'),
        para('video.lead', 'Paragraf', 'Suasana belajar, kehidupan asrama, dan keseharian santri Al Bashiroh dalam satu video.'),
      ],
    },
    {
      key: 'schools',
      label: 'Pilihan sekolah',
      note: 'Dua kartu jenjang SMP dan SMA. Slogan tiap kartu diambil dari Slogan singkat portal sekolahnya.',
      hideable: true,
      texts: [
        line('schools.kick', 'Label kecil', 'Dua jenjang, satu yayasan', 60),
        line('schools.title', 'Judul', 'Pilih sekolah putra-putri Anda.'),
        para('schools.lead', 'Paragraf', 'Setiap jenjang punya portal sendiri: akademik, ekstrakurikuler, prestasi, dan tanya jawab.'),
      ],
    },
    {
      key: 'takhosus',
      label: 'Program unggulan',
      note: 'Blok Takhosus dengan tabel kompetensi lulusan SMP dan SMA. Tanpa tabel kompetensi, sisi kanan memakai judul pengganti dan cuplikan halaman Takhosus.',
      hideable: true,
      texts: [
        line('takhosus.kick', 'Label kecil', 'Program unggulan', 60),
        line('takhosus.value', 'Angka besar', '30', 6),
        line('takhosus.unit', 'Satuan angka', 'juz', 16),
        line('takhosus.title', 'Judul', "Takhosus Al-Qur'an"),
        para('takhosus.text', 'Paragraf', "Program hafalan Al-Qur'an 30 juz di bawah yayasan, berjalan bersama kehidupan asrama."),
        line('takhosus.tableTitle', 'Judul tabel', 'Target kompetensi lulusan'),
        line('takhosus.tableLead', 'Keterangan tabel', 'Yang wajib dikuasai setiap lulusan reguler.', 200),
        line('takhosus.altTitle', 'Judul pengganti tabel', 'Hafalan, adab, dan kemandirian'),
      ],
    },
    {
      key: 'about',
      label: 'Kenali Al Bashiroh',
      note: 'Lima kotak menuju Fasilitas, Keasramaan, Guru & staf, Prestasi dan Download dokumen.',
      hideable: true,
      texts: [
        line('about.kick', 'Label kecil', 'Kenali Al Bashiroh', 60),
        line('about.title', 'Judul', 'Belajar, tinggal, dan tumbuh di satu lingkungan.'),
        line('about.fasilitasTitle', 'Kotak Fasilitas: judul', 'Fasilitas', 40),
        line('about.fasilitasText', 'Kotak Fasilitas: keterangan', 'Sarana belajar, asrama, dan lingkungan sekolah.', 160),
        line('about.keasramaanTitle', 'Kotak Keasramaan: judul', 'Keasramaan', 40),
        line('about.keasramaanText', 'Kotak Keasramaan: keterangan', 'Kehidupan asrama, pembinaan ibadah, dan kegiatan harian santri.', 160),
        line('about.guruTitle', 'Kotak Guru & staf: judul', 'Guru & staf', 40),
        line('about.guruText', 'Kotak Guru & staf: keterangan', 'Pendidik dan tenaga kependidikan.', 160),
        line('about.prestasiTitle', 'Kotak Prestasi: judul', 'Prestasi', 40),
        line('about.prestasiText', 'Kotak Prestasi: keterangan', 'Capaian siswa SMP dan SMA.', 160),
        line('about.dokumenTitle', 'Kotak Dokumen: judul', 'Download dokumen', 40),
        line('about.dokumenText', 'Kotak Dokumen: keterangan', 'Brosur, formulir, dan berkas resmi.', 160),
      ],
    },
    {
      key: 'news',
      label: 'Berita dan agenda',
      note: 'Tiga berita terbaru dari Yayasan, SMP dan SMA, di samping agenda terdekat.',
      hideable: true,
      texts: [line('news.kick', 'Label kecil', 'Berita & artikel', 60), line('news.title', 'Judul', 'Kabar terbaru.')],
    },
    {
      key: 'gallery',
      label: 'Galeri',
      note: 'Empat foto atau video terbaru. Tampil bila galeri sudah berisi.',
      hideable: true,
      texts: [line('gallery.kick', 'Label kecil', 'Galeri', 60), line('gallery.title', 'Judul', 'Suasana Al Bashiroh.')],
    },
    {
      key: 'ppdb',
      label: 'Ajakan PPDB',
      note: 'Blok oranye di akhir halaman dengan tombol daftar SMP dan SMA.',
      hideable: true,
      texts: [
        line('ppdb.kick', 'Label kecil', 'PPDB Al Bashiroh', 60),
        line('ppdb.title', 'Judul', 'Satu pendaftaran untuk SMP dan SMA.'),
        para('ppdb.text', 'Paragraf', 'Pilih jenjang, isi formulir online, lalu pantau jadwal dan pengumuman di halaman PPDB.'),
      ],
    },
  ];
}

function schoolSections(portal: 'smp' | 'sma'): HomeSectionDef[] {
  const level = portal.toUpperCase();
  const school = `${level} IT Al Bashiroh Turen`;
  const sections: HomeSectionDef[] = [
    {
      key: 'hero',
      label: 'Bagian atas',
      note: 'Tombol dan kartu di atas foto utama. Judul, paragraf, foto dan angka ada di kartu Beranda; isi kartu diambil dari Visi.',
      hideable: false,
      texts: [
        line('hero.primary', 'Tombol utama', `Daftar ke ${level}`, 40),
        line('hero.secondary', 'Tombol kedua', 'Profil sekolah', 40),
        line('hero.cardLabel', 'Label kartu', 'Visi sekolah', 40),
      ],
    },
    {
      key: 'video',
      label: 'Video profil',
      note: VIDEO_NOTE,
      hideable: true,
      texts: [
        line('video.kick', 'Label kecil', 'Video profil', 60),
        line('video.title', 'Judul', `Kenali ${level} IT Al Bashiroh lebih dekat.`),
        para('video.lead', 'Paragraf', `Suasana belajar, kegiatan, dan keseharian siswa ${school} dalam satu video.`),
      ],
    },
    {
      key: 'prakata',
      label: 'Prakata kepala sekolah',
      note: 'Foto, sambutan dan misi sekolah. Tampil bila teks prakata atau misi sudah diisi.',
      hideable: true,
      texts: [
        line('prakata.kick', 'Label kecil', 'Prakata kepala sekolah', 60),
        line('prakata.title', 'Judul', "Assalamu'alaikum warahmatullahi wabarakatuh."),
        line('prakata.misiTitle', 'Judul daftar misi', 'Misi sekolah', 60),
      ],
    },
    {
      key: 'akademik',
      label: 'Akademik',
      note: 'Tiga info akademik teratas. Tampil bila sudah ada yang terbit.',
      hideable: true,
      texts: [line('akademik.kick', 'Label kecil', 'Akademik', 60), line('akademik.title', 'Judul', 'Kurikulum, kalender, dan program belajar.')],
    },
    {
      key: 'ekskul',
      label: 'Ekstrakurikuler',
      note: 'Tiga ekstrakurikuler teratas. Tampil bila sudah ada yang terbit.',
      hideable: true,
      texts: [line('ekskul.kick', 'Label kecil', 'Ekstrakurikuler', 60), line('ekskul.title', 'Judul', 'Minat dan bakat di luar kelas.')],
    },
    {
      key: 'kompetensi',
      label: 'Standar kompetensi lulusan',
      note: 'Angka besar dan tabel dari kartu Standar kompetensi lulusan. Paragraf yang dikosongkan disusun dari kompetensi pertama.',
      hideable: true,
      texts: [
        line('kompetensi.kick', 'Label kecil', 'Standar kompetensi lulusan', 60),
        line('kompetensi.title', 'Judul', `Target setiap lulusan ${level}.`),
        para('kompetensi.text', 'Paragraf', ''),
        line('kompetensi.tableTitle', 'Judul tabel', 'Kompetensi yang wajib dikuasai'),
        line('kompetensi.tableLead', 'Keterangan tabel', `Kompetensi yang wajib dimiliki setiap lulusan ${school}.`, 200),
      ],
    },
    {
      key: 'news',
      label: 'Berita dan agenda',
      note: 'Tiga berita terbaru sekolah di samping agenda terdekat.',
      hideable: true,
      texts: [line('news.kick', 'Label kecil', `Kabar ${level}`, 60), line('news.title', 'Judul', 'Berita & agenda terbaru.')],
    },
    {
      key: 'prestasi',
      label: 'Prestasi',
      note: 'Tiga prestasi terbaru. Tampil bila sudah ada yang terbit.',
      hideable: true,
      texts: [line('prestasi.kick', 'Label kecil', 'Prestasi', 60), line('prestasi.title', 'Judul', `Capaian siswa ${level}.`)],
    },
  ];
  if (portal === 'sma') {
    sections.push({
      key: 'alumni',
      label: 'Alumni',
      note: 'Kartu di samping Prestasi. Tampil bila sudah ada alumni yang terbit.',
      hideable: true,
      texts: [
        line('alumni.kick', 'Label kecil', 'Alumni', 60),
        line('alumni.title', 'Judul', 'Jejak lulusan Al Bashiroh.'),
        para('alumni.text', 'Paragraf', 'Kabar alumni, kampus dan karier lulusan, serta jalur untuk tetap terhubung dengan sekolah.'),
      ],
    });
  }
  sections.push(
    {
      key: 'faq',
      label: 'Tanya jawab',
      note: 'Empat pertanyaan teratas. Tampil bila sudah ada yang terbit.',
      hideable: true,
      texts: [
        line('faq.kick', 'Label kecil', 'Q&A', 60),
        line('faq.title', 'Judul', 'Pertanyaan yang sering ditanyakan.'),
        para('faq.lead', 'Paragraf', 'Belum menemukan jawabannya? Tanyakan langsung kepada kami.'),
      ],
    },
    {
      key: 'ppdb',
      label: 'Ajakan PPDB',
      note: 'Blok oranye di akhir halaman dengan tombol daftar dan WhatsApp panitia.',
      hideable: true,
      texts: [
        line('ppdb.kick', 'Label kecil', `PPDB ${level} IT Al Bashiroh`, 60),
        line('ppdb.title', 'Judul', 'Bergabung bersama kami.'),
        para('ppdb.text', 'Paragraf', `Kunjungi sekolah, bertemu dengan guru, dan rasakan langsung suasana belajar di ${school}.`),
      ],
    },
  );
  return sections;
}

const SECTIONS: Record<Portal, HomeSectionDef[]> = { yayasan: yayasanSections(), smp: schoolSections('smp'), sma: schoolSections('sma') };

/** The sections of a portal's home page, top to bottom. */
export function homeSections(portal: Portal): readonly HomeSectionDef[] {
  return SECTIONS[portal];
}

const FALLBACKS = Object.fromEntries(
  (Object.keys(SECTIONS) as Portal[]).map((portal) => [portal, new Map(SECTIONS[portal].flatMap((section) => section.texts.map((text) => [text.key, text.fallback])))]),
) as Record<Portal, Map<string, string>>;

/** A home page text: what the school wrote, or the fallback. */
export function homeText(portal: Portal, home: HomeSettings | undefined, key: string): string {
  return home?.text[key] || FALLBACKS[portal].get(key) || '';
}

/** Whether the school keeps a section on its home page. */
export function homeShown(home: HomeSettings | undefined, section: string): boolean {
  return !home?.hidden.includes(section);
}

/** The YouTube id in a watch, short, embed, shorts or live link. */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  const match = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(url);
  return match ? match[1]! : null;
}
