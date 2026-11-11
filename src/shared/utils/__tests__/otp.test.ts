import { isValidOtpCode, normalizeOtpCode, OTP_LENGTH } from '@/shared/utils/otp';

describe('otp', () => {
  it('expects 8 digits', () => {
    expect(OTP_LENGTH).toBe(8);
    expect(isValidOtpCode('12345678')).toBe(true);
    expect(isValidOtpCode('1234567')).toBe(false);
    expect(isValidOtpCode('123456789')).toBe(false);
    expect(isValidOtpCode('1234567a')).toBe(false);
  });

  it('strips separators from a pasted code and caps it at the length', () => {
    expect(normalizeOtpCode('1234 5678')).toBe('12345678');
    expect(normalizeOtpCode('12-34-56-78')).toBe('12345678');
    expect(normalizeOtpCode('123456789012')).toBe('12345678');
    expect(normalizeOtpCode('abc')).toBe('');
  });
});
