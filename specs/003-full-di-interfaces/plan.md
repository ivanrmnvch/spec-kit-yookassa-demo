# Implementation Plan: Complete Dependency Injection with Interfaces

**Branch**: `003-full-di-interfaces` | **Date**: 2026-01-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-full-di-interfaces/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Complete the architectural refactoring to full Dependency Injection with interfaces for all dependencies. This refactoring:
- Creates interfaces for all repositories and services (IUserRepository, IPaymentRepository, IPaymentsService, IWebhookService)
- Refactors static services (IdempotencyService, YookassaService) to instance classes with constructor injection
- Converts controllers from factory functions to instance classes
- Removes adapter classes (IdempotencyServiceAdapter, YookassaServiceAdapter)
- Updates all tests to use interfaces in mocks

**Technical Approach**: Incremental refactoring following Dependency Inversion Principle. Interfaces are created first, then services are refactored, followed by controllers, and finally adapters are removed. All changes maintain backward compatibility with HTTP API.

## Technical Context

**Language/Version**: TypeScript 5.7.3 (ES2023 target, ESNext modules)  
**Primary Dependencies**: Express 4.19.2, Prisma 7.3.0, Redis 5.10.0, Axios 1.13.4, Jest 29.7.0  
**Storage**: PostgreSQL (via Prisma ORM), Redis (for idempotency keys and rate limiting)  
**Testing**: Jest with ts-jest, unit tests only (no integration tests per constitution)  
**Target Platform**: Node.js backend server (Linux/Unix compatible)  
**Project Type**: Single backend project (no frontend)  
**Performance Goals**: Maintain current performance characteristics (no degradation expected)  
**Constraints**: TypeScript strict mode required, no `any` types, 100% test coverage maintained, no breaking changes to HTTP API  
**Scale/Scope**: Refactoring affects ~15 files (interfaces, services, controllers, routes, tests), ~500-800 lines of code changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle IX: Dependencies Must Be Explicitly Initialized (Constructor Injection)

✅ **PASS**: This refactoring directly implements and completes Principle IX:
- All services use constructor injection (no static Service Locator pattern)
- External dependencies (Redis, Prisma, Axios) are explicitly initialized before creating dependent services
- All dependencies are visible in the application entry point (app.ts)
- Services accept dependencies through constructors, not through static getters or global state
- Fail-fast behavior: connection errors are caught at startup, not during first request
- Testability: dependencies can be easily mocked by passing interface implementations through constructors
- Explicit lifecycle: the order of initialization is clear and controlled

### Development Workflow & Quality Gates

✅ **PASS**: All requirements met:
- TypeScript strict mode: Already enforced, will be maintained
- Input validation: No changes to validation logic (Zod remains)
- Testing: Unit tests will be updated to use interfaces, maintaining 100% coverage
- Architecture: Constructor injection pattern fully implemented

### Constraints & Security Boundaries

✅ **PASS**: No violations:
- Backend-only: No changes to project scope
- No changes to payment flow logic
- No changes to security boundaries
- No changes to database schema

**Constitution Check Result**: ✅ **PASS** - No violations. This refactoring fully aligns with and completes Constitution Principle IX.

## Project Structure

### Documentation (this feature)

```text
specs/003-full-di-interfaces/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

**Note**: This is an architectural refactoring, not a new feature. Therefore:
- `data-model.md`: Not needed (data model unchanged)
- `contracts/`: Not needed (HTTP API contracts unchanged)
- `quickstart.md`: Not needed (no new feature to demonstrate)

### Source Code (repository root)

```text
src/
├── app.ts                          # Application entry point (updated: remove adapters, use instance classes)
├── config/                         # Configuration (unchanged)
│   ├── database.ts
│   ├── env.ts
│   ├── redis.ts
│   └── yookassa.ts
├── controllers/                    # HTTP controllers (refactored: factory functions → classes)
│   ├── payments.controller.ts      # → PaymentsController class
│   └── webhooks.controller.ts     # → WebhooksController class
├── interfaces/                     # NEW: Interface definitions
│   ├── repositories/
│   │   ├── IUserRepository.ts     # NEW
│   │   └── IPaymentRepository.ts  # NEW
│   └── services/
│       ├── IPaymentsService.ts     # NEW
│       ├── IWebhookService.ts      # NEW
│       ├── IIdempotencyService.ts  # Existing (reviewed/updated)
│       └── IYookassaService.ts     # Existing (reviewed/updated)
├── middlewares/                    # Middleware (unchanged)
├── repositories/                   # Data access (updated: implement interfaces)
│   ├── user.repository.ts         # → implements IUserRepository
│   └── payment.repository.ts      # → implements IPaymentRepository
├── routes/                         # Route definitions (updated: accept controller instances)
│   ├── payments.ts                 # → accepts PaymentsController instance
│   └── webhooks.ts                 # → accepts WebhooksController instance
├── services/
│   ├── adapters/                   # DELETED: Adapter classes removed
│   │   ├── idempotency-service.adapter.ts  # DELETE
│   │   └── yookassa-service.adapter.ts     # DELETE
│   ├── interfaces/                 # Existing interfaces (reviewed/updated)
│   │   ├── idempotency-service.interface.ts
│   │   └── yookassa-service.interface.ts
│   ├── idempotency.service.ts      # Refactored: static → instance class
│   ├── payment.service.ts          # Updated: use interfaces in constructor
│   ├── payment-state-machine.ts    # Unchanged
│   ├── webhook.service.ts         # Updated: use interfaces in constructor
│   └── yookassa.service.ts         # Refactored: static → instance class
├── types/                          # Type definitions (unchanged)
└── utils/                          # Utilities (unchanged)

tests/
└── unit/                           # Unit tests (updated: use interfaces in mocks)
    ├── payments-create.*.test.ts   # Updated: jest.Mocked<IUserRepository>, etc.
    ├── payments-get.*.test.ts      # Updated: interface mocks
    ├── webhook.*.test.ts           # Updated: interface mocks
    └── ...                         # All test files updated
```

**Structure Decision**: Single backend project structure maintained. New `src/interfaces/` directory added for interface definitions organized by layer (repositories/, services/). Adapter classes removed. Controllers converted from factory functions to classes. All existing structure preserved, only refactored to use interfaces and instance classes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. This refactoring simplifies the architecture by removing adapters and establishing consistent patterns.
