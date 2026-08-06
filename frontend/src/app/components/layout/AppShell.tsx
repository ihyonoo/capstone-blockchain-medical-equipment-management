import { type ReactNode } from 'react';
import { cn } from '../ui/utils';

type AppShellProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  wide?: boolean;
};

export default function AppShell({
  title,
  subtitle,
  actions,
  headerAside,
  children,
  contentClassName,
  wide = false,
}: AppShellProps) {
  const containerClass = cn('app-shell__container', wide && 'app-shell__container--wide');
  const hasHero = Boolean(title || subtitle || headerAside);
  const headerOnly = Boolean(headerAside && !title && !subtitle);

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <div className={containerClass}>
          <nav className="app-shell__nav">
            <div className="brand-lockup">
              <div className="brand-copy">
                <strong>MediLedger &amp; EquipTrace</strong>
              </div>
            </div>
            <div className="app-shell__actions flex flex-wrap items-center justify-end gap-3 sm:gap-5">{actions}</div>
          </nav>
        </div>
      </header>

      <div className={containerClass}>
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
