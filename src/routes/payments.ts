import { Router, Request, Response, NextFunction } from "express";

import { idempotenceKeyMiddleware } from "../middlewares/idempotence-key";
import { validateCreatePaymentRequest } from "../middlewares/validation";
import { createPaymentRateLimiter, createGeneralRateLimiter } from "../middlewares/rate-limiter";

/**
 * Create payments routes factory function
 * Returns an Express Router configured with payment routes
 * @param createPaymentController - Controller function for creating payments
 * @param getPaymentController - Controller function for getting payments
 * @returns Express Router with payment routes configured
 */
export function createPaymentsRoutes(
  createPaymentController: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  getPaymentController: (req: Request, res: Response, next: NextFunction) => Promise<void>
): Router {
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
    createPaymentController
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
    getPaymentController
  );

  return router;
}
