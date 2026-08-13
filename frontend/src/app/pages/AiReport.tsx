import { Sparkles } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import AdminNav from '../components/layout/AdminNav';
import { getStoredAuthSession, LOGIN_PATH } from '../lib/auth';
import { useAuthGuard } from '../lib/useAuthGuard';

export default function AiReport() {
  const isAuthorized = useAuthGuard(() => {
    try {
      const session = getStoredAuthSession();
      if (!session?.token || !session.user) return LOGIN_PATH;
      if (session.user.role !== 'admin') return '/equipment';
      return null;
    } catch {
      return LOGIN_PATH;
    }
  });

  if (!isAuthorized) return null;

  return (
    <AppShell wide actions={<AdminNav active="ai-report" />} contentClassName="pt-6 sm:pt-5">
      <section className="surface-panel p-5 fade-rise">
        <div className="panel-header">
          <div>
            <div className="panel-title">AI 기반 레포트</div>
          </div>
        </div>
        <div className="empty-state flex flex-col items-center gap-3 py-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <div className="text-base font-medium text-foreground">아직 개발 중인 기능입니다.</div>
        </div>
      </section>
    </AppShell>
  );
}
