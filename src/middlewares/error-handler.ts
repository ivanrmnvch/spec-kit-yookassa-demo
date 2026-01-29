import type { ErrorRequestHandler } from "express";

import { logger } from "../utils/logger";

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    sameIdempotenceKey?: boolean;
  };
}

/**
 * Centralized error handler middleware.
 * Formats all errors into a consistent JSON envelope per OpenAPI spec.
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = req.correlationId || "unknown";

  // Log the error with correlation ID
  logger.child({ correlationId }).error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      path: req.path,
      method: req.method,
    },
    "Error handled by error handler middleware",
  );

  // Default error response
  let statusCode = 500;
  const envelope: ErrorEnvelope = {
    error: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    },
  };

  // Handle known error types
  if (err instanceof Error) {
    // Check for status code in error (common pattern)
    const status = (err as Error & { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 600) {
      statusCode = status;
    }

    // Map common error codes
    if (err.name === "ValidationError" || statusCode === 400) {
      statusCode = 400;
      envelope.error.code = "VALIDATION_ERROR";
      envelope.error.message = err.message || "Validation failed";
    } else if (statusCode === 404) {
      envelope.error.code = "NOT_FOUND";
      envelope.error.message = err.message || "Resource not found";
    } else if (statusCode === 409) {
      envelope.error.code = "CONFLICT";
      envelope.error.message = err.message || "Conflict";
    } else if (statusCode === 429) {
      envelope.error.code = "RATE_LIMIT_EXCEEDED";
      envelope.error.message = err.message || "Too many requests";
    } else if (statusCode === 403) {
      envelope.error.code = "FORBIDDEN";
      envelope.error.message = err.message || "Forbidden";
    } else if (statusCode === 503) {
      envelope.error.code = "SERVICE_UNAVAILABLE";
      envelope.error.message = err.message || "Service unavailable";
      envelope.error.retryable = true;
      // Check if sameIdempotenceKey should be set
      if ((err as Error & { sameIdempotenceKey?: boolean }).sameIdempotenceKey) {
        envelope.error.sameIdempotenceKey = true;
      }
    }
  }

  // In production, don't expose internal error details
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    envelope.error.message = "Internal server error";
  }

  res.status(statusCode).json(envelope);
};
