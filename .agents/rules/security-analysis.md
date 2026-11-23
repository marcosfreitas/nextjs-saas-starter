---
paths:
  - "src/app/api/**"
  - "src/infrastructure/**"
  - "src/proxy.ts"
  - "src/shared/http/**"
  - "supabase/**"
---

# Security Guidelines

## API Security
- Validate ALL input with Zod before processing
- Call `getCurrentUser()` at the top of every authenticated handler
- Apply `checkRateLimit(identifier)` — use userId for auth'd routes, IP for public
- Never log sensitive data (tokens, passwords, full request bodies), and never return a secret in an error message

## Supabase
- Enable RLS on every table — no exceptions
- A policy without a `GRANT` never runs: `revoke all` from `anon, authenticated`, then grant only what the policy is meant to allow
- Every `SECURITY DEFINER` function sets `search_path` and revokes `EXECUTE` from `public` and `anon`. Postgres grants `EXECUTE` to `PUBLIC` by default and PostgREST exposes the function at `/rest/v1/rpc/<name>`, so without the revoke anyone holding the publishable key can call it. Never take the acting user's id as a parameter: read `auth.uid()` inside the function
- Use `server.ts` client for API routes (cookie-based session)
- Use `admin.ts` client only for privileged server-side operations (webhooks, cron)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code or env

## Anthropic / LLM
- Never pass raw user input directly as the system prompt
- Validate and sanitize content before including in prompts
- Limit `maxTokens` appropriately — don't allow unbounded generation
- Detail: `llm-guidelines.md`

## Billing Webhooks
- Verify webhook signatures before processing any event
- Use `POLAR_WEBHOOK_SECRET` to authenticate Polar events
- Process webhooks idempotently — events may arrive multiple times
- Grant entitlements, credits or access only from the verified webhook. A checkout success page or a client redirect is not proof of payment

## Brotli (CVE-2026-111497)

Node 22.23.4, 24.22.1 and 26.12.1 fix the Brotli decoder. Until the platform is on those versions, two code rules apply:

- **Response from a URL the user or a third party can influence:** use `safeGet`, never `fetch`. The built-in `fetch` decodes `br` on its own, before your code sees the response. `safeGet` refuses any `Content-Encoding` other than identity, gzip and deflate before reading the body, and does not follow redirects. Removing `br` from `Accept-Encoding` is not enough: the server may answer `br` anyway.
- **Request body:** Next 16.4.3 (route handlers) and Fastify do not decode `br` by default; Express 5 and body-parser 2 do. If Express ever enters this repo, refuse `br` in the middleware (`inflate: false` gives 415 for `br` and `gzip`) before any parser.

## Environment Variables
- All secrets via `assertEnv()` — crashes loudly on missing config rather than silently failing
- Public vars prefixed `NEXT_PUBLIC_` only when truly needed client-side
- Never commit `.env*` files — only `.env*.example`

## OWASP Top 10
- A01 Broken Access Control: RLS + `getCurrentUser()` on every endpoint
- A02 Cryptographic Failures: Supabase handles auth tokens; never roll your own crypto
- A03 Injection: Supabase parameterized queries; Zod validation at boundaries
- A05 Security Misconfiguration: `assertEnv()` prevents silent misconfig
- A07 Auth Failures: email code (8 digits, 15 min), no link in the email, no password storage
