-- -- 1) 위치(리더) 마스터
-- CREATE TABLE readers (
--   reader_id      TEXT PRIMARY KEY,              -- 예: R501
--   location_name  TEXT NOT NULL,                 -- 예: 501호
--   description    TEXT,
--   is_active      BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- -- 2) 사용자(의료진/관리자)
-- CREATE TABLE users (
--   user_id        BIGSERIAL PRIMARY KEY,
--   username       TEXT NOT NULL UNIQUE,          -- 로그인 ID 용도 (없으면 삭제 가능)
--   display_name   TEXT NOT NULL,                 -- 화면 표시 이름
--   role           TEXT NOT NULL CHECK (role IN ('admin','staff')), -- 최소 2역할
--   department     TEXT,
--   is_active      BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- -- 3) 태그/장비(추적 대상)
-- CREATE TABLE tags (
--   tag_id         TEXT PRIMARY KEY,              -- 예: TAG123 (NFC/RTLS 태그 ID)
--   asset_name     TEXT,                          -- 예: Infusion Pump A
--   asset_type     TEXT,                          -- 예: pump, monitor
--   serial_number  TEXT UNIQUE,                   -- 있으면 좋음(없으면 NULL 허용)
--   is_active      BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- -- 4) 현재 위치(조회용)
-- CREATE TABLE tag_state_current (
--   tag_id         TEXT PRIMARY KEY REFERENCES tags(tag_id) ON DELETE CASCADE,
--   reader_id      TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
--   last_rssi      INT,
--   updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- -- 5) 위치 변경 이력(감사/분석용)
-- CREATE TABLE tag_state_history (
--   id             BIGSERIAL PRIMARY KEY,
--   tag_id         TEXT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
--   reader_id      TEXT REFERENCES readers(reader_id) ON DELETE SET NULL,
--   rssi           INT,
--   decided_at     TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- ALTER TABLE readers DROP COLUMN description;

-- ALTER TABLE users ADD password_hash TEXT NOT NULL;

