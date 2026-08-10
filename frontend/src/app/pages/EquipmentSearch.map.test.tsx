import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// jsdom에는 scrollIntoView가 없어, Radix Select가 옵션 선택 시 이를 호출하면 렌더가 깨진다.
function mockScrollIntoView() {
  Element.prototype.scrollIntoView = vi.fn();
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
  count: 3,
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
    {
      tag_id: 'EQ-0002',
      equipment_name: '수액펌프 2호',
      equipment_type: '수액펌프',
      serial_number: 'BME-2024-00002',
      asset_status: 'checked_out',
      current_holder_user_id: 7,
      current_holder_name: '박수현',
      reader_id: 'M101',
      location: '1층 병동 A',
      rssi: -58,
      updated_at: 0,
      is_stale: false,
      is_online: true,
      last_seen: 0,
    },
    {
      tag_id: 'EQ-0003',
      equipment_name: '제세동기 1호',
      equipment_type: '제세동기',
      serial_number: 'BME-2024-00003',
      asset_status: 'available',
      current_holder_user_id: null,
      current_holder_name: null,
      reader_id: 'M201',
      location: '2층 응급실',
      rssi: -50,
      updated_at: 0,
      is_stale: false,
      is_online: true,
      last_seen: 0,
    },
  ],
  readers: [
    { reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1 },
    { reader_id: 'M201', location: '2층 응급실', is_online: true, last_seen: 0, floor: 2 },
  ],
  readers_online: 2,
  readers_total: 2,
  tags_online: 3,
  tags_total: 3,
};

vi.mock('../lib/floorZoneBounds', () => ({
  ZONE_BOUNDS: {
    M101: [
      { x: 20, y: 40 },
      { x: 30, y: 40 },
      { x: 30, y: 60 },
      { x: 20, y: 60 },
    ],
    M201: [
      { x: 60, y: 40 },
      { x: 70, y: 40 },
      { x: 70, y: 60 },
      { x: 60, y: 60 },
    ],
  },
}));

describe('EquipmentSearch map view', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeStaffSession();
    mockContainerRect();
    mockScrollIntoView();
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

  it('opens on the map view without needing to switch tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('floor-map-container')).toBeInTheDocument();
    expect(await screen.findByTestId('floor-map-equipment-EQ-0001')).toBeInTheDocument();
  });

  it('shows the equipment dot without drawing a zone marker', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('floor-map-equipment-EQ-0001')).toBeInTheDocument();
    // 직원 지도에는 구역 표식을 그리지 않는다 — 평면도에 이미 구역명이 인쇄돼 있다.
    expect(screen.queryByTestId('floor-map-pin-M101')).not.toBeInTheDocument();
  });

  it('colors the equipment dot by its asset status on the map', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-equipment-EQ-0001');
    expect(screen.getByTestId('floor-map-equipment-dot-EQ-0001')).toHaveClass('map-marker-ok');
    expect(screen.getByTestId('floor-map-equipment-dot-EQ-0002')).toHaveClass('map-marker-err');
  });

  it('hides checked-out equipment from the map when the available-only filter is on', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-equipment-EQ-0002');
    fireEvent.click(screen.getByRole('checkbox', { name: '사용 가능 장비만 보기' }));

    expect(screen.queryByTestId('floor-map-equipment-EQ-0002')).not.toBeInTheDocument();
    expect(screen.getByTestId('floor-map-equipment-EQ-0001')).toBeInTheDocument();
  });

  it('hides checked-out equipment from the list too when the available-only filter is on', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('수액펌프 2호');
    fireEvent.click(screen.getByRole('checkbox', { name: '사용 가능 장비만 보기' }));

    expect(screen.queryByText('수액펌프 2호')).not.toBeInTheDocument();
    expect(screen.getAllByText('수액펌프 1호').length).toBeGreaterThan(0);
  });

  it('no longer shows the reader panel heading', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    expect(screen.queryByText('리더 위치 패널')).not.toBeInTheDocument();
  });

  it('highlights the equipment in the list when its map dot is clicked', async () => {
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
      const sidebar = screen.getByTestId('equipment-sidebar');
      expect(within(sidebar).getByText('수액펌프 1호').closest('button')).toHaveClass('border-l-foreground');
    });
  });

  function getZoneGuidePanel() {
    return within(screen.getByTestId('zone-guide-panel'));
  }

  it('lists both reader-backed and amenity zones for the current floor in the zone guide panel', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    const zonePanel = getZoneGuidePanel();
    expect(zonePanel.getByText('1층')).toBeInTheDocument();
    // 리더가 있는 구역(LIVE_PAYLOAD의 M101)과, 리더가 없는 편의시설 구역(floorZones.ts)이 함께 보인다.
    expect(zonePanel.getByRole('button', { name: /1층 병동 A/ })).toBeInTheDocument();
    expect(zonePanel.getByRole('button', { name: /GATE1/ })).toBeInTheDocument();
  });

  it('filters the equipment list and highlights the map pin when a reader-backed zone is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    fireEvent.click(getZoneGuidePanel().getByRole('button', { name: /1층 병동 A/ }));

    const highlight = await screen.findByTestId('floor-map-highlight-M101');
    expect(highlight.style.left).not.toBe('');
    expect(Number.isNaN(parseFloat(highlight.style.left))).toBe(false);
    expect(screen.queryByText('수액펌프 1호')).toBeInTheDocument();
  });

  it('highlights the map without filtering equipment when an amenity zone (no reader) is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    fireEvent.click(getZoneGuidePanel().getByRole('button', { name: /GATE1/ }));

    expect(await screen.findByTestId('floor-map-highlight-1f-gate1')).toBeInTheDocument();
    // 편의시설 구역은 필터링할 장비가 없으므로 장비 목록은 그대로 유지된다.
    expect(screen.getAllByText('수액펌프 1호').length).toBeGreaterThan(0);
  });

  it('collapses the sidebar to a thin handle when the resize handle is double-clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    expect(screen.getByPlaceholderText('태그 ID, 장비명, 위치 검색')).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByTestId('sidebar-resize-handle'));

    expect(screen.queryByPlaceholderText('태그 ID, 장비명, 위치 검색')).not.toBeInTheDocument();
    expect(screen.getByTestId('equipment-sidebar').style.width).toBe('10px');
    expect(screen.getByRole('button', { name: '검색 패널 펼치기' })).toBeInTheDocument();
  });

  it('restores the sidebar when the collapsed handle is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    fireEvent.doubleClick(screen.getByTestId('sidebar-resize-handle'));
    fireEvent.click(screen.getByTestId('sidebar-resize-handle'));

    expect(screen.getByPlaceholderText('태그 ID, 장비명, 위치 검색')).toBeInTheDocument();
  });

  it('resizes the sidebar by dragging its resize handle', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    const sidebar = screen.getByTestId('equipment-sidebar');
    expect(sidebar.style.width).toBe('420px');

    fireEvent.mouseDown(screen.getByTestId('sidebar-resize-handle'), { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);

    expect(sidebar.style.width).toBe('500px');
  });

  it('does not resize the sidebar past the minimum width', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('floor-map-container');
    const sidebar = screen.getByTestId('equipment-sidebar');

    fireEvent.mouseDown(screen.getByTestId('sidebar-resize-handle'), { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: -1000 });
    fireEvent.mouseUp(window);

    expect(sidebar.style.width).toBe('320px');
  });

  it('narrows the location dropdown to the selected floor and filters the list by floor alone', async () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route path="/equipment" element={<EquipmentSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('수액펌프 1호');
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: /층/ }));
    fireEvent.click(await screen.findByRole('option', { name: '2층' }));

    // 위치가 "전체"인 채로도 2층 장비만 남고 1층 장비는 사라진다.
    await waitFor(() => {
      expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();
    });
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();

    // 위치 드롭다운을 열면 1층 구역("1층 병동 A")은 더 이상 선택지에 없다.
    fireEvent.click(screen.getByRole('combobox', { name: /위치/ }));
    expect(screen.queryByRole('option', { name: '1층 병동 A' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2층 응급실' })).toBeInTheDocument();
  });
});
