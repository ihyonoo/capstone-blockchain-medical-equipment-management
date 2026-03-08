-- RTLS project schema bootstrap (v2)
-- 목적:
-- 1) 기존 RTLS 테이블 호환 유지
-- 2) 완성형 기능(NFC 인증, 장비 사용 이력, 무결성 해시)을 선반영
-- 3) 이미 운영 중인 DB에도 안전하게 재실행 가능하도록 IF NOT EXISTS / ALTER 기반으로 작성

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
  position       TEXT,
  -- NFC UID는 NULL 허용(미등록 사용자 가능), 등록 시 중복 금지
  nfc_uid        TEXT UNIQUE,
  password_hash  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Tag / equipment master
-- Keep column names aligned with backend/registration.py.
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

-- ---------------------------
-- Backward-compatible alters
-- ---------------------------
-- 기존 DB에 users.nfc_uid가 없는 경우를 위한 보강
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nfc_uid TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_nfc_uid_key'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_nfc_uid_key UNIQUE (nfc_uid);
  END IF;
END
$$;

-- -------------------------------------------
-- 장비 사용 이력(단일 이력 테이블, 완성형)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS usage_history (
  usage_id                    BIGSERIAL PRIMARY KEY,
  user_id                     BIGINT NOT NULL REFERENCES users(user_id),
  -- 스냅샷: 이력 생성 당시 값을 보존해 사용자 정보 변경 이후에도 과거 기록 유지
  user_name_snapshot          TEXT NOT NULL,
  user_position_snapshot      TEXT NOT NULL,
  user_department_snapshot    TEXT,
  tag_id                      TEXT NOT NULL REFERENCES tags(tag_id),
  equipment_name_snapshot     TEXT NOT NULL,
  checkout_reader_id          TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
  checkout_location_snapshot  TEXT,
  checkout_at                 TIMESTAMPTZ NOT NULL,
  return_reader_id            TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
  return_location_snapshot    TEXT,
  returned_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_usage_time_order
    CHECK (returned_at IS NULL OR returned_at >= checkout_at)
);

CREATE INDEX IF NOT EXISTS idx_usage_history_checkout_desc
  ON usage_history(checkout_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_checkout
  ON usage_history(user_id, checkout_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_history_tag_checkout
  ON usage_history(tag_id, checkout_at DESC);

-- --------------------------------------------------
-- 사용 이력별 무결성 앵커(레코드 1건당 SHA-256 해시 1건)
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_integrity (
  usage_id     BIGINT PRIMARY KEY REFERENCES usage_history(usage_id) ON DELETE CASCADE,
  record_hash  CHAR(64) NOT NULL,
  anchored_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_integrity_anchored_at
  ON usage_integrity(anchored_at DESC);

COMMIT;

