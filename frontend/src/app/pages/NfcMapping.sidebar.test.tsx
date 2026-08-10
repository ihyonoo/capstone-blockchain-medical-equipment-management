import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import NfcMapping from './NfcMapping';

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

const MAPPING_PAYLOAD = {
  ok: true,
  items: [
    {
      tag_id: 'EQ-0001',
      equipment_name: '수액펌프 1호',
      equipment_type: '수액펌프',
      serial_number: 'BME-2024-00001',
      nfc_token: 'pump-001',
      asset_status: 'available',
      is_active: true,
      reader_id: 'M101',
      location: '1층 병동 A',
      updated_at: null,
      is_stale: false,
    },
    {
      tag_id: 'EQ-0002',
      equipment_name: '제세동기 1호',
      equipment_type: '제세동기',
      serial_number: 'BME-2024-00002',
      nfc_token: null,
      asset_status: 'available',
      is_active: true,
      reader_id: 'M201',
      location: '2층 응급실',
      updated_at: null,
      is_stale: false,
    },
  ],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/nfc-mapping']}>
      <Routes>
        <Route path="/admin/nfc-mapping" element={<NfcMapping />} />
      </Routes>
    </MemoryRouter>,
  );
}

function sidebar() {
  return screen.getByTestId('nfc-mapping-sidebar');
}

describe('NfcMapping search sidebar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MAPPING_PAYLOAD,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the search input and the mapping guide inside the left sidebar', async () => {
    renderPage();

    const panel = within(await screen.findByTestId('nfc-mapping-sidebar'));
    expect(panel.getByPlaceholderText('장비명, 태그 ID, NFC 토큰, 위치 검색')).toBeInTheDocument();
    expect(panel.getByText('매핑 가이드')).toBeInTheDocument();
  });

  it('leaves the equipment list outside the sidebar', async () => {
    renderPage();

    await screen.findByTestId('nfc-mapping-sidebar');
    expect(await screen.findByText('수액펌프 1호')).toBeInTheDocument();
    expect(within(sidebar()).queryByText('수액펌프 1호')).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText('장비별 NFC 토큰')).not.toBeInTheDocument();
  });

  it('still filters the list from the sidebar search input', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    fireEvent.change(within(sidebar()).getByPlaceholderText('장비명, 태그 ID, NFC 토큰, 위치 검색'), {
      target: { value: '제세동기' },
    });

    expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();
  });
});
