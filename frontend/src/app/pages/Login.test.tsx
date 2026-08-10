import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Login from './Login';

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  );
}

function roleOption(label: string) {
  return screen.getByRole('radio', { name: label });
}

describe('Login role picker', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, token: 't', expires_at: 9999999999, user: { role: 'admin' } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers both roles as visible choices instead of a dropdown', () => {
    renderLogin();
    expect(roleOption('의료진')).toBeInTheDocument();
    expect(roleOption('관리자')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('starts with 의료진 selected', () => {
    renderLogin();
    expect(roleOption('의료진')).toBeChecked();
    expect(roleOption('관리자')).not.toBeChecked();
  });

  it('sends the picked role with the login request', async () => {
    renderLogin();
    fireEvent.click(roleOption('관리자'));
    expect(roleOption('관리자')).toBeChecked();
    expect(roleOption('의료진')).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
      expect(body.role).toBe('admin');
    });
  });
});
