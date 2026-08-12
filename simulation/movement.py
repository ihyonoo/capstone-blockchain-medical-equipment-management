"""그래프 위 이동. 장비는 인접 구역으로만, 최단경로를 따라, 걷는 속도로 움직인다.

구역이 도면상 복도를 따라 사슬로 늘어서 있어서, 구역 중심점을 잇는 직선 보간이
자연스럽게 복도를 지나간다 — 별도의 복도 노드가 필요 없다.
"""

import random
from dataclasses import dataclass

from simulation.topology import geometry, graph, zones
from simulation.topology.geometry import Point

# 장비를 밀고 걷는 속도.
WALK_SPEED_MEAN_MPS = 1.1
WALK_SPEED_SIGMA = 0.25
WALK_SPEED_MIN = 0.6
WALK_SPEED_MAX = 1.6


@dataclass(frozen=True)
class Placement:
    """전파 계산에 필요한 최소 위치 정보.

    정지 중이면 zone_a == zone_b이고 progress는 0이다.
    """

    point: Point
    zone_a: str
    zone_b: str
    progress: float


@dataclass
class Journey:
    path: tuple[str, ...]
    speed_mps: float
    leg_index: int = 0
    leg_progress_m: float = 0.0


def _zone_center(zone_id: str) -> Point:
    return geometry.centroid(zones.ZONE_BY_ID[zone_id].polygon)


def _leg_length_m(journey: Journey) -> float:
    a = _zone_center(journey.path[journey.leg_index])
    b = _zone_center(journey.path[journey.leg_index + 1])
    return max(geometry.distance_m(a, b), 0.01)


def plan_journey(origin: str, destination: str, rng: random.Random) -> Journey | None:
    """최단경로와 이번 이동의 걷는 속도를 정한다. 갈 수 없거나 제자리면 None."""
    if origin == destination:
        return None
    path = graph.shortest_path(origin, destination)
    if len(path) < 2:
        return None
    speed = min(WALK_SPEED_MAX, max(WALK_SPEED_MIN, rng.gauss(WALK_SPEED_MEAN_MPS, WALK_SPEED_SIGMA)))
    return Journey(path=path, speed_mps=speed)


def advance(journey: Journey, dt_sec: float) -> bool:
    """dt_sec만큼 진행시킨다. 목적지에 닿으면 True."""
    remaining = journey.speed_mps * dt_sec
    while remaining > 0.0:
        leg_length = _leg_length_m(journey)
        to_end = leg_length - journey.leg_progress_m
        if remaining < to_end:
            journey.leg_progress_m += remaining
            return False
        remaining -= to_end
        if journey.leg_index >= len(journey.path) - 2:
            journey.leg_index = len(journey.path) - 2
            journey.leg_progress_m = leg_length
            return True
        journey.leg_index += 1
        journey.leg_progress_m = 0.0
    return False


def placement_of(journey: Journey) -> Placement:
    zone_a = journey.path[journey.leg_index]
    zone_b = journey.path[journey.leg_index + 1]
    progress = min(1.0, journey.leg_progress_m / _leg_length_m(journey))
    point = geometry.lerp(_zone_center(zone_a), _zone_center(zone_b), progress)
    return Placement(point=point, zone_a=zone_a, zone_b=zone_b, progress=progress)


def resting_placement(zone_id: str, point: Point) -> Placement:
    return Placement(point=point, zone_a=zone_id, zone_b=zone_id, progress=0.0)


def wall_hops(placement: Placement, reader_zone: str) -> float:
    """리더까지 통과해야 하는 벽 수. 이동 중이면 두 구역의 홉 수를 진행률로 보간한다."""
    hops_a = graph.hops(placement.zone_a, reader_zone)
    if placement.zone_a == placement.zone_b:
        return float(hops_a)
    hops_b = graph.hops(placement.zone_b, reader_zone)
    if graph.HOPS_UNREACHABLE in (hops_a, hops_b):
        return float(graph.HOPS_UNREACHABLE)
    return hops_a * (1.0 - placement.progress) + hops_b * placement.progress
