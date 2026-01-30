import { IdempotencyService } from "../idempotency.service";
import { IIdempotencyService } from "../../interfaces/services/IIdempotencyService";

/**
 * Adapter for IdempotencyService static class
 * Implements IIdempotencyService interface and delegates to static methods
 * Enables dependency injection of static service through Dependency Inversion Principle
 */
export class IdempotencyServiceAdapter implements IIdempotencyService {
  /**
   * Get idempotency record by key
   * Delegates to IdempotencyService.get()
   */
  async get(idempotencyKey: string) {
    return IdempotencyService.get(idempotencyKey);
  }

  /**
   * Store idempotency record with 24h TTL
   * Delegates to IdempotencyService.set()
   */
  async set(
    idempotencyKey: string,
    requestHash: string,
    payment: { id: string; yookassa_payment_id: string; [key: string]: unknown }
  ): Promise<void> {
    return IdempotencyService.set(idempotencyKey, requestHash, payment);
  }

  /**
   * Check if there's a hash conflict for the given idempotency key
   * Delegates to IdempotencyService.checkConflict()
   */
  async checkConflict(
    idempotencyKey: string,
    requestHash: string
  ): Promise<boolean> {
    return IdempotencyService.checkConflict(idempotencyKey, requestHash);
  }
}

