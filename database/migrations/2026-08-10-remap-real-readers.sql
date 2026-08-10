-- 실물 리더 구역 재매핑: M502를 영상의학센터(1층) → 통원수술센터(5층)로 옮기고,
-- 영상의학센터를 모의 리더 M106이 인계받게 한다. 통원수술센터를 맡던 모의 리더 M508은 없어진다.
--
-- 왜 필요한가: seed_demo_topology.sql은 INSERT가 ON CONFLICT DO NOTHING이고 UPDATE도
-- 조건부(플레이스홀더/NULL일 때만)라, 이미 값이 들어 있는 기존 행을 고치지 못한다.
--
-- 실행 전 반드시 시뮬레이터를 멈춘다 — 켜진 채로 지우면 사라진 reader_id로 새 행을 계속
-- 써 넣어 DELETE가 FK 위반으로 실패한다.
--   docker compose stop simulator
--
-- 실행:
--   psql "$DATABASE_URL" -f database/migrations/2026-08-10-remap-real-readers.sql
--   psql "$DATABASE_URL" -f database/seed_demo_topology.sql   -- M106 생성 (이 파일 다음에)
--   docker compose start simulator
--
-- 멱등적 — 이미 적용된 DB에 다시 돌려도 안전하다(전부 조건부이거나 대상이 없으면 0건).

BEGIN;

-- 1) 실물 리더 M502의 위치·층 보정.
UPDATE readers
   SET location_name = '통원수술센터', floor = 5, updated_at = now()
 WHERE reader_id = 'M502'
   AND (location_name IS DISTINCT FROM '통원수술센터' OR floor IS DISTINCT FROM 5);

-- 2) 층이 바뀌며 tag_id가 재발급된 구 태그를 은퇴시킨다.
--    tag_id에는 층이 들어가지만 serial_number/nfc_tag_uid는 seq 기반이라 그대로다.
--    비켜주지 않으면 새 태그(...:1:0048) INSERT가 유니크 제약에 막힌다.
--    행은 남긴다 — 이 태그를 참조하는 사용 이력을 보존해야 한다.
UPDATE tags
   SET is_active = FALSE,
       serial_number = 'RETIRED-' || serial_number,
       nfc_tag_uid = NULL,
       updated_at = now()
 WHERE tag_id LIKE '%:5:0048'
   AND is_active = TRUE;

-- 3) 사라진 구역 M508 정리. FK 의존 역순으로 지운다.
--    usage_history 행 자체는 남긴다 — checkout_location/return_location 텍스트가 위치를
--    이미 보존하고 있어 리더 ID만 끊어도 이력 정보는 손실되지 않는다.
DELETE FROM usage_nfc_events WHERE reader_id = 'M508';
UPDATE usage_history SET checkout_reader_id = NULL WHERE checkout_reader_id = 'M508';
UPDATE usage_history SET return_reader_id = NULL WHERE return_reader_id = 'M508';
DELETE FROM tag_state_history WHERE reader_id = 'M508';
DELETE FROM readers WHERE reader_id = 'M508';

COMMIT;
