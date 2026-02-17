-- RTLS project schema bootstrap
-- This file recreates the current database schema used by backend code.

BEGIN;

-- 1) Reader master
CREATE TABLE IF NOT EXISTS readers (
  reader_id      TEXT PRIMARY KEY,
  location_name  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) User master
CREATE TABLE IF NOT EXISTS users (
  user_id        BIGSERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  display_name   TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  department     TEXT,
  password_hash  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Tag / equipment master
-- Keep column names aligned with back/registration.py.
CREATE TABLE IF NOT EXISTS tags (
  tag_id          TEXT PRIMARY KEY,
  equipment_name  TEXT,
  equipment_type  TEXT,
  serial_number   TEXT UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Current location snapshot
CREATE TABLE IF NOT EXISTS tag_state_current (
  tag_id      TEXT PRIMARY KEY REFERENCES tags(tag_id) ON DELETE CASCADE,
  reader_id   TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
  last_rssi   INT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Location history
CREATE TABLE IF NOT EXISTS tag_state_history (
  id          BIGSERIAL PRIMARY KEY,
  tag_id      TEXT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  reader_id   TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
  rssi        INT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tag_state_history_tag_time
  ON tag_state_history(tag_id, decided_at DESC);

COMMIT;

