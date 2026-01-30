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

describe("PaymentsController.createPayment", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    responseBody = null;

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
    };

    mockResponse = {
      status: jest.fn().mockImplementation((code: number) => {
        responseStatus = code;
        return mockResponse as Response;
      }),
      json: jest.fn().mockImplementation((body: unknown) => {
        responseBody = body;
        return mockResponse as Response;
      }),
    };
  });

  describe("status codes", () => {
    it("should return 201 on first request (cache miss)", async () => {
      const mockPayment = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        yookassa_payment_id: "yk-123",
        status: "pending" as const,
        amount: "100.00",
        currency: "RUB",
        paid: false,
        confirmation_url: "https://yookassa.ru/confirmation",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedPaymentsService.createPayment = jest.fn().mockResolvedValue({
        payment: mockPayment,
        isNew: true,
      });

      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(responseStatus).toBe(201);
      expect(responseBody).toHaveProperty("id");
      expect(responseBody).toHaveProperty("yookassa_payment_id");
      expect(responseBody).toHaveProperty("confirmation_url");
    });

    it("should return 200 on idempotent request (cache hit)", async () => {
      const mockPayment = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        yookassa_payment_id: "yk-123",
        status: "pending" as const,
        amount: "100.00",
        currency: "RUB",
        paid: false,
        confirmation_url: "https://yookassa.ru/confirmation",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedPaymentsService.createPayment = jest.fn().mockResolvedValue({
        payment: mockPayment,
        isNew: false,
      });

      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(responseStatus).toBe(200);
      expect(responseBody).toEqual(mockPayment);
    });
  });
});

