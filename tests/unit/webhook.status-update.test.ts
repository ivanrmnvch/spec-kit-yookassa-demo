import { Request, Response, NextFunction } from "express";
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

describe("WebhookController - Status Update", () => {
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
      json: jest.fn().mockImplementation((body: unknown) => {
        responseBody = body;
        return mockResponse as Response;
      }),
    };
  });

  describe("idempotent status update", () => {
    it("should update status from pending to succeeded", async () => {
      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: true,
        statusUpdated: true,
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should be idempotent when same webhook is processed multiple times", async () => {
      // First call
      mockedWebhookService.processWebhook = jest
        .fn()
        .mockResolvedValueOnce({
          processed: true,
          statusUpdated: true,
          paymentId: "550e8400-e29b-41d4-a716-446655440000",
        })
        .mockResolvedValueOnce({
          processed: true,
          statusUpdated: false, // Already processed, no update needed
          paymentId: "550e8400-e29b-41d4-a716-446655440000",
        });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);

      // Second call with same webhook (idempotent)
      responseStatus = 0;
      responseBody = null;

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalledTimes(2);
    });
  });

  describe("final-state immutability", () => {
    it("should not update status when payment is already succeeded (final state)", async () => {
      // Simulate webhook for already-succeeded payment
      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: true,
        statusUpdated: false, // Status already final, no update
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      await processWebhook(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should not update status when payment is already canceled (final state)", async () => {
      const canceledPayload = {
        type: "notification" as const,
        event: "payment.canceled" as const,
        object: {
          id: "yk-123",
          status: "canceled" as const,
          paid: false,
          amount: {
            value: "100.00",
            currency: "RUB" as const,
          },
          created_at: "2024-01-01T00:00:00.000Z",
        },
      };

      const canceledRequest = {
        ...mockRequest,
        body: canceledPayload,
        validatedWebhookPayload: canceledPayload,
      } as Request;

      mockedWebhookService.processWebhook = jest.fn().mockResolvedValue({
        processed: true,
        statusUpdated: false, // Status already final, no update
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      await processWebhook(
        canceledRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(200);
      expect(mockedWebhookService.processWebhook).toHaveBeenCalled();
    });

    it("should reject invalid transition from succeeded to canceled", async () => {
      // Simulate invalid transition attempt (should be caught by state machine)
      mockedWebhookService.processWebhook = jest.fn().mockRejectedValue(
        new Error("Invalid state transition: succeeded → canceled")
      );

      const canceledPayload = {
        type: "notification" as const,
        event: "payment.canceled" as const,
        object: {
          id: "yk-123",
          status: "canceled" as const,
          paid: false,
          amount: {
            value: "100.00",
            currency: "RUB" as const,
          },
          created_at: "2024-01-01T00:00:00.000Z",
        },
      };

      const canceledRequest = {
        ...mockRequest,
        body: canceledPayload,
        validatedWebhookPayload: canceledPayload,
      } as Request;

      await processWebhook(
        canceledRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      const error = nextFunction.mock.calls[0][0] as Error;
      expect(error.message).toContain("Invalid state transition");
    });
  });
});

