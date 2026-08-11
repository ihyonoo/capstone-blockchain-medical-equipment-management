import re
from collections import Counter

from simulation.topology import equipment, zones


class TestCatalogSize:
    def test_has_20_types(self):
        assert len(equipment.TYPES) == 20

    def test_has_50_instances(self):
        assert len(equipment.EQUIPMENT) == 50

    def test_instance_count_matches_the_placement_list(self):
        assert len(equipment.PLACEMENTS) == 50


class TestPlacement:
    def test_every_home_zone_is_a_simulated_zone(self):
        for item in equipment.EQUIPMENT:
            assert item.home_zone in zones.SIM_ZONE_IDS, item.equipment_name

    def test_no_equipment_lives_in_a_real_hardware_zone(self):
        for item in equipment.EQUIPMENT:
            assert item.home_zone not in zones.REAL_READER_IDS, item.equipment_name

    def test_instance_floor_matches_its_home_zone_floor(self):
        for item in equipment.EQUIPMENT:
            assert item.floor == zones.ZONE_BY_ID[item.home_zone].floor

    def test_per_floor_distribution(self):
        counts = Counter(item.floor for item in equipment.EQUIPMENT)
        assert dict(sorted(counts.items())) == {1: 9, 2: 13, 3: 8, 4: 11, 5: 9}

    def test_nine_simulated_zones_have_no_resident_equipment(self):
        occupied = {item.home_zone for item in equipment.EQUIPMENT}
        assert len(zones.SIM_ZONE_IDS - occupied) == 9


class TestNamingConvention:
    def test_equipment_names_follow_type_dash_three_digits(self):
        for item in equipment.EQUIPMENT:
            assert re.fullmatch(r".+-\d{3}", item.equipment_name), item.equipment_name

    def test_index_starts_at_the_reserved_or_default_start_for_each_type(self):
        for slug, profile in equipment.TYPES.items():
            same = sorted(i.equipment_name for i in equipment.EQUIPMENT if i.equipment_type == profile.name)
            start = equipment.RESERVED_START_INDEX.get(slug, 1)
            expected = [f"{profile.name}-{n:03d}" for n in range(start, start + len(same))]
            assert same == expected, slug

    def test_pump_naming_never_collides_with_the_registered_real_hardware_token(self):
        # 로컬 개발 DB에 is_real_hardware=TRUE로 등록된 실물 태그가 nfc_tag_uid='pump-001'을
        # 이미 쓰고 있다 — 시뮬레이션 카탈로그가 이 값을 다시 만들면 재시드가 DB
        # UniqueViolation으로 깨진다.
        tokens = {item.nfc_token for item in equipment.EQUIPMENT}
        assert "pump-001" not in tokens
        names = {item.equipment_name for item in equipment.EQUIPMENT}
        assert "수액펌프-001" not in names

    def test_nfc_tokens_are_lowercase_ascii_slug_and_index(self):
        for item in equipment.EQUIPMENT:
            assert re.fullmatch(r"[a-z]+-\d{3}", item.nfc_token), item.nfc_token

    def test_nfc_tokens_are_unique(self):
        tokens = [item.nfc_token for item in equipment.EQUIPMENT]
        assert len(tokens) == len(set(tokens))

    def test_tag_ids_are_ibeacon_uuid_major_minor_with_the_floor_as_major(self):
        for item in equipment.EQUIPMENT:
            uuid, major, minor = item.tag_id.split(":")
            assert uuid == equipment.HOSPITAL_BEACON_UUID
            assert int(major) == item.floor
            assert re.fullmatch(r"\d{4}", minor)

    def test_tag_ids_and_serial_numbers_are_unique(self):
        assert len({i.tag_id for i in equipment.EQUIPMENT}) == 50
        assert len({i.serial_number for i in equipment.EQUIPMENT}) == 50


class TestTypeProfiles:
    def test_slugs_are_unique_lowercase_ascii(self):
        for slug in equipment.TYPES:
            assert re.fullmatch(r"[a-z]+", slug), slug

    def test_home_return_rate_is_a_probability(self):
        for profile in equipment.TYPES.values():
            assert 0.0 <= profile.home_return_rate <= 1.0, profile.slug

    def test_fixed_mobility_types_declare_their_zones(self):
        for profile in equipment.TYPES.values():
            if profile.mobility is equipment.Mobility.FIXED:
                assert profile.fixed_zones, profile.slug
                for zone_id in profile.fixed_zones:
                    assert zone_id in zones.SIM_ZONE_IDS
            else:
                assert profile.fixed_zones == ()

    def test_non_fixed_types_have_no_stray_zone_list(self):
        assert equipment.TYPES["pump"].fixed_zones == ()

    def test_every_type_declares_at_least_one_role(self):
        for profile in equipment.TYPES.values():
            assert profile.roles, profile.slug

    def test_defibrillators_almost_always_return_home(self):
        assert equipment.TYPES["defib"].home_return_rate >= 0.9

    def test_dialysis_machines_are_fixed_to_the_dialysis_zones(self):
        profile = equipment.TYPES["hd"]
        assert profile.mobility is equipment.Mobility.FIXED
        assert set(profile.fixed_zones) == {"M409", "M410"}


class TestAffinity:
    def test_affinity_zones_are_the_zones_that_host_that_type(self):
        assert equipment.AFFINITY_ZONES["hd"] == frozenset({"M409", "M410"})

    def test_every_type_has_affinity_zones(self):
        for slug in equipment.TYPES:
            assert equipment.AFFINITY_ZONES[slug], slug
