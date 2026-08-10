import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import DeviceStatus from './DeviceStatus';

function storeAdminSession() {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'u', display_name: 'u', role: 'admin' },
    }),
  );
}

const REAL_TAG_ID = 'fda50693-a4e2-4fb1-afcf-c6eb07647825:1:2';
const SIM_TAG_ID = 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0010';

const LIVE_PAYLOAD = {
  ok: true,
  count: 2,
  ts: 0,
  items: [
    {
      tag_id: REAL_TAG_ID,
      equipment_name: '수액펌프',
      reader_id: 'M502',
      location: '통원수술센터',
      is_online: true,
      last_seen: 0,
      is_real_hardware: true,
    },
    {
      tag_id: SIM_TAG_ID,
      equipment_name: '수액펌프 10호',
      reader_id: 'M205',
      location: '주사센터',
      is_online: true,
      last_seen: 0,
      is_real_hardware: false,
    },
  ],
  readers: [{ reader_id: 'M502', location: '통원수술센터', is_online: true, last_seen: 0, is_real_hardware: true }],
  readers_online: 1,
  readers_total: 1,
  tags_online: 2,
  tags_total: 2,
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/devices']}>
      <Routes>
        <Route path="/admin/devices" element={<DeviceStatus />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DeviceStatus tag identity', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => LIVE_PAYLOAD }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('identifies a tag by its major and minor, not by the shared uuid', async () => {
    renderPage();

    expect(await screen.findByText(/major 1 · minor 2/)).toBeInTheDocument();
    expect(screen.getByText(/major 2 · minor 0010/)).toBeInTheDocument();
    expect(screen.queryByText(/fda50693/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a83f2c9e/)).not.toBeInTheDocument();
  });

  it('keeps the full tag id available on hover for copying', async () => {
    renderPage();

    const line = await screen.findByText(/major 1 · minor 2/);
    expect(line).toHaveAttribute('title', REAL_TAG_ID);
  });
});
