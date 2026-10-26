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
    console.log('auth config passes: confirmation on, site_url is not the callback.');
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
