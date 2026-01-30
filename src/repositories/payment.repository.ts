import { PrismaClient, Prisma } from "../../prisma/generated/prisma/client";
import { PaymentStatus } from "../types/payment.types";

/**
 * Payment repository
 * Provides data access methods for Payment entity
 */
export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new payment record
   * @param data - Payment data
   * @returns Created payment
   * @throws Error if yookassa_payment_id already exists (unique constraint violation)
   */
  async create(data: {
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
  }) {
    try {
      return await this.prisma.payment.create({
        data: {
          userId: data.userId,
          yookassaPaymentId: data.yookassaPaymentId,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          paid: data.paid,
          confirmationUrl: data.confirmationUrl,
          confirmationType: data.confirmationType,
          paymentMethodType: data.paymentMethodType,
          description: data.description,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      // Handle unique constraint violation on yookassa_payment_id
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002" &&
        "meta" in error &&
        error.meta &&
        typeof error.meta === "object" &&
        "target" in error.meta &&
        Array.isArray(error.meta.target) &&
        error.meta.target.includes("yookassa_payment_id")
      ) {
        throw new Error(
          `Payment with yookassa_payment_id ${data.yookassaPaymentId} already exists`
        );
      }
      throw error;
    }
  }

  /**
   * Find payment by YooKassa payment ID
   * @param yookassaPaymentId - YooKassa payment ID
   * @returns Payment if found, null otherwise
   */
  async findByYooKassaId(yookassaPaymentId: string) {
    return await this.prisma.payment.findUnique({
      where: { yookassaPaymentId },
    });
  }

  /**
   * Find payment by internal ID
   * @param id - Payment internal ID (UUID)
   * @returns Payment if found, null otherwise
   */
  async findById(id: string) {
    return await this.prisma.payment.findUnique({
      where: { id },
    });
  }

  /**
   * Update payment status and related fields
   * Used for idempotent status updates via state machine
   * @param id - Payment internal ID (UUID)
   * @param data - Update data (status, paid, cancellation details, etc.)
   * @returns Updated payment
   */
  async updateStatus(
    id: string,
    data: {
      status: PaymentStatus;
      paid: boolean;
      cancellationParty?: string;
      cancellationReason?: string;
      canceledAt?: Date;
      capturedAt?: Date;
    }
  ) {
    return await this.prisma.payment.update({
      where: { id },
      data: {
        status: data.status,
        paid: data.paid,
        cancellationParty: data.cancellationParty,
        cancellationReason: data.cancellationReason,
        canceledAt: data.canceledAt,
        capturedAt: data.capturedAt,
      },
    });
  }
}

