/**
 * When a sign-in code was last sent to an address, remembered in the browser.
 *
 * The wait before asking for another code belongs to the ADDRESS, not to what is
 * on the screen. A counter kept in the form's state is reset by "change email":
 * typing the same address again looked like a first request and sent another
 * code at once, so one address could be flooded.
 *
 * This is the courtesy half of the limit. The half that counts is the auth
 * server's minimum interval (`max_frequency` in supabase/config.toml), because
 * anything stored in the browser can be cleared. Keep the two equal.
 */
export const RESEND_SECONDS = 60;

const PREFIX = 'otp-sent:';

type CooldownStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** One key per address: trimmed and lower-cased, so "A@x.com " and "a@x.com" share a wait. */
function key(email: string): string {
  return `${PREFIX}${email.trim().toLowerCase()}`;
}

function browserStorage(): CooldownStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // storage blocked: the server-side limit still applies
  }
}

/** Seconds still to wait before another code may be sent to this address. 0 when none. */
export function secondsUntilResend(
  email: string,
  now: number = Date.now(),
  storage: CooldownStorage | null = browserStorage()
): number {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key(email)) ?? null;
  } catch {
    return 0;
  }
  const sentAt = Number(raw);
  if (!raw || !Number.isFinite(sentAt) || sentAt <= 0) return 0;
  const remaining = Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000);
  // A timestamp in the future (clock change, tampering) never blocks longer than one wait.
  return Math.min(RESEND_SECONDS, Math.max(0, remaining));
}

/** Remember that a code was just sent to this address. */
export function markCodeSent(
  email: string,
  now: number = Date.now(),
  storage: CooldownStorage | null = browserStorage()
): void {
  try {
    storage?.setItem(key(email), String(now));
  } catch {
    // Full or blocked storage: nothing to remember, the server limit still applies.
  }
}
