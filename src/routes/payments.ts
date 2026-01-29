import { Router, Request, Response, NextFunction } from "express";

import { createPayment } from "../controllers/payments.controller";
import { idempotenceKeyMiddleware } from "../middlewares/idempotence-key";
import { validateCreatePaymentRequest } from "../middlewares/validation";
import { createPaymentRateLimiter } from "../middlewares/rate-limiter";

const router = Router();

/**
 * POST /api/payments
 * Create a payment (idempotent)
 *
 * Middleware order:
 * 1. correlation-id (applied globally in app.ts)
 * 2. rate-limit (payment-specific rate limiter)
 * 3. idempotence-key (validates UUID v4 header)
 * 4. DTO validation (validates request body)
 * 5. controller (creates payment)
 */
router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    const rateLimiter = await createPaymentRateLimiter();
    return rateLimiter(req, res, next);
  },
  idempotenceKeyMiddleware,
  validateCreatePaymentRequest,
  createPayment
);

export default router;

