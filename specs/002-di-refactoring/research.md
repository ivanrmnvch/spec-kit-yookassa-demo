# Research: Dependency Injection Refactoring

**Feature**: Dependency Injection Refactoring (Constructor Injection)  
**Date**: 2026-01-29  
**Status**: Complete

## Research Topics

### 1. Constructor Injection Without DI Container

**Decision**: Manual dependency wiring in application entry point (`app.ts`)

**Rationale**:
- No external dependencies required (keeps project lightweight)
- Full control over initialization order
- Explicit dependency graph visible in one place
- Aligns with Constitution Principle IX requirement for explicit initialization
- Simple and straightforward for small-to-medium codebases

**Alternatives Considered**:
- **InversifyJS / TSyringe**: Rejected - adds complexity and external dependency, not needed for this scope
- **Service Locator pattern**: Rejected - violates Constitution Principle IX, hides dependencies
- **Factory pattern with DI container**: Rejected - overkill for this refactoring scope

### 2. Adapter Pattern for Static Services

**Decision**: Create adapter classes that implement interfaces and delegate to static services

**Rationale**:
- Enables Dependency Inversion Principle (depend on abstractions, not concretions)
- Maintains uniform dependency injection approach across all services
- Easy to test (can mock interfaces)
- Static services remain unchanged (minimal risk)
- Clear separation of concerns (adapters are thin wrappers)

**Alternatives Considered**:
- **Direct static calls**: Rejected - violates DI principles, harder to test, inconsistent approach
- **Convert all services to instances**: Rejected - out of scope, increases risk and complexity
- **Proxy pattern**: Rejected - more complex than needed, adapters are simpler

**Implementation Pattern**:
```typescript
interface IIdempotencyService {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(key: string, hash: string, payment: Payment): Promise<void>;
}

class IdempotencyServiceAdapter implements IIdempotencyService {
  async get(key: string): Promise<IdempotencyRecord | null> {
    return IdempotencyService.get(key);
  }
  
  async set(key: string, hash: string, payment: Payment): Promise<void> {
    return IdempotencyService.set(key, hash, payment);
  }
}
```

### 3. Factory Functions for Controllers and Routes

**Decision**: Named exports with `create*` prefix (e.g., `createPaymentController`, `createPaymentsRoutes`)

**Rationale**:
- Clear naming convention that indicates factory pattern
- Consistent with common JavaScript/TypeScript patterns
- Easy to identify factory functions in codebase
- Named exports enable better tree-shaking and explicit imports
- Controllers and routes become testable (can inject mocked services)

**Alternatives Considered**:
- **Default exports**: Rejected - less explicit, harder to identify factory functions
- **No prefix (direct function names)**: Rejected - less clear that these are factories
- **Class-based factories**: Rejected - unnecessary complexity, functions are simpler

**Implementation Pattern**:
```typescript
export function createPaymentController(paymentsService: PaymentsService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Controller logic using paymentsService
  };
}
```

### 4. Error Handling During Dependency Initialization

**Decision**: Log error with full context (dependency name, error message, stack trace), then `process.exit(1)`

**Rationale**:
- Fail-fast behavior prevents application from starting in invalid state
- Full context logging enables debugging of startup failures
- Structured logging (Pino) provides observability
- Clear error messages help identify which dependency failed
- Prevents partial initialization that could lead to runtime errors

**Alternatives Considered**:
- **Graceful degradation**: Rejected - application should not start if dependencies are unavailable
- **Retry logic**: Rejected - initialization failures should be fixed before deployment, not retried
- **Throw exception and rely on uncaught handler**: Rejected - explicit error handling is clearer

### 5. Migration Strategy

**Decision**: Incremental refactoring, one service at a time, following priority order (P1 → P6)

**Rationale**:
- Minimizes risk by making small, testable changes
- Each step can be verified independently
- Easier to rollback if issues arise
- Maintains working codebase throughout migration
- Clear progression: Services → Controllers → Routes → App initialization → Tests

**Migration Order**:
1. Create interfaces and adapters (foundation)
2. Refactor PaymentsService (P1 - core service)
3. Refactor WebhookService (P2 - depends on PaymentsService)
4. Convert controllers to factories (P3 - depends on services)
5. Convert routes to factories (P4 - depends on controllers)
6. Update app.ts initialization (P5 - integrates everything)
7. Update tests (P6 - verifies correctness)

## Key Principles Applied

1. **Dependency Inversion Principle**: Depend on interfaces (abstractions), not concrete implementations
2. **Explicit is Better Than Implicit**: All dependencies visible in app.ts
3. **Fail-Fast**: Errors caught at startup, not during runtime
4. **Testability**: Dependencies can be easily mocked through constructors
5. **Incremental Refactoring**: Small, safe steps with verification at each stage

## References

- Constitution Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)
- SOLID Principles (especially Dependency Inversion)
- Adapter Pattern (Gang of Four)
- Factory Pattern for dependency creation

