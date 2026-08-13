import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { clearStoredAuthSession, LOGIN_PATH } from '../../lib/auth';
import { useMediaQuery } from '../../lib/useMediaQuery';

type StaffNavProps = {
  active: 'equipment' | 'mypage';
};

const TABS: { key: StaffNavProps['active']; label: string; path: string }[] = [
  { key: 'equipment', label: '장비 검색', path: '/equipment' },
  { key: 'mypage', label: '마이페이지', path: '/me' },
];

// AdminNav와 동일한 breakpoint — 상단바가 모든 화면에서 한 줄을 유지하도록 맞춘다.
const WIDE_QUERY = '(min-width: 640px)';

export default function StaffNav({ active }: StaffNavProps) {
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = () => {
    clearStoredAuthSession();
    navigate(LOGIN_PATH, { replace: true });
  };

  const renderTabs = (onNavigate: (path: string) => void, inMenu: boolean) => (
    <>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cn('app-nav-tab', active === tab.key && 'app-nav-tab--active', inMenu && 'app-nav-tab--menu')}
          onClick={() => onNavigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
      <button
        type="button"
        className={cn('app-nav-tab app-nav-tab--logout', inMenu && 'app-nav-tab--menu')}
        onClick={() => {
          setMenuOpen(false);
          logout();
        }}
      >
        로그아웃
      </button>
    </>
  );

  if (isWide) {
    return renderTabs(navigate, false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="app-nav-tab"
      >
        {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full z-30 flex w-max flex-col items-end gap-1 rounded-md border border-border bg-card p-3 shadow-lg">
          {renderTabs((path) => {
            setMenuOpen(false);
            navigate(path);
          }, true)}
        </div>
      ) : null}
    </div>
  );
}
