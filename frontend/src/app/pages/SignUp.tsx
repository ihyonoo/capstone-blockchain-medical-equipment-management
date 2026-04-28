import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../components/ui/utils';
import { getRedirectTarget, withRedirectQuery } from '../lib/auth';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:8000`;
const POSITION_OPTIONS = ['간호사', '의사', '간호조무사', '방사선사', '임상병리사', '물리치료사', '기타'];
const ROLE_OPTIONS = [
  { value: 'staff', label: '의료진' },
  { value: 'admin', label: '관리자' },
] as const;
type SignUpRole = (typeof ROLE_OPTIONS)[number]['value'];

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location.search);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('간호사');
  const [role, setRole] = useState<SignUpRole>('staff');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isAdminRole = role === 'admin';

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          display_name: displayName.trim(),
          password,
          department: isAdminRole ? null : department.trim() || null,
          position: isAdminRole ? null : position,
          role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail ?? '회원가입에 실패했습니다.');
      }

      setSuccess('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
      setTimeout(() => navigate(withRedirectQuery('/', redirectTarget), { replace: true }), 700);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('회원가입 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto mt-6 w-full max-w-3xl sm:mt-8">
        <section className="surface-panel p-6 fade-rise sm:p-8">
          <div className="mb-6">
            <div className="panel-title">회원가입</div>
          </div>

          <form onSubmit={handleSignUp} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="test"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="displayName">이름</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="홍길동"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>가입 권한</Label>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="가입 권한 선택">
                {ROLE_OPTIONS.map((item) => {
                  const selected = role === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRole(item.value)}
                      className={cn(
                        'rounded-3xl border px-4 py-4 text-left transition-all duration-200',
                        selected
                          ? 'border-primary bg-primary/8 shadow-[0_10px_24px_rgba(0,113,227,0.12)]'
                          : 'border-white/70 bg-white/72 hover:-translate-y-0.5 hover:bg-white/88',
                      )}
                    >
                      <div className="text-base font-semibold text-foreground">{item.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isAdminRole ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="department">부서</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="내과"
                  />
                </div>

                <div className="space-y-2">
                  <Label>직책</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="직책 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 다시 입력"
                required
              />
            </div>

            {error ? (
              <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row">
              <Button type="submit" className="flex-1" size="lg" disabled={isLoading}>
                {isLoading ? '가입 중...' : '회원가입'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => navigate(withRedirectQuery('/', redirectTarget))}
              >
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
