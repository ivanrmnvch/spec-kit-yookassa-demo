import { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { logger } from "../utils/logger";
import { YooKassaWebhookPayload } from "../types/yookassa.types";

/**
 * Zod schema for webhook payload validation
 * Requires object.id (payment ID) to be present
 */
const webhookPayloadSchema = z.object({
  type: z.literal("notification"),
  event: z.enum(["payment.succeeded", "payment.canceled"]),
  object: z.object({
    id: z.string().min(1, "Payment ID is required"),
    status: z.enum(["pending", "succeeded", "canceled"]),
    paid: z.boolean(),
    amount: z.object({
      value: z.string(),
      currency: z.string(),
    }),
    created_at: z.string(),
    description: z.string().optional(),
    metadata: z.record(z.string()).optional(),
    payment_method: z.any().optional(),
    cancellation_details: z.any().optional(),
    captured_at: z.string().optional(),
  }),
});

/**
 * Middleware to validate webhook payload
 * Requires object.id (payment ID) to be present
 * Returns 400 Bad Request if validation fails
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function validateWebhookPayload(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || "unknown";

  try {
    const result = webhookPayloadSchema.safeParse(req.body);

    if (!result.success) {
      logger.warn(
        {
          correlationId,
          errors: result.error.errors,
        },
        "Webhook payload validation failed"
      );

      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid webhook payload: payment ID (object.id) is required",
          details: result.error.errors,
        },
      });
      return;
    }

    // Attach validated payload to request for use in controller
    (req as Request & { validatedWebhookPayload: YooKassaWebhookPayload }).validatedWebhookPayload =
      result.data as YooKassaWebhookPayload;

    logger.debug(
      {
        correlationId,
        paymentId: result.data.object.id,
        event: result.data.event,
      },
      "Webhook payload validation passed"
    );

    next();
  } catch (error) {
    logger.error(
      {
        correlationId,
        error,
      },
      "Unexpected error during webhook payload validation"
    );
    next(error);
  }
}

