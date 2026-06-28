export type AuthUser = {
  user_id: number;
  username: string;
  display_name: string;
  role: string;
  department?: string | null;
  position?: string | null;
};

export type AuthSession = {
  token: string;
  expires_at: number;
  user: AuthUser;
};

const AUTH_SESSION_KEY = 'auth_session';
const LEGACY_AUTH_USER_KEY = 'auth_user';

export function storeAuthSession(session: AuthSession) {
  // 예전 세션 저장 포맷이 남아 있으면 현재 포맷과 충돌할 수 있어 함께 정리한다.
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem(LEGACY_AUTH_USER_KEY);
}

export function clearStoredAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_USER_KEY);
}

export function getStoredAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user) return null;
    // 만료된 세션은 즉시 지워서 권한 판정이 모든 화면에서 일관되게 동작하게 한다.
    if (typeof parsed.expires_at !== 'number' || parsed.expires_at <= Math.floor(Date.now() / 1000)) {
      clearStoredAuthSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredAuthUser(): AuthUser | null {
  return getStoredAuthSession()?.user ?? null;
}

export function getStoredAuthToken(): string | null {
  return getStoredAuthSession()?.token ?? null;
}

export function buildAuthHeaders(
  token: string | null,
  init?: Record<string, string>,
): Record<string, string> {
  const headers = { ...(init ?? {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function getRedirectTarget(search: string): string | null {
  const value = new URLSearchParams(search).get('redirect');
  if (!value) return null;
  // 외부 URL로의 오픈 리다이렉트는 막고, 앱 내부 경로만 유지한다.
  if (!value.startsWith('/')) return null;
  return value;
}

export function withRedirectQuery(pathname: string, redirectTarget: string | null) {
  if (!redirectTarget) return pathname;
  const params = new URLSearchParams({ redirect: redirectTarget });
  return `${pathname}?${params.toString()}`;
}
