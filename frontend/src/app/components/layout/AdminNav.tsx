import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { LogOut } from 'lucide-react';
import { clearStoredAuthSession } from '../../lib/auth';

type AdminNavProps = {
  active: 'verification' | 'nfc-mapping' | 'devices' | 'ai-report' | 'mypage';
};

export default function AdminNav({ active }: AdminNavProps) {
  const navigate = useNavigate();

  const logout = () => {
    clearStoredAuthSession();
    navigate('/', { replace: true });
  };

  return (
    <>
      <Button
        variant={active === 'verification' ? 'secondary' : 'outline'}
        onClick={() => navigate('/verification')}
      >
        장비 사용 이력 조회
      </Button>
      <Button
        variant={active === 'nfc-mapping' ? 'secondary' : 'outline'}
        onClick={() => navigate('/admin/nfc-mapping')}
      >
        NFC 매핑
      </Button>
      <Button
        variant={active === 'devices' ? 'secondary' : 'outline'}
        onClick={() => navigate('/admin/devices')}
      >
        기기 상태
      </Button>
      <Button
        variant={active === 'ai-report' ? 'secondary' : 'outline'}
        onClick={() => navigate('/admin/ai-report')}
      >
        AI 기반 레포트
      </Button>
      <Button
        variant={active === 'mypage' ? 'secondary' : 'outline'}
        onClick={() => navigate('/me')}
      >
        마이페이지
      </Button>
      <Button variant="outline" onClick={logout}>
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </>
  );
}
