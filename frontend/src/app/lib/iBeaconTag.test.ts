import { describe, it, expect } from 'vitest';
import { formatIBeaconTag, parseIBeaconTag } from './iBeaconTag';

describe('parseIBeaconTag', () => {
  it('splits an iBeacon tag id into its major and minor', () => {
    expect(parseIBeaconTag('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0007')).toEqual({ major: '1', minor: '0007' });
  });

  it('is null for an id that is not in uuid:major:minor form', () => {
    expect(parseIBeaconTag('EQ-0001')).toBeNull();
    expect(parseIBeaconTag('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1')).toBeNull();
  });

  it('is null when major or minor is blank', () => {
    expect(parseIBeaconTag('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44::0007')).toBeNull();
  });
});

describe('formatIBeaconTag', () => {
  it('labels the major and minor instead of the uuid the admin cannot act on', () => {
    expect(formatIBeaconTag('a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0007')).toBe('major 1 · minor 0007');
  });

  it('falls back to the raw id when it is not an iBeacon tag', () => {
    expect(formatIBeaconTag('EQ-0001')).toBe('EQ-0001');
  });

  it('has nothing to show for an empty id', () => {
    expect(formatIBeaconTag('')).toBe('-');
  });
});
