import re

from simulation.topology import zones


class TestZoneInventory:
    def test_has_44_zones(self):
        assert len(zones.ZONES) == 44

    def test_has_42_simulated_zones(self):
        assert len(zones.SIM_ZONES) == 42

    def test_real_hardware_zones_are_the_two_operating_centers(self):
        real = {zone.reader_id for zone in zones.ZONES if zone.is_real_hardware}
        assert real == {"M501", "M502"}

    def test_zone_counts_per_floor(self):
        counts = {floor: len(zones.zones_on_floor(floor)) for floor in range(1, 6)}
        assert counts == {1: 3, 2: 12, 3: 12, 4: 10, 5: 7}


class TestZoneInvariants:
    def test_reader_ids_follow_the_m_plus_three_digits_format(self):
        for zone in zones.ZONES:
            assert re.fullmatch(r"M\d{3}", zone.reader_id), zone.reader_id

    def test_first_digit_of_the_reader_id_is_the_floor(self):
        for zone in zones.ZONES:
            assert int(zone.reader_id[1]) == zone.floor, zone.reader_id

    def test_reader_ids_are_unique(self):
        ids = [zone.reader_id for zone in zones.ZONES]
        assert len(ids) == len(set(ids))

    def test_zone_names_are_unique(self):
        names = [zone.name for zone in zones.ZONES]
        assert len(names) == len(set(names))

    def test_every_polygon_is_a_closed_shape_with_at_least_three_vertices(self):
        for zone in zones.ZONES:
            assert len(zone.polygon) >= 3, zone.reader_id

    def test_all_coordinates_are_within_the_image_bounds(self):
        for zone in zones.ZONES:
            for x, y in zone.polygon:
                assert 0.0 <= x <= 100.0, zone.reader_id
                assert 0.0 <= y <= 100.0, zone.reader_id
