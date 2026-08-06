import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LogOut } from 'lucide-react';
import { clearStoredAuthSession, LOGIN_PATH } from '../../lib/auth';

type StaffNavProps = {
  active: 'equipment' | 'mypage';
};

const TABS: { key: StaffNavProps['active']; label: string; path: string }[] = [
  { key: 'equipment', label: '장비 검색', path: '/equipment' },
  { key: 'mypage', label: '마이페이지', path: '/me' },
];

export default function StaffNav({ active }: StaffNavProps) {
  const navigate = useNavigate();

  const logout = () => {
    clearStoredAuthSession();
    navigate(LOGIN_PATH, { replace: true });
  };

  return (
    <>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cn('app-nav-tab', active === tab.key && 'app-nav-tab--active')}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
      <Button variant="outline" onClick={logout}>
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </>
  );
}
