import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AppShell from '../components/layout/AppShell';
import { ChevronLeft, ShieldCheck, UserRoundPlus, Waves } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const POSITION_OPTIONS = ['간호사', '의사', '간호조무사', '방사선사', '임상병리사', '물리치료사', '기타'];
const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: '관리자(Admin)' },
] as const;
type SignUpRole = (typeof ROLE_OPTIONS)[number]['value'];

const ROLE_SUMMARY = [
  {
    title: 'Staff 계정',
    copy: '부서와 직책 정보를 함께 받아 장비 사용 이력과 연결합니다.',
    icon: UserRoundPlus,
  },
  {
    title: 'Admin 계정',
    copy: '전체 사용 이력 조회와 무결성 검증 화면에 접근할 수 있습니다.',
    icon: ShieldCheck,
  },
  {
    title: 'RTLS 운영 연동',
    copy: '등록된 계정은 실제 장비 추적 흐름과 동일한 인증 경로를 사용합니다.',
    icon: Waves,
  },
] as const;

export default function SignUp() {
  const navigate = useNavigate();
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
      setTimeout(() => navigate('/'), 700);
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
    <AppShell
      title="회원가입"
      subtitle="권한, 부서, 직책 정보를 등록합니다."
      headerAside={
        <div className="surface-panel p-6">
          <div className="panel-title">가입 정책</div>
          <p className="panel-copy mt-2">Staff는 직책 정보가 필요하고, Admin은 검증 화면 중심으로 사용됩니다.</p>
          <div className="mt-4 inline-meta">
            <span className="inline-meta__item">Staff requires position</span>
            <span className="inline-meta__item">Admin review access</span>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-panel p-6 fade-rise">
          <div className="panel-header">
            <div>
              <div className="panel-title">회원가입</div>
            </div>
            <Badge variant="outline">{role === 'admin' ? 'Admin Flow' : 'Staff Flow'}</Badge>
          </div>

          <form onSubmit={handleSignUp} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="username">아이디(이메일)</Label>
              <Input
                id="username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="example@email.com"
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
              <Select value={role} onValueChange={(value) => setRole(value as SignUpRole)}>
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
                placeholder="8자 이상 입력"
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
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => navigate('/')}>
                <ChevronLeft className="h-4 w-4" />
                로그인으로 돌아가기
              </Button>
            </div>
          </form>
        </section>

        <aside className="space-y-3 fade-rise-delay">
          {ROLE_SUMMARY.map(({ title, copy, icon: Icon }) => (
            <section key={title} className="surface-panel p-6">
              <div className="flex items-start gap-4">
                <div className="brand-mark h-11 w-11 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[1.05rem]">{title}</h3>
                  <p className="panel-copy mt-2">{copy}</p>
                </div>
              </div>
            </section>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
