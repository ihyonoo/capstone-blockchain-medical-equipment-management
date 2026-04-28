export type AuthUser = {
  user_id: number;
  username: string;
  display_name: string;
  role: string;
  department?: string | null;
  position?: string | null;
};

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem('auth_user');
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getRedirectTarget(search: string): string | null {
  const value = new URLSearchParams(search).get('redirect');
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  return value;
}

export function withRedirectQuery(pathname: string, redirectTarget: string | null) {
  if (!redirectTarget) return pathname;
  const params = new URLSearchParams({ redirect: redirectTarget });
  return `${pathname}?${params.toString()}`;
}
