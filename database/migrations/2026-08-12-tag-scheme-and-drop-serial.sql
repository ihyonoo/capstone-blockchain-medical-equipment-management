-- 장비 식별 체계 정리 두 가지를 한 번에 적용한다.
--
-- 1) iBeacon major/minor 규칙 변경
--    major는 이제 출처 구분자다 — 1 = 실물 IoT 장비, 2 = 시뮬레이션 장비.
--    (이전에는 시뮬레이션 태그의 major에 층 번호가 들어갔다.)
--    minor는 그 분류 안에서 1부터 올라가는 3자리 연번이다(001, 002, ...).
--    실물 리더도 같은 표기를 내도록 rtls/rtls_reader/send_to_server.py를 함께 고쳤다 —
--    이 마이그레이션만 돌리고 리더를 갱신하지 않으면 리더가 보내는 구 형식 tag_id가
--    /ingest에서 이름 없는 새 태그로 upsert된다.
--
-- 2) 장비 시리얼 번호 폐기
--    tags.serial_number와 usage_history.equipment_serial_number를 드롭한다.
--    체인에 앵커링되는 값이 아니라서 무결성 검증에는 영향이 없다.
--
-- 시뮬레이션 데이터는 여기서 손대지 않는다 — simulation/generate_seed.py가 만드는
-- 시드 SQL이 is_real_hardware = FALSE 행을 통째로 지우고 다시 넣으므로,
-- `python -m simulation.apply_seed`를 돌리면 새 규칙으로 재생성된다.
--
-- 실행 전 시뮬레이터와 백엔드를 멈춘다 — 켜진 채로 돌리면 백엔드가 드롭된 컬럼을
-- 계속 SELECT하고, 리더/시뮬레이터가 구 형식 tag_id를 다시 써 넣는다.
--
-- 실행:
--   psql "$DATABASE_URL" -f database/migrations/2026-08-12-tag-scheme-and-drop-serial.sql
--   python -m simulation.apply_seed
--
-- 멱등적 — 이미 적용된 DB에 다시 돌려도 안전하다.

BEGIN;

-- 1) 온체인에 tagId가 박혀 있는 실물 이력을 먼저 지운다.
--    tag_id를 바꾸면 DB 원문과 온체인 원문이 어긋나 무결성 검증이 실패로 뒤집힌다.
--    앵커가 없는 이력은 비교 대상이 아니라서 그대로 두고 CASCADE로 따라 옮긴다.
DELETE FROM usage_nfc_events
 WHERE usage_id IN (
   SELECT usage_id FROM usage_history
    WHERE blockchain_tx_hash IS NOT NULL
      AND tag_id ~ ':[0-9]+:[0-9]{1,2}$'
 );

UPDATE tags SET current_usage_id = NULL, current_holder_user_id = NULL
 WHERE current_usage_id IN (
   SELECT usage_id FROM usage_history
    WHERE blockchain_tx_hash IS NOT NULL
      AND tag_id ~ ':[0-9]+:[0-9]{1,2}$'
 );

DELETE FROM usage_history
 WHERE blockchain_tx_hash IS NOT NULL
   AND tag_id ~ ':[0-9]+:[0-9]{1,2}$';

-- 2) 실물 태그의 minor를 3자리로 채운다. major는 이미 1이라 건드리지 않는다.
--    FK가 전부 ON UPDATE CASCADE라 참조 테이블은 따라 바뀐다.
UPDATE tags
   SET tag_id = regexp_replace(tag_id, ':([0-9]+):([0-9]{1,2})$', ':\1:' || lpad(split_part(tag_id, ':', 3), 3, '0')),
       updated_at = now()
 WHERE is_real_hardware IS NOT FALSE
   AND tag_id ~ ':[0-9]+:[0-9]{1,2}$';

-- 3) 시리얼 번호 컬럼 폐기.
ALTER TABLE tags DROP COLUMN IF EXISTS serial_number;
ALTER TABLE usage_history DROP COLUMN IF EXISTS equipment_serial_number;

COMMIT;
