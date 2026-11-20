CREATE TABLE media (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'file')),
  name TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX media_created_at_idx ON media (created_at DESC, id DESC);
CREATE INDEX media_kind_idx ON media (kind, created_at DESC);
