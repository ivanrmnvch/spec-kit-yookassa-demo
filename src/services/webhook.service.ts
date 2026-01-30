import { YooKassaWebhookPayload, YooKassaPaymentResponse } from "../types/yookassa.types";
import { IPaymentRepository } from "../interfaces/repositories/IPaymentRepository";
import { PaymentsService } from "./payment.service";
import { logger } from "../utils/logger";
import { PaymentStatus } from "../types/payment.types";
import { IYookassaService } from "../interfaces/services/IYookassaService";
import { IWebhookService, WebhookProcessingResult } from "../interfaces/services/IWebhookService";

/**
 * Webhook service
 * Orchestrates webhook processing: verify → restore if missing → update status
 */
export class WebhookService implements IWebhookService {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly paymentsService: PaymentsService,
    private readonly yookassaService: IYookassaService
  ) {}

  /**
   * Process webhook notification
   * Flow: verify → restore if missing → update status
   * 
   * Decision points:
   * 1. Verification: Check if payment exists in YooKassa (source of truth)
   * 2. Status validation: Check if webhook status matches verified status
   * 3. Restoration: Check if payment exists locally, restore if missing
   * 4. Status update: Update status using state machine (idempotent)
   * 
   * @param payload - Webhook payload from YooKassa
   * @param correlationId - Correlation ID for logging
   * @returns Processing result
   */
  async processWebhook(
    payload: YooKassaWebhookPayload,
    correlationId: string
  ): Promise<WebhookProcessingResult> {
    const yookassaPaymentId = payload.object.id;

    logger.info(
      {
        correlationId,
        yookassaPaymentId,
        event: payload.event,
        webhookStatus: payload.object.status,
      },
      "Processing webhook notification"
    );

    // Decision Point 1: Verify payment with YooKassa (source of truth)
    const verifiedPayment = await this.verifyPaymentWithYooKassa(
      yookassaPaymentId,
      correlationId
    );

    if (!verifiedPayment) {
      return {
        processed: false,
        reason: "payment_not_found",
      };
    }

    // Decision Point 2: Validate status match (prevent fake webhooks)
    const statusValid = this.validateStatusMatch(
      payload.object.status,
      verifiedPayment.status,
      yookassaPaymentId,
      correlationId
    );

    if (!statusValid) {
      return {
        processed: false,
        reason: "status_mismatch",
      };
    }

    // Decision Point 3: Find or restore payment locally
    const payment = await this.findOrRestorePayment(
      yookassaPaymentId,
      verifiedPayment,
      correlationId
    );

    if (!payment) {
      throw new Error("Payment not found and restoration failed");
    }

    // Decision Point 4: Update status if needed (idempotent)
    const statusUpdateResult = await this.updatePaymentStatus(
      payment.id,
      verifiedPayment.status,
      verifiedPayment,
      correlationId
    );

    return {
      processed: true,
      restored: payment.id !== undefined, // Will be set if restored
      statusUpdated: statusUpdateResult.updated,
      paymentId: payment.id,
    };
  }

  /**
   * Decision Point 1: Verify payment with YooKassa (source of truth)
   * Returns null if payment not found (fake webhook)
   */
  private async verifyPaymentWithYooKassa(
    yookassaPaymentId: string,
    correlationId: string
  ): Promise<YooKassaPaymentResponse | null> {
    logger.debug(
      {
        correlationId,
        yookassaPaymentId,
      },
      "Verifying payment with YooKassa (source of truth)"
    );

    const verifiedPayment = await this.yookassaService.getPayment(
      yookassaPaymentId,
      correlationId
    );

    if (!verifiedPayment) {
      logger.warn(
        {
          correlationId,
          yookassaPaymentId,
        },
        "Webhook ignored: payment not found in YooKassa (fake webhook)"
      );
      return null;
    }

    logger.debug(
      {
        correlationId,
        yookassaPaymentId,
        verifiedStatus: verifiedPayment.status,
        verifiedPaid: verifiedPayment.paid,
      },
      "Payment verified with YooKassa"
    );

    return verifiedPayment;
  }

  /**
   * Decision Point 2: Validate status match
   * Returns false if webhook status doesn't match verified status (suspicious webhook)
   */
  private validateStatusMatch(
    webhookStatus: string,
    verifiedStatus: string,
    yookassaPaymentId: string,
    correlationId: string
  ): boolean {
    if (webhookStatus !== verifiedStatus) {
      logger.warn(
        {
          correlationId,
          yookassaPaymentId,
          webhookStatus,
          verifiedStatus,
        },
        "Webhook ignored: status mismatch (suspicious webhook)"
      );
      return false;
    }

    logger.debug(
      {
        correlationId,
        yookassaPaymentId,
        status: verifiedStatus,
      },
      "Status match validated"
    );

    return true;
  }

  /**
   * Decision Point 3: Find or restore payment locally
   * Returns payment if found or restored, null if restoration failed
   */
  private async findOrRestorePayment(
    yookassaPaymentId: string,
    verifiedPayment: YooKassaPaymentResponse,
    correlationId: string
  ): Promise<Awaited<ReturnType<IPaymentRepository["findByYooKassaId"]>> | null> {
    logger.debug(
      {
        correlationId,
        yookassaPaymentId,
      },
      "Checking if payment exists locally"
    );

    const payment = await this.paymentRepository.findByYooKassaId(yookassaPaymentId);

    if (payment) {
      logger.debug(
        {
          correlationId,
          yookassaPaymentId,
          paymentId: payment.id,
        },
        "Payment found locally"
      );
      return payment;
    }

    // Payment missing locally - restore from YooKassa
    logger.info(
      {
        correlationId,
        yookassaPaymentId,
      },
      "Payment missing locally, restoring from YooKassa"
    );

    const restoreResult = await this.restorePayment(verifiedPayment, correlationId);

    if (!restoreResult.success) {
      logger.error(
        {
          correlationId,
          yookassaPaymentId,
          error: restoreResult.error,
        },
        "Failed to restore payment from YooKassa"
      );
      return null;
    }

    logger.info(
      {
        correlationId,
        yookassaPaymentId,
        paymentId: restoreResult.payment!.id,
      },
      "Payment restored from YooKassa"
    );

    return restoreResult.payment!;
  }

  /**
   * Restore payment from YooKassa data
   * Handles unique constraint conflicts (race-safe)
   * 
   * @param yookassaPayment - Verified payment from YooKassa
   * @param correlationId - Correlation ID for logging
   * @returns Restore result
   */
  private async restorePayment(
    yookassaPayment: YooKassaPaymentResponse,
    correlationId: string
  ): Promise<{ success: boolean; payment?: Awaited<ReturnType<IPaymentRepository["findByYooKassaId"]>>; error?: string }> {
    // Extract userId from metadata (required for restoration)
    const userId = yookassaPayment.metadata?.userId;
    if (!userId) {
      return {
        success: false,
        error: "Cannot restore payment: userId missing in metadata",
      };
    }

    try {
      // Create payment from YooKassa data
      await this.paymentRepository.create({
        userId,
        yookassaPaymentId: yookassaPayment.id,
        amount: parseFloat(yookassaPayment.amount.value),
        currency: yookassaPayment.amount.currency,
        status: this.mapYooKassaStatus(yookassaPayment.status),
        paid: yookassaPayment.paid,
        confirmationUrl: yookassaPayment.confirmation?.confirmation_url,
        confirmationType: yookassaPayment.confirmation?.type,
        paymentMethodType: yookassaPayment.payment_method?.type,
        description: yookassaPayment.description,
        metadata: yookassaPayment.metadata,
        // Set cancellation details if payment is canceled
        ...(yookassaPayment.status === "canceled" && yookassaPayment.cancellation_details
          ? {
              cancellationParty: yookassaPayment.cancellation_details.party,
              cancellationReason: yookassaPayment.cancellation_details.reason,
            }
          : {}),
      });

      // Re-read payment to handle potential race condition
      // (if payment was created between our check and create)
      const restoredPayment = await this.paymentRepository.findByYooKassaId(
        yookassaPayment.id
      );

      if (!restoredPayment) {
        return {
          success: false,
          error: "Payment not found after restoration",
        };
      }

      logger.info(
        {
          correlationId,
          paymentId: restoredPayment.id,
          yookassaPaymentId: yookassaPayment.id,
        },
        "Payment restored from YooKassa"
      );

      return {
        success: true,
        payment: restoredPayment,
      };
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.includes("already exists")
      ) {
        // Payment was created by another request - re-read it
        logger.info(
          {
            correlationId,
            yookassaPaymentId: yookassaPayment.id,
          },
          "Payment already exists (race condition), re-reading"
        );

        const existingPayment = await this.paymentRepository.findByYooKassaId(
          yookassaPayment.id
        );

        if (existingPayment) {
          return {
            success: true,
            payment: existingPayment,
          };
        }
      }

      logger.error(
        {
          correlationId,
          yookassaPaymentId: yookassaPayment.id,
          error,
        },
        "Failed to restore payment from YooKassa"
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update payment status using state machine
   * Idempotent: no-op if status is already final or matches
   * Delegates to PaymentsService.updatePaymentStatus
   * 
   * @param paymentId - Internal payment ID
   * @param newStatus - New status from YooKassa
   * @param yookassaPayment - Full payment data from YooKassa
   * @param correlationId - Correlation ID for logging
   * @returns Update result
   */
  private async updatePaymentStatus(
    paymentId: string,
    newStatus: YooKassaPaymentResponse["status"],
    yookassaPayment: YooKassaPaymentResponse,
    correlationId: string
  ): Promise<{ updated: boolean }> {
    // Map YooKassa status to domain status
    const domainStatus = this.mapYooKassaStatus(newStatus);

    // Delegate to PaymentsService for state machine logic
    return await this.paymentsService.updatePaymentStatus(
      paymentId,
      domainStatus,
      yookassaPayment,
      correlationId
    );
  }

  /**
   * Map YooKassa status to domain status
   */
  private mapYooKassaStatus(
    status: YooKassaPaymentResponse["status"]
  ): PaymentStatus {
    switch (status) {
      case "pending":
        return "pending";
      case "succeeded":
        return "succeeded";
      case "canceled":
        return "canceled";
      default:
        return "pending";
    }
  }
}

