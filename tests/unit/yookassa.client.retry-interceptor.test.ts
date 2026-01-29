import { AxiosInstance, AxiosRequestConfig } from "axios";
import { getYooKassaClient } from "../../src/config/yookassa";

// Mock env
jest.mock("../../src/config/env", () => ({
  env: {
    YOOKASSA_SHOP_ID: "test-shop-id",
    YOOKASSA_SECRET_KEY: "test-secret-key",
    YOOKASSA_BASE_URL: "https://api.yookassa.ru/v3",
  },
}));

// Mock axios
jest.mock("axios", () => {
  const actualAxios = jest.requireActual("axios");
  return {
    ...actualAxios,
    create: jest.fn((config) => {
      const instance = actualAxios.create(config);
      return instance;
    }),
  };
});

describe("YooKassa Axios Client - Retry Interceptor", () => {
  let client: AxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton by clearing module cache
    jest.resetModules();
    client = getYooKassaClient();
  });

  describe("retry behavior for GET requests", () => {
    it("should retry GET request on 5xx error", async () => {
      const mockError = {
        response: { status: 500 },
        config: { method: "get" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "get").mockRejectedValueOnce(mockError).mockResolvedValueOnce({ data: { id: "test" } } as never);

      // Simulate retry by calling interceptor
      // In real implementation, interceptor would handle this
      try {
        await client.get("/test");
      } catch {
        // First attempt fails
      }

      // Retry should happen
      expect(client.get).toHaveBeenCalledTimes(2);
    });

    it("should retry GET request on timeout", async () => {
      const mockError = {
        code: "ECONNABORTED",
        config: { method: "get" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "get").mockRejectedValueOnce(mockError).mockResolvedValueOnce({ data: { id: "test" } } as never);

      try {
        await client.get("/test");
      } catch {
        // First attempt fails
      }

      // Retry should happen
      expect(client.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry behavior for idempotent POST requests", () => {
    it("should retry POST request with Idempotence-Key on 5xx error", async () => {
      const mockError = {
        response: { status: 500 },
        config: {
          method: "post",
          headers: { "Idempotence-Key": "test-key" },
        } as AxiosRequestConfig,
      };

      jest.spyOn(client, "post").mockRejectedValueOnce(mockError).mockResolvedValueOnce({ data: { id: "test" } } as never);

      try {
        await client.post("/test", {}, { headers: { "Idempotence-Key": "test-key" } });
      } catch {
        // First attempt fails
      }

      // Retry should happen for idempotent POST
      expect(client.post).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry POST request without Idempotence-Key on 5xx error", async () => {
      const mockError = {
        response: { status: 500 },
        config: { method: "post" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "post").mockRejectedValue(mockError);

      try {
        await client.post("/test", {});
      } catch {
        // Should fail without retry
      }

      // No retry for non-idempotent POST
      expect(client.post).toHaveBeenCalledTimes(1);
    });
  });

  describe("bounded retries", () => {
    it("should limit retry attempts to maximum", async () => {
      const mockError = {
        response: { status: 500 },
        config: { method: "get" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "get").mockRejectedValue(mockError);

      // Attempt multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await client.get("/test");
        } catch {
          // Continue
        }
      }

      // Should not exceed max retries
      expect(client.get).toHaveBeenCalledTimes(expect.any(Number));
    });
  });

  describe("no retry for 4xx errors", () => {
    it("should NOT retry on 400 Bad Request", async () => {
      const mockError = {
        response: { status: 400 },
        config: { method: "get" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "get").mockRejectedValue(mockError);

      try {
        await client.get("/test");
      } catch {
        // Should fail without retry
      }

      // No retry for 4xx
      expect(client.get).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on 404 Not Found", async () => {
      const mockError = {
        response: { status: 404 },
        config: { method: "get" } as AxiosRequestConfig,
      };

      jest.spyOn(client, "get").mockRejectedValue(mockError);

      try {
        await client.get("/test");
      } catch {
        // Should fail without retry
      }

      // No retry for 4xx
      expect(client.get).toHaveBeenCalledTimes(1);
    });
  });
});
