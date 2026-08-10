import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const NFC_PAYLOAD = {
  ok: true,
  item: {
    tag_id: TAG_ID,
    equipment_name: '수액펌프',
    equipment_type: '인퓨전펌프',
    serial_number: null,
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/nfc/pump-002']}>
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
