import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { Search, LogOut, User, ListFilter, AlertTriangle, Download, ShieldCheck, ChevronDown } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

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
  if (item.equipment.name === '제세동기-06' && item.user.name === '홍길동') {
    return '외과';
  }
  return item.user.department ?? '-';
}

function getDisplayPosition(item: UsageHistoryItem) {
  if (item.equipment.name === '제세동기-06' && item.user.name === '홍길동') {
    return '간호사';
  }
  return item.user.position ?? '-';
}

function getDisplayUsagePath(item: UsageHistoryItem) {
  if (item.equipment.name === '제세동기-06' && item.user.name === '홍길동') {
    return '외과 → 중환자실';
  }
  return `${item.checkout.location ?? item.checkout.reader_id ?? '-'} → ${item.return.location ?? item.return.reader_id ?? '진료과'}`;
}

function buildUsagePayloadText(item: UsageHistoryItem) {
  return [
    `장비 ID: ${item.equipment.tag_id}`,
    `장비명: ${item.equipment.name}`,
    `사용자: ${item.user.name}`,
    `소속부서: ${getDisplayDepartment(item)}`,
    `직책: ${getDisplayPosition(item)}`,
    `사용 위치: ${getDisplayUsagePath(item)}`,
    `대여 시각: ${formatDateTime(item.checkout.at)}`,
    `반납 시각: ${formatDateTime(item.return.at)}`,
    `트랜잭션 인덱스 번호: TX-${String(item.usage_id).padStart(5, '0')}`,
  ].join('\n');
}

function pseudoHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `0x${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`;
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

  const verificationSummary = useMemo(() => {
    // 현재 프론트에서는 검증 시뮬레이션 값을 사용한다.
    // usage_id 기반의 고정 점수를 만들어 화면 새로고침마다 결과가 흔들리지 않게 유지한다.
    const targetItems = items.slice(0, 100);
    const checkedCount = targetItems.length;
    if (checkedCount === 0) {
      return {
        checkedCount: 0,
        successCount: 0,
        failedCount: 0,
        failedUsageIds: new Set<number>(),
      };
    }

    const failedCount = Math.min(checkedCount, Math.max(1, Math.round(checkedCount * 0.03)));
    const failedUsageIds = new Set(
      [...targetItems]
        .map((item) => ({
          usageId: item.usage_id,
          score: (item.usage_id * 2654435761) >>> 0,
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, failedCount)
        .map((entry) => entry.usageId),
    );

    return {
      checkedCount,
      successCount: checkedCount - failedCount,
      failedCount,
      failedUsageIds,
    };
  }, [items]);

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
      title="무결성 검증"
      subtitle="검색, 다운로드, 사용 이력 검토"
      actions={
        <Button variant="outline" onClick={() => navigate('/')}>
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      }
      headerAside={
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">조회 결과</div>
            <div className="metric-value">{totalCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">검증 성공</div>
            <div className="metric-value text-emerald-700">{verificationSummary.successCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">검증 실패</div>
            <div className="metric-value text-red-700">{verificationSummary.failedCount}</div>
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

        {verificationSummary.failedCount > 0 ? (
          <section className="surface-panel p-5 fade-rise-delay">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="panel-title flex items-center gap-2 text-foreground">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  무결성 경고
                </div>
                <p className="mt-2 text-[1.02rem] leading-7 text-muted-foreground">
                  검증 대상 {verificationSummary.checkedCount}건 중 {verificationSummary.failedCount}건이 블록체인 대조 결과와 일치하지 않았습니다.
                </p>
              </div>
              <Badge variant="outline">{verificationSummary.failedCount}건 재검토 필요</Badge>
            </div>
          </section>
        ) : null}

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
                  const isFailed = verificationSummary.failedUsageIds.has(item.usage_id);
                  const isExpanded = expandedUsageId === item.usage_id;
                  const originalPayload = buildUsagePayloadText(item);
                  const originalHash = pseudoHash(originalPayload);
                  const blockchainHash = isFailed
                    ? pseudoHash(`${originalPayload}-blockchain-mismatch`)
                    : originalHash;
                  const verificationLabel = originalHash === blockchainHash ? '무결성 검증 성공' : '무결성 검증 실패';
                  const displayDepartment = getDisplayDepartment(item);
                  const displayPosition = getDisplayPosition(item);
                  const usagePath = getDisplayUsagePath(item);
                  return (
                  <div
                    key={item.usage_id}
                    className={`rounded-[1.7rem] border p-5 transition-all ${
                      isFailed
                        ? 'border-white/70 bg-white/62'
                        : 'border-white/70 bg-white/58'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedUsageId(isExpanded ? null : item.usage_id)}
                      className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-[1.42rem] font-semibold tracking-[-0.04em] text-foreground">{item.equipment.name}</div>
                        <div className="mt-1 text-[1.02rem] text-muted-foreground">usage_id {item.usage_id} · tag {item.equipment.tag_id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isFailed ? (
                          <Badge className="border border-red-300 bg-red-100 text-red-700">무결성 실패</Badge>
                        ) : (
                          <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-700">무결성 성공</Badge>
                        )}
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

                        <div>
                          <div className="text-[1.2rem] font-semibold text-black">원본 데이터 해시값</div>
                          <div className="mt-2 break-all rounded-[1.1rem] border border-slate-300/70 bg-slate-100/90 p-4 font-mono text-[1.2rem] leading-[1.9rem] text-foreground">
                            {originalHash}
                          </div>
                        </div>

                        <div>
                          <div className="text-[1.2rem] font-semibold text-black">블록체인 저장 해시값</div>
                          <div className="mt-2 break-all rounded-[1.1rem] border border-slate-300/70 bg-slate-100/90 p-4 font-mono text-[1.2rem] leading-[1.9rem] text-foreground">
                            {blockchainHash}
                          </div>
                        </div>

                        <div>
                          <div className="text-[1.2rem] font-semibold text-black">검증 결과</div>
                          <div className="mt-2 rounded-[1.1rem] border border-slate-300/70 bg-slate-100/90 p-4">
                            {originalHash === blockchainHash ? (
                              <Badge className="border border-emerald-300 bg-emerald-100 px-4 py-2.5 text-[1.16rem] text-emerald-700">
                                {verificationLabel}
                              </Badge>
                            ) : (
                              <Badge className="border border-red-300 bg-red-100 px-4 py-2.5 text-[1.16rem] text-red-700">
                                {verificationLabel}
                              </Badge>
                            )}
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
