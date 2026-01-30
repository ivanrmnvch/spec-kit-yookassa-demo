import { Request, Response } from "express";
import { PaymentsController } from "../../src/controllers/payments.controller";
import { IPaymentsService } from "../../src/interfaces/services/IPaymentsService";

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

describe("PaymentsController.getPayment - cancellation details", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;
  let nextFunction: jest.Mock;
  let mockPaymentsService: jest.Mocked<IPaymentsService>;
  let paymentsController: PaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    responseBody = null;
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
      params: {
        id: "550e8400-e29b-41d4-a716-446655440000",
      },
      correlationId: "test-correlation-id",
    } as unknown as Request;

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

  describe("cancellation details mapping", () => {
    it("should include cancellation_details when payment is canceled", async () => {
      const mockPayment = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        yookassa_payment_id: "yk-123",
        status: "canceled" as const,
        amount: "100.00",
        currency: "RUB",
        paid: false,
        cancellation_details: {
          party: "merchant",
          reason: "insufficient_funds",
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPaymentsService.getPaymentById.mockResolvedValue(mockPayment);

      await paymentsController.getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      const payment = responseBody as {
        status: string;
        cancellation_details?: {
          party: string;
          reason: string;
        };
      };

      expect(payment.status).toBe("canceled");
      expect(payment.cancellation_details).toBeDefined();
      expect(payment.cancellation_details?.party).toBe("merchant");
      expect(payment.cancellation_details?.reason).toBe("insufficient_funds");
    });

    it("should map cancellation_party and cancellation_reason to cancellation_details", async () => {
      const mockPayment = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        yookassa_payment_id: "yk-123",
        status: "canceled" as const,
        amount: "100.00",
        currency: "RUB",
        paid: false,
        cancellation_details: {
          party: "yoo_money",
          reason: "fraud_suspected",
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPaymentsService.getPaymentById.mockResolvedValue(mockPayment);

      await paymentsController.getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      const payment = responseBody as {
        status: string;
        cancellation_details?: {
          party: string;
          reason: string;
        };
      };

      expect(payment.status).toBe("canceled");
      expect(payment.cancellation_details).toBeDefined();
      expect(payment.cancellation_details).toHaveProperty("party");
      expect(payment.cancellation_details).toHaveProperty("reason");
      expect(typeof payment.cancellation_details!.party).toBe("string");
      expect(typeof payment.cancellation_details!.reason).toBe("string");
    });

    it("should not include cancellation_details for non-canceled payments", async () => {
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

      mockPaymentsService.getPaymentById.mockResolvedValue(mockPayment);

      await paymentsController.getPayment(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      const payment = responseBody as {
        status: string;
        cancellation_details?: unknown;
      };

      expect(payment.status).toBe("pending");
      expect(payment.cancellation_details).toBeUndefined();
    });
  });
});
