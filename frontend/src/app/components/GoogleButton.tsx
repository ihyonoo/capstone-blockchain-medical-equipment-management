import { Button } from './ui/button';
import { getRedirectTarget } from '../lib/auth';
import { API_BASE_URL } from '../lib/runtime';

// 흑백 디자인 시스템에 맞춘 Google 계속하기 버튼(브랜드 컬러 미사용).
// 백엔드 /auth/google/start 로 이동하면 redirect 흐름이 시작된다.
// 로그인 화면이 들고 있던 redirect를 백엔드로 넘긴다. 구글로 나갔다 돌아오는 사이
// 브라우저 상태가 끊기므로, 이 값을 state에 실어 보내지 않으면 "원래 가려던 곳"이 사라진다.
export function buildGoogleStartUrl(apiBaseUrl: string, mode: 'login' | 'signup', search: string): string {
  const params = new URLSearchParams({ mode });
  const redirect = getRedirectTarget(search);
  if (redirect) params.set('redirect', redirect);
  return `${apiBaseUrl}/auth/google/start?${params.toString()}`;
}

export default function GoogleButton({ mode, label }: { mode: 'login' | 'signup'; label?: string }) {
  const handleClick = () => {
    window.location.href = buildGoogleStartUrl(API_BASE_URL, mode, window.location.search);
  };
  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleClick}>
      {label ?? 'Google로 계속하기'}
    </Button>
  );
}
