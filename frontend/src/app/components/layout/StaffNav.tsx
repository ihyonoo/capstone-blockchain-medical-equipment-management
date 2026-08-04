import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { LogOut } from 'lucide-react';
import { clearStoredAuthSession, LOGIN_PATH } from '../../lib/auth';

type StaffNavProps = {
  active: 'equipment' | 'mypage';
};

export default function StaffNav({ active }: StaffNavProps) {
  const navigate = useNavigate();

  const logout = () => {
    clearStoredAuthSession();
    navigate(LOGIN_PATH, { replace: true });
  };

  return (
    <>
      <Button variant={active === 'equipment' ? 'secondary' : 'outline'} onClick={() => navigate('/equipment')}>
        장비 검색
      </Button>
      <Button variant={active === 'mypage' ? 'secondary' : 'outline'} onClick={() => navigate('/me')}>
        마이페이지
      </Button>
      <Button variant="outline" onClick={logout}>
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </>
  );
}
