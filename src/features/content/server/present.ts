import {
  CONTENT_TYPES,
  LISTED_BODY_TYPES,
  portalTypes,
  type ContentEntry,
  type EntryFile,
  type EntryImage,
  type Portal,
  type PortalSettings,
  type PortalSettingsRecord,
  type PublicEntry,
  type PublicEntryDetail,
  type TypeSummary,
} from '../contract';
import type { ContentServerHost } from './host';
import { entryImageIds, parseFields, type EntryRow, type StoredSettings } from './repository';

type Refs = Pick<ContentServerHost, 'images' | 'files'>;

function resolve(rows: readonly EntryRow[], host: Refs) {
  const images = host.images(rows.flatMap((row) => (row.image_id ? [row.image_id] : [])));
  const files = host.files(rows.flatMap((row) => (row.file_id ? [row.file_id] : [])));
  return {
    image: (row: EntryRow): EntryImage | null => (row.image_id ? images.get(row.image_id) ?? null : null),
    file: (row: EntryRow): EntryFile | null => (row.file_id ? files.get(row.file_id) ?? null : null),
  };
}

export function presentEntries(rows: readonly EntryRow[], host: Refs): ContentEntry[] {
  const refs = resolve(rows, host);
  return rows.map((row) => ({
    id: row.id,
    portal: row.portal,
    type: row.type,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    imageId: row.image_id,
    image: refs.image(row),
    fileId: row.file_id,
    file: refs.file(row),
    date: row.date,
    fields: parseFields(row),
    status: row.status,
    sortOrder: row.sort_order,
    legacyNote: row.legacy_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  }));
}

export function presentEntry(row: EntryRow, host: Refs): ContentEntry {
  return presentEntries([row], host)[0]!;
}

export function presentPublic(rows: readonly EntryRow[], host: Refs): PublicEntry[] {
  const refs = resolve(rows, host);
  return rows.map((row) => ({
    id: row.id,
    portal: row.portal,
    type: row.type,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    image: refs.image(row),
    file: refs.file(row),
    date: row.date,
    fields: parseFields(row),
    ...((LISTED_BODY_TYPES as readonly string[]).includes(row.type) ? { body: row.body } : {}),
  }));
}

export function presentPublicDetail(row: EntryRow, host: Refs): PublicEntryDetail {
  return { ...presentPublic([row], host)[0]!, body: row.body };
}

/** Whether a type takes a photo, so an entry without one needs attention. */
export function takesImage(type: string): boolean {
  return Object.hasOwn(CONTENT_TYPES, type) && 'image' in CONTENT_TYPES[type as keyof typeof CONTENT_TYPES];
}

/** Ids of entries that take a photo but have none, or whose photo was deleted from the library. */
export function withoutImage(rows: readonly { id: string; type: string; imageId: string | null }[], host: Refs): Set<string> {
  const candidates = rows.filter((row) => takesImage(row.type));
  const existing = host.images(candidates.flatMap((row) => (row.imageId ? [row.imageId] : [])));
  return new Set(candidates.filter((row) => !row.imageId || !existing.has(row.imageId)).map((row) => row.id));
}

export function portalSummary(portal: Portal, host: Refs): TypeSummary[] {
  const rows = entryImageIds(portal);
  const missing = withoutImage(rows, host);
  return portalTypes(portal).map((type) => {
    const ofType = rows.filter((row) => row.type === type);
    return {
      type,
      total: ofType.length,
      published: ofType.filter((row) => row.status === 'published').length,
      withoutImage: ofType.filter((row) => missing.has(row.id)).length,
    };
  });
}

function settingsMediaIds(settings: PortalSettings): { images: string[]; files: string[] } {
  return {
    images: [settings.heroImageId, settings.prakata.photoId, settings.video.posterId].filter((value): value is string => Boolean(value)),
    files: [settings.ppdb.brochureFileId].filter((value): value is string => Boolean(value)),
  };
}

export function presentSettings(portal: Portal, stored: StoredSettings, host: Refs): PortalSettingsRecord {
  const ids = settingsMediaIds(stored.settings);
  return {
    portal,
    settings: stored.settings,
    images: Object.fromEntries(host.images(ids.images)),
    files: Object.fromEntries(host.files(ids.files)),
    revision: stored.revision,
    updatedAt: stored.updatedAt,
  };
}
