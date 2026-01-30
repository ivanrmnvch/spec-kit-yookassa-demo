import {
  YooKassaCreatePaymentRequest,
  YooKassaPaymentResponse,
} from "../../types/yookassa.types";

/**
 * Interface for YooKassa service operations
 * Enables dependency injection of YooKassa service through Dependency Inversion Principle
 */
export interface IYookassaService {
  /**
   * Create a payment in YooKassa
   * @param request - Payment creation request
   * @param idempotenceKey - UUID v4 idempotency key
   * @returns Payment response from YooKassa
   * @throws AxiosError if request fails
   */
  createPayment(
    request: YooKassaCreatePaymentRequest,
    idempotenceKey: string
  ): Promise<YooKassaPaymentResponse>;

  /**
   * Get payment from YooKassa by ID
   * Used for webhook verification (source of truth)
   * @param paymentId - YooKassa payment ID
   * @param correlationId - Correlation ID for logging
   * @returns YooKassa payment response, or null if not found
   * @throws AxiosError if request fails (except 404)
   */
  getPayment(
    paymentId: string,
    correlationId?: string
  ): Promise<YooKassaPaymentResponse | null>;
}

