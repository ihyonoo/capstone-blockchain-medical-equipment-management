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

function makeItem(index: number) {
  const label = String(index).padStart(2, '0');
  return {
    usage_id: index,
    user: { name: '박수현', position: '간호사', department: '응급의학과' },
    returned_by: { name: '박수현', position: '간호사', department: '응급의학과' },
    equipment: { tag_id: `EQ-00${label}`, name: `장비 ${label}` },
    checkout: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_000_000 },
    return: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_003_600 },
    blockchain: {
      verification_status: 'verified',
      verification_label: '검증 성공',
      db_record: null,
      tx_input_matches_db: true,
      transactions_root_matches: true,
      anchor: {
        block_number: 100 + index,
        transaction_index: 0,
        transactions_root: '0xroot',
        recalculated_transactions_root: '0xroot',
      },
    },
  };
}

const HISTORY_PAYLOAD = {
  ok: true,
  count: 25,
  items: Array.from({ length: 25 }, (_, i) => makeItem(i + 1)),
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

function visibleEquipmentNames() {
  return screen.getAllByText(/^장비 \d{2}$/).map((node) => node.textContent);
}

describe('IntegrityVerification pagination', () => {
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
          json: async () => (String(url).includes('/rtls/live') ? LIVE_PAYLOAD : HISTORY_PAYLOAD),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows only the first page of results by default', async () => {
    renderPage();

    await screen.findByText('장비 01');
    expect(visibleEquipmentNames()).toHaveLength(20);
    expect(screen.queryByText('장비 21')).not.toBeInTheDocument();
  });

  it('shows the remaining results on the next page', async () => {
    renderPage();

    await screen.findByText('장비 01');
    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));

    expect(visibleEquipmentNames()).toHaveLength(5);
    expect(screen.getByText('장비 21')).toBeInTheDocument();
    expect(screen.queryByText('장비 01')).not.toBeInTheDocument();
  });

  it('applies the page size the admin picked', async () => {
    renderPage();

    await screen.findByText('장비 01');
    fireEvent.click(screen.getByRole('combobox', { name: '페이지당 개수' }));
    fireEvent.click(await screen.findByRole('option', { name: '10개씩' }));

    await waitFor(() => expect(visibleEquipmentNames()).toHaveLength(10));
    expect(screen.queryByText('장비 11')).not.toBeInTheDocument();
  });

  it('returns to the first page when the page size changes', async () => {
    renderPage();

    await screen.findByText('장비 01');
    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    expect(screen.getByText('장비 21')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: '페이지당 개수' }));
    fireEvent.click(await screen.findByRole('option', { name: '10개씩' }));

    await waitFor(() => expect(screen.getByText('장비 01')).toBeInTheDocument());
  });

  it('returns to the first page when a new search is submitted', async () => {
    renderPage();

    await screen.findByText('장비 01');
    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    expect(screen.queryByText('장비 01')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(screen.getByText('장비 01')).toBeInTheDocument());
  });
});
