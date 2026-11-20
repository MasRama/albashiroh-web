import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTENT_TYPES,
  fillEmptySettings,
  importLegacyEntry,
  legacyImported,
  plainText,
  type ContentType,
  type EntryInput,
  type LegacySettings,
} from '../features/content';
import { discardMedia, fileRefs, imageRefs, storeMedia } from '../features/media';
import type { AssetStorage } from '../shared/storage';

/**
 * The import from the old SMP and SMA sites (Knex + SQLite). Their uploads
 * were lost with the old server, so records arrive without their photos and
 * files: each such entry carries a note for the admin, gallery photos and
 * documents come in as drafts (they are nothing without their file), and
 * photos that were pasted into an article as data survive and go into the
 * library. Every record is keyed by its old id, so running the import again
 * adds only what is new and never touches what the school has edited since.
 */
export type OldPortal = 'smp' | 'sma';

export interface TypeTally {
  type: ContentType;
  /** Records in the old database. */
  found: number;
  imported: number;
  /** Imported by an earlier run; left as they are. */
  existing: number;
  /** Refused by the entry checks; listed in `problems`. */
  invalid: number;
  /** Imported entries of a photo-carrying type that have no photo. */
  withoutImage: number;
  /** Imported as drafts (photo or file lost, or hidden on the old site). */
  drafts: number;
}

export interface PortalImport {
  portal: OldPortal;
  types: TypeTally[];
  /** Settings fields filled because they were still empty. */
  settings: string[];
  /** Photos pasted into old articles, now in the library. */
  recoveredPhotos: number;
  problems: string[];
}

type Row = Record<string, unknown>;

const LOST_PHOTO = 'Fotonya hilang bersama server lama. Unggah ulang dari arsip sekolah bila ada.';
const LOST_GALLERY_PHOTO = 'Foto galeri ini hilang bersama server lama. Unggah fotonya, lalu terbitkan.';
const LOST_FILE = 'Berkas ini hilang bersama server lama. Unggah berkasnya, lalu terbitkan.';
const HIDDEN = 'Disembunyikan di situs lama, jadi masuk sebagai draf.';

interface Planned {
  ref: string;
  note: string;
  input: EntryInput;
  /** Photos pasted into the old body as data URLs, by placeholder. */
  pasted?: { marker: string; mime: string; data: Buffer }[];
}

/** A column as text; the old sites sometimes saved a missing value as the word "null" or "undefined". */
const text = (value: unknown) => {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value);
  return /^\s*(?:null|undefined)\s*$/i.test(raw) ? '' : raw;
};
const active = (row: Row) => row.is_active === undefined || row.is_active === null || Number(row.is_active) === 1 || row.is_active === 'true';

/** An old millisecond timestamp as the school's calendar day (WIB). */
function wibDate(value: unknown): string | null {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text typed in a textarea, as paragraphs and line breaks. */
function paragraphs(value: string): string {
  return value
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((part) => `<p>${escapeHtml(part.trim()).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

/** A body that may be HTML from the old editor or plain text. */
function richText(value: string): string {
  return /<\/?(?:p|br|div|span|strong|b|em|i|u|s|a|ul|ol|li|h[1-6]|blockquote|img|table)\b[^>]*>/i.test(value) ? value : paragraphs(value);
}

/** The old editor's spacer paragraphs (`<p><br></p>`) go; the sanitizer drops its classes and styles. */
function withoutSpacers(html: string): string {
  return html.replace(/<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
}

/** Text of a piece of HTML, with a space where one block or line ends and the next begins. */
const shorten = (value: string, max: number) => plainText(value.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>|<br\s*\/?>/gi, '$& ').replace(/[\u200B-\u200D\uFEFF]/g, ''), max);

function entry(input: Partial<EntryInput> & Pick<EntryInput, 'title'>): EntryInput {
  return {
    slug: '',
    summary: '',
    body: '',
    imageId: null,
    fileId: null,
    date: null,
    fields: {},
    status: 'published',
    ...input,
    title: shorten(input.title, 200),
  };
}

function tableExists(source: Database.Database, table: string): boolean {
  return Boolean(source.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function rows(source: Database.Database, table: string, order: string): Row[] {
  if (!tableExists(source, table)) return [];
  const columns = new Set((source.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((column) => column.name));
  const by = order
    .split(',')
    .map((part) => part.trim())
    .filter((part) => columns.has(part.split(' ')[0]!.replace(/"/g, '')))
    .join(', ');
  return source.prepare(`SELECT * FROM "${table}"${by ? ` ORDER BY ${by}` : ''}`).all() as Row[];
}

const DATA_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)["'][^>]*>/gi;

/** Old posts: blog, news and event all become Berita; pasted photos are kept for the library. */
function planPosts(portal: OldPortal, source: Database.Database): Planned[] {
  return rows(source, 'posts', 'publish_date, created_at').map((row) => {
    const pasted: NonNullable<Planned['pasted']> = [];
    const body = withoutSpacers(text(row.content)).replace(DATA_IMAGE, (_match, mime: string, data: string) => {
      const marker = `<!--old-photo-${pasted.length}-->`;
      pasted.push({ marker, mime: mime === 'image/jpg' ? 'image/jpeg' : mime, data: Buffer.from(data.replace(/\s+/g, ''), 'base64') });
      return marker;
    });
    return {
      ref: `${portal}:posts:${text(row.id)}`,
      note: text(row.thumbnail_url).trim() ? LOST_PHOTO : '',
      pasted,
      input: entry({
        title: text(row.title),
        slug: text(row.slug),
        summary: shorten(body, 220),
        body,
        date: wibDate(row.publish_date) ?? wibDate(row.created_at),
        fields: text(row.category).trim() ? { category: shorten(text(row.category), 60) } : {},
      }),
    };
  });
}

function plan(portal: OldPortal, type: ContentType, source: Database.Database): Planned[] {
  const ref = (table: string, row: Row) => `${portal}:${table}:${text(row.id)}`;
  switch (type) {
    case 'berita':
      return planPosts(portal, source);
    case 'agenda':
      return rows(source, 'schedules', '"order", created_at').map((row) => ({
        ref: ref('schedules', row),
        note: active(row) ? '' : HIDDEN,
        input: entry({ title: text(row.title), summary: shorten(text(row.description), 600), status: active(row) ? 'published' : 'draft' }),
      }));
    case 'galeri':
      return rows(source, 'galleries', 'layout_order, created_at').map((row) => {
        const video = text(row.embed_url).trim();
        const isVideo = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(video);
        return {
          ref: ref('galleries', row),
          note: isVideo ? '' : LOST_GALLERY_PHOTO,
          input: entry({
            title: text(row.title),
            summary: shorten(text(row.description), 600),
            date: wibDate(row.created_at),
            fields: isVideo ? { video } : {},
            status: isVideo ? 'published' : 'draft',
          }),
        };
      });
    case 'prestasi':
      return rows(source, 'achievements', 'date, created_at').map((row) => ({
        ref: ref('achievements', row),
        note: text(row.image_url).trim() ? LOST_PHOTO : '',
        input: entry({
          title: text(row.title),
          summary: shorten(text(row.description), 600),
          date: wibDate(row.date) ?? wibDate(row.created_at),
          fields: { student: shorten(text(row.student_name), 160), level: shorten(text(row.level), 60) },
        }),
      }));
    case 'fasilitas':
      return rows(source, 'facilities', 'created_at').map((row) => ({
        ref: ref('facilities', row),
        note: text(row.image_url).trim() ? LOST_PHOTO : '',
        input: entry({ title: text(row.name), summary: shorten(text(row.description), 600) }),
      }));
    case 'guru':
      return rows(source, 'staff', 'created_at').map((row) => ({
        ref: ref('staff', row),
        note: text(row.photo_url).trim() ? LOST_PHOTO : '',
        input: entry({ title: text(row.name), summary: shorten(text(row.bio), 600), fields: { position: shorten(text(row.position), 120) } }),
      }));
    case 'dokumen':
      return rows(source, 'downloads', 'created_at').map((row) => ({
        ref: ref('downloads', row),
        note: LOST_FILE,
        input: entry({ title: text(row.title), slug: text(row.slug), fields: { kind: shorten(text(row.type), 60) }, status: 'draft' }),
      }));
    case 'ekskul':
      return rows(source, 'extracurriculars', 'created_at').map((row) => ({
        ref: ref('extracurriculars', row),
        note: text(row.image_url).trim() ? LOST_PHOTO : '',
        input: entry({
          title: text(row.name),
          summary: shorten(text(row.description), 600),
          body: richText(text(row.description)),
          fields: { coach: shorten(text(row.coach), 120), schedule: shorten(text(row.schedule), 120) },
        }),
      }));
    case 'akademik':
      return rows(source, 'curriculums', 'created_at').map((row) => {
        const body = withoutSpacers(richText(text(row.description)));
        return { ref: ref('curriculums', row), note: '', input: entry({ title: 'Kurikulum', summary: shorten(body, 220), body }) };
      });
    case 'faq':
      return rows(source, 'faqs', '"order", created_at').map((row) => ({
        ref: ref('faqs', row),
        note: active(row) ? '' : HIDDEN,
        input: entry({ title: text(row.question), body: richText(text(row.answer)), status: active(row) ? 'published' : 'draft' }),
      }));
    case 'testimoni':
      return rows(source, 'testimonials', '"order", created_at').map((row) => ({
        ref: ref('testimonials', row),
        note: [text(row.image_url).trim() ? LOST_PHOTO : '', active(row) ? '' : HIDDEN].filter(Boolean).join(' '),
        input: entry({ title: text(row.name), summary: shorten(text(row.description), 600), status: active(row) ? 'published' : 'draft' }),
      }));
    default:
      return [];
  }
}

/** The types the old sites had, in the order they are imported and reported. */
export const OLD_SITE_TYPES = ['berita', 'agenda', 'galeri', 'prestasi', 'fasilitas', 'guru', 'dokumen', 'ekskul', 'akademik', 'faq', 'testimoni'] as const satisfies readonly ContentType[];

/** A link as typed on the old site, without the tracking part apps append when sharing. */
function cleanLink(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

/** An Indonesian phone number as WhatsApp wants it: country code, digits only. */
export function whatsappNumber(value: unknown): string {
  const digits = text(value).replace(/\D/g, '');
  const number = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return /^\d{8,15}$/.test(number) ? number : '';
}

function planSettings(source: Database.Database): LegacySettings {
  const profile = rows(source, 'school_profile', 'updated_at DESC')[0];
  const missions = rows(source, 'school_missions', '"order", created_at')
    .filter(active)
    .map((row) => shorten(text(row.content), 300))
    .filter(Boolean);
  const listed = text(profile?.misi)
    .split(/\r?\n/)
    .map((line) => shorten(line.replace(/^\s*\d+\s*[.)]\s*/, ''), 300))
    .filter(Boolean);
  const email = text(profile?.email).trim();
  return {
    visi: shorten(text(profile?.visi), 400),
    misi: (missions.length > 0 ? missions : listed).slice(0, 12),
    contact: {
      address: shorten(text(profile?.address), 300),
      phone: shorten(text(profile?.phone), 40),
      whatsapp: whatsappNumber(profile?.phone),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
      facebook: cleanLink(profile?.facebook_url),
      instagram: cleanLink(profile?.instagram_url),
      youtube: cleanLink(profile?.youtube_url),
      tiktok: cleanLink(profile?.tiktok_url),
    },
  };
}

const host = { images: imageRefs, files: fileRefs };

/** Imports one old school site from an open (read-only) copy of its database. */
export async function importOldSite(portal: OldPortal, source: Database.Database, storage: AssetStorage): Promise<PortalImport> {
  const report: PortalImport = { portal, types: [], settings: [], recoveredPhotos: 0, problems: [] };
  for (const type of OLD_SITE_TYPES) {
    if (!(CONTENT_TYPES[type].portals as readonly string[]).includes(portal)) continue;
    const planned = plan(portal, type, source);
    const tally: TypeTally = { type, found: planned.length, imported: 0, existing: 0, invalid: 0, withoutImage: 0, drafts: 0 };
    for (const item of planned) {
      const outcome = await importPlanned(portal, type, item, storage, report);
      if (outcome.status === 'exists') tally.existing += 1;
      else if (outcome.status === 'invalid') {
        tally.invalid += 1;
        report.problems.push(`${portal} ${type} "${item.input.title}": ${Object.entries(outcome.errors).map(([key, messages]) => `${key}: ${messages.join(', ')}`).join('; ')}`);
      } else {
        tally.imported += 1;
        if ('image' in CONTENT_TYPES[type] && !outcome.imageId) tally.withoutImage += 1;
        if (outcome.status === 'draft') tally.drafts += 1;
      }
    }
    report.types.push(tally);
  }
  const filled = fillEmptySettings(portal, planSettings(source), host);
  if (filled.status === 'filled') report.settings = filled.keys;
  else report.problems.push(`${portal} settings: ${Object.entries(filled.errors).map(([key, messages]) => `${key}: ${messages.join(', ')}`).join('; ')}`);
  return report;
}

type Outcome = { status: 'published' | 'draft'; imageId: string | null } | { status: 'exists' } | { status: 'invalid'; errors: Record<string, string[]> };

const RECOVERED_COVER = 'Foto sampul diambil dari foto di dalam isi berita lama; sampul aslinya hilang bersama server lama.';

async function importPlanned(portal: OldPortal, type: ContentType, item: Planned, storage: AssetStorage, report: PortalImport): Promise<Outcome> {
  // A record imported by an earlier run stays as the school left it, and its pasted photos are not stored again.
  if (legacyImported(item.ref)) return { status: 'exists' };
  let { body } = item.input;
  const stored: string[] = [];
  // The old covers were lost, so the first photo from the article becomes the cover, and leaves the body so it does not show twice.
  const takesCover = !item.input.imageId && 'image' in CONTENT_TYPES[type];
  for (const photo of item.pasted ?? []) {
    const extension = photo.mime === 'image/jpeg' ? 'jpg' : photo.mime.split('/')[1]!;
    const alt = shorten(item.input.title, 300);
    const saved = await storeMedia(storage, { name: `${shorten(item.input.title, 80)}.${extension}`, type: photo.mime, data: photo.data, alt, createdBy: null });
    if (saved.ok) {
      const isCover = takesCover && stored.length === 0;
      stored.push(saved.item.id);
      body = body.replace(photo.marker, isCover ? '' : `<img src="/media/${saved.item.id}/lg.webp" alt="${escapeHtml(alt)}">`);
    } else {
      body = body.replace(photo.marker, '');
      report.problems.push(`${portal} ${type} "${item.input.title}": a pasted photo could not be read (${saved.code})`);
    }
  }
  const imageId = item.input.imageId ?? (takesCover ? (stored[0] ?? null) : null);
  // The paragraph that held only the cover photo is now empty.
  body = withoutSpacers(body);
  const note = imageId && item.note === LOST_PHOTO ? RECOVERED_COVER : item.note;
  const outcome = importLegacyEntry(portal, type, { ref: item.ref, note, input: { ...item.input, body, imageId } }, host);
  if (outcome.status !== 'imported') {
    await Promise.all(stored.map((id) => discardMedia(storage, id)));
    return outcome;
  }
  report.recoveredPhotos += stored.length;
  return { status: outcome.row.status === 'draft' ? 'draft' : 'published', imageId };
}

/**
 * Imports one old site straight from its database file without ever writing
 * to it: the file (with any -wal/-shm beside it) is copied to a fresh temp
 * folder, the copy is opened read-only, and the copy is removed afterwards.
 */
export async function importOldSiteFile(portal: OldPortal, file: string, storage: AssetStorage): Promise<PortalImport> {
  if (!existsSync(file)) throw new Error(`Old ${portal.toUpperCase()} database not found: ${file}`);
  const folder = mkdtempSync(join(tmpdir(), `albashiroh-old-${portal}-`));
  const copy = join(folder, 'old.db');
  try {
    copyFileSync(file, copy);
    for (const suffix of ['-wal', '-shm']) if (existsSync(file + suffix)) copyFileSync(file + suffix, copy + suffix);
    // A WAL copy needs write access once to fold the log in; do that on the copy, then read it read-only.
    if (existsSync(copy + '-wal')) {
      const folding = new Database(copy);
      folding.pragma('wal_checkpoint(TRUNCATE)');
      folding.close();
    }
    const source = new Database(copy, { readonly: true, fileMustExist: true });
    try {
      return await importOldSite(portal, source, storage);
    } finally {
      source.close();
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
