import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import AppShell from '../components/layout/AppShell';
import { API_BASE_URL } from '../lib/runtime';
import { LOGIN_PATH } from '../lib/auth';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? '요청 처리에 실패했습니다.');
      }
      setMessage(payload.message ?? '가입된 계정이 있다면 비밀번호 재설정 메일을 보냈습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
        <section className="surface-panel p-6 fade-rise sm:p-8">
          <div className="mb-6">
            <div className="panel-title">비밀번호 찾기</div>
            <p className="panel-copy mt-2">가입 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error ? <div className="alert alert-error">{error}</div> : null}
            {message ? <div className="alert alert-success">{message}</div> : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="submit" className="flex-1" size="lg" disabled={isLoading}>
                {isLoading ? '전송 중...' : '재설정 메일 보내기'}
              </Button>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => navigate(LOGIN_PATH)}>
                <ChevronLeft className="h-4 w-4" />
                로그인으로 돌아가기
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
