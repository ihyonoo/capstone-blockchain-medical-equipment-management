import re
from collections import Counter

from simulation.topology import staff


class TestRosterSize:
    def test_has_120_members(self):
        assert len(staff.ROSTER) == 120

    def test_headcount_per_position(self):
        counts = Counter(member.position for member in staff.ROSTER)
        assert counts == Counter(staff.HEADCOUNT)

    def test_headcount_sums_to_120(self):
        assert sum(staff.HEADCOUNT.values()) == 120


class TestFloorAllocation:
    def test_floor_headcount(self):
        counts = Counter(member.floor for member in staff.ROSTER)
        assert counts[1] == 22
        assert counts[2] == 21
        assert counts[3] == 21
        assert counts[4] == 24
        assert counts[5] == 24
        assert counts[None] == 8

    def test_universal_positions_have_no_floor(self):
        for member in staff.ROSTER:
            if member.position in staff.UNIVERSAL_POSITIONS:
                assert member.floor is None, member.username


class TestShiftDistribution:
    def test_three_shift_positions_split_roughly_40_33_27(self):
        rotating = [m for m in staff.ROSTER if m.shift in (staff.Shift.DAY, staff.Shift.EVENING, staff.Shift.NIGHT)]
        counts = Counter(m.shift for m in rotating)
        total = len(rotating)
        assert counts[staff.Shift.DAY] > counts[staff.Shift.EVENING] > counts[staff.Shift.NIGHT]
        assert abs(counts[staff.Shift.DAY] / total - 0.40) < 0.05
        assert abs(counts[staff.Shift.NIGHT] / total - 0.27) < 0.05

    def test_every_member_has_a_shift(self):
        for member in staff.ROSTER:
            assert isinstance(member.shift, staff.Shift)


class TestAccountFields:
    def test_usernames_are_unique(self):
        usernames = [member.username for member in staff.ROSTER]
        assert len(usernames) == len(set(usernames))

    def test_usernames_are_lowercase_ascii_with_digits(self):
        for member in staff.ROSTER:
            assert re.fullmatch(r"[a-z]+\d+", member.username), member.username

    def test_display_names_are_korean(self):
        for member in staff.ROSTER:
            assert re.fullmatch(r"[가-힣]{2,4}", member.display_name), member.display_name

    def test_every_member_has_a_department(self):
        for member in staff.ROSTER:
            assert member.department

    def test_positions_cover_every_role_declared_by_the_equipment_catalog(self):
        from simulation.topology import equipment

        declared = {role for profile in equipment.TYPES.values() for role in profile.roles}
        available = {member.position for member in staff.ROSTER}
        assert declared <= available, declared - available
