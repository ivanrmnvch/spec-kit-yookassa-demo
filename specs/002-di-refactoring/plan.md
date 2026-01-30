# Implementation Plan: Dependency Injection Refactoring (Constructor Injection)

**Branch**: `002-di-refactoring` | **Date**: 2026-01-29 | **Spec**: `specs/002-di-refactoring/spec.md`  
**Input**: Feature specification from `specs/002-di-refactoring/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor the payment service architecture from static Service Locator pattern to Constructor Injection without a DI container:

- Convert `PaymentsService` and `WebhookService` from static classes to instance classes with constructor injection
- Create service interfaces (`IIdempotencyService`, `IYookassaService`) and adapter classes to wrap static services
- Convert controllers and routes to factory functions with `create*` prefix
- Update `app.ts` to explicitly initialize all dependencies in correct order: Redis → Prisma → Repositories → Adapters → Services → Controllers → Routes
- Ensure Prisma client is explicitly connected (`await prisma.$connect()`) before creating any repositories or services
- Update all unit tests to work with instance classes

Non-negotiables (from constitution/spec):
- All dependencies must be visible in `app.ts` (no hidden or lazy initialization)
- Fail-fast behavior: connection errors caught at startup, not during first request
- Testability: dependencies can be easily mocked through constructors
- No DI container library (manual wiring in `app.ts`)
- Only PaymentsService and WebhookService refactored; other services remain static

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 20+  
**Primary Dependencies**: Express.js, Prisma, PostgreSQL, Redis (existing stack)  
**Storage**: PostgreSQL 15+ (primary), Redis 7+ (idempotency + rate limiting)  
**Testing**: Jest + ts-jest (existing test framework)  
**Target Platform**: Linux server (Docker Compose for local)  
**Project Type**: Single backend service (no frontend)  
**Performance Goals**: No performance impact (refactoring only, no functional changes)  
**Constraints**: No breaking changes to HTTP API endpoints; backward compatibility for external API  
**Scale/Scope**: Refactoring of 2 services (PaymentsService, WebhookService), 2 controllers, 2 route modules, and app.ts initialization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **GATE 1 (Constructor Injection)**: Services MUST use constructor injection, not static Service Locator pattern. ✅ PaymentsService and WebhookService will be converted to instance classes with constructor injection.

- **GATE 2 (Explicit Initialization)**: External dependencies (Prisma, Redis) MUST be explicitly connected/initialized BEFORE creating repositories and services. ✅ Prisma connection will be explicit (`await prisma.$connect()`) in `app.ts` before creating any repositories or services.

- **GATE 3 (Visible Dependencies)**: All dependencies MUST be visible in the application entry point (`app.ts`). ✅ Complete dependency graph will be visible in `app.ts`: Redis → Prisma → Repositories → Adapters → Services → Controllers → Routes.

- **GATE 4 (Fail-Fast)**: Connection errors MUST be caught at startup, not during first request. ✅ Error handling will log with full context and exit with `process.exit(1)` if any dependency initialization fails.

- **GATE 5 (Testability)**: Dependencies MUST be easily mockable through constructors. ✅ Instance classes with constructor injection enable easy mocking in tests.

- **GATE 6 (No Static Service Locator)**: Services MUST NOT use static methods with lazy initialization. ✅ All static methods in PaymentsService and WebhookService will be converted to instance methods.

## Project Structure

### Documentation (this feature)

```text
specs/002-di-refactoring/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── interfaces/      # NEW: Service interfaces (IIdempotencyService, IYookassaService)
│   ├── adapters/        # NEW: Adapter classes (IdempotencyServiceAdapter, YookassaServiceAdapter)
│   ├── payment.service.ts      # MODIFY: Convert to instance class
│   ├── webhook.service.ts      # MODIFY: Convert to instance class
│   ├── idempotency.service.ts  # UNCHANGED: Remains static
│   ├── yookassa.service.ts     # UNCHANGED: Remains static
│   └── payment-state-machine.ts # UNCHANGED: Remains static
├── controllers/
│   ├── payments.controller.ts  # MODIFY: Convert to factory functions
│   └── webhooks.controller.ts  # MODIFY: Convert to factory functions
├── routes/
│   ├── payments.ts      # MODIFY: Convert to factory function
│   └── webhooks.ts     # MODIFY: Convert to factory function
├── app.ts               # MODIFY: Add explicit dependency initialization
└── [other directories unchanged]
```

**Structure Decision**: Existing single backend project structure. New directories added for interfaces and adapters. No changes to existing directory layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Adapter pattern for static services | Enables Dependency Inversion Principle and consistent DI approach | Direct static calls would violate DI principles and make testing harder |

## Phase 0: Research (completed)

Output: `specs/002-di-refactoring/research.md`

Research topics:
- Constructor Injection patterns without DI containers
- Adapter pattern for wrapping static services
- Factory function patterns for controllers and routes
- Error handling during dependency initialization
- Migration strategies for refactoring static to instance classes

No unresolved "NEEDS CLARIFICATION" items remain (all clarified in spec).

## Phase 1: Design & Contracts (completed)

Outputs:
- `specs/002-di-refactoring/quickstart.md` - Migration guide and quick reference

Note: This is an architectural refactoring, so data-model.md and contracts/ are not applicable (no API changes, no new data entities).

## Phase 2: Implementation Plan (step-by-step)

### 2.1 Create Service Interfaces

- Create `src/services/interfaces/idempotency-service.interface.ts`:
  - Define `IIdempotencyService` interface with methods: `get(key: string)`, `set(key, hash, payment)`, `checkConflict(key, hash)`
  - Match the signature of `IdempotencyService` static methods
- Create `src/services/interfaces/yookassa-service.interface.ts`:
  - Define `IYookassaService` interface with methods: `createPayment(request, idempotenceKey)`, `getPayment(paymentId, correlationId)`
  - Match the signature of `YookassaService` static methods

### 2.2 Create Adapter Classes

- Create `src/services/adapters/idempotency-service.adapter.ts`:
  - Implement `IIdempotencyService` interface
  - Delegate all method calls to `IdempotencyService` static methods
  - No state, pure delegation wrapper
- Create `src/services/adapters/yookassa-service.adapter.ts`:
  - Implement `IYookassaService` interface
  - Delegate all method calls to `YookassaService` static methods
  - No state, pure delegation wrapper

### 2.3 Refactor PaymentsService to Instance Class

- Convert `src/services/payment.service.ts`:
  - Remove `static` keyword from class declaration
  - Remove all `private static readonly` properties (prisma, userRepository, paymentRepository)
  - Add constructor: `constructor(userRepository: UserRepository, paymentRepository: PaymentRepository, idempotencyService: IIdempotencyService, yookassaService: IYookassaService)`
  - Store dependencies as private instance properties
  - Convert all static methods to instance methods (remove `static` keyword)
  - Update internal references: `this.userRepository`, `this.paymentRepository`, `this.idempotencyService`, `this.yookassaService`
  - Replace `IdempotencyService.get()` with `this.idempotencyService.get()`
  - Replace `YookassaService.createPayment()` with `this.yookassaService.createPayment()`
  - Keep all business logic unchanged

### 2.4 Refactor WebhookService to Instance Class

- Convert `src/services/webhook.service.ts`:
  - Remove `static` keyword from class declaration
  - Remove all `private static readonly` properties (paymentRepository)
  - Add constructor: `constructor(paymentRepository: PaymentRepository, paymentsService: PaymentsService, yookassaService: IYookassaService)`
  - Store dependencies as private instance properties
  - Convert all static methods to instance methods (remove `static` keyword)
  - Update internal references: `this.paymentRepository`, `this.paymentsService`, `this.yookassaService`
  - Replace `PaymentsService.updatePaymentStatus()` with `this.paymentsService.updatePaymentStatus()`
  - Replace `YookassaService.getPayment()` with `this.yookassaService.getPayment()`
  - Keep all business logic unchanged

### 2.5 Convert Controllers to Factory Functions

- Convert `src/controllers/payments.controller.ts`:
  - Create `export function createPaymentController(paymentsService: PaymentsService)` factory function
  - Factory returns async controller function `(req, res, next) => Promise<void>`
  - Move existing `createPayment` logic into factory closure, using `paymentsService` parameter
  - Create `export function getPaymentController(paymentsService: PaymentsService)` factory function
  - Move existing `getPayment` logic into factory closure
  - Remove direct imports of `PaymentsService` static class
- Convert `src/controllers/webhooks.controller.ts`:
  - Create `export function processWebhookController(webhookService: WebhookService)` factory function
  - Factory returns async controller function `(req, res, next) => Promise<void>`
  - Move existing `processWebhook` logic into factory closure, using `webhookService` parameter
  - Remove direct imports of `WebhookService` static class

### 2.6 Convert Routes to Factory Functions

- Convert `src/routes/payments.ts`:
  - Create `export function createPaymentsRoutes(createPaymentController, getPaymentController)` factory function
  - Factory returns Express Router
  - Move existing route definitions into factory, using controller parameters
  - Remove direct imports of controller functions
  - Keep all middleware (rate limiting, validation, idempotence key) unchanged
- Convert `src/routes/webhooks.ts`:
  - Create `export function createWebhooksRoutes(processWebhookController)` factory function
  - Factory returns Express Router
  - Move existing route definitions into factory, using controller parameter
  - Remove direct imports of controller functions
  - Keep all middleware (IP allowlist, payload validation) unchanged

### 2.7 Update app.ts for Explicit Dependency Initialization

- Update `src/app.ts`:
  - Move Express app setup to top (before dependency initialization)
  - Add explicit initialization function `async function initializeDependencies()`
  - Initialize in correct order:
    1. `await getRedisClient()` - establish Redis connection
    2. `const prisma = getPrismaClient()` - get Prisma client
    3. `await prisma.$connect()` - explicitly connect to database
    4. `const userRepository = new UserRepository(prisma)` - create repositories
    5. `const paymentRepository = new PaymentRepository(prisma)` - create repositories
    6. `const idempotencyService = new IdempotencyServiceAdapter()` - create adapters
    7. `const yookassaService = new YookassaServiceAdapter()` - create adapters
    8. `const paymentsService = new PaymentsService(userRepository, paymentRepository, idempotencyService, yookassaService)` - create services
    9. `const webhookService = new WebhookService(paymentRepository, paymentsService, yookassaService)` - create services
    10. `const createPaymentController = createPaymentController(paymentsService)` - create controllers
    11. `const getPaymentController = getPaymentController(paymentsService)` - create controllers
    12. `const processWebhookController = processWebhookController(webhookService)` - create controllers
    13. `const paymentsRoutes = createPaymentsRoutes(createPaymentController, getPaymentController)` - create routes
    14. `const webhooksRoutes = createWebhooksRoutes(processWebhookController)` - create routes
    15. `app.use("/api/payments", paymentsRoutes)` - mount routes
    16. `app.use("/api/webhooks", webhooksRoutes)` - mount routes
  - Wrap initialization in try-catch:
    - On error: log with full context (dependency name, error message, stack trace) using structured logging
    - Exit with `process.exit(1)`
  - Call `initializeDependencies()` in `startServer()` before starting HTTP server
  - Update graceful shutdown to disconnect Prisma explicitly

### 2.8 Update Unit Tests

- Update all test files that use PaymentsService:
  - Create mock repositories: `mockUserRepository`, `mockPaymentRepository`
  - Create mock adapters: `mockIdempotencyService`, `mockYookassaService`
  - Create service instance: `new PaymentsService(mockUserRepository, mockPaymentRepository, mockIdempotencyService, mockYookassaService)`
  - Replace all `PaymentsService.createPayment()` calls with `paymentsService.createPayment()`
  - Replace all `PaymentsService.getPaymentById()` calls with `paymentsService.getPaymentById()`
  - Replace all `PaymentsService.updatePaymentStatus()` calls with `paymentsService.updatePaymentStatus()`
- Update all test files that use WebhookService:
  - Create mock repository: `mockPaymentRepository`
  - Create mock service: `mockPaymentsService`
  - Create mock adapter: `mockYookassaService`
  - Create service instance: `new WebhookService(mockPaymentRepository, mockPaymentsService, mockYookassaService)`
  - Replace all `WebhookService.processWebhook()` calls with `webhookService.processWebhook()`
- Update controller tests:
  - Create service instances with mocks
  - Create controllers via factory functions: `createPaymentController(mockPaymentsService)`
  - Test controller behavior with mocked services
- Verify all tests pass after refactoring

### 2.9 Re-check Constitution Gates

- Re-run the Constitution Check section and ensure no violations remain:
  - ✅ GATE 1: Constructor Injection - PaymentsService and WebhookService use constructor injection
  - ✅ GATE 2: Explicit Initialization - Prisma explicitly connected before repositories/services
  - ✅ GATE 3: Visible Dependencies - All dependencies visible in app.ts
  - ✅ GATE 4: Fail-Fast - Error handling with logging and exit on initialization failure
  - ✅ GATE 5: Testability - Dependencies mockable through constructors
  - ✅ GATE 6: No Static Service Locator - All static methods converted to instance methods
