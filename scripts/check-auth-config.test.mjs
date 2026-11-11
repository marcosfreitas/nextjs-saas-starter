// Unit tests for the pure part of check-auth-config. Run: pnpm test:auth-config
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthConfig } from './check-auth-config.mjs';

const GOOD_TEMPLATE = '<p>Your code: {{ .Token }}</p>';

const GOOD = {
  mailer_autoconfirm: false,
  site_url: 'https://app.example.com',
  mailer_otp_length: 8,
  mailer_otp_exp: 900,
  mailer_templates_confirmation_content: GOOD_TEMPLATE,
  mailer_templates_magic_link_content: GOOD_TEMPLATE,
};

test('passes a config that matches the standard', () => {
  assert.deepEqual(checkAuthConfig(GOOD), []);
});

test('flags confirmation off', () => {
  const problems = checkAuthConfig({ ...GOOD, mailer_autoconfirm: true });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /mailer_autoconfirm/);
});

test('flags site_url pointing at the callback', () => {
  const problems = checkAuthConfig({ ...GOOD, site_url: 'https://x.dev/auth/callback' });
  assert.match(problems.join('\n'), /site_url points at/);
});

test('flags a code length other than 8', () => {
  const problems = checkAuthConfig({ ...GOOD, mailer_otp_length: 6 });
  assert.match(problems.join('\n'), /mailer_otp_length is 6, expected 8/);
});

test('flags an expiry other than 900 s', () => {
  const problems = checkAuthConfig({ ...GOOD, mailer_otp_exp: 3600 });
  assert.match(problems.join('\n'), /mailer_otp_exp is 3600, expected 900/);
});

test('flags a template without the code', () => {
  const problems = checkAuthConfig({ ...GOOD, mailer_templates_magic_link_content: '<p>hi</p>' });
  assert.match(problems.join('\n'), /mailer_templates_magic_link_content must show/);
});

test('flags a template that still carries a link', () => {
  const body = '{{ .Token }} or <a href="{{ .ConfirmationURL }}">here</a>';
  const problems = checkAuthConfig({ ...GOOD, mailer_templates_confirmation_content: body });
  assert.match(problems.join('\n'), /mailer_templates_confirmation_content must show/);
});

test('a missing template counts as a failure, not a pass', () => {
  const rest = { ...GOOD };
  delete rest.mailer_templates_confirmation_content;
  const problems = checkAuthConfig(rest);
  assert.match(problems.join('\n'), /mailer_templates_confirmation_content/);
});

test('flags the removed callback still in the redirect allowlist', () => {
  const problems = checkAuthConfig({ ...GOOD, uri_allow_list: 'https://x.dev/auth/callback,https://x.dev/auth/confirm' });
  assert.match(problems.join('\n'), /uri_allow_list still includes/);
});
