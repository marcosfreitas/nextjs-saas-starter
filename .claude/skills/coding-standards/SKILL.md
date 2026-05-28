---
name: coding-standards
description: Enforce DDD + Clean Architecture coding standards for TypeScript/Node.js projects. Use when writing new code, reviewing code, creating files, naming things, handling errors, setting up middleware, or when the user asks about coding conventions, layer responsibilities, or project patterns.
---

# Coding Standards — DDD + Clean Architecture (TypeScript/Node.js)

These standards apply **inside** the folder structure defined by the architecture rule. That rule defines **where** things go; this skill defines **how** to write them.

> The guidelines are mutable by project — every project has its challenges. We keep improving as we find new generic use cases or modern features.

## Layer Independence (dependency rule)

Dependencies flow **inward only**:

```
interfaces/functions → application → domain
                           ↑
infrastructure ────────────┘ (implements contracts)
```

- `domain` has **zero** external dependencies.
- `application` depends only on `domain`.
- `infrastructure` implements contracts from `domain`/`application`; depends on both.
- `interfaces` (controllers) or `functions` (lambdas) depend on `application`.
- Layers communicate through **contracts** (interfaces/types).
- Outer layers may depend on inner layers, never the reverse.

## Contracts and Interfaces

- **Shared contracts** (used across layers): placed in `shared/` (e.g. repository interfaces, use-case interfaces).
- **Layer-specific contracts** (used within one layer): placed in that layer.
- Always define cross-layer communication via TypeScript interfaces.

## Versioning Strategy

- Version domains and use cases independently (`v1`, `v2`, …).
- Versioning applies to: domain models, use cases, API endpoints/functions.
- Maintain backward compatibility; document breaking changes; plan deprecation.

## Naming Conventions

### Files and directories

| Target | Convention | Examples |
|--------|-----------|----------|
| Directories | kebab-case | `key-management/`, `user-repository/` |
| Regular files | camelCase | `index.ts`, `config.ts`, `utils.ts` |
| Class/interface files | PascalCase | `UserRepository.ts`, `KeyService.ts` |

### Code

| Target | Convention | Examples |
|--------|-----------|----------|
| Classes, Interfaces | PascalCase | `class UserRepository`, `interface KeyService` |
| Interface prefix | `I` | `IUserRepository`, `IKeyService` |
| Type suffix | `Type` | `UserType`, `ApplicationContextVariablesType` |
| Functions, methods | camelCase | `getUserById()`, `validateKey()` |
| Variables, parameters | camelCase | `const userData`, `let isActive` |
| Environment variables | UPPER_SNAKE_CASE | `AWS_REGION`, `DATABASE_URL` |

## Error Handling

Three error hierarchies, one per inner layer:

| Layer | Base class | Example |
|-------|-----------|---------|
| Domain | `DomainError` | `InvalidKeyError` |
| Application | `ApplicationError` | `KeyNotFoundError` |
| Infrastructure | `InfrastructureError` | `DatabaseConnectionError` |

Catch errors by type:

```typescript
try {
  await keyService.validateKey(key);
} catch (error) {
  if (error instanceof DomainError) { /* handle */ }
  else if (error instanceof ApplicationError) { /* handle */ }
  else { /* unexpected */ }
}
```

## Middleware (Lambda with Middy)

Default order — adjust only if a specific use case requires it:

```typescript
const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
  .use(httpHeaderNormalizer())
  .use(httpSecurityHeaders())
  .use(awsXRayTracer())
  .use(requestIdentificationMiddleware())
  .use(loggerMiddleware())
  .use(contentTypeValidator())
  .use(externalLambdaValidator(RequestSchema))
  .use(captureSsmParameters<AppContextType>(SSMVariables))
  .use(configValidator<IAllConfigVariables>(AllConfigVariables))
  .use(versionMiddleware(versionOptions))
  .use(mainErrorHandlerMiddleware())
  .handler(async (event, context) => event.handler(event as never, context));
```

For middleware descriptions and details, see [references/patterns-and-examples.md](references/patterns-and-examples.md).

## Logging

| Level | When |
|-------|------|
| ERROR | Needs immediate attention |
| WARN | Potentially harmful |
| INFO | General operational info |
| DEBUG | Detailed debugging |

- Always include `correlationId`.
- Use structured JSON logging.
- Never log sensitive/PII data.
- For log format details, see [references/patterns-and-examples.md](references/patterns-and-examples.md).

## Testing (Jest)

- Colocate `__tests__/` and `__mocks__/` next to the source they cover (no top-level `tests/` folder).
- Test each layer in isolation; mock cross-layer dependencies.
- Include integration tests for layer interactions.
- Follow the same versioning structure in tests.

## Shared and Commons Folders

- **`shared/`**: Any common resources used across the project — contracts, middlewares, utilities, shared types, helpers. Promotes reuse.
- **`commons/`** (optional): Resources that belong in the base repository template, present in every project even if not used. Part of the project template that follows these guidelines.

## API Documentation (OpenAPI)

- Use OpenAPI 3.0; document all endpoints with request/response examples and error responses.
- Version in URL path (`/v1/keys`) or headers.
- Structure: `swagger/paths/`, `swagger/components/schemas|parameters|responses/`, `swagger.yaml`.

## Environment Configuration

- Group env files: `.env.dev`, `.env.staging`, `.env.prod` under `config/`.
- Use UPPER_SNAKE_CASE; group related variables with prefixes; provide defaults where appropriate.

## Additional Resources

- **Layer responsibilities in detail**: [references/layer-responsibilities.md](references/layer-responsibilities.md)
- **Patterns, examples, and middleware details**: [references/patterns-and-examples.md](references/patterns-and-examples.md)
