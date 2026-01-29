import { Request, Response, NextFunction } from "express";

import { PaymentsService } from "../services/payment.service";
import { logger } from "../utils/logger";

/**
 * Create payment controller
 * Returns 201 for new payments, 200 for idempotent requests
 */
export async function createPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || "unknown";
  const idempotenceKey = (req as Request & { idempotenceKey: string }).idempotenceKey;

  try {
    logger.info(
      {
        correlationId,
        idempotenceKey,
        userId: req.body.userId,
        amount: req.body.amount?.value,
      },
      "Creating payment"
    );

    const result = await PaymentsService.createPayment(req.body, idempotenceKey);

    // Return 201 for new payment, 200 for idempotent replay
    const statusCode = result.isNew ? 201 : 200;

    logger.info(
      {
        correlationId,
        idempotenceKey,
        paymentId: result.payment.id,
        statusCode,
        isNew: result.isNew,
      },
      "Payment request completed"
    );

    res.status(statusCode).json(result.payment);
  } catch (error) {
    next(error);
  }
}

