CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  position INTEGER NOT NULL,
  hora TEXT NOT NULL DEFAULT '',
  hotel TEXT NOT NULL DEFAULT '',
  habitacion TEXT NOT NULL DEFAULT '',
  taxista TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE(date, position)
);

CREATE INDEX IF NOT EXISTS idx_services_date ON services(date);
