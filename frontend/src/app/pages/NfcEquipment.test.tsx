import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import NfcEquipment from './NfcEquipment';

function storeStaffSession() {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'u', display_name: '박수현', role: 'staff' },
    }),
  );
}

const TAG_ID = 'fda50693-a4e2-4fb1-afcf-c6eb07647825:1:2';

const TAP_SESSION = 'tap-session-abc';

const NFC_PAYLOAD = {
  ok: true,
  tap_session: TAP_SESSION,
  item: {
    tag_id: TAG_ID,
    equipment_name: '수액펌프',
    equipment_type: '인퓨전펌프',
    nfc_token: 'pump-002',
    asset_status: 'available',
    current_holder_user_id: null,
    current_holder_name: null,
    current_usage_id: null,
    reader_id: 'M502',
    location: '통원수술센터',
    updated_at: null,
    is_stale: false,
  },
};

function renderPage(search = '') {
  render(
    <MemoryRouter initialEntries={[`/nfc/pump-002${search}`]}>
      <Routes>
        <Route path="/nfc/:token" element={<NfcEquipment />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NfcEquipment tag identity', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeStaffSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => NFC_PAYLOAD }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('identifies the equipment by major and minor instead of the raw tag id', async () => {
    renderPage();

    expect(await screen.findByText(/major 1 · minor 2/)).toBeInTheDocument();
  });

  it('never shows the uuid, which tells the staff nothing', async () => {
    renderPage();

    await screen.findByText('수액펌프');
    expect(screen.queryByText(/fda50693/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tag ID/)).not.toBeInTheDocument();
  });
});

const SDM_QUERY = '?uid=04AABBCCDDEE80&ctr=00000A&cmac=0011223344556677';

describe('NfcEquipment SDM tap', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeStaffSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards the sdm parameters it was opened with', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => NFC_PAYLOAD });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(SDM_QUERY);
    await screen.findByText('수액펌프');

    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('uid=04AABBCCDDEE80');
    expect(requestedUrl).toContain('ctr=00000A');
    expect(requestedUrl).toContain('cmac=0011223344556677');
  });

  it('sends the tap session with the checkout so the server can authorise it', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/usage/checkout')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, item: { ...NFC_PAYLOAD.item, asset_status: 'checked_out' } }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => NFC_PAYLOAD });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(SDM_QUERY);
    fireEvent.click(await screen.findByRole('button', { name: '사용 시작' }));

    await screen.findByText(/대여 중으로 변경/);
    const postCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/usage/checkout'));
    expect(JSON.parse(postCall![1].body)).toMatchObject({ nfc_token: 'pump-002', tap_session: TAP_SESSION });
  });

  it('refreshes from the action response instead of re-reading the spent url', async () => {
    // 탭한 URL은 카운터가 소비돼 다시 못 읽는다. 액션 응답의 item으로 갱신해야 한다.
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/usage/checkout')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, item: { ...NFC_PAYLOAD.item, asset_status: 'checked_out' } }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => NFC_PAYLOAD });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(SDM_QUERY);
    fireEvent.click(await screen.findByRole('button', { name: '사용 시작' }));
    await screen.findByText(/대여 중으로 변경/);

    const tapReads = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/nfc/pump-002'));
    expect(tapReads).toHaveLength(1);
    expect(await screen.findByText('대여 중')).toBeInTheDocument();
  });

  it('keeps the login when a tap is rejected', async () => {
    // 403은 "이 탭이 무효"라는 뜻이지 로그인이 끊긴 게 아니다.
    // 3분 지난 탭 때문에 세션을 버리면 사용자는 영문도 모른 채 다시 로그인해야 한다.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ detail: '유효하지 않은 NFC 태그 인증입니다.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(SDM_QUERY);

    expect(await screen.findByText(/유효하지 않은 NFC 태그 인증/)).toBeInTheDocument();
    expect(sessionStorage.getItem('auth_session')).not.toBeNull();
  });

  it('still logs out when the session itself expired', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: '인증이 필요합니다.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(SDM_QUERY);

    await vi.waitFor(() => expect(sessionStorage.getItem('auth_session')).toBeNull());
  });
});
