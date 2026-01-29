import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // If later we add request/response logging, these redactions prevent accidental secret leaks.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.Authorization",
      "headers.authorization",
      "headers.Authorization",
      "auth.password",
      "password",
      "YOOKASSA_SECRET_KEY",
      "env.YOOKASSA_SECRET_KEY",
    ],
    censor: "[REDACTED]",
  },
});
