<!--
Sync Impact Report

- Version change: (unversioned template) → 1.0.0
- Modified principles: N/A (template placeholders replaced with finalized principles)
- Added sections:
  - Constraints & Security Boundaries (Non‑Negotiable)
  - Development Workflow & Quality Gates
- Removed sections: N/A
- Templates requiring updates:
  - ✅ .specify/templates/tasks-template.md (tests policy aligned to constitution)
  - ✅ .specify/templates/plan-template.md (no change required)
  - ✅ .specify/templates/spec-template.md (no change required)
  - ✅ .specify/templates/checklist-template.md (no change required)
  - ✅ .specify/templates/agent-file-template.md (no change required)
  - ⚠ N/A: .specify/templates/commands/*.md (directory not present in this repo)
- Deferred TODOs: none
-->

# YooKassa Payment Backend (Demo) Constitution

## Core Principles

### I. YooKassa API is the Source of Truth (Webhook is an Input, not Authority)
All payment state and fields that affect business decisions MUST be derived from the
YooKassa API (`GET /v3/payments/{payment_id}`), not from the webhook payload.

- Webhook payload MUST NOT be trusted as final state. It MAY be used only to extract
  `payment_id` and to decide which payment to verify.
- Webhook handling MUST perform GET verification before any DB state mutation.
- Out-of-order webhooks MUST NOT be able to roll back state: the system MUST apply
  the status returned by GET verification, and status updates MUST be idempotent.

### II. Idempotency is REQUIRED for Payment Creation (Client Key + Redis TTL + Body Hash)
`POST /api/payments` MUST be idempotent to protect against retries/double-clicks and
unknown-outcome failures (timeouts/5xx).

- `Idempotence-Key` header is REQUIRED and MUST be a UUID v4.
- Idempotency key state MUST be stored in Redis (NOT PostgreSQL) with TTL exactly
  24 hours (as per YooKassa idempotency window).
- The service MUST compute a deterministic hash of the request body (e.g. stable JSON
  stringify + SHA-256) and MUST return `409 Conflict` if the same key is reused with a
  different body.
- The service MUST rely on YooKassa idempotency for unknown-outcome errors: on 500/timeout
  where a payment ID is unknown, the client MUST be instructed to retry with the SAME key.

### III. Webhook Security is Multi-Layered and Non-Negotiable
Incoming webhook requests MUST be treated as hostile by default.

- The webhook endpoint MUST implement an IP allowlist for YooKassa source ranges.
- If the request IP is not allowed, the service MUST return `403 Forbidden`.
- The webhook handler MUST validate payload shape (at minimum: `object.id`).
- If `payment_id` is missing, the service MUST return `400 Bad Request`.
- After passing IP + shape checks, the handler MUST perform GET verification to confirm:
  - the payment exists in YooKassa; and
  - the status matches (or otherwise treat as invalid input).
- For invalid/fake webhooks (after IP allowlist), the service SHOULD return `200 OK`
  with an “ignored” response to avoid repeated retries and to reduce signal to attackers.

### IV. Payment State Machine is Enforced (Final States MUST NOT Change)
The domain model MUST enforce a strict state machine for one-stage payments (`capture: true`).

- Allowed transitions MUST be explicitly defined; for MVP:
  - `pending` → `succeeded`
  - `pending` → `canceled`
- Final statuses (`succeeded`, `canceled`) MUST be treated as immutable.
- Duplicate webhooks MUST be safe: if the current status equals the new status, the update
  MUST be a no-op (idempotent).
- Attempts to change a final status MUST be ignored (or rejected) and MUST be logged.

### V. Persistence Must Be Race-Safe (DB Constraints + Transactional Updates)
The system MUST be safe under concurrency and repeated delivery.

- `yookassa_payment_id` MUST be UNIQUE in the database.
- “Webhook arrived before POST” MUST be supported: webhook handling MUST be able to
  restore a missing payment record using data from GET verification.
- Restoration MUST be race-safe: on unique-constraint conflict, the handler MUST read
  the existing record and continue idempotently.

### VI. Observability is Required (Structured Logs + Correlation ID)
The service MUST be debuggable end-to-end for payment incidents.

- Logs MUST be structured JSON (Pino).
- Every inbound HTTP request MUST have a `correlationId`:
  - If `X-Correlation-Id` is provided, reuse it; otherwise generate one.
- `correlationId` MUST be present in all logs for:
  - inbound API requests,
  - outbound requests to YooKassa (request/response),
  - inbound webhooks (full payload),
  - payment status transitions,
  - errors (with stack trace).

### VII. External Calls Must Be Bounded and Retry-Safe
The YooKassa HTTP client MUST be configured to fail predictably and retry safely.

- Timeouts MUST be set (recommended 35s as the service-side ceiling).
- Automatic retries MUST be implemented only for:
  - GET requests, and
  - POST requests that include `Idempotence-Key`.
- Retry policy MUST use exponential backoff and a small bounded number of attempts.
- 4xx responses MUST NOT be retried.

### VIII. Fail-Fast Configuration is Required
The service MUST validate required environment configuration at startup and MUST refuse
to start if configuration is missing/invalid.

- `DATABASE_URL`, `REDIS_URL`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` are REQUIRED.
- Secrets MUST NOT be committed to the repository.

### IX. Dependencies Must Be Explicitly Initialized (Constructor Injection)
Services and repositories MUST use constructor injection to ensure explicit dependency initialization and improve testability.

- Services MUST NOT use static methods with lazy initialization (Service Locator pattern).
- External dependencies (databases, caches, message queues, etc.) MUST be explicitly connected/initialized BEFORE creating repositories and services that depend on them.
- All dependencies MUST be visible in the application entry point (`app.ts` or equivalent).
- Services MUST accept dependencies through constructors, not through static getters or global state.
- This principle ensures:
  - Fail-fast behavior: connection errors are caught at startup, not during first request.
  - Testability: dependencies can be easily mocked by passing test doubles through constructors.
  - Explicit lifecycle: the order of initialization is clear and controlled.

## Constraints & Security Boundaries (Non‑Negotiable)

- **Backend-only**: No frontend is part of this project scope.
- **One-stage payments only**: `capture: true` is REQUIRED; two-stage capture flows are out of scope.
- **Idempotency TTL**: The idempotency window is exactly 24 hours; code and docs MUST reference a
  single constant for this value.
- **Rate limiting**:
  - API endpoints MUST be protected by rate limiting backed by Redis.
  - Webhook endpoint MUST NOT use rate limiting (429 would trigger YooKassa retries and may
    stall payment processing).
- **Database model**:
  - The database MUST include `users` and `payments` tables (minimal scope).
  - `payments` MUST include cancellation details (`cancellation_party`, `cancellation_reason`)
    to support failed-payment analysis.
- **Data integrity**: SQL injection protection is REQUIRED (ORM/prepared statements only).

## Development Workflow & Quality Gates

- **TypeScript strict** is REQUIRED; `any` MUST NOT be introduced for core domain logic.
- **Input validation**: All inbound request DTOs MUST be validated (Zod) before business logic.
- **Testing**:
  - Unit tests for critical logic are REQUIRED (non-negotiable):
    - idempotency (Redis TTL + request-hash conflict),
    - YooKassa client error handling/retries,
    - payment state machine,
    - webhook security logic (IP allowlist + GET verification decisioning).
  - Integration tests are NOT REQUIRED for MVP and MUST NOT be added if they would introduce
    heavy infrastructure coupling without explicit scope expansion.
- **Docker Compose** for local development is REQUIRED (PostgreSQL + Redis). App container is optional.
- **Architecture**:
  - Services MUST use constructor injection for dependencies (no static Service Locator pattern).
  - External dependencies (databases, caches, etc.) MUST be established before creating dependent services.
  - Dependencies MUST be explicitly visible in the application entry point.

## Governance

- This constitution is the single highest-priority document for engineering decisions in this repo.
  If another doc conflicts with it, this constitution wins.
- Every PR MUST include a “Constitution Check”:
  - Idempotency requirements upheld (key validation, Redis TTL, body-hash conflict).
  - Webhook security upheld (IP allowlist + GET verification; no rate limiter on webhook).
  - State machine + final-state immutability upheld.
  - Logging/correlation requirements upheld.
  - Schema constraints upheld (unique `yookassa_payment_id`).
- Amendments:
  - Any change to a MUST/MUST NOT/REQUIRED rule MUST include:
    - rationale,
    - migration/rollout plan,
    - updated tests (or explicit justification if tests are not applicable).
- Versioning:
  - MAJOR: breaking change to non-negotiable rules or security posture.
  - MINOR: new non-negotiable rule or new mandatory section.
  - PATCH: clarifications that do not change requirements.

**Version**: 1.0.0 | **Ratified**: 2026-01-29 | **Last Amended**: 2026-01-29
