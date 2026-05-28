# Patterns and Examples

## Error Handling

### Error hierarchy

```typescript
// Domain Error
class InvalidKeyError extends DomainError {
  constructor(message: string) {
    super('INVALID_KEY', message);
  }
}

// Application Error
class KeyNotFoundError extends ApplicationError {
  constructor(keyId: string) {
    super('KEY_NOT_FOUND', `Key ${keyId} not found`);
  }
}
```

### Catching by type

```typescript
try {
  await keyService.validateKey(key);
} catch (error) {
  if (error instanceof DomainError) {
    // Business rule violation
  } else if (error instanceof ApplicationError) {
    // Use case failure
  } else {
    // Unexpected / infrastructure
  }
}
```

---

## Middleware (Lambda with Middy)

### Default order

```typescript
const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
  .use(httpHeaderNormalizer())
  .use(httpSecurityHeaders())
  .use(awsXRayTracer())
  .use(requestIdentificationMiddleware())
  .use(loggerMiddleware())
  .use(contentTypeValidator())
  .use(externalLambdaValidator(GetKeysRequestSchema))
  .use(captureSsmParameters<ApplicationContextVariablesType>(SSMVariables))
  .use(configValidator<IGetKeysAllConfigVariables>(GetKeysAllConfigVariables))
  .use(versionMiddleware(versionOptions))
  .use(mainErrorHandlerMiddleware())
  .handler(async (event, context) => event.handler(event as never, context));
```

### Middleware descriptions

| Middleware | Purpose |
|-----------|---------|
| `httpHeaderNormalizer` | Normalizes HTTP headers for consistency |
| `httpSecurityHeaders` | Adds standard security headers to responses |
| `awsXRayTracer` | Integrates AWS X-Ray tracing for observability |
| `requestIdentificationMiddleware` | Attaches a unique request ID for tracing |
| `loggerMiddleware` | Sets up structured logging for the request lifecycle |
| `contentTypeValidator` | Validates the `Content-Type` header |
| `externalLambdaValidator` | Validates the request body against a schema |
| `captureSsmParameters` | Loads parameters from AWS SSM Parameter Store |
| `configValidator` | Validates configuration variables |
| `versionMiddleware` | Handles API versioning logic |
| `mainErrorHandlerMiddleware` | Centralized error handling for the handler |

Adjust order only if a specific use case requires it.

---

## Logging

### Structured log format

```json
{
  "level": "ERROR",
  "timestamp": "2024-03-14T12:00:00Z",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "service": "key-management",
  "layer": "application",
  "useCase": "get-key",
  "message": "Key not found",
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Key 123 not found",
    "stack": "..."
  },
  "context": {
    "keyId": "123",
    "userId": "456"
  }
}
```

### Rules

- Always include `correlationId`.
- Log at the appropriate level (ERROR, WARN, INFO, DEBUG).
- Include relevant context (service, layer, useCase).
- Never log sensitive information or PII.
- Use structured (JSON) logging.

---

## Naming Examples

### Domain service file

```typescript
// File: domain/key-management/v1/services/KeyService.ts

interface IKeyService {
  validateKey(key: string): boolean;
  processKey(key: string): Promise<void>;
}

class KeyServiceImpl implements IKeyService {
  private readonly keyRepository: IKeyRepository;

  constructor(keyRepository: IKeyRepository) {
    this.keyRepository = keyRepository;
  }

  validateKey(key: string): boolean {
    // ...
  }

  async processKey(key: string): Promise<void> {
    // ...
  }
}
```

### Lambda handler file

```typescript
// File: interfaces/key-management/lambdas/v1/getKeys.ts

import { IKeyService } from '../../../../shared/v1/useCases/IKeyService';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // Thin adapter — delegates to use case
};
```

---

## Environment Configuration

### File layout

```
config/
├── .env.dev
├── .env.staging
├── .env.prod
└── index.ts
```

### Config module

```typescript
// config/index.ts
export const config = {
  environment: process.env.NODE_ENV || 'development',
  aws: {
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT,
  },
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10'),
  },
};
```

- Use UPPER_SNAKE_CASE for env vars.
- Group related variables with prefixes.
- Provide defaults where appropriate.

---

## API Documentation (OpenAPI)

### Folder structure

```
swagger/
├── paths/
│   └── keys/
│       ├── get.yaml
│       ├── post.yaml
│       └── delete.yaml
├── components/
│   ├── schemas/
│   ├── parameters/
│   └── responses/
└── swagger.yaml
```

### Example endpoint spec

```yaml
# swagger/paths/keys/get.yaml
get:
  summary: Get key by ID
  parameters:
    - name: keyId
      in: path
      required: true
      schema:
        type: string
  responses:
    '200':
      description: Key found
      content:
        application/json:
          schema:
            $ref: '../components/schemas/Key.yaml'
    '404':
      description: Key not found
      content:
        application/json:
          schema:
            $ref: '../components/responses/Error.yaml'
```

- Use OpenAPI 3.0.
- Document all endpoints with request/response examples and error responses.
- Version in URL path (`/v1/keys`) or headers.
- Include deprecation notices for old versions.
