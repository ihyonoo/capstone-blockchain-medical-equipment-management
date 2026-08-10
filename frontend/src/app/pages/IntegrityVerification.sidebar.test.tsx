import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import IntegrityVerification from './IntegrityVerification';

function storeAdminSession() {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'admin', display_name: '관리자', role: 'admin' },
    }),
  );
}

const HISTORY_PAYLOAD = { ok: true, count: 0, items: [] };
const LIVE_PAYLOAD = {
  ok: true,
  readers: [{ reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1 }],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/verification']}>
      <Routes>
        <Route path="/verification" element={<IntegrityVerification />} />
      </Routes>
    </MemoryRouter>,
  );
}

function sidebar() {
  return screen.getByTestId('verification-sidebar');
}

describe('IntegrityVerification search sidebar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (String(url).includes('/rtls/live') ? LIVE_PAYLOAD : HISTORY_PAYLOAD),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the search fields inside the left sidebar instead of above the results', async () => {
    renderPage();

    const panel = within(await screen.findByTestId('verification-sidebar'));
    expect(panel.getByText('검색 조건')).toBeInTheDocument();
    expect(panel.getByPlaceholderText('이름, 사용자 ID')).toBeInTheDocument();
    expect(panel.getByPlaceholderText('장비명 또는 태그 ID')).toBeInTheDocument();
  });

  it('keeps all five search actions inside the sidebar', async () => {
    renderPage();

    const panel = within(await screen.findByTestId('verification-sidebar'));
    ['조회', '기간 초기화', '초기화', '새로고침', 'CSV 다운로드'].forEach((label) => {
      expect(panel.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('leaves the usage history results outside the sidebar', async () => {
    renderPage();

    await screen.findByTestId('verification-sidebar');
    expect(screen.getByText('장비 사용 이력')).toBeInTheDocument();
    expect(within(sidebar()).queryByText('장비 사용 이력')).not.toBeInTheDocument();
  });

  it('still submits the search from the sidebar', async () => {
    renderPage();

    await screen.findByTestId('verification-sidebar');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    fireEvent.change(within(sidebar()).getByPlaceholderText('이름, 사용자 ID'), { target: { value: '박수현' } });
    fireEvent.click(within(sidebar()).getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const requested = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        requested.some((url) => url.includes('/usage/history') && url.includes(encodeURIComponent('박수현'))),
      ).toBe(true);
    });
  });
});
