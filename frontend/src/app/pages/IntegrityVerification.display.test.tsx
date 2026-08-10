import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const TAG_ID = 'a83f2c9e-6b1d-4e2a-9c77-51f8d20b6a44:1:0007';

const HISTORY_PAYLOAD = {
  ok: true,
  count: 1,
  items: [
    {
      usage_id: 42,
      user: { name: '박수현', position: '간호사', department: '응급의학과' },
      returned_by: { name: '박수현', position: '간호사', department: '응급의학과' },
      equipment: { tag_id: TAG_ID, name: '검체이송 카트 7호' },
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
    },
  ],
};

const LIVE_PAYLOAD = {
  ok: true,
  readers: [{ reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1 }],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/verification']}>
      <Routes>
        <Route path="/verification" element={<IntegrityVerification />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('IntegrityVerification result display', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeAdminSession();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubResolvedFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (String(url).includes('/rtls/live') ? LIVE_PAYLOAD : HISTORY_PAYLOAD),
        }),
      ),
    );
  }

  it('identifies the tag by its major and minor rather than the shared uuid', async () => {
    stubResolvedFetch();
    renderPage();

    expect(await screen.findByText(/major 1 · minor 0007/)).toBeInTheDocument();
    expect(screen.queryByText(/a83f2c9e/)).not.toBeInTheDocument();
  });

  it('shows placeholder cards while the history is loading', async () => {
    // 이력 조회는 응답을 미뤄 로딩 상태를 유지시킨다.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          String(url).includes('/rtls/live')
            ? Promise.resolve({ ok: true, status: 200, json: async () => LIVE_PAYLOAD })
            : new Promise(() => {}),
        ),
    );
    renderPage();

    const skeleton = await screen.findByTestId('history-skeleton');
    expect(within(skeleton).getAllByTestId('history-skeleton-card').length).toBeGreaterThan(1);
    expect(screen.queryByText('조회 중입니다.')).not.toBeInTheDocument();
  });

  it('explains that the wait comes from checking each record against the chain', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          String(url).includes('/rtls/live')
            ? Promise.resolve({ ok: true, status: 200, json: async () => LIVE_PAYLOAD })
            : new Promise(() => {}),
        ),
    );
    renderPage();

    const notice = await screen.findByTestId('history-loading-notice');
    expect(within(notice).getByText('블록체인에서 사용 이력을 검증하는 중입니다')).toBeInTheDocument();
    expect(within(notice).getByText(/온체인/)).toBeInTheDocument();
  });

  it('replaces the placeholder cards with the results once loading finishes', async () => {
    stubResolvedFetch();
    renderPage();

    await screen.findByText('검체이송 카트 7호');
    await waitFor(() => expect(screen.queryByTestId('history-skeleton')).not.toBeInTheDocument());
  });

  it('no longer advertises the 200-record cap in the search sidebar', async () => {
    stubResolvedFetch();
    renderPage();

    await screen.findByTestId('verification-sidebar');
    expect(screen.queryByText('최대 200건')).not.toBeInTheDocument();
  });
});
