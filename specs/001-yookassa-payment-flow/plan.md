# Implementation Plan: YooKassa Payment Flow (Create • Status • Webhooks)

**Branch**: `001-yookassa-payment-flow` | **Date**: 2026-01-29 | **Spec**: `specs/001-yookassa-payment-flow/spec.md`  
**Input**: Feature specification from `specs/001-yookassa-payment-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement the core YooKassa payment cycle for a backend-only demo service:

- `POST /api/payments`: create a one-stage payment (capture: true) and return redirect URL.
- `GET /api/payments/:id`: fetch payment status/details by internal id (also return `yookassa_payment_id`).
- `POST /api/webhooks/yookassa`: securely process YooKassa notifications with IP allowlist + GET verification,
  support duplicates/out-of-order delivery, and restore missing payments (webhook-before-POST).

Non-negotiables (from constitution/spec):
- Idempotency via Redis (24h TTL) + deterministic request-hash conflict protection.
- YooKassa API GET is the source of truth (webhook payload is never authoritative).
- Strict payment state machine: `pending → succeeded|canceled`, final statuses immutable.
- Structured logging (Pino) with `correlationId` across inbound/outbound/webhooks.
- Retry-safe upstream client (Axios) with bounded retries only for GET and idempotent POST.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 20+  
**Primary Dependencies**: Express.js, Prisma, PostgreSQL, Redis, Axios, Zod, Pino, express-rate-limit + rate-limit-redis  
**Storage**: PostgreSQL 15+ (primary), Redis 7+ (idempotency + rate limiting)  
**Testing**: Jest + ts-jest, axios-mock-adapter (no real HTTP to YooKassa)  
**Target Platform**: Linux server (Docker Compose for local)  
**Project Type**: Single backend service (no frontend)  
**Performance Goals**: Non-upstream work p95 < 200ms; upstream-dependent endpoints bounded by 35s timeout  
**Constraints**: One-stage payments only; no refunds; no admin list; no auth; webhook must not be rate-limited  
**Scale/Scope**: MVP for demo; must be safe under retries, duplicates, and concurrency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **GATE 1 (Source of truth)**: Webhook processing MUST use YooKassa `GET /payments/{id}` before DB mutation.
- **GATE 2 (Idempotency)**: `POST /api/payments` MUST require UUID v4 `Idempotence-Key`, use Redis (TTL=24h),
  and enforce request-hash conflict → `409`.
- **GATE 3 (Retry-safe)**: Transient unknown-outcome errors MUST return `503` with `retryable=true` and
  `sameIdempotenceKey=true` (client retries with the same key).
- **GATE 4 (State machine)**: Only `pending → succeeded|canceled`; final statuses immutable; idempotent updates.
- **GATE 5 (Webhook security)**: IP allowlist MUST be enforced; forwarded headers trusted only when configured;
  payload must include `object.id`; response code strategy per spec.
- **GATE 6 (Persistence safety)**: `yookassa_payment_id` UNIQUE; webhook-before-POST restoration is supported.
- **GATE 7 (Observability)**: Pino structured logs + `correlationId` everywhere; log outbound YooKassa and full webhook.
- **GATE 8 (Rate limiting)**: API endpoints limited; create-payment stricter; webhook MUST NOT be limited.
- **GATE 9 (Fail-fast config)**: validate required env vars at startup; secrets not in repo.
- **GATE 10 (Testing discipline)**: Unit tests REQUIRED for: idempotency, retry client logic, state machine,
  webhook validator & decisioning.

## Project Structure

### Documentation (this feature)

```text
specs/001-yookassa-payment-flow/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── models/
├── services/
├── repositories/
├── controllers/
├── middlewares/
├── config/
├── routes/
├── types/
└── utils/

tests/
└── unit/
```

**Structure Decision**: Single backend project at repo root. Folder layout matches `.context/draft.md §6.2`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Phase 0: Research (completed)

Output: `specs/001-yookassa-payment-flow/research.md`

No unresolved “NEEDS CLARIFICATION” items remain.

## Phase 1: Design & Contracts (completed)

Outputs:
- `specs/001-yookassa-payment-flow/data-model.md`
- `specs/001-yookassa-payment-flow/contracts/openapi.yaml`
- `specs/001-yookassa-payment-flow/quickstart.md`

## Phase 2: Implementation Plan (step-by-step)

### 2.1 Infrastructure & Project Bootstrap

- Initialize Node.js + TypeScript (strict) project scaffolding.
- Add lint/format baseline (ESLint + Prettier) and enforce “no warnings”.
- Add Docker Compose for PostgreSQL + Redis (per `.context/draft.md §6.3`).
- Add environment validation (Zod schema) and fail-fast startup.
- Add Prisma:
  - configure datasource with `DATABASE_URL`
  - create initial migration for `users` and `payments` (per `.context/draft.md §5`)
  - add seeds for 2–3 users only.

### 2.2 Core Domain: State Machine + Models

- Implement `PaymentStateMachine`:
  - allowed transitions: `pending → succeeded|canceled`
  - idempotent no-op for same status
  - final status immutability
- Define domain types for `PaymentStatus`, cancellation details, and metadata.

### 2.3 Redis: Idempotency Layer (create-payment)

- Middleware: validate `Idempotence-Key` header (UUID v4) and attach to request context.
- Compute deterministic request hash (stable stringify + sha256).
- Redis read:
  - if key exists:
    - if hash mismatch → return `409 Conflict`
    - else return cached payment response with `200 OK`
- Redis miss path:
  - verify `userId` exists → else `404 Not Found` (no YooKassa call)
  - call YooKassa create payment (capture: true, redirect confirmation) with `Idempotence-Key`
  - persist payment in DB (handle unique conflict on `yookassa_payment_id`)
  - cache `{ payment, requestHash }` with TTL=24h
  - return `201 Created`
- Failure handling:
  - unknown-outcome timeout/5xx → return `503` retryable envelope (retry with same key).

### 2.4 YooKassa Integration: Axios Client + Retry Interceptor

- Configure Axios client:
  - baseURL `https://api.yookassa.ru/v3`
  - basic auth with `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY`
  - timeout 35s
- Implement a single response interceptor:
  - retry on network errors + 5xx
  - max 2 retries with exponential backoff
  - retry only for GET and POST with `Idempotence-Key`
  - never retry 4xx
- Log outbound request/response with `correlationId` (redact secrets).

### 2.5 API Endpoints (Controllers + Routes)

- `POST /api/payments`:
  - request validation with Zod (`userId`, `amount`, `returnUrl`, `description`, `metadata`)
  - inject `metadata.userId` for YooKassa call if missing
  - idempotency + rate limit + create payment flow
  - response includes both `id` and `yookassa_payment_id`
  - 201 vs 200 behavior per spec
- `GET /api/payments/:id`:
  - treat `:id` as internal id only
  - 404 if not found
  - include cancellation_details for canceled payments; optional best-effort message
- Global middlewares:
  - correlation id generation (`X-Correlation-Id` reuse)
  - structured logging middleware
  - error handler mapping domain errors to HTTP envelopes.

### 2.6 Webhooks: Security + Verification + Restoration

- Webhook endpoint MUST NOT be rate-limited.
- IP allowlist middleware:
  - supports trusted proxy mode (explicit config) vs direct IP
  - reject non-allowlisted IP with 403
- Payload validation:
  - require `object.id` (paymentId) → else 400
- GET verification:
  - call YooKassa `GET /payments/{id}`
  - ignore fake/suspicious (404, status mismatch) with 200
- Restoration:
  - if local payment missing, create it from verified YooKassa data (metadata.userId is required)
  - handle unique conflicts on `yookassa_payment_id` (race-safe)
- Status update:
  - apply state machine rules; final statuses immutable; idempotent updates
- Response code policy per spec (200/400/403/500).

### 2.7 Rate Limiting (Redis-backed)

- Configure general limiter: 100 req / 15 min / IP for API endpoints.
- Configure payment limiter: 10 req / 60 min / (IP + userId) for `POST /api/payments`.
- Return `429` with JSON envelope when limited.

### 2.8 Tests (Unit tests required)

- `YookassaService`:
  - create payment call uses `Idempotence-Key`
  - retries on network/5xx with bounded attempts
  - timeout mapping to retryable 503 envelope (via higher-level service/controller)
- `PaymentStateMachine`:
  - allowed transitions
  - reject/ignore final state modifications
  - idempotent no-op transitions
- Idempotency service:
  - cache hit same hash → 200 returns same payment
  - cache hit hash mismatch → 409
- Webhook processing decisioning:
  - non-allowlisted IP → 403
  - missing paymentId → 400
  - fake (404/status mismatch) → 200 ignored

### 2.9 Re-check Constitution Gates

- Re-run the Constitution Check section and ensure no violations remain.
