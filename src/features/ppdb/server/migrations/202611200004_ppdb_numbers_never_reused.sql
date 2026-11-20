-- The last number handed out per level and season. Numbers only go up, so a
-- deleted registration's number is never given to another child.
-- ppdb_applications.year is the first year of the season the committee set
-- ("2027/2028" counts as 2027), or the calendar year when no season is set.
CREATE TABLE ppdb_sequences (
  level TEXT NOT NULL CHECK (level IN ('smp', 'sma')),
  year INTEGER NOT NULL,
  last INTEGER NOT NULL,
  PRIMARY KEY (level, year)
);

INSERT INTO ppdb_sequences (level, year, last)
SELECT level, year, MAX(sequence) FROM ppdb_applications GROUP BY level, year;
