import { CONTENT_TYPES, portalSettingsSchema, type ContentType, type EntryInput, type Portal, type PortalSettings } from '../contract';
import { homeSections } from '../home';
import type { ContentServerHost } from './host';
import { freeSlug, slugTaken, todayInJakarta, type EntryValues } from './repository';
import { sanitizeRichText, slugify } from './sanitize';

export type Checked<T> = { ok: true; values: T } | { ok: false; errors: Record<string, string[]> };

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * An entry as its type keeps it: parts the type does not have are cleared,
 * undeclared fields dropped, the body sanitized, photos and documents checked
 * against the library, and the address made from the title when none is given.
 */
export function entryValues(
  portal: Portal,
  type: ContentType,
  input: EntryInput,
  host: Pick<ContentServerHost, 'images' | 'files'>,
  exceptId?: string,
): Checked<EntryValues> {
  const def = CONTENT_TYPES[type] as (typeof CONTENT_TYPES)[ContentType] & Partial<Record<'summary' | 'body' | 'image' | 'file' | 'date', string>>;
  const errors: Record<string, string[]> = {};
  const fail = (key: string, message: string) => (errors[key] ??= []).push(message);

  const fields: Record<string, string> = {};
  for (const field of def.fields) {
    const value = (input.fields[field.key] ?? '').trim();
    if (!value) continue;
    if ('max' in field && field.max !== undefined && value.length > field.max) fail(`fields.${field.key}`, `Paling banyak ${field.max} huruf`);
    else if ('input' in field && field.input === 'url' && !isWebAddress(value)) fail(`fields.${field.key}`, 'Tulis alamat lengkap, diawali https://');
    else fields[field.key] = value;
  }

  const imageId = def.image ? input.imageId : null;
  if (imageId && !host.images([imageId]).has(imageId)) fail('imageId', 'Foto ini tidak ada lagi di pustaka. Pilih foto lain.');
  const fileId = def.file ? input.fileId : null;
  if (fileId && !host.files([fileId]).has(fileId)) fail('fileId', 'Berkas ini tidak ada lagi di pustaka. Pilih berkas lain.');

  let slug = input.slug;
  if (slug && slugTaken(portal, type, slug, exceptId)) fail('slug', 'Alamat ini sudah dipakai entri lain.');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!slug) slug = freeSlug(portal, type, slugify(input.title), exceptId);

  let date = def.date ? input.date : null;
  // A published news item, photo or achievement always has a date to sort and show by.
  if (!date && def.date && def.order === 'newest' && input.status === 'published') date = todayInJakarta();

  return {
    ok: true,
    values: {
      title: input.title,
      slug,
      summary: def.summary ? input.summary : '',
      body: def.body ? sanitizeRichText(input.body) : '',
      imageId,
      fileId,
      date,
      fields,
      status: input.status,
    },
  };
}

/**
 * Settings as a portal keeps them: rich text sanitized, photos and documents
 * that are gone from the library dropped, Yayasan-only pages cleared on the
 * school portals, the home page kept to the sections and texts the portal has.
 */
export function settingsValues(portal: Portal, input: PortalSettings, host: Pick<ContentServerHost, 'images' | 'files'>): Checked<PortalSettings> {
  const errors: Record<string, string[]> = {};
  const settings = portalSettingsSchema.parse(input);
  const image = (key: string, value: string | null) => {
    if (value && !host.images([value]).has(value)) (errors[key] ??= []).push('Foto ini tidak ada lagi di pustaka. Pilih foto lain.');
  };
  image('settings.heroImageId', settings.heroImageId);
  image('settings.prakata.photoId', settings.prakata.photoId);
  image('settings.video.posterId', settings.video.posterId);
  const brochure = settings.ppdb.brochureFileId;
  if (brochure && !host.files([brochure]).has(brochure)) (errors['settings.ppdb.brochureFileId'] ??= []).push('Berkas ini tidak ada lagi di pustaka. Pilih berkas lain.');

  // Only this portal's sections and texts are kept; a text left as its fallback is not saved, so a later change to the fallback still shows.
  const sections = homeSections(portal);
  const text: Record<string, string> = {};
  for (const def of sections.flatMap((section) => section.texts)) {
    const value = settings.home.text[def.key] ?? '';
    if (value.length > def.max) (errors[`settings.home.text.${def.key}`] ??= []).push(`Paling banyak ${def.max} huruf`);
    else if (value && value !== def.fallback) text[def.key] = value;
  }
  const hidden = sections.filter((section) => section.hideable && settings.home.hidden.includes(section.key)).map((section) => section.key);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const school = portal !== 'yayasan';
  return {
    ok: true,
    values: {
      ...settings,
      home: { hidden, text },
      stats: settings.stats.filter((stat) => stat.value || stat.label),
      kompetensi: settings.kompetensi.filter((row) => row.name),
      profil: sanitizeRichText(settings.profil),
      prakata: { ...settings.prakata, body: sanitizeRichText(settings.prakata.body) },
      takhosus: school ? '' : sanitizeRichText(settings.takhosus),
      keasramaan: school ? '' : sanitizeRichText(settings.keasramaan),
      ppdb: { ...settings.ppdb, flow: sanitizeRichText(settings.ppdb.flow) },
    },
  };
}
