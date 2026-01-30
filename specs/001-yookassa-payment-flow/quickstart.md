# Quickstart: YooKassa Payment Flow (Create • Status • Webhooks)

**Feature**: `001-yookassa-payment-flow`  
**Date**: 2026-01-29

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- YooKassa test credentials (shop id + secret key)
- ngrok (for webhook testing)

## Environment variables

Create `.env` (example values):

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_service`
- `REDIS_URL=redis://localhost:6379`
- `YOOKASSA_SHOP_ID=...`
- `YOOKASSA_SECRET_KEY=...`
- `PORT=3000`
- `NODE_ENV=development`

## Start dependencies

```bash
docker-compose up -d
```

## Run migrations + seed users

```bash
npx prisma migrate dev
npx prisma db seed
```

## Run the service

```bash
npm run dev
```

## Expose webhooks with ngrok

```bash
ngrok http 3000
```

Configure YooKassa webhook URL to:

- `https://<ngrok-subdomain>.ngrok.io/api/webhooks/yookassa`

## Manual API checks (examples)

### 1) Create payment (idempotent)

- Send `Idempotence-Key: <uuid-v4>`
- Optional `X-Correlation-Id: <your-id>`

```bash
curl -X POST 'http://localhost:3000/api/payments' \
  -H 'Content-Type: application/json' \
  -H 'Idempotence-Key: 11111111-1111-4111-8111-111111111111' \
  -H 'X-Correlation-Id: demo-req-001' \
  -d '{
    "userId": "00000000-0000-4000-8000-000000000001",
    "amount": { "value": "100.00", "currency": "RUB" },
    "returnUrl": "https://example.com/payment/result",
    "description": "Premium subscription",
    "metadata": { "plan_type": "premium", "billing_period": "monthly", "userId": "00000000-0000-4000-8000-000000000001" }
  }'
```

Repeat the same request with the same key and same body:
- expect `200 OK` (idempotency cache hit)
- same `id` and same `yookassa_payment_id`

### 2) Fetch payment status

```bash
curl 'http://localhost:3000/api/payments/<internal-id>'
```

## Webhook behavior validation

- Webhook must be:
  - blocked with `403` if source IP is not allowlisted
  - rejected with `400` if payload misses `object.id`
  - processed via GET verification (YooKassa is the source of truth)
  - idempotent under duplicates/out-of-order


