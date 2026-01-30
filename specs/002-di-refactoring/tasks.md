---
description: "Task list for Dependency Injection Refactoring (Constructor Injection)"
---

# Tasks: Dependency Injection Refactoring (Constructor Injection)

**Input**: Design documents from `specs/002-di-refactoring/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `quickstart.md`

**Tests**: Unit tests are REQUIRED to verify refactoring correctness. All existing tests must pass after refactoring.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths below assume single backend project at repo root (per `plan.md`)

## Phase 1: Setup (Prerequisites)

**Purpose**: Create directory structure for new interfaces and adapters

- [x] T001 Create `src/services/interfaces/` directory for service interfaces
- [x] T002 Create `src/services/adapters/` directory for adapter classes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service interfaces and adapters that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Service Interfaces

- [x] T003 [P] Create `IIdempotencyService` interface in `src/services/interfaces/idempotency-service.interface.ts` with methods: `get(key: string)`, `set(key, hash, payment)`, `checkConflict(key, hash)` matching `IdempotencyService` static method signatures
- [x] T004 [P] Create `IYookassaService` interface in `src/services/interfaces/yookassa-service.interface.ts` with methods: `createPayment(request, idempotenceKey)`, `getPayment(paymentId, correlationId)` matching `YookassaService` static method signatures

### Adapter Classes

- [x] T005 [P] Create `IdempotencyServiceAdapter` class in `src/services/adapters/idempotency-service.adapter.ts` implementing `IIdempotencyService` interface, delegating all method calls to `IdempotencyService` static methods
- [x] T006 [P] Create `YookassaServiceAdapter` class in `src/services/adapters/yookassa-service.adapter.ts` implementing `IYookassaService` interface, delegating all method calls to `YookassaService` static methods

**Checkpoint**: Interfaces and adapters ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Refactor PaymentsService to instance class (Priority: P1) 🎯 MVP

**Goal**: Convert `PaymentsService` from static class to instance class with constructor injection, enabling explicit dependency control and improved testability.

**Independent Test**: Create `PaymentsService` instance with `new PaymentsService(userRepository, paymentRepository, idempotencyService, yookassaService)` and verify all methods (`createPayment`, `getPaymentById`, `updatePaymentStatus`) work correctly.

### Implementation for User Story 1

- [x] T007 [US1] Remove `static` keyword from class declaration in `src/services/payment.service.ts`
- [x] T008 [US1] Remove all `private static readonly` properties (`prisma`, `userRepository`, `paymentRepository`) from `src/services/payment.service.ts`
- [x] T009 [US1] Add constructor to `PaymentsService` in `src/services/payment.service.ts`: `constructor(userRepository: UserRepository, paymentRepository: PaymentRepository, idempotencyService: IIdempotencyService, yookassaService: IYookassaService)`
- [x] T010 [US1] Store constructor parameters as private instance properties in `src/services/payment.service.ts`
- [x] T011 [US1] Convert `createPayment` static method to instance method in `src/services/payment.service.ts` (remove `static` keyword)
- [x] T012 [US1] Convert `getPaymentById` static method to instance method in `src/services/payment.service.ts` (remove `static` keyword)
- [x] T013 [US1] Convert `updatePaymentStatus` static method to instance method in `src/services/payment.service.ts` (remove `static` keyword)
- [x] T014 [US1] Update internal references in `createPayment` method: replace `this.userRepository` (was static), `this.paymentRepository` (was static), `this.idempotencyService`, `this.yookassaService` in `src/services/payment.service.ts`
- [x] T015 [US1] Replace `IdempotencyService.get()` calls with `this.idempotencyService.get()` in `src/services/payment.service.ts`
- [x] T016 [US1] Replace `YookassaService.createPayment()` calls with `this.yookassaService.createPayment()` in `src/services/payment.service.ts`
- [x] T017 [US1] Update internal references in `getPaymentById` method: replace `this.paymentRepository` (was static) in `src/services/payment.service.ts`
- [x] T018 [US1] Update internal references in `updatePaymentStatus` method: replace `this.paymentRepository` (was static) in `src/services/payment.service.ts`
- [x] T019 [US1] Add imports for `IIdempotencyService` and `IYookassaService` interfaces in `src/services/payment.service.ts`
- [x] T020 [US1] Verify all business logic remains unchanged in `src/services/payment.service.ts` (no functional changes)

**Checkpoint**: PaymentsService is now an instance class with constructor injection. Can be tested independently.

---

## Phase 4: User Story 2 - Refactor WebhookService to instance class (Priority: P2)

**Goal**: Convert `WebhookService` from static class to instance class with constructor injection, completing the service layer refactoring.

**Independent Test**: Create `WebhookService` instance with `new WebhookService(paymentRepository, paymentsService, yookassaService)` and verify `processWebhook` method works correctly.

### Implementation for User Story 2

- [x] T021 [US2] Remove `static` keyword from class declaration in `src/services/webhook.service.ts`
- [x] T022 [US2] Remove all `private static readonly` properties (`paymentRepository`) from `src/services/webhook.service.ts`
- [x] T023 [US2] Add constructor to `WebhookService` in `src/services/webhook.service.ts`: `constructor(paymentRepository: PaymentRepository, paymentsService: PaymentsService, yookassaService: IYookassaService)`
- [x] T024 [US2] Store constructor parameters as private instance properties in `src/services/webhook.service.ts`
- [x] T025 [US2] Convert `processWebhook` static method to instance method in `src/services/webhook.service.ts` (remove `static` keyword)
- [x] T026 [US2] Convert all private static helper methods to instance methods in `src/services/webhook.service.ts` (remove `static` keyword from `verifyPaymentWithYooKassa`, `validateStatusMatch`, `findOrRestorePayment`, `restorePayment`, `updatePaymentStatus`, `mapYooKassaStatus`)
- [x] T027 [US2] Update internal references in `processWebhook` method: replace `this.paymentRepository` (was static), `this.paymentsService`, `this.yookassaService` in `src/services/webhook.service.ts`
- [x] T028 [US2] Replace `PaymentsService.updatePaymentStatus()` calls with `this.paymentsService.updatePaymentStatus()` in `src/services/webhook.service.ts`
- [x] T029 [US2] Replace `YookassaService.getPayment()` calls with `this.yookassaService.getPayment()` in `src/services/webhook.service.ts`
- [x] T030 [US2] Update all internal method calls to use `this.` prefix for instance methods in `src/services/webhook.service.ts`
- [x] T031 [US2] Add imports for `IYookassaService` interface and `PaymentsService` class in `src/services/webhook.service.ts`
- [x] T032 [US2] Verify all business logic remains unchanged in `src/services/webhook.service.ts` (no functional changes)

**Checkpoint**: WebhookService is now an instance class with constructor injection. Service layer refactoring complete.

---

## Phase 5: User Story 3 - Update controllers to work with instance services (Priority: P3)

**Goal**: Convert controllers to factory functions that accept service instances as parameters, enabling dependency injection at controller creation time.

**Independent Test**: Create controller via `createPaymentController(paymentsService)` with mocked service and verify controller calls service methods correctly.

### Implementation for User Story 3

- [x] T033 [US3] Create `createPaymentController` factory function in `src/controllers/payments.controller.ts` that accepts `paymentsService: PaymentsService` parameter and returns async controller function `(req, res, next) => Promise<void>`
- [x] T034 [US3] Move existing `createPayment` controller logic into `createPaymentController` factory closure, using `paymentsService` parameter instead of `PaymentsService.createPayment()` static call in `src/controllers/payments.controller.ts`
- [x] T035 [US3] Create `getPaymentController` factory function in `src/controllers/payments.controller.ts` that accepts `paymentsService: PaymentsService` parameter and returns async controller function `(req, res, next) => Promise<void>`
- [x] T036 [US3] Move existing `getPayment` controller logic into `getPaymentController` factory closure, using `paymentsService` parameter instead of `PaymentsService.getPaymentById()` static call in `src/controllers/payments.controller.ts`
- [x] T037 [US3] Remove direct imports of `PaymentsService` static class from `src/controllers/payments.controller.ts`
- [x] T038 [US3] Create `processWebhookController` factory function in `src/controllers/webhooks.controller.ts` that accepts `webhookService: WebhookService` parameter and returns async controller function `(req, res, next) => Promise<void>`
- [x] T039 [US3] Move existing `processWebhook` controller logic into `processWebhookController` factory closure, using `webhookService` parameter instead of `WebhookService.processWebhook()` static call in `src/controllers/webhooks.controller.ts`
- [x] T040 [US3] Remove direct imports of `WebhookService` static class from `src/controllers/webhooks.controller.ts`
- [x] T041 [US3] Verify all controller error handling and response logic remains unchanged in `src/controllers/payments.controller.ts` and `src/controllers/webhooks.controller.ts`

**Checkpoint**: Controllers are now factory functions. Can be tested independently with mocked services.

---

## Phase 6: User Story 4 - Update routes to accept controllers via factory functions (Priority: P4)

**Goal**: Convert routes to factory functions that accept controller functions as parameters, enabling dependency injection at route creation time.

**Independent Test**: Create routes via `createPaymentsRoutes(createPaymentController, getPaymentController)` with mocked controllers and verify routes are properly configured.

### Implementation for User Story 4

- [x] T042 [US4] Create `createPaymentsRoutes` factory function in `src/routes/payments.ts` that accepts `createPaymentController` and `getPaymentController` parameters and returns Express Router
- [x] T043 [US4] Move existing route definitions into `createPaymentsRoutes` factory, using controller parameters instead of directly imported controller functions in `src/routes/payments.ts`
- [x] T044 [US4] Keep all middleware (rate limiting, validation, idempotence key) unchanged in `createPaymentsRoutes` factory in `src/routes/payments.ts`
- [x] T045 [US4] Remove direct imports of controller functions from `src/routes/payments.ts`
- [x] T046 [US4] Create `createWebhooksRoutes` factory function in `src/routes/webhooks.ts` that accepts `processWebhookController` parameter and returns Express Router
- [x] T047 [US4] Move existing route definitions into `createWebhooksRoutes` factory, using controller parameter instead of directly imported controller function in `src/routes/webhooks.ts`
- [x] T048 [US4] Keep all middleware (IP allowlist, payload validation) unchanged in `createWebhooksRoutes` factory in `src/routes/webhooks.ts`
- [x] T049 [US4] Remove direct imports of controller functions from `src/routes/webhooks.ts`
- [x] T050 [US4] Verify all route middleware configuration remains unchanged in `src/routes/payments.ts` and `src/routes/webhooks.ts`

**Checkpoint**: Routes are now factory functions. Can be tested independently with mocked controllers.

---

## Phase 7: User Story 5 - Update app.ts for explicit dependency initialization (Priority: P5)

**Goal**: Update `app.ts` to explicitly initialize all dependencies in correct order, making the dependency graph visible and ensuring Prisma is connected before services are created.

**Independent Test**: Verify `app.ts` initializes dependencies in correct order (Redis → Prisma → Repositories → Adapters → Services → Controllers → Routes) and Prisma is explicitly connected before repositories are created.

### Implementation for User Story 5

- [ ] T051 [US5] Move Express app setup to top of `src/app.ts` (before dependency initialization)
- [ ] T052 [US5] Create `async function initializeDependencies()` in `src/app.ts` to handle all dependency initialization
- [ ] T053 [US5] Add Redis connection initialization: `await getRedisClient()` as first step in `initializeDependencies()` in `src/app.ts`
- [ ] T054 [US5] Add Prisma client initialization: `const prisma = getPrismaClient()` in `initializeDependencies()` in `src/app.ts`
- [ ] T055 [US5] Add explicit Prisma connection: `await prisma.$connect()` before creating any repositories in `initializeDependencies()` in `src/app.ts`
- [ ] T056 [US5] Create repository instances: `const userRepository = new UserRepository(prisma)` and `const paymentRepository = new PaymentRepository(prisma)` in `initializeDependencies()` in `src/app.ts`
- [ ] T057 [US5] Create adapter instances: `const idempotencyService = new IdempotencyServiceAdapter()` and `const yookassaService = new YookassaServiceAdapter()` in `initializeDependencies()` in `src/app.ts`
- [ ] T058 [US5] Create service instances: `const paymentsService = new PaymentsService(userRepository, paymentRepository, idempotencyService, yookassaService)` in `initializeDependencies()` in `src/app.ts`
- [ ] T059 [US5] Create service instances: `const webhookService = new WebhookService(paymentRepository, paymentsService, yookassaService)` in `initializeDependencies()` in `src/app.ts`
- [ ] T060 [US5] Create controller instances via factory functions: `const createPaymentController = createPaymentController(paymentsService)`, `const getPaymentController = getPaymentController(paymentsService)`, `const processWebhookController = processWebhookController(webhookService)` in `initializeDependencies()` in `src/app.ts`
- [ ] T061 [US5] Create route instances via factory functions: `const paymentsRoutes = createPaymentsRoutes(createPaymentController, getPaymentController)`, `const webhooksRoutes = createWebhooksRoutes(processWebhookController)` in `initializeDependencies()` in `src/app.ts`
- [ ] T062 [US5] Mount routes: `app.use("/api/payments", paymentsRoutes)` and `app.use("/api/webhooks", webhooksRoutes)` in `initializeDependencies()` in `src/app.ts`
- [ ] T063 [US5] Wrap `initializeDependencies()` in try-catch block: on error, log with full context (dependency name, error message, stack trace) using structured logging, then exit with `process.exit(1)` in `src/app.ts`
- [ ] T064 [US5] Call `initializeDependencies()` in `startServer()` function before starting HTTP server in `src/app.ts`
- [ ] T065 [US5] Update graceful shutdown to explicitly disconnect Prisma: `await disconnectPrisma()` in `gracefulShutdown()` function in `src/app.ts`
- [ ] T066 [US5] Add imports for all new classes and factory functions in `src/app.ts`
- [ ] T067 [US5] Verify complete dependency graph is visible in `src/app.ts` (no hidden or lazy initializations)

**Checkpoint**: app.ts explicitly initializes all dependencies in correct order. Application startup is now fail-fast.

---

## Phase 8: User Story 6 - Update unit tests for instance classes (Priority: P6)

**Goal**: Update all unit tests to work with instance classes, ensuring test coverage is maintained and tests can take advantage of improved testability.

**Independent Test**: Run all existing unit tests and verify they pass with the new instance-based architecture. Tests should create service instances with mocks rather than relying on static methods.

### Implementation for User Story 6

- [ ] T068 [US6] Update test files that use `PaymentsService`: create mock repositories (`mockUserRepository`, `mockPaymentRepository`) and mock adapters (`mockIdempotencyService`, `mockYookassaService`) in test setup
- [ ] T069 [US6] Update test files that use `PaymentsService`: create service instance `new PaymentsService(mockUserRepository, mockPaymentRepository, mockIdempotencyService, mockYookassaService)` instead of using static class
- [ ] T070 [US6] Replace all `PaymentsService.createPayment()` static calls with `paymentsService.createPayment()` instance calls in test files
- [ ] T071 [US6] Replace all `PaymentsService.getPaymentById()` static calls with `paymentsService.getPaymentById()` instance calls in test files
- [ ] T072 [US6] Replace all `PaymentsService.updatePaymentStatus()` static calls with `paymentsService.updatePaymentStatus()` instance calls in test files
- [ ] T073 [US6] Update test files that use `WebhookService`: create mock repository (`mockPaymentRepository`), mock service (`mockPaymentsService`), and mock adapter (`mockYookassaService`) in test setup
- [ ] T074 [US6] Update test files that use `WebhookService`: create service instance `new WebhookService(mockPaymentRepository, mockPaymentsService, mockYookassaService)` instead of using static class
- [ ] T075 [US6] Replace all `WebhookService.processWebhook()` static calls with `webhookService.processWebhook()` instance calls in test files
- [ ] T076 [US6] Update controller tests: create service instances with mocks and create controllers via factory functions `createPaymentController(mockPaymentsService)` in test files
- [ ] T077 [US6] Update controller tests: verify controller behavior with mocked services in test files
- [ ] T078 [US6] Run all unit tests and verify they pass with the new instance-based architecture
- [ ] T079 [US6] Verify test coverage remains at 100% of previously covered functionality

**Checkpoint**: All unit tests pass with instance-based architecture. Testability improvements are verified.

---

## Phase 9: Polish & Verification

**Purpose**: Final verification and cleanup

- [ ] T080 Verify no static methods remain in `PaymentsService` or `WebhookService` (all methods are instance methods)
- [ ] T081 Verify all dependencies are explicitly visible in `src/app.ts` (no hidden or lazy initializations)
- [ ] T082 Verify Prisma client is explicitly connected (`await prisma.$connect()`) before any repositories or services are created
- [ ] T083 Verify application starts successfully and all HTTP endpoints work identically (no breaking changes)
- [ ] T084 Verify error handling: simulate connection failure and verify application fails fast with clear error message
- [ ] T085 Run Constitution Check: verify all 6 gates pass (Constructor Injection, Explicit Initialization, Visible Dependencies, Fail-Fast, Testability, No Static Service Locator)
- [ ] T086 Update documentation if needed (README, code comments)

---

## Dependencies

### User Story Completion Order

1. **Phase 2 (Foundational)** → Must complete before any user story
   - Interfaces and adapters are prerequisites for US1

2. **Phase 3 (US1: PaymentsService)** → Can start after Phase 2
   - Independent: No dependencies on other user stories

3. **Phase 4 (US2: WebhookService)** → Must complete after US1
   - Depends on: US1 (WebhookService uses PaymentsService instance)

4. **Phase 5 (US3: Controllers)** → Must complete after US1 and US2
   - Depends on: US1 (uses PaymentsService), US2 (uses WebhookService)

5. **Phase 6 (US4: Routes)** → Must complete after US3
   - Depends on: US3 (uses controller factory functions)

6. **Phase 7 (US5: app.ts)** → Must complete after US1, US2, US3, US4
   - Depends on: All previous phases (integrates everything)

7. **Phase 8 (US6: Tests)** → Must complete after all implementation phases
   - Depends on: All previous phases (tests verify refactoring correctness)

### Parallel Execution Opportunities

**Within Phase 2 (Foundational)**:
- T003 and T004 can run in parallel (different interface files)
- T005 and T006 can run in parallel (different adapter files)

**Within Phase 3 (US1)**:
- Most tasks are sequential (modifying same file), but T019 (imports) can be done in parallel with other tasks

**Within Phase 4 (US2)**:
- Most tasks are sequential (modifying same file), but T031 (imports) can be done in parallel with other tasks

**Within Phase 5 (US3)**:
- T033-T036 (payments controller) and T038-T040 (webhooks controller) can be done in parallel (different files)

**Within Phase 6 (US4)**:
- T042-T045 (payments routes) and T046-T049 (webhooks routes) can be done in parallel (different files)

**Within Phase 8 (US6)**:
- Test updates for different services can be done in parallel (different test files)

## Implementation Strategy

### MVP Scope

**Minimum Viable Product**: Complete through Phase 3 (US1: PaymentsService refactoring)

This provides:
- Core service refactored to instance class
- Pattern established for other services
- Immediate testability improvements
- Can be tested independently

### Incremental Delivery

1. **Increment 1 (MVP)**: Phase 2 + Phase 3
   - Interfaces, adapters, and PaymentsService refactored
   - Can be tested and verified independently

2. **Increment 2**: Phase 4
   - WebhookService refactored
   - Service layer complete

3. **Increment 3**: Phase 5 + Phase 6
   - Controllers and routes converted to factories
   - Can be tested independently

4. **Increment 4**: Phase 7
   - app.ts integration
   - Full dependency graph visible

5. **Increment 5**: Phase 8 + Phase 9
   - Tests updated and verified
   - Final polish and verification

### Risk Mitigation

- Each phase is independently testable
- No breaking changes to HTTP API (backward compatible)
- Incremental delivery allows early validation
- Tests verify correctness at each step
- Rollback is possible at any phase boundary

---

## Summary

- **Total Tasks**: 86
- **Tasks per User Story**:
  - Phase 2 (Foundational): 4 tasks
  - Phase 3 (US1): 14 tasks
  - Phase 4 (US2): 12 tasks
  - Phase 5 (US3): 9 tasks
  - Phase 6 (US4): 9 tasks
  - Phase 7 (US5): 17 tasks
  - Phase 8 (US6): 12 tasks
  - Phase 9 (Polish): 7 tasks

- **Parallel Opportunities**: Multiple tasks can run in parallel within phases (see Parallel Execution Opportunities section)

- **Independent Test Criteria**:
  - US1: Create PaymentsService instance and verify all methods work
  - US2: Create WebhookService instance and verify processWebhook works
  - US3: Create controllers via factories and verify they call service methods
  - US4: Create routes via factories and verify route configuration
  - US5: Verify app.ts initializes dependencies in correct order
  - US6: Run all unit tests and verify they pass

- **Suggested MVP Scope**: Phase 2 + Phase 3 (interfaces, adapters, PaymentsService refactoring)

- **Format Validation**: ✅ All tasks follow checklist format with checkbox, ID, optional [P] marker, [Story] label, and file paths

