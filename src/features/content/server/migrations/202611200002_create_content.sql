CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  portal TEXT NOT NULL CHECK (portal IN ('yayasan', 'smp', 'sma')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_id TEXT,
  file_id TEXT,
  date TEXT,
  fields TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  legacy_ref TEXT,
  legacy_note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX content_entries_slug_idx ON content_entries (portal, type, slug);
CREATE UNIQUE INDEX content_entries_legacy_idx ON content_entries (legacy_ref) WHERE legacy_ref IS NOT NULL;
CREATE INDEX content_entries_list_idx ON content_entries (portal, type, status, date DESC);
CREATE INDEX content_entries_order_idx ON content_entries (portal, type, sort_order);

CREATE TABLE portal_settings (
  portal TEXT PRIMARY KEY CHECK (portal IN ('yayasan', 'smp', 'sma')),
  data TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
