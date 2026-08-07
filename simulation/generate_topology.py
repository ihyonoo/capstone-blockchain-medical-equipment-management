"""1회성 생성기: demo_data.py의 병원 토폴로지로 database/seed_demo_topology.sql을 만든다.

서버 실행 경로에는 포함되지 않는다 — 한 번 실행해 결과 SQL을 정적으로 커밋하고,
이후에는 그 SQL만 재실행한다(랜덤/매 실행마다 값이 바뀌면 데모 재현성이 깨짐).

실행: python -m simulation.generate_topology (저장소 루트에서)
"""

import json
from pathlib import Path

from simulation.demo_data import HOSPITAL_BEACON_UUID, ROOMS, STAFF_ACCOUNTS

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "database" / "seed_demo_topology.sql"
# DB에는 안 들어가는 참고용 산출물: 관리자 핀 편집기(/admin/floor-map)에서 각 리더를
# 어느 층 탭에 배치해야 하는지 사람이 참고하는 목록.
PLACEMENT_HINTS_PATH = Path(__file__).resolve().parent / "floor_placement_hints.json"


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def build_reader_rows() -> list[str]:
    # floor/map_x/map_y는 일부러 비워둔다: readers_map_position_consistent CHECK 제약이
    # 세 컬럼을 전부 채우거나 전부 비우도록 강제하므로, 실제 좌표는 관리자 핀 편집기
    # (/admin/floor-map)로 배치해야 한다. demo_data.py의 floor 값은 어느 층 탭에서
    # 배치해야 하는지 알려주는 참고용일 뿐 DB에는 쓰지 않는다 — build_placement_hints() 참고.
    rows = []
    for reader_id, _floor, location_name, _equipment in ROOMS:
        rows.append(f"    ('{reader_id}', '{sql_escape(location_name)}', FALSE)")
    return rows


def build_tag_rows() -> list[str]:
    rows = []
    seq = 0
    for _reader_id, floor, _location_name, equipment in ROOMS:
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
    return rows


def build_user_rows() -> list[str]:
    # 비밀번호 해시는 시딩 시점에 알 수 없는 SIM_STAFF_PASSWORD에 의존하므로 여기서
    # 만들지 않는다 — seed_demo_topology.sql 적용 후 simulator.py 최초 기동 시
    # UPDATE로 채운다(자세한 내용은 simulation/CLAUDE.md 참고).
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


def build_placement_hints() -> list[dict]:
    return [
        {"reader_id": reader_id, "floor": floor, "location_name": location_name}
        for reader_id, floor, location_name, _equipment in ROOMS
    ]


def main() -> None:
    reader_rows = build_reader_rows()
    tag_rows = build_tag_rows()
    user_rows = build_user_rows()

    sql = f"""-- database/seed_demo_topology.sql
-- simulation/generate_topology.py가 simulation/demo_data.py로부터 생성했다(정적 산출물,
-- 수동 수정하지 말 것 — 데이터를 바꾸려면 demo_data.py를 고치고 다시 생성한다).
-- 순천향대학교 천안병원 본관 1~5층 실제 부서 구성을 본뜬 모의(시뮬레이션) 리더/장비/staff.
-- 전부 is_real_hardware = FALSE로 표시되어 실물(M501/M502, 실물 태그)과 구분된다.
-- 멱등적(ON CONFLICT DO NOTHING) — 재실행해도 안전하다.

BEGIN;

INSERT INTO readers (reader_id, location_name, is_real_hardware) VALUES
{",\n".join(reader_rows)}
ON CONFLICT (reader_id) DO NOTHING;

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
    PLACEMENT_HINTS_PATH.write_text(json.dumps(build_placement_hints(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUTPUT_PATH} ({len(reader_rows)} readers, {len(tag_rows)} tags, {len(user_rows)} users)")
    print(f"wrote {PLACEMENT_HINTS_PATH}")


if __name__ == "__main__":
    main()
