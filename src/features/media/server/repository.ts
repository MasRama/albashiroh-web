import { getDatabase } from '../../../shared/database';
import {
  IMAGE_VARIANTS,
  MEDIA_PUBLIC_PATH,
  type FileRef,
  type ImageRef,
  type ImageVariant,
  type MediaItem,
  type MediaKind,
  type MediaQuery,
} from '../contract';

interface MediaRow {
  id: string;
  kind: MediaKind;
  name: string;
  alt: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  revision: number;
}

const VARIANTS = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

/** The extension each document type is served with. */
const TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/**
 * The file name a document is served under: readable, safe in a URL and a
 * header, and always ending in its stored type's extension, whatever the
 * name says, so a rename never turns a PDF into an address without `.pdf`.
 */
export function downloadName(name: string, mimeType: string): string {
  const extension = TYPE_EXTENSIONS[mimeType] ?? '';
  const own = extension ? new RegExp(`\\.${extension}$`, 'i') : null;
  const stem = (own ? name.trim().replace(own, '') : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'dokumen';
  return extension ? `${stem}.${extension}` : stem;
}

export function variantUrl(id: string, variant: ImageVariant): string {
  return `${MEDIA_PUBLIC_PATH}/${id}/${variant}.webp`;
}

function fileUrl(row: Pick<MediaRow, 'id' | 'name' | 'mime_type'>): string {
  return `${MEDIA_PUBLIC_PATH}/${row.id}/${downloadName(row.name, row.mime_type)}`;
}

function toItem(row: MediaRow): MediaItem {
  const variants =
    row.kind === 'image'
      ? (Object.fromEntries(VARIANTS.map((variant) => [variant, variantUrl(row.id, variant)])) as Record<ImageVariant, string>)
      : null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    alt: row.alt,
    mimeType: row.mime_type,
    size: row.size,
    width: row.width,
    height: row.height,
    url: variants ? variants.md : fileUrl(row),
    variants,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  };
}

export interface NewMedia {
  id: string;
  kind: MediaKind;
  name: string;
  alt: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdBy: string | null;
}

export function insertMedia(input: NewMedia, now = Date.now()): MediaItem {
  getDatabase()
    .prepare(
      `INSERT INTO media (id, kind, name, alt, mime_type, size, width, height, created_by, created_at, updated_at)
       VALUES (@id, @kind, @name, @alt, @mimeType, @size, @width, @height, @createdBy, @now, @now)`,
    )
    .run({ ...input, now });
  return findMedia(input.id)!;
}

function findRow(id: string): MediaRow | undefined {
  return getDatabase().prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined;
}

export function findMedia(id: string): MediaItem | undefined {
  const row = findRow(id);
  return row ? toItem(row) : undefined;
}

export function listMedia(query: MediaQuery): { items: MediaItem[]; total: number } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.kind) {
    where.push('kind = @kind');
    params.kind = query.kind;
  }
  if (query.q) {
    where.push("(name LIKE @q ESCAPE '\\' OR alt LIKE @q ESCAPE '\\')");
    params.q = `%${query.q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const database = getDatabase();
  const total = (database.prepare(`SELECT COUNT(*) AS total FROM media ${clause}`).get(params) as { total: number }).total;
  const rows = database
    .prepare(`SELECT * FROM media ${clause} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: query.limit, offset: (query.page - 1) * query.limit }) as MediaRow[];
  return { items: rows.map(toItem), total };
}

export type MediaUpdate =
  | { status: 'updated'; item: MediaItem }
  | { status: 'stale'; item: MediaItem }
  | { status: 'missing' };

export function updateMedia(id: string, input: { name: string; alt: string; revision: number }, now = Date.now()): MediaUpdate {
  const database = getDatabase();
  return database.transaction((): MediaUpdate => {
    const row = findRow(id);
    if (!row) return { status: 'missing' };
    if (row.revision !== input.revision) return { status: 'stale', item: toItem(row) };
    database
      .prepare('UPDATE media SET name = ?, alt = ?, updated_at = ?, revision = revision + 1 WHERE id = ?')
      .run(input.name, input.alt, now, id);
    return { status: 'updated', item: toItem(findRow(id)!) };
  })();
}

export function deleteMedia(id: string): MediaItem | undefined {
  const row = findRow(id);
  if (!row) return undefined;
  getDatabase().prepare('DELETE FROM media WHERE id = ?').run(id);
  return toItem(row);
}

/** What a page needs to draw each photo; ids that are not photos (or are gone) are left out. */
export function imageRefs(ids: readonly string[]): Map<string, ImageRef> {
  const unique = [...new Set(ids.filter(Boolean))];
  const found = new Map<string, ImageRef>();
  if (unique.length === 0) return found;
  const rows = getDatabase()
    .prepare(`SELECT * FROM media WHERE kind = 'image' AND id IN (${unique.map(() => '?').join(', ')})`)
    .all(...unique) as MediaRow[];
  for (const row of rows) {
    found.set(row.id, {
      id: row.id,
      alt: row.alt,
      width: row.width ?? 0,
      height: row.height ?? 0,
      sm: variantUrl(row.id, 'sm'),
      md: variantUrl(row.id, 'md'),
      lg: variantUrl(row.id, 'lg'),
    });
  }
  return found;
}

/** What a page needs to link each document; photos count too, so a flyer can be a download. */
export function fileRefs(ids: readonly string[]): Map<string, FileRef> {
  const unique = [...new Set(ids.filter(Boolean))];
  const found = new Map<string, FileRef>();
  if (unique.length === 0) return found;
  const rows = getDatabase()
    .prepare(`SELECT * FROM media WHERE id IN (${unique.map(() => '?').join(', ')})`)
    .all(...unique) as MediaRow[];
  for (const row of rows) {
    const item = toItem(row);
    found.set(row.id, {
      id: row.id,
      name: row.name,
      mimeType: row.kind === 'image' ? 'image/webp' : row.mime_type,
      size: row.size,
      url: row.kind === 'image' ? variantUrl(row.id, 'lg') : item.url,
    });
  }
  return found;
}
