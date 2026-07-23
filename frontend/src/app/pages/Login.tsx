import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { getRedirectTarget, storeAuthSession, withRedirectQuery } from '../lib/auth';
import { API_BASE_URL } from '../lib/runtime';

const ROLE_OPTIONS = [
  { value: 'staff', label: '의료진' },
  { value: 'admin', label: '관리자' },
] as const;
type LoginRole = (typeof ROLE_OPTIONS)[number]['value'];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('staff');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location.search);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email.trim(),
          password,
          role,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? '로그인에 실패했습니다.');
      }
      if (!payload.user || typeof payload.token !== 'string' || payload.token.length === 0) {
        throw new Error('로그인 응답이 올바르지 않습니다.');
      }

      storeAuthSession({
        token: payload.token,
        expires_at: Number(payload.expires_at ?? 0),
        user: payload.user,
      });
      const loginRole = (payload.user?.role as string | undefined)?.toLowerCase();
      navigate(redirectTarget ?? (loginRole === 'admin' ? '/verification' : '/equipment'), { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('로그인 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate(withRedirectQuery('/signup', redirectTarget));
  };

  return (
    <AppShell>
      <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
        <section className="surface-panel p-6 fade-rise sm:p-8">
          <div className="mb-6">
            <div className="panel-title">로그인</div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">아이디</Label>
              <Input
                id="email"
                type="text"
                placeholder="test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>로그인 권한</Label>
              <Select value={role} onValueChange={(value) => setRole(value as LoginRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="권한 선택" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <div className="alert alert-error">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="submit" className="flex-1" size="lg" disabled={isLoading}>
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={handleSignUp}>
                회원가입
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
