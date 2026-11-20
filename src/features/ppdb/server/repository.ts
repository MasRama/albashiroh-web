import { randomBytes, randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';
import {
  LEVEL_LABEL,
  LEVELS,
  ppdbSettingsSchema,
  STATUSES,
  emptyPpdbSettings,
  type Application,
  type ApplicationQuery,
  type ApplicationStatus,
  type ApplicationSummary,
  type ApplicationValues,
  type Level,
  type PpdbSettings,
  type PpdbSettingsRecord,
} from '../contract';

interface ApplicationRow {
  id: string;
  code: string;
  level: Level;
  year: number;
  sequence: number;
  name: string;
  nisn: string;
  previous_school: string;
  phone: string;
  data: string;
  status: ApplicationStatus;
  note: string;
  created_at: number;
  updated_at: number;
  revision: number;
}

function toApplication(row: ApplicationRow): Application {
  const values = JSON.parse(row.data) as ApplicationValues;
  return { ...values, id: row.id, code: row.code, level: row.level, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision };
}

function toSummary(row: ApplicationRow): ApplicationSummary {
  return { id: row.id, code: row.code, level: row.level, status: row.status, name: row.name, previousSchool: row.previous_school, phone: row.phone, createdAt: row.created_at };
}

/** The year a registration counts toward, in the school's time zone (WIB). */
export function registrationYear(time: number): number {
  return new Date(time + 7 * 60 * 60 * 1000).getUTCFullYear();
}

export type InsertResult = { status: 'created'; application: Application } | { status: 'duplicate' };

/**
 * Saves a registration with the next number for its level and year, for
 * example SMP-2026-0007. A second registration of the same NISN to the same
 * level in the same year is refused rather than numbered again.
 */
export function insertApplication(values: ApplicationValues, now: number): InsertResult {
  const database = getDatabase();
  const year = registrationYear(now);
  return database.transaction((): InsertResult => {
    const taken = database.prepare('SELECT 1 FROM ppdb_applications WHERE level = ? AND year = ? AND nisn = ?').get(values.level, year, values.student.nisn);
    if (taken) return { status: 'duplicate' };
    const { next } = database
      .prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM ppdb_applications WHERE level = ? AND year = ?')
      .get(values.level, year) as { next: number };
    const row: ApplicationRow = {
      id: randomUUID(),
      code: `${LEVEL_LABEL[values.level]}-${year}-${String(next).padStart(4, '0')}`,
      level: values.level,
      year,
      sequence: next,
      name: values.student.name,
      nisn: values.student.nisn,
      previous_school: values.student.previousSchool,
      phone: values.phone,
      data: JSON.stringify(values),
      status: 'baru',
      note: '',
      created_at: now,
      updated_at: now,
      revision: 1,
    };
    database
      .prepare(
        `INSERT INTO ppdb_applications (id, code, level, year, sequence, name, nisn, previous_school, phone, data, status, note, created_at, updated_at, revision)
         VALUES (@id, @code, @level, @year, @sequence, @name, @nisn, @previous_school, @phone, @data, @status, @note, @created_at, @updated_at, @revision)`,
      )
      .run(row);
    return { status: 'created', application: toApplication(row) };
  }).immediate();
}

const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

function where(filter: Pick<ApplicationQuery, 'level' | 'status' | 'q'>): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.level) {
    clauses.push('level = ?');
    params.push(filter.level);
  }
  if (filter.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter.q) {
    clauses.push("(name LIKE ? ESCAPE '\\' OR nisn LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\' OR previous_school LIKE ? ESCAPE '\\')");
    const like = escapeLike(filter.q);
    params.push(like, like, like, like);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function listApplications(query: ApplicationQuery): { items: ApplicationSummary[]; total: number } {
  const database = getDatabase();
  const { sql, params } = where(query);
  const { total } = database.prepare(`SELECT COUNT(*) AS total FROM ppdb_applications ${sql}`).get(...params) as { total: number };
  const rows = database
    .prepare(`SELECT * FROM ppdb_applications ${sql} ORDER BY created_at DESC, id LIMIT ? OFFSET ?`)
    .all(...params, query.limit, (query.page - 1) * query.limit) as ApplicationRow[];
  return { items: rows.map(toSummary), total };
}

/** Every registration matching the filter, oldest first, as an export lists them. */
export function exportApplications(filter: Pick<ApplicationQuery, 'level' | 'status' | 'q'>): Application[] {
  const { sql, params } = where(filter);
  const rows = getDatabase().prepare(`SELECT * FROM ppdb_applications ${sql} ORDER BY CASE level WHEN 'smp' THEN 0 ELSE 1 END, created_at, id`).all(...params) as ApplicationRow[];
  return rows.map(toApplication);
}

export function countApplications(): Record<Level, Record<ApplicationStatus, number>> {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, Object.fromEntries(STATUSES.map((status) => [status, 0]))])) as Record<Level, Record<ApplicationStatus, number>>;
  const rows = getDatabase().prepare('SELECT level, status, COUNT(*) AS count FROM ppdb_applications GROUP BY level, status').all() as { level: Level; status: ApplicationStatus; count: number }[];
  for (const row of rows) counts[row.level][row.status] = row.count;
  return counts;
}

export function findApplication(id: string): Application | undefined {
  const row = getDatabase().prepare('SELECT * FROM ppdb_applications WHERE id = ?').get(id) as ApplicationRow | undefined;
  return row ? toApplication(row) : undefined;
}

export type ReviewResult = { status: 'saved'; application: Application } | { status: 'stale'; application: Application } | { status: 'missing' };

export function reviewApplication(id: string, change: { status: ApplicationStatus; note: string }, revision: number, now: number): ReviewResult {
  const database = getDatabase();
  return database.transaction((): ReviewResult => {
    const updated = database
      .prepare('UPDATE ppdb_applications SET status = ?, note = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
      .run(change.status, change.note, now, id, revision);
    const application = findApplication(id);
    if (!application) return { status: 'missing' };
    return updated.changes === 1 ? { status: 'saved', application } : { status: 'stale', application };
  })();
}

export function deleteApplication(id: string): Application | undefined {
  const application = findApplication(id);
  if (!application) return undefined;
  getDatabase().prepare('DELETE FROM ppdb_applications WHERE id = ?').run(id);
  return application;
}

interface SettingsRow {
  data: string;
  form_key: string;
  updated_at: number;
  revision: number;
}

/** The settings row, made on first use so the form key exists before any form is opened. */
function settingsRow(): SettingsRow {
  const database = getDatabase();
  database
    .prepare('INSERT OR IGNORE INTO ppdb_settings (id, data, form_key, updated_at, revision) VALUES (1, ?, ?, ?, 0)')
    .run(JSON.stringify(emptyPpdbSettings()), randomBytes(32).toString('hex'), Date.now());
  return database.prepare('SELECT data, form_key, updated_at, revision FROM ppdb_settings WHERE id = 1').get() as SettingsRow;
}

function parseSettings(data: string): PpdbSettings {
  try {
    const parsed = ppdbSettingsSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : emptyPpdbSettings();
  } catch {
    return emptyPpdbSettings();
  }
}

export function readPpdbSettings(): PpdbSettingsRecord {
  const row = settingsRow();
  return { settings: parseSettings(row.data), revision: row.revision, updatedAt: row.revision === 0 ? null : row.updated_at };
}

export function formKey(): string {
  return settingsRow().form_key;
}

export function savePpdbSettings(settings: PpdbSettings, revision: number, actorId: string, now: number): { status: 'saved' | 'stale'; record: PpdbSettingsRecord } {
  settingsRow();
  const updated = getDatabase()
    .prepare('UPDATE ppdb_settings SET data = ?, updated_by = ?, updated_at = ?, revision = revision + 1 WHERE id = 1 AND revision = ?')
    .run(JSON.stringify(settings), actorId, now, revision);
  return { status: updated.changes === 1 ? 'saved' : 'stale', record: readPpdbSettings() };
}
