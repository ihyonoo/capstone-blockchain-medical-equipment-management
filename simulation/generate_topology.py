"""1회성 생성기: demo_data.py의 병원 토폴로지로 database/seed_demo_topology.sql을 만든다.

서버 실행 경로에는 포함되지 않는다 — 한 번 실행해 결과 SQL을 정적으로 커밋하고,
이후에는 그 SQL만 재실행한다(랜덤/매 실행마다 값이 바뀌면 데모 재현성이 깨짐).

실행: python -m simulation.generate_topology (저장소 루트에서)
"""

from pathlib import Path

from simulation.demo_data import HOSPITAL_BEACON_UUID, REAL_READER_EQUIPMENT, REAL_READERS, ROOMS, STAFF_ACCOUNTS

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "database" / "seed_demo_topology.sql"


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def build_reader_rows() -> list[str]:
    rows = []
    for reader_id, floor, location_name, _equipment in ROOMS:
        rows.append(f"    ('{reader_id}', '{sql_escape(location_name)}', {floor}, FALSE)")
    return rows


def build_reader_floor_updates() -> list[str]:
    # 이미 존재하는 리더 행에 floor를 채우는 보정 UPDATE. INSERT는 ON CONFLICT DO NOTHING이라
    # 기존 행을 못 고치는데, /ingest의 upsert가 만든 행은 reader_id/location_name만 있고
    # floor가 NULL이다 — 이게 비면 프론트가 그 구역을 지도에서 통째로 건너뛴다.
    # floor IS NULL 조건이라 이미 채워진 행은 건드리지 않는다(멱등).
    rows = []
    for reader_id, floor, _location_name, _equipment in ROOMS:
        rows.append(
            f"UPDATE readers SET floor = {floor}, updated_at = now()\n"
            f"    WHERE reader_id = '{reader_id}' AND floor IS NULL;"
        )
    return rows


def build_real_reader_statements() -> list[str]:
    # 실물 리더는 /ingest가 자동 upsert하지만, 하드웨어가 꺼져 있어도 지도에 보이도록
    # 미리 만들어 둔다. is_real_hardware는 명시하지 않아 DB 기본값 TRUE가 적용된다.
    statements = []
    for reader_id, floor, location_name in REAL_READERS:
        escaped = sql_escape(location_name)
        statements.append(
            f"INSERT INTO readers (reader_id, location_name, floor) VALUES\n"
            f"    ('{reader_id}', '{escaped}', {floor})\n"
            f"ON CONFLICT (reader_id) DO NOTHING;"
        )
        statements.append(
            f"UPDATE readers SET floor = {floor}, updated_at = now()\n"
            f"    WHERE reader_id = '{reader_id}' AND floor IS NULL;"
        )
        # location_name이 플레이스홀더(reader_id 그대로)로 남아 있는 경우에만 실제 이름으로 교체한다.
        # upsert_readers_from_ingest는 COALESCE라 기존 값을 못 고치기 때문.
        statements.append(
            f"UPDATE readers SET location_name = '{escaped}', updated_at = now()\n"
            f"    WHERE reader_id = '{reader_id}' AND location_name = '{reader_id}';"
        )
    return statements


def build_tag_rows() -> list[str]:
    rows = []
    seq = 0

    def emit(floor: int, equipment: list[tuple[str, str, int]]) -> None:
        nonlocal seq
        for equipment_name, equipment_type, count in equipment:
            for _ in range(count):
                seq += 1
                tag_id = f"{HOSPITAL_BEACON_UUID}:{floor}:{seq:04d}"
                serial_number = f"BME-{2020 + (seq % 5)}-{seq:05d}"
                nfc_tag_uid = f"04{seq:012X}"
                name = sql_escape(f"{equipment_name} {seq}호")
                etype = sql_escape(equipment_type)
                rows.append(
                    f"    ('{tag_id}', '{name}', '{etype}', '{serial_number}', '{nfc_tag_uid}', 'available', FALSE)"
                )

    for _reader_id, floor, _location_name, equipment in ROOMS:
        emit(floor, equipment)
    for reader_id, floor, _location_name in REAL_READERS:
        emit(floor, REAL_READER_EQUIPMENT.get(reader_id, []))

    return rows


def build_user_rows() -> list[str]:
    # 비밀번호 해시는 시딩 시점에 알 수 없는 SIM_STAFF_PASSWORD에 의존하므로 여기서
    # 만들지 않는다 — simulator.py 기동 시 db.ensure_staff_passwords()가 채운다.
    rows = []
    for username, display_name, department, position in STAFF_ACCOUNTS:
        email = f"{username}@sch-cheonan.local"
        display_name = sql_escape(display_name)
        department = sql_escape(department)
        position = sql_escape(position)
        rows.append(
            f"    ('{username}', '{display_name}', 'staff', '{department}', '{position}', "
            f"'x', TRUE, TRUE, '{email}', FALSE)"
        )
    return rows


def main() -> None:
    reader_rows = build_reader_rows()
    tag_rows = build_tag_rows()
    user_rows = build_user_rows()
    floor_updates = build_reader_floor_updates()
    real_reader_statements = build_real_reader_statements()

    sql = f"""-- database/seed_demo_topology.sql
-- simulation/generate_topology.py가 simulation/demo_data.py로부터 생성했다(정적 산출물,
-- 수동 수정하지 말 것 — 데이터를 바꾸려면 demo_data.py를 고치고 다시 생성한다).
-- 순천향대학교 천안병원 본관 1~5층 실제 부서 구성을 본뜬 모의(시뮬레이션) 리더/장비/staff.
-- 전부 is_real_hardware = FALSE로 표시되어 실물(M501/M502, 실물 태그)과 구분된다.
-- 멱등적 — 재실행해도 안전하다.

BEGIN;

INSERT INTO readers (reader_id, location_name, floor, is_real_hardware) VALUES
{",\n".join(reader_rows)}
ON CONFLICT (reader_id) DO NOTHING;

-- floor 없이 먼저 만들어진 행(/ingest upsert가 만든 행)에 층을 채운다. floor가 비면
-- 프론트가 그 구역을 지도에서 건너뛴다.
{"\n".join(floor_updates)}

-- 실물 하드웨어 리더의 위치(생성이 아니라 표시 정보 보정).
{"\n\n".join(real_reader_statements)}

INSERT INTO tags (
    tag_id, equipment_name, equipment_type, serial_number, nfc_tag_uid, asset_status, is_real_hardware
) VALUES
{",\n".join(tag_rows)}
ON CONFLICT (tag_id) DO NOTHING;

INSERT INTO users (
    username, display_name, role, department, position,
    password_hash, is_active, email_verified, email, is_real_hardware
) VALUES
{",\n".join(user_rows)}
ON CONFLICT (username) DO NOTHING;

COMMIT;
"""

    OUTPUT_PATH.write_text(sql, encoding="utf-8")
    print(
        f"wrote {OUTPUT_PATH} ({len(reader_rows)} readers, {len(REAL_READERS)} real readers, "
        f"{len(tag_rows)} tags, {len(user_rows)} users)"
    )


if __name__ == "__main__":
    main()
