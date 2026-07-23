import { Button } from './ui/button';
import { API_BASE_URL } from '../lib/runtime';

// 흑백 디자인 시스템에 맞춘 Google 계속하기 버튼(브랜드 컬러 미사용).
// 백엔드 /auth/google/start 로 이동하면 redirect 흐름이 시작된다.
export default function GoogleButton({
  mode,
  label,
}: {
  mode: 'login' | 'signup';
  label?: string;
}) {
  const handleClick = () => {
    window.location.href = `${API_BASE_URL}/auth/google/start?mode=${mode}`;
  };
  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleClick}>
      {label ?? 'Google로 계속하기'}
    </Button>
  );
}
