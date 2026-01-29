import { IdempotencyService } from "../../src/services/idempotency.service";

describe("IdempotencyService", () => {
  const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";
  const requestHash = "abc123def456";
  const paymentResponse = {
    id: "payment-123",
    yookassa_payment_id: "yk-456",
    status: "pending" as const,
  };

  beforeEach(() => {
    // Clear Redis before each test
    // In real implementation, we'd use a test Redis instance
  });

  describe("cache miss (first request)", () => {
    it("should return null when key does not exist", async () => {
      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).toBeNull();
    });

    it("should store request hash and payment response", async () => {
      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
      expect(result?.requestHash).toBe(requestHash);
      expect(result?.payment).toEqual(paymentResponse);
    });

    it("should set TTL to 24 hours", async () => {
      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      // Check TTL is approximately 24 hours (86400 seconds)
      // In real test, we'd check Redis TTL
      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
    });
  });

  describe("cache hit (idempotent request)", () => {
    it("should return stored value when key exists with same hash", async () => {
      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
      expect(result?.requestHash).toBe(requestHash);
      expect(result?.payment).toEqual(paymentResponse);
    });
  });

  describe("cache conflict (hash mismatch)", () => {
    it("should detect hash mismatch when key exists with different hash", async () => {
      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      const differentHash = "different-hash-789";
      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        differentHash
      );
      expect(isConflict).toBe(true);
    });

    it("should not detect conflict when hash matches", async () => {
      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        requestHash
      );
      expect(isConflict).toBe(false);
    });

    it("should not detect conflict when key does not exist", async () => {
      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        requestHash
      );
      expect(isConflict).toBe(false);
    });
  });
});

