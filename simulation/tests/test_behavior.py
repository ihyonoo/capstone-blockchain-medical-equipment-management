import random
import statistics
from collections import Counter

from simulation import behavior
from simulation.topology import equipment, graph, staff, zones

NURSE = staff.StaffMember("test01", "홍길동", "간호부", "간호사", 2, staff.Shift.DAY)


def _item(slug: str) -> equipment.Equipment:
    return next(i for i in equipment.EQUIPMENT if i.profile.slug == slug)


class TestReachableZones:
    def test_floor_mobility_reaches_the_whole_floor(self):
        item = _item("pump")
        reachable = set(behavior.reachable_zones(item, item.home_zone))
        same_floor = {z.reader_id for z in zones.SIM_ZONES if z.floor == item.floor}
        assert reachable == same_floor

    def test_home2_mobility_stays_within_two_hops_of_home(self):
        item = _item("defib")
        for zone_id in behavior.reachable_zones(item, item.home_zone):
            assert graph.hops(item.home_zone, zone_id) <= 2

    def test_home1_mobility_stays_within_one_hop_of_home(self):
        item = _item("anesth")
        for zone_id in behavior.reachable_zones(item, item.home_zone):
            assert graph.hops(item.home_zone, zone_id) <= 1

    def test_fixed_mobility_only_reaches_its_declared_zones(self):
        item = _item("hd")
        assert set(behavior.reachable_zones(item, item.home_zone)) == {"M409", "M410"}

    def test_never_crosses_floors(self):
        for item in equipment.EQUIPMENT:
            for zone_id in behavior.reachable_zones(item, item.home_zone):
                assert zones.ZONE_BY_ID[zone_id].floor == item.floor, item.equipment_name

    def test_always_includes_the_current_zone_even_after_straying(self):
        # home에서 2홉을 넘는 구역이 실제로 있는 HOME2 장비를 고른다 — 1층은 구역이
        # 3개뿐이라 2홉 밖이 아예 존재하지 않는다.
        item, far = next(
            (i, z.reader_id)
            for i in equipment.EQUIPMENT
            if i.profile.mobility is equipment.Mobility.HOME2
            for z in zones.SIM_ZONES
            if z.floor == i.floor and graph.hops(i.home_zone, z.reader_id) > 2
        )
        assert far not in behavior.reachable_zones(item, item.home_zone)
        assert far in behavior.reachable_zones(item, far)


class TestPickNextStop:
    def test_never_picks_the_current_zone_when_alternatives_exist(self):
        item = _item("pump")
        rng = random.Random(1)
        for _ in range(200):
            assert behavior.pick_next_stop(item, item.home_zone, rng) != item.home_zone

    def test_stays_within_the_mobility_envelope(self):
        item = _item("defib")
        rng = random.Random(2)
        allowed = set(behavior.reachable_zones(item, item.home_zone))
        for _ in range(200):
            assert behavior.pick_next_stop(item, item.home_zone, rng) in allowed

    def test_prefers_nearby_zones(self):
        item = _item("pump")
        rng = random.Random(3)
        picks = Counter(behavior.pick_next_stop(item, item.home_zone, rng) for _ in range(600))
        near = [z for z in picks if graph.hops(item.home_zone, z) == 1]
        far = [z for z in picks if graph.hops(item.home_zone, z) >= 4]
        assert sum(picks[z] for z in near) > sum(picks[z] for z in far)

    def test_returns_the_current_zone_when_it_is_the_only_option(self):
        item = _item("anesth")  # home1 이고 M507은 이웃이 M503 하나뿐인 경우가 있다
        rng = random.Random(4)
        stop = behavior.pick_next_stop(item, item.home_zone, rng)
        assert stop in behavior.reachable_zones(item, item.home_zone)


class TestPlanAssignment:
    def test_records_the_borrower(self):
        item = _item("pump")
        plan = behavior.plan_assignment(item, NURSE, item.home_zone, random.Random(5))
        assert plan.borrower is NURSE

    def test_stop_count_distribution_matches_the_weights(self):
        item = _item("pump")
        rng = random.Random(6)
        counts = Counter(len(behavior.plan_assignment(item, NURSE, item.home_zone, rng).stops) for _ in range(4000))
        # mistap(2%)은 사용지가 0곳이다.
        assert counts[0] / 4000 < 0.05
        assert 0.48 < counts[1] / 4000 < 0.62
        assert 0.25 < counts[2] / 4000 < 0.35

    def test_dwell_entries_match_the_stop_count(self):
        item = _item("pump")
        rng = random.Random(7)
        for _ in range(300):
            plan = behavior.plan_assignment(item, NURSE, item.home_zone, rng)
            if plan.mistap:
                continue  # 잘못 태깅한 대여는 사용지 없이 dwell만 하나 갖는다(전용 테스트가 검증)
            assert len(plan.dwell_sec) == len(plan.stops)

    def test_total_dwell_is_centred_on_the_type_median(self):
        item = _item("us")
        rng = random.Random(8)
        totals = [sum(behavior.plan_assignment(item, NURSE, item.home_zone, rng).dwell_sec) for _ in range(2000)]
        non_mistap = [t for t in totals if t > behavior.MISTAP_MAX_SEC]
        assert 0.7 < statistics.median(non_mistap) / item.profile.usage_median_sec < 1.5

    def test_every_stop_is_reachable(self):
        rng = random.Random(9)
        for item in equipment.EQUIPMENT:
            plan = behavior.plan_assignment(item, NURSE, item.home_zone, rng)
            allowed = set(behavior.reachable_zones(item, item.home_zone))
            for stop in plan.stops:
                assert stop in allowed, f"{item.equipment_name} -> {stop}"

    def test_return_zone_is_always_a_simulated_zone_on_the_same_floor(self):
        rng = random.Random(10)
        for item in equipment.EQUIPMENT:
            for _ in range(20):
                plan = behavior.plan_assignment(item, NURSE, item.home_zone, rng)
                assert plan.return_zone in zones.SIM_ZONE_IDS
                assert zones.ZONE_BY_ID[plan.return_zone].floor == item.floor

    def test_high_home_return_types_usually_go_back_home(self):
        item = _item("defib")
        rng = random.Random(11)
        home = sum(
            behavior.plan_assignment(item, NURSE, item.home_zone, rng).return_zone == item.home_zone
            for _ in range(1000)
        )
        assert home / 1000 > 0.85

    def test_low_home_return_types_often_end_up_elsewhere(self):
        item = _item("speccart")
        rng = random.Random(12)
        home = sum(
            behavior.plan_assignment(item, NURSE, item.home_zone, rng).return_zone == item.home_zone
            for _ in range(1000)
        )
        assert home / 1000 < 0.6

    def test_mistap_plans_have_no_stops_and_a_short_dwell(self):
        item = _item("pump")
        rng = random.Random(13)
        plans = [behavior.plan_assignment(item, NURSE, item.home_zone, rng) for _ in range(3000)]
        mistaps = [p for p in plans if p.mistap]
        assert 0.005 < len(mistaps) / 3000 < 0.05
        for plan in mistaps:
            assert plan.stops == ()
            assert behavior.MISTAP_MIN_SEC <= sum(plan.dwell_sec) <= behavior.MISTAP_MAX_SEC
            assert plan.return_zone == item.home_zone

    def test_a_small_share_of_plans_run_much_longer_than_the_median(self):
        item = _item("us")
        rng = random.Random(14)
        totals = [sum(behavior.plan_assignment(item, NURSE, item.home_zone, rng).dwell_sec) for _ in range(3000)]
        long_runs = [t for t in totals if t > item.profile.usage_median_sec * 2]
        assert 0.02 < len(long_runs) / 3000 < 0.20
