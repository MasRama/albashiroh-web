import { getDatabase } from '../../../shared/database';
import { portalSettingsSchema, type ContentType, type EntryInput, type Portal, type PortalSettings } from '../contract';
import type { ContentServerHost } from './host';
import { freeSlug, insertEntry, readSettings, saveSettings, slugTaken, type EntryRow } from './repository';
import { slugify } from './sanitize';
import { entryValues, settingsValues } from './values';

/** One record from the old site, keyed so a second import finds it again. */
export interface LegacyEntry {
  /** Stable key of the old record, like `smp:posts:<old id>`. */
  ref: string;
  /** What the admin reads on the entry, e.g. that its photo was lost with the old server. */
  note: string;
  input: EntryInput;
}

/** Whether an old-site record was imported by an earlier run. */
export function legacyImported(ref: string): boolean {
  return Boolean(getDatabase().prepare('SELECT 1 FROM content_entries WHERE legacy_ref = ?').get(ref));
}

export type LegacyImport =
  | { status: 'imported'; row: EntryRow }
  | { status: 'exists' }
  | { status: 'invalid'; errors: Record<string, string[]> };

/**
 * Adds an old-site record as an entry, once: a record already imported (by
 * its key) is left as the school may have edited it since. The entry goes
 * through the same checks as one typed in the admin; its address keeps the
 * old one when it is free, so old links keep working.
 */
export function importLegacyEntry(portal: Portal, type: ContentType, entry: LegacyEntry, host: Pick<ContentServerHost, 'images' | 'files'>): LegacyImport {
  const database = getDatabase();
  return database.transaction((): LegacyImport => {
    if (database.prepare('SELECT 1 FROM content_entries WHERE legacy_ref = ?').get(entry.ref)) return { status: 'exists' };
    const wanted = slugify(entry.input.slug || entry.input.title);
    const slug = slugTaken(portal, type, wanted) ? freeSlug(portal, type, wanted) : wanted;
    const checked = entryValues(portal, type, { ...entry.input, slug }, host);
    if (!checked.ok) return { status: 'invalid', errors: checked.errors };
    const row = insertEntry(portal, type, checked.values, null);
    database.prepare('UPDATE content_entries SET legacy_ref = ?, legacy_note = ? WHERE id = ?').run(entry.ref, entry.note, row.id);
    return { status: 'imported', row: { ...row, legacy_ref: entry.ref, legacy_note: entry.note } };
  })();
}

/** The settings an old site can supply; everything else stays as the school set it. */
export type LegacySettings = Partial<Pick<PortalSettings, 'visi' | 'misi' | 'profil'>> & { contact?: Partial<PortalSettings['contact']> };

const isEmpty = (value: unknown) => value === '' || value === null || (Array.isArray(value) && value.length === 0);

export type LegacySettingsFill = { status: 'filled'; keys: string[] } | { status: 'invalid'; errors: Record<string, string[]> };

/**
 * Copies old-site settings into a portal, but only into fields that are
 * still empty: running the import again, or after the school has written its
 * own visi or address, changes nothing.
 */
export function fillEmptySettings(portal: Portal, legacy: LegacySettings, host: Pick<ContentServerHost, 'images' | 'files'>): LegacySettingsFill {
  const stored = readSettings(portal);
  const next = structuredClone(stored.settings);
  const keys: string[] = [];
  for (const key of ['visi', 'misi', 'profil'] as const) {
    const value = legacy[key];
    if (value !== undefined && !isEmpty(value) && isEmpty(next[key])) {
      (next as Record<string, unknown>)[key] = value;
      keys.push(key);
    }
  }
  for (const [key, value] of Object.entries(legacy.contact ?? {}) as [keyof PortalSettings['contact'], string][]) {
    if (value && !next.contact[key]) {
      next.contact[key] = value;
      keys.push(`contact.${key}`);
    }
  }
  if (keys.length === 0) return { status: 'filled', keys };
  const parsed = portalSettingsSchema.safeParse(next);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (errors[issue.path.join('.')] ??= []).push(issue.message);
    return { status: 'invalid', errors };
  }
  const checked = settingsValues(portal, parsed.data, host);
  if (!checked.ok) return { status: 'invalid', errors: checked.errors };
  const saved = saveSettings(portal, checked.values, stored.revision, null);
  // Someone saved this portal in the same instant: try once more on their version.
  return saved.status === 'saved' ? { status: 'filled', keys } : fillEmptySettings(portal, legacy, host);
}
