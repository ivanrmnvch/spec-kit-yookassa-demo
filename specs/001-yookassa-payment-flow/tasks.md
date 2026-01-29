---

description: "Task list template for feature implementation"
---

# Tasks: YooKassa Payment Flow (Create • Status • Webhooks)

**Input**: Design documents from `specs/001-yookassa-payment-flow/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Unit tests for critical payment logic are REQUIRED (TDD: Red → Green → Refactor). Integration tests are OPTIONAL and should only be included if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths below assume single backend project at repo root (per `plan.md`)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create source/test directory skeleton per plan in `src/` and `tests/unit/` (DoD: dirs exist, committed)
- [x] T002 Initialize Node.js + TypeScript project (`package.json`, `tsconfig.json` strict) (DoD: `npm test` runs)
- [x] T003 [P] Add ESLint + Prettier config (DoD: `npm run lint` passes, no warnings)
- [x] T004 [P] Add Jest + ts-jest test setup in `jest.config.*` (DoD: `npm test` executes empty suite)
- [x] T005 Add base app entrypoint in `src/app.ts` (DoD: starts and listens on PORT)
- [x] T006 Add `docker-compose.yml` with PostgreSQL + Redis per plan (DoD: `docker-compose up -d` is healthy)
- [x] T007 Add `.env.example` documenting required env vars (DoD: matches constitution/env validation list)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Implement environment validation schema in `src/config/env.ts` (DoD: missing/invalid env fails fast at startup)
- [ ] T009 Implement Pino logger in `src/utils/logger.ts` (DoD: structured JSON logs, no secrets)
- [ ] T010 Implement correlation-id middleware in `src/middlewares/correlation-id.ts` (DoD: uses `X-Correlation-Id` or generates; attaches to request context)
- [ ] T011 Implement request logging middleware in `src/middlewares/request-logger.ts` (DoD: logs inbound request with `correlationId`)
- [ ] T012 Implement centralized error handler in `src/middlewares/error-handler.ts` (DoD: consistent JSON error envelope)
- [ ] T013 Implement Redis client connect/disconnect in `src/config/redis.ts` (DoD: connects on startup, graceful quit on shutdown)
- [ ] T014 Implement rate limiter wiring in `src/middlewares/rate-limiter.ts` (DoD: Redis-backed store supported; webhook excluded)
- [ ] T015 Implement Prisma client in `src/config/database.ts` (DoD: connects/disconnects cleanly)
- [ ] T016 Create Prisma schema in `prisma/schema.prisma` for `users` + `payments` per `data-model.md` (DoD: schema matches fields + types)
- [ ] T017 Create initial Prisma migration for tables + indexes in `prisma/migrations/*` (DoD: `npx prisma migrate dev` applies cleanly)
- [ ] T018 Create seed script for 2–3 users in `prisma/seed.ts` (DoD: `npx prisma db seed` inserts users only)
- [ ] T019 Create base routing in `src/routes/index.ts` and mount in `src/app.ts` (DoD: server boots with `/health` route)
- [ ] T020 Add health endpoint in `src/routes/health.ts` (DoD: `GET /health` returns status ok)
- [ ] T021 Add YooKassa types in `src/types/yookassa.types.ts` (DoD: no `any` for core YooKassa DTOs)
- [ ] T022 [P] Add domain enums/types in `src/types/payment.types.ts` (DoD: `PaymentStatus` union matches `pending|succeeded|canceled`)

### TDD: Payment state machine (core domain, blocks webhook correctness)

- [ ] T023 [P] Write failing unit tests for state transitions in `tests/unit/payment-state-machine.test.ts` (Red DoD: tests fail)
- [ ] T024 Implement `PaymentStateMachine` in `src/services/payment-state-machine.ts` (Green DoD: tests pass)
- [ ] T025 Refactor `PaymentStateMachine` for clarity (Refactor DoD: tests still pass, no behavior change)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initiate payment and redirect user to checkout (Priority: P1) 🎯 MVP

**Goal**: Implement `POST /api/payments` with Redis idempotency (24h), request-hash conflict protection, YooKassa create-payment, and 201/200 semantics.

**Independent Test**: `POST /api/payments` with valid body + UUID v4 `Idempotence-Key` returns 201 + `confirmation_url` + ids; repeating returns 200 with same ids.

### Tests for User Story 1 (REQUIRED for critical logic) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US1] Write failing unit tests for idempotency cache hit/miss/conflict in `tests/unit/idempotency-service.test.ts` (Red DoD: tests fail)
- [ ] T027 [P] [US1] Write failing unit tests for create-payment controller status codes (201 vs 200) in `tests/unit/payments-create.controller.test.ts` (Red DoD: tests fail)
- [ ] T028 [P] [US1] Write failing unit tests for 404 user-not-found (no YooKassa call) in `tests/unit/payments-create.user-not-found.test.ts` (Red DoD: tests fail)
- [ ] T029 [P] [US1] Write failing unit tests for 409 idempotency hash mismatch in `tests/unit/payments-create.idempotency-conflict.test.ts` (Red DoD: tests fail)

### Implementation for User Story 1

- [ ] T030 [P] [US1] Implement `UserRepository` in `src/repositories/user.repository.ts` (DoD: exposes `existsById`)
- [ ] T031 [P] [US1] Implement `PaymentRepository` create/find by YooKassa id in `src/repositories/payment.repository.ts` (DoD: supports unique constraint handling)
- [ ] T032 [P] [US1] Implement stable JSON hashing helper in `src/utils/request-hash.ts` (DoD: deterministic hash for same object)
- [ ] T033 [US1] Implement idempotency store in `src/services/idempotency.service.ts` using Redis TTL=24h (Green DoD: T026 passes)
- [ ] T034 [US1] Refactor idempotency store (types, error classes) in `src/services/idempotency.service.ts` (Refactor DoD: tests still pass)
- [ ] T035 [P] [US1] Implement `Idempotence-Key` validation middleware in `src/middlewares/idempotence-key.ts` (DoD: rejects missing/invalid UUID v4)

### TDD: YooKassa client (create payment)

- [ ] T036 [P] [US1] Write failing unit tests for YooKassa create-payment call and headers in `tests/unit/yookassa.service.create-payment.test.ts` (Red DoD: tests fail)
- [ ] T037 [P] [US1] Write failing unit tests for Axios retry interceptor behavior in `tests/unit/yookassa.client.retry-interceptor.test.ts` (Red DoD: tests fail)
- [ ] T038 [US1] Implement Axios client + retry interceptor in `src/config/yookassa.ts` (Green DoD: T037 passes)
- [ ] T039 [US1] Implement `YookassaService` create-payment in `src/services/yookassa.service.ts` (Green DoD: T036 passes)
- [ ] T040 [US1] Refactor YooKassa client/service (logging, redaction, types) in `src/config/yookassa.ts` and `src/services/yookassa.service.ts` (Refactor DoD: tests still pass)

### API endpoint: POST /api/payments

- [ ] T041 [P] [US1] Implement Zod DTO schema for create-payment in `src/middlewares/validation.ts` (DoD: validates `amount.value` pattern + `returnUrl`)
- [ ] T042 [US1] Implement `PaymentsService.createPayment` in `src/services/payment.service.ts` (DoD: orchestrates user exists → idempotency → YooKassa → DB → cache)
- [ ] T043 [US1] Implement controller `createPayment` in `src/controllers/payments.controller.ts` (DoD: returns 201 vs 200 per spec; includes `id` + `yookassa_payment_id`)
- [ ] T044 [US1] Wire route `POST /api/payments` in `src/routes/payments.ts` (DoD: middleware order: correlation → rate limit → idempotence-key → DTO validation → controller)
- [ ] T045 [US1] Refactor create-payment flow for readability (Refactor DoD: tests T026–T029 green; no behavior change)

**Checkpoint**: User Story 1 functional; idempotency works; 201/200 correct; basic YooKassa integration mocked in unit tests

---

## Phase 4: User Story 2 - Track payment status via API (Priority: P2)

**Goal**: Implement `GET /api/payments/:id` with 404 not found and cancellation details exposure.

**Independent Test**: Create a payment record in DB and verify `GET /api/payments/:id` returns it; unknown id returns 404.

### Tests for User Story 2 (REQUIRED for critical logic) ⚠️

- [ ] T046 [P] [US2] Write failing unit tests for payment fetch 200/404 in `tests/unit/payments-get.controller.test.ts` (Red DoD: tests fail)
- [ ] T047 [P] [US2] Write failing unit tests for cancellation_details mapping in `tests/unit/payments-get.cancellation-details.test.ts` (Red DoD: tests fail)

### Implementation for User Story 2

- [ ] T048 [P] [US2] Extend `PaymentRepository` with `findById` in `src/repositories/payment.repository.ts` (DoD: returns null when missing)
- [ ] T049 [US2] Implement `PaymentsService.getPaymentById` in `src/services/payment.service.ts` (Green DoD: T046 passes)
- [ ] T050 [US2] Implement controller `getPayment` in `src/controllers/payments.controller.ts` (Green DoD: returns 200/404; includes both ids)
- [ ] T051 [US2] Wire route `GET /api/payments/:id` in `src/routes/payments.ts` (DoD: returns 429 when limited)
- [ ] T052 [US2] Refactor payment fetch flow and response mapping (Refactor DoD: tests still pass)

**Checkpoint**: User Stories 1 and 2 both work independently (create + fetch)

---

## Phase 5: User Story 3 - Process YooKassa webhooks safely and idempotently (Priority: P3)

**Goal**: Implement secure webhook endpoint with IP allowlist, payload validation, GET verification, restore missing payments, and idempotent status transitions (no rollback).

**Independent Test**: POST webhook payload with `object.id` and verify handler performs GET verification, updates status idempotently, returns correct HTTP code.

### Tests for User Story 3 (REQUIRED for critical logic) ⚠️

- [ ] T053 [P] [US3] Write failing unit tests for IP allowlist behavior (403) in `tests/unit/webhook.ip-allowlist.test.ts` (Red DoD: tests fail)
- [ ] T054 [P] [US3] Write failing unit tests for missing paymentId payload (400) in `tests/unit/webhook.payload-validation.test.ts` (Red DoD: tests fail)
- [ ] T055 [P] [US3] Write failing unit tests for fake webhook ignored (200) on YooKassa 404/status mismatch in `tests/unit/webhook.verification-ignored.test.ts` (Red DoD: tests fail)
- [ ] T056 [P] [US3] Write failing unit tests for webhook-before-POST restore in `tests/unit/webhook.restore-missing-payment.test.ts` (Red DoD: tests fail)
- [ ] T057 [P] [US3] Write failing unit tests for idempotent status update + final-state immutability in `tests/unit/webhook.status-update.test.ts` (Red DoD: tests fail)

### Implementation for User Story 3

- [ ] T058 [P] [US3] Implement YooKassa IP ranges list (IPv4 CIDR + IPv6) in `src/middlewares/webhook-ip-allowlist.ts` (DoD: matches `.context/draft.md §7.2` list)
- [ ] T059 [US3] Implement client IP extraction with trusted-proxy mode in `src/middlewares/webhook-client-ip.ts` (DoD: honors forwarded headers only when configured)
- [ ] T060 [US3] Implement webhook payload validation (require `object.id`) in `src/middlewares/webhook-payload.ts` (Green DoD: T054 passes)
- [ ] T061 [US3] Implement `YookassaService.getPayment` in `src/services/yookassa.service.ts` (DoD: typed response; logged with correlationId)
- [ ] T062 [US3] Implement webhook handler orchestration in `src/services/webhook.service.ts` (DoD: verify → restore if missing → update status)
- [ ] T063 [US3] Implement restore-from-YooKassa logic in `src/services/webhook.service.ts` (Green DoD: T056 passes; handles unique conflict by re-read)
- [ ] T064 [US3] Implement status update using `PaymentStateMachine` in `src/services/payment.service.ts` (Green DoD: T057 passes)
- [ ] T065 [US3] Implement webhook controller in `src/controllers/webhooks.controller.ts` (DoD: returns 200/400/403/500 per spec)
- [ ] T066 [US3] Wire route `POST /api/webhooks/yookassa` in `src/routes/webhooks.ts` (DoD: webhook is NOT rate-limited; middleware order: correlation → ip allowlist → payload → controller)
- [ ] T067 [US3] Refactor webhook pipeline (separate decision points, better logs) (Refactor DoD: tests still pass)

**Checkpoint**: All webhooks scenarios covered: duplicates/out-of-order safe, restore supported, response codes correct

---

## Phase 6: User Story 4 - Handle transient failures (timeouts/5xx) without creating duplicates (Priority: P3)

**Goal**: Ensure unknown-outcome failures on create-payment return `503` with retryable envelope and “same key” guidance; ensure retries are bounded and safe.

**Independent Test**: Simulate YooKassa timeout/5xx on create-payment and assert `503` response includes `retryable=true` and `sameIdempotenceKey=true`.

### Tests for User Story 4 (REQUIRED for critical logic) ⚠️

- [ ] T068 [P] [US4] Write failing unit tests for 503 retryable envelope on YooKassa timeout in `tests/unit/payments-create.timeout-503.test.ts` (Red DoD: tests fail)
- [ ] T069 [P] [US4] Write failing unit tests for 503 retryable envelope on YooKassa 5xx in `tests/unit/payments-create.5xx-503.test.ts` (Red DoD: tests fail)

### Implementation for User Story 4

- [ ] T070 [US4] Implement domain error types for retryable upstream failures in `src/types/errors.ts` (DoD: code + flags map to spec)
- [ ] T071 [US4] Map upstream timeout/5xx into 503 envelope in `src/middlewares/error-handler.ts` (Green DoD: T068–T069 pass)
- [ ] T072 [US4] Refactor error mapping (avoid duplication, keep envelope consistent) (Refactor DoD: tests still pass)

**Checkpoint**: Transient failure UX is deterministic; retry guidance is explicit and safe

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T073 [P] Add/verify OpenAPI is aligned with implemented controllers in `specs/001-yookassa-payment-flow/contracts/openapi.yaml` (DoD: endpoints/headers/status codes match)
- [ ] T074 Ensure all logs include `correlationId` across controllers/services in `src/` (DoD: spot-check + unit test if needed)
- [ ] T075 Add graceful shutdown (server + Prisma + Redis) in `src/app.ts` (DoD: SIGTERM closes resources)
- [ ] T076 Run quickstart steps and update `specs/001-yookassa-payment-flow/quickstart.md` if commands differ (DoD: instructions are accurate)
- [ ] T077 Refactor codebase for consistency (naming, folder boundaries) (DoD: tests green, lint green)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependencies
- **User Story 2 (P2)**: Depends on US1 persistence primitives (PaymentRepository)
- **User Story 3 (P3)**: Depends on US1 YooKassa client + PaymentStateMachine + repositories
- **User Story 4 (P3)**: Depends on US1 create-payment path + error-handler mapping

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD: Red → Green → Refactor)
- Repositories/utilities before services
- Services before controllers/routes
- Story checkpoint must be reached before proceeding

### Parallel Opportunities

- Tasks marked [P] can be implemented in parallel (different files)
- Tests for the same story marked [P] can be written in parallel

---

## Parallel Example: User Story 1

```bash
Task: "T026 Write failing unit tests for idempotency cache hit/miss/conflict in tests/unit/idempotency-service.test.ts"
Task: "T027 Write failing unit tests for create-payment controller status codes in tests/unit/payments-create.controller.test.ts"
Task: "T028 Write failing unit tests for 404 user-not-found in tests/unit/payments-create.user-not-found.test.ts"
Task: "T029 Write failing unit tests for 409 idempotency hash mismatch in tests/unit/payments-create.idempotency-conflict.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. STOP and validate: idempotency + 201/200 + YooKassa create (mocked) works end-to-end

### Incremental Delivery

1. Add User Story 2 (GET payment)
2. Add User Story 3 (webhooks)
3. Add User Story 4 (transient failure contracts)
4. Polish


