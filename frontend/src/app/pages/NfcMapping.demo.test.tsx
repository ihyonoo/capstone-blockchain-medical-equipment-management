import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import NfcMapping from './NfcMapping';

const DEMO_NOTICE = '데모 체험 계정에서는 NFC 매핑을 변경할 수 없습니다.';

function storeAdminSession(isDemo: boolean) {
  sessionStorage.setItem(
    'auth_session',
    JSON.stringify({
      token: 'test-token',
      expires_at: 9999999999,
      user: { user_id: 1, username: 'admin', display_name: '관리자', role: 'admin', is_demo: isDemo },
    }),
  );
}

const MAPPING_PAYLOAD = {
  ok: true,
  items: [
    {
      tag_id: 'EQ-0001',
      equipment_name: '제세동기-001',
      equipment_type: '제세동기',
      nfc_token: 'defib-001',
      asset_status: 'available',
      is_active: true,
      is_real_hardware: true,
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

// 사이드바 검색 필터에도 같은 placeholder가 있어, id가 없는 목록 카드 쪽 입력을 고른다.
function tokenInputOfFirstItem() {
  const inputs = screen.getAllByPlaceholderText('예: defib-001');
  return inputs.find((input) => !input.id) as HTMLElement;
}

async function renderAndWait() {
  renderPage();
  await screen.findByText('제세동기-001');
  // 목록 조회 호출은 이미 끝났으므로, 이후 호출 여부만으로 쓰기 요청을 판별한다.
  return vi.mocked(fetch).mock.calls.length;
}

describe('NfcMapping demo guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => MAPPING_PAYLOAD }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('warns instead of saving a mapping', async () => {
    storeAdminSession(true);
    const callsBefore = await renderAndWait();

    fireEvent.change(tokenInputOfFirstItem(), { target: { value: 'defib-002' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText(DEMO_NOTICE)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
  });

  it('warns instead of removing a mapping', async () => {
    storeAdminSession(true);
    const callsBefore = await renderAndWait();

    fireEvent.click(screen.getByRole('button', { name: '매핑 해제' }));

    expect(await screen.findByText(DEMO_NOTICE)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
  });

  it('still saves a mapping for a normal admin', async () => {
    storeAdminSession(false);
    const callsBefore = await renderAndWait();

    fireEvent.change(tokenInputOfFirstItem(), { target: { value: 'defib-002' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(callsBefore));
    expect(screen.queryByText(DEMO_NOTICE)).not.toBeInTheDocument();
  });
});
