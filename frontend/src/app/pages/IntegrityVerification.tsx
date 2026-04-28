import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { API_BASE_URL } from '../lib/runtime';
import { Search, LogOut, User, ListFilter, Download, ShieldCheck, ChevronDown } from 'lucide-react';

type UsageHistoryItem = {
  usage_id: number;
  user: {
    user_id: number;
    name: string;
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
  created_at: number | null;
  verification: UsageVerifyResult;
};

const FALLBACK_VERIFICATION: UsageVerifyResult = {
  ok: true,
  usage_id: 0,
  verification_status: 'not_configured',
  detail: '검증 결과를 아직 불러오지 못했습니다.',
  recalculated_hash: null,
  onchain_hash: null,
  onchain_exists: false,
  recorded_at: null,
  recorder: null,
};

type UsageVerifyResult = {
  ok: boolean;
  usage_id: number;
  verification_status: 'match' | 'mismatch' | 'not_anchored' | 'not_configured' | 'chain_error';
  detail: string | null;
  recalculated_hash: string | null;
  onchain_hash: string | null;
  onchain_exists: boolean;
  recorded_at?: number | null;
  recorder?: string | null;
};

type SearchMode = 'user' | 'equipment' | 'date';
const SEARCH_OPTIONS: Array<{ value: SearchMode; label: string }> = [
  { value: 'user', label: '사용자' },
  { value: 'equipment', label: '장비' },
  { value: 'date', label: '날짜' },
];

function formatDateTime(epoch: number | null) {
  if (!epoch) return '-';
  return new Date(epoch * 1000).toLocaleString('ko-KR', { hour12: false });
}

function getDisplayDepartment(item: UsageHistoryItem) {
  return item.user.department ?? '-';
}

function getDisplayPosition(item: UsageHistoryItem) {
  return item.user.position ?? '-';
}

function getDisplayUsagePath(item: UsageHistoryItem) {
  return `${item.checkout.location ?? item.checkout.reader_id ?? '-'} → ${item.return.location ?? item.return.reader_id ?? '진료과'}`;
}

function getVerificationLabel(status: UsageVerifyResult['verification_status']) {
  switch (status) {
    case 'match':
      return '검증 통과';
    case 'mismatch':
      return '불일치';
    case 'not_anchored':
      return '미앵커';
    case 'not_configured':
      return '체인 미설정';
    default:
      return '조회 오류';
  }
}

function getVerificationBadgeVariant(status: UsageVerifyResult['verification_status']): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (status) {
    case 'match':
      return 'default';
    case 'mismatch':
    case 'chain_error':
      return 'destructive';
    case 'not_anchored':
    case 'not_configured':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function IntegrityVerification() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  const [searchMode, setSearchMode] = useState<SearchMode>('user');
  const [searchValue, setSearchValue] = useState('');
  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingFiltered, setIsExportingFiltered] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [error, setError] = useState('');
  const [expandedUsageId, setExpandedUsageId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        navigate('/', { replace: true });
        return;
      }
      const user = JSON.parse(raw) as { role?: string };
      if (user.role !== 'admin') {
        navigate('/equipment', { replace: true });
        return;
      }
      setIsAuthorized(true);
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const fetchHistory = useCallback(
    async (mode: SearchMode, value: string) => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        const q = value.trim();
        if (q) {
          if (mode === 'user') params.set('user', q);
          if (mode === 'equipment') params.set('equipment', q);
          if (mode === 'date') params.set('date', q);
        }
        params.set('limit', '100');

        const response = await fetch(`${API_BASE_URL}/usage/history?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? '사용 이력 조회에 실패했습니다.');
        }

        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('사용 이력 조회 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAuthorized) return;
    fetchHistory(searchMode, '');
  }, [isAuthorized, fetchHistory]);

  const totalCount = items.length;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(searchMode, searchValue);
  };

  const onReset = () => {
    setSearchMode('user');
    setSearchValue('');
    fetchHistory('user', '');
  };

  const downloadUsageHistory = useCallback(
    async (exportAll: boolean) => {
      if (exportAll) setIsExportingAll(true);
      else setIsExportingFiltered(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (!exportAll) {
          const q = searchValue.trim();
          if (q) {
            if (searchMode === 'user') params.set('user', q);
            if (searchMode === 'equipment') params.set('equipment', q);
            if (searchMode === 'date') params.set('date', q);
          }
        }
        params.set('limit', '10000');

        const response = await fetch(`${API_BASE_URL}/usage/history/export?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail ?? '엑셀 다운로드에 실패했습니다.');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        const filenameMatch = contentDisposition?.match(/filename=\"?([^"]+)\"?/i);
        const filename = filenameMatch?.[1] ?? `usage_history_${Date.now()}.csv`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('엑셀 다운로드 중 오류가 발생했습니다.');
      } finally {
        if (exportAll) setIsExportingAll(false);
        else setIsExportingFiltered(false);
      }
    },
    [searchMode, searchValue],
  );

  const inputPlaceholder = useMemo(() => {
    if (searchMode === 'user') return '이름 또는 사용자 ID';
    if (searchMode === 'equipment') return '장비명 또는 태그 ID';
    return 'YYYY-MM-DD';
  }, [searchMode]);

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell
      actions={
        <>
          <Button variant="secondary" onClick={() => navigate('/verification')}>
            장비 사용 이력 조회
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/nfc-mapping')}>
            NFC 매핑
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </>
      }
      headerAside={
        <div className="w-[10rem] max-w-full">
          <div className="metric-card text-center">
            <div className="metric-label">조회 결과</div>
            <div className="metric-value">{totalCount}</div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="surface-panel p-5 fade-rise">
          <div className="panel-header">
            <div>
              <div className="panel-title flex items-center gap-2">
                <ListFilter className="h-5 w-5 text-primary" />
                검색 조건
              </div>
            </div>
            <Badge variant="outline">Max 100 rows on screen</Badge>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium block">검색 방식</label>
              <Select value={searchMode} onValueChange={(value) => setSearchMode(value as SearchMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="검색 방식 선택" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">검색값</label>
              <Input
                type={searchMode === 'date' ? 'date' : 'text'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={inputPlaceholder}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '조회 중...' : '조회'}
              </Button>
              <Button type="button" variant="outline" onClick={onReset}>
                초기화
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadUsageHistory(false)}
              disabled={isExportingFiltered || isExportingAll}
            >
              <Download className="h-4 w-4" />
              {isExportingFiltered ? '다운로드 중...' : '검색 결과 엑셀 다운로드'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadUsageHistory(true)}
              disabled={isExportingFiltered || isExportingAll}
            >
              <Download className="h-4 w-4" />
              {isExportingAll ? '다운로드 중...' : '전체 이력 엑셀 다운로드'}
            </Button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="surface-panel p-5 fade-rise-delay">
          <div className="panel-header">
            <div>
              <div className="panel-title flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                장비 사용 이력
              </div>
            </div>
            <Badge variant="outline">Immutable Audit View</Badge>
          </div>

          <div className="space-y-2.5">
              {isLoading ? (
                <div className="empty-state">조회 중입니다.</div>
              ) : items.length === 0 ? (
                <div className="empty-state">조회된 사용 이력이 없습니다.</div>
              ) : (
                items.map((item) => {
                  const isExpanded = expandedUsageId === item.usage_id;
                  const displayDepartment = getDisplayDepartment(item);
                  const displayPosition = getDisplayPosition(item);
                  const usagePath = getDisplayUsagePath(item);
                  const verification = item.verification ?? { ...FALLBACK_VERIFICATION, usage_id: item.usage_id };
                  return (
                  <div
                    key={item.usage_id}
                    className="rounded-[1.7rem] border border-white/70 bg-white/58 p-5 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const nextExpanded = isExpanded ? null : item.usage_id;
                        setExpandedUsageId(nextExpanded);
                      }}
                      className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-[1.42rem] font-semibold tracking-[-0.04em] text-foreground">{item.equipment.name}</div>
                        <div className="mt-1 text-[1.02rem] text-muted-foreground">usage_id {item.usage_id} · tag {item.equipment.tag_id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">사용 이력</Badge>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/62 p-4">
                        <div className="metric-label text-[1rem]">사용자</div>
                        <div className="mt-2 flex items-center gap-2 text-[1.08rem] leading-7 text-foreground">
                          <User className="h-[1.05rem] w-[1.05rem] text-muted-foreground" />
                          <span>
                            {item.user.name} / {displayDepartment} / {displayPosition}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/62 p-4">
                        <div className="metric-label text-[1rem]">대여 정보</div>
                        <div className="mt-2 text-[1.08rem] leading-7 text-foreground">
                          {formatDateTime(item.checkout.at)}
                          <br />
                          {item.checkout.location ?? item.checkout.reader_id ?? '-'}
                        </div>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/62 p-4">
                        <div className="metric-label text-[1rem]">반납 정보</div>
                        <div className="mt-2 text-[1.08rem] leading-7 text-foreground">
                          {formatDateTime(item.return.at)}
                          <br />
                          {item.return.location ?? item.return.reader_id ?? '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 inline-meta text-[0.98rem]">
                      <span className="inline-meta__item">
                        <Search className="h-4 w-4" />
                        생성 시각 {formatDateTime(item.created_at)}
                      </span>
                      <span className="inline-meta__item">
                        <User className="h-4 w-4" />
                        <span>
                          user_id {item.user.user_id}
                        </span>
                      </span>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 space-y-3 rounded-[1.5rem] border border-slate-300/70 bg-slate-200/70 p-4">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[1.2rem] font-semibold text-black">블록체인 무결성 검증</div>
                          </div>
                          <div className="space-y-3 rounded-[1.1rem] border border-slate-300/70 bg-slate-100/90 p-4 text-[1rem] text-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={getVerificationBadgeVariant(verification.verification_status)}>
                                {getVerificationLabel(verification.verification_status)}
                              </Badge>
                              {verification.detail ? (
                                <span className="text-sm text-muted-foreground">{verification.detail}</span>
                              ) : null}
                            </div>
                            <div>재계산 해시: {verification.recalculated_hash ?? '-'}</div>
                            <div>온체인 해시: {verification.onchain_hash ?? '-'}</div>
                            <div>기록 시각: {formatDateTime(verification.recorded_at ?? null)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[1.2rem] font-semibold text-black">장비 사용 이력 원본 데이터</div>
                          <div className="mt-2 rounded-[1.1rem] border border-slate-300/70 bg-slate-100/90 p-4 text-[1.28rem] leading-[2rem] text-foreground">
                            <div>장비 ID: {item.equipment.tag_id}</div>
                            <div>장비명: {item.equipment.name}</div>
                            <div>
                              사용자: {item.user.name} / {displayDepartment} / {displayPosition}
                            </div>
                            <div>사용 위치: {usagePath}</div>
                            <div>대여 시각: {formatDateTime(item.checkout.at)}</div>
                            <div>반납 시각: {formatDateTime(item.return.at)}</div>
                            <div>트랜잭션 인덱스 번호: TX-{String(item.usage_id).padStart(5, '0')}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )})
              )}
            </div>
        </section>
      </div>
    </AppShell>
  );
}
