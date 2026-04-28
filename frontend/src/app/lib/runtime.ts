function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:8000`;

export const PUBLIC_APP_URL = trimTrailingSlash(
  import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin,
);

