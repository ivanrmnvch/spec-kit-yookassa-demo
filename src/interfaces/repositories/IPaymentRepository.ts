import { Prisma, Payment } from "../../../prisma/generated/prisma/client";
import { PaymentStatus } from "../../types/payment.types";

/**
 * Interface for payment repository operations
 * Enables dependency injection of payment repository through Dependency Inversion Principle
 */
export interface IPaymentRepository {
  /**
   * Create a new payment record
   * @param data - Payment data
   * @returns Created payment
   * @throws Error if yookassa_payment_id already exists (unique constraint violation)
   */
  create(data: {
    userId: string;
    yookassaPaymentId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    paid: boolean;
    confirmationUrl?: string;
    confirmationType?: string;
    paymentMethodType?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Payment>;

  /**
   * Find payment by YooKassa payment ID
   * @param yookassaPaymentId - YooKassa payment ID
   * @returns Payment if found, null otherwise
   */
  findByYooKassaId(yookassaPaymentId: string): Promise<Payment | null>;

  /**
   * Find payment by internal ID
   * @param id - Payment internal ID (UUID)
   * @returns Payment if found, null otherwise
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Update payment status and related fields
   * Used for idempotent status updates via state machine
   * @param id - Payment internal ID (UUID)
   * @param data - Update data (status, paid, cancellation details, etc.)
   * @returns Updated payment
   */
  updateStatus(
    id: string,
    data: {
      status: PaymentStatus;
      paid: boolean;
      cancellationParty?: string;
      cancellationReason?: string;
      canceledAt?: Date;
      capturedAt?: Date;
    }
  ): Promise<Payment>;
}

