# Quickstart: Dependency Injection Refactoring

**Feature**: Dependency Injection Refactoring (Constructor Injection)  
**Date**: 2026-01-29

## Overview

This refactoring converts the payment service architecture from static Service Locator pattern to Constructor Injection without a DI container. The goal is to improve testability, make dependencies explicit, and ensure fail-fast behavior at startup.

## Key Changes

### Architecture Transformation

**Before (Static Service Locator)**:
```typescript
// Static class with lazy initialization
export class PaymentsService {
  private static readonly prisma = getPrismaClient();
  private static readonly userRepository = new UserRepository(this.prisma);
  
  static async createPayment(...) {
    // Uses static dependencies
  }
}

// Direct static calls
PaymentsService.createPayment(...);
```

**After (Constructor Injection)**:
```typescript
// Instance class with constructor injection
export class PaymentsService {
  constructor(
    private userRepository: UserRepository,
    private paymentRepository: PaymentRepository,
    private idempotencyService: IIdempotencyService,
    private yookassaService: IYookassaService
  ) {}
  
  async createPayment(...) {
    // Uses injected dependencies
  }
}

// Instance creation with dependencies
const paymentsService = new PaymentsService(
  userRepository,
  paymentRepository,
  idempotencyService,
  yookassaService
);
```

### Dependency Initialization Order

All dependencies are explicitly initialized in `app.ts` in this order:

1. **Redis** → `await getRedisClient()`
2. **Prisma** → `getPrismaClient()` then `await prisma.$connect()`
3. **Repositories** → `new UserRepository(prisma)`, `new PaymentRepository(prisma)`
4. **Adapters** → `new IdempotencyServiceAdapter()`, `new YookassaServiceAdapter()`
5. **Services** → `new PaymentsService(...)`, `new WebhookService(...)`
6. **Controllers** → `createPaymentController(paymentsService)`, etc.
7. **Routes** → `createPaymentsRoutes(...)`, `createWebhooksRoutes(...)`
8. **Express App** → `app.use("/api/payments", paymentsRoutes)`

### Service Interfaces and Adapters

Static services are wrapped in adapters that implement interfaces:

```typescript
// Interface
interface IIdempotencyService {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(key: string, hash: string, payment: Payment): Promise<void>;
}

// Adapter (wraps static service)
class IdempotencyServiceAdapter implements IIdempotencyService {
  async get(key: string) {
    return IdempotencyService.get(key); // Delegates to static
  }
  
  async set(key: string, hash: string, payment: Payment) {
    return IdempotencyService.set(key, hash, payment);
  }
}
```

### Factory Functions

Controllers and routes are created via factory functions:

```typescript
// Controller factory
export function createPaymentController(paymentsService: PaymentsService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await paymentsService.createPayment(...);
    res.status(201).json(result);
  };
}

// Route factory
export function createPaymentsRoutes(
  createPaymentController: ReturnType<typeof createPaymentController>,
  getPaymentController: ReturnType<typeof getPaymentController>
) {
  const router = Router();
  router.post("/", createPaymentController);
  router.get("/:id", getPaymentController);
  return router;
}
```

## Testing Changes

### Before (Static)
```typescript
// Hard to mock static dependencies
test("createPayment", async () => {
  const result = await PaymentsService.createPayment(...);
  // Can't easily mock repositories
});
```

### After (Instance)
```typescript
// Easy to mock dependencies
test("createPayment", async () => {
  const mockUserRepo = createMockUserRepository();
  const mockPaymentRepo = createMockPaymentRepository();
  const mockIdempotency = createMockIdempotencyService();
  const mockYookassa = createMockYookassaService();
  
  const service = new PaymentsService(
    mockUserRepo,
    mockPaymentRepo,
    mockIdempotency,
    mockYookassa
  );
  
  const result = await service.createPayment(...);
  // All dependencies are mocked
});
```

## Migration Checklist

- [ ] Create service interfaces (`IIdempotencyService`, `IYookassaService`)
- [ ] Create adapter classes (`IdempotencyServiceAdapter`, `YookassaServiceAdapter`)
- [ ] Refactor `PaymentsService` to instance class
- [ ] Refactor `WebhookService` to instance class
- [ ] Convert controllers to factory functions
- [ ] Convert routes to factory functions
- [ ] Update `app.ts` with explicit dependency initialization
- [ ] Update all unit tests
- [ ] Verify all tests pass
- [ ] Verify application starts correctly
- [ ] Verify HTTP API endpoints work identically

## Breaking Changes

**Internal API Only** (no HTTP API changes):
- `PaymentsService` and `WebhookService` are no longer static classes
- Controllers and routes are now factory functions
- Tests must be updated to use instance classes

**No External API Changes**:
- All HTTP endpoints (`POST /api/payments`, `GET /api/payments/:id`, `POST /api/webhooks/yookassa`) work identically
- Request/response contracts unchanged
- Client applications unaffected

## Error Handling

If any dependency fails to initialize during startup:
1. Error is logged with full context (dependency name, error message, stack trace)
2. Application exits immediately with `process.exit(1)`
3. Application does not start in invalid state

Example error log:
```json
{
  "level": "error",
  "dependency": "Prisma",
  "error": {
    "message": "Connection refused",
    "stack": "..."
  },
  "msg": "Failed to initialize dependency"
}
```

## Verification

After refactoring, verify:
- ✅ All unit tests pass
- ✅ Application starts successfully
- ✅ Prisma connection established before services created
- ✅ All dependencies visible in `app.ts`
- ✅ HTTP endpoints work identically
- ✅ No static methods in PaymentsService or WebhookService
- ✅ Error handling works (simulate connection failure)

