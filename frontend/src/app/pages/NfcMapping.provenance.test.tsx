import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function makeItem(tagId: string, name: string, isRealHardware: boolean) {
  return {
    tag_id: tagId,
    equipment_name: name,
    equipment_type: '수액펌프',
    serial_number: null,
    nfc_token: null,
    asset_status: 'available',
    is_active: true,
    is_real_hardware: isRealHardware,
    reader_id: 'M101',
    location: '1층 병동 A',
    updated_at: null,
    is_stale: false,
  };
}

const MAPPING_PAYLOAD = {
  ok: true,
  items: [makeItem('EQ-REAL-0001', '실물 장비', true), makeItem('EQ-SIM-0001', '모의 장비', false)],
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

describe('NfcMapping simulated data toggle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => MAPPING_PAYLOAD }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows both real and simulated equipment by default', async () => {
    renderPage();

    expect(await screen.findByText('실물 장비')).toBeInTheDocument();
    expect(screen.getByText('모의 장비')).toBeInTheDocument();
  });

  it('drops the simulated equipment when the toggle is on', async () => {
    renderPage();

    await screen.findByText('모의 장비');
    fireEvent.click(screen.getByRole('checkbox', { name: '시뮬레이션 데이터 숨기기' }));

    await waitFor(() => expect(screen.queryByText('모의 장비')).not.toBeInTheDocument());
    expect(screen.getByText('실물 장비')).toBeInTheDocument();
  });
});
