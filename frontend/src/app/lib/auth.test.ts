import { describe, it, expect } from 'vitest';
import { getHomePath, type AuthUser } from './auth';

function user(role: string): AuthUser {
  return { user_id: 1, username: 'tester', display_name: '테스터', role };
}

describe('getHomePath', () => {
  it('sends signed-out visitors to the landing page', () => {
    expect(getHomePath(null)).toBe('/');
  });

  it('sends admins to the usage history page', () => {
    expect(getHomePath(user('admin'))).toBe('/verification');
  });

  it('sends staff to the equipment search page', () => {
    expect(getHomePath(user('staff'))).toBe('/equipment');
  });

  // 서버가 대문자로 내려주더라도 판정이 흔들리면 안 된다.
  it('matches the admin role case-insensitively', () => {
    expect(getHomePath(user('ADMIN'))).toBe('/verification');
  });

  it('falls back to equipment search for any other role', () => {
    expect(getHomePath(user('viewer'))).toBe('/equipment');
  });
});
