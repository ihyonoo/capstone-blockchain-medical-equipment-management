import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { clearStoredAuthSession } from './auth';

// resolveRedirect는 마운트 시 단 한 번만 호출된다: null이면 인가됨, 문자열이면 그 경로로 리다이렉트.
export function useAuthGuard(resolveRedirect: () => string | null): boolean {
  const navigate = useNavigate();
  const [redirectTarget] = useState(resolveRedirect);

  useEffect(() => {
    if (redirectTarget) navigate(redirectTarget, { replace: true });
  }, [redirectTarget, navigate]);

  return redirectTarget === null;
}

export function useLogout() {
  const navigate = useNavigate();
  return useCallback(() => {
    clearStoredAuthSession();
    navigate('/', { replace: true });
  }, [navigate]);
}

// 마운트 시(ready === true) 표준 data-fetching 패턴으로 run()을 한 번 실행한다.
export function useRunWhenReady(ready: boolean, run: () => void) {
  useEffect(() => {
    if (!ready) return;
    run();
  }, [ready, run]);
}
