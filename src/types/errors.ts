/**
 * Domain error types for retryable upstream failures
 * Maps to OpenAPI spec error codes and retryable flags
 */

/**
 * Base error class for domain errors
 */
export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly sameIdempotenceKey: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    retryable: boolean = false,
    sameIdempotenceKey: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.sameIdempotenceKey = sameIdempotenceKey;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Retryable upstream failure (timeout or 5xx from YooKassa)
 * Returns 503 with retryable=true and sameIdempotenceKey=true
 */
export class RetryableUpstreamError extends DomainError {
  constructor(message: string = "Upstream service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE", true, true);
  }
}

/**
 * Error code mapping for retryable failures
 * Maps upstream error conditions to domain error types
 */
export const ERROR_CODE_MAP = {
  // Retryable errors (503)
  TIMEOUT: "SERVICE_UNAVAILABLE",
  UPSTREAM_5XX: "SERVICE_UNAVAILABLE",
  NETWORK_ERROR: "SERVICE_UNAVAILABLE",

  // Non-retryable errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/**
 * Check if an error is a retryable upstream failure
 * @param error - Error to check
 * @returns true if error is retryable upstream failure
 */
export function isRetryableUpstreamError(error: unknown): boolean {
  if (error instanceof RetryableUpstreamError) {
    return true;
  }

  // Check for Axios timeout/5xx errors
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code as string;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return true;
    }
  }

  // Check for Axios 5xx response
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response
  ) {
    const status = error.response.status as number;
    if (status >= 500 && status < 600) {
      return true;
    }
  }

  return false;
}

/**
 * Check if error should use same idempotence key on retry
 * @param error - Error to check
 * @returns true if same idempotence key should be used
 */
export function shouldUseSameIdempotenceKey(error: unknown): boolean {
  // Retryable upstream errors (timeout/5xx) should use same key
  if (isRetryableUpstreamError(error)) {
    return true;
  }

  // Check if error explicitly sets sameIdempotenceKey
  if (
    error &&
    typeof error === "object" &&
    "sameIdempotenceKey" in error &&
    error.sameIdempotenceKey === true
  ) {
    return true;
  }

  return false;
}

