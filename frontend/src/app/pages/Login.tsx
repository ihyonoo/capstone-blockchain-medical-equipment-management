import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import GoogleButton from '../components/GoogleButton';
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
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('oauth_error') ? 'Google 로그인에 실패했습니다. 다시 시도해 주세요.' : '';
  });
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location.search);

  // Google 로그인 실패 시 백엔드가 /#oauth_error=... 로 되돌려 보낸다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('oauth_error')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setResendMsg('');
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
        const detail = payload?.detail;
        // 이메일 미인증 계정: detail 은 {code, message, email} 형태의 객체다.
        if (detail && typeof detail === 'object' && detail.code === 'email_unverified') {
          setUnverifiedEmail(detail.email ?? email.trim());
          setError(detail.message ?? '이메일 인증이 필요합니다.');
          return;
        }
        throw new Error(typeof detail === 'string' ? detail : '로그인에 실패했습니다.');
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

  const handleResendVerification = async () => {
    setResendMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const payload = await res.json().catch(() => null);
      setResendMsg(payload?.message ?? '인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.');
    } catch {
      setResendMsg('인증 메일 재발송 중 오류가 발생했습니다.');
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
                {unverifiedEmail ? (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="mt-2 block font-medium underline underline-offset-2"
                  >
                    인증 메일 다시 보내기
                  </button>
                ) : null}
              </div>
            ) : null}
            {resendMsg ? <div className="alert alert-success">{resendMsg}</div> : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="submit" className="flex-1" size="lg" disabled={isLoading}>
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={handleSignUp}>
                회원가입
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1 text-sm text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={() => navigate('/find-id')}>
                아이디 찾기
              </button>
              <span aria-hidden>·</span>
              <button type="button" className="hover:text-foreground" onClick={() => navigate('/forgot-password')}>
                비밀번호 찾기
              </button>
            </div>

            <div className="relative py-2">
              <div className="border-t border-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                또는
              </span>
            </div>

            <GoogleButton mode="login" />
          </form>
        </section>
      </div>
    </AppShell>
  );
}
