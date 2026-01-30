import { Request, Response, NextFunction } from "express";

/**
 * Validate UUID v4 format
 * @param uuid - String to validate
 * @returns true if valid UUID v4, false otherwise
 */
function isValidUUIDv4(uuid: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(uuid);
}

/**
 * Middleware to validate Idempotence-Key header
 * Requires UUID v4 format
 */
export function idempotenceKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const idempotenceKey = req.headers["idempotence-key"];

  if (!idempotenceKey) {
    res.status(400).json({
      error: {
        code: "MISSING_IDEMPOTENCE_KEY",
        message: "Idempotence-Key header is required",
      },
    });
    return;
  }

  if (typeof idempotenceKey !== "string") {
    res.status(400).json({
      error: {
        code: "INVALID_IDEMPOTENCE_KEY",
        message: "Idempotence-Key header must be a string",
      },
    });
    return;
  }

  // Validate UUID v4 format
  if (!isValidUUIDv4(idempotenceKey)) {
    res.status(400).json({
      error: {
        code: "INVALID_IDEMPOTENCE_KEY",
        message: "Idempotence-Key must be a valid UUID v4",
      },
    });
    return;
  }

  // Attach validated key to request for use in controllers
  (req as Request & { idempotenceKey: string }).idempotenceKey = idempotenceKey;

  next();
}

