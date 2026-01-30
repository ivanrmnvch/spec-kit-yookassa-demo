import { Request, Response } from "express";
import { createPaymentController } from "../../src/controllers/payments.controller";
import { PaymentsService } from "../../src/services/payment.service";
import { UserRepository } from "../../src/repositories/user.repository";
import { PaymentRepository } from "../../src/repositories/payment.repository";
import { IIdempotencyService } from "../../src/services/interfaces/idempotency-service.interface";
import { IYookassaService } from "../../src/services/interfaces/yookassa-service.interface";
import { AxiosError } from "axios";
import { RetryableUpstreamError } from "../../src/types/errors";

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
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPaymentRepository: jest.Mocked<PaymentRepository>;
  let mockIdempotencyService: jest.Mocked<IIdempotencyService>;
  let mockYookassaService: jest.Mocked<IYookassaService>;
  let paymentsService: PaymentsService;
  let createPayment: (req: Request, res: Response, next: () => void) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    nextFunction = jest.fn();

    // Create mocks
    mockUserRepository = {
      existsById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    mockPaymentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByYooKassaId: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepository>;

    mockIdempotencyService = {
      get: jest.fn(),
      set: jest.fn(),
      checkConflict: jest.fn(),
    } as unknown as jest.Mocked<IIdempotencyService>;

    mockYookassaService = {
      createPayment: jest.fn(),
      getPayment: jest.fn(),
    } as unknown as jest.Mocked<IYookassaService>;

    // Create service instance with mocks
    paymentsService = new PaymentsService(
      mockUserRepository,
      mockPaymentRepository,
      mockIdempotencyService,
      mockYookassaService
    );

    // Create controller via factory function
    createPayment = createPaymentController(paymentsService);

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
      jest.spyOn(paymentsService, "createPayment").mockRejectedValue(
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
      jest.spyOn(paymentsService, "createPayment").mockRejectedValue(
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
      jest.spyOn(paymentsService, "createPayment").mockRejectedValue(
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
