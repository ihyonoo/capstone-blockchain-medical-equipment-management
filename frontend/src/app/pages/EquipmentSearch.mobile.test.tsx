import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  count: 2,
  ts: 0,
  items: [
    {
      tag_id: 'EQ-0001',
      equipment_name: '수액펌프 1호',
      equipment_type: '수액펌프',
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
      equipment_name: '제세동기 1호',
      equipment_type: '제세동기',
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
  tags_online: 2,
  tags_total: 2,
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/equipment']}>
      <Routes>
        <Route path="/equipment" element={<EquipmentSearch />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubLiveFetch() {
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
}

describe('EquipmentSearch on a narrow (mobile) viewport', () => {
  beforeEach(() => {
    stubLiveFetch();
    setViewportWidth(375);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setViewportWidth(1440);
  });

  it('replaces the boxed sidebar with a plain filter bar above the map', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    expect(screen.queryByTestId('equipment-sidebar')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('태그 ID, 장비명, 위치 검색')).toBeInTheDocument();
  });

  it('shows the filtered count on the results button and lists equipment inside a dialog', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    const resultsButton = await screen.findByRole('button', { name: /전체 2건 보기/ });
    expect(screen.queryByText('제세동기 1호')).not.toBeInTheDocument();

    fireEvent.click(resultsButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('제세동기 1호')).toBeInTheDocument();
    expect(within(dialog).getByText('수액펌프 1호')).toBeInTheDocument();
  });

  it('closes the results dialog after picking an equipment item', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    fireEvent.click(await screen.findByRole('button', { name: /전체 2건 보기/ }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByText('제세동기 1호'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('filters the results button count when searching', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    fireEvent.change(screen.getByPlaceholderText('태그 ID, 장비명, 위치 검색'), {
      target: { value: '제세동기' },
    });

    await screen.findByRole('button', { name: /검색 결과 1건 보기/ });
  });

  it('hides the filter fields behind an 상세검색 toggle by default', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    expect(screen.queryByText('장비 유형')).not.toBeInTheDocument();
    expect(screen.queryByTestId('equipment-filter-toggles')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '상세검색' })).toBeInTheDocument();
  });

  it('reveals the filter selects and toggles when 상세검색 is opened, and hides them again on a second click', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));

    expect(screen.getByText('장비 유형')).toBeInTheDocument();
    expect(screen.getByText('층')).toBeInTheDocument();
    expect(screen.getByText('위치 필터')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-filter-toggles')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));

    expect(screen.queryByText('장비 유형')).not.toBeInTheDocument();
    expect(screen.queryByTestId('equipment-filter-toggles')).not.toBeInTheDocument();
  });

  it('keeps the two toggles out of the horizontally scrolling filter row once opened', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    fireEvent.click(screen.getByRole('button', { name: '상세검색' }));

    const toggles = screen.getByTestId('equipment-filter-toggles');
    expect(toggles.closest('.overflow-x-auto')).toBeNull();
  });
});

describe('EquipmentSearch on a wide (desktop) viewport', () => {
  beforeEach(() => {
    stubLiveFetch();
    setViewportWidth(1440);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the boxed sidebar and does not render the mobile results button', async () => {
    renderPage();
    await screen.findByTestId('floor-map-container');

    expect(screen.getByTestId('equipment-sidebar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /건 보기/ })).not.toBeInTheDocument();
  });
});
