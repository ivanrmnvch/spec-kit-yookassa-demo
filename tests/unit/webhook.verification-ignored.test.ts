import { Request, Response } from "express";
import { processWebhook } from "../../src/controllers/webhooks.controller";
import { WebhookService } from "../../src/services/webhook.service";

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

// Mock webhook service
jest.mock("../../src/services/webhook.service");
const mockedWebhookService = WebhookService as jest.Mocked<typeof WebhookService>;

describe("WebhookController - Verification Ignored", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    nextFunction = jest.fn();

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
      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: false,
        reason: "payment_not_found",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when YooKassa GET returns status mismatch (suspicious webhook)", async () => {
      // Simulate status mismatch - webhook says succeeded, but YooKassa says pending
      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: false,
        reason: "status_mismatch",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 200 when webhook is ignored (already processed)", async () => {
      // Simulate webhook being ignored (duplicate or already processed)
      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: false,
        reason: "already_processed",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });
  });
});

