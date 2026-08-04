import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { useAuthGuard, useLogout } from './useAuthGuard';
import { LOGIN_PATH } from './auth';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function GuardedScreen({ redirect }: { redirect: string | null }) {
  const isAuthorized = useAuthGuard(() => redirect);
  return <div data-testid="authorized">{String(isAuthorized)}</div>;
}

function LogoutScreen() {
  const logout = useLogout();
  return (
    <button type="button" onClick={logout}>
      로그아웃
    </button>
  );
}

describe('useAuthGuard', () => {
  it('navigates to the resolver-returned path when unauthorized', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<GuardedScreen redirect={LOGIN_PATH} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent(LOGIN_PATH);
  });

  it('stays put and reports authorized when the resolver returns null', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<GuardedScreen redirect={null} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('authorized')).toHaveTextContent('true');
  });
});

describe('useLogout', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('clears the session and navigates to LOGIN_PATH', () => {
    sessionStorage.setItem(
      'auth_session',
      JSON.stringify({ token: 't', expires_at: 9999999999, user: { user_id: 1 } }),
    );

    render(
      <MemoryRouter initialEntries={['/me']}>
        <Routes>
          <Route path="/me" element={<LogoutScreen />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      screen.getByRole('button', { name: '로그아웃' }).click();
    });

    expect(sessionStorage.getItem('auth_session')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(LOGIN_PATH);
  });
});
