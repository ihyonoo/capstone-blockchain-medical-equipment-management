import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AuthCallback from './AuthCallback';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

const SESSION = {
  ok: true,
  token: 't',
  expires_at: 9999999999,
  user: { user_id: 1, username: 'u', display_name: '박수현', role: 'staff' },
};

function renderWithHash(hash: string) {
  window.location.hash = hash;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => SESSION }));
  render(
    <MemoryRouter>
      <AuthCallback />
    </MemoryRouter>,
  );
}

describe('AuthCallback redirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigate.mockClear();
  });

  afterEach(() => {
    window.location.hash = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns to where the user was headed before logging in', async () => {
    // 태그를 태깅해 /nfc/...로 들어왔다가 구글 로그인을 한 경우. 홈이 아니라 그 화면이어야 한다.
    renderWithHash('#code=abc&redirect=%2Fnfc%2Fpump-001%3Fuid%3D04AABB');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/nfc/pump-001?uid=04AABB', { replace: true }));
  });

  it('falls back to the role home when there is no redirect', async () => {
    renderWithHash('#code=abc');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/equipment', { replace: true }));
  });

  it('refuses a redirect that would leave the site', async () => {
    renderWithHash('#code=abc&redirect=https%3A%2F%2Fevil.example.com');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/equipment', { replace: true }));
  });
});
