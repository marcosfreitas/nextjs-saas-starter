# nextjs-saas-starter

Production-ready Next.js SaaS boilerplate with DDD/Clean Architecture.

## Stack

- **Next.js 16** + **React 19** + **TypeScript** (strict)
- **Supabase** — PostgreSQL + Auth
- **Tailwind CSS 4** + **shadcn/ui**
- **Anthropic Claude** — LLM integration
- **Resend** — transactional email
- **Polar** — billing + subscriptions
- **Upstash** — rate limiting

## Architecture

```
src/
├── config/         env config
├── core/           domain (pure, no framework)
│   └── {domain}/
│       ├── contracts/   interfaces
│       ├── entities/    domain objects
│       └── services/    use cases
├── infrastructure/ implementations
│   ├── database/   supabase clients
│   ├── llm/        AnthropicProvider
│   ├── email/      ResendProvider
│   ├── billing/    PolarProvider
│   └── repositories/
├── features/       React components + hooks
├── shared/         errors, utils, ui primitives
└── app/            Next.js App Router
    ├── api/v1/     thin route handlers
    ├── (authenticated)/
    ├── (marketing)/
    └── auth/
```

## Setup

```bash
cp .env.local.example .env.local
pnpm install
pnpm dev
```

See `CLAUDE.md` for agent rules and development workflow.
