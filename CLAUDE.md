# CLAUDE.md — nextjs-saas-starter

Boilerplate SaaS em Next.js 16 / React 19, organizado em DDD + Clean Architecture. **É um template**: a maior parte do valor está na estrutura e nos contratos, não em features prontas. Leia a seção "Estado real do código" antes de assumir que algo existe.

## Regras detalhadas

O detalhe fica em `.agents/rules/`. Carregue o arquivo quando o assunto aparecer, não antes.

| Assunto | Arquivo |
|---------|---------|
| Camadas e regra de dependência | [`.agents/rules/architecture.md`](.agents/rules/architecture.md) |
| Stack e versões | [`.agents/rules/tech-stack.md`](.agents/rules/tech-stack.md) |
| Convenções de API, nomes, estilo | [`.agents/rules/project-guidelines.md`](.agents/rules/project-guidelines.md) |
| Hierarquia de erros | [`.agents/rules/error-handling.md`](.agents/rules/error-handling.md) |
| Auth (Supabase, magic link) | [`.agents/rules/auth-guidelines.md`](.agents/rules/auth-guidelines.md) |
| Fluxo de trabalho / commits | [`.agents/rules/sdlc.md`](.agents/rules/sdlc.md) |
| Segurança | [`.agents/rules/security-analysis.md`](.agents/rules/security-analysis.md) |

Skills ficam em dois lugares. Cinco têm a fonte em `.agents/skills/` (frontend-design, security-review, copywriting, marketing-psychology, vercel-react-best-practices), e `.claude/skills/` só tem um symlink para cada uma: edite a fonte, nunca pelo symlink. As outras oito (orc, interface-design, theme-factory, documentation-organizer, webapp-testing, agentic-owasp-security, branding-specialist, marketing-specialist) existem apenas em `.claude/skills/`, que é a fonte delas. Todas são cópias vendorizadas: nada as atualiza sozinho.

## Regra de dependência

```
app/ → features/ → core/
infrastructure/ implementa contratos de core/
shared/ é usado por todas as camadas, exceto core/
```

`core/` não importa Next.js, Supabase, HTTP ou React. Se um import quebra isso, a lógica está na camada errada.

Route handler é composition root, o único lugar que instancia repositório e serviço:

```typescript
export async function GET() {
  try {
    const authUser = await getCurrentUser();          // lança UnauthorizedError
    await checkRateLimit(`users-get:${authUser.id}`);
    const supabase = await createClient();
    const service = new GetUserService(new UserRepository(supabase));
    return ok(await service.execute(authUser.id));
  } catch (err) {
    return handleError(err);                          // mapeia todo erro para HTTP
  }
}
```

## Estado real do código

O que está implementado e funcionando:

| Peça | Caminho |
|------|---------|
| Envelope de API (`ok` / `created` / `handleError`) | `src/shared/utils/api-handler.ts` |
| Hierarquia de erros tipados | `src/shared/errors/index.ts` |
| Rate limit (Upstash, no-op sem env) | `src/shared/utils/rate-limit.ts` |
| Sessão Supabase por cookie | `src/proxy.ts`, `src/infrastructure/database/{server,client,admin,auth-session}.ts` |
| Domínio de exemplo (users) | `src/core/users/`, `src/infrastructure/repositories/user.repository.ts`, `src/app/api/v1/users/route.ts` |
| Providers | `llm/anthropic.provider.ts`, `email/resend.provider.ts`, `billing/polar.provider.ts` |
| Webhook Polar com verificação de assinatura | `src/app/api/v1/webhooks/polar/route.ts` |
| Gate de super-admin de plataforma | `supabase/migrations/20260827000000_platform_admin.sql`, `src/core/platform/`, `src/infrastructure/database/platform-admin-session.ts` |
| i18n cookie-based (pt-BR/pt/en, sem prefixo de URL) | `src/shared/i18n/` |
| TanStack Query provider | `src/shared/providers/query-provider.tsx` |
| Zustand (estado de UI, não de servidor) | `src/shared/stores/` |

Diretórios que **existem mas estão vazios**. Os rules descrevem o padrão, não o conteúdo:

- `src/features/`: ainda sem features. A primeira define o padrão `{feature}/{components,hooks}/`
- `src/shared/components/ui/`: `components.json` aponta shadcn para cá, mas nenhum componente foi instalado. Rode `pnpm dlx shadcn@latest add <componente>` antes de importar.
- `src/config/prompts/`, `docs/architecture/`
- `src/core/users/services/__tests__/` (o domínio `platform` já tem teste; `users` ainda não)

## Lacunas conhecidas (não são bugs, são pendências do template)

1. **Poucos testes.** `jest.config.js` existe e funciona (ts-jest, jsdom por omissão, alias `@/`), mas só o gate de plataforma tem suíte. Um teste node puro opta por sair do jsdom com `@jest-environment node` no topo do arquivo.
2. **Tipos do Supabase são placeholder.** `src/infrastructure/database/types.ts` declara `Tables: { [name: string]: GenericTable }` com `Record<string, unknown>`, ou seja, o cliente tipado não valida nada. Gere os tipos reais (`supabase gen types typescript --project-id <id>`) assim que houver schema. A CLI do Supabase não é dependência do projeto; use `pnpm dlx supabase`.
3. **Modelos Anthropic desatualizados.** `anthropic.provider.ts` fixa `claude-sonnet-4-6` e `claude-opus-4-8` como padrão. A família atual é Claude 5 (`claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`). Atualize antes de usar o provider para valer.
4. **`.nvmrc` diz 22, a máquina roda 24.** Node 24 é o padrão atual da Vercel; o `.nvmrc` é que está atrasado.
5. **A migration de `platform_admins` é a única versionada.** A tabela `public.users` que `UserRepository` consulta não é criada por migration nenhuma: o schema base do Supabase só existe no projeto remoto. A cadeia de migrations começa no meio.
6. **Três dependências seguram versão de propósito**, todas travadas pelo mesmo ecossistema de lint:
   - `eslint` fica no 9. O 10 remove `context.getFilename()`, e o `eslint-plugin-react@7.37.5` (dep transitiva do `eslint-config-next`) ainda chama esse método: `pnpm lint` morre com `contextOrFilename.getFilename is not a function`. O npm já marca o 9.39.5 como sem suporte, então isto é dívida com prazo.
   - `typescript` fica no 6. O `typescript-eslint@8.68` recusa TS 7.0 explicitamente ("does not support TS 7.0"), e o ts-jest também quebra. Só `tsc` e `next build` passam. Rastreamento: typescript-eslint#10940, que fala em suportar TS >= 7.1.
   - `@types/node` fica no 25. Subir pro 26 aumenta o descasamento com o runtime: a máquina roda Node 24 e a Vercel também. O ajuste certo é ir pra `^24` e corrigir o `.nvmrc` junto, não subir.

## Comandos

Esta máquina congela quando o tooling Node cresce demais. Sempre com teto de heap e timeout:

```bash
pnpm dev --port 3100                                              # ver nota sobre portas
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm build
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm typecheck
NODE_OPTIONS="--max-old-space-size=1536" timeout 240 pnpm lint
NODE_OPTIONS="--max-old-space-size=1536" timeout 300 pnpm test --runInBand
```

**Portas:** 3000 e 3001 pertencem a outros projetos desta máquina. Use uma porta dedicada (3100+) e nunca `pkill next`, que mata o dev server de outra sessão.

**ESLint fica no v9.** O stack de lint do Next 16 (`eslint-config-next`) só suporta v9; se `ncu` propuser v10, recuse.

## Adicionar um domínio novo

1. `src/core/{domain}/{contracts,entities,services}/`: contrato primeiro, entidade depois, serviço por último
2. Um serviço = um caso de uso = um método público `execute()`
3. `src/infrastructure/repositories/{domain}.repository.ts`, estendendo `BaseRepository` (ela injeta o `SupabaseClient` e converte erro do Postgres em `DatabaseError`)
4. `src/app/api/v1/{domain}/route.ts`: fino. Valida com Zod, injeta, chama, responde
5. `src/features/{domain}/` para a UI

## Antes de commitar

`pnpm typecheck`, `pnpm lint` e `pnpm test` precisam passar. Commit em Conventional Commits, uma unidade lógica por commit.
