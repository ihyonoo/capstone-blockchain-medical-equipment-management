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

const UUID = 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44';

/** major/minor와 등록 시각이 서로 다른 순서를 만들도록 일부러 어긋나게 짠 표본. */
function makeItem(name: string, major: number, minor: string, createdAt: number) {
  return {
    tag_id: `${UUID}:${major}:${minor}`,
    equipment_name: name,
    equipment_type: '수액펌프',
    nfc_token: null,
    asset_status: 'available',
    is_active: true,
    is_real_hardware: true,
    reader_id: 'M101',
    location: '1층 병동 A',
    updated_at: null,
    created_at: createdAt,
    is_stale: false,
  };
}

const MAPPING_PAYLOAD = {
  ok: true,
  items: [
    makeItem('가', 1, '002', 300),
    makeItem('나', 2, '001', 100),
    makeItem('다', 1, '001', 400),
    makeItem('라', 2, '003', 200),
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

/** 화면에 렌더된 장비명을 위에서부터 순서대로 읽는다. */
function visibleOrder() {
  return screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
}

async function chooseSort(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('NfcMapping sorting', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => MAPPING_PAYLOAD })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('orders by major ascending when asked', async () => {
    renderPage();
    await screen.findByText('가');

    await chooseSort('major 정렬', '오름차순');

    // major 1: 가(002), 다(001) / major 2: 나(001), 라(003)
    await waitFor(() => expect(visibleOrder().slice(0, 2).sort()).toEqual(['가', '다']));
    expect(visibleOrder().slice(2).sort()).toEqual(['나', '라']);
  });

  it('breaks major ties with minor, each keeping its own direction', async () => {
    renderPage();
    await screen.findByText('가');

    await chooseSort('major 정렬', '내림차순');
    await chooseSort('minor 정렬', '오름차순');

    // major 내림차순이 먼저, 같은 major 안에서는 minor 오름차순
    await waitFor(() => expect(visibleOrder()).toEqual(['나', '라', '다', '가']));
  });

  it('sorts by minor alone when major sort is off', async () => {
    renderPage();
    await screen.findByText('가');

    await chooseSort('minor 정렬', '내림차순');

    await waitFor(() => expect(visibleOrder()).toEqual(['라', '가', '나', '다']));
  });

  it('drops the major and minor keys when the newest-first mode is picked', async () => {
    renderPage();
    await screen.findByText('가');

    await chooseSort('major 정렬', '오름차순');
    await chooseSort('등록 시각 정렬', '최신순');

    // created_at 내림차순: 다(400), 가(300), 라(200), 나(100)
    await waitFor(() => expect(visibleOrder()).toEqual(['다', '가', '라', '나']));
  });

  it('shows each tag registration time so the newest-first order is checkable', async () => {
    renderPage();

    expect(await screen.findAllByText(/등록:/)).toHaveLength(4);
  });
});
