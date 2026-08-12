import re
from pathlib import Path

from simulation import generate_seed
from simulation.topology import equipment, staff, zones


class TestSeedSql:
    def test_inserts_42_simulated_readers(self):
        sql = generate_seed.render_seed_sql()
        assert sql.count("INSERT INTO readers") == 1
        readers = re.findall(r"\('(M\d{3})', '[^']*', \d, FALSE\)", sql)
        assert len(readers) == 42
        assert set(readers) == zones.SIM_ZONE_IDS

    def test_reader_insert_upserts_on_conflict(self):
        """/ingest가 미리 만들어 둔 리더 행(floor NULL, is_real_hardware TRUE)을 재시드가 덮어써야 한다."""
        sql = generate_seed.render_seed_sql()
        insert_start = sql.index("INSERT INTO readers")
        insert_end = sql.index(";", insert_start)
        statement = sql[insert_start : insert_end + 1]
        assert "ON CONFLICT (reader_id) DO UPDATE SET" in statement
        assert "location_name = EXCLUDED.location_name" in statement
        assert "floor = EXCLUDED.floor" in statement
        assert "is_real_hardware = EXCLUDED.is_real_hardware" in statement

    def test_never_touches_real_hardware_rows(self):
        sql = generate_seed.render_seed_sql()
        for statement in re.findall(r"DELETE FROM [^;]+;", sql):
            assert "is_real_hardware = FALSE" in statement, statement

    def test_deletes_in_foreign_key_order(self):
        sql = generate_seed.render_seed_sql()
        order = [m.group(1) for m in re.finditer(r"DELETE FROM (\w+)", sql)]
        assert order.index("usage_nfc_events") < order.index("usage_history")
        assert order.index("tag_state_history") < order.index("tags")
        assert order.index("usage_history") < order.index("tags")
        assert order.index("tags") < order.index("readers")

    def test_clears_the_circular_tag_reference_before_deleting_usage_history(self):
        sql = generate_seed.render_seed_sql()
        assert sql.index("SET current_usage_id = NULL") < sql.index("DELETE FROM usage_history")

    def test_inserts_50_tags_with_the_naming_convention(self):
        sql = generate_seed.render_seed_sql()
        tokens = re.findall(r"'([a-z]+-\d{3})'", sql)
        assert len(tokens) == 50
        assert set(tokens) == {item.nfc_token for item in equipment.EQUIPMENT}

    def test_inserts_120_staff_accounts(self):
        sql = generate_seed.render_seed_sql()
        usernames = re.findall(r"\('([a-z]+\d+)', '[가-힣]{2,4}'", sql)
        assert len(usernames) == 120
        assert set(usernames) == {member.username for member in staff.ROSTER}

    def test_staff_rows_use_the_password_placeholder(self):
        # 비밀번호는 런타임 비밀이라 커밋되는 SQL에 해시를 넣지 않는다.
        assert "'x'" in generate_seed.render_seed_sql()

    def test_is_wrapped_in_a_transaction(self):
        sql = generate_seed.render_seed_sql()
        assert sql.strip().startswith("--")
        assert "BEGIN;" in sql
        assert sql.strip().endswith("COMMIT;")

    def test_escapes_single_quotes_in_names(self):
        assert generate_seed._quote("O'Brien") == "'O''Brien'"


class TestZoneBoundsTs:
    def test_contains_all_44_zones_including_real_hardware(self):
        ts = generate_seed.render_zone_bounds_ts()
        keys = re.findall(r"^  (M\d{3}): \[", ts, re.M)
        assert len(keys) == 44
        assert set(keys) == {zone.reader_id for zone in zones.ZONES}

    def test_exports_the_types_the_frontend_imports(self):
        ts = generate_seed.render_zone_bounds_ts()
        assert "export type ZonePoint" in ts
        assert "export const ZONE_BOUNDS" in ts

    def test_regenerating_matches_the_committed_file(self):
        # 프론트 지도가 안 깨지는지 강제한다. 좌표를 바꿨다면 생성기를 다시 돌려 커밋한다.
        committed = Path(generate_seed.ZONE_BOUNDS_TS_PATH).read_text(encoding="utf-8")
        assert generate_seed.render_zone_bounds_ts() == committed


class TestCommittedSeedIsCurrent:
    def test_committed_sql_matches_the_generator(self):
        committed = Path(generate_seed.SEED_SQL_PATH).read_text(encoding="utf-8")
        assert generate_seed.render_seed_sql() == committed
