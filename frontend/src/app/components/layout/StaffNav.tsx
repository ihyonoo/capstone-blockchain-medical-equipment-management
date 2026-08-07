import { useNavigate } from 'react-router';
import { cn } from '../ui/utils';
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
      <button type="button" className="app-nav-tab app-nav-tab--logout" onClick={logout}>
        로그아웃
      </button>
    </>
  );
}
