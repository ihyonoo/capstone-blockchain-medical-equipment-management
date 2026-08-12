import random

from simulation import movement
from simulation.topology import geometry, graph, zones


class TestPlanJourney:
    def test_path_follows_the_graph(self):
        journey = movement.plan_journey("M201", "M212", random.Random(1))
        for a, b in zip(journey.path, journey.path[1:], strict=False):
            assert b in graph.NEIGHBORS[a], f"{a}->{b}"

    def test_speed_stays_within_the_walking_band(self):
        rng = random.Random(2)
        for _ in range(500):
            journey = movement.plan_journey("M201", "M205", rng)
            assert movement.WALK_SPEED_MIN <= journey.speed_mps <= movement.WALK_SPEED_MAX

    def test_returns_none_for_an_unreachable_destination(self):
        assert movement.plan_journey("M201", "M301", random.Random(1)) is None

    def test_returns_none_when_origin_equals_destination(self):
        assert movement.plan_journey("M203", "M203", random.Random(1)) is None


class TestAdvance:
    def test_reports_arrival_only_at_the_end_of_the_last_leg(self):
        journey = movement.plan_journey("M201", "M202", random.Random(3))
        assert movement.advance(journey, 0.2) is False
        # 한 번에 아주 크게 진행시키면 도착한다.
        assert movement.advance(journey, 10_000.0) is True

    def test_progresses_through_every_leg_in_order(self):
        journey = movement.plan_journey("M201", "M212", random.Random(4))
        seen = [journey.leg_index]
        while not movement.advance(journey, 1.0):
            seen.append(journey.leg_index)
        assert seen == sorted(seen)
        assert max(seen) <= len(journey.path) - 2

    def test_never_moves_backwards(self):
        journey = movement.plan_journey("M201", "M212", random.Random(5))
        previous = (journey.leg_index, journey.leg_progress_m)
        while not movement.advance(journey, 0.2):
            current = (journey.leg_index, journey.leg_progress_m)
            assert current >= previous
            previous = current


class TestPlacement:
    def test_resting_placement_reports_the_same_zone_on_both_ends(self):
        point = geometry.centroid(zones.ZONE_BY_ID["M203"].polygon)
        placement = movement.resting_placement("M203", point)
        assert placement.zone_a == placement.zone_b == "M203"
        assert placement.progress == 0.0
        assert placement.point == point

    def test_moving_placement_interpolates_between_the_two_leg_zones(self):
        journey = movement.plan_journey("M201", "M202", random.Random(6))
        movement.advance(journey, 1.0)
        placement = movement.placement_of(journey)
        assert placement.zone_a == "M201"
        assert placement.zone_b == "M202"
        assert 0.0 < placement.progress < 1.0

    def test_point_moves_continuously_along_the_route(self):
        journey = movement.plan_journey("M201", "M212", random.Random(7))
        previous = movement.placement_of(journey).point
        while not movement.advance(journey, 0.2):
            current = movement.placement_of(journey).point
            # 0.2초에 최대 속도로 움직여도 0.4m를 넘지 않는다.
            assert geometry.distance_m(previous, current) < 0.5
            previous = current


class TestWallHops:
    def test_resting_in_a_zone_has_no_wall_to_its_own_reader(self):
        placement = movement.resting_placement("M203", (0.0, 0.0))
        assert movement.wall_hops(placement, "M203") == 0.0

    def test_resting_next_to_an_adjacent_zone_costs_one_wall(self):
        placement = movement.resting_placement("M201", (0.0, 0.0))
        assert movement.wall_hops(placement, "M202") == 1.0

    def test_interpolates_between_the_two_leg_zones_while_moving(self):
        placement = movement.Placement(point=(0.0, 0.0), zone_a="M201", zone_b="M202", progress=0.5)
        # M201에서 M202까지 이동 중이면 M202 리더에 대한 벽은 1과 0의 중간이다.
        assert movement.wall_hops(placement, "M202") == 0.5
        assert movement.wall_hops(placement, "M201") == 0.5

    def test_unreachable_reader_reports_the_unreachable_sentinel(self):
        placement = movement.resting_placement("M201", (0.0, 0.0))
        assert movement.wall_hops(placement, "M301") == float(graph.HOPS_UNREACHABLE)
