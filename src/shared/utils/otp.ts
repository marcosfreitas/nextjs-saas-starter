/**
 * Length of the email sign-in code. Must match `otp_length` in
 * `supabase/config.toml` and in the hosted project's auth settings: if they
 * differ, the code screen rejects a code the email actually carries.
 */
export const OTP_LENGTH = 8;

/** Keeps digits only, so a code pasted with spaces or dashes still fits. */
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isValidOtpCode(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}
