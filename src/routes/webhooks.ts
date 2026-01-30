import { Router, Request, Response, NextFunction } from "express";

import { webhookIpAllowlistMiddleware } from "../middlewares/webhook-ip-allowlist";
import { validateWebhookPayload } from "../middlewares/webhook-payload";

/**
 * Create webhooks routes factory function
 * Returns an Express Router configured with webhook routes
 * @param processWebhookController - Controller function for processing webhooks
 * @returns Express Router with webhook routes configured
 */
export function createWebhooksRoutes(
  processWebhookController: (req: Request, res: Response, next: NextFunction) => Promise<void>
): Router {
  const router = Router();

  /**
   * POST /api/webhooks/yookassa
   * Receive YooKassa webhook notification
   * 
   * Middleware order:
   * 1. correlation-id (applied globally in app.ts)
   * 2. ip-allowlist (reject non-YooKassa IPs with 403)
   * 3. payload-validation (require object.id, return 400 if missing)
   * 4. controller (process webhook, return 200/400/500)
   * 
   * NOTE: Webhook endpoint MUST NOT be rate-limited per spec
   */
  router.post(
    "/yookassa",
    webhookIpAllowlistMiddleware,
    validateWebhookPayload,
    processWebhookController
  );

  return router;
}
