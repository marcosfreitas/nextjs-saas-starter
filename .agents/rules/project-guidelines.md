---
paths:
  - "src/app/api/**"
  - "src/core/**"
  - "src/features/**"
---

# Project Guidelines

## API Patterns
- All routes versioned: `/api/v1/`
- Response envelope: `{ success: true, data: T }` or `{ success: false, error: { code, message } }`
- Use `ok()`, `created()`, `handleError()` from `@/shared/utils/api-handler`
- Validate all input with Zod at the route level before calling services

## Error Handling
- Throw typed errors from `@/shared/errors` — never throw plain strings
- `handleError()` in route handlers maps all error types to proper HTTP responses
- Never swallow errors silently; always log before re-throwing infrastructure errors

## Code Style
- No `any` — use `unknown` and narrow
- No comments unless the WHY is non-obvious
- Prefer `async/await` over `.then()`
- No barrel `index.ts` in `infrastructure/` or `core/` — import directly

## Security
- Never trust client input — validate with Zod
- Always call `getCurrentUser()` before any authenticated operation
- Rate-limit public and authenticated endpoints with `checkRateLimit()`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client

## Authentication
- Email code (8 digits) via Supabase Auth by default. No password, no link in the email
- API routes and server actions: `getCurrentUser()` throws `UnauthorizedError` (401) with no session and `OnboardingRequiredError` (403) before the terms are accepted
- Server pages: `getCurrentUserForPage()` runs the same check and redirects instead of throwing
- `getSessionUser()` skips the onboarding check. Only for reading one's own profile
- `getCurrentUserOrNull()` for pages that handle both signed-in and anonymous visitors
- Proxy at `src/proxy.ts` only refreshes the session cookie. No gate lives there
- Detail: `auth-guidelines.md`

## Naming Conventions
- Services: `{verb}{Noun}Service` — `GetUserService`, `CreateOrderService`
- Repositories: `{Noun}Repository` — `UserRepository`
- Providers: `{Provider}Provider` — `AnthropicProvider`, `ResendProvider`
- Entities: plain interface, PascalCase — `User`, `Order`
- Contracts: interface with `I` prefix — `IUserRepository`, `ILLMProvider`
