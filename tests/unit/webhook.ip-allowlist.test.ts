import { Request, Response, NextFunction } from "express";
import { webhookIpAllowlistMiddleware } from "../../src/middlewares/webhook-ip-allowlist";

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

describe("Webhook IP Allowlist Middleware", () => {
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
      ip: "192.168.1.1",
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

  describe("IP allowlist enforcement", () => {
    it("should return 403 when request comes from non-allowlisted IP", async () => {
      // Simulate request from non-YooKassa IP
      const request = {
        ...mockRequest,
        ip: "192.168.1.1", // Non-allowlisted IP
      } as Request;

      await webhookIpAllowlistMiddleware(
        request,
        mockResponse as Response,
        nextFunction
      );

      expect(responseStatus).toBe(403);
      expect(responseBody).toHaveProperty("error");
      expect((responseBody as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN"
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should allow request from YooKassa IP range (185.71.76.0/27)", async () => {
      const request = {
        ...mockRequest,
        ip: "185.71.76.1", // YooKassa IP range
      } as Request;

      await webhookIpAllowlistMiddleware(
        request,
        mockResponse as Response,
        nextFunction
      );

      // Should call next() for allowed IP
      expect(nextFunction).toHaveBeenCalled();
      expect(responseStatus).toBe(0); // No response sent
    });

    it("should allow request from YooKassa IP range (77.75.153.0/25)", async () => {
      const request = {
        ...mockRequest,
        ip: "77.75.153.1", // YooKassa IP range
      } as Request;

      await webhookIpAllowlistMiddleware(
        request,
        mockResponse as Response,
        nextFunction
      );

      // Should call next() for allowed IP
      expect(nextFunction).toHaveBeenCalled();
      expect(responseStatus).toBe(0); // No response sent
    });
  });
});

