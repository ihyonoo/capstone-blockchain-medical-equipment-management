import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
      tag_id: 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0007',
      equipment_name: '검체이송 카트 7호',
      equipment_type: '카트',
      serial_number: 'BME-2024-00007',
      nfc_token: null,
      asset_status: 'available',
      is_active: true,
      reader_id: 'M101',
      location: '1층 병동 A',
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

describe('NfcMapping guide dialog', () => {
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

  it('keeps the guide behind a button instead of spending sidebar space on it', async () => {
    renderPage();

    const sidebar = await screen.findByTestId('nfc-mapping-sidebar');
    expect(within(sidebar).getByRole('button', { name: '매핑 가이드' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the guide with the steps needed to write a tag', async () => {
    renderPage();

    const sidebar = await screen.findByTestId('nfc-mapping-sidebar');
    fireEvent.click(within(sidebar).getByRole('button', { name: '매핑 가이드' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('NFC 매핑 가이드')).toBeInTheDocument();
    // 부모 요소도 같은 텍스트를 품으므로 개수만 확인한다.
    expect(within(dialog).getAllByText(/NTAG215/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/nfc\/<token>/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/같은 토큰은 한 장비에만/).length).toBeGreaterThan(0);
  });

  it('closes the guide again', async () => {
    renderPage();

    const sidebar = await screen.findByTestId('nfc-mapping-sidebar');
    fireEvent.click(within(sidebar).getByRole('button', { name: '매핑 가이드' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
