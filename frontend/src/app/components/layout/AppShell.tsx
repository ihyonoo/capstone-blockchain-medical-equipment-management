import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../ui/utils';

type AppShellProps = {
  title?: string;
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
  const hasHero = Boolean(title || subtitle || headerAside);
  const headerOnly = Boolean(headerAside && !title && !subtitle);

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
              <strong>의료 장비 사용 이력 관리 시스템</strong>
              <span>의료 장비 사용 이력 관리 · 무결성 검증 · 의료 장비 실시간 위치 추적</span>
            </div>
          </div>
          {actions ? <div className="app-shell__actions flex items-center gap-2">{actions}</div> : null}
        </header>

        {hasHero ? (
          <section
            className={cn(
              'app-shell__hero',
              headerAside && !headerOnly && 'app-shell__hero--split',
              headerOnly && 'justify-items-end',
            )}
          >
            {title || subtitle ? (
              <div className="fade-rise">
                <div className="page-header">
                  <div>
                    {title ? <div className="page-header__title">{title}</div> : null}
                    {subtitle ? <p className="page-header__meta mt-2">{subtitle}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
            {headerAside ? <div className="fade-rise-delay">{headerAside}</div> : null}
          </section>
        ) : null}

        <main className={cn('app-shell__content', contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
