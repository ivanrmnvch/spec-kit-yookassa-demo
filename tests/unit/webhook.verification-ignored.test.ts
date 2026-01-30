import { Request, Response } from "express";
import { WebhooksController } from "../../src/controllers/webhooks.controller";
import { IWebhookService } from "../../src/interfaces/services/IWebhookService";

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
  let mockWebhookService: jest.Mocked<IWebhookService>;
  let webhooksController: WebhooksController;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    nextFunction = jest.fn();

    // Create mocks
    mockWebhookService = {
      processWebhook: jest.fn(),
    } as unknown as jest.Mocked<IWebhookService>;

    // Create controller instance with mocked service
    webhooksController = new WebhooksController(mockWebhookService);

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
      mockWebhookService.processWebhook.mockResolvedValue({
        processed: false,
        reason: "payment_not_found",
      });

      await webhooksController.processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when YooKassa GET returns status mismatch (suspicious webhook)", async () => {
      // Simulate status mismatch - webhook says succeeded, but YooKassa says pending
      mockWebhookService.processWebhook.mockResolvedValue({
        processed: false,
        reason: "status_mismatch",
      });

      await webhooksController.processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when webhook is ignored (already processed)", async () => {
      // Simulate webhook being ignored (duplicate or already processed)
      mockWebhookService.processWebhook.mockResolvedValue({
        processed: false,
        reason: "already_processed",
      });

      await webhooksController.processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockWebhookService.processWebhook).toHaveBeenCalled();
    });
  });
});
