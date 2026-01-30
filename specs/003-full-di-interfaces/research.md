# Research: Complete Dependency Injection with Interfaces

**Feature**: 003-full-di-interfaces  
**Date**: 2026-01-29  
**Purpose**: Research technical decisions for completing Dependency Injection refactoring with interfaces

## Research Questions

### 1. TypeScript Interface Organization and Naming Conventions

**Question**: What are best practices for organizing and naming interfaces in TypeScript projects?

**Research Findings**:

**Decision**: Use `I` prefix for interfaces (IUserRepository, IPaymentRepository) and organize interfaces in separate directories by layer.

**Rationale**:
- `I` prefix is a widely recognized TypeScript convention that clearly distinguishes interfaces from classes
- Separate interface files (one interface per file) improve maintainability and make dependencies explicit
- Directory organization by layer (`interfaces/repositories/`, `interfaces/services/`) provides clear structure and matches the codebase organization
- This pattern is consistent with existing interfaces (IIdempotencyService, IYookassaService)

**Alternatives Considered**:
- No prefix (UserRepository interface): Rejected because it would conflict with class names
- Suffix pattern (UserRepositoryInterface): Rejected because `I` prefix is more concise and widely used
- Single interfaces file: Rejected because it would become unwieldy and reduce maintainability

**References**:
- TypeScript Handbook: Interfaces
- Microsoft TypeScript Coding Guidelines

---

### 2. Interface Method Signatures: Static to Instance Conversion

**Question**: How should interface method signatures be defined when converting static methods to instance methods?

**Research Findings**:

**Decision**: Interface methods should be defined as instance methods (no `static` keyword). The interface signature matches the static method signature exactly, but as an instance method.

**Rationale**:
- Interfaces in TypeScript cannot have static members
- Instance methods in interfaces are the standard pattern
- Method signatures (parameters, return types) remain identical, only the calling pattern changes (from `Service.method()` to `service.method()`)
- This maintains the same contract while enabling dependency injection

**Example**:
```typescript
// Static service (current)
static async get(idempotencyKey: string): Promise<IdempotencyRecord | null>

// Interface (instance method)
get(idempotencyKey: string): Promise<IdempotencyRecord | null>

// Instance class (after refactoring)
async get(idempotencyKey: string): Promise<IdempotencyRecord | null>
```

**Alternatives Considered**:
- Keep static methods in interfaces: Rejected because TypeScript doesn't support static interface members
- Change method signatures: Rejected because it would break the contract and require changes to all callers

---

### 3. Constructor Injection with Interfaces: Type Safety

**Question**: How to ensure type safety when using interfaces in constructors?

**Research Findings**:

**Decision**: Use interface types directly in constructor parameters. TypeScript's structural typing ensures compile-time safety.

**Rationale**:
- TypeScript's structural typing means any object that satisfies the interface contract can be used
- Compile-time checking ensures all required methods are implemented
- No runtime overhead (interfaces are compile-time only)
- Enables easy mocking in tests (any object with matching methods works)

**Example**:
```typescript
class PaymentsService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly paymentRepository: IPaymentRepository,
    // ...
  ) {}
}
```

**Alternatives Considered**:
- Abstract classes instead of interfaces: Rejected because interfaces are more flexible and don't impose implementation inheritance
- Generic constraints: Rejected because it adds unnecessary complexity for this use case

---

### 4. Controller Class Pattern: Arrow Methods for Express

**Question**: How should controller classes be structured to work with Express route handlers?

**Research Findings**:

**Decision**: Use arrow method syntax for controller methods to ensure proper `this` binding in Express route handlers.

**Rationale**:
- Arrow methods automatically bind `this` to the class instance
- Express route handlers receive functions that may lose `this` context
- Arrow methods eliminate the need for manual `.bind()` calls
- Consistent with modern TypeScript/JavaScript patterns

**Example**:
```typescript
class PaymentsController {
  constructor(private readonly paymentsService: IPaymentsService) {}

  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    // 'this' is automatically bound to PaymentsController instance
    await this.paymentsService.createPayment(...);
  };
}
```

**Alternatives Considered**:
- Regular methods with manual binding: Rejected because arrow methods are cleaner and less error-prone
- Factory functions: Rejected because classes provide better dependency injection and consistency with service layer

---

### 5. Testing with Interface Mocks: Jest Patterns

**Question**: What is the best pattern for mocking interfaces in Jest tests?

**Research Findings**:

**Decision**: Use `jest.Mocked<Interface>` type with object literal mocks. Create mocks that satisfy the interface contract.

**Rationale**:
- `jest.Mocked<T>` provides type safety and IntelliSense for mock methods
- Object literals with `jest.fn()` are simple and readable
- TypeScript ensures mocks implement all required interface methods
- Consistent with existing test patterns in the codebase

**Example**:
```typescript
const mockUserRepository: jest.Mocked<IUserRepository> = {
  existsById: jest.fn(),
} as jest.Mocked<IUserRepository>;

const mockPaymentRepository: jest.Mocked<IPaymentRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByYooKassaId: jest.fn(),
  updateStatus: jest.fn(),
} as jest.Mocked<IPaymentRepository>;
```

**Alternatives Considered**:
- `jest.createMockFromModule`: Rejected because it's designed for module mocks, not interface mocks
- Manual type assertions: Rejected because `jest.Mocked<T>` provides better type safety

---

### 6. Migration Strategy: Incremental Refactoring

**Question**: What is the safest approach to refactoring static services to instance classes?

**Research Findings**:

**Decision**: Follow the migration order defined in the spec: Interfaces → Services → Controllers → Adapters removal. Complete each step fully before moving to the next.

**Rationale**:
- Creating interfaces first establishes the contract before implementation changes
- Refactoring services incrementally (IdempotencyService, then YookassaService) minimizes risk
- Updating controllers after services ensures service interfaces are stable
- Removing adapters last ensures all dependencies are updated first
- Each step can be tested independently

**Migration Order**:
1. Create repository interfaces → Update repositories → Update services to use interfaces
2. Create service interfaces → Update services to implement interfaces
3. Refactor IdempotencyService (static → instance)
4. Refactor YookassaService (static → instance)
5. Refactor controllers (factory functions → classes)
6. Remove adapters and update app.ts
7. Update all tests

**Alternatives Considered**:
- Big bang refactoring: Rejected because it increases risk and makes debugging difficult
- Reverse order (adapters first): Rejected because it would break the dependency chain

---

## Technical Decisions Summary

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `I` prefix for interfaces | Widely recognized convention, clear distinction | Low - naming only |
| One interface per file | Maintainability, explicit dependencies | Low - file organization |
| Interface directories by layer | Matches codebase structure | Low - organization |
| Instance methods in interfaces | TypeScript limitation, standard pattern | None - required |
| Arrow methods in controllers | Automatic `this` binding for Express | Low - syntax change |
| `jest.Mocked<Interface>` for tests | Type safety, IntelliSense | Low - test pattern |
| Incremental migration order | Risk reduction, testability | High - affects execution |

## No Additional Research Needed

All technical decisions are straightforward and follow established TypeScript/Node.js patterns. The refactoring is primarily structural (adding interfaces, converting static to instance) without requiring new technologies or complex patterns.

**Status**: ✅ Research complete. Ready for implementation.

