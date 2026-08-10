import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import SignUp from './SignUp';

function roleOption(label: string) {
  return screen.getByRole('radio', { name: label });
}

describe('SignUp role picker', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignUp />
      </MemoryRouter>,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('centers each role label inside its own box, like the login screen does', () => {
    for (const label of ['의료진', '관리자']) {
      expect(roleOption(label)).toHaveClass('justify-center');
    }
  });

  it('keeps the label as the only content of the box', () => {
    expect(roleOption('의료진').textContent).toBe('의료진');
    expect(roleOption('관리자').textContent).toBe('관리자');
  });
});
