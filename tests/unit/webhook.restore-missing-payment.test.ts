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

describe("WebhookController - Restore Missing Payment", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;
  let nextFunction: jest.Mock;
  let mockWebhookService: jest.Mocked<IWebhookService>;
  let webhooksController: WebhooksController;

  beforeEach(() => {
    jest.clearAllMocks();
    responseStatus = 0;
    responseBody = null;
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
        metadata: {
          userId: "550e8400-e29b-41d4-a716-446655440000",
        },
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
      json: jest.fn().mockImplementation((body: unknown) => {
        responseBody = body;
        return mockResponse as Response;
      }),
    };
  });

  describe("webhook-before-POST restore", () => {
    it("should restore payment when webhook arrives before POST /api/payments", async () => {
      // Simulate webhook arriving before payment is created locally
      mockWebhookService.processWebhook.mockResolvedValue({
        processed: true,
        restored: true,
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      await webhooksController.processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockWebhookService.processWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          object: expect.objectContaining({
            id: "yk-123",
          }),
        }),
        "test-correlation-id"
      );
    });

    it("should handle unique constraint conflict during restore (race condition)", async () => {
      // Simulate race condition: payment was created between webhook arrival and restore attempt
      mockWebhookService.processWebhook.mockResolvedValue({
        processed: true,
        restored: false, // Restore failed due to conflict, but payment exists now
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      await webhooksController.processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should return 400 when restore fails due to missing userId in metadata", async () => {
      // Simulate webhook without userId in metadata (cannot restore)
      const payloadWithoutUserId = {
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
          metadata: {}, // userId missing
        },
      };

      const requestWithoutUserId = {
        ...mockRequest,
        body: payloadWithoutUserId,
        validatedWebhookPayload: payloadWithoutUserId,
      } as Request;

      mockWebhookService.processWebhook.mockRejectedValue(
        new Error("Cannot restore payment: userId missing in metadata")
      );

      await webhooksController.processWebhook(
        requestWithoutUserId,
        mockResponse as Response,
        nextFunction
      );

      // Controller returns 400 for validation errors (userId/metadata related)
      expect(responseStatus).toBe(400);
      expect(responseBody).toHaveProperty("error");
      expect((responseBody as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST"
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
