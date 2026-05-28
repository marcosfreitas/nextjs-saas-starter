# Layer Responsibilities (Detail)

## Domain Layer

Contains core business logic and domain models. Independent of external frameworks and libraries.

**Contains:**
- **Entities**: Core business objects with identity and lifecycle.
- **Value Objects**: Immutable objects with no identity.
- **Domain Services**: Business operations that span multiple entities.
- **Repository Interfaces**: Data access contracts (placed in `shared/`).

**Rules:**
- No dependencies on other layers.
- Pure business logic — no infrastructure concerns (no I/O, no framework imports).
- Defines its own error type: `DomainError`.

## Application Layer

Orchestrates use cases and coordinates between domain and infrastructure.

**Contains:**
- **Use Case Implementations**: Business workflows that compose domain logic.
- **Use Case Interfaces**: Contracts for the function/interface layer (placed in `shared/`).
- **Configuration**: Use-case-specific settings.

**Rules:**
- Depends only on `domain`.
- No direct infrastructure dependencies — uses contracts.
- Defines its own error type: `ApplicationError`.

## Infrastructure Layer

Implements external concerns and technical details.

**Contains:**
- **Repository Implementations**: Database access (implements domain repository interfaces).
- **External Service Clients**: AWS SDKs, third-party APIs.
- **Logging and Monitoring**: Technical observability.
- **Dependency Injection**: Service wiring and composition roots.

**Rules:**
- Implements interfaces from `shared/` contracts.
- Depends on `domain` and `application`.
- Handles all external communication.
- Defines its own error type: `InfrastructureError`.

## Shared Layer

Contains contracts and utilities used across layers.

**Contains:**
- **Repository Interfaces**: Data access contracts.
- **Use Case Interfaces**: Application contracts.
- **Common Types**: Shared data structures.
- **Utilities**: Helper functions.
- **Middlewares**: Shared middleware functions.

**Rules:**
- No business logic.
- No dependencies on other layers.
- Used by all layers to maintain boundaries.

## Functions / Interfaces Layer

Entry points that trigger application use cases. For Lambda projects this is `functions/` or `interfaces/.../lambdas`; for Web APIs this is `interfaces/.../http/.../controllers`.

**Contains:**
- **Handler Logic**: Request/response or event handling.
- **Function Configuration**: AWS-specific or framework-specific settings.
- **Input/Output Types**: API or event contracts.

**Rules:**
- Depends on the `application` layer (calls use cases).
- No business logic — thin adapter between external trigger and application.
- Handles HTTP/event integration, serialization, and response formatting.

## Commons Layer (optional)

Similar to `shared/`, but groups contracts and resources that can be present in any project, even if not used. Its content is part of the **base repository template** used for new projects that follow these guidelines.
