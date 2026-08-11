"""토폴로지 정본에서 DB 시드 SQL과 프론트 좌표 TS를 만든다.

수동 실행 전용이고 런타임 경로가 아니다. 산출물은 커밋한다 — 매번 생성하면 재현이
깨지고, 프론트 빌드가 파이썬에 의존하게 된다.

실행: python -m simulation.generate_seed (저장소 루트에서)
"""

from pathlib import Path

from simulation.topology import equipment, staff, zones

_ROOT = Path(__file__).resolve().parents[1]
SEED_SQL_PATH = _ROOT / "database" / "seed_sim_hospital.sql"
ZONE_BOUNDS_TS_PATH = _ROOT / "frontend" / "src" / "app" / "lib" / "floorZoneBounds.ts"

# 비밀번호는 런타임 비밀이므로 커밋되는 SQL에는 해시를 넣지 않는다.
# apply_seed.py가 SIM_STAFF_PASSWORD로 만든 해시로 이 플레이스홀더를 교체한다.
PASSWORD_PLACEHOLDER = "x"


def _quote(value: str) -> str:
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def _render_cleanup() -> list[str]:
    """기존 시뮬 데이터를 FK 순서대로 지운다. 실물 하드웨어 행은 건드리지 않는다."""
    sim_tags = "SELECT tag_id FROM tags WHERE is_real_hardware = FALSE"
    return [
        "-- 기존 시뮬레이션 데이터 정리. 대상은 전부 is_real_hardware = FALSE 뿐이다.",
        f"DELETE FROM usage_nfc_events WHERE tag_id IN ({sim_tags});",
        f"DELETE FROM tag_state_history WHERE tag_id IN ({sim_tags});",
        "-- tags.current_usage_id -> usage_history 순환 참조를 먼저 끊는다.",
        "UPDATE tags SET current_usage_id = NULL, current_holder_user_id = NULL,",
        "    asset_status = 'available' WHERE is_real_hardware = FALSE;",
        f"DELETE FROM usage_history WHERE tag_id IN ({sim_tags});",
        "DELETE FROM tags WHERE is_real_hardware = FALSE;",
        "DELETE FROM readers WHERE is_real_hardware = FALSE;",
        "DELETE FROM users WHERE is_real_hardware = FALSE;",
        "",
    ]


def _render_readers() -> list[str]:
    rows = [f"    ({_quote(zone.reader_id)}, {_quote(zone.name)}, {zone.floor}, FALSE)" for zone in zones.SIM_ZONES]
    return [
        "-- 모의 리더 42개. 실물 M501·M502는 이 목록에 없다.",
        "INSERT INTO readers (reader_id, location_name, floor, is_real_hardware) VALUES",
        ",\n".join(rows) + ";",
        "",
    ]


def _render_tags() -> list[str]:
    rows = []
    for item in equipment.EQUIPMENT:
        rows.append(
            f"    ({_quote(item.tag_id)}, {_quote(item.equipment_name)}, {_quote(item.equipment_type)}, "
            f"{_quote(item.serial_number)}, {_quote(item.nfc_token)}, 'available', TRUE, FALSE)"
        )
    return [
        "-- 태그 50개. 시뮬레이션 시작 시점에는 전부 사용 가능 상태다.",
        "INSERT INTO tags (tag_id, equipment_name, equipment_type, serial_number, nfc_tag_uid,",
        "                  asset_status, is_active, is_real_hardware) VALUES",
        ",\n".join(rows) + ";",
        "",
    ]


def _render_users() -> list[str]:
    rows = []
    for member in staff.ROSTER:
        rows.append(
            f"    ({_quote(member.username)}, {_quote(member.display_name)}, 'staff', "
            f"{_quote(member.department)}, {_quote(member.position)}, {_quote(PASSWORD_PLACEHOLDER)}, "
            f"TRUE, TRUE, {_quote(member.username + '@sch-cheonan.local')}, FALSE)"
        )
    return [
        "-- 의료진 120명. password_hash는 플레이스홀더이고 apply_seed.py가 채운다.",
        "INSERT INTO users (username, display_name, role, department, position, password_hash,",
        "                   is_active, email_verified, email, is_real_hardware) VALUES",
        ",\n".join(rows) + ";",
        "",
    ]


def render_seed_sql() -> str:
    header = [
        "-- database/seed_sim_hospital.sql",
        "-- simulation/generate_seed.py가 simulation/topology/에서 생성했다.",
        "-- 정적 산출물이므로 수동 수정하지 말 것 — 데이터를 바꾸려면 topology를 고치고 다시 생성한다.",
        "-- 순천향대학교 천안병원 본관 1~5층 구성을 본뜬 모의 리더 42개·장비 50개·의료진 120명.",
        "-- 전부 is_real_hardware = FALSE라 실물(M501/M502, 실물 태그)과 구분된다.",
        "-- 멱등하지 않다 — 기존 시뮬 데이터를 지우고 새로 넣는다.",
        "",
        "BEGIN;",
        "",
    ]
    body = _render_cleanup() + _render_readers() + _render_tags() + _render_users()
    return "\n".join(header + body + ["COMMIT;", ""])


def render_zone_bounds_ts() -> str:
    lines = [
        "// 구역 폴리곤 좌표 — 도면 이미지 대비 percent(0~100).",
        "// simulation/generate_seed.py가 simulation/topology/zones.py에서 생성했다.",
        "// 직접 수정하지 말 것 — zones.py를 고치고 `python -m simulation.generate_seed`를 다시 돌린다.",
        "",
        "export type ZonePoint = { x: number; y: number };",
        "",
        "export const ZONE_BOUNDS: Record<string, ZonePoint[]> = {",
    ]
    for zone in zones.ZONES:
        lines.append(f"  {zone.reader_id}: [")
        for x, y in zone.polygon:
            lines.append(f"    {{ x: {x}, y: {y} }},")
        lines.append(f"  ], // {zone.name}")
    lines += ["};", ""]
    return "\n".join(lines)


def main() -> None:
    SEED_SQL_PATH.write_text(render_seed_sql(), encoding="utf-8")
    ZONE_BOUNDS_TS_PATH.write_text(render_zone_bounds_ts(), encoding="utf-8")
    print(f"wrote {SEED_SQL_PATH.relative_to(_ROOT)}")
    print(f"wrote {ZONE_BOUNDS_TS_PATH.relative_to(_ROOT)}")


if __name__ == "__main__":
    main()
