import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import AdminNav from '../components/layout/AdminNav';
import { API_BASE_URL } from '../lib/runtime';
import { buildAuthHeaders, clearStoredAuthSession, getStoredAuthSession } from '../lib/auth';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleMinus, HelpCircle, User } from 'lucide-react';

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
  verificationStatus: string;
  blockNumber: string;
  sortField: SortField;
  sortOrder: SortOrder;
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

const VERIFICATION_STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'verified', label: '검증 성공' },
  { value: 'not_eligible', label: '검증 제외' },
  { value: 'onchain_missing', label: '온체인 미기록' },
  { value: 'db_mismatch', label: 'DB/온체인 불일치' },
  { value: 'tx_input_mismatch', label: '트랜잭션 입력 불일치' },
  { value: 'anchor_unresolved', label: '앵커 트랜잭션 미확인' },
  { value: 'transaction_missing', label: '트랜잭션 조회 실패' },
  { value: 'tx_not_in_block', label: '블록 내 트랜잭션 불일치' },
  { value: 'transactions_root_mismatch', label: '블록 머클 검증 실패' },
  { value: 'not_configured', label: '체인 미설정' },
  { value: 'chain_error', label: '검증 중 오류' },
] as const;

const DEFAULT_FILTERS: HistoryFilters = {
  user: '',
  equipment: '',
  checkoutLocation: '',
  returnLocation: '',
  startDate: '',
  endDate: '',
  verificationStatus: 'all',
  blockNumber: 'all',
  sortField: 'time',
  sortOrder: 'desc',
};

function getShortTagId(tagId: string) {
  const head = tagId.split(':')[0] ?? tagId;
  return head.split('-')[0] ?? head;
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
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.82rem] font-semibold ${tone}`}>
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
          <div>tag_id: {record.tagId ? getShortTagId(record.tagId) : '-'}</div>
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
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [allItems, setAllItems] = useState<UsageHistoryItem[]>([]);
  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedUsageId, setExpandedUsageId] = useState<number | null>(null);
  const [locationOptions, setLocationOptions] = useState<Array<{ value: string; label: string }>>([]);

  const logout = () => {
    clearStoredAuthSession();
    navigate('/', { replace: true });
  };

  const applyClientFilters = useCallback((sourceItems: UsageHistoryItem[], targetFilters: HistoryFilters) => {
    // 텍스트/기간 조건은 서버 조회 시 반영하고, 블록/검증 상태만 화면에서 즉시 재필터링한다.
    return sourceItems.filter((item) => {
      const status = item.blockchain?.verification_status ?? 'chain_error';
      const blockNumber = item.blockchain?.anchor?.block_number;
      if (targetFilters.verificationStatus !== 'all' && status !== targetFilters.verificationStatus) return false;
      if (targetFilters.blockNumber !== 'all' && String(blockNumber ?? '') !== targetFilters.blockNumber) return false;
      return true;
    });
  }, []);

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

  useEffect(() => {
    try {
      const session = getStoredAuthSession();
      if (!session?.token || !session.user) {
        navigate('/', { replace: true });
        return;
      }
      if (session.user.role !== 'admin') {
        navigate('/equipment', { replace: true });
        return;
      }
      setIsAuthorized(true);
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const fetchHistory = useCallback(
    async (targetFilters: HistoryFilters) => {
      setIsLoading(true);
      setError('');
      try {
        const session = getStoredAuthSession();
        if (!session?.token) {
          logout();
          return;
        }

        const params = new URLSearchParams({
          sort_by: targetFilters.sortField,
          sort_order: targetFilters.sortOrder,
          limit: '200',
          include_blockchain: 'true',
        });
        if (targetFilters.user.trim()) params.set('user', targetFilters.user.trim());
        if (targetFilters.equipment.trim()) params.set('equipment', targetFilters.equipment.trim());
        if (targetFilters.checkoutLocation.trim()) params.set('checkout_location', targetFilters.checkoutLocation.trim());
        if (targetFilters.returnLocation.trim()) params.set('return_location', targetFilters.returnLocation.trim());
        if (targetFilters.startDate) params.set('start_date', targetFilters.startDate);
        if (targetFilters.endDate) params.set('end_date', targetFilters.endDate);

        const response = await fetch(`${API_BASE_URL}/usage/history?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: buildAuthHeaders(session.token),
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? '사용 이력 무결성 검증 조회에 실패했습니다.');
        }

        const fetchedItems = Array.isArray(payload.items) ? (payload.items as UsageHistoryItem[]) : [];
        setAllItems(fetchedItems);
        setItems(applyClientFilters(fetchedItems, targetFilters));
        setExpandedUsageId(null);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('사용 이력 무결성 검증 조회 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [applyClientFilters, navigate],
  );

  useEffect(() => {
    if (!isAuthorized) return;
    void fetchHistory(DEFAULT_FILTERS);
  }, [isAuthorized, fetchHistory]);

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
    void fetchHistory(filters);
  };

  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    void fetchHistory(DEFAULT_FILTERS);
  };

  const downloadCsv = () => {
    if (!items.length) return;

    // 화면에 보이는 결과를 그대로 내보내야 하므로 서버 재호출 없이 현재 items를 사용한다.
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
      '무결성 검증 결과',
    ];

    const rows = items.map((item) => [
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
      item.blockchain?.verification_label ?? '검증 중 오류',
    ]);

    const csv = ['\ufeff' + header.map(escapeCsvCell).join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\r\n');
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

  const onSelectBlock = (blockNumber: string) => {
    const nextFilters = { ...filters, blockNumber };
    setFilters(nextFilters);
    setItems(applyClientFilters(allItems, nextFilters));
    setExpandedUsageId(null);
  };

  const onSelectVerificationStatus = (verificationStatus: string) => {
    const nextFilters = { ...filters, verificationStatus };
    setFilters(nextFilters);
    setItems(applyClientFilters(allItems, nextFilters));
    setExpandedUsageId(null);
  };

  const blockOptions = useMemo(() => {
    const seen = new Set<number>();
    const values: Array<{ value: string; label: string }> = [];
    allItems.forEach((item) => {
      const blockNumber = item.blockchain?.anchor?.block_number;
      if (typeof blockNumber !== 'number' || seen.has(blockNumber)) return;
      seen.add(blockNumber);
      values.push({ value: String(blockNumber), label: `Block ${blockNumber}` });
    });
    values.sort((left, right) => Number(left.value) - Number(right.value));
    return values;
  }, [allItems]);

  const visibleVerifiedCount = items.filter((item) => item.blockchain?.verification_status === 'verified').length;
  const visibleIssueCount = items.filter((item) => {
    const status = item.blockchain?.verification_status ?? 'chain_error';
    return status !== 'verified' && status !== 'not_eligible';
  }).length;

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell
      wide
      actions={<AdminNav active="verification" />}
      contentClassName="pt-4 sm:pt-5"
    >
      <div className="space-y-4">
        <section className="surface-panel p-5 fade-rise">
          <div className="panel-header">
            <div>
              <div className="panel-title">검색 조건</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline">최대 200건</Badge>
            </div>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              <label className="block text-sm font-medium">검증 상태</label>
              <Select value={filters.verificationStatus} onValueChange={onSelectVerificationStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="검증 상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  {VERIFICATION_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">블록</label>
              <Select value={filters.blockNumber} onValueChange={onSelectBlock}>
                <SelectTrigger>
                  <SelectValue placeholder="블록 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 블록</SelectItem>
                  {blockOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">정렬 기준</label>
              <Select value={filters.sortField} onValueChange={(value) => updateFilter('sortField', value as SortField)}>
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
              <Select value={filters.sortOrder} onValueChange={(value) => updateFilter('sortOrder', value as SortOrder)}>
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
            <div className="flex flex-wrap items-end gap-2 xl:col-span-5">
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
              <Button type="button" variant="outline" onClick={() => void fetchHistory(filters)} disabled={isLoading}>
                새로고침
              </Button>
              <Button type="button" variant="outline" onClick={downloadCsv} disabled={isLoading || items.length === 0}>
                CSV 다운로드
              </Button>
            </div>
          </form>

          {error ? (
            <div className="alert alert-error mt-4">
              {error}
            </div>
          ) : null}
        </section>

        <section className="surface-panel p-5 fade-rise-delay">
          <div className="panel-header">
            <div>
              <div className="panel-title">장비 사용 이력</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline">검증 완료 {visibleVerifiedCount}건</Badge>
              <Badge variant="outline">검증 실패 {visibleIssueCount}건</Badge>
            </div>
          </div>

          <div className="space-y-2.5">
            {isLoading ? (
              <div className="empty-state">조회 중입니다.</div>
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
                    className="relative overflow-hidden rounded-[1.25rem] border border-border bg-card p-4 pl-5 transition-all"
                  >
                    <div className={`absolute left-0 top-0 h-full w-1.5 ${getVerificationCardTone(verificationStatus)}`} />
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
                          usage_id {item.usage_id} · tag {getShortTagId(item.equipment.tag_id)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {typeof blockNumber === 'number' ? <Badge variant="outline">Block {blockNumber}</Badge> : null}
                        {typeof transactionIndex === 'number' ? <Badge variant="outline">Tx #{transactionIndex}</Badge> : null}
                        <VerificationStatusPill
                          status={verificationStatus}
                          label={verificationLabel}
                        />
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
                          <div className="break-all">원본 머클 루트 값: {blockchain?.anchor?.transactions_root ?? '-'}</div>
                          <div className="break-all">재계산 머클 루트 값: {blockchain?.anchor?.recalculated_transactions_root ?? '-'}</div>
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
        </section>
      </div>
    </AppShell>
  );
}
