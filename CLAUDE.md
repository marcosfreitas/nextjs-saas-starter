# CLAUDE.md — nextjs-saas-starter

SaaS boilerplate on Next.js 16 / React 19, organised as DDD + Clean Architecture. **It is a template**: most of the value is in the structure and the contracts, not in finished features. Read "Actual state of the code" before assuming something exists.

## Detailed rules

The rules live in `.agents/rules/` and reach Claude through `.claude/rules/`, which is a symlink to that folder. Each file has a `paths` block at the top, and the rule enters the context only when Claude touches a file that matches the pattern. There is no need to open the file by hand. When you create a rule, give it its `paths` in the frontmatter. A rule with no `paths` loads in every session, so use that only for what applies everywhere (today: `sdlc.md` and `tech-stack.md`, plus the product's `context.md` once it exists).

`orc` (`/orc`) looks after phases, the roadmap and the product context. The architectural decisions do not live in it: they are in the rules, which load on their own.

Skills live in two places. Five have their source in `.agents/skills/` (frontend-design, security-review, copywriting, marketing-psychology, vercel-react-best-practices), and `.claude/skills/` holds only a symlink to each: edit the source, never through the symlink. The other eight (orc, interface-design, theme-factory, documentation-organizer, webapp-testing, agentic-owasp-security, branding-specialist, marketing-specialist) exist only in `.claude/skills/`, which is their source. All are vendored copies: nothing updates them automatically.

## Dependency rule

```
app/ → features/ → core/
infrastructure/ implements the contracts of core/
shared/ is used by every layer except core/
```

`core/` does not import Next.js, Supabase, HTTP or React. If an import breaks that, the logic is in the wrong layer.

A route handler is the composition root, the only place that instantiates a repository and a service:

```typescript
export async function GET() {
  try {
    const authUser = await getCurrentUser();          // throws UnauthorizedError
    await checkRateLimit(`users-get:${authUser.id}`);
    const supabase = await createClient();
    const service = new GetUserService(new UserRepository(supabase));
    return ok(await service.execute(authUser.id));
  } catch (err) {
    return handleError(err);                          // maps every error to HTTP
  }
}
```

## Actual state of the code

What is implemented and working:

| Piece | Path |
|------|---------|
| API envelope (`ok` / `created` / `handleError`) | `src/shared/utils/api-handler.ts` |
| Typed error hierarchy | `src/shared/errors/index.ts` |
| Rate limit (Upstash, no-op without env) | `src/shared/utils/rate-limit.ts` |
| HTML escaping and email template | `src/shared/utils/html.ts` (`escapeHtml`, `renderTemplate`) |
| GET for a URL third parties can influence (does not decode Brotli) | `src/shared/http/safe-get.ts` (`safeGet`) |
| Sign-up and sign-in by an 8-digit email code, no password, no link, onboarding and consent | `src/app/auth/sign-in/`, `src/app/onboarding/`, `src/app/(authenticated)/layout.tsx` (gate), `src/infrastructure/database/auth-session.ts` (`getCurrentUser` for API routes, `getCurrentUserForPage` for server pages, base check), `src/shared/utils/otp.ts`, `src/infrastructure/database/profile.ts`, `supabase/config.toml`, `supabase/templates/code.html`, `supabase/migrations/20261025{170000,180000}_*.sql` (no passwords, profiles and consents), `supabase/migrations/20261111{000000,000100,000200}_*.sql` (end password sessions, `complete_onboarding()`, acceptance per terms version) |
| Supabase session by cookie | `src/proxy.ts` (only refreshes the cookie), `src/infrastructure/database/{server,client,admin,auth-session}.ts` |
| Example domain (users) | `src/core/users/`, `src/infrastructure/repositories/user.repository.ts`, `src/app/api/v1/users/route.ts` |
| Providers (adapters) | `llm/anthropic.provider.ts`, `email/resend.provider.ts`, `billing/polar.provider.ts` |
| Ports they implement | `src/core/{llm,email,billing}/contracts/index.ts` |
| Model refusal error (HTTP 200, `stop_reason: refusal`) | `LLMRefusalError` in `src/shared/errors/index.ts` |
| Polar webhook with signature verification | `src/app/api/v1/webhooks/polar/route.ts` |
| Platform super-admin gate | `supabase/migrations/20260827000000_platform_admin.sql`, `src/core/platform/`, `src/infrastructure/database/platform-admin-session.ts` |
| Cookie-based i18n (pt-BR/pt/en, no URL prefix) | `src/shared/i18n/` |
| TanStack Query provider | `src/shared/providers/query-provider.tsx` |
| Zustand (UI state, not server state) | `src/shared/stores/` |

Directories that **exist but are empty**. The rules describe the pattern, not the content:

- `src/features/`: no features yet. The first one sets the `{feature}/{components,hooks}/` pattern
- `src/shared/components/ui/`: `components.json` points shadcn here, but no component has been installed. Run `pnpm dlx shadcn@latest add <component>` before importing.
- `src/config/prompts/`, `docs/architecture/`
- `src/core/users/services/__tests__/` (the `platform` domain already has a test; `users` does not yet)

## Known gaps (not bugs, pending work in the template)

1. **Few tests.** `jest.config.js` exists and works (ts-jest, jsdom by default, `@/` alias). Suites today: the platform gate, the auth session helpers and the onboarding check (`src/infrastructure/database/__tests__/`), `safeGet`, and the `html`, `otp` and `safe-next` utils. `scripts/check-auth-config.test.mjs` runs outside jest, with `pnpm test:auth-config`. The `users` domain, the providers and the route handlers have none. A pure node test opts out of jsdom with `@jest-environment node` at the top of the file.
2. **The Supabase types are a placeholder.** `src/infrastructure/database/types.ts` declares `Tables: { [name: string]: GenericTable }` with `Record<string, unknown>`, so the typed client validates nothing. Generate the real types (`supabase gen types typescript --project-id <id>`) as soon as there is a schema. The Supabase CLI is not a project dependency; use `pnpm dlx supabase`.
3. **The Anthropic SDK is behind the models.** The IDs in `anthropic.provider.ts` are current (`claude-opus-5-5` by default), but the `Model` union of `@anthropic-ai/sdk@0.121.0` does not list the 5.5 family: they pass through the type's `(string & {})` fallback, not because they are declared. It works, and you lose autocomplete and the wrong-ID check. Upgrade the SDK before using the provider in earnest.
4. **`.nvmrc` says 22, the machine runs 24.** Node 24 is Vercel's current default; the `.nvmrc` is the one that is behind.
5. **`public.users` has no migration.** The versioned migrations create `platform_admins`, `profiles` and `consents`, but the `public.users` table that `UserRepository` queries is not created by any of them. The template has no hosted project, so nothing else creates it either: a project built from the template adds that migration with its first real schema.
6. **Three dependencies hold their version on purpose**, all pinned by the same lint ecosystem:
   - `eslint` stays on 9. Version 10 removes `context.getFilename()`, and `eslint-plugin-react@7.37.5` (a transitive dependency of `eslint-config-next`) still calls it: `pnpm lint` dies with `contextOrFilename.getFilename is not a function`. npm already marks 9.39.5 as unsupported, so this is debt with a deadline.
   - `typescript` stays on 6. `typescript-eslint@8.68` refuses TS 7.0 explicitly ("does not support TS 7.0"), and ts-jest breaks too. Only `tsc` and `next build` pass. Tracking: typescript-eslint#10940, which talks about supporting TS >= 7.1.
   - `@types/node` stays on 25. Going to 26 widens the mismatch with the runtime: the machine runs Node 24 and so does Vercel. The right move is to go to `^24` and fix the `.nvmrc` with it, not to go up.

### Brotli (CVE-2026-111497)

Node 22.23.4, 24.22.1 and 26.12.1 fix the Brotli decoder. Until the platform is on those versions, two code rules apply:

- **Response from a URL the user or a third party can influence:** use `safeGet`, never `fetch`. The built-in `fetch` decodes `br` on its own, before your code sees the response. `safeGet` refuses any `Content-Encoding` other than identity, gzip and deflate before reading the body, and does not follow redirects. Removing `br` from `Accept-Encoding` is not enough: the server may answer `br` anyway.
- **Request body:** Next 16.4.3 (route handlers) and Fastify do not decode `br` by default; Express 5 and body-parser 2 do. If Express ever enters this repo, refuse `br` in the middleware (`inflate: false` gives 415 for `br` and `gzip`) before any parser.

## Commands

This machine freezes when Node tooling grows too large. Always with a heap cap and a timeout:

```bash
pnpm dev --port 3100                                              # see the note on ports
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm build
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm typecheck
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm lint
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm test --runInBand
```

**Ports:** 3000 and 3001 belong to other projects on this machine. Use a dedicated port (3100+) and never `pkill next`, which kills another session's dev server.

**ESLint stays on v9.** The Next 16 lint stack (`eslint-config-next`) only supports v9; if `ncu` proposes v10, refuse.

## Adding a new domain

1. `src/core/{domain}/{contracts,entities,services}/`: contract first, entity next, service last
2. One service = one use case = one public `execute()` method
3. `src/infrastructure/repositories/{domain}.repository.ts`, extending `BaseRepository` (it injects the `SupabaseClient` and converts a Postgres error into `DatabaseError`)
4. `src/app/api/v1/{domain}/route.ts`: thin. Validates with Zod, injects, calls, responds
5. `src/features/{domain}/` for the UI

## Before committing

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` must pass, always with the heap cap and timeout from "Commands". If the change touches `supabase/`, also run the migrations from scratch on a disposable local stack (`supabase db reset`, then `supabase stop --no-backup`). The step by step is in `.agents/rules/sdlc.md`. Commits follow Conventional Commits, one logical unit per commit.
