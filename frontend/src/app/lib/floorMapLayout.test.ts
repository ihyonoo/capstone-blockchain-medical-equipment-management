import { describe, it, expect } from 'vitest';
import { equipmentRowOffsets, clampPct } from './floorMapLayout';

describe('equipmentRowOffsets', () => {
  it('places a single item exactly on the reader position (no offset)', () => {
    expect(equipmentRowOffsets(1)).toEqual([0]);
  });

  it('spaces multiple items evenly in a row centered on the reader position', () => {
    const offsets = equipmentRowOffsets(3, 7);
    expect(offsets).toEqual([-7, 0, 7]);
  });

  it('never produces two equal offsets, so markers cannot land on top of each other', () => {
    const offsets = equipmentRowOffsets(4, 7);
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('returns an empty array for zero items', () => {
    expect(equipmentRowOffsets(0)).toEqual([]);
  });
});

describe('clampPct', () => {
  it('clamps values below 0 up to 0', () => {
    expect(clampPct(-5)).toBe(0);
  });

  it('clamps values above 100 down to 100', () => {
    expect(clampPct(120)).toBe(100);
  });

  it('leaves in-range values untouched', () => {
    expect(clampPct(42.5)).toBe(42.5);
  });
});
