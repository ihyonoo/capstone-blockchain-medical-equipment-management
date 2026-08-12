"""대여 상태 머신 — 사용지 계획, 체류 시간, 반납 위치, 예외 이벤트.

대여 1건은 이렇게 흐른다:
  AVAILABLE -> checkout -> TRANSIT -> IN_USE -> (TRANSIT -> IN_USE)* -> RETURNING -> return
사용지 개수가 1곳이면 `대여->이동->사용->반납`, 3곳이면 그만큼 길어진다.

대여는 예외 없이 반드시 반납으로 끝난다. 여기서 말하는 예외는 소요 시간과 반납 위치의
변동이지, 이력이 미완결로 남는 상황이 아니다.
"""

import math
import random
from dataclasses import dataclass
from enum import StrEnum

from simulation.topology import graph, zones
from simulation.topology.equipment import AFFINITY_ZONES, Equipment, Mobility
from simulation.topology.staff import StaffMember

# 사용지 개수 분포. 1곳이 절반 이상이고, 4곳까지 드물게 나온다.
STOP_COUNT_WEIGHTS: tuple[tuple[int, float], ...] = ((1, 0.55), (2, 0.30), (3, 0.12), (4, 0.03))

# 체류 시간 lognormal의 형상 모수.
DWELL_SIGMA = 0.5

# 예외 이벤트.
LONG_USE_PROB = 0.05  # 예상보다 오래 사용
LONG_USE_MIN_FACTOR = 2.0
LONG_USE_MAX_FACTOR = 4.0
STRAY_RETURN_PROB = 0.03  # home 복귀율을 무시하고 엉뚱한 곳에 반납
MISTAP_RETURN_PROB = 0.02  # 잘못 태깅 후 곧바로 반납
MISTAP_MIN_SEC = 30.0
MISTAP_MAX_SEC = 90.0

# 사용지 선택 가중치 = 친화도 x 거리감쇠.
AFFINITY_HIGH = 3.0
AFFINITY_BASE = 1.0
DISTANCE_DECAY = 0.6


class AssetState(StrEnum):
    AVAILABLE = "available"
    TRANSIT = "transit"
    IN_USE = "in_use"
    RETURNING = "returning"


@dataclass(frozen=True)
class Assignment:
    borrower: StaffMember
    stops: tuple[str, ...]
    dwell_sec: tuple[float, ...]
    return_zone: str
    mistap: bool


def reachable_zones(item: Equipment, current_zone: str) -> tuple[str, ...]:
    """이동 성향이 허용하는 구역. 현재 위치는 언제나 포함한다(떠돈 뒤에도 갇히지 않도록)."""
    profile = item.profile
    if profile.mobility is Mobility.FIXED:
        allowed = {zone_id for zone_id in profile.fixed_zones if zones.ZONE_BY_ID[zone_id].floor == item.floor}
    elif profile.mobility is Mobility.FLOOR:
        allowed = {zone.reader_id for zone in zones.SIM_ZONES if zone.floor == item.floor}
    else:
        limit = 1 if profile.mobility is Mobility.HOME1 else 2
        allowed = {
            zone.reader_id
            for zone in zones.SIM_ZONES
            if zone.floor == item.floor and graph.hops(item.home_zone, zone.reader_id) <= limit
        }
    allowed.add(current_zone)
    return tuple(sorted(allowed))


def pick_next_stop(item: Equipment, current_zone: str, rng: random.Random) -> str:
    """친화도 x 거리감쇠로 가중 추첨한다. 가까운 곳이 기본적으로 자주 뽑힌다."""
    affinity = AFFINITY_ZONES[item.profile.slug]
    options = [zone_id for zone_id in reachable_zones(item, current_zone) if zone_id != current_zone]
    if not options:
        return current_zone
    weights = []
    for zone_id in options:
        hops = graph.hops(current_zone, zone_id)
        base = AFFINITY_HIGH if zone_id in affinity else AFFINITY_BASE
        weights.append(base * (DISTANCE_DECAY**hops))
    return rng.choices(options, weights=weights, k=1)[0]


def _pick_stop_count(rng: random.Random) -> int:
    counts = [count for count, _ in STOP_COUNT_WEIGHTS]
    weights = [weight for _, weight in STOP_COUNT_WEIGHTS]
    return rng.choices(counts, weights=weights, k=1)[0]


def plan_assignment(item: Equipment, borrower: StaffMember, current_zone: str, rng: random.Random) -> Assignment:
    """대여 1건의 전체 계획을 미리 세운다. 반납은 반드시 일어나므로 반납 위치도 여기서 정한다."""
    if rng.random() < MISTAP_RETURN_PROB:
        return Assignment(
            borrower=borrower,
            stops=(),
            dwell_sec=(rng.uniform(MISTAP_MIN_SEC, MISTAP_MAX_SEC),),
            return_zone=item.home_zone,
            mistap=True,
        )

    total_sec = item.profile.usage_median_sec
    if rng.random() < LONG_USE_PROB:
        total_sec *= rng.uniform(LONG_USE_MIN_FACTOR, LONG_USE_MAX_FACTOR)

    stop_count = _pick_stop_count(rng)
    stops: list[str] = []
    cursor = current_zone
    for _ in range(stop_count):
        cursor = pick_next_stop(item, cursor, rng)
        stops.append(cursor)

    per_stop_median = total_sec / stop_count
    dwell = tuple(max(30.0, rng.lognormvariate(math.log(per_stop_median), DWELL_SIGMA)) for _ in range(stop_count))

    goes_home = rng.random() >= STRAY_RETURN_PROB and rng.random() < item.profile.home_return_rate
    return_zone = item.home_zone if goes_home else stops[-1]

    return Assignment(borrower=borrower, stops=tuple(stops), dwell_sec=dwell, return_zone=return_zone, mistap=False)
