"""시각별 근무자 판정과 대여자·반납자 선정.

대여는 세 조건을 모두 만족하는 사람만 할 수 있다 — 그 시각 근무 중, 장비가 있는 층
담당, 그 장비를 쓰는 직종. 후보가 없으면 대여 자체가 일어나지 않는다. 시간대 곡선과는
독립적으로 작동하는 두 번째 억제 장치다(새벽에 물리치료사가 없으니 전기자극치료기가
안 나간다).
"""

import datetime as dt
import random

from simulation.demand import KST
from simulation.topology import staff
from simulation.topology.equipment import Equipment
from simulation.topology.staff import Shift, StaffMember

# 전층 공통 직종(의공기사)은 어떤 장비든 다룰 수 있지만 주 사용자는 아니다.
UNIVERSAL_WEIGHT = 0.2
PRIMARY_WEIGHT = 1.0

# 대여자가 아직 근무 중일 때의 대리 반납 확률.
PROXY_RETURN_RATE = 0.04
# 대여자가 이미 퇴근했을 때의 대리 반납 확률. 교대 경계를 넘긴 사용에서 자연히 발생한다.
PROXY_RETURN_RATE_OFF_DUTY = 0.85

_SHIFT_WINDOWS = {
    Shift.DAY: (7, 15),
    Shift.EVENING: (15, 23),
    Shift.NIGHT: (23, 7),
    Shift.OFFICE: (8, 18),
    Shift.ONCALL: (8, 18),
}
_WEEKDAY_ONLY_SHIFTS = frozenset({Shift.OFFICE, Shift.ONCALL})


def _in_window(hour: int, window: tuple[int, int]) -> bool:
    start, end = window
    return start <= hour < end if start < end else (hour >= start or hour < end)


def _is_call_duty(member: StaffMember) -> bool:
    """온콜 직종 중 실제로 호출 대기를 서는 소수. username에서 결정론적으로 정한다."""
    return sum(ord(char) for char in member.username) % 6 == 0


def is_on_duty(member: StaffMember, moment: dt.datetime) -> bool:
    local = moment.astimezone(KST)
    if member.shift in _WEEKDAY_ONLY_SHIFTS:
        in_office_hours = local.weekday() < 5 and _in_window(local.hour, _SHIFT_WINDOWS[member.shift])
        if in_office_hours:
            return True
        return member.shift is Shift.ONCALL and _is_call_duty(member)
    return _in_window(local.hour, _SHIFT_WINDOWS[member.shift])


def on_duty(moment: dt.datetime) -> tuple[StaffMember, ...]:
    return tuple(member for member in staff.ROSTER if is_on_duty(member, moment))


def candidates_for(item: Equipment, moment: dt.datetime) -> tuple[tuple[StaffMember, float], ...]:
    """이 장비를 지금 대여할 수 있는 사람과 그 가중치."""
    primary = set(item.profile.roles)
    found: list[tuple[StaffMember, float]] = []
    for member in staff.ROSTER:
        if member.floor is not None and member.floor != item.floor:
            continue
        if not is_on_duty(member, moment):
            continue
        if member.position in primary:
            found.append((member, PRIMARY_WEIGHT))
        elif member.position in staff.UNIVERSAL_POSITIONS:
            found.append((member, UNIVERSAL_WEIGHT))
    return tuple(found)


def _weighted_choice(pool: tuple[tuple[StaffMember, float], ...], rng: random.Random) -> StaffMember:
    members = [member for member, _ in pool]
    weights = [weight for _, weight in pool]
    return rng.choices(members, weights=weights, k=1)[0]


def pick_borrower(item: Equipment, moment: dt.datetime, rng: random.Random) -> StaffMember | None:
    pool = candidates_for(item, moment)
    return _weighted_choice(pool, rng) if pool else None


def pick_returner(item: Equipment, borrower: StaffMember, moment: dt.datetime, rng: random.Random) -> StaffMember:
    """보통은 대여자 본인이 반납한다. 대여자가 퇴근했으면 거의 항상 다른 사람이 대신한다."""
    borrower_available = is_on_duty(borrower, moment)
    proxy_rate = PROXY_RETURN_RATE if borrower_available else PROXY_RETURN_RATE_OFF_DUTY
    if borrower_available and rng.random() >= proxy_rate:
        return borrower

    others = tuple((m, w) for m, w in candidates_for(item, moment) if m.username != borrower.username)
    if others:
        # 같은 직종을 우선하고, 없으면 후보 전체(의공기사 포함)에서 고른다.
        same_position = tuple((m, w) for m, w in others if m.position == borrower.position)
        return _weighted_choice(same_position or others, rng)

    if not borrower_available and rng.random() < proxy_rate:
        engineers = tuple(
            (m, PRIMARY_WEIGHT)
            for m in staff.ROSTER
            if m.position in staff.UNIVERSAL_POSITIONS and is_on_duty(m, moment)
        )
        if engineers:
            return _weighted_choice(engineers, rng)
    return borrower
