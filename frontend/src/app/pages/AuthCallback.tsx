import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import AppShell from '../components/layout/AppShell';
import { getHomePath, storeAuthSession, LOGIN_PATH } from '../lib/auth';
import { API_BASE_URL } from '../lib/runtime';

// Google 로그인 성공 후 백엔드가 #code=<handoff> 프래그먼트로 리다이렉트한다.
// 이 코드를 실제 세션 토큰으로 교환한다(토큰이 URL 기록에 남지 않도록 fragment 사용).
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('code') ? '' : '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.';
  });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code');
    if (!code) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/session/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok || !payload.token || !payload.user) {
          throw new Error(payload?.detail ?? '로그인에 실패했습니다.');
        }
        storeAuthSession({
          token: payload.token,
          expires_at: Number(payload.expires_at ?? 0),
          user: payload.user,
        });
        navigate(getHomePath(payload.user), { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.');
      }
    })();
  }, [navigate]);

  return (
    <AppShell>
      <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
        <section className="surface-panel p-6 fade-rise sm:p-8">
          <div className="mb-6">
            <div className="panel-title">로그인 처리 중</div>
          </div>
          {error ? (
            <>
              <div className="alert alert-error">{error}</div>
              <div className="pt-4">
                <Button className="w-full" size="lg" onClick={() => navigate(LOGIN_PATH, { replace: true })}>
                  로그인으로 돌아가기
                </Button>
              </div>
            </>
          ) : (
            <div className="alert">Google 로그인 정보를 확인하는 중입니다...</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
