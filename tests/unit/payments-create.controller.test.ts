import { Request, Response } from "express";
import { createPayment } from "../../src/controllers/payments.controller";

describe("PaymentsController.createPayment", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseStatus: number;
  let responseBody: unknown;

  beforeEach(() => {
    responseStatus = 0;
    responseBody = null;

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

  describe("status codes", () => {
    it("should return 201 on first request (cache miss)", async () => {
      // First request - idempotency key not found
      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(responseStatus).toBe(201);
      expect(responseBody).toHaveProperty("id");
      expect(responseBody).toHaveProperty("yookassa_payment_id");
      expect(responseBody).toHaveProperty("confirmation_url");
    });

    it("should return 200 on idempotent request (cache hit)", async () => {
      // First request
      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      const firstResponseBody = responseBody;
      responseStatus = 0;
      responseBody = null;

      // Second request with same idempotency key
      await createPayment(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(responseStatus).toBe(200);
      expect(responseBody).toEqual(firstResponseBody);
    });
  });
});

