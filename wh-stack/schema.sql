CREATE TABLE IF NOT EXISTS stock (
  date TEXT NOT NULL, zone TEXT NOT NULL, loc TEXT NOT NULL,
  capa INTEGER DEFAULT 0, qty INTEGER DEFAULT 0, worker TEXT, updated_at TEXT,
  PRIMARY KEY (date, zone, loc)
);
CREATE TABLE IF NOT EXISTS submits (
  date TEXT NOT NULL, zone TEXT NOT NULL, worker TEXT, note TEXT,
  total INTEGER DEFAULT 0, capa INTEGER DEFAULT 0, locs INTEGER DEFAULT 0,
  status TEXT DEFAULT 'submitted', submitted_at TEXT, confirmed_by TEXT, confirmed_at TEXT,
  PRIMARY KEY (date, zone)
);
CREATE INDEX IF NOT EXISTS idx_stock_date ON stock(date);
