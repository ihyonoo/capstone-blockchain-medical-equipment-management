export type ZonePoint = { x: number; y: number };

// 슈레이스(shoelace) 공식 — 폴리곤 면적(좌표 단위의 제곱, 여기서는 도면 대비 퍼센트제곱).
export function polygonArea(polygon: ZonePoint[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// 면적 가중 중심 — 정점 단순평균보다 실제 방 모양에 더 가깝다.
export function polygonCentroid(polygon: ZonePoint[]): ZonePoint {
  let area6 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    area6 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area6) < 1e-9) {
    // 퇴화(면적 0) 폴리곤 — 정점 단순평균으로 폴백.
    const n = polygon.length;
    return {
      x: polygon.reduce((s, p) => s + p.x, 0) / n,
      y: polygon.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * area6), y: cy / (3 * area6) };
}

// 레이캐스팅(ray casting) — 점에서 오른쪽으로 그은 반직선이 폴리곤 변과 몇 번 교차하는지로 내부 판정.
export function pointInPolygon(point: ZonePoint, polygon: ZonePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;
    const xAtPointY = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < xAtPointY) inside = !inside;
  }
  return inside;
}

// 점 하나가 차지하는 최소 여유 면적(퍼센트제곱) — 14px 점 + 여백을 어림잡은 값.
const MIN_AREA_PER_DOT = 9;
const MAX_VISIBLE_CAP = 8;

export function maxVisibleForPolygon(polygon: ZonePoint[]): number {
  const area = polygonArea(polygon);
  return Math.min(MAX_VISIBLE_CAP, Math.max(1, Math.floor(area / MIN_AREA_PER_DOT)));
}

function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pseudoRandom01(seed: string): number {
  return (hash32(seed) % 100000) / 100000;
}

const MIN_DISTANCE_FROM_TAKEN = 3;
const PLACEMENT_ATTEMPTS = 30;

// tagId 기준 결정적 의사난수로 폴리곤 내부의 빈 자리를 찾는다. 같은 tagId는 항상 같은
// 좌표를 반환한다(재렌더링마다 안 흔들림). 30번 시도해도 못 찾으면 중심점으로 폴백한다.
export function placeInPolygon(polygon: ZonePoint[], tagId: string, takenPoints: ZonePoint[]): ZonePoint {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const rx = pseudoRandom01(`${tagId}:${attempt}:x`);
    const ry = pseudoRandom01(`${tagId}:${attempt}:y`);
    const candidate: ZonePoint = { x: minX + rx * (maxX - minX), y: minY + ry * (maxY - minY) };
    if (!pointInPolygon(candidate, polygon)) continue;
    const farEnough = takenPoints.every(
      (p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) >= MIN_DISTANCE_FROM_TAKEN,
    );
    if (farEnough) return candidate;
  }
  return polygonCentroid(polygon);
}
