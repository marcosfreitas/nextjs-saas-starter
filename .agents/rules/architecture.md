# Architecture — Next.js SaaS Starter

## Layer overview

```
src/
├── config/         Static configuration — env vars, constants, prompt templates
├── core/           Domain — entities, contracts, domain services (pure, no framework)
├── infrastructure/ Concrete implementations of core contracts — DB, LLM, email, billing
├── features/       React UI layer — components and hooks per feature (no business logic)
├── shared/         Cross-cutting — UI primitives, errors, utils
└── app/            Next.js App Router — pages and thin API route handlers
```

**Dependency rule:**
`app/` → `features/` → `core/`; `infrastructure/` implements `core/` contracts; `shared/` used by all layers except `core/`.

---

## `core/`

Pure business logic. **No framework imports, no Supabase, no Next.js, no HTTP.** Testable in isolation.

```
core/
├── {domain}/
│   ├── contracts/    # Repository and service interfaces
│   ├── entities/     # Domain objects (plain TypeScript)
│   └── services/     # Use cases — one class, one public method: execute()
└── {capability}/
    └── contracts/    # Outbound port: llm/, email/, billing/
```

A port is an interface the domain declares and an outer layer fills. It belongs
in `core/` even when `core/` has no consumer for it yet: the point of the
interface is that the domain owns the shape and the vendor does not. Declaring
it next to the implementation inverts the dependency rule, because every
consumer then has to import from `infrastructure/` to name the type it depends
on, and swapping the vendor becomes a change to every call site instead of one
import.

---

## `infrastructure/`

Concrete implementations of `core/` contracts.

```
infrastructure/
├── database/       # Supabase client (client.ts, server.ts, admin.ts) + generated types
├── repositories/   # Implement core repository contracts
├── llm/            # AnthropicProvider — implements core/llm/contracts
├── email/          # ResendProvider — implements core/email/contracts
└── billing/        # PolarProvider — implements core/billing/contracts
```

---

## `features/`

React UI layer. One folder per product feature. No business logic, no direct DB calls.

```
features/
└── {feature}/
    ├── components/
    └── hooks/
```

---

## `shared/`

```
shared/
├── components/ui/    # shadcn/Radix primitives
├── components/       # Shared layout pieces
├── config/           # assertEnv and app-wide config
├── errors/           # Full error hierarchy
├── i18n/             # next-intl config, request handler, messages
├── providers/        # App-wide React providers (TanStack Query)
├── stores/           # Zustand client/UI state stores
└── utils/            # api-handler, rate-limit, cn()
```

---

## `app/`

Thin handlers only — validate input, inject infrastructure, call core service, return response.

```
app/
├── api/v1/              # REST endpoints
├── (authenticated)/     # Auth-guarded pages
├── (marketing)/         # Public pages
└── auth/                # Supabase auth flow
```

**Composition root pattern:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = Schema.parse(await req.json());
    const supabase = await createClient();
    const repo = new SomeRepository(supabase);
    const service = new SomeService(repo);
    const result = await service.execute({ userId: user.id, ...body });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
```

---

## Do / Don't

- **Do**: Keep `core/` free of all framework imports
- **Do**: Keep `features/` free of business logic
- **Do**: Make route handlers thin — validate, inject, call service, respond
- **Do**: One service class = one use case = one `execute()` method
- **Don't**: Import `infrastructure/` from `core/` or `features/`
- **Don't**: Import `core/` services directly from React components
- **Don't**: Put domain rules in route handlers — they belong in `core/services/`
