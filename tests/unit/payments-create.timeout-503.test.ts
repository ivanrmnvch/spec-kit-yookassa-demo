import { Request, Response } from "express";
import { createPayment } from "../../src/controllers/payments.controller";
import { PaymentsService } from "../../src/services/payment.service";
import { AxiosError } from "axios";
import { RetryableUpstreamError } from "../../src/types/errors";

// Mock PaymentsService
jest.mock("../../src/services/payment.service");
const mockedPaymentsService = PaymentsService as jest.Mocked<typeof PaymentsService>;

// Mock env and database to prevent Prisma/Redis connection issues
jest.mock("../../src/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    YOOKASSA_SHOP_ID: "test-shop-id",
    YOOKASSA_SECRET_KEY: "test-secret-key",
    YOOKASSA_BASE_URL: "https://api.yookassa.ru/v3",
  },
}));
jest.mock("../../src/config/database", () => ({
  getPrismaClient: jest.fn(),
}));

describe("PaymentsController.createPayment - Timeout 503", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    nextFunction = jest.fn();

    mockRequest = {
      body: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        amount: {
          value: "100.00",
          currency: "RUB",
        },
        returnUrl: "https://example.com/return",
      },
      headers: {
        "idempotence-key": "550e8400-e29b-41d4-a716-446655440000",
      },
      correlationId: "test-correlation-id",
    } as unknown as Request;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("503 retryable envelope on timeout", () => {
    it("should return 503 with retryable=true when YooKassa times out", async () => {
      // Simulate YooKassa timeout (ECONNABORTED or ETIMEDOUT)
      const timeoutError = new AxiosError("timeout of 35000ms exceeded");
      timeoutError.code = "ECONNABORTED";
      timeoutError.config = {
        method: "post",
        url: "/payments",
        headers: {
          "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
        },
      } as unknown as AxiosError["config"];

      // Mock PaymentsService to throw RetryableUpstreamError (which is what payment.service does)
      mockedPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa request timeout")
      );

      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Error should be passed to error handler
      expect(nextFunction).toHaveBeenCalled();
      const error = nextFunction.mock.calls[0][0] as Error & {
        statusCode?: number;
        retryable?: boolean;
        sameIdempotenceKey?: boolean;
      };

      // Error should have retryable flags
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
      expect(error.sameIdempotenceKey).toBe(true);
    });

    it("should return 503 with retryable=true when YooKassa connection times out", async () => {
      // Simulate connection timeout (ETIMEDOUT)
      const timeoutError = new AxiosError("connect ETIMEDOUT");
      timeoutError.code = "ETIMEDOUT";
      timeoutError.config = {
        method: "post",
        url: "/payments",
        headers: {
          "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
        },
      } as unknown as AxiosError["config"];

      // Mock PaymentsService to throw RetryableUpstreamError (which is what payment.service does)
      mockedPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa request timeout")
      );

      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      const error = nextFunction.mock.calls[0][0] as Error & {
        statusCode?: number;
        retryable?: boolean;
        sameIdempotenceKey?: boolean;
      };

      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
      expect(error.sameIdempotenceKey).toBe(true);
    });

    it("should include sameIdempotenceKey=true in error for idempotent retries", async () => {
      // Timeout errors should indicate that same idempotence key should be used
      const timeoutError = new AxiosError("timeout of 35000ms exceeded");
      timeoutError.code = "ECONNABORTED";
      timeoutError.config = {
        method: "post",
        url: "/payments",
        headers: {
          "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
        },
      } as unknown as AxiosError["config"];

      // Mock PaymentsService to throw RetryableUpstreamError (which is what payment.service does)
      mockedPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa request timeout")
      );

      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      const error = nextFunction.mock.calls[0][0] as Error & {
        sameIdempotenceKey?: boolean;
      };

      expect(error.sameIdempotenceKey).toBe(true);
    });
  });
});

