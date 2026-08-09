import { describe, it, expect } from 'vitest';
import { clampSidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './sidebarResize';

describe('clampSidebarWidth', () => {
  it('keeps a width within range unchanged', () => {
    expect(clampSidebarWidth(450)).toBe(450);
  });

  it('clamps below the minimum width up to the minimum', () => {
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it('clamps above the maximum width down to the maximum', () => {
    expect(clampSidebarWidth(900)).toBe(SIDEBAR_MAX_WIDTH);
  });
});
