import { getRedisClient } from "../config/redis";
import { logger } from "../utils/logger";

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
 * Idempotency service
 * Manages idempotency keys in Redis with 24h TTL
 */
export class IdempotencyService {
  private static readonly TTL_SECONDS = 24 * 60 * 60; // 24 hours
  private static readonly KEY_PREFIX = "idempotency:";

  /**
   * Get idempotency record by key
   * @param idempotencyKey - UUID v4 idempotency key
   * @returns Idempotency record if found, null otherwise
   */
  static async get(
    idempotencyKey: string
  ): Promise<IdempotencyRecord | null> {
    const redis = await getRedisClient();
    const key = this.getKey(idempotencyKey);

    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as IdempotencyRecord;
    } catch (error) {
      logger.error({ err: error, idempotencyKey, correlationId: "unknown" }, "Failed to get idempotency record");
      throw error;
    }
  }

  /**
   * Store idempotency record with 24h TTL
   * @param idempotencyKey - UUID v4 idempotency key
   * @param requestHash - SHA-256 hash of request body
   * @param payment - Payment response to cache
   */
  static async set(
    idempotencyKey: string,
    requestHash: string,
    payment: { id: string; yookassa_payment_id: string; [key: string]: unknown }
  ): Promise<void> {
    const redis = await getRedisClient();
    const key = this.getKey(idempotencyKey);

    const record: IdempotencyRecord = {
      requestHash,
      payment,
    };

    try {
      await redis.setEx(key, this.TTL_SECONDS, JSON.stringify(record));
      logger.debug({ idempotencyKey, correlationId: "unknown" }, "Idempotency record stored");
    } catch (error) {
      logger.error({ err: error, idempotencyKey, correlationId: "unknown" }, "Failed to set idempotency record");
      throw error;
    }
  }

  /**
   * Check if there's a hash conflict for the given idempotency key
   * @param idempotencyKey - UUID v4 idempotency key
   * @param requestHash - SHA-256 hash of request body
   * @returns true if conflict exists (key exists with different hash), false otherwise
   */
  static async checkConflict(
    idempotencyKey: string,
    requestHash: string
  ): Promise<boolean> {
    const record = await this.get(idempotencyKey);

    if (!record) {
      return false; // No conflict if key doesn't exist
    }

    return record.requestHash !== requestHash;
  }

  /**
   * Get Redis key for idempotency key
   */
  private static getKey(idempotencyKey: string): string {
    return `${this.KEY_PREFIX}${idempotencyKey}`;
  }
}

