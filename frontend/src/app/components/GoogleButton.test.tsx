import { describe, it, expect } from 'vitest';
import { buildGoogleStartUrl } from './GoogleButton';

describe('buildGoogleStartUrl', () => {
  it('carries the redirect target across the google round trip', () => {
    // NFC 태그로 들어온 사람이 구글 로그인을 마치면 홈이 아니라 그 장비 화면으로 돌아가야 한다.
    const url = buildGoogleStartUrl('http://api', 'login', '?redirect=%2Fnfc%2Fpump-001%3Fuid%3D04AABB');

    expect(url).toContain('mode=login');
    expect(decodeURIComponent(url)).toContain('redirect=/nfc/pump-001?uid=04AABB');
  });

  it('omits redirect when there is none', () => {
    expect(buildGoogleStartUrl('http://api', 'signup', '')).toBe('http://api/auth/google/start?mode=signup');
  });

  it('drops a redirect that would leave the site', () => {
    const url = buildGoogleStartUrl('http://api', 'login', '?redirect=https%3A%2F%2Fevil.example.com');

    expect(url).toBe('http://api/auth/google/start?mode=login');
  });
});
