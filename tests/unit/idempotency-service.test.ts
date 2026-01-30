import { IdempotencyService } from "../../src/services/idempotency.service";

// Mock env
jest.mock("../../src/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    YOOKASSA_SHOP_ID: "test-shop-id",
    YOOKASSA_SECRET_KEY: "test-secret-key",
    YOOKASSA_BASE_URL: "https://api.yookassa.ru/v3",
  },
}));

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  setEx: jest.fn(),
  sendCommand: jest.fn(),
};

jest.mock("../../src/config/redis", () => ({
  getRedisClient: jest.fn(),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Get the mocked function after jest.mock
import { getRedisClient } from "../../src/config/redis";
const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

describe("IdempotencyService", () => {
  const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";
  const requestHash = "abc123def456";
  const paymentResponse = {
    id: "payment-123",
    yookassa_payment_id: "yk-456",
    status: "pending" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup Redis mock to return our mock client
    mockedGetRedisClient.mockResolvedValue(mockRedisClient as unknown as Awaited<ReturnType<typeof getRedisClient>>);
    // Reset Redis mocks
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setEx.mockResolvedValue("OK");
  });

  describe("cache miss (first request)", () => {
    it("should return null when key does not exist", async () => {
      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).toBeNull();
    });

    it("should store request hash and payment response", async () => {
      const storedRecord = {
        requestHash,
        payment: paymentResponse,
      };

      // Mock: set doesn't call get, it just calls setEx
      // After set, get should return the stored value
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(storedRecord));

      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      // Verify setEx was called
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey),
        expect.any(Number),
        expect.stringContaining(requestHash)
      );

      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
      expect(result?.requestHash).toBe(requestHash);
      expect(result?.payment).toEqual(paymentResponse);
    });

    it("should set TTL to 24 hours", async () => {
      const storedRecord = {
        requestHash,
        payment: paymentResponse,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedRecord));

      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      // Verify setEx was called with TTL of 24 hours (86400 seconds)
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey),
        24 * 60 * 60, // 24 hours in seconds
        expect.any(String)
      );

      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
    });
  });

  describe("cache hit (idempotent request)", () => {
    it("should return stored value when key exists with same hash", async () => {
      const storedRecord = {
        requestHash,
        payment: paymentResponse,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedRecord));

      await IdempotencyService.set(idempotencyKey, requestHash, paymentResponse);

      const result = await IdempotencyService.get(idempotencyKey);
      expect(result).not.toBeNull();
      expect(result?.requestHash).toBe(requestHash);
      expect(result?.payment).toEqual(paymentResponse);
    });
  });

  describe("cache conflict (hash mismatch)", () => {
    it("should detect hash mismatch when key exists with different hash", async () => {
      const storedRecord = {
        requestHash,
        payment: paymentResponse,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedRecord));

      const differentHash = "different-hash-789";
      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        differentHash
      );
      expect(isConflict).toBe(true);
    });

    it("should not detect conflict when hash matches", async () => {
      const storedRecord = {
        requestHash,
        payment: paymentResponse,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedRecord));

      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        requestHash
      );
      expect(isConflict).toBe(false);
    });

    it("should not detect conflict when key does not exist", async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const isConflict = await IdempotencyService.checkConflict(
        idempotencyKey,
        requestHash
      );
      expect(isConflict).toBe(false);
    });
  });
});

