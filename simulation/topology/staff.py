"""의료진 로스터 120명. 직종·담당 층·교대가 대여 가능 여부를 결정한다.

users.role은 DB CHECK 때문에 admin/staff 두 값뿐이라 직종은 position에 넣는다.
로스터는 고정 시드로 결정론적으로 생성한다 — 같은 시드 SQL이 매번 나와야 재현이 된다.
"""

import random
from dataclasses import dataclass
from enum import StrEnum


class Shift(StrEnum):
    DAY = "D"  # 07-15
    EVENING = "E"  # 15-23
    NIGHT = "N"  # 23-07
    OFFICE = "A"  # 평일 08-18
    ONCALL = "O"  # 평일 주간 상주 + 그 밖의 시간은 일부만 호출 대기


@dataclass(frozen=True)
class StaffMember:
    username: str
    display_name: str
    department: str
    position: str
    floor: int | None  # None이면 전층 공통
    shift: Shift


UNIVERSAL_POSITIONS = frozenset({"의공기사"})

# 3교대를 도는 직종. D:E:N을 40:33:27로 나눈다 — 야간조가 가장 적은 실제 배치를 따른다.
ROTATING_POSITIONS = frozenset({"간호사", "전공의", "응급구조사", "수술실간호사", "호흡치료사"})
ROTATION_DAY_RATIO = 0.40
ROTATION_EVENING_RATIO = 0.33

# 주간·저녁 2교대만 도는 직종.
TWO_SHIFT_POSITIONS = frozenset({"투석실간호사"})

# 주간 상근 + 정원 1/3을 야간 당직으로 세우는 직종.
ON_DUTY_POSITIONS = frozenset({"방사선사", "임상병리사", "마취간호사"})

# 평일 주간 상주 + 호출 대기.
ONCALL_POSITIONS = frozenset({"전문의", "의공기사"})

# (층, 직종, 인원). 층이 None이면 전층 공통. 합이 120이어야 한다.
FLOOR_ALLOCATION: tuple[tuple[int | None, str, int], ...] = (
    (1, "간호사", 10), (1, "응급구조사", 6), (1, "전문의", 3), (1, "전공의", 3),
    (2, "간호사", 10), (2, "임상병리사", 4), (2, "전문의", 3), (2, "전공의", 3), (2, "수간호사", 1),
    (3, "간호사", 8), (3, "물리치료사", 4), (3, "작업치료사", 2), (3, "전문의", 4), (3, "전공의", 2),
    (3, "수간호사", 1),
    (4, "간호사", 10), (4, "투석실간호사", 4), (4, "임상병리사", 2), (4, "방사선사", 2), (4, "전문의", 2),
    (4, "전공의", 2), (4, "수간호사", 2),
    (5, "간호사", 8), (5, "마취간호사", 4), (5, "수술실간호사", 4), (5, "호흡치료사", 2), (5, "전문의", 2),
    (5, "전공의", 2), (5, "수간호사", 2),
    (None, "의공기사", 4), (None, "방사선사", 4),
)  # fmt: skip

HEADCOUNT: dict[str, int] = {
    "간호사": 46,
    "수간호사": 6,
    "전문의": 14,
    "전공의": 12,
    "응급구조사": 6,
    "방사선사": 6,
    "임상병리사": 6,
    "투석실간호사": 4,
    "마취간호사": 4,
    "수술실간호사": 4,
    "물리치료사": 4,
    "의공기사": 4,
    "작업치료사": 2,
    "호흡치료사": 2,
}

DEPARTMENT_BY_POSITION: dict[str, str] = {
    "간호사": "간호부",
    "수간호사": "간호부",
    "전문의": "진료부",
    "전공의": "진료부",
    "응급구조사": "응급의료센터",
    "방사선사": "영상의학과",
    "임상병리사": "진단검사의학과",
    "투석실간호사": "인공신장실",
    "마취간호사": "마취통증의학과",
    "수술실간호사": "중앙수술센터",
    "물리치료사": "재활의학과",
    "의공기사": "의공학팀",
    "작업치료사": "재활의학과",
    "호흡치료사": "호흡기내과",
}

# (한글, 로마자). username 생성에 로마자를 쓴다.
_SURNAMES = (
    ("김", "kim"), ("이", "lee"), ("박", "park"), ("최", "choi"),
    ("정", "jung"), ("강", "kang"), ("조", "cho"), ("윤", "yoon"),
    ("장", "jang"), ("임", "lim"), ("한", "han"), ("오", "oh"),
    ("서", "seo"), ("신", "shin"), ("권", "kwon"), ("황", "hwang"),
)  # fmt: skip

# (한글, 이니셜).
_GIVEN_NAMES = (
    ("지훈", "jh"), ("서연", "sy"), ("민준", "mj"), ("수빈", "sb"), ("예은", "ye"),
    ("도현", "dh"), ("하윤", "hy"), ("지우", "jw"), ("채원", "cw"), ("시우", "sw"),
    ("은지", "ej"), ("준서", "js"), ("다은", "de"), ("현우", "hw"), ("소율", "sr"),
    ("태윤", "ty"), ("유진", "yj"), ("동혁", "dhk"), ("나연", "ny"), ("성민", "sm"),
)  # fmt: skip

# 로스터 생성 시드. 바꾸면 모든 계정 이름이 바뀌므로 함부로 건드리지 않는다.
_ROSTER_SEED = 20260811


def _rotation_sequence(total: int) -> tuple[Shift, ...]:
    """D:E:N을 40:33:27로 나눈 뒤 라운드로빈으로 섞는다.

    한 층·한 직종에 같은 교대가 몰리지 않게 하려고 섞는다.
    """
    day = round(total * ROTATION_DAY_RATIO)
    evening = round(total * ROTATION_EVENING_RATIO)
    remaining = {Shift.DAY: day, Shift.EVENING: evening, Shift.NIGHT: total - day - evening}
    sequence: list[Shift] = []
    while sum(remaining.values()) > 0:
        for shift in (Shift.DAY, Shift.EVENING, Shift.NIGHT):
            if remaining[shift] > 0:
                sequence.append(shift)
                remaining[shift] -= 1
    return tuple(sequence)


def _build_roster() -> tuple[StaffMember, ...]:
    rng = random.Random(_ROSTER_SEED)
    combinations = [(surname, given) for surname in _SURNAMES for given in _GIVEN_NAMES]
    rng.shuffle(combinations)

    rotating_total = sum(count for _, position, count in FLOOR_ALLOCATION if position in ROTATING_POSITIONS)
    rotation = iter(_rotation_sequence(rotating_total))
    position_index: dict[str, int] = {}

    members: list[StaffMember] = []
    for floor, position, count in FLOOR_ALLOCATION:
        for _ in range(count):
            sequence = len(members) + 1
            index = position_index[position] = position_index.get(position, 0) + 1
            (surname_ko, surname_roman), (given_ko, given_initials) = combinations[sequence - 1]
            members.append(
                StaffMember(
                    username=f"{surname_roman}{given_initials}{sequence:02d}",
                    display_name=f"{surname_ko}{given_ko}",
                    department=DEPARTMENT_BY_POSITION[position],
                    position=position,
                    floor=floor,
                    shift=_assign_shift(position, index, rotation),
                )
            )
    return tuple(members)


def _assign_shift(position: str, index: int, rotation) -> Shift:
    if position in ROTATING_POSITIONS:
        return next(rotation)
    if position in TWO_SHIFT_POSITIONS:
        return Shift.DAY if index % 2 == 1 else Shift.EVENING
    if position in ON_DUTY_POSITIONS:
        # 정원 1/3을 야간 당직으로 남기고 나머지는 주간 상근.
        return Shift.NIGHT if index % 3 == 0 else Shift.OFFICE
    if position in ONCALL_POSITIONS:
        return Shift.ONCALL
    return Shift.OFFICE


ROSTER: tuple[StaffMember, ...] = _build_roster()
STAFF_BY_USERNAME: dict[str, StaffMember] = {member.username: member for member in ROSTER}
