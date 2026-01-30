import { Router, Request, Response, NextFunction } from "express";

import { createPayment, getPayment } from "../controllers/payments.controller";
import { idempotenceKeyMiddleware } from "../middlewares/idempotence-key";
import { validateCreatePaymentRequest } from "../middlewares/validation";
import { createPaymentRateLimiter, createGeneralRateLimiter } from "../middlewares/rate-limiter";

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

/**
 * GET /api/payments/:id
 * Get payment by internal ID
 *
 * Middleware order:
 * 1. correlation-id (applied globally in app.ts)
 * 2. rate-limit (general API rate limiter)
 * 3. controller (fetches payment)
 */
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const rateLimiter = await createGeneralRateLimiter();
    return rateLimiter(req, res, next);
  },
  getPayment
);

export default router;

