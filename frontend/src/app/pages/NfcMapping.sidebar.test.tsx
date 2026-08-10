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
      tag_id: 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0001',
      equipment_name: '수액펌프 1호',
      equipment_type: '수액펌프',
      serial_number: 'BME-2024-00001',
      nfc_token: 'pump-001',
      asset_status: 'available',
      is_active: true,
      reader_id: 'M101',
      location: '1층 병동 A',
      updated_at: null,
      is_stale: false,
    },
    {
      tag_id: 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:2:0002',
      equipment_name: '제세동기 1호',
      equipment_type: '제세동기',
      serial_number: 'BME-2024-00002',
      nfc_token: null,
      asset_status: 'available',
      is_active: true,
      reader_id: 'M201',
      location: '2층 응급실',
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

function sidebar() {
  return screen.getByTestId('nfc-mapping-sidebar');
}

async function pickOption(comboboxName: string, optionName: string) {
  fireEvent.click(within(sidebar()).getByRole('combobox', { name: comboboxName }));
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

function search() {
  fireEvent.click(within(sidebar()).getByRole('button', { name: '검색' }));
}

describe('NfcMapping search sidebar', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('splits the search into a field per attribute instead of one catch-all box', async () => {
    renderPage();

    const panel = within(await screen.findByTestId('nfc-mapping-sidebar'));
    expect(panel.getByLabelText('장비명')).toBeInTheDocument();
    expect(panel.getByLabelText('태그')).toBeInTheDocument();
    expect(panel.getByLabelText('NFC 토큰')).toBeInTheDocument();
    expect(panel.getByRole('combobox', { name: '장비 유형' })).toBeInTheDocument();
    expect(panel.getByRole('combobox', { name: '매핑 상태' })).toBeInTheDocument();
    // 위치는 매핑 작업의 판단 근거가 아니라 빼둔다 — 목록 카드에 현재 위치가 이미 적혀 있다.
    expect(panel.queryByRole('combobox', { name: '위치' })).not.toBeInTheDocument();
  });

  it('keeps the guide button below the search fields', async () => {
    renderPage();

    const panel = within(await screen.findByTestId('nfc-mapping-sidebar'));
    const lastField = panel.getByRole('combobox', { name: '매핑 상태' });
    const guideButton = panel.getByRole('button', { name: '매핑 가이드' });

    expect(lastField.compareDocumentPosition(guideButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves the equipment list outside the sidebar', async () => {
    renderPage();

    await screen.findByTestId('nfc-mapping-sidebar');
    expect(await screen.findByText('수액펌프 1호')).toBeInTheDocument();
    expect(within(sidebar()).queryByText('수액펌프 1호')).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText('장비별 NFC 토큰')).not.toBeInTheDocument();
  });

  it('waits for the search button before narrowing the list', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    fireEvent.change(within(sidebar()).getByLabelText('장비명'), { target: { value: '제세동기' } });

    // 타이핑만으로는 목록이 흔들리지 않는다.
    expect(screen.getByText('수액펌프 1호')).toBeInTheDocument();

    search();
    expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();
  });

  it('filters by the tag minor the admin can read off the list', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    fireEvent.change(within(sidebar()).getByLabelText('태그'), { target: { value: '0002' } });
    search();

    expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();
  });

  it('filters by nfc token', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    fireEvent.change(within(sidebar()).getByLabelText('NFC 토큰'), { target: { value: 'pump' } });
    search();

    expect(screen.getByText('수액펌프 1호')).toBeInTheDocument();
    expect(screen.queryByText('제세동기 1호')).not.toBeInTheDocument();
  });

  it('searches when enter is pressed inside a field', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    const field = within(sidebar()).getByLabelText('장비명');
    fireEvent.change(field, { target: { value: '제세동기' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);

    expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();
  });

  it('narrows to the equipment still missing a token', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    await pickOption('매핑 상태', '미매핑');
    search();

    await waitFor(() => expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument());
    expect(screen.getByText('제세동기 1호')).toBeInTheDocument();
  });

  it('clears every field and shows the whole list again', async () => {
    renderPage();

    await screen.findByText('수액펌프 1호');
    fireEvent.change(within(sidebar()).getByLabelText('장비명'), { target: { value: '제세동기' } });
    search();
    expect(screen.queryByText('수액펌프 1호')).not.toBeInTheDocument();

    fireEvent.click(within(sidebar()).getByRole('button', { name: '초기화' }));

    await waitFor(() => expect(screen.getByText('수액펌프 1호')).toBeInTheDocument());
    expect(within(sidebar()).getByLabelText('장비명')).toHaveValue('');
  });
});
