import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

const HEADER_NAME = "x-correlation-id";

export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  const incoming = req.header(HEADER_NAME);
  req.correlationId = incoming && incoming.length > 0 ? incoming : `req-${randomUUID()}`;
  next();
}
