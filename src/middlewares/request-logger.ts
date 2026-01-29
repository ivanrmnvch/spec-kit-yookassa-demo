import type { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger";

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;

    logger.child({ correlationId: req.correlationId }).info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      },
      "http_request",
    );
  });

  next();
}
