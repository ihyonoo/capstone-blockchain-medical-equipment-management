import { describe, it, expect } from 'vitest';
import { ZONE_BOUNDS } from './floorZoneBounds';

describe('floorZoneBounds', () => {
  it('has exactly 44 traced zones', () => {
    expect(Object.keys(ZONE_BOUNDS).length).toBe(44);
  });

  it('gives every zone at least 3 points, all within 0-100 percent', () => {
    for (const [readerId, polygon] of Object.entries(ZONE_BOUNDS)) {
      expect(polygon.length, readerId).toBeGreaterThanOrEqual(3);
      for (const point of polygon) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not include the four rooms that no longer have a reader', () => {
    expect(ZONE_BOUNDS.M103).toBeUndefined();
    expect(ZONE_BOUNDS.M104).toBeUndefined();
    expect(ZONE_BOUNDS.M105).toBeUndefined();
    expect(ZONE_BOUNDS.M509).toBeUndefined();
  });

  it('keys the two zones the real readers cover by those readers', () => {
    // M501 중앙수술센터, M502 통원수술센터. 통원수술센터를 맡던 모의 리더 M508은 사라졌다.
    expect(ZONE_BOUNDS.M501).toBeDefined();
    expect(ZONE_BOUNDS.M502).toBeDefined();
    expect(ZONE_BOUNDS.M508).toBeUndefined();
  });

  it('keeps the imaging centre zone under the simulated reader that took it over', () => {
    expect(ZONE_BOUNDS.M106).toBeDefined();
  });
});
