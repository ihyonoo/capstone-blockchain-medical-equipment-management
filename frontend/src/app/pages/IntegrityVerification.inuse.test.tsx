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

function makeInUseItem() {
  return {
    usage_id: 1,
    user: { name: '박수현', position: '간호사', department: '응급의학과' },
    returned_by: { name: null, position: null, department: null },
    equipment: { tag_id: 'EQ-0001', name: '수액펌프-001', is_real_hardware: true },
    checkout: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_000_000 },
    return: { reader_id: null, location: null, at: null },
    blockchain: {
      verification_status: 'not_eligible',
      verification_label: '사용 중',
      db_record: null,
      tx_input_matches_db: null,
      transactions_root_matches: null,
      anchor: null,
    },
  };
}

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

function historyRequests() {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.includes('/usage/history'));
}

describe('IntegrityVerification in-use records', () => {
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
          json: async () =>
            String(url).includes('/rtls/live')
              ? LIVE_PAYLOAD
              : { ok: true, count: 1, total: 1, offset: 0, items: [makeInUseItem()] },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks the server to leave out records that are still checked out', async () => {
    renderPage();

    await waitFor(() => expect(historyRequests().length).toBeGreaterThan(0));
    expect(historyRequests()[0]).toContain('include_in_use=false');
  });

  it('asks for them once the toggle is turned on, back at the first page', async () => {
    renderPage();
    await waitFor(() => expect(historyRequests().length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText('사용 중인 이력 포함'));

    await waitFor(() => expect(historyRequests().at(-1)).toContain('include_in_use=true'));
    expect(historyRequests().at(-1)).toContain('offset=0');
  });
});
