import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import IntegrityVerification from './IntegrityVerification';

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

function makeItem(usageId: number, name: string, isRealHardware: boolean) {
  return {
    usage_id: usageId,
    user: { name: '박수현', position: '간호사', department: '응급의학과' },
    returned_by: { name: '박수현', position: '간호사', department: '응급의학과' },
    equipment: { tag_id: `EQ-000${usageId}`, name, is_real_hardware: isRealHardware },
    checkout: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_000_000 },
    return: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_003_600 },
    blockchain: {
      verification_status: 'verified',
      verification_label: '검증 성공',
      db_record: null,
      tx_input_matches_db: true,
      transactions_root_matches: true,
      anchor: {
        block_number: 101,
        transaction_index: 0,
        transactions_root: '0xroot',
        recalculated_transactions_root: '0xroot',
      },
    },
  };
}

const REAL = makeItem(1, '실물 장비', true);
const SIMULATED = makeItem(2, '모의 장비', false);

const LIVE_PAYLOAD = {
  ok: true,
  readers: [{ reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1 }],
};

/** 서버처럼 hide_simulated를 실제로 반영해 돌려주는 mock. */
function historyPayloadFor(url: string) {
  const hideSimulated = new URL(url, 'http://localhost').searchParams.get('hide_simulated') === 'true';
  const items = hideSimulated ? [REAL] : [REAL, SIMULATED];
  return { ok: true, count: items.length, total: items.length, offset: 0, items };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/verification']}>
      <Routes>
        <Route path="/verification" element={<IntegrityVerification />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('IntegrityVerification simulated data toggle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (String(url).includes('/rtls/live') ? LIVE_PAYLOAD : historyPayloadFor(String(url))),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows both real and simulated records by default', async () => {
    expect.hasAssertions();
    renderPage();

    expect(await screen.findByText('실물 장비')).toBeInTheDocument();
    expect(screen.getByText('모의 장비')).toBeInTheDocument();
  });

  it('asks the server to exclude simulated records so paging stays correct', async () => {
    renderPage();

    await screen.findByText('모의 장비');
    fireEvent.click(screen.getByRole('checkbox', { name: '시뮬레이션 데이터 숨기기' }));

    await waitFor(() => expect(screen.queryByText('모의 장비')).not.toBeInTheDocument());
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const lastHistoryRequest = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes('/usage/history'))
      .at(-1);
    expect(lastHistoryRequest).toContain('hide_simulated=true');
    expect(screen.getByText('실물 장비')).toBeInTheDocument();
  });

  it('brings them back when the toggle is off again', async () => {
    renderPage();

    await screen.findByText('모의 장비');
    const toggle = screen.getByRole('checkbox', { name: '시뮬레이션 데이터 숨기기' });
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByText('모의 장비')).not.toBeInTheDocument());

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('모의 장비')).toBeInTheDocument());
  });
});
