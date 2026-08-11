"""구역 인접 그래프. 장비는 이 그래프의 엣지를 따라서만 이동한다.

엣지는 폴리곤 경계 간격이 ADJACENCY_GAP_PX 이하인 쌍에서 도출하고, 그 결과를
EDGES에 고정한다. 런타임에 도출을 돌리지 않는 이유는 폴리곤을 손보다가 그래프가
조용히 바뀌는 사고를 막기 위해서다 — 테스트가 둘의 일치를 강제한다.
"""

from collections import deque
from itertools import combinations

from simulation.topology import zones
from simulation.topology.geometry import polygon_gap_px

# 복도 폭(약 6.5m)에 해당한다. 이 이하로 떨어진 두 구역은 서로 오갈 수 있다고 본다.
ADJACENCY_GAP_PX = 60.0

HOPS_UNREACHABLE = 99


def derive_edges() -> tuple[tuple[str, str], ...]:
    """폴리곤 기하로 인접 엣지를 도출한다. EDGES 생성과 그 검증에만 쓴다."""
    edges: list[tuple[str, str]] = []
    for floor in range(1, 6):
        floor_zones = [z for z in zones.SIM_ZONES if z.floor == floor]
        for a, b in combinations(floor_zones, 2):
            if polygon_gap_px(a.polygon, b.polygon) <= ADJACENCY_GAP_PX:
                edges.append(tuple(sorted((a.reader_id, b.reader_id))))
    return tuple(sorted(edges))


EDGES: tuple[tuple[str, str], ...] = (
    ("M101", "M102"),
    ("M102", "M106"),
    ("M201", "M202"),
    ("M201", "M203"),
    ("M202", "M203"),
    ("M203", "M204"),
    ("M204", "M205"),
    ("M204", "M206"),
    ("M204", "M207"),
    ("M205", "M206"),
    ("M206", "M207"),
    ("M207", "M208"),
    ("M208", "M209"),
    ("M209", "M210"),
    ("M210", "M211"),
    ("M211", "M212"),
    ("M301", "M302"),
    ("M302", "M303"),
    ("M303", "M304"),
    ("M303", "M306"),
    ("M303", "M307"),
    ("M304", "M305"),
    ("M304", "M306"),
    ("M304", "M307"),
    ("M305", "M306"),
    ("M306", "M307"),
    ("M307", "M308"),
    ("M308", "M309"),
    ("M309", "M310"),
    ("M310", "M311"),
    ("M311", "M312"),
    ("M401", "M402"),
    ("M401", "M406"),
    ("M402", "M403"),
    ("M402", "M404"),
    ("M403", "M404"),
    ("M403", "M405"),
    ("M404", "M405"),
    ("M405", "M406"),
    ("M406", "M407"),
    ("M407", "M408"),
    ("M407", "M409"),
    ("M407", "M410"),
    ("M408", "M409"),
    ("M408", "M410"),
    ("M409", "M410"),
    ("M503", "M504"),
    ("M503", "M507"),
    ("M504", "M505"),
    ("M504", "M506"),
    ("M505", "M506"),
)


def _build_neighbors() -> dict[str, tuple[str, ...]]:
    adjacency: dict[str, set[str]] = {zone.reader_id: set() for zone in zones.SIM_ZONES}
    for a, b in EDGES:
        adjacency[a].add(b)
        adjacency[b].add(a)
    return {key: tuple(sorted(value)) for key, value in adjacency.items()}


NEIGHBORS: dict[str, tuple[str, ...]] = _build_neighbors()


def shortest_path(origin: str, destination: str) -> tuple[str, ...]:
    """BFS 최단경로. 출발지를 포함하고, 도달 불가면 빈 튜플."""
    if origin == destination:
        return (origin,) if origin in NEIGHBORS else ()
    if origin not in NEIGHBORS or destination not in NEIGHBORS:
        return ()

    previous: dict[str, str] = {origin: origin}
    queue = deque([origin])
    while queue:
        current = queue.popleft()
        for neighbor in NEIGHBORS[current]:
            if neighbor in previous:
                continue
            previous[neighbor] = current
            if neighbor == destination:
                path = [destination]
                while path[-1] != origin:
                    path.append(previous[path[-1]])
                return tuple(reversed(path))
            queue.append(neighbor)
    return ()


def hops(origin: str, destination: str) -> int:
    if origin == destination and origin in NEIGHBORS:
        return 0
    path = shortest_path(origin, destination)
    return len(path) - 1 if path else HOPS_UNREACHABLE
