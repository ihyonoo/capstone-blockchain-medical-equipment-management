import datetime as dt
import random

from simulation import demand, roster
from simulation.topology import equipment, staff

WEEKDAY_9AM = dt.datetime(2026, 8, 12, 9, 0, tzinfo=demand.KST)  # 수요일
WEEKDAY_8PM = dt.datetime(2026, 8, 12, 20, 0, tzinfo=demand.KST)
WEEKDAY_3AM = dt.datetime(2026, 8, 12, 3, 0, tzinfo=demand.KST)
SUNDAY_9AM = dt.datetime(2026, 8, 16, 9, 0, tzinfo=demand.KST)
SUNDAY_3AM = dt.datetime(2026, 8, 16, 3, 0, tzinfo=demand.KST)


def _member(shift: staff.Shift) -> staff.StaffMember:
    return staff.StaffMember("test01", "홍길동", "간호부", "간호사", 2, shift)


class TestShiftWindows:
    def test_day_shift_covers_07_to_15(self):
        member = _member(staff.Shift.DAY)
        assert roster.is_on_duty(member, WEEKDAY_9AM) is True
        assert roster.is_on_duty(member, WEEKDAY_8PM) is False

    def test_evening_shift_covers_15_to_23(self):
        member = _member(staff.Shift.EVENING)
        assert roster.is_on_duty(member, WEEKDAY_8PM) is True
        assert roster.is_on_duty(member, WEEKDAY_9AM) is False

    def test_night_shift_wraps_across_midnight(self):
        member = _member(staff.Shift.NIGHT)
        assert roster.is_on_duty(member, WEEKDAY_3AM) is True
        assert roster.is_on_duty(member, dt.datetime(2026, 8, 12, 23, 30, tzinfo=demand.KST)) is True
        assert roster.is_on_duty(member, WEEKDAY_9AM) is False

    def test_rotating_shifts_work_weekends_too(self):
        assert roster.is_on_duty(_member(staff.Shift.NIGHT), SUNDAY_3AM) is True

    def test_office_shift_is_weekdays_only(self):
        member = _member(staff.Shift.OFFICE)
        assert roster.is_on_duty(member, WEEKDAY_9AM) is True
        assert roster.is_on_duty(member, SUNDAY_9AM) is False
        assert roster.is_on_duty(member, WEEKDAY_8PM) is False


class TestOnDutyHeadcount:
    def test_weekday_daytime_is_around_seventy(self):
        assert 60 <= len(roster.on_duty(WEEKDAY_9AM)) <= 80

    def test_weekday_evening_is_around_thirty(self):
        assert 22 <= len(roster.on_duty(WEEKDAY_8PM)) <= 38

    def test_weekday_night_is_around_twenty_five(self):
        assert 18 <= len(roster.on_duty(WEEKDAY_3AM)) <= 33

    def test_weekend_daytime_is_far_smaller_than_weekday_daytime(self):
        assert len(roster.on_duty(SUNDAY_9AM)) < len(roster.on_duty(WEEKDAY_9AM)) * 0.6

    def test_night_is_always_smaller_than_day(self):
        assert len(roster.on_duty(WEEKDAY_3AM)) < len(roster.on_duty(WEEKDAY_9AM))


class TestCandidates:
    def test_only_returns_people_on_duty(self):
        item = equipment.EQUIPMENT_BY_TAG[equipment.EQUIPMENT[0].tag_id]
        for member, _ in roster.candidates_for(item, WEEKDAY_3AM):
            assert roster.is_on_duty(member, WEEKDAY_3AM)

    def test_only_returns_people_on_the_equipment_floor_or_universal(self):
        item = next(i for i in equipment.EQUIPMENT if i.floor == 4)
        for member, _ in roster.candidates_for(item, WEEKDAY_9AM):
            assert member.floor in (4, None)

    def test_only_returns_positions_that_use_that_equipment(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "hd")
        positions = {member.position for member, _ in roster.candidates_for(item, WEEKDAY_9AM)}
        assert positions <= set(item.profile.roles) | staff.UNIVERSAL_POSITIONS

    def test_universal_positions_get_a_smaller_weight(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "hd")
        weights = {member.position: weight for member, weight in roster.candidates_for(item, WEEKDAY_9AM)}
        if "의공기사" in weights and "투석실간호사" in weights:
            assert weights["의공기사"] < weights["투석실간호사"]

    def test_outpatient_only_equipment_has_no_candidates_at_night(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "estim")
        assert roster.candidates_for(item, WEEKDAY_3AM) == ()


class TestPickBorrower:
    def test_returns_none_when_nobody_qualifies(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "estim")
        assert roster.pick_borrower(item, WEEKDAY_3AM, random.Random(1)) is None

    def test_returns_a_qualified_person_during_the_day(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "estim")
        borrower = roster.pick_borrower(item, WEEKDAY_9AM, random.Random(1))
        assert borrower is not None
        assert borrower.position in set(item.profile.roles) | staff.UNIVERSAL_POSITIONS

    def test_spreads_across_multiple_people(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "pump")
        rng = random.Random(2)
        picked = {roster.pick_borrower(item, WEEKDAY_9AM, rng).username for _ in range(200)}
        assert len(picked) > 3


class TestPickReturner:
    def test_usually_returns_the_borrower_when_still_on_duty(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "pump")
        borrower = roster.pick_borrower(item, WEEKDAY_9AM, random.Random(3))
        rng = random.Random(4)
        same = sum(
            roster.pick_returner(item, borrower, WEEKDAY_9AM, rng).username == borrower.username for _ in range(500)
        )
        assert same / 500 > 0.90

    def test_almost_always_delegates_when_the_borrower_has_gone_home(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "pump")
        borrower = next(m for m in staff.ROSTER if m.floor == item.floor and m.shift is staff.Shift.NIGHT)
        rng = random.Random(5)
        other = sum(
            roster.pick_returner(item, borrower, WEEKDAY_9AM, rng).username != borrower.username for _ in range(500)
        )
        assert other / 500 > 0.70

    def test_falls_back_to_the_borrower_when_nobody_else_is_around(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "estim")
        borrower = next(m for m in staff.ROSTER if m.position == "물리치료사")
        returned = roster.pick_returner(item, borrower, WEEKDAY_3AM, random.Random(6))
        assert returned.username == borrower.username

    def test_the_proxy_returner_is_on_duty(self):
        item = next(i for i in equipment.EQUIPMENT if i.profile.slug == "pump")
        borrower = next(m for m in staff.ROSTER if m.floor == item.floor and m.shift is staff.Shift.NIGHT)
        rng = random.Random(7)
        for _ in range(100):
            returner = roster.pick_returner(item, borrower, WEEKDAY_9AM, rng)
            if returner.username != borrower.username:
                assert roster.is_on_duty(returner, WEEKDAY_9AM)
