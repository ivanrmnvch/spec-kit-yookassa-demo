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

/**
 * Get payment by ID controller
 * Returns 200 with payment data, 404 if not found
 */
export async function getPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || "unknown";
  const paymentId = req.params.id;

  try {
    logger.info(
      {
        correlationId,
        paymentId,
      },
      "Fetching payment"
    );

    const payment = await PaymentsService.getPaymentById(paymentId);

    if (!payment) {
      logger.warn(
        {
          correlationId,
          paymentId,
        },
        "Payment not found"
      );

      res.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: `Payment with id ${paymentId} not found`,
        },
      });
      return;
    }

    logger.info(
      {
        correlationId,
        paymentId,
        status: payment.status,
      },
      "Payment fetched successfully"
    );

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
}

