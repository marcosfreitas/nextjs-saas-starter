import { markCodeSent, RESEND_SECONDS, secondsUntilResend } from '@/shared/utils/otp-cooldown';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const T0 = 1_800_000_000_000;

describe('otp cooldown', () => {
  it('has no wait for an address that never asked', () => {
    expect(secondsUntilResend('a@x.com', T0, memoryStorage())).toBe(0);
  });

  it('waits the full interval right after a send, and counts down', () => {
    const s = memoryStorage();
    markCodeSent('a@x.com', T0, s);
    expect(secondsUntilResend('a@x.com', T0, s)).toBe(RESEND_SECONDS);
    expect(secondsUntilResend('a@x.com', T0 + 20_000, s)).toBe(RESEND_SECONDS - 20);
    expect(secondsUntilResend('a@x.com', T0 + RESEND_SECONDS * 1000, s)).toBe(0);
  });

  it('keeps the wait when the same address is typed again with other casing or spaces', () => {
    const s = memoryStorage();
    markCodeSent('Ana@X.com', T0, s);
    expect(secondsUntilResend('  ana@x.COM ', T0 + 5_000, s)).toBe(RESEND_SECONDS - 5);
  });

  it('does not make another address wait', () => {
    const s = memoryStorage();
    markCodeSent('a@x.com', T0, s);
    expect(secondsUntilResend('b@x.com', T0 + 1_000, s)).toBe(0);
  });

  it('never waits longer than one interval for a timestamp in the future', () => {
    const s = memoryStorage();
    markCodeSent('a@x.com', T0 + 3_600_000, s);
    expect(secondsUntilResend('a@x.com', T0, s)).toBe(RESEND_SECONDS);
  });

  it('treats garbage and blocked storage as no wait, and does not throw', () => {
    const s = memoryStorage();
    s.setItem('otp-sent:a@x.com', 'not-a-number');
    expect(secondsUntilResend('a@x.com', T0, s)).toBe(0);
    expect(secondsUntilResend('a@x.com', T0, null)).toBe(0);
    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(secondsUntilResend('a@x.com', T0, throwing)).toBe(0);
    expect(() => markCodeSent('a@x.com', T0, throwing)).not.toThrow();
  });
});
