import { z } from 'zod';
import { API_REFUSAL_CODES } from '../../shared/security/codes';
import type { PermissionDeclaration } from '../../shared/security/permissions';
import { permissionRules, type AccessRule } from '../../shared/security/access';
import type { ActivityDeclaration } from '../../shared/security/activity';

export const featureName = 'content' as const;
export type FeatureName = typeof featureName;

/**
 * Content is everything the school writes for the public site: each portal's
 * settings (hero, profile, prakata, contact, PPDB text) and its entries (news,
 * agenda, gallery, achievements, staff, documents, and the rest). The Yayasan
 * site and the two school portals are edited separately, each under its own
 * permission.
 */
export const PORTALS = ['yayasan', 'smp', 'sma'] as const;
export type Portal = (typeof PORTALS)[number];

export const PORTAL_INFO: Record<Portal, { name: string; short: string; path: string }> = {
  yayasan: { name: 'Yayasan Bashiroh Robbaniyah', short: 'Yayasan', path: '/' },
  smp: { name: 'SMP IT Al Bashiroh Turen', short: 'SMP', path: '/smp' },
  sma: { name: 'SMA IT Al Bashiroh Turen', short: 'SMA', path: '/sma' },
};

export const CONTENT_PERMISSIONS = [
  { action: 'yayasan', name: 'Kelola konten Yayasan', description: 'Mengisi profil, berita, galeri, dokumen dan isi lain situs Yayasan' },
  { action: 'smp', name: 'Kelola konten SMP', description: 'Mengisi portal SMP IT Al Bashiroh' },
  { action: 'sma', name: 'Kelola konten SMA', description: 'Mengisi portal SMA IT Al Bashiroh' },
] as const satisfies readonly PermissionDeclaration[];

export type ContentAccess = Readonly<Record<Portal, AccessRule>>;

export function contentAccess(resource: string): ContentAccess {
  const rule = permissionRules(resource, CONTENT_PERMISSIONS);
  return { yayasan: rule('yayasan'), smp: rule('smp'), sma: rule('sma') };
}

/** What Content reports to the activity trail. */
export const CONTENT_ACTIVITY = [
  { action: 'created', label: 'Konten dibuat', kind: 'create' },
  { action: 'updated', label: 'Konten diubah', kind: 'update' },
  { action: 'deleted', label: 'Konten dihapus', kind: 'delete' },
  { action: 'reordered', label: 'Urutan konten diubah', kind: 'update' },
  { action: 'configured', label: 'Pengaturan portal diubah', kind: 'update' },
] as const satisfies readonly ActivityDeclaration[];

/** An extra plain field a type carries in `fields`, besides the common parts. */
export interface ContentFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  input?: 'text' | 'url';
  max?: number;
}

/**
 * How a type's entries are listed: by their date, newest first (`newest`),
 * soonest first with undated ones last (`upcoming`), or in the order the
 * school sets (`manual`).
 */
export type ContentOrder = 'newest' | 'upcoming' | 'manual';

/**
 * One kind of entry. The common parts a type uses are named by their label;
 * a type without a label for a part does not have it, and the server clears
 * whatever is sent for it.
 */
export interface ContentTypeDef {
  label: string;
  singular: string;
  portals: readonly Portal[];
  order: ContentOrder;
  title: string;
  summary?: string;
  body?: string;
  image?: string;
  file?: string;
  date?: string;
  fields: readonly ContentFieldDef[];
  /** Where the entries show on the site, for the admin. */
  note: string;
}

const ALL: readonly Portal[] = PORTALS;
const SCHOOLS: readonly Portal[] = ['smp', 'sma'];

export const CONTENT_TYPES = {
  berita: {
    label: 'Berita & artikel',
    singular: 'berita',
    portals: ALL,
    order: 'newest',
    title: 'Judul',
    summary: 'Ringkasan',
    body: 'Isi berita',
    image: 'Foto sampul',
    date: 'Tanggal terbit',
    fields: [{ key: 'category', label: 'Kategori', placeholder: 'Kegiatan, Keagamaan, Prestasi', max: 60 }],
    note: 'Kabar terbaru di beranda dan halaman Berita.',
  },
  agenda: {
    label: 'Agenda',
    singular: 'agenda',
    portals: ALL,
    order: 'upcoming',
    title: 'Nama acara',
    summary: 'Keterangan singkat',
    date: 'Tanggal acara',
    fields: [{ key: 'label', label: 'Label', placeholder: 'PPDB, Ujian, Libur', max: 30 }],
    note: 'Agenda terdekat di beranda. Kosongkan tanggal bila belum pasti; tampil sebagai "Segera".',
  },
  galeri: {
    label: 'Galeri',
    singular: 'foto galeri',
    portals: ALL,
    order: 'newest',
    title: 'Judul foto',
    summary: 'Keterangan',
    image: 'Foto',
    date: 'Tanggal kegiatan',
    fields: [{ key: 'video', label: 'Tautan video YouTube (opsional)', placeholder: 'https://youtu.be/...', input: 'url', max: 300 }],
    note: 'Halaman Galeri dan potongan galeri di beranda.',
  },
  prestasi: {
    label: 'Prestasi',
    singular: 'prestasi',
    portals: ALL,
    order: 'newest',
    title: 'Judul prestasi',
    summary: 'Keterangan',
    image: 'Foto',
    date: 'Tanggal',
    fields: [
      { key: 'student', label: 'Nama siswa atau tim', max: 160 },
      { key: 'level', label: 'Tingkat lomba', placeholder: 'Kabupaten, Provinsi, Nasional', max: 60 },
    ],
    note: 'Halaman Prestasi dan bagian Prestasi di beranda portal.',
  },
  fasilitas: {
    label: 'Fasilitas',
    singular: 'fasilitas',
    portals: ALL,
    order: 'manual',
    title: 'Nama fasilitas',
    summary: 'Keterangan',
    image: 'Foto',
    fields: [],
    note: 'Halaman Fasilitas.',
  },
  guru: {
    label: 'Guru & staf',
    singular: 'guru atau staf',
    portals: ALL,
    order: 'manual',
    title: 'Nama lengkap',
    summary: 'Profil singkat',
    image: 'Foto',
    fields: [{ key: 'position', label: 'Jabatan atau mata pelajaran', placeholder: 'Guru Matematika', max: 120 }],
    note: 'Halaman Guru & staf.',
  },
  dokumen: {
    label: 'Dokumen',
    singular: 'dokumen',
    portals: ALL,
    order: 'manual',
    title: 'Nama dokumen',
    summary: 'Keterangan',
    file: 'Berkas',
    fields: [{ key: 'kind', label: 'Jenis', placeholder: 'Brosur, Formulir, Surat edaran', max: 60 }],
    note: 'Halaman Download dokumen.',
  },
  ekskul: {
    label: 'Ekstrakurikuler',
    singular: 'ekstrakurikuler',
    portals: SCHOOLS,
    order: 'manual',
    title: 'Nama kegiatan',
    summary: 'Keterangan singkat',
    body: 'Uraian',
    image: 'Foto kegiatan',
    fields: [
      { key: 'coach', label: 'Pembina', max: 120 },
      { key: 'schedule', label: 'Jadwal', placeholder: 'Sabtu, 07.30', max: 120 },
    ],
    note: 'Bagian Ekstrakurikuler, dengan foto besar per kegiatan.',
  },
  akademik: {
    label: 'Akademik',
    singular: 'info akademik',
    portals: SCHOOLS,
    order: 'manual',
    title: 'Judul',
    summary: 'Keterangan singkat',
    body: 'Isi',
    image: 'Foto',
    file: 'Lampiran (opsional)',
    fields: [],
    note: 'Bagian Akademik: kurikulum, kalender akademik, program belajar.',
  },
  faq: {
    label: 'Tanya jawab',
    singular: 'pertanyaan',
    portals: ALL,
    order: 'manual',
    title: 'Pertanyaan',
    body: 'Jawaban',
    fields: [],
    note: 'Bagian Q&A.',
  },
  alumni: {
    label: 'Alumni',
    singular: 'alumni',
    portals: ['sma'],
    order: 'manual',
    title: 'Nama alumni',
    summary: 'Cerita singkat',
    image: 'Foto',
    fields: [
      { key: 'year', label: 'Angkatan (tahun lulus)', placeholder: '2024', max: 10 },
      { key: 'now', label: 'Kampus atau karier sekarang', max: 160 },
    ],
    note: 'Halaman Alumni SMA.',
  },
  testimoni: {
    label: 'Testimoni',
    singular: 'testimoni',
    portals: ALL,
    order: 'manual',
    title: 'Nama',
    summary: 'Kutipan',
    image: 'Foto',
    fields: [{ key: 'role', label: 'Keterangan', placeholder: 'Wali santri kelas 8', max: 120 }],
    note: 'Kutipan wali santri dan alumni di beranda.',
  },
} as const satisfies Record<string, ContentTypeDef>;

export type ContentType = keyof typeof CONTENT_TYPES;
export const CONTENT_TYPE_KEYS = Object.keys(CONTENT_TYPES) as ContentType[];

export function contentType(type: string): ContentTypeDef | undefined {
  return Object.hasOwn(CONTENT_TYPES, type) ? (CONTENT_TYPES as Record<string, ContentTypeDef>)[type] : undefined;
}

/** The types a portal carries, in the order the admin lists them. */
export function portalTypes(portal: Portal): ContentType[] {
  return CONTENT_TYPE_KEYS.filter((type) => (CONTENT_TYPES[type].portals as readonly Portal[]).includes(portal));
}

/**
 * Types the Yayasan site shows from every portal, each entry labelled with
 * its school: one news page, one gallery, one staff list for the foundation.
 */
export const AGGREGATED_TYPES = ['berita', 'agenda', 'galeri', 'prestasi', 'fasilitas', 'guru', 'dokumen'] as const satisfies readonly ContentType[];

/** Types whose public list carries each entry's body: a FAQ answer is read in the list, never on a page of its own. */
export const LISTED_BODY_TYPES = ['faq'] as const satisfies readonly ContentType[];

export const ENTRY_STATUSES = ['draft', 'published'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const CONTENT_REFUSAL_CODES = [
  ...API_REFUSAL_CODES,
  'TYPE_NOT_FOUND',
  'ENTRY_NOT_FOUND',
  'STALE_REVISION',
] as const;
export type ContentRefusalCode = (typeof CONTENT_REFUSAL_CODES)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = z.string().regex(/^[0-9a-f-]{36}$/, 'Pilihan tidak dikenal');

export const entryInputSchema = z.object({
  title: z.string().trim().min(1, 'Wajib diisi').max(200, 'Paling banyak 200 huruf'),
  slug: z.string().trim().max(120).refine((value) => value === '' || SLUG.test(value), 'Hanya huruf kecil, angka dan tanda minus').default(''),
  summary: z.string().trim().max(600, 'Paling banyak 600 huruf').default(''),
  body: z.string().max(200_000, 'Isi terlalu panjang').default(''),
  imageId: id.nullable().default(null),
  fileId: id.nullable().default(null),
  date: z.iso.date('Tanggal tidak valid').nullable().default(null),
  fields: z.record(z.string().max(40), z.string().trim().max(500)).default({}),
  status: z.enum(ENTRY_STATUSES).default('draft'),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryUpdateSchema = entryInputSchema.extend({ revision: z.number().int().min(1) });
export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;

export const entryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(120).optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
  /** Only entries whose type takes a photo and that have none. */
  missingImage: z.enum(['1']).optional(),
});
export type EntryQuery = z.infer<typeof entryQuerySchema>;

export const reorderSchema = z.object({ ids: z.array(id).min(1).max(500) });

export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
  /** Agenda: only events from today on, plus undated ones. */
  upcoming: z.enum(['1']).optional(),
});
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;

/** A photo as entries and settings carry it; mirrors Media's reference so pages draw it without a lookup. */
export interface EntryImage {
  id: string;
  alt: string;
  width: number;
  height: number;
  sm: string;
  md: string;
  lg: string;
}

export interface EntryFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

/** One entry, as the admin API answers it. */
export interface ContentEntry {
  id: string;
  portal: Portal;
  type: ContentType;
  title: string;
  slug: string;
  summary: string;
  body: string;
  imageId: string | null;
  /** The chosen photo, or null when there is none or it was deleted from the library. */
  image: EntryImage | null;
  fileId: string | null;
  file: EntryFile | null;
  date: string | null;
  fields: Record<string, string>;
  status: EntryStatus;
  sortOrder: number;
  /** What the old site had, for entries brought over by the importer (say, the photo's old file name). */
  legacyNote: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface EntryPage {
  items: ContentEntry[];
  total: number;
  page: number;
  limit: number;
}

/** Per type, how many entries a portal has, and how many still need a photo. */
export interface TypeSummary {
  type: ContentType;
  total: number;
  published: number;
  withoutImage: number;
}

/** An entry as the public site gets it: published only, no admin notes. */
export interface PublicEntry {
  id: string;
  portal: Portal;
  type: ContentType;
  title: string;
  slug: string;
  summary: string;
  image: EntryImage | null;
  file: EntryFile | null;
  date: string | null;
  fields: Record<string, string>;
  /** Only for LISTED_BODY_TYPES in a list; always on a single entry. */
  body?: string;
}

export interface PublicEntryDetail extends PublicEntry {
  body: string;
}

export interface PublicEntryPage {
  items: PublicEntry[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Portal settings

const text = (max: number) => z.string().trim().max(max, `Paling banyak ${max} huruf`).default('');
const html = z.string().max(100_000, 'Isi terlalu panjang').default('');
/** A link the public site puts in an href: http(s) only, so no javascript: or data: address reaches a page. */
const webLink = text(300).refine((value) => value === '' || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value), 'Tulis alamat lengkap, diawali https://');

export const portalSettingsSchema = z.object({
  tagline: text(160),
  heroTitle: text(140),
  heroIntro: text(400),
  heroImageId: id.nullable().default(null),
  accreditation: text(10),
  stats: z.array(z.object({ value: text(16), label: text(60) })).max(4, 'Paling banyak 4 angka').default([]),
  visi: text(400),
  misi: z.array(z.string().trim().min(1).max(300)).max(12, 'Paling banyak 12 butir').default([]),
  profil: html,
  prakata: z
    .object({ name: text(120), role: text(120), photoId: id.nullable().default(null), body: html })
    .default({ name: '', role: '', photoId: null, body: '' }),
  kompetensi: z
    .array(z.object({ name: text(80), detail: text(160), target: text(60) }))
    .max(20, 'Paling banyak 20 baris')
    .default([]),
  takhosus: html,
  keasramaan: html,
  contact: z
    .object({
      address: text(300),
      area: text(160),
      phone: text(40),
      whatsapp: z.string().trim().max(20).regex(/^(\+?\d{8,15})?$/, 'Tulis nomor saja, misalnya 6281234567890').default(''),
      email: z.union([z.literal(''), z.email('Alamat email tidak valid')]).default(''),
      mapQuery: text(300),
      instagram: webLink,
      facebook: webLink,
      youtube: webLink,
      tiktok: webLink,
    })
    .default({ address: '', area: '', phone: '', whatsapp: '', email: '', mapQuery: '', instagram: '', facebook: '', youtube: '', tiktok: '' }),
  ppdb: z
    .object({ intro: text(600), flow: html, brochureFileId: id.nullable().default(null) })
    .default({ intro: '', flow: '', brochureFileId: null }),
});
export type PortalSettings = z.infer<typeof portalSettingsSchema>;

export const portalSettingsUpdateSchema = z.object({ settings: portalSettingsSchema, revision: z.number().int().min(0) });

/** Settings as the admin gets them: the values plus the resolved photos and files they point at. */
export interface PortalSettingsRecord {
  portal: Portal;
  settings: PortalSettings;
  images: Record<string, EntryImage>;
  files: Record<string, EntryFile>;
  /** 0 until the portal is first saved. */
  revision: number;
  updatedAt: number | null;
}

/** Whether a settings field applies to a portal: Takhosus and Keasramaan pages are the Yayasan's. */
export const YAYASAN_ONLY_SETTINGS = ['takhosus', 'keasramaan'] as const satisfies readonly (keyof PortalSettings)[];

/** The settings a portal starts with, before the school saves anything. */
export function emptySettings(): PortalSettings {
  return portalSettingsSchema.parse({});
}
