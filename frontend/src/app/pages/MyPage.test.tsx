import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import MyPage from './MyPage';

function storeSession(role: 'staff' | 'admin') {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'u', display_name: 'u', role },
    }),
  );
}

function renderMyPage() {
  render(
    <MemoryRouter initialEntries={['/me']}>
      <MyPage />
    </MemoryRouter>,
  );
}

describe('MyPage header', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, user: { user_id: 1, username: 'u', display_name: 'u', role: 'staff' } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prints no page title above the content for staff', () => {
    storeSession('staff');
    renderMyPage();
    // 상단 네비에 이미 '마이페이지' 탭이 있어 같은 제목을 본문 위에 또 찍지 않는다.
    expect(document.querySelector('.page-header__title')).toBeNull();
    expect(screen.getByRole('button', { name: '마이페이지' })).toBeInTheDocument();
  });

  it('prints no page title above the content for admins either', () => {
    storeSession('admin');
    renderMyPage();
    expect(document.querySelector('.page-header__title')).toBeNull();
  });
});
