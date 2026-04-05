import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { ArrowRight, Fingerprint, Lock, Mail, ShieldCheck, Waves } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: '관리자(Admin)' },
] as const;
type LoginRole = (typeof ROLE_OPTIONS)[number]['value'];

const TRUST_POINTS = [
  {
    title: 'RTLS 가시성',
    copy: '병원 내부 리더 수신 상태를 기준으로 장비 위치를 연속적으로 확인합니다.',
    icon: Waves,
  },
  {
    title: 'NFC 기반 인증',
    copy: '인가된 의료진 계정만 사용 이력 생성 흐름에 진입할 수 있도록 설계합니다.',
    icon: Fingerprint,
  },
  {
    title: '무결성 검증',
    copy: 'DB 이력과 블록체인 해시 비교를 통해 변경 가능성을 탐지합니다.',
    icon: ShieldCheck,
  },
] as const;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('staff');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

      sessionStorage.setItem('auth_user', JSON.stringify(payload.user));
      const loginRole = (payload.user?.role as string | undefined)?.toLowerCase();
      navigate(loginRole === 'admin' ? '/verification' : '/equipment');
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
    navigate('/signup');
  };

  return (
    <AppShell
      title="로그인"
      subtitle="권한에 따라 장비 검색 또는 무결성 검증 화면으로 이동합니다."
      headerAside={
        <div className="surface-panel p-6">
          <div className="panel-header !mb-4">
            <div>
              <div className="panel-title">접속 준비 상태</div>
              <p className="panel-copy mt-2">RTLS, 인증 API, 권한 분기 상태를 간단히 확인합니다.</p>
            </div>
            <Badge variant="outline">Secure Session</Badge>
          </div>
          <div className="space-y-3">
            <div className="inline-meta__item w-full justify-between">
              <span className="flex items-center gap-2">
                <span className="status-dot status-dot--live" />
                RTLS 리더 연동
              </span>
              <strong className="text-foreground">활성</strong>
            </div>
            <div className="inline-meta__item w-full justify-between">
              <span className="flex items-center gap-2">
                <span className="status-dot status-dot--live" />
                인증 API
              </span>
              <strong className="text-foreground">연결됨</strong>
            </div>
            <div className="inline-meta__item w-full justify-between">
              <span className="flex items-center gap-2">
                <span className="status-dot status-dot--warn" />
                운영 권한 분기
              </span>
              <strong className="text-foreground">Staff / Admin</strong>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)]">
        <section className="surface-panel p-6 fade-rise">
          <div className="panel-header">
            <div>
              <div className="panel-title">로그인</div>
            </div>
            <Badge variant="outline">Hospital Access</Badge>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">아이디(이메일)</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11"
                  required
                />
              </div>
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

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-border accent-[#0071e3]" />
                로그인 상태 유지
              </label>
              <span>권한에 맞는 화면으로 자동 분기</span>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="submit" className="flex-1" size="lg" disabled={isLoading}>
                {isLoading ? '로그인 중...' : '로그인'}
                {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={handleSignUp}>
                회원가입
              </Button>
            </div>
          </form>
        </section>

        <aside className="space-y-3 fade-rise-delay">
          {TRUST_POINTS.map(({ title, copy, icon: Icon }) => (
            <section key={title} className="surface-panel p-6">
              <div className="flex items-start gap-4">
                <div className="brand-mark h-11 w-11 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[1.05rem]">{title}</h3>
                  <p className="panel-copy">{copy}</p>
                </div>
              </div>
            </section>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
