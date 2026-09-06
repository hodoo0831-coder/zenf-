CREATE TABLE IF NOT EXISTS actions (
  site TEXT NOT NULL, k TEXT NOT NULL,
  area TEXT, title TEXT, rule TEXT, st TEXT DEFAULT 'todo',
  owner TEXT, due INTEGER, note TEXT, what TEXT, txt TEXT,
  seq INTEGER DEFAULT 1, verify TEXT, cleared INTEGER DEFAULT 0,
  opened_at INTEGER, done_at INTEGER, ts INTEGER, by TEXT,
  PRIMARY KEY (site, k)
);
CREATE TABLE IF NOT EXISTS actlog (
  id TEXT PRIMARY KEY, site TEXT NOT NULL, k TEXT,
  area TEXT, title TEXT, rule TEXT, seq INTEGER, owner TEXT,
  what TEXT, outcome TEXT, opened_at INTEGER, done_at INTEGER,
  closed_at INTEGER, overdue INTEGER, by TEXT
);
CREATE INDEX IF NOT EXISTS idx_actlog_site ON actlog(site, closed_at DESC);
