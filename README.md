# YooKassa Payment Flow Demo

***[English](README.md)** | [Русский](README.ru.md)*

A demo portfolio project showcasing payment integration with YooKassa payment provider for a SaaS application. This project demonstrates understanding of payment processing challenges and their solutions.

## Overview

This project demonstrates:
- Clean, modern, AI-native backend development following Spec-Driven Development principles
- Full payment flow integration with YooKassa (payment creation, status tracking, webhook processing)
- Identification and resolution of critical payment processing challenges
- Adherence to constitutional principles defined in `.specify/memory/constitution.md`

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Framework**: Express.js
- **ORM**: Prisma with PostgreSQL
- **Cache**: Redis (idempotency keys + rate limiting)
- **HTTP Client**: Axios with retry logic
- **Validation**: Zod (type-safe schema validation)
- **Logging**: Pino (structured JSON logs)
- **Documentation**: OpenAPI/Swagger
- **Testing**: Jest + ts-jest
- **Containerization**: Docker + Docker Compose

## Project Structure

```
src/
├── app.ts                    # Application entry point with explicit dependency initialization
├── config/                   # Configuration (env, database, redis, yookassa)
├── controllers/              # Request handlers as instance classes (PaymentsController, WebhooksController)
├── interfaces/               # Interface definitions for dependency inversion
│   ├── repositories/        # Repository interfaces (IUserRepository, IPaymentRepository)
│   └── services/            # Service interfaces (IPaymentsService, IWebhookService, IIdempotencyService, IYookassaService)
├── middlewares/              # Express middleware (validation, rate limiting, etc.)
├── repositories/             # Data access layer (UserRepository, PaymentRepository) implementing interfaces
├── routes/                   # Route factory functions (createPaymentsRoutes, createWebhooksRoutes)
├── services/                 # Business logic as instance classes (PaymentsService, WebhookService, IdempotencyService, YookassaService)
├── types/                    # TypeScript type definitions
└── utils/                    # Utilities (logger, request hash)

prisma/
├── schema.prisma             # Database schema
└── migrations/               # Database migrations

specs/
├── 001-yookassa-payment-flow/ # Payment flow integration specification
│   ├── spec.md
│   ├── plan.md
│   ├── research.md
│   ├── data-model.md
│   ├── tasks.md
│   ├── quickstart.md
│   └── contracts/
├── 002-di-refactoring/        # Dependency Injection refactoring specification
│   ├── spec.md
│   ├── plan.md
│   ├── research.md
│   ├── tasks.md
│   └── checklists/
└── 003-full-di-interfaces/   # Full DI with interfaces specification
    ├── spec.md
    ├── plan.md
    ├── research.md
    └── tasks.md
```

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn
- YooKassa test credentials (shop ID + secret key)
- ngrok (for webhook testing in development)

## Getting Started

### 1. Environment Setup

Create `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_service"

# Redis
REDIS_URL="redis://localhost:6379"

# YooKassa
YOOKASSA_SHOP_ID="your-shop-id"
YOOKASSA_SECRET_KEY="your-secret-key"
YOOKASSA_BASE_URL="https://api.yookassa.ru/v3"

# Application
PORT=3000
NODE_ENV=development

# Trusted Proxy (set to true if behind reverse proxy)
TRUSTED_PROXY=false
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Dependencies

```bash
docker compose up -d
```

This starts PostgreSQL and Redis containers.

### 4. Run Migrations and Seed

```bash
npx prisma migrate dev
npx prisma db seed
```

The seed script creates 3 test users for development.

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 6. Expose Webhooks with ngrok

For webhook testing, expose the local server:

```bash
ngrok http 3000
```

Configure YooKassa webhook URL in your YooKassa dashboard:
- `https://<ngrok-subdomain>.ngrok.io/api/webhooks/yookassa`

## API Endpoints

### Payments

- `POST /api/payments` - Create payment (idempotent, requires `Idempotence-Key` header)
- `GET /api/payments/:id` - Get payment status by internal ID

### Webhooks

- `POST /api/webhooks/yookassa` - Receive YooKassa webhook notifications (IP allowlist enforced)

### Health

- `GET /health` - Health check endpoint

## Example Requests

### Create Payment

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Idempotence-Key: 11111111-1111-4111-8111-111111111111" \
  -H "X-Correlation-Id: demo-req-001" \
  -d '{
    "userId": "00000000-0000-4000-8000-000000000001",
    "amount": { "value": "100.00", "currency": "RUB" },
    "returnUrl": "https://example.com/payment/result",
    "description": "Premium subscription",
    "metadata": { 
      "plan_type": "premium", 
      "billing_period": "monthly",
      "userId": "00000000-0000-4000-8000-000000000001"
    }
  }'
```

**Response (201 Created for new payment, 200 OK for idempotent replay):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "yookassa_payment_id": "22e12a6f-000f-5000-9000-1a2b3c4d5e6f",
  "status": "pending",
  "amount": "100.00",
  "currency": "RUB",
  "paid": false,
  "confirmation_url": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=...",
  "metadata": { "plan_type": "premium", "billing_period": "monthly", "userId": "..." },
  "created_at": "2026-01-29T12:00:00.000Z",
  "updated_at": "2026-01-29T12:00:00.000Z"
}
```

### Get Payment Status

```bash
curl http://localhost:3000/api/payments/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "yookassa_payment_id": "22e12a6f-000f-5000-9000-1a2b3c4d5e6f",
  "status": "succeeded",
  "amount": "100.00",
  "currency": "RUB",
  "paid": true,
  "confirmation_url": null,
  "metadata": { "plan_type": "premium", "billing_period": "monthly", "userId": "..." },
  "cancellation_details": null,
  "created_at": "2026-01-29T12:00:00.000Z",
  "updated_at": "2026-01-29T12:05:00.000Z",
  "captured_at": "2026-01-29T12:05:00.000Z",
  "canceled_at": null
}
```

### Idempotent Retry (Same Key, Same Body)

Repeat the same request with the same `Idempotence-Key` and same body:
- Expect `200 OK` (idempotency cache hit)
- Same `id` and same `yookassa_payment_id`

## Development

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch
```

**Test Coverage**: 82 passing tests covering:
- Payment state machine transitions
- Idempotency service (Redis caching, hash conflicts)
- Webhook processing (IP allowlist, payload validation, verification, restoration)
- Error handling (timeout/5xx retryable errors)
- YooKassa service integration
- Payment creation and retrieval

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev

# Open Prisma Studio (DB GUI)
npx prisma studio
```

### Linting & Formatting

```bash
# Lint
npm run lint

# Format
npm run format:write
```

## Docker Deployment

Build and run with Docker Compose:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`

## Architecture & Design Patterns

### Layered Architecture
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic orchestration
- **Repositories**: Data access abstraction
- **Middlewares**: Cross-cutting concerns (validation, rate limiting, logging)

### Dependency Injection (Constructor Injection)
- **Full Dependency Inversion**: All dependencies use interfaces, not concrete classes. Services depend on `IUserRepository`, `IPaymentRepository`, `IPaymentsService`, `IWebhookService`, `IIdempotencyService`, `IYookassaService`.
- **Instance-based Services**: All services (`PaymentsService`, `WebhookService`, `IdempotencyService`, `YookassaService`) are instance classes with constructor injection
- **Instance-based Controllers**: Controllers (`PaymentsController`, `WebhooksController`) are instance classes with constructor injection, using arrow methods for Express binding
- **Instance-based Repositories**: Repositories (`UserRepository`, `PaymentRepository`) are instance classes implementing interfaces
- **Route Factory Functions**: Routes are created via factory functions (`createPaymentsRoutes`, `createWebhooksRoutes`) that accept controller instances
- **Explicit Initialization**: All dependencies are initialized explicitly in `app.ts` in the correct order: Prisma → Repositories → Redis → Services → Controllers → Routes
- **Fail-Fast Behavior**: Connection errors are caught at startup with structured logging and `process.exit(1)`
- **Interface-Based Testing**: All unit tests use interface mocks (`jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentsService>`, etc.) for improved testability and loose coupling

### Security Patterns
- **IP Allowlisting**: Webhook endpoints only accept requests from YooKassa IP ranges
- **Webhook Verification**: Always verify webhook data via YooKassa GET API (source of truth)
- **Input Validation**: Zod schemas for all request DTOs
- **Rate Limiting**: API endpoints protected (100 req/15min), create-payment stricter (10 req/hour)

### Error Handling
- **Global Error Handler**: Consistent JSON error envelope across all endpoints
- **Retryable Errors**: 503 responses with `retryable=true` and `sameIdempotenceKey=true` for transient failures
- **HTTP Status Codes**:
  - 200/201: Success
  - 400: Bad Request (validation errors)
  - 403: Forbidden (non-allowlisted IP for webhooks)
  - 404: Not Found (user/payment not found)
  - 409: Conflict (idempotency key hash mismatch)
  - 429: Too Many Requests (rate limit exceeded)
  - 503: Service Unavailable (retryable upstream errors)

### Logging & Observability
- **Structured Logging**: Pino JSON logs with `correlationId` for end-to-end tracing
- **Request Logging**: All incoming requests logged with correlation ID
- **Outbound Calls**: All YooKassa API calls logged (request/response)
- **Webhook Logging**: Full webhook payloads logged for debugging

## Critical Problems Identified & Solutions

Based on the requirements to identify payment processing challenges, the following problems were identified and solved:

### 1. **Idempotency & Duplicate Prevention**

**Problem**: 
- Client retries or double-clicks can create duplicate payments
- Unknown-outcome failures (timeout/5xx) make it unclear if payment was created
- Same idempotency key with different request body creates conflicts

**Solution**:
- **Redis-based idempotency**: Store idempotency records in Redis with 24h TTL (matches YooKassa window)
- **Request hash validation**: Compute SHA-256 hash of request body; return `409 Conflict` if same key used with different body
- **Idempotent replay**: Return cached response (200 OK) for same key + same hash
- **Retry guidance**: Return `503` with `sameIdempotenceKey=true` for unknown-outcome errors

**Implementation**:
- `IdempotencyService` manages Redis keys with deterministic hashing
- `PaymentService` checks idempotency before creating payment
- Error handler maps timeout/5xx to retryable 503 envelope

### 2. **Webhook Security & Trust**

**Problem**:
- Webhooks can be spoofed (fake notifications)
- Webhook payload may contain incorrect or outdated data
- Out-of-order webhook delivery can cause state corruption

**Solution**:
- **IP Allowlisting**: Reject webhooks from non-YooKassa IPs (403 Forbidden)
- **GET Verification**: Always verify webhook data via `GET /v3/payments/{id}` before any DB mutation
- **Source of Truth**: YooKassa API is authoritative; webhook payload is input-only
- **Idempotent Updates**: State machine prevents invalid transitions and handles duplicates gracefully

**Implementation**:
- `webhookIpAllowlistMiddleware` enforces IP allowlist
- `WebhookService.processWebhook` performs GET verification before processing
- `PaymentStateMachine` ensures only valid transitions and idempotent updates

### 3. **Unknown-Outcome Failures (Timeout/5xx)**

**Problem**:
- Network timeouts or YooKassa 5xx errors leave payment creation outcome unknown
- Client doesn't know if payment was created or not
- Retrying with new idempotency key can create duplicates

**Solution**:
- **Retryable Error Envelope**: Return `503 Service Unavailable` with `retryable=true` and `sameIdempotenceKey=true`
- **Axios Retry Logic**: Automatic retries for GET and idempotent POST requests (with `Idempotence-Key`)
- **Bounded Retries**: Maximum 3 retries with exponential backoff
- **Clear Guidance**: Error response explicitly instructs client to retry with same key

**Implementation**:
- `RetryableUpstreamError` domain error type
- `error-handler.ts` maps Axios timeout/5xx to 503 envelope
- `yookassa.ts` configures Axios interceptor for retry logic

### 4. **Out-of-Order Webhook Delivery**

**Problem**:
- Webhooks may arrive out of order (e.g., `payment.succeeded` before `payment.pending`)
- Duplicate webhooks can cause state corruption
- Race conditions between webhook and polling

**Solution**:
- **State Machine**: Enforces valid transitions only (`pending → succeeded|canceled`)
- **Idempotent Updates**: Same status update is a no-op
- **Final State Immutability**: Once `succeeded` or `canceled`, status cannot change
- **GET Verification**: Always use current status from YooKassa API, not webhook payload

**Implementation**:
- `PaymentStateMachine` validates transitions
- `PaymentService.updatePaymentStatus` checks state machine before updating
- Webhook processing uses verified status from GET request

### 5. **Webhook-Before-POST Race Condition**

**Problem**:
- YooKassa may send webhook notification before `POST /payments` response returns
- Local payment record may not exist yet
- Webhook processing fails or creates orphaned records

**Solution**:
- **Payment Restoration**: If webhook arrives for non-existent payment, restore it from YooKassa API
- **Metadata Requirement**: `metadata.userId` required for restoration
- **Idempotent Creation**: Handle race condition where payment is created concurrently

**Implementation**:
- `WebhookService.restorePayment` creates local record from YooKassa data
- Handles concurrent creation race condition gracefully
- Validates `userId` in metadata before restoration

### 6. **Rate Limiting & Abuse Prevention**

**Problem**:
- Public API endpoints vulnerable to abuse
- Payment creation endpoint needs stricter limits
- Webhooks must not be rate-limited (YooKassa retries)

**Solution**:
- **Tiered Rate Limiting**: 
  - General API: 100 requests / 15 minutes / IP
  - Create payment: 10 requests / 60 minutes / (IP + userId)
  - Webhooks: No rate limiting
- **Redis-backed**: Rate limits stored in Redis for distributed systems
- **Standard Headers**: Return `RateLimit-*` headers for client awareness

**Implementation**:
- `rate-limiter.ts` creates Express rate limiters with Redis store
- Different limits for different endpoints
- Webhook routes explicitly excluded from rate limiting

### 7. **Request Tracing & Debugging**

**Problem**:
- Difficult to trace payment flow across multiple services
- No way to correlate logs from API request → YooKassa → webhook

**Solution**:
- **Correlation ID**: Generate or accept `X-Correlation-Id` header
- **Structured Logging**: All logs include `correlationId` for filtering
- **End-to-End Tracing**: Correlation ID passed to YooKassa service and webhook processing

**Implementation**:
- `correlationIdMiddleware` generates/accepts correlation ID
- All services log with `correlationId` context
- Pino structured JSON logs enable easy filtering

### 8. **Database Schema Protection**

**Problem**:
- Duplicate `yookassa_payment_id` can cause data corruption
- Concurrent webhook processing can create duplicates

**Solution**:
- **Unique Constraint**: `yookassa_payment_id` has unique constraint in database
- **Error Handling**: Catch unique constraint violations and handle gracefully
- **Idempotent Operations**: All operations are safe to retry

**Implementation**:
- Prisma schema enforces unique constraint
- `PaymentRepository` handles unique constraint violations
- Webhook processing checks for existing payment before creation

## Testing

### Unit Tests

All critical logic has comprehensive unit test coverage:
- **PaymentStateMachine**: 18 tests (transitions, immutability, idempotency)
- **IdempotencyService**: 6 tests (get, set, conflict detection) - tests instance class
- **Webhook Processing**: 15 tests (IP allowlist, payload validation, verification, restoration, status updates)
- **Error Handling**: 7 tests (timeout/5xx retryable errors)
- **YooKassa Service**: 3 tests (create payment, retry logic) - tests instance class
- **Controllers**: Tests use interface-based mocks (`jest.Mocked<IPaymentsService>`, `jest.Mocked<IWebhookService>`)
- **Services**: Tests use interface-based mocks (`jest.Mocked<IUserRepository>`, `jest.Mocked<IPaymentRepository>`, `jest.Mocked<IIdempotencyService>`, `jest.Mocked<IYookassaService>`)

**Total: 82 passing tests (17 test suites)**

```bash
npm test
```

### Test Coverage

- Business logic coverage: >80%
- Critical paths: idempotency, state machine, webhook security, error handling
- Edge cases: duplicates, out-of-order, race conditions, unknown-outcome failures
- **Interface-Based Mocks**: All tests use `jest.Mocked<Interface>` instead of concrete class mocks, ensuring loose coupling and improved testability

## Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Make sure PostgreSQL is running
docker compose ps
docker compose up postgres -d
```

**Redis Connection Error**
```bash
# Make sure Redis is running
docker compose ps
docker compose up redis -d
```

**Migration Issues**
```bash
# Reset database and rerun migrations
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

**Webhook Not Received**
```bash
# Check ngrok is running and URL is configured in YooKassa dashboard
ngrok http 3000

# Check webhook IP allowlist (must be from YooKassa IPs)
# Check logs for 403 Forbidden errors
```

**Idempotency Key Conflict**
```bash
# Use different idempotency key for different request bodies
# Or wait 24 hours for TTL expiration
```

**Port Already in Use**
```bash
# Change PORT in .env file
PORT=3001
```

## Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_service"

# Redis
REDIS_URL="redis://localhost:6379"

# YooKassa
YOOKASSA_SHOP_ID="your-shop-id"
YOOKASSA_SECRET_KEY="your-secret-key"
YOOKASSA_BASE_URL="https://api.yookassa.ru/v3"

# Application
PORT=3000
NODE_ENV=development

# Trusted Proxy (for webhook IP extraction behind reverse proxy)
TRUSTED_PROXY=false
```

## Performance Considerations

- **Database Indexes**: Indexed on `yookassa_payment_id` (unique), `user_id` for queries
- **Redis Caching**: Idempotency keys cached with 24h TTL
- **Connection Pooling**: Prisma uses PostgreSQL connection pool
- **Retry Logic**: Bounded retries (max 3) with exponential backoff for upstream calls
- **Rate Limiting**: Prevents abuse while allowing legitimate traffic

## Constitution & Spec-Driven Development

This project follows the Spec-Driven Development workflow:

1. **Constitution** (`.specify/memory/constitution.md`) - Defines principles and standards
2. **Specifications**:
   - `specs/001-yookassa-payment-flow/` - Payment flow integration specification (✅ Implemented)
   - `specs/002-di-refactoring/` - Dependency Injection refactoring specification (✅ Implemented)
   - `specs/003-full-di-interfaces/` - Full Dependency Injection with interfaces specification (✅ Implemented)
3. **Research** - Technical decisions and alternatives documented in each spec
4. **Plan** - Technical implementation plans for each feature
5. **Tasks** - Actionable task breakdowns for implementation
6. **Implementation** - This codebase

All artifacts remain consistent with the constitution principles, including **Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)**.

### Implemented Refactorings

#### 002-di-refactoring
- ✅ Converted `PaymentsService` and `WebhookService` from static classes to instance classes with constructor injection
- ✅ Converted controllers from direct imports to factory functions accepting service instances
- ✅ Converted routes to factory functions accepting controller functions
- ✅ Added explicit Prisma connection in `app.ts` with fail-fast error handling
- ✅ Made dependency graph visible in `app.ts` with explicit initialization order

#### 003-full-di-interfaces
- ✅ Created interfaces for all repositories (`IUserRepository`, `IPaymentRepository`)
- ✅ Created interfaces for all services (`IPaymentsService`, `IWebhookService`, `IIdempotencyService`, `IYookassaService`)
- ✅ Converted `IdempotencyService` and `YookassaService` from static classes to instance classes
- ✅ Converted controllers from factory functions to instance classes with constructor injection
- ✅ Removed adapter classes (no longer needed as all services are instance classes)
- ✅ Updated all dependencies to use interfaces instead of concrete classes
- ✅ Updated all unit tests to use interface-based mocks (`jest.Mocked<Interface>`)
- ✅ All services and repositories implement their respective interfaces

## Key Features

### Payment Flow
- ✅ One-stage payment creation with redirect URL
- ✅ Payment status tracking (pending → succeeded|canceled)
- ✅ Idempotent payment creation (Redis + request hash)
- ✅ Payment restoration from webhook (webhook-before-POST scenario)

### Webhook Processing
- ✅ IP allowlist enforcement (YooKassa IPs only)
- ✅ Webhook verification via YooKassa GET API (source of truth)
- ✅ Idempotent status updates (handles duplicates/out-of-order)
- ✅ Payment restoration for missing records

### Error Handling
- ✅ Retryable error envelope (503 with `retryable=true`, `sameIdempotenceKey=true`)
- ✅ Axios retry logic for GET and idempotent POST
- ✅ Graceful shutdown (HTTP server + Prisma + Redis)
- ✅ Comprehensive error logging with correlation ID

### Security & Reliability
- ✅ Input validation with Zod (type-safe schemas)
- ✅ Rate limiting (API + create-payment endpoints)
- ✅ Webhook IP allowlisting
- ✅ State machine prevents invalid transitions
- ✅ Unique constraint on `yookassa_payment_id`

### Observability
- ✅ Structured JSON logging (Pino)
- ✅ Correlation ID for end-to-end tracing
- ✅ Request/response logging
- ✅ Webhook payload logging

### Code Quality
- ✅ TypeScript strict mode (no `any` types)
- ✅ Full Dependency Injection with interfaces (Dependency Inversion Principle)
- ✅ Modular architecture (controllers, services, repositories)
- ✅ Explicit dependency initialization with fail-fast error handling
- ✅ Global error handling
- ✅ Interface-based unit tests (82 passing tests)
- ✅ OpenAPI documentation

## License

MIT

## Author

Portfolio/demo project for showcasing payment integration skills and understanding of payment processing challenges.

