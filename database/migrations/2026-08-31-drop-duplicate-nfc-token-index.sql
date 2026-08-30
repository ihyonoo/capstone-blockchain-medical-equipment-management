-- 같은 컬럼에 정의가 완전히 같은 UNIQUE 인덱스가 둘 있던 것을 하나로 줄인다.
--
-- 어쩌다 둘이 됐는가: schema.sql의 인덱스 이름에 한글 '동'이 오타로 섞여 있었다
-- (idx_tags_nfc_tag_uid동). CREATE UNIQUE INDEX IF NOT EXISTS는 "그 이름의 인덱스가
-- 있는가"만 보므로, 이미 idx_tags_nfc_tag_uid가 있는 DB에서도 오타 이름은 없다고 판단해
-- 두 번째 인덱스를 새로 만들었다. 즉 오타는 이름만 이상했던 게 아니라 중복 인덱스를
-- 계속 만들어 내고 있었다 — 쓰기마다 같은 인덱스를 두 번 갱신한 셈이다.
--
-- 2026-08-31-rename-nfc-token-columns.sql이 오타 쪽을 idx_tags_nfc_token으로 옮기면서
-- 중복이 드러났다. 옛 이름 쪽을 버리고 새 이름만 남긴다.
--
-- 실행:
--   cat database/migrations/2026-08-31-drop-duplicate-nfc-token-index.sql \
--     | docker exec -i mediledger-postgres psql -U mediledger -d mediledger_db
--
-- 멱등적 — 이미 정리된 DB에 다시 돌려도 아무 일도 하지 않는다.

BEGIN;

DO $$
BEGIN
    -- 남길 인덱스가 실제로 있는지 먼저 확인한다. 없는데 지우면 컬럼이 무방비가 된다.
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_tags_nfc_token')
       AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_tags_nfc_tag_uid') THEN
        DROP INDEX idx_tags_nfc_tag_uid;
    END IF;
END $$;

COMMIT;
