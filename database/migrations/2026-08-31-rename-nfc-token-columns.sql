-- 컬럼 이름이 담고 있는 값과 어긋나 있던 것을 바로잡는다.
--
-- tags.nfc_tag_uid는 이름과 달리 칩 UID가 아니라 URL 경로에 들어가는 장비 토큰
-- (pump-001, aed-001)을 담아 왔다. NTAG 424 DNA 전환으로 진짜 칩 UID를 담는
-- tags.ntag_uid가 생기면서 두 이름이 정면으로 충돌해, 코드를 읽는 사람이 반드시 헷갈린다.
-- usage_history.equipment_nfc_uid도 같은 값을 담고 있어 함께 옮긴다.
--
--   tags.nfc_tag_uid              -> tags.nfc_token
--   usage_history.equipment_nfc_uid -> usage_history.equipment_nfc_token
--   idx_tags_nfc_tag_uid동        -> idx_tags_nfc_token   (인덱스 이름 끝의 '동'은 오타)
--
-- API 응답 필드와 프론트엔드는 이전부터 nfc_token이라는 이름을 써 왔으므로 인터페이스는
-- 바뀌지 않는다. 온체인 앵커링 payload에도 이 컬럼은 들어가지 않아 체인 데이터와 무관하다.
--
-- 실행 순서가 중요하다. 배포된 백엔드가 옛 컬럼명을 SELECT하는 동안 이 스크립트를 돌리면
-- 그 순간부터 백엔드가 500을 낸다. **머지 직후, 새 이미지가 뜨기 직전에** 적용할 것.
--
-- 실행:
--   cat database/migrations/2026-08-31-rename-nfc-token-columns.sql \
--     | docker exec -i mediledger-postgres psql -U mediledger -d mediledger_db
--
-- 멱등적 — 이미 적용된 DB에 다시 돌려도 아무 일도 하지 않는다.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tags' AND column_name = 'nfc_tag_uid'
    ) THEN
        ALTER TABLE tags RENAME COLUMN nfc_tag_uid TO nfc_token;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'equipment_nfc_uid'
    ) THEN
        ALTER TABLE usage_history RENAME COLUMN equipment_nfc_uid TO equipment_nfc_token;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_nfc_events' AND column_name = 'equipment_nfc_uid'
    ) THEN
        ALTER TABLE usage_nfc_events RENAME COLUMN equipment_nfc_uid TO equipment_nfc_token;
    END IF;

    -- 인덱스 이름에 한글이 섞여 있었다. 이름만 바꾸므로 재구축 비용은 없다.
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_tags_nfc_tag_uid동') THEN
        ALTER INDEX "idx_tags_nfc_tag_uid동" RENAME TO idx_tags_nfc_token;
    END IF;
END $$;

COMMIT;
