# Data Model: Dependency Injection Refactoring

**Feature**: Dependency Injection Refactoring (Constructor Injection)  
**Date**: 2026-01-29

## Note

This is an **architectural refactoring** feature with **no changes to data entities or database schema**.

- No new database tables or columns
- No changes to existing data models (User, Payment)
- No changes to API request/response contracts
- No changes to domain entities

The refactoring only changes:
- **Service architecture** (static → instance classes)
- **Dependency injection pattern** (Service Locator → Constructor Injection)
- **Initialization flow** (lazy → explicit)

## Architecture Entities (Not Data Entities)

This refactoring introduces new **architectural entities** (interfaces and adapters), not data entities:

### Service Interfaces

- **IIdempotencyService**: Interface for idempotency operations
  - Methods: `get(key: string)`, `set(key, hash, payment)`, `checkConflict(key, hash)`
  
- **IYookassaService**: Interface for YooKassa API operations
  - Methods: `createPayment(request, idempotenceKey)`, `getPayment(paymentId, correlationId)`

### Adapter Classes

- **IdempotencyServiceAdapter**: Wraps static `IdempotencyService`, implements `IIdempotencyService`
- **YookassaServiceAdapter**: Wraps static `YookassaService`, implements `IYookassaService`

### Service Instances

- **PaymentsService (instance)**: Instance class with constructor injection
- **WebhookService (instance)**: Instance class with constructor injection

These are architectural components, not data entities, and do not require database schema changes.

