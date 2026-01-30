import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

import { env } from "./env";
import { logger } from "../utils/logger";

let yooKassaClient: AxiosInstance | null = null;

/**
 * YooKassa API configuration constants
 */
const YOOKASSA_CONFIG = {
  TIMEOUT_MS: 35000, // 35 seconds as per spec
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE_MS: 1000, // Base delay for exponential backoff
} as const;

/**
 * Extended Axios config with retry metadata
 */
interface RetryableAxiosConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

/**
 * Get or create YooKassa Axios client singleton
 * Includes retry interceptor for GET and idempotent POST requests
 */
export function getYooKassaClient(): AxiosInstance {
  if (yooKassaClient) {
    return yooKassaClient;
  }

  // Create axios instance
  yooKassaClient = axios.create({
    baseURL: env.YOOKASSA_BASE_URL,
    timeout: YOOKASSA_CONFIG.TIMEOUT_MS,
    auth: {
      username: env.YOOKASSA_SHOP_ID,
      password: env.YOOKASSA_SECRET_KEY,
    },
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add retry interceptor
  yooKassaClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryableAxiosConfig;

      // Don't retry if already retried or no config
      if (!config || config._retry) {
        return Promise.reject(error);
      }

      const retryCount = config._retryCount || 0;

      // Check if request should be retried
      const shouldRetry = shouldRetryRequest(error, config);

      if (shouldRetry && retryCount < YOOKASSA_CONFIG.MAX_RETRIES) {
        config._retry = true;
        config._retryCount = retryCount + 1;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * YOOKASSA_CONFIG.RETRY_DELAY_BASE_MS;
        await new Promise((resolve) => setTimeout(resolve, delay));

        logger.warn(
          {
            url: config.url,
            method: config.method,
            retryCount: config._retryCount,
            status: error.response?.status,
            errorCode: error.code,
          },
          "Retrying YooKassa request"
        );

        return yooKassaClient!.request(config);
      }

      return Promise.reject(error);
    }
  );

  return yooKassaClient;
}

/**
 * Determine if a request should be retried
 * - GET requests: retry on 5xx and timeouts
 * - POST requests: retry only if Idempotence-Key header is present (idempotent)
 * - Never retry on 4xx errors
 * 
 * Exported for unit testing
 */
export function shouldRetryRequest(
  error: AxiosError,
  config: InternalAxiosRequestConfig
): boolean {
  // Don't retry on 4xx errors (client errors)
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return false;
  }

  // Retry on 5xx errors (server errors)
  if (error.response && error.response.status >= 500) {
    return isRetryableMethod(config);
  }

  // Retry on timeouts and network errors
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || !error.response) {
    return isRetryableMethod(config);
  }

  return false;
}

/**
 * Check if HTTP method is safe to retry
 * - GET: always safe
 * - POST: safe only if Idempotence-Key header is present
 * 
 * Exported for unit testing
 */
export function isRetryableMethod(config: InternalAxiosRequestConfig): boolean {
  const method = config.method?.toLowerCase();

  if (method === "get") {
    return true;
  }

  if (method === "post") {
    // Check if Idempotence-Key header is present
    const idempotenceKey = config.headers?.["Idempotence-Key"] || config.headers?.["idempotence-key"];
    return !!idempotenceKey;
  }

  return false;
}

