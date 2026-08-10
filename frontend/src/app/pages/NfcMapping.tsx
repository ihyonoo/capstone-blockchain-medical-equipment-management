import { useCallback, useMemo, useState } from 'react';
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
import { RefreshCw, Save, Search, Trash2 } from 'lucide-react';

type MappingItem = {
  tag_id: string;
  equipment_name: string;
  equipment_type: string | null;
  serial_number: string | null;
  nfc_token: string | null;
  asset_status: string;
  is_active: boolean;
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

export default function NfcMapping() {
  const isAuthorized = useAuthGuard(() => {
    const session = getStoredAuthSession();
    if (!session?.token || !session.user) return LOGIN_PATH;
    if (session.user.role !== 'admin') return '/equipment';
    return null;
  });
  const [items, setItems] = useState<MappingItem[]>([]);
  const [draftTokens, setDraftTokens] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const logout = useLogout();

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

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.equipment_name.toLowerCase().includes(q) ||
        item.tag_id.toLowerCase().includes(q) ||
        (item.nfc_token ?? '').toLowerCase().includes(q) ||
        (item.location ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  const mappedCount = useMemo(() => items.filter((item) => item.nfc_token).length, [items]);

  // 결과가 줄어 현재 페이지가 사라진 경우에도 빈 화면이 되지 않도록 렌더 시점에 페이지를 좁힌다.
  const safePage = clampPage(page, getTotalPages(filteredItems.length, pageSize));
  const pagedItems = getPageSlice(filteredItems, safePage, pageSize);

  const saveMapping = async (tagId: string) => {
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

            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="장비명, 태그 ID, NFC 토큰, 위치 검색"
                className="pl-11"
              />
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              <div className="panel-title">매핑 가이드</div>
              <p className="panel-copy">
                NTAG215에는 <strong>{`${PUBLIC_APP_URL}/nfc/<token>`}</strong> 형식의 URL을 기록하면 됩니다.
              </p>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                같은 토큰은 한 장비에만 매핑할 수 있습니다. 저장 후 휴대폰으로 태그를 읽으면 해당 장비 상세 페이지로
                진입합니다.
              </div>
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
                <div className="flex flex-wrap items-center justify-end gap-2">
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
              ) : filteredItems.length === 0 ? (
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
                              tag {item.tag_id}
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

              {filteredItems.length > 0 ? (
                <Pagination
                  page={safePage}
                  pageSize={pageSize}
                  totalItems={filteredItems.length}
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
