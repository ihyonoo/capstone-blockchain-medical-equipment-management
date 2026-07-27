import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import AppShell from '../components/layout/AppShell';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { buildAuthHeaders, clearStoredAuthSession, getStoredAuthSession, getStoredAuthUser, withRedirectQuery } from '../lib/auth';
import { API_BASE_URL } from '../lib/runtime';
import { LogOut } from 'lucide-react';

type NfcEquipmentItem = {
  tag_id: string;
  equipment_name: string;
  equipment_type: string | null;
  serial_number: string | null;
  nfc_token: string;
  asset_status: string;
  current_holder_user_id: number | null;
  current_holder_name: string | null;
  current_usage_id: number | null;
  reader_id: string | null;
  location: string | null;
  updated_at: number | null;
  is_stale: boolean;
};

function getAssetStatusLabel(status: string) {
  switch (status) {
    case 'checked_out':
      return '대여 중';
    case 'maintenance':
      return '점검 중';
    case 'inactive':
      return '비활성';
    default:
      return '사용 가능';
  }
}

export default function NfcEquipment() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const token = params.token ?? '';
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [item, setItem] = useState<NfcEquipmentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const currentUser = useMemo(() => getStoredAuthUser(), []);
  const currentAuthToken = useMemo(() => getStoredAuthSession()?.token ?? null, []);

  const logout = () => {
    clearStoredAuthSession();
    navigate('/', { replace: true });
  };

  const fetchItem = async (nfcToken: string) => {
    setIsLoading(true);
    setError('');
    try {
      const authToken = getStoredAuthSession()?.token;
      if (!authToken) {
        logout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/nfc/${encodeURIComponent(nfcToken)}`, {
        method: 'GET',
        cache: 'no-store',
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? 'NFC 장비 정보를 불러오지 못했습니다.');
      }
      setItem((payload.item as NfcEquipmentItem) ?? null);
    } catch (err) {
      setItem(null);
      if (err instanceof Error) setError(err.message);
      else setError('NFC 장비 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // NFC URL 직진입 시 로그인 페이지로 보내더라도, 현재 진입 경로는 redirect로 보존한다.
    if (!currentUser || !currentAuthToken) {
      navigate(withRedirectQuery('/', `${location.pathname}${location.search}`), { replace: true });
      return;
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
      navigate(withRedirectQuery('/', `${location.pathname}${location.search}`), { replace: true });
      return;
    }
    setIsAuthorized(true);
  }, [currentAuthToken, currentUser, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!isAuthorized || !token) return;
    void fetchItem(token);
  }, [isAuthorized, token]);

  const handleUsageAction = async (action: 'checkout' | 'return') => {
    if (!currentUser || !token) return;
    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      const authToken = getStoredAuthSession()?.token;
      if (!authToken) {
        logout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/usage/${action}`, {
        method: 'POST',
        headers: buildAuthHeaders(authToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          nfc_token: token,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? `장비 ${action === 'checkout' ? '사용 시작' : '사용 종료'}에 실패했습니다.`);
      }
      setNotice(action === 'checkout' ? '장비 상태가 대여 중으로 변경되었습니다.' : '장비 상태가 사용 가능으로 변경되었습니다.');
      await fetchItem(token);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('장비 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHolder = Boolean(item && currentUser && item.current_holder_user_id === currentUser.user_id);
  const canCheckout = item?.asset_status === 'available';
  const canReturn = item?.asset_status === 'checked_out' && (isHolder || currentUser?.role === 'admin');

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => navigate('/me')}
          >
            마이페이지
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={logout}>
            <LogOut className="h-2.5 w-2.5" />
            로그아웃
          </Button>
        </>
      }
      headerAside={
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-[1.35rem] border border-border bg-card p-3 sm:p-4">
            <div className="metric-label truncate">스캔 토큰</div>
            <div className="mt-1 truncate text-xs font-semibold leading-5 text-foreground sm:mt-2 sm:text-sm sm:leading-6">
              {token || '-'}
            </div>
          </div>
          <div className="rounded-[1.35rem] border border-border bg-card p-3 sm:p-4">
            <div className="metric-label truncate">장비 상태</div>
            <div className="mt-1 truncate text-xs font-semibold tracking-[-0.03em] text-foreground sm:mt-2 sm:text-sm sm:text-lg">
              {item ? getAssetStatusLabel(item.asset_status) : '-'}
            </div>
          </div>
          <div className="rounded-[1.35rem] border border-border bg-card p-3 sm:p-4">
            <div className="metric-label truncate">현재 위치</div>
            <div className="mt-1 truncate text-xs font-semibold tracking-[-0.03em] text-foreground sm:mt-2 sm:text-sm sm:text-lg">
              {item?.location ?? '미수신'}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="surface-panel p-5 fade-rise">
          <div className="panel-header">
            <div>
              <div className="panel-title">{item?.equipment_name ?? '장비 정보'}</div>
              {item ? <p className="panel-copy mt-2">tag ID: {item.tag_id}</p> : null}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center text-muted-foreground">
              장비 정보를 불러오는 중입니다.
            </div>
          ) : error ? (
            <div className="alert alert-error px-5 py-5">{error}</div>
          ) : !item ? (
            <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center text-muted-foreground">
              매핑된 장비를 찾을 수 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {notice ? (
                <div className="alert alert-success px-5 py-4">{notice}</div>
              ) : null}

              <section className="rounded-[28px] border border-border/70 bg-background/80 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">장비 사용 상태 전환</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {item.asset_status === 'available'
                        ? '이 장비는 현재 사용 가능합니다.'
                        : item.current_holder_name
                          ? `${item.current_holder_name} 사용자가 현재 대여 중입니다.`
                          : '현재 대여 중인 장비입니다.'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button className="w-full sm:w-auto" onClick={() => handleUsageAction('checkout')} disabled={!canCheckout || isSubmitting}>
                      {isSubmitting && canCheckout ? '처리 중...' : '사용 시작'}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => handleUsageAction('return')}
                      disabled={!canReturn || isSubmitting}
                    >
                      {isSubmitting && canReturn ? '처리 중...' : '사용 종료'}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
