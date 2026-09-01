-- Reethau Inventory Admin Portal — PostgreSQL schema
-- Run automatically by src/migrate.js on server boot (idempotent: safe to
-- run every time, only creates what's missing).

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  position       TEXT NOT NULL DEFAULT 'Anggota Tim',
  role           TEXT NOT NULL DEFAULT 'Site Manager'
                   CHECK (role IN ('Super Admin', 'Site Manager', 'Maintenance Engineer')),
  assigned_site  TEXT NOT NULL DEFAULT 'global',
  avatar_url     TEXT,
  created_at     DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS sites (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT 'Site Operasional',
  color       TEXT NOT NULL DEFAULT '#00D084',
  image_url   TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS spare_part_categories (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS product_energy_categories (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS spare_parts (
  id               TEXT PRIMARY KEY,
  sku              TEXT NOT NULL,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  product_energy   TEXT NOT NULL,
  site             TEXT NOT NULL REFERENCES sites(key) ON DELETE RESTRICT,
  stock            INTEGER NOT NULL DEFAULT 0,
  min_stock        INTEGER NOT NULL DEFAULT 0,
  unit             TEXT NOT NULL DEFAULT 'Units',
  price_estimate   NUMERIC NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'In Stock'
                     CHECK (status IN ('In Stock', 'Low Stock', 'Critical', 'Maintenance Needed')),
  last_inspected   DATE NOT NULL DEFAULT CURRENT_DATE,
  specifications   TEXT NOT NULL DEFAULT '',
  image_url        TEXT
);

CREATE INDEX IF NOT EXISTS idx_spare_parts_site ON spare_parts(site);
CREATE INDEX IF NOT EXISTS idx_spare_parts_sku ON spare_parts(sku);

CREATE TABLE IF NOT EXISTS activity_logs (
  id            TEXT PRIMARY KEY,
  -- Kept as free-text "YYYY-MM-DD HH:mm" (not a real TIMESTAMP column) to
  -- exactly match the sortable/parseable format the frontend already
  -- standardized on (see AdminDashboard's nowTimestamp()) — avoids a
  -- timezone-conversion mismatch between what the UI displays and stores.
  "timestamp"   TEXT NOT NULL,
  action        TEXT NOT NULL
                  CHECK (action IN ('TRANSFER', 'STOCK_UPDATE', 'ADD_SPARE_PART', 'DELETE_SPARE_PART')),
  description   TEXT NOT NULL,
  performed_by  TEXT NOT NULL,
  site_from     TEXT,
  site_to       TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs("timestamp" DESC);

CREATE TABLE IF NOT EXISTS gallery (
  id           TEXT PRIMARY KEY,
  site         TEXT NOT NULL REFERENCES sites(key) ON DELETE CASCADE,
  src          TEXT NOT NULL,
  caption      TEXT NOT NULL,
  description  TEXT,
  uploaded_by  TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_gallery_site ON gallery(site);
