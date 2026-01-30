# Tasks: Complete Dependency Injection with Interfaces

**Input**: Design documents from `/specs/003-full-di-interfaces/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: For this project, unit tests for critical payment logic are REQUIRED. All existing tests must be updated to use interfaces in mocks.

**Organization**: Tasks are organized by user story to enable independent implementation and testing of each story. This is an architectural refactoring - the project structure already exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below use single project structure

---

## Phase 1: User Story 1 - Create interfaces for all repositories (Priority: P1) 🎯 MVP

**Goal**: Create repository interfaces (IUserRepository, IPaymentRepository) so that services can depend on abstractions rather than concrete implementations, improving testability and flexibility.

**Independent Test**: Can be fully tested by creating mock implementations of repository interfaces and verifying that services can work with any implementation that satisfies the interface contract.

### Implementation for User Story 1

- [x] T001 [P] [US1] Create interfaces directory structure: `src/interfaces/repositories/`
- [x] T002 [P] [US1] Create IUserRepository interface in `src/interfaces/repositories/IUserRepository.ts` with `existsById(userId: string): Promise<boolean>` method
- [x] T003 [P] [US1] Create IPaymentRepository interface in `src/interfaces/repositories/IPaymentRepository.ts` with methods: `create(data)`, `findById(id)`, `findByYooKassaId(yookassaPaymentId)`, `updateStatus(id, data)`
- [x] T004 [US1] Update UserRepository class in `src/repositories/user.repository.ts` to implement `IUserRepository` interface
- [x] T005 [US1] Update PaymentRepository class in `src/repositories/payment.repository.ts` to implement `IPaymentRepository` interface
- [x] T006 [US1] Update PaymentsService constructor in `src/services/payment.service.ts` to accept `IUserRepository` and `IPaymentRepository` instead of concrete classes
- [x] T007 [US1] Update WebhookService constructor in `src/services/webhook.service.ts` to accept `IPaymentRepository` instead of concrete class

**Checkpoint**: At this point, repository interfaces exist and services use them. User Story 1 should be fully functional and testable independently.

---

## Phase 2: User Story 2 - Create interfaces for all services (Priority: P2)

**Goal**: Create service interfaces (IPaymentsService, IWebhookService) and review/update existing interfaces (IIdempotencyService, IYookassaService) so that controllers and other services can depend on abstractions.

**Independent Test**: Can be fully tested by creating mock implementations of service interfaces and verifying that controllers can work with any implementation that satisfies the interface contract.

### Implementation for User Story 2

- [X] T008 [P] [US2] Create interfaces directory structure: `src/interfaces/services/`
- [X] T009 [P] [US2] Review and update IIdempotencyService interface in `src/services/interfaces/idempotency-service.interface.ts` to match static IdempotencyService method signatures exactly (as instance methods)
- [X] T010 [P] [US2] Review and update IYookassaService interface in `src/services/interfaces/yookassa-service.interface.ts` to match static YookassaService method signatures exactly (as instance methods)
- [X] T011 [P] [US2] Create IPaymentsService interface in `src/interfaces/services/IPaymentsService.ts` with methods: `createPayment(request, idempotenceKey)`, `getPaymentById(id)`, `updatePaymentStatus(id, status)`
- [X] T012 [P] [US2] Create IWebhookService interface in `src/interfaces/services/IWebhookService.ts` with method: `processWebhook(payload, correlationId)`
- [X] T013 [US2] Move IIdempotencyService interface from `src/services/interfaces/idempotency-service.interface.ts` to `src/interfaces/services/IIdempotencyService.ts`
- [X] T014 [US2] Move IYookassaService interface from `src/services/interfaces/yookassa-service.interface.ts` to `src/interfaces/services/IYookassaService.ts`
- [X] T015 [US2] Update PaymentsService class in `src/services/payment.service.ts` to implement `IPaymentsService` interface
- [X] T016 [US2] Update WebhookService class in `src/services/webhook.service.ts` to implement `IWebhookService` interface
- [X] T017 [US2] Update all imports of IIdempotencyService and IYookassaService to use new paths in `src/interfaces/services/`

**Checkpoint**: At this point, all service interfaces exist and services implement them. User Story 2 should be fully functional and testable independently.

---

## Phase 3: User Story 3 - Refactor IdempotencyService to instance class (Priority: P3)

**Goal**: Convert IdempotencyService from static class to instance class with constructor injection so that it follows the same pattern as other services and can be easily tested with mocks.

**Independent Test**: Can be fully tested by creating an IdempotencyService instance with a mocked Redis client and verifying that all methods (`get`, `set`, `checkConflict`) work correctly.

### Implementation for User Story 3

- [X] T018 [US3] Convert IdempotencyService class in `src/services/idempotency.service.ts` from static class to instance class
- [X] T019 [US3] Add constructor to IdempotencyService in `src/services/idempotency.service.ts` that accepts `redisClient: RedisClientType` parameter
- [X] T020 [US3] Convert static `get` method to instance method in `src/services/idempotency.service.ts`
- [X] T021 [US3] Convert static `set` method to instance method in `src/services/idempotency.service.ts`
- [X] T022 [US3] Convert static `checkConflict` method to instance method in `src/services/idempotency.service.ts`
- [X] T023 [US3] Convert static `getKey` private method to instance method in `src/services/idempotency.service.ts`
- [X] T024 [US3] Convert static constants (TTL_SECONDS, KEY_PREFIX) to instance readonly properties in `src/services/idempotency.service.ts`
- [X] T025 [US3] Update IdempotencyService class in `src/services/idempotency.service.ts` to implement `IIdempotencyService` interface
- [X] T026 [US3] Update PaymentsService constructor in `src/services/payment.service.ts` to accept `IIdempotencyService` instead of using IdempotencyServiceAdapter

**Checkpoint**: At this point, IdempotencyService is an instance class. User Story 3 should be fully functional and testable independently.

---

## Phase 4: User Story 4 - Refactor YookassaService to instance class (Priority: P4)

**Goal**: Convert YookassaService from static class to instance class with constructor injection so that it follows the same pattern as other services and can be easily tested with mocks.

**Independent Test**: Can be fully tested by creating a YookassaService instance with a mocked Axios client and verifying that all methods (`createPayment`, `getPayment`) work correctly.

### Implementation for User Story 4

- [X] T027 [US4] Convert YookassaService class in `src/services/yookassa.service.ts` from static class to instance class
- [X] T028 [US4] Add constructor to YookassaService in `src/services/yookassa.service.ts` that accepts `axiosClient: AxiosInstance` parameter
- [X] T029 [US4] Convert static `createPayment` method to instance method in `src/services/yookassa.service.ts`
- [X] T030 [US4] Convert static `getPayment` method to instance method in `src/services/yookassa.service.ts`
- [X] T031 [US4] Convert static PAYMENTS_ENDPOINT constant to instance readonly property in `src/services/yookassa.service.ts`
- [X] T032 [US4] Update YookassaService class in `src/services/yookassa.service.ts` to implement `IYookassaService` interface
- [X] T033 [US4] Update PaymentsService constructor in `src/services/payment.service.ts` to accept `IYookassaService` instead of using YookassaServiceAdapter
- [X] T034 [US4] Update WebhookService constructor in `src/services/webhook.service.ts` to accept `IYookassaService` instead of using YookassaServiceAdapter

**Checkpoint**: At this point, YookassaService is an instance class. User Story 4 should be fully functional and testable independently.

---

## Phase 5: User Story 5 - Refactor controllers to classes (Priority: P5)

**Goal**: Convert controllers from factory functions to instance classes with constructor injection so that the dependency graph is explicit and consistent with the service layer pattern.

**Independent Test**: Can be fully tested by creating controller instances with mocked services and verifying that controller methods handle requests correctly and call service methods appropriately.

### Implementation for User Story 5

- [X] T035 [US5] Convert `createPaymentController` factory function to `PaymentsController` class in `src/controllers/payments.controller.ts`
- [X] T036 [US5] Add constructor to PaymentsController in `src/controllers/payments.controller.ts` that accepts `paymentsService: IPaymentsService` parameter
- [X] T037 [US5] Convert `createPayment` function to arrow method `createPayment` in PaymentsController class in `src/controllers/payments.controller.ts`
- [X] T038 [US5] Convert `getPaymentController` factory function to `getPayment` arrow method in PaymentsController class in `src/controllers/payments.controller.ts`
- [X] T039 [US5] Convert `processWebhookController` factory function to `WebhooksController` class in `src/controllers/webhooks.controller.ts`
- [X] T040 [US5] Add constructor to WebhooksController in `src/controllers/webhooks.controller.ts` that accepts `webhookService: IWebhookService` parameter
- [X] T041 [US5] Convert `processWebhook` function to arrow method `processWebhook` in WebhooksController class in `src/controllers/webhooks.controller.ts`
- [X] T042 [US5] Update `createPaymentsRoutes` function in `src/routes/payments.ts` to accept `PaymentsController` instance and call `paymentsController.createPayment` and `paymentsController.getPayment` methods
- [X] T043 [US5] Update `createWebhooksRoutes` function in `src/routes/webhooks.ts` to accept `WebhooksController` instance and call `webhooksController.processWebhook` method

**Checkpoint**: At this point, controllers are instance classes. User Story 5 should be fully functional and testable independently.

---

## Phase 6: User Story 6 - Remove adapters and update app.ts (Priority: P6)

**Goal**: Remove adapter classes and update app.ts so that the dependency graph uses only instance classes and interfaces, with no temporary workarounds.

**Independent Test**: Can be fully tested by verifying that app.ts initializes dependencies in the correct order (Redis → Prisma → Repositories → Services → Controllers → Routes) using only instance classes and interfaces, with no adapter classes.

### Implementation for User Story 6

- [X] T044 [US6] Delete `IdempotencyServiceAdapter` class file: `src/services/adapters/idempotency-service.adapter.ts`
- [X] T045 [US6] Delete `YookassaServiceAdapter` class file: `src/services/adapters/yookassa-service.adapter.ts`
- [X] T046 [US6] Remove adapter imports from `src/app.ts`
- [X] T047 [US6] Update `initializeDependencies` function in `src/app.ts` to create IdempotencyService instance directly: `new IdempotencyService(redisClient)` instead of adapter
- [X] T048 [US6] Update `initializeDependencies` function in `src/app.ts` to create YookassaService instance directly: `new YookassaService(axiosClient)` instead of adapter
- [X] T049 [US6] Update `initializeDependencies` function in `src/app.ts` to create PaymentsController instance: `new PaymentsController(paymentsService)`
- [X] T050 [US6] Update `initializeDependencies` function in `src/app.ts` to create WebhooksController instance: `new WebhooksController(webhookService)`
- [X] T051 [US6] Update `initializeDependencies` function in `src/app.ts` to pass controller instances to route factory functions: `createPaymentsRoutes(paymentsController)` and `createWebhooksRoutes(webhooksController)`
- [X] T052 [US6] Verify initialization order in `src/app.ts` follows: Redis → Prisma → Repositories → Services (IdempotencyService, YookassaService, PaymentsService, WebhookService) → Controllers → Routes
- [X] T053 [US6] Verify all dependencies in constructors use interfaces (not concrete classes) in `src/app.ts`

**Checkpoint**: At this point, adapters are removed and app.ts uses only instance classes. User Story 6 should be fully functional and testable independently.

---

## Phase 7: User Story 7 - Update tests to use interfaces (Priority: P7)

**Goal**: Update all unit tests to use interfaces in mocks so that tests are decoupled from concrete implementations and can work with any implementation that satisfies the interface contract.

**Independent Test**: Can be fully tested by running all existing unit tests and verifying that they pass with interface-based mocks. Tests should create service instances with interface mocks rather than concrete class mocks.

### Implementation for User Story 7

- [ ] T054 [P] [US7] Update test file `tests/unit/payments-create.controller.test.ts` to use `jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentRepository>`, `jest.Mocked<IPaymentsService>` instead of concrete class mocks
- [ ] T055 [P] [US7] Update test file `tests/unit/payments-create.idempotency-conflict.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T056 [P] [US7] Update test file `tests/unit/payments-create.user-not-found.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T057 [P] [US7] Update test file `tests/unit/payments-create.5xx-503.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T058 [P] [US7] Update test file `tests/unit/payments-create.timeout-503.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T059 [P] [US7] Update test file `tests/unit/payments-get.controller.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T060 [P] [US7] Update test file `tests/unit/payments-get.cancellation-details.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T061 [P] [US7] Update test file `tests/unit/webhook.restore-missing-payment.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T062 [P] [US7] Update test file `tests/unit/webhook.status-update.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T063 [P] [US7] Update test file `tests/unit/webhook.verification-ignored.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T064 [P] [US7] Update test file `tests/unit/webhook.payload-validation.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T065 [P] [US7] Update test file `tests/unit/webhook.ip-allowlist.test.ts` to use interface mocks instead of concrete class mocks
- [ ] T066 [P] [US7] Update test file `tests/unit/yookassa.service.create-payment.test.ts` to use interface mocks and test instance class instead of static class
- [ ] T067 [P] [US7] Update test file `tests/unit/yookassa.client.retry-interceptor.test.ts` to use interface mocks if applicable
- [ ] T068 [P] [US7] Update test file `tests/unit/idempotency-service.test.ts` to use interface mocks and test instance class instead of static class
- [ ] T069 [P] [US7] Update test file `tests/unit/payment-state-machine.test.ts` to use interface mocks if applicable
- [ ] T070 [US7] Run all unit tests and verify they pass with interface-based mocks
- [ ] T071 [US7] Verify test coverage remains at 100% of previously covered functionality

**Checkpoint**: At this point, all tests use interfaces and pass. User Story 7 should be fully functional and testable independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T072 [P] Verify TypeScript compilation succeeds without errors
- [ ] T073 [P] Run linter and fix any issues
- [ ] T074 [P] Verify no references to adapters remain in codebase (search for "Adapter")
- [ ] T075 [P] Verify no static method calls remain for IdempotencyService and YookassaService (search for "IdempotencyService." and "YookassaService.")
- [ ] T076 [P] Verify all dependencies in constructors use interfaces (not concrete classes) across all files
- [ ] T077 [P] Update any documentation that references old architecture patterns
- [ ] T078 Verify application starts successfully and all endpoints work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (P1)**: No dependencies - can start immediately (MVP)
- **User Story 2 (P2)**: Depends on User Story 1 completion (needs repository interfaces)
- **User Story 3 (P3)**: Depends on User Story 2 completion (needs IIdempotencyService interface)
- **User Story 4 (P4)**: Depends on User Story 2 completion (needs IYookassaService interface)
- **User Story 5 (P5)**: Depends on User Story 2 completion (needs IPaymentsService and IWebhookService interfaces)
- **User Story 6 (P6)**: Depends on User Stories 3, 4, 5 completion (needs all services and controllers refactored)
- **User Story 7 (P7)**: Depends on all previous stories completion (needs all refactoring complete)
- **Polish (Phase 8)**: Depends on all user stories completion

### User Story Dependencies

- **User Story 1 (P1)**: Foundation - creates repository interfaces
- **User Story 2 (P2)**: Depends on US1 - creates service interfaces
- **User Story 3 (P3)**: Depends on US2 - refactors IdempotencyService (can run in parallel with US4)
- **User Story 4 (P4)**: Depends on US2 - refactors YookassaService (can run in parallel with US3)
- **User Story 5 (P5)**: Depends on US2 - refactors controllers (can start after US2, but should wait for US3/US4)
- **User Story 6 (P6)**: Depends on US3, US4, US5 - removes adapters and updates app.ts
- **User Story 7 (P7)**: Depends on all previous stories - updates tests

### Within Each User Story

- Interface creation before implementation updates
- Service updates before controller updates
- Implementation before test updates (for new tests)
- Story complete before moving to next priority

### Parallel Opportunities

- **User Story 1**: T001-T003 can run in parallel (different interface files)
- **User Story 2**: T008-T012 can run in parallel (different interface files)
- **User Story 3 & 4**: Can run in parallel (different services, no dependencies on each other)
- **User Story 7**: All test file updates (T054-T069) can run in parallel (different test files)
- **Polish Phase**: T072-T077 can run in parallel (different validation tasks)

---

## Parallel Example: User Story 1

```bash
# Launch all interface creation tasks together:
Task: "Create IUserRepository interface in src/interfaces/repositories/IUserRepository.ts"
Task: "Create IPaymentRepository interface in src/interfaces/repositories/IPaymentRepository.ts"
Task: "Create interfaces directory structure: src/interfaces/repositories/"
```

---

## Parallel Example: User Story 7

```bash
# Launch all test updates together (17 test files):
Task: "Update test file tests/unit/payments-create.controller.test.ts"
Task: "Update test file tests/unit/payments-create.idempotency-conflict.test.ts"
Task: "Update test file tests/unit/payments-create.user-not-found.test.ts"
# ... (all 17 test files can be updated in parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: User Story 1 (Repository Interfaces)
2. **STOP and VALIDATE**: Verify repository interfaces work, services can use them
3. Test independently
4. Deploy/demo if ready

### Incremental Delivery

1. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
2. Add User Story 2 → Test independently → Deploy/Demo
3. Add User Story 3 → Test independently → Deploy/Demo
4. Add User Story 4 → Test independently → Deploy/Demo
5. Add User Story 5 → Test independently → Deploy/Demo
6. Add User Story 6 → Test independently → Deploy/Demo
7. Add User Story 7 → Test independently → Deploy/Demo
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. **Developer A**: User Story 1 (Repository Interfaces)
2. **Once US1 complete**:
   - Developer A: User Story 2 (Service Interfaces)
   - Developer B: User Story 3 (IdempotencyService) - can start after US2
   - Developer C: User Story 4 (YookassaService) - can start after US2
3. **Once US2, US3, US4 complete**:
   - Developer A: User Story 5 (Controllers)
   - Developer B: User Story 6 (Remove adapters)
4. **Once all stories complete**:
   - All developers: User Story 7 (Update tests) - can work in parallel on different test files

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- This is a refactoring - no new features, maintain 100% test coverage
- All changes maintain backward compatibility with HTTP API

---

## Summary

- **Total Tasks**: 78 tasks
- **Tasks per User Story**:
  - US1 (P1): 7 tasks
  - US2 (P2): 10 tasks
  - US3 (P3): 9 tasks
  - US4 (P4): 8 tasks
  - US5 (P5): 9 tasks
  - US6 (P6): 10 tasks
  - US7 (P7): 18 tasks
  - Polish: 7 tasks
- **Parallel Opportunities**: 30+ tasks can run in parallel
- **Independent Test Criteria**: Each user story has clear acceptance scenarios
- **Suggested MVP Scope**: User Story 1 (Repository Interfaces) - 7 tasks

