import { Request, Response } from "express";
import { createPayment } from "../../src/controllers/payments.controller";

describe("PaymentsController.createPayment - idempotency conflict", () => {
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
        userId: "550e8400-e29b-41d4-a716-446655440000",
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

  it("should return 409 when idempotency key exists with different request hash", async () => {
    // First request with one body
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toBe(201);

    // Second request with same idempotency key but different body
    mockRequest.body = {
      ...mockRequest.body,
      amount: {
        value: "200.00", // Different amount
        currency: "RUB",
      },
    };

    responseStatus = 0;
    responseBody = null;

    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toBe(409);
    expect(responseBody).toHaveProperty("error");
    expect((responseBody as { error: { code: string } }).error.code).toBe(
      "IDEMPOTENCY_CONFLICT"
    );
  });

  it("should include message about request hash mismatch", async () => {
    // Setup: first request
    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // Conflict: different body with same key
    mockRequest.body = {
      ...mockRequest.body,
      amount: {
        value: "200.00",
        currency: "RUB",
      },
    };

    responseStatus = 0;
    responseBody = null;

    await createPayment(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toBe(409);
    expect(responseBody).toHaveProperty("error");
    const error = (responseBody as { error: { message: string } }).error;
    expect(error.message).toContain("idempotency");
    expect(error.message).toContain("hash");
  });
});

