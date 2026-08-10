"""demo_data.py의 구조 불변식.

구역·리더 배치는 손으로 고치는 상수라, 실물 리더와 모의 리더가 같은 구역을 이중으로
맡거나 reader_id가 겹치는 실수를 여기서 잡는다.
"""

import re

from simulation.demo_data import REAL_READER_EQUIPMENT, REAL_READERS, ROOMS

READER_ID_PATTERN = re.compile(r"^M\d{3}$")


class TestReaderIdentity:
    def test_every_reader_id_follows_the_hardware_naming(self):
        for reader_id, _floor, _name, _equipment in ROOMS:
            assert READER_ID_PATTERN.match(reader_id), reader_id
        for reader_id, _floor, _name in REAL_READERS:
            assert READER_ID_PATTERN.match(reader_id), reader_id

    def test_no_reader_id_is_used_twice(self):
        ids = [room[0] for room in ROOMS] + [real[0] for real in REAL_READERS]
        assert len(ids) == len(set(ids))


class TestZoneOwnership:
    def test_a_zone_owned_by_real_hardware_has_no_simulated_reader(self):
        """실물 리더가 맡은 구역에 모의 리더를 또 두면 지도에 같은 구역이 두 번 뜬다."""
        simulated_zones = {room[2] for room in ROOMS}
        for _reader_id, _floor, location_name in REAL_READERS:
            assert location_name not in simulated_zones, location_name

    def test_no_zone_name_is_defined_twice(self):
        names = [room[2] for room in ROOMS] + [real[2] for real in REAL_READERS]
        assert len(names) == len(set(names))


class TestRealReaderEquipment:
    def test_only_real_readers_appear_in_the_real_equipment_map(self):
        real_ids = {real[0] for real in REAL_READERS}
        assert set(REAL_READER_EQUIPMENT) <= real_ids
