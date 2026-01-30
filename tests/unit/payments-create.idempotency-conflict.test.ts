import { Request, Response } from "express";
import { createPayment } from "../../src/controllers/payments.controller";
import { PaymentsService } from "../../src/services/payment.service";

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

// Mock database to avoid Prisma import issues
jest.mock("../../src/config/database", () => ({
  getPrismaClient: jest.fn(),
}));

// Mock PaymentsService
jest.mock("../../src/services/payment.service");
const mockedPaymentsService = PaymentsService as jest.Mocked<typeof PaymentsService>;

describe("PaymentsController.createPayment - idempotency conflict", () => {
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

  it("should return 409 when idempotency key exists with different request hash", async () => {
    // First request with one body - succeeds
    const mockPayment = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      yookassa_payment_id: "yk-123",
      status: "pending" as const,
      amount: "100.00",
      currency: "RUB",
      paid: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockedPaymentsService.createPayment = jest
      .fn()
      .mockResolvedValueOnce({
        payment: mockPayment,
        isNew: true,
      })
      .mockImplementationOnce(() => {
        const error = new Error(
          "Idempotency key conflict: request body does not match previous request"
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 409;
        error.code = "IDEMPOTENCY_CONFLICT";
        throw error;
      });

    // First request
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Verify first request succeeded (status 201)
    expect(mockResponse.status).toHaveBeenCalledWith(201);

    // Second request with same idempotency key but different body
    mockRequest.body = {
      ...mockRequest.body,
      amount: {
        value: "200.00", // Different amount
        currency: "RUB",
      },
    };

    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Error should be passed to nextFunction
    expect(nextFunction).toHaveBeenCalled();
    const errorPassed = nextFunction.mock.calls[0][0] as Error & { statusCode?: number; code?: string };
    expect(errorPassed.statusCode).toBe(409);
    expect(errorPassed.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("should include message about request hash mismatch", async () => {
    const mockPayment = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      yookassa_payment_id: "yk-123",
      status: "pending" as const,
      amount: "100.00",
      currency: "RUB",
      paid: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockedPaymentsService.createPayment = jest
      .fn()
      .mockResolvedValueOnce({
        payment: mockPayment,
        isNew: true,
      })
      .mockImplementationOnce(() => {
        const error = new Error(
          "Idempotency key conflict: request body does not match previous request"
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 409;
        error.code = "IDEMPOTENCY_CONFLICT";
        throw error;
      });

    // Setup: first request
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Conflict: different body with same key
    mockRequest.body = {
      ...mockRequest.body,
      amount: {
        value: "200.00",
        currency: "RUB",
      },
    };

    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Error should be passed to nextFunction
    expect(nextFunction).toHaveBeenCalled();
    const errorPassed = nextFunction.mock.calls[0][0] as Error & { message: string };
    expect(errorPassed.message.toLowerCase()).toContain("idempotency");
    expect(errorPassed.message.toLowerCase()).toMatch(/request|body|match|previous/);
  });
});

