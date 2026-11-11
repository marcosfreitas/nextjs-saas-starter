# Auth Guidelines

## Provider
Supabase Auth — email code (OTP, 8 digits) by default. No password, no link in the email. The decision and the reasons are in the shared note `decisions/email-link-signup-onboarding`.

## Session Management
- `src/proxy.ts` — refreshes sessions on every request via cookie exchange (Next.js proxy, formerly middleware)
- `src/infrastructure/database/server.ts` — SSR client reads/writes cookies
- `src/infrastructure/database/auth-session.ts` — `getCurrentUser()` (API routes), `getCurrentUserForPage()` (server pages), `getCurrentUserOrNull()`

## Usage

**Protected API route or server action:**
```typescript
const user = await getCurrentUser(); // UnauthorizedError if not signed in; OnboardingRequiredError if terms not accepted
```
`getCurrentUser()` is the one base check every door calls. It reads `profiles.onboarded_at` in the same request, so a route cannot skip onboarding by calling the database itself.

**Own profile read only:** `getSessionUser()` checks the session and nothing else. It is exempt because the user needs their own profile to see where they stand. Use it for nothing else.

**Protected page (group layout):** the layout in `src/app/(authenticated)/layout.tsx` redirects: no session to `/auth/sign-in`, not onboarded to `/onboarding`. It only redirects, never throws. Server pages inside the group call `getCurrentUserForPage()`: the same check, but a refusal redirects instead of throwing, so the dev server does not log an error on every first login. API routes keep `getCurrentUser()` and its 401/403.

**Sign-in flow (one field, then the code, in the same tab):**
1. User submits email → `supabase.auth.signInWithOtp({ email })` from the browser (`src/app/auth/sign-in/page.tsx`). It creates the account on first use. No `emailRedirectTo`.
2. The email carries `{{ .Token }}` (8 digits) and no link (`supabase/templates/code.html`, wired in `supabase/config.toml`).
3. User types the code → `supabase.auth.verifyOtp({ email, token, type: 'email' })`, also from the browser. Verifying on the server would share GoTrue's per-IP attempt limit across every user.
4. The session cookie is set; the page goes to `/dashboard`. The authenticated layout sends a profile that is not onboarded to `/onboarding`.
5. `/onboarding` records the terms acceptance in `public.consents` and sets `profiles.onboarded_at`

**The gate is the authenticated layout, not the proxy.** `src/proxy.ts` only refreshes the session cookie, with `getClaims()`, and makes no table read per navigation. Outside the `(authenticated)` group are `/onboarding`, terms, privacy, `/auth/*` (token routes), and metadata routes, so none of them can be swallowed by a gate. A profile that cannot be read counts as not onboarded.

**No login callback route.** The template has none: a code never travels in a URL. A route that exchanges `?code=` would turn a recovery or invite link into a session, because the PKCE code carries no type. Recovery, invite and email-change links go to `/auth/confirm`, which verifies `token_hash` with an explicit type from an allowlist (`email`, `email_change` today). `recovery` and `invite` are not allowed there until their flow sets the password before signing anyone in. Never set `/auth/callback` as `site_url`; it no longer exists, and `pnpm check:auth` flags it.

**Migrating a project that still sends links** (order matters, because templates and code cannot change atomically): (a) templates carrying the code and the old link; (b) deploy the code screen; (c) templates with the code only; (d) once the old links have expired, remove the login callback route.

**No password door.** `supabase/migrations/20261025170000_auth_no_passwords.sql` blanks `encrypted_password` on every insert and update. The Supabase email provider accepts `POST /auth/v1/signup` with a password from the public key whatever the UI shows, and turning confirmation on does not close it. Any future password feature must drop that trigger first.

## Adding OAuth
OAuth needs a redirect target, so it brings back a callback route that the template does not have. Build it with the same rule as above: it exchanges only the code it asked for, and it is not `site_url`.
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/oauth/callback` },
});
```

## Row Level Security
Enable RLS on all tables. Default policy: users can only access their own rows.

```sql
alter table your_table enable row level security;
create policy "users own data" on your_table
  for all using (auth.uid() = user_id);
```

---

## Two authorization axes — do not conflate them

Authentication answers *who*. Authorization here has **two independent axes**, and a role from one can never answer a question from the other.

| Axis | Question it answers | Where it lives |
|------|--------------------|----------------|
| **Tenant / account** | What may this user do *inside their own account*? | Whatever per-account role model the product adds (owner, member, permissions) |
| **Platform operator** | May this user see *across* accounts — internal tooling, support screens, cross-tenant reports? | `public.platform_admins` + `public.is_admin()` |

**The failure this prevents:** gating a cross-tenant screen on a tenant role such as `role_name = 'Account Owner'`. Every customer owns their own account, so every customer passes that gate, and the screen leaks other tenants' data. The check *looks* restrictive and is effectively `true`.

### Using the platform gate

```typescript
// Route handler or server component
const operator = await requirePlatformAdmin(); // 401 no session, 403 not an operator
```

`requirePlatformAdmin()` lives in `src/infrastructure/database/platform-admin-session.ts` and composes `getCurrentUser()` with `AssertPlatformAdminService`. Use `isCurrentUserPlatformAdmin()` when a page renders a different view per role instead of refusing.

Worked example: `src/app/api/v1/admin/whoami/route.ts`.

### The database half

The migration is `supabase/migrations/20260827000000_platform_admin.sql`.

- `platform_admins` is **empty by default** — fail-closed. Nobody is an operator until a row exists.
- Seed the first operator **out-of-band by `user_id`**, in its own migration. Never by email lookup inside the migration (the insert silently matches nothing if the account does not exist yet, and the migration still reports success), and never through a self-service flow.
- The policy on `platform_admins` itself reads `auth.uid()` directly and **must not** call `is_admin()`: that function selects from the same table, so the policy would recurse into itself (Postgres `42P17`).
- Every other admin-only or cross-tenant table gates on the function:

```sql
revoke all on public.some_table from anon, authenticated;
grant  select on public.some_table to authenticated;

create policy some_table_admin_reads
  on public.some_table for select to authenticated
  using ((select public.is_admin()));
```

Three details in those four lines, each of which silently breaks the gate if dropped:

1. **The `revoke`/`grant` pair is not optional.** RLS answers "which rows"; `GRANT` answers "may this role touch the table at all". A policy with no grant is never evaluated — the request fails with `42501` instead. And on stacks where new tables still arrive with full privileges for `anon`/`authenticated`, writing no grant hands over everything rather than withholding it.
2. **`(select public.is_admin())`, not `public.is_admin()`.** The wrapper makes it an InitPlan: evaluated once per query instead of once per row.
3. **Read on the session client** (`infrastructure/database/server.ts`), never the service-role client (`admin.ts`). Service-role bypasses RLS, so the policy never runs and the application check becomes the entire authorization. Gate in the app *and* policy in the database is two layers; policy plus service-role is zero.
