import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import EquipmentSearch from './EquipmentSearch';

function storeStaffSession() {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'u', display_name: 'u', role: 'staff' },
    }),
  );
}

function mockContainerRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 1000,
    width: 1000,
    height: 1000,
    toJSON: () => {},
  });
}

const LIVE_PAYLOAD = {
  ok: true,
  count: 1,
  ts: 0,
  items: [
    {
      tag_id: 'EQ-0001',
      equipment_name: '수액펌프 1호',
      equipment_type: '수액펌프',
      serial_number: 'BME-2024-00001',
      asset_status: 'available',
      current_holder_user_id: null,
      current_holder_name: null,
      reader_id: 'M101',
      location: '1층 병동 A',
      rssi: -55,
      updated_at: 0,
      is_stale: false,
      is_online: true,
      last_seen: 0,
    },
  ],
  readers: [
    { reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1, map_x: 25, map_y: 50 },
  ],
  readers_online: 1,
  readers_total: 1,
  tags_online: 1,
  tags_total: 1,
};

describe('EquipmentSearch map view', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeStaffSession();
    mockContainerRect();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => LIVE_PAYLOAD,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('switches to the map tab and shows the equipment dot on the matching floor pin', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('수액펌프 1호');

    fireEvent.click(screen.getByRole('button', { name: '지도' }));

    expect(await screen.findByTestId('floor-map-pin-M101')).toBeInTheDocument();
    expect(screen.getByTestId('floor-map-equipment-EQ-0001')).toBeInTheDocument();
  });

  it('selects the equipment detail panel when its map dot is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('수액펌프 1호');
    fireEvent.click(screen.getByRole('button', { name: '지도' }));
    const dot = await screen.findByTestId('floor-map-equipment-EQ-0001');
    fireEvent.click(dot);

    await waitFor(() => {
      expect(screen.getByText('선택 장비 상세').closest('div.surface-panel')).toHaveTextContent('수액펌프 1호');
    });
  });
});
