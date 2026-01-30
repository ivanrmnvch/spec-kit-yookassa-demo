import { Request, Response, NextFunction } from "express";

import { IPaymentsService } from "../interfaces/services/IPaymentsService";
import { logger } from "../utils/logger";

/**
 * Payments controller
 * Handles HTTP requests for payment operations
 */
export class PaymentsController {
  constructor(private readonly paymentsService: IPaymentsService) {}

  /**
   * Create payment controller method
   * Handles POST /api/payments requests
   */
  createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

      const result = await this.paymentsService.createPayment(req.body, idempotenceKey);

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

  /**
   * Get payment by ID controller method
   * Handles GET /api/payments/:id requests
   */
  getPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

      const payment = await this.paymentsService.getPaymentById(paymentId);

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
