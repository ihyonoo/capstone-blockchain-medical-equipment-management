"""도면 좌표(퍼센트) 계산. 폴리곤 포함·중심점·경계거리·선형보간.

좌표는 층 도면 이미지 대비 퍼센트(0~100)다 — 프론트의 ZONE_BOUNDS와 같은 좌표계.
거리 계산에는 실제 미터가 필요하므로 도면 실치수 가정을 곱한다.
"""

import math
import random
from collections.abc import Sequence

Point = tuple[float, float]

# 층 도면 이미지 규격(5개 층 동일).
IMAGE_WIDTH_PX = 930
IMAGE_HEIGHT_PX = 976

# 본관 바닥판 실치수 가정. RSSI가 어색하면 이 값만 조정한다.
FLOOR_PLATE_WIDTH_M = 100.0

METERS_PER_PERCENT_X = FLOOR_PLATE_WIDTH_M / 100.0
METERS_PER_PERCENT_Y = FLOOR_PLATE_WIDTH_M * (IMAGE_HEIGHT_PX / IMAGE_WIDTH_PX) / 100.0

_PIXELS_PER_PERCENT_X = IMAGE_WIDTH_PX / 100.0
_PIXELS_PER_PERCENT_Y = IMAGE_HEIGHT_PX / 100.0


def distance_m(a: Point, b: Point) -> float:
    dx = (a[0] - b[0]) * METERS_PER_PERCENT_X
    dy = (a[1] - b[1]) * METERS_PER_PERCENT_Y
    return math.hypot(dx, dy)


def centroid(polygon: Sequence[Point]) -> Point:
    return (
        sum(p[0] for p in polygon) / len(polygon),
        sum(p[1] for p in polygon) / len(polygon),
    )


def contains(polygon: Sequence[Point], p: Point) -> bool:
    """ray casting. 꼭짓점 중복 계산을 막으려 y 비교를 반개구간으로 둔다."""
    x, y = p
    inside = False
    for i in range(len(polygon)):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % len(polygon)]
        if (y1 > y) != (y2 > y):
            x_cross = x1 + (y - y1) / (y2 - y1) * (x2 - x1)
            if x < x_cross:
                inside = not inside
    return inside


def _to_pixels(p: Point) -> Point:
    return (p[0] * _PIXELS_PER_PERCENT_X, p[1] * _PIXELS_PER_PERCENT_Y)


def _point_segment_distance(p: Point, a: Point, b: Point) -> float:
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _segment_distance(p: Point, q: Point, a: Point, b: Point) -> float:
    return min(
        _point_segment_distance(p, a, b),
        _point_segment_distance(q, a, b),
        _point_segment_distance(a, p, q),
        _point_segment_distance(b, p, q),
    )


def polygon_gap_px(a: Sequence[Point], b: Sequence[Point]) -> float:
    """두 폴리곤 경계 사이 최단거리(px). 인접 판정에 쓴다."""
    pa = [_to_pixels(p) for p in a]
    pb = [_to_pixels(p) for p in b]
    best = math.inf
    for i in range(len(pa)):
        seg_a = (pa[i], pa[(i + 1) % len(pa)])
        for j in range(len(pb)):
            seg_b = (pb[j], pb[(j + 1) % len(pb)])
            best = min(best, _segment_distance(*seg_a, *seg_b))
    return best


def random_point_in(polygon: Sequence[Point], rng: random.Random) -> Point:
    """bbox 기각표집. 볼록하지 않은 구역도 정확히 내부만 반환한다."""
    min_x = min(p[0] for p in polygon)
    max_x = max(p[0] for p in polygon)
    min_y = min(p[1] for p in polygon)
    max_y = max(p[1] for p in polygon)
    for _ in range(200):
        candidate = (rng.uniform(min_x, max_x), rng.uniform(min_y, max_y))
        if contains(polygon, candidate):
            return candidate
    return centroid(polygon)


def lerp(a: Point, b: Point, t: float) -> Point:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
