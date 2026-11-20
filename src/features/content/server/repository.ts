import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';
import {
  CONTENT_TYPES,
  emptySettings,
  portalSettingsSchema,
  type ContentOrder,
  type ContentType,
  type EntryQuery,
  type EntryStatus,
  type Portal,
  type PortalSettings,
} from '../contract';

export interface EntryRow {
  id: string;
  portal: Portal;
  type: ContentType;
  title: string;
  slug: string;
  summary: string;
  body: string;
  image_id: string | null;
  file_id: string | null;
  date: string | null;
  fields: string;
  status: EntryStatus;
  sort_order: number;
  legacy_ref: string | null;
  legacy_note: string;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  revision: number;
}

/** The values an entry is saved with, already checked and cleaned for its type. */
export interface EntryValues {
  title: string;
  slug: string;
  summary: string;
  body: string;
  imageId: string | null;
  fileId: string | null;
  date: string | null;
  fields: Record<string, string>;
  status: EntryStatus;
}

const ORDER_BY: Record<ContentOrder, string> = {
  newest: 'date IS NULL, date DESC, created_at DESC, id',
  upcoming: 'date IS NULL, date ASC, created_at ASC, id',
  manual: 'sort_order ASC, created_at ASC, id',
};

export function orderBy(type: ContentType): string {
  return ORDER_BY[CONTENT_TYPES[type].order];
}

export function parseFields(row: Pick<EntryRow, 'fields'>): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(row.fields);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

export function findEntryRow(portal: Portal, type: ContentType, id: string): EntryRow | undefined {
  return getDatabase()
    .prepare('SELECT * FROM content_entries WHERE id = ? AND portal = ? AND type = ?')
    .get(id, portal, type) as EntryRow | undefined;
}

export function slugTaken(portal: Portal, type: ContentType, slug: string, exceptId?: string): boolean {
  return (
    getDatabase()
      .prepare('SELECT 1 FROM content_entries WHERE portal = ? AND type = ? AND slug = ? AND id IS NOT ?')
      .get(portal, type, slug, exceptId ?? null) !== undefined
  );
}

/** `base`, or `base-2`, `base-3`… whichever is free in the portal and type. */
export function freeSlug(portal: Portal, type: ContentType, base: string, exceptId?: string): string {
  let candidate = base;
  for (let suffix = 2; slugTaken(portal, type, candidate, exceptId); suffix += 1) candidate = `${base}-${suffix}`;
  return candidate;
}

export interface EntryFilter {
  q?: string;
  status?: EntryStatus;
  /** Limit the list to these ids (the entries still missing a photo). */
  ids?: readonly string[];
}

function where(portal: Portal, type: ContentType, filter: EntryFilter): { clause: string; params: Record<string, unknown> } {
  const parts = ['portal = @portal', 'type = @type'];
  const params: Record<string, unknown> = { portal, type };
  if (filter.status) {
    parts.push('status = @status');
    params.status = filter.status;
  }
  if (filter.q) {
    parts.push("(title LIKE @q ESCAPE '\\' OR summary LIKE @q ESCAPE '\\' OR fields LIKE @q ESCAPE '\\')");
    params.q = escapeLike(filter.q);
  }
  if (filter.ids) {
    parts.push(`id IN (SELECT value FROM json_each(@ids))`);
    params.ids = JSON.stringify(filter.ids);
  }
  return { clause: parts.join(' AND '), params };
}

export function listEntryRows(portal: Portal, type: ContentType, query: Pick<EntryQuery, 'page' | 'limit'> & EntryFilter): { rows: EntryRow[]; total: number } {
  const database = getDatabase();
  const { clause, params } = where(portal, type, query);
  const total = (database.prepare(`SELECT COUNT(*) AS total FROM content_entries WHERE ${clause}`).get(params) as { total: number }).total;
  const rows = database
    .prepare(`SELECT * FROM content_entries WHERE ${clause} ORDER BY ${orderBy(type)} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: query.limit, offset: (query.page - 1) * query.limit }) as EntryRow[];
  return { rows, total };
}

/** Each entry's photo id (or null), for counting and filtering the ones without a photo. */
export function entryImageIds(portal: Portal, type?: ContentType, filter: EntryFilter = {}): { id: string; type: ContentType; imageId: string | null; status: EntryStatus }[] {
  if (type) {
    const { clause, params } = where(portal, type, filter);
    return getDatabase()
      .prepare(`SELECT id, type, image_id AS imageId, status FROM content_entries WHERE ${clause}`)
      .all(params) as { id: string; type: ContentType; imageId: string | null; status: EntryStatus }[];
  }
  return getDatabase()
    .prepare('SELECT id, type, image_id AS imageId, status FROM content_entries WHERE portal = ?')
    .all(portal) as { id: string; type: ContentType; imageId: string | null; status: EntryStatus }[];
}

export function insertEntry(portal: Portal, type: ContentType, values: EntryValues, createdBy: string | null, now = Date.now()): EntryRow {
  const database = getDatabase();
  const id = randomUUID();
  database.transaction(() => {
    const next = (
      database.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM content_entries WHERE portal = ? AND type = ?').get(portal, type) as { next: number }
    ).next;
    database
      .prepare(
        `INSERT INTO content_entries
           (id, portal, type, title, slug, summary, body, image_id, file_id, date, fields, status, sort_order, created_by, created_at, updated_at)
         VALUES (@id, @portal, @type, @title, @slug, @summary, @body, @imageId, @fileId, @date, @fields, @status, @sortOrder, @createdBy, @now, @now)`,
      )
      .run({ ...values, id, portal, type, fields: JSON.stringify(values.fields), sortOrder: next, createdBy, now });
  })();
  return findEntryRow(portal, type, id)!;
}

export type EntryUpdate = { status: 'updated'; row: EntryRow } | { status: 'stale'; row: EntryRow } | { status: 'missing' };

export function updateEntry(portal: Portal, type: ContentType, id: string, values: EntryValues, revision: number, now = Date.now()): EntryUpdate {
  const database = getDatabase();
  return database.transaction((): EntryUpdate => {
    const row = findEntryRow(portal, type, id);
    if (!row) return { status: 'missing' };
    if (row.revision !== revision) return { status: 'stale', row };
    database
      .prepare(
        `UPDATE content_entries
            SET title = @title, slug = @slug, summary = @summary, body = @body, image_id = @imageId, file_id = @fileId,
                date = @date, fields = @fields, status = @status, updated_at = @now, revision = revision + 1
          WHERE id = @id`,
      )
      .run({ ...values, fields: JSON.stringify(values.fields), now, id });
    return { status: 'updated', row: findEntryRow(portal, type, id)! };
  })();
}

export function deleteEntry(portal: Portal, type: ContentType, id: string): EntryRow | undefined {
  const row = findEntryRow(portal, type, id);
  if (!row) return undefined;
  getDatabase().prepare('DELETE FROM content_entries WHERE id = ?').run(id);
  return row;
}

/**
 * Puts the listed entries first, in the order given; entries left out keep
 * their relative order after them. Ids from another portal or type are
 * ignored.
 */
export function reorderEntries(portal: Portal, type: ContentType, ids: readonly string[], now = Date.now()): number {
  const database = getDatabase();
  return database.transaction(() => {
    const current = (database
      .prepare(`SELECT id FROM content_entries WHERE portal = ? AND type = ? ORDER BY ${ORDER_BY.manual}`)
      .all(portal, type) as { id: string }[]).map((row) => row.id);
    const known = new Set(current);
    const listed = [...new Set(ids)].filter((id) => known.has(id));
    const order = [...listed, ...current.filter((id) => !listed.includes(id))];
    const update = database.prepare('UPDATE content_entries SET sort_order = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND sort_order <> ?');
    order.forEach((id, index) => update.run(index + 1, now, id, index + 1));
    return listed.length;
  })();
}

// Public reads -------------------------------------------------------------

/** Today in Malang, as YYYY-MM-DD, for "upcoming" agenda. */
export function todayInJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function listPublishedRows(
  portals: readonly Portal[],
  type: ContentType,
  query: { page: number; limit: number; upcoming?: boolean; today?: string },
): { rows: EntryRow[]; total: number } {
  const database = getDatabase();
  const parts = [`portal IN (SELECT value FROM json_each(@portals))`, 'type = @type', "status = 'published'"];
  const params: Record<string, unknown> = { portals: JSON.stringify(portals), type };
  if (query.upcoming) {
    parts.push('(date IS NULL OR date >= @today)');
    params.today = query.today ?? todayInJakarta();
  }
  const clause = parts.join(' AND ');
  const total = (database.prepare(`SELECT COUNT(*) AS total FROM content_entries WHERE ${clause}`).get(params) as { total: number }).total;
  const rows = database
    .prepare(`SELECT * FROM content_entries WHERE ${clause} ORDER BY ${orderBy(type)} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: query.limit, offset: (query.page - 1) * query.limit }) as EntryRow[];
  return { rows, total };
}

export function findPublishedRow(portal: Portal, type: ContentType, slug: string): EntryRow | undefined {
  return getDatabase()
    .prepare("SELECT * FROM content_entries WHERE portal = ? AND type = ? AND slug = ? AND status = 'published'")
    .get(portal, type, slug) as EntryRow | undefined;
}

/** Every published entry's address parts, for the sitemap. */
export function publishedSlugs(): { portal: Portal; type: ContentType; slug: string; updatedAt: number }[] {
  return getDatabase()
    .prepare("SELECT portal, type, slug, updated_at AS updatedAt FROM content_entries WHERE status = 'published' ORDER BY portal, type, slug")
    .all() as { portal: Portal; type: ContentType; slug: string; updatedAt: number }[];
}

// Settings -----------------------------------------------------------------

interface SettingsRow {
  portal: Portal;
  data: string;
  updated_at: number;
  revision: number;
}

export interface StoredSettings {
  settings: PortalSettings;
  revision: number;
  updatedAt: number | null;
}

/**
 * A portal's saved settings, read through the current schema so fields added
 * since the last save come back with their defaults.
 */
export function readSettings(portal: Portal): StoredSettings {
  const row = getDatabase().prepare('SELECT * FROM portal_settings WHERE portal = ?').get(portal) as SettingsRow | undefined;
  if (!row) return { settings: emptySettings(), revision: 0, updatedAt: null };
  let data: unknown = {};
  try {
    data = JSON.parse(row.data);
  } catch {
    data = {};
  }
  const parsed = portalSettingsSchema.safeParse(data);
  return { settings: parsed.success ? parsed.data : emptySettings(), revision: row.revision, updatedAt: row.updated_at };
}

export type SettingsSave = { status: 'saved'; stored: StoredSettings } | { status: 'stale'; stored: StoredSettings };

export function saveSettings(portal: Portal, settings: PortalSettings, revision: number, updatedBy: string | null, now = Date.now()): SettingsSave {
  const database = getDatabase();
  return database.transaction((): SettingsSave => {
    const current = readSettings(portal);
    if (current.revision !== revision) return { status: 'stale', stored: current };
    const data = JSON.stringify(settings);
    if (revision === 0) {
      database
        .prepare('INSERT INTO portal_settings (portal, data, updated_by, updated_at, revision) VALUES (?, ?, ?, ?, 1)')
        .run(portal, data, updatedBy, now);
    } else {
      database
        .prepare('UPDATE portal_settings SET data = ?, updated_by = ?, updated_at = ?, revision = revision + 1 WHERE portal = ?')
        .run(data, updatedBy, now, portal);
    }
    return { status: 'saved', stored: readSettings(portal) };
  })();
}
