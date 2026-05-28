# Auth Guidelines

## Provider
Supabase Auth — magic link (OTP) by default.

## Session Management
- `src/middleware.ts` — refreshes sessions on every request via cookie exchange
- `src/infrastructure/database/server.ts` — SSR client reads/writes cookies
- `src/infrastructure/database/auth-session.ts` — `getCurrentUser()` / `getCurrentUserOrNull()`

## Usage

**Protected API route:**
```typescript
const user = await getCurrentUser(); // throws UnauthorizedError if not signed in
```

**Protected page (layout):**
```typescript
const user = await getCurrentUserOrNull();
if (!user) redirect('/auth/sign-in');
```

**Sign-in flow:**
1. User submits email → `supabase.auth.signInWithOtp()`
2. Email link → `/auth/callback?code=...`
3. `exchangeCodeForSession(code)` → redirect to `/dashboard`

## Adding OAuth
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/callback` },
});
```

## Row Level Security
Enable RLS on all tables. Default policy: users can only access their own rows.

```sql
alter table your_table enable row level security;
create policy "users own data" on your_table
  for all using (auth.uid() = user_id);
```
