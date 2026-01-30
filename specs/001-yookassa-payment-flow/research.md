# Research: YooKassa Payment Flow (Create • Status • Webhooks)

**Feature**: `001-yookassa-payment-flow`  
**Date**: 2026-01-29  
**Sources of truth**: `.specify/memory/constitution.md` (highest), `spec.md`, `.context/draft.md`

## Decisions

### Decision: One-stage payments only (`capture: true`)
- **Chosen**: Use one-stage payments only (`capture: true`).
- **Rationale**: Matches scope and simplifies state machine to `pending → succeeded|canceled`.
- **Alternatives considered**: Two-stage capture (out of scope; adds complexity and new finalization paths).

### Decision: Idempotency enforcement (Redis + 24h TTL + request-hash conflict)
- **Chosen**: Enforce idempotency for `POST /api/payments` using `Idempotence-Key` (UUID v4), Redis TTL = 24h,
  and deterministic request body hash to detect key reuse with different payload.
- **Rationale**: Prevents duplicates under retries/double-clicks and preserves integrity under unknown-outcome
  failures (timeouts/5xx).
- **Alternatives considered**:
  - Storing idempotency keys in PostgreSQL (rejected: slower; no native TTL; extra cleanup complexity).
  - Relying only on YooKassa idempotency (rejected: does not protect against client-side key reuse with different body).

### Decision: Retry-safe upstream errors contract for create-payment
- **Chosen**: For unknown-outcome transient failures (YooKassa 5xx / timeout) return `503` with JSON
  `error.retryable=true` and `error.sameIdempotenceKey=true`.
- **Rationale**: Makes client behavior explicit and safe: retry MUST reuse the same idempotency key.
- **Alternatives considered**: Generic 500 (too ambiguous), 502/504 split (not necessary for MVP; 503 is sufficient).

### Decision: Webhook security & source of truth
- **Chosen**:
  - IP allowlist (reject non-YooKassa IP with 403),
  - validate payload has `object.id` (otherwise 400),
  - perform YooKassa `GET /payments/{id}` verification before any DB mutation,
  - treat webhook payload as input-only (never authoritative state),
  - idempotent updates + no rollback from final states.
- **Rationale**: Prevents fake webhooks, out-of-order updates, and duplicate delivery issues.
- **Alternatives considered**: Trust webhook payload status (rejected: security and correctness risk).

### Decision: Webhook HTTP response strategy
- **Chosen**:
  - 403 for non-allowed IP
  - 400 for malformed payload (missing paymentId)
  - 200 for ignored fake/status mismatch/404/duplicates/restored/success
  - 500 for real internal processing failures where retry is desired
- **Rationale**: Minimizes unnecessary YooKassa retries and reduces attacker signal after allowlist check.

### Decision: Rate limiting policy
- **Chosen**:
  - general API: 100 req / 15 min / IP
  - create-payment: 10 req / 60 min / (IP + userId)
  - webhook: no rate limiting
- **Rationale**: Protects public endpoints from abuse while not blocking webhook delivery.

### Decision: Logging/observability
- **Chosen**: Pino structured JSON logs with required `correlationId` (reuse `X-Correlation-Id` or generate),
  log outbound YooKassa calls (request/response), inbound webhooks (full body), transitions, and errors.
- **Rationale**: Payments require incident-grade traceability.

### Decision: Data model & constraints
- **Chosen**: PostgreSQL with Prisma migrations; `payments.yookassa_payment_id` unique; store cancellation party/reason;
  store SaaS metadata in JSONB.
- **Rationale**: Minimal schema meets scope while preserving audit/debug signals.

## Notes / Open Questions

No blocking open questions remain after `spec.md` clarify passes.


