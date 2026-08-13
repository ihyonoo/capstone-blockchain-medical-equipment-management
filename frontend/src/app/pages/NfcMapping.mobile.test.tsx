import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      tag_id: 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0001',
      equipment_name: '수액펌프 1호',
      equipment_type: '수액펌프',
      nfc_token: 'pump-001',
      asset_status: 'available',
      is_active: true,
      reader_id: 'M101',
      location: '1층 병동 A',
      updated_at: null,
      is_stale: false,
    },
  ],
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/nfc-mapping']}>
      <Routes>
        <Route path="/admin/nfc-mapping" element={<NfcMapping />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stub() {
  sessionStorage.clear();
  storeAdminSession();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MAPPING_PAYLOAD,
    }),
  );
}

describe('NfcMapping on a narrow (mobile) viewport', () => {
  beforeEach(() => {
    stub();
    setViewportWidth(375);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setViewportWidth(1440);
  });

  it('replaces the boxed sidebar with an 상세검색 toggle that starts closed', async () => {
    renderPage();
    await screen.findByText('수액펌프 1호');

    expect(screen.queryByTestId('nfc-mapping-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('장비명')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '상세검색' })).toBeInTheDocument();
  });

  it('reveals the search fields when 상세검색 is opened, and hides them again on a second click', async () => {
    renderPage();
    await screen.findByText('수액펌프 1호');

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));

    expect(screen.getByLabelText('장비명')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));

    expect(screen.queryByLabelText('장비명')).not.toBeInTheDocument();
  });

  it('still shows the equipment list without opening 상세검색', async () => {
    renderPage();

    expect(await screen.findByText('수액펌프 1호')).toBeInTheDocument();
  });
});

describe('NfcMapping on a wide (desktop) viewport', () => {
  beforeEach(() => {
    stub();
    setViewportWidth(1440);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the boxed sidebar and does not render the 상세검색 toggle', async () => {
    renderPage();
    await screen.findByText('수액펌프 1호');

    expect(screen.getByTestId('nfc-mapping-sidebar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '상세검색' })).not.toBeInTheDocument();
  });
});
