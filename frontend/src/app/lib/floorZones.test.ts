import { describe, it, expect } from 'vitest';
import { AMENITY_ZONES, getAmenityZonesForFloor } from './floorZones';

describe('floorZones', () => {
  it('gives every amenity zone a unique id', () => {
    const ids = AMENITY_ZONES.map((zone) => zone.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every coordinate within the 0-100 percent range', () => {
    for (const zone of AMENITY_ZONES) {
      expect(zone.mapX).toBeGreaterThanOrEqual(0);
      expect(zone.mapX).toBeLessThanOrEqual(100);
      expect(zone.mapY).toBeGreaterThanOrEqual(0);
      expect(zone.mapY).toBeLessThanOrEqual(100);
    }
  });

  it('returns only the amenity zones for the requested floor', () => {
    const floor1 = getAmenityZonesForFloor(1);
    expect(floor1.every((zone) => zone.floor === 1)).toBe(true);
    expect(floor1.map((zone) => zone.name)).toContain('카페');

    expect(getAmenityZonesForFloor(4)).toEqual([]);
  });
});
