# CLAUDE.md — Next.js SaaS Starter

Production-ready Next.js SaaS boilerplate following DDD/Clean Architecture.

## Agent Rules

| Rule | File |
|------|------|
| Architecture | [`.agents/rules/architecture.md`](.agents/rules/architecture.md) |
| Tech Stack | [`.agents/rules/tech-stack.md`](.agents/rules/tech-stack.md) |
| Project Guidelines | [`.agents/rules/project-guidelines.md`](.agents/rules/project-guidelines.md) |
| Error Handling | [`.agents/rules/error-handling.md`](.agents/rules/error-handling.md) |
| Auth | [`.agents/rules/auth-guidelines.md`](.agents/rules/auth-guidelines.md) |
| SDLC | [`.agents/rules/sdlc.md`](.agents/rules/sdlc.md) |
| Security | [`.agents/rules/security-analysis.md`](.agents/rules/security-analysis.md) |

## Quick Start

```bash
cp .env.local.example .env.local
# fill in .env.local
pnpm install
pnpm dev
```

## Layer Dependency Rule

```
app/ → features/ → core/
infrastructure/ implements core/ contracts
shared/ used by all layers except core/
```

## Pre-wired Integrations

| Integration | Location |
|-------------|----------|
| Anthropic / Claude | `src/infrastructure/llm/anthropic.provider.ts` |
| Resend email | `src/infrastructure/email/resend.provider.ts` |
| Polar billing | `src/infrastructure/billing/polar.provider.ts` |
| Supabase DB + Auth | `src/infrastructure/database/` |
| Upstash rate limiting | `src/shared/utils/rate-limit.ts` |

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # jest
```

## Adding a New Domain

1. `src/core/{domain}/{contracts,entities,services/}`
2. `src/infrastructure/repositories/{domain}.repository.ts`
3. `src/app/api/v1/{domain}/route.ts`
4. `src/features/{domain}/{components,hooks}/`

See `.agents/rules/sdlc.md` for full workflow.
