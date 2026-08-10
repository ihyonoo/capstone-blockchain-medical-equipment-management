import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import AuthSplitLayout from '../components/layout/AuthSplitLayout';
import GoogleButton from '../components/GoogleButton';
import { getHomePath, getRedirectTarget, storeAuthSession, withRedirectQuery } from '../lib/auth';
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
      navigate(redirectTarget ?? getHomePath(payload.user), { replace: true });
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
    <AuthSplitLayout title="로그인" subtitle="장비의 위치와 사용 이력을 확인하려면 로그인해 주세요.">
      <form onSubmit={handleLogin} className="space-y-5">
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
          {/* 선택지가 둘뿐이라 드롭다운 대신 한눈에 보이는 라디오 세그먼트로 둔다. */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="로그인 권한">
            {ROLE_OPTIONS.map((item) => (
              <label key={item.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="login-role"
                  value={item.value}
                  checked={role === item.value}
                  onChange={() => setRole(item.value)}
                  className="peer sr-only"
                />
                <span className="flex h-12 items-center justify-center rounded-md border border-input bg-input-background text-[0.98rem] tracking-[-0.01em] text-muted-foreground transition-[border-color,box-shadow,background-color,color] peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-medium peer-checked:text-foreground peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40">
                  {item.label}
                </span>
              </label>
            ))}
          </div>
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

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </Button>

        <div className="auth-split__links">
          <button type="button" className="auth-split__link" onClick={handleSignUp}>
            회원가입
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="auth-split__link" onClick={() => navigate('/find-id')}>
              아이디 찾기
            </button>
            <span aria-hidden>·</span>
            <button type="button" className="auth-split__link" onClick={() => navigate('/forgot-password')}>
              비밀번호 찾기
            </button>
          </div>
        </div>

        <div className="auth-split__divider">
          <span>또는</span>
        </div>

        <GoogleButton mode="login" />
      </form>
    </AuthSplitLayout>
  );
}
