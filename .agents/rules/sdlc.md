# SDLC — Development Workflow

## Sequence for every non-trivial change

1. **Plan** — `/orc` first when the change opens or closes a phase or may touch a product non-negotiable; then scope files and layers in plan mode (`/plan`)
2. **Implement** — code; run `pnpm typecheck` before committing
3. **Review** — correctness, contracts, layer compliance, type safety, security
4. **Commit** — one logical unit, conventional prefix, `Co-Authored-By` trailer
5. **Push** — push after every commit

## Conventional commit prefixes
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — no behavior change
- `test:` — tests only
- `chore:` — tooling, deps, config

## Before committing
All four must pass. Always with a heap cap and a timeout, and jest on one worker:

```bash
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm typecheck
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm lint
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm test --runInBand
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm build
```

When the change touches `supabase/`, also run the migrations from scratch on a local stack that is thrown away afterwards. Type checks and unit tests do not catch a SQL error, a missing grant or a broken function:

```bash
supabase start
supabase db reset --local --no-seed   # applies every migration to an empty database
# check grants and functions as the app's role (anon / authenticated), not as the owner
supabase stop --no-backup             # removes the volumes: no state is kept between runs
```

On every dependency or security pass: `pnpm audit`, then `pnpm update` (stays inside the declared ranges, no major jump), then re-pin to the exact resolved versions. Name the runtime packages that moved in the commit message.

## Adding a new domain
1. Create `src/core/{domain}/{contracts,entities,services}/`
2. Add contract interfaces first; entities next, services last
3. Create entity types
4. Implement services (one class per use case)
5. Create `src/infrastructure/repositories/{domain}.repository.ts`, extending `BaseRepository` (it injects the `SupabaseClient` and converts a Postgres error into `DatabaseError`)
6. Wire in `src/app/api/v1/{domain}/route.ts`: thin. Validate with Zod, inject, call, respond
7. Add `src/features/{domain}/` for UI

## Adding a new integration
1. Create `src/infrastructure/{provider}/{name}.provider.ts`
2. Define interface in relevant `core/{domain}/contracts/index.ts`
3. Inject via constructor in route handler
