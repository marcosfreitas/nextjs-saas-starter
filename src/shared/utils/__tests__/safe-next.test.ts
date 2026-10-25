import { safeNext } from '@/shared/utils/safe-next';

describe('safeNext', () => {
  it('keeps a same-origin path', () => {
    expect(safeNext('/settings')).toBe('/settings');
  });

  it('falls back when missing', () => {
    expect(safeNext(null)).toBe('/dashboard');
    expect(safeNext(null, '/home')).toBe('/home');
  });

  it('rejects other hosts, protocol-relative and backslash forms', () => {
    expect(safeNext('https://evil.example')).toBe('/dashboard');
    expect(safeNext('//evil.example')).toBe('/dashboard');
    expect(safeNext('/\\evil.example')).toBe('/dashboard');
    expect(safeNext('dashboard')).toBe('/dashboard');
  });
});
