import { CreatePaymentRequest } from "../../middlewares/validation";
import { PaymentStatus } from "../../types/payment.types";
import { YooKassaPaymentResponse } from "../../types/yookassa.types";

/**
 * Payment service response for createPayment
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
 * Payment service response for getPaymentById
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

/**
 * Interface for payment service operations
 * Enables dependency injection of payment service through Dependency Inversion Principle
 */
export interface IPaymentsService {
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
  createPayment(
    request: CreatePaymentRequest,
    idempotenceKey: string
  ): Promise<{ payment: CreatePaymentResponse; isNew: boolean }>;

  /**
   * Get payment by internal ID
   * Maps database payment to API response format, including cancellation_details for canceled payments
   * @param id - Payment internal ID (UUID)
   * @returns Payment response if found, null otherwise
   */
  getPaymentById(id: string): Promise<GetPaymentResponse | null>;

  /**
   * Update payment status
   * Updates payment status using state machine (idempotent)
   * @param paymentId - Payment internal ID (UUID)
   * @param newStatus - New status from YooKassa
   * @param yookassaPayment - Full payment data from YooKassa (for cancellation details, etc.)
   * @param correlationId - Correlation ID for logging
   * @returns Update result
   */
  updatePaymentStatus(
    paymentId: string,
    newStatus: PaymentStatus,
    yookassaPayment: YooKassaPaymentResponse,
    correlationId: string
  ): Promise<{ updated: boolean }>;
}

