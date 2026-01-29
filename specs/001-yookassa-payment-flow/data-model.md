# Data Model: YooKassa Payment Flow (Create • Status • Webhooks)

**Feature**: `001-yookassa-payment-flow`  
**Date**: 2026-01-29  
**Sources**: `spec.md`, `.context/draft.md §5`, `.specify/memory/constitution.md`

## Entities

### User
Minimal user entity used to associate payments.

- **Primary key**: `id` (UUID)
- **Unique**: `email`
- **Fields**: `id`, `email`, `name`, `created_at`, `updated_at`

### Payment
Represents one payment attempt in the system, backed by a YooKassa payment.

- **Primary key**: `id` (UUID)
- **Unique**: `yookassa_payment_id` (string)
- **Foreign key**: `user_id → users.id`

#### Financials
- `amount` (decimal(10,2))
- `currency` (string, `"RUB"` expected)

#### Status and lifecycle
- `status`: `"pending" | "succeeded" | "canceled"`
- `paid`: boolean
- **Finality**: `succeeded` and `canceled` are final (MUST NOT change).

#### Confirmation / UX linkage
- `confirmation_url` (string, redirect URL)
- `confirmation_type` (string)

#### Cancellation details (failed payments)
- `cancellation_party` (string)
- `cancellation_reason` (string)
- `canceled_at` (timestamp)

#### Misc
- `payment_method_type` (string)
- `description` (text)
- `metadata` (JSONB) — includes SaaS info (`plan_type`, `billing_period`) and MUST include `userId` for restoration
- timestamps: `created_at`, `updated_at`, `captured_at`

### Idempotency Key Record (ephemeral, Redis)
Temporary record keyed by `Idempotence-Key` for 24 hours.

- **Key**: `idempotency:<uuid-v4>`
- **Value**: JSON containing:
  - `requestHash` (sha256 of stable JSON)
  - `payment` (cached response payload; includes internal id + yookassa_payment_id)
- **TTL**: 24h (single constant).

## Relationships

- `User (1) → (N) Payment`

## State Machine

Allowed transitions:
- `pending → succeeded`
- `pending → canceled`

Disallowed transitions:
- `succeeded → *`
- `canceled → *`

Idempotent transitions:
- `X → X` is a no-op.

## Indexing & Constraints (required)

- `payments.yookassa_payment_id` UNIQUE
- Indexes:
  - `users.email`
  - `payments.user_id`
  - `payments.status`
  - `payments.yookassa_payment_id`

## Prisma Mapping Notes (for implementation)

- `users` table:
  - `id` UUID default `gen_random_uuid()` (via Postgres extension / Prisma default)
- `payments` table:
  - keep `amount` as decimal
  - represent JSONB as `Json` in Prisma
  - timestamps in UTC (`timestamptz`)


