import { Request, Response } from "express";
import { PaymentsController } from "../../src/controllers/payments.controller";
import { IPaymentsService } from "../../src/interfaces/services/IPaymentsService";
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

describe("PaymentsController.createPayment - 5xx 503", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let mockPaymentsService: jest.Mocked<IPaymentsService>;
  let paymentsController: PaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    nextFunction = jest.fn();

    // Create mocks
    mockPaymentsService = {
      createPayment: jest.fn(),
      getPaymentById: jest.fn(),
      updatePaymentStatus: jest.fn(),
    } as unknown as jest.Mocked<IPaymentsService>;

    // Create controller instance with mocked service
    paymentsController = new PaymentsController(mockPaymentsService);

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

  describe("503 retryable envelope on 5xx", () => {
    it("should return 503 with retryable=true when YooKassa returns 500", async () => {
      // Simulate YooKassa 500 error
      const serverError = new AxiosError("Internal Server Error");
      serverError.response = {
        status: 500,
        statusText: "Internal Server Error",
        data: {},
        headers: {},
        config: {
          method: "post",
          url: "/payments",
          headers: {
            "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
          },
        } as unknown as AxiosError["config"],
      } as AxiosError["response"];

      // Mock PaymentsService to throw RetryableUpstreamError (which is what payment.service does)
      mockPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa service error: 500 Internal Server Error")
      );

    await paymentsController.createPayment(
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

    it("should return 503 with retryable=true when YooKassa returns 503", async () => {
      // Simulate YooKassa 503 error
      const serviceUnavailableError = new AxiosError("Service Unavailable");
      serviceUnavailableError.response = {
        status: 503,
        statusText: "Service Unavailable",
        data: {},
        headers: {},
        config: {
          method: "post",
          url: "/payments",
          headers: {
            "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
          },
        } as unknown as AxiosError["config"],
      } as AxiosError["response"];

      mockPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa service error: 503 Service Unavailable")
      );

    await paymentsController.createPayment(
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

    it("should return 503 with retryable=true when YooKassa returns 502", async () => {
      // Simulate YooKassa 502 error
      const badGatewayError = new AxiosError("Bad Gateway");
      badGatewayError.response = {
        status: 502,
        statusText: "Bad Gateway",
        data: {},
        headers: {},
        config: {
          method: "post",
          url: "/payments",
          headers: {
            "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
          },
        } as unknown as AxiosError["config"],
      } as AxiosError["response"];

      mockPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa service error: 502 Bad Gateway")
      );

    await paymentsController.createPayment(
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

    it("should include sameIdempotenceKey=true for idempotent retries on 5xx", async () => {
      // 5xx errors should indicate that same idempotence key should be used
      const serverError = new AxiosError("Internal Server Error");
      serverError.response = {
        status: 500,
        statusText: "Internal Server Error",
        data: {},
        headers: {},
        config: {
          method: "post",
          url: "/payments",
          headers: {
            "Idempotence-Key": "550e8400-e29b-41d4-a716-446655440000",
          },
        } as unknown as AxiosError["config"],
      } as AxiosError["response"];

      // Mock PaymentsService to throw RetryableUpstreamError (which is what payment.service does)
      mockPaymentsService.createPayment.mockRejectedValue(
        new RetryableUpstreamError("YooKassa service error: 500 Internal Server Error")
      );

    await paymentsController.createPayment(
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
