import { useCallback, useMemo, useState, type ReactNode } from 'react';
import AppShell from '../components/layout/AppShell';
import AdminNav from '../components/layout/AdminNav';
import ResizableSidebar from '../components/layout/ResizableSidebar';
import Pagination from '../components/ui/Pagination';
import { clampPage, DEFAULT_PAGE_SIZE, getPageSlice, getTotalPages } from '../lib/pagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { buildAuthHeaders, getStoredAuthSession, LOGIN_PATH } from '../lib/auth';
import { useAuthGuard, useLogout, useRunWhenReady } from '../lib/useAuthGuard';
import { API_BASE_URL, PUBLIC_APP_URL } from '../lib/runtime';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BookOpen, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

type MappingItem = {
  tag_id: string;
  equipment_name: string;
  equipment_type: string | null;
  serial_number: string | null;
  nfc_token: string | null;
  asset_status: string;
  is_active: boolean;
  // 관리자만 받는 값. 예전 응답에는 없을 수 있어 optional.
  is_real_hardware?: boolean;
  reader_id: string | null;
  location: string | null;
  updated_at: number | null;
  is_stale: boolean;
};

function getAssetStatusLabel(status: string) {
  switch (status) {
    case 'checked_out':
      return '대여 중';
    case 'inactive':
      return '비활성';
    default:
      return '사용 가능';
  }
}

/** tag_id는 `{공유 UUID}:{major}:{minor}` 형식. UUID는 모든 장비가 동일해 표시할 필요가 없다. */
function formatTagIdentity(tagId: string) {
  const parts = tagId.split(':');
  if (parts.length < 3) return `tag ${tagId}`;
  const [, major, minor] = parts;
  return `major ${major} · minor ${minor}`;
}

function formatAgo(updatedAt: number | null) {
  if (!updatedAt) return '미수신';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - updatedAt);
  if (diff < 5) return '방금';
  if (diff < 60) return `${diff}초 전`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

type MappingFilters = {
  equipmentName: string;
  tagId: string;
  nfcToken: string;
  equipmentType: string;
  mappingState: 'all' | 'mapped' | 'unmapped';
};

const DEMO_NOTICE = '데모 체험 계정에서는 NFC 매핑을 변경할 수 없습니다.';

const DEFAULT_MAPPING_FILTERS: MappingFilters = {
  equipmentName: '',
  tagId: '',
  nfcToken: '',
  equipmentType: 'all',
  mappingState: 'all',
};

const MAPPING_STATE_OPTIONS: Array<{ value: MappingFilters['mappingState']; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'mapped', label: '매핑 완료' },
  { value: 'unmapped', label: '미매핑' },
];

/** 사이드바 자리를 차지하지 않도록, 매핑 절차 안내는 버튼 뒤 팝업으로 둔다. */
function MappingGuideDialog() {
  const steps: Array<{ title: string; body: ReactNode }> = [
    {
      title: '1. 토큰 정하기',
      body: (
        <>
          장비마다 겹치지 않는 짧은 문자열을 정합니다(예: <code>defib-001</code>). 같은 토큰은 한 장비에만 매핑할 수
          있어, 이미 쓰인 토큰을 저장하면 거부됩니다.
        </>
      ),
    },
    {
      title: '2. 목록에서 매핑 저장',
      body: <>오른쪽 목록에서 장비를 찾아 토큰을 입력하고 저장을 누릅니다. 저장하면 태그에 기록할 URL이 나타납니다.</>,
    },
    {
      title: '3. 태그에 URL 기록',
      body: (
        <>
          <strong>NTAG215</strong> 태그에 NFC 쓰기 앱(NFC Tools 등)으로 아래 형식의 URL을 <em>URI 레코드</em>로
          기록합니다.
          <span className="mt-2 block border border-border/70 bg-secondary/40 px-3 py-2 font-mono text-xs break-all">
            {`${PUBLIC_APP_URL}/nfc/<token>`}
          </span>
        </>
      ),
    },
    {
      title: '4. 장비에 부착',
      body: <>금속면은 NFC 신호를 막으므로 플라스틱·도장 면에 붙이고, 스캔하기 쉬운 위치를 고릅니다.</>,
    },
    {
      title: '5. 동작 확인',
      body: <>스마트폰으로 태그를 읽으면 해당 장비 화면이 열리고, 그 화면에서 사용 시작·종료를 처리합니다.</>,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <BookOpen className="h-4 w-4" />
          매핑 가이드
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>NFC 매핑 가이드</DialogTitle>
          <DialogDescription>NFC 태그를 만들어 장비에 붙이기까지의 절차입니다.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {steps.map((step) => (
            <div key={step.title}>
              <div className="font-semibold text-foreground">{step.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}

          <div className="border-t border-border/70 pt-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">매핑을 해제하면</div>
            <p className="mt-1 leading-relaxed">
              그 토큰으로는 더 이상 장비에 접근할 수 없습니다. 태그 자체는 다른 토큰을 다시 기록해 재사용할 수 있습니다.
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function NfcMapping() {
  const isAuthorized = useAuthGuard(() => {
    const session = getStoredAuthSession();
    if (!session?.token || !session.user) return LOGIN_PATH;
    if (session.user.role !== 'admin') return '/equipment';
    return null;
  });
  const [items, setItems] = useState<MappingItem[]>([]);
  const [draftTokens, setDraftTokens] = useState<Record<string, string>>({});
  // 입력 중인 조건(draft)과 목록에 실제로 적용된 조건(applied)을 나눈다.
  // 타이핑할 때마다 목록이 흔들리지 않고, 검색을 눌러야 반영된다.
  const [draftFilters, setDraftFilters] = useState<MappingFilters>(DEFAULT_MAPPING_FILTERS);
  const [filters, setFilters] = useState<MappingFilters>(DEFAULT_MAPPING_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hideSimulated, setHideSimulated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const logout = useLogout();

  // 데모 계정은 매핑을 바꿀 수 없다(백엔드도 403). 요청을 보내기 전에 안내만 띄운다.
  const blockedForDemo = () => {
    if (getStoredAuthSession()?.user?.is_demo !== true) return false;
    setNotice('');
    setError(DEMO_NOTICE);
    return true;
  };

  const fetchMappings = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      const session = getStoredAuthSession();
      if (!session?.token) {
        logout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/admin/nfc-mappings`, {
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
        throw new Error(payload?.detail ?? 'NFC 매핑 목록을 불러오지 못했습니다.');
      }

      const nextItems = Array.isArray(payload.items) ? (payload.items as MappingItem[]) : [];
      setItems(nextItems);
      setDraftTokens(
        nextItems.reduce<Record<string, string>>((acc, item) => {
          acc[item.tag_id] = item.nfc_token ?? '';
          return acc;
        }, {}),
      );
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('NFC 매핑 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [logout]);

  useRunWhenReady(isAuthorized, fetchMappings);

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.equipment_type?.trim()).filter(Boolean) as string[])).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const contains = (value: string | null, query: string) =>
      !query.trim() || (value ?? '').toLowerCase().includes(query.trim().toLowerCase());

    return items.filter((item) => {
      if (!contains(item.equipment_name, filters.equipmentName)) return false;
      if (!contains(item.tag_id, filters.tagId)) return false;
      if (!contains(item.nfc_token, filters.nfcToken)) return false;
      if (filters.equipmentType !== 'all' && item.equipment_type?.trim() !== filters.equipmentType) return false;
      if (filters.mappingState === 'mapped' && !item.nfc_token) return false;
      if (filters.mappingState === 'unmapped' && item.nfc_token) return false;
      return true;
    });
  }, [items, filters]);

  const mappedCount = useMemo(() => items.filter((item) => item.nfc_token).length, [items]);

  const updateDraftFilter = <K extends keyof MappingFilters>(key: K, value: MappingFilters[K]) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  // 조건을 적용하면 결과 집합이 달라지므로 첫 페이지부터 다시 본다.
  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(draftFilters);
    setPage(1);
  };

  const onResetFilters = () => {
    setDraftFilters(DEFAULT_MAPPING_FILTERS);
    setFilters(DEFAULT_MAPPING_FILTERS);
    setPage(1);
  };

  // 검색 조건이 아니라 보기 설정이라, 검색 버튼과 무관하게 즉시 반영한다.
  const visibleItems = hideSimulated ? filteredItems.filter((item) => item.is_real_hardware !== false) : filteredItems;

  // 결과가 줄어 현재 페이지가 사라진 경우에도 빈 화면이 되지 않도록 렌더 시점에 페이지를 좁힌다.
  const safePage = clampPage(page, getTotalPages(visibleItems.length, pageSize));
  const pagedItems = getPageSlice(visibleItems, safePage, pageSize);

  const saveMapping = async (tagId: string) => {
    if (blockedForDemo()) return;
    const token = (draftTokens[tagId] ?? '').trim();
    if (!token) {
      setError('저장할 NFC 토큰을 입력하세요.');
      return;
    }

    setSavingTagId(tagId);
    setError('');
    setNotice('');
    try {
      const session = getStoredAuthSession();
      if (!session?.token) {
        logout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/admin/nfc-mappings`, {
        method: 'POST',
        headers: buildAuthHeaders(session.token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          tag_id: tagId,
          nfc_token: token,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? 'NFC 매핑 저장에 실패했습니다.');
      }

      setNotice('NFC 매핑을 저장했습니다.');
      await fetchMappings();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('NFC 매핑 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTagId(null);
    }
  };

  const removeMapping = async (tagId: string) => {
    if (blockedForDemo()) return;
    setRemovingTagId(tagId);
    setError('');
    setNotice('');
    try {
      const session = getStoredAuthSession();
      if (!session?.token) {
        logout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/admin/nfc-mappings/${encodeURIComponent(tagId)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(session.token),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? 'NFC 매핑 해제에 실패했습니다.');
      }

      setNotice('NFC 매핑을 해제했습니다.');
      await fetchMappings();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('NFC 매핑 해제 중 오류가 발생했습니다.');
    } finally {
      setRemovingTagId(null);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell bleed actions={<AdminNav active="nfc-mapping" />} contentClassName="pt-4 sm:pt-5">
      {/* 사이드바를 상하 꽉 채우기 위해, AppShell 공용 상하 패딩(contentClassName="pt-4 sm:pt-5" +
          .app-shell__content의 3.5rem 하단 패딩)을 이 행 전체에서 걷어내고, 사이드바가 아닌
          나머지(매핑 목록) 쪽에만 그 패딩을 되돌려준다. */}
      {/* xl:items-start — 자식이 stretch로 늘어나면 사이드바의 sticky가 동작하지 않는다 */}
      <div className="-mt-4 -mb-14 flex w-full flex-col gap-4 sm:-mt-5 xl:flex-row xl:items-start">
        <ResizableSidebar testId="nfc-mapping-sidebar">
          <>
            <div className="panel-header shrink-0">
              <div>
                <div className="panel-title">매핑 검색</div>
              </div>
            </div>

            {/* 조건을 항목별로 나눠 무엇으로 좁힐 수 있는지 한눈에 보이게 한다.
                버튼은 마지막 필드 바로 아래에 붙인다 — 패널 바닥으로 내리면 필드와 멀어져 따로 논다. */}
            <form onSubmit={onSearch} className="flex min-h-0 shrink flex-col">
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <label htmlFor="filter-equipment-name" className="block text-sm font-medium">
                    장비명
                  </label>
                  <Input
                    id="filter-equipment-name"
                    value={draftFilters.equipmentName}
                    onChange={(e) => updateDraftFilter('equipmentName', e.target.value)}
                    placeholder="예: 수액펌프"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="filter-tag-id" className="block text-sm font-medium">
                    태그
                  </label>
                  <Input
                    id="filter-tag-id"
                    value={draftFilters.tagId}
                    onChange={(e) => updateDraftFilter('tagId', e.target.value)}
                    placeholder="major 또는 minor (예: 0007)"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="filter-nfc-token" className="block text-sm font-medium">
                    NFC 토큰
                  </label>
                  <Input
                    id="filter-nfc-token"
                    value={draftFilters.nfcToken}
                    onChange={(e) => updateDraftFilter('nfcToken', e.target.value)}
                    placeholder="예: defib-001"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">장비 유형</label>
                  <Select
                    value={draftFilters.equipmentType}
                    onValueChange={(value) => updateDraftFilter('equipmentType', value)}
                  >
                    <SelectTrigger aria-label="장비 유형">
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 유형</SelectItem>
                      {typeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">매핑 상태</label>
                  <Select
                    value={draftFilters.mappingState}
                    onValueChange={(value) =>
                      updateDraftFilter('mappingState', value as MappingFilters['mappingState'])
                    }
                  >
                    <SelectTrigger aria-label="매핑 상태">
                      <SelectValue placeholder="매핑 상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAPPING_STATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex shrink-0 gap-2">
                <Button type="submit" className="flex-1">
                  <Search className="h-4 w-4" />
                  검색
                </Button>
                <Button type="button" variant="outline" onClick={onResetFilters}>
                  초기화
                </Button>
              </div>
            </form>

            {/* 남는 세로 공간은 여기서 흡수해, 가이드 버튼만 패널 바닥에 남는다. */}
            <div className="min-h-4 flex-1" />

            <div className="shrink-0 border-t border-border/70 pt-4">
              <MappingGuideDialog />
            </div>
          </>
        </ResizableSidebar>

        <div className="flex w-full min-w-0 flex-1 justify-center pt-4 pb-14 pr-[clamp(1rem,2.5vw,2rem)] sm:pt-5">
          <div className="w-full max-w-[1360px]">
            <section className="surface-panel p-5 fade-rise-delay">
              <div className="panel-header">
                <div>
                  <div className="panel-title">장비별 NFC 토큰</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={hideSimulated}
                      onChange={(event) => {
                        setHideSimulated(event.target.checked);
                        setPage(1);
                      }}
                    />
                    시뮬레이션 데이터 숨기기
                  </label>
                  <Badge variant="outline">활성 장비 {items.length}개</Badge>
                  <Badge variant="outline">매핑 완료 {mappedCount}개</Badge>
                  <Button variant="outline" onClick={fetchMappings} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    새로고침
                  </Button>
                </div>
              </div>

              {error ? <div className="alert alert-error">{error}</div> : null}
              {notice ? <div className="alert alert-success">{notice}</div> : null}

              {isLoading ? (
                <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center text-muted-foreground">
                  매핑 목록을 불러오는 중입니다.
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center text-muted-foreground">
                  표시할 장비가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {pagedItems.map((item) => {
                    const tokenDraft = draftTokens[item.tag_id] ?? '';
                    const trimmedToken = tokenDraft.trim();
                    const nfcUrl = trimmedToken ? `${PUBLIC_APP_URL}/nfc/${trimmedToken}` : null;
                    return (
                      <section key={item.tag_id} className="border border-border/70 bg-background/80 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">
                                {item.equipment_name}
                              </h3>
                              <Badge variant="outline">{getAssetStatusLabel(item.asset_status)}</Badge>
                              <Badge variant="outline">{item.equipment_type?.trim() || '미분류'}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatTagIdentity(item.tag_id)}
                              {item.serial_number ? ` · serial ${item.serial_number}` : ''}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              현재 위치: {item.location ?? '미수신'} · 최근 수신: {formatAgo(item.updated_at)}
                            </div>
                          </div>

                          <div className="grid w-full gap-3 lg:max-w-[440px]">
                            <Input
                              value={tokenDraft}
                              onChange={(e) =>
                                setDraftTokens((current) => ({
                                  ...current,
                                  [item.tag_id]: e.target.value,
                                }))
                              }
                              placeholder="예: defib-001"
                            />
                            <div className="rounded-lg border border-border/70 bg-secondary/35 px-4 py-3 text-xs text-muted-foreground break-all">
                              {nfcUrl ?? '토큰을 입력하면 여기에 태그에 기록할 URL이 표시됩니다.'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => saveMapping(item.tag_id)}
                                disabled={savingTagId === item.tag_id || removingTagId === item.tag_id}
                              >
                                <Save className="h-4 w-4" />
                                {savingTagId === item.tag_id ? '저장 중...' : '저장'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => removeMapping(item.tag_id)}
                                disabled={
                                  !item.nfc_token || savingTagId === item.tag_id || removingTagId === item.tag_id
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                {removingTagId === item.tag_id ? '해제 중...' : '매핑 해제'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {visibleItems.length > 0 ? (
                <Pagination
                  page={safePage}
                  pageSize={pageSize}
                  totalItems={visibleItems.length}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPageSize(nextSize);
                    setPage(1);
                  }}
                />
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
