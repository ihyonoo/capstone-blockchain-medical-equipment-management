import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import AdminNav from '../components/layout/AdminNav';
import ResizableSidebar from '../components/layout/ResizableSidebar';
import Pagination from '../components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '../lib/pagination';
import { formatIBeaconTag } from '../lib/iBeaconTag';
import { API_BASE_URL } from '../lib/runtime';
import { buildAuthHeaders, getStoredAuthSession, LOGIN_PATH } from '../lib/auth';
import { useAuthGuard, useLogout, useRunWhenReady } from '../lib/useAuthGuard';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleMinus, HelpCircle, Loader2, User } from 'lucide-react';

type UsageChainRecord = {
  usageId: string;
  checkoutUserId: number | null;
  returnUserId: number | null;
  tagId: string;
  checkoutLocation: string;
  checkoutAt: number | null;
  returnLocation: string;
  returnedAt: number | null;
};

type UsageHistoryItem = {
  usage_id: number;
  user: {
    name: string;
    position: string | null;
    department: string | null;
  };
  returned_by: {
    name: string | null;
    position: string | null;
    department: string | null;
  };
  equipment: {
    tag_id: string;
    name: string;
    // 관리자만 받는 값. 예전 응답에는 없을 수 있어 optional.
    is_real_hardware?: boolean;
  };
  checkout: {
    reader_id: string | null;
    location: string | null;
    at: number | null;
  };
  return: {
    reader_id: string | null;
    location: string | null;
    at: number | null;
  };
  blockchain: {
    verification_status: string;
    verification_label: string;
    db_record: UsageChainRecord | null;
    tx_input_matches_db: boolean | null;
    transactions_root_matches: boolean | null;
    anchor: {
      block_number: number | null;
      transaction_index: number | null;
      transactions_root: string | null;
      recalculated_transactions_root: string | null;
    } | null;
  } | null;
};

type SortField = 'time' | 'user' | 'equipment';
type SortOrder = 'asc' | 'desc';

type HistoryFilters = {
  user: string;
  equipment: string;
  checkoutLocation: string;
  returnLocation: string;
  startDate: string;
  endDate: string;
  sortField: SortField;
  sortOrder: SortOrder;
};

/** 서버 한 페이지를 특정하는 값 전부. 이 값이 곧 요청 파라미터가 된다. */
type HistoryQuery = {
  filters: HistoryFilters;
  page: number;
  pageSize: number;
  hideSimulated: boolean;
};

const SORT_FIELD_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'time', label: '시간 순' },
  { value: 'user', label: '이름 순' },
  { value: 'equipment', label: '장비 이름 순' },
];

const SORT_ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: 'desc', label: '내림차순' },
  { value: 'asc', label: '오름차순' },
];

const DEFAULT_FILTERS: HistoryFilters = {
  user: '',
  equipment: '',
  checkoutLocation: '',
  returnLocation: '',
  startDate: '',
  endDate: '',
  sortField: 'time',
  sortOrder: 'desc',
};

const DEFAULT_QUERY: HistoryQuery = {
  filters: DEFAULT_FILTERS,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  hideSimulated: false,
};

/** CSV는 검증 없이 전체를 훑으므로 페이지 크기를 크게 잡는다. 서버 상한과 같은 값. */
const CSV_CHUNK_SIZE = 1000;

function buildHistoryParams(query: HistoryQuery, { includeBlockchain }: { includeBlockchain: boolean }) {
  const { filters, page, pageSize, hideSimulated } = query;
  const params = new URLSearchParams({
    sort_by: filters.sortField,
    sort_order: filters.sortOrder,
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    include_blockchain: String(includeBlockchain),
  });
  if (hideSimulated) params.set('hide_simulated', 'true');
  if (filters.user.trim()) params.set('user', filters.user.trim());
  if (filters.equipment.trim()) params.set('equipment', filters.equipment.trim());
  if (filters.checkoutLocation.trim()) params.set('checkout_location', filters.checkoutLocation.trim());
  if (filters.returnLocation.trim()) params.set('return_location', filters.returnLocation.trim());
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate) params.set('end_date', filters.endDate);
  return params;
}

/** 조회 중 결과 카드 자리를 대신 채우는 자리표시자. 개수는 첫 페이지가 비어 보이지 않을 만큼만. */
function HistorySkeleton() {
  return (
    <div
      data-testid="history-skeleton"
      role="status"
      aria-label="사용 이력을 불러오는 중입니다"
      className="space-y-2.5"
    >
      {/* 조회가 느린 이유를 설명해 둔다 — 단순 DB 조회가 아니라 기록마다 체인을 되짚는 작업이다. */}
      <div
        data-testid="history-loading-notice"
        className="flex items-start gap-3 border border-border/70 bg-secondary/40 px-5 py-4"
      >
        <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-primary" />
        <div>
          <div className="text-[1.1rem] font-semibold tracking-[-0.02em] text-foreground">
            블록체인에서 사용 이력을 검증하는 중입니다
          </div>
          <p className="mt-1.5 text-[0.98rem] leading-relaxed text-muted-foreground">
            한 건씩 온체인 값과 대조하고 그 기록이 담긴 블록의 머클루트를 다시 계산하기 때문에 결과가 나오기까지 수십
            초가 걸릴 수 있습니다.
          </p>
        </div>
      </div>

      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          data-testid="history-skeleton-card"
          className="relative overflow-hidden border border-border bg-card p-4 pl-5"
        >
          <div className="skeleton absolute left-0 top-0 h-full w-1.5 border-0" />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="skeleton h-6 w-44" />
              <div className="skeleton h-4 w-56" />
            </div>
            <div className="skeleton h-7 w-28" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDateTime(epoch: number | null | undefined) {
  if (!epoch) return '-';
  const date = new Date(epoch * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hours}시 ${minutes}분 ${seconds}초`;
}

function formatDownloadTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function getLocationLabel(location: string | null, readerId: string | null) {
  return location ?? readerId ?? '-';
}

function getOnchainRecordNotice(value: boolean | null | undefined) {
  if (value === true) return '온체인 원문 일치';
  if (value === false) return '온체인 원문 불일치';
  return '온체인 원문 비교 불가';
}

function getMerkleVerificationNotice(value: boolean | null | undefined) {
  if (value === true) return '머클루트 일치';
  if (value === false) return '머클루트 불일치';
  return '머클루트 검증 불가';
}

function VerificationNotice({ value, children }: { value: boolean | null | undefined; children: string }) {
  const Icon = value === true ? CheckCircle2 : value === false ? AlertTriangle : HelpCircle;
  const iconTone = value === true ? 'text-ok' : value === false ? 'text-err' : 'text-muted-foreground';

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-[0.92rem] font-medium text-muted-foreground">
      <Icon className={`h-4 w-4 shrink-0 ${iconTone}`} />
      <span>{children}</span>
    </div>
  );
}

function getDisplayDepartment(item: UsageHistoryItem) {
  return item.user.department ?? '-';
}

function getDisplayPosition(item: UsageHistoryItem) {
  return item.user.position ?? '-';
}

function getDisplayReturnedByDepartment(item: UsageHistoryItem) {
  return item.returned_by.department ?? '-';
}

function getDisplayReturnedByPosition(item: UsageHistoryItem) {
  return item.returned_by.position ?? '-';
}

function getStatusTone(status: string) {
  if (status === 'verified') {
    return 'tone-ok';
  }
  if (status === 'not_eligible') {
    return 'tone-neutral';
  }
  if (status === 'chain_error' || status === 'not_configured') {
    return 'tone-warn';
  }
  return 'tone-err';
}

function getVerificationCardTone(status: string) {
  if (status === 'verified') return 'solid-ok';
  if (status === 'not_eligible') return 'solid-neutral';
  if (status === 'chain_error' || status === 'not_configured') return 'solid-warn';
  return 'solid-err';
}

function VerificationStatusIcon({ status }: { status: string }) {
  if (status === 'verified') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'not_eligible') return <CircleMinus className="h-4 w-4" />;
  if (status === 'chain_error' || status === 'not_configured') return <HelpCircle className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function VerificationStatusPill({ status, label }: { status: string; label: string }) {
  const tone = getStatusTone(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.82rem] font-semibold ${tone}`}
    >
      <VerificationStatusIcon status={status} />
      <span>{label}</span>
    </span>
  );
}

function SnapshotCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[1.08rem] font-semibold text-foreground">{title}</div>
      <div className="mt-3 border-t border-border/70 pt-3 text-[1rem] leading-7 text-foreground">{children}</div>
    </div>
  );
}

function RecordSnapshot({
  title,
  record,
  notice,
  noticeState,
}: {
  title: string;
  record: UsageChainRecord | null;
  notice?: string;
  noticeState?: boolean | null;
}) {
  return (
    <SnapshotCard title={title}>
      {!record ? (
        <div>기록 없음</div>
      ) : (
        <>
          <div>usage_id: {record.usageId}</div>
          <div>태그: {formatIBeaconTag(record.tagId ?? '')}</div>
          <div>사용 시작자 ID: {record.checkoutUserId ?? '-'}</div>
          <div>사용 종료자 ID: {record.returnUserId ?? '-'}</div>
          <div>대여 위치: {record.checkoutLocation || '-'}</div>
          <div>반납 위치: {record.returnLocation || '-'}</div>
          <div>대여 시각: {formatDateTime(record.checkoutAt)}</div>
          <div>반납 시각: {formatDateTime(record.returnedAt)}</div>
          {notice ? <VerificationNotice value={noticeState}>{notice}</VerificationNotice> : null}
        </>
      )}
    </SnapshotCard>
  );
}

export default function IntegrityVerification() {
  const isAuthorized = useAuthGuard(() => {
    try {
      const session = getStoredAuthSession();
      if (!session?.token || !session.user) return LOGIN_PATH;
      if (session.user.role !== 'admin') return '/equipment';
      return null;
    } catch {
      return LOGIN_PATH;
    }
  });
  // 입력 중인 조건. 조회를 눌러야 query로 넘어간다.
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  // 서버에 실제로 보낸 조회 조건. 이 값이 바뀔 때마다 한 페이지씩 다시 받아온다.
  const [query, setQuery] = useState<HistoryQuery>(DEFAULT_QUERY);
  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedUsageId, setExpandedUsageId] = useState<number | null>(null);
  const [locationOptions, setLocationOptions] = useState<Array<{ value: string; label: string }>>([]);

  const logout = useLogout();

  const updateFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateStartDate = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      startDate: value,
      endDate: prev.endDate && value && prev.endDate < value ? value : prev.endDate,
    }));
  };

  const updateEndDate = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      startDate: prev.startDate && value && prev.startDate > value ? value : prev.startDate,
      endDate: value,
    }));
  };

  const fetchHistory = useCallback(
    async (targetQuery: HistoryQuery) => {
      setIsLoading(true);
      setError('');
      try {
        const session = getStoredAuthSession();
        if (!session?.token) {
          logout();
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/usage/history?${buildHistoryParams(targetQuery, { includeBlockchain: true }).toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: buildAuthHeaders(session.token),
          },
        );
        const payload = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? '사용 이력 무결성 검증 조회에 실패했습니다.');
        }

        setItems(Array.isArray(payload.items) ? (payload.items as UsageHistoryItem[]) : []);
        setTotal(typeof payload.total === 'number' ? payload.total : 0);
        setExpandedUsageId(null);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('사용 이력 무결성 검증 조회 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [logout],
  );

  // 조회 조건·페이지·개수·시뮬레이션 데이터 토글이 바뀔 때마다 해당 페이지만 다시 받아온다.
  const runFetchHistory = useCallback(() => {
    void fetchHistory(query);
  }, [fetchHistory, query]);
  useRunWhenReady(isAuthorized, runFetchHistory);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    const fetchLocations = async () => {
      try {
        const session = getStoredAuthSession();
        if (!session?.token) return;
        const response = await fetch(`${API_BASE_URL}/rtls/live`, {
          method: 'GET',
          cache: 'no-store',
          headers: buildAuthHeaders(session.token),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || cancelled) return;

        const readers = Array.isArray(payload.readers) ? (payload.readers as Array<{ location?: string | null }>) : [];
        const seen = new Set<string>();
        const values: Array<{ value: string; label: string }> = [];
        readers.forEach((reader) => {
          const value = (reader.location ?? '').trim();
          if (!value || seen.has(value)) return;
          seen.add(value);
          values.push({ value, label: value });
        });
        values.sort((left, right) => left.label.localeCompare(right.label, 'ko'));
        setLocationOptions(values);
      } catch {
        // 위치 목록은 부가 정보이므로 실패 시 조용히 무시한다.
      }
    };

    void fetchLocations();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((prev) => ({ ...prev, filters, page: 1 }));
  };

  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery((prev) => ({ ...prev, filters: DEFAULT_FILTERS, page: 1 }));
  };

  const downloadCsv = async () => {
    if (!total) return;

    // 화면은 한 페이지씩만 받지만 CSV는 조회 조건에 맞는 전체를 담는다.
    // 온체인 검증은 건당 비용이 커서 전수로 돌릴 수 없으므로 CSV에는 검증 결과를 넣지 않는다.
    const session = getStoredAuthSession();
    if (!session?.token) {
      logout();
      return;
    }

    const collected: UsageHistoryItem[] = [];
    try {
      for (let chunk = 0; collected.length < total; chunk += 1) {
        const params = buildHistoryParams(
          { ...query, page: chunk + 1, pageSize: CSV_CHUNK_SIZE },
          { includeBlockchain: false },
        );
        const response = await fetch(`${API_BASE_URL}/usage/history?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: buildAuthHeaders(session.token),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? 'CSV로 내보낼 사용 이력을 불러오지 못했습니다.');
        }
        const chunkItems = Array.isArray(payload.items) ? (payload.items as UsageHistoryItem[]) : [];
        if (!chunkItems.length) break;
        collected.push(...chunkItems);
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('CSV 내보내기 중 오류가 발생했습니다.');
      return;
    }

    const header = [
      '사용 이력 ID',
      '장비 ID',
      '장비명',
      '대여자 이름',
      '대여자 부서',
      '대여자 직책',
      '반납자 이름',
      '반납자 부서',
      '반납자 직책',
      '대여 위치',
      '반납 위치',
      '대여 시각',
      '반납 시각',
    ];

    const rows = collected.map((item) => [
      item.usage_id,
      item.equipment.tag_id,
      item.equipment.name,
      item.user.name,
      getDisplayDepartment(item),
      getDisplayPosition(item),
      item.returned_by.name ?? '-',
      getDisplayReturnedByDepartment(item),
      getDisplayReturnedByPosition(item),
      getLocationLabel(item.checkout.location, item.checkout.reader_id),
      getLocationLabel(item.return.location, item.return.reader_id),
      formatDateTime(item.checkout.at),
      formatDateTime(item.return.at),
    ]);

    const csv = [
      '\ufeff' + header.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usage_history_${formatDownloadTimestamp(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 검증 결과는 지금 화면에 띄운 페이지에 대해서만 계산된다(전수 검증은 비용이 커서 하지 않는다).
  const pageVerifiedCount = items.filter((item) => item.blockchain?.verification_status === 'verified').length;
  const pageIssueCount = items.filter((item) => {
    const status = item.blockchain?.verification_status ?? 'chain_error';
    return status !== 'verified' && status !== 'not_eligible';
  }).length;

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell bleed actions={<AdminNav active="verification" />} contentClassName="pt-4 sm:pt-5">
      {/* 사이드바를 상하 꽉 채우기 위해, AppShell 공용 상하 패딩(contentClassName="pt-4 sm:pt-5" +
          .app-shell__content의 3.5rem 하단 패딩)을 이 행 전체에서 걷어내고, 사이드바가 아닌
          나머지(이력 목록) 쪽에만 그 패딩을 되돌려준다. */}
      {/* xl:items-start — 자식이 stretch로 늘어나면 사이드바의 sticky가 동작하지 않는다 */}
      <div className="-mt-4 -mb-14 flex w-full flex-col gap-4 sm:-mt-5 xl:flex-row xl:items-start">
        <ResizableSidebar testId="verification-sidebar">
          <>
            <div className="panel-header shrink-0">
              <div>
                <div className="panel-title">검색 조건</div>
              </div>
            </div>

            {/* 조건이 많아 사이드바를 넘치므로, 필드만 스크롤시키고 버튼 줄은 하단에 고정한다. */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">사용자</label>
                  <Input
                    type="text"
                    value={filters.user}
                    onChange={(e) => updateFilter('user', e.target.value)}
                    placeholder="이름, 사용자 ID"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">장비</label>
                  <Input
                    type="text"
                    value={filters.equipment}
                    onChange={(e) => updateFilter('equipment', e.target.value)}
                    placeholder="장비명 또는 태그 ID"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">대여 위치</label>
                  <Select
                    value={filters.checkoutLocation || 'all'}
                    onValueChange={(value) => updateFilter('checkoutLocation', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="대여 위치 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 위치</SelectItem>
                      {locationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">반납 위치</label>
                  <Select
                    value={filters.returnLocation || 'all'}
                    onValueChange={(value) => updateFilter('returnLocation', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="반납 위치 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 위치</SelectItem>
                      {locationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">조회 시작일</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || undefined}
                    onChange={(e) => updateStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">조회 종료일</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    onChange={(e) => updateEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">정렬 기준</label>
                  <Select
                    value={filters.sortField}
                    onValueChange={(value) => updateFilter('sortField', value as SortField)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="정렬 기준 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_FIELD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">정렬 방향</label>
                  <Select
                    value={filters.sortOrder}
                    onValueChange={(value) => updateFilter('sortOrder', value as SortOrder)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="정렬 방향 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_ORDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '조회 중...' : '조회'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }))}
                  disabled={!filters.startDate && !filters.endDate}
                >
                  기간 초기화
                </Button>
                <Button type="button" variant="outline" onClick={onReset}>
                  초기화
                </Button>
                <Button type="button" variant="outline" onClick={() => void fetchHistory(query)} disabled={isLoading}>
                  새로고침
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadCsv()}
                  disabled={isLoading || total === 0}
                >
                  CSV 다운로드
                </Button>
              </div>
            </form>

            {error ? <div className="alert alert-error mt-4 shrink-0">{error}</div> : null}
          </>
        </ResizableSidebar>

        <div className="flex w-full min-w-0 flex-1 justify-center pt-4 pb-14 pr-[clamp(1rem,2.5vw,2rem)] sm:pt-5">
          <div className="w-full max-w-[1360px]">
            <section className="surface-panel p-5 fade-rise-delay">
              <div className="panel-header">
                <div>
                  <div className="panel-title">장비 사용 이력</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={query.hideSimulated}
                      onChange={(event) =>
                        setQuery((prev) => ({ ...prev, hideSimulated: event.target.checked, page: 1 }))
                      }
                    />
                    시뮬레이션 데이터 숨기기
                  </label>
                  <Badge variant="outline">이 페이지 검증 완료 {pageVerifiedCount}건</Badge>
                  <Badge variant="outline">검증 실패 {pageIssueCount}건</Badge>
                </div>
              </div>

              <div className="space-y-2.5">
                {isLoading ? (
                  <HistorySkeleton />
                ) : items.length === 0 ? (
                  <div className="empty-state">조회된 사용 이력이 없습니다.</div>
                ) : (
                  items.map((item) => {
                    const blockchain = item.blockchain;
                    const isExpanded = expandedUsageId === item.usage_id;
                    const displayDepartment = getDisplayDepartment(item);
                    const displayPosition = getDisplayPosition(item);
                    const returnedByDepartment = getDisplayReturnedByDepartment(item);
                    const returnedByPosition = getDisplayReturnedByPosition(item);
                    const returnedByName = item.returned_by.name ?? '-';
                    const checkoutLocation = getLocationLabel(item.checkout.location, item.checkout.reader_id);
                    const returnLocation = getLocationLabel(item.return.location, item.return.reader_id);
                    const blockNumber = blockchain?.anchor?.block_number ?? null;
                    const transactionIndex = blockchain?.anchor?.transaction_index ?? null;
                    const verificationStatus = blockchain?.verification_status ?? 'chain_error';
                    const verificationLabel = blockchain?.verification_label ?? '검증 중 오류';

                    return (
                      <div
                        key={item.usage_id}
                        className="relative overflow-hidden border border-border bg-card p-4 pl-5 transition-all"
                      >
                        <div
                          className={`absolute left-0 top-0 h-full w-1.5 ${getVerificationCardTone(verificationStatus)}`}
                        />
                        <button
                          type="button"
                          onClick={() => setExpandedUsageId(isExpanded ? null : item.usage_id)}
                          className="mb-2.5 flex w-full flex-wrap items-center justify-between gap-3 text-left"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                            <div className="text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
                              {item.equipment.name}
                            </div>
                            <div className="text-[0.95rem] text-muted-foreground">
                              usage_id {item.usage_id} · {formatIBeaconTag(item.equipment.tag_id)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {typeof blockNumber === 'number' ? (
                              <Badge variant="outline">Block {blockNumber}</Badge>
                            ) : null}
                            {typeof transactionIndex === 'number' ? (
                              <Badge variant="outline">Tx #{transactionIndex}</Badge>
                            ) : null}
                            <VerificationStatusPill status={verificationStatus} label={verificationLabel} />
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg border border-border bg-card p-3">
                            <div className="metric-label text-[0.92rem]">대여자</div>
                            <div className="mt-1.5 flex items-center gap-2 text-[1rem] leading-6 text-foreground">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div>이름: {item.user.name}</div>
                                <div>부서: {displayDepartment}</div>
                                <div>직책: {displayPosition}</div>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <div className="metric-label text-[0.92rem]">반납자</div>
                            <div className="mt-1.5 flex items-center gap-2 text-[1rem] leading-6 text-foreground">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div>이름: {returnedByName}</div>
                                <div>부서: {returnedByDepartment}</div>
                                <div>직책: {returnedByPosition}</div>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <div className="metric-label text-[0.92rem]">장소</div>
                            <div className="mt-1.5 text-[1rem] leading-6 text-foreground">
                              대여: {checkoutLocation}
                              <br />
                              반납: {returnLocation}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <div className="metric-label text-[0.92rem]">시각</div>
                            <div className="mt-1.5 text-[0.85rem] leading-5 tracking-[-0.02em] text-foreground">
                              대여: {formatDateTime(item.checkout.at)}
                              <br />
                              반납: {formatDateTime(item.return.at)}
                            </div>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
                            <RecordSnapshot
                              title="의료 장비 사용 이력"
                              record={blockchain?.db_record ?? null}
                              notice={getOnchainRecordNotice(blockchain?.tx_input_matches_db)}
                              noticeState={blockchain?.tx_input_matches_db}
                            />

                            <SnapshotCard title="머클 검증 결과">
                              <div>블록 번호: {blockchain?.anchor?.block_number ?? '-'}</div>
                              <div>트랜잭션 인덱스: {blockchain?.anchor?.transaction_index ?? '-'}</div>
                              <div className="break-all">
                                원본 머클 루트 값: {blockchain?.anchor?.transactions_root ?? '-'}
                              </div>
                              <div className="break-all">
                                재계산 머클 루트 값: {blockchain?.anchor?.recalculated_transactions_root ?? '-'}
                              </div>
                              <VerificationNotice value={blockchain?.transactions_root_matches}>
                                {getMerkleVerificationNotice(blockchain?.transactions_root_matches)}
                              </VerificationNotice>
                            </SnapshotCard>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              {total > 0 ? (
                <Pagination
                  page={query.page}
                  pageSize={query.pageSize}
                  totalItems={total}
                  onPageChange={(nextPage) => setQuery((prev) => ({ ...prev, page: nextPage }))}
                  onPageSizeChange={(nextSize) => setQuery((prev) => ({ ...prev, pageSize: nextSize, page: 1 }))}
                />
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
