import { Request, Response } from "express";
import { processWebhookController } from "../../src/controllers/webhooks.controller";
import { WebhookService } from "../../src/services/webhook.service";
import { PaymentRepository } from "../../src/repositories/payment.repository";
import { PaymentsService } from "../../src/services/payment.service";
import { IYookassaService } from "../../src/services/interfaces/yookassa-service.interface";
import { UserRepository } from "../../src/repositories/user.repository";
import { IIdempotencyService } from "../../src/services/interfaces/idempotency-service.interface";

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

describe("WebhookController - Verification Ignored", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let nextFunction: jest.Mock;
  let mockPaymentRepository: jest.Mocked<PaymentRepository>;
  let mockPaymentsService: jest.Mocked<PaymentsService>;
  let mockYookassaService: jest.Mocked<IYookassaService>;
  let webhookService: WebhookService;
  let processWebhook: (req: Request, res: Response, next: () => void) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    nextFunction = jest.fn();

    // Create mocks
    mockPaymentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByYooKassaId: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepository>;

    const mockUserRepository = {
      existsById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    const mockIdempotencyService = {
      get: jest.fn(),
      set: jest.fn(),
      checkConflict: jest.fn(),
    } as unknown as jest.Mocked<IIdempotencyService>;

    mockYookassaService = {
      createPayment: jest.fn(),
      getPayment: jest.fn(),
    } as unknown as jest.Mocked<IYookassaService>;

    // Create PaymentsService instance for WebhookService dependency
    mockPaymentsService = new PaymentsService(
      mockUserRepository,
      mockPaymentRepository,
      mockIdempotencyService,
      mockYookassaService
    ) as jest.Mocked<PaymentsService>;

    // Create WebhookService instance with mocks
    webhookService = new WebhookService(
      mockPaymentRepository,
      mockPaymentsService,
      mockYookassaService
    );

    // Create controller via factory function
    processWebhook = processWebhookController(webhookService);

    const webhookPayload = {
      type: "notification" as const,
      event: "payment.succeeded" as const,
      object: {
        id: "yk-123",
        status: "succeeded" as const,
        paid: true,
        amount: {
          value: "100.00",
          currency: "RUB" as const,
        },
        created_at: "2024-01-01T00:00:00.000Z",
      },
    };

    mockRequest = {
      body: webhookPayload,
      correlationId: "test-correlation-id",
      validatedWebhookPayload: webhookPayload,
    } as unknown as Request;

    mockResponse = {
      status: jest.fn().mockImplementation((code: number) => {
        responseStatus = code;
        return mockResponse as Response;
      }),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("fake webhook ignored", () => {
    it("should return 200 when YooKassa GET returns 404 (fake webhook)", async () => {
      // Simulate YooKassa API returning 404 (payment doesn't exist)
      jest.spyOn(webhookService, "processWebhook").mockResolvedValue({
        processed: false,
        reason: "payment_not_found",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(webhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when YooKassa GET returns status mismatch (suspicious webhook)", async () => {
      // Simulate status mismatch - webhook says succeeded, but YooKassa says pending
      jest.spyOn(webhookService, "processWebhook").mockResolvedValue({
        processed: false,
        reason: "status_mismatch",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(webhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when webhook is ignored (already processed)", async () => {
      // Simulate webhook being ignored (duplicate or already processed)
      jest.spyOn(webhookService, "processWebhook").mockResolvedValue({
        processed: false,
        reason: "already_processed",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(webhookService.processWebhook).toHaveBeenCalled();
    });
  });
});
