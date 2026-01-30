# Feature Specification: Complete Dependency Injection with Interfaces

**Feature Branch**: `003-full-di-interfaces`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "Создай спецификацию для завершения рефакторинга архитектуры на полный Dependency Injection с интерфейсами для всех зависимостей."

## Context & Motivation

### Current Architecture (After 002-di-refactoring)

The previous refactoring (002-di-refactoring) established constructor injection for core services:

- **PaymentsService**: Instance class with constructor injection (`userRepository`, `paymentRepository`, `idempotencyService`, `yookassaService`)
- **WebhookService**: Instance class with constructor injection (`paymentRepository`, `paymentsService`, `yookassaService`)
- **IdempotencyService**: Static class with static methods (`get`, `set`, `checkConflict`). Wrapped in `IdempotencyServiceAdapter` for dependency injection.
- **YookassaService**: Static class with static methods (`createPayment`, `getPayment`). Wrapped in `YookassaServiceAdapter` for dependency injection.
- **Repositories**: Instance classes (`UserRepository`, `PaymentRepository`) with constructor injection, but no interfaces.
- **Controllers**: Factory functions (`createPaymentController`, `getPaymentController`, `processWebhookController`) that accept service instances.
- **Routes**: Factory functions (`createPaymentsRoutes`, `createWebhooksRoutes`) that accept controller functions.
- **Tests**: Use `jest.Mocked<UserRepository>` and `jest.Mocked<PaymentRepository>` instead of interfaces.

### Problem Statement

The current architecture has several remaining issues:

1. **Incomplete Dependency Inversion**: Static services (IdempotencyService, YookassaService) still exist and require adapters. This violates the Dependency Inversion Principle by depending on concrete implementations rather than abstractions.

2. **Missing Repository Interfaces**: Repositories are instance classes but lack interfaces. Services depend on concrete repository classes (`UserRepository`, `PaymentRepository`) instead of abstractions (`IUserRepository`, `IPaymentRepository`).

3. **Missing Service Interfaces**: Core services (PaymentsService, WebhookService) lack interfaces. Controllers and other services depend on concrete service classes instead of abstractions.

4. **Adapter Overhead**: Adapter classes (IdempotencyServiceAdapter, YookassaServiceAdapter) are temporary workarounds that add complexity and should be removed once static services are refactored.

5. **Controller Pattern Inconsistency**: Controllers are factory functions instead of classes, which is inconsistent with the service layer pattern and makes dependency injection less explicit.

6. **Test Coupling**: Tests depend on concrete classes (`jest.Mocked<UserRepository>`) instead of interfaces, making tests brittle and tightly coupled to implementations.

### Target Architecture

The refactored architecture will fully implement Dependency Inversion Principle:

- **All Services as Instance Classes**: IdempotencyService and YookassaService become instance classes with constructor injection.
- **Interfaces for All Dependencies**: All repositories and services have interfaces. Dependencies use interfaces, not concrete classes. Controllers do not require interfaces as they are thin HTTP adapters.
- **Controllers as Classes**: Controllers become instance classes with constructor injection, using arrow methods for Express binding.
- **No Adapters**: Adapter classes are removed since static services no longer exist.
- **Interface-Based Testing**: Tests use interfaces in mocks (`jest.Mocked<IUserRepository>`) instead of concrete classes.

This refactoring completes the implementation of **Constitution Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)** and fully implements the **Dependency Inversion Principle** (depend on abstractions, not concretions).

## Clarifications

### Session 2026-01-29

- Q: Should controller interfaces be created (IPaymentsController, IWebhooksController) for full consistency with service/repository pattern? → A: No controller interfaces. Controllers are thin HTTP adapters that delegate to services. Service interfaces provide sufficient abstraction for testing. Routes can depend on concrete controller classes since controllers are created in app.ts and are not swapped at runtime.
- Q: Should route factory functions accept controller instances or individual controller methods? → A: Routes accept controller instances and call methods on the instance (e.g., `paymentsController.createPayment`). This keeps dependencies explicit and consistent with the class-based pattern.
- Q: How should existing interfaces (IIdempotencyService, IYookassaService) be handled - review before or after refactoring? → A: Review and update interfaces to match static service method signatures exactly before refactoring. This ensures interfaces are correct before converting static services to instance classes, and any mismatches are caught early. The interface should define the exact same methods as the static service, just as instance methods.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create interfaces for all repositories (Priority: P1)

As a developer, I want repository interfaces (IUserRepository, IPaymentRepository) so that services can depend on abstractions rather than concrete implementations, improving testability and flexibility.

**Why this priority**: Repository interfaces are the foundation for dependency inversion. They must be created first before refactoring services to use them. This enables independent testing of repository interfaces without affecting service implementations.

**Independent Test**: Can be fully tested by creating mock implementations of repository interfaces and verifying that services can work with any implementation that satisfies the interface contract.

**Acceptance Scenarios**:

1. **Given** IUserRepository interface exists, **When** I examine the interface definition, **Then** it defines all public methods of UserRepository (e.g., `existsById(userId: string): Promise<boolean>`).
2. **Given** IPaymentRepository interface exists, **When** I examine the interface definition, **Then** it defines all public methods of PaymentRepository (e.g., `create`, `findById`, `findByYooKassaId`, `updateStatus`).
3. **Given** repository interfaces exist, **When** I update UserRepository and PaymentRepository classes, **Then** they implement their respective interfaces (`implements IUserRepository`, `implements IPaymentRepository`).
4. **Given** repository interfaces exist, **When** I update services to use interfaces in constructors, **Then** services accept `IUserRepository` and `IPaymentRepository` instead of concrete classes.

---

### User Story 2 - Create interfaces for all services (Priority: P2)

As a developer, I want service interfaces (IPaymentsService, IWebhookService, IIdempotencyService, IYookassaService) so that controllers and other services can depend on abstractions, enabling easy testing and implementation swapping.

**Why this priority**: Service interfaces enable dependency inversion for the service layer. They must be created before refactoring controllers to use them. Existing interfaces (IIdempotencyService, IYookassaService) need to be reviewed and potentially extended.

**Independent Test**: Can be fully tested by creating mock implementations of service interfaces and verifying that controllers can work with any implementation that satisfies the interface contract.

**Acceptance Scenarios**:

1. **Given** IPaymentsService interface exists, **When** I examine the interface definition, **Then** it defines all public methods of PaymentsService (e.g., `createPayment`, `getPaymentById`, `updatePaymentStatus`).
2. **Given** IWebhookService interface exists, **When** I examine the interface definition, **Then** it defines all public method of WebhookService (e.g., `processWebhook`).
3. **Given** service interfaces exist, **When** I update PaymentsService and WebhookService classes, **Then** they implement their respective interfaces (`implements IPaymentsService`, `implements IWebhookService`).
4. **Given** existing interfaces (IIdempotencyService, IYookassaService) exist, **When** I review them, **Then** they match the current static service method signatures and are ready for instance class implementation.

---

### User Story 3 - Refactor IdempotencyService to instance class (Priority: P3)

As a developer, I want IdempotencyService to be an instance class with constructor injection so that it follows the same pattern as other services and can be easily tested with mocks.

**Why this priority**: IdempotencyService is a core dependency for PaymentsService. Refactoring it removes the need for adapters and establishes a consistent service pattern. It should be done before YookassaService since it has fewer dependencies.

**Independent Test**: Can be fully tested by creating an IdempotencyService instance with a mocked Redis client and verifying that all methods (`get`, `set`, `checkConflict`) work correctly.

**Acceptance Scenarios**:

1. **Given** IdempotencyService is refactored to an instance class, **When** I create an instance with `new IdempotencyService(redisClient)`, **Then** all methods (`get`, `set`, `checkConflict`) work correctly.
2. **Given** IdempotencyService is an instance class, **When** I examine the constructor, **Then** it accepts `redisClient: RedisClientType` as a parameter and implements `IIdempotencyService`.
3. **Given** IdempotencyService is an instance class, **When** I create a test instance with a mocked Redis client, **Then** I can test idempotency logic without a real Redis connection.
4. **Given** IdempotencyService is an instance class, **When** I update PaymentsService, **Then** PaymentsService accepts `IIdempotencyService` in constructor and no longer uses IdempotencyServiceAdapter.

---

### User Story 4 - Refactor YookassaService to instance class (Priority: P4)

As a developer, I want YookassaService to be an instance class with constructor injection so that it follows the same pattern as other services and can be easily tested with mocks.

**Why this priority**: YookassaService is a core dependency for PaymentsService and WebhookService. Refactoring it removes the need for adapters and completes the service layer refactoring. It should be done after IdempotencyService since it has similar complexity.

**Independent Test**: Can be fully tested by creating a YookassaService instance with a mocked Axios client and verifying that all methods (`createPayment`, `getPayment`) work correctly.

**Acceptance Scenarios**:

1. **Given** YookassaService is refactored to an instance class, **When** I create an instance with `new YookassaService(axiosClient)`, **Then** all methods (`createPayment`, `getPayment`) work correctly.
2. **Given** YookassaService is an instance class, **When** I examine the constructor, **Then** it accepts `axiosClient: AxiosInstance` as a parameter and implements `IYookassaService`.
3. **Given** YookassaService is an instance class, **When** I create a test instance with a mocked Axios client, **Then** I can test YooKassa API interaction logic without real HTTP requests.
4. **Given** YookassaService is an instance class, **When** I update PaymentsService and WebhookService, **Then** they accept `IYookassaService` in constructors and no longer use YookassaServiceAdapter.

---

### User Story 5 - Refactor controllers to classes (Priority: P5)

As a developer, I want controllers to be instance classes with constructor injection so that the dependency graph is explicit and consistent with the service layer pattern.

**Why this priority**: Controllers are the bridge between routes and services. Converting them to classes makes dependencies explicit and consistent with the service layer. This should be done after service interfaces are created so controllers can depend on interfaces.

**Independent Test**: Can be fully tested by creating controller instances with mocked services and verifying that controller methods handle requests correctly and call service methods appropriately.

**Acceptance Scenarios**:

1. **Given** PaymentsController is a class, **When** I create an instance with `new PaymentsController(paymentsService)`, **Then** controller methods (`createPayment`, `getPayment`) are available as arrow methods for Express binding.
2. **Given** PaymentsController is a class, **When** I examine the constructor, **Then** it accepts `paymentsService: IPaymentsService` (interface, not concrete class).
3. **Given** WebhooksController is a class, **When** I create an instance with `new WebhooksController(webhookService)`, **Then** controller method (`processWebhook`) is available as an arrow method for Express binding.
4. **Given** WebhooksController is a class, **When** I examine the constructor, **Then** it accepts `webhookService: IWebhookService` (interface, not concrete class).
5. **Given** controllers are classes, **When** I update routes, **Then** routes create controller instances via constructors instead of factory functions.

---

### User Story 6 - Remove adapters and update app.ts (Priority: P6)

As a developer, I want adapters removed and app.ts updated so that the dependency graph uses only instance classes and interfaces, with no temporary workarounds.

**Why this priority**: This is the final integration step that brings everything together. Adapters are no longer needed since static services are refactored. app.ts must be updated to create instance classes directly.

**Independent Test**: Can be fully tested by verifying that app.ts initializes dependencies in the correct order (Redis → Prisma → Repositories → Services → Controllers → Routes) using only instance classes and interfaces, with no adapter classes.

**Acceptance Scenarios**:

1. **Given** adapters are removed, **When** I search the codebase, **Then** IdempotencyServiceAdapter and YookassaServiceAdapter classes do not exist.
2. **Given** app.ts is updated, **When** I examine the initialization code, **Then** it creates IdempotencyService and YookassaService instances directly (not adapters).
3. **Given** app.ts uses instance classes, **When** I trace the dependency graph, **Then** all dependencies use interfaces in constructors (e.g., `IPaymentRepository`, `IPaymentsService`, `IIdempotencyService`, `IYookassaService`).
4. **Given** app.ts initializes dependencies, **When** I examine the initialization order, **Then** it follows: Redis → Prisma → Repositories → Services (IdempotencyService, YookassaService, PaymentsService, WebhookService) → Controllers → Routes.

---

### User Story 7 - Update tests to use interfaces (Priority: P7)

As a developer, I want tests to use interfaces in mocks so that tests are decoupled from concrete implementations and can work with any implementation that satisfies the interface contract.

**Why this priority**: Tests need to be updated to reflect the new architecture. This ensures that the refactoring doesn't break existing test coverage and that tests take advantage of improved testability through interfaces.

**Independent Test**: Can be fully tested by running all existing unit tests and verifying that they pass with interface-based mocks. Tests should create service instances with interface mocks rather than concrete class mocks.

**Acceptance Scenarios**:

1. **Given** tests are updated for interfaces, **When** I run all unit tests, **Then** all tests pass with the new interface-based architecture.
2. **Given** tests use interfaces, **When** I examine test code, **Then** mocks use interfaces (e.g., `jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentRepository>`, `jest.Mocked<IPaymentsService>`) instead of concrete classes.
3. **Given** tests use interfaces, **When** I create a test service instance, **Then** I pass interface mocks through constructors, not concrete class mocks.
4. **Given** tests are updated, **When** I verify test coverage, **Then** test coverage remains at 100% of previously covered functionality.

---

### Edge Cases

- **What happens if an interface doesn't match the implementation?** TypeScript compilation will fail if a class claims to implement an interface but doesn't satisfy all interface requirements. This is caught at compile time, not runtime.

- **How are circular dependencies between services handled through interfaces?** Interfaces themselves cannot create circular dependencies. If services have circular dependencies, they should be resolved by:
  - Extracting shared logic into a separate service
  - Using dependency inversion (depend on interfaces/abstractions)
  - Restructuring the dependency graph
  - Using event-driven patterns if appropriate

- **How is interface compatibility ensured when interfaces change?** Interface changes are breaking changes. When an interface is modified:
  - All implementing classes must be updated to match the new interface
  - All dependent code (services, controllers, tests) must be updated
  - TypeScript compilation will catch mismatches
  - Tests should verify that implementations satisfy interface contracts

- **What happens if a service implementation doesn't use all interface methods?** This is acceptable. An implementation can provide additional methods beyond the interface, but it must implement all interface methods. TypeScript ensures this at compile time.

- **How are interface changes versioned or managed?** Interfaces are part of the codebase and follow semantic versioning. Breaking changes to interfaces require updates to all implementations and dependents. Consider creating new interfaces (e.g., `IPaymentsServiceV2`) if backward compatibility is needed during migration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All repositories MUST have interfaces (IUserRepository, IPaymentRepository). Repository classes MUST implement their respective interfaces. Interfaces MUST define all public methods of repository classes, hiding ORM implementation details (Prisma) from services.

- **FR-002**: All services MUST have interfaces (IPaymentsService, IWebhookService, IIdempotencyService, IYookassaService). Service classes MUST implement their respective interfaces. Interfaces MUST define only public methods (not private/protected methods). Existing interfaces (IIdempotencyService, IYookassaService) MUST be reviewed and updated to match static service method signatures exactly before refactoring static services to instance classes.

- **FR-003**: Interfaces MUST be in separate files (one interface per file). Interface files MUST be organized in directories: `src/interfaces/repositories/`, `src/interfaces/services/`. Controller interfaces are NOT required as controllers are thin HTTP adapters that delegate to services.

- **FR-004**: IdempotencyService MUST be an instance class with constructor injection. The constructor MUST accept `redisClient: RedisClientType` as a parameter. All static methods (`get`, `set`, `checkConflict`) MUST be replaced with instance methods. The class MUST implement `IIdempotencyService` interface.

- **FR-005**: YookassaService MUST be an instance class with constructor injection. The constructor MUST accept `axiosClient: AxiosInstance` as a parameter. All static methods (`createPayment`, `getPayment`) MUST be replaced with instance methods. The class MUST implement `IYookassaService` interface.

- **FR-006**: Controllers MUST be instance classes with constructor injection. PaymentsController MUST accept `paymentsService: IPaymentsService` in constructor. WebhooksController MUST accept `webhookService: IWebhookService` in constructor. Controller methods MUST be arrow functions for automatic `this` binding in Express.

- **FR-007**: Adapter classes (IdempotencyServiceAdapter, YookassaServiceAdapter) MUST be removed from the codebase, as static services no longer exist.

- **FR-008**: app.ts MUST be updated to create instance classes directly (not adapters). Initialization order MUST be: Redis → Prisma → Repositories → Services (IdempotencyService, YookassaService, PaymentsService, WebhookService) → Controllers → Routes. All dependencies in constructors MUST use interfaces, not concrete classes.

- **FR-009**: All dependencies in constructors MUST use interfaces, not concrete classes. For example:
  - Services MUST accept `IUserRepository`, `IPaymentRepository` (not `UserRepository`, `PaymentRepository`)
  - Controllers MUST accept `IPaymentsService`, `IWebhookService` (not `PaymentsService`, `WebhookService`)
  - Services MUST accept `IIdempotencyService`, `IYookassaService` (not `IdempotencyService`, `YookassaService`)

- **FR-010**: All unit tests MUST be updated to use interfaces in mocks. Tests MUST use `jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentRepository>`, `jest.Mocked<IPaymentsService>`, etc., instead of concrete class mocks. Tests MUST create service/controller instances via constructors with interface mocks.

- **FR-011**: Route factory functions MUST be updated to accept controller instances (not factory functions). Routes MUST accept controller instances as parameters and call methods on the instance (e.g., `paymentsController.createPayment`, `paymentsController.getPayment`). Controller instances are created in app.ts and passed to route factory functions.

- **FR-012**: Interface definitions MUST match current implementation method signatures exactly. When refactoring static services to instance classes, interface methods MUST remain unchanged (only implementation changes from static to instance).

### Key Entities *(include if feature involves data)*

- **IUserRepository**: Interface defining user repository operations. Methods: `existsById(userId: string): Promise<boolean>`. Implemented by `UserRepository` class.

- **IPaymentRepository**: Interface defining payment repository operations. Methods: `create(data)`, `findById(id)`, `findByYooKassaId(yookassaPaymentId)`, `updateStatus(id, data)`. Implemented by `PaymentRepository` class.

- **IPaymentsService**: Interface defining payment service operations. Methods: `createPayment(request, idempotenceKey)`, `getPaymentById(id)`, `updatePaymentStatus(id, status)`. Implemented by `PaymentsService` class.

- **IWebhookService**: Interface defining webhook service operations. Methods: `processWebhook(payload, correlationId)`. Implemented by `WebhookService` class.

- **IIdempotencyService**: Interface defining idempotency service operations. Methods: `get(idempotencyKey)`, `set(idempotencyKey, requestHash, payment)`, `checkConflict(idempotencyKey, requestHash)`. Implemented by `IdempotencyService` class (after refactoring).

- **IYookassaService**: Interface defining YooKassa service operations. Methods: `createPayment(request, idempotenceKey)`, `getPayment(paymentId, correlationId)`. Implemented by `YookassaService` class (after refactoring).

- **PaymentsController**: Instance class for payment-related HTTP handlers. Constructor accepts `paymentsService: IPaymentsService`. Methods: `createPayment` (arrow function), `getPayment` (arrow function).

- **WebhooksController**: Instance class for webhook-related HTTP handlers. Constructor accepts `webhookService: IWebhookService`. Methods: `processWebhook` (arrow function).

- **IdempotencyService (instance)**: Instance class for idempotency operations. Constructor accepts `redisClient: RedisClientType`. Implements `IIdempotencyService`. Methods: `get`, `set`, `checkConflict` (all instance methods).

- **YookassaService (instance)**: Instance class for YooKassa API operations. Constructor accepts `axiosClient: AxiosInstance`. Implements `IYookassaService`. Methods: `createPayment`, `getPayment` (all instance methods).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All static services are converted to instance classes. IdempotencyService and YookassaService are instance classes with constructor injection. No static methods remain in these services.

- **SC-002**: All repositories and services have interfaces and implement them. IUserRepository, IPaymentRepository, IPaymentsService, IWebhookService, IIdempotencyService, IYookassaService interfaces exist, and corresponding classes implement them.

- **SC-003**: Controllers are implemented as instance classes with constructor injection. PaymentsController and WebhooksController are classes (not factory functions) that accept service interfaces in constructors.

- **SC-004**: Adapter classes are removed from the codebase. IdempotencyServiceAdapter and YookassaServiceAdapter classes do not exist. No references to adapters remain in app.ts or other files.

- **SC-005**: All dependencies in constructors use interfaces, not concrete classes. TypeScript compilation verifies that services accept interface types (e.g., `IPaymentRepository`, `IPaymentsService`) in constructors.

- **SC-006**: All unit tests are updated to use interfaces in mocks. Tests use `jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentRepository>`, etc., instead of concrete class mocks. All existing tests pass with interface-based mocks.

- **SC-007**: All existing unit tests pass after the refactoring is complete. Test coverage remains at 100% of previously covered functionality. No tests are skipped or disabled.

- **SC-008**: app.ts uses only instance classes, with no adapters. The dependency initialization order is correct: Redis → Prisma → Repositories → Services → Controllers → Routes. All dependencies are created via constructors with interface types.

- **SC-009**: Interface definitions match implementation method signatures. TypeScript compilation succeeds without errors, confirming that all classes correctly implement their interfaces.

## Technical Details

### Architecture Changes

#### Current Structure (After 002-di-refactoring)

```
IdempotencyService (static class)
  - static get()
  - static set()
  - static checkConflict()

YookassaService (static class)
  - static createPayment()
  - static getPayment()

IdempotencyServiceAdapter (adapter)
  - implements IIdempotencyService
  - delegates to IdempotencyService static methods

YookassaServiceAdapter (adapter)
  - implements IYookassaService
  - delegates to YookassaService static methods

PaymentsService (instance class)
  - constructor(userRepository, paymentRepository, idempotencyService, yookassaService)
  - uses IIdempotencyService, IYookassaService (via adapters)

WebhookService (instance class)
  - constructor(paymentRepository, paymentsService, yookassaService)
  - uses IYookassaService (via adapter)

UserRepository (instance class, no interface)
  - constructor(prisma)

PaymentRepository (instance class, no interface)
  - constructor(prisma)

Controllers (factory functions)
  - createPaymentController(paymentsService)
  - getPaymentController(paymentsService)
  - processWebhookController(webhookService)

Routes (factory functions)
  - createPaymentsRoutes(createPaymentController, getPaymentController)
  - createWebhooksRoutes(processWebhookController)

app.ts
  - Creates adapters (IdempotencyServiceAdapter, YookassaServiceAdapter)
  - Creates services with adapters
  - Creates controllers via factory functions
```

#### Target Structure

```
Interfaces
  - src/interfaces/repositories/IUserRepository.ts
  - src/interfaces/repositories/IPaymentRepository.ts
  - src/interfaces/services/IPaymentsService.ts
  - src/interfaces/services/IWebhookService.ts
  - src/interfaces/services/IIdempotencyService.ts (existing, updated if needed)
  - src/interfaces/services/IYookassaService.ts (existing, updated if needed)

IdempotencyService (instance class)
  - constructor(redisClient: RedisClientType)
  - implements IIdempotencyService
  - get(), set(), checkConflict() (instance methods)

YookassaService (instance class)
  - constructor(axiosClient: AxiosInstance)
  - implements IYookassaService
  - createPayment(), getPayment() (instance methods)

UserRepository (instance class)
  - constructor(prisma: PrismaClient)
  - implements IUserRepository
  - existsById() (instance method)

PaymentRepository (instance class)
  - constructor(prisma: PrismaClient)
  - implements IPaymentRepository
  - create(), findById(), findByYooKassaId(), updateStatus() (instance methods)

PaymentsService (instance class)
  - constructor(
      userRepository: IUserRepository,
      paymentRepository: IPaymentRepository,
      idempotencyService: IIdempotencyService,
      yookassaService: IYookassaService
    )
  - implements IPaymentsService
  - createPayment(), getPaymentById(), updatePaymentStatus() (instance methods)

WebhookService (instance class)
  - constructor(
      paymentRepository: IPaymentRepository,
      paymentsService: IPaymentsService,
      yookassaService: IYookassaService
    )
  - implements IWebhookService
  - processWebhook() (instance method)

PaymentsController (instance class)
  - constructor(paymentsService: IPaymentsService)
  - createPayment = async (req, res, next) => { ... } (arrow method)
  - getPayment = async (req, res, next) => { ... } (arrow method)

WebhooksController (instance class)
  - constructor(webhookService: IWebhookService)
  - processWebhook = async (req, res, next) => { ... } (arrow method)

Routes (factory functions, updated)
  - createPaymentsRoutes(paymentsController: PaymentsController)
    - Calls paymentsController.createPayment and paymentsController.getPayment
  - createWebhooksRoutes(webhooksController: WebhooksController)
    - Calls webhooksController.processWebhook

app.ts
  - await getRedisClient()
  - const prisma = getPrismaClient()
  - await prisma.$connect()
  - const userRepository = new UserRepository(prisma)
  - const paymentRepository = new PaymentRepository(prisma)
  - const redisClient = await getRedisClient()
  - const axiosClient = getYooKassaClient()
  - const idempotencyService = new IdempotencyService(redisClient)
  - const yookassaService = new YookassaService(axiosClient)
  - const paymentsService = new PaymentsService(userRepository, paymentRepository, idempotencyService, yookassaService)
  - const webhookService = new WebhookService(paymentRepository, paymentsService, yookassaService)
  - const paymentsController = new PaymentsController(paymentsService)
  - const webhooksController = new WebhooksController(webhookService)
  - const paymentsRoutes = createPaymentsRoutes(paymentsController)
  - const webhooksRoutes = createWebhooksRoutes(webhooksController)
  - app.use("/api/payments", paymentsRoutes)
  - app.use("/api/webhooks", webhooksRoutes)
```

### Migration Order

1. **Step 1**: Create repository interfaces (P1)
   - Create `src/interfaces/repositories/IUserRepository.ts`
   - Create `src/interfaces/repositories/IPaymentRepository.ts`
   - Update `UserRepository` to implement `IUserRepository`
   - Update `PaymentRepository` to implement `IPaymentRepository`
   - Update services to use interfaces in constructors

2. **Step 2**: Create service interfaces (P2)
   - Create `src/interfaces/services/IPaymentsService.ts`
   - Create `src/interfaces/services/IWebhookService.ts`
   - Review and update existing interfaces (`IIdempotencyService`, `IYookassaService`) to match static service method signatures exactly before refactoring
   - Verify interfaces define the exact same methods as static services (as instance methods)
   - Update `PaymentsService` to implement `IPaymentsService`
   - Update `WebhookService` to implement `IWebhookService`

3. **Step 3**: Refactor IdempotencyService to instance class (P3)
   - Convert static class to instance class
   - Add constructor with `redisClient: RedisClientType`
   - Convert static methods to instance methods
   - Update class to implement `IIdempotencyService`
   - Update `PaymentsService` to accept `IIdempotencyService` (remove adapter dependency)

4. **Step 4**: Refactor YookassaService to instance class (P4)
   - Convert static class to instance class
   - Add constructor with `axiosClient: AxiosInstance`
   - Convert static methods to instance methods
   - Update class to implement `IYookassaService`
   - Update `PaymentsService` and `WebhookService` to accept `IYookassaService` (remove adapter dependency)

5. **Step 5**: Refactor controllers to classes (P5)
   - Convert `createPaymentController` factory to `PaymentsController` class
   - Convert `getPaymentController` to `PaymentsController.getPayment` method
   - Convert `processWebhookController` factory to `WebhooksController` class
   - Use arrow methods for Express binding
   - Update routes to accept controller instances and call methods on instances (e.g., `paymentsController.createPayment`)

6. **Step 6**: Remove adapters and update app.ts (P6)
   - Delete `IdempotencyServiceAdapter` class
   - Delete `YookassaServiceAdapter` class
   - Update `app.ts` to create instance classes directly
   - Update initialization order: Redis → Prisma → Repositories → Services → Controllers → Routes

7. **Step 7**: Update tests to use interfaces (P7)
   - Update all test files to use interface mocks (`jest.Mocked<IUserRepository>`, etc.)
   - Update test setup to create instance classes with interface mocks
   - Verify all tests pass
   - Verify test coverage remains at 100%

### Breaking Changes

- **API Compatibility**: No breaking changes to HTTP API endpoints. All endpoints continue to work identically from the client perspective.

- **Internal API Changes**:
  - IdempotencyService and YookassaService are no longer static classes. Code that directly calls static methods must be updated.
  - Controllers are now instance classes. Code that imports controller factory functions must be updated.
  - Adapter classes are removed. Code that imports or uses adapters must be updated.
  - Repository and service constructors now use interfaces. Code that passes concrete classes must be updated (though TypeScript will catch this).

- **Test Compatibility**: Existing unit tests must be updated to work with interfaces and instance classes. Tests that rely on static methods or concrete class mocks will break and need to be refactored.

### Files to Modify

1. **New Interface Files**:
   - `src/interfaces/repositories/IUserRepository.ts` (new)
   - `src/interfaces/repositories/IPaymentRepository.ts` (new)
   - `src/interfaces/services/IPaymentsService.ts` (new)
   - `src/interfaces/services/IWebhookService.ts` (new)
   - `src/interfaces/services/IIdempotencyService.ts` (existing, review/update if needed)
   - `src/interfaces/services/IYookassaService.ts` (existing, review/update if needed)

2. **Repository Files**:
   - `src/repositories/user.repository.ts` (add interface implementation)
   - `src/repositories/payment.repository.ts` (add interface implementation)

3. **Service Files**:
   - `src/services/idempotency.service.ts` (convert to instance class)
   - `src/services/yookassa.service.ts` (convert to instance class)
   - `src/services/payment.service.ts` (update to use interfaces, add interface implementation)
   - `src/services/webhook.service.ts` (update to use interfaces, add interface implementation)

4. **Controller Files**:
   - `src/controllers/payments.controller.ts` (convert to class)
   - `src/controllers/webhooks.controller.ts` (convert to class)

5. **Route Files**:
   - `src/routes/payments.ts` (update to accept controller instances)
   - `src/routes/webhooks.ts` (update to accept controller instances)

6. **Application Entry Point**:
   - `src/app.ts` (update initialization, remove adapters)

7. **Adapter Files (Delete)**:
   - `src/services/adapters/idempotency-service.adapter.ts` (delete)
   - `src/services/adapters/yookassa-service.adapter.ts` (delete)

8. **Test Files**:
   - All unit test files in `tests/unit/` (update to use interfaces in mocks)

### Constitution Alignment

This refactoring fully implements **Constitution Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)** and the **Dependency Inversion Principle**:

- ✅ All services use constructor injection (no static Service Locator pattern)
- ✅ All dependencies use interfaces (Dependency Inversion Principle)
- ✅ External dependencies (Redis, Prisma, Axios) are explicitly initialized before creating dependent services
- ✅ All dependencies are visible in the application entry point (app.ts)
- ✅ Services accept dependencies through constructors, not through static getters or global state
- ✅ Fail-fast behavior: connection errors are caught at startup, not during first request
- ✅ Testability: dependencies can be easily mocked by passing interface implementations through constructors
- ✅ Explicit lifecycle: the order of initialization is clear and controlled

## Assumptions

- No DI container library will be used (e.g., InversifyJS, TSyringe). Dependencies will be manually wired in app.ts.
- Services will be created once per application instance (singleton behavior is enforced by creating services only once in app.ts).
- Interface definitions will match current implementation method signatures exactly. No breaking changes to method signatures during refactoring.
- Redis client and Axios client are obtained via existing factory functions (`getRedisClient()`, `getYooKassaClient()`). These functions are not refactored in this feature.
- Controller arrow methods will automatically bind `this` correctly in Express route handlers. No manual binding is required.
- All existing tests will be updated to use interfaces, maintaining 100% test coverage of previously covered functionality.
- Interface files will be organized in directories (`src/interfaces/repositories/`, `src/interfaces/services/`) for better organization.
- The refactoring will be done incrementally, one component at a time, to minimize risk and maintain testability throughout the process.
