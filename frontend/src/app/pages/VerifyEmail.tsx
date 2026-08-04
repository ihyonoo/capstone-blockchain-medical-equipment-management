import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import AppShell from '../components/layout/AppShell';
import { API_BASE_URL } from '../lib/runtime';
import { LOGIN_PATH } from '../lib/auth';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasToken = Boolean(searchParams.get('token'));
  const [status, setStatus] = useState<Status>(() => (hasToken ? 'loading' : 'error'));
  const [message, setMessage] = useState(() =>
    hasToken ? '이메일 인증을 확인하는 중입니다...' : '유효하지 않은 인증 링크입니다.',
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // React StrictMode 이중 실행으로 일회성 토큰이 소진되는 것을 막는다.
    ran.current = true;

    const token = searchParams.get('token') ?? '';
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.detail ?? '이메일 인증에 실패했습니다.');
        }
        setStatus('success');
        setMessage(payload.message ?? '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '이메일 인증 처리 중 오류가 발생했습니다.');
      }
    })();
  }, [searchParams]);

  return (
    <AppShell>
      <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
        <section className="surface-panel p-6 fade-rise sm:p-8">
          <div className="mb-6">
            <div className="panel-title">이메일 인증</div>
          </div>

          {status === 'loading' ? <div className="alert">{message}</div> : null}
          {status === 'success' ? <div className="alert alert-success">{message}</div> : null}
          {status === 'error' ? <div className="alert alert-error">{message}</div> : null}

          {status !== 'loading' ? (
            <div className="pt-4">
              <Button className="w-full" size="lg" onClick={() => navigate(LOGIN_PATH, { replace: true })}>
                로그인하러 가기
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
