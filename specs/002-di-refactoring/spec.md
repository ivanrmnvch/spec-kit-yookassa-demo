# Feature Specification: Dependency Injection Refactoring (Constructor Injection)

**Feature Branch**: `002-di-refactoring`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "Создай спецификацию для рефакторинга архитектуры проекта на Dependency Injection (Constructor Injection) без использования DI-контейнера."

## Context & Motivation

### Current Architecture

The current implementation uses static classes with Service Locator pattern (lazy initialization via getter methods):

- **PaymentsService**: Static class with static methods (`createPayment`, `getPaymentById`, `updatePaymentStatus`). Dependencies (repositories) are initialized lazily via static properties that call `getPrismaClient()` on first access.
- **WebhookService**: Static class with static methods (`processWebhook`). Dependencies (repositories, services) are initialized lazily via static properties.
- **Prisma Client**: Initialized implicitly through `getPrismaClient()` function when repositories are first accessed, not explicitly connected before use.
- **Controllers**: Directly import and call static service methods (e.g., `PaymentsService.createPayment()`).
- **Routes**: Import controller functions directly and use them as Express route handlers.

### Problem Statement

The current architecture has several issues:

1. **Implicit initialization**: Prisma client is initialized lazily when repositories are first accessed, making it difficult to control when database connections are established.
2. **Poor testability**: Static classes with lazy initialization make it difficult to inject mocks for testing. Dependencies are hidden and cannot be easily replaced.
3. **Hidden dependencies**: The dependency graph is not visible in the application entry point (`app.ts`), making it hard to understand initialization order and lifecycle.
4. **No fail-fast behavior**: Connection errors (e.g., database unavailable) are only discovered when the first request accesses a repository, not at application startup.

### Target Architecture

The refactored architecture will use Constructor Injection without a DI container:

- **Instance classes**: Services and repositories become instance classes with constructor injection.
- **Explicit initialization**: All dependencies are created explicitly in `app.ts` in the correct order: Redis → Prisma → Repositories → Services → Controllers → Routes.
- **Factory functions**: Controllers and routes are created via factory functions that accept service instances as parameters.
- **Explicit connection**: Prisma client is explicitly connected (`await prisma.$connect()`) before creating any repositories or services.
- **Visible dependency graph**: All dependencies are visible in `app.ts`, making the initialization order clear and controllable.

This refactoring aligns with **Constitution Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)**, which requires explicit dependency initialization and constructor injection for improved testability and lifecycle control.

## Clarifications

### Session 2026-01-29

- Q: How should errors during dependency initialization be handled and logged? → A: Log error with full context (dependency name, error message, stack trace), then `process.exit(1)`.
- Q: Which services MUST be refactored to instance classes, and which can remain static? → A: Only PaymentsService and WebhookService MUST be refactored; all other services (YookassaService, IdempotencyService, etc.) remain static.
- Q: What should be the structure and naming convention for controller and route factory functions? → A: Named exports with `create*` prefix (e.g., `createPaymentController`, `createPaymentsRoutes`).
- Q: How should instance services access static services (YookassaService, IdempotencyService)? → A: Static services MUST be injected through constructors using interfaces (Dependency Inversion Principle). Interfaces (e.g., `IIdempotencyService`, `IYookassaService`) define the contract, and static services are wrapped in adapter classes that implement these interfaces. This ensures all dependencies are visible in constructors, enables easy testing with mocks, and maintains a uniform dependency injection approach.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refactor PaymentsService to instance class with constructor injection (Priority: P1)

As a developer, I want PaymentsService to be an instance class with constructor injection so that I can explicitly control its dependencies and easily test it with mocks.

**Why this priority**: PaymentsService is the core service for payment operations. Refactoring it first establishes the pattern for other services and enables immediate testability improvements.

**Independent Test**: Can be fully tested by creating a PaymentsService instance with mocked repositories and verifying that all methods work correctly. The service can be used independently of other services.

**Acceptance Scenarios**:

1. **Given** PaymentsService is refactored to an instance class, **When** I create an instance with `new PaymentsService(userRepository, paymentRepository)`, **Then** all methods (`createPayment`, `getPaymentById`, `updatePaymentStatus`) work correctly.
2. **Given** PaymentsService is an instance class, **When** I create a test instance with mocked repositories, **Then** I can test payment creation logic without a real database connection.
3. **Given** PaymentsService uses constructor injection, **When** I examine the constructor signature, **Then** all dependencies are explicitly visible (userRepository, paymentRepository).

---

### User Story 2 - Refactor WebhookService to instance class with constructor injection (Priority: P2)

As a developer, I want WebhookService to be an instance class with constructor injection so that I can explicitly control its dependencies and easily test it with mocks.

**Why this priority**: WebhookService depends on PaymentsService, so it should be refactored after PaymentsService to maintain the dependency order. This completes the service layer refactoring.

**Independent Test**: Can be fully tested by creating a WebhookService instance with mocked repositories and PaymentsService, and verifying that webhook processing works correctly.

**Acceptance Scenarios**:

1. **Given** WebhookService is refactored to an instance class, **When** I create an instance with `new WebhookService(paymentRepository, paymentsService)`, **Then** the `processWebhook` method works correctly.
2. **Given** WebhookService is an instance class, **When** I create a test instance with mocked dependencies, **Then** I can test webhook processing logic without real database or service connections.
3. **Given** WebhookService uses constructor injection, **When** I examine the constructor signature, **Then** all dependencies are explicitly visible (paymentRepository, paymentsService).

---

### User Story 3 - Update controllers to work with instance services (Priority: P3)

As a developer, I want controllers to work with instance services through factory functions so that dependencies are injected at controller creation time.

**Why this priority**: Controllers are the bridge between routes and services. They need to be updated to accept services as parameters (via factory functions) rather than importing static service classes.

**Independent Test**: Can be fully tested by creating controller functions via factory functions with mocked services, and verifying that controllers call service methods correctly and handle responses/errors appropriately.

**Acceptance Scenarios**:

1. **Given** controllers are updated to factory functions, **When** I create a controller with `createPaymentController(paymentsService)`, **Then** the controller uses the provided service instance instead of static methods.
2. **Given** controllers use factory functions, **When** I create test controllers with mocked services, **Then** I can test controller logic without real service implementations.
3. **Given** controllers are factory functions, **When** I examine the factory function signature, **Then** all service dependencies are explicitly visible as parameters.

---

### User Story 4 - Update routes to accept controllers via factory functions (Priority: P4)

As a developer, I want routes to accept controllers through factory functions so that controllers are created with the correct service instances.

**Why this priority**: Routes need to be updated to use factory functions that create controllers with injected services, rather than importing controller functions directly.

**Independent Test**: Can be fully tested by creating routes with factory functions that accept controllers, and verifying that routes are properly configured with the correct middleware and handlers.

**Acceptance Scenarios**:

1. **Given** routes are updated to factory functions, **When** I create routes with `createPaymentsRoutes(createPaymentController, getPaymentController)`, **Then** routes use the provided controller functions instead of directly imported controllers.
2. **Given** routes use factory functions, **When** I create test routes with mocked controllers, **Then** I can test route configuration without real controller implementations.
3. **Given** routes are factory functions, **When** I examine the factory function signature, **Then** all controller dependencies are explicitly visible as parameters.

---

### User Story 5 - Update app.ts for explicit dependency initialization (Priority: P5)

As a developer, I want app.ts to explicitly initialize all dependencies in the correct order so that the dependency graph is visible and database connections are established before services are created.

**Why this priority**: This is the final integration step that brings everything together. It ensures Prisma is explicitly connected before repositories/services are created, and makes the entire dependency graph visible in one place.

**Independent Test**: Can be fully tested by verifying that app.ts initializes dependencies in the correct order (Redis → Prisma → Repositories → Services → Controllers → Routes) and that Prisma is explicitly connected before repositories are created.

**Acceptance Scenarios**:

1. **Given** app.ts is updated for explicit initialization, **When** the application starts, **Then** Prisma client is explicitly connected (`await prisma.$connect()`) before any repositories or services are created.
2. **Given** app.ts uses explicit initialization, **When** I examine the startup code, **Then** the complete dependency graph is visible: Redis → Prisma → Repositories → Services → Controllers → Routes.
3. **Given** app.ts initializes dependencies explicitly, **When** a database connection fails at startup, **Then** the application fails fast with a clear error message before accepting requests.
4. **Given** app.ts creates all dependencies explicitly, **When** I trace the initialization flow, **Then** there are no hidden or lazy initializations (all dependencies are created in app.ts).

---

### User Story 6 - Update unit tests for instance classes (Priority: P6)

As a developer, I want unit tests to be updated to work with instance classes so that tests can easily create service instances with mocked dependencies.

**Why this priority**: Tests need to be updated to reflect the new architecture. This ensures that the refactoring doesn't break existing test coverage and that tests can take advantage of improved testability.

**Independent Test**: Can be fully tested by running all existing unit tests and verifying that they pass with the new instance-based architecture. Tests should create service instances with mocks rather than relying on static methods.

**Acceptance Scenarios**:

1. **Given** unit tests are updated for instance classes, **When** I run all unit tests, **Then** all tests pass with the new instance-based architecture.
2. **Given** unit tests use instance classes, **When** I create a test service instance with mocked dependencies, **Then** I can test service logic in isolation without real database or external service connections.
3. **Given** unit tests are updated, **When** I examine test code, **Then** tests create service instances via constructors with mocked dependencies, not static method calls.

---

### Edge Cases

- **What happens if Prisma is not connected when repositories are created?** The application should fail fast at startup with a clear error message. Prisma connection must be established (`await prisma.$connect()`) before creating any repositories or services.

- **How are circular dependencies between services handled?** WebhookService depends on PaymentsService, but PaymentsService does not depend on WebhookService, so there is no circular dependency. If circular dependencies are introduced in the future, they should be resolved by:
  - Extracting shared logic into a separate service
  - Using dependency inversion (depend on interfaces/abstractions)
  - Restructuring the dependency graph

- **How is singleton behavior ensured for services (if needed)?** Services are created once in `app.ts` and passed to controllers/routes. If singleton behavior is required, it is enforced by creating services only once during application startup. No additional singleton pattern is needed.

- **What happens if a service is created before its dependencies are ready?** The explicit initialization order in `app.ts` ensures dependencies are created before services that depend on them. If this order is violated, TypeScript compilation errors or runtime errors will occur, making the issue immediately visible.

- **How are errors handled during dependency initialization?** If any dependency fails to initialize (e.g., Prisma connection fails, Redis connection fails), the application MUST log the error with full context (dependency name, error message, stack trace) using structured logging, then exit immediately with `process.exit(1)`. This prevents the application from starting in an invalid state and provides clear observability for debugging startup failures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: PaymentsService MUST be an instance class with constructor injection. The constructor MUST accept `userRepository: UserRepository`, `paymentRepository: PaymentRepository`, `idempotencyService: IIdempotencyService`, and `yookassaService: IYookassaService` as parameters. All static methods MUST be converted to instance methods. Static services (IdempotencyService, YookassaService) MUST be injected through interfaces using the Dependency Inversion Principle.

- **FR-002**: WebhookService MUST be an instance class with constructor injection. The constructor MUST accept `paymentRepository: PaymentRepository`, `paymentsService: PaymentsService`, and `yookassaService: IYookassaService` as parameters. All static methods MUST be converted to instance methods. Static services (YookassaService) MUST be injected through interfaces using the Dependency Inversion Principle.

- **FR-003**: Controllers MUST accept services through factory functions (closures). Controllers MUST be created via factory functions that accept service instances as parameters. Factory functions MUST be named exports with `create*` prefix (e.g., `export function createPaymentController(paymentsService: PaymentsService)`). Controllers MUST NOT directly import or call static service methods.

- **FR-004**: Routes MUST accept controllers through factory functions. Routes MUST be created via factory functions that accept controller functions as parameters. Factory functions MUST be named exports with `create*` prefix (e.g., `export function createPaymentsRoutes(createPaymentController, getPaymentController)`). Routes MUST NOT directly import controller functions.

- **FR-005**: app.ts MUST explicitly create all dependencies in the correct order: Redis → Prisma → Repositories → Adapter instances (wrapping static services) → Services → Controllers → Routes. The initialization order MUST be visible in app.ts, and dependencies MUST be created before services that depend on them.

- **FR-006**: Prisma client MUST be explicitly connected (`await prisma.$connect()`) BEFORE creating any repositories or services. The connection MUST be established during application startup, not lazily on first access.

- **FR-007**: All static methods in PaymentsService and WebhookService MUST be replaced with instance methods. Static properties (e.g., `private static readonly prisma`) MUST be removed. All method calls MUST use instance methods (e.g., `this.paymentRepository.findById()` instead of `this.paymentRepository.findById()` on a static property).

- **FR-008**: Unit tests MUST be updated to work with instance classes. Tests MUST create service instances via constructors with mocked dependencies (e.g., `new PaymentsService(mockUserRepository, mockPaymentRepository)`). Tests MUST NOT rely on static methods or lazy initialization.

- **FR-009**: Error handling during dependency initialization MUST log errors with full context (dependency name, error message, stack trace) using structured logging, then exit immediately with `process.exit(1)`. Error logs MUST include sufficient context to identify which dependency failed and why.

- **FR-010 (Scope)**: Only PaymentsService and WebhookService MUST be refactored to instance classes. All other services (YookassaService, IdempotencyService, PaymentStateMachine, and any other services) MUST remain as static classes and are explicitly out of scope for this refactoring.

- **FR-011 (Interface-based injection)**: Static services (YookassaService, IdempotencyService) MUST be injected into instance services through interfaces (e.g., `IYookassaService`, `IIdempotencyService`). Adapter classes MUST be created that wrap static services and implement these interfaces. This ensures all dependencies are visible in constructors, enables easy testing with mocks, and maintains a uniform dependency injection approach following the Dependency Inversion Principle.

### Key Entities *(include if feature involves data)*

- **PaymentsService (instance)**: Represents the payment service as an instance class. Dependencies: `userRepository: UserRepository`, `paymentRepository: PaymentRepository`, `idempotencyService: IIdempotencyService`, `yookassaService: IYookassaService`. Methods: `createPayment()`, `getPaymentById()`, `updatePaymentStatus()`.

- **WebhookService (instance)**: Represents the webhook service as an instance class. Dependencies: `paymentRepository: PaymentRepository`, `paymentsService: PaymentsService`, `yookassaService: IYookassaService`. Methods: `processWebhook()`.

- **Service Interfaces**: Interfaces that define contracts for static services to enable dependency injection. Examples: `IIdempotencyService` (methods: `get()`, `set()`), `IYookassaService` (methods: `createPayment()`, `getPayment()`).

- **Adapter Classes**: Wrapper classes that implement service interfaces and delegate to static services. Examples: `IdempotencyServiceAdapter implements IIdempotencyService` (delegates to `IdempotencyService` static methods), `YookassaServiceAdapter implements IYookassaService` (delegates to `YookassaService` static methods).

- **Controller Factory Functions**: Functions that create controller handlers by accepting service instances as parameters. MUST be named exports with `create*` prefix. Examples: `export function createPaymentController(paymentsService)`, `export function getPaymentController(paymentsService)`, `export function processWebhookController(webhookService)`.

- **Route Factory Functions**: Functions that create route handlers by accepting controller functions as parameters. MUST be named exports with `create*` prefix. Examples: `export function createPaymentsRoutes(createPaymentController, getPaymentController)`, `export function createWebhooksRoutes(processWebhookController)`.

- **Dependency Initialization Order**: The explicit order of dependency creation in app.ts: Redis connection → Prisma connection → Repository instances → Adapter instances (wrapping static services) → Service instances → Controller factory functions → Route factory functions → Express app configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing unit tests pass after the refactoring is complete. Test coverage remains at 100% of previously covered functionality, and no tests are skipped or disabled.

- **SC-002**: Prisma client is explicitly connected (`await prisma.$connect()`) in app.ts before any repositories or services are created. Connection errors are caught at application startup, not during first request.

- **SC-003**: All dependencies are explicitly visible in app.ts. The complete dependency graph (Redis → Prisma → Repositories → Services → Controllers → Routes) is visible in the application entry point, with no hidden or lazy initializations.

- **SC-004**: Code remains testable: all services can be instantiated with mocked dependencies through constructors. Unit tests can create service instances with test doubles (mocks/stubs) without requiring real database or external service connections.

- **SC-005**: Application startup fails fast if any dependency initialization fails (e.g., Prisma connection fails, Redis connection fails). Errors are logged with full context (dependency name, error message, stack trace) using structured logging, and the application exits immediately with `process.exit(1)`. Error logs clearly indicate which dependency failed to initialize and provide sufficient context for debugging.

- **SC-006**: No static methods remain in PaymentsService or WebhookService. All methods are instance methods, and all dependencies are injected through constructors.

## Technical Details

### Architecture Changes

#### Current Structure

```
PaymentsService (static class)
  - static createPayment()
  - static getPaymentById()
  - static updatePaymentStatus()
  - private static readonly prisma = getPrismaClient()
  - private static readonly userRepository = new UserRepository(this.prisma)
  - private static readonly paymentRepository = new PaymentRepository(this.prisma)

WebhookService (static class)
  - static processWebhook()
  - private static readonly paymentRepository = new PaymentRepository(getPrismaClient())

Controllers
  - createPayment() → PaymentsService.createPayment()
  - getPayment() → PaymentsService.getPaymentById()
  - processWebhook() → WebhookService.processWebhook()

Routes
  - Import controllers directly
  - router.post("/", createPayment)

app.ts
  - No explicit Prisma connection
  - Routes imported directly
```

#### Target Structure

```
PaymentsService (instance class)
  - constructor(userRepository, paymentRepository)
  - createPayment()
  - getPaymentById()
  - updatePaymentStatus()

WebhookService (instance class)
  - constructor(paymentRepository, paymentsService)
  - processWebhook()

Controller Factories
  - createPaymentController(paymentsService)
  - getPaymentController(paymentsService)
  - processWebhookController(webhookService)

Route Factories
  - createPaymentsRoutes(createPaymentController, getPaymentController)
  - createWebhooksRoutes(processWebhookController)

app.ts
  - await getRedisClient()
  - const prisma = getPrismaClient()
  - await prisma.$connect()
  - const userRepository = new UserRepository(prisma)
  - const paymentRepository = new PaymentRepository(prisma)
  - const idempotencyService = new IdempotencyServiceAdapter()
  - const yookassaService = new YookassaServiceAdapter()
  - const paymentsService = new PaymentsService(userRepository, paymentRepository, idempotencyService, yookassaService)
  - const webhookService = new WebhookService(paymentRepository, paymentsService, yookassaService)
  - const createPaymentController = createPaymentControllerFactory(paymentsService)
  - const getPaymentController = getPaymentControllerFactory(paymentsService)
  - const processWebhookController = processWebhookControllerFactory(webhookService)
  - const paymentsRoutes = createPaymentsRoutes(createPaymentController, getPaymentController)
  - const webhooksRoutes = createWebhooksRoutes(processWebhookController)
  - app.use("/api/payments", paymentsRoutes)
  - app.use("/api/webhooks", webhooksRoutes)
```

### Migration Order

1. **Step 1**: Refactor PaymentsService to instance class (P1)
   - Convert static class to instance class
   - Add constructor with dependencies
   - Convert static methods to instance methods
   - Update internal references

2. **Step 2**: Refactor WebhookService to instance class (P2)
   - Convert static class to instance class
   - Add constructor with dependencies
   - Convert static methods to instance methods
   - Update internal references

3. **Step 3**: Update controllers to factory functions (P3)
   - Convert controllers to factory functions
   - Accept services as parameters
   - Update controller implementations to use instance methods

4. **Step 4**: Update routes to factory functions (P4)
   - Convert routes to factory functions
   - Accept controllers as parameters
   - Update route definitions

5. **Step 5**: Update app.ts for explicit initialization (P5)
   - Add explicit Prisma connection
   - Create all dependencies in correct order
   - Pass dependencies through factory functions

6. **Step 6**: Update unit tests (P6)
   - Update tests to create service instances
   - Update tests to use mocked dependencies
   - Verify all tests pass

### Breaking Changes

- **API Compatibility**: No breaking changes to HTTP API endpoints. All endpoints continue to work identically from the client perspective.

- **Internal API Changes**: 
  - PaymentsService and WebhookService are no longer static classes. Code that directly instantiates or calls these services must be updated.
  - Controllers and routes are now factory functions. Code that imports controllers/routes directly must be updated.
  - Other services (YookassaService, IdempotencyService, etc.) remain static and are not affected by this refactoring.

- **Test Compatibility**: Existing unit tests must be updated to work with instance classes. Tests that rely on static methods will break and need to be refactored.

### Files to Modify

1. `src/services/payment.service.ts` - Convert to instance class
2. `src/services/webhook.service.ts` - Convert to instance class
3. `src/services/interfaces/` (new) - Create service interfaces (IIdempotencyService, IYookassaService)
4. `src/services/adapters/` (new) - Create adapter classes (IdempotencyServiceAdapter, YookassaServiceAdapter)
5. `src/controllers/payments.controller.ts` - Convert to factory functions
6. `src/controllers/webhooks.controller.ts` - Convert to factory functions
7. `src/routes/payments.ts` - Convert to factory function
8. `src/routes/webhooks.ts` - Convert to factory function
9. `src/app.ts` - Add explicit dependency initialization
10. All unit test files - Update to use instance classes

### Constitution Alignment

This refactoring directly implements **Constitution Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)**:

- ✅ Services use constructor injection (no static Service Locator pattern)
- ✅ External dependencies (Prisma) are explicitly connected before creating dependent services
- ✅ All dependencies are visible in the application entry point (app.ts)
- ✅ Services accept dependencies through constructors, not through static getters or global state
- ✅ Fail-fast behavior: connection errors are caught at startup, not during first request
- ✅ Testability: dependencies can be easily mocked by passing test doubles through constructors
- ✅ Explicit lifecycle: the order of initialization is clear and controlled

## Assumptions

## Assumptions

- No DI container library will be used (e.g., InversifyJS, TSyringe). Dependencies will be manually wired in app.ts.
- Services will be created once per application instance (singleton behavior is enforced by creating services only once in app.ts).
- Repository classes (UserRepository, PaymentRepository) already use constructor injection and do not need refactoring.
- **Scope limitation (Phase 1)**: Only PaymentsService and WebhookService MUST be refactored to instance classes in this feature. All other services (YookassaService, IdempotencyService, PaymentStateMachine, etc.) remain static classes and are explicitly out of scope for this refactoring. They may be refactored in future iterations if needed.
- **Adapter pattern**: Static services (YookassaService, IdempotencyService) are wrapped in adapter classes that implement interfaces (IYookassaService, IIdempotencyService) to enable dependency injection. Adapters are a temporary solution and will be removed in a future refactoring when static services are converted to instance classes.
- **Controller pattern**: Controllers are implemented as factory functions that accept service instances as parameters. This is a temporary pattern; future refactoring will convert controllers to instance classes.
- **Interface coverage**: Only static services (YookassaService, IdempotencyService) have interfaces for dependency injection. Repositories and instance services do not have interfaces in this phase, but interfaces will be added in a future refactoring to fully implement Dependency Inversion Principle.
- The refactoring will be done incrementally, one service at a time, to minimize risk.
