import { Request, Response } from "express";
import { getPayment } from "../../src/controllers/payments.controller";
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

describe("PaymentsController.getPayment", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    responseBody = null;
    nextFunction = jest.fn();

    mockRequest = {
      params: {
        id: "550e8400-e29b-41d4-a716-446655440000",
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
    it("should return 200 when payment exists", async () => {
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

      mockedPaymentsService.getPaymentById = jest.fn().mockResolvedValue(mockPayment);

      await getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(responseBody).toHaveProperty("id");
      expect(responseBody).toHaveProperty("yookassa_payment_id");
      expect(responseBody).toHaveProperty("status");
      expect(responseBody).toHaveProperty("amount");
      expect(responseBody).toHaveProperty("currency");
    });

    it("should return 404 when payment does not exist", async () => {
      mockRequest.params = {
        id: "00000000-0000-0000-0000-000000000000",
      };

      mockedPaymentsService.getPaymentById = jest.fn().mockResolvedValue(null);

      await getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(404);
      expect(responseBody).toHaveProperty("error");
      expect((responseBody as { error: { code: string } }).error.code).toBe(
        "PAYMENT_NOT_FOUND"
      );
    });
  });

  describe("response format", () => {
    it("should include both internal id and yookassa_payment_id", async () => {
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

      mockedPaymentsService.getPaymentById = jest.fn().mockResolvedValue(mockPayment);

      await getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      const payment = responseBody as { id: string; yookassa_payment_id: string };
      expect(payment.id).toBeDefined();
      expect(payment.yookassa_payment_id).toBeDefined();
      expect(typeof payment.id).toBe("string");
      expect(typeof payment.yookassa_payment_id).toBe("string");
    });
  });
});

