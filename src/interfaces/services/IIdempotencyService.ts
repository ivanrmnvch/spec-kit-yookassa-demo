/**
 * Idempotency record stored in Redis
 */
export interface IdempotencyRecord {
  requestHash: string;
  payment: {
    id: string;
    yookassa_payment_id: string;
    [key: string]: unknown;
  };
}

/**
 * Interface for idempotency service operations
 * Enables dependency injection of idempotency service through Dependency Inversion Principle
 */
export interface IIdempotencyService {
  /**
   * Get idempotency record by key
   * @param idempotencyKey - UUID v4 idempotency key
   * @returns Idempotency record if found, null otherwise
   */
  get(idempotencyKey: string): Promise<IdempotencyRecord | null>;

  /**
   * Store idempotency record with 24h TTL
   * @param idempotencyKey - UUID v4 idempotency key
   * @param requestHash - SHA-256 hash of request body
   * @param payment - Payment response to cache
   */
  set(
    idempotencyKey: string,
    requestHash: string,
    payment: { id: string; yookassa_payment_id: string; [key: string]: unknown }
  ): Promise<void>;

  /**
   * Check if there's a hash conflict for the given idempotency key
   * @param idempotencyKey - UUID v4 idempotency key
   * @param requestHash - SHA-256 hash of request body
   * @returns true if conflict exists (key exists with different hash), false otherwise
   */
  checkConflict(idempotencyKey: string, requestHash: string): Promise<boolean>;
}

