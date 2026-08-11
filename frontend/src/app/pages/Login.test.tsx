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

describe('Login demo buttons', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          token: 'demo-token',
          expires_at: 9999999999,
          user: { role: 'staff', is_demo: true },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function firstCall() {
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    return { url: String(url), body: JSON.parse((init as RequestInit).body as string) };
  }

  it('requests a staff demo session without credentials', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '의료진으로 둘러보기' }));

    await waitFor(() => {
      const { url, body } = firstCall();
      expect(url).toContain('/auth/demo-login');
      expect(body.role).toBe('staff');
    });
  });

  it('requests an admin demo session', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '관리자로 둘러보기' }));

    await waitFor(() => {
      expect(firstCall().body.role).toBe('admin');
    });
  });

  it('stores the issued demo session', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '의료진으로 둘러보기' }));

    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem('auth_session') ?? '{}');
      expect(stored.token).toBe('demo-token');
    });
  });

  it('shows an error when the demo session cannot be issued', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: '데모 로그인이 비활성화되어 있습니다.' }),
    } as Response);
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '의료진으로 둘러보기' }));

    expect(await screen.findByText('데모 로그인이 비활성화되어 있습니다.')).toBeInTheDocument();
  });
});
