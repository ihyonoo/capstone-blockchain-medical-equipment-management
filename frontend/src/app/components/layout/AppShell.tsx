import { useEffect, useState, type ReactNode } from 'react';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { cn } from '../ui/utils';

type ColorMode = 'light' | 'dark';

const COLOR_MODE_STORAGE_KEY = 'mediledger-color-mode';

function getInitialColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';

  try {
    const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return storedMode === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function persistColorMode(mode: ColorMode) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

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
  const [colorMode, setColorMode] = useState<ColorMode>(getInitialColorMode);
  const isDarkMode = colorMode === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = colorMode;
    persistColorMode(colorMode);
  }, [colorMode, isDarkMode]);

  return (
    <div className="app-shell">
      <div className="app-shell__ambient" />
      <div className="app-shell__container">
        <header className="app-shell__nav fade-rise">
          <div className="brand-lockup">
            <div className="brand-mark">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="brand-copy">
              <strong>MediLedger &amp; EquipTrace</strong>
            </div>
          </div>
          <div className="app-shell__actions flex items-center gap-2">
            {actions}
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
              aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
              title={isDarkMode ? '라이트 모드' : '다크 모드'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
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
