import { Request, Response } from "express";
import { validateWebhookPayload } from "../../src/middlewares/webhook-payload";

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

describe("Webhook Payload Validation Middleware", () => {
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
      body: {
        type: "notification",
        event: "payment.succeeded",
        object: {
          id: "yk-123",
          status: "succeeded",
          paid: true,
          amount: {
            value: "100.00",
            currency: "RUB",
          },
        },
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

  describe("payload validation", () => {
    it("should return 400 when object.id is missing", async () => {
      const request = {
        ...mockRequest,
        body: {
          type: "notification",
          event: "payment.succeeded",
          object: {
            // id is missing
            status: "succeeded",
            paid: true,
          },
        },
      } as Request;

      await validateWebhookPayload(
        request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(400);
      expect(responseBody).toHaveProperty("error");
      expect((responseBody as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST"
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 400 when object is missing", async () => {
      const request = {
        ...mockRequest,
        body: {
          type: "notification",
          event: "payment.succeeded",
          // object is missing
        },
      } as Request;

      await validateWebhookPayload(
        request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(400);
      expect(responseBody).toHaveProperty("error");
      expect((responseBody as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST"
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should call next() when object.id is present", async () => {
      const request = {
        ...mockRequest,
        body: {
          type: "notification",
          event: "payment.succeeded",
          object: {
            id: "yk-123",
            status: "succeeded",
            paid: true,
            amount: {
              value: "100.00",
              currency: "RUB",
            },
            created_at: "2024-01-01T00:00:00.000Z",
          },
        },
      } as Request;

      await validateWebhookPayload(
        request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(responseStatus).toBe(0); // No response sent
    });
  });
});

