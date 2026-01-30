import { Request, Response, NextFunction } from "express";

import { PaymentsService } from "../services/payment.service";
import { logger } from "../utils/logger";

/**
 * Create payment controller factory function
 * Returns a controller function that uses the provided PaymentsService instance
 * @param paymentsService - PaymentsService instance
 * @returns Controller function that handles payment creation
 */
export function createPaymentController(
  paymentsService: PaymentsService
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async function createPayment(
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

      const result = await paymentsService.createPayment(req.body, idempotenceKey);

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
  };
}

/**
 * Get payment by ID controller factory function
 * Returns a controller function that uses the provided PaymentsService instance
 * @param paymentsService - PaymentsService instance
 * @returns Controller function that handles payment retrieval
 */
export function getPaymentController(
  paymentsService: PaymentsService
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async function getPayment(
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

      const payment = await paymentsService.getPaymentById(paymentId);

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
  };
}
