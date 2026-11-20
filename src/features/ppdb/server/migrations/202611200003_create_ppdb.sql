CREATE TABLE ppdb_applications (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('smp', 'sma')),
  -- The year the registration came in: codes and duplicate checks count per year.
  year INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  nisn TEXT NOT NULL,
  previous_school TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- Every field the form sent, as JSON, so a new form field needs no migration.
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'diverifikasi', 'diterima', 'ditolak')),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX ppdb_applications_code_idx ON ppdb_applications (code);
CREATE UNIQUE INDEX ppdb_applications_sequence_idx ON ppdb_applications (level, year, sequence);
CREATE UNIQUE INDEX ppdb_applications_nisn_idx ON ppdb_applications (level, year, nisn);
CREATE INDEX ppdb_applications_list_idx ON ppdb_applications (level, status, created_at DESC);

CREATE TABLE ppdb_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  -- Signs the time a form was opened; made once, never leaves the server.
  form_key TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0
);
