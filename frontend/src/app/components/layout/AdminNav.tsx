import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { clearStoredAuthSession, LOGIN_PATH } from '../../lib/auth';
import { useMediaQuery } from '../../lib/useMediaQuery';

type AdminNavProps = {
  active: 'verification' | 'nfc-mapping' | 'devices' | 'ai-report' | 'mypage';
};

const TABS: { key: AdminNavProps['active']; label: string; path: string }[] = [
  { key: 'verification', label: '장비 사용 이력 조회', path: '/verification' },
  { key: 'nfc-mapping', label: 'NFC 매핑', path: '/admin/nfc-mapping' },
  { key: 'devices', label: '기기 상태', path: '/admin/devices' },
  { key: 'ai-report', label: 'AI 기반 레포트', path: '/admin/ai-report' },
  { key: 'mypage', label: '마이페이지', path: '/me' },
];

// 탭 6개(5개 + 로그아웃)가 22px 고정 크기라, 이 아래 폭에서는 상단바가 여러 줄로 밀려
// 어색해진다 — theme.css의 topbar 축소 breakpoint와 동일하게 맞춘다.
const WIDE_QUERY = '(min-width: 640px)';

export default function AdminNav({ active }: AdminNavProps) {
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = () => {
    clearStoredAuthSession();
    navigate(LOGIN_PATH, { replace: true });
  };

  const renderTabs = (onNavigate: (path: string) => void) => (
    <>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cn('app-nav-tab', active === tab.key && 'app-nav-tab--active')}
          onClick={() => onNavigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
      <button
        type="button"
        className="app-nav-tab app-nav-tab--logout"
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
    return renderTabs(navigate);
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
        <div className="absolute right-0 top-full z-30 flex flex-col items-end gap-1 rounded-md border border-border bg-card p-3 shadow-lg">
          {renderTabs((path) => {
            setMenuOpen(false);
            navigate(path);
          })}
        </div>
      ) : null}
    </div>
  );
}
