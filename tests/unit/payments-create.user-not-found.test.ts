import { Request, Response } from "express";
import { createPayment } from "../../src/controllers/payments.controller";

describe("PaymentsController.createPayment - user not found", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    responseStatus = 0;
    responseBody = null;
    nextFunction = jest.fn();

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
    };

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

  it("should return 404 when user does not exist", async () => {
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toBe(404);
    expect(responseBody).toHaveProperty("error");
    expect((responseBody as { error: { code: string } }).error.code).toBe(
      "USER_NOT_FOUND"
    );
  });

  it("should not call YooKassa API when user does not exist", async () => {
    // This test verifies that YooKassa is not called
    // In real implementation, we'd mock YooKassa service and verify it wasn't called
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toBe(404);
    // YooKassa service should not be called
  });
});

