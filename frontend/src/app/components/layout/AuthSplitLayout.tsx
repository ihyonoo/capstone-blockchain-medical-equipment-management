import { type ReactNode } from 'react';
import AppShell from './AppShell';
import AuthImageCarousel from '../AuthImageCarousel';

type AuthSplitLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

// 인증 화면 공통 레이아웃: 상단바 아래를 좌측 이미지 캐러셀 + 우측 폼으로 나눈다.
export default function AuthSplitLayout({ title, subtitle, children }: AuthSplitLayoutProps) {
  return (
    <AppShell bleed contentClassName="auth-split">
      <div className="auth-split__media">
        <AuthImageCarousel />
      </div>

      <div className="auth-split__form">
        <div className="auth-split__form-inner fade-rise">
          <h1 className="auth-split__title">{title}</h1>
          {subtitle ? <p className="auth-split__subtitle">{subtitle}</p> : null}
          <div className="auth-split__body">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
