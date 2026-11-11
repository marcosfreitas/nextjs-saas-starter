#!/usr/bin/env node
/**
 * Read-only check of the hosted Supabase auth config, run by hand on a new project.
 *
 * Why it exists: `supabase/config.toml` is not in this repo, so the two switches
 * that decide whether the password door is closed live only in the remote project,
 * where nothing checks them. This reads them and exits 1 if they are wrong.
 *
 * Checks:
 * - mailer_autoconfirm must be false. With it true, a password signup on someone
 *   else's address returns a session at once, and the database trigger cannot
 *   revoke that session.
 * - site_url must not be the auth callback. Links whose redirect_to is not
 *   allowed fall back to site_url, so the callback would receive a recovery token.
 *
 * Usage (needs a Management API token, which is read from the environment only):
 *   SUPABASE_ACCESS_TOKEN=... node scripts/check-auth-config.mjs <project-ref>
 *
 * Writes nothing. The token is never printed.
 */

const API_BASE = process.env.SUPABASE_API_BASE ?? 'https://api.supabase.com';
const CALLBACK_PATH = '/auth/callback';
const OTP_LENGTH = 8;
const OTP_EXP_SECONDS = 900;
const CODE_TOKEN = /\{\{\s*\.Token\s*\}\}/;
const LINK_VARIABLE = /\{\{\s*\.(ConfirmationURL|SiteURL|RedirectTo)\s*\}\}/;

/** Pure: returns the list of problems, empty when the config passes. */
export function checkAuthConfig(config) {
  const problems = [];

  if (config.mailer_autoconfirm !== false) {
    problems.push(
      'mailer_autoconfirm is not false: confirmation is off, so a password signup returns a session at once. Turn "Confirm email" on.'
    );
  }

  const siteUrl = typeof config.site_url === 'string' ? config.site_url : '';
  if (siteUrl.includes(CALLBACK_PATH)) {
    problems.push(
      `site_url points at ${CALLBACK_PATH}: links with a redirect_to outside the allowlist would hand their token to the login callback. Point site_url at an inert page.`
    );
  }

  // The allowlist decides where a link may land. A stale /auth/callback entry there
  // would send a token to a route that no longer exists, with the token in the URL.
  const allowList = typeof config.uri_allow_list === 'string' ? config.uri_allow_list : '';
  if (allowList.includes(CALLBACK_PATH)) {
    problems.push(
      `uri_allow_list still includes ${CALLBACK_PATH}: remove it, the callback route is gone.`
    );
  }

  // The code step is only as good as the length and expiry it was derived for.
  // OTP_LENGTH in src/shared/utils/otp.ts is the app's copy of the same number.
  if (config.mailer_otp_length !== OTP_LENGTH) {
    problems.push(
      `mailer_otp_length is ${config.mailer_otp_length}, expected ${OTP_LENGTH}: the input and the attempt budget assume ${OTP_LENGTH} digits.`
    );
  }
  if (config.mailer_otp_exp !== OTP_EXP_SECONDS) {
    problems.push(
      `mailer_otp_exp is ${config.mailer_otp_exp}, expected ${OTP_EXP_SECONDS}: the templates promise 15 minutes.`
    );
  }

  // Both templates must carry the code and no link, or new accounts get the wrong email.
  for (const key of ['mailer_templates_confirmation_content', 'mailer_templates_magic_link_content']) {
    const body = typeof config[key] === 'string' ? config[key] : '';
    if (!CODE_TOKEN.test(body) || LINK_VARIABLE.test(body)) {
      problems.push(
        `${key} must show {{ .Token }} and no link variable (ConfirmationURL, SiteURL, RedirectTo): a mail scanner that opens a link consumes its token and leaves the code dead.`
      );
    }
  }

  return problems;
}

async function main() {
  const ref = process.argv[2];
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!ref || !token) {
    console.error('usage: SUPABASE_ACCESS_TOKEN=... node scripts/check-auth-config.mjs <project-ref>');
    process.exit(2);
  }

  const res = await fetch(`${API_BASE}/v1/projects/${encodeURIComponent(ref)}/config/auth`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error(`Management API answered HTTP ${res.status}. Nothing was checked.`);
    process.exit(2);
  }

  const problems = checkAuthConfig(await res.json());
  if (problems.length === 0) {
    console.log('auth config passes: confirmation on, site_url not the callback, 8-digit code for 900 s, code-only templates.');
    return;
  }
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}

// Run only when executed directly, so the check function can be imported in tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`check failed to run: ${err.message}`);
    process.exit(2);
  });
}
