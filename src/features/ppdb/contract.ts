import { z } from 'zod';
import { API_REFUSAL_CODES } from '../../shared/security/codes';
import type { AccessRule } from '../../shared/security/access';
import { permissionRules } from '../../shared/security/access';
import type { ActivityDeclaration } from '../../shared/security/activity';
import type { PermissionDeclaration } from '../../shared/security/permissions';

export const featureName = 'ppdb' as const;
export type FeatureName = typeof featureName;

/**
 * PPDB is the online registration for new students: one form for both
 * schools, where the applicant picks SMP or SMA, and the committee's list of
 * applicants with their status and a CSV or Excel export. The fields follow
 * the school's earlier online form.
 */
export const LEVELS = ['smp', 'sma'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { smp: 'SMP', sma: 'SMA' };

export const GENDERS = ['L', 'P'] as const;
export const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = { L: 'Laki-laki', P: 'Perempuan' };

export const EDUCATION = ['S3', 'S2', 'S1', 'Diploma (D1–D4)', 'SMA/SMK/MA', 'SMP/MTs', 'SD/MI', 'Tidak sekolah'] as const;
export const JOBS = ['PNS / P3K / TNI / POLRI / Anggota Dewan', 'Swasta / Wiraswasta', 'IRT / Tidak bekerja', 'Sudah meninggal'] as const;
export const INCOMES = ['Kurang dari Rp500.000', 'Rp500.000 – Rp1.000.000', 'Rp1.000.000 – Rp3.000.000', 'Lebih dari Rp3.000.000', 'Tidak berpenghasilan'] as const;

export const BOARDING = ['bersedia', 'tidak'] as const;
export const BOARDING_LABEL: Record<(typeof BOARDING)[number], string> = { bersedia: 'Bersedia berasrama', tidak: 'Tidak bersedia' };
export const PAYMENTS = ['tunai', 'transfer'] as const;
export const PAYMENT_LABEL: Record<(typeof PAYMENTS)[number], string> = { tunai: 'Tunai', transfer: 'Transfer' };

export const STATUSES = ['baru', 'diverifikasi', 'diterima', 'ditolak'] as const;
export type ApplicationStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<ApplicationStatus, string> = { baru: 'Baru', diverifikasi: 'Diverifikasi', diterima: 'Diterima', ditolak: 'Tidak diterima' };

export const PPDB_PERMISSIONS = [
  { action: 'view', name: 'Lihat pendaftar PPDB', description: 'Melihat dan mengunduh data pendaftar PPDB' },
  { action: 'manage', name: 'Kelola PPDB', description: 'Mengubah status pendaftar, menghapus data, dan mengatur formulir PPDB' },
] as const satisfies readonly PermissionDeclaration[];

export interface PpdbAccess {
  readonly view: AccessRule;
  readonly manage: AccessRule;
}

export function ppdbAccess(resource: string): PpdbAccess {
  const rule = permissionRules(resource, PPDB_PERMISSIONS);
  return { view: rule('view'), manage: rule('manage') };
}

/** What PPDB reports to the activity trail. Applicants sign up without an account, so only the committee's actions are recorded. */
export const PPDB_ACTIVITY = [
  { action: 'reviewed', label: 'Status pendaftar diubah', kind: 'update' },
  { action: 'deleted', label: 'Data pendaftar dihapus', kind: 'delete' },
  { action: 'exported', label: 'Data pendaftar diunduh', kind: 'access' },
  { action: 'configured', label: 'Pengaturan PPDB diubah', kind: 'update' },
] as const satisfies readonly ActivityDeclaration[];

/** Every code the PPDB API answers a refusal with. */
export const PPDB_REFUSAL_CODES = [
  ...API_REFUSAL_CODES,
  'PPDB_CLOSED',
  'SPAM_REFUSED',
  'FORM_EXPIRED',
  'ALREADY_REGISTERED',
  'APPLICATION_NOT_FOUND',
  'STALE_REVISION',
] as const;
export type PpdbRefusalCode = (typeof PPDB_REFUSAL_CODES)[number];

/** The fewest seconds a person needs to fill the form; a faster post is a script. */
export const MIN_FILL_MS = 5_000;
/** How long an opened form stays valid. */
export const FORM_TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const name = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} wajib diisi`).max(max, `${label} terlalu panjang`);
const digits = (count: number, message: string) => z.string().trim().regex(new RegExp(`^\\d{${count}}$`), message);

/** Indonesian numbers in any common spelling (0812…, +62 812…, 62812…), stored as 62812…. */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s().-]/g, '');
  if (compact.startsWith('+62')) return `62${compact.slice(3)}`;
  if (compact.startsWith('0')) return `62${compact.slice(1)}`;
  return compact;
}

/** A date written YYYY-MM-DD that exists on the calendar. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parentSchema(label: 'ayah' | 'ibu') {
  const thisYear = new Date().getFullYear();
  return z.object({
    name: name(2, 120, `Nama ${label}`),
    nik: digits(16, `NIK ${label} berisi 16 angka, lihat di KTP atau KK`),
    // An empty box means not filled in, not the year 0.
    birthYear: z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce
      .number({ message: `Tahun lahir ${label} wajib diisi` })
      .int(`Tahun lahir ${label} ditulis 4 angka`)
      .min(1930, `Tahun lahir ${label} tidak valid`)
      .max(thisYear - 15, `Tahun lahir ${label} tidak valid`)),
    education: z.enum(EDUCATION, { message: `Pilih pendidikan terakhir ${label}` }),
    job: z.enum(JOBS, { message: `Pilih pekerjaan ${label}` }),
    income: z.enum(INCOMES, { message: `Pilih penghasilan ${label}` }),
  });
}

/** One registration as the public form sends it. `website` is a field people never see; `token` dates when the form was opened. */
export const applicationInputSchema = z.object({
  level: z.enum(LEVELS, { message: 'Pilih jenjang SMP atau SMA' }),
  student: z.object({
    name: name(3, 120, 'Nama lengkap'),
    birthPlace: name(2, 80, 'Tempat lahir'),
    birthDate: z
      .string()
      .trim()
      .min(1, 'Tanggal lahir wajib diisi')
      .refine(isCalendarDate, 'Tanggal lahir tidak valid')
      .refine((value) => {
        const age = (Date.now() - Date.parse(`${value}T00:00:00Z`)) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 9 && age <= 21;
      }, 'Periksa lagi tahun lahir calon siswa'),
    gender: z.enum(GENDERS, { message: 'Pilih jenis kelamin' }),
    nisn: digits(10, 'NISN berisi 10 angka, lihat di rapor atau ijazah'),
    previousSchool: name(3, 120, 'Asal sekolah'),
  }),
  father: parentSchema('ayah'),
  mother: parentSchema('ibu'),
  address: name(10, 400, 'Alamat rumah'),
  postalCode: digits(5, 'Kode pos berisi 5 angka'),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => /^62\d{8,13}$/.test(value), 'Tulis nomor HP aktif, misalnya 081234567890'),
  boarding: z.enum(BOARDING, { message: 'Pilih kesediaan berasrama' }),
  payment: z.enum(PAYMENTS, { message: 'Pilih cara membayar infaq pendaftaran' }),
  website: z.string().max(200).default(''),
  token: z.string().max(200).default(''),
});
export type ApplicationInput = z.input<typeof applicationInputSchema>;
export type ApplicationValues = Omit<z.output<typeof applicationInputSchema>, 'website' | 'token'>;
export type Parent = ApplicationValues['father'];

/** A registration as the committee sees it. */
export interface Application extends ApplicationValues {
  id: string;
  code: string;
  status: ApplicationStatus;
  note: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

/** A row in the committee's list: enough to find and sort a registration. */
export interface ApplicationSummary {
  id: string;
  code: string;
  level: Level;
  status: ApplicationStatus;
  name: string;
  previousSchool: string;
  phone: string;
  createdAt: number;
}

export const applicationQuerySchema = z.object({
  level: z.enum(LEVELS).optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;

export const exportQuerySchema = applicationQuerySchema.omit({ page: true, limit: true }).extend({ format: z.enum(['csv', 'xlsx']).default('xlsx') });

export interface ApplicationPage {
  items: ApplicationSummary[];
  total: number;
  page: number;
  limit: number;
  /** Registrations per level and status, for the counters above the list. */
  counts: Record<Level, Record<ApplicationStatus, number>>;
}

export const reviewSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(1000).default(''),
  revision: z.number().int().min(1),
});

const groupLink = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === '' || /^https:\/\/\S+$/.test(value), 'Tulis alamat lengkap yang diawali https://')
  .default('');

/** What the committee sets: whether the form takes registrations, and what an applicant reads once registered. */
export const ppdbSettingsSchema = z.object({
  open: z.boolean().default(false),
  /** The season, "2027/2028": registrations are numbered and checked for repeats per season. */
  academicYear: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === '' || (/^\d{4}\/\d{4}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1), 'Tulis dua tahun berurutan, seperti 2027/2028')
    .default(''),
  /** Per level: payment and next steps, plain text shown on the success screen. */
  nextSteps: z
    .object({ smp: z.string().trim().max(2000).default(''), sma: z.string().trim().max(2000).default('') })
    .default({ smp: '', sma: '' }),
  /** Per level: the parents' WhatsApp group. */
  groupLink: z.object({ smp: groupLink, sma: groupLink }).default({ smp: '', sma: '' }),
});
export type PpdbSettings = z.infer<typeof ppdbSettingsSchema>;

/**
 * The year a registration's number and repeat check count toward: the first
 * year of the season the committee set ("2027/2028" gives 2027), so a season
 * that runs past New Year keeps one numbering; without a season, the calendar
 * year in the school's time zone (WIB).
 */
export function registrationSeason(academicYear: string, now: number): number {
  const start = /^(\d{4})\//.exec(academicYear)?.[1];
  return start ? Number(start) : new Date(now + 7 * 60 * 60 * 1000).getUTCFullYear();
}

export const ppdbSettingsUpdateSchema = z.object({ settings: ppdbSettingsSchema, revision: z.number().int().min(0) });

export interface PpdbSettingsRecord {
  settings: PpdbSettings;
  /** 0 until first saved. */
  revision: number;
  updatedAt: number | null;
}

/** What the public form reads before it shows. */
export interface PpdbForm {
  open: boolean;
  academicYear: string;
  token: string;
}

/** What an applicant sees once registered. */
export interface Receipt {
  code: string;
  level: Level;
  name: string;
  createdAt: number;
  nextSteps: string;
  groupLink: string;
}

export function emptyPpdbSettings(): PpdbSettings {
  return ppdbSettingsSchema.parse({});
}

/** The columns of the CSV and Excel exports, in order. */
export const EXPORT_COLUMNS: readonly { header: string; value: (application: Application) => string }[] = [
  { header: 'No. pendaftaran', value: (a) => a.code },
  // The school's own date (WIB), not UTC: a registration at 06.00 WIB belongs to that day.
  { header: 'Tanggal daftar', value: (a) => new Date(a.createdAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) },
  { header: 'Jenjang', value: (a) => LEVEL_LABEL[a.level] },
  { header: 'Status', value: (a) => STATUS_LABEL[a.status] },
  { header: 'Nama lengkap', value: (a) => a.student.name },
  { header: 'Tempat lahir', value: (a) => a.student.birthPlace },
  { header: 'Tanggal lahir', value: (a) => a.student.birthDate },
  { header: 'Jenis kelamin', value: (a) => GENDER_LABEL[a.student.gender] },
  { header: 'NISN', value: (a) => a.student.nisn },
  { header: 'Asal sekolah', value: (a) => a.student.previousSchool },
  ...(['father', 'mother'] as const).flatMap((who) => {
    const label = who === 'father' ? 'ayah' : 'ibu';
    return [
      { header: `Nama ${label}`, value: (a: Application) => a[who].name },
      { header: `NIK ${label}`, value: (a: Application) => a[who].nik },
      { header: `Tahun lahir ${label}`, value: (a: Application) => String(a[who].birthYear) },
      { header: `Pendidikan ${label}`, value: (a: Application) => a[who].education },
      { header: `Pekerjaan ${label}`, value: (a: Application) => a[who].job },
      { header: `Penghasilan ${label}`, value: (a: Application) => a[who].income },
    ];
  }),
  { header: 'Alamat', value: (a) => a.address },
  { header: 'Kode pos', value: (a) => a.postalCode },
  { header: 'Nomor HP', value: (a) => a.phone },
  { header: 'Asrama', value: (a) => BOARDING_LABEL[a.boarding] },
  { header: 'Infaq pendaftaran', value: (a) => PAYMENT_LABEL[a.payment] },
  { header: 'Catatan panitia', value: (a) => a.note },
];
