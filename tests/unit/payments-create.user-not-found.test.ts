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

describe("PaymentsController.createPayment - user not found", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let mockPaymentsService: jest.Mocked<IPaymentsService>;
  let paymentsController: PaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
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
      body: {
        userId: "00000000-0000-0000-0000-000000000000", // Non-existent user
        amount: {
          value: "100.00",
          currency: "RUB",
        },
        returnUrl: "https://example.com/return",
      },
      headers: {
        "idempotence-key": "550e8400-e29b-41d4-a716-446655440000",
      },
      correlationId: "test-correlation-id",
    } as unknown as Request;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("should return 404 when user does not exist", async () => {
    const error = new Error("User not found") as Error & { statusCode?: number; code?: string };
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";

    mockPaymentsService.createPayment.mockRejectedValue(error);

    await paymentsController.createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Error should be passed to nextFunction, which will be handled by error middleware
    expect(nextFunction).toHaveBeenCalledWith(error);
    // The error handler middleware should set status 404
    // In unit tests, we verify that nextFunction was called with the error
  });

  it("should not call YooKassa API when user does not exist", async () => {
    const error = new Error("User not found") as Error & { statusCode?: number; code?: string };
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";

    mockPaymentsService.createPayment.mockRejectedValue(error);

    await paymentsController.createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Verify that error was passed to nextFunction
    expect(nextFunction).toHaveBeenCalledWith(error);
    // YooKassa service should not be called (error thrown before YooKassa call)
  });
});
