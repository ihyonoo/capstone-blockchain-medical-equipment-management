import { describe, it, expect } from 'vitest';
import {
  polygonArea,
  polygonCentroid,
  pointInPolygon,
  maxVisibleForPolygon,
  placeInPolygon,
  distanceToPolygonEdge,
} from './floorMapLayout';

const SQUARE = [
  { x: 10, y: 10 },
  { x: 20, y: 10 },
  { x: 20, y: 20 },
  { x: 10, y: 20 },
];

describe('polygonArea', () => {
  it('computes the area of a simple square', () => {
    expect(polygonArea(SQUARE)).toBe(100);
  });
});

describe('polygonCentroid', () => {
  it('finds the center of a square', () => {
    expect(polygonCentroid(SQUARE)).toEqual({ x: 15, y: 15 });
  });
});

describe('pointInPolygon', () => {
  it('reports a point inside the square as inside', () => {
    expect(pointInPolygon({ x: 15, y: 15 }, SQUARE)).toBe(true);
  });

  it('reports a point outside the square as outside', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, SQUARE)).toBe(false);
  });
});

describe('maxVisibleForPolygon', () => {
  it('allows more dots for a bigger room', () => {
    // 공유 SQUARE(10x10, 면적 100)는 MIN_AREA_PER_DOT=9 기준 8개(상한)에 이미 도달해버려서
    // bigRoom과 비교해도 "더 크다"는 차이가 안 드러난다 — 상한 아래인 작은 방을 따로 쓴다.
    const smallRoom = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const bigRoom = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 0, y: 30 },
    ];
    expect(maxVisibleForPolygon(bigRoom)).toBeGreaterThan(maxVisibleForPolygon(smallRoom));
  });

  it('never goes below 1 even for a tiny room', () => {
    const tinyRoom = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(maxVisibleForPolygon(tinyRoom)).toBe(1);
  });

  it('never exceeds the cap of 8 even for a huge room', () => {
    const hugeRoom = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(maxVisibleForPolygon(hugeRoom)).toBe(8);
  });
});

describe('distanceToPolygonEdge', () => {
  it('measures the distance to the nearest edge, not to the nearest vertex', () => {
    // (12, 15)는 왼쪽 변(x=10)에서 2, 가장 가까운 정점(10,10)/(10,20)에서는 약 5.4.
    expect(distanceToPolygonEdge({ x: 12, y: 15 }, SQUARE)).toBeCloseTo(2);
  });

  it('reports zero for a point sitting on the border', () => {
    expect(distanceToPolygonEdge({ x: 10, y: 15 }, SQUARE)).toBeCloseTo(0);
  });
});

describe('placeInPolygon', () => {
  it('always places the point inside the polygon', () => {
    const point = placeInPolygon(SQUARE, 'EQ-0001', []);
    expect(pointInPolygon(point, SQUARE)).toBe(true);
  });

  it('is deterministic for the same tagId', () => {
    const a = placeInPolygon(SQUARE, 'EQ-0001', []);
    const b = placeInPolygon(SQUARE, 'EQ-0001', []);
    expect(a).toEqual(b);
  });

  it('places different tagIds at different points', () => {
    const a = placeInPolygon(SQUARE, 'EQ-0001', []);
    const b = placeInPolygon(SQUARE, 'EQ-0002', []);
    expect(a).not.toEqual(b);
  });

  it('keeps the point away from the zone border when the zone has room to spare', () => {
    const roomyPolygon = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const point = placeInPolygon(roomyPolygon, 'EQ-0001', []);
    expect(distanceToPolygonEdge(point, roomyPolygon)).toBeGreaterThanOrEqual(2);
  });

  it('still spreads points out in a zone too narrow for the full border margin', () => {
    // 두께 3짜리 복도 — 여유 2를 그대로 요구하면 배치가 전부 실패해 중심점으로 뭉친다.
    const narrowCorridor = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 3 },
      { x: 0, y: 3 },
    ];
    const first = placeInPolygon(narrowCorridor, 'EQ-0001', []);
    const second = placeInPolygon(narrowCorridor, 'EQ-0002', [first]);
    expect(pointInPolygon(first, narrowCorridor)).toBe(true);
    expect(first).not.toEqual(second);
  });

  it('keeps new points at least 3 percent away from already-taken points when there is room', () => {
    const roomyPolygon = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const first = placeInPolygon(roomyPolygon, 'EQ-0001', []);
    const second = placeInPolygon(roomyPolygon, 'EQ-0002', [first]);
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    expect(distance).toBeGreaterThanOrEqual(3);
  });
});
