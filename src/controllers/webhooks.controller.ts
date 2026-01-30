import { Request, Response, NextFunction } from "express";

import { WebhookService } from "../services/webhook.service";
import { logger } from "../utils/logger";
import { YooKassaWebhookPayload } from "../types/yookassa.types";

/**
 * Process webhook controller factory function
 * Returns a controller function that uses the provided WebhookService instance
 * @param webhookService - WebhookService instance
 * @returns Controller function that handles webhook processing
 */
export function processWebhookController(
  webhookService: WebhookService
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async function processWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || "unknown";
    const payload = (req as Request & { validatedWebhookPayload: YooKassaWebhookPayload })
      .validatedWebhookPayload;

    try {
      logger.info(
        {
          correlationId,
          paymentId: payload.object.id,
          event: payload.event,
        },
        "Processing webhook notification"
      );

      const result = await webhookService.processWebhook(payload, correlationId);

      if (!result.processed) {
        // Webhook ignored (fake, status mismatch, etc.) - return 200
        logger.info(
          {
            correlationId,
            paymentId: payload.object.id,
            reason: result.reason,
          },
          "Webhook ignored (fake or status mismatch)"
        );

        res.status(200).json({
          message: "Webhook received and processed",
          processed: false,
          reason: result.reason,
        });
        return;
      }

      // Webhook processed successfully
      logger.info(
        {
          correlationId,
          paymentId: payload.object.id,
          internalPaymentId: result.paymentId,
          restored: result.restored,
          statusUpdated: result.statusUpdated,
        },
        "Webhook processed successfully"
      );

      res.status(200).json({
        message: "Webhook processed successfully",
        processed: true,
        paymentId: result.paymentId,
        restored: result.restored,
        statusUpdated: result.statusUpdated,
      });
    } catch (error) {
      const paymentId = payload?.object?.id || "unknown";
      logger.error(
        {
          correlationId,
          paymentId,
          error,
        },
        "Error processing webhook"
      );

      // Check if it's a validation error (should return 400)
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        (error.message.includes("userId") || error.message.includes("metadata"))
      ) {
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: error.message,
          },
        });
        return;
      }

      // Internal error - return 500 (retry desired)
      next(error);
    }
  };
}
