'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/infrastructure/database/client';
import { isValidOtpCode, normalizeOtpCode, OTP_LENGTH } from '@/shared/utils/otp';
import { markCodeSent, secondsUntilResend } from '@/shared/utils/otp-cooldown';

/**
 * One gesture for signup and login: type the email, type the code it receives.
 *
 * The code is checked here, in the browser, on purpose. GoTrue limits verification
 * attempts per client IP. From a server action every attempt would share the
 * host's egress IPs, so one attacker could lock out everyone's code entry.
 */
/** Page shell: useSearchParams needs a Suspense boundary during static rendering. */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  // /auth/confirm sends ?error=auth_failed when a link is expired or already used.
  const linkFailed = useSearchParams().get('error') === 'auth_failed';
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setError] = useState<string | null>(null);
  const error = errorMessage ?? (linkFailed ? 'That link is no longer valid. Enter your email to get a new code.' : null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /**
   * The only path that asks the auth server for a code. Every caller goes through
   * the per-address wait first, so "change email" followed by the same address
   * cannot send a second code early.
   *
   * Returns 'sent', 'waiting' (a code went out to this address less than a minute
   * ago: show the code step, send nothing) or 'failed'.
   */
  async function requestCode(address: string): Promise<'sent' | 'waiting' | 'failed'> {
    setError(null);
    setNotice(null);
    const wait = secondsUntilResend(address);
    if (wait > 0) {
      setCooldown(wait);
      setNotice('A code was sent to this address a moment ago. Use that one, or wait to ask for another.');
      return 'waiting';
    }
    const { error } = await supabase.auth.signInWithOtp({ email: address });
    if (error) {
      setError(
        error.status === 429
          ? 'Too many codes requested. Wait a few minutes before trying again.'
          : 'We could not send the code. Wait a minute and try again.'
      );
      return 'failed';
    }
    markCodeSent(address);
    setCooldown(secondsUntilResend(address));
    return 'sent';
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setBusy(true);
    const result = await requestCode(address);
    setBusy(false);
    if (result !== 'failed') {
      setSentTo(address);
      setCode('');
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo || !isValidOtpCode(code)) {
      setError(`Enter the ${OTP_LENGTH}-digit code from the email.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? 'Too many attempts. Wait a few minutes before trying again.'
          : 'That code is wrong or expired. Use the most recent code from the email.'
      );
      return;
    }
    // The session cookie is set now. The authenticated layout sends the user to
    // /onboarding if this account has not finished onboarding yet.
    router.replace('/dashboard');
    router.refresh();
  }

  function changeEmail() {
    setSentTo(null);
    setCode('');
    setError(null);
    setNotice(null);
  }

  if (sentTo) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <form onSubmit={handleCode} className="flex flex-col gap-4 w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Enter your code</h1>
          <p className="text-sm">
            Sent to <strong>{sentTo}</strong>.{' '}
            <button type="button" onClick={changeEmail} className="underline">
              Change email
            </button>
          </p>
          <p className="text-sm text-muted-foreground">
            Each new code replaces the previous one. Use the most recent code from the email.
          </p>
          {notice && <p className="text-sm">{notice}</p>}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={'0'.repeat(OTP_LENGTH)}
            value={code}
            onChange={(e) => setCode(normalizeOtpCode(e.target.value))}
            required
            className="border rounded px-3 py-2 tracking-widest text-center text-lg"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded px-4 py-2 disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => requestCode(sentTo)}
            disabled={busy || cooldown > 0}
            className="text-sm underline disabled:no-underline disabled:opacity-50"
          >
            {cooldown > 0 ? `Send a new code in ${cooldown} s` : 'Send a new code'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={handleEmail} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground rounded px-4 py-2 disabled:opacity-50"
        >
          Send code
        </button>
      </form>
    </main>
  );
}
