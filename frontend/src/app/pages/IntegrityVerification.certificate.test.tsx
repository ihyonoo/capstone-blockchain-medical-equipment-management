import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

const MOVEMENT_PATH = [
  { location: '복도 B', at: 1_700_001_000 },
  { location: '영상의학과', at: 1_700_002_000 },
];

const HISTORY_PAYLOAD = {
  ok: true,
  count: 1,
  items: [
    {
      usage_id: 42,
      user: { name: '박수현', position: '간호사', department: '응급의학과' },
      returned_by: { name: '김도윤', position: '전공의', department: '정형외과' },
      equipment: { tag_id: TAG_ID, name: '검체이송 카트 7호' },
      checkout: { reader_id: 'M101', location: '1층 병동 A', at: 1_700_000_000 },
      return: { reader_id: 'M503', location: '수술실', at: 1_700_003_600 },
      movement_path: MOVEMENT_PATH,
      blockchain: {
        verification_status: 'verified',
        verification_label: '검증 성공',
        db_record: {
          usageId: '42',
          checkoutUserId: 11,
          returnUserId: 22,
          tagId: TAG_ID,
          checkoutLocation: '1층 병동 A',
          checkoutAt: 1_700_000_000,
          returnLocation: '수술실',
          returnedAt: 1_700_003_600,
          movementPath: MOVEMENT_PATH,
        },
        tx_input_matches_db: true,
        transactions_root_matches: true,
        anchor: {
          block_number: 101,
          transaction_index: 0,
          transactions_root: '0xdeadbeefroot',
          recalculated_transactions_root: '0xdeadbeefroot',
        },
      },
    },
  ],
};

const LIVE_PAYLOAD = {
  ok: true,
  readers: [
    { reader_id: 'M101', location: '1층 병동 A', is_online: true, last_seen: 0, floor: 1 },
    { reader_id: 'M503', location: '수술실', is_online: true, last_seen: 0, floor: 5 },
  ],
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

async function openCertificate() {
  const row = await screen.findByRole('button', { name: /검체이송 카트 7호/ });
  fireEvent.click(row);
  return within(await screen.findByRole('dialog'));
}

describe('IntegrityVerification usage certificate', () => {
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

  it('presents the record as an issued verification certificate', async () => {
    renderPage();

    const dialog = await openCertificate();
    expect(dialog.getByText('의료 장비 사용 이력 검증 증명서')).toBeInTheDocument();
  });

  // 발급 대장이 따로 없으므로 문서번호는 usage_id에서만 파생한다.
  it('derives the document number from the usage id alone', async () => {
    renderPage();

    const dialog = await openCertificate();
    const meta = within(dialog.getByRole('group', { name: '증명서 발급 정보' }));
    expect(meta.getByText('문서번호')).toBeInTheDocument();
    expect(meta.getByText('UR-000042')).toBeInTheDocument();
  });

  // 장비명·태그·usage_id는 한 줄에 나란히 놓는다.
  it('keeps the equipment identity on a single line', async () => {
    renderPage();

    const dialog = await openCertificate();
    const equipment = within(dialog.getByRole('group', { name: '장비' }));
    const line = equipment.getByRole('list', { name: '장비 식별 정보' });
    const cells = within(line)
      .getAllByRole('listitem')
      .map((cell) => cell.textContent ?? '');

    expect(cells).toHaveLength(3);
    expect(cells[0]).toContain('검체이송 카트 7호');
    expect(cells[1]).toContain('major 1 · minor 0007');
    expect(cells[2]).toContain('42');
  });

  it('numbers the certificate sections', async () => {
    renderPage();

    const dialog = await openCertificate();
    expect(dialog.getByText('Ⅰ')).toBeInTheDocument();
    expect(dialog.getByText('Ⅱ')).toBeInTheDocument();
    expect(dialog.getByText('Ⅲ')).toBeInTheDocument();
    expect(dialog.getByText('Ⅳ')).toBeInTheDocument();
  });

  it('walks the record as a checkout → transit → return timeline', async () => {
    renderPage();

    const dialog = await openCertificate();
    const timeline = dialog.getByRole('list', { name: '사용 기록 타임라인' });
    const steps = within(timeline)
      .getAllByRole('listitem')
      .map((step) => step.textContent ?? '');

    expect(steps).toHaveLength(4);
    expect(steps[0]).toContain('대여');
    expect(steps[0]).toContain('1층 병동 A');
    expect(steps[0]).toContain('박수현');
    expect(steps[1]).toContain('복도 B');
    expect(steps[2]).toContain('영상의학과');
    expect(steps[3]).toContain('반납');
    expect(steps[3]).toContain('수술실');
    expect(steps[3]).toContain('김도윤');
  });

  it('says so inside the timeline when there was no transit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => {
            if (String(url).includes('/rtls/live')) return LIVE_PAYLOAD;
            return { ...HISTORY_PAYLOAD, items: [{ ...HISTORY_PAYLOAD.items[0], movement_path: [] }] };
          },
        }),
      ),
    );

    renderPage();

    const dialog = await openCertificate();
    const timeline = within(dialog.getByRole('list', { name: '사용 기록 타임라인' }));
    expect(timeline.getByText('이동 기록 없음')).toBeInTheDocument();
  });

  // 대여자·반납자의 부서와 직책은 증명서에서도 빠지면 안 된다.
  it('keeps department and position for both handlers', async () => {
    renderPage();

    const dialog = await openCertificate();
    expect(dialog.getByText(/응급의학과/)).toBeInTheDocument();
    expect(dialog.getByText(/간호사/)).toBeInTheDocument();
    expect(dialog.getByText(/정형외과/)).toBeInTheDocument();
    expect(dialog.getByText(/전공의/)).toBeInTheDocument();
  });

  it('lists every field of the on-chain record snapshot', async () => {
    renderPage();

    const dialog = await openCertificate();
    const snapshot = dialog.getByRole('group', { name: '의료 장비 사용 이력' });
    for (const label of [
      'usage_id',
      '태그',
      '사용 시작자 ID',
      '사용 종료자 ID',
      '대여 위치',
      '반납 위치',
      '대여 시각',
      '반납 시각',
    ]) {
      expect(within(snapshot).getByText(label)).toBeInTheDocument();
    }
    expect(within(snapshot).getByText('11')).toBeInTheDocument();
    expect(within(snapshot).getByText('22')).toBeInTheDocument();
    expect(within(snapshot).getByText('온체인 원문 일치')).toBeInTheDocument();
    // 이동 경로는 Ⅱ절 타임라인이 이미 보여주므로 원문 절에서는 뺀다.
    expect(within(snapshot).queryByText('이동 경로')).not.toBeInTheDocument();
  });

  it('shows both merkle roots in full so the values can be compared', async () => {
    renderPage();

    const dialog = await openCertificate();
    const merkle = dialog.getByRole('group', { name: '머클 검증 결과' });
    expect(within(merkle).getAllByText('0xdeadbeefroot')).toHaveLength(2);
    expect(within(merkle).getByText('머클루트 일치')).toBeInTheDocument();
  });

  it('copies a merkle root to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderPage();

    const dialog = await openCertificate();
    const merkle = within(dialog.getByRole('group', { name: '머클 검증 결과' }));
    fireEvent.click(merkle.getAllByRole('button', { name: '값 복사' })[0]);

    expect(writeText).toHaveBeenCalledWith('0xdeadbeefroot');
  });

  it('prints the certificate', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);

    renderPage();

    const dialog = await openCertificate();
    fireEvent.click(dialog.getByRole('button', { name: '인쇄' }));

    expect(print).toHaveBeenCalled();
  });

  it('does not close with a summary seal box', async () => {
    renderPage();

    const dialog = await openCertificate();
    expect(dialog.queryByRole('group', { name: '검증 결과 확인' })).not.toBeInTheDocument();
  });
});
