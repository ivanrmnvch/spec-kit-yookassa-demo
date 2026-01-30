import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { shouldRetryRequest, isRetryableMethod } from "../../src/config/yookassa";

// Mock env (required because yookassa.ts imports env)
jest.mock("../../src/config/env", () => ({
  env: {
    YOOKASSA_SHOP_ID: "test-shop-id",
    YOOKASSA_SECRET_KEY: "test-secret-key",
    YOOKASSA_BASE_URL: "https://api.yookassa.ru/v3",
  },
}));

describe("YooKassa Axios Client - Retry Interceptor Logic", () => {
  describe("isRetryableMethod", () => {
    it("should return true for GET requests", () => {
      const config = { method: "get" } as InternalAxiosRequestConfig;
      expect(isRetryableMethod(config)).toBe(true);
    });

    it("should return true for POST requests with Idempotence-Key header", () => {
      const config = {
        method: "post",
        headers: { "Idempotence-Key": "test-key" } as Record<string, string>,
      } as unknown as InternalAxiosRequestConfig;
      expect(isRetryableMethod(config)).toBe(true);
    });

    it("should return false for POST requests without Idempotence-Key header", () => {
      const config = { method: "post" } as InternalAxiosRequestConfig;
      expect(isRetryableMethod(config)).toBe(false);
    });

    it("should handle case-insensitive Idempotence-Key header", () => {
      const config = {
        method: "post",
        headers: { "idempotence-key": "test-key" } as Record<string, string>,
      } as unknown as InternalAxiosRequestConfig;
      expect(isRetryableMethod(config)).toBe(true);
    });
  });

  describe("shouldRetryRequest", () => {
    describe("4xx errors", () => {
      it("should NOT retry on 400 Bad Request", () => {
        const error = {
          response: { status: 400 },
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(false);
      });

      it("should NOT retry on 404 Not Found", () => {
        const error = {
          response: { status: 404 },
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(false);
      });
    });

    describe("5xx errors", () => {
      it("should retry GET request on 500 error", () => {
        const error = {
          response: { status: 500 },
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should retry GET request on 503 error", () => {
        const error = {
          response: { status: 503 },
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should retry POST request with Idempotence-Key on 500 error", () => {
        const error = {
          response: { status: 500 },
        } as AxiosError;
        const config = {
          method: "post",
          headers: { "Idempotence-Key": "test-key" } as Record<string, string>,
        } as unknown as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should NOT retry POST request without Idempotence-Key on 500 error", () => {
        const error = {
          response: { status: 500 },
        } as AxiosError;
        const config = { method: "post" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(false);
      });
    });

    describe("timeout errors", () => {
      it("should retry GET request on ECONNABORTED", () => {
        const error = {
          code: "ECONNABORTED",
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should retry GET request on ETIMEDOUT", () => {
        const error = {
          code: "ETIMEDOUT",
        } as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should retry GET request on network error (no response)", () => {
        const error = {} as AxiosError;
        const config = { method: "get" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should retry POST request with Idempotence-Key on timeout", () => {
        const error = {
          code: "ECONNABORTED",
        } as AxiosError;
        const config = {
          method: "post",
          headers: { "Idempotence-Key": "test-key" } as Record<string, string>,
        } as unknown as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(true);
      });

      it("should NOT retry POST request without Idempotence-Key on timeout", () => {
        const error = {
          code: "ECONNABORTED",
        } as AxiosError;
        const config = { method: "post" } as InternalAxiosRequestConfig;
        expect(shouldRetryRequest(error, config)).toBe(false);
      });
    });
  });
});
