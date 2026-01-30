# API Contracts: Dependency Injection Refactoring

**Feature**: Dependency Injection Refactoring (Constructor Injection)  
**Date**: 2026-01-29

## Note

This is an **architectural refactoring** feature with **no changes to HTTP API contracts**.

- No new endpoints
- No changes to existing endpoint paths
- No changes to request/response schemas
- No changes to HTTP status codes
- No changes to error response formats

All HTTP API endpoints continue to work identically:
- `POST /api/payments` - unchanged
- `GET /api/payments/:id` - unchanged  
- `POST /api/webhooks/yookassa` - unchanged

The refactoring only affects **internal architecture** (service instantiation, dependency injection), not external API contracts.

For API contract documentation, see `specs/001-yookassa-payment-flow/contracts/openapi.yaml`.

