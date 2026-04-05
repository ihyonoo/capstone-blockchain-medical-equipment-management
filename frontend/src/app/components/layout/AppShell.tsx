import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../ui/utils';

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export default function AppShell({
  title,
  subtitle,
  actions,
  headerAside,
  children,
  contentClassName,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__ambient" />
      <div className="app-shell__container">
        <header className="app-shell__nav fade-rise">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Activity className="h-4 w-4" />
            </div>
            <div className="brand-copy">
              <strong>Clinical Asset Ledger</strong>
              <span>병원 장비 위치 추적 · 사용 이력 무결성</span>
            </div>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>

        <section className={cn('app-shell__hero', headerAside && 'app-shell__hero--split')}>
          <div className="fade-rise">
            <div className="page-header">
              <div>
                <div className="page-header__title">{title}</div>
                {subtitle ? <p className="page-header__meta mt-2">{subtitle}</p> : null}
              </div>
            </div>
          </div>
          {headerAside ? <div className="fade-rise-delay">{headerAside}</div> : null}
        </section>

        <main className={cn('app-shell__content', contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
