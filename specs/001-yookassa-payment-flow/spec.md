# Feature Specification: YooKassa Payment Flow (Create • Status • Webhooks)

**Feature Branch**: `001-yookassa-payment-flow`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "Реализация базового цикла оплаты ЮКасса: создание платежа, проверка статуса и обработка вебхуков"

## Clarifications

### Session 2026-01-29

- Q: For `POST /api/payments`, which response contract should we закрепить for retryable transient errors (YooKassa 5xx / timeout where outcome is unknown)? → A: Option A — return HTTP 503 with JSON `{ error: { code: "YOOKASSA_UNAVAILABLE" | "YOOKASSA_TIMEOUT", message, retryable: true, sameIdempotenceKey: true } }`.
- Q: Which webhook HTTP response strategy should we закрепить for `POST /api/webhooks/yookassa`? → A: Option B — 403 for non-allowed IP, 400 for missing paymentId, 200 for ignored (fake/status mismatch/404/duplicates/restored), 500 only for real internal errors.
- Q: Which rate-limiting policy should we закрепить for this feature? → A: Option A — API: 100 req / 15 min / IP; create-payment: 10 payments / hour / (IP + userId); no rate limiting on webhooks.
- Q: Which request body schema should we закрепить for `POST /api/payments`? → A: Option A — `amount` object `{ value, currency }`, `userId` + `returnUrl` required, `description` optional, `metadata` optional but if present MUST include `userId`.
- Q: For canceled payments, what should `GET /api/payments/:id` return regarding cancellation reason/message? → A: Option B — return `cancellation_details` (party, reason) always; `cancellation_message` optional/best-effort with safe default.
- Q: Which success status code policy should we закрепить for `POST /api/payments` (first create vs idempotent replay)? → A: Option A — 201 when created; 200 when returned from idempotency cache; response body schema identical.
- Q: What should be the identifier policy for API responses and `GET /api/payments/:id`? → A: Option B — return both `id` and `yookassa_payment_id` in responses; `GET /api/payments/:id` uses internal `id` only.
- Q: How should we определить the client IP for webhook IP allowlisting (direct vs behind proxy)? → A: Option B — only trust proxy/forwarded headers when explicitly configured; otherwise use direct connection IP.
- Q: What should `POST /api/payments` do when `userId` is not found? → A: Option A — return 404 Not Found.
- Q: What should `GET /api/payments/:id` return when the payment is not found? → A: Option A — return 404 Not Found.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Initiate payment and redirect user to checkout (Priority: P1)

As a client application, I want to initiate a payment for a specific user and receive a
checkout URL so the user can complete payment on YooKassa.

**Why this priority**: This is the entry point of the whole payment flow; without it no
payments can be made.

**Independent Test**: Call `POST /api/payments` with a valid userId, amount, returnUrl,
metadata and a valid `Idempotence-Key` and verify the response contains a payment identifier
and a redirect/confirmation URL.

**Acceptance Scenarios**:

1. **Given** an existing user and a valid payment request, **When** the client calls
   `POST /api/payments` with a UUID v4 `Idempotence-Key`, **Then** the system creates a
   payment in YooKassa (one-stage capture) and returns a confirmation URL and the created
   payment record in status `pending`.
2. **Given** a previously successful `POST /api/payments` request, **When** the client repeats
   the same request with the same `Idempotence-Key` and the same body, **Then** the system
   returns the same payment (no duplicates) and does not create a new payment in YooKassa.

---

### User Story 2 - Track payment status via API (Priority: P2)

As a client application, I want to query the status of a payment at any time to show the
current outcome to the user (pending / succeeded / canceled) including cancellation details.

**Why this priority**: Status visibility is required for UX and support; it also enables
safe client-side retries when payment creation outcome is unknown.

**Independent Test**: Call `GET /api/payments/:id` for an existing payment and verify it
returns stable status and the stored metadata/cancellation details when present.

**Acceptance Scenarios**:

1. **Given** a payment exists, **When** the client calls `GET /api/payments/:id`, **Then**
   the system returns its current status and key fields (amount, currency, metadata, timestamps).
2. **Given** a payment is canceled with a known reason (e.g., “insufficient_funds”),
   **When** the client calls `GET /api/payments/:id`, **Then** the system returns the cancellation
   party and reason (and, if available, user-facing cancellation message fields).

---

### User Story 3 - Process YooKassa webhooks safely and idempotently (Priority: P3)

As the payment system, I want to process YooKassa webhook notifications so that payment
statuses are updated reliably, securely, and are safe under duplicates/out-of-order delivery.

**Why this priority**: Webhooks are the primary mechanism to learn the final outcome. They must
not create security holes, incorrect state, or data loss.

**Independent Test**: Post a webhook payload to `POST /api/webhooks/yookassa` for a known payment
and verify that the stored payment status matches YooKassa GET verification, even under duplicates.

**Acceptance Scenarios**:

1. **Given** YooKassa sends `payment.succeeded`, **When** the system receives a webhook and verifies
   the payment via YooKassa API, **Then** the payment is transitioned to `succeeded` and never changes
   again (final state).
2. **Given** YooKassa sends duplicate notifications for the same payment, **When** the system receives
   the same webhook multiple times, **Then** processing is idempotent and results in a single final
   state (no repeated side effects).
3. **Given** webhooks arrive out of order (e.g., older “pending” after “succeeded”), **When** the system
   receives them, **Then** the stored status remains consistent with YooKassa GET verification and MUST
   NOT roll back to a non-final/older state.
4. **Given** a valid webhook arrives before the payment record is stored locally, **When** the system
   verifies the payment in YooKassa, **Then** it restores/creates the missing local payment record and
   applies the verified status.

---

### User Story 4 - Handle transient failures (timeouts/5xx) without creating duplicates (Priority: P3)

As a client application, I want clear, safe retry guidance when YooKassa or the network is unstable,
so that retries do not create duplicate payments or lose track of the outcome.

**Why this priority**: Transient errors are common in payments; unsafe retry patterns create duplicates
and support incidents.

**Independent Test**: Simulate a transient failure during payment initiation and verify the response
instructs the client to retry using the SAME idempotency key.

**Acceptance Scenarios**:

1. **Given** a payment initiation request and a transient YooKassa 5xx error, **When** the system cannot
   determine whether the payment was created, **Then** it responds with a retryable error and explicitly
   instructs the client to retry with the SAME `Idempotence-Key`.
2. **Given** a payment initiation request and a timeout, **When** the system cannot determine whether the
   payment was created, **Then** it responds with a retryable error and explicitly instructs the client to
   retry with the SAME `Idempotence-Key`.

### Edge Cases

- What happens when `Idempotence-Key` is missing or not UUID v4?
- What happens when the same `Idempotence-Key` is reused with a different request body?
- What happens when two identical create-payment requests arrive concurrently?
- What happens when YooKassa returns 500 and the system has no payment ID in response?
- What happens when YooKassa times out or the network fails during create-payment?
- What happens when webhook delivery is duplicated (at-least-once delivery)?
- What happens when webhooks arrive out of order?
- What happens when webhook arrives before local payment persistence?
- What happens when webhook payload is malformed (missing payment ID)?
- What happens when webhook comes from a non-YooKassa IP?
- What happens when cancellation has a reason (e.g., insufficient funds, expired confirmation)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Scope)**: The system MUST expose exactly these payment flow endpoints:
  - `POST /api/payments` (initiate payment)
  - `GET /api/payments/:id` (fetch payment by internal ID)
  - `POST /api/webhooks/yookassa` (receive YooKassa notifications)
- **FR-002 (Out of scope)**: The system MUST NOT implement:
  - payment listing (`GET /payments`) for admin purposes,
  - refunds (`POST /refunds`),
  - frontend UI,
  - user authorization/authentication flows (users are assumed to exist via seeds),
  - admin panel.
- **FR-003 (One-stage payments)**: The system MUST initiate payments in one-stage mode (capture immediately).
- **FR-004 (Idempotency input contract)**: `POST /api/payments` MUST require `Idempotence-Key` header and
  MUST reject requests without it or with a non-UUID v4 value.
- **FR-005 (Idempotency conflict protection)**: If the same `Idempotence-Key` is reused with a different
  request body, the system MUST return `409 Conflict`.
- **FR-006 (Idempotency window)**: Idempotency enforcement MUST apply for 24 hours (single configured constant).
- **FR-007 (Retry-safe transient errors)**: For transient errors where the system cannot determine whether a
  payment was created (timeouts / YooKassa 5xx with missing payment identifier), `POST /api/payments` MUST
  return `503 Service Unavailable` with JSON:
  - `error.code`: `YOOKASSA_UNAVAILABLE` (5xx) or `YOOKASSA_TIMEOUT` (timeout)
  - `error.retryable`: `true`
  - `error.sameIdempotenceKey`: `true`
  and MUST instruct the client (via `error.sameIdempotenceKey`) to retry with the SAME `Idempotence-Key`.
- **FR-008 (Payment creation response)**: On successful payment initiation, the system MUST return:
  - internal payment ID,
  - current status (`pending` initially),
  - the redirect/confirmation URL to complete payment,
  - echoed metadata (plan, billing period) for traceability.
- **FR-008a (Create payment success HTTP codes)**: `POST /api/payments` MUST return:
  - `201 Created` when a new payment is created (first request for a given `Idempotence-Key` + body hash)
  - `200 OK` when returning an existing payment from idempotency cache (same `Idempotence-Key` + same body hash)
  and the response body schema MUST be identical in both cases.
- **FR-009 (Payment status API)**: `GET /api/payments/:id` MUST return the stored payment status and key fields,
  including cancellation details when status is `canceled`.
- **FR-009b (Payment not found)**: If `GET /api/payments/:id` references a payment that does not exist, the system MUST
  return `404 Not Found`.
- **FR-009a (Identifier contract)**:
  - Successful responses for payment creation and payment fetch MUST include both identifiers:
    - internal `id` (the canonical identifier for this service)
    - external `yookassa_payment_id` (for correlation/debug and webhook processing)
  - `GET /api/payments/:id` MUST interpret `:id` as the internal payment `id` only (it MUST NOT accept a
    `yookassa_payment_id` in this path parameter).
- **FR-010 (Cancellation details persistence)**: When a payment is canceled, the system MUST persist:
  - cancellation party, and
  - cancellation reason (machine-readable code).
- **FR-010a (Cancellation details API contract)**: For canceled payments, `GET /api/payments/:id` MUST return
  `cancellation_details: { party, reason }`. A user-facing `cancellation_message` field MAY be included on a
  best-effort basis; if included, it MUST have a safe default fallback for unknown reasons.
- **FR-011 (Webhook IP allowlist)**: The webhook endpoint MUST reject requests from non-YooKassa IPs with `403`.
- **FR-011a (Webhook client IP determination)**: Webhook IP allowlisting MUST use the real client IP. If the service
  is behind a proxy/LB (e.g., ngrok/ingress), it MAY derive the client IP from forwarded headers only when the service
  is explicitly configured to trust that proxy. The service MUST NOT blindly trust `X-Forwarded-For` when not configured.
- **FR-012 (Webhook payload validation)**: The webhook endpoint MUST validate the presence of a payment ID;
  missing ID MUST result in `400`.
- **FR-013 (Webhook source of truth)**: The webhook handler MUST verify payment existence and status via YooKassa API
  before mutating local state. Webhook payload MUST NOT be treated as authoritative status.
- **FR-014 (Webhook idempotency)**: Webhook processing MUST be idempotent under duplicates (at-least-once delivery).
- **FR-015 (Out-of-order safety)**: Webhook processing MUST be safe under out-of-order delivery; final status MUST NOT
  roll back to an earlier/non-final state.
- **FR-016 (Webhook-before-POST recovery)**: If a verified webhook is received for a payment that is not yet present
  locally, the system MUST restore/create the local payment record using verified YooKassa data.
- **FR-017 (State machine)**: The system MUST enforce valid status transitions and MUST treat `succeeded` and `canceled`
  as immutable final states.
- **FR-018 (Metadata)**: The system MUST accept and persist payment metadata for SaaS context, at minimum:
  - `plan_type` (e.g., premium),
  - `billing_period` (e.g., monthly),
  and MUST pass this metadata to YooKassa so it is available for webhook-based restoration.
- **FR-019 (Observability)**: The system MUST support a request-scoped `correlationId` (provided or generated) and MUST
  include it in logs for:
  - all inbound API requests,
  - all outbound YooKassa calls (request/response),
  - full inbound webhook body,
  - payment status transitions,
  - all errors (with stack trace).
- **FR-020 (Rate limiting)**: The system MUST apply rate limiting to public API endpoints and MUST NOT apply rate limiting
  to the webhook endpoint.
- **FR-022 (Rate limiting policy)**: Rate limiting MUST be Redis-backed and MUST be configured as:
  - General API limiter (applies to non-webhook endpoints): 100 requests per 15 minutes per IP.
  - Payment creation limiter (applies to `POST /api/payments`): 10 requests per 60 minutes per key `(ip + userId)`.
  - Webhook endpoint: MUST NOT be rate limited.
  - When a request is limited, the system MUST return `429 Too Many Requests` with a JSON error message.
- **FR-023 (Create payment request schema)**: `POST /api/payments` request body MUST be validated as:
  - `userId`: required UUID (existing user)
  - `amount`: required object `{ value, currency }` where:
    - `value` is a decimal string with exactly 2 fractional digits (e.g., `"100.00"`)
    - `currency` is `"RUB"`
  - `returnUrl`: required URL (used for YooKassa redirect confirmation)
  - `description`: optional string (max length MUST NOT exceed YooKassa limits)
  - `metadata`: optional object (string values recommended); if present MUST include `userId`
  Additionally, to support webhook-based restoration, the system MUST ensure `metadata.userId` is
  included in the payload sent to YooKassa (the system MAY inject it even if the client omits metadata).
- **FR-024 (User not found)**: If the `userId` provided to `POST /api/payments` does not exist, the system MUST
  return `404 Not Found` and MUST NOT call YooKassa.
- **FR-021 (Webhook HTTP codes contract)**: `POST /api/webhooks/yookassa` MUST follow this response contract:
  - `403 Forbidden`: request IP is not on YooKassa allowlist
  - `400 Bad Request`: payload missing `object.id` (payment ID)
  - `200 OK`: ignored webhook after allowlist check (e.g., payment not found in YooKassa, status mismatch, YooKassa 404),
    duplicate webhook that produces no state change, or successful processing (including “webhook-before-POST” restore)
  - `500 Internal Server Error`: real internal processing failure (DB/network/etc.) where retry is desired

### Key Entities *(include if feature involves data)*

- **User**: Represents an existing customer in the system (seeded for demo). Attributes: `id`, `email`, `name`.
- **Payment**: Represents a single payment attempt tied to a User. Attributes:
  - identifiers: internal `id`, external `yookassa_payment_id`
  - financials: `amount`, `currency`
  - status: `pending | succeeded | canceled` and `paid` flag
  - confirmation: `confirmation_url` (for redirect)
  - cancellation details: `cancellation_party`, `cancellation_reason`
  - SaaS metadata: `metadata.plan_type`, `metadata.billing_period` (and any additional fields)
  - timestamps: `created_at`, `updated_at`, `captured_at`, `canceled_at`
- **Idempotency Key Record (ephemeral)**: Temporary record keyed by `Idempotence-Key` for 24h containing:
  - request body hash,
  - created payment reference/result (for safe replay).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can initiate a payment and obtain a checkout URL in under 40 seconds in ≥ 99% of attempts
  under normal network conditions.
- **SC-002**: Repeating the same payment initiation request with the same idempotency key results in 0 duplicate
  payments (verified by consistent external payment identifiers).
- **SC-003**: For payments that complete, the local stored status matches YooKassa status after webhook processing
  (no rollbacks of final status) in 100% of tested scenarios.
- **SC-004**: Webhook security checks block 100% of simulated non-YooKassa webhook attempts (non-allowed IPs) and
  reject malformed payloads (missing payment ID) with the defined error behavior.
