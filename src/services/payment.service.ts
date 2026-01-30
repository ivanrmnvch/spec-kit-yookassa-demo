import { AxiosError } from "axios";

import { IdempotencyRecord } from "./idempotency.service";
import { IPaymentRepository } from "../interfaces/repositories/IPaymentRepository";
import { IUserRepository } from "../interfaces/repositories/IUserRepository";
import { PaymentStateMachine } from "./payment-state-machine";
import { Payment } from "../../prisma/generated/prisma/client";
import { hashRequest } from "../utils/request-hash";
import { logger } from "../utils/logger";
import { CreatePaymentRequest } from "../middlewares/validation";
import { YooKassaCreatePaymentRequest, YooKassaPaymentResponse } from "../types/yookassa.types";
import { PaymentStatus } from "../types/payment.types";
import { RetryableUpstreamError } from "../types/errors";
import { IIdempotencyService } from "./interfaces/idempotency-service.interface";
import { IYookassaService } from "./interfaces/yookassa-service.interface";

/**
 * Payment service response
 */
export interface CreatePaymentResponse {
  id: string;
  yookassa_payment_id: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  paid: boolean;
  confirmation_url?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Payment service
 * Orchestrates payment creation flow
 */
export class PaymentsService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly paymentRepository: IPaymentRepository,
    private readonly idempotencyService: IIdempotencyService,
    private readonly yookassaService: IYookassaService
  ) {}

  /**
   * Create a payment
   * Orchestrates the complete payment creation flow:
   * 1. Validate user exists
   * 2. Check idempotency (cache hit/miss/conflict)
   * 3. Create payment in YooKassa
   * 4. Save payment to database
   * 5. Cache response in Redis for idempotency
   *
   * @param request - Create payment request
   * @param idempotenceKey - UUID v4 idempotency key
   * @returns Payment response and whether it was created (true) or retrieved from cache (false)
   */
  async createPayment(
    request: CreatePaymentRequest,
    idempotenceKey: string
  ): Promise<{ payment: CreatePaymentResponse; isNew: boolean }> {
    const correlationId = `payment-${idempotenceKey}`;

    // Step 1: Check if user exists
    const userExists = await this.userRepository.existsById(request.userId);
    if (!userExists) {
      logger.warn({ correlationId, userId: request.userId }, "User not found");
      const error = new Error("User not found") as Error & { statusCode?: number };
      error.statusCode = 404;
      (error as Error & { code?: string }).code = "USER_NOT_FOUND";
      throw error;
    }

    // Step 2: Check idempotency
    const requestHash = hashRequest(request);
    const idempotencyRecord = await this.idempotencyService.get(idempotenceKey);

    // Check for hash conflict
    if (idempotencyRecord && idempotencyRecord.requestHash !== requestHash) {
      logger.warn(
        { correlationId, idempotenceKey },
        "Idempotency key conflict: different request hash"
      );
      const error = new Error(
        "Idempotency key conflict: request body does not match previous request"
      ) as Error & { statusCode?: number };
      error.statusCode = 409;
      (error as Error & { code?: string }).code = "IDEMPOTENCY_CONFLICT";
      throw error;
    }

    // If idempotency record exists with same hash, return cached response (idempotent replay)
    if (idempotencyRecord) {
      logger.info({ correlationId, idempotenceKey }, "Returning cached payment from idempotency");
      return this.mapCachedPaymentToResponse(idempotencyRecord.payment);
    }

    // Step 3: Create payment in YooKassa
    const yookassaRequest: YooKassaCreatePaymentRequest = {
      amount: {
        value: request.amount.value,
        currency: request.amount.currency,
      },
      capture: true, // One-stage payment
      confirmation: {
        type: "redirect",
        return_url: request.returnUrl,
      },
      description: request.description,
      metadata: request.metadata,
    };

    let yookassaResponse: YooKassaPaymentResponse;
    try {
      yookassaResponse = await this.yookassaService.createPayment(yookassaRequest, idempotenceKey);
    } catch (error) {
      logger.error({ err: error, correlationId, idempotenceKey }, "Failed to create payment in YooKassa");

      // Map timeout/5xx errors to RetryableUpstreamError (503)
      // Check for AxiosError by checking for AxiosError properties
      const isAxiosError =
        error &&
        typeof error === "object" &&
        ("isAxiosError" in error || "code" in error || "response" in error);

      if (isAxiosError) {
        const axiosErr = error as AxiosError;
        
        // Check for timeout errors
        if (axiosErr.code === "ECONNABORTED" || axiosErr.code === "ETIMEDOUT") {
          throw new RetryableUpstreamError("YooKassa request timeout");
        }
        
        // Check for 5xx errors
        if (axiosErr.response && axiosErr.response.status >= 500 && axiosErr.response.status < 600) {
          throw new RetryableUpstreamError(
            `YooKassa service error: ${axiosErr.response.status} ${axiosErr.response.statusText}`
          );
        }
      }

      // Re-throw other errors as-is
      throw error;
    }

    // Step 4: Map YooKassa status to domain status
    const domainStatus: PaymentStatus =
      yookassaResponse.status === "pending"
        ? "pending"
        : yookassaResponse.status === "succeeded"
          ? "succeeded"
          : "canceled";

    // Step 5: Save payment to database
    const payment: Payment = await this.paymentRepository.create({
      userId: request.userId,
      yookassaPaymentId: yookassaResponse.id,
      amount: parseFloat(yookassaResponse.amount.value),
      currency: yookassaResponse.amount.currency,
      status: domainStatus,
      paid: yookassaResponse.paid,
      confirmationUrl: yookassaResponse.confirmation?.confirmation_url,
      confirmationType: yookassaResponse.confirmation?.type,
      paymentMethodType: yookassaResponse.payment_method?.type,
      description: yookassaResponse.description,
      metadata: yookassaResponse.metadata,
    });

    // Step 6: Cache in Redis for idempotency
    await this.idempotencyService.set(idempotenceKey, requestHash, {
      id: payment.id,
      yookassa_payment_id: payment.yookassaPaymentId,
      status: payment.status,
      amount: yookassaResponse.amount.value,
      currency: yookassaResponse.amount.currency,
      paid: payment.paid,
      confirmation_url: payment.confirmationUrl || undefined,
      metadata: payment.metadata as Record<string, unknown> | undefined,
      created_at: payment.createdAt.toISOString(),
      updated_at: payment.updatedAt.toISOString(),
    });

    logger.info(
      {
        correlationId,
        idempotenceKey,
        paymentId: payment.id,
        yookassaPaymentId: payment.yookassaPaymentId,
      },
      "Payment created successfully"
    );

    return {
      payment: {
        id: payment.id,
        yookassa_payment_id: payment.yookassaPaymentId,
        status: payment.status as PaymentStatus,
        amount: yookassaResponse.amount.value,
        currency: yookassaResponse.amount.currency,
        paid: payment.paid,
        confirmation_url: payment.confirmationUrl || undefined,
        metadata: payment.metadata as Record<string, unknown> | undefined,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
      },
      isNew: true,
    };
  }

  /**
   * Map cached payment from Redis to response format
   */
  private mapCachedPaymentToResponse(
    cachedPayment: IdempotencyRecord["payment"]
  ): { payment: CreatePaymentResponse; isNew: boolean } {
    return {
      payment: {
        id: cachedPayment.id as string,
        yookassa_payment_id: cachedPayment.yookassa_payment_id as string,
        status: cachedPayment.status as PaymentStatus,
        amount: cachedPayment.amount as string,
        currency: cachedPayment.currency as string,
        paid: cachedPayment.paid as boolean,
        confirmation_url: cachedPayment.confirmation_url as string | undefined,
        metadata: cachedPayment.metadata as Record<string, unknown> | undefined,
        created_at: new Date(cachedPayment.created_at as string),
        updated_at: new Date(cachedPayment.updated_at as string),
      },
      isNew: false,
    };
  }

  /**
   * Get payment by internal ID
   * Maps database payment to API response format, including cancellation_details for canceled payments
   * @param id - Payment internal ID (UUID)
   * @returns Payment response if found, null otherwise
   */
  async getPaymentById(id: string): Promise<GetPaymentResponse | null> {
    const payment: Payment | null = await this.paymentRepository.findById(id);

    if (!payment) {
      return null;
    }

    return this.mapPaymentToResponse(payment);
  }

  /**
   * Map database payment entity to API response format
   * Includes cancellation_details for canceled payments
   */
  private mapPaymentToResponse(
    payment: Payment | null
  ): GetPaymentResponse {
    if (!payment) {
      throw new Error("Payment is null");
    }

    const response: GetPaymentResponse = {
      id: payment.id,
      yookassa_payment_id: payment.yookassaPaymentId,
      status: payment.status as PaymentStatus,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      paid: payment.paid,
      confirmation_url: payment.confirmationUrl || undefined,
      metadata: payment.metadata as Record<string, unknown> | undefined,
      created_at: payment.createdAt,
      updated_at: payment.updatedAt,
    };

    // Include cancellation_details for canceled payments
    if (payment.status === "canceled" && payment.cancellationParty && payment.cancellationReason) {
      response.cancellation_details = {
        party: payment.cancellationParty,
        reason: payment.cancellationReason,
      };
    }

    return response;
  }

  /**
   * Update payment status using state machine
   * Idempotent: no-op if status is already final or matches
   * 
   * @param paymentId - Internal payment ID
   * @param newStatus - New status from YooKassa
   * @param yookassaPayment - Full payment data from YooKassa (for cancellation details, etc.)
   * @param correlationId - Correlation ID for logging
   * @returns Update result
   */
  async updatePaymentStatus(
    paymentId: string,
    newStatus: PaymentStatus,
    yookassaPayment: YooKassaPaymentResponse,
    correlationId: string
  ): Promise<{ updated: boolean }> {
    // Get current payment state
    const payment: Payment | null = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new Error(`Payment with id ${paymentId} not found`);
    }

    const currentStatus = payment.status as PaymentStatus;

    // Check if transition is allowed using state machine
    if (!PaymentStateMachine.canTransition(currentStatus, newStatus)) {
      // Final state or invalid transition - idempotent no-op
      logger.debug(
        {
          correlationId,
          paymentId,
          currentStatus,
          newStatus,
        },
        "Status update skipped: invalid transition or final state (idempotent)"
      );
      return { updated: false };
    }

    // Perform transition
    const transitionedStatus = PaymentStateMachine.transition(
      currentStatus,
      newStatus
    );

    // Prepare update data
    const updateData: Parameters<IPaymentRepository["updateStatus"]>[1] = {
      status: transitionedStatus,
      paid: yookassaPayment.paid,
    };

    // Add cancellation details if payment is canceled
    if (transitionedStatus === "canceled" && yookassaPayment.cancellation_details) {
      updateData.cancellationParty = yookassaPayment.cancellation_details.party;
      updateData.cancellationReason = yookassaPayment.cancellation_details.reason;
      updateData.canceledAt = new Date();
    }

    // Add captured_at if payment is succeeded
    if (transitionedStatus === "succeeded" && yookassaPayment.captured_at) {
      updateData.capturedAt = new Date(yookassaPayment.captured_at);
    }

    // Update payment status
    await this.paymentRepository.updateStatus(paymentId, updateData);

    logger.info(
      {
        correlationId,
        paymentId,
        oldStatus: currentStatus,
        newStatus: transitionedStatus,
      },
      "Payment status updated"
    );

    return { updated: true };
  }
}

/**
 * Get payment response (includes cancellation_details for canceled payments)
 */
export interface GetPaymentResponse {
  id: string;
  yookassa_payment_id: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  paid: boolean;
  confirmation_url?: string;
  metadata?: Record<string, unknown>;
  cancellation_details?: {
    party: string;
    reason: string;
  };
  created_at: Date;
  updated_at: Date;
}

