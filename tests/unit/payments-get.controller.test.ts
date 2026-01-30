import { Request, Response } from "express";
import { getPaymentController } from "../../src/controllers/payments.controller";
import { PaymentsService } from "../../src/services/payment.service";
import { UserRepository } from "../../src/repositories/user.repository";
import { PaymentRepository } from "../../src/repositories/payment.repository";
import { IIdempotencyService } from "../../src/services/interfaces/idempotency-service.interface";
import { IYookassaService } from "../../src/services/interfaces/yookassa-service.interface";

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

describe("PaymentsController.getPayment", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;
  let nextFunction: jest.Mock;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPaymentRepository: jest.Mocked<PaymentRepository>;
  let mockIdempotencyService: jest.Mocked<IIdempotencyService>;
  let mockYookassaService: jest.Mocked<IYookassaService>;
  let paymentsService: PaymentsService;
  let getPayment: (req: Request, res: Response, next: () => void) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    responseBody = null;
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
    getPayment = getPaymentController(paymentsService);

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

      jest.spyOn(paymentsService, "getPaymentById").mockResolvedValue(mockPayment);

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

      jest.spyOn(paymentsService, "getPaymentById").mockResolvedValue(null);

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

      jest.spyOn(paymentsService, "getPaymentById").mockResolvedValue(mockPayment);

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
